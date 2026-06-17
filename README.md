# Skald

A private, self-hostable Twitter-style feed for a tabletop campaign. Your table
posts as its characters and NPCs, follows each other, schedules reveals to drop
mid-session, and reskins the whole app per campaign. Built to deploy free on
Vercel and Neon.

Skald is multi-tenant: one deployment hosts many campaigns, each with its own
members, personas, theme, and invite code, all isolated from each other.

## Features

- Personas, not accounts. A login can act as several in-world characters. Players
  get a character (the DM can hand them more); the DM owns the NPCs and posts as
  any of them from one login. Switch personas in the composer or the side nav.
- Posting: text, image, multi-post threads, quote posts, and polls (2-4 options,
  timed). Edit with an "edited" marker, delete with undo (soft delete keeps reply
  threads intact), and pin a post to a profile. The DM can moderate any post.
- Scheduling and drafts. A post's publish time is just a timestamp, so a scheduled
  post goes live on its own with no background worker. Manage scheduled posts and
  drafts under Queue.
- Feed: Following / Everyone tabs, replies and quote embeds, likes, boosts,
  bookmarks, and a live "new posts" pill. @mentions and #hashtags are linkified,
  with @mention autocomplete in the composer.
- Notifications for likes, replies, follows, and @mentions, with an unread badge.
  Paginated, and read ones are pruned over time so the table stays bounded.
- Search people and posts, plus trending hashtags.
- Themeable per campaign: ten styling dimensions (backdrop, card frames, dividers,
  button FX, reaction flourishes, avatar frames, depth, wordmark, top-bar chrome,
  ambient motion), applied at runtime via data attributes and CSS variables and
  gated by `prefers-reduced-motion`. Presets for arcane academia, parchment
  fantasy, sci-fi cyberpunk, and botanical, plus a neutral default.
- Decoration "mods": on top of the campaign theme, any member can author a
  decoration (override any decoration dimension and/or upload a custom backdrop, a
  declarative spec, not raw CSS) and apply it just to themselves in that campaign
  from an Appearance page. A DM can also share decorations campaign-wide and
  promote one to the campaign default. Resolution per viewer: your pick, else the
  campaign default, else the theme's named values.
- Accounts: invite-code registration, DM member provisioning, self-service change
  password, DM password reset, and first-sign-in onboarding.
- Images upload to Vercel Blob (avatars, banners, post images), with a pasted-URL
  fallback when Blob isn't configured.
- A write-only HTTP API so an external app can post into a campaign with a
  per-campaign bearer key.
- Responsive: a desktop three-column layout and a mobile top bar + bottom tab bar.
- Hardened: hashed session tokens, server-side persona ownership checks, and rate
  limiting on the API, login, and register.

## Tech stack

- Next.js 16 (App Router, server actions, Turbopack) and React 19, TypeScript.
- Drizzle ORM on Neon Postgres (serverless driver; WebSocket in dev, fetch in
  prod).
- Tailwind CSS v4.
- Custom cookie-session auth (bcrypt password hashing, SHA-256 token hashes).
- Zod for validation, Vercel Blob for image storage, Vitest for tests.

## How it works

- Campaigns are tenants. Everything (personas, posts, follows, theme, invites)
  belongs to one campaign, reachable at `/c/<slug>`.
- Personas are the actors. A membership ties a user to a campaign with a role (DM
  or player) and an "acting persona" that lives server-side, not in a cookie.
  Every post, like, and follow re-checks that you own the persona you're acting
  as.
- Scheduling needs no worker. Visibility is purely time-based: a post is live once
  its publish time has passed, so a scheduled reveal appears on its own.
- Themes are data. Each campaign stores its theme as JSON on its row, applied at
  runtime, editable live under Settings -> Theme.
- Private by design. Registration is invite-code only, so only your table can
  join.

## Local setup

You need Node 20+ and a free Neon Postgres database. Neon works for both local
dev and production, so there's no local Postgres to install.

