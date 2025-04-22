import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { wpError } from '@vp/core/utils/wpError';
import { BASE_URL } from '@vp/core/config';
import {
  optionalAuth,
  requireAuth,
  requireCapabilities,
  AuthRequest,
} from '../middleware/verifyRoles.middleware';
import {
  createPost,
  getPostById,
  updatePost,
  deletePost,
  getPosts,
} from '@vp/core/services/post/posts.services';
import {
  sanitiseForContext,
  Context as RestContext,
} from '@vp/core/utils/restContext';
import { serverHooks } from '@vp/core/hooks/hookEngine.server';

const router = Router();

/*─────────────────────────────────────────────────────────────*
 *  Helpers: mapping & context
 *─────────────────────────────────────────────────────────────*/

// Ensure only valid enum values
function isValidContext(v: any): v is RestContext {
  return (
    v === RestContext.view ||
    v === RestContext.embed ||
    v === RestContext.edit
  );
}

// Fully typed WP‑shape for sanitisation
export type PostWPShape = {
  id: number;
  date: string;
  date_gmt: string;
  modified: string;
  modified_gmt: string;
  slug: string;
  status: string;
  type: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string; protected: boolean };
  excerpt: { rendered: string; protected: boolean };
  author: number;
  comment_status: string;
  ping_status: string;
  guid: { rendered: string };
  _links: any;
};

// Only view/embed need explicit sets; edit returns full
const postFieldSets = {
  view: [
    'id', 'date', 'date_gmt', 'modified', 'modified_gmt',
    'slug', 'status', 'type', 'link', 'title', 'content',
    'excerpt', 'author', 'comment_status', 'ping_status',
    'guid', '_links',
  ] as (keyof PostWPShape)[],
  embed: [
    'id', 'date', 'slug', 'type', 'link', 'title', 'author', '_links',
  ] as (keyof PostWPShape)[],
};

function mapPostToWP(post: any, context: RestContext): Partial<PostWPShape> {
  const full: PostWPShape = {
    id: post.ID,
    date: post.post_date.toISOString(),
    date_gmt: post.post_date_gmt.toISOString(),
    modified: post.post_modified.toISOString(),
    modified_gmt: post.post_modified_gmt.toISOString(),
    slug: post.post_name,
    status: post.post_status,
    type: post.post_type,
    link: `${BASE_URL}/?p=${post.ID}`,
    title: { rendered: post.post_title },
    content: { rendered: post.post_content ?? '', protected: false },
    excerpt: { rendered: post.post_excerpt ?? '', protected: false },
    author: post.post_author,
    comment_status: post.comment_status ?? 'open',
    ping_status: post.ping_status ?? 'open',
    guid: { rendered: post.guid },
    _links: {
      self: [{ href: `${BASE_URL}/wp-json/wp/v2/posts/${post.ID}` }],
      collection: [{ href: `${BASE_URL}/wp-json/wp/v2/posts` }],
      author: [{ href: `${BASE_URL}/wp-json/wp/v2/users/${post.post_author}` }],
    },
  };

  return sanitiseForContext(full, context, postFieldSets) as Partial<PostWPShape>;
}

/*─────────────────────────────────────────────────────────────*
 *  Validation Schemas
 *─────────────────────────────────────────────────────────────*/

// GET /posts query
const listQuerySchema = z.object({
  context: z
    .enum([RestContext.view, RestContext.embed, RestContext.edit])
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  author: z
    .string()
    .optional()
    .transform(v => v ? v.split(',').map(x => Number(x)) : undefined),
  status: z
    .string()
    .optional()
    .transform(v => v ? v.split(',') : undefined),
  type: z.string().optional(),
});

// GET/DELETE by ID
const singleQuerySchema = z.object({
  context: z
    .enum([RestContext.view, RestContext.embed, RestContext.edit])
    .optional(),
});

const idParamSchema = z.object({
  id: z.coerce.number().int(),
});

// DELETE /posts query
const deleteQuerySchema = z.object({
  force: z.coerce.boolean().default(false),
});

// POST/PUT body
const postBodySchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  excerpt: z.string().optional(),
  status: z.string().optional(),
  slug: z.string().optional(),
  meta: z.record(z.any()).optional(),
});

/*─────────────────────────────────────────────────────────────*
 *  GET /wp/v2/posts
 *─────────────────────────────────────────────────────────────*/
router.get('/posts', optionalAuth, async (req: AuthRequest, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json(
      wpError('rest_invalid_param', 'Invalid query parameters', 400, {
        details: parsed.error.flatten(),
      })
    );
    return;
  }

  const {
    context: ctxQ,
    page,
    per_page,
    search,
    author,
    status,
    type,
  } = parsed.data;
  const context = isValidContext(ctxQ) ? ctxQ : RestContext.view;

  // edit context requires capability
  if (
    context === RestContext.edit &&
    !(req.user?.capabilities ?? []).includes('edit_posts')
  ) {
    res
      .status(403)
      .json(wpError('rest_forbidden', 'Cannot view posts in edit context', 403));
    return;
  }

  try {
    const posts = await getPosts({
      page,
      perPage: per_page,
      search,
      author: (Array.isArray(author) && author.length > 0) ? author : undefined,
      statuses: (Array.isArray(status) && status.length > 0) ? status : undefined,
      types: type ? [type] : undefined,
    });

    const wpPosts = posts.map((p) => mapPostToWP(p, context));
    res.setHeader('X-WP-Total', wpPosts.length);
    res.setHeader('X-WP-TotalPages', 1);
    res.json(wpPosts);
    return;
  } catch (e: any) {
    await serverHooks.doAction('rest.posts.get:action:error', { error: e });
    res
      .status(500)
      .json(wpError('rest_unknown', e.message || 'Unknown error', 500));
    return;
  }
});

