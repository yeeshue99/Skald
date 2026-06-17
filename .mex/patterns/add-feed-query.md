---
name: add-feed-query
description: Add a feed/profile/search read that returns posts. Use when building any list of posts (a new tab, view, or filter).
triggers:
  - "feed query"
  - "list posts"
  - "new feed type"
  - "hydrate"
  - "PostView"
edges:
  - target: context/conventions.md
    condition: for the read + hydrate pattern and verify checklist
  - target: context/architecture.md
    condition: for where reads sit in the flow
last_updated: 2026-06-16
---

# Add a feed query

## Context

All post reads live in `src/lib/queries.ts`. They select `RawPost` rows, apply the shared visibility predicate and keyset cursor pagination, then `hydrate()` into `PostView` (author, counts, viewer state, poll, nested quote). Components consume `PostView[]`, never raw rows. Reuse the existing helpers; don't hand-roll a parallel read.

## Steps

1. Add a query function in `src/lib/queries.ts`. Filter by `campaignId` and the shared visibility condition (`deletedAt IS NULL AND publishedAt <= now()`).
2. For pagination, accept a cursor and use the keyset helpers (`encodeCursor` / `decodeCursor`, keyset-before on `(publishedAt, id)`). Do not use `OFFSET`.
3. Run the rows through `hydrate(rows, viewerPersonaId, campaignId)` so the view carries author/counts/viewer state.
4. Call it from a server page under `src/app/c/[slug]/`, pass `PostView[]` props into the client list component (e.g. `FeedList`).
5. For a new live/paginated tab, add the feed type in `src/app/actions/feed.ts` and the `FeedList` switch (this is exactly what the backlog "Paginate the Quotes view" item needs).

## Gotchas

- `RawPost` now includes the generated `search_vector` tsvector, so `db.select().from(posts)` pulls it over the wire. `hydrate` ignores it (correct), but select explicit columns if bytes matter.
- Feeds list only thread roots; replies are hidden in feeds and expanded via `getThread`. Don't reinvent reply visibility per query.
- Quote embeds are a nested `PostView` on the row; let `hydrate` build them rather than fetching the quoted post separately.

## Verify

- [ ] Query filters by `campaignId` and the visibility predicate.
- [ ] Pagination is keyset (cursor), not offset.
- [ ] Returns `PostView[]` via `hydrate`; the component never queries the DB.
- [ ] `pnpm test:integration` covers the new read if it's non-trivial.

## Debug

- Soft-deleted or future posts showing up: the visibility predicate is missing.
- Wrong like/bookmark state: `viewerPersonaId` not threaded into `hydrate`.

## Update Scaffold

- [ ] Update `.mex/BACKLOG.md` if this closed a backlog read (e.g. quotes pagination).
- [ ] Update `.mex/patterns/INDEX.md` if a new task type emerged.
