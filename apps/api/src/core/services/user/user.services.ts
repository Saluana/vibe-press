// src/core/services/user.service.ts
import { db, schema } from '../../db';
import { hashPassword } from '../auth.services';
import { sql, and, or, like, eq, inArray } from 'drizzle-orm';
import { createUserMetaDefaults } from './userMeta.services';
import { serverHooks } from '../../../core/hooks/hookEngine.server';
import { PgSelect } from 'drizzle-orm/pg-core';

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
}) {
  await serverHooks.doAction('user.create:before', { user_login, user_email, display_name });

  const hashed = await hashPassword(user_pass);

  const result = await db.insert(schema.wp_users).values({
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

  await createUserMetaDefaults(result[0].ID, {
    nickname: display_name,
  });

  await serverHooks.doAction('user.create:after', { user: result[0] });
  return await serverHooks.applyFilters('user.create', result[0]);
}

/**
 * Retrieves a user by their login username or email.
 * 
 * @param {string} identifier - The login username or email of the user.
 * @returns {Promise<Object|null>} The user record, or null if not found.
 */
export async function getUserByLoginOrEmail(identifier: string) {
  await serverHooks.doAction('user.get:before', { identifier });
  const result = await db.select().from(schema.wp_users)
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
 * Update user information.
 *
 * @param {number} userId - The ID of the user.
 * @param {Object} updates - The fields to update.
 * @param {string} [updates.user_login]
 * @param {string} [updates.user_email]
 * @param {string} [updates.user_pass]
 * @param {string} [updates.display_name]
 * @param {string} [updates.user_url]
 * @param {number} [updates.user_status]
 * @returns {Promise<Object|null>} The updated user record.
 */
export async function updateUser(userId: number, updates: {
  user_login?: string;
  user_email?: string;
  user_pass?: string;
  display_name?: string;
  user_url?: string;
  user_status?: number;
}) {
  await serverHooks.doAction('user.update:before', { userId, updates });
  const data: any = { ...updates };
  if (updates.user_pass) {
    data.user_pass = await hashPassword(updates.user_pass);
  }
  const result = await db.update(schema.wp_users)
    .set(data)
    .where(eq(schema.wp_users.ID, userId))
    .returning();
  await serverHooks.doAction('user.update:after', { user: result[0] });
  return await serverHooks.applyFilters('user.update', result[0] || null);
}

/**
 * Delete a user.
 *
 * @param {number} userId - The ID of the user.
 * @returns {Promise<Object|null>} The deleted user record.
 */
export async function deleteUser(userId: number) {
  await serverHooks.doAction('user.delete:before', { userId });
  const result = await db.delete(schema.wp_users)
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
export async function getUsers(params: GetUsersParams) {
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
  let queryBuilder: any = db.select({
    id: schema.wp_users.ID,
    user_login: schema.wp_users.user_login,
    user_pass: schema.wp_users.user_pass,
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
