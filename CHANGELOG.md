# Changelog

A record of what's shipped in Skald, a deployable themeable D&D social feed.
Newer work is toward the top. There are no version tags yet, so everything lives
under Unreleased.

## Unreleased

### Posts: composing, scheduling, and moderation

- Image uploads: attach an image in the composer and it uploads to Vercel Blob
  via `/api/upload` (signed-in only, image types only, 5MB cap). When
  `BLOB_READ_WRITE_TOKEN` isn't set the route returns 501 and the composer falls
  back to pasting an image URL. The same uploader (a reusable `AvatarField`) now
  backs persona avatars in Edit profile and in onboarding: upload a file, paste a
  URL, or leave it blank for generated initials, with a live preview.
- Profile banner: a persona can set a wide header image (`personas.bannerUrl`)
  from Edit profile via the same uploader (a `BannerField`); the profile header
  shows it, falling back to the theme gradient when unset.
- Per-persona avatar frame: each persona picks its own avatar frame
  (`personas.avatarFrame`) in Edit profile, independent of the campaign theme.
  "default" inherits the campaign frame; any other value (none, mana halo,
  medallion, HUD bracket, wreath, blossom) overrides it for that persona's avatar
  wherever it appears, via a `data-frame` attribute the per-avatar CSS keys off.
- Decoration "mods": on top of the DM's campaign theme, any member can author a
  decoration and apply it just to themselves in that campaign, like a small
  first-party modding SDK. A mod overrides any subset of the campaign's named
  decoration dimensions (backdrop texture, post divider, button FX, avatar frame,
  card depth, reaction flourish, card frame, wordmark, top-bar chrome, background
  motion, ambient effects) and/or supplies a custom uploaded backdrop image (the
  one upload-backed dimension: tile or cover, tile size, opacity, motion). It
  applies to your view until you change it; everyone else keeps the campaign
  default. A decoration is a declarative spec (`{ overrides, backdrop }`, never
  raw CSS/JS), stored in a new `decorations` table; your pick is
  `memberships.selected_decoration_id`. `campaignRenderProps` merges the active
  mod's named overrides into the theme (so the existing data-attr + CSS-var
  machinery covers every dimension) and then repoints the texture machinery at a
  custom backdrop; image URLs pass a `safeCssUrl` guard so nothing can break out
  of the `url("…")` wrapper. Resolution per viewer is: your personal pick, else
  the campaign default, else the campaign theme's named values.
- DM decorations: a DM can additionally share decorations campaign-wide (a
  `scope = "campaign"` decoration in the same table) so every member can pick them
  on their Appearance page, and promote one shared decoration to the campaign
  default (`campaigns.world_decoration_id`), applied to anyone without a personal
  pick. Both the per-member selection and the campaign default are
  `ON DELETE SET NULL`, so deleting a decoration falls everyone back cleanly. The
  DM theme editor and this editor share one option list (`decoration-options.ts`).
  All managed on the Appearance page (`/c/<slug>/appearance`), linked from the
  sidebar and the mobile header.
- Decoration preview shows every dimension. The live preview's sample now carries
  one element per previewable dimension (`.chrome-bar`, `.wordmark`, `.post-card`,
  a single `.avatar-frame`, `.ui-card`, `.ui-button`), so card depth, card frame,
  and top-bar chrome — which target `.ui-card`/`.chrome-bar` and previously had no
  element to style — now render. The redundant nested `.avatar-frame` that drew
  the ring twice was collapsed. (Same enrichment applied to the DM theme editor
  preview.) Backdrop motion, ambient effects, reaction flourishes, and named
  textures still only show on the real feed; they are motion/event/fixed-layer
  driven, not static.
- Multi-post threads: the composer can author a self-thread. "Add another post"
  chains a run of segments (each with its own text, image, and counter), posted
  in order as replies to one another and sharing one publish / schedule / draft
  state. Opening the root shows the whole thread because `getThread` follows the
  author's own chain into a `selfThread`; feeds list only the root since they
  already hide replies.
- Quote posts: the repost control is now a Repost / Quote menu. "Quote" opens a
  focused composer (`/c/<slug>/post/<id>/quote`) that embeds the original and
  posts your commentary as a new root carrying `repostOfPostId`; the quoted post
  then renders inline in the feed and on the profile. A plain repost (empty
  content) still boosts; a quote adds text. The reply-XOR-repost check keeps a
  post from being both a reply and a quote, so a quote can't carry a poll, a
  thread, or a reply target.
