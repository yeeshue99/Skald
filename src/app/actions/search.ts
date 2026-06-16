"use server";

import { loadActionContext } from "@/lib/campaign";
import {
  searchMentionTargets,
  searchPosts,
  type Feed,
  type PersonaSummary,
} from "@/lib/queries";

// @mention autocomplete: personas matching the partial handle the user typed.
export async function searchMentionsAction(
  slug: string,
  query: string,
): Promise<PersonaSummary[]> {
  const ctx = await loadActionContext(slug);
  return searchMentionTargets(ctx.campaign.id, query.slice(0, 24), 6);
}

// Load-more for post search results. People results aren't paginated (the page
// shows a top-N). The "cursor" is just the next offset as a string (post search
// is ranked by relevance, not a stable keyset, so it pages by offset).
export async function searchPostsAction(
  slug: string,
  query: string,
  cursor: string | null,
): Promise<Feed> {
  const ctx = await loadActionContext(slug);
  const q = query.trim().slice(0, 100);
  if (!q) return { posts: [], nextCursor: null };
  const offset = Math.min(5000, Math.max(0, Math.trunc(Number(cursor)) || 0));
  return searchPosts(ctx.campaign.id, ctx.actingPersona.id, q, offset);
}
