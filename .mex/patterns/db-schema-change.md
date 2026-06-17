---
name: db-schema-change
description: Add or change a Drizzle table/column, with the migration-chain drift gotcha. Use for any schema edit.
triggers:
  - "add a table"
  - "add a column"
  - "schema change"
  - "migration"
  - "drizzle"
edges:
  - target: context/architecture.md
    condition: for the dual-driver db client and tenancy model
  - target: context/decisions.md
    condition: for why scheduling/tenancy shape the schema
last_updated: 2026-06-16
---

# Change the database schema

## Context

The schema is code in `src/db/schema.ts` (14 tables, snake_case columns mapped to camelCase TS). The DB client (`src/db/index.ts`) auto-switches Neon serverless vs node-postgres. Dev syncs with `pnpm db:push`. There is known drift in the migration chain (see below), so read this before running `db:generate`.

## Steps

1. Edit `src/db/schema.ts`. New tables: include a `campaignId` FK. For per-campaign edges (a row referencing personas/posts), use a composite FK to `(id, campaignId)` so cross-campaign edges are impossible.
2. Export the inferred types if other code needs them (`typeof <table>.$inferSelect` / `$inferInsert`).
3. Sync to your dev DB: `pnpm db:push`.
4. Update `src/lib/queries.ts` (reads) and the relevant action(s) (writes); both must filter by `campaignId`.
5. If feed-shaped, extend `RawPost -> PostView` hydration rather than selecting raw rows into components.
6. Update `src/db/seed.ts` / `seed-petalfall.ts` and any factory in `src/test/` if the new column is required.

## Gotchas

- Migration-chain drift: the `0003` snapshot predates the `campaign_api_keys` table and the `personas_owner_idx` rename, so `pnpm db:generate` keeps wanting to re-emit them. Do not blindly commit a generated migration that folds that drift in. `0004` (the search vector) was hand-authored to avoid it. A clean reconciling migration is still owed (`BACKLOG.md`).
- The integration harness pushes `schema.ts` directly (not migrations), so a schema edit is picked up by `pnpm test:integration` without a migration file.
- A dev DB built via `db:push` has an empty drizzle journal; `pnpm db:migrate` would re-run everything. Backfill with `pnpm db:mark-migrations` first.
- Generated columns (e.g. `posts.search_vector` tsvector) are STORED; remember they ride along in `select()` unless you pick explicit columns.

## Verify

- [ ] New rows carry `campaignId`; edges use composite FKs.
- [ ] `pnpm db:push` applies cleanly; `pnpm typecheck` passes.
- [ ] `pnpm test:integration` passes against `TEST_DATABASE_URL`.
- [ ] Seeds/factories updated for any non-null column.

## Debug

- `db:generate` proposes unexpected drops/renames: that's the known drift, not your change. Inspect the diff; don't fold unrelated table/index changes into your migration.
- Integration tests fail on a missing column: the harness pushes `schema.ts`; confirm the edit saved and re-run.

## Update Scaffold

- [ ] Update `.mex/ROUTER.md` "Current Project State" / "Known issues" if the drift status changed.
- [ ] Note new tables in `.mex/context/architecture.md` if they're load-bearing.
- [ ] Update `.mex/patterns/INDEX.md` if a new task type emerged.
