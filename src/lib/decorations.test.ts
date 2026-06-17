import { describe, it, expect } from "vitest";
import {
  DEFAULT_THEME,
  STRIX_THEME,
  normalizeDecorationSpec,
  safeCssUrl,
  campaignRenderProps,
  type DecorationSpec,
} from "@/lib/themes";
import { decorationSchema } from "@/lib/validation";

const backdrop = (over: Partial<DecorationSpec> = {}): DecorationSpec => ({
  kind: "backdrop",
  imageUrl: "https://x.public.blob.vercel-storage.com/uploads/u1-abc.png",
  fit: "tile",
  size: 240,
  opacity: 0.5,
  scroll: "static",
  ...over,
});

describe("safeCssUrl", () => {
  it("wraps a safe http(s) image url (hyphens allowed)", () => {
    expect(
      safeCssUrl("https://x.public.blob.vercel-storage.com/uploads/u1-abc.png"),
    ).toBe('url("https://x.public.blob.vercel-storage.com/uploads/u1-abc.png")');
  });
  it("rejects non-http(s) schemes", () => {
    expect(safeCssUrl("javascript:alert(1)")).toBe("none");
    expect(safeCssUrl("data:image/png;base64,AAAA")).toBe("none");
  });
  it("rejects url() breakout and whitespace/control chars", () => {
    expect(safeCssUrl('https://e.com/a".png')).toBe("none");
    expect(safeCssUrl("https://e.com/a b.png")).toBe("none");
    expect(safeCssUrl("https://e.com/a\nb.png")).toBe("none");
  });
  it("returns none for empty input", () => {
    expect(safeCssUrl("")).toBe("none");
    expect(safeCssUrl(null)).toBe("none");
  });
});

describe("normalizeDecorationSpec", () => {
  it("clamps size and opacity into range", () => {
    expect(normalizeDecorationSpec(backdrop({ size: 5000 })).size).toBe(1024);
    expect(normalizeDecorationSpec(backdrop({ size: 1 })).size).toBe(24);
    expect(normalizeDecorationSpec(backdrop({ opacity: 5 })).opacity).toBe(1);
    expect(normalizeDecorationSpec(backdrop({ opacity: -1 })).opacity).toBe(0);
  });
  it("coerces unknown fit/scroll to safe defaults", () => {
    const out = normalizeDecorationSpec(
      backdrop({
        fit: "weird" as DecorationSpec["fit"],
        scroll: "spin" as DecorationSpec["scroll"],
      }),
    );
    expect(out.fit).toBe("tile");
    expect(out.scroll).toBe("static");
  });
});

describe("campaignRenderProps", () => {
  it("matches the bare theme attrs when no decoration is selected", () => {
    const { dataAttrs, cssVars } = campaignRenderProps(DEFAULT_THEME, null);
    expect(dataAttrs["data-texture"]).toBe("none");
    expect(cssVars.colorScheme).toBe("dark");
    expect(dataAttrs["data-texture"]).not.toBe("custom");
  });

  it("repoints the backdrop at a custom image and takes over opacity", () => {
    const { dataAttrs, cssVars } = campaignRenderProps(
      STRIX_THEME,
      backdrop({ opacity: 0.4, scroll: "down" }),
    );
    expect(dataAttrs["data-texture"]).toBe("custom");
    expect(cssVars["--texture-image" as keyof typeof cssVars]).toContain("url(");
    expect(cssVars["--texture-opacity" as keyof typeof cssVars]).toBe("0.4");
    expect(cssVars["--texture-size" as keyof typeof cssVars]).toBe("240px");
    expect(cssVars["--texture-repeat" as keyof typeof cssVars]).toBe("repeat");
    // a moving custom backdrop sets its own scroll direction
    expect(dataAttrs["data-bg-scroll"]).toBe("down");
  });

  it("uses cover sizing and clears motion for a still cover backdrop", () => {
    // STR/X's campaign texture scrolls "down"; a static custom pick must clear it
    const { dataAttrs, cssVars } = campaignRenderProps(
      STRIX_THEME,
      backdrop({ fit: "cover", scroll: "static" }),
    );
    expect(cssVars["--texture-size" as keyof typeof cssVars]).toBe("cover");
    expect(cssVars["--texture-repeat" as keyof typeof cssVars]).toBe("no-repeat");
    expect(dataAttrs["data-bg-scroll"]).toBeUndefined();
  });

  it("ignores an unsafe image url and keeps the campaign texture", () => {
    const { dataAttrs } = campaignRenderProps(
      STRIX_THEME,
      backdrop({ imageUrl: "javascript:alert(1)" }),
    );
    expect(dataAttrs["data-texture"]).toBe("constellations");
  });
});

describe("decorationSchema", () => {
  it("accepts a valid decoration and applies defaults", () => {
    const r = decorationSchema.safeParse({
      name: "My star map",
      imageUrl: "https://x.public.blob.vercel-storage.com/uploads/u1-abc.png",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.fit).toBe("tile");
      expect(r.data.size).toBe(240);
      expect(r.data.opacity).toBe(0.2);
      expect(r.data.scroll).toBe("static");
    }
  });
  it("coerces numeric strings from the form", () => {
    const r = decorationSchema.safeParse({
      name: "x",
      imageUrl: "https://e.com/a.png",
      size: "128",
      opacity: "0.6",
      fit: "cover",
      scroll: "sway",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.size).toBe(128);
      expect(r.data.opacity).toBe(0.6);
      expect(r.data.fit).toBe("cover");
    }
  });
  it("rejects a missing name", () => {
    expect(
      decorationSchema.safeParse({ name: "", imageUrl: "https://e.com/a.png" })
        .success,
    ).toBe(false);
  });
  it("rejects an unsafe image url", () => {
    expect(
      decorationSchema.safeParse({ name: "x", imageUrl: "javascript:alert(1)" })
        .success,
    ).toBe(false);
    expect(
      decorationSchema.safeParse({ name: "x", imageUrl: "https://e.com/a b.png" })
        .success,
    ).toBe(false);
  });
});
