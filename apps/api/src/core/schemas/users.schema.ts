import { z } from "zod";
import { Context as RestContext } from "@vp/core/utils/restContext";

/*─────────────────────────────────────────────────────────────*/
/* ⚙️  Validation schemas                                         */
  export const CreateUserSchema = z
   .object({
     username: z.string(),
     name: z.string().optional(),
     first_name: z.string().optional(),
     last_name: z.string().optional(),
     email: z.string().email(),
     url: z.string().url().optional(),
     description: z.string().optional(),
     locale: z.enum(["", "en_US"]).optional(),
     nickname: z.string().optional(),
     slug: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional(),
     roles: z.array(z.string()).optional(),
     password: z.string(),
     meta: z.record(z.string(), z.any()).optional(),
   })
   .strict();

export const UpdateUserValidation = z
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

      /** 1. Build & validate query‑params */
    export  const GetUsersValidation = z
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