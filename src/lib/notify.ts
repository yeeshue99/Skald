import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { notifications, personas } from "@/db/schema";
import type { NotificationType } from "@/db/schema";

// Mentions use the same shape the feed linkifies (@handle, 2-24 word chars).
const MENTION_RE = /@([a-zA-Z0-9_]{2,24})/g;

// Insert a notification. Self-notifications are skipped (the DB also enforces
// it), and like/follow are deduped by their partial unique indexes, so toggling
// can't pile rows up.
export async function notify(params: {
  campaignId: number;
  recipientPersonaId: number;
  actorPersonaId: number;
  type: NotificationType;
  postId?: number | null;
}): Promise<void> {
  if (params.recipientPersonaId === params.actorPersonaId) return;
  await db
    .insert(notifications)
    .values({
      campaignId: params.campaignId,
      recipientPersonaId: params.recipientPersonaId,
      actorPersonaId: params.actorPersonaId,
      type: params.type,
      postId: params.postId ?? null,
    })
    .onConflictDoNothing();
}

// Undo the notification for an un-liked post.
export async function removeLikeNotification(
  actorPersonaId: number,
  postId: number,
): Promise<void> {
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.type, "like"),
        eq(notifications.actorPersonaId, actorPersonaId),
        eq(notifications.postId, postId),
      ),
    );
}

// Undo the notification for an unfollow.
export async function removeFollowNotification(
  actorPersonaId: number,
  recipientPersonaId: number,
): Promise<void> {
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.type, "follow"),
        eq(notifications.actorPersonaId, actorPersonaId),
        eq(notifications.recipientPersonaId, recipientPersonaId),
      ),
    );
}

// Parse @mentions out of `content`, resolve them to personas in the campaign,
// and notify each (skipping the actor and any already-notified personas, e.g.
// the reply recipient, so a reply that also @-tags the parent author doesn't
// double-notify).
export async function notifyMentions(opts: {
  campaignId: number;
  actorPersonaId: number;
  postId: number;
  content: string;
  exclude?: number[];
}): Promise<void> {
  const handles = new Set<string>();
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(opts.content)) !== null) {
    handles.add(m[1].toLowerCase());
  }
  if (handles.size === 0) return;

  const rows = await db
    .select({ id: personas.id })
    .from(personas)
    .where(
      and(
        eq(personas.campaignId, opts.campaignId),
        inArray(personas.handleLower, [...handles]),
      ),
    );

  const skip = new Set([opts.actorPersonaId, ...(opts.exclude ?? [])]);
  for (const r of rows) {
    if (skip.has(r.id)) continue;
    await notify({
      campaignId: opts.campaignId,
      recipientPersonaId: r.id,
      actorPersonaId: opts.actorPersonaId,
      type: "mention",
      postId: opts.postId,
    });
  }
}
