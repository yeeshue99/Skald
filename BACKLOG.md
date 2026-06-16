# Backlog

Future work for Skald. Shipped items live in CHANGELOG.md. Roughly ordered by
how grounded each item is: concrete gaps first, then ideas.

## Concrete gaps

- [ ] Mark migrations applied on the existing dev DB. The schema is fully
      captured by migrations (`0000`-`0003`), so a from-scratch `db:migrate`
      reproduces it, but the current dev DB got the `0002` / `0003` columns and
      tables by hand and its `__drizzle_migrations` table doesn't record them.
      Insert their hashes (or rebuild dev) before migrating there. Low priority:
      dev is disposable.

## Optional / nice-to-have

- [ ] Reposts and quotes share one count. `repostCount` counts every post that
      references a target via `repostOfPostId`, so a quote bumps the same number
      as a plain boost; only the viewer's "reposted" toggle tells them apart (it
      filters to empty-content boosts). Split the display into reposts vs quotes,
      or add a "Quotes" view that lists who quoted a post.
- [ ] Better search. `search` matches with `ilike` substrings (with a small
      regex / prefix score bump); a Postgres `tsvector` + GIN index would rank by
      relevance and scale past a small campaign.
- [ ] Posts-and-replies tab on a profile. The feeds hide replies
      (`isNull(reply_to)`), so a persona's replies only show inside a thread. Add
      a "Replies" tab on the profile.
- [ ] Modal a11y polish. The Edit profile / Change password / Compose dialogs are
      hand-rolled divs with no `role="dialog"` / `aria-modal`, no focus trap, and
      no Esc-to-close. Add those, move focus to the dialog on open, and restore it
      to the trigger on close.
- [ ] Global rate limiting. The write-path limiter is an in-memory fixed window,
      so it only throttles per process. Swap in Upstash / Redis (or similar) so
      the limit holds across instances once the app runs more than one.
- [ ] Real text-to-image (needs an API key) so seeded avatars and post images
      match their `imageHint`s, instead of generated avatars and stand-in
      placeholders.
- [ ] Composer draft autosave (local) so a half-written post survives a reload.

## Ideas (unscoped)

- [ ] Hashtag pages and following a hashtag. Trending already extracts them
      (`ilike(content, "%#%")`) and the search page lists them, but there's no
      page to click a tag and see its posts.
- [ ] Direct messages between personas (in-world, table-visible to the DM).
- [ ] Emoji reactions beyond like / boost.
- [ ] Mute / block a persona from your own feed.
- [ ] In-world flavor: a per-campaign "lore" / rules page the DM pins, and
      optional in-character "language" tags on posts (Common, Elvish, ...).
- [ ] DM session tooling: an auto-generated session-recap post. The scheduling
      queue and the campaign API both exist now to build it on.
