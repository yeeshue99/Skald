import type { CSSProperties } from "react";
import type { Theme } from "./theme-types";

export type { Theme, ThemeColors, ThemeMode } from "./theme-types";

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
// Presets. The three flavored ones came from independent design passes; the
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
    accent: "#A8791C",
    like: "#B5232B",
    repost: "#3F6B3A",
    link: "#7A3E12",
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
};

export const PRESETS: Theme[] = [
  DEFAULT_THEME,
  STRIX_THEME,
  SCROLLR_THEME,
  HOLONET_THEME,
];

export function getPreset(id: string): Theme {
  return PRESETS.find((p) => p.id === id) ?? DEFAULT_THEME;
}

// ---------------------------------------------------------------------------
// Apply a theme by emitting CSS custom properties. Because they reference the
// raw vars, a per-campaign <div style={themeToCssVars(theme)}> re-skins every
// child at runtime with no rebuild.
// ---------------------------------------------------------------------------
export function themeToCssVars(theme: Theme): CSSProperties {
  const c = theme.colors;
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
    "--radius": theme.radius,
    "--font-display": fontStack(theme.fonts.display),
    "--font-body": fontStack(theme.fonts.body),
    colorScheme: theme.mode,
  } as CSSProperties;
}
