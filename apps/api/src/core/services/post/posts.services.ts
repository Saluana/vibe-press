// apps/api/src/core/services/post/post.services.ts
import { db, schema } from '@vp/core/db';
import { sql, and, or, like, eq, inArray, not, count } from 'drizzle-orm';
import { serverHooks } from '@vp/core/hooks/hookEngine.server';
import {  setPostMeta, createPostMetaDefaults } from './postMeta.services';

/*─────────────────────────────────────────────────────────────*
 *  TYPES
 *─────────────────────────────────────────────────────────────*/
export type PostBasicInfo = {
  ID: number;
  post_author: number;
  post_date: Date;
  post_date_gmt: Date;
  post_title: string;
  post_excerpt: string | null;
  post_status: string;
  post_name: string;
  post_modified: Date;
  post_modified_gmt: Date;
  post_parent: number;
  guid: string;
  menu_order: number;
  post_type: string;
  comment_count: number;
};

type DbClient = typeof db;
type TransactionClient = Parameters<DbClient['transaction']>[0] extends (c: infer C) => any ? C : never;
type DbOrTrx = DbClient | TransactionClient;

/*─────────────────────────────────────────────────────────────*
 *  CREATE
 *─────────────────────────────────────────────────────────────*/
export async function createPost(
    {
      post_author,
      post_title,
      post_content,
      post_excerpt = '',
      post_status = 'publish',
      post_name = '',
      post_type = 'post',
      post_parent = 0,
      guid = '',
      menu_order = 0,
      comment_status = 'open',
      ping_status = 'open',
      meta = {},               // ⬅️ NEW
    }: {
      post_author: number;
      post_title: string;
      post_content: string;
      post_excerpt?: string;
      post_status?: string;
      post_name?: string;
      post_type?: string;
      post_parent?: number;
      guid?: string;
      menu_order?: number;
      comment_status?: string;
      ping_status?: string;
      meta?: Record<string, any>; // ⬅️ NEW
    },
    dbClient: DbOrTrx = db,
  ) {
    await serverHooks.doAction('svc.post.create:action:before', { post_author, post_title });
  
    let newPost: PostBasicInfo;
    await dbClient.transaction(async (trx) => {
      const rows = await trx
        .insert(schema.wp_posts)
        .values({
          post_author,
          post_content,
          post_title,
          post_excerpt,
          post_status,
          post_name,
          post_type,
          post_parent,
          guid,
          menu_order,
          comment_status,
          ping_status,
          to_ping: '',
          pinged: '',
          post_content_filtered: '',
        })
        .returning({
          ID: schema.wp_posts.ID,
          post_author: schema.wp_posts.post_author,
          post_date: schema.wp_posts.post_date,
          post_date_gmt: schema.wp_posts.post_date_gmt,
          post_title: schema.wp_posts.post_title,
          post_excerpt: schema.wp_posts.post_excerpt,
          post_status: schema.wp_posts.post_status,
          post_name: schema.wp_posts.post_name,
          post_modified: schema.wp_posts.post_modified,
          post_modified_gmt: schema.wp_posts.post_modified_gmt,
          post_parent: schema.wp_posts.post_parent,
          guid: schema.wp_posts.guid,
          menu_order: schema.wp_posts.menu_order,
          post_type: schema.wp_posts.post_type,
          comment_count: schema.wp_posts.comment_count,
        });
  
      newPost = rows[0] as PostBasicInfo;
  
      // ⬅️ NEW: insert meta within the same transaction
      if (meta && Object.keys(meta).length) {
        await createPostMetaDefaults(newPost.ID, meta, trx);
      }
    });
  
    await serverHooks.doAction('svc.post.create:action:after', { post: newPost! });
    return serverHooks.applyFilters('svc.post.create:filter:result', newPost!);
  }

/*─────────────────────────────────────────────────────────────*
 *  GET SINGLE
 *─────────────────────────────────────────────────────────────*/
export async function getPostById(id: number, dbClient: DbOrTrx = db) {
  await serverHooks.doAction('svc.post.get:action:before', { id });

  const result = await dbClient
    .select({
      ID: schema.wp_posts.ID,
      post_author: schema.wp_posts.post_author,
      post_date: schema.wp_posts.post_date,
      post_date_gmt: schema.wp_posts.post_date_gmt,
      post_title: schema.wp_posts.post_title,
      post_excerpt: schema.wp_posts.post_excerpt,
      post_status: schema.wp_posts.post_status,
      post_name: schema.wp_posts.post_name,
      post_modified: schema.wp_posts.post_modified,
      post_modified_gmt: schema.wp_posts.post_modified_gmt,
      post_parent: schema.wp_posts.post_parent,
      guid: schema.wp_posts.guid,
      menu_order: schema.wp_posts.menu_order,
      post_type: schema.wp_posts.post_type,
      comment_count: schema.wp_posts.comment_count,
    })
    .from(schema.wp_posts)
    .where(eq(schema.wp_posts.ID, id));

  await serverHooks.doAction('svc.post.get:action:after', { post: result[0] });

  return serverHooks.applyFilters(
    'svc.post.get:filter:result',
    (result[0] ?? null) as PostBasicInfo | null,
  );
}

