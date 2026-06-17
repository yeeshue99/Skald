import { describe, it, expect, beforeEach } from "vitest";
import {
  getExploreFeed,
  getPersonaPosts,
  getPersonaReplies,
  decodeCursor,
} from "@/lib/queries";
import { resetDb, mkCampaign, mkPersona, mkPost } from "@/test/factory";

const HAS_DB = !!process.env.TEST_DATABASE_URL;

describe.skipIf(!HAS_DB)("feed visibility + keyset pagination", () => {
  beforeEach(resetDb);

  it("shows only published, non-deleted, non-future top-level posts", async () => {
    const { campaignId, userId } = await mkCampaign();
    const author = await mkPersona(campaignId, userId, { handle: "auth" });
    const past = new Date(Date.now() - 60_000);

    const visible = await mkPost(campaignId, author, {
      content: "live",
      publishedAt: past,
    });
    await mkPost(campaignId, author, {
      content: "future",
      status: "scheduled",
      publishedAt: new Date(Date.now() + 3_600_000),
    });
    await mkPost(campaignId, author, {
      content: "draft",
      status: "draft",
      publishedAt: null,
    });
    await mkPost(campaignId, author, {
      content: "deleted",
      publishedAt: past,
      deletedAt: new Date(),
    });
    // a reply is visible in a thread but never in the feed (feeds hide replies)
    await mkPost(campaignId, author, {
      content: "reply",
      publishedAt: past,
      replyToPostId: visible,
    });

    const feed = await getExploreFeed(campaignId, author, null);
    expect(feed.posts.map((p) => p.id)).toEqual([visible]);
  });

  it("keyset-paginates every post exactly once, including tied timestamps", async () => {
    const { campaignId, userId } = await mkCampaign();
    const author = await mkPersona(campaignId, userId, { handle: "auth" });

    const ids: number[] = [];
    const tied = new Date(Date.now() - 10_000); // 10 posts share one instant
    for (let i = 0; i < 30; i++) {
      const publishedAt =
        i < 10 ? tied : new Date(Date.now() - 100_000 + i * 1000);
      ids.push(await mkPost(campaignId, author, { content: `p${i}`, publishedAt }));
    }

    const seen: number[] = [];
    let next: string | null = null;
    let pages = 0;
    do {
      const page = await getExploreFeed(campaignId, author, decodeCursor(next));
      seen.push(...page.posts.map((p) => p.id));
      next = page.nextCursor;
      pages++;
      expect(pages).toBeLessThan(10); // guard against a cursor that never ends
    } while (next);

    expect(seen.length).toBe(30); // no duplicates across the page boundary
    expect(new Set(seen).size).toBe(30); // and no repeats
    expect([...seen].sort((a, b) => a - b)).toEqual(
      [...ids].sort((a, b) => a - b),
    ); // every inserted post reached (no gaps)
  });

  it("profile Posts tab hides replies; Replies tab keeps both", async () => {
    const { campaignId, userId } = await mkCampaign();
    const author = await mkPersona(campaignId, userId, { handle: "auth" });
    const other = await mkPersona(campaignId, userId, { handle: "other" });
    const past = new Date(Date.now() - 60_000);

    // a top-level post by the author, plus the author's reply to someone else's
    // post (the reply is by `author`, replying to `other`'s post)
    const top = await mkPost(campaignId, author, {
      content: "top",
      publishedAt: past,
    });
    const parent = await mkPost(campaignId, other, {
      content: "parent",
      publishedAt: new Date(Date.now() - 70_000),
    });
    const reply = await mkPost(campaignId, author, {
      content: "reply",
      publishedAt: past,
      replyToPostId: parent,
    });
    // a soft-deleted reply by the author must stay hidden on both tabs
    await mkPost(campaignId, author, {
      content: "deleted reply",
      publishedAt: past,
      replyToPostId: parent,
      deletedAt: new Date(),
    });

    const posts = await getPersonaPosts(campaignId, author, author, null);
    expect(posts.posts.map((p) => p.id).sort((a, b) => a - b)).toEqual([top]);

    const repliesFeed = await getPersonaReplies(campaignId, author, author, null);
    expect(repliesFeed.posts.map((p) => p.id).sort((a, b) => a - b)).toEqual(
      [top, reply].sort((a, b) => a - b),
    );
    expect(repliesFeed.posts.some((p) => p.id === reply)).toBe(true);
  });
});
