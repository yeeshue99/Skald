"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookmarks, posts } from "@/db/schema";
import { loadActionContext } from "@/lib/campaign";

// Toggle a private bookmark for the acting persona. No public count, no
// notification — it's just a personal "save for later".
export async function toggleBookmarkAction(
  slug: string,
  postId: number,
): Promise<{ bookmarked: boolean }> {
  const ctx = await loadActionContext(slug);
  const personaId = ctx.actingPersona.id;

  // the post must exist in this campaign (visibility is re-checked when listing)
  const target = (
    await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.id, postId), eq(posts.campaignId, ctx.campaign.id)))
      .limit(1)
  )[0];
  if (!target) throw new Error("Post not available.");

  const existing = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(and(eq(bookmarks.personaId, personaId), eq(bookmarks.postId, postId)))
    .limit(1);

  let bookmarked: boolean;
  if (existing.length) {
    await db.delete(bookmarks).where(eq(bookmarks.id, existing[0].id));
    bookmarked = false;
  } else {
    await db
      .insert(bookmarks)
      .values({ campaignId: ctx.campaign.id, personaId, postId })
      .onConflictDoNothing();
    bookmarked = true;
  }

  revalidatePath(`/c/${slug}/bookmarks`);
  return { bookmarked };
}