/*─────────────────────────────────────────────────────────────*
 *  UPDATE  (meta‑aware)
 *─────────────────────────────────────────────────────────────*/
export async function updatePost(
    postId: number,
    updates: Record<string, any>,
    dbClient: DbOrTrx = db,
  ) {
    updates = await serverHooks.applyFilters('svc.post.update:filter:input', updates, postId);
    await serverHooks.doAction('svc.post.update:action:before', { postId, updates });
  
    /* separate meta from core columns */
    const { meta, ...coreUpdates } = updates;          // ⬅️ NEW
  
    const wpUpdates: Partial<typeof schema.wp_posts.$inferInsert> = {};
    const allowed: (keyof typeof schema.wp_posts.$inferInsert)[] = [
      'post_author','post_content','post_title','post_excerpt','post_status',
      'post_name','post_modified','post_modified_gmt','post_parent','guid',
      'menu_order','post_type','comment_status','ping_status','to_ping',
      'pinged','post_content_filtered',
    ];
    allowed.forEach(f => { if (coreUpdates[f] !== undefined) wpUpdates[f] = coreUpdates[f]; });
    if (!Object.keys(wpUpdates).length && !meta) throw new Error('No valid fields provided for post update.');
  
    let updated: PostBasicInfo | null = null;
    await dbClient.transaction(async (trx) => {
      if (Object.keys(wpUpdates).length) {
        const rows = await trx
          .update(schema.wp_posts)
          .set(wpUpdates)
          .where(eq(schema.wp_posts.ID, postId))
          .returning({
            ID: schema.wp_posts.ID,
            post_author: schema.wp_posts.post_author,
            post_date: schema.wp_posts.post_date,
            post_date_gmt: schema.wp_posts.post_date_gmt,
            post_title: schema.wp_posts.post_title,
            post_excerpt: schema.wp_posts.post_excerpt,
            post_status: schema.wp_posts.post_status,
            post_name: schema.wp_posts.post_name,
            post_modified: schema.wp_posts.post_modified,
            post_modified_gmt: schema.wp_posts.post_modified_gmt,
            post_parent: schema.wp_posts.post_parent,
            guid: schema.wp_posts.guid,
            menu_order: schema.wp_posts.menu_order,
            post_type: schema.wp_posts.post_type,
            comment_count: schema.wp_posts.comment_count,
          });
        if (!rows.length) throw new Error(`Post ${postId} not found.`);
        updated = rows[0] as PostBasicInfo;
      } else {
        /* if only meta updates, we still need the post row for return */
        const rows = await trx
          .select({
            ID: schema.wp_posts.ID,
            post_author: schema.wp_posts.post_author,
            post_date: schema.wp_posts.post_date,
            post_date_gmt: schema.wp_posts.post_date_gmt,
            post_title: schema.wp_posts.post_title,
            post_excerpt: schema.wp_posts.post_excerpt,
            post_status: schema.wp_posts.post_status,
            post_name: schema.wp_posts.post_name,
            post_modified: schema.wp_posts.post_modified,
            post_modified_gmt: schema.wp_posts.post_modified_gmt,
            post_parent: schema.wp_posts.post_parent,
            guid: schema.wp_posts.guid,
            menu_order: schema.wp_posts.menu_order,
            post_type: schema.wp_posts.post_type,
            comment_count: schema.wp_posts.comment_count,
          })
          .from(schema.wp_posts)
          .where(eq(schema.wp_posts.ID, postId));
        updated = rows[0] as PostBasicInfo;
      }
  
      // ⬅️ NEW: handle meta upserts
      if (meta && Object.keys(meta).length) {
        for (const [k, v] of Object.entries(meta)) {
          await setPostMeta(postId, k, v, trx);
        }
      }
    });
  
    await serverHooks.doAction('svc.post.update:action:after', { post: updated });
    return serverHooks.applyFilters('svc.post.update:filter:result', updated);
  }

/*─────────────────────────────────────────────────────────────*
 *  DELETE
 *─────────────────────────────────────────────────────────────*/
