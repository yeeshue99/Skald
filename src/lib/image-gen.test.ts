import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  imageGenEnabled,
  generateAvatar,
  generatePostImage,
  placeholderAvatar,
  placeholderPostImage,
} from "@/lib/image-gen";

// Imports ONLY the image-gen module so no db pool is constructed.

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  // Start each test from a clean slate: no key, no provider overrides.
  delete process.env.IMAGE_GEN_API_KEY;
  delete process.env.IMAGE_GEN_PROVIDER;
  delete process.env.IMAGE_GEN_MODEL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("placeholders (the keyless source of truth)", () => {
  it("placeholderAvatar matches today's DiceBear shape, seeded by handle", () => {
    expect(placeholderAvatar("Aria")).toBe(
      "https://api.dicebear.com/9.x/adventurer/svg?seed=Aria",
    );
    // handles needing encoding are escaped
    expect(placeholderAvatar("two words")).toBe(
      "https://api.dicebear.com/9.x/adventurer/svg?seed=two%20words",
    );
  });

  it("placeholderPostImage matches today's picsum shape, seeded by 'skald-' + ref at 900x506", () => {
    expect(placeholderPostImage("p1")).toBe(
      "https://picsum.photos/seed/skald-p1/900/506",
    );
  });
});

describe("imageGenEnabled", () => {
  it("is false when no key is set", () => {
    expect(imageGenEnabled()).toBe(false);
  });

  it("is false when the key is blank/whitespace", () => {
    process.env.IMAGE_GEN_API_KEY = "   ";
    expect(imageGenEnabled()).toBe(false);
  });

  it("is true when a key is set (read on each call, not cached)", () => {
    expect(imageGenEnabled()).toBe(false);
    process.env.IMAGE_GEN_API_KEY = "sk-test";
    expect(imageGenEnabled()).toBe(true);
  });
});

describe("generateAvatar / generatePostImage with no key", () => {
  it("returns EXACTLY the placeholder avatar and never calls fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(generateAvatar({ handle: "Aria", hint: "a wise elf" })).resolves.toBe(
      placeholderAvatar("Aria"),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns EXACTLY the placeholder post image and never calls fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(generatePostImage({ ref: "p1", hint: "a burning bridge" })).resolves.toBe(
      placeholderPostImage("p1"),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("no usable hint returns the placeholder even with a key", () => {
  beforeEach(() => {
    process.env.IMAGE_GEN_API_KEY = "sk-test";
  });

  it("avatar with undefined hint -> placeholder, no fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(generateAvatar({ handle: "Aria" })).resolves.toBe(placeholderAvatar("Aria"));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("post image with whitespace-only hint -> placeholder, no fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(generatePostImage({ ref: "p1", hint: "   " })).resolves.toBe(
      placeholderPostImage("p1"),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("enabled path with mocked fetch", () => {
  beforeEach(() => {
    process.env.IMAGE_GEN_API_KEY = "sk-test";
  });

  it("calls fetch with a hint-derived prompt and returns a hosted URL", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ url: "https://cdn.example/generated.png" }] }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const url = await generateAvatar({ handle: "Aria", hint: "a wise elf" });
    expect(url).toBe("https://cdn.example/generated.png");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string) as { prompt: string };
    expect(body.prompt).toContain("a wise elf");
    // an AbortController signal is attached so a hung provider can be cut off
    expect((init as RequestInit).signal).toBeDefined();
  });

  it("falls back to the placeholder when fetch throws (never rejects)", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchSpy);
    await expect(generateAvatar({ handle: "Aria", hint: "a wise elf" })).resolves.toBe(
      placeholderAvatar("Aria"),
    );
  });

  it("falls back to the placeholder on a non-ok response", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchSpy);
    await expect(generatePostImage({ ref: "p1", hint: "a burning bridge" })).resolves.toBe(
      placeholderPostImage("p1"),
    );
  });

  it("falls back when the provider returns base64 but no blob store is configured", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: Buffer.from("png-bytes").toString("base64") }] }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    await expect(generatePostImage({ ref: "p1", hint: "a burning bridge" })).resolves.toBe(
      placeholderPostImage("p1"),
    );
  });
});
