// src/core/services/user.service.ts
import { db, schema } from '@vp/core/db';
import { hashPassword } from '@vp/core/services/auth.services';
import { sql, and, or, like, eq, inArray } from 'drizzle-orm';
import { createUserMetaDefaults, setUserMeta, setUserRole } from './userMeta.services';
import { serverHooks } from '@vp/core/hooks/hookEngine.server';


// Correctly define Db/Transaction types
type DbClient = typeof db;
type TransactionClient = Parameters<DbClient['transaction']>[0] extends (client: infer C) => any ? C : never;
type DbOrTrx = DbClient | TransactionClient;

/**
 * Creates a new user and inserts their information into the database.
 * 
 * @param {Object} params - The user information.
 * @param {string} params.user_login - The login username of the user.
 * @param {string} params.user_email - The email of the user.
 * @param {string} params.user_pass - The password of the user.
 * @param {string} params.display_name - The display name of the user.
 * @returns {Promise<Object>} The newly created user record.
 */
export async function createUser({
  user_login,
  user_email,
  user_pass,
  display_name,
}: {
  user_login: string;
  user_email: string;
  user_pass: string;
  display_name: string;
}, dbClient: DbOrTrx = db) {
  await serverHooks.doAction('user.create:before', { user_login, user_email, display_name });

  const hashed = await hashPassword(user_pass);

  const result = await dbClient.transaction(async (trx) => {
    const userResult = await trx.insert(schema.wp_users).values({
      user_login,
      user_email,
      user_pass: hashed,
      display_name,
      user_nicename: user_login.toLowerCase(),
      user_registered: new Date().toISOString(),
      user_url: '',
      user_activation_key: '',
      user_status: 0,
    }).returning();

    await createUserMetaDefaults(userResult[0].ID, {
      nickname: display_name,
    }, trx);

    return userResult;
  });

  console.log('user service:', result[0]);

  await serverHooks.doAction('user.create:after', { user: result[0] });
  return await serverHooks.applyFilters('user.create', result[0]);
}

/**
 * Retrieves a user by their login username or email.
 * 
 * @param {string} identifier - The login username or email of the user.
 * @returns {Promise<Object|null>} The user record, or null if not found.
 */
export async function getUserByLoginOrEmail(identifier: string, dbClient: DbOrTrx = db) {
  await serverHooks.doAction('user.get:before', { identifier });
  const result = await dbClient.select().from(schema.wp_users)
    .where(
      or(
        eq(schema.wp_users.user_login, identifier),
        eq(schema.wp_users.user_email, identifier)
      )
    );
  await serverHooks.doAction('user.get:after', { user: result[0] });
  return await serverHooks.applyFilters('user.get', result[0] || null);
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
  // Apply filter to allow validation/mutation of updates before processing
  updates = await serverHooks.applyFilters('user.update:before', updates, userId);
  
  await serverHooks.doAction('user.update:before', { userId, updates });

  // Separate standard fields, roles, and meta
  const {
    roles,
    meta,
    // Extract potential meta fields passed directly in updates
    first_name,
    last_name,
    nickname,
    description,
    locale,
    ...standardUpdates // Remaining fields intended for wp_users
   } = updates;

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

  let updatedUserResult: (typeof schema.wp_users.$inferSelect)[] = [];

  // Use a transaction for atomicity
  await dbClient.transaction(async (trx) => {
      // 1. Update wp_users table if there are fields to update
      if (Object.keys(userTableFields).length > 0) {
           const result = await trx.update(schema.wp_users)
              .set(userTableFields)
              .where(eq(schema.wp_users.ID, userId))
              .returning();
           if (result.length > 0) {
             updatedUserResult = result;
           } else if (Object.keys(metaUpdates).length === 0 && !roles) {
               // Only throw if nothing else is being updated
               throw new Error(`User with ID ${userId} not found for update.`);
           }
      }

       // Fetch user data if only meta/roles updated OR if wp_users update failed but we continue
       if(updatedUserResult.length === 0 && (Object.keys(metaUpdates).length > 0 || roles)) {
         const existingUser = await trx.select().from(schema.wp_users).where(eq(schema.wp_users.ID, userId));
         if (existingUser.length === 0) {
            throw new Error(`User with ID ${userId} not found.`);
         }
         updatedUserResult = existingUser; // Use existing user data to return
       }

       if (updatedUserResult.length === 0) {
         // Should not happen if logic above is correct, but safeguard
         throw new Error(`Failed to find or update user with ID ${userId}.`);
       }

      // 2. Update roles if provided
      if (roles && Array.isArray(roles) && roles.length > 0) {
          // WP REST API allows multiple roles, but wp_capabilities typically stores one primary.
          // Use the first role provided as the primary role.
          const primaryRole = roles[0];
          await setUserRole(userId, primaryRole, trx); // Pass transaction client
      }

      // 3. Update meta fields if provided
      if (Object.keys(metaUpdates).length > 0) {
          for (const [key, value] of Object.entries(metaUpdates)) {
              await setUserMeta(userId, key, value, trx); // Pass transaction client
          }
      }
  }); // End transaction

  const finalUser = updatedUserResult[0] || null; // Should always have a user if transaction succeeded

  await serverHooks.doAction('user.update:after', { user: finalUser });
  return await serverHooks.applyFilters('user.update', finalUser);
}

/**
 * Delete a user.
 *
 * @param {number} userId - The ID of the user.
 * @returns {Promise<Object|null>} The deleted user record.
 */
export async function deleteUser(userId: number, dbClient: DbOrTrx = db) {
  await serverHooks.doAction('user.delete:before', { userId });
  const result = await dbClient.delete(schema.wp_users)
    .where(eq(schema.wp_users.ID, userId))
    .returning();
  await serverHooks.doAction('user.delete:after', { user: result[0] });
  return await serverHooks.applyFilters('user.delete', result[0] || null);
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
    capabilities,
    who,
    hasPublishedPosts
  } = params;

  await serverHooks.doAction('users.get:before', { params });
  // Start building the query
  let conditions = [];
  if (search) {
    conditions.push(like(schema.wp_users.user_login, `%${search}%`));
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
    user_activation_key: schema.wp_users.user_activation_key,
    user_status: schema.wp_users.user_status,
    display_name: schema.wp_users.display_name
  }).from(schema.wp_users);
  
  // Roles filtering - requires join with usermeta
  if (roles && roles.length) {
    queryBuilder = queryBuilder
      .innerJoin(
        schema.wp_usermeta, 
        eq(schema.wp_users.ID, schema.wp_usermeta.user_id)
      );
    conditions.push(
      and(
        eq(schema.wp_usermeta.meta_key, 'wp_capabilities'),
        like(schema.wp_usermeta.meta_value, `%${roles[0]}%`)
      )
    );
    // For multiple roles, we might need a more complex condition or multiple joins
    // This is a simplified version checking for the first role
  }
  
  // Capabilities filtering - requires join with usermeta
  if (capabilities && capabilities.length) {
    if (!roles || !roles.length) {
      // Only join if we haven't already for roles
      queryBuilder = queryBuilder
        .innerJoin(
          schema.wp_usermeta, 
          eq(schema.wp_users.ID, schema.wp_usermeta.user_id)
        );
    }
    conditions.push(
      and(
        eq(schema.wp_usermeta.meta_key, 'wp_capabilities'),
        like(schema.wp_usermeta.meta_value, `%${capabilities[0]}%`)
      )
    );
    // Similar simplification as roles for multiple capabilities
  }
  
  // Who filtering - maps to specific roles
  if (who === 'authors') {
    if (!roles || !roles.length) {
      queryBuilder = queryBuilder
        .innerJoin(
          schema.wp_usermeta, 
          eq(schema.wp_users.ID, schema.wp_usermeta.user_id)
        );
    }
    conditions.push(
      and(
        eq(schema.wp_usermeta.meta_key, 'wp_capabilities'),
        like(schema.wp_usermeta.meta_value, '%author%')
      )
    );
  }
  
  // hasPublishedPosts filtering - requires checking post count in usermeta or posts table
  // Since posts table isn't available, we'll look for any indicator in usermeta if possible
  if (hasPublishedPosts) {
    if (!roles || !roles.length || !capabilities || !capabilities.length) {
      queryBuilder = queryBuilder
        .innerJoin(
          schema.wp_usermeta, 
          eq(schema.wp_users.ID, schema.wp_usermeta.user_id)
        );
    }
    // This is a placeholder - ideally we'd join with posts table, 
    // but since it's not available we'll assume authors have published posts
    conditions.push(
      and(
        eq(schema.wp_usermeta.meta_key, 'wp_capabilities'),
        like(schema.wp_usermeta.meta_value, '%author%')
      )
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
    default: sortColumn = schema.wp_users.display_name;
  }
  const orderByClause = order === 'desc' ? sql`${sortColumn} DESC` : sql`${sortColumn} ASC`;

  // Pagination
  const actualOffset = typeof offset === 'number' ? offset : (page - 1) * perPage;

  // Build and execute the query
  const query = queryBuilder
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderByClause)
    .limit(perPage)
    .offset(actualOffset);


  const users = await query;
  await serverHooks.doAction('users.get:after', { users });
  return await serverHooks.applyFilters('users.get', users);
}
