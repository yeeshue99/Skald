# Backlog

Future work for Skald. Shipped items live in CHANGELOG.md. Roughly ordered by
how grounded each item is: in-progress first, then concrete gaps, then ideas.

## In progress

Being built in parallel; tracked here so the backlog reflects reality. These
move to CHANGELOG.md once they ship.

- [ ] Notifications: likes, replies, follows, and @mentions for your personas,
      with an unread badge in the nav.
- [ ] Search and trending: search posts and people, plus a trending-topics rail.
- [ ] Post editing (with an "edited" marker) and a proper delete-with-undo.
- [ ] Pinned post on a profile.

## Concrete gaps

- [ ] Real image uploads. Posts and avatars still use generated / placeholder
      images (DiceBear + picsum from `imageHint`s). Wire the attach-image button
      and an avatar picker to Vercel Blob (the store already exists) so people
      upload their own. Onboarding and Edit-profile should let a player set an
      avatar.
- [ ] Mobile navigation. The right rail and parts of the nav are xl-only
      (>=1280px). Add a bottom tab bar (or a drawer) so Home, Search, Bookmarks,
      Notifications, and Profile are reachable on a phone.
- [ ] Threads. Compose and read a multi-post thread as one unit, not just single
      replies.
- [ ] Profile banner. The header is a gradient placeholder; let a persona set a
      banner image (pairs with image uploads).
- [ ] DM moderation. Let the DM delete or hide any persona's post in their
      campaign, not just their own.
- [ ] Accessibility pass. Audit keyboard navigation, focus-visible styling, ARIA
      on the icon-only buttons, and color contrast across the theme presets.

## Optional / nice-to-have

- [ ] Real text-to-image (needs an API key) so avatars and post images match
      their `imageHint`s, instead of generated avatars + stand-in placeholders.

## Ideas (unscoped)

- [ ] Direct messages between personas (in-world, table-visible to the DM).
- [ ] Emoji reactions beyond like / boost.
- [ ] Polls in posts.
- [ ] Post drafts (save without scheduling) and a drafts list.
- [ ] Mute / block a persona from your own feed.
- [ ] In-world flavor: a per-campaign "lore" / rules page the DM pins, and
      optional in-character "language" tags on posts (Common, Elvish, ...).
- [ ] DM session tooling: queue NPC posts to drop live during a session
      (builds on scheduled posts), plus an auto-generated session-recap post.
- [ ] Export a campaign's feed (JSON) for backup or moving between deployments.
