"use server";

import { loadActionContext } from "@/lib/campaign";
import {
  decodeCursor,
  getBookmarksFeed,
  getExploreFeed,
  getHomeFeed,
  getNewerExploreFeed,
  getNewerHomeFeed,
  getNewerPersonaPosts,
  getPersonaByHandle,
  getPersonaPosts,
  type Feed,
  type PostView,
} from "@/lib/queries";

export async function fetchFeedPageAction(
  slug: string,
  type: "home" | "explore" | "profile" | "bookmarks",
  cursor: string | null,
  handleLower?: string,
): Promise<Feed> {
  const ctx = await loadActionContext(slug);
  const cur = decodeCursor(cursor);

  if (type === "home") {
    return getHomeFeed(ctx.campaign.id, ctx.actingPersona.id, cur);
  }
  if (type === "explore") {
    return getExploreFeed(ctx.campaign.id, ctx.actingPersona.id, cur);
  }
  if (type === "bookmarks") {
    return getBookmarksFeed(ctx.campaign.id, ctx.actingPersona.id, cur);
  }
  if (!handleLower) return { posts: [], nextCursor: null };
  const persona = await getPersonaByHandle(ctx.campaign.id, handleLower);
  if (!persona) return { posts: [], nextCursor: null };
  return getPersonaPosts(ctx.campaign.id, persona.id, ctx.actingPersona.id, cur);
}

// Posts that appeared after the given (publishedAt, id) head — used for the
// live "N new posts" pill and to surface the user's own just-sent post.
export async function fetchNewerFeedAction(
  slug: string,
  type: "home" | "explore" | "profile" | "bookmarks",
  afterIso: string,
  afterId: number,
  handleLower?: string,
): Promise<PostView[]> {
  // bookmarks are a static, self-curated list; no live "new posts" polling
  if (type === "bookmarks") return [];
  const ctx = await loadActionContext(slug);
  const publishedAt = new Date(afterIso);
  if (Number.isNaN(publishedAt.getTime()) || !Number.isInteger(afterId)) {
    return [];
  }
  const after = { publishedAt, id: afterId };

  if (type === "home") {
    return getNewerHomeFeed(ctx.campaign.id, ctx.actingPersona.id, after);
  }
  if (type === "explore") {
    return getNewerExploreFeed(ctx.campaign.id, ctx.actingPersona.id, after);
  }
  if (!handleLower) return [];
  const persona = await getPersonaByHandle(ctx.campaign.id, handleLower);
  if (!persona) return [];
  return getNewerPersonaPosts(
    ctx.campaign.id,
    persona.id,
    ctx.actingPersona.id,
    after,
  );
}
