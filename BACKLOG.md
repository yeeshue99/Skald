# Backlog

Future work for Skald. Shipped items live in CHANGELOG.md. Roughly ordered by
how grounded each item is: concrete gaps first, then ideas.

## Concrete gaps

- [ ] Regenerate Drizzle migrations. `avatar_frame`, `banner_url`, `edited_at`,
      `pinned_post_id`, and the `bookmarks` table are in `schema.ts` but were
      applied to dev by hand (direct `ALTER` / `CREATE`, since drizzle-kit hangs
      on the Neon connection here); only `0000` / `0001` exist. Run `db:generate`
      in a clean env so a fresh `db:migrate` reproduces the schema before
      deploying from scratch.

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
