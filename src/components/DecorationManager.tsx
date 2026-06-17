"use client";

import type { CSSProperties } from "react";
import { useRef, useState, useTransition } from "react";
import {
  Check,
  ImagePlus,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  createDecorationAction,
  deleteDecorationAction,
  selectDecorationAction,
} from "@/app/actions/decorations";
import { emptyFormState } from "@/lib/form";
import { safeCssUrl, type DecorationSpec, type DecorationFit } from "@/lib/themes";
import {
  DECORATION_NAME_MAX,
  DECORATION_SIZE_MIN,
  DECORATION_SIZE_MAX,
  DECORATION_SIZE_DEFAULT,
} from "@/lib/theme-types";
import { Button, ErrorText, Field, TextInput } from "@/components/ui";
import { cn } from "@/lib/cn";

type Decoration = { id: number; name: string; spec: DecorationSpec };

const SCROLL_OPTIONS: [DecorationSpec["scroll"], string][] = [
  ["static", "Still"],
  ["down", "Scroll down"],
  ["up", "Scroll up"],
  ["left", "Scroll left"],
  ["right", "Scroll right"],
  ["diagonal", "Diagonal"],
  ["sineDown", "Sine (down)"],
  ["sway", "Sway"],
  ["sineUp", "Sine (up)"],
];

type Draft = {
  name: string;
  imageUrl: string;
  fit: DecorationFit;
  size: number;
  opacity: number;
  scroll: DecorationSpec["scroll"];
};

const EMPTY_DRAFT: Draft = {
  name: "",
  imageUrl: "",
  fit: "tile",
  size: DECORATION_SIZE_DEFAULT,
  opacity: 0.25,
  scroll: "static",
};

// The contained background style for a backdrop spec. Unlike the live campaign
// backdrop (a fixed ::before covering the viewport), previews/thumbnails draw
// the image on a normal absolutely-positioned layer so it stays inside its box.
function backdropLayer(
  spec: { imageUrl: string; fit: DecorationFit; size: number; opacity: number },
  withOpacity = true,
): CSSProperties {
  const img = safeCssUrl(spec.imageUrl);
  if (img === "none") return {};
  return {
    backgroundImage: img,
    backgroundSize: spec.fit === "cover" ? "cover" : `${spec.size}px ${spec.size}px`,
    backgroundRepeat: spec.fit === "cover" ? "no-repeat" : "repeat",
    backgroundPosition: "center",
    ...(withOpacity ? { opacity: spec.opacity } : {}),
  };
}

