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
}
