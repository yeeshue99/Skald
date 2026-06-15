"use client";

import { useActionState, useState } from "react";
import { Heart, MessageCircle, Repeat2 } from "lucide-react";
import { updateThemeAction } from "@/app/actions/campaigns";
import {
  AVAILABLE_FONTS,
  PRESETS,
  normalizeTheme,
  themeDataAttrs,
  themeToCssVars,
  type AmbientEffect,
  type Decorations,
  type Theme,
} from "@/lib/themes";
import { emptyFormState } from "@/lib/form";
import { Avatar } from "@/components/Avatar";
import { Button, ErrorText, Field, TextInput } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { cn } from "@/lib/cn";

const COLOR_FIELDS: { key: keyof Theme["colors"]; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "surface", label: "Surface" },
  { key: "surfaceHover", label: "Surface hover" },
  { key: "border", label: "Border" },
  { key: "text", label: "Text" },
  { key: "textMuted", label: "Muted text" },
  { key: "primary", label: "Primary" },
  { key: "primaryHover", label: "Primary hover" },
  { key: "onPrimary", label: "On primary" },
  { key: "accent", label: "Accent" },
  { key: "like", label: "Like" },
  { key: "repost", label: "Boost" },
  { key: "link", label: "Link" },
];

const RADII: [string, string][] = [
  ["0px", "Square"],
  ["0.375rem", "Subtle"],
  ["0.5rem", "Soft"],
  ["0.875rem", "Round"],
  ["1rem", "Rounder"],
  ["1.5rem", "Pill"],
];

// Single-select decoration dimensions (effects is a separate multi-select).
// Values are the canonical union strings; the label is the editor display name.
const DECORATION_FIELDS: {
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

// Multi-select ambient effects — combine any. Labels for the editor checkboxes.
const EFFECT_OPTIONS: [AmbientEffect, string][] = [
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

export function ThemeEditorForm({
  slug,
  initial,
}: {
  slug: string;
  initial: Theme;
}) {
  // Seed from a normalized theme so `decorations` always has all five keys.
  // Otherwise changing one dropdown on a campaign with no saved decorations
  // would serialize a partial object, which the theme schema rejects (the save
  // silently fails). With a full object, every change saves.
  const [theme, setTheme] = useState<Theme>(() => normalizeTheme(initial));
  const [state, action] = useActionState(updateThemeAction, emptyFormState);

  function patch(p: Partial<Theme>) {
    setTheme((t) => ({ ...t, ...p }));
  }
  function setColor(key: keyof Theme["colors"], value: string) {
    setTheme((t) => ({ ...t, colors: { ...t.colors, [key]: value } }));
  }
  function setDecoration<K extends keyof Decorations>(
    key: K,
    value: Decorations[K],
  ) {
    setTheme((t) => ({
      ...t,
      decorations: { ...t.decorations, [key]: value } as Decorations,
    }));
  }
  function toggleEffect(effect: AmbientEffect) {
    setTheme((t) => {
      const current = t.decorations?.effects ?? [];
      const next = current.includes(effect)
        ? current.filter((e) => e !== effect)
        : [...current, effect];
      return {
        ...t,
        decorations: { ...t.decorations, effects: next } as Decorations,
      };
    });
  }
  function applyPreset(p: Theme) {
    setTheme((t) => ({
      ...p,
      appName: t.appName,
      tagline: t.tagline,
    }));
  }

  return (
    <form
      action={action}
      // React 19 auto-resets a form after its action runs. That native reset
      // snaps controlled <select>/<input> elements back to their first option
      // (the value prop is unchanged, so React doesn't re-sync the DOM) — the
      // edit looks like it reverted even though state + DB saved. Cancel it;
      // every field here is controlled by `theme`, so there's nothing to reset.
      onReset={(e) => e.preventDefault()}
      className="space-y-6"
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="theme" value={JSON.stringify(theme)} />

      {/* quick presets */}
      <div>
        <span className="mb-2 block text-sm font-medium text-text">
          Start from a preset
        </span>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              className="rounded-full border border-border px-3 py-1 text-sm hover:bg-surface-hover"
              style={{ color: p.colors.primary }}
            >
              {p.appName}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="App name (wordmark)">
          <TextInput
            value={theme.appName}
            onChange={(e) => patch({ appName: e.target.value })}
            required
          />
        </Field>
        <Field label="Tagline">
          <TextInput
            value={theme.tagline}
            onChange={(e) => patch({ tagline: e.target.value })}
          />
        </Field>
        <Field label="Display font">
          <select
            value={theme.fonts.display}
            onChange={(e) =>
              patch({ fonts: { ...theme.fonts, display: e.target.value } })
            }
            className="w-full rounded-base border border-border bg-bg/60 px-3 py-2 text-text"
          >
            {AVAILABLE_FONTS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Body font">
          <select
            value={theme.fonts.body}
            onChange={(e) =>
              patch({ fonts: { ...theme.fonts, body: e.target.value } })
            }
            className="w-full rounded-base border border-border bg-bg/60 px-3 py-2 text-text"
          >
            {AVAILABLE_FONTS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Corner radius">
          <select
            value={theme.radius}
            onChange={(e) => patch({ radius: e.target.value })}
            className="w-full rounded-base border border-border bg-bg/60 px-3 py-2 text-text"
          >
            {RADII.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mode">
          <div className="flex gap-2">
            {(["dark", "light"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => patch({ mode: m })}
                className={cn(
                  "flex-1 rounded-base border px-3 py-2 text-sm capitalize",
                  theme.mode === m
                    ? "border-primary text-primary"
                    : "border-border text-muted",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </Field>
      </div>

      {/* colors */}
      <div>
        <span className="mb-2 block text-sm font-medium text-text">Colors</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {COLOR_FIELDS.map((c) => (
            <label
              key={c.key}
              className="flex items-center gap-2 rounded-base border border-border px-2 py-1.5"
            >
              <input
                type="color"
                value={theme.colors[c.key]}
                onChange={(e) => setColor(c.key, e.target.value)}
                className="size-7 shrink-0 cursor-pointer rounded border-0 bg-transparent"
              />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-text">
                  {c.label}
                </span>
                <span className="block font-mono text-[10px] uppercase text-muted">
                  {theme.colors[c.key]}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* decorations */}
      <div>
        <span className="mb-2 block text-sm font-medium text-text">
          Decorations
        </span>
        <div className="grid gap-4 sm:grid-cols-2">
          {DECORATION_FIELDS.map((d) => (
            <Field key={d.key} label={d.label}>
              <select
                value={theme.decorations?.[d.key] ?? d.options[0][0]}
                onChange={(e) =>
                  setDecoration(
                    d.key,
                    e.target.value as Decorations[typeof d.key],
                  )
                }
                className="w-full rounded-base border border-border bg-bg/60 px-3 py-2 text-text"
              >
                {d.options.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>
        {/* ambient effects — multi-select, combine any */}
        <div className="mt-4">
          <span className="mb-1 block text-sm font-medium text-text">
            Ambient effects
          </span>
          <p className="mb-2 text-xs text-muted">
            Combine any. All respect reduced-motion. Shown on the feed, not this
            preview.
          </p>
          <div className="flex flex-wrap gap-2">
            {EFFECT_OPTIONS.map(([value, label]) => {
              const on = (theme.decorations?.effects ?? []).includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleEffect(value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    on
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted hover:bg-surface-hover",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* live preview */}
      <div>
        <span className="mb-2 block text-sm font-medium text-text">Preview</span>
        <div
          {...themeDataAttrs(theme)}
          style={themeToCssVars(theme)}
          className="overflow-hidden rounded-base border border-border"
        >
          <div className="bg-bg p-4 font-body text-text">
            <div className="wordmark font-display text-2xl font-bold text-primary">
              {theme.appName || "Your campaign"}
            </div>
            <p className="text-sm text-muted">{theme.tagline}</p>
            <div className="post-card mt-3 rounded-base border border-border bg-surface p-3">
              <div className="flex items-center gap-2">
                <Avatar name="Mystic Raven" size={36} />
                <div className="text-sm">
                  <span className="font-semibold text-text">Mystic Raven</span>{" "}
                  <span className="text-muted">@raven · 2h</span>
                </div>
              </div>
              <p className="mt-2 text-[15px] text-text">
                The portal opened at dusk. Meet me at the old library.{" "}
                <span className="text-link">#nightclass</span>
              </p>
              <div className="mt-2 flex gap-6 text-muted">
                <MessageCircle className="size-4" />
                <Repeat2 className="size-4 text-repost" />
                <Heart className="size-4 text-like" />
              </div>
            </div>
            <button
              type="button"
              className="ui-button mt-4 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
            >
              Post
            </button>
          </div>
        </div>
      </div>

      <ErrorText>{state.error}</ErrorText>
      {state.ok ? (
        <p className="text-sm text-repost">Saved. The campaign has been restyled.</p>
      ) : null}
      <SubmitButton pendingLabel="Saving…">Save theme</SubmitButton>
    </form>
  );
}
