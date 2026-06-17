---
name: decisions
description: Key architectural and technical decisions with reasoning. Load when making design choices or understanding why something is built a certain way.
triggers:
  - "why do we"
  - "why is it"
  - "decision"
  - "alternative"
  - "we chose"
edges:
  - target: context/architecture.md
    condition: when a decision relates to system structure
  - target: context/stack.md
    condition: when a decision relates to technology choice
last_updated: 2026-06-16
---

# Decisions

<!-- When a decision changes: mark the old entry Superseded, add the new one above it.
     Preserve history. -->

## Decision Log

### Personas, not users, are the tweetable accounts

**Date:** 2026-06-14
**Status:** Active
**Decision:** Posts, follows, likes, and notifications attach to a persona. One login (user) can act as several personas; the DM owns the NPC personas.
**Reasoning:** The product is a table of characters and NPCs, not individual people. The DM needs to post as many NPCs from one login, and players speak in-character.
**Alternatives considered:** One account per character (rejected: the DM would juggle many logins). A "display name" toggle on a single account (rejected: doesn't model ownership, follows, or per-character profiles).
**Consequences:** The "acting persona" is server-side state on the membership, and every write re-checks `ownsPersona`. Identity logic concentrates in `src/lib/campaign.ts`.

### Multi-tenant: one deployment hosts many campaigns

**Date:** 2026-06-14
**Status:** Active
**Decision:** Every row carries a `campaignId`; campaigns are reached at `/c/<slug>` and isolated from each other. Edges (follows, likes, votes) use composite FKs to `(id, campaignId)`.
**Reasoning:** A single free Vercel + Neon deployment can serve many tables without per-campaign infra.
**Alternatives considered:** A deployment (or database) per campaign (rejected: operational overhead for a hobby project). A `campaignId` column with app-only enforcement (rejected: composite FKs make cross-campaign edges impossible at the schema level).
**Consequences:** Every query must filter by `campaignId`; forgetting it is a tenant-isolation bug. This is a non-negotiable.

### Scheduling is time-based, with no background worker

**Date:** 2026-06-14
**Status:** Active
**Decision:** A post's visibility is `publishedAt <= now()`. Scheduled posts and drafts are just rows with a future or null publish time; they appear on their own when the clock passes.
**Reasoning:** Vercel serverless has no always-on worker. A pure timestamp needs no queue, cron, or daemon.
**Alternatives considered:** A cron job or queue to flip posts live (rejected: infra and failure modes for zero benefit). Vercel Cron (rejected: unnecessary given the timestamp model).
**Consequences:** Every read applies the visibility predicate (`src/lib/queries.ts`). Anything keyed off "went live" (e.g. notifications) fires at publish time, not on a schedule tick.

### Hand-rolled cookie-session auth

**Date:** 2026-06-14
**Status:** Active
**Decision:** Auth is a custom cookie session (`skald_session`) in `src/lib/auth.ts`. The DB stores only the SHA-256 hash of the token; passwords are bcrypt-hashed. Registration is invite-code only.
**Reasoning:** The app is private to one table. A full auth provider is overkill, and the threat model is small and self-hosted.
**Alternatives considered:** NextAuth/Auth.js or Clerk (rejected: heavier than needed, and invite-only registration is trivial to own). Storing raw tokens (rejected: a DB leak would expose live sessions).
**Consequences:** Session and credential handling is owned code to maintain. The "store only the hash" rule is a non-negotiable.

### Drizzle with a dual Neon/node-postgres driver

**Date:** 2026-06-14
**Status:** Active
**Decision:** `src/db/index.ts` auto-selects the Neon serverless driver for Neon URLs and node-postgres otherwise.
**Reasoning:** Neon serverless fits Vercel's edge/serverless runtime; node-postgres keeps local and self-hosted Postgres working with no config change.
**Alternatives considered:** Neon-only (rejected: ties local dev to Neon). node-postgres-only (rejected: not ideal on serverless).
**Consequences:** Both `@neondatabase/serverless` and `pg` are dependencies. Schema changes are synced with `db:push` in dev; the migration chain has known drift (see `BACKLOG.md` and `patterns/db-schema-change.md`).
