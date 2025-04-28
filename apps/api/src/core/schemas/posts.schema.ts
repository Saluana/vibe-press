import { z } from 'zod';
import { post_status_enum, comment_status_enum, ping_status_enum, post_type_enum } from '@vp/core/db/schema/posts';
import {
    Context as RestContext,
  } from '@vp/core/utils/restContext';


/*─────────────────────────────────────────────────────────────*
 *  Validation Schemas
 *─────────────────────────────────────────────────────────────*/

// GET /posts query
export const listQuerySchema = z.object({
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
export const singleQuerySchema = z.object({
  context: z
    .enum([RestContext.view, RestContext.embed, RestContext.edit])
    .optional(),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int(),
});

// DELETE /posts query
export const deleteQuerySchema = z.object({
  force: z.coerce.boolean().default(false),
});


export const postBodySchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  excerpt: z.string().optional(),
  status: z.enum([...post_status_enum] as [string, ...string[]]).optional(),
  slug: z.string().optional(),
  meta: z.record(z.any()).optional(),
});

export const CreatePostValidation = z.object({
  post_date: z.date().optional(),
  post_date_gmt: z.date().optional(),
  post_author: z.number(),
  post_title: z.string().default(''),
  post_content: z.string().default(''),
  post_excerpt: z.string().optional(),
  post_status: z.enum([...post_status_enum] as [string, ...string[]]).default('draft'),
  post_name: z.string().optional(),
  post_type: z.enum([...post_type_enum] as [string, ...string[]]).optional(),
  post_parent: z.number().optional(),
  guid: z.string().optional(),
  post_password: z.string().optional(),
  menu_order: z.number().optional(),
  comment_status: z.enum([...comment_status_enum] as [string, ...string[]]),
  ping_status: z.enum([...ping_status_enum] as [string, ...string[]]),
  meta: z.record(z.any()).optional(),
  categories: z.array(z.number()).optional(),
  tags: z.array(z.number()).optional(),
  featured_media: z.number().optional(),
}).strict();

export const UpdatePostValidation = z.object({
  post_author: z.number().optional(),
  post_title: z.string().optional(),
  post_content: z.string().optional(),
  post_excerpt: z.string().optional(),
  post_status: z.enum([...post_status_enum] as [string, ...string[]]).optional(),
  post_name: z.string().optional(),
  post_type: z.enum([...post_type_enum] as [string, ...string[]]).optional(),
  post_parent: z.number().optional(),
  guid: z.string().optional(),
  menu_order: z.number().optional(),
  comment_status: z.enum([...comment_status_enum] as [string, ...string[]]).optional(),
  ping_status: z.enum([...ping_status_enum] as [string, ...string[]]).optional(),
  meta: z.record(z.any()).optional(),
});

export const GetPostsValidation = z.object({
  page: z.number().optional(),
  perPage: z.number().optional(),
  search: z.string().optional(),
  exclude: z.array(z.number()).optional(),
  include: z.array(z.number()).optional(),
  offset: z.number().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  orderBy: z.enum(['id', 'include', 'title', 'date', 'slug', 'author', 'modified']).optional(),
  slug: z.array(z.string()).optional(),
  author: z.number().or(z.array(z.number())).optional(),
  statuses: z.array(z.string()).optional(),
  types: z.array(z.string()).optional(),
});