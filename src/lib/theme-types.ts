// Shape of a campaign theme. Stored as jsonb on the campaign row and applied
// at runtime via CSS custom properties. Kept dependency-free so both the Drizzle
// schema and the client can import it.

export type ThemeMode = "dark" | "light";

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceHover: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryHover: string;
  onPrimary: string;
  accent: string;
  like: string;
  repost: string;
  link: string;
}

// Phase 1 decorative styling. Each dimension is a NAMED style the DM picks.
// Optional on Theme so existing campaign rows (stored before this field
// existed) still satisfy the type. normalizeTheme() fills any missing values.
export interface Decorations {
  /** backdrop pattern behind the feed */
  texture:
    | "none"
    | "starchart"
    | "parchment"
    | "circuit"
    | "constellations"
    | "squiggle"
    | "florets"
    | "vinework";
  /** direction the backdrop pattern tiles/scrolls (static = no motion;
   *  sineDown = scrolls down while swaying side to side like a sine wave;
   *  sway = swaying side to side in place; sineUp = the sine drift, rising) */
  bgScroll:
    | "static"
    | "down"
    | "up"
    | "left"
    | "right"
    | "diagonal"
    | "sineDown"
    | "sway"
    | "sineUp";
  /** ornament between feed posts */
  divider: "plain" | "asterism" | "diamond" | "dataline" | "vine" | "laurel";
  /** hover/press FX beyond color */
  buttons: "flat" | "arcaneGlow" | "wax" | "neon" | "petal" | "dew";
  /** ring/decoration around avatars */
  avatarFrame:
    | "none"
    | "manaHalo"
    | "medallion"
    | "hudBracket"
    | "wreath"
    | "blossom";
  /** shadow + glow language for cards/menus */
  depth:
    | "flat"
    | "violetAmbient"
    | "paperMatte"
    | "cyanBloom"
    | "verdantAmbient"
    | "roseGlow";
  /** flourish played when a post is liked/boosted */
  reactions: "none" | "sparkle" | "stamp" | "pulse" | "petals" | "bloom";
  /** frame treatment for standalone cards (panels, quote embeds, composer) */
  cardFrame: "plain" | "gilded" | "deckled" | "chamfer" | "botanical" | "pressed";
  /** embellishment on the app wordmark in the header */
  wordmark: "plain" | "sigil" | "dropcap" | "caret" | "sprig" | "rosette";
  /** treatment for the top-bar / header chrome */
  chrome: "plain" | "stainedGlass" | "banner" | "hudStrip" | "trellis" | "garland";
  /** opt-in ambient effects, freely combinable (multi-select). Each renders its
   *  own layer; all are gated by prefers-reduced-motion. Empty = none. */
  effects: AmbientEffect[];
}

// ---------------------------------------------------------------------------
// Player decoration "mods". A member can author their own decoration and apply
// it to themselves in one campaign; everyone else keeps the campaign (world)
// default. To keep this a safe "first-party modding SDK" — never arbitrary CSS
// or JS — a mod is a declarative spec the render layer maps onto the existing
// decoration machinery. v1 ships one kind (a feed backdrop); the discriminated
// union on `kind` is the extension point for future kinds (divider, frame, …).
// ---------------------------------------------------------------------------

/** How a backdrop image fills the field behind the feed. */
export type DecorationFit = "tile" | "cover";

/** A custom feed backdrop: an uploaded (or pasted) image plus a few declarative
 *  knobs. Reuses the campaign backdrop's opacity dial and the bgScroll motions,
 *  so it animates and dims exactly like a built-in texture. */
export interface BackdropDecoration {
  kind: "backdrop";
  /** image asset URL (our Vercel Blob upload, or a pasted http(s) image URL) */
  imageUrl: string;
  /** tile the image at `size`px, or scale one copy to cover the viewport */
  fit: DecorationFit;
  /** tile edge length in px when fit === "tile" (ignored for cover) */
  size: number;
  /** backdrop opacity, 0..1 */
  opacity: number;
  /** drift direction; reuses the campaign bgScroll vocabulary ("static" = none) */
  scroll: Decorations["bgScroll"];
}

/** A player-authored decoration mod. Discriminated on `kind` so more dimensions
 *  can be added without reworking storage or the render layer. */
export type DecorationSpec = BackdropDecoration;

/** Clamp bounds for a custom backdrop, shared by the normalizer and validator. */
export const DECORATION_SIZE_MIN = 24;
export const DECORATION_SIZE_MAX = 1024;
export const DECORATION_SIZE_DEFAULT = 240;
export const DECORATION_NAME_MAX = 40;

export const DECORATION_FITS: DecorationFit[] = ["tile", "cover"];

/** Individually selectable ambient effects (combine any). */
export type AmbientEffect =
  | "embers"
  | "motes"
  | "dust"
  | "scanlines"
  | "fog"
  | "pagecurl"
  | "petalfall"
  | "pollen"
  | "leaves";

/** Per-persona avatar frame. "default" inherits the campaign theme's avatar
 *  frame (the DM's pick); every other value overrides it for that one persona's
 *  avatar wherever it appears. The named frames mirror the campaign-level
 *  Decorations["avatarFrame"] set so the same ring CSS can be reused. */
export const PERSONA_AVATAR_FRAMES = [
  "default",
  "none",
  "manaHalo",
  "medallion",
  "hudBracket",
  "wreath",
  "blossom",
] as const;
export type PersonaAvatarFrame = (typeof PERSONA_AVATAR_FRAMES)[number];

export const AMBIENT_EFFECTS: AmbientEffect[] = [
  "embers",
  "motes",
  "dust",
  "scanlines",
  "fog",
  "pagecurl",
  "petalfall",
  "pollen",
  "leaves",
];

export interface Theme {
  /** stable id of the preset this theme started from */
  id: string;
  /** the wordmark shown in the app, e.g. "STR/X" or "Scrollr" */
  appName: string;
  tagline: string;
  mode: ThemeMode;
  fonts: {
    display: string;
    body: string;
  };
  colors: ThemeColors;
  /** base border radius, e.g. "0.875rem" */
  radius: string;
  /** optional Phase 1 decorations; absent on legacy rows */
  decorations?: Decorations;
}
