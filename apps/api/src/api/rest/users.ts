// src/api/rest/users.ts
import { wpError } from "@vp/core/utils/wpError";
import { serverHooks } from "@vp/core/hooks/hookEngine.server";
import { GetUsersParams, getUsers, updateUser, deleteUser } from "@vp/core/services/user/user.services";
import { Router, Request, Response } from "express";
import { BASE_URL } from "@vp/core/config";
import {
  requireCapabilities,
  requireAuth,
  optionalAuth,
  AuthRequest,
} from "../middleware/verifyRoles.middleware";
import { z } from "zod";
import { sanitiseForContext, Context as RestContext } from "@vp/core/utils/restContext";

const router = Router();

function getMd5Hash(email: string): string {
  return new Bun.CryptoHasher("md5")
    .update(email.trim().toLowerCase())
    .digest("hex");
}

/**
 * Return the list of HTTP methods the requesting user is allowed to use
 * against the given target user.
 */
function getAllowedMethods(
  viewer: { id: number; capabilities: string[] } | null,
  targetUser: { ID?: number; id?: number }
): string[] {
  const allowed = ["GET"];
  if (!viewer) return allowed;

  const isSelf = viewer.id === (targetUser.ID ?? targetUser.id);
  const caps = viewer.capabilities || [];

  if (isSelf || caps.includes('edit_users')) {
    allowed.push('POST', 'PUT', 'PATCH');
  }

  if (caps.includes("delete_users")) {
    allowed.push("DELETE");
  }
  return allowed;
}

/**
 * Maps a user object from the database to the format expected by the WordPress REST API.
 * Includes context-based field filtering and capability checks.
 */
function mapUserToWP(
  user: any,
  viewer: { id: number; capabilities: string[] } | null,
  context: RestContext
): Partial<any> {

  const isSelf = viewer && viewer.id === user.id;
  const canEdit = isSelf || viewer?.capabilities?.includes("edit_users");

  // Start building the full object (similar to context=edit)
  const full: Record<string, any> = {
    id: user.id,
    name: user.display_name,
    url: user.user_url,
    description: user.description ?? "",
    link: `${BASE_URL}/author/${user.user_nicename ?? user.slug}/`,
    slug: user.user_nicename ?? user.slug,
    avatar_urls: {
      24: `https://secure.gravatar.com/avatar/${getMd5Hash(user.user_email)}?s=24&d=mm&r=g`,
      48: `https://secure.gravatar.com/avatar/${getMd5Hash(user.user_email)}?s=48&d=mm&r=g`,
      96: `https://secure.gravatar.com/avatar/${getMd5Hash(user.user_email)}?s=96&d=mm&r=g`,
    },
    locale: user.locale,
    nickname: user.nickname,
    first_name: user.first_name,
    last_name: user.last_name,
    roles: user.roles,
    meta: user.meta ?? [],
    _links: {
      self: [
        {
          href: `${BASE_URL}/wp-json/wp/v2/users/${user.id}`,
          targetHints: {
            allow: getAllowedMethods(viewer, user),
          },
        },
      ],
      collection: [{ href: `${BASE_URL}/wp-json/wp/v2/users` }],
    },
  };

  // Add fields only visible in 'edit' context or to privileged users
  if (canEdit) {
    full.email = user.user_email;
    full.registered_date = user.user_registered;
    full.capabilities = user.capabilities || {};
    full.extra_capabilities = user.extra_capabilities || {};
    full.roles = user.roles || [];
  }

  // Define field sets for different contexts
  const userFieldSets = {
    view: [
      "id", "name", "url", "description", "link", "slug", "avatar_urls", "locale", "nickname", "first_name", "last_name", "roles", "meta", "_links"
    ],
    embed: [
      "id", "name", "link", "slug", "avatar_urls", "_links"
    ],
    // 'edit' context returns the full object by default in sanitiseForContext
  };

  // Shape the object based on context using the utility
  return sanitiseForContext(full, context, userFieldSets);
}

/*─────────────────────────────────────────────────────────────*/
/* ⚙️  Validation schemas                                         */
const CreateUserValidation = z
  .object({
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
    meta: z.record(z.string(), z.any()).optional(),
  })
  .strip();

const UpdateUserValidation = z
  .object({
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
    meta: z.record(z.string(), z.any()).optional(),
  })
  .strip();