- Polls: a post can carry a poll (2-4 options, open for 1 / 3 / 7 days). The
  composer has a poll mode that's mutually exclusive with images, threads, and
  scheduling. Each persona casts one vote (unique per poll); after voting or once
  the poll closes the options become result bars (percent, your pick checked, the
  total and time left). Stored as `polls` + `poll_votes` tables, hydrated onto
  `PostView` and rendered by `PollDisplay`.
- Scheduling and drafts: compose now, schedule for later, or save a draft.
  Visibility is purely time-based (a post is live once its `publishedAt` is in
  the past), so scheduled posts go live with no background worker.
- Queue page (`/c/<slug>/queue`, in the nav): lists your scheduled posts and
  drafts, each with publish-now, reschedule, edit, and delete.
- Post editing: the author (or the DM) can edit a post's content and image;
  edited posts show an "edited" marker (`editedAt`). Status, author, and publish
  time are preserved.
- Delete with undo: deleting a post soft-deletes it (`deletedAt`), which keeps
  reply threads intact and lets the delete be undone.
- Pinned post: pin one of a persona's posts to the top of their profile
  (`personas.pinnedPostId`); the pinned post is hidden from its normal
  chronological slot. Pin from a post's menu ("Pin to profile"); the pinned
  slot's menu flips to "Unpin from profile".
- DM moderation: the DM can edit, delete, or pin any persona's post in their
  campaign, not just their own.
- @mention autocomplete: typing `@` in the composer opens a picker of campaign
  personas (server-resolved, ranked exact > prefix), with arrow-key / Enter / Tab
  / click selection that inserts `@handle`. Works on every composer segment and
  feeds the existing mention notifications.
- Composer draft autosave: an in-progress post is saved to `localStorage`
  (debounced) and restored on reload, then cleared once the post is submitted.
  The feed composer and the `/compose` page share one draft; a reply composer
  keeps a per-parent draft. Storage failures in private or blocked-storage modes
  degrade to a silent no-op, so the composer always works.

### Notifications

- Per-persona notifications for likes, replies, follows, and @mentions, with an
  unread badge in the nav and a notifications page. Un-liking or unfollowing
  removes the matching notification; self-notifications and duplicates are
  skipped (DB partial unique indexes back the dedup). Scheduled posts fire their
  reply, quote, and mention notifications when they go live, not when they're
  queued.
- Quote notifications: quoting someone's post notifies the quoted author (a new
  `quote` type), linking to the quote so they see who quoted them and what they
  added. Self-quotes notify no one, and a quote that also @mentions the quoted
  author pings them once, not twice.
- Notifications paginate and don't grow without bound: the page keyset-paginates
  (created_at, id) with a "Load more" button like the feed, and each visit lazily
  prunes the persona's read notifications older than 30 days (unread and recent
  are always kept).

### Search and discovery

- Search page (`/c/<slug>/search`, in the nav): search posts and people by text,
  with inline Follow on people results. With an empty query it shows trending
  hashtags for the campaign.
- Post search now uses Postgres full-text search. Free-text queries match and
  rank against a stored, GIN-indexed `search_vector` (`to_tsvector('english',
  content)`) via `websearch_to_tsquery` + `ts_rank`, giving multi-word AND
  semantics and relevance ranking. Stopword-only or untokenizable queries fall
  back to the previous substring match so they stay discoverable. Hashtag,
  mention, person, and trending searches are unchanged. Campaign exports omit the
  derived `search_vector` column.

### Integrations

- Campaign API keys: the DM can mint bearer keys in Settings -> API access so an
  external app (e.g. a session-notes tool) can post into the campaign over HTTP.
  `POST /api/c/<slug>/posts` takes `persona` (a @handle), `content` and/or
  `imageUrl`, and an optional `scheduledAt`; it posts as any NPC or the key
  creator's own persona and fires @mention notifications. Write-only, scoped to
  one campaign. Keys are stored as a SHA-256 hash (raw token shown once) in
  `campaign_api_keys` and can be revoked. Documented in the README.

### Security

- Rate limiting on write paths. A small in-memory fixed-window limiter throttles
  the campaign API (per IP and per key), login, and register (per IP), so a
  leaked key or credential stuffing has a brake. The API returns `429` with a
  `Retry-After` header; login/register surface a "try again later" message.
  Per-process (fine for a single instance); swap in Upstash/Redis to make it
  global if it ever scales out.
