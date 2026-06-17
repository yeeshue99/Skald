"use client";

import type { CSSProperties } from "react";
import { useRef, useState, useTransition } from "react";
import {
  Check,
  Heart,
  ImagePlus,
  Loader2,
  MessageCircle,
  Palette,
  Repeat2,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import {
  createDecorationAction,
  deleteDecorationAction,
  selectDecorationAction,
  setWorldDecorationAction,
} from "@/app/actions/decorations";
import { emptyFormState } from "@/lib/form";
import {
  campaignRenderProps,
  safeCssUrl,
  type DecorationSpec,
  type DecorationFit,
  type Theme,
  type CustomImageDim,
  type WordmarkMode,
} from "@/lib/themes";
import { DECORATION_FIELDS, EFFECT_OPTIONS } from "@/lib/decoration-options";
import {
  DECORATION_SIZE_MIN,
  DECORATION_SIZE_MAX,
  DECORATION_SIZE_DEFAULT,
  DECORATION_NAME_MAX,
  CUSTOM_IMAGE_DIMS,
  CUSTOM_IMAGE_SIZE,
  CUSTOM_IMAGE_OPACITY,
  WORDMARK_MODES,
} from "@/lib/theme-types";
import { Avatar } from "@/components/Avatar";
import { ThemePreviewFrame } from "@/components/ThemePreviewFrame";
import { Button, ErrorText, Field, TextInput } from "@/components/ui";
import { cn } from "@/lib/cn";

type Decoration = { id: number; name: string; spec: DecorationSpec };

const TEXTURE_FIELD = DECORATION_FIELDS.find((f) => f.key === "texture")!;
// every dimension except texture (handled specially with a Custom-image option)
const OTHER_FIELDS = DECORATION_FIELDS.filter((f) => f.key !== "texture");
const CUSTOM = "__custom__";

// dropdown dimensions that gain a "Custom image…" option, mapped to the spec's
// custom-asset field (note the named dimension `reactions` -> custom `reaction`).
const CUSTOM_FOR_FIELD: Record<string, CustomImageDim> = {
  divider: "divider",
  avatarFrame: "avatarFrame",
  cardFrame: "cardFrame",
  wordmark: "wordmark",
  reactions: "reaction",
};

type CustomDraft = {
  imageUrl: string;
  opacity: number;
  size: number;
  mode: WordmarkMode;
};

type Draft = {
  name: string;
  scope: "personal" | "campaign";
  // per single-select dimension: "" = inherit; CUSTOM = a custom uploaded image
  overrides: Record<string, string>;
  effectsMode: "inherit" | "override";
  effects: string[];
  backdrop: { imageUrl: string; fit: DecorationFit; size: number; opacity: number };
  // custom uploaded images for the non-backdrop dimensions (+ ambient particle)
  custom: Record<CustomImageDim, CustomDraft>;
};

const emptyCustom = (): Record<CustomImageDim, CustomDraft> =>
  Object.fromEntries(
    CUSTOM_IMAGE_DIMS.map((d) => [
      d.key,
      {
        imageUrl: "",
        opacity: CUSTOM_IMAGE_OPACITY[d.key],
        size: CUSTOM_IMAGE_SIZE[d.key]?.def ?? 0,
        mode: "ornament" as WordmarkMode,
      },
    ]),
  ) as Record<CustomImageDim, CustomDraft>;

const EMPTY_DRAFT: Draft = {
  name: "",
  scope: "personal",
  overrides: {},
  effectsMode: "inherit",
  effects: [],
  backdrop: { imageUrl: "", fit: "tile", size: DECORATION_SIZE_DEFAULT, opacity: 0.25 },
  custom: emptyCustom(),
};

// Upload a file to Vercel Blob; returns the URL, or a pasted URL (501 fallback),
// or null (cancelled / failed). Shared by the backdrop uploader and every
// per-dimension CustomImageField.
async function uploadToBlob(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (res.ok) return (await res.json()).url as string;
  if (res.status === 501) {
    const p = window.prompt(
      "Image upload isn't configured. Paste an image URL instead:",
    );
    return p ? p.trim() : null;
  }
  const data = await res.json().catch(() => ({ error: "Upload failed." }));
  window.alert(data.error ?? "Upload failed.");
  return null;
}

// Build the stored spec from the editor draft.
function buildSpec(draft: Draft): DecorationSpec {
  const overrides: Record<string, unknown> = {};
  for (const f of DECORATION_FIELDS) {
    const v = draft.overrides[f.key] ?? "";
    if (v && v !== CUSTOM) overrides[f.key] = v; // a named value (CUSTOM handled below)
  }
  if (draft.effectsMode === "override") overrides.effects = draft.effects;

  const spec: Record<string, unknown> = { overrides };

  // texture custom -> backdrop (motion from the bgScroll override)
  if ((draft.overrides.texture ?? "") === CUSTOM && draft.backdrop.imageUrl) {
    spec.backdrop = {
      ...draft.backdrop,
      scroll: draft.overrides.bgScroll || "static",
    };
  }
  // dropdown-driven custom dimensions
  for (const [field, dim] of Object.entries(CUSTOM_FOR_FIELD)) {
    if ((draft.overrides[field] ?? "") !== CUSTOM) continue;
    const c = draft.custom[dim];
    if (!c.imageUrl) continue;
    spec[dim] =
      dim === "wordmark"
        ? { imageUrl: c.imageUrl, opacity: c.opacity, size: c.size, mode: c.mode }
        : { imageUrl: c.imageUrl, opacity: c.opacity, size: c.size };
  }
  // ambient particle (no dropdown; enabled simply by having an image)
  if (draft.custom.ambient.imageUrl) {
    const a = draft.custom.ambient;
    spec.ambient = { imageUrl: a.imageUrl, opacity: a.opacity, size: a.size };
  }
  return spec as unknown as DecorationSpec;
}

const CUSTOM_SPEC_KEYS = [
  "backdrop", "divider", "cardFrame", "avatarFrame", "wordmark", "reaction", "ambient",
] as const;

function specIsEmpty(spec: DecorationSpec): boolean {
  const s = spec as unknown as Record<string, unknown>;
  return (
    Object.keys(spec.overrides).length === 0 &&
    !CUSTOM_SPEC_KEYS.some((k) => s[k])
  );
}

function summarize(spec: DecorationSpec): string {
  const s = spec as unknown as Record<string, unknown>;
  const n = Object.keys(spec.overrides).filter((k) => k !== "effects").length;
  const custom = CUSTOM_SPEC_KEYS.filter((k) => s[k]).length;
  const parts: string[] = [];
  if (custom) parts.push(`${custom} custom image${custom === 1 ? "" : "s"}`);
  if (n) parts.push(`${n} style${n === 1 ? "" : "s"}`);
  if (spec.overrides.effects?.length) parts.push("effects");
  return parts.join(" · ") || "no changes";
}

// Contained background style for a backdrop image (the live ::before is fixed and
// would escape a preview box, so previews/thumbnails draw their own layer).
function backdropLayer(
  b: { imageUrl: string; fit: DecorationFit; size: number; opacity: number },
): CSSProperties {
  const img = safeCssUrl(b.imageUrl);
  if (img === "none") return {};
  return {
    backgroundImage: img,
    backgroundSize: b.fit === "cover" ? "cover" : `${b.size}px ${b.size}px`,
    backgroundRepeat: b.fit === "cover" ? "no-repeat" : "repeat",
    backgroundPosition: "center",
    opacity: b.opacity,
  };
}

// A preview of a spec over the campaign theme, rendered in an isolated iframe
// (ThemePreviewFrame) so the page's own [data-campaign] decorations can't leak
// in — every dimension, attribute-driven ones included, reflects the draft
// regardless of how the campaign itself is themed. Isolation also lets the real
// texture ::before render contained, so a named texture or a custom backdrop
// previews here too (no manual layer, no stripping data-texture).
//
// The sample carries one element per previewable dimension:
//   .chrome-bar  -> top-bar chrome      .wordmark   -> wordmark
//   .post-card   -> post divider        .avatar-frame (Avatar's own) -> avatar frame
//   .ui-card     -> card depth + frame  .ui-button  -> button FX
// Motion (bgScroll), ambient effects, and reaction flourishes are runtime/event
// driven and still only show on the real feed.
function SpecPreview({ theme, spec }: { theme: Theme; spec: DecorationSpec }) {
  const { dataAttrs, cssVars } = campaignRenderProps(theme, spec);
  return (
    <ThemePreviewFrame
      dataAttrs={dataAttrs}
      cssVars={cssVars}
      title="Decoration preview"
      className="block w-full rounded-base border border-border"
    >
      <div className="font-body text-text">
        {/* top-bar chrome + wordmark */}
        <div className="chrome-bar flex items-center border-b border-border px-3 py-2">
          <span className="wordmark font-display text-lg font-bold text-primary">
            Your campaign
          </span>
        </div>
        <div className="space-y-3 p-4">
          {/* feed post: divider + avatar frame (Avatar renders its own single
              .avatar-frame, so we don't wrap it in a second one) */}
          <div className="post-card rounded-base border border-border bg-surface p-3">
            <div className="flex items-center gap-2">
              <Avatar name="Mystic Raven" size={32} />
              <div className="text-sm">
                <span className="font-semibold text-text">Mystic Raven</span>{" "}
                <span className="text-muted">@raven · 2h</span>
              </div>
            </div>
            <p className="mt-2 text-[14px] text-text">
              The portal opened at dusk. Meet me at the old library.
            </p>
            <div className="mt-2 flex gap-6 text-muted">
              <MessageCircle className="size-4" />
              <Repeat2 className="size-4 text-repost" />
              <Heart className="size-4 text-like" />
            </div>
          </div>
          {/* standalone card: depth + card frame */}
          <div className="ui-card rounded-base border border-border bg-surface p-3 text-[13px] text-muted">
            A side panel. Shows card depth and the card frame.
          </div>
          {/* button FX */}
          <button
            type="button"
            className="ui-button rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
          >
            Post
          </button>
        </div>
      </div>
    </ThemePreviewFrame>
  );
}

// Small thumbnail for a list row: the custom backdrop if any, else a palette tile.
function Thumb({ spec }: { spec: DecorationSpec }) {
  const bg = spec.backdrop ? backdropLayer(spec.backdrop) : null;
  return (
    <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-base border border-border bg-bg">
      {bg ? (
        <span aria-hidden className="size-full" style={bg} />
      ) : (
        <Palette className="size-5 text-muted" />
      )}
    </span>
  );
}

// Upload + tune a custom image for one decoration dimension: upload/paste,
// opacity, an optional size knob, and (for the wordmark) a replace/ornament mode.
function CustomImageField({
  dim,
  value,
  onChange,
  uploadEnabled,
}: {
  dim: CustomImageDim;
  value: CustomDraft;
  onChange: (next: CustomDraft) => void;
  uploadEnabled: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const sizeCfg = CUSTOM_IMAGE_SIZE[dim];
  const hasMode = CUSTOM_IMAGE_DIMS.find((d) => d.key === dim)?.hasMode;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadToBlob(file);
      if (url) onChange({ ...value, imageUrl: url });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-base border border-border/70 bg-bg/40 p-3">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Uploading…
            </>
          ) : (
            <>
              <ImagePlus className="size-4" /> Upload image
            </>
          )}
        </Button>
        <button
          type="button"
          onClick={() => {
            const p = window.prompt("Paste an image URL:", value.imageUrl);
            if (p !== null) onChange({ ...value, imageUrl: p.trim() });
          }}
          className="text-xs text-muted hover:text-text hover:underline"
        >
          paste URL
        </button>
        {value.imageUrl ? (
          <>
            <span className="text-xs text-repost">image set</span>
            <button
              type="button"
              onClick={() => onChange({ ...value, imageUrl: "" })}
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-like"
            >
              <Trash2 className="size-3.5" /> remove
            </button>
          </>
        ) : null}
      </div>
      {!uploadEnabled ? (
        <span className="block text-xs text-muted">
          Uploads aren&apos;t configured — paste an image URL.
        </span>
      ) : null}

      {hasMode ? (
        <div className="flex gap-2">
          {WORDMARK_MODES.map((mo) => (
            <button
              key={mo}
              type="button"
              onClick={() => onChange({ ...value, mode: mo })}
              className={cn(
                "flex-1 rounded-base border px-3 py-1.5 text-sm",
                value.mode === mo
                  ? "border-primary text-primary"
                  : "border-border text-muted hover:bg-surface-hover",
              )}
            >
              {mo === "replace" ? "Replace text" : "Ornament"}
            </button>
          ))}
        </div>
      ) : null}

      {sizeCfg ? (
        <label className="block space-y-1">
          <span className="flex items-center justify-between text-xs font-medium text-text">
            <span>Size</span>
            <span className="font-mono text-muted">{value.size}px</span>
          </span>
          <input
            type="range"
            min={sizeCfg.min}
            max={sizeCfg.max}
            step={2}
            value={value.size}
            onChange={(e) => onChange({ ...value, size: Number(e.target.value) })}
            className="w-full accent-primary"
          />
        </label>
      ) : null}

      <label className="block space-y-1">
        <span className="flex items-center justify-between text-xs font-medium text-text">
          <span>Opacity</span>
          <span className="font-mono text-muted">{Math.round(value.opacity * 100)}%</span>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={value.opacity}
          onChange={(e) => onChange({ ...value, opacity: Number(e.target.value) })}
          className="w-full accent-primary"
        />
      </label>
    </div>
  );
}

