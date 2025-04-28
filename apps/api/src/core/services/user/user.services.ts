// src/core/services/user.service.ts
import { db, schema } from '@vp/core/db';
import { hashPassword, getUserCapabilities } from '@vp/core/services/auth.services';
import { sql, and, or, like, eq, inArray } from 'drizzle-orm';
import { createUserMetaDefaults, setUserMeta, setUserRole, batchSetUserMeta } from './userMeta.services';
import { serverHooks } from '@vp/core/hooks/hookEngine.server';
import { GetUsersValidation, UpdateUserValidation, CreateUserSchema } from '../../schemas/users.schema';
import { basicUserColumns } from './user.mappers';

// Define a consistent return type for basic user info
export type UserBasicInfo = {
  id: number;
  user_login: string;
  user_nicename: string | null;
  user_email: string | null;
  user_url: string | null;
  user_registered: string | null;
  user_status: number | null;
  display_name: string | null;
};

// Define a type for the user object structure returned by the query (getUsers specific)
type UserQueryResult = UserBasicInfo; // Reuse UserBasicInfo

// Correctly define Db/Transaction types
type DbClient = typeof db;
type TransactionClient = Parameters<DbClient['transaction']>[0] extends (client: infer C) => any ? C : never;
type DbOrTrx = DbClient | TransactionClient;

export const userServices = {
  createUser,
  getUserByLoginOrEmail,
  updateUser,
  deleteUser,
  getUsers
} as const;


/**
 * Creates a new user and inserts their information into the database.
 * 
 * @param {Object} params - The user information.
 * @param {string} params.user_login - The login username of the user.
 * @param {string} params.user_email - The email of the user.
 * @param {string} params.user_pass - The password of the user.
 * @param {string} params.display_name - The display name of the user.
 * @param {string} [params.user_url] - The URL of the user.
 * @param {string} [params.user_nicename] - The nicename of the user.
 * @param {Record<string, any>} [params.meta] - Additional user meta.
 * @param {string[]} [params.roles] - The roles of the user.
 * @returns {Promise<Object>} The newly created user record.
 */
export async function createUser({
  user_login,
  user_email,
  user_pass,
  display_name,
  user_url = '',
  user_nicename,
  meta,
  roles,
}: {
  user_login: string;
  user_email: string;
  user_pass: string;
  display_name: string;
  user_url?: string;
  user_nicename?: string;
  meta?: Record<string, any>;
  roles?: string[];
}, dbClient: DbOrTrx = db) {

  const validation = CreateUserSchema.safeParse({
    user_login,
    user_email,
    user_pass,
    display_name,
    user_url,
    user_nicename,
    meta,
    roles,
  });


  await serverHooks.doAction('svc.user.create:action:before', { user_login, user_email, display_name, meta, roles });

  const hashed = await hashPassword(user_pass);

  const result = await dbClient.transaction(async (trx) => {
    const userResult = await trx.insert(schema.wp_users).values({
      user_login,
      user_email,
      user_pass: hashed,
      display_name,
      user_nicename: user_nicename || user_login.toLowerCase(),
      user_registered: new Date().toISOString(),
      user_url: user_url,
      user_activation_key: '',
      user_status: 0,
    }).returning(basicUserColumns);

    const newUser = userResult[0];

    await createUserMetaDefaults(newUser.id, {
      nickname: display_name,
    }, trx);

    // Set additional meta fields if provided
    if (meta && Object.keys(meta).length > 0) {
      for (const key in meta) {
        if (Object.prototype.hasOwnProperty.call(meta, key)) {
          await setUserMeta(newUser.id, key, meta[key], trx);
        }
      }
    }
    
    // Set roles if provided (using the first role as primary capability)
    if (roles && roles.length > 0) {
      // Assuming setUserRole handles setting wp_capabilities meta
      // We might need a dedicated function if roles need complex handling
      await setUserMeta(newUser.id, 'wp_capabilities', { [roles[0].toLowerCase()]: true }, trx);
      // Set primary role for easy access if needed
      await setUserMeta(newUser.id, 'primary_role', roles[0].toLowerCase(), trx);
    }

    return userResult;
  });

  console.log('user service:', result[0]);

  await serverHooks.doAction('svc.user.create:action:after', { user: result[0] });
  // Ensure the filtered result matches the expected structure if hooks modify it
  // For now, assume hooks return the same structure or cast if necessary.
  return await serverHooks.applyFilters('svc.user.create:filter:result', result[0] as UserBasicInfo);
}

