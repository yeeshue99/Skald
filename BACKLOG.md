# Backlog

Future work for Skald. Shipped items live in CHANGELOG.md. Roughly ordered by
how grounded each item is: concrete gaps first, then ideas.

## Concrete gaps

- [ ] Integration tests against a throwaway Postgres. The new unit suite covers
      pure logic; the DB-bound paths still ship verified by hand. Add a few
      integration tests (feed `visibleCondition` + keyset pagination, `getThread`
      self-thread chaining, `notify` dedup via the partial unique indexes) that
      run against an ephemeral DB, and wire that DB into CI.
- [ ] Post images have no alt text. Every `<img>` renders `alt=""`, fine for
      decorative avatars but not for post images, which carry content a screen
      reader then can't describe. Let the author add alt text in the composer
      (and map a seeded post's `imageHint` to it).
- [ ] Mark migrations applied on the existing dev DB. The schema is fully
      captured by migrations (`0000`-`0003`), so a from-scratch `db:migrate`
      reproduces it, but the current dev DB got those columns and tables by hand
      and its `__drizzle_migrations` table doesn't record `0002` / `0003`. Insert
      their hashes (or rebuild dev) before migrating there. Low priority: dev is
      disposable.

## Optional / nice-to-have

- [ ] Real text-to-image (needs an API key) so seeded avatars and post images
      match their `imageHint`s, instead of generated avatars and stand-in
      placeholders.
- [ ] Better search. `search` matches with `ilike` substrings; a Postgres
      `tsvector` index would rank by relevance and scale past a small campaign.
- [ ] Posts-and-replies on a profile. The feeds hide replies (`isNull(reply_to)`)
      so a persona's replies only show inside a thread. Add a "Replies" tab on
      the profile.
- [ ] Modal a11y polish. The Edit profile / Change password / Compose dialogs are
      hand-rolled divs; add a focus trap and Esc-to-close, and move focus to the
      dialog on open and back to the trigger on close.
- [ ] Composer draft autosave (local) so a half-written post survives a reload.

## Ideas (unscoped)

- [ ] Direct messages between personas (in-world, table-visible to the DM).
- [ ] Emoji reactions beyond like / boost.
- [ ] Mute / block a persona from your own feed.
- [ ] In-world flavor: a per-campaign "lore" / rules page the DM pins, and
      optional in-character "language" tags on posts (Common, Elvish, ...).
- [ ] DM session tooling: an auto-generated session-recap post. The scheduling
      queue and the campaign API both exist now to build it on.
- [ ] Hashtag pages and following a hashtag (trending already computes them).
- [ ] A quote-post affordance in the UI (`repostOfPostId` already supports quotes;
      just surface a "quote" action and a compose box).
