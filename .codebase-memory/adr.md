# Skald — Architecture Decision Record

Skald is a private, self-hostable, themeable Twitter-style feed for a tabletop RPG group. One Vercel + Neon deployment is multi-tenant: it hosts many campaigns, each isolated with its own members, personas, theme, and invite code. Stack: Next.js 16 (App Router, server actions, Turbopack) + React 19 + TypeScript, Drizzle ORM on Postgres (Neon), Tailwind v4, hand-rolled cookie-session auth. ~149 TS files, 1911 graph nodes.

## Layering and dependency direction

Four internal areas, verified from the call graph:

- **`src/lib` (core).** High fan-in (about 196 in, 3 out). Holds queries, auth, campaign/tenancy context, validation, notify, themes, ids, rate limiting. Everything depends on it; it depends on almost nothing.
- **`src/app` (internal).** Routes + server actions. Fan-out ~149, almost all into `lib`. Boundary `app -> lib` is the heaviest in the codebase (~148 calls).
- **`src/components` (internal).** Client UI. Fan-out ~55, into `lib` (~42) and `app` actions (~13). Nothing depends on components except pages.
- **`src/db`.** Drizzle schema (14 tables) + the dual driver client. Small, leaf-ish.

Rule the graph confirms: data flows app/components -> lib -> db. Components never call db directly.

## Load-bearing symbols (hotspots)

- `loadActionContext` (lib/campaign.ts), fan-in 36 — the entry gate of nearly every server action. Resolves user + campaign + membership + acting persona.
- `requireCampaignContext` (lib/campaign.ts), fan-in 16 — the page-level equivalent.
- `visibleCondition` (lib/queries.ts), fan-in 13 — the shared post-visibility predicate (`deletedAt IS NULL AND publishedAt <= now()`).
- `hydrate` (lib/queries.ts), fan-in 9 — RawPost -> PostView enrichment (author, counts, viewer state, poll, nested quote).
- `notify` (lib/notify.ts) 7, `normalizeTheme` (lib/themes.ts) 6, `hashToken` (lib/ids.ts) 5, `isUniqueViolation` (lib/form.ts) 10, `cn` (lib/cn.ts) 27.

Touching `loadActionContext`, `visibleCondition`, or `hydrate` has wide blast radius; treat them as stable contracts.

## Key decisions

1. **Personas, not users, are the tweetable accounts.** One login acts as several in-world personas; the DM owns NPC personas. The acting persona is server-side state on the membership, never a cookie or client field. Every write re-checks `ownsPersona`. Identity logic concentrates in `lib/campaign.ts`.
2. **Multi-tenant by `campaignId`.** Every row carries it; campaigns live at `/c/<slug>`. Edges (follows, likes, votes) use composite FKs to `(id, campaignId)` so cross-campaign edges are impossible at the schema level. Every query must filter by `campaignId`.
3. **Scheduling is time-based, no worker.** Visibility is `publishedAt <= now()`; a scheduled post appears on its own. No queue or daemon drives features. The only cron is housekeeping: `GET /api/cron/blob-sweep` daily at 04:00 UTC, guarded by `CRON_SECRET` (503 until set), deleting orphaned blob images.
4. **Hand-rolled cookie auth.** Cookie `skald_session` (lib/auth.ts). The DB stores only the SHA-256 hash of the token; passwords are bcrypt (rounds 12); API keys are hash-only. Registration is invite-code only. No auth provider.
5. **Drizzle with a dual driver.** `db/index.ts` auto-selects the Neon serverless driver for Neon URLs (WebSocket dev, fetch prod) and node-postgres otherwise, so the same code runs on local/self-hosted Postgres.
6. **Server actions + queries/hydrate, no client data layer.** Mutations are `"use server"` actions returning `FormState` (`{ ok?, error? }` from lib/form.ts), never throwing to the client. Reads go through lib/queries.ts. No Redux/Zustand, no React Query/SWR/tRPC, no WebSockets; feed freshness is `revalidatePath` + a polling "new posts" pill.

## HTTP surface

Only three routes; everything else is server components + actions:

- `POST /api/c/[slug]/posts` — write-only campaign API, per-campaign bearer key (hash-only), can post as any NPC or the creator's character.
- `POST /api/upload` — image upload to Vercel Blob; 501 when `BLOB_READ_WRITE_TOKEN` is unset (UI falls back to pasted URLs).
- `GET /api/cron/blob-sweep` — the housekeeping cron above.

## Non-negotiables

- Re-check persona ownership server-side on every write (`loadActionContext` -> `ownsPersona`); never trust a client `personaId`.
- Scope every query and insert by `campaignId`.
- Never persist a raw secret: session tokens and API keys are SHA-256 hashes; passwords are bcrypt.
- DB access only through lib/queries.ts (reads) and server actions (writes); components never query the DB.

## Known issues

- Migration-chain drift: the `0003` snapshot predates the `campaign_api_keys` table and the `personas_owner_idx` rename, so `drizzle-kit generate` keeps wanting to re-emit them. The integration harness pushes `schema.ts` directly. A clean reconciling migration is still owed.
- A dev DB built with `db:push` has an empty drizzle journal; `db:migrate` would re-run everything. Backfill with `pnpm db:mark-migrations` first.
- Feed payloads still carry the generated `search_vector` tsvector over the wire (correctness fine, bytes wasted).

## Testing

Co-located: `*.test.ts` are unit (no DB), `*.itest.ts` are integration against a real Postgres `TEST_DATABASE_URL` (truncate + seed via `src/test/`, run serially). CI runs typecheck, lint, build, and the unit suite on every push.

Note: the project's `.mex/` scaffold (ROUTER, AGENTS, context/, patterns/) holds the same knowledge in the session-bootstrap format and is the first thing to read each session.