export function DecorationManager({
  slug,
  isDm,
  personal,
  campaign,
  selectedId,
  worldId,
  campaignTheme,
  uploadEnabled,
}: {
  slug: string;
  isDm: boolean;
  personal: Decoration[];
  campaign: Decoration[];
  selectedId: number | null;
  worldId: number | null;
  campaignTheme: Theme;
  uploadEnabled: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [uploading, setUploading] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const spec = buildSpec(draft);
  const usingCustom = (draft.overrides.texture ?? "") === CUSTOM;

  function setOverride(key: string, value: string) {
    setDraft((d) => ({ ...d, overrides: { ...d.overrides, [key]: value } }));
  }
  function toggleEffect(value: string) {
    setDraft((d) => ({
      ...d,
      effects: d.effects.includes(value)
        ? d.effects.filter((e) => e !== value)
        : [...d.effects, value],
    }));
  }
  function setCustom(dim: CustomImageDim, next: CustomDraft) {
    setDraft((d) => ({ ...d, custom: { ...d.custom, [dim]: next } }));
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToBlob(file);
      if (url) setDraft((d) => ({ ...d, backdrop: { ...d.backdrop, imageUrl: url } }));
    } finally {
      setUploading(false);
    }
  }

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const built = buildSpec(draft);
    const fd = new FormData();
    fd.set("slug", slug);
    fd.set("name", draft.name);
    fd.set("scope", isDm ? draft.scope : "personal");
    fd.set("spec", JSON.stringify(built));
    startTransition(async () => {
      const res = await createDecorationAction(emptyFormState, fd);
      if (res.error) setCreateError(res.error);
      else {
        setCreateError(undefined);
        setDraft(EMPTY_DRAFT);
      }
    });
  }

  function select(id: number | null) {
    startTransition(() => selectDecorationAction(slug, id));
  }
  function remove(id: number) {
    if (!window.confirm("Delete this decoration?")) return;
    startTransition(() => deleteDecorationAction(slug, id));
  }
  function setDefault(id: number | null) {
    startTransition(() => setWorldDecorationAction(slug, id));
  }

  const canSubmit =
    !pending && !uploading && draft.name.trim().length > 0 && !specIsEmpty(spec);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Make your own look and wear it just in this campaign: pick any named
        decoration, or upload your own image for the backdrop, post divider, card
        frame, avatar frame, wordmark, reaction burst, or an ambient particle. It
        stays yours until you change it; everyone else keeps the campaign default.
        {isDm
          ? " As DM you can also share decorations with the whole campaign and set the campaign default."
          : null}
      </p>

      {/* ---- create ----------------------------------------------------- */}
      <form
        onSubmit={onCreate}
        className="space-y-4 rounded-base border border-border bg-surface p-5"
      >
        <h2 className="font-display text-xl font-bold text-text">New decoration</h2>

        <Field label="Name">
          <TextInput
            value={draft.name}
            maxLength={DECORATION_NAME_MAX}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="e.g. My star map"
            required
          />
        </Field>

        {isDm ? (
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-text">Who gets it</span>
            <div className="flex gap-2">
              {(
                [
                  ["personal", "Just me"],
                  ["campaign", "Whole campaign"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, scope: value }))}
                  className={cn(
                    "flex-1 rounded-base border px-3 py-2 text-sm",
                    draft.scope === value
                      ? "border-primary text-primary"
                      : "border-border text-muted hover:bg-surface-hover",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* backdrop dimension (named texture, or a custom upload) */}
        <Field label="Backdrop">
          <select
            value={draft.overrides.texture ?? ""}
            onChange={(e) => setOverride("texture", e.target.value)}
            className="w-full rounded-base border border-border bg-bg/60 px-3 py-2 text-text"
          >
            <option value="">Inherit (campaign)</option>
            {TEXTURE_FIELD.options.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            <option value={CUSTOM}>Custom image…</option>
          </select>
        </Field>

        {usingCustom ? (
          <div className="space-y-3 rounded-base border border-border/70 bg-bg/40 p-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickFile}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Uploading…
                  </>
                ) : (
                  <>
                    <ImagePlus className="size-4" /> Upload image
                  </>
                )}
              </Button>
              <button
                type="button"
                onClick={() => {
                  const p = window.prompt("Paste an image URL:", draft.backdrop.imageUrl);
                  if (p !== null)
                    setDraft((d) => ({ ...d, backdrop: { ...d.backdrop, imageUrl: p.trim() } }));
                }}
                className="text-xs text-muted hover:text-text hover:underline"
              >
                paste URL
              </button>
              {draft.backdrop.imageUrl ? (
                <span className="text-xs text-repost">image set</span>
              ) : null}
            </div>
            {!uploadEnabled ? (
              <span className="block text-xs text-muted">
                Uploads aren&apos;t configured on this server — paste an image URL.
              </span>
            ) : null}

            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-text">Fit</span>
              <div className="flex gap-2">
                {(["tile", "cover"] as DecorationFit[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, backdrop: { ...d.backdrop, fit: f } }))}
                    className={cn(
                      "flex-1 rounded-base border px-3 py-1.5 text-sm capitalize",
                      draft.backdrop.fit === f
                        ? "border-primary text-primary"
                        : "border-border text-muted hover:bg-surface-hover",
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {draft.backdrop.fit === "tile" ? (
              <label className="block space-y-1">
                <span className="flex items-center justify-between text-xs font-medium text-text">
                  <span>Tile size</span>
                  <span className="font-mono text-muted">{draft.backdrop.size}px</span>
                </span>
                <input
                  type="range"
                  min={DECORATION_SIZE_MIN}
                  max={DECORATION_SIZE_MAX}
                  step={8}
                  value={draft.backdrop.size}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, backdrop: { ...d.backdrop, size: Number(e.target.value) } }))
                  }
                  className="w-full accent-primary"
                />
              </label>
            ) : null}

            <label className="block space-y-1">
              <span className="flex items-center justify-between text-xs font-medium text-text">
                <span>Opacity</span>
                <span className="font-mono text-muted">
                  {Math.round(draft.backdrop.opacity * 100)}%
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={draft.backdrop.opacity}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, backdrop: { ...d.backdrop, opacity: Number(e.target.value) } }))
                }
                className="w-full accent-primary"
              />
            </label>
          </div>
        ) : null}

        {/* every other named dimension: inherit, a named value, or a custom upload */}
        <div className="grid gap-3 sm:grid-cols-2">
          {OTHER_FIELDS.map((f) => {
            const dim = CUSTOM_FOR_FIELD[f.key];
            const val = draft.overrides[f.key] ?? "";
            return (
              <Field key={f.key} label={f.label}>
                <select
                  value={val}
                  onChange={(e) => setOverride(f.key, e.target.value)}
                  className="w-full rounded-base border border-border bg-bg/60 px-3 py-2 text-text"
                >
                  <option value="">Inherit (campaign)</option>
                  {f.options.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                  {dim ? <option value={CUSTOM}>Custom image…</option> : null}
                </select>
                {dim && val === CUSTOM ? (
                  <div className="mt-2">
                    <CustomImageField
                      dim={dim}
                      value={draft.custom[dim]}
                      onChange={(n) => setCustom(dim, n)}
                      uploadEnabled={uploadEnabled}
                    />
                  </div>
                ) : null}
              </Field>
            );
          })}
        </div>

        {/* ambient effects */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-text">
            <input
              type="checkbox"
              checked={draft.effectsMode === "override"}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  effectsMode: e.target.checked ? "override" : "inherit",
                }))
              }
              className="size-4 accent-primary"
            />
            Override ambient effects
          </label>
          {draft.effectsMode === "override" ? (
            <div className="flex flex-wrap gap-2">
              {EFFECT_OPTIONS.map(([value, label]) => {
                const on = draft.effects.includes(value);
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
          ) : null}
        </div>

        {/* custom ambient particle (an uploaded image that drifts across the feed) */}
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-text">
            Custom ambient particle
          </span>
          <p className="text-xs text-muted">
            Optional. An image that drifts across the whole feed, always on.
          </p>
          <CustomImageField
            dim="ambient"
            value={draft.custom.ambient}
            onChange={(n) => setCustom("ambient", n)}
            uploadEnabled={uploadEnabled}
          />
        </div>

        {/* preview */}
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-text">Preview</span>
          <SpecPreview theme={campaignTheme} spec={spec} />
          <span className="block text-xs text-muted">
            Background motion, the ambient particle, and the reaction burst show on
            the real feed, not in this preview.
          </span>
        </div>

        <ErrorText>{createError}</ErrorText>
        <Button type="submit" disabled={!canSubmit}>
          <Sparkles className="size-4" />
          {pending ? "Saving…" : isDm && draft.scope === "campaign" ? "Share" : "Create & use"}
        </Button>
      </form>

      {/* ---- your decorations ------------------------------------------- */}
      <DecorationList
        title="Your decorations"
        empty="No personal decorations yet. Make one above."
        items={personal}
        selectedId={selectedId}
        pending={pending}
        onSelect={select}
        onRemove={remove}
        header={
          selectedId !== null ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => select(null)}
            >
              Use campaign default
            </Button>
          ) : (
            <span className="text-xs text-muted">Using campaign default</span>
          )
        }
      />

      {/* ---- shared campaign decorations -------------------------------- */}
      {campaign.length > 0 || isDm ? (
        <DecorationList
          title="Campaign decorations"
          empty={
            isDm
              ? "Share a decoration with the campaign by choosing “Whole campaign” above."
              : "Your DM hasn't shared any decorations yet."
          }
          items={campaign}
          selectedId={selectedId}
          pending={pending}
          onSelect={select}
          onRemove={isDm ? remove : undefined}
          worldId={worldId}
          onSetDefault={isDm ? setDefault : undefined}
        />
      ) : null}
    </div>
  );
}

