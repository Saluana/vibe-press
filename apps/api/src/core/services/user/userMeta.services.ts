import { db, schema } from "@vp/core/db";
import { eq, and, inArray } from 'drizzle-orm';
import { serverHooks } from '@vp/core/hooks/hookEngine.server';
import type { NodePgDatabase, NodePgTransaction } from 'drizzle-orm/node-postgres';
import { getRoles } from '@vp/core/roles/roles';


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
  await serverHooks.doAction('svc.userMeta.create:action:before', { userId, overrides });
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
  await serverHooks.doAction('svc.userMeta.create:action:after', { userId, overrides });
}

/**
 * Retrieve user meta data.
 * 
 * @param {number} userId - The ID of the user.
 * @param {string} key - Specific meta key to retrieve.
 * @param {DbOrTrx} [dbClient=db] - Optional database client or transaction.
 * @returns {Promise<any|null>} The meta value or null if not found.
 */
export async function getUserMeta(userId: number, key: string, dbClient: DbOrTrx = db): Promise<any | null> {
  await serverHooks.doAction('svc.userMeta.get:action:before', { userId, key });

  const result = await dbClient.select().from(schema.wp_usermeta)
    .where(and(
      eq(schema.wp_usermeta.user_id, userId),
      eq(schema.wp_usermeta.meta_key, key)
    ));

  const metaValue = result.length > 0 ? result[0].meta_value : null;

  await serverHooks.doAction('svc.userMeta.get:action:after', { userId, key, result: metaValue });

  const filteredValue = await serverHooks.applyFilters('svc.userMeta.get:filter:result', metaValue, userId, key);
  return filteredValue;

}

/**
 * Fetches multiple meta values for a specific user in a single query.
 * 
 * @param {number} userId - The ID of the user.
 * @param {string[]} keys - An array of meta keys to fetch.
 * @param {DbOrTrx} [dbClient=db] - Optional database client or transaction.
 * @returns {Promise<Record<string, any>>} An object where keys are the requested meta_keys and values are the corresponding meta_values. Keys not found are omitted.
 */
export async function getUserMetaBatch(userId: number, keys: string[], dbClient: DbOrTrx = db): Promise<Record<string, any>> {
  if (!userId || !keys || keys.length === 0) {
    return {};
  }

  const results = await dbClient
    .select({
      meta_key: schema.wp_usermeta.meta_key,
      meta_value: schema.wp_usermeta.meta_value
    })
    .from(schema.wp_usermeta)
    .where(
      and(
        eq(schema.wp_usermeta.user_id, userId),
        inArray(schema.wp_usermeta.meta_key, keys)
      )
    );

  const metaMap: Record<string, any> = {};
  for (const row of results) {
    // Ensure meta_key is not null before using it as an index
    if (row.meta_key !== null && row.meta_key !== undefined) { 
      metaMap[row.meta_key] = row.meta_value;
    }
  }

  const filteredMetaMap = await serverHooks.applyFilters('svc.userMeta.getBatch:filter:result', metaMap, userId, keys);
  return filteredMetaMap;
}

/**
 * Update or insert a user meta value (upsert).
 * 
 * @param {number} userId - The ID of the user.
 * @param {string} metaKey - The meta key to update or insert.
 * @param {any} metaValue - The value to set for the meta key.
 */
export async function setUserMeta(userId: number, metaKey: string, metaValue: any, dbClient: DbOrTrx = db) {
  await serverHooks.doAction('svc.userMeta.set:action:before', { userId, metaKey, metaValue });
  // add filter 
  metaValue = await serverHooks.applyFilters('svc.userMeta.set:filter:input', metaValue, userId, metaKey);
  
  const updated = await dbClient.update(schema.wp_usermeta)
    .set({ meta_value: metaValue })
    .where(and(
      eq(schema.wp_usermeta.user_id, userId),
      eq(schema.wp_usermeta.meta_key, metaKey)
    ));
  if (updated.rowCount === 0) {
    // Use the passed dbClient (transaction) for the insert
    await dbClient.insert(schema.wp_usermeta).values({ user_id: userId, meta_key: metaKey, meta_value: metaValue });
  }
  await serverHooks.doAction('svc.userMeta.set:action:after', { userId, metaKey, metaValue });
}

/**
 * Delete a user meta value.
 * 
 * @param {number} userId - The ID of the user.
 * @param {string} metaKey - The meta key to delete.
 * @returns {Promise<any>} The result of the delete operation.
 */
export async function deleteUserMeta(userId: number, metaKey: string, dbClient: DbOrTrx = db) {
  await serverHooks.doAction('svc.userMeta.delete:action:before', { userId, metaKey });
  const result = await dbClient.delete(schema.wp_usermeta)
    .where(and(
      eq(schema.wp_usermeta.user_id, userId),
      eq(schema.wp_usermeta.meta_key, metaKey)
    ));
  await serverHooks.doAction('svc.userMeta.delete:action:after', { userId, metaKey, result });
  return await serverHooks.applyFilters('svc.userMeta.delete:filter:result', result);
}

export async function setUserRole(userId: number, role: string, dbClient: DbOrTrx = db) {
  await serverHooks.doAction('svc.userMeta.setRole:action:before', { userId, role });
  const roles = await getRoles(dbClient);
  const normalizedRole = role.toLowerCase(); // Normalize role

  // Check using the normalized role name
  if (!roles[normalizedRole]) throw new Error(`Role ${role} does not exist`);

  // Store using the normalized role name as the key
  await setUserMeta(userId, 'wp_capabilities', { [normalizedRole]: true }, dbClient);
  await serverHooks.doAction('svc.userMeta.setRole:action:after', { userId, role });
}

export async function getUserRole(userId: number, dbClient: DbOrTrx = db): Promise<string | null> {
  const meta = await getUserMeta(userId, 'wp_capabilities', dbClient);
  if (meta === null || typeof meta !== 'object') return null; // Check for null or non-object type
  const capabilities = meta as Record<string, boolean>; // Safe assertion after check
  return Object.keys(capabilities).find(role => capabilities[role]) || null;
}