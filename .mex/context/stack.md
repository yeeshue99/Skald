---
name: stack
description: Technology stack, library choices, and the reasoning behind them. Load when working with specific technologies or making decisions about libraries and tools.
triggers:
  - "library"
  - "package"
  - "dependency"
  - "which tool"
  - "technology"
edges:
  - target: context/decisions.md
    condition: when the reasoning behind a tech choice is needed
  - target: context/conventions.md
    condition: when understanding how to use a technology in this codebase
last_updated: 2026-06-16
---

# Stack

## Core Technologies

- **Next.js 16** (App Router, server actions, Turbopack) with **React 19** and **TypeScript 5**: the whole app, frontend and backend.
- **Node 20+** runtime; **pnpm 10** is the package manager (the version is pinned in `package.json`).
- **Postgres** (Neon in dev and prod): the only datastore.
- **Tailwind CSS v4** (via `@tailwindcss/postcss`): styling, on top of runtime theme CSS variables.

## Key Libraries

- **Drizzle ORM** (`drizzle-orm`, `drizzle-kit`): all database access; schema is code in `src/db/schema.ts`. No other ORM or query builder.
- **`@neondatabase/serverless`** plus **`pg`**: dual drivers. `src/db/index.ts` uses the Neon serverless driver for Neon URLs (WebSocket in dev via `ws`, fetch in prod) and node-postgres otherwise, so the same code runs on local/self-hosted Postgres.
- **Zod v4**: all input validation, schemas centralized in `src/lib/validation.ts`.
- **bcryptjs**: password hashing (salt rounds 12). Node `crypto` (SHA-256) hashes session tokens and API keys.
- **`@vercel/blob`**: image uploads.
- **lucide-react**: icons. **clsx**: conditional class names.
- **Vitest v4**: unit and integration tests. **tsx**: runs the seed and maintenance scripts.

## What We Deliberately Do NOT Use

- No client state library (Redux, Zustand, Jotai). Server state comes from server components; the only client state is React `useActionState` form state.
- No data-fetching client (React Query, SWR, tRPC). Reads are server components calling `src/lib/queries.ts`; mutations are server actions.
- No auth library (NextAuth/Auth.js, Clerk). Auth is a hand-rolled cookie session in `src/lib/auth.ts`.
- No CSS-in-JS or component library. Tailwind v4 plus runtime CSS-variable theming only.

## Version Constraints

- React 19 plus Next 16: server actions and `useActionState` are the mutation path. Note React 19's `<form action>` auto-reset can revert controlled inputs; guard with an `onReset` `preventDefault` where it bites.
- Zod is v4 (`zod@^4`), not v3. Drizzle is on the `0.45.x` line.
