"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { follows, personas } from "@/db/schema";
import { loadActionContext } from "@/lib/campaign";
import { notify, removeFollowNotification } from "@/lib/notify";

export async function toggleFollowAction(
  slug: string,
  targetPersonaId: number,
): Promise<{ following: boolean; followerCount: number }> {
  const ctx = await loadActionContext(slug);
  const follower = ctx.actingPersona.id;
  if (targetPersonaId === follower) throw new Error("You can't follow yourself.");

  const target = (
    await db
      .select({ id: personas.id })
      .from(personas)
      .where(
        and(
          eq(personas.id, targetPersonaId),
          eq(personas.campaignId, ctx.campaign.id),
        ),
      )
      .limit(1)
  )[0];
  if (!target) throw new Error("That persona doesn't exist here.");

  const existing = await db
    .select({ id: follows.id })
    .from(follows)
    .where(
      and(
        eq(follows.followerPersonaId, follower),
        eq(follows.followingPersonaId, targetPersonaId),
      ),
    )
    .limit(1);

  let following: boolean;
  if (existing.length) {
    await db.delete(follows).where(eq(follows.id, existing[0].id));
    following = false;
  } else {
    await db
      .insert(follows)
      .values({
        campaignId: ctx.campaign.id,
        followerPersonaId: follower,
        followingPersonaId: targetPersonaId,
      })
      .onConflictDoNothing();
    following = true;
  }

  if (following) {
    await notify({
      campaignId: ctx.campaign.id,
      recipientPersonaId: targetPersonaId,
      actorPersonaId: follower,
      type: "follow",
    });
  } else {
    await removeFollowNotification(follower, targetPersonaId);
  }

  const [{ c }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.followingPersonaId, targetPersonaId));

  revalidatePath(`/c/${slug}`);
  return { following, followerCount: Number(c) };
}
