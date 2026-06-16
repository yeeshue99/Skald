import { describe, it, expect } from "vitest";
import { pickOrphans } from "@/lib/blob-cleanup";

describe("pickOrphans", () => {
  it("returns only blobs whose pathname no row references", () => {
    const referenced = new Set(["uploads/keep.png", "uploads/also.png"]);
    const blobs = [
      { pathname: "uploads/keep.png", url: "u1", size: 1 },
      { pathname: "uploads/gone.png", url: "u2", size: 2 },
      { pathname: "uploads/also.png", url: "u3", size: 3 },
    ];
    expect(pickOrphans(referenced, blobs).map((o) => o.pathname)).toEqual(["uploads/gone.png"]);
  });

  it("returns all blobs when nothing is referenced", () => {
    expect(pickOrphans(new Set(), [{ pathname: "a", url: "u", size: 0 }])).toHaveLength(1);
  });

  it("returns none when every blob is referenced", () => {
    expect(pickOrphans(new Set(["a"]), [{ pathname: "a", url: "u", size: 0 }])).toHaveLength(0);
  });
});
