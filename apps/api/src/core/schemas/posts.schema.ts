import { z } from 'zod';
import { post_status_enum } from '@vp/core/db/schema/posts';
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