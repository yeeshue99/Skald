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
- Multi-post threads: the composer can author a self-thread. "Add another post"
  chains a run of segments (each with its own text, image, and counter), posted
  in order as replies to one another and sharing one publish / schedule / draft
  state. Opening the root shows the whole thread because `getThread` follows the
  author's own chain into a `selfThread`; feeds list only the root since they
  already hide replies.
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

### Notifications

- Per-persona notifications for likes, replies, follows, and @mentions, with an
  unread badge in the nav and a notifications page. Un-liking or unfollowing
  removes the matching notification; self-notifications and duplicates are
  skipped (DB partial unique indexes back the dedup). Scheduled posts fire their
  reply and mention notifications when they go live, not when they're queued.

### Search and discovery

- Search page (`/c/<slug>/search`, in the nav): search posts and people by text,
  with inline Follow on people results. With an empty query it shows trending
  hashtags for the campaign.

### Integrations

- Campaign API keys: the DM can mint bearer keys in Settings -> API access so an
  external app (e.g. a session-notes tool) can post into the campaign over HTTP.
  `POST /api/c/<slug>/posts` takes `persona` (a @handle), `content` and/or
  `imageUrl`, and an optional `scheduledAt`; it posts as any NPC or the key
  creator's own persona and fires @mention notifications. Write-only, scoped to
  one campaign. Keys are stored as a SHA-256 hash (raw token shown once) in
  `campaign_api_keys` and can be revoked. Documented in the README.

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

### Campaign seeding

- Reusable JSON seeder (`src/db/seed-petalfall.ts`, `pnpm seed:petalfall`):
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

### Fixes

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

- Campaign export: from Settings, the DM can download the whole campaign as a
  JSON file (`/c/<slug>/settings/export`; DM-only, a non-DM member gets 403). It
  dumps the theme, members (username and role, no credentials), personas, every
  post (drafts and soft-deleted included), the follow / like / bookmark graph,
  and polls, with row ids preserved so the in-export relationships stay
  consistent for a future import. Password hashes, sessions, and notifications
  are excluded.
- Schema migrations regenerated. Everything that had been applied to dev by hand
  (post `editedAt`; persona `avatarFrame`, `bannerUrl`, `pinnedPostId`; and the
  `bookmarks`, `polls`, and `poll_votes` tables) now has a Drizzle migration
  (`0002`, `0003`), so a fresh `db:migrate` reproduces the whole schema.
  `drizzle-kit generate` runs offline (schema vs snapshots, no DB), so it
  sidesteps the Neon connection hang that blocks `migrate` / `push` here.
- Rebranded internal `twttr` identifiers to `skald`.
- Deployed to Vercel.
