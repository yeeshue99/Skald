import type { CSSProperties } from "react";
import type {
  Theme,
  Decorations,
  DecorationSpec,
  DecorationFit,
  BackdropImage,
  ImageAsset,
  WordmarkAsset,
  CustomImageDim,
} from "./theme-types";
import {
  DECORATION_SIZE_MIN,
  DECORATION_SIZE_MAX,
  DECORATION_SIZE_DEFAULT,
  CUSTOM_IMAGE_DIMS,
  CUSTOM_IMAGE_SIZE,
  CUSTOM_IMAGE_OPACITY,
  WORDMARK_MODES,
} from "./theme-types";
import { DECORATION_VALUES, AMBIENT_EFFECT_VALUES } from "./decoration-options";

export type {
  Theme,
  ThemeColors,
  ThemeMode,
  Decorations,
  AmbientEffect,
  DecorationSpec,
  DecorationFit,
  BackdropImage,
  ImageAsset,
  WordmarkAsset,
  WordmarkMode,
  CustomImageDim,
} from "./theme-types";

// ---------------------------------------------------------------------------
// Fonts. We load a small bounded set of Google Fonts so any theme (preset or
// DM-customized) always has its faces available.
// ---------------------------------------------------------------------------
const FONT_STACKS: Record<string, string> = {
  Inter: '"Inter", system-ui, sans-serif',
  "Space Grotesk": '"Space Grotesk", system-ui, sans-serif',
  "IBM Plex Sans": '"IBM Plex Sans", system-ui, sans-serif',
  Rajdhani: '"Rajdhani", system-ui, sans-serif',
  Orbitron: '"Orbitron", "Space Grotesk", system-ui, sans-serif',
  "Cormorant Garamond": '"Cormorant Garamond", Georgia, serif',
  "EB Garamond": '"EB Garamond", Georgia, serif',
  Lora: '"Lora", Georgia, serif',
  "Playfair Display": '"Playfair Display", Georgia, serif',
  Cinzel: '"Cinzel", "Playfair Display", Georgia, serif',
};

export const AVAILABLE_FONTS = Object.keys(FONT_STACKS);

export function fontStack(name: string): string {
  return FONT_STACKS[name] ?? `"${name}", system-ui, sans-serif`;
}

// Single stylesheet that pulls every selectable family.
export const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "Inter:wght@400;500;600;700",
    "Space+Grotesk:wght@400;500;600;700",
    "IBM+Plex+Sans:wght@400;500;600;700",
    "Rajdhani:wght@400;500;600;700",
    "Orbitron:wght@500;700;800;900",
    "Cormorant+Garamond:wght@500;600;700",
    "EB+Garamond:wght@400;500;600;700",
    "Lora:wght@400;500;600;700",
    "Playfair+Display:wght@500;600;700;800",
    "Cinzel:wght@500;600;700",
  ]
    .map((f) => "family=" + f)
    .join("&") +
  "&display=swap";

// ---------------------------------------------------------------------------
// Phase 1 decorations. DEFAULT_DECORATIONS is the understated fallback source
// used by normalizeTheme to fill any missing keys, so a legacy row with no
// (or partial) decorations renders with the current plain appearance.
// ---------------------------------------------------------------------------
export const DEFAULT_DECORATIONS: Decorations = {
  texture: "none",
  bgScroll: "static",
  divider: "plain",
  buttons: "flat",
  avatarFrame: "none",
  depth: "flat",
  reactions: "none",
  cardFrame: "plain",
  wordmark: "plain",
  chrome: "plain",
  effects: [],
};

// ---------------------------------------------------------------------------
// Presets. The four flavored ones came from independent design passes; the
// neutral "Skald" default is used on signed-out pages and as the starting
// point for a new campaign.
// ---------------------------------------------------------------------------
export const DEFAULT_THEME: Theme = {
  id: "default",
  appName: "Skald",
  tagline: "A social feed for your table.",
  mode: "dark",
  fonts: { display: "Space Grotesk", body: "Inter" },
  radius: "1rem",
  colors: {
    background: "#0B0E14",
    surface: "#151A23",
    surfaceHover: "#1D2430",
    border: "#232B38",
    text: "#E7ECF3",
    textMuted: "#93A1B5",
    primary: "#2F6FED",
    primaryHover: "#2560D8",
    onPrimary: "#FFFFFF",
    accent: "#8B5CF6",
    like: "#F4467F",
    repost: "#22C55E",
    link: "#5EA0F2",
  },
  decorations: DEFAULT_DECORATIONS,
};

export const STRIX_THEME: Theme = {
  id: "strix",
  appName: "STR/X",
  tagline: "Where the five colleges share one feed.",
  mode: "dark",
  fonts: { display: "Cormorant Garamond", body: "Inter" },
  radius: "0.875rem",
  colors: {
    background: "#0E0B1A",
    surface: "#171327",
    surfaceHover: "#211B38",
    border: "#2A2342",
    text: "#ECE8F7",
    textMuted: "#A89FC7",
    primary: "#9D7BFF",
    primaryHover: "#B399FF",
    onPrimary: "#120A24",
    accent: "#5BE0C8",
    like: "#FF6B9D",
    repost: "#5BE0C8",
    link: "#6FB7FF",
  },
  decorations: {
    texture: "constellations",
    bgScroll: "down",
    divider: "asterism",
    buttons: "arcaneGlow",
    avatarFrame: "manaHalo",
    depth: "violetAmbient",
    reactions: "sparkle",
    cardFrame: "gilded",
    wordmark: "sigil",
    chrome: "stainedGlass",
    effects: ["motes", "embers"],
  },
};

export const SCROLLR_THEME: Theme = {
  id: "scrollr",
  appName: "Scrollr",
  tagline: "Post your proclamations to the realm.",
  mode: "light",
  fonts: { display: "Cormorant Garamond", body: "EB Garamond" },
  radius: "0.375rem",
  colors: {
    background: "#F4E9D2",
    surface: "#FBF3E1",
    surfaceHover: "#F2E4C6",
    border: "#D8C3A0",
    text: "#2B2118",
    textMuted: "#6B5A42",
    primary: "#9B2D26",
    primaryHover: "#7E2018",
    onPrimary: "#FBF3E1",
    // deepened gold so accent text (e.g. the NPC badge) clears WCAG AA (4.5:1)
    // on the light parchment field; #A8791C was 3.22:1
    accent: "#8A6210",
    like: "#B5232B",
    repost: "#3F6B3A",
    link: "#7A3E12",
  },
  decorations: {
    texture: "parchment",
    bgScroll: "static",
    divider: "diamond",
    buttons: "wax",
    avatarFrame: "medallion",
    depth: "paperMatte",
    reactions: "stamp",
    cardFrame: "deckled",
    wordmark: "dropcap",
    chrome: "banner",
    effects: ["dust", "pagecurl"],
  },
};

export const BLOOMR_THEME: Theme = {
  id: "bloomr",
  appName: "Bloomr",
  tagline: "Every bloom has its tale.",
  mode: "light",
  fonts: { display: "Cinzel", body: "EB Garamond" },
  radius: "0.5rem",
  colors: {
    // An illuminated herbal: vellum tinted green, with damask rose, marigold
    // gold and violet picked out against a leaf-green garden field.
    background: "#EEF1DE",
    surface: "#F8F6E8",
    surfaceHover: "#E6EBD0",
    border: "#C3CBA2",
    text: "#25301B",
    textMuted: "#5F6B45",
    primary: "#A8336A",
    primaryHover: "#8C2957",
    onPrimary: "#FBF7EE",
    // deepened gold + green so accent (NPC badge) and repost (success text /
    // boost counts) clear WCAG AA on the pale green field; were 2.26 / 4.28
    accent: "#806010",
    like: "#BE3B5E",
    repost: "#477035",
    link: "#7A5AA8",
  },
  decorations: {
    texture: "florets",
    bgScroll: "sway",
    divider: "vine",
    buttons: "petal",
    avatarFrame: "wreath",
    // paperMatte over a colored glow: tinted blooms read poorly on light parchment.
    depth: "paperMatte",
    reactions: "bloom",
    cardFrame: "botanical",
    wordmark: "sprig",
    chrome: "garland",
    effects: ["petalfall", "pollen"],
  },
};

export const HOLONET_THEME: Theme = {
  id: "holonet",
  appName: "HOLONET//",
  tagline: "The galaxy is talking. Tune in.",
  mode: "dark",
  fonts: { display: "Orbitron", body: "Rajdhani" },
  radius: "0.5rem",
  colors: {
    background: "#070A12",
    surface: "#0E1320",
    surfaceHover: "#151C2D",
    border: "#1C2638",
    text: "#E6ECF7",
    textMuted: "#8A97B0",
    primary: "#22D3EE",
    primaryHover: "#67E8F9",
    onPrimary: "#03121A",
    accent: "#F0529C",
    like: "#FF4D8D",
    repost: "#3DF5A6",
    link: "#5BE8FF",
  },
  decorations: {
    texture: "circuit",
    bgScroll: "down",
    divider: "dataline",
    buttons: "neon",
    avatarFrame: "hudBracket",
    depth: "cyanBloom",
    reactions: "pulse",
    cardFrame: "chamfer",
    wordmark: "caret",
    chrome: "hudStrip",
    effects: ["scanlines"],
  },
};

export const PRESETS: Theme[] = [
  DEFAULT_THEME,
  STRIX_THEME,
  SCROLLR_THEME,
  BLOOMR_THEME,
  HOLONET_THEME,
];

export function getPreset(id: string): Theme {
  return PRESETS.find((p) => p.id === id) ?? DEFAULT_THEME;
}

// ---------------------------------------------------------------------------
// Normalize. Returns a shallow copy with `decorations` guaranteed present.
// Missing OR partially-present decorations are filled per-key from
// DEFAULT_DECORATIONS, so a row with `{ texture: "starchart" }` still gets the
// other four keys. Pure: never mutates the input.
// ---------------------------------------------------------------------------
const AVATAR_FRAMES: Decorations["avatarFrame"][] = [
  "none",
  "manaHalo",
  "medallion",
  "hudBracket",
  "wreath",
  "blossom",
];

export function normalizeTheme(theme: Theme): Theme {
  const decorations = { ...DEFAULT_DECORATIONS, ...(theme.decorations ?? {}) };
  // Coerce retired frame values (e.g. an old "laurel"/"bookstack") to "none".
  if (!AVATAR_FRAMES.includes(decorations.avatarFrame)) {
    decorations.avatarFrame = "none";
  }
  return { ...theme, decorations };
}

// ---------------------------------------------------------------------------
// Data attributes for the campaign wrapper. Normalizes internally then returns
// a plain data-* map (kebab-case keys) so callers can spread it directly onto a
// JSX element. The CSS in globals.css scopes every decoration rule under these.
// ---------------------------------------------------------------------------
export function themeDataAttrs(theme: Theme): Record<string, string> {
  const d = normalizeTheme(theme).decorations!;
  return {
    "data-texture": d.texture,
    "data-divider": d.divider,
    "data-buttons": d.buttons,
    "data-avatar-frame": d.avatarFrame,
    "data-depth": d.depth,
    "data-reactions": d.reactions,
    "data-card-frame": d.cardFrame,
    "data-wordmark": d.wordmark,
    "data-chrome": d.chrome,
    // static => omit so no scroll animation matches; else the direction.
    ...(d.bgScroll !== "static" ? { "data-bg-scroll": d.bgScroll } : {}),
    "data-campaign": "true",
  };
}

// ---------------------------------------------------------------------------
// Apply a theme by emitting CSS custom properties. Because they reference the
// raw vars, a per-campaign <div style={themeToCssVars(theme)}> re-skins every
// child at runtime with no rebuild. Normalizes internally so legacy rows still
// get the decoration-driven vars (resolving to the plain/flat look).
// ---------------------------------------------------------------------------
export function themeToCssVars(theme: Theme): CSSProperties {
  const t = normalizeTheme(theme);
  const c = t.colors;
  const d = t.decorations!;

  // depth => card shadow + glow language
  // Kept in sync with the [data-depth] blocks in globals.css. These inline vars
  // win over the CSS fallback at render time, so they carry the stronger v2
  // values; the CSS restates them for any legacy row that predates the var.
  // Depth glow colors are EXPLICIT so the option name matches what's rendered
  // (e.g. "Cyan bloom" is cyan on every theme, not the theme's primary). Using
  // var(--accent)/var(--primary) made the color depend on the palette, so on
  // STR/X (accent=teal, primary=violet) the violet/cyan options came out swapped.
  const VIOLET = "#8b5cf6";
  const CYAN = "#22d3ee";
  // Garden hues for the flora depth options: a leaf green ambient and a damask
  // rose bloom. Explicit hexes (like VIOLET/CYAN) so the option name matches the
  // rendered glow on every palette, not the per-theme primary/accent.
  const LEAF = "#4e7c3a";
  const ROSE = "#b23a6e";
  const DEPTH_SHADOW: Record<Decorations["depth"], string> = {
    flat: "none",
    violetAmbient: `0 10px 30px -12px color-mix(in srgb,${VIOLET} 60%,transparent), 0 3px 10px color-mix(in srgb,#000 50%,transparent), 0 0 0 1px color-mix(in srgb,${VIOLET} 24%,transparent)`,
    // paperMatte must read on BOTH light (warm-ish dark drop) and dark (white
    // top-inset + faint rim, since a dark shadow is invisible on a dark bg).
    paperMatte:
      "0 2px 6px color-mix(in srgb,#000 22%,transparent), 0 12px 24px -10px color-mix(in srgb,#000 26%,transparent), inset 0 1px 0 color-mix(in srgb,#fff 9%,transparent), 0 0 0 1px color-mix(in srgb,#fff 8%,transparent)",
    cyanBloom: `0 0 0 1px color-mix(in srgb,${CYAN} 42%,transparent), 0 4px 14px -4px color-mix(in srgb,#000 55%,transparent), 0 0 22px -2px color-mix(in srgb,${CYAN} 48%,transparent)`,
    verdantAmbient: `0 10px 30px -12px color-mix(in srgb,${LEAF} 60%,transparent), 0 3px 10px color-mix(in srgb,#000 50%,transparent), 0 0 0 1px color-mix(in srgb,${LEAF} 24%,transparent)`,
    roseGlow: `0 0 0 1px color-mix(in srgb,${ROSE} 42%,transparent), 0 4px 14px -4px color-mix(in srgb,#000 45%,transparent), 0 0 22px -2px color-mix(in srgb,${ROSE} 44%,transparent)`,
  };
  const DEPTH_GLOW: Record<Decorations["depth"], string> = {
    flat: "none",
    violetAmbient: `inset 0 0 30px color-mix(in srgb,${VIOLET} 22%,transparent)`,
    paperMatte: "none",
    cyanBloom: `0 0 30px -6px color-mix(in srgb,${CYAN} 55%,transparent)`,
    verdantAmbient: `inset 0 0 30px color-mix(in srgb,${LEAF} 22%,transparent)`,
    roseGlow: `0 0 30px -6px color-mix(in srgb,${ROSE} 50%,transparent)`,
  };

  // buttons => interaction glow
  // A bare COLOR (not a full shadow fragment): every consumer in globals.css
  // supplies its own offset/blur and uses this only for the glow hue, e.g.
  // `box-shadow: 0 0 18px var(--btn-glow)`. Emitting a fragment here would make
  // those declarations invalid (too many lengths) and silently drop the glow.
  const BTN_GLOW: Record<Decorations["buttons"], string> = {
    flat: "transparent",
    arcaneGlow: "color-mix(in srgb,var(--accent) 50%,transparent)",
    wax: "transparent",
    neon: "color-mix(in srgb,var(--primary) 70%,transparent)",
    petal: "color-mix(in srgb,var(--accent) 55%,transparent)",
    dew: "color-mix(in srgb,var(--primary) 55%,transparent)",
  };

  // avatarFrame => ring spec consumed by .avatar-frame
  // Kept in sync with the resting box-shadow rings under [data-avatar-frame]
  // in globals.css (which are authoritative for rendering). This keeps
  // --frame-ring consistent for any consumer that reads it directly.
  const FRAME_RING: Record<Decorations["avatarFrame"], string> = {
    none: "none",
    manaHalo:
      "0 0 0 2px color-mix(in srgb,var(--accent) 85%,transparent), 0 0 14px 1px color-mix(in srgb,var(--accent) 60%,transparent), 0 0 22px 2px color-mix(in srgb,var(--primary) 35%,transparent)",
    medallion:
      "0 0 0 2px #c8a33a, 0 0 0 4px #6e551f, 0 0 0 5px color-mix(in srgb,#2b2118 55%,transparent)",
    hudBracket:
      "0 0 0 1px color-mix(in srgb,var(--primary) 70%,transparent), 0 0 8px -1px color-mix(in srgb,var(--primary) 55%,transparent)",
    // wreath: a green laurel rim over a dark gold band, struck like a coin.
    wreath:
      "0 0 0 2px color-mix(in srgb,var(--repost) 80%,#2b3a1e), 0 0 0 4px #6e551f, 0 0 0 5px color-mix(in srgb,#2b2118 45%,transparent)",
    // blossom: a soft petal halo (accent ring + accent/primary outer bloom).
    blossom:
      "0 0 0 2px color-mix(in srgb,var(--accent) 80%,transparent), 0 0 10px 1px color-mix(in srgb,var(--accent) 45%,transparent), 0 0 16px 2px color-mix(in srgb,var(--primary) 28%,transparent)",
  };

  // backdrop opacity, per texture. The v1 dark value (0.06) was effectively
  // invisible on #0E0B1A / #070A12; the dark fields now carry near-opaque
  // star/trace colors so a higher dial reads as atmospheric, not loud. Light
  // parchment nudges up slightly for the added aged-edge vignette.
  const TEXTURE_OPACITY: Record<Decorations["texture"], string> = {
    none: "0",
    parchment: "0.14",
    starchart: "0.22",
    circuit: "0.2",
    constellations: "0.3",
    squiggle: "0.18",
    florets: "0.16",
    vinework: "0.15",
  };
  const textureOpacity = TEXTURE_OPACITY[d.texture];

  return {
    "--bg": c.background,
    "--surface": c.surface,
    "--surface-hover": c.surfaceHover,
    "--border": c.border,
    "--text": c.text,
    "--muted": c.textMuted,
    "--primary": c.primary,
    "--primary-hover": c.primaryHover,
    "--on-primary": c.onPrimary,
    "--accent": c.accent,
    "--like": c.like,
    "--repost": c.repost,
    "--link": c.link,
    "--radius": t.radius,
    "--font-display": fontStack(t.fonts.display),
    "--font-body": fontStack(t.fonts.body),
    "--shadow-card": DEPTH_SHADOW[d.depth],
    "--glow": DEPTH_GLOW[d.depth],
    "--btn-glow": BTN_GLOW[d.buttons],
    "--frame-ring": FRAME_RING[d.avatarFrame],
    "--texture-opacity": textureOpacity,
    colorScheme: t.mode,
  } as CSSProperties;
}

// ---------------------------------------------------------------------------
// Decoration mods. A viewer's active decoration (their personal pick, else the
// campaign default) is layered over the campaign theme at render time (in the
// campaign layout), for that viewer's request only — so "all others default to
// the world default" needs no extra work: a viewer with no active mod just gets
// the campaign theme unchanged. A mod overrides any subset of the named
// dimensions (merged into the theme so the existing CSS machinery covers them)
// and may supply a custom uploaded backdrop image.
// ---------------------------------------------------------------------------

/** Clamp a custom backdrop image into its valid ranges. Pure. */
export function normalizeBackdrop(b: BackdropImage): BackdropImage {
  const fit: DecorationFit = b.fit === "cover" ? "cover" : "tile";
  const rawSize = Math.round(Number(b.size));
  const size = Number.isFinite(rawSize)
    ? Math.min(DECORATION_SIZE_MAX, Math.max(DECORATION_SIZE_MIN, rawSize))
    : DECORATION_SIZE_DEFAULT;
  const rawOpacity = Number(b.opacity);
  const opacity = Number.isFinite(rawOpacity)
    ? Math.min(1, Math.max(0, rawOpacity))
    : 0.2;
  const scroll = (DECORATION_VALUES.bgScroll ?? []).includes(b.scroll)
    ? b.scroll
    : "static";
  return { imageUrl: b.imageUrl, fit, size, opacity, scroll };
}

