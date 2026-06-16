# Skald — a social feed for your tabletop campaign

A private, self-hostable Twitter-style app for your D&D group. Post as NPCs and
players, follow each other, schedule reveals to go live mid-session, and reskin
the whole thing per campaign (STR/X for Strixhaven, Scrollr for high fantasy,
HOLONET// for sci-fi, or roll your own).

Built with Next.js (App Router) + TypeScript, Drizzle ORM on Neon Postgres,
Tailwind v4, and custom session auth. Designed to deploy free on Vercel + Neon.

## How it works

- **Personas are the accounts.** Each player owns one persona (their character);
  the DM owns many (NPCs). Posts, follows, and likes all attach to a persona, so
  the DM can post as any NPC from one login. Switch personas in the composer or
  the left rail.
- **Scheduling needs no background worker.** A post's "publish time" is just a
  timestamp; the feed shows posts whose time has passed. Schedule a post for the
  exact moment of a reveal and it appears on its own. Manage scheduled posts and
  drafts under **Queue**.
- **Themeable per campaign.** Each campaign stores its own theme (name, colors,
  fonts, radius), applied at runtime via CSS variables. Edit it live under
  **Settings → Theme**.
- **Private.** Invite-code registration. Just your table, no strangers.

## Local setup

You need Node 20+ and a (free) Neon Postgres database. Neon works for both local
dev and production, so there's no local Postgres to install.

1. **Create a database.** Sign up at [neon.tech](https://neon.tech), create a
   project, and copy its connection string.

2. **Configure env.** Copy the example and paste your connection string:

   ```bash
   cp .env.example .env.local
   ```

   Set `DATABASE_URL` in `.env.local`. (`BLOB_READ_WRITE_TOKEN` is optional — see
   Images below.)

3. **Install + create the tables:**

   ```bash
   pnpm install
   pnpm db:push
   ```

4. **(Optional) Seed a demo campaign:**

   ```bash
   pnpm seed
   ```

   This creates the **STR/X** demo campaign at `/c/strix` and prints logins
   (default password `password123`: `dm`, `tasha`, `kael`) plus an invite code.

5. **Run it:**

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Create your own campaign
   from the landing page, or sign in with a seeded account.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **New Project → import the repo.** Framework auto-detects as
   Next.js.
3. Add an environment variable **`DATABASE_URL`** = your Neon connection string
   (the same one you used locally). Tip: in the Vercel project's **Storage** tab
   you can also create a Neon database and it wires `DATABASE_URL` for you.
4. **Deploy.** After the first deploy, create the tables against your production
   database once:

   ```bash
   # locally, with .env.local pointing at the production Neon DB
   pnpm db:push
   ```

   (Or run it against the prod URL however you prefer. You only do this when the
   schema changes.)

5. Visit your deployment, create a campaign, and share the invite code with your
   players.

### Images (optional)

Tweet and avatar image **uploads** use [Vercel Blob](https://vercel.com/docs/storage/vercel-blob).
To enable: in your Vercel project's **Storage** tab, create a Blob store, then
add its **`BLOB_READ_WRITE_TOKEN`** to your environment variables (and to
`.env.local` for local uploads). Without it, you can still attach images by
pasting an image URL — the app falls back automatically.

## Seeding a campaign from a world

You can generate a whole campaign (the world, NPCs, player characters, and a feed
of posts/replies/quotes/boosts with likes and follows) from a prompt, then load
it in one command.

1. **Generate the data.** Open [`docs/seed-prompt.md`](docs/seed-prompt.md), fill
   in the bracketed inputs (premise, tone, your player characters, sizes), and
   give the prompt to a capable LLM. Save its JSON output to a file, e.g.
   `scripts/seed.myworld.json`.
2. **Seed it:**

   ```bash
   pnpm tsx src/db/seed-petalfall.ts scripts/seed.myworld.json my-world
   ```

   (`pnpm seed:petalfall` with no args loads the bundled **Petalfall** demo from
   `scripts/seed.petalfall.json`.)

The seeder validates the JSON (handles, lengths, that every reference resolves,
the reply/quote/boost rules), then creates the campaign, its NPC and PC personas,
the posts, likes, and follows. It's idempotent: re-running wipes that campaign and
its accounts, then rebuilds.

What you get:

- A DM login (`<slug>_dm`) that owns all the NPCs, plus one login per player
  character (their real name, from `account`). All share the dev password
  `petalfall` — players can change theirs in the app, and the DM can reset any of
  them from **Settings → Members**.
- A generated avatar for every persona (DiceBear, deterministic by handle).
- A placeholder image on any post that has an `imageHint` (a stand-in; matching
  the hint exactly would need a text-to-image API).
- An invite code, printed at the end along with every login.

## Posting from an external app (API keys)

A DM can let another app (say, a session-notes tool) post into a campaign over
HTTP. In Settings -> API access, generate a key. The raw key is shown once;
only its hash is stored.

The key is write-only and scoped to that one campaign. It can post as any NPC,
or as the key creator's own character. Send it as a bearer token:

```bash
curl -X POST https://your-app.example/api/c/<slug>/posts \
  -H "Authorization: Bearer skald_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "persona": "@chronicler",
    "content": "Session 12 recap: the party finally reached Blackthorn…",
    "imageUrl": "https://…",        // optional
    "scheduledAt": "2026-07-01T18:00:00Z"  // optional ISO instant; posts later
  }'
```

`persona` (a handle) plus `content` and/or `imageUrl` are required. On success
it returns `201` with `{ id, status, persona, url }`. Bad or revoked keys get
`401`; a persona the key can't post as gets `403`/`404`. Revoke a key any time
from the same Settings panel.

Full contract (for the calling app): [docs/integrations/skald-posting.md](docs/integrations/skald-posting.md).

## Useful scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run the dev server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm db:push` | Sync the schema to the database |
| `pnpm db:studio` | Open Drizzle Studio to browse data |
| `pnpm seed` | Load the STR/X demo campaign |
| `pnpm seed:petalfall` | Load the Petalfall demo (or a custom world JSON) |
| `pnpm typecheck` | Type-check the project |

## Notes

- Sessions store only a SHA-256 hash of the cookie token, so a database leak
  never exposes usable sessions.
- The "acting persona" lives server-side on your membership, not in a cookie, and
  every post/like/follow re-checks that you own the persona you're acting as.
- Scheduled times are picked in your local timezone and stored as UTC instants.
