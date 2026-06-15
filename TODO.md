# TODO

## Theme styling beyond color swaps

Goal: themes today are only color + font + radius + mode + name/tagline. Add
decorative, per-theme styling so STR/X, Scrollr, and HOLONET// each feel
distinct, not just recolored.

### How the theme system works (for whoever implements this)

- `Theme` shape: `src/lib/theme-types.ts`
- Presets + `themeToCssVars()`: `src/lib/themes.ts`
- CSS var -> Tailwind token mapping: `src/app/globals.css`
- DM editor: `src/components/forms/ThemeEditorForm.tsx`
- Theme is stored as `jsonb` on the `campaigns` row, so new fields need NO DB
  migration. Default-fill missing fields when reading so existing campaigns keep
  working.

Each option below is the same pattern: add an optional `Theme` field, emit a new
CSS var in `themeToCssVars()`, add the component/global CSS, add one control to
the editor. Everything stays runtime-swappable (no rebuild).

Preset flavors to design against: STR/X = gothic arcane academia, Scrollr =
medieval parchment, HOLONET// = sci-fi cyberpunk.

### Open decisions (settled)

- [x] Preset-locked vs. DM-editable. Chosen: each dimension is a named style the
      DM picks from a dropdown, with presets pre-set to their flavor.
- [x] Scope: built iteratively across all themes (not theme-by-theme).

### Recommended phasing

- Phase 1 (most impact, least risk, mostly CSS-var driven): options 1, 3, 4, 6, 7.
  DONE (refined in a v2 pass; also fixed two save bugs: partial-decorations
  rejected by the schema, and a React 19 form-reset that visually reverted edits).
- Phase 2 (delight tier): options 5, 10. DONE.
- Phase 3 (more component work): options 2, 8, 9. DONE.

### The 10 options

- [x] 1. Background texture layer. Fixed backdrop behind the feed.
  - STR/X: faint star-chart / constellation lines with a slow violet glow
  - Scrollr: aged parchment grain with a subtle fleur-de-lis tile
  - HOLONET//: scanlines over a dim hex / circuit grid
  - Impl: one fixed pseudo-element, CSS gradients or tiny inline SVG, opacity
    token. Low effort, high impact.

- [x] 2. Card frame treatment. Scoped to STANDALONE cards (`.ui-card` panels +
      `.quote-card` embeds), NOT feed posts — per-post boxes compete with the
      divider ornament and the depth note, and were previously disliked.
  - STR/X: thin gilded double-rule with corner filigree brackets (`gilded`)
  - Scrollr: warm paper edge with a layered torn-sheet dashed outline (`deckled`)
  - HOLONET//: chamfered notched corners with an inner cyan edge glow (`chamfer`)
  - Impl: `clip-path` + box-shadow + corner pseudo-element, keyed by data-card-frame.

- [x] 3. Section dividers between posts. The separator line becomes an ornament.
  - STR/X: a centered asterism (three small stars)
  - Scrollr: a rule with a central diamond or leaf
  - HOLONET//: a dashed data-line with tick end-caps
  - Impl: divider component or `::after`. Low effort.

- [x] 4. Button and interaction effects. Hover/press beyond a color shift.
  - STR/X: soft arcane glow that blooms on hover
  - Scrollr: embossed / pressed-wax look, slight ink bleed
  - HOLONET//: neon glow, uppercase tracking, quick glitch flicker
  - Impl: `box-shadow` / `text-transform` / transitions keyed by a token. Low effort.

- [x] 5. Reaction flourishes (like / boost). Themed animation on tap.
  - STR/X: the heart bursts into tiny sparkles
  - Scrollr: a wax-seal stamp thunk
  - HOLONET//: an energy pulse ring
  - Impl: keyframes variant on the action buttons; optionally swap the icon.
    Medium effort, high delight.

- [x] 6. Avatar frames. A themed ring around avatars (`src/components/Avatar.tsx`).
  - STR/X: a glowing mana halo
  - Scrollr: a coin / medallion bezel
  - HOLONET//: a HUD targeting-bracket ring
  - Impl: a ring variant. Low effort.

- [x] 7. Depth language (shadow + glow). Consistent elevation for cards, menus,
      composer.
  - STR/X: soft violet ambient shadow with a faint inner glow
  - Scrollr: warm matte paper shadow, no glow
  - HOLONET//: hard cyan edge-glow / bloom
  - Impl: `--shadow-card` / `--glow` tokens. Low effort.

- [x] 8. Wordmark embellishment. Dress up the app name in the header.
  - STR/X: a small arcane 4-point star sigil before the name (`sigil`)
  - Scrollr: an enlarged, accent-tinted illuminated drop-cap initial (`dropcap`)
  - HOLONET//: a glowing blinking terminal caret after the name (`caret`)
  - Impl: `.wordmark` ::before/::first-letter/::after keyed by data-wordmark.

- [x] 9. Top-bar / chrome treatment. The sticky header bars (`.chrome-bar`:
      desktop PageHeader + mobile wordmark bar) get personality.
  - STR/X: a stained-glass gradient wash + glowing gradient underline (`stainedGlass`)
  - Scrollr: a warm wash + scalloped pennant bottom edge (`banner`)
  - HOLONET//: a HUD strip with tick marks + an animated signal-meter sweep (`hudStrip`)
  - Impl: header background + ::after edge, keyed by data-chrome.

- [x] 10. Ambient motion (opt-in). Subtle background life, gated by
      `prefers-reduced-motion` and a per-theme toggle, off by default.
  - STR/X: slowly drifting motes / embers
  - Scrollr: occasional floating dust, gentle page-curl on card hover
  - HOLONET//: a periodic scanline sweep and blinking status dots
  - Impl: CSS animations on the texture layer. Medium effort.
