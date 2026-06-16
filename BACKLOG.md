# Backlog

Future work for Skald. Shipped items live in CHANGELOG.md. Roughly ordered by
how grounded each item is: concrete gaps first, then ideas.

## Concrete gaps

- [ ] No tests and no CI. `package.json` has `lint` and `typecheck` but no
      `test` script, there's no vitest or playwright config, no `*.test.ts` under
      `src`, and no `.github/workflows`. Everything ships verified by hand. Add a
      test runner plus a CI workflow that runs `typecheck`, `lint`, and `build`
      on every push, and a starter suite over the highest-risk pure logic: the
      feed `visibleCondition` + keyset `encodeCursor`/`decodeCursor`, `getThread`
      self-thread chaining, `notify` self/dedup skips, and the compose / persona
      Zod schemas.
- [ ] No rate limiting on write paths. Nothing throttles requests anywhere. The
      campaign API (`POST /api/c/<slug>/posts`, bearer key), login, and register
      are all unbounded, so a leaked key or credential stuffing has no brake. Add
      a small per-key and per-IP limiter (in-memory is enough for a single
      instance; Upstash or similar if it ever scales out).
- [ ] Orphaned blobs are never cleaned up. `api/upload` only `put`s to Vercel
      Blob; nothing `del`s the old blob when an avatar, banner, or post image is
      replaced, or when its post or persona is deleted, so storage leaks over
      time. Track the blob URLs and delete on replace / delete, or run a sweep.
- [ ] Notifications have no pagination and no retention. `getNotifications` takes
      a fixed `limit = 50` with no cursor, so older notifications are
      unreachable, and the table is never pruned, so it grows without bound. Add
      keyset pagination like the feed, plus a retention cap (or prune-read).
- [ ] `getThread` issues a query per hop. The ancestor walk and the self-thread
      continuation each run one `SELECT` per level with sequential awaits, so a
      long thread is many round-trips. Replace with a recursive CTE or a single
      bounded fetch assembled in memory.
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
- [ ] @mention autocomplete in the composer. Handles already resolve server-side
      for notifications; surface a client-side picker as you type `@`.
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
