"use client";

import { useActionState, useState } from "react";
import { Heart, MessageCircle, Repeat2 } from "lucide-react";
import { updateThemeAction } from "@/app/actions/campaigns";
import {
  AVAILABLE_FONTS,
  PRESETS,
  themeToCssVars,
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

export function ThemeEditorForm({
  slug,
  initial,
}: {
  slug: string;
  initial: Theme;
}) {
  const [theme, setTheme] = useState<Theme>(initial);
  const [state, action] = useActionState(updateThemeAction, emptyFormState);

  function patch(p: Partial<Theme>) {
    setTheme((t) => ({ ...t, ...p }));
  }
  function setColor(key: keyof Theme["colors"], value: string) {
    setTheme((t) => ({ ...t, colors: { ...t.colors, [key]: value } }));
  }
  function applyPreset(p: Theme) {
    setTheme((t) => ({
      ...p,
      appName: t.appName,
      tagline: t.tagline,
    }));
  }

  return (
    <form action={action} className="space-y-6">
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

      {/* live preview */}
      <div>
        <span className="mb-2 block text-sm font-medium text-text">Preview</span>
        <div
          style={themeToCssVars(theme)}
          className="overflow-hidden rounded-base border border-border"
        >
          <div className="bg-bg p-4 font-body text-text">
            <div className="font-display text-2xl font-bold text-primary">
              {theme.appName || "Your campaign"}
            </div>
            <p className="text-sm text-muted">{theme.tagline}</p>
            <div className="mt-3 rounded-base border border-border bg-surface p-3">
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
              className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
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
