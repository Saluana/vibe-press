import { wpError } from "@vp/core/utils/wpError";
import { serverHooks } from "@vp/core/hooks/hookEngine.server";
import { getUsers, updateUser } from "@vp/core/services/user/user.services";
import {setUserMeta, setUserRole} from "@vp/core/services/user/userMeta.services";
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
  
// Update a specific user
// @ts-expect-error - Router typing issue, similar to GET route
router.post('/users/:id', async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
        return res.status(400).json(wpError('invalid_user_id', 'Invalid user ID.', 400));
    }

    const validationResult = UpdateUserValidation.safeParse(req.body);

    if (!validationResult.success) {
        return res.status(400).json(wpError('invalid_param', 'Invalid parameter(s).', 400, {
            invalid_params: validationResult.error.flatten().fieldErrors
        }));
    }

    // Explicitly exclude password from update data for now
    const { password, ...userData } = validationResult.data;

    if (Object.keys(userData).length === 0) {
        return res.status(400).json(wpError('no_data', 'No data provided for update.', 400));
    }

    try {
        // Map REST API fields to DB fields for the service
        const dbUpdateData: any = {}; // Use 'any' for now, or define a proper DB update type
        if (userData.username !== undefined) dbUpdateData.user_login = userData.username;
        if (userData.name !== undefined) dbUpdateData.display_name = userData.name;
        if (userData.first_name !== undefined) dbUpdateData.first_name = userData.first_name; // Assuming direct mapping or handled by service
        if (userData.last_name !== undefined) dbUpdateData.last_name = userData.last_name; // Assuming direct mapping or handled by service
        if (userData.email !== undefined) dbUpdateData.user_email = userData.email;
        if (userData.url !== undefined) dbUpdateData.user_url = userData.url;
        if (userData.description !== undefined) dbUpdateData.description = userData.description; // Assuming direct mapping or handled by service
        if (userData.nickname !== undefined) dbUpdateData.nickname = userData.nickname; // Assuming direct mapping or handled by service
        if (userData.slug !== undefined) dbUpdateData.user_nicename = userData.slug; // WP uses user_nicename for slug
        // locale, roles, meta might need specific handling in updateUser service
        if (userData.locale !== undefined) dbUpdateData.locale = userData.locale;
        if (userData.roles !== undefined) dbUpdateData.roles = userData.roles; // Pass roles through, service needs to handle
        if (userData.meta !== undefined) dbUpdateData.meta = userData.meta; // Pass meta through, service needs to handle

        // TODO: Add capability checks (e.g., 'edit_users' or editing self)
        const updatedUser = await updateUser(userId, dbUpdateData);
        if (!updatedUser) {
            return res.status(404).json(wpError('rest_user_invalid_id', 'Invalid user ID.', 404));
        }

        const wpUser = mapUserToWP(updatedUser);
        await serverHooks.doAction('user.update:success', { user: updatedUser });
        return res.json(wpUser);
    } catch (err: any) {
        console.error(`Error updating user ${userId}:`, err);
        await serverHooks.doAction('user.update:error', { error: err, userId });
        // Handle potential specific errors like duplicate username/email if needed
        if (err.code === '...') { // Example: Check for specific DB errors
            // return res.status(400).json(wpError('existing_user_login', 'Username already exists.', 400));
        }
        return res.status(500).json(wpError('rest_user_update_failed', err.message || 'Could not update user.', 500));
    }
});

export default router;