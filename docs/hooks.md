Here's the updated documentation with a new section titled **"📚 Pre‑Registered Core Hooks"** that lists built-in hooks like `user.register:before`:

---

# 📌 AstroPress Hook System – Quick Reference

AstroPress includes a modern, type-safe hook system inspired by WordPress’s `WP_Hook`. It allows plugins and core logic to register and run callbacks at specific moments in the lifecycle of your app.

---

## 🧠 Concepts

- **Filters** modify data and return a value.
- **Actions** are fire-and-forget events (like logging, side-effects).
- All hooks are **namespaced strings** (e.g. `user.register:before`, `post.save:after`).
- Hook order is determined by **priority** (default: `10`). Lower runs first.
- Callbacks can specify how many arguments they accept (`acceptedArgs`).

---

## 🔧 API Methods

```ts
const hooks = createHookEngine();
```

| Method | Description |
|--------|-------------|
| `addFilter(hook, fn, priority?, acceptedArgs?)` | Attach a callback to a hook |
| `removeFilter(hook, fn, priority?)` | Remove a previously added callback |
| `hasFilter(hook?, fn?)` | Check if a filter exists (for a hook or specific fn) |
| `hasFilters()` | Check if *any* filters exist |
| `removeAllFilters(priority?)` | Remove all filters, or all at a given priority |
| `applyFilters(hook, value, ...args)` | Apply all filters for a hook and return result |
| `doAction(hook, ...args)` | Run all callbacks for an action (no return value) |
| `doAllHook(args)` | Run *all* hooks with same args (dev/debug only) |
| `currentPriority()` | Returns currently running priority (or `false`) |

---

## ✅ Example: Registering Hooks

```ts
serverHooks.addFilter('user.register:before', (_unused, payload) => {
  if (payload.username === 'forbidden') {
    throw new Error('This username is not allowed.');
  }
}, 10, 2);

serverHooks.doAction('user.register:before', { username: 'john' });
```

---

## 📚 Pre‑Registered Core Hooks

These are the hook points already wired into AstroPress core. Plugins and themes can safely use these:

### 🧍 User Registration/Login
| Hook | When it fires |
|------|----------------|
| `user.register:before` | Before user is created in DB |
| `user.register:after` | After user is created and token is issued |
| `user.register:error` | On registration failure |
| `user.login:before` | Before login attempt |
| `user.login:after` | After successful login |
| `user.login:error` | On login failure |
| `user.get:before` | Before fetching user data (e.g. in `/users`) |
| `user.get:after` | After user data is returned |
| `jwt.sign:before` | Before signing JWT |
| `jwt.sign:after` | After JWT is signed |
| `jwt.verify:before` | Before verifying JWT |
| `jwt.verify:after` | After JWT is verified |

*You can attach filters or actions to any of these to intercept, validate, or observe user activity.*

---

## 🔍 Internals

- Uses a `WeakMap` for unique function identity
- Supports nested hooks and real-time reordering during execution
- Shared between backend and frontend via `registerServer()` / `registerClient()`

---

## 🔒 Best Practices

- Use namespaced hooks: `user.login:after`, `post.save:before`
- Keep filters pure — no side-effects
- Keep actions impure — side-effects like logging, analytics, etc.
- Avoid mutating arguments unless intentional

---

## 📁 Folder Integration

Located in:
```
packages/core/hooks/createWPHook.ts
packages/core/hooks/hookEngine.server.ts (instance)
packages/plugins/*/server.ts (usage)
```

---

Let me know if you want the list of pre-registered hooks auto-generated or pulled dynamically from a `core-hooks.json` or metadata file.