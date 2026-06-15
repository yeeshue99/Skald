"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  ImagePlus,
  Link2,
  Loader2,
  X,
} from "lucide-react";
import { createPostAction } from "@/app/actions/posts";
import { emptyFormState } from "@/lib/form";
import { MAX_POST_LENGTH } from "@/lib/validation";
import type { PersonaSummary } from "@/lib/queries";
import { Avatar } from "./Avatar";
import { Button } from "./ui";
import { cn } from "@/lib/cn";

export function Composer({
  slug,
  personas,
  actingPersonaId,
  replyToPostId,
  placeholder = "What's happening in the realm?",
  autoFocus = false,
}: {
  slug: string;
  personas: PersonaSummary[];
  actingPersonaId: number;
  replyToPostId?: number;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    createPostAction,
    emptyFormState,
  );

  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [authorId, setAuthorId] = useState(actingPersonaId);
  const [personaOpen, setPersonaOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [localWhen, setLocalWhen] = useState("");

  const draftRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const author = personas.find((p) => p.id === authorId) ?? personas[0];
  const remaining = MAX_POST_LENGTH - content.length;
  const over = remaining < 0;
  const empty = content.trim().length === 0 && !imageUrl;
  const scheduledIso =
    scheduleOpen && localWhen ? new Date(localWhen).toISOString() : "";

  // reset after a successful post, and nudge any visible feed to pull it in
  useEffect(() => {
    if (state.ok) {
      setContent("");
      setImageUrl("");
      setScheduleOpen(false);
      setLocalWhen("");
      window.dispatchEvent(new Event("skald:posted"));
    }
  }, [state]);

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
        const { url } = await res.json();
        setImageUrl(url);
      } else if (res.status === 501) {
        const url = window.prompt(
          "Image upload isn't configured. Paste an image URL instead:",
        );
        if (url) setImageUrl(url);
      } else {
        const data = await res.json().catch(() => ({ error: "Upload failed." }));
        window.alert(data.error ?? "Upload failed.");
      }
    } finally {
      setUploading(false);
    }
  }

  function addImageUrl() {
    const url = window.prompt("Paste an image URL:");
    if (url) setImageUrl(url);
  }

  const minDateTime = (() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
  })();

  return (
    <form action={formAction} className="flex gap-3 px-4 py-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="authorPersonaId" value={authorId} />
      <input type="hidden" name="imageUrl" value={imageUrl} />
      <input type="hidden" name="scheduledAt" value={scheduledIso} />
      <input ref={draftRef} type="hidden" name="asDraft" value="" />
      {replyToPostId ? (
        <input type="hidden" name="replyToPostId" value={replyToPostId} />
      ) : null}

      <div className="pt-1">
        <Avatar name={author.displayName} avatarUrl={author.avatarUrl} size={44} />
      </div>

      <div className="min-w-0 flex-1">
        {/* persona switcher (only when the user has more than one persona) */}
        {personas.length > 1 ? (
          <div className="relative mb-1 inline-block">
            <button
              type="button"
              onClick={() => setPersonaOpen((v) => !v)}
              className="fx-btn inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-primary hover:bg-surface-hover"
            >
              posting as {author.displayName}
              <ChevronDown className="size-3" />
            </button>
            {personaOpen ? (
              <div className="absolute z-20 mt-1 max-h-64 w-60 overflow-auto rounded-base border border-border bg-surface p-1 shadow-lg">
                {personas.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setAuthorId(p.id);
                      setPersonaOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-[calc(var(--app-radius)/1.5)] px-2 py-1.5 text-left text-sm hover:bg-surface-hover",
                      p.id === authorId && "bg-surface-hover",
                    )}
                  >
                    <Avatar name={p.displayName} avatarUrl={p.avatarUrl} size={28} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-text">
                        {p.displayName}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        @{p.handle}
                        {p.isNpc ? " · NPC" : ""}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <textarea
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={replyToPostId ? 2 : 3}
          className="w-full resize-none bg-transparent text-[17px] leading-relaxed text-text placeholder:text-muted/70 focus:outline-none"
        />

        {imageUrl ? (
          <div className="relative mt-2 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              className="max-h-72 rounded-base border border-border object-cover"
            />
            <button
              type="button"
              onClick={() => setImageUrl("")}
              className="fx-btn absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              aria-label="Remove image"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        {scheduleOpen ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-base border border-border bg-bg/40 p-2 text-sm">
            <CalendarClock className="size-4 text-primary" />
            <span className="text-muted">Go live at</span>
            <input
              type="datetime-local"
              min={minDateTime}
              value={localWhen}
              onChange={(e) => setLocalWhen(e.target.value)}
              className="rounded border border-border bg-bg px-2 py-1 text-text"
            />
            <button
              type="button"
              onClick={() => {
                setScheduleOpen(false);
                setLocalWhen("");
              }}
              className="text-muted hover:text-text"
            >
              cancel
            </button>
            <span className="text-xs text-muted">
              (in your local time)
            </span>
          </div>
        ) : null}

        {state.error ? (
          <p className="mt-2 text-sm text-like">{state.error}</p>
        ) : null}

        <div className="mt-2 flex items-center gap-1 border-t border-border pt-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickFile}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="fx-btn rounded-full p-2 text-primary hover:bg-primary/10 disabled:opacity-50"
            aria-label="Add image"
            title="Add image"
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ImagePlus className="size-5" />
            )}
          </button>
          <button
            type="button"
            onClick={addImageUrl}
            className="fx-btn rounded-full p-2 text-primary hover:bg-primary/10"
            aria-label="Add image by URL"
            title="Add image by URL"
          >
            <Link2 className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setScheduleOpen((v) => !v)}
            className={cn(
              "fx-btn rounded-full p-2 hover:bg-primary/10",
              scheduleOpen ? "text-accent" : "text-primary",
            )}
            aria-label="Schedule"
            title="Schedule for later"
          >
            <CalendarClock className="size-5" />
          </button>

          <span
            className={cn(
              "ml-auto text-xs tabular-nums",
              over ? "text-like" : "text-muted",
            )}
          >
            {remaining}
          </span>

          {scheduleOpen ? (
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={pending || empty || over}
              onClick={() => {
                if (draftRef.current) draftRef.current.value = "1";
              }}
            >
              Save draft
            </Button>
          ) : null}

          <Button
            type="submit"
            size="sm"
            disabled={pending || empty || over || (scheduleOpen && !localWhen)}
            onClick={() => {
              if (draftRef.current) draftRef.current.value = "";
            }}
          >
            {pending
              ? "…"
              : replyToPostId
                ? "Reply"
                : scheduleOpen
                  ? "Schedule"
                  : "Post"}
          </Button>
        </div>
      </div>
    </form>
  );
}
