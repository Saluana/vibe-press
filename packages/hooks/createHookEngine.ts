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

// Shape stored for each hook.
interface HookSpec<Args extends any[] = any[]> {
  /** Human‑readable description (optional but recommended) */
  description?: string;
  /** Expected total argument count when *calling* the hook. */
  acceptedArgs: number;
}

// The central immutable registry (filled only through declareHooks / defineHook).
export const hookRegistry: Record<string, HookSpec> = {};

/**
 * Register a single hook.
 * Call this during application bootstrap – *never* from within a request.
 */
export function defineHook<Args extends any[] = any[]>(
  name: string,
  acceptedArgs: number,
  description?: string
): void {
  if (hookRegistry[name]) {
    throw new Error(`[HookRegistry] Hook '${name}' already defined.`);
  }
  hookRegistry[name] = { acceptedArgs, description } as HookSpec<Args>;
}

/**
 * Convenience helper to register many hooks at once with literal inference.
 */
export function declareHooks<const H extends Record<string, HookSpec>>(specs: H): void {
  (Object.keys(specs) as (keyof H)[]).forEach(name => {
    // @ts-ignore – we know the key is string
    defineHook(name, specs[name].acceptedArgs, specs[name].description);
  });
}

// After at least one hook is declared, TypeScript derives the union.
export type HookName = keyof typeof hookRegistry;

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
    hookName: HookName,
    callback: Callback,
    priority?: number,
    acceptedArgs?: number
  ): void;
  removeFilter(
    hookName: HookName,
    callback: Callback,
    priority?: number
  ): boolean;
  hasFilter(hookName?: HookName, callback?: Callback): boolean | number;
  hasFilters(): boolean;
  removeAllFilters(priority?: number): void;
  applyFiltersSync<T>(hookName: HookName, value: T, ...args: any[]): T;
  applyFilters<T>(hookName: HookName, value: T, ...args: any[]): Promise<T>;
  doActionSync(hookName: HookName, ...args: any[]): void;
  doAction(hookName: HookName, ...args: any[]): Promise<void>;
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
    throw new Error(`[Hooks] Unknown hook '${hookName}'. Did you call defineHook()?`);
  }
}

/* ─────────────────────────────────────────────────────────── */
/* 5 ▸ Engine factory                                           */

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
    hookName: HookName,
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
    hookName: HookName,
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

  function hasFilter(hookName: HookName = '' as HookName, callback?: Callback): boolean | number {
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

  function removeAllFilters(priority?: number): void {
    if (priority === undefined) {
      Object.keys(callbacks).forEach(k => delete callbacks[+k]);
      priorities = [];
    } else if (callbacks[priority]) {
      delete callbacks[priority];
      updatePriorities();
    }
    if (nestingLevel > 0) resortActiveIterations();
  }

  // sync filter
  function applyFiltersSync<T>(hookName: HookName, value: T, ...args: any[]): T {
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
  async function applyFilters<T>(hookName: HookName, value: T, ...args: any[]): Promise<T> {
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

  function doActionSync(hookName: HookName, ...args: any[]): void {
    doingAction = true;
    applyFiltersSync<void>(hookName, undefined as any, ...args);
    if (nestingLevel === 0) doingAction = false;
  }

  const doAction = async (hookName: HookName, ...args: any[]): Promise<void> => {
    await applyFilters<void>(hookName, undefined as any, ...args);
  };

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
    removeAllFilters,
    applyFilters,
    applyFiltersSync,
    doAction,
    doActionSync,
    doAllHook,
    currentPriority: currentPrio
  };
}

// Register hooks (declarative)
declareHooks({
  // 🧍 User Registration/Login
  'user.create': { acceptedArgs: 1, description: 'Before user is created in DB' },
  'user.create:before': { acceptedArgs: 1, description: 'Before user is created in DB' },
  'user.create:after': { acceptedArgs: 1, description: 'After user is created and token is issued' },
  'user.create:error': { acceptedArgs: 1, description: 'On user creation failure' },
  'user.login:before': { acceptedArgs: 1, description: 'Before login attempt' },
  'user.login:after': { acceptedArgs: 2, description: 'After successful login' },
  'user.login:error': { acceptedArgs: 1, description: 'On login failure' },
  'jwt.sign:before': { acceptedArgs: 1, description: 'Before signing JWT' },
  'jwt.sign:after': { acceptedArgs: 2, description: 'After JWT is signed' },
  'jwt.verify:before': { acceptedArgs: 1, description: 'Before verifying JWT' },
  'jwt.verify:after': { acceptedArgs: 2, description: 'After JWT is verified' },

  // 🧍 User Meta
  'user.get': { acceptedArgs: 1, description: 'Before user data is returned' },
  'user.get:before': { acceptedArgs: 1, description: 'Before user data is returned' },
  'user.get:after': { acceptedArgs: 1, description: 'After user data is returned' },
  'user.update:before': { acceptedArgs: 1, description: 'Before updating user data' },
  'user.update:after': { acceptedArgs: 1, description: 'After user data is updated' },
  'user.delete:before': { acceptedArgs: 1, description: 'Before deleting user data' },
  'user.delete:after': { acceptedArgs: 1, description: 'After user data is deleted' },
  'user.can:before': { acceptedArgs: 1, description: 'Before checking user capabilities' },
  'user.can:after': { acceptedArgs: 1, description: 'After checking user capabilities' },
  'user.can': { acceptedArgs: 1, description: 'On user capability check failure' },
  'userMeta.create:before': { acceptedArgs: 1, description: 'Before user meta is created' },
  'userMeta.create:after': { acceptedArgs: 1, description: 'After user meta is created' },
  'userMeta.get': { acceptedArgs: 1, description: 'Before user meta is fetched' },
  'userMeta.get:before': { acceptedArgs: 1, description: 'Before user meta is fetched' },
  'userMeta.get:after': { acceptedArgs: 1, description: 'After user meta is fetched' },
  'userMeta.set:before': { acceptedArgs: 1, description: 'Before user meta is set' },
  'userMeta.set:after': { acceptedArgs: 1, description: 'After user meta is set' },
  'userMeta.delete:before': { acceptedArgs: 1, description: 'Before user meta is deleted' },
  'userMeta.delete:after': { acceptedArgs: 1, description: 'After user meta is deleted' },
  'userMeta.setRole:before': { acceptedArgs: 1, description: 'Before user role is set' },
  'userMeta.setRole:after': { acceptedArgs: 1, description: 'After user role is set' },
});