export async function deletePost(postId: number, dbClient: DbOrTrx = db) {
  await serverHooks.doAction('svc.post.delete:action:before', { postId });

  const res = await dbClient
    .delete(schema.wp_posts)
    .where(eq(schema.wp_posts.ID, postId))
    .returning({
      ID: schema.wp_posts.ID,
      post_author: schema.wp_posts.post_author,
      post_date: schema.wp_posts.post_date,
      post_date_gmt: schema.wp_posts.post_date_gmt,
      post_title: schema.wp_posts.post_title,
      post_excerpt: schema.wp_posts.post_excerpt,
      post_status: schema.wp_posts.post_status,
      post_name: schema.wp_posts.post_name,
      post_modified: schema.wp_posts.post_modified,
      post_modified_gmt: schema.wp_posts.post_modified_gmt,
      post_parent: schema.wp_posts.post_parent,
      guid: schema.wp_posts.guid,
      menu_order: schema.wp_posts.menu_order,
      post_type: schema.wp_posts.post_type,
      comment_count: schema.wp_posts.comment_count,
    });

  await serverHooks.doAction('svc.post.delete:action:after', { post: res[0] });
  return serverHooks.applyFilters(
    'svc.post.delete:filter:result',
    (res[0] ?? null) as PostBasicInfo | null,
  );
}

/*─────────────────────────────────────────────────────────────*
 *  GET MULTIPLE
 *─────────────────────────────────────────────────────────────*/
export type GetPostsParams = {
  page?: number;
  perPage?: number;
  search?: string;
  exclude?: number[];
  include?: number[];
  offset?: number;
  order?: 'asc' | 'desc';
  orderBy?: 'id' | 'include' | 'title' | 'date' | 'slug' | 'author' | 'modified';
  slug?: string[];
  author?: number | number[];
  statuses?: string[];
  types?: string[];
};

export async function getPosts(params: GetPostsParams, dbClient: DbOrTrx = db) {
  const {
    page = 1,
    perPage = 10,
    search,
    exclude,
    include,
    offset,
    order = 'desc',
    orderBy = 'date',
    slug,
    author,
    statuses,
    types,
  } = params;

  await serverHooks.doAction('svc.posts.get:action:before', { params });

  // Build conditions
  const cond: any[] = [];
  if (search) cond.push(or(like(schema.wp_posts.post_title, `%${search}%`), like(schema.wp_posts.post_content, `%${search}%`)));
  if (exclude?.length) cond.push(not(inArray(schema.wp_posts.ID, exclude)));
  if (include?.length) cond.push(inArray(schema.wp_posts.ID, include));
  if (slug?.length) cond.push(inArray(schema.wp_posts.post_name, slug));
  if (author !== undefined) cond.push(Array.isArray(author) ? inArray(schema.wp_posts.post_author, author) : eq(schema.wp_posts.post_author, author));
  if (statuses?.length) cond.push(inArray(schema.wp_posts.post_status, statuses));
  // Apply types filter if provided
  if (types?.length) cond.push(inArray(schema.wp_posts.post_type, types)); 
  const whereClause = cond.length ? and(...cond) : undefined;

  // Get total count applying the same filters
  const totalCountResult = await dbClient
    .select({ value: count() })
    .from(schema.wp_posts)
    .where(whereClause); 
  const totalCount = totalCountResult[0]?.value ?? 0;

  // Build ordering
  const sortCol = (() => {
    switch (orderBy) {
      case 'id': return schema.wp_posts.ID;
      case 'title': return schema.wp_posts.post_title;
      case 'date': return schema.wp_posts.post_date;
      case 'slug': return schema.wp_posts.post_name;
      case 'author': return schema.wp_posts.post_author;
      case 'modified': return schema.wp_posts.post_modified;
      default: return schema.wp_posts.post_date;
    }
  })();
  const orderByClause = order === 'asc' ? sql`${sortCol} ASC` : sql`${sortCol} DESC`;
  const actualOffset = typeof offset === 'number' ? offset : (page - 1) * perPage;

  // Get paginated posts
  const posts = (await dbClient
    .select({
      ID: schema.wp_posts.ID,
      post_author: schema.wp_posts.post_author,
      post_date: schema.wp_posts.post_date,
      post_date_gmt: schema.wp_posts.post_date_gmt,
      post_title: schema.wp_posts.post_title,
      post_excerpt: schema.wp_posts.post_excerpt,
      post_status: schema.wp_posts.post_status,
      post_name: schema.wp_posts.post_name,
      post_modified: schema.wp_posts.post_modified,
      post_modified_gmt: schema.wp_posts.post_modified_gmt,
      post_parent: schema.wp_posts.post_parent,
      guid: schema.wp_posts.guid,
      menu_order: schema.wp_posts.menu_order,
      post_type: schema.wp_posts.post_type,
      comment_count: schema.wp_posts.comment_count,
    })
    .from(schema.wp_posts)
    .where(whereClause) // Apply the same conditions here
    .orderBy(orderByClause)
    .limit(perPage)
    .offset(actualOffset)) as PostBasicInfo[];

  // Return both posts and the total count
  const result = { posts, totalCount };

  await serverHooks.doAction('svc.posts.get:action:after', result);
  // Ensure filters receive and return the new structure
  return serverHooks.applyFilters('svc.posts.get:filter:result', result);
}

/*─────────────────────────────────────────────────────────────*
 *  END OF FILE
 *─────────────────────────────────────────────────────────────*/