export function DecorationManager({
  slug,
  decorations,
  selectedId,
  uploadEnabled,
}: {
  slug: string;
  decorations: Decoration[];
  selectedId: number | null;
  uploadEnabled: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [uploading, setUploading] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  // Submit by hand (rather than a form action) so the draft can be cleared in
  // the action's resolved callback on success — the new decoration then shows up
  // in the list below, auto-selected by the action. Resetting in an effect would
  // be a cascading-render smell; this keeps the reset inside the transition.
  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createDecorationAction(emptyFormState, fd);
      if (res.error) {
        setCreateError(res.error);
      } else {
        setCreateError(undefined);
        setDraft(EMPTY_DRAFT);
      }
    });
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setDraft((d) => ({ ...d, imageUrl: data.url }));
      } else if (res.status === 501) {
        const pasted = window.prompt(
          "Image upload isn't configured. Paste an image URL instead:",
        );
        if (pasted) setDraft((d) => ({ ...d, imageUrl: pasted.trim() }));
      } else {
        const data = await res.json().catch(() => ({ error: "Upload failed." }));
        window.alert(data.error ?? "Upload failed.");
      }
    } finally {
      setUploading(false);
    }
  }

  function pasteUrl() {
    const pasted = window.prompt("Paste an image URL:", draft.imageUrl);
    if (pasted !== null) setDraft((d) => ({ ...d, imageUrl: pasted.trim() }));
  }

  function select(id: number | null) {
    startTransition(() => selectDecorationAction(slug, id));
  }
  function remove(id: number) {
    if (!window.confirm("Delete this decoration?")) return;
    startTransition(() => deleteDecorationAction(slug, id));
  }

  const hasImage = safeCssUrl(draft.imageUrl) !== "none";

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Make your own backdrop and wear it just in this campaign. Upload an image,
        tune how it sits, and it stays yours until you change it. Everyone else
        keeps the campaign default.
      </p>

      {/* ---- create a decoration ---------------------------------------- */}
      <form
        onSubmit={onCreate}
        className="space-y-4 rounded-base border border-border bg-surface p-5"
      >
        <h2 className="font-display text-xl font-bold text-text">
          New decoration
        </h2>

        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="imageUrl" value={draft.imageUrl} />
        <input type="hidden" name="fit" value={draft.fit} />

        <Field label="Name">
          <TextInput
            name="name"
            value={draft.name}
            maxLength={DECORATION_NAME_MAX}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="e.g. My star map"
            required
          />
        </Field>

        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-text">Image</span>
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
                  <ImagePlus className="size-4" /> Upload
                </>
              )}
            </Button>
            <button
              type="button"
              onClick={pasteUrl}
              className="text-xs text-muted hover:text-text hover:underline"
            >
              paste URL
            </button>
            {hasImage ? (
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, imageUrl: "" }))}
                className="inline-flex items-center gap-1 text-xs text-muted hover:text-like"
              >
                <Trash2 className="size-3.5" /> remove
              </button>
            ) : null}
          </div>
          {!uploadEnabled ? (
            <span className="block text-xs text-muted">
              Uploads aren&apos;t configured on this server — paste an image URL
              instead.
            </span>
          ) : null}
        </div>

        {/* fit */}
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-text">Fit</span>
          <div className="flex gap-2">
            {(["tile", "cover"] as DecorationFit[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, fit: f }))}
                className={cn(
                  "flex-1 rounded-base border px-3 py-2 text-sm capitalize",
                  draft.fit === f
                    ? "border-primary text-primary"
                    : "border-border text-muted hover:bg-surface-hover",
                )}
              >
                {f === "tile" ? "Tile" : "Cover"}
              </button>
            ))}
          </div>
        </div>

        {/* tile size (only meaningful when tiling) */}
        {draft.fit === "tile" ? (
          <label className="block space-y-1.5">
            <span className="flex items-center justify-between text-sm font-medium text-text">
              <span>Tile size</span>
              <span className="font-mono text-xs text-muted">{draft.size}px</span>
            </span>
            <input
              type="range"
              name="size"
              min={DECORATION_SIZE_MIN}
              max={DECORATION_SIZE_MAX}
              step={8}
              value={draft.size}
              onChange={(e) =>
                setDraft((d) => ({ ...d, size: Number(e.target.value) }))
              }
              className="w-full accent-primary"
            />
          </label>
        ) : (
          <input type="hidden" name="size" value={draft.size} />
        )}

        {/* opacity */}
        <label className="block space-y-1.5">
          <span className="flex items-center justify-between text-sm font-medium text-text">
            <span>Opacity</span>
            <span className="font-mono text-xs text-muted">
              {Math.round(draft.opacity * 100)}%
            </span>
          </span>
          <input
            type="range"
            name="opacity"
            min={0}
            max={1}
            step={0.05}
            value={draft.opacity}
            onChange={(e) =>
              setDraft((d) => ({ ...d, opacity: Number(e.target.value) }))
            }
            className="w-full accent-primary"
          />
        </label>

        {/* motion */}
        <Field label="Motion">
          <select
            name="scroll"
            value={draft.scroll}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                scroll: e.target.value as DecorationSpec["scroll"],
              }))
            }
            className="w-full rounded-base border border-border bg-bg/60 px-3 py-2 text-text"
          >
            {SCROLL_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        {/* live preview */}
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-text">Preview</span>
          <div className="relative h-40 overflow-hidden rounded-base border border-border bg-bg">
            {hasImage ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={backdropLayer(draft)}
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-xs text-muted">
                Add an image to preview your backdrop
              </div>
            )}
            <div className="relative p-4">
              <div className="max-w-xs rounded-base border border-border bg-surface p-3 shadow-sm">
                <div className="text-sm font-semibold text-text">Mystic Raven</div>
                <p className="mt-1 text-[13px] text-muted">
                  The portal opened at dusk. Meet me at the old library.
                </p>
              </div>
            </div>
          </div>
        </div>

        <ErrorText>{createError}</ErrorText>
        <Button type="submit" disabled={pending || uploading}>
          <Sparkles className="size-4" /> {pending ? "Saving…" : "Create & use"}
        </Button>
      </form>

      {/* ---- your decorations ------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-text">
            Your decorations
          </h2>
          {selectedId !== null ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => select(null)}
            >
              Use world default
            </Button>
          ) : (
            <span className="text-xs text-muted">Using world default</span>
          )}
        </div>

        {decorations.length === 0 ? (
          <p className="rounded-base border border-dashed border-border p-6 text-center text-sm text-muted">
            No decorations yet. Make one above.
          </p>
        ) : (
          <ul className="space-y-2">
            {decorations.map((d) => {
              const active = d.id === selectedId;
              return (
                <li
                  key={d.id}
                  className={cn(
                    "flex items-center gap-3 rounded-base border bg-surface p-3",
                    active ? "border-primary" : "border-border",
                  )}
                >
                  <span
                    aria-hidden
                    className="size-14 shrink-0 overflow-hidden rounded-base border border-border bg-bg"
                    style={backdropLayer(
                      {
                        imageUrl: d.spec.imageUrl,
                        fit: d.spec.fit,
                        // shrink the tile so the thumbnail shows the pattern
                        size: Math.max(
                          DECORATION_SIZE_MIN,
                          Math.round(d.spec.size / 3),
                        ),
                        opacity: d.spec.opacity,
                      },
                      true,
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-text">{d.name}</div>
                    <div className="text-xs capitalize text-muted">
                      {d.spec.fit} · {Math.round(d.spec.opacity * 100)}% ·{" "}
                      {d.spec.scroll === "static" ? "still" : "animated"}
                    </div>
                  </div>
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
                      onClick={() => select(d.id)}
                    >
                      Use
                    </Button>
                  )}
                  <button
                    type="button"
                    aria-label={`Delete ${d.name}`}
                    disabled={pending}
                    onClick={() => remove(d.id)}
                    className="rounded-full p-1.5 text-muted hover:bg-like/10 hover:text-like disabled:opacity-50"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
