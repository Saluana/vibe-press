import { wpError } from "@vp/core/utils/wpError";
import { serverHooks } from "@vp/core/hooks/hookEngine.server";
import { createPost, getPostById, updatePost, deletePost, getPosts } from "@vp/core/services/post/posts.services";
import { Router, Request, Response } from "express";
import { BASE_URL } from "@vp/core/config";
import {
  requireCapabilities,
  requireAuth,
  optionalAuth,
  AuthRequest,
} from "../middleware/verifyRoles.middleware";
import { sanitiseForContext, Context as RestContext } from "@vp/core/utils/restContext";
import {z} from 'zod';

const router = Router();

export default router;