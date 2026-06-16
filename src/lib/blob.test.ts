import { describe, it, expect } from "vitest";
import { blobPathname, isOurBlobUrl } from "@/lib/blob";

describe("blobPathname", () => {
  it("extracts the pathname for a URL in our blob store", () => {
    expect(blobPathname("https://abc.public.blob.vercel-storage.com/uploads/u1-x.png")).toBe(
      "uploads/u1-x.png",
    );
  });

  it("returns null for external / pasted URLs (those are never deleted)", () => {
    expect(blobPathname("https://api.dicebear.com/7.x/thumbs/svg?seed=foo")).toBeNull();
    expect(blobPathname("https://example.com/pic.png")).toBeNull();
    // a look-alike host must not match
    expect(blobPathname("https://x.blob.vercel-storage.com.attacker.com/uploads/a.png")).toBeNull();
  });

  it("returns null for null / undefined / garbage", () => {
    expect(blobPathname(null)).toBeNull();
    expect(blobPathname(undefined)).toBeNull();
    expect(blobPathname("not a url")).toBeNull();
  });

  it("isOurBlobUrl agrees", () => {
    expect(isOurBlobUrl("https://x.public.blob.vercel-storage.com/uploads/a.png")).toBe(true);
    expect(isOurBlobUrl("https://example.com/a.png")).toBe(false);
  });
});
