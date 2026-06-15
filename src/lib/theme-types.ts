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
