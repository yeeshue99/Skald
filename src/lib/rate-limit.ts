// Tiny in-memory rate limiter. Per-process only: on serverless each instance
// keeps its own counters, so this throttles obvious abuse (a leaked API key,
// credential stuffing) without coordinating across instances. Swap in
// Upstash/Redis if it ever needs to be global. Fixed-window counters keyed by
// an arbitrary string.

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

export type RateResult = {
  ok: boolean;
  remaining: number;
  /** seconds until the window resets (use for a Retry-After header) */
  retryAfterSec: number;
};

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): RateResult {
  const now = Date.now();
  let w = buckets.get(key);
  if (!w || now >= w.resetAt) {
    w = { count: 0, resetAt: now + opts.windowMs };
    buckets.set(key, w);
  }
  w.count += 1;

  // opportunistic sweep so the map can't grow without bound
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
  }

  return {
    ok: w.count <= opts.limit,
    remaining: Math.max(0, opts.limit - w.count),
    retryAfterSec: Math.max(1, Math.ceil((w.resetAt - now) / 1000)),
  };
}

// Best-effort client IP from proxy headers (Vercel sets x-forwarded-for).
export function ipFromHeaders(h: Headers): string {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}
