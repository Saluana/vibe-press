import { wpError } from "../../core/utils/wpError";
import { serverHooks } from "../../core/hooks/hookEngine.server";
import { getUsers, createUser, getUserByLoginOrEmail, updateUser, deleteUser } from "../../core/services/user/user.services";
import { getUserMeta, setUserMeta, deleteUserMeta } from "../../core/services/user/userMeta.services";
import { type } from "arktype";
import { Router, Request, Response } from "express";
import {toWpDatetime, fromWpDatetime} from '../../core/utils/wpTime';
import { db, schema } from '../../core/db';
// import { requireAuth, getCurrentUserId } from "../../core/middleware/auth"; // If you have auth helpers

const router = Router();

// Arktype schemas for validation
const CreateUserValidation = type({
  username: "string",
  email: "string",
  password: "string",
  name: "string?",
  first_name: "string?",
  last_name: "string?",
  url: "string?",
  description: "string?",
  locale: "string?",
  nickname: "string?",
  slug: "string?",
  roles: "string[]?",
  meta: "object?"
});

const UpdateUserValidation = type({
  username: "string?",
  email: "string?",
  password: "string?",
  name: "string?",
  first_name: "string?",
  last_name: "string?",
  url: "string?",
  description: "string?",
  locale: "string?",
  nickname: "string?",
  slug: "string?",
  roles: "string[]?",
  meta: "object?"
});

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
    const GetUsersValidation = type({
      context: "'view' | 'embed' | 'edit'?" as const,
      page: "number?",
      per_page: "number?",
      search: "string?",
      exclude: "number | number[]?",     // string because query params are strings
      include: "number | number[]?",
      offset: "number?",
      order: "'asc' | 'desc'?",
      orderby: "'id' | 'name' | 'slug' | 'email' | 'url' | 'registered_date'?",
      slug: "string | string[]?",
      roles: "string | string[]?",
      capabilities: "string | string[]?",
      who: "'authors'?",
      has_published_posts: "boolean?"
    });
  
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
  
    const validationResult = GetUsersValidation(queryParams);

    const invalidParams = validationResult as any;

    if (invalidParams.errors && invalidParams.errors.length > 0) {
      const errorResponse = wpError('400', 'Invalid query parameters', 400, {
        details: invalidParams.summary || 'There was an issue with one or more provided query parameters.'
      });
      return res.status(400).json(errorResponse);
    }
  
    try {
      const users = await getUsers(queryParams);

      return res.json(users); // optionally wrap this for WP shape
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