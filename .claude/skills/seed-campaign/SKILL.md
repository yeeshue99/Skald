---
name: seed-campaign
description: >-
  Generate a runnable Skald campaign seed script from freeform text describing
  player characters (PCs) and NPCs. Use when the user pastes or describes a cast
  ("seed a campaign with these characters", "make a seed from this party", "build
  demo data for <campaign>"). Produces a tsx seed under src/db/ that creates the
  users, personas, posts, follows, likes, polls, threads, quotes, hashtags,
  mentions, and notifications, with the DM loaded as Narrator/DM/GM and every
  character interacting with every other at least twice. Always re-derives the
  app's current capabilities from source before generating.
---

# Seed a campaign from freeform character text

Turn a freeform description of a cast into a runnable seed script that fills a
Skald campaign with believable, interconnected activity that exercises every
feature the app currently has.

The output is a TypeScript seed (`src/db/seeds/<slug>.ts`) run with
`pnpm tsx src/db/seeds/<slug>.ts`. It inserts rows directly with Drizzle (it does
NOT go through server actions), mirroring `src/db/seeds/seed.ts`.

## Non-negotiable requirements

These come from the request and must always hold:

1. **The DM is the Narrator.** The DM user's primary persona is named exactly
   `Narrator`, `DM`, or `GM` (default to `Narrator` unless the input says
   otherwise). The DM is a single global user with `memberships.role = "dm"`.
2. **All NPCs live under the DM account.** Every NPC is a persona owned by the
   DM user with `isNpc = true`. Players never own NPCs. Each PC is owned by its
   own player user (`role = "player"`), `isNpc = false`.
3. **Fun, on-theme handles.** Every persona (PC, NPC, and the Narrator) gets a
   handle that is playful and clearly tied to the character (e.g. a rogue named
   Vex -> `@lightfingers`, a fire mage -> `@ashmonger`, a kindly innkeeper ->
   `@tapsandtales`). Handles must satisfy the app's handle rule (see step 1) and
   be unique within the campaign.
4. **Full pairwise interaction.** Every character (every PC and every NPC) must
   interact with every other character **at least twice**. More is good. Build a
   ledger and prove coverage (see step 6). The Narrator should also interact with
   the cast; include it in the ledger.
5. **Show every feature.** The seed must exercise the full current feature set:
   threads, quotes, plain boosts, replies, polls + votes, hashtags, mentions,
   images, scheduled posts, drafts, likes, follows, bookmarks, notifications,
   pinned posts, avatar frames, banners, and decorations. Derive the exact list
   from the code in step 1, then check each off in step 7.

## Procedure

### 1. Re-derive the app's current capabilities (do this every time)

Never trust this file's snapshot of the schema. Read the source first and build
the feature list and row shapes from what is actually there now:

- `src/db/schema.ts` — every table and column, enums, FKs, checks, unique
  indexes. Note generated columns you must NOT write (e.g. `posts.search_vector`).
- `src/db/seeds/seed.ts` — the canonical seed conventions to mirror (env loading,
  idempotent cleanup, insert order, acting-persona wiring, clean shutdown,
  the logins printout). Note its imports are one level deeper (`../index`,
  `../../lib/...`); generated seeds in `src/db/seeds/` use the same paths.
- `src/lib/validation.ts` — the live limits: handle regex and length, display
  name and bio caps, post length cap, poll option/length rules, avatar-frame set.
- `src/lib/themes.ts` — the `PRESETS` to pick a campaign theme from (so the
  campaign has real colors + decorations), and the decoration/avatar-frame names.
- `src/lib/notify.ts` — the `notify()` / `notifyMentions()` helpers and the
  notification `type` set. Notifications are NOT auto-created on direct inserts,
  so the seed must create them (reuse these helpers, or insert rows directly
  respecting the unique/dedup indexes).
- `src/lib/queries.ts` and `src/app/actions/posts.ts` — to confirm the data-level
  meaning of each feature (how a thread, quote, boost, poll, scheduled/draft post
  is represented). Skim `src/components/` only if a feature's data shape is
  unclear.

Write down, from the code you just read, the concrete feature list and the
constraints. If a capability changed since this file was written, follow the
code, not this file.

### 2. Parse the freeform input into a roster

From the user's text, extract:

- The **DM/Narrator** (their preferred label if stated).
- Each **PC**: name, a short bio, personality/voice, and relationships.
- Each **NPC**: same, plus that it is DM-owned.
- Any **relationships, conflicts, running jokes, plot hooks** — these drive the
  post content and the interaction graph.

If the input does not make clear who is a PC vs an NPC, ask one concise
clarifying question rather than guessing. If it is clear, proceed.

### 3. Design the accounts and personas

- One DM user (e.g. username `dm`) -> Narrator persona (`isNpc = false`) + all
  NPC personas (`isNpc = true`).
- One player user per PC -> that PC persona (`isNpc = false`).
- Memberships: DM `role = "dm"`, players `role = "player"`. Set each membership's
  `actingPersonaId` (DM -> Narrator; player -> their PC).
- Pick a `PRESETS` theme that fits the campaign's tone (this is how the
  decorations feature shows up). Optionally also seed a personal/shared decoration
  and a campaign default if those exist in the current schema.
- Give personas variety: different `avatarFrame` values, a few `bannerUrl`s, some
  `avatarUrl`s (use stable placeholder image URLs), and pick one post per active
  persona to set as its `pinnedPostId`.

Validate every handle/displayName/bio against the limits from step 1 BEFORE
writing them. Keep one password for all seeded logins and print them at the end.

### 4. Plan the content beats

