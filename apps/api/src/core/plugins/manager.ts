/* ──────────────────────────────────────────────────────────────
   apps/api/src/core/plugins/manager.ts
   Accepts both classic-object plugins and “definePlugin(fn)” style
   ────────────────────────────────────────────────────────────── */

   import path            from 'node:path';
   import { createRequire } from 'node:module';
   import { db, schema }  from '@vp/core/db';
   import { eq, sql }     from 'drizzle-orm';
   import { cache }       from '@vp/core/utils/cacheManager';
   import { PluginManifestSchema } from './pluginManifest.schema';
   import { serverHooks} from '@vp/core/hooks/hookEngine.server';
   import type { PluginContext } from '@vp/core/plugins/pluginManifest.schema';
import router from '../../api/rest/auth';
import { env } from 'node:process';

   
   /* ------------------------------------------------------------------ */
   /*  Constants & helpers                                               */
   /* ------------------------------------------------------------------ */
   const ACTIVE_KEY  = 'active_plugins';                       // wp_options-style key
   const PLUGINS_DIR = path.resolve(__dirname, '../../../../../packages/plugins');
   const nodeRequire = createRequire(import.meta.url);         // CJS cache purge helper
   
   /* ------------------------------------------------------------------ */
   /*  Public types                                                      */
   /* ------------------------------------------------------------------ */
   
   export type ActivateFn = (ctx: PluginContext) =>
     | void
     | (() => void | Promise<void>)
     | Promise<void | (() => void | Promise<void>)>;
   
   export interface VpPlugin {
     activate  : (ctx: PluginContext) => Promise<void> | void;
     deactivate?: (ctx: PluginContext) => Promise<void> | void;
   }
   
   /* Convenience wrapper for authors
      --------------------------------- */
   export function definePlugin(fn: ActivateFn) { return fn; }
   
   /* ------------------------------------------------------------------ */
   /*  PluginManager                                                     */
   /* ------------------------------------------------------------------ */
   export class PluginManager {
     private active = new Map<string, VpPlugin>();
   
     /* Boot-time ---------------------------------------------------------------- */
     async init() {
       console.log('[PluginManager] Initializing and loading active plugins...');
       const list = await loadActiveList();
       for (const slug of list) {
         console.log(`[PluginManager] Enabling plugin: ${slug}`);
         await this.enable(slug);
       }
       console.log('[PluginManager] Initialization complete.');
     }
   
     /* Enable / persist --------------------------------------------------------- */
     async enable(slug: string) {
       if (this.active.has(slug)) {
         console.log(`[PluginManager] Plugin already enabled: ${slug}`);
         return;
       }
       try {
         /* 1. load manifest + module */
         console.log(`[PluginManager] Loading plugin: ${slug}`);
         const { manifest, plugin } = await this.load(slug);
   
         /* 2. build context */
         const ctx: PluginContext = { slug, cache, db, hooks: serverHooks, router, env };

         /* 3. normalise: function → object ------------------------------------ */
         const pluginObj = toPluginObject(plugin);
   
         /* 4. activate & remember */
         await pluginObj.activate(ctx);
         this.active.set(slug, pluginObj);
         console.log(`[PluginManager] Activated and registered: ${slug}`);
   
         await persistEnable(slug);


         // if the manifest opted into REST, tell the app to mount this router
         if (manifest.rest) {
           serverHooks.doAction('plugin.mount:rest', { slug, router: ctx.router });
         }

         serverHooks.doAction('plugin.enabled', { slug, manifest });
       } catch (err) {
         console.error(`[PluginManager] Failed to enable plugin: ${slug}`, err);
       }
     }
   
     /* Disable / persist -------------------------------------------------------- */
     async disable(slug: string) {
       const plugin = this.active.get(slug);
       if (!plugin) {
         console.log(`[PluginManager] Plugin not active: ${slug}`);
         return;
       }
       try {
         await plugin.deactivate?.({ slug, cache, db, hooks: serverHooks, router, env });
         this.active.delete(slug);
         await persistDisable(slug);
         serverHooks.doAction('plugin.disabled', { slug });
         console.log(`[PluginManager] Disabled and deregistered: ${slug}`);
       } catch (err) {
         console.error(`[PluginManager] Failed to disable plugin: ${slug}`, err);
       }
     }
   
     /* Hot reload (dev) --------------------------------------------------------- */
     async reload(slug: string) {
       console.log(`[PluginManager] Reloading plugin: ${slug}`);
       await this.disable(slug);
       purgeRequireCache(slug);
       await this.enable(slug);
       console.log(`[PluginManager] Reload complete: ${slug}`);
     }
   
     /* ------------------------------------------------------------------------ */
     /* internal loader                                                          */
     /* ------------------------------------------------------------------------ */
     private async load(slug: string) {
       const root         = path.join(PLUGINS_DIR, slug);
       const manifestPath = path.join(root, 'plugin.json');
       console.log(`[PluginManager] Loading manifest for: ${slug}`);
       const manifestRaw  = JSON.parse(await Bun.file(manifestPath).text());
       const manifest     = PluginManifestSchema.parse(manifestRaw);
       console.log(`[PluginManager] Manifest loaded for: ${slug}`);
       const mod          = await import(path.join(root, manifest.main));
       const exported     = mod.default as unknown;
       return { manifest, plugin: exported };
     }
   }
   
   /* ------------------------------------------------------------------ */
   /*  Functional-plugin → VpPlugin object                                */
   /* ------------------------------------------------------------------ */
   function toPluginObject(exported: unknown): VpPlugin {
     if (typeof exported === 'function') {
       /* functional style */
       let disposer: (() => void | Promise<void>) | undefined;
   
       const obj: VpPlugin = {
         async activate(ctx) {
           const maybe = await (exported as ActivateFn)(ctx);
           if (typeof maybe === 'function') disposer = maybe;
         },
         async deactivate() { await disposer?.(); },
       };
       return obj;
     }
   
     /* assume legacy object already matches VpPlugin */
     return exported as VpPlugin;
   }
   
   /* ------------------------------------------------------------------ */
   /*  Active-list persistence (DB + cache)                              */
   /* ------------------------------------------------------------------ */
   async function loadActiveList(): Promise<string[]> {
     const cached = await cache.get<string[]>(ACTIVE_KEY);
     if (Array.isArray(cached)) {
       console.log('[PluginManager] Loaded active plugin list from cache:', cached);
       return cached;
     }
     const row = await db
       .select({ val: schema.wp_options.option_value })
       .from(schema.wp_options)
       .where(eq(schema.wp_options.option_name, ACTIVE_KEY))
       .limit(1);
     const list = Array.isArray(row[0]?.val) ? (row[0]!.val as string[]) : [];
     await cache.set(ACTIVE_KEY, list);
     console.log('[PluginManager] Loaded active plugin list from DB:', list);
     return list;
   }
   
   async function writeActiveList(list: string[]) {
     console.log('[PluginManager] Persisting active plugin list:', list);
     await cache.set(ACTIVE_KEY, list);
   
     const exists = await db
       .select({ cnt: sql`count(*)`.mapWith(Number) })
       .from(schema.wp_options)
       .where(eq(schema.wp_options.option_name, ACTIVE_KEY))
       .then(r => r[0]?.cnt > 0);
     if (exists) {
       await db.update(schema.wp_options)
         .set({ option_value: list })
         .where(eq(schema.wp_options.option_name, ACTIVE_KEY));
       console.log('[PluginManager] Updated plugin list in DB.');
     } else {
       await db.insert(schema.wp_options).values({
         option_name : ACTIVE_KEY,
         option_value: list,
         autoload    : 'yes',
       });
       console.log('[PluginManager] Inserted new plugin list in DB.');
     }
   }
   
   async function persistEnable (slug: string) {
     const list = await loadActiveList();
     if (!list.includes(slug)) {
       list.push(slug);
       await writeActiveList(list);
       console.log(`[PluginManager] Plugin enabled persisted: ${slug}`);
     }
   }
   
   async function persistDisable(slug: string) {
     const list = (await loadActiveList()).filter(s => s !== slug);
     await writeActiveList(list);
     console.log(`[PluginManager] Plugin disable persisted: ${slug}`);
   }
   
   /* ------------------------------------------------------------------ */
   /*  Cache purge for hot-reload (CJS)                                  */
   /* ------------------------------------------------------------------ */
   function purgeRequireCache(slug: string) {
     const c: any = (nodeRequire as any).cache;
     if (!c) return;
     const match = `/plugins/${slug}/`;
     for (const id of Object.keys(c)) if (id.includes(match)) delete c[id];
   }
   