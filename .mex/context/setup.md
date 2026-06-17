---
name: setup
description: Dev environment setup and commands. Load when setting up the project for the first time or when environment issues arise.
triggers:
  - "setup"
  - "install"
  - "environment"
  - "getting started"
  - "how do I run"
  - "local development"
edges:
  - target: context/stack.md
    condition: when specific technology versions or library details are needed
  - target: context/architecture.md
    condition: when understanding how components connect during setup
last_updated: 2026-06-16
---

# Setup

## Prerequisites

- Node 20+
- pnpm 10 (`npm install -g pnpm`; the version is pinned in `package.json`)
- A Postgres database. A free Neon project works for both dev and prod, so there's no local Postgres to install.

## First-time Setup

1. `pnpm install`
2. `cp .env.example .env.local` and set `DATABASE_URL` to your Neon connection string.
3. `pnpm db:push` (sync the schema to the database).
4. `pnpm seed` (optional: STR/X demo at `/c/strix`; prints logins `dm` / `tasha` / `kael`, password `password123`, plus an invite code).
5. `pnpm dev` and open <http://localhost:3000>.

## Environment Variables

- `DATABASE_URL` (required): Postgres/Neon connection string.
- `BLOB_READ_WRITE_TOKEN` (optional): Vercel Blob token for image uploads; without it the composer falls back to pasted image URLs and `/api/upload` returns 501.
- `TEST_DATABASE_URL` (required for `pnpm test:integration`): a Postgres URL the integration suite truncates and seeds. Do not point it at real data.
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (optional): cross-instance rate limiting; falls back to in-memory when unset.
- `IMAGE_GEN_API_KEY` (optional, plus `IMAGE_GEN_PROVIDER` / `IMAGE_GEN_MODEL`): let the seeder generate real avatars/images instead of placeholders.
- `CRON_SECRET` (required for the blob-sweep cron): Bearer token Vercel Cron sends to `GET /api/cron/blob-sweep`. The route 503s until it's set, so the daily orphaned-image cleanup is a no-op without it.

## Common Commands

- `pnpm dev`: Next.js dev server on :3000.
- `pnpm test` / `pnpm test:watch`: unit suite (no DB).
- `pnpm test:integration`: integration suite against `TEST_DATABASE_URL`.
- `pnpm typecheck`: `tsc --noEmit`. `pnpm lint`: ESLint. `pnpm build`: production build.
- `pnpm db:push`: sync schema. `pnpm db:studio`: browse data. `pnpm db:generate` / `pnpm db:migrate`: generate / apply migrations.
- `pnpm seed` / `pnpm seed:petalfall`: load a demo campaign. `pnpm blob:sweep`: delete orphaned blobs.

## Common Issues

- **`pnpm db:migrate` wants to re-run everything:** a DB built with `db:push` has an empty drizzle journal. Run `pnpm db:mark-migrations --dry-run` then `pnpm db:mark-migrations` to backfill the journal.
- **Renaming/moving the project folder breaks pnpm symlinks:** re-link with `CI=true pnpm install`.
- **`vercel env pull` / `blob create-store -e` overwrite `.env.local` wholesale:** back it up first, then merge.
- **Stale dev bundle after `git stash` / branch switch with the server running:** stop it, `rm -rf .next`, restart (Turbopack serves the old bundle otherwise).
