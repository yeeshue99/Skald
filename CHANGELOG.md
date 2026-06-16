# Changelog

A record of what's shipped in Skald, a deployable themeable D&D social feed.
Newer work is toward the top. There are no version tags yet, so everything lives
under Unreleased.

## Unreleased

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

- Rebranded internal `twttr` identifiers to `skald`.
- Deployed to Vercel.
