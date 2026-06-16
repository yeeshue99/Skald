# Backlog

Future work for Skald. Shipped items live in CHANGELOG.md. Roughly ordered by
how grounded each item is: concrete gaps first, then ideas.

## Concrete gaps

- [ ] Avatar uploads. Post images already upload to Vercel Blob (the
      `/api/upload` route + the composer file picker, with a pasted-URL
      fallback), but persona avatars are still a pasted URL only (Edit profile)
      or auto-generated (onboarding). Reuse `/api/upload` to add a file picker to
      the persona and onboarding forms.
- [ ] Profile banner. The profile header is a gradient placeholder; let a persona
      set a banner image (pairs with avatar uploads).
- [ ] Compose multi-post threads. Reading a conversation works (`getThread`
      renders ancestors, root, and replies), but you can't author a self-thread
      (a chain of your own posts) as one unit.
- [ ] Bookmarks on mobile. The bottom tab bar is Home / Explore / Queue /
      Profile; Bookmarks is reachable only from the desktop side nav. Add it to
      the mobile top bar or an overflow.
- [ ] Accessibility pass. The side-nav labels are `display:none` below `lg`, so
      audit icon-only controls for aria-labels, focus-visible styling, and color
      contrast across the theme presets.

## Optional / nice-to-have

- [ ] Real text-to-image (needs an API key) so seeded avatars and post images
      match their `imageHint`s, instead of generated avatars + stand-in
      placeholders.

## Ideas (unscoped)

- [ ] Direct messages between personas (in-world, table-visible to the DM).
- [ ] Emoji reactions beyond like / boost.
- [ ] Polls in posts.
- [ ] Mute / block a persona from your own feed.
- [ ] In-world flavor: a per-campaign "lore" / rules page the DM pins, and
      optional in-character "language" tags on posts (Common, Elvish, ...).
- [ ] DM session tooling: an auto-generated session-recap post (scheduled posts
      and a publish queue already exist to build on).
- [ ] Export a campaign's feed (JSON) for backup or moving between deployments.
