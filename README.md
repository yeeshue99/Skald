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

## Useful scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run the dev server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm db:push` | Sync the schema to the database |
| `pnpm db:studio` | Open Drizzle Studio to browse data |
| `pnpm seed` | Load the STR/X demo campaign |
| `pnpm typecheck` | Type-check the project |

## Notes

- Sessions store only a SHA-256 hash of the cookie token, so a database leak
  never exposes usable sessions.
- The "acting persona" lives server-side on your membership, not in a cookie, and
  every post/like/follow re-checks that you own the persona you're acting as.
- Scheduled times are picked in your local timezone and stored as UTC instants.
