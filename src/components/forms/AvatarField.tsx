"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  PERSONA_AVATAR_FRAMES,
  type PersonaAvatarFrame,
} from "@/lib/theme-types";

const FRAME_LABELS: Record<PersonaAvatarFrame, string> = {
  default: "Theme",
  none: "None",
  manaHalo: "Mana halo",
  medallion: "Medallion",
  hudBracket: "HUD bracket",
  wreath: "Wreath",
  blossom: "Blossom",
};

// Reusable avatar picker: a live preview plus a file upload to /api/upload
// (Vercel Blob), with a pasted-URL fallback when upload isn't configured. The
// chosen URL is submitted via a hidden input (default name "avatarUrl"), so the
// surrounding <form action> picks it up like any other field. Pass withFrame to
// also let the persona choose an avatar frame (submitted as "avatarFrame"); the
// live preview and swatches reflect the pick.
export function AvatarField({
  name,
  defaultUrl = null,
  inputName = "avatarUrl",
  label = "Avatar",
  hint = "Optional. Upload an image or leave blank for initials.",
  withFrame = false,
  defaultFrame = "default",
  frameInputName = "avatarFrame",
}: {
  name: string;
  defaultUrl?: string | null;
  inputName?: string;
  label?: string;
  hint?: string;
  withFrame?: boolean;
  defaultFrame?: PersonaAvatarFrame;
  frameInputName?: string;
}) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [frame, setFrame] = useState<PersonaAvatarFrame>(defaultFrame);
  const fileRef = useRef<HTMLInputElement>(null);

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
        setUrl(data.url);
      } else if (res.status === 501) {
        const pasted = window.prompt(
          "Image upload isn't configured. Paste an image URL instead:",
        );
        if (pasted) setUrl(pasted.trim());
      } else {
        const data = await res.json().catch(() => ({ error: "Upload failed." }));
        window.alert(data.error ?? "Upload failed.");
      }
    } finally {
      setUploading(false);
    }
  }

  function pasteUrl() {
    const pasted = window.prompt("Paste an image URL:", url);
    if (pasted !== null) setUrl(pasted.trim());
  }

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-text">{label}</span>
      <input type="hidden" name={inputName} value={url} />
      {withFrame ? (
        <input type="hidden" name={frameInputName} value={frame} />
      ) : null}
      <div className="flex items-center gap-3">
        <Avatar
          name={name || "?"}
          avatarUrl={url || null}
          size={56}
          frame={withFrame ? frame : undefined}
        />
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
          {url ? (
            <button
              type="button"
              onClick={() => setUrl("")}
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-like"
            >
              <Trash2 className="size-3.5" /> remove
            </button>
          ) : null}
        </div>
      </div>
      {hint ? <span className="block text-xs text-muted">{hint}</span> : null}

      {withFrame ? (
        <div className="pt-1">
          <span className="block text-xs font-medium text-text">Frame</span>
          <div className="mt-1.5 flex flex-wrap gap-2.5">
            {PERSONA_AVATAR_FRAMES.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrame(f)}
                aria-pressed={frame === f}
                title={FRAME_LABELS[f]}
                className="flex w-14 flex-col items-center gap-1 text-center"
              >
                <span
                  className={cn(
                    "rounded-full p-0.5 transition-all",
                    frame === f
                      ? "ring-2 ring-primary"
                      : "ring-1 ring-border hover:ring-muted",
                  )}
                >
                  <Avatar
                    name={name || "?"}
                    avatarUrl={url || null}
                    size={40}
                    frame={f}
                  />
                </span>
                <span
                  className={cn(
                    "text-[10px] leading-tight",
                    frame === f
                      ? "font-semibold text-text"
                      : "text-muted",
                  )}
                >
                  {FRAME_LABELS[f]}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