/*─────────────────────────────────────────────────────────────*
 *  GET /wp/v2/posts/:id
 *─────────────────────────────────────────────────────────────*/
router.get('/posts/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  const idParams = idParamSchema.safeParse(req.params);
  const qParams = singleQuerySchema.safeParse(req.query);
  if (!idParams.success || !qParams.success) {
    res
      .status(400)
      .json(wpError('rest_invalid_param', 'Invalid parameters', 400));
    return;
  }
  const postId = idParams.data.id;
  const ctxQ = qParams.data.context;
  const context = isValidContext(ctxQ) ? ctxQ : RestContext.view;

  if (
    context === RestContext.edit &&
    !(req.user?.capabilities ?? []).includes('edit_posts')
  ) {
    res
      .status(403)
      .json(wpError('rest_forbidden', 'Cannot view post in edit context', 403));
    return;
  }

  try {
    const post = await getPostById(postId);
    if (!post) {
      res
        .status(404)
        .json(wpError('rest_post_invalid_id', 'Post not found', 404));
      return;
    }

    res.json(mapPostToWP(post, context));
    return;
  } catch (e: any) {
    await serverHooks.doAction('rest.posts.single:action:error', { error: e });
    res
      .status(500)
      .json(wpError('rest_unknown', e.message || 'Unknown error', 500));
    return;
  }
});

/*─────────────────────────────────────────────────────────────*
 *  POST /wp/v2/posts
 *─────────────────────────────────────────────────────────────*/
router.post(
  '/posts',
  requireAuth,
  requireCapabilities({ capabilities: ['edit_posts'] }),
  async (req: AuthRequest, res: Response) => {
    const parse = postBodySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json(
        wpError('rest_invalid_param', 'Invalid body', 400, {
          details: parse.error.flatten(),
        })
      );
      return;
    }

    try {
      const post = await createPost({
        post_author: req.user!.id,
        post_title: parse.data.title ?? '',
        post_content: parse.data.content ?? '',
        post_excerpt: parse.data.excerpt ?? '',
        post_status: parse.data.status ?? 'draft',
        post_name: parse.data.slug ?? '',
        meta: parse.data.meta,
      });
      res.status(201).json(mapPostToWP(post, RestContext.edit));
      return;
    } catch (e: any) {
      await serverHooks.doAction('rest.posts.create:action:error', { error: e });
      res
        .status(500)
        .json(wpError('rest_unknown', e.message || 'Unknown error', 500));
      return;
    }
  }
);

/*─────────────────────────────────────────────────────────────*
 *  PUT /wp/v2/posts/:id
 *─────────────────────────────────────────────────────────────*/
router.put(
  '/posts/:id',
  requireAuth,
  requireCapabilities({ capabilities: ['edit_posts'] }),
  async (req: AuthRequest, res: Response) => {
    const idParams = idParamSchema.safeParse(req.params);
    if (!idParams.success) {
      res
        .status(400)
        .json(wpError('rest_invalid_param', 'Invalid post ID', 400));
      return;
    }
    const parse = postBodySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json(
        wpError('rest_invalid_param', 'Invalid body', 400, {
          details: parse.error.flatten(),
        })
      );
      return;
    }

    try {
      const updated = await updatePost(idParams.data.id, {
        post_title: parse.data.title,
        post_content: parse.data.content,
        post_excerpt: parse.data.excerpt,
        post_status: parse.data.status,
        post_name: parse.data.slug,
        meta: parse.data.meta,
      });
      res.json(mapPostToWP(updated!, RestContext.edit));
      return;
    } catch (e: any) {
      await serverHooks.doAction('rest.posts.update:action:error', { error: e });
      res
        .status(500)
        .json(wpError('rest_unknown', e.message || 'Unknown error', 500));
      return;
    }
  }
);

/*─────────────────────────────────────────────────────────────*
 *  DELETE /wp/v2/posts/:id
 *─────────────────────────────────────────────────────────────*/
router.delete(
  '/posts/:id',
  requireAuth,
  requireCapabilities({ capabilities: ['delete_posts'] }),
  async (req: AuthRequest, res: Response) => {
    const idParams = idParamSchema.safeParse(req.params);
    const qParams = deleteQuerySchema.safeParse(req.query);
    if (!idParams.success || !qParams.success) {
      res
        .status(400)
        .json(wpError('rest_invalid_param', 'Invalid parameters', 400));
      return;
    }
    const force = qParams.data.force;

    try {
      if (!force) {
        // soft delete => trash
        const trashed = await updatePost(idParams.data.id, { post_status: 'trash' });
        res.json({
          trashed: true,
          previous: mapPostToWP(trashed!, RestContext.view),
        });
        return;
      }
      const deleted = await deletePost(idParams.data.id);
      res.json({
        deleted: true,
        previous: mapPostToWP(deleted!, RestContext.view),
      });
      return;
    } catch (e: any) {
      await serverHooks.doAction('rest.posts.delete:action:error', { error: e });
      res
        .status(500)
        .json(wpError('rest_unknown', e.message || 'Unknown error', 500));
      return;
    }
  }
);

export default router;
