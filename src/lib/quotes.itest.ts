import { describe, it, expect, beforeEach } from "vitest";
import { getExploreFeed, getQuotesOf } from "@/lib/queries";
import { resetDb, mkCampaign, mkPersona, mkPost } from "@/test/factory";

const HAS_DB = !!process.env.TEST_DATABASE_URL;

describe.skipIf(!HAS_DB)("reposts vs quotes split", () => {
  beforeEach(resetDb);

  it("counts plain boosts and quotes separately on the original post", async () => {
    const { campaignId, userId } = await mkCampaign();
    const author = await mkPersona(campaignId, userId, { handle: "auth" });
    const a = await mkPersona(campaignId, userId, { handle: "a" });
    const b = await mkPersona(campaignId, userId, { handle: "b" });
    const c = await mkPersona(campaignId, userId, { handle: "c" });
    const past = new Date(Date.now() - 60_000);

    const original = await mkPost(campaignId, author, {
      content: "the original",
      publishedAt: past,
    });

    // two plain boosts (empty content) + one quote (non-empty content)
    await mkPost(campaignId, a, {
      content: "",
      repostOfPostId: original,
      publishedAt: past,
    });
    await mkPost(campaignId, b, {
      content: "",
      repostOfPostId: original,
      publishedAt: past,
    });
    await mkPost(campaignId, c, {
      content: "look at this",
      repostOfPostId: original,
      publishedAt: past,
    });

    const feed = await getExploreFeed(campaignId, author, null);
    const view = feed.posts.find((p) => p.id === original);
    expect(view).toBeTruthy();
    expect(view!.repostCount).toBe(2); // plain boosts only
    expect(view!.quoteCount).toBe(1); // quotes counted separately
  });

  it("lists only visible quotes of a post, newest-first", async () => {
    const { campaignId, userId } = await mkCampaign();
    const author = await mkPersona(campaignId, userId, { handle: "auth" });
    const q1u = await mkPersona(campaignId, userId, { handle: "q1" });
    const q2u = await mkPersona(campaignId, userId, { handle: "q2" });
    const booster = await mkPersona(campaignId, userId, { handle: "boost" });

    const original = await mkPost(campaignId, author, {
      content: "the original",
      publishedAt: new Date(Date.now() - 60_000),
    });

    const q1 = await mkPost(campaignId, q1u, {
      content: "earlier quote",
      repostOfPostId: original,
      publishedAt: new Date(Date.now() - 40_000),
    });
    const q2 = await mkPost(campaignId, q2u, {
      content: "later quote",
      repostOfPostId: original,
      publishedAt: new Date(Date.now() - 20_000),
    });
    // a plain boost must NOT appear in the quotes list
    await mkPost(campaignId, booster, {
      content: "",
      repostOfPostId: original,
      publishedAt: new Date(Date.now() - 30_000),
    });
    // a deleted quote must NOT appear either
    await mkPost(campaignId, q1u, {
      content: "deleted quote",
      repostOfPostId: original,
      publishedAt: new Date(Date.now() - 10_000),
      deletedAt: new Date(),
    });

    const feed = await getQuotesOf(campaignId, original, author, null);
    expect(feed).not.toBeNull();
    expect(feed!.posts.map((p) => p.id)).toEqual([q2, q1]); // newest first
  });

  it("returns null when the target post isn't visible", async () => {
    const { campaignId, userId } = await mkCampaign();
    const author = await mkPersona(campaignId, userId, { handle: "auth" });
    const quoter = await mkPersona(campaignId, userId, { handle: "q" });
    const past = new Date(Date.now() - 60_000);

    const deleted = await mkPost(campaignId, author, {
      content: "gone",
      publishedAt: past,
      deletedAt: new Date(),
    });
    await mkPost(campaignId, quoter, {
      content: "quoting a removed post",
      repostOfPostId: deleted,
      publishedAt: past,
    });

    // quotes of a deleted post can't be enumerated
    expect(await getQuotesOf(campaignId, deleted, author, null)).toBeNull();
    // and an id that doesn't exist is null too
    expect(await getQuotesOf(campaignId, 999_999, author, null)).toBeNull();
  });

  it("scopes quotes to the campaign", async () => {
    const c1 = await mkCampaign();
    const c2 = await mkCampaign();
    const author1 = await mkPersona(c1.campaignId, c1.userId, { handle: "a1" });
    const author2 = await mkPersona(c2.campaignId, c2.userId, { handle: "a2" });
    const past = new Date(Date.now() - 60_000);

    const original = await mkPost(c1.campaignId, author1, {
      content: "original in c1",
      publishedAt: past,
    });
    const quote1 = await mkPost(c1.campaignId, author1, {
      content: "quote in c1",
      repostOfPostId: original,
      publishedAt: past,
    });

    // the same post id viewed from c2 must not be found, and c1's quote must not
    // leak when queried under c2's campaign id
    expect(await getQuotesOf(c2.campaignId, original, author2, null)).toBeNull();

    const feed = await getQuotesOf(c1.campaignId, original, author1, null);
    expect(feed!.posts.map((p) => p.id)).toEqual([quote1]);
  });
});
