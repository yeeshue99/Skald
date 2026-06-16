import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { resetDb, mkCampaign, mkPersona, mkPost } from "@/test/factory";

const HAS_DB = !!process.env.TEST_DATABASE_URL;

// The composer/createPostAction guards are backed by DB CHECK constraints; these
// prove the database itself rejects the illegal shapes, so a bad write can't slip
// past the app layer.
describe.skipIf(!HAS_DB)("post CHECK constraints", () => {
  beforeEach(resetDb);

  it("rejects a post that is both a reply and a quote (reply-XOR-repost)", async () => {
    const { campaignId, userId } = await mkCampaign();
    const p = await mkPersona(campaignId, userId, { handle: "p" });
    const a = await mkPost(campaignId, p, { content: "a" });
    const b = await mkPost(campaignId, p, { content: "b" });

    await expect(
      db.insert(posts).values({
        campaignId,
        personaId: p,
        content: "both",
        status: "published",
        publishedAt: new Date(),
        replyToPostId: a,
        repostOfPostId: b,
      }),
    ).rejects.toThrow();
  });

  it("enforces draft <=> no publish time", async () => {
    const { campaignId, userId } = await mkCampaign();
    const p = await mkPersona(campaignId, userId, { handle: "p" });

    // a draft must have a null publish time
    await expect(
      db.insert(posts).values({
        campaignId,
        personaId: p,
        content: "draft-with-time",
        status: "draft",
        publishedAt: new Date(),
      }),
    ).rejects.toThrow();

    // a published post must have a publish time
    await expect(
      db.insert(posts).values({
        campaignId,
        personaId: p,
        content: "published-without-time",
        status: "published",
        publishedAt: null,
      }),
    ).rejects.toThrow();
  });

  it("rejects a post that replies to itself", async () => {
    const { campaignId, userId } = await mkCampaign();
    const p = await mkPersona(campaignId, userId, { handle: "p" });
    const id = await mkPost(campaignId, p, { content: "self" });

    await expect(
      db.update(posts).set({ replyToPostId: id }).where(eq(posts.id, id)),
    ).rejects.toThrow();
  });
});