/** Keep only known dimensions set to a value the CSS understands; junk keys or
 *  values would otherwise emit dead data-attrs or `undefined` derived vars. */
export function normalizeOverrides(
  overrides: Partial<Decorations> | undefined,
): Partial<Decorations> {
  const out: Partial<Decorations> = {};
  if (!overrides) return out;
  for (const [key, allowed] of Object.entries(DECORATION_VALUES)) {
    const v = (overrides as Record<string, unknown>)[key];
    if (typeof v === "string" && allowed.includes(v)) {
      (out as Record<string, unknown>)[key] = v;
    }
  }
  if (Array.isArray(overrides.effects)) {
    out.effects = overrides.effects.filter(
      (e) => typeof e === "string" && AMBIENT_EFFECT_VALUES.includes(e),
    ) as Decorations["effects"];
  }
  return out;
}

const clampNum = (n: unknown, lo: number, hi: number, def: number): number => {
  const r = Number(n);
  return Number.isFinite(r) ? Math.min(hi, Math.max(lo, r)) : def;
};

/** Clamp a custom image asset for a given dimension (opacity 0..1; size per the
 *  dimension's range, or dropped where size is unused). Pure. */
export function normalizeImageAsset(dim: CustomImageDim, a: ImageAsset): ImageAsset {
  const sizeCfg = CUSTOM_IMAGE_SIZE[dim];
  const size = sizeCfg
    ? Math.round(clampNum(a.size, sizeCfg.min, sizeCfg.max, sizeCfg.def))
    : 0;
  return {
    imageUrl: a.imageUrl,
    opacity: clampNum(a.opacity, 0, 1, CUSTOM_IMAGE_OPACITY[dim]),
    size,
  };
}

function normalizeWordmark(a: WordmarkAsset): WordmarkAsset {
  const mode = (WORDMARK_MODES as readonly string[]).includes(a.mode)
    ? a.mode
    : "ornament";
  return { ...normalizeImageAsset("wordmark", a), mode };
}

/** Clamp a stored/submitted decoration mod into its valid ranges. Pure. */
export function normalizeDecorationSpec(spec: DecorationSpec): DecorationSpec {
  const out: DecorationSpec = { overrides: normalizeOverrides(spec.overrides) };
  if (spec.backdrop) out.backdrop = normalizeBackdrop(spec.backdrop);
  if (spec.divider) out.divider = normalizeImageAsset("divider", spec.divider);
  if (spec.cardFrame) out.cardFrame = normalizeImageAsset("cardFrame", spec.cardFrame);
  if (spec.avatarFrame) out.avatarFrame = normalizeImageAsset("avatarFrame", spec.avatarFrame);
  if (spec.wordmark) out.wordmark = normalizeWordmark(spec.wordmark);
  if (spec.reaction) out.reaction = normalizeImageAsset("reaction", spec.reaction);
  if (spec.ambient) out.ambient = normalizeImageAsset("ambient", spec.ambient);
  return out;
}

/** Build a safe CSS `url("…")` token from a user-supplied image URL. Returns
 *  "none" when the URL is missing, isn't http(s), or contains characters that
 *  could break out of the quoted url() (quotes, backslash, whitespace, control
 *  chars). The render layer treats "none" as "no custom backdrop", and the
 *  create action rejects such URLs up front so the user sees a clear error. */
