// Write-path rate limiter with two backends, picked once at module load.
//
//   - Upstash REST (global): when UPSTASH_REDIS_REST_URL and
//     UPSTASH_REDIS_REST_TOKEN are both set, counters live in Redis so every
//     serverless instance shares one fixed window. Dependency-free: we POST a
//     pipeline to the REST API with global fetch, no @upstash/redis package.
//   - In-memory (per-process): the default fallback. Each instance keeps its
//     own counters, so it throttles obvious abuse (a leaked API key, credential
//     stuffing) without coordinating across instances.
//
// On any Upstash error we fall back to the in-memory limiter for that call (we
// never blanket-allow: a leaked key shouldn't get to flood during an outage).
// Fixed-window counters keyed by an arbitrary string.

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

export type RateResult = {
  ok: boolean;
  remaining: number;
  /** seconds until the window resets (use for a Retry-After header) */
  retryAfterSec: number;
};

type RateOpts = { limit: number; windowMs: number };

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const useUpstash = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

// Announce the chosen backend once, for observability in logs.
console.warn(
  `[rate-limit] backend: ${useUpstash ? "upstash-rest (global)" : "in-memory (per-process)"}`,
);

let warnedUpstashFailure = false;

function inMemoryRateLimit(key: string, opts: RateOpts): RateResult {
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

// Global fixed window via the Upstash REST pipeline endpoint. One round trip:
// INCR the counter, set the TTL atomically on first hit (PEXPIRE ... NX), then
// read the TTL back so we can report Retry-After.
async function upstashRateLimit(key: string, opts: RateOpts): Promise<RateResult> {
  const redisKey = `rl:${key}`;
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["PEXPIRE", redisKey, String(opts.windowMs), "NX"],
      ["PTTL", redisKey],
    ]),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Upstash REST ${res.status}`);
  }

  // The pipeline endpoint returns an array of { result } | { error } objects,
  // one per command, in order.
  const parsed = (await res.json()) as Array<{ result?: unknown; error?: string }>;
  if (!Array.isArray(parsed) || parsed.length < 3) {
    throw new Error("Upstash REST: unexpected pipeline response");
  }
  for (const r of parsed) {
    if (r && typeof r === "object" && "error" in r && r.error) {
      throw new Error(`Upstash REST command error: ${r.error}`);
    }
  }

  const count = Number(parsed[0].result);
  const ttl = Number(parsed[2].result);
  if (!Number.isFinite(count)) {
    throw new Error("Upstash REST: non-numeric INCR result");
  }

  // A negative PTTL means no expiry yet (-1) or the key vanished (-2); treat it
  // as a fresh full window so Retry-After is never zero or negative.
  const retryAfterSec =
    ttl > 0 ? Math.max(1, Math.ceil(ttl / 1000)) : Math.ceil(opts.windowMs / 1000);

  return {
    ok: count <= opts.limit,
    remaining: Math.max(0, opts.limit - count),
    retryAfterSec,
  };
}

export async function rateLimit(key: string, opts: RateOpts): Promise<RateResult> {
  if (useUpstash) {
    try {
      return await upstashRateLimit(key, opts);
    } catch (e) {
      // Fall back to the local limiter (never blanket-allow). Log once so an
      // outage is visible without flooding the logs every request.
      if (!warnedUpstashFailure) {
        warnedUpstashFailure = true;
        console.warn(
          "[rate-limit] Upstash REST failed, falling back to in-memory:",
          e instanceof Error ? e.message : e,
        );
      }
      return inMemoryRateLimit(key, opts);
    }
  }
  return inMemoryRateLimit(key, opts);
}

// Best-effort client IP from proxy headers (Vercel sets x-forwarded-for).
export function ipFromHeaders(h: Headers): string {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}
