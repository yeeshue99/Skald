# Backlog

Future work for Skald. Shipped items live in CHANGELOG.md. Roughly ordered by
how grounded each item is: in-progress first, then concrete gaps, then ideas.

## In progress (finish these)

- [ ] Search. There's scaffolding (`src/app/actions/search.ts`,
      `src/app/c/[slug]/search/`, `SearchBar`, `SearchPosts`) and nav links, plus
      `#hashtag` text linking to `/search?q=#tag`. Finish: wire the action to the
      search UI, handle empty/no-results, paginate, and decide person vs post vs
      hashtag scoping.
- [ ] Trending topics. `TrendingTopics` component exists; needs the query
      (most-used hashtags in a window) and placement (right rail), and hashtag
      result pages.

## Accounts and membership

- [ ] DM "reset member password" in the members list, for when a player forgets
      the temporary password the DM set.
- [ ] Forgot-password / recovery flow (there's no email, so likely a DM-mediated
      reset or a one-time code).
- [ ] "Sign out everywhere" on password change (revoke the user's other sessions;
      currently the change takes effect at next sign-in and existing sessions stay
      valid).

## Seeding

- [ ] Turn seed `imageHint`s into real images via an image generator and attach
      them as `avatarUrl` / post `imageUrl` (currently text-only, not stored).
- [ ] Document the worldbuilder prompt -> JSON -> `pnpm seed:petalfall` pipeline
      in the README so it's reusable for new campaigns.

## Tech debt

- [ ] Canonicalize Tailwind arbitrary classes flagged by lint
      (`min-w-[6rem]` -> `min-w-24`, `max-h-[28rem]` -> `max-h-112`,
      `break-words` -> `wrap-break-word`).
- [ ] Resolve the pre-existing react-hooks lint errors (setState-in-effect in
      `EditPersonaButton` / `LocalTime`, ref-write-during-render in `FeedList`).
- [ ] Remove dead keyframes left in `globals.css` from earlier iterations.

## Ideas (unscoped)

- [ ] Notifications: likes, replies, follows, and @mentions for your personas.
- [ ] Bookmarks / saved posts.
- [ ] Post editing and a proper delete-with-undo.
- [ ] Pinned post on a profile.
- [ ] Per-campaign onboarding for a brand-new player (pick/confirm their
      character on first sign-in instead of the DM presetting it).
