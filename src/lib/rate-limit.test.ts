import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The limiter selects its backend once at module load from these env vars. Keep
// them unset so this suite exercises the in-memory fixed-window path. (vitest
// does not set them by default, but be explicit so the test is robust.)
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

import { rateLimit } from "@/lib/rate-limit";

// Unique key per test so windows from one case can't bleed into another.
let counter = 0;
function freshKey(): string {
  return `test-key-${counter++}-${Math.random()}`;
}

describe("rateLimit (in-memory backend)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows exactly `limit` calls then blocks the next", async () => {
    const key = freshKey();
    const opts = { limit: 3, windowMs: 60_000 };

    for (let i = 0; i < 3; i++) {
      const r = await rateLimit(key, opts);
      expect(r.ok).toBe(true);
    }
    const blocked = await rateLimit(key, opts);
    expect(blocked.ok).toBe(false);
  });

  it("decrements remaining down to 0", async () => {
    const key = freshKey();
    const opts = { limit: 3, windowMs: 60_000 };

    expect((await rateLimit(key, opts)).remaining).toBe(2);
    expect((await rateLimit(key, opts)).remaining).toBe(1);
    expect((await rateLimit(key, opts)).remaining).toBe(0);
    // over the limit stays clamped at 0
    expect((await rateLimit(key, opts)).remaining).toBe(0);
  });

  it("reports retryAfterSec of at least 1 second", async () => {
    const key = freshKey();
    const r = await rateLimit(key, { limit: 1, windowMs: 60_000 });
    expect(r.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(r.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("resets the window after time advances past it", async () => {
    const key = freshKey();
    const opts = { limit: 2, windowMs: 60_000 };

    await rateLimit(key, opts);
    expect((await rateLimit(key, opts)).ok).toBe(true);
    expect((await rateLimit(key, opts)).ok).toBe(false); // 3rd call blocked

    // advance past the window
    vi.advanceTimersByTime(60_001);

    const afterReset = await rateLimit(key, opts);
    expect(afterReset.ok).toBe(true);
    expect(afterReset.remaining).toBe(1);
  });

  it("keeps distinct keys independent", async () => {
    const a = freshKey();
    const b = freshKey();
    const opts = { limit: 1, windowMs: 60_000 };

    expect((await rateLimit(a, opts)).ok).toBe(true);
    expect((await rateLimit(a, opts)).ok).toBe(false); // a is now blocked
    // b has its own counter, untouched
    expect((await rateLimit(b, opts)).ok).toBe(true);
  });
});