Sketch a short timeline (oldest to newest) of what is happening in the campaign,
so the posts read like a real feed, not filler. Use the relationships and hooks
from step 2. Plan where each feature naturally fits:

- a **self-thread** where one character tells a story across several posts;
- **conversations** (replies between different characters);
- **quotes** (a character quote-posts another with commentary) and a couple of
  plain **boosts** (repost with empty content);
- a **poll** the Narrator or an NPC runs, with several characters voting;
- **hashtags** for running bits/events and **mentions** to pull characters in;
- an **image** post or two, a **scheduled** reveal (future `publishedAt`), and a
  **draft**;
- **bookmarks** (a few characters privately save posts).

### 5. Generate posts and the social graph

Write the posts so they are short, in-voice, and reference each other. Respect
the schema constraints from step 1 (e.g. a post is a reply XOR a quote, never
both; a plain boost has empty content and is unique per persona+post; timestamps
are timezone-aware; content stays under the post-length cap).

Lay down the social graph: a follow edge for most pairs, likes scattered across
posts, a few bookmarks, and notifications for the replies/quotes/follows/mentions
you created (via `notify()` so dedup is correct).

### 6. Enforce the interaction matrix (hard requirement)

An **interaction** between A and B is any of: A replies to B, A quotes or boosts
B, A @mentions B, A likes B's post, or A follows B (and the reverse). Each such
event adds 1 to the unordered pair {A, B}.

Build a ledger as you generate (a `Map` keyed by the sorted handle pair, with a
`touch(a, b)` helper called at every reply/quote/boost/mention/like/follow).
**Embed a self-check in the generated seed**: after all inserts, iterate every
unordered pair of PC+NPC personas and assert the count is >= 2; if any pair is
short, `console.error` the missing pairs and `process.exit(1)`. Print a one-line
coverage summary on success. This makes the requirement enforced at run time, not
just at authoring time.

Cost note: full pairwise coverage is O(n^2) in the number of characters. For a
large cast, lead with a dense follow graph and likes (cheap pair coverage), then
layer threads/quotes/replies/mentions for variety and to push busy pairs well
past 2. If the cast is very large (say > 12), tell the user the post count will be
high and confirm before generating.

### 7. Feature-coverage checklist

Before finishing, confirm the generated seed includes at least one of each
feature you enumerated in step 1. At time of writing that is:

- [ ] multi-post self-thread (chained `replyToPostId` to the author's own posts)
- [ ] reply / conversation (reply to a different author)
- [ ] quote post (`repostOfPostId` + non-empty content)
- [ ] plain boost (`repostOfPostId` + empty content)
- [ ] poll + votes (`polls` + `pollVotes`)
- [ ] hashtags (`#tag`) feeding trending
- [ ] mentions (`@handle`)
- [ ] image post (`imageUrl`)
- [ ] scheduled post (future `publishedAt`, status `scheduled`)
- [ ] draft (status `draft`, `publishedAt` null)
- [ ] likes, follows, bookmarks
- [ ] notifications (via `notify()`)
- [ ] pinned post (`personas.pinnedPostId`)
- [ ] avatar frames (varied), banners
- [ ] decorations (theme preset; plus personal/shared/default if present in schema)

Re-derive this list from the code each run; treat the checklist above as a
starting point, not the source of truth.

### 8. Write, verify, and report

- Write the seed to `src/db/seeds/<slug>.ts` (a NEW file; never clobber
  `seed.ts`). Use the same env import and clean-shutdown pattern as
  `src/db/seeds/seed.ts`, including its `../`/`../../` import depth.
- Make cleanup idempotent and SCOPED: delete the campaign by its slug (cascades
  its personas/posts/etc.) and delete only the users this seed creates (by
  `usernameLower`). Never delete data you did not create.
- `pnpm typecheck` must pass on the new file.
- If a dev database is reachable, run `pnpm tsx src/db/seeds/<slug>.ts` and confirm
  it prints success + the coverage summary. The seed targets `DATABASE_URL` from
  `.env.local`; the DB must already have the current schema applied (`pnpm db:push`)
  or inserts referencing new columns will fail. If you cannot reach a DB, hand the
  user the exact run command and say it was not executed here.
- Report the campaign slug, the logins (username + the shared password), the
  invite code, and the feature/interaction coverage.

## Gotchas (verify against current source; this is a snapshot)

- **Handles**: `^[a-zA-Z0-9_]{2,24}$`, unique per campaign case-insensitively
  (store `handleLower`). Display name and bio have caps; posts have a length cap
  (`MAX_POST_LENGTH`). Read the real values from `validation.ts`.
- **Constraints**: a post is reply XOR repost; no self-reference; a plain boost
  (empty content + `repostOfPostId`) is unique per (persona, post); a notification
  must have `recipient != actor` and is unique per (actor, post) for likes and per
  (actor, recipient) for follows.
- **Generated columns**: never write `posts.search_vector` (Postgres maintains it).
- **Notifications are not automatic** on direct inserts. Create them with
  `notify()` / `notifyMentions()`, and only for published posts (a scheduled/draft
  post should not ping anyone yet).
- **Scheduling needs no worker**: a `scheduled` post simply has a future
  `publishedAt`; it becomes visible when its time passes.
- **Schema must be applied**: editing `schema.ts` does not touch the database. Run
  `pnpm db:push` against the target DB before seeding, or inserts will fail with
  "column does not exist". (See the project note on applying schema changes.)
- **Theme**: set `campaigns.theme` to a `PRESETS` entry (spread a copy) so the
  campaign renders with real colors and decorations.