export function safeCssUrl(url: string | null | undefined): string {
  if (!url) return "none";
  if (!/^https?:\/\//i.test(url)) return "none";
  if (/["'\\]/.test(url) || /[\u0000-\u0020\u007f]/.test(url)) return "none";
  return `url("${url}")`;
}

/**
 * The data-* attributes, inline CSS vars, and effective ambient effects for the
 * campaign wrapper, with one optional decoration mod layered on top. Without
 * `mod` this is exactly `themeDataAttrs` + `themeToCssVars`. A mod's named
 * `overrides` are merged into the theme's decorations so the existing CSS
 * machinery (data-attrs + derived vars) covers every dimension; a `backdrop`
 * then repoints the texture machinery at the custom image (and takes over its
 * motion + opacity). `effects` is the merged ambient-effect list the layout
 * uses to render particle layers.
 */
export function campaignRenderProps(
  theme: Theme,
  mod?: DecorationSpec | null,
): {
  dataAttrs: Record<string, string>;
  cssVars: CSSProperties;
  effects: Decorations["effects"];
  /** custom ambient particle to render as a feed layer (the layout draws it) */
  ambient: ImageAsset | null;
} {
  // merge the mod's named overrides into the campaign decorations, then run the
  // existing data-attr + var derivation over the merged theme so divider, card
  // frame, wordmark, depth, etc. all flow through unchanged.
  const baseDecor = normalizeTheme(theme).decorations!;
  const overrides = mod ? normalizeOverrides(mod.overrides) : {};
  const mergedDecor: Decorations = { ...baseDecor, ...overrides };
  const mergedTheme: Theme = { ...theme, decorations: mergedDecor };

  const dataAttrs: Record<string, string> = { ...themeDataAttrs(mergedTheme) };
  const cssVars: Record<string, string | number | undefined> = {
    ...(themeToCssVars(mergedTheme) as Record<string, string | number | undefined>),
  };

  const backdrop = mod?.backdrop ? normalizeBackdrop(mod.backdrop) : null;
  if (backdrop) {
    const cssImage = safeCssUrl(backdrop.imageUrl);
    if (cssImage !== "none") {
      dataAttrs["data-texture"] = "custom";
      // a custom backdrop fully owns motion: set its own scroll, or clear it so
      // a "static" pick really is static
      if (backdrop.scroll !== "static")
        dataAttrs["data-bg-scroll"] = backdrop.scroll;
      else delete dataAttrs["data-bg-scroll"];
      cssVars["--texture-image"] = cssImage;
      cssVars["--texture-opacity"] = String(backdrop.opacity);
      cssVars["--texture-size"] =
        backdrop.fit === "cover" ? "cover" : `${backdrop.size}px`;
      cssVars["--texture-repeat"] =
        backdrop.fit === "cover" ? "no-repeat" : "repeat";
    }
  }

  // every other upload-backed dimension: point its data-attr at "custom" and emit
  // the --<prefix>-image/opacity/size vars the matching globals.css branch reads.
  // ambient has no data-attr (it is a feed layer the layout draws separately).
  let ambient: ImageAsset | null = null;
  const m = mod as Record<string, ImageAsset | WordmarkAsset | null | undefined> | null | undefined;
  for (const { key, dataAttr, varPrefix, hasSize, hasMode } of CUSTOM_IMAGE_DIMS) {
    const raw = m?.[key];
    if (!raw) continue;
    const cssImage = safeCssUrl(raw.imageUrl);
    if (cssImage === "none") continue;
    const a =
      key === "wordmark"
        ? normalizeWordmark(raw as WordmarkAsset)
        : normalizeImageAsset(key, raw);
    if (dataAttr) dataAttrs[dataAttr] = "custom";
    cssVars[`--${varPrefix}-image`] = cssImage;
    cssVars[`--${varPrefix}-opacity`] = String(a.opacity);
    if (hasSize) cssVars[`--${varPrefix}-size`] = `${a.size}px`;
    if (hasMode) dataAttrs["data-wordmark-mode"] = (a as WordmarkAsset).mode;
    if (key === "ambient") ambient = a;
  }

  return {
    dataAttrs,
    cssVars: cssVars as CSSProperties,
    effects: mergedDecor.effects,
    ambient,
  };
}