/*─────────────────────────────────────────────────────────────*/
/* 📜  GET /users                                                */
router.get("/users", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    /** 1. Build & validate query‑params */
    const GetUsersValidation = z
      .object({
        context: z.nativeEnum(RestContext).optional(),
        page: z.coerce.number().int().min(1).optional(),
        per_page: z.coerce.number().int().min(1).max(100).optional(),
        search: z.string().optional(),
        exclude: z
          .union([z.coerce.number(), z.array(z.coerce.number())])
          .optional(),
        include: z
          .union([z.coerce.number(), z.array(z.coerce.number())])
          .optional(),
        offset: z.coerce.number().optional(),
        order: z.enum(["asc", "desc"]).optional(),
        orderby: z
          .enum([
            "id",
            "include",
            "name",
            "registered_date",
            "slug",
            "email",
            "url",
          ])
          .optional(),
        slug: z.union([z.string(), z.array(z.string())]).optional(),
        roles: z.union([z.string(), z.array(z.string())]).optional(),
        capabilities: z.union([z.string(), z.array(z.string())]).optional(),
        who: z.enum(["authors"]).optional(),
        has_published_posts: z.boolean().optional(),
      })
      .strip();

    const raw = req.query;
    const params = {
      context: raw.context as RestContext | undefined,
      page: raw.page,
      per_page: raw.per_page,
      search: raw.search,
      exclude: raw.exclude,
      include: raw.include,
      offset: raw.offset,
      order: raw.order,
      orderby: raw.orderby,
      slug: raw.slug,
      roles: raw.roles,
      capabilities: raw.capabilities,
      who: raw.who,
      has_published_posts: raw.has_published_posts,
    };

    const validation = GetUsersValidation.safeParse(params);
    if (!validation.success) {
      res.status(400).json(
        wpError("rest_invalid_param", "Invalid query parameters.", 400, {
          details: validation.error.format(),
        })
      );
      return;
    }

    // Explicitly type the validated data
    const validatedData = validation.data;
    // Destructure validated data, relying on Zod types and defaults
    let { context = RestContext.view, page = 1, per_page = 10, ...restFilters } =
      validatedData;

    const queryParams: any = {
      ...validation.data,
      page: validation.data.page ? Number(validation.data.page) : 1,
      perPage: validation.data.per_page
        ? Number(validation.data.per_page)
        : 10,
      order: validation.data.order as "asc" | "desc" | undefined,
      orderBy: validation.data.orderby as
        | "id"
        | "include"
        | "name"
        | "registered_date"
        | "slug"
        | "email"
        | "url"
        | undefined,
    };

    /** 2. Auth / capability checks */
    const viewer =
      req.user && req.user.id
        ? {
            id: req.user.id,
            capabilities: req.user.capabilities || [],
          }
        : null;

    // Check permission for 'edit' context
    // Use enum member for comparison
    if (context === RestContext.edit) {
      if (
        !viewer ||
        !viewer.capabilities.includes("list_users")
      ) {
        res.status(403).json(
          wpError(
            "rest_forbidden",
            "You do not have permission to list users in edit context.",
            403
          )
        );
        return;
      }
    }

    /** 3. Limit unauthenticated requests to authors w/ published posts */
    if (!viewer) {
      queryParams.who = "authors";
      queryParams.hasPublishedPosts = true;
      // Force context=view if someone set edit
      // Use enum members for comparison and assignment
      context = context === RestContext.embed ? RestContext.embed : RestContext.view;
    }

    /** 4. Fetch + sanitise */
    const users = await getUsers(queryParams);
    const wpUsers = users.map((u: any) =>
      mapUserToWP(u, viewer, context)
    );
    res.json(wpUsers);
  } catch (err: any) {
    console.error("Error processing /users:", err);
    await serverHooks.doAction("rest.users.get:action:error", { error: err });
    res
      .status(500)
      .json(wpError("rest_unknown", err.message || "Unknown error", 500));
  }
});
/*─────────────────────────────────────────────────────────────*/
/* 📜  GET /users/:id                                           */
/**
 * - Public for `context=view` or `embed`
 * - Authenticated + `edit_users` required for `context=edit`
 */
