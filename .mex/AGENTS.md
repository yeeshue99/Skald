---
name: agents
description: Always-loaded project anchor. Read this first. Contains project identity, non-negotiables, commands, and pointer to ROUTER.md for full context.
last_updated: 2026-06-16
---

# Skald

## What This Is

A private, self-hostable, themeable Twitter-style feed for a tabletop RPG group: one Vercel + Neon deployment hosts many campaigns, where players post as their characters and the DM posts as NPCs, follows, schedules reveals, and reskins the app per campaign.

## Non-Negotiables

- Re-check persona ownership server-side on every write. Posts, likes, follows, votes, and edits resolve the acting persona from the membership (`loadActionContext` -> `ownsPersona`), never from a client-supplied `personaId` or the cookie. Trusting the client lets one user act as another's character.
- Scope every query by `campaignId`. Tenants share one database; a read or write that crosses campaigns leaks or corrupts another table's data. Edges (follows, likes, votes) use composite FKs to `(id, campaignId)` to enforce this at the schema level.
- Never persist a raw secret. Session tokens and API keys are stored as SHA-256 hashes only (shown once, then gone); passwords are bcrypt-hashed. A DB leak must not expose usable credentials.
- DB access goes through the layers: reads via `src/lib/queries.ts`, writes via server actions in `src/app/actions/`. Components never query the database directly.
- Commit, never push (the working tree is shared with parallel agents, so stage only the files you changed). Finishing a task means updating `CHANGELOG.md` and `BACKLOG.md`, not just the code.

## Commands

- Dev: `pnpm dev` (Next.js on :3000)
- Test: `pnpm test` (unit), `pnpm test:integration` (needs a Postgres `TEST_DATABASE_URL`)
- Typecheck / Lint / Build: `pnpm typecheck` / `pnpm lint` / `pnpm build`
- DB: `pnpm db:push` (sync schema to DB), `pnpm db:generate` / `pnpm db:migrate`, `pnpm db:studio`
- Seed: `pnpm seed` (STR/X demo), `pnpm seed:petalfall`

## Scaffold Growth

After meaningful work, run GROW:

- Ground: what changed in reality?
- Record: update `ROUTER.md` and relevant `context/` files
- Orient: create or update a `patterns/` runbook if this can recur
- Write: bump `last_updated` on changed scaffold files and run `mex log` when rationale matters

The scaffold grows from real work, not just setup. See the GROW step in `ROUTER.md` for details.

## Navigation

At the start of every session, read `ROUTER.md` before doing anything else.
For full project context, patterns, and task guidance, everything is there.
