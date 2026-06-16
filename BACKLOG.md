# Backlog

Future work for Skald. Shipped items live in CHANGELOG.md. Roughly ordered by
how grounded each item is: concrete gaps first, then ideas.

## Concrete gaps

- [ ] Mark migrations applied on the existing dev DB. The schema is now fully
      captured by migrations (`0000`-`0003`), so a from-scratch `db:migrate`
      reproduces it. But the current dev DB got those columns/tables by hand and
      its `__drizzle_migrations` table doesn't record `0002` / `0003`, so running
      `db:migrate` against dev would error on "already exists". Insert their
      hashes (or rebuild dev) before migrating there. Low priority: dev is
      disposable.

## Optional / nice-to-have

- [ ] Real text-to-image (needs an API key) so seeded avatars and post images
      match their `imageHint`s, instead of generated avatars + stand-in
      placeholders.

## Ideas (unscoped)

- [ ] Direct messages between personas (in-world, table-visible to the DM).
- [ ] Emoji reactions beyond like / boost.
- [ ] Mute / block a persona from your own feed.
- [ ] In-world flavor: a per-campaign "lore" / rules page the DM pins, and
      optional in-character "language" tags on posts (Common, Elvish, ...).
- [ ] DM session tooling: an auto-generated session-recap post (scheduled posts
      and a publish queue already exist to build on).
- [ ] Export a campaign's feed (JSON) for backup or moving between deployments.