function DecorationList({
  title,
  empty,
  items,
  selectedId,
  pending,
  onSelect,
  onRemove,
  worldId,
  onSetDefault,
  header,
}: {
  title: string;
  empty: string;
  items: Decoration[];
  selectedId: number | null;
  pending: boolean;
  onSelect: (id: number) => void;
  onRemove?: (id: number) => void;
  worldId?: number | null;
  onSetDefault?: (id: number | null) => void;
  header?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-text">{title}</h2>
        {header}
      </div>
      {items.length === 0 ? (
        <p className="rounded-base border border-dashed border-border p-6 text-center text-sm text-muted">
          {empty}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((d) => {
            const active = d.id === selectedId;
            const isDefault = worldId != null && d.id === worldId;
            return (
              <li
                key={d.id}
                className={cn(
                  "flex items-center gap-3 rounded-base border bg-surface p-3",
                  active ? "border-primary" : "border-border",
                )}
              >
                <Thumb spec={d.spec} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-text">{d.name}</span>
                    {isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                        <Star className="size-3" /> Default
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted">{summarize(d.spec)}</div>
                </div>
                {onSetDefault ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => onSetDefault(isDefault ? null : d.id)}
                  >
                    {isDefault ? "Unset default" : "Set default"}
                  </Button>
                ) : null}
                {active ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    <Check className="size-3.5" /> In use
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => onSelect(d.id)}
                  >
                    Use
                  </Button>
                )}
                {onRemove ? (
                  <button
                    type="button"
                    aria-label={`Delete ${d.name}`}
                    disabled={pending}
                    onClick={() => onRemove(d.id)}
                    className="rounded-full p-1.5 text-muted hover:bg-like/10 hover:text-like disabled:opacity-50"
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
