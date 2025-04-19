# AstroPress Hook System – Quick Reference

## 🚀 Overview
AstroPress ships with a fully‑typed, WordPress‑style hook engine that lets extensions tap into every significant step of the request‑→service‑→DB life‑cycle.  
Hooks are declared **once** in code (or via `defineHook()`), validated at runtime, and surfaced to TypeScript as the `HookName` union so typos cannot compile.

- **Filters** return a (possibly mutated) value – think *pure functions*.
- **Actions** are side‑effects – logging, cache busts, analytics, etc.
- Hooks are hierarchical strings: `layer.subject.verb:kind:phase`  
  e.g. `svc.user.update:filter:input` or `rest.post.save:action:error`.
- Lower `priority` runs first (default `10`).

---
## 🛠 Public API (from `createHookEngine()`)
```ts
hooks.addFilter(name, fn, priority?, acceptedArgs?)
hooks.removeFilter(name, fn, priority?)
hooks.hasFilter(name?, fn?)        // boolean | priority
hooks.hasFilters()                 // any filters registered?
hooks.removeAllCallbacks(priority?)

hooks.applyFilters(name, value, ...extraArgs) // ➜ Promise<Return>
hooks.applyFiltersSync(name, value, ...extraArgs) // synchronous variant

hooks.addAction(name, fn, priority?, acceptedArgs?)
hooks.removeAction(name, fn, priority?)
hooks.hasAction(name?, fn?)
hooks.doAction(name, ...args)      // fire‑and‑forget (async)
hooks.doActionSync(name, ...args)  // **ensure callbacks are sync**

hooks.doAllHook(args)              // dev helper – runs *every* callback
hooks.currentPriority()            // number | false
```

---
## ✅ Minimal Example
```ts
// plugins/user-events/server.ts
serverHooks.addAction(
  'svc.user.create:action:before',
  (_unused, payload) => {
    if (payload?.user_login === 'forbidden') {
      throw new Error('This username is not allowed.');
    }
  },
  10,   // priority
  2     // acceptedArgs
);
```

---
## 📚 Pre‑Registered Core Hooks
The tables below list every hook baked into AstroPress **core**.  Names are 100 % source‑of‑truth—they’re generated straight from the `HOOKS` constant in `createWPHook.ts`.

### Legend
| Segment | Meaning | Examples |
|---------|---------|----------|
| **layer** | Execution tier | `svc` (business logic / DB) • `rest` (HTTP edge) |
| **subject** | Domain entity | `user`, `userMeta`, `jwt`, … |
| **verb** | High‑level op | `create`, `get`, `update`, `delete`, `login`, `can` |
| **kind** | `action` or `filter` | literal in the name |
| **phase** | Lifecycle slice | `before`, `after`, `error`, `input`, `result` |

> **Pattern**: `layer.subject.verb:kind:phase`

---
### 🧍 User Service (`svc.user.*`)
| Hook | Kind | Fires |
|------|------|-------|
| `svc.user.create:action:before` | action | right before inserting the user row |
| `svc.user.create:action:after` | action | immediately after insert + defaults |
| `svc.user.create:filter:result` | filter | post‑TXN – final user object |
| `svc.user.get:action:before` | action | just before `SELECT … WHERE login/email` |
| `svc.user.get:action:after` | action | after fetch |
| `svc.user.get:filter:result` | filter | mutate/validate fetched record |
| `svc.user.update:filter:input` | filter | mutate inbound payload                |
| `svc.user.update:action:before` | action | before `UPDATE wp_users …` |
| `svc.user.update:action:after` | action | after update + meta/roles writes |
| `svc.user.update:filter:result` | filter | final user row |
| `svc.user.delete:action:before` | action | before `DELETE` |
| `svc.user.delete:action:after` | action | after delete |
| `svc.user.delete:filter:result` | filter | final (deleted) record |
| `svc.user.login:action:before` | action | pre‑password‑check |
| `svc.user.login:action:after` | action | after successful login |
| `svc.user.login:filter:result` | filter | final login payload (tokens etc.) |
| `svc.user.login:action:error` | action | on **failed** login attempt |
| `svc.user.can:action:before` | action | before capability check |
| `svc.user.can:action:after` | action | after capability check |
| `svc.user.can:filter:result` | filter | boolean capability result |

### 👥 Users Collection (`svc.users.*`)
| Hook | Kind | Fires |
|------|------|-------|
| `svc.users.get:action:before` | action | before bulk fetch |
| `svc.users.get:action:after` | action | after fetch |
| `svc.users.get:filter:result` | filter | mutate array of users |

### 🗂 User Meta (`svc.userMeta.*`)
| Hook | Kind | Fires |
|------|------|-------|
| `svc.userMeta.create:action:before` | action | before defaults insert |
| `svc.userMeta.create:action:after` | action | after defaults insert |
| `svc.userMeta.get:action:before` | action | before single meta fetch |
| `svc.userMeta.get:action:after` | action | after fetch |
| `svc.userMeta.get:filter:result` | filter | mutate single value |
| `svc.userMeta.getBatch:filter:result` | filter | mutate map of keys→values |
| `svc.userMeta.set:action:before` | action | before write |
| `svc.userMeta.set:filter:input` | filter | mutate value on the way in |
| `svc.userMeta.set:action:after` | action | after write |
| `svc.userMeta.delete:action:before` | action | before delete |
| `svc.userMeta.delete:action:after` | action | after delete |
| `svc.userMeta.delete:filter:result` | filter | final state |
| `svc.userMeta.setRole:action:before` | action | before role change |
| `svc.userMeta.setRole:action:after` | action | after role change |

### 🔑 JWT & Auth (`svc.jwt.*`)
| Hook | Kind | Fires |
|------|------|-------|
| `svc.jwt.sign:action:before` | action | before `jwt.sign` |
| `svc.jwt.sign:action:after` | action | after token created |
| `svc.jwt.verify:action:before` | action | before `jwt.verify` |
| `svc.jwt.verify:action:after` | action | after verification |

### 🌐 REST‑Layer Errors (`rest.*`)
| Hook | Kind | Fires |
|------|------|-------|
| `rest.user.update:action:error` | action | failed REST `PUT /users/:id` |
| `rest.users.get:action:error` | action | failed REST `GET /users` |
| `rest.user.login:action:error` | action | failed REST `POST /login` |

---
## 🔒 Best Practices
- **Filters** should stay pure – return a new value, no external side‑effects.  
- **Actions** may log, mutate, and call out to other services; they do **not** influence return values.
- Namespace everything (`svc.`, `rest.`) to avoid collisions.
- Keep `acceptedArgs` tight – unused params are a smell.

---
## 🤖 Auto‑Generating this List
Because the registry is just a constant, documentation like the tables above can be emitted automatically at build‑time (e.g. `pnpm run generate‑doc`) or sourced from a JSON dump (`core‑hooks.json`).  
**Ping me if you’d like that scaffolded – it’s ~20 LOC with `ts-node`.**

