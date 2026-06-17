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
- [ ] More upload-backed decoration dimensions. A `DecorationSpec` overrides all
      named dimensions today, but the only *uploaded* asset is the backdrop image
      (`spec.backdrop`). Natural next custom assets: a divider image, an
      avatar-frame overlay, a card-frame border. Each needs a field on the spec, a
      `campaignRenderProps` branch emitting its vars/attrs, and a CSS hook
      (mirroring the `[data-texture="custom"]` rule), plus an editor control.
- [ ] Live preview of the backdrop + named texture. The Appearance editor preview
      shows named dimensions (divider/frame/depth/wordmark/...) and a custom
      backdrop, but the fixed `::before` texture layer can't render inside a
      contained box, so named *textures* and backdrop motion aren't previewed
      (same limitation as the DM theme editor). A contained texture renderer would
      fix both.
- [ ] Preview fidelity on a themed campaign (nested `[data-campaign]`). The
      preview wrapper is nested inside the layout's own `[data-campaign]`, and the
      value-keyed decoration rules use identical selector text, so on a campaign
      whose theme is NON-default the attribute-driven dimensions (divider,
      wordmark, avatar frame, card frame, chrome) can tie at equal specificity and
      the page's value wins by stylesheet order instead of the draft's. Inline-var
      dims (depth, buttons) and the backdrop always reflect the draft. The clean
      fix is to isolate the preview from the outer `[data-campaign]` — render it in
      an iframe (its own document, stylesheets cloned by element, not by reading
      cross-origin `.cssRules`) or portal it outside the layout wrapper. Marker-
      class specificity bumps are NOT viable: the rule bodies are large SVG
      backgrounds, so ~25 of them would have to be duplicated.
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
