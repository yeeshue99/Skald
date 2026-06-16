import { describe, it, expect, beforeEach } from "vitest";
import { getThread } from "@/lib/queries";
import { resetDb, mkCampaign, mkPersona, mkPost } from "@/test/factory";

const HAS_DB = !!process.env.TEST_DATABASE_URL;

describe.skipIf(!HAS_DB)("getThread", () => {
  beforeEach(resetDb);

  it("returns ancestors, the author self-thread, and other replies", async () => {
    const { campaignId, userId } = await mkCampaign();
    const A = await mkPersona(campaignId, userId, { handle: "a" });
    const B = await mkPersona(campaignId, userId, { handle: "b", isNpc: true });
    const at = (s: number) => new Date(Date.now() - 1_000_000 + s * 1000);

    const grand = await mkPost(campaignId, A, { content: "grand", publishedAt: at(0) });
    const parent = await mkPost(campaignId, B, { content: "parent", replyToPostId: grand, publishedAt: at(1) });
    const root = await mkPost(campaignId, A, { content: "root", replyToPostId: parent, publishedAt: at(2) });
    const self1 = await mkPost(campaignId, A, { content: "self1", replyToPostId: root, publishedAt: at(3) });
    const self2 = await mkPost(campaignId, A, { content: "self2", replyToPostId: self1, publishedAt: at(4) });
    const other = await mkPost(campaignId, B, { content: "other", replyToPostId: root, publishedAt: at(5) });

    const t = await getThread(campaignId, root, A);
    expect(t).not.toBeNull();
    expect(t!.root.id).toBe(root);
    expect(t!.ancestors.map((p) => p.id)).toEqual([grand, parent]);
    expect(t!.selfThread.map((p) => p.id)).toEqual([self1, self2]);
    expect(t!.replies.map((p) => p.id)).toEqual([other]);
  });

  it("stops the ancestor walk at an invisible (deleted) parent", async () => {
    const { campaignId, userId } = await mkCampaign();
    const A = await mkPersona(campaignId, userId, { handle: "a" });
    const at = (s: number) => new Date(Date.now() - 1_000_000 + s * 1000);

    const grand = await mkPost(campaignId, A, { content: "grand", publishedAt: at(0), deletedAt: new Date() });
    const parent = await mkPost(campaignId, A, { content: "parent", replyToPostId: grand, publishedAt: at(1) });
    const root = await mkPost(campaignId, A, { content: "root", replyToPostId: parent, publishedAt: at(2) });

    const t = await getThread(campaignId, root, A);
    expect(t!.ancestors.map((p) => p.id)).toEqual([parent]); // grand is hidden
  });

  it("picks the lowest-id child per hop; siblings go to replies", async () => {
    const { campaignId, userId } = await mkCampaign();
    const A = await mkPersona(campaignId, userId, { handle: "a" });
    const at = (s: number) => new Date(Date.now() - 1_000_000 + s * 1000);

    const root = await mkPost(campaignId, A, { content: "root", publishedAt: at(0) });
    const self1 = await mkPost(campaignId, A, { content: "self1", replyToPostId: root, publishedAt: at(1) });
    const sibling = await mkPost(campaignId, A, { content: "sibling", replyToPostId: root, publishedAt: at(2) });

    const t = await getThread(campaignId, root, A);
    expect(t!.selfThread.map((p) => p.id)).toEqual([self1]); // lowest-id child only
    expect(t!.replies.map((p) => p.id)).toEqual([sibling]); // the other goes to replies
  });
});
