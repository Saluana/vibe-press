import { wpError } from "../../core/utils/wpError";
import { serverHooks } from "../../core/hooks/hookEngine.server";
import { getUsers } from "../../core/services/user/user.services";
import { Router, Request, Response } from "express";

import {z} from 'zod';

const router = Router();

function getMd5Hash(email: string): string {
  return new Bun.CryptoHasher('md5').update(email.trim().toLowerCase()).digest('hex');
}

// Map DB user to WP REST API user format
function mapUserToWP(user: any): any {
  const hash = user.user_email ? getMd5Hash(user.user_email) : '';
  const baseUrl = "http://localhost:4000"; // Change to your site URL if needed
  return {
    id: user.ID || user.id,
    name: user.display_name,
    url: user.user_url,
    description: user.description || "",
    link: `${baseUrl}/author/${user.user_nicename || user.slug}/`,
    slug: user.user_nicename || user.slug,
    avatar_urls: {
      24: `https://secure.gravatar.com/avatar/${hash}?s=24&d=mm&r=g`,
      48: `https://secure.gravatar.com/avatar/${hash}?s=48&d=mm&r=g`,
      96: `https://secure.gravatar.com/avatar/${hash}?s=96&d=mm&r=g`
    },
    meta: user.meta || [],
    _links: {
      self: [
        { href: `${baseUrl}/wp-json/wp/v2/users/${user.ID || user.id}`, targetHints: { allow: ["GET"] } }
      ],
      collection: [
        { href: `${baseUrl}/wp-json/wp/v2/users` }
      ]
    }
  };
}


// Arktype schemas for validation
const CreateUserValidation = z.object({
  username: z.string(),
  email: z.string(),
  password: z.string(),
  name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  url: z.string().optional(),
  description: z.string().optional(),
  locale: z.string().optional(),
  nickname: z.string().optional(),
  slug: z.string().optional(),
  roles: z.array(z.string()).optional(),
  meta: z.record(z.string(), z.any()).optional()
}).strip();

const UpdateUserValidation = z.object({
  username: z.string().optional(),
  email: z.string().optional(),
  password: z.string().optional(),
  name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  url: z.string().optional(),
  description: z.string().optional(),
  locale: z.string().optional(),
  nickname: z.string().optional(),
  slug: z.string().optional(),
  roles: z.array(z.string()).optional(),
  meta: z.record(z.string(), z.any()).optional()
}).strip();

const formatUserResponse = async (user: any) => {
  return {
    ID: user.ID,
    username: user.user_login,
    email: user.user_email,
    name: user.display_name,
    first_name: user.first_name,
    last_name: user.last_name,
    url: user.user_url,
    description: user.description,
    locale: user.locale,
    nickname: user.nickname,
    slug: user.slug,
    roles: user.roles,
    meta: user.meta
  };
};

// @ts-expect-error
router.get('/users', async (req: Request, res: Response) => {
  try {
    const GetUsersValidation = z.object({
      context: z.enum(['view', 'embed', 'edit']).optional(),
      page: z.number().optional(),
      per_page: z.number().optional(),
      search: z.string().optional(),
      exclude: z.union([z.number(), z.array(z.number())]).optional(),
      include: z.union([z.number(), z.array(z.number())]).optional(),
      offset: z.number().optional(),
      order: z.enum(['asc', 'desc']).optional(),
      orderby: z.enum(['id', 'name', 'slug', 'email', 'url', 'registered_date']).optional(),
      slug: z.union([z.string(), z.array(z.string())]).optional(),
      roles: z.union([z.string(), z.array(z.string())]).optional(),
      capabilities: z.union([z.string(), z.array(z.string())]).optional(),
      who: z.enum(['authors']).optional(),
      has_published_posts: z.boolean().optional()
    }).strip();
  
    const query = req.query;
  
    const queryParams = {
      context: query.context as 'view' | 'embed' | 'edit' | undefined,
      page: parseInt(query.page as string) || 1,
      perPage: parseInt(query.per_page as string) || 10,
      search: query.search as string | undefined,
      exclude: Array.isArray(query.exclude) ? (query.exclude as string[]).map(Number) : query.exclude ? [parseInt(query.exclude as string)] : undefined,
      include: Array.isArray(query.include) ? (query.include as string[]).map(Number) : query.include ? [parseInt(query.include as string)] : undefined,
      offset: parseInt(query.offset as string) || 0,
      order: query.order as 'asc' | 'desc' | undefined,
      orderBy: query.orderby as 'id' | 'include' | 'name' | 'registered_date' | 'slug' | 'email' | 'url' | undefined,
      slug: Array.isArray(query.slug) ? query.slug as string[] : query.slug ? [query.slug as string] : undefined,
      hasPublishedPosts: query.has_published_posts === 'true' ? true : query.has_published_posts === 'false' ? false : undefined
    };
  
    const validationResult = GetUsersValidation.safeParse(queryParams);

    const invalidParams = validationResult.success ? undefined : validationResult.error;

    if (invalidParams) {
      const errorResponse = wpError('400', 'Invalid query parameters', 400, {
        details: invalidParams.message || 'There was an issue with one or more provided query parameters.'
      });
      return res.status(400).json(errorResponse);
    }
  
    try {
      const users = await getUsers(queryParams);
      // Map users to WP REST API shape
      const wpUsers = users.map(mapUserToWP);
      return res.json(wpUsers);
    } catch (err: any) {
      await serverHooks.doAction('users.get:error', { error: err });
      return res.status(500).json(wpError('500', err.message || 'Unknown error', 500));
    }
  } catch (err: any) {
    console.error('Error processing /users request:', err);
    await serverHooks.doAction('users.get:error', { error: err });
    return res.status(500).json(wpError('500', err.message || 'Unknown error', 500));
  }
});
  
  

export default router;