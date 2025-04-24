// packages/core/hooks/createWPHook.ts

/**
 * AstroPress – Functional port of WordPress WP_Hook (TypeScript) **with an integrated
 * type‑safe Hook Registry**.
 *
 * – Each hook **must** be declared through `defineHook()` (or via the convenience
 *   `declareHooks()` helper) *before* it can be used by plugins.
 * – `addFilter()`, `doAction()` and their async/sync variants validate the hook
 *   name against the registry and throw if the hook is unknown.
 * – Developers get compile‑time safety via the exported `HookName` union type.
 * – Docs/IDE autocompletion come from `export const hookRegistry` which is the
 *   single source of truth for names and expected argument count.
 */

/* ─────────────────────────────────────────────────────────── */
/* 1 ▸ Registry primitives                                       */

// Represents the specification for a registered hook.
// Args defines the expected arguments when *calling* the hook.
// ReturnValue is relevant for filters, defining the type of the value they modify.
export interface HookSpec<Args extends any[] = any[], ReturnValue = any> {
  /** Type of hook: 'action' (side effects) or 'filter' (modifies value) */
  kind: 'action' | 'filter';
  /** Human‑readable description (optional but recommended) */
  description?: string;
  /** Expected total argument count when *calling* the hook. */
  acceptedArgs: number;
}

// Define all core hooks statically for compile-time type inference
export const HOOKS = {
  // 🧍 User Registration/Login
  'svc.user.create:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before user is created (service layer)' },
  'svc.user.create:action:after': { kind: 'action', acceptedArgs: 1, description: 'After user is created (service layer)' },
  'svc.user.create:filter:result': { kind: 'filter', acceptedArgs: 1, description: 'Filter user result after creation (service layer)' },

  // 🧍 User Get
  'svc.user.get:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before fetching user by login/email (service layer)' },
  'svc.user.get:action:after': { kind: 'action', acceptedArgs: 1, description: 'After fetching user by login/email (service layer)' },
  'svc.user.get:filter:result': { kind: 'filter', acceptedArgs: 1, description: 'Filter result of getUserByLoginOrEmail (service layer)' },

  // 🧍 Users Get (plural)
  'svc.users.get:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before fetching users (service layer)' },
  'svc.users.get:action:after': { kind: 'action', acceptedArgs: 1, description: 'After fetching users (service layer)' },
  'svc.users.get:filter:result': { kind: 'filter', acceptedArgs: 1, description: 'Filter result of getUsers (service layer)' },

  // 🧍 User Update
  'svc.user.update:filter:input': { kind: 'filter', acceptedArgs: 2, description: 'Filter input payload before user update (service layer)' },
  'svc.user.update:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before updating user (service layer)' },
  'svc.user.update:action:after': { kind: 'action', acceptedArgs: 1, description: 'After updating user (service layer)' },
  'svc.user.update:filter:result': { kind: 'filter', acceptedArgs: 1, description: 'Filter user result after update (service layer)' },

  // 🧍 User Delete
  'svc.user.delete:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before deleting user (service layer)' },
  'svc.user.delete:action:after': { kind: 'action', acceptedArgs: 1, description: 'After deleting user (service layer)' },
  'svc.user.delete:filter:result': { kind: 'filter', acceptedArgs: 1, description: 'Filter user result after delete (service layer)' },

  // --- UserMeta Service Layer Hooks ---
  'svc.userMeta.create:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before creating user meta defaults (service layer)' },
  'svc.userMeta.create:action:after': { kind: 'action', acceptedArgs: 1, description: 'After creating user meta defaults (service layer)' },
  'svc.userMeta.get:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before getUserMeta (service layer)' },
  'svc.userMeta.get:action:after': { kind: 'action', acceptedArgs: 1, description: 'After getUserMeta (service layer)' },
  'svc.userMeta.get:filter:result': { kind: 'filter', acceptedArgs: 3, description: 'Filter result of getUserMeta (service layer)' },
  'svc.userMeta.getBatch:filter:result': { kind: 'filter', acceptedArgs: 3, description: 'Filter result of getUserMetaBatch (service layer)' },
  'svc.userMeta.set:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before setUserMeta (service layer)' },
  'svc.userMeta.set:filter:input': { kind: 'filter', acceptedArgs: 3, description: 'Filter input value before setUserMeta (service layer)' },
  'svc.userMeta.set:action:after': { kind: 'action', acceptedArgs: 1, description: 'After setUserMeta (service layer)' },
  'svc.userMeta.delete:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before deleteUserMeta (service layer)' },
  'svc.userMeta.delete:action:after': { kind: 'action', acceptedArgs: 1, description: 'After deleteUserMeta (service layer)' },
  'svc.userMeta.delete:filter:result': { kind: 'filter', acceptedArgs: 1, description: 'Filter result of deleteUserMeta (service layer)' },
  'svc.userMeta.setRole:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before setUserRole (service layer)' },
  'svc.userMeta.setRole:action:after': { kind: 'action', acceptedArgs: 1, description: 'After setUserRole (service layer)' },
  'svc.userMeta.batchUpdate:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before batchUpdateUserMeta (service layer)' },
  'svc.userMeta.batchUpdate:action:after': { kind: 'action', acceptedArgs: 1, description: 'After batchUpdateUserMeta (service layer)' },
  'svc.userMeta.batchUpdate:filter:input': { kind: 'filter', acceptedArgs: 3, description: 'Filter input value before batchUpdateUserMeta (service layer)' },

  // --- Legacy/compat hooks (used elsewhere or for public API) ---
  'rest.users.create:action:after': { kind: 'action', acceptedArgs: 1, description: 'After users create (rest layer)' },
  'rest.user.update:action:error': { kind: 'action', acceptedArgs: 1, description: 'On user update failure' },
  'rest.users.get:action:error': { kind: 'action', acceptedArgs: 1, description: 'On users get failure' },
  'rest.user.login:action:error': { kind: 'action', acceptedArgs: 1, description: 'On user login failure' },
  'rest.users.create:action:error': { kind: 'action', acceptedArgs: 1, description: 'On users create failure' },
  
  'svc.user.can:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before checking user capabilities (service layer)' },
  'svc.user.can:action:after': { kind: 'action', acceptedArgs: 1, description: 'After checking user capabilities (service layer)' },
  'svc.user.can:filter:result': { kind: 'filter', acceptedArgs: 1, description: 'Filter result of user capability check (service layer)' },
  'svc.user.login:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before user login (service layer)' },
  'svc.user.login:action:after': { kind: 'action', acceptedArgs: 1, description: 'After user login (service layer)' },
  'svc.user.login:filter:result': { kind: 'filter', acceptedArgs: 1, description: 'Filter result of user login (service layer)' },
  'svc.user.login:action:error': { kind: 'action', acceptedArgs: 1, description: 'On user login failure' },
  'svc.jwt.sign:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before signing JWT' },
  'svc.jwt.sign:action:after': { kind: 'action', acceptedArgs: 2, description: 'After JWT is signed' },
  'svc.jwt.verify:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before verifying JWT' },
  'svc.jwt.verify:action:after': { kind: 'action', acceptedArgs: 2, description: 'After JWT is verified' },

  // Posts hooks
  'svc.post.create:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before creating a post (service layer)' },
  'svc.post.create:action:after': { kind: 'action', acceptedArgs: 1, description: 'After creating a post (service layer)' },
  'svc.post.create:filter:result': { kind: 'filter', acceptedArgs: 1, description: 'Filter result of post creation (service layer)' },

  'svc.post.get:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before getting a post (service layer)' },
  'svc.post.get:action:after': { kind: 'action', acceptedArgs: 1, description: 'After getting a post (service layer)' },
  'svc.post.get:filter:result': { kind: 'filter', acceptedArgs: 1, description: 'Filter result of getting a post (service layer)' },

  'svc.post.update:filter:input': { kind: 'filter', acceptedArgs: 1, description: 'Filter input data before updating a post (service layer)' },
  'svc.post.update:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before updating a post (service layer)' },
  'svc.post.update:action:after': { kind: 'action', acceptedArgs: 1, description: 'After updating a post (service layer)' },
  'svc.post.update:filter:result': { kind: 'filter', acceptedArgs: 1, description: 'Filter result of post update (service layer)' },

  'svc.post.delete:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before deleting a post (service layer)' },
  'svc.post.delete:action:after': { kind: 'action', acceptedArgs: 1, description: 'After deleting a post (service layer)' },
  'svc.post.delete:filter:result': { kind: 'filter', acceptedArgs: 1, description: 'Filter result of post deletion (service layer)' },

  'svc.posts.get:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before getting multiple posts (service layer)' },
  'svc.posts.get:action:after': { kind: 'action', acceptedArgs: 1, description: 'After getting multiple posts (service layer)' },
  'svc.posts.get:filter:result': { kind: 'filter', acceptedArgs: 1, description: 'Filter result of getting multiple posts (service layer)' },

  //Post Meta
  'svc.postMeta.create:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before creating default post meta (service layer)' },
  'svc.postMeta.create:action:after': { kind: 'action', acceptedArgs: 1, description: 'After creating default post meta (service layer)' },

  'svc.postMeta.get:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before getting single post meta (service layer)' },
  'svc.postMeta.get:action:after': { kind: 'action', acceptedArgs: 1, description: 'After getting single post meta (service layer)' },
  'svc.postMeta.get:filter:result': { kind: 'filter', acceptedArgs: 1, description: 'Filter result of getting single post meta (service layer)' },

  'svc.postMeta.getBatch:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before getting batch post meta (service layer)' },
  'svc.postMeta.getBatch:action:after': { kind: 'action', acceptedArgs: 1, description: 'After getting batch post meta (service layer)' },
  'svc.postMeta.getBatch:filter:result': { kind: 'filter', acceptedArgs: 1, description: 'Filter result of getting batch post meta (service layer)' },

  'svc.postMeta.set:filter:input': { kind: 'filter', acceptedArgs: 1, description: 'Filter input data before setting post meta (service layer)' },
  'svc.postMeta.set:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before setting post meta (service layer)' },
  'svc.postMeta.set:action:after': { kind: 'action', acceptedArgs: 1, description: 'After setting post meta (service layer)' },

  'svc.postMeta.delete:action:before': { kind: 'action', acceptedArgs: 1, description: 'Before deleting post meta (service layer)' },
  'svc.postMeta.delete:action:after': { kind: 'action', acceptedArgs: 1, description: 'After deleting post meta (service layer)' },
  'svc.postMeta.delete:filter:result': { kind: 'filter', acceptedArgs: 1, description: 'Filter result of deleting post meta (service layer)' },

  'rest.posts.get:action:error': { kind: 'action', acceptedArgs: 1, description: 'On posts get failure' },
  'rest.posts.single:action:error': { kind: 'action', acceptedArgs: 1, description: 'On single post get failure' },
  'rest.posts.create:action:error': { kind: 'action', acceptedArgs: 1, description: 'On posts create failure' },
  'rest.posts.update:action:error': { kind: 'action', acceptedArgs: 1, description: 'On posts update failure' },
  'rest.posts.delete:action:error': { kind: 'action', acceptedArgs: 1, description: 'On posts delete failure' },

  //plugins
  'plugin.enabled': { kind: 'action', acceptedArgs: 1, description: 'After plugin is enabled' },
  'plugin.disabled': { kind: 'action', acceptedArgs: 1, description: 'After plugin is disabled' },
  'plugin.mount:rest': { kind: 'action', acceptedArgs: 1, description: 'After plugin REST router is mounted' },

  //server
  'server:starting': { kind: 'action', acceptedArgs: 0, description: 'Before server starts' },
  'server:started': { kind: 'action', acceptedArgs: 1, description: 'After server starts' },
} as const; // Use 'as const' for precise type inference

// Base type for hook specifications (used internally)
export interface HookSpec<Args extends any[] = any[], ReturnValue = any> {
  kind: 'action' | 'filter';
  description?: string;
  acceptedArgs: number;
}

// Derive the registry type from the static HOOKS constant
export type HookRegistry = typeof HOOKS;

// Derive HookName, FilterHookName, ActionHookName from the inferred HookRegistry type
export type HookName = keyof HookRegistry;

export type FilterHookName = {
  [K in keyof HookRegistry]: HookRegistry[K]['kind'] extends 'filter' ? K : never
}[keyof HookRegistry];

export type ActionHookName = {
  [K in keyof HookRegistry]: HookRegistry[K]['kind'] extends 'action' ? K : never
}[keyof HookRegistry];

// Helper types for plugin developers
export type AllHooks = HookName;
export type AllActions = ActionHookName;
export type AllFilters = FilterHookName;

// Runtime registry - initialized as a copy of the static definitions
// Used by the hook engine internals for lookups. Allow string index for dynamic hooks.
const hookRegistry: Record<string, HookSpec> = { ...HOOKS };

/* ─────────────────────────────────────────────────────────── */
/* 2 ▸ Callback bookkeeping                                     */

type Callback = (...args: any[]) => any;

interface CallbackEntry {
  fn: Callback;
  acceptedArgs: number;
}

/* ─────────────────────────────────────────────────────────── */
/* 3 ▸ Public API shape                                         */

export interface HookAPI {
  addFilter(
    hookName: FilterHookName,
    callback: Callback,
    priority?: number,
    acceptedArgs?: number
  ): void;
  removeFilter(
    hookName: FilterHookName,
    callback: Callback,
    priority?: number
  ): boolean;
  hasFilter(hookName?: FilterHookName, callback?: Callback): boolean | number;
  hasFilters(): boolean;
  removeAllCallbacks(priority?: number): void;
  applyFiltersSync<T>(hookName: FilterHookName, value: T, ...args: any[]): T;
  applyFilters<T>(hookName: FilterHookName, value: T, ...args: any[]): Promise<T>;
  addAction(
    hookName: ActionHookName,
    callback: Callback,
    priority?: number,
    acceptedArgs?: number
  ): void;
  removeAction(
    hookName: ActionHookName,
    callback: Callback,
    priority?: number
  ): boolean;
  hasAction(hookName?: ActionHookName, callback?: Callback): boolean | number;
  doAction(hookName: ActionHookName, ...args: any[]): Promise<void>;
  doActionSync(hookName: ActionHookName, ...args: any[]): void;
  doAllHook(args: any[]): void;
  currentPriority(): number | false;
}

/* ─────────────────────────────────────────────────────────── */
/* 4 ▸ Utilities shared by all engines                          */

const fnIds = new WeakMap<Callback, number>();
let globalUid = 0;

function buildUniqueId(hook: string, cb: Callback, prio: number): string {
  if (!fnIds.has(cb)) fnIds.set(cb, ++globalUid);
  return `${hook}:${prio}:${fnIds.get(cb)}`;
}

function ensureKnownHook(hookName: string): asserts hookName is HookName {
  if (!hookRegistry[hookName]) {
    throw new Error(`[HookRegistry] Hook '${hookName}' already defined.`);
  }
}

