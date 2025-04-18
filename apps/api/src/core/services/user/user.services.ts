// src/core/services/user.service.ts
import { db, schema } from '../../db';
import { hashPassword } from '../auth.services';
import { eq, or } from 'drizzle-orm';
import { createUserMetaDefaults } from './userMeta.services';
import { serverHooks } from '../../../core/hooks/hookEngine.server';


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
