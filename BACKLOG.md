# Backlog

Future work for Skald. Shipped items live in CHANGELOG.md. Roughly ordered by
how grounded each item is: concrete gaps first, then ideas.

## Concrete gaps

- [ ] Reconcile the migration chain with the live schema. The `0003` snapshot
      predates the `campaign_api_keys` table (which has no migration of its own)
      and a `personas` index rename (`personas_one_pc_per_user_idx` ->
      `personas_owner_idx`), so `drizzle-kit generate` keeps wanting to emit them.
      `0004` (the search vector) was hand-authored to avoid folding that drift in,
      and the integration harness sidesteps it by pushing `schema.ts` directly,
      but a clean migration that captures the API-keys table and the index rename
      is still owed. Surfaced while adding full-text search.

## Optional / nice-to-have

- [ ] Paginate the Quotes view. `/c/<slug>/post/<id>/quotes` renders only the
      first page (25). `getQuotesOf` already returns a cursor, so wiring
      load-more / the live feed needs a `"quotes"` feed type in
      `src/app/actions/feed.ts` and `FeedList`.
- [ ] Autosave quote drafts too. The composer draft autosave covers the main
      `Composer`; `QuoteComposer` is a separate single-textarea form that could
      reuse `src/lib/composer-draft.ts` for the same restore-on-reload behavior.
- [ ] Trim `search_vector` from feed payloads. `RawPost` now includes the
      generated `tsvector`, so every `db.select().from(posts)` feed query pulls it
      over the wire. `hydrate` ignores it (correctness is fine) but selecting
      explicit columns would save the bytes. Only `campaign-export` was trimmed.
- [ ] Parent context on reply cards. The profile Replies tab renders bare reply
      cards (no "Replying to @x" line). `PostView` carries only `replyToPostId`;
      surfacing the parent author would touch hydration and `PostCard`.
- [ ] Reuse a decoration across campaigns. A decoration is scoped to the campaign
      it was made in (`decorations.campaign_id`). A user-level library plus a
      per-membership selection would let one upload be worn in several campaigns.
      The selection already lives on `memberships`, so only the authored-pack
      scope would change.
- [ ] Public, anonymous viewing of campaigns. Let a campaign expose a read-only
      view that doesn't require sign-in or membership: an unauthenticated visitor
      could browse the feed, posts, and profiles. Needs a per-campaign visibility
      flag (public vs members-only), gating in the campaign/feed loaders to allow
      anonymous reads when public, hiding compose/interaction affordances for
      anonymous visitors, and a deliberate call on what stays private (DM tools,
      member-only content, drafts).
- [ ] Add the `0005`/`0006` decoration snapshots to `drizzle/meta`. Their
      migration SQL + journal entries were hand-authored (consistent with `0004`),
      but no `meta/000{5,6}_snapshot.json` were written, so `drizzle-kit generate`
      still diffs against the `0004` snapshot. Folds into the migration-chain
      reconciliation item above.
