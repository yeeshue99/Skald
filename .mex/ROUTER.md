---
name: router
description: Session bootstrap and navigation hub. Read at the start of every session before any task. Contains project state, routing table, and behavioural contract.
edges:
  - target: context/architecture.md
    condition: when working on system design, integrations, or understanding how components connect
  - target: context/stack.md
    condition: when working with specific technologies, libraries, or making tech decisions
  - target: context/conventions.md
    condition: when writing new code, reviewing code, or unsure about project patterns
  - target: context/decisions.md
    condition: when making architectural choices or understanding why something is built a certain way
  - target: context/setup.md
    condition: when setting up the dev environment or running the project for the first time
  - target: patterns/INDEX.md
    condition: when starting a task, check the pattern index for a matching pattern file
last_updated: 2026-06-16
---

# Session Bootstrap

If you haven't already read `AGENTS.md`, read it now — it contains the project identity, non-negotiables, and commands.

Then read this file fully before doing anything else in this session.

## Current Project State

The app is live (Vercel + Neon, push-to-`main` auto-deploys) and broadly feature-complete. CI runs typecheck, lint, build, and the test suite on every push, plus integration tests against a real Postgres.

**Working:**

- Auth and accounts: invite-code registration, username/password login (bcrypt + hashed session cookie), change/reset password, first-sign-in onboarding, DM member provisioning.
- Multi-tenant campaigns at `/c/<slug>`, each with its own personas, theme, invite code, and members. Personas (not users) are the actors; DM owns NPCs and can moderate any post.
- Posting: text, image, multi-post threads, quote posts, and polls; edit (with "edited" marker), soft-delete with undo, pin to profile. Scheduling and drafts via the Queue page, time-based with no background worker.
- Feed: Following / Everyone tabs, replies, quote embeds, likes, boosts, bookmarks, a live "new posts" pill; @mention and #hashtag linkify plus @mention autocomplete.
- Notifications (likes, replies, follows, mentions, quotes) with an unread badge and pruning of read rows.
- Search (people and posts via a Postgres `search_vector`) and trending hashtags.
- Per-campaign theming across ten dimensions, presets plus a live editor; per-persona avatar frames and banners.
- Images upload to Vercel Blob with a pasted-URL fallback (`pnpm blob:sweep` clears orphans); write-only campaign HTTP API with per-campaign bearer keys; campaign export/import as JSON.

**Not yet built (see `BACKLOG.md`):**

- A clean migration reconciling the `campaign_api_keys` table and the `personas` index rename with the migration chain.
- Paginated Quotes view (`/c/<slug>/post/<id>/quotes` renders only the first 25).
- Quote-draft autosave; "Replying to @x" context on profile reply cards.

**Known issues:**

- Migration-chain drift: the `0003` snapshot predates `campaign_api_keys` and the `personas_owner_idx` rename, so `db:generate` keeps wanting to re-emit them. The integration harness sidesteps this by pushing `schema.ts` directly. See `patterns/db-schema-change.md`.
- A dev DB built with `db:push` has an empty drizzle journal, so `db:migrate` would try to re-run every migration; backfill with `pnpm db:mark-migrations` first.
- Feed payloads still carry the generated `search_vector` tsvector over the wire (correctness fine, bytes wasted).

## Routing Table

Load the relevant file based on the current task. Always load `context/architecture.md` first if not already in context this session.

| Task type | Load |
|-----------|------|
| Understanding how the system works | `context/architecture.md` |
| Working with a specific technology | `context/stack.md` |
| Writing or reviewing code | `context/conventions.md` |
| Making a design decision | `context/decisions.md` |
| Setting up or running the project | `context/setup.md` |
| Any specific task | Check `patterns/INDEX.md` for a matching pattern |

## Behavioural Contract

For every task, follow this loop:

1. **CONTEXT** — Load the relevant context file(s) from the routing table above. Check `patterns/INDEX.md` for a matching pattern. If one exists, follow it. Narrate what you load: "Loading architecture context..."
2. **BUILD** — Do the work. If a pattern exists, follow its Steps. If you are about to deviate from an established pattern, say so before writing any code — state the deviation and why.
3. **VERIFY** — Load `context/conventions.md` and run the Verify Checklist item by item. State each item and whether the output passes. Do not summarise — enumerate explicitly.
4. **DEBUG** — If verification fails or something breaks, check `patterns/INDEX.md` for a debug pattern. Follow it. Fix the issue and re-run VERIFY.
5. **GROW** — After meaningful work, run this binary checklist:
   - **Ground:** What changed in reality? Name the changed behavior, system, command, dependency, or workflow.
   - **Record:** If project state changed, update the "Current Project State" section above. If documented facts changed, update the relevant `context/` file surgically.
   - **Orient:** If this task can recur and no pattern exists, create one in `patterns/` using `patterns/README.md`, then add it to `patterns/INDEX.md`. If a pattern exists but you learned a gotcha, update it.
   - **Write:** Bump `last_updated` in every scaffold file you changed. If the why matters, run `mex log --type decision "<what changed and why>"` or `mex log "<note>"`.
