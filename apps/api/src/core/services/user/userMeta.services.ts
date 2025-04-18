import { db, schema } from "../../db";
import { eq, and } from 'drizzle-orm';
import { serverHooks } from '../../../core/hooks/hookEngine.server';
import type { NodePgDatabase, NodePgTransaction } from 'drizzle-orm/node-postgres';



// Correctly define Db/Transaction types
type DbClient = typeof db;
type TransactionClient = Parameters<DbClient['transaction']>[0] extends (client: infer C) => any ? C : never;
type DbOrTrx = DbClient | TransactionClient;

/**
 * Create default user meta entries for a new user.
 * 
 * @param {number} userId - The ID of the user.
 * @param {Object} overrides - The meta values to override.
 * @param {string} [overrides.nickname] - User's nickname.
 * @param {string} [overrides.first_name] - User's first name.
 * @param {string} [overrides.last_name] - User's last name.
 * @param {string} [overrides.description] - User's description.
 * @param {string} [overrides.locale] - User's locale.
 * @param {'subscriber' | 'contributor' | 'author' | 'editor' | 'administrator'} [overrides.role] - User's role.
 */
export async function createUserMetaDefaults(userId: number, overrides: { 
  nickname?: string; 
  first_name?: string; 
  last_name?: string; 
  description?: string; 
  locale?: string; 
  role?: 'subscriber' | 'contributor' | 'author' | 'editor' | 'administrator'; 
}, dbClient: DbOrTrx = db) {
  await serverHooks.doAction('userMeta.create:before', { userId, overrides });
  const role = overrides.role || 'subscriber';

  const metaValues = [
    {
      meta_key: 'wp_capabilities',
      meta_value: { [role]: true },
    },
    {
      meta_key: 'wp_user_level',
      meta_value: 0,
    },
    {
      meta_key: 'nickname',
      meta_value: overrides.nickname ?? '',
    },
    {
      meta_key: 'first_name',
      meta_value: overrides.first_name ?? '',
    },
    {
      meta_key: 'last_name',
      meta_value: overrides.last_name ?? '',
    },
    {
      meta_key: 'description',
      meta_value: overrides.description ?? '',
    },
    {
      meta_key: 'locale',
      meta_value: overrides.locale ?? 'en_US',
    },
  ];

  await dbClient.insert(schema.wp_usermeta).values(
    metaValues.map(meta => ({
      user_id: userId,
      meta_key: meta.meta_key,
      meta_value: meta.meta_value,
    }))
  );
  await serverHooks.doAction('userMeta.create:after', { userId, overrides });
}

/**
 * Retrieve user meta data.
 * 
 * @param {number} userId - The ID of the user.
 * @param {string} [metaKey] - Specific meta key to retrieve.
 * @returns {Promise<any>} The meta data for the user.
 */
export async function getUserMeta(userId: number, metaKey?: string, dbClient: DbOrTrx = db) {
  await serverHooks.doAction('userMeta.get:before', { userId, metaKey });
  let result;
  if (metaKey) {
    result = await dbClient.select().from(schema.wp_usermeta)
      .where(and(
        eq(schema.wp_usermeta.user_id, userId),
        eq(schema.wp_usermeta.meta_key, metaKey)
      ));
  } else {
    result = await db.select().from(schema.wp_usermeta)
      .where(eq(schema.wp_usermeta.user_id, userId));
  }
  await serverHooks.doAction('userMeta.get:after', { userId, metaKey, result });
  return await serverHooks.applyFilters('userMeta.get', result);
}

/**
 * Update or insert a user meta value (upsert).
 * 
 * @param {number} userId - The ID of the user.
 * @param {string} metaKey - The meta key to update or insert.
 * @param {any} metaValue - The value to set for the meta key.
 */
export async function setUserMeta(userId: number, metaKey: string, metaValue: any, dbClient: DbOrTrx = db) {
  serverHooks.doAction('userMeta.set:before', { userId, metaKey, metaValue });
  const updated = await dbClient.update(schema.wp_usermeta)
    .set({ meta_value: metaValue })
    .where(and(
      eq(schema.wp_usermeta.user_id, userId),
      eq(schema.wp_usermeta.meta_key, metaKey)
    ));
  if (updated.rowCount === 0) {
    await db.insert(schema.wp_usermeta).values({ user_id: userId, meta_key: metaKey, meta_value: metaValue });
  }
  await serverHooks.doAction('userMeta.set:after', { userId, metaKey, metaValue });
}

/**
 * Delete a user meta value.
 * 
 * @param {number} userId - The ID of the user.
 * @param {string} metaKey - The meta key to delete.
 * @returns {Promise<any>} The result of the delete operation.
 */
export async function deleteUserMeta(userId: number, metaKey: string, dbClient: DbOrTrx = db) {
  await serverHooks.doAction('userMeta.delete:before', { userId, metaKey });
  const result = await dbClient.delete(schema.wp_usermeta)
    .where(and(
      eq(schema.wp_usermeta.user_id, userId),
      eq(schema.wp_usermeta.meta_key, metaKey)
    ));
  await serverHooks.doAction('userMeta.delete:after', { userId, metaKey, result });
  return await serverHooks.applyFilters('userMeta.delete', result);
}
