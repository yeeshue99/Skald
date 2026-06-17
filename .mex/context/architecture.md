---
name: architecture
description: How the major pieces of this project connect and flow. Load when working on system design, integrations, or understanding how components interact.
triggers:
  - "architecture"
  - "system design"
  - "how does X connect to Y"
  - "integration"
  - "flow"
edges:
  - target: context/stack.md
    condition: when specific technology details are needed
  - target: context/decisions.md
    condition: when understanding why the architecture is structured this way
last_updated: 2026-06-16
---

# Architecture

## System Overview

Next.js 16 App Router. Server components fetch, client components interact, server actions mutate.

A write (composing a post) flows like this:

```text
Composer.tsx ("use client")
  -> createPostAction (src/app/actions/posts.ts, "use server"), receives FormData
  -> loadActionContext(slug) (src/lib/campaign.ts) resolves user + campaign + membership + acting persona
  -> ownsPersona(ctx, personaId) re-checks the client can act as that persona
  -> Zod schema (src/lib/validation.ts) validates content / schedule / reply target
  -> Drizzle insert into posts (+ polls), scoped to campaignId
  -> notify() / notifyMentions() (src/lib/notify.ts) for published posts only
  -> revalidatePath('/c/<slug>') and return FormState ({ ok } | { error })
```

A read (rendering a feed) flows: a server page under `src/app/c/[slug]/` calls `getCampaignContext(slug)`, then a query in `src/lib/queries.ts` selects `RawPost` rows and runs `hydrate()` to enrich them into `PostView` objects (author, counts, viewer state, poll, nested quote) via parallel sub-queries, then passes `PostView[]` props to client components like `FeedList`. Components never touch the database.

## Key Components

- **Server actions** (`src/app/actions/*.ts`, e.g. `posts.ts`, `auth.ts`, `follow.ts`, `campaigns.ts`): every mutation. All start with `loadActionContext`, validate with Zod, return `FormState` from `src/lib/form.ts`, then `revalidatePath`. Wired to forms via React 19 `useActionState`.
- **`src/lib/campaign.ts`**: the tenancy and identity gate. `getCampaignContext` / `loadActionContext` resolve the membership and the server-side acting persona (memoized per request via React `cache()`); `ownsPersona` is the ownership check every write calls.
- **`src/lib/queries.ts`**: the read layer (large). Holds all feed/profile/search queries, the `RawPost` to `PostView` `hydrate()` pattern, keyset cursor pagination, and the shared visibility predicate (`deletedAt IS NULL AND publishedAt <= now()`).
- **`src/lib/auth.ts`**: session cookie (`skald_session`), stores only the SHA-256 `tokenHash`; `getCurrentUser()` is the lookup.
- **`src/db/schema.ts` + `src/db/index.ts`**: Drizzle schema (14 tables) and the client that auto-switches between the Neon serverless driver and node-postgres.
- **`src/lib/themes.ts`**: per-campaign theme stored as JSON on the campaign row, applied at runtime via data attributes and CSS variables.

## External Dependencies

- **Neon Postgres**: the only datastore. All persistence (sessions, posts, notifications, everything) lives here. Reached through Drizzle; the client picks the Neon serverless driver for Neon URLs and node-postgres otherwise.
- **Vercel Blob**: image storage for avatars, banners, and post images, via `/api/upload` and `@vercel/blob`. Optional: without `BLOB_READ_WRITE_TOKEN` the route 501s and the UI falls back to pasted image URLs.
- **Upstash Redis** (optional): backs the write-path rate limiter across serverless instances. Falls back to an in-memory fixed window when unset or unreachable.
- **Vercel**: host. Push to GitHub `main` auto-deploys to production.

## What Does NOT Exist Here

- No background worker, cron, or job queue. Scheduling is purely time-based: a post is visible once `publishedAt` has passed.
- No read-side REST/GraphQL API. The only HTTP endpoints are `POST /api/c/<slug>/posts` (write-only campaign API) and `/api/upload`. Everything else is server components plus server actions.
- No client state library (Redux/Zustand) and no WebSockets/real-time. Feed freshness comes from `revalidatePath` and a polling "new posts" pill.
- No email or external notifications; notifications are in-app rows only.
- No permission system beyond the two membership roles, `dm` and `player`.
