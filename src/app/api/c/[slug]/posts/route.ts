import { NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { campaignApiKeys, campaigns, personas, posts } from "@/db/schema";
import { hashToken } from "@/lib/ids";
import { composeSchema } from "@/lib/validation";
import { notifyMentions } from "@/lib/notify";
import { ipFromHeaders, rateLimit } from "@/lib/rate-limit";

function json(
  data: unknown,
  status: number,
  headers?: Record<string, string>,
): Response {
  return NextResponse.json(data, { status, headers });
}

function tooMany(retryAfterSec: number): Response {
  return json({ error: "Rate limit exceeded. Slow down." }, 429, {
    "Retry-After": String(retryAfterSec),
  });
}

// External integration: create a post in a campaign with a campaign API key.
//
//   POST /api/c/<slug>/posts
//   Authorization: Bearer skald_xxx
//   { "persona": "@chronicler", "content": "Session 12 recap…",
//     "imageUrl": "https://…" (optional), "scheduledAt": "2026-…Z" (optional) }
//
// The key may post as any NPC in its campaign, or as a persona owned by the user
// who created the key. Write-only: there is no read side here.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;

  // coarse per-IP throttle before auth, so unauthenticated spam is cheap to shed
  const ip = ipFromHeaders(req.headers);
  const ipLimit = await rateLimit(`api-ip:${ip}`, { limit: 120, windowMs: 60_000 });
  if (!ipLimit.ok) return tooMany(ipLimit.retryAfterSec);

  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return json({ error: "Missing 'Authorization: Bearer <key>'." }, 401);
  const token = m[1].trim();

  const campaign = (
    await db.select().from(campaigns).where(eq(campaigns.slug, slug)).limit(1)
  )[0];
  if (!campaign) return json({ error: "Campaign not found." }, 404);

  const key = (
    await db
      .select()
      .from(campaignApiKeys)
      .where(
        and(
          eq(campaignApiKeys.tokenHash, hashToken(token)),
          eq(campaignApiKeys.campaignId, campaign.id),
          isNull(campaignApiKeys.revokedAt),
        ),
      )
      .limit(1)
  )[0];
  if (!key) return json({ error: "Invalid or revoked API key." }, 401);

  // per-key throttle: a leaked key can't flood the campaign
  const keyLimit = await rateLimit(`api-key:${key.id}`, { limit: 60, windowMs: 60_000 });
  if (!keyLimit.ok) return tooMany(keyLimit.retryAfterSec);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be JSON." }, 400);
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const handle = String(b.persona ?? "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
  if (!handle) return json({ error: "`persona` (a handle) is required." }, 400);

  const parsed = composeSchema.safeParse({
    content: typeof b.content === "string" ? b.content : "",
    imageUrl: typeof b.imageUrl === "string" ? b.imageUrl : "",
    scheduledAt: typeof b.scheduledAt === "string" ? b.scheduledAt : "",
  });
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Invalid post." }, 400);
  }
  const content = parsed.data.content.trim();
  const imageUrl = parsed.data.imageUrl;
  if (!content && !imageUrl) {
    return json({ error: "Provide `content` or an `imageUrl`." }, 400);
  }

  const persona = (
    await db
      .select()
      .from(personas)
      .where(
        and(
          eq(personas.campaignId, campaign.id),
          eq(personas.handleLower, handle),
        ),
      )
      .limit(1)
  )[0];
  if (!persona) {
    return json({ error: `No persona @${handle} in this campaign.` }, 404);
  }
  // a campaign key may post as any NPC, or as the key creator's own persona
  if (!persona.isNpc && persona.ownerUserId !== key.createdByUserId) {
    return json({ error: `This key can't post as @${handle}.` }, 403);
  }

  let status: "scheduled" | "published" = "published";
  let publishedAt: Date | ReturnType<typeof sql> | null = sql`date_trunc('milliseconds', now())`;
  if (parsed.data.scheduledAt) {
    const when = new Date(parsed.data.scheduledAt);
    if (!Number.isNaN(when.getTime()) && when.getTime() > Date.now()) {
      status = "scheduled";
      publishedAt = when;
    }
  }

  const [row] = await db
    .insert(posts)
    .values({
      campaignId: campaign.id,
      personaId: persona.id,
      content,
      imageUrl: imageUrl || null,
      status,
      publishedAt: publishedAt as Date | null,
    })
    .returning({ id: posts.id });

  // @mentions notify only once the post is actually live
  if (status === "published") {
    await notifyMentions({
      campaignId: campaign.id,
      actorPersonaId: persona.id,
      postId: row.id,
      content,
    });
  }

  // best-effort "last used" stamp; don't fail the request if it errors
  void db
    .update(campaignApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(campaignApiKeys.id, key.id));

  return json(
    { id: row.id, status, persona: persona.handle, url: `/c/${slug}/post/${row.id}` },
    201,
  );
}
