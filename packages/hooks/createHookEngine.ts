// packages/core/hooks/createWPHook.ts

/**
 * AstroPress – Functional port of WordPress WP_Hook (TypeScript).
 * Zero fluff, full honesty. Entire file provided.
 */

type Callback = (...args: any[]) => any;

interface CallbackEntry {
  fn: Callback;
  acceptedArgs: number;
}

export interface HookAPI {
  addFilter(
    hookName: string,
    callback: Callback,
    priority?: number,
    acceptedArgs?: number
  ): void;
  removeFilter(
    hookName: string,
    callback: Callback,
    priority?: number
  ): boolean;
  hasFilter(hookName?: string, callback?: Callback): boolean | number;
  hasFilters(): boolean;
  removeAllFilters(priority?: number): void;
  applyFiltersSync<T>(hookName: string, value: T, ...args: any[]): T;
  applyFilters<T>(hookName: string, value: T, ...args: any[]): Promise<T>;
  doActionSync(hookName: string, ...args: any[]): void;
  doAction(hookName: string, ...args: any[]): Promise<void>;
  doAllHook(args: any[]): void;
  currentPriority(): number | false;
}

/* ─────────────────────────────────────────────────────────── */
/* Shared utilities (module‑level) */

const fnIds = new WeakMap<Callback, number>();
let globalUid = 0;

function buildUniqueId(
  hookName: string,
  callback: Callback,
  priority: number
): string {
  /* WeakMap ensures 1‑to‑1 id per function */
  if (!fnIds.has(callback)) {
    fnIds.set(callback, ++globalUid);
  }
  return `${hookName}:${priority}:${fnIds.get(callback)}`;
}

/* ─────────────────────────────────────────────────────────── */
/* Factory (creates one hook instance and returns API.)        */

export function createHookEngine(): HookAPI {
  const callbacks: Record<number, Record<string, CallbackEntry>> = {};
  let priorities: number[] = [];

  const iterations: number[][] = [];
  const currentPriority: number[] = [];
  let nestingLevel = 0;
  let doingAction = false;

  /* ───── internal helpers ───── */

  function updatePriorities(): void {
    priorities = Object.keys(callbacks)
      .map(Number)
      .sort((a, b) => a - b);
  }

  function resortActiveIterations(
    newPriority?: number,
    priorityExisted = false
  ): void {
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
  }

  /* ───── public API implementation ───── */

  function addFilter(
    hookName: string,
    callback: Callback,
    priority = 10,
    acceptedArgs = callback.length
  ): void {
    const uid = buildUniqueId(hookName, callback, priority);
    const priorityExisted = callbacks.hasOwnProperty(priority);

    if (!priorityExisted) callbacks[priority] = {};
    callbacks[priority][uid] = { fn: callback, acceptedArgs };
    updatePriorities();

    if (nestingLevel > 0) {
      resortActiveIterations(priority, priorityExisted);
    }
  }

  function removeFilter(
    hookName: string,
    callback: Callback,
    priority = 10
  ): boolean {
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

  function hasFilter(hookName = '', callback?: Callback): boolean | number {
    if (!callback) return hasFilters();

    const partial = buildUniqueId(hookName, callback, 0).split(':').slice(-1)[0];
    for (const [prio, group] of Object.entries(callbacks)) {
      if (Object.keys(group).some(key => key.endsWith(partial))) {
        return +prio;
      }
    }
    return false;
  }

  function hasFilters(): boolean {
    return priorities.length > 0;
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

  // Only apply filters for a specific hook
  function applyFiltersSync<T>(hookName: string, value: T, ...args: any[]): T {
    // no callbacks for this hook?
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

      // only callbacks for this hook
      for (const [uid, {fn, acceptedArgs}] of Object.entries(callbacks[prio] || {})) {
        if (!uid.startsWith(hookName + ':')) continue;
        console.log('DEBUG: Calling filter', fn.name || '<anon>', 'with args:', [result, ...args].slice(0, acceptedArgs));
        if (!doingAction) args[0] = result;

        if (acceptedArgs === 0) {
          result = fn();
        } else if (acceptedArgs >= numArgsTotal) {
          result = fn(result, ...args);
        } else {
          result = fn(...[result, ...args].slice(0, acceptedArgs));
        }
      }
    } while (
      iterations[level].shift() !== undefined &&
      iterations[level].length
    );

    delete iterations[level];
    delete currentPriority[level];
    nestingLevel--;

    return result;
  }

  // Fire action hooks: only payload to applyFiltersSync, keyed by hookName
  function doActionSync(hookName: string, ...args: any[]): void {
    doingAction = true;
    // run all filters for this hook, no return value needed
    applyFiltersSync<void>(hookName, undefined as any, ...args);
    if (nestingLevel === 0) doingAction = false;
  }

  // Async versions: default async applyFilters/doAction
  async function applyFilters<T>(hookName: string, value: T, ...args: any[]): Promise<T> {
    const prios = priorities.filter(prio =>
      Object.keys(callbacks[prio] || {}).some(uid => uid.startsWith(hookName + ':'))
    );
    if (prios.length === 0) return value;
    let result: any = value;
    const numArgsTotal = args.length + 1;
    for (const prio of prios) {
      for (const [uid, {fn, acceptedArgs}] of Object.entries(callbacks[prio] || {})) {
        if (!uid.startsWith(hookName + ':')) continue;
        if (acceptedArgs === 0) {
          result = await fn();
        } else if (acceptedArgs >= numArgsTotal) {
          result = await fn(result, ...args);
        } else {
          result = await fn(...[result, ...args].slice(0, acceptedArgs));
        }
      }
    }
    return result;
  }

  async function doAction(hookName: string, ...args: any[]): Promise<void> {
    await applyFilters<void>(hookName, undefined as any, ...args);
  }

  function doAllHook(args: any[]): void {
    const level = nestingLevel++;
    iterations[level] = [...priorities];

    do {
      const prio = iterations[level][0];
      for (const { fn } of Object.values(callbacks[prio])) {
        fn(...args);
      }
    } while (
      iterations[level].shift() !== undefined &&
      iterations[level].length
    );

    delete iterations[level];
    nestingLevel--;
  }

  function currentPrio(): number | false {
    const top = iterations[0];
    return top && top.length ? top[0] : false;
  }

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
