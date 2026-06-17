// Local autosave for an in-progress Composer post. Pure logic, no DOM access at
// module load so it can be unit-tested under the node-env vitest. The React glue
// (debounced save, restore on mount, clear on submit) lives in Composer.tsx.

// Bump this whenever the ComposerDraft shape changes. parseDraft returns null on
// a version mismatch so a future Segment shape change doesn't crash existing
// users sitting on a stale draft in localStorage.
export const DRAFT_VERSION = 1;

export type DraftSegment = { content: string; imageUrl: string };

export type ComposerDraft = {
  segments: DraftSegment[];
  pollOpen: boolean;
  pollOptions: string[];
  pollDays: number;
  scheduleOpen: boolean;
  localWhen: string;
  authorId: number;
  v: number;
};

const KEY_PREFIX = "skald:composer-draft:";

/**
 * Storage key for one composer instance. The feed composer and the /compose
 * page both render with no replyToPostId and intentionally share the "root"
 * key, so a draft started in one shows up in the other. A reply composer gets
 * its own key per parent post.
 */
export function draftStorageKey(slug: string, replyToPostId?: number): string {
  return `${KEY_PREFIX}${slug}:${replyToPostId ?? "root"}`;
}

/** Serialize a draft to JSON, stamping the current version. */
export function serializeDraft(draft: ComposerDraft): string {
  return JSON.stringify({ ...draft, v: DRAFT_VERSION });
}

function isSegment(value: unknown): value is DraftSegment {
  if (typeof value !== "object" || value === null) return false;
  const seg = value as Record<string, unknown>;
  return typeof seg.content === "string" && typeof seg.imageUrl === "string";
}

/**
 * Parse a stored draft. Returns null for null/empty input, malformed JSON, a
 * wrong shape, or a version that doesn't match DRAFT_VERSION. Callers treat null
 * as "no draft to restore", so any doubt degrades to starting fresh.
 */
export function parseDraft(raw: string | null): ComposerDraft | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const d = parsed as Record<string, unknown>;

  if (d.v !== DRAFT_VERSION) return null;
  if (!Array.isArray(d.segments) || d.segments.length === 0) return null;
  if (!d.segments.every(isSegment)) return null;
  if (typeof d.pollOpen !== "boolean") return null;
  if (
    !Array.isArray(d.pollOptions) ||
    !d.pollOptions.every((o) => typeof o === "string")
  ) {
    return null;
  }
  if (typeof d.pollDays !== "number" || !Number.isFinite(d.pollDays)) {
    return null;
  }
  if (typeof d.scheduleOpen !== "boolean") return null;
  if (typeof d.localWhen !== "string") return null;
  if (typeof d.authorId !== "number" || !Number.isFinite(d.authorId)) {
    return null;
  }

  return {
    segments: (d.segments as DraftSegment[]).map((s) => ({
      content: s.content,
      imageUrl: s.imageUrl,
    })),
    pollOpen: d.pollOpen,
    pollOptions: d.pollOptions as string[],
    pollDays: d.pollDays,
    scheduleOpen: d.scheduleOpen,
    localWhen: d.localWhen,
    authorId: d.authorId,
    v: DRAFT_VERSION,
  };
}

/**
 * True when there's nothing worth saving: every segment is blank (no text, no
 * image) and no poll or schedule is in progress. The save effect removes the
 * stored draft rather than writing an empty one.
 */
export function isDraftEmpty(draft: ComposerDraft): boolean {
  const segmentsBlank = draft.segments.every(
    (s) => s.content.trim().length === 0 && !s.imageUrl,
  );
  return segmentsBlank && !draft.pollOpen && !draft.scheduleOpen;
}
