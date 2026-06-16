import { sql } from "drizzle-orm";
import { db } from "@/db";
import { campaigns, personas, posts, users } from "@/db/schema";
import type { Theme } from "@/lib/theme-types";
import type { PostStatus } from "@/db/schema";

// Minimal fixtures for integration tests. The query functions under test never
// read the theme, so an empty object is fine for the jsonb column.

let seq = 0;
const uniq = () => `t${Date.now().toString(36)}${seq++}`;

const ALL_TABLES = [
  "users",
  "campaigns",
  "memberships",
  "personas",
  "posts",
  "follows",
  "likes",
  "bookmarks",
  "polls",
  "poll_votes",
  "notifications",
  "sessions",
  "campaign_api_keys",
];

export async function resetDb(): Promise<void> {
  await db.execute(
    sql.raw(`TRUNCATE ${ALL_TABLES.join(", ")} RESTART IDENTITY CASCADE`),
  );
}

export async function mkCampaign(): Promise<{
  userId: number;
  campaignId: number;
}> {
  const tag = uniq();
  const [u] = await db
    .insert(users)
    .values({ username: tag, usernameLower: tag, passwordHash: "x" })
    .returning({ id: users.id });
  const [c] = await db
    .insert(campaigns)
    .values({
      slug: tag,
      name: tag,
      theme: {} as Theme,
      inviteCode: tag.toUpperCase(),
      createdByUserId: u.id,
    })
    .returning({ id: campaigns.id });
  return { userId: u.id, campaignId: c.id };
}

export async function mkPersona(
  campaignId: number,
  ownerUserId: number,
  opts: { handle?: string; displayName?: string; isNpc?: boolean } = {},
): Promise<number> {
  const handle = opts.handle ?? uniq();
  const [p] = await db
    .insert(personas)
    .values({
      campaignId,
      ownerUserId,
      handle,
      handleLower: handle.toLowerCase(),
      displayName: opts.displayName ?? handle,
      isNpc: opts.isNpc ?? false,
    })
    .returning({ id: personas.id });
  return p.id;
}

export async function mkPost(
  campaignId: number,
  personaId: number,
  opts: {
    content?: string;
    status?: PostStatus;
    publishedAt?: Date | null;
    replyToPostId?: number | null;
    repostOfPostId?: number | null;
    deletedAt?: Date | null;
  } = {},
): Promise<number> {
  const [p] = await db
    .insert(posts)
    .values({
      campaignId,
      personaId,
      content: opts.content ?? "",
      status: opts.status ?? "published",
      // a published/scheduled post needs a publish instant; a draft needs null
      publishedAt:
        opts.publishedAt === undefined ? new Date() : opts.publishedAt,
      replyToPostId: opts.replyToPostId ?? null,
      repostOfPostId: opts.repostOfPostId ?? null,
      deletedAt: opts.deletedAt ?? null,
    })
    .returning({ id: posts.id });
  return p.id;
}
