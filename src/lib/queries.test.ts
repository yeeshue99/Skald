import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor } from "@/lib/queries";

describe("keyset cursor codec", () => {
  it("round-trips a (publishedAt, id) cursor exactly", () => {
    const c = { publishedAt: new Date("2026-01-02T03:04:05.678Z"), id: 42 };
    const dec = decodeCursor(encodeCursor(c));
    expect(dec).not.toBeNull();
    expect(dec!.id).toBe(42);
    expect(dec!.publishedAt.toISOString()).toBe("2026-01-02T03:04:05.678Z");
  });

  it("encodes as `<iso>_<id>`", () => {
    expect(encodeCursor({ publishedAt: new Date("2026-01-02T03:04:05.678Z"), id: 7 })).toBe(
      "2026-01-02T03:04:05.678Z_7",
    );
  });

  it("splits on the LAST underscore (the ISO date is preserved)", () => {
    const c = { publishedAt: new Date("2026-06-16T12:00:00.000Z"), id: 99 };
    expect(decodeCursor(encodeCursor(c))!.id).toBe(99);
  });

  it("rejects malformed input rather than producing a bad cursor", () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor("no-underscore")).toBeNull();
    expect(decodeCursor("not-a-date_5")).toBeNull(); // invalid date
    expect(decodeCursor("2026-01-02T03:04:05.678Z_0")).toBeNull(); // id must be positive
    expect(decodeCursor("2026-01-02T03:04:05.678Z_-1")).toBeNull();
    expect(decodeCursor("2026-01-02T03:04:05.678Z_abc")).toBeNull(); // NaN id
  });
});
