import { describe, it, expect, beforeEach } from "vitest";
import { searchPosts } from "@/lib/queries";
import { resetDb, mkCampaign, mkPersona, mkPost } from "@/test/factory";

const HAS_DB = !!process.env.TEST_DATABASE_URL;

// Full-text search lives on a STORED, GIN-indexed posts.search_vector
// (to_tsvector('english', content)). These prove the behaviour that matters to
// callers: FTS relevance beats a loose substring, multi-word queries AND their
// terms, stopword-only queries still fall back to the old substring match,
// hashtag / mention token search is unchanged, and results never leak across
// campaigns. No EXPLAIN/index assertion here: at test scale the planner may pick
// a seq scan, which would make such a check flaky without proving anything.
describe.skipIf(!HAS_DB)("post full-text search", () => {
  beforeEach(resetDb);

  it("ranks a strong FTS match above a substring-only match", async () => {
    const { campaignId, userId } = await mkCampaign();
    const author = await mkPersona(campaignId, userId, { handle: "auth" });

    // "dragon" as a whole word vs. "dragonfly" which only contains it as a
    // substring. FTS stems "dragon" to its own lexeme and ranks the exact
    // match higher; the substring-only post should still be unmatched by FTS
    // entirely (different lexeme), so the strong match wins outright.
    const strong = await mkPost(campaignId, author, {
      content: "The dragon circled the keep at dawn.",
    });
    const substring = await mkPost(campaignId, author, {
      content: "A dragonfly landed on the windowsill.",
    });

    const feed = await searchPosts(campaignId, author, "dragon");
    const ids = feed.posts.map((p) => p.id);
    expect(ids).toContain(strong);
    // the whole-word match must rank first
    expect(ids[0]).toBe(strong);
    // "dragonfly" is a separate lexeme, so it isn't an FTS hit at all
    expect(ids).not.toContain(substring);
  });

  it("requires every word of a multi-word query (AND semantics)", async () => {
    const { campaignId, userId } = await mkCampaign();
    const author = await mkPersona(campaignId, userId, { handle: "auth" });

    const both = await mkPost(campaignId, author, {
      content: "The silver dragon guards the mountain pass.",
    });
    // each has only one of the two terms
    await mkPost(campaignId, author, {
      content: "The dragon slept for a hundred years.",
    });
    await mkPost(campaignId, author, {
      content: "Snow blanketed the silver fir trees.",
    });

    const feed = await searchPosts(campaignId, author, "silver dragon");
    expect(feed.posts.map((p) => p.id)).toEqual([both]);
  });

  it("falls back to substring matching for a stopword-only query", async () => {
    const { campaignId, userId } = await mkCampaign();
    const author = await mkPersona(campaignId, userId, { handle: "auth" });

    // "the a of" tokenises to nothing (all stopwords), so FTS can't match it.
    // The guard-only ilike fallback should still surface posts that literally
    // contain the substring "the a of".
    const hit = await mkPost(campaignId, author, {
      content: "the a of sequence is a known riddle opener",
    });
    await mkPost(campaignId, author, {
      content: "completely unrelated content here",
    });

    const feed = await searchPosts(campaignId, author, "the a of");
    expect(feed.posts.map((p) => p.id)).toContain(hit);
  });

  it("hashtag and mention token search still match on word boundaries", async () => {
    const { campaignId, userId } = await mkCampaign();
    const author = await mkPersona(campaignId, userId, { handle: "auth" });

    const tagged = await mkPost(campaignId, author, {
      content: "Heading to the #biblioplex tonight.",
    });
    // contains the bare word but not as a hashtag, so #biblioplex must not match
    await mkPost(campaignId, author, {
      content: "The biblioplex was quiet.",
    });
    const mentioned = await mkPost(campaignId, author, {
      content: "Looping in @tasha for the plan.",
    });
    await mkPost(campaignId, author, {
      content: "tasha already knows the plan.",
    });

    const tagFeed = await searchPosts(campaignId, author, "#biblioplex");
    expect(tagFeed.posts.map((p) => p.id)).toEqual([tagged]);

    const mentionFeed = await searchPosts(campaignId, author, "@tasha");
    expect(mentionFeed.posts.map((p) => p.id)).toEqual([mentioned]);
  });

  it("never returns matches from another campaign", async () => {
    const mine = await mkCampaign();
    const theirs = await mkCampaign();
    const meAuthor = await mkPersona(mine.campaignId, mine.userId, {
      handle: "me",
    });
    const themAuthor = await mkPersona(theirs.campaignId, theirs.userId, {
      handle: "them",
    });

    const mineHit = await mkPost(mine.campaignId, meAuthor, {
      content: "A wyvern nests on the cliff.",
    });
    // same content in the other campaign must stay invisible to my search
    await mkPost(theirs.campaignId, themAuthor, {
      content: "A wyvern nests on the cliff.",
    });

    const feed = await searchPosts(mine.campaignId, meAuthor, "wyvern");
    expect(feed.posts.map((p) => p.id)).toEqual([mineHit]);
  });
});
