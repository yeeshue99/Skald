"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  ImagePlus,
  Link2,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { createPostAction } from "@/app/actions/posts";
import { emptyFormState } from "@/lib/form";
import { MAX_POST_LENGTH } from "@/lib/validation";
import type { PersonaSummary } from "@/lib/queries";
import { Avatar } from "./Avatar";
import { Button } from "./ui";
import { cn } from "@/lib/cn";

// keep in sync with MAX_THREAD_POSTS in app/actions/posts.ts
const MAX_THREAD_POSTS = 25;

type Segment = { content: string; imageUrl: string };

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

  const [segments, setSegments] = useState<Segment[]>([
    { content: "", imageUrl: "" },
  ]);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [authorId, setAuthorId] = useState(actingPersonaId);
  const [personaOpen, setPersonaOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [localWhen, setLocalWhen] = useState("");
  const [minDateTime, setMinDateTime] = useState("");

  const draftRef = useRef<HTMLInputElement>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const author = personas.find((p) => p.id === authorId) ?? personas[0];
  const isThread = segments.length > 1;
  const anyOver = segments.some((s) => s.content.length > MAX_POST_LENGTH);
  const hasContent = segments.some(
    (s) => s.content.trim().length > 0 || s.imageUrl,
  );
  const lastSeg = segments[segments.length - 1];
  const lastEmpty = lastSeg.content.trim().length === 0 && !lastSeg.imageUrl;
  const scheduledIso =
    scheduleOpen && localWhen ? new Date(localWhen).toISOString() : "";

  // reset after a successful post, and nudge any visible feed to pull it in
  useEffect(() => {
    if (state.ok) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setSegments([{ content: "", imageUrl: "" }]);
      setScheduleOpen(false);
      setLocalWhen("");
      /* eslint-enable react-hooks/set-state-in-effect */
      window.dispatchEvent(new Event("skald:posted"));
    }
  }, [state]);

  function patchSegment(i: number, patch: Partial<Segment>) {
    setSegments((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );
  }
  function addSegment() {
    setSegments((prev) =>
      prev.length >= MAX_THREAD_POSTS
        ? prev
        : [...prev, { content: "", imageUrl: "" }],
    );
  }
  function removeSegment(i: number) {
    setSegments((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i),
    );
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>, i: number) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingIndex(i);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const { url } = await res.json();
        patchSegment(i, { imageUrl: url });
      } else if (res.status === 501) {
        const url = window.prompt(
          "Image upload isn't configured. Paste an image URL instead:",
        );
        if (url) patchSegment(i, { imageUrl: url });
      } else {
        const data = await res.json().catch(() => ({ error: "Upload failed." }));
        window.alert(data.error ?? "Upload failed.");
      }
    } finally {
      setUploadingIndex(null);
    }
  }

  function addImageUrl(i: number) {
    const url = window.prompt("Paste an image URL:");
    if (url) patchSegment(i, { imageUrl: url });
  }

  function toggleSchedule() {
    const opening = !scheduleOpen;
    if (opening) {
      // floor the picker ~5 min out, computed in this handler rather than during
      // render (Date.now() is impure and not allowed in render).
      const d = new Date(Date.now() + 5 * 60 * 1000);
      const off = d.getTimezoneOffset();
      setMinDateTime(
        new Date(d.getTime() - off * 60000).toISOString().slice(0, 16),
      );
    }
    setScheduleOpen(opening);
  }

  const submitLabel = pending
    ? "…"
    : isThread
      ? replyToPostId
        ? "Reply all"
        : "Post all"
      : replyToPostId
        ? "Reply"
        : scheduleOpen
          ? "Schedule"
          : "Post";

  return (
    <form action={formAction} className="px-4 py-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="authorPersonaId" value={authorId} />
      <input type="hidden" name="segments" value={JSON.stringify(segments)} />
      <input type="hidden" name="scheduledAt" value={scheduledIso} />
      <input ref={draftRef} type="hidden" name="asDraft" value="" />
      {replyToPostId ? (
        <input type="hidden" name="replyToPostId" value={replyToPostId} />
      ) : null}

      {segments.map((seg, i) => {
        const remaining = MAX_POST_LENGTH - seg.content.length;
        const over = remaining < 0;
        const isLast = i === segments.length - 1;
        return (
          <div key={i} className="flex gap-3">
            {/* avatar column, with a connector line down to the next segment */}
            <div className="flex flex-col items-center">
              <Avatar
                name={author.displayName}
                avatarUrl={author.avatarUrl}
                size={i === 0 ? 44 : 40}
                frame={author.avatarFrame}
              />
              {!isLast ? (
                <div className="mt-1 w-0.5 flex-1 rounded-full bg-border" />
              ) : null}
            </div>

            <div className={cn("min-w-0 flex-1", !isLast && "pb-3")}>
              {/* persona switcher (only on the first segment, when relevant) */}
              {i === 0 && personas.length > 1 ? (
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
                          <Avatar
                            name={p.displayName}
                            avatarUrl={p.avatarUrl}
                            size={28}
                            frame={p.avatarFrame}
                          />
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
                value={seg.content}
                onChange={(e) => patchSegment(i, { content: e.target.value })}
                placeholder={i === 0 ? placeholder : "Add another post…"}
                autoFocus={autoFocus && i === 0}
                rows={i === 0 ? (replyToPostId ? 2 : 3) : 2}
                className="w-full resize-none bg-transparent text-[17px] leading-relaxed text-text placeholder:text-muted/70 focus:outline-none"
              />

              {seg.imageUrl ? (
                <div className="relative mt-1 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={seg.imageUrl}
                    alt=""
                    className="max-h-72 rounded-base border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => patchSegment(i, { imageUrl: "" })}
                    className="fx-btn absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                    aria-label="Remove image"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : null}

              {/* per-segment controls */}
              <div className="mt-1 flex items-center gap-1">
                <input
                  ref={(el) => {
                    fileRefs.current[i] = el;
                  }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickFile(e, i)}
                />
                <button
                  type="button"
                  onClick={() => fileRefs.current[i]?.click()}
                  disabled={uploadingIndex === i}
                  className="fx-btn rounded-full p-1.5 text-primary hover:bg-primary/10 disabled:opacity-50"
                  aria-label="Add image"
                  title="Add image"
                >
                  {uploadingIndex === i ? (
                    <Loader2 className="size-4.5 animate-spin" />
                  ) : (
                    <ImagePlus className="size-4.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => addImageUrl(i)}
                  className="fx-btn rounded-full p-1.5 text-primary hover:bg-primary/10"
                  aria-label="Add image by URL"
                  title="Add image by URL"
                >
                  <Link2 className="size-4.5" />
                </button>

                {isThread ? (
                  <button
                    type="button"
                    onClick={() => removeSegment(i)}
                    className="fx-btn rounded-full p-1.5 text-muted hover:bg-like/10 hover:text-like"
                    aria-label="Remove this post"
                    title="Remove this post"
                  >
                    <X className="size-4.5" />
                  </button>
                ) : null}

                <span
                  className={cn(
                    "ml-auto text-xs tabular-nums",
                    over ? "text-like" : "text-muted",
                  )}
                >
                  {remaining}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {/* add another post to the thread */}
      <button
        type="button"
        onClick={addSegment}
        disabled={lastEmpty || segments.length >= MAX_THREAD_POSTS}
        className="fx-btn ml-14 mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-40"
      >
        <Plus className="size-4" /> Add another post
      </button>

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
          <span className="text-xs text-muted">(in your local time)</span>
        </div>
      ) : null}

      {state.error ? (
        <p className="mt-2 text-sm text-like">{state.error}</p>
      ) : null}

      <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
        <button
          type="button"
          onClick={toggleSchedule}
          className={cn(
            "fx-btn rounded-full p-2 hover:bg-primary/10",
            scheduleOpen ? "text-accent" : "text-primary",
          )}
          aria-label="Schedule"
          title="Schedule for later"
        >
          <CalendarClock className="size-5" />
        </button>

        {isThread ? (
          <span className="text-xs text-muted tabular-nums">
            {segments.length} posts
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {scheduleOpen ? (
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={pending || !hasContent || anyOver}
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
            disabled={
              pending || !hasContent || anyOver || (scheduleOpen && !localWhen)
            }
            onClick={() => {
              if (draftRef.current) draftRef.current.value = "";
            }}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