1. Create a database. Sign up at [neon.tech](https://neon.tech), create a project,
   and copy its connection string.

2. Configure env:

   ```bash
   cp .env.example .env.local
   ```

   Set `DATABASE_URL` in `.env.local`. (`BLOB_READ_WRITE_TOKEN` is optional, see
   Images below.)

3. Install and create the tables:

   ```bash
   pnpm install
   pnpm db:push
   ```

4. (Optional) seed a demo campaign:

   ```bash
   pnpm seed
   ```

   This creates the STR/X demo at `/c/strix` and prints logins (default password
   `password123`: `dm`, `tasha`, `kael`) plus an invite code.

5. Run it:

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Create your own campaign
   from the landing page, or sign in with a seeded account.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, New Project, import the repo. The framework auto-detects as Next.js.
3. Add `DATABASE_URL` = your Neon connection string. (In the project's Storage
   tab you can create a Neon database and Vercel wires `DATABASE_URL` for you.)
   It must be available to the **Production** build, since migrations run there.
4. Deploy. Migrations run **automatically on every production deploy**:
   `vercel.json` sets the build command to
   `node scripts/predeploy-migrate.mjs && pnpm build`, which runs
   `drizzle-kit migrate` (applying only new `drizzle/000N_*.sql` files) before
   the Next.js build. Preview/branch deploys skip migrating, so they never touch
   the production schema.
   - A **brand-new empty** Neon database migrates from scratch on the first
     deploy — nothing to do.
   - A database that already has tables from an earlier `db:push` (no migration
     journal) must be **baselined once**, or the build fails with instructions.
     Run locally with `.env.local` pointing at that production Neon URL:

     ```bash
     pnpm db:push                   # bring prod schema up to date with schema.ts
     pnpm db:mark-migrations --yes  # record 0000..N as applied (needed once)
     ```

   To add a schema change later: edit `schema.ts`, write the matching
   `drizzle/000N_*.sql` (+ a `_journal.json` entry), commit, and push — the
   deploy applies it. (`pnpm db:generate` can emit the SQL, but the chain is
   currently drifted; see BACKLOG.)
5. Visit the deployment, create a campaign, and share the invite code.

### Images (optional)

Avatar, banner, and post-image uploads use
[Vercel Blob](https://vercel.com/docs/storage/vercel-blob). To enable: in the
project's Storage tab, create a Blob store, then add its `BLOB_READ_WRITE_TOKEN`
to your environment variables (and to `.env.local` for local uploads). Without
it, you can still attach images by pasting an image URL; the app falls back
automatically. `pnpm blob:sweep` deletes orphaned blobs no post or persona
references.

### Rate limiting (optional)

Write paths (the campaign API, login, and register) are rate-limited. By default
the limiter is an in-memory fixed window, so it throttles per process. To make
the limit hold across serverless instances, set `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` from an Upstash Redis database; the limiter then keeps
its counters in Upstash over the REST API (no extra dependency). Both are
optional, and if Upstash is unreachable at request time the limiter degrades to
in-memory rather than failing open.

## Seeding a campaign from a world

You can generate a whole campaign (the world, NPCs, player characters, and a feed
of posts with likes and follows) from a prompt, then load it in one command.

1. Generate the data. Open [`docs/seed-prompt.md`](docs/seed-prompt.md), fill in
   the bracketed inputs (premise, tone, your player characters, sizes), and give
   the prompt to a capable LLM. Save its JSON to a file, e.g.
   `scripts/seed.myworld.json`.
2. Seed it:

   ```bash
   pnpm tsx src/db/seed-petalfall.ts scripts/seed.myworld.json my-world
   ```

   (`pnpm seed:petalfall` with no args loads the bundled Petalfall demo.)

The seeder validates the JSON (handles, lengths, that every reference resolves,
the reply/quote/boost rules), then creates the campaign, its NPC and PC personas,
the posts, likes, and follows. It's idempotent: re-running wipes that campaign and
its accounts, then rebuilds. You get a DM login plus one login per player
character (all sharing a dev password the DM can reset), a generated avatar per
persona, placeholder images for posts that carry an `imageHint`, and an invite
code printed at the end.

By default avatars are deterministic DiceBear images (by handle) and posts with
an `imageHint` get a picsum placeholder. Set `IMAGE_GEN_API_KEY` (and optionally
`IMAGE_GEN_PROVIDER` / `IMAGE_GEN_MODEL`) to have the seeder generate real avatars
and post images from each `avatarHint` / `imageHint` instead. OpenAI returns
base64, so `BLOB_READ_WRITE_TOKEN` must also be set for generated images to
persist; otherwise generation falls back to the placeholder. With a key set,
reseeds produce fresh, non-deterministic images.

A whole campaign can also be exported and re-imported as JSON from Settings, for
backup or moving between deployments.

## Posting from an external app (API keys)

A DM can let another app (say, a session-notes tool) post into a campaign over
HTTP. In Settings -> API access, generate a key. The raw key is shown once; only
its hash is stored. The key is write-only and scoped to that one campaign, and it
can post as any NPC or as the key creator's own character.

```bash
curl -X POST https://your-app.example/api/c/<slug>/posts \
  -H "Authorization: Bearer skald_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "persona": "@chronicler",
    "content": "Session 12 recap: the party finally reached Blackthorn.",
    "imageUrl": "https://...",               // optional
    "scheduledAt": "2026-07-01T18:00:00Z"    // optional ISO instant; posts later
  }'
```

`persona` (a handle) plus `content` and/or `imageUrl` are required. Success
returns `201` with `{ id, status, persona, url }`; bad or revoked keys get `401`,
a persona the key can't post as gets `403`/`404`. Full contract:
[docs/integrations/skald-posting.md](docs/integrations/skald-posting.md).

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run the dev server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm test` | Run the Vitest suite (`pnpm test:watch` to watch) |
| `pnpm typecheck` | Type-check the project |
| `pnpm lint` | Lint with ESLint |
| `pnpm db:push` | Sync the schema to the database |
| `pnpm db:generate` / `pnpm db:migrate` | Generate / apply Drizzle migrations |
| `pnpm db:studio` | Browse data in Drizzle Studio |
| `pnpm seed` | Load the STR/X demo campaign |
| `pnpm seed:petalfall` | Load the Petalfall demo (or a custom world JSON) |
| `pnpm blob:sweep` | Delete orphaned Vercel Blob images |
| `pnpm db:mark-migrations` | Backfill the drizzle journal so `db:migrate` is a no-op on a hand-built dev DB |

CI runs typecheck, lint, build, and the test suite on every push.

## Project layout

```text
src/
  app/                Next.js routes (App Router)
    c/[slug]/         a campaign: feed, profile, post/thread, search, queue,
                      notifications, bookmarks, settings
    actions/          server actions (posts, auth, follows, campaigns, ...)
    api/              the campaign posting API + image upload route
  components/         feed, composer, post card, nav, theme-driven UI
  db/                 Drizzle schema, client, seeders
  lib/                queries, auth, validation, theme types, helpers
docs/                 the worldbuilder seed prompt + integration contract
```

## Notes

- Sessions store only a SHA-256 hash of the cookie token, so a database leak never
  exposes usable sessions.
- The acting persona lives server-side on your membership, not in a cookie, and
  every post / like / follow re-checks that you own the persona you're acting as.
- Scheduled times are picked in your local timezone and stored as UTC instants.
- If a dev database was built by hand or with `db:push`, its drizzle journal is
  empty and `pnpm db:migrate` would try to re-run every migration. Run
  `pnpm db:mark-migrations --dry-run` to preview, then `pnpm db:mark-migrations`
  to backfill the journal so migrate is a no-op. It is idempotent and refuses
  non-local URLs unless you pass `--yes`.
- `CHANGELOG.md` records what's shipped; `BACKLOG.md` tracks what's next.
