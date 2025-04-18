
# AstroPress Hook Engine

A lightweight, functional hook system inspired by WordPress, built for modern fullstack apps using Astro + Bun (or any modern JS stack).

---

## ✅ What It Does

The hook engine lets **plugins**, **themes**, or **core features** tap into your app’s lifecycle using standardized filters and actions.

- **Filters** modify a value
- **Actions** just run side-effects

You can register, remove, or override behavior using priority-based callbacks — just like WordPress, but fully typed and functional.

---

## 📦 Installation

The engine is provided internally. To use it, import either:

```ts
import { serverHooks } from 'apps/core/hooks/hookEngine.server'
import { clientHooks } from 'apps/core/hooks/hookEngine.client'
```

---

## 🧱 Folder Structure

```
packages/core/hooks/
├── createHookEngine.ts        ← core hook logic
├── hookEngine.server.ts       ← server-side hook instance
└── hookEngine.client.ts       ← client-side hook instance
```

---

## 🚀 Usage Examples

### 🟦 Backend (Bun / Express)

```ts
// plugin-my-auth.ts
import { serverHooks } from 'apps/core/hooks/hookEngine.server'

serverHooks.addFilter(
  'auth:isAdmin',
  (isAdmin, user) => user.role === 'superuser' || isAdmin,
  20
)

// Later during auth check
const isAdmin = serverHooks.applyFilters(false, currentUser)
```

---

### 🌐 Frontend (Astro / Vue)

```ts
// plugin-my-theme.ts
import { clientHooks } from 'apps/core/hooks/hookEngine.client'

clientHooks.addFilter('theme:primaryColor', () => '#ff4081')

// In your layout.tsx or Vue component
const color = clientHooks.applyFilters('#000000') // → '#ff4081'
```

---

## 🧩 Core Concepts

### 🔁 Filters

Modify a value by chaining logic from multiple plugins/themes.

```ts
hooks.addFilter('search:query', (query) => query.trim())
hooks.addFilter('search:query', (query) => query.toLowerCase(), 20)

const result = hooks.applyFilters('  Hello WORLD  ')
// → 'hello world'
```

---

### ⚡️ Actions

Fire functions without changing any value — useful for logging, tracking, etc.

```ts
hooks.addFilter('user:created', (noop, user) => {
  sendWelcomeEmail(user.email)
}, 10)

hooks.doAction({ id: '123', email: 'me@example.com' })
```

> Note: actions internally use `applyFilters(undefined, ...args)`. Same engine.

---

### ⛔️ Removing a Filter

```ts
const fn = (v: string) => v + '!'
hooks.addFilter('exclaim', fn)
hooks.removeFilter('exclaim', fn)
```

---

## 📚 Best Practices

### Where to Register Hooks

- **Plugins**: in their own `register.ts`
- **Themes**: in `theme.ts` or `layout.ts`
- **Core**: on app bootstrap

> Avoid registering hooks inline in components unless they are runtime‑scoped.

---

### Where to Apply Filters

| Context          | Use Case                       |
|------------------|--------------------------------|
| `applyFilters`   | Modifying config, values, UI   |
| `doAction`       | Triggering side effects        |
| `hasFilter`      | Conditionally injecting logic  |
| `removeAllFilters` | Cleanup in tests or hot reloads |

---

## 🔒 Server vs Client Separation

Always import from the correct engine:

- **Server**: `hookEngine.server.ts`
- **Client**: `hookEngine.client.ts`

This keeps your logic tree-shakable and avoids hydration mismatches.

---

## 🧠 Advanced

### Custom Hook Contexts

If you want to isolate hooks (e.g. per plugin), you can create fresh engines:

```ts
import { createHookEngine } from 'apps/core/hooks/createHookEngine'

export const localHooks = createHookEngine()
```

Each instance is totally self-contained.

---

## 🧪 Testing Hooks

```ts
import { createHookEngine } from 'apps/core/hooks/createHookEngine'

const hooks = createHookEngine()

hooks.addFilter('test:addOne', (n) => n + 1)
const out = hooks.applyFilters(1) // → 2
```

Clear all:

```ts
hooks.removeAllFilters()
```

---

## 🔧 API Reference

| Method               | Description                                      |
|----------------------|--------------------------------------------------|
| `addFilter()`        | Add a filter or action callback                  |
| `removeFilter()`     | Remove specific callback                         |
| `hasFilter()`        | Check if a callback exists                       |
| `hasFilters()`       | Check if any filters exist at all                |
| `applyFilters()`     | Run filter chain and return result               |
| `doAction()`         | Run filter chain with no return value            |
| `removeAllFilters()` | Clears all filters (or just by priority)         |
| `currentPriority()`  | Returns priority of currently running callback   |

---

## 📦 Real‑World Use Cases

- Customize **search algorithms** (`search:query`, `search:results`)
- Override **user roles** (`auth:isAdmin`, `user:canEdit`)
- Inject **tracking/logging** (`route:loaded`, `user:created`)
- Allow plugins to modify **menus**, **UI themes**, or **meta tags**

---

## 🛡️ Safety Notes

- All hooks are **synchronous**. Use wrappers for async flows.
- Don’t assume filters are idempotent — call them exactly once.
- Always namespace your hook names: `pluginName:eventName`

---

## ✅ Summary

This system gives you **WordPress-level extensibility**, minus the legacy.  
No classes. No context hell. Just clean control over behavior injection.