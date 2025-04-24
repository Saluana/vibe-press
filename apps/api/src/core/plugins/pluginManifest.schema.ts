import { z } from "zod";
import { Router } from "express";
import { db } from "@vp/core/db";
import {HookAPI} from "@vp/packages/hooks/createHookEngine";
import { cache } from "@vp/core/utils/cacheManager";

export const PluginManifestSchema = z.object({
    name:        z.string().regex(/^[a-z0-9-_]+$/),          // unique slug
    version:     z.string(),                                // semver
    description: z.string().optional(),
    author:      z.string().optional(),
    // bootstrap entry (relative to package root)
    main:        z.string().default('src/index.ts'),
  
    // compatibility
    requires:    z.object({ vibepress: z.string().optional() }).optional(),
  
    // activation flags
    autoload:    z.boolean().default(false),                // auto‑activate on install
    showInAdmin: z.boolean().default(true),
  
    // optional REST/GraphQL toggles (plugin‑wide)
    rest:        z.boolean().default(false),
    graphql:     z.boolean().default(false),
  });

/**
 * The object your `activate()` callback will receive.
 * It contains exactly the services you wire up in your manager.
 */
export interface PluginContext {
  /** the plugin’s unique folder name */
  slug:     string

  /** shared in-process cache (Keyv + cache-manager) */
  cache:    typeof cache

  /** your Drizzle-ORM client */
  db:       typeof db

  /** your hook engine: typed addAction / doAction / removeAction, etc */
  hooks:    HookAPI

  /** the Express router you can mount REST endpoints on */
  router:   Router

  /** raw env if you need feature flags, secrets, etc */
  env:      Record<string,string|undefined>
}
  
  export type ActivateFn = (ctx: PluginContext) =>
    | void                                        // nothing to clean-up
    | (() => void | Promise<void>)                // return disposer
    | Promise<() => void | void>;                 // same but async
    
  export type DeactivateFn = ()                => Promise<void> | void;
  
  export interface VpPlugin {
    activate:   ActivateFn;
    deactivate?:DeactivateFn;
  }

  export type PluginManifest = z.infer<typeof PluginManifestSchema>;
  