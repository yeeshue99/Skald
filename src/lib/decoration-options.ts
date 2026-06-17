import type { AmbientEffect, Decorations } from "./theme-types";

// Single source of truth for the selectable decoration values + their editor
// labels. Shared by the DM theme editor (ThemeEditorForm), the personal/shared
// decoration editor (DecorationManager), and the validation/normalize layers, so
// the option sets never drift apart. The first value of each dimension is the
// understated "plain/none/flat" baseline.
//
// Note: `texture` lists only the named/built-in textures here. The custom
// uploaded backdrop is a separate dimension (DecorationSpec.backdrop), not a
// `texture` value, so it never appears in this list.
export const DECORATION_FIELDS: {
  key: Exclude<keyof Decorations, "effects">;
  label: string;
  options: [string, string][];
}[] = [
  {
    key: "texture",
    label: "Backdrop texture",
    options: [
      ["none", "None"],
      ["starchart", "Star chart"],
      ["constellations", "Constellations"],
      ["parchment", "Paper & books"],
      ["circuit", "Circuit"],
      ["squiggle", "Squiggle"],
      ["florets", "Florets"],
      ["vinework", "Vinework"],
    ],
  },
  {
    key: "bgScroll",
    label: "Background motion",
    options: [
      ["static", "Static"],
      ["down", "Scroll down"],
      ["up", "Scroll up"],
      ["left", "Scroll left"],
      ["right", "Scroll right"],
      ["diagonal", "Diagonal"],
      ["sineDown", "Sine wave (down)"],
      ["sway", "Sway"],
      ["sineUp", "Sine wave (up)"],
    ],
  },
  {
    key: "divider",
    label: "Post divider",
    options: [
      ["plain", "Plain"],
      ["asterism", "Asterism"],
      ["diamond", "Diamond"],
      ["dataline", "Data line"],
      ["vine", "Vine sprig"],
      ["laurel", "Laurel"],
    ],
  },
  {
    key: "buttons",
    label: "Button FX",
    options: [
      ["flat", "Flat"],
      ["arcaneGlow", "Arcane glow"],
      ["wax", "Wax seal"],
      ["neon", "Neon"],
      ["petal", "Petal press"],
      ["dew", "Dewdrop"],
    ],
  },
  {
    key: "avatarFrame",
    label: "Avatar frame",
    options: [
      ["none", "None"],
      ["manaHalo", "Mana halo"],
      ["medallion", "Medallion"],
      ["hudBracket", "HUD bracket"],
      ["wreath", "Laurel wreath"],
      ["blossom", "Blossom halo"],
    ],
  },
  {
    key: "depth",
    label: "Card depth",
    options: [
      ["flat", "Flat"],
      ["violetAmbient", "Violet ambient"],
      ["paperMatte", "Paper matte"],
      ["cyanBloom", "Cyan bloom"],
      ["verdantAmbient", "Verdant ambient"],
      ["roseGlow", "Rose glow"],
    ],
  },
  {
    key: "reactions",
    label: "Reaction flourish",
    options: [
      ["none", "None"],
      ["sparkle", "Sparkle"],
      ["stamp", "Wax stamp"],
      ["pulse", "Energy pulse"],
      ["petals", "Petal scatter"],
      ["bloom", "Bloom"],
    ],
  },
  {
    key: "cardFrame",
    label: "Card frame",
    options: [
      ["plain", "Plain"],
      ["gilded", "Gilded rule"],
      ["deckled", "Deckled edge"],
      ["chamfer", "Chamfered HUD"],
      ["botanical", "Botanical vine"],
      ["pressed", "Pressed flower"],
    ],
  },
  {
    key: "wordmark",
    label: "Wordmark",
    options: [
      ["plain", "Plain"],
      ["sigil", "Arcane sigil"],
      ["dropcap", "Drop-cap"],
      ["caret", "Blinking caret"],
      ["sprig", "Leaf sprig"],
      ["rosette", "Rosette"],
    ],
  },
  {
    key: "chrome",
    label: "Top-bar chrome",
    options: [
      ["plain", "Plain"],
      ["stainedGlass", "Stained glass"],
      ["banner", "Banner edge"],
      ["hudStrip", "HUD strip"],
      ["trellis", "Trellis"],
      ["garland", "Garland"],
    ],
  },
];

// Multi-select ambient effects — combine any.
export const EFFECT_OPTIONS: [AmbientEffect, string][] = [
  ["embers", "Embers"],
  ["motes", "Motes"],
  ["dust", "Dust"],
  ["scanlines", "Scanlines"],
  ["fog", "Fog"],
  ["pagecurl", "Page-curl on hover"],
  ["petalfall", "Petal fall"],
  ["pollen", "Pollen"],
  ["leaves", "Drifting leaves"],
];

// Allowed values per single-select dimension, derived once from the field list.
// Used by validation (zod enums) and render normalization (drop junk overrides).
export const DECORATION_VALUES: Record<string, string[]> = Object.fromEntries(
  DECORATION_FIELDS.map((f) => [f.key, f.options.map((o) => o[0])]),
);

export const AMBIENT_EFFECT_VALUES: string[] = EFFECT_OPTIONS.map((o) => o[0]);
