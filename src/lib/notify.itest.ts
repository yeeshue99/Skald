import { describe, it, expect, beforeEach } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import {
  notify,
  removeFollowNotification,
  removeLikeNotification,
} from "@/lib/notify";
import { resetDb, mkCampaign, mkPersona, mkPost } from "@/test/factory";

const HAS_DB = !!process.env.TEST_DATABASE_URL;

async function countOf(type: string): Promise<number> {
  const [r] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(notifications)
    .where(eq(notifications.type, type as "like"));
  return Number(r.c);
}

describe.skipIf(!HAS_DB)("notify dedup + self-skip", () => {
  beforeEach(resetDb);

  it("dedups repeated likes and supports undo", async () => {
    const { campaignId, userId } = await mkCampaign();
    const actor = await mkPersona(campaignId, userId, { handle: "actor" });
    const recipient = await mkPersona(campaignId, userId, { handle: "rcpt" });
    const post = await mkPost(campaignId, recipient, { content: "p" });

    await notify({ campaignId, recipientPersonaId: recipient, actorPersonaId: actor, type: "like", postId: post });
    await notify({ campaignId, recipientPersonaId: recipient, actorPersonaId: actor, type: "like", postId: post });
    expect(await countOf("like")).toBe(1); // partial unique index dedups

    await removeLikeNotification(actor, post);
    expect(await countOf("like")).toBe(0);
  });

  it("dedups repeated follows", async () => {
    const { campaignId, userId } = await mkCampaign();
    const actor = await mkPersona(campaignId, userId, { handle: "actor" });
    const recipient = await mkPersona(campaignId, userId, { handle: "rcpt" });

    await notify({ campaignId, recipientPersonaId: recipient, actorPersonaId: actor, type: "follow", postId: null });
    await notify({ campaignId, recipientPersonaId: recipient, actorPersonaId: actor, type: "follow", postId: null });
    expect(await countOf("follow")).toBe(1);

    await removeFollowNotification(actor, recipient);
    expect(await countOf("follow")).toBe(0);
  });

  it("skips self-notifications", async () => {
    const { campaignId, userId } = await mkCampaign();
    const me = await mkPersona(campaignId, userId, { handle: "me" });
    const post = await mkPost(campaignId, me, { content: "p" });

    await notify({ campaignId, recipientPersonaId: me, actorPersonaId: me, type: "like", postId: post });
    const [r] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.recipientPersonaId, me), eq(notifications.actorPersonaId, me)));
    expect(Number(r.c)).toBe(0);
  });
});