router.get(
  "/users/:id",
  optionalAuth,                    
  // @ts-expect-error
  async (req: AuthRequest, res: Response) => {
    let { id: rawId } = req.params;
    const ctxQuery = (req.query.context as string)?.toLowerCase();
    const allowedContexts = Object.values(RestContext); 
    const context: RestContext =
      allowedContexts.includes(ctxQuery as any) ? (ctxQuery as RestContext) : RestContext.view;

    // Resolve `:id` or `me`
    let userId: number | null = null;
    if (rawId === "me") {
      userId = req.user?.id ?? null;
    } else {
      userId = Number(rawId);
    }

    if (!userId || Number.isNaN(userId)) {
      return res
        .status(400)
        .json(wpError("rest_invalid_param", "Invalid user ID.", 400));
    }

    // If they asked for `edit`, enforce auth+cap
    if (context === RestContext.edit) {
      if (!req.user) {
        return res
          .status(401)
          .json(wpError("rest_not_logged_in", "Authentication required.", 401));
      }
      const isSelf = req.user.id === userId;
      const canEditUsers = req.user.capabilities?.includes("edit_users");
      if (!isSelf && !canEditUsers) {
        return res
          .status(403)
          .json(
            wpError(
              "rest_forbidden",
              "You do not have permission to edit this user.",
              403
            )
          );
      }
    }

    // Fetch
    try {
      const users = await getUsers({
        include: [userId],
        // note: your getUsers() currently ignores context, but you
        // could pass it through if needed for DB‐level filtering.
      });
      if (!users?.length) {
        return res
          .status(404)
          .json(wpError("rest_user_invalid_id", "User not found", 404));
      }

      // Map with full viewer context
      const viewer = req.user
        ? { id: req.user.id, capabilities: req.user.capabilities ?? [] }
        : null;

      return res.json(mapUserToWP(users[0], viewer, context));
    } catch (err: any) {
      console.error("GET /users/:id failed", err);
      return res
        .status(500)
        .json(wpError("rest_unknown", err.message || "Unknown error", 500));
    }
  }
);


/*─────────────────────────────────────────────────────────────*/
/* 📝  PUT /users/:id                                            */
router.put(
  "/users/:id",
  requireAuth,
  requireCapabilities({
    capabilities: ["edit_users"],
    allowOwner: true,
    ownerIdParam: "id",
  }),
  async (req: Request, res: Response) => {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) {
      res
        .status(400)
        .json(wpError("invalid_user_id", "Invalid user ID.", 400));
      return;
    }

    const validation = UpdateUserValidation.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json(
        wpError("invalid_param", "Invalid parameter(s).", 400, {
          invalid_params: validation.error.flatten().fieldErrors,
        })
      );
      return;
    }

    const { password, ...userData } = validation.data;
    if (!Object.keys(userData).length) {
      res
        .status(400)
        .json(wpError("no_data", "No data provided for update.", 400));
      return;
    }

    const dbData: any = {};
    if (userData.username !== undefined) dbData.user_login = userData.username;
    if (userData.name !== undefined) dbData.display_name = userData.name;
    if (userData.first_name !== undefined)
      dbData.first_name = userData.first_name;
    if (userData.last_name !== undefined)
      dbData.last_name = userData.last_name;
    if (userData.email !== undefined) dbData.user_email = userData.email;
    if (userData.url !== undefined) dbData.user_url = userData.url;
    if (userData.description !== undefined)
      dbData.description = userData.description;
    if (userData.nickname !== undefined) dbData.nickname = userData.nickname;
    if (userData.slug !== undefined)
      dbData.user_nicename = userData.slug;
    if (userData.locale !== undefined) dbData.locale = userData.locale;
    if (userData.roles !== undefined) dbData.roles = userData.roles;
    if (userData.meta !== undefined) dbData.meta = userData.meta;

    try {
      const updatedUser = await updateUser(userId, dbData);

      if (!updatedUser) {
        res
          .status(404)
          .json(wpError("rest_user_invalid_id", "User not found", 404));
        return;
      }

      const viewer = {
        id: (req as any).user?.id,
        capabilities: (req as any).user?.capabilities || [],
      };
      res.json(mapUserToWP(updatedUser, viewer, RestContext.edit));
      return;
    } catch (err: any) {
      console.error(`Error updating user ${userId}:`, err);
      await serverHooks.doAction("rest.user.update:action:error", {
        error: err,
        userId,
      });
      res.status(500).json(
        wpError(
          "rest_user_update_failed",
          err.message || "Could not update user.",
          500
        )
      );
      return;
    }
  }
);

/*─────────────────────────────────────────────────────────────*/
/* 🚮  DELETE /users/:id                                         */
router.delete(
  "/users/:id",
  requireAuth,
  requireCapabilities({
    capabilities: ["delete_users"],
    allowOwner: false,
    ownerIdParam: "id",
  }),
  async (req: AuthRequest, res: Response) => {
    const userId = Number(req.params.id);

    try {
      const deletedUser = await deleteUser(userId);
      if (!deletedUser) {
        res
          .status(404)
          .json(wpError("rest_user_invalid_id", "User not found", 404));
        return;
      }

      // Success response
      // Return the deleted user object (or just status)
      res.json({
        deleted: true,
        previous: mapUserToWP(deletedUser, null, RestContext.view), // Show limited info
      });
      return;
    } catch (err: any) {
      console.error(`DELETE /users/${userId} failed`, err);
      // Ensure return after sending error response
      res
        .status(500)
        .json(wpError("rest_unknown", err.message || "Unknown error", 500));
      return;
    }
  }
);

export default router;