/* ─────────────────────────────────────────────────────────── */
/* 5 ▸ Engine factory                                           */
/**
 * Creates a new hook engine that implements the WordPress-style hooks API.
 * 
 * This factory function returns an object with methods for registering and 
 * executing hooks (actions and filters). The hook engine manages priorities,
 * maintains callback references, and provides both synchronous and asynchronous
 * execution paths.
 * 
 * All hooks must be registered via defineHook() before they can be used.
 * This ensures type safety and prevents typos in hook names.
 * 
 * @returns {HookAPI} A new hook engine instance with the complete hooks API
 */
export function createHookEngine(): HookAPI {
  /** callbacks[priority][uid] → {fn, acceptedArgs} */
  const callbacks: Record<number, Record<string, CallbackEntry>> = {};
  let priorities: number[] = [];

  const iterations: number[][] = [];
  const currentPriority: number[] = [];
  let nestingLevel = 0;
  let doingAction = false;

  /* internal helpers */
  const updatePriorities = () => {
    priorities = Object.keys(callbacks)
      .map(Number)
      .sort((a, b) => a - b);
  };

  const resortActiveIterations = (
    newPriority?: number,
    priorityExisted = false
  ) => {
    const newPriorities = [...priorities];
    if (newPriorities.length === 0) {
      iterations.forEach((_, i) => (iterations[i] = []));
      return;
    }
    const min = Math.min(...newPriorities);
    iterations.forEach((iteration, idx) => {
      const current = iteration[0] ?? null;
      iterations[idx] = [...newPriorities];
      if (current === null) return;
      if (current < min) {
        iterations[idx].unshift(current);
        return;
      }
      while (iterations[idx][0] < current && iterations[idx].length) {
        iterations[idx].shift();
      }
      if (
        newPriority !== undefined &&
        newPriority === currentPriority[idx] &&
        !priorityExisted
      ) {
        const prev = iterations[idx].shift();
        if (prev !== newPriority) iterations[idx].unshift(prev!);
      }
    });
  };

  /* ───── public API implementation ───── */

  function addFilter(
    hookName: FilterHookName,
    callback: Callback,
    priority = 10,
    acceptedArgs = callback.length
  ): void {
    ensureKnownHook(hookName);

    const uid = buildUniqueId(hookName, callback, priority);
    const priorityExisted = callbacks.hasOwnProperty(priority);

    if (!priorityExisted) callbacks[priority] = {};
    callbacks[priority][uid] = { fn: callback, acceptedArgs };
    updatePriorities();

    if (nestingLevel > 0) resortActiveIterations(priority, priorityExisted);
  }

  function removeFilter(
    hookName: FilterHookName,
    callback: Callback,
    priority = 10
  ): boolean {
    ensureKnownHook(hookName);
    const uid = buildUniqueId(hookName, callback, priority);
    const exists = !!(callbacks[priority] && callbacks[priority][uid]);
    if (!exists) return false;
    delete callbacks[priority][uid];
    if (Object.keys(callbacks[priority]).length === 0) {
      delete callbacks[priority];
      updatePriorities();
      if (nestingLevel > 0) resortActiveIterations();
    }
    return true;
  }

  const hasFilters = (): boolean => priorities.length > 0;

  function hasFilter(hookName: FilterHookName = '' as FilterHookName, callback?: Callback): boolean | number {
    ensureKnownHook(hookName);
    if (!callback) return hasFilters();
    const partial = buildUniqueId(hookName, callback, 0).split(':').slice(-1)[0];
    for (const [prio, group] of Object.entries(callbacks)) {
      if (Object.keys(group).some(key => key.endsWith(partial))) {
        return +prio;
      }
    }
    return false;
  }

  function removeAllCallbacks(priority?: number): void {
    if (priority === undefined) {
      // Iterate and delete each priority key instead of reassigning the const object
      Object.keys(callbacks).forEach(key => {
        delete callbacks[Number(key)];
      });
      priorities = []; // Resetting the 'let' array is fine
    } else if (callbacks.hasOwnProperty(priority)) { // Check callbacks existence
      delete callbacks[priority]; // Modify const object property is fine
      updatePriorities(); // Recalculate priorities array
    }
    if (nestingLevel > 0) resortActiveIterations();
  }

  // sync filter
  function applyFiltersSync<T>(hookName: FilterHookName, value: T, ...args: any[]): T {
    ensureKnownHook(hookName);
    const prios = priorities.filter(prio =>
      Object.keys(callbacks[prio] || {}).some(uid => uid.startsWith(hookName + ':'))
    );
    if (prios.length === 0) return value;

    const level = nestingLevel++;
    iterations[level] = [...prios];
    let result: any = value;
    const numArgsTotal = args.length + 1;

    do {
      currentPriority[level] = iterations[level][0];
      const prio = currentPriority[level];
      for (const [uid, { fn, acceptedArgs }] of Object.entries(callbacks[prio] || {})) {
        if (!uid.startsWith(hookName + ':')) continue;
        if (acceptedArgs === 0) result = fn();
        else if (acceptedArgs >= numArgsTotal) result = fn(result, ...args);
        else result = fn(...[result, ...args].slice(0, acceptedArgs));
      }
    } while (iterations[level].shift() !== undefined && iterations[level].length);

    delete iterations[level];
    delete currentPriority[level];
    nestingLevel--;
    return result;
  }

  // async filter
  async function applyFilters<T>(hookName: FilterHookName, value: T, ...args: any[]): Promise<T> {
    ensureKnownHook(hookName);
    const prios = priorities.filter(prio =>
      Object.keys(callbacks[prio] || {}).some(uid => uid.startsWith(hookName + ':'))
    );
    if (prios.length === 0) return value;
    let result: any = value;
    const numArgsTotal = args.length + 1;
    for (const prio of prios) {
      for (const [uid, { fn, acceptedArgs }] of Object.entries(callbacks[prio] || {})) {
        const uidHookName = uid.split(':').slice(0, -2).join(':');
        if (uidHookName !== hookName) continue;
        if (acceptedArgs === 0) result = await fn();
        else if (acceptedArgs >= numArgsTotal) result = await fn(result, ...args);
        else result = await fn(...[result, ...args].slice(0, acceptedArgs));
      }
    }
    return result;
  }

  function addAction(
    hookName: ActionHookName,
    callback: Callback,
    priority = 10,
    acceptedArgs = callback.length
  ): void {
    ensureKnownHook(hookName);

    const uid = buildUniqueId(hookName, callback, priority);
    const priorityExisted = callbacks.hasOwnProperty(priority);

    if (!priorityExisted) callbacks[priority] = {};
    callbacks[priority][uid] = { fn: callback, acceptedArgs };
    updatePriorities();

    if (nestingLevel > 0) resortActiveIterations(priority, priorityExisted);
  }

  function removeAction(
    hookName: ActionHookName,
    callback: Callback,
    priority = 10
  ): boolean {
    ensureKnownHook(hookName);
    const uid = buildUniqueId(hookName, callback, priority);
    const exists = !!(callbacks[priority] && callbacks[priority][uid]);
    if (!exists) return false;
    delete callbacks[priority][uid];
    if (Object.keys(callbacks[priority]).length === 0) {
      delete callbacks[priority];
      updatePriorities();
      if (nestingLevel > 0) resortActiveIterations();
    }
    return true;
  }

  function hasAction(hookName: ActionHookName = '' as ActionHookName, callback?: Callback): boolean | number {
    ensureKnownHook(hookName);
    if (!callback) return priorities.length > 0;
    const partial = buildUniqueId(hookName, callback, 0).split(':').slice(-1)[0];
    for (const [prio, group] of Object.entries(callbacks)) {
      if (Object.keys(group).some(key => key.endsWith(partial))) {
        return +prio;
      }
    }
    return false;
  }

  // --- Action Specific Helpers ---

  // Internal helper to run action callbacks without modifying a value
  async function runActionCallbacks(hookName: ActionHookName, ...args: any[]): Promise<void> {
    ensureKnownHook(hookName);
    // Find priorities that contain callbacks for the specific action hook
    const prios = priorities.filter(prio =>
      Object.keys(callbacks[prio] || {}).some(uid => uid.startsWith(hookName + ':'))
    );

    if (!prios.length) return;

    const level = nestingLevel++;
    iterations[level] = [...prios];

    try {
      for (const currentPriority of iterations[level]) {
        if (callbacks[currentPriority]) {
          // Filter UIDs for the specific action hook at the current priority
          const hookCallbacks = Object.entries(callbacks[currentPriority])
            .filter(([uid]) => uid.startsWith(hookName + ':'))
            .map(([, cbData]) => cbData);

          for (const { fn, acceptedArgs } of hookCallbacks) {
            await fn(...args.slice(0, acceptedArgs)); // Call with original args
          }
        }
      }
    } finally {
      delete iterations[level];
      nestingLevel--;
    }
  }

  async function doAction(hookName: ActionHookName, ...args: any[]): Promise<void> {
    doingAction = true;
    // Use the dedicated action runner
    await runActionCallbacks(hookName, ...args);
    // Reset doingAction flag only at the top level
    if (nestingLevel === 0) doingAction = false;
  }

  function doActionSync(hookName: ActionHookName, ...args: any[]): void {
    doingAction = true;
    // Ideally, call a synchronous version of runActionCallbacks if implemented
    // For now, logging a warning or throwing if async callbacks are added to sync actions might be needed.
    // This simplified version just runs the async one without await - potential issues if callbacks aren't truly sync!
    runActionCallbacks(hookName, ...args).catch(err => {
      console.error(`Error in sync action hook '${hookName}':`, err); // Basic error handling
    });
    if (nestingLevel === 0) doingAction = false;
  }

  function doAllHook(args: any[]): void {
    const level = nestingLevel++;
    iterations[level] = [...priorities];
    do {
      const prio = iterations[level][0];
      for (const { fn } of Object.values(callbacks[prio])) {
        fn(...args);
      }
    } while (iterations[level].shift() !== undefined && iterations[level].length);
    delete iterations[level];
    nestingLevel--;
  }

  const currentPrio = (): number | false => {
    const top = iterations[0];
    return top && top.length ? top[0] : false;
  };

  /* ───── exposed API object ───── */
  return {
    addFilter,
    removeFilter,
    hasFilter,
    hasFilters,
    removeAllCallbacks,
    applyFilters,
    applyFiltersSync,
    addAction,
    removeAction,
    hasAction,
    doAction,
    doActionSync,
    doAllHook,
    currentPriority: currentPrio
  };
}

/**
 * Register a single hook dynamically (if needed, core hooks are static now).
 * 
 * @param name Hook name
 * @param kind Type of hook: 'action' (side effects) or 'filter' (modifies value)
 * @param acceptedArgs Expected total argument count when *calling* the hook
 * @param description Human-readable description (optional but recommended)
 */
export function defineHook<Args extends any[] = any[], ReturnValue = any>(
  name: string,
  kind: 'action' | 'filter',
  acceptedArgs: number,
  description?: string
): void {
  if (hookRegistry[name]) {
    throw new Error(`[HookRegistry] Hook '${name}' already defined.`);
  }
  hookRegistry[name] = { kind, acceptedArgs, description } as HookSpec<Args, ReturnValue>;
}

/**
 * Convenience helper to register many hooks dynamically (if needed).
 */
export function declareHooks<const H extends Record<string, HookSpec>>(specs: H): void {
  (Object.keys(specs) as (keyof H)[]).forEach(name => {
    // @ts-ignore – we know the key is string
    defineHook(name, specs[name].kind, specs[name].acceptedArgs, specs[name].description);
  });
}