/**
 * Retrieves a user by their login username or email.
 * 
 * @param {string} identifier - The login username or email of the user.
 * @returns {Promise<Object|null>} The user record, or null if not found.
 */
export async function getUserByLoginOrEmail(identifier: string, dbClient: DbOrTrx = db) {
  await serverHooks.doAction('svc.user.get:action:before', { identifier });
  const result = await dbClient.select({
    id: schema.wp_users.ID,
    user_login: schema.wp_users.user_login,
    user_nicename: schema.wp_users.user_nicename,
    user_email: schema.wp_users.user_email,
    user_url: schema.wp_users.user_url,
    user_registered: schema.wp_users.user_registered,
    user_status: schema.wp_users.user_status,
    display_name: schema.wp_users.display_name,
    user_pass: schema.wp_users.user_pass // Needed for auth checks
  }).from(schema.wp_users)
    .where(
      or(
        eq(schema.wp_users.user_login, identifier),
        eq(schema.wp_users.user_email, identifier)
      )
    );
  await serverHooks.doAction('svc.user.get:action:after', { user: result[0] });
  // Return type includes user_pass, define a specific type or cast
  type UserWithPass = UserBasicInfo & { user_pass: string };
  return await serverHooks.applyFilters('svc.user.get:filter:result', result[0] as UserWithPass || null);
}

/**
 * Update user information, including roles and metadata.
 *
 * @param {number} userId - The ID of the user.
 * @param {Object} updates - The fields to update, potentially including standard user fields, roles, and meta.
 * @param {DbOrTrx} [dbClient=db] - Optional database client or transaction.
 * @returns {Promise<Object|null>} The updated user record.
 */
export async function updateUser(userId: number, updates: Record<string, any>, dbClient: DbOrTrx = db) {
  
  const validation = UpdateUserValidation.parse(updates);
  
  // Apply filter to allow validation/mutation of updates before processing
  updates = await serverHooks.applyFilters('svc.user.update:filter:input', updates, userId);
  
  await serverHooks.doAction('svc.user.update:action:before', { userId, updates });

  // Separate standard fields, roles, and meta
  const {
    roles,
    meta,
    first_name,
    last_name,
    nickname,
    description,
    locale,
    ...standardUpdates // Remaining fields intended for wp_users
   } = validation;

  const userTableFields: Partial<typeof schema.wp_users.$inferInsert> = {};
  const metaUpdates: Record<string, any> = meta || {}; // Initialize metaUpdates with passed meta object

  // --- Map standard updates to wp_users fields ---
  if (standardUpdates.user_login !== undefined) userTableFields.user_login = standardUpdates.user_login;
  if (standardUpdates.user_email !== undefined) userTableFields.user_email = standardUpdates.user_email;
  if (standardUpdates.display_name !== undefined) userTableFields.display_name = standardUpdates.display_name;
  if (standardUpdates.user_url !== undefined) userTableFields.user_url = standardUpdates.user_url;
  if (standardUpdates.user_status !== undefined) userTableFields.user_status = standardUpdates.user_status;
  // Handle slug mapping (user_nicename in DB)
  if (standardUpdates.user_nicename !== undefined) userTableFields.user_nicename = standardUpdates.user_nicename;
  // Handle password hashing if present
  if (standardUpdates.user_pass) {
    userTableFields.user_pass = await hashPassword(standardUpdates.user_pass);
    // Clear activation key when password is updated
    userTableFields.user_activation_key = ''; 
}

  // --- Add fields intended for usermeta to the metaUpdates object ---
  if (first_name !== undefined) metaUpdates.first_name = first_name;
  if (last_name !== undefined) metaUpdates.last_name = last_name;
  if (nickname !== undefined) metaUpdates.nickname = nickname;
  if (description !== undefined) metaUpdates.description = description;
  if (locale !== undefined) metaUpdates.locale = locale;

  // Use the defined UserBasicInfo type
  let updatedUserResult: UserBasicInfo[] = [];

  // Use a transaction for atomicity
  await dbClient.transaction(async (trx) => {
      // 1. Update wp_users table if there are fields to update
      if (Object.keys(userTableFields).length > 0) {
           const result = await trx.update(schema.wp_users)
              .set(userTableFields)
              .where(eq(schema.wp_users.ID, userId))
              .returning(basicUserColumns);
           if (result.length > 0) {
             updatedUserResult = result;
           } else if (Object.keys(metaUpdates).length === 0 && !roles) {
               // Only throw if nothing else is being updated
               throw new Error(`User with ID ${userId} not found for update.`);
           }
      }

       // Fetch user data if only meta/roles updated OR if wp_users update failed but we continue
       if(updatedUserResult.length === 0 && (Object.keys(metaUpdates).length > 0 || roles)) {
         const existingUser = await trx.select({
            id: schema.wp_users.ID,
            user_login: schema.wp_users.user_login,
            user_nicename: schema.wp_users.user_nicename,
            user_email: schema.wp_users.user_email,
            user_url: schema.wp_users.user_url,
            user_registered: schema.wp_users.user_registered,
            user_status: schema.wp_users.user_status,
            display_name: schema.wp_users.display_name,
         }).from(schema.wp_users).where(eq(schema.wp_users.ID, userId));
         if (existingUser.length === 0) {
            throw new Error(`User with ID ${userId} not found.`);
         }
         updatedUserResult = existingUser; // Use existing user data to return
       }

      // 2. Update roles if provided
      if (roles && Array.isArray(roles) && roles.length > 0) {
          // WP REST API allows multiple roles, but wp_capabilities typically stores one primary.
          // Use the first role provided as the primary role.
          const primaryRole = roles[0];
          await setUserRole(userId, primaryRole, trx); // Pass transaction client
      }

      // 4. Batch update meta fields if provided
      if (Object.keys(metaUpdates).length > 0) {
        await batchSetUserMeta(userId, metaUpdates, trx); // Pass transaction client
      }


  }); // End transaction

  // Use the defined UserBasicInfo type
  const finalUser: UserBasicInfo | null = updatedUserResult[0] || null;

  await serverHooks.doAction('svc.user.update:action:after', { user: finalUser });
  // Ensure the filtered result matches the expected structure
  return await serverHooks.applyFilters('svc.user.update:filter:result', finalUser as UserBasicInfo | null);
}


/**
 * Delete a user.
 *
 * @param {number} userId - The ID of the user.
 * @returns {Promise<Object|null>} The deleted user record.
 */
export async function deleteUser(userId: number, dbClient: DbOrTrx = db) {
  await serverHooks.doAction('svc.user.delete:action:before', { userId });
  const result = await dbClient.delete(schema.wp_users)
    .where(eq(schema.wp_users.ID, userId))
    .returning(basicUserColumns);
  await serverHooks.doAction('svc.user.delete:action:after', { user: result[0] });
  // Ensure the filtered result matches the expected structure
  return await serverHooks.applyFilters('svc.user.delete:filter:result', result[0] as UserBasicInfo || null);
}

export type GetUsersParams = {
  context?: 'view' | 'embed' | 'edit';
  page?: number;
  perPage?: number;
  search?: string;
  exclude?: number[];
  include?: number[];
  offset?: number;
  order?: 'asc' | 'desc';
  orderBy?:
    | 'id'
    | 'include'
    | 'name'
    | 'registered_date'
    | 'slug'
    | 'include_slugs'
    | 'email'
    | 'url';
  slug?: string[];
  roles?: string[];
  capabilities?: string[];
  who?: 'authors';
  hasPublishedPosts?: boolean;
};

/**
 * Retrieves users based on various query parameters (pagination, search, sorting, filtering, etc).
 * @param params - The parameters to filter, sort, and paginate users.
 * @returns A list of users matching the query.
 */
export async function getUsers(params: GetUsersParams, dbClient: DbOrTrx = db) {

  const validatedParams = GetUsersValidation.parse(params);
  
  const {
    context = 'view',
    page = 1,
    perPage = 10,
    search,
    exclude,
    include,
    offset,
    order = 'asc',
    orderBy = 'name',
    slug,
    roles,
    capabilities, // Keep param
    who,
    hasPublishedPosts
  } = params;

  await serverHooks.doAction('svc.users.get:action:before', { params });
  // Start building the query
  let conditions = [];
  let needsMetaJoin = false; // Flag to track if join is needed

  if (search) {
    // Search across multiple fields potentially
    conditions.push(
      or(
        like(schema.wp_users.user_login, `%${search}%`),
        like(schema.wp_users.user_email, `%${search}%`),
        like(schema.wp_users.display_name, `%${search}%`)
      )
    );
  }
  if (exclude && exclude.length) {
    conditions.push(sql`${schema.wp_users.ID} NOT IN (${exclude.join(',')})`);
  }
  if (include && include.length) {
    conditions.push(inArray(schema.wp_users.ID, include));
  }
  if (slug && slug.length) {
    conditions.push(inArray(schema.wp_users.user_nicename, slug));
  }
  
  // Initialize query builder
  let queryBuilder: any = dbClient.select({
    id: schema.wp_users.ID,
    user_login: schema.wp_users.user_login,
    user_nicename: schema.wp_users.user_nicename,
    user_email: schema.wp_users.user_email,
    user_url: schema.wp_users.user_url,
    user_registered: schema.wp_users.user_registered,
    // user_activation_key: schema.wp_users.user_activation_key, // Often excluded for security
    user_status: schema.wp_users.user_status,
    display_name: schema.wp_users.display_name
  }).from(schema.wp_users);
  
  // Roles filtering - requires join with usermeta
  if (roles && roles.length) {
    needsMetaJoin = true; // Mark that we need the join
    // Simple check for the first role using LIKE (can be improved for accuracy/multiple roles)
    conditions.push(
      and(
        eq(schema.wp_usermeta.meta_key, 'wp_capabilities'),
        like(sql`${schema.wp_usermeta.meta_value}::text`, `%"${roles[0]}"%`) // Cast meta_value to text for LIKE
      )
    );
  }
  
  // Who filtering - maps to specific roles
  if (who === 'authors') {
    needsMetaJoin = true;
    conditions.push(
      and(
        eq(schema.wp_usermeta.meta_key, 'wp_capabilities'),
        like(sql`${schema.wp_usermeta.meta_value}::text`, '%"author"%') // Cast meta_value to text for LIKE
      )
    );
  }
  
  // hasPublishedPosts filtering - Placeholder logic remains
  if (hasPublishedPosts) {
     needsMetaJoin = true;
    // This is a placeholder - ideally we'd join with posts table
    conditions.push(
      and(
        eq(schema.wp_usermeta.meta_key, 'wp_capabilities'),
        like(sql`${schema.wp_usermeta.meta_value}::text`, '%"author"%') // Cast meta_value to text for LIKE
      )
    );
  }

  // Add the join only if needed by any filter
  if (needsMetaJoin) {
      queryBuilder = queryBuilder
        .innerJoin(
          schema.wp_usermeta, 
          eq(schema.wp_users.ID, schema.wp_usermeta.user_id)
        );
  }

  // Sorting
  let sortColumn;
  switch (orderBy) {
    case 'id': sortColumn = schema.wp_users.ID; break;
    case 'name': sortColumn = schema.wp_users.display_name; break;
    case 'registered_date': sortColumn = schema.wp_users.user_registered; break;
    case 'slug': sortColumn = schema.wp_users.user_nicename; break;
    case 'email': sortColumn = schema.wp_users.user_email; break;
    case 'url': sortColumn = schema.wp_users.user_url; break;
    // case 'include': sortColumn = sql`FIELD(${schema.wp_users.ID}, ${include ? include.join(',') : ''})`; break; // Needs careful handling if include is empty
    default: sortColumn = schema.wp_users.display_name;
  }
  const orderByClause = order === 'desc' ? sql`${sortColumn} DESC` : sql`${sortColumn} ASC`;
  // Handle include order separately if needed
  // if (orderBy === 'include' && include && include.length) {
  //   orderByClause = sql`FIELD(${schema.wp_users.ID}, ${include.join(',')})`
  // }


  // Pagination
  const actualOffset = typeof offset === 'number' ? offset : (page - 1) * perPage;

  // Build and execute the initial query
  const query = queryBuilder
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderByClause)
    .limit(perPage)
    .offset(actualOffset)
    .groupBy(schema.wp_users.ID); // Group by user ID to avoid duplicates from join


  let users: UserQueryResult[] = await query; // Add type here

  // Post-fetch filtering for capabilities (if requested)
  if (capabilities && capabilities.length && users.length > 0) {
    const normalizedRequiredCaps = capabilities.map(cap => cap.toLowerCase());

    // Use Promise.all for potentially concurrent capability checks
    const userCapabilityChecks = await Promise.all(
        users.map(async (user: UserQueryResult) => { // Add type here
            const userCapsMap = await getUserCapabilities(user.id, dbClient); // Use helper, returns lowercase keys
            const hasAllRequired = normalizedRequiredCaps.every(reqCap => userCapsMap[reqCap] === true);
            return { user, hasAllRequired };
        })
    );

    // Filter the users based on the check results
    users = userCapabilityChecks
        .filter(result => result.hasAllRequired)
        .map(result => result.user);
  }


  await serverHooks.doAction('svc.users.get:action:after', { users });
  return await serverHooks.applyFilters('svc.users.get:filter:result', users);
}
