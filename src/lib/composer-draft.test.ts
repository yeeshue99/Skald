import { describe, it, expect } from "vitest";
import {
  DRAFT_VERSION,
  draftStorageKey,
  serializeDraft,
  parseDraft,
  isDraftEmpty,
  type ComposerDraft,
} from "@/lib/composer-draft";

function makeDraft(over: Partial<ComposerDraft> = {}): ComposerDraft {
  return {
    segments: [{ content: "", imageUrl: "" }],
    pollOpen: false,
    pollOptions: ["", ""],
    pollDays: 1,
    scheduleOpen: false,
    localWhen: "",
    authorId: 7,
    v: DRAFT_VERSION,
    ...over,
  };
}

describe("draftStorageKey", () => {
  it("is deterministic for the same inputs", () => {
    expect(draftStorageKey("crown")).toBe(draftStorageKey("crown"));
    expect(draftStorageKey("crown", 42)).toBe(draftStorageKey("crown", 42));
  });

  it("distinguishes by slug", () => {
    expect(draftStorageKey("crown")).not.toBe(draftStorageKey("abyss"));
  });

  it("uses the shared root key when there's no replyToPostId", () => {
    expect(draftStorageKey("crown")).toBe("skald:composer-draft:crown:root");
    expect(draftStorageKey("crown", undefined)).toBe(
      "skald:composer-draft:crown:root",
    );
  });

  it("distinguishes root from a reply, and replies from each other", () => {
    expect(draftStorageKey("crown")).not.toBe(draftStorageKey("crown", 1));
    expect(draftStorageKey("crown", 1)).not.toBe(draftStorageKey("crown", 2));
    expect(draftStorageKey("crown", 1)).toBe("skald:composer-draft:crown:1");
  });
});

describe("serializeDraft / parseDraft round-trip", () => {
  it("round-trips a fully populated draft including the version", () => {
    const draft = makeDraft({
      segments: [
        { content: "hello realm", imageUrl: "https://img/1.png" },
        { content: "thread two", imageUrl: "" },
      ],
      pollOpen: true,
      pollOptions: ["yes", "no", "maybe"],
      pollDays: 7,
      scheduleOpen: true,
      localWhen: "2026-06-20T12:30",
      authorId: 3,
    });
    const restored = parseDraft(serializeDraft(draft));
    expect(restored).toEqual(draft);
    expect(restored?.v).toBe(DRAFT_VERSION);
  });

  it("stamps the current version even if the draft carried a stale one", () => {
    const draft = makeDraft({ v: 999 });
    const raw = serializeDraft(draft);
    expect(JSON.parse(raw).v).toBe(DRAFT_VERSION);
    expect(parseDraft(raw)?.v).toBe(DRAFT_VERSION);
  });
});

describe("parseDraft returns null", () => {
  it("for null or empty input", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("")).toBeNull();
  });

  it("for malformed JSON", () => {
    expect(parseDraft("{not json")).toBeNull();
    expect(parseDraft("undefined")).toBeNull();
  });

  it("for a non-object JSON value", () => {
    expect(parseDraft("42")).toBeNull();
    expect(parseDraft("null")).toBeNull();
    expect(parseDraft('"a string"')).toBeNull();
  });

  it("for a version mismatch", () => {
    const raw = JSON.stringify({ ...makeDraft(), v: DRAFT_VERSION + 1 });
    expect(parseDraft(raw)).toBeNull();
  });

  it("for a wrong shape (missing or mistyped fields)", () => {
    expect(parseDraft(JSON.stringify({ v: DRAFT_VERSION }))).toBeNull();
    // segments not an array
    expect(
      parseDraft(JSON.stringify({ ...makeDraft(), segments: "nope" })),
    ).toBeNull();
    // empty segments array
    expect(
      parseDraft(JSON.stringify({ ...makeDraft(), segments: [] })),
    ).toBeNull();
    // a segment missing imageUrl
    expect(
      parseDraft(
        JSON.stringify({ ...makeDraft(), segments: [{ content: "x" }] }),
      ),
    ).toBeNull();
    // pollOptions holds a non-string
    expect(
      parseDraft(JSON.stringify({ ...makeDraft(), pollOptions: [1, 2] })),
    ).toBeNull();
    // authorId not a number
    expect(
      parseDraft(JSON.stringify({ ...makeDraft(), authorId: "7" })),
    ).toBeNull();
    // scheduleOpen not a boolean
    expect(
      parseDraft(JSON.stringify({ ...makeDraft(), scheduleOpen: "yes" })),
    ).toBeNull();
  });
});

describe("isDraftEmpty", () => {
  it("is true for the default blank draft", () => {
    expect(isDraftEmpty(makeDraft())).toBe(true);
  });

  it("treats whitespace-only segments as blank", () => {
    expect(
      isDraftEmpty(makeDraft({ segments: [{ content: "   \n ", imageUrl: "" }] })),
    ).toBe(true);
  });

  it("is false when a segment has content", () => {
    expect(
      isDraftEmpty(makeDraft({ segments: [{ content: "hi", imageUrl: "" }] })),
    ).toBe(false);
  });

  it("is false when a segment has an image", () => {
    expect(
      isDraftEmpty(
        makeDraft({ segments: [{ content: "", imageUrl: "https://x/y.png" }] }),
      ),
    ).toBe(false);
  });

  it("is false when a poll is open", () => {
    expect(isDraftEmpty(makeDraft({ pollOpen: true }))).toBe(false);
  });

  it("is false when the scheduler is open", () => {
    expect(isDraftEmpty(makeDraft({ scheduleOpen: true }))).toBe(false);
  });
});