- Cross-instance rate limiting (optional). When `UPSTASH_REDIS_REST_URL` and
  `UPSTASH_REDIS_REST_TOKEN` are set, the write-path counters live in Upstash
  Redis via a dependency-free REST pipeline (`INCR` + `PEXPIRE NX` + `PTTL`) so
  every instance shares one fixed window; otherwise it keeps the per-process
  in-memory limiter. On any Upstash error it falls back to the in-memory limiter
  for that call rather than failing open.

### Performance

- `getThread` no longer issues a query per hop. The ancestor walk is now one
  bounded recursive CTE (ids) plus a single fetch, and the author's self-thread
  is assembled in memory from one query of their replies — so opening a deep
  thread is a handful of round-trips instead of one per level. Output is
  unchanged (verified against a golden baseline + ancestor/self-thread edges).

### Responsive layout

- Mobile navigation: below `md`, a top app bar (wordmark, notifications, search,
  bookmarks, persona switcher) and a fixed bottom tab bar (Home, Explore, Queue,
  Profile, with a center compose button and a safe-area inset). The desktop side
  nav takes over at `md` and up. The top bar's wordmark truncates and the icon
  group holds its size, so it never overflows on narrow phones.

### Accessibility

- Icon-only controls are labeled. Below `lg` the side-nav text labels are
  `display:none`, so the nav links, Post, and Log out (plus the icon-only NPC
  delete button) carry an `aria-label`, with `aria-current` on the active nav
  item. Verified at a 900px viewport: zero unlabeled sidebar controls.
- Consistent keyboard focus rings. A low-specificity `:focus-visible` outline
  covers links, the side-nav and composer icon buttons, `.action-btn`, and
  native controls; `.ui-button` keeps its own Tailwind ring.
- Theme-preset contrast. Deepened the Scrollr and Bloomr accent (the NPC badge)
  and the Bloomr boost green so text on the light fields clears WCAG AA (4.5:1).
  The default theme's primary as 12px text is a known 4.25:1 (it can't be
  lightened without dropping the white-on-primary button label below AA).
- Accessible dialogs. Edit profile and Change password now share one `Modal`
  component instead of hand-rolled divs: `role="dialog"`, `aria-modal`,
  `aria-labelledby`, a Tab / Shift+Tab focus trap, Escape and scrim-click to
  close, and focus moved into the panel on open and restored to the trigger on
  close (guarded for a trigger that has since unmounted). The Compose flow is an
  inline route, not a modal, so it is intentionally left as is.

### Accounts and membership

- DM member provisioning: a "Add a member" form in Settings creates a login, a
  player membership, and a starting character persona in one step, so a player
  can sign in and post immediately. Complements the existing invite-code flow.
- Self-service change password: a "Change password" modal on your own profile.
  Verifies the current password, requires the new one to match its confirmation
  and differ from the old, then re-hashes with bcrypt. Signs out the user's other
  sessions and re-establishes the current one (change here, log out everywhere).
- DM reset member password: a "Reset password" button in the members list sets a
  new temporary password for a member and revokes their sessions, so they sign in
  again with the new one.
- Forgot-password path: since there's no email, the login page tells players to
  ask their DM to reset it (handled by the reset button above).
- New-player onboarding: the DM can add a member with just a login (the character
  is now optional). A player without a character is routed on first sign-in to an
  onboarding screen to pick their own (name, @handle, bio), which becomes their
  acting persona — instead of the DM presetting it.
- Multiple characters per player: a player isn't limited to one character. From
  Settings -> Player characters the DM can create extra characters and assign
  them to a player, and reassign any persona's owner (to another player, or to
  the DM, which turns it into an NPC). A player fully controls every character
  they own and switches between them in the composer's persona switcher. (Dropped
  the one-PC-per-user unique index; ownership + `isNpc` now follow the assignment.)

### Feed and follow

- Following / Everyone tabs on the home feed. Following shows people you follow
  plus your own posts; Everyone is the whole campaign (`?tab=everyone`), folding
  the old Explore page into the main feed (Explore still works as a direct route).
- Inline Follow buttons on feed posts, shown for authors you don't already follow
  and who aren't your own personas. `PostView` carries `authorFollowedByMe`.
- Optimistic FollowButton (Follow / Following / Unfollow) on profiles, the
  "Who to follow" rail, and inline in the feed.
- Bookmarks: a private "save post" toggle on every post (optimistic), plus a
  Bookmarks page (`/c/<slug>/bookmarks`) and nav link listing what the acting
  persona saved. No public count or notification.
- Reposts and quotes are counted separately. The repost icon shows plain boosts
  only, with a separate "N quotes" link beside it that opens a new
  `/c/<slug>/post/<id>/quotes` page listing who quote-reposted a post. The boost
  toggle's optimistic count stays correct because it tracks boosts alone.
