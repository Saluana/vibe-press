// ────────────────────────────────────────────────────────────
// apps/api/src/core/services/post/postMeta.services.ts
// ────────────────────────────────────────────────────────────
import { db, schema } from '@vp/core/db';
import { eq, and, inArray } from 'drizzle-orm';
import { serverHooks } from '@vp/core/hooks/hookEngine.server';

/*──── Types & DB helpers ────────────────────────────────────*/
type DbClient = typeof db;
type TransactionClient = Parameters<DbClient['transaction']>[0] extends (c: infer C) => any ? C : never;
type DbOrTrx = DbClient | TransactionClient;

/*──── Create defaults (optional helper) ─────────────────────*/
export async function createPostMetaDefaults(
  postId: number,
  meta: Record<string, any> = {},
  dbClient: DbOrTrx = db,
) {
  await serverHooks.doAction('svc.postMeta.create:action:before', { postId, meta });

  if (Object.keys(meta).length) {
    await dbClient.insert(schema.wp_postmeta).values(
      Object.entries(meta).map(([meta_key, meta_value]) => ({
        post_id: postId,
        meta_key,
        meta_value,
      })),
    );
  }

  await serverHooks.doAction('svc.postMeta.create:action:after', { postId, meta });
}

/*──── Get a single meta value ───────────────────────────────*/
export async function getPostMeta(
  postId: number,
  metaKey: string,
  dbClient: DbOrTrx = db,
): Promise<any | null> {
  await serverHooks.doAction('svc.postMeta.get:action:before', { postId, metaKey });

  const res = await dbClient
    .select({ meta_value: schema.wp_postmeta.meta_value })
    .from(schema.wp_postmeta)
    .where(and(eq(schema.wp_postmeta.post_id, postId), eq(schema.wp_postmeta.meta_key, metaKey)));

  await serverHooks.doAction('svc.postMeta.get:action:after', { postId, metaKey, meta: res[0]?.meta_value });

  return serverHooks.applyFilters(
    'svc.postMeta.get:filter:result',
    res[0]?.meta_value ?? null,
    postId,
    metaKey,
  );
}

/*──── Batch‑get several keys ────────────────────────────────*/
export async function getPostMetaBatch(
  postId: number,
  keys: string[],
  dbClient: DbOrTrx = db,
): Promise<Record<string, any>> {
  await serverHooks.doAction('svc.postMeta.getBatch:action:before', { postId, keys });

  const rows = await dbClient
    .select({
      meta_key: schema.wp_postmeta.meta_key,
      meta_value: schema.wp_postmeta.meta_value,
    })
    .from(schema.wp_postmeta)
    .where(and(eq(schema.wp_postmeta.post_id, postId), inArray(schema.wp_postmeta.meta_key, keys)));

  const metaMap: Record<string, any> = {};
  rows.forEach((r) => (metaMap[r.meta_key] = r.meta_value));

  await serverHooks.doAction('svc.postMeta.getBatch:action:after', { postId, keys, metaMap });

  return serverHooks.applyFilters('svc.postMeta.getBatch:filter:result', metaMap, postId, keys);
}

/*──── Upsert meta value ─────────────────────────────────────*/
export async function setPostMeta(
  postId: number,
  metaKey: string,
  metaValue: any,
  dbClient: DbOrTrx = db,
) {
  metaValue = await serverHooks.applyFilters('svc.postMeta.set:filter:input', metaValue, postId, metaKey);
  await serverHooks.doAction('svc.postMeta.set:action:before', { postId, metaKey, metaValue });

  const updated = await dbClient
    .update(schema.wp_postmeta)
    .set({ meta_value: metaValue })
    .where(and(eq(schema.wp_postmeta.post_id, postId), eq(schema.wp_postmeta.meta_key, metaKey)));

  if (updated.rowCount === 0) {
    await dbClient.insert(schema.wp_postmeta).values({
      post_id: postId,
      meta_key: metaKey,
      meta_value: metaValue,
    });
  }

  await serverHooks.doAction('svc.postMeta.set:action:after', { postId, metaKey, metaValue });
}

/*──── Delete meta key ───────────────────────────────────────*/
export async function deletePostMeta(
  postId: number,
  metaKey: string,
  dbClient: DbOrTrx = db,
) {
  await serverHooks.doAction('svc.postMeta.delete:action:before', { postId, metaKey });

  const res = await dbClient
    .delete(schema.wp_postmeta)
    .where(and(eq(schema.wp_postmeta.post_id, postId), eq(schema.wp_postmeta.meta_key, metaKey)));

  await serverHooks.doAction('svc.postMeta.delete:action:after', { postId, metaKey, result: res });

  return serverHooks.applyFilters('svc.postMeta.delete:filter:result', res);
}

/*─────────────────────────────────────────────────────────────*
 *  End of postMeta.services.ts
 *─────────────────────────────────────────────────────────────*/
