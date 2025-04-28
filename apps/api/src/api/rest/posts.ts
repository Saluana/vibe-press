import { Router, Request, Response } from 'express';
import { formatZodErrorForWpRest } from "@vp/core/utils/wpError";
import { ZodError } from "zod";
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
import { postBodySchema, listQuerySchema, singleQuerySchema, idParamSchema, deleteQuerySchema } from '@vp/core/schemas/posts.schema';

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
 *  GET /wp/v2/posts
 *─────────────────────────────────────────────────────────────*/
router.get('/posts', optionalAuth, async (req: AuthRequest, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json(
      wpError('rest_invalid_param', 'Invalid parameter(s)', 400, {
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
  const userCaps = req.user?.capabilities ?? [];
  const hasEditPosts = userCaps.includes('edit_posts');
  let filteredStatus: string[] | undefined = undefined;
  // Default type to 'post' if not specified (WP Compatibility)
  const filteredType = type ? [type] : ['post'];

  // WordPress compatibility: Only show published posts unless user can edit_posts
  if (!hasEditPosts) {
    filteredStatus = ['publish'];
  } else if (Array.isArray(status) && status.length > 0) {
    filteredStatus = status;
  }

  if (
    context === RestContext.edit &&
    !hasEditPosts
  ) {
    res
      .status(403)
      .json(wpError('rest_forbidden', 'Cannot view posts in edit context', 403));
    return;
  }

  try {
    // Get posts and total count from the service
    const result = await getPosts({
      page,
      perPage: per_page,
      search,
      author: (Array.isArray(author) && author.length > 0) ? author : undefined,
      statuses: filteredStatus,
      types: filteredType, // Use filteredType
    });

    const { posts, totalCount } = result;
    const totalPages = Math.ceil(totalCount / per_page);

    // Map posts to WP shape
    const wpPosts = posts.map((p: any) => mapPostToWP(p, context)); // Add type 'any' to fix lint

    // Set headers
    res.setHeader('X-WP-Total', totalCount);
    res.setHeader('X-WP-TotalPages', totalPages);

    // Construct Link header
    const linkHeaderParts: string[] = [];
    const urlBase = `${BASE_URL}/wp-json/wp/v2/posts`;
    const queryParams = new URLSearchParams(req.query as any);

    if (page > 1) {
      queryParams.set('page', (page - 1).toString());
      linkHeaderParts.push(`<${urlBase}?${queryParams.toString()}>; rel="prev"`);
    }
    if (page < totalPages) {
      queryParams.set('page', (page + 1).toString());
      linkHeaderParts.push(`<${urlBase}?${queryParams.toString()}>; rel="next"`);
    }
    if (linkHeaderParts.length > 0) {
      res.setHeader('Link', linkHeaderParts.join(', '));
    }

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
    // Flatten errors for detailed reporting
    const errors = { 
      ...(idParams.success ? {} : idParams.error.flatten().fieldErrors),
      ...(qParams.success ? {} : qParams.error.flatten().fieldErrors),
    };
    res
      .status(400)
      .json(wpError('rest_invalid_param', 'Invalid parameter(s)', 400, { 
        details: { fieldErrors: errors } 
      }));
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
      .json(wpError('rest_forbidden', 'Sorry, you are not allowed to view this post in edit context.', 403));
    return;
  }

  try {
    const post = await getPostById(postId);

    if (!post) {
      res
        .status(404)
        .json(wpError('rest_post_invalid_id', 'Invalid post ID.', 404)); // Correct message
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
  // @ts-expect-error
  async (req: AuthRequest, res: Response) => {

    const postInput = {
      ...req.body, // Spread all body properties
      post_author: req.user!.id, // Ensure author is set
    };

    console.log("[REST] postInput:", postInput);

    try {
      const post = await createPost(postInput);
      res.status(201).json(mapPostToWP(post, RestContext.edit));
      return;
    } catch (e: any) {
      if (e instanceof ZodError) {
        const formattedError = formatZodErrorForWpRest(e);
        return res.status(formattedError.status).json(formattedError.body);
      }
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
        .json(wpError('rest_invalid_param', 'Invalid parameter(s): id', 400));
      return;
    }
    const data = req.body;
    try {
      const updated = await updatePost(idParams.data.id, {
        post_title: data.title,
        post_content: data.content,
        post_excerpt: data.excerpt,
        post_status: data.status,
        post_name: data.slug,

        meta: data.meta,
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
      // Flatten errors for detailed reporting
      const errors = { 
        ...(idParams.success ? {} : idParams.error.flatten().fieldErrors),
        ...(qParams.success ? {} : qParams.error.flatten().fieldErrors),
      };
      res
        .status(400)
        .json(wpError('rest_invalid_param', 'Invalid parameter(s)', 400, { 
          details: { fieldErrors: errors } 
        }));
      return;
    }
    const force = qParams.data.force;

    // Get the post before deleting/trashing to return it
    const postToDelete = await getPostById(idParams.data.id);
    if (!postToDelete) {
       res
         .status(404)
         .json(wpError('rest_post_invalid_id', 'Invalid post ID.', 404)); 
       return;
    }
    const previousPostMapped = mapPostToWP(postToDelete, RestContext.view); // Map before potential delete

    try {
      if (!force) {
        // soft delete => trash
        const trashed = await updatePost(idParams.data.id, { post_status: 'trash' });
        // WP returns the full trashed post object
        res.json(mapPostToWP(trashed!, RestContext.view)); 
        return;
      } else {
        // hard delete
        await deletePost(idParams.data.id);
        // WP returns { deleted: true, previous: { ... } }
        res.json({ 
          deleted: true, 
          previous: previousPostMapped 
        }); 
        return;
      }
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