- Posts and Replies tabs on a profile (`?tab=replies`). The Replies tab shows the
  persona's top-level posts and replies together, newest first, sharing the home
  feed's visibility rules. Pinned posts still show only on the Posts tab.

### Campaign seeding

- Generic seed dispatcher (`src/db/seeds/run.ts`, wired to `pnpm seed`): run any
  seed by filename with `pnpm seed <name>` (resolves `src/db/seeds/<name>.ts`, or
  `seed-<name>.ts`), forwarding extra args to that seed. No name runs the STR/X
  demo. New seeds need no package.json entry, just a file in the folder. The
  `seed-campaign` skill now generates seeds run this way.
- Reusable JSON seeder (`src/db/seeds/seed-petalfall.ts`, `pnpm seed:petalfall`):
  validates a world payload, then creates the campaign, NPC and PC personas,
  posts (replies / quotes / boosts), likes, and follows. Idempotent re-runs.
  Supports an optional per-persona `account` login (real name to sign in, alias
  as the display name, a fun @handle).
- A worldbuilder prompt that emits seed-ready JSON (`docs/seed-prompt.md`), plus
  the "Petalfall" demo campaign built from it. The prompt -> JSON -> seed pipeline
  is documented in the README.
- Seeded personas get a deterministic generated avatar (DiceBear, by handle), and
  posts with an `imageHint` get a seeded placeholder image, so a fresh seed reads
  as a populated feed instead of initials and blank cards.
- Optional real image generation. With `IMAGE_GEN_API_KEY` set, the seeder
  generates avatars and post images from each `avatarHint` / `imageHint` via an
  image-gen API (provider-pluggable, default OpenAI; base64 output is uploaded to
  Vercel Blob). With no key the seeder is unchanged (deterministic DiceBear
  avatars and picsum placeholders). Any provider error or timeout falls back to
  the placeholder, so a seed never hard-fails on the image path; with a key,
  reseeds produce fresh, non-deterministic images.

### Theme decorations (per-campaign styling)

Each dimension is a named style the DM picks from a dropdown, stored as `jsonb`
on the campaign row (no migration needed), applied at runtime via data
attributes and CSS variables, and gated by `prefers-reduced-motion` where
animated. Presets: STR/X (gothic arcane academia), Scrollr (medieval parchment),
HOLONET// (sci-fi cyberpunk), Bloomr (botanical / illuminated herbal), and a
neutral default. Migrated from the old TODO; all ten dimensions shipped.

1. Backdrop texture: star-chart / constellations, parchment, circuit, squiggle,
   florets, vinework.
2. Card frame on standalone cards (panels, quote embeds): gilded double-rule
   with corner filigree, deckled torn-sheet edge, chamfered HUD corners,
   botanical vine, pressed flower.
3. Post dividers: asterism, diamond, data line, vine sprig, laurel.
4. Button and interaction FX: arcane glow (hover bloom), wax seal (emboss), neon
   (uppercase + glitch flicker), petal press, dewdrop. Applied to primary
   buttons, side-nav, and composer buttons.
5. Reaction flourishes on like / boost: sparkle, wax stamp, energy pulse, petal
   scatter, bloom.
6. Avatar frames: mana halo, medallion, HUD bracket, laurel wreath, blossom halo.
7. Depth language (shadow + glow): violet ambient, paper matte, cyan bloom,
   verdant ambient, rose glow.
8. Wordmark embellishment: arcane sigil, illuminated drop-cap, blinking caret,
   leaf sprig, rosette.
9. Top-bar chrome: stained-glass wash, scalloped banner edge, HUD signal strip,
   trellis, garland.
10. Ambient motion (opt-in, combinable): embers, motes, dust, scanlines, fog,
    page-curl on hover, petal fall, pollen, with selectable background scroll
    direction (including a sine-wave drift).

### Tests and CI

- Test runner: Vitest, with `pnpm test` and `pnpm test:watch`. A starter unit
  suite (32 tests) over the highest-risk pure logic: the keyset cursor codec
  (`encodeCursor` / `decodeCursor`), the compose / persona / poll / auth /
  campaign Zod schemas and slug/handle normalizers, the blob-cleanup helpers
  (`blobPathname`, `pickOrphans`), and `notify`'s self-skip + dedup (db mocked).
  DB-bound paths are covered by the integration suite below.
