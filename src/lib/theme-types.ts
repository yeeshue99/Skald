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
// Decoration "mods". A member authors a decoration and applies it to themselves
// in one campaign; everyone else keeps the campaign (world) default. A DM can
// also share decorations campaign-wide and promote one to the campaign default.
// To keep this a safe "first-party modding SDK" — never arbitrary CSS or JS — a
// mod is a declarative spec: a partial override of the campaign's named
// decoration dimensions, plus the one upload-backed dimension (a custom
// backdrop image). The render layer merges it over the campaign theme through
// the existing decoration machinery, so every named dimension is covered.
// ---------------------------------------------------------------------------

/** How a backdrop image fills the field behind the feed. */
export type DecorationFit = "tile" | "cover";

/** A custom uploaded feed backdrop: an image plus a few declarative knobs. The
 *  one upload-backed dimension. Reuses the campaign backdrop's opacity dial and
 *  the bgScroll motions, so it animates and dims exactly like a built-in texture. */
export interface BackdropImage {
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

/** A custom uploaded image for a decoration dimension other than the backdrop.
 *  `size` is interpreted per dimension (strip height / particle tile / ornament
 *  px); ignored where the image is stretched or cover-fit. */
export interface ImageAsset {
  imageUrl: string;
  opacity: number;
  size: number;
}

/** Whether a custom wordmark image replaces the app-name text or sits beside it. */
export const WORDMARK_MODES = ["ornament", "replace"] as const;
export type WordmarkMode = (typeof WORDMARK_MODES)[number];

export interface WordmarkAsset extends ImageAsset {
  mode: WordmarkMode;
}

/** A decoration mod. `overrides` replaces any subset of the campaign's named
 *  decoration dimensions for one viewer; the optional image fields supply a
 *  custom uploaded image for that dimension instead of a named value. A viewer
 *  sees exactly one active mod (their personal pick, else the campaign default)
 *  applied over the campaign theme. */
export interface DecorationSpec {
  overrides: Partial<Decorations>;
  /** custom feed backdrop (the texture dimension) */
  backdrop?: BackdropImage | null;
  /** custom post-divider strip */
  divider?: ImageAsset | null;
  /** custom standalone-card frame (stretched over the card) */
  cardFrame?: ImageAsset | null;
  /** custom avatar-frame overlay (drawn over the avatar) */
  avatarFrame?: ImageAsset | null;
  /** custom wordmark image (logo replace, or ornament beside the text) */
  wordmark?: WordmarkAsset | null;
  /** custom reaction burst played on like/boost */
  reaction?: ImageAsset | null;
  /** custom always-on ambient particle drifting across the feed */
  ambient?: ImageAsset | null;
}

/** Upload-backed dimensions beyond the backdrop, driving render + editor.
 *  `dataAttr` is the attribute campaignRenderProps sets to "custom" (null for
 *  ambient, which is a feed layer not an attribute); `varPrefix` names the CSS
 *  vars `--<prefix>-image` / `-opacity` / `-size`. */
export const CUSTOM_IMAGE_DIMS = [
  { key: "divider", label: "Post divider", dataAttr: "data-divider", varPrefix: "divider", hasSize: true, hasMode: false },
  { key: "cardFrame", label: "Card frame", dataAttr: "data-card-frame", varPrefix: "card-frame", hasSize: false, hasMode: false },
  { key: "avatarFrame", label: "Avatar frame", dataAttr: "data-avatar-frame", varPrefix: "avatar-frame", hasSize: false, hasMode: false },
  { key: "wordmark", label: "Wordmark", dataAttr: "data-wordmark", varPrefix: "wordmark", hasSize: true, hasMode: true },
  { key: "reaction", label: "Reaction burst", dataAttr: "data-reactions", varPrefix: "reaction", hasSize: true, hasMode: false },
  { key: "ambient", label: "Ambient particle", dataAttr: null, varPrefix: "ambient", hasSize: true, hasMode: false },
] as const;

export type CustomImageDim = (typeof CUSTOM_IMAGE_DIMS)[number]["key"];

/** Per-dimension `size` clamp + default (px), or null where size is unused. */
export const CUSTOM_IMAGE_SIZE: Record<CustomImageDim, { min: number; max: number; def: number } | null> = {
  divider: { min: 8, max: 64, def: 18 },
  cardFrame: null,
  avatarFrame: null,
  wordmark: { min: 12, max: 80, def: 24 },
  reaction: { min: 12, max: 96, def: 24 },
  ambient: { min: 24, max: 512, def: 140 },
};

/** Per-dimension default opacity. */
export const CUSTOM_IMAGE_OPACITY: Record<CustomImageDim, number> = {
  divider: 1,
  cardFrame: 1,
  avatarFrame: 1,
  wordmark: 1,
  reaction: 1,
  ambient: 0.5,
};

/** Whether a decoration is the author's own (personal) or shared campaign-wide
 *  by the DM. A campaign-scoped decoration is offered to every member and is the
 *  only kind that may be promoted to the campaign default. */
export const DECORATION_SCOPES = ["personal", "campaign"] as const;
export type DecorationScope = (typeof DECORATION_SCOPES)[number];

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
