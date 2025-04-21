// tests/posts.services.test.ts

import { db, schema } from '../apps/api/src/core/db';
import { eq, sql } from 'drizzle-orm';
import { hashPassword } from '../apps/api/src/core/services/auth.services';
const {
  createPost,
  getPostById,
  updatePost,
  deletePost,
  getPosts,
} = await import('../apps/api/src/core/services/post/posts.services');
import { describe, test, expect, afterEach } from 'bun:test';

describe('Post Services (Integration)', () => {
  const cleanupUsers: number[] = [];
  const cleanupPosts: number[] = [];

  afterEach(async () => {
    if (cleanupPosts.length > 0) {
      // delete meta then posts
      await db.delete(schema.wp_postmeta).where(sql`${schema.wp_postmeta.post_id} IN ${cleanupPosts}`);
      await db.delete(schema.wp_posts).where(sql`${schema.wp_posts.ID} IN ${cleanupPosts}`);
      cleanupPosts.length = 0;
    }
    if (cleanupUsers.length > 0) {
      // delete usermeta then users
      await db.delete(schema.wp_usermeta).where(sql`${schema.wp_usermeta.user_id} IN ${cleanupUsers}`);
      await db.delete(schema.wp_users).where(sql`${schema.wp_users.ID} IN ${cleanupUsers}`);
      cleanupUsers.length = 0;
    }
  });

  test('createPost creates a post with defaults and meta', async () => {
    // create an author
    const login = `post_user_${Date.now()}`;
    const [u] = await db
      .insert(schema.wp_users)
      .values({
        user_login: login,
        user_email: `${login}@example.com`,
        user_pass: await hashPassword('password'),
        display_name: 'Test User',
        user_nicename: login.toLowerCase(),
        user_registered: new Date().toISOString(),
      })
      .returning({ ID: schema.wp_users.ID });
    cleanupUsers.push(u.ID);

    const meta = { foo: 'bar' };
    const post = await createPost({
      post_author: u.ID,
      post_title: 'Hello World',
      post_content: 'Content here',
      meta,
    });

    expect(post.ID).toBeDefined();
    expect(post.post_author).toBe(u.ID);
    expect(post.post_title).toBe('Hello World');
    cleanupPosts.push(post.ID);

    // verify core data
    const [dbPost] = await db
      .select()
      .from(schema.wp_posts)
      .where(eq(schema.wp_posts.ID, post.ID))
      .limit(1)
      .execute();
    expect(dbPost.post_title).toBe('Hello World');

    // verify meta
    const rows = await db
      .select()
      .from(schema.wp_postmeta)
      .where(sql`${schema.wp_postmeta.post_id} = ${post.ID}`)
      .execute();
    expect(rows).toHaveLength(Object.keys(meta).length);
    expect(rows[0].meta_key).toBe('foo');
    expect(rows[0].meta_value).toBe('bar');
  });

  test('getPostById returns null for missing post', async () => {
    const result = await getPostById(-1);
    expect(result).toBeNull();
  });

  test('getPostById returns an existing post', async () => {
    // setup author & post
    const login = `post_user2_${Date.now()}`;
    const [u] = await db
      .insert(schema.wp_users)
      .values({
        user_login: login,
        user_email: `${login}@example.com`,
        user_pass: await hashPassword('password'),
        display_name: 'Test User 2',
        user_nicename: login.toLowerCase(),
        user_registered: new Date().toISOString(),
      })
      .returning({ ID: schema.wp_users.ID });
    cleanupUsers.push(u.ID);

    const post = await createPost({
      post_author: u.ID,
      post_title: 'Find Me',
      post_content: '...' ,
    });
    cleanupPosts.push(post.ID);

    const fetched = await getPostById(post.ID);
    expect(fetched).not.toBeNull();
    expect(fetched?.ID).toBe(post.ID);
    expect(fetched?.post_title).toBe('Find Me');
  });

  test('updatePost updates core fields and meta', async () => {
    const login = `post_user3_${Date.now()}`;
    const [u] = await db
      .insert(schema.wp_users)
      .values({
        user_login: login,
        user_email: `${login}@example.com`,
        user_pass: await hashPassword('password'),
        display_name: 'TU3',
        user_nicename: login.toLowerCase(),
        user_registered: new Date().toISOString(),
      })
      .returning({ ID: schema.wp_users.ID });
    cleanupUsers.push(u.ID);

    const post = await createPost({
      post_author: u.ID,
      post_title: 'Old Title',
      post_content: 'xxx',
    });
    cleanupPosts.push(post.ID);

    const updated = await updatePost(post.ID, {
      post_title: 'New Title',
      meta: { updatedKey: 'updatedValue' },
    });
    expect(updated).not.toBeNull();
    expect(updated?.post_title).toBe('New Title');

    // verify new meta
    const [m] = await db
      .select()
      .from(schema.wp_postmeta)
      .where(sql`${schema.wp_postmeta.post_id} = ${post.ID} AND ${schema.wp_postmeta.meta_key} = 'updatedKey'`)
      .limit(1)
      .execute();
    expect(m.meta_value).toBe('updatedValue');
  });

  test('deletePost removes the post and returns the deleted row', async () => {
    const login = `post_user4_${Date.now()}`;
    const [u] = await db
      .insert(schema.wp_users)
      .values({
        user_login: login,
        user_email: `${login}@example.com`,
        user_pass: await hashPassword('password'),
        display_name: 'TU4',
        user_nicename: login.toLowerCase(),
        user_registered: new Date().toISOString(),
      })
      .returning({ ID: schema.wp_users.ID });
    cleanupUsers.push(u.ID);

    const post = await createPost({
      post_author: u.ID,
      post_title: 'To be deleted',
      post_content: '...',
    });
    // note: do not push to cleanupPosts since deletePost already removes it

    const del = await deletePost(post.ID);
    expect(del).not.toBeNull();
    expect(del?.ID).toBe(post.ID);

    const shouldBeNull = await getPostById(post.ID);
    expect(shouldBeNull).toBeNull();
  });

  test('getPosts respects search filter', async () => {
    const login = `post_user5_${Date.now()}`;
    const [u] = await db
      .insert(schema.wp_users)
      .values({
        user_login: login,
        user_email: `${login}@example.com`,
        user_pass: await hashPassword('password'),
        display_name: 'TU5',
        user_nicename: login.toLowerCase(),
        user_registered: new Date().toISOString(),
      })
      .returning({ ID: schema.wp_users.ID });
    cleanupUsers.push(u.ID);

    const a = await createPost({
      post_author: u.ID,
      post_title: 'Searchable One',
      post_content: '...',
    });
    const b = await createPost({
      post_author: u.ID,
      post_title: 'Other Two',
      post_content: '...',
    });
    cleanupPosts.push(a.ID, b.ID);

    const results = await getPosts({ search: 'Searchable' });
    expect(Array.isArray(results)).toBe(true);
    expect(results.find(p => p.ID === a.ID)).toBeDefined();
    expect(results.find(p => p.ID === b.ID)).toBeUndefined();
  });

  test('createPost without meta does not insert postmeta', async () => {
    const login = `post_user_no_meta_${Date.now()}`;
    const [u] = await db
      .insert(schema.wp_users)
      .values({
        user_login: login,
        user_email: `${login}@example.com`,
        user_pass: await hashPassword('password'),
        display_name: 'TM',
        user_nicename: login.toLowerCase(),
        user_registered: new Date().toISOString(),
      })
      .returning({ ID: schema.wp_users.ID });
    cleanupUsers.push(u.ID);

    const post = await createPost({
      post_author: u.ID,
      post_title: 'No Meta',
      post_content: '...',
    });
    cleanupPosts.push(post.ID);

    const metaRows = await db
      .select()
      .from(schema.wp_postmeta)
      .where(sql`${schema.wp_postmeta.post_id} = ${post.ID}`)
      .execute();
    expect(metaRows).toHaveLength(0);
  });

  test('updatePost throws when no valid fields provided', async () => {
    const login = `post_user_throw_${Date.now()}`;
    const [u] = await db
      .insert(schema.wp_users)
      .values({
        user_login: login,
        user_email: `${login}@example.com`,
        user_pass: await hashPassword('password'),
        display_name: 'TT',
        user_nicename: login.toLowerCase(),
        user_registered: new Date().toISOString(),
      })
      .returning({ ID: schema.wp_users.ID });
    cleanupUsers.push(u.ID);

    const post = await createPost({
      post_author: u.ID,
      post_title: 'Throw Test',
      post_content: '...',
    });
    cleanupPosts.push(post.ID);

    await expect(updatePost(post.ID, {})).rejects.toThrow('No valid fields provided');
  });

  test('getPosts respects include and exclude filters', async () => {
    const login = `post_user_inc_exc_${Date.now()}`;
    const [u] = await db
      .insert(schema.wp_users)
      .values({
        user_login: login,
        user_email: `${login}@example.com`,
        user_pass: await hashPassword('password'),
        display_name: 'TI',
        user_nicename: login.toLowerCase(),
        user_registered: new Date().toISOString(),
      })
      .returning({ ID: schema.wp_users.ID });
    cleanupUsers.push(u.ID);

    const p1 = await createPost({ post_author: u.ID, post_title: 'IncPost', post_content: 'c' });
    const p2 = await createPost({ post_author: u.ID, post_title: 'ExcPost', post_content: 'c' });
    const p3 = await createPost({ post_author: u.ID, post_title: 'OtherPost', post_content: 'c' });
    cleanupPosts.push(p1.ID, p2.ID, p3.ID);

    const incResults = await getPosts({ include: [p1.ID, p2.ID] });
    expect(incResults.map(p => p.ID).sort()).toEqual([p1.ID, p2.ID]);

    const excResults = await getPosts({ exclude: [p2.ID, p3.ID] });
    expect(excResults.find(p => p.ID === p2.ID)).toBeUndefined();
    expect(excResults.find(p => p.ID === p3.ID)).toBeUndefined();
    expect(excResults.find(p => p.ID === p1.ID)).toBeDefined();
  });

  test('getPosts respects ordering asc', async () => {
    const login = `post_user_order_${Date.now()}`;
    const [u] = await db
      .insert(schema.wp_users)
      .values({
        user_login: login,
        user_email: `${login}@example.com`,
        user_pass: await hashPassword('password'),
        display_name: 'TO',
        user_nicename: login.toLowerCase(),
        user_registered: new Date().toISOString(),
      })
      .returning({ ID: schema.wp_users.ID });
    cleanupUsers.push(u.ID);

    const p1 = await createPost({ post_author: u.ID, post_title: 'First', post_content: 'c' });
    const p2 = await createPost({ post_author: u.ID, post_title: 'Second', post_content: 'c' });
    cleanupPosts.push(p1.ID, p2.ID);

    const now = new Date();
    const older = new Date(now.getTime() - 60000);
    const newer = now;

    await db.update(schema.wp_posts)
      .set({ post_date: older, post_date_gmt: older, post_modified: older, post_modified_gmt: older })
      .where(eq(schema.wp_posts.ID, p1.ID))
      .execute();
    await db.update(schema.wp_posts)
      .set({ post_date: newer, post_date_gmt: newer, post_modified: newer, post_modified_gmt: newer })
      .where(eq(schema.wp_posts.ID, p2.ID))
      .execute();

    const results = await getPosts({ order: 'asc', orderBy: 'date' });
    const ids = results.map(p => p.ID);
    expect(ids.indexOf(p1.ID)).toBeLessThan(ids.indexOf(p2.ID));
  });
});