- Integration tests against a real Postgres (`pnpm test:integration`, the
  `*.itest.ts` files). They cover feed visibility + keyset pagination (including
  tied timestamps), `getThread` ancestor / self-thread chaining and its edges,
  `notify` dedup via the partial unique indexes, and the post CHECK constraints
  (reply-XOR-repost, draft-has-no-publish-time, no self-reply). They run via the
  node-postgres driver against `TEST_DATABASE_URL`, pushing the current schema
  first; without that env var they skip, so the default `pnpm test` is unaffected.
- CI: a GitHub Actions workflow (`.github/workflows/ci.yml`) runs `typecheck`,
  `lint`, `test`, and `build` on every push and pull request, plus a separate
  job that spins up a Postgres service and runs the integration suite. The app is
  fully dynamic (cookie-based), so build needs no database (a dummy `DATABASE_URL`
  satisfies the lazy pool constructor).

### Fixes

- NPC creation was rejected by `personaSchema`. After `bannerUrl` / `avatarFrame`
  were added to the schema, the NPC form omitted them, so they arrived as `null`
  from FormData and failed the optional-string/enum parse. Persona actions now
  coerce absent fields to `undefined` so the schema defaults apply.
- arcaneGlow hover bloom was a no-op: `--btn-glow` held a full shadow fragment
  but was consumed as a color, so the hover box-shadow was invalid and dropped.
- React 19 `<form action>` auto-reset was reverting theme-editor edits on
  controlled selects (fixed with an `onReset` preventDefault).
- Partial decorations were rejected by the save schema (seed from a normalized
  theme so every key is present).
- Infinite-loading on the dev feed from the Neon serverless `poolQueryViaFetch`
  fetch path on Node 24 (use the WebSocket query path in dev).
- Removed the laurel/bookstack avatar frames that didn't read well; retired
  values coerce to "none".
- Lint cleanup: `pnpm lint` is error-free. Canonicalized Tailwind arbitrary
  classes, resolved the react-hooks errors (`EditPersonaButton`, `LocalTime`,
  `FeedList`, `Composer`), and removed dead `@keyframes` from `globals.css`.

### Platform

- Orphaned blob cleanup: a sweep deletes Vercel Blob images that no row
  references (avatars, banners, and post images replaced by a newer upload, or
  belonging to a hard-deleted persona or post). External / pasted image URLs are
  never touched. Run it with `pnpm blob:sweep` (dry-run by default, `--apply` to
  delete) or the guarded `/api/cron/blob-sweep` route, which Vercel Cron hits
  daily (`vercel.json`) once `CRON_SECRET` is set.
- Campaign export: from Settings, the DM can download the whole campaign as a
  JSON file (`/c/<slug>/settings/export`; DM-only, a non-DM member gets 403). It
  dumps the theme, members (username and role, no credentials), personas, every
  post (drafts and soft-deleted included), the follow / like / bookmark graph,
  and polls, with row ids preserved so the in-export relationships stay
  consistent for a future import. Password hashes, sessions, and notifications
  are excluded.
- Campaign import: the other half of export. From the new-campaign page ("or
  restore a backup"), a signed-in user uploads an export JSON and gets a fresh
  campaign they DM. The import runs in one transaction, remapping every row id
  onto new ones so replies, reposts, pins, follows, likes, bookmarks, and poll
  votes are rebuilt against the new ids; it takes a fresh slug and invite code.
  The original creator's persona is restored as the importer's player character
  and the rest become their NPCs (one owner can hold a single PC). The source's
  other members and their credentials aren't restored.
- Schema migrations regenerated. Everything that had been applied to dev by hand
  (post `editedAt`; persona `avatarFrame`, `bannerUrl`, `pinnedPostId`; and the
  `bookmarks`, `polls`, and `poll_votes` tables) now has a Drizzle migration
  (`0002`, `0003`), so a fresh `db:migrate` reproduces the whole schema.
  `drizzle-kit generate` runs offline (schema vs snapshots, no DB), so it
  sidesteps the Neon connection hang that blocks `migrate` / `push` here.
- `pnpm db:mark-migrations`: an idempotent dev-only script that backfills
  `drizzle.__drizzle_migrations` so a from-scratch `db:migrate` is a no-op on a
  hand-built dev database (the recurring gap when dev was created with `db:push`
  or by hand). Hashes and timestamps come straight from drizzle-orm for exact
  parity; it inserts only the missing rows in a transaction, supports `--dry-run`
  (prints the full journal table plus planned inserts), refuses a placeholder or
  invalid `DATABASE_URL`, and requires `--yes` with a host echo for any non-local
  target.
- Rebranded internal `twttr` identifiers to `skald`.
- Deployed to Vercel.
