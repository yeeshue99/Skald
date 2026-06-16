"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";

// Wide profile-banner picker: a 3:1 live preview plus a file upload to
// /api/upload (Vercel Blob), with a pasted-URL fallback when upload isn't
// configured. The chosen URL is submitted via a hidden input (default name
// "bannerUrl"); an empty value falls back to the theme gradient on the profile.
export function BannerField({
  defaultUrl = null,
  inputName = "bannerUrl",
  label = "Profile banner",
  hint = "Optional. A wide header image; leave blank for a theme gradient.",
}: {
  defaultUrl?: string | null;
  inputName?: string;
  label?: string;
  hint?: string;
}) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [uploading, setUploading] = useState(false);
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
      <div className="overflow-hidden rounded-base border border-border">
        {url ? (
          // user-provided URL, so a plain <img> (no domain allowlist)
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-24 w-full object-cover" />
        ) : (
          <div
            className="h-24 w-full"
            style={{
              backgroundImage:
                "linear-gradient(120deg, var(--primary), var(--accent))",
            }}
          />
        )}
      </div>
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
      {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </div>
  );
}
