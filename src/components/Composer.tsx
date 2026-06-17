"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
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
import {
  MAX_POST_LENGTH,
  POLL_DAY_CHOICES,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_OPTION_MAX,
} from "@/lib/validation";
import type { PersonaSummary } from "@/lib/queries";
import {
  DRAFT_VERSION,
  draftStorageKey,
  isDraftEmpty,
  parseDraft,
  serializeDraft,
  type ComposerDraft,
} from "@/lib/composer-draft";
import { Avatar } from "./Avatar";
import { MentionTextarea } from "./MentionTextarea";
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
  const [pollOpen, setPollOpen] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollDays, setPollDays] = useState<number>(POLL_DAY_CHOICES[0]);

  const draftRef = useRef<HTMLInputElement>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Local autosave. The feed composer and /compose share the root key on
  // purpose (both render with no replyToPostId), so a draft started in one is
  // offered in the other.
  const storageKey = useMemo(
    () => draftStorageKey(slug, replyToPostId),
    [slug, replyToPostId],
  );
  // Guards the save effect against re-serializing immediately after restore, and
  // skips the very first save so restoring identical data isn't a no-op write.
  const hasRestoredRef = useRef(false);
  // Shared handle for the pending debounced save, cleared in the success effect
  // so a stale timer can't re-write the draft after it's been cleared.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const trimmedPollOptions = pollOptions.map((o) => o.trim());
  const pollFilled = trimmedPollOptions.filter(Boolean).length;
  const pollValid = pollFilled >= POLL_MIN_OPTIONS;
  // a poll post needs a question (the first segment's text) and enough options;
  // a normal post just needs some content
  const canSubmit = pollOpen
    ? segments[0].content.trim().length > 0 && pollValid && !anyOver
    : hasContent && !anyOver;

  // Restore a saved draft once, on mount. Done in an effect (not during render)
  // so the controlled textareas hydrate from server-empty markup first and we
  // don't trip a hydration mismatch. localStorage is wrapped because it throws
  // in some private-mode / blocked-storage configs.
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(storageKey);
    } catch {
      return;
    }
    const draft = parseDraft(raw);
    if (!draft) return;

    /* eslint-disable react-hooks/set-state-in-effect */
    setSegments(draft.segments.map((s) => ({ ...s })));
    setPollOpen(draft.pollOpen);
    setPollOptions(draft.pollOptions.length ? draft.pollOptions : ["", ""]);
    setPollDays(draft.pollDays);
    setAuthorId(draft.authorId);

    if (draft.scheduleOpen) {
      // Recompute the picker floor the same way toggleSchedule does, then drop a
      // restored time that's now in the past so we never restore an
      // unsubmittable schedule.
      const d = new Date(Date.now() + 5 * 60 * 1000);
      const off = d.getTimezoneOffset();
      const min = new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
      setMinDateTime(min);
      setScheduleOpen(true);
      setLocalWhen(draft.localWhen && draft.localWhen >= min ? draft.localWhen : "");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [storageKey]);

  // Debounced save on every draft change. Skips the first run right after
  // restore, and skips entirely once a post has succeeded so it can't race the
  // success effect's clear. All storage access is guarded.
  useEffect(() => {
    if (!hasRestoredRef.current || state.ok) return;
    const draft: ComposerDraft = {
      segments,
      pollOpen,
      pollOptions,
      pollDays,
      scheduleOpen,
      localWhen,
      authorId,
      v: DRAFT_VERSION,
    };
    saveTimerRef.current = setTimeout(() => {
      try {
        if (isDraftEmpty(draft)) {
          window.localStorage.removeItem(storageKey);
        } else {
          window.localStorage.setItem(storageKey, serializeDraft(draft));
        }
      } catch {
        // QuotaExceededError / SecurityError in private modes: keep composing.
      }
    }, 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [
    storageKey,
    segments,
    pollOpen,
    pollOptions,
    pollDays,
    scheduleOpen,
    localWhen,
    authorId,
    state.ok,
  ]);

  // reset after a successful post, and nudge any visible feed to pull it in
  useEffect(() => {
    if (state.ok) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setSegments([{ content: "", imageUrl: "" }]);
      setScheduleOpen(false);
      setLocalWhen("");
      setPollOpen(false);
      setPollOptions(["", ""]);
      setPollDays(POLL_DAY_CHOICES[0]);
      /* eslint-enable react-hooks/set-state-in-effect */
      // Cancel any pending debounced save before clearing so a stale timer can't
      // re-write the draft we're about to remove.
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // ignore: storage blocked, nothing to clean up
      }
      window.dispatchEvent(new Event("skald:posted"));
    }
  }, [state, storageKey]);

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

  function togglePoll() {
    const next = !pollOpen;
    if (next) {
      // a poll is a single post: collapse any thread, drop the image, and close
      // the scheduler (polls publish immediately)
      setSegments((s) => [{ content: s[0].content, imageUrl: "" }]);
      setScheduleOpen(false);
      setLocalWhen("");
      setPollOptions(["", ""]);
      setPollDays(POLL_DAY_CHOICES[0]);
    }
    setPollOpen(next);
  }
  function patchPollOption(i: number, val: string) {
    setPollOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)));
  }
  function addPollOption() {
    setPollOptions((prev) =>
      prev.length >= POLL_MAX_OPTIONS ? prev : [...prev, ""],
    );
  }
  function removePollOption(i: number) {
    setPollOptions((prev) =>
      prev.length <= POLL_MIN_OPTIONS ? prev : prev.filter((_, idx) => idx !== i),
    );
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
    <form
      action={formAction}
      onReset={(e) => e.preventDefault()}
      className="px-4 py-3"
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="authorPersonaId" value={authorId} />
      <input type="hidden" name="segments" value={JSON.stringify(segments)} />
      <input type="hidden" name="scheduledAt" value={scheduledIso} />
      <input
        type="hidden"
        name="pollOptions"
        value={pollOpen ? JSON.stringify(trimmedPollOptions.filter(Boolean)) : ""}
      />
      <input
        type="hidden"
        name="pollDays"
        value={pollOpen ? String(pollDays) : ""}
      />
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

              <MentionTextarea
                slug={slug}
                value={seg.content}
                onChange={(next) => patchSegment(i, { content: next })}
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
                  disabled={pollOpen || uploadingIndex === i}
                  className="fx-btn rounded-full p-1.5 text-primary hover:bg-primary/10 disabled:opacity-40"
                  aria-label="Add image"
                  title={pollOpen ? "A post can have a poll or an image" : "Add image"}
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
                  disabled={pollOpen}
                  className="fx-btn rounded-full p-1.5 text-primary hover:bg-primary/10 disabled:opacity-40"
                  aria-label="Add image by URL"
                  title={pollOpen ? "A post can have a poll or an image" : "Add image by URL"}
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

      {/* add another post to the thread (not while building a poll) */}
      {!pollOpen ? (
        <button
          type="button"
          onClick={addSegment}
          disabled={lastEmpty || segments.length >= MAX_THREAD_POSTS}
          className="fx-btn ml-14 mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-40"
        >
          <Plus className="size-4" /> Add another post
        </button>
      ) : null}

      {/* poll editor */}
      {pollOpen ? (
        <div className="ml-14 mt-2 space-y-2 rounded-base border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text">Poll</span>
            <button
              type="button"
              onClick={togglePoll}
              className="fx-btn rounded-full p-1 text-muted hover:bg-like/10 hover:text-like"
              aria-label="Remove poll"
              title="Remove poll"
            >
              <X className="size-4" />
            </button>
          </div>
          {pollOptions.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={opt}
                onChange={(e) => patchPollOption(i, e.target.value)}
                maxLength={POLL_OPTION_MAX}
                placeholder={`Option ${i + 1}`}
                className="w-full rounded-base border border-border bg-bg/60 px-3 py-1.5 text-sm text-text placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {pollOptions.length > POLL_MIN_OPTIONS ? (
                <button
                  type="button"
                  onClick={() => removePollOption(i)}
                  className="fx-btn rounded-full p-1 text-muted hover:text-like"
                  aria-label={`Remove option ${i + 1}`}
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            {pollOptions.length < POLL_MAX_OPTIONS ? (
              <button
                type="button"
                onClick={addPollOption}
                className="fx-btn inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                <Plus className="size-4" /> Add option
              </button>
            ) : (
              <span />
            )}
            <label className="flex items-center gap-1.5 text-xs text-muted">
              Poll length
              <select
                value={pollDays}
                onChange={(e) => setPollDays(Number(e.target.value))}
                className="rounded border border-border bg-bg px-2 py-1 text-text"
              >
                {POLL_DAY_CHOICES.map((d) => (
                  <option key={d} value={d}>
                    {d} day{d > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
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
          disabled={pollOpen}
          className={cn(
            "fx-btn rounded-full p-2 hover:bg-primary/10 disabled:opacity-40",
            scheduleOpen ? "text-accent" : "text-primary",
          )}
          aria-label="Schedule"
          title={pollOpen ? "A poll can't be scheduled" : "Schedule for later"}
        >
          <CalendarClock className="size-5" />
        </button>
        <button
          type="button"
          onClick={togglePoll}
          disabled={isThread || Boolean(segments[0].imageUrl)}
          className={cn(
            "fx-btn rounded-full p-2 hover:bg-primary/10 disabled:opacity-40",
            pollOpen ? "text-accent" : "text-primary",
          )}
          aria-label="Add poll"
          title={
            isThread || segments[0].imageUrl
              ? "A poll can't be combined with a thread or image"
              : "Add a poll"
          }
        >
          <BarChart3 className="size-5" />
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
              disabled={pending || !canSubmit}
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
            disabled={pending || !canSubmit || (scheduleOpen && !localWhen)}
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
