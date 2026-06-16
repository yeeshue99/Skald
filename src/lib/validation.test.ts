import { describe, it, expect } from "vitest";
import {
  slugify,
  normalizeHandle,
  normalizeUsername,
  registerSchema,
  loginSchema,
  createCampaignSchema,
  personaSchema,
  composeSchema,
  pollInputSchema,
  MAX_POST_LENGTH,
} from "@/lib/validation";

describe("slugify", () => {
  it("lowercases, hyphenates, trims", () => {
    expect(slugify("The Sunken Crown")).toBe("the-sunken-crown");
    expect(slugify("  STR/X!!  ")).toBe("str-x");
    expect(slugify("---a---")).toBe("a");
  });
  it("falls back to 'campaign' when nothing usable remains", () => {
    expect(slugify("")).toBe("campaign");
    expect(slugify("!!!")).toBe("campaign");
  });
  it("caps at 40 chars", () => {
    expect(slugify("a".repeat(60)).length).toBeLessThanOrEqual(40);
  });
});

describe("normalizeHandle / normalizeUsername", () => {
  it("strips a leading @ and surrounding whitespace from handles", () => {
    expect(normalizeHandle("  @Bard ")).toBe("Bard");
    expect(normalizeHandle("@@x")).toBe("x");
  });
  it("trims usernames", () => {
    expect(normalizeUsername("  alice  ")).toBe("alice");
  });
});

describe("personaSchema", () => {
  it("accepts a valid persona, strips @, applies defaults", () => {
    const r = personaSchema.safeParse({ handle: "@Bard", displayName: "The Bard" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.handle).toBe("Bard");
      expect(r.data.avatarFrame).toBe("default");
      expect(r.data.bio).toBe("");
    }
  });
  it("rejects a too-short or spaced handle", () => {
    expect(personaSchema.safeParse({ handle: "a", displayName: "x" }).success).toBe(false);
    expect(personaSchema.safeParse({ handle: "has space", displayName: "x" }).success).toBe(false);
  });
  it("rejects an over-long display name", () => {
    expect(personaSchema.safeParse({ handle: "bard", displayName: "x".repeat(41) }).success).toBe(false);
  });
  it("rejects a non-http(s) avatar URL", () => {
    expect(personaSchema.safeParse({ handle: "bard", displayName: "x", avatarUrl: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("composeSchema", () => {
  it("accepts content within the cap and coerces flags", () => {
    const r = composeSchema.safeParse({ content: "hi", asDraft: "true", replyToPostId: "12" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.asDraft).toBe(true);
      expect(r.data.replyToPostId).toBe(12);
    }
  });
  it("rejects content over the cap", () => {
    expect(composeSchema.safeParse({ content: "x".repeat(MAX_POST_LENGTH + 1) }).success).toBe(false);
  });
  it("rejects a non-positive replyToPostId", () => {
    expect(composeSchema.safeParse({ content: "x", replyToPostId: "0" }).success).toBe(false);
    expect(composeSchema.safeParse({ content: "x", replyToPostId: "-1" }).success).toBe(false);
  });
});

describe("pollInputSchema", () => {
  it("accepts 2-4 options and a valid length", () => {
    expect(pollInputSchema.safeParse({ options: ["a", "b"], days: "3" }).success).toBe(true);
  });
  it("rejects fewer than 2 or more than 4 options", () => {
    expect(pollInputSchema.safeParse({ options: ["a"], days: 1 }).success).toBe(false);
    expect(pollInputSchema.safeParse({ options: ["a", "b", "c", "d", "e"], days: 1 }).success).toBe(false);
  });
  it("rejects a length not in the allowed set", () => {
    expect(pollInputSchema.safeParse({ options: ["a", "b"], days: 2 }).success).toBe(false);
  });
});

describe("auth + campaign schemas", () => {
  it("registerSchema enforces username, password, and handle rules", () => {
    const base = { inviteCode: "X", displayName: "Al", handle: "al" };
    expect(registerSchema.safeParse({ ...base, username: "al", password: "longenough" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, username: "alice", password: "short" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, username: "alice", password: "longenough" }).success).toBe(true);
  });
  it("loginSchema requires both fields", () => {
    expect(loginSchema.safeParse({ username: "", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ username: "a", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ username: "a", password: "x" }).success).toBe(true);
  });
  it("createCampaignSchema requires a preset id", () => {
    expect(createCampaignSchema.safeParse({ name: "My Game", presetId: "", dmDisplayName: "DM", dmHandle: "dm" }).success).toBe(false);
    expect(createCampaignSchema.safeParse({ name: "My Game", presetId: "strix", dmDisplayName: "DM", dmHandle: "dm" }).success).toBe(true);
  });
});
