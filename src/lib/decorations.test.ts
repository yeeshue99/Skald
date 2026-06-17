import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  DEFAULT_THEME,
  STRIX_THEME,
  normalizeDecorationSpec,
  normalizeOverrides,
  safeCssUrl,
  campaignRenderProps,
  type DecorationSpec,
} from "@/lib/themes";
import { decorationSchema } from "@/lib/validation";

const IMG = "https://x.public.blob.vercel-storage.com/uploads/u1-abc.png";

// a mod with just a custom backdrop
const backdrop = (over: Record<string, unknown> = {}): DecorationSpec => ({
  overrides: {},
  backdrop: { imageUrl: IMG, fit: "tile", size: 240, opacity: 0.5, scroll: "static", ...over },
});

describe("safeCssUrl", () => {
  it("wraps a safe http(s) image url (hyphens allowed)", () => {
    expect(safeCssUrl(IMG)).toBe(`url("${IMG}")`);
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

describe("normalizeOverrides", () => {
  it("keeps known dimensions with valid values, drops the rest", () => {
    const out = normalizeOverrides({
      wordmark: "sigil",
      divider: "bogus",
      junk: "x",
      effects: ["motes", "nope"],
    } as never);
    expect(out).toEqual({ wordmark: "sigil", effects: ["motes"] });
  });
  it("returns an empty object for undefined", () => {
    expect(normalizeOverrides(undefined)).toEqual({});
  });
});

describe("normalizeDecorationSpec", () => {
  it("clamps backdrop size and opacity into range", () => {
    expect(normalizeDecorationSpec(backdrop({ size: 5000 })).backdrop!.size).toBe(1024);
    expect(normalizeDecorationSpec(backdrop({ size: 1 })).backdrop!.size).toBe(24);
    expect(normalizeDecorationSpec(backdrop({ opacity: 5 })).backdrop!.opacity).toBe(1);
    expect(normalizeDecorationSpec(backdrop({ opacity: -1 })).backdrop!.opacity).toBe(0);
  });
  it("coerces unknown fit/scroll to safe defaults and filters overrides", () => {
    const out = normalizeDecorationSpec({
      overrides: { wordmark: "sigil", depth: "bogus" } as never,
      backdrop: { imageUrl: IMG, fit: "weird" as never, size: 240, opacity: 0.5, scroll: "spin" as never },
    });
    expect(out.backdrop!.fit).toBe("tile");
    expect(out.backdrop!.scroll).toBe("static");
    expect(out.overrides).toEqual({ wordmark: "sigil" });
  });
});

describe("campaignRenderProps", () => {
  it("matches the bare theme attrs when no mod is active", () => {
    const { dataAttrs, cssVars, effects } = campaignRenderProps(DEFAULT_THEME, null);
    expect(dataAttrs["data-texture"]).toBe("none");
    expect(cssVars.colorScheme).toBe("dark");
    expect(effects).toEqual([]);
  });

  it("merges named overrides through the existing data-attrs", () => {
    const { dataAttrs } = campaignRenderProps(DEFAULT_THEME, {
      overrides: { wordmark: "sigil", divider: "asterism", cardFrame: "gilded" },
    });
    expect(dataAttrs["data-wordmark"]).toBe("sigil");
    expect(dataAttrs["data-divider"]).toBe("asterism");
    expect(dataAttrs["data-card-frame"]).toBe("gilded");
  });

  it("lets an override beat the campaign value", () => {
    // STR/X's campaign wordmark is "sigil"; override it to plain
    const { dataAttrs } = campaignRenderProps(STRIX_THEME, {
      overrides: { wordmark: "plain" },
    });
    expect(dataAttrs["data-wordmark"]).toBe("plain");
  });

  it("returns the overridden ambient effects", () => {
    const { effects } = campaignRenderProps(STRIX_THEME, {
      overrides: { effects: ["fog"] },
    });
    expect(effects).toEqual(["fog"]);
  });

  it("repoints the backdrop at a custom image and takes over opacity", () => {
    const { dataAttrs, cssVars } = campaignRenderProps(
      STRIX_THEME,
      backdrop({ opacity: 0.4, scroll: "down" }),
    );
    expect(dataAttrs["data-texture"]).toBe("custom");
    expect(String(cssVars["--texture-image" as keyof typeof cssVars])).toContain("url(");
    expect(cssVars["--texture-opacity" as keyof typeof cssVars]).toBe("0.4");
    expect(cssVars["--texture-size" as keyof typeof cssVars]).toBe("240px");
    expect(dataAttrs["data-bg-scroll"]).toBe("down");
  });

  it("uses cover sizing and clears motion for a still cover backdrop", () => {
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

// Guards the contract between the render layer and the stylesheet: a typo in a
// var name (emit `--texture-image`, read `--texture-img`) would make the custom
// backdrop silently not paint, which no pure-JS test would catch.
describe("custom backdrop CSS contract", () => {
  const css = readFileSync(
    fileURLToPath(new URL("../app/globals.css", import.meta.url)),
    "utf8",
  );
  const { cssVars } = campaignRenderProps(STRIX_THEME, backdrop());

  it("globals.css reads every --texture-* var the render emits", () => {
    const emitted = Object.keys(cssVars).filter((k) => k.startsWith("--texture-"));
    expect(emitted.length).toBeGreaterThanOrEqual(4);
    for (const v of emitted) {
      expect(css, `globals.css must read var(${v})`).toContain(`var(${v}`);
    }
  });

  it("has a [data-texture=custom] ::before rule that paints the image", () => {
    expect(css).toMatch(/\[data-texture="custom"\]::before/);
    expect(css).toMatch(/data-texture="custom"\]::before\s*\{[^}]*var\(--texture-image/);
  });
});

describe("custom upload-backed dimensions", () => {
  const full = (): DecorationSpec => ({
    overrides: {},
    divider: { imageUrl: IMG, opacity: 0.8, size: 20 },
    cardFrame: { imageUrl: IMG, opacity: 0.5, size: 0 },
    avatarFrame: { imageUrl: IMG, opacity: 1, size: 0 },
    wordmark: { imageUrl: IMG, opacity: 1, size: 30, mode: "replace" },
    reaction: { imageUrl: IMG, opacity: 1, size: 32 },
    ambient: { imageUrl: IMG, opacity: 0.4, size: 160 },
  });

  it("points each dimension's data-attr at custom and emits its --image var", () => {
    const { dataAttrs, cssVars, ambient } = campaignRenderProps(DEFAULT_THEME, full());
    expect(dataAttrs["data-divider"]).toBe("custom");
    expect(dataAttrs["data-card-frame"]).toBe("custom");
    expect(dataAttrs["data-avatar-frame"]).toBe("custom");
    expect(dataAttrs["data-wordmark"]).toBe("custom");
    expect(dataAttrs["data-wordmark-mode"]).toBe("replace");
    expect(dataAttrs["data-reactions"]).toBe("custom");
    for (const v of ["--divider-image", "--card-frame-image", "--avatar-frame-image", "--wordmark-image", "--reaction-image", "--ambient-image"]) {
      expect(String(cssVars[v as keyof typeof cssVars])).toContain("url(");
    }
    expect(cssVars["--divider-size" as keyof typeof cssVars]).toBe("20px");
    expect(cssVars["--divider-opacity" as keyof typeof cssVars]).toBe("0.8");
    // ambient is a feed layer, returned for the layout (no data-attr)
    expect(ambient?.imageUrl).toBe(IMG);
  });

  it("ignores an unsafe custom image url (keeps the campaign value)", () => {
    const { dataAttrs } = campaignRenderProps(DEFAULT_THEME, {
      overrides: {},
      divider: { imageUrl: "javascript:alert(1)", opacity: 1, size: 18 },
    });
    expect(dataAttrs["data-divider"]).not.toBe("custom");
  });

  it("clamps custom opacity/size and coerces an unknown wordmark mode", () => {
    const out = normalizeDecorationSpec({
      overrides: {},
      divider: { imageUrl: IMG, opacity: 5, size: 9999 },
      wordmark: { imageUrl: IMG, opacity: -1, size: 0, mode: "bogus" as never },
    });
    expect(out.divider!.opacity).toBe(1);
    expect(out.divider!.size).toBe(64); // divider size max
    expect(out.wordmark!.opacity).toBe(0);
    expect(out.wordmark!.mode).toBe("ornament");
  });
});

describe("decorationSchema", () => {
  it("accepts a spec with only a custom image and no overrides", () => {
    const r = decorationSchema.safeParse({
      name: "Logo",
      spec: { wordmark: { imageUrl: IMG, mode: "replace" } },
    });
    expect(r.success).toBe(true);
  });
  it("accepts named overrides and defaults scope to personal", () => {
    const r = decorationSchema.safeParse({
      name: "My look",
      spec: { overrides: { wordmark: "sigil", divider: "vine" } },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.scope).toBe("personal");
  });
  it("accepts a custom backdrop with defaults", () => {
    const r = decorationSchema.safeParse({
      name: "Map",
      spec: { backdrop: { imageUrl: IMG } },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.spec.backdrop?.fit).toBe("tile");
      expect(r.data.spec.backdrop?.opacity).toBe(0.2);
    }
  });
  it("accepts a DM campaign scope", () => {
    const r = decorationSchema.safeParse({
      name: "Shared",
      scope: "campaign",
      spec: { overrides: { depth: "cyanBloom" } },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.scope).toBe("campaign");
  });
  it("rejects an empty spec (no overrides, no backdrop)", () => {
    expect(
      decorationSchema.safeParse({ name: "x", spec: { overrides: {} } }).success,
    ).toBe(false);
  });
  it("rejects an unknown override value", () => {
    expect(
      decorationSchema.safeParse({ name: "x", spec: { overrides: { wordmark: "nope" } } }).success,
    ).toBe(false);
  });
  it("rejects a missing name", () => {
    expect(
      decorationSchema.safeParse({ name: "", spec: { overrides: { divider: "vine" } } }).success,
    ).toBe(false);
  });
  it("rejects an unsafe backdrop url", () => {
    expect(
      decorationSchema.safeParse({ name: "x", spec: { backdrop: { imageUrl: "javascript:alert(1)" } } }).success,
    ).toBe(false);
  });
});
