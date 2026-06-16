"use server";

import { revalidatePath } from "next/cache";
import { loadActionContext } from "@/lib/campaign";
import {
  decodeNotifCursor,
  getNotifications,
  markNotificationsRead,
  type NotifPage,
} from "@/lib/queries";

// Mark every notification for the user's personas as read (called when the
// notifications page is opened). Revalidates the campaign layout so the nav
// unread badge clears.
export async function markNotificationsReadAction(slug: string): Promise<void> {
  const ctx = await loadActionContext(slug);
  await markNotificationsRead(
    ctx.campaign.id,
    ctx.myPersonas.map((p) => p.id),
  );
  revalidatePath(`/c/${slug}`, "layout");
}

// Next page of notifications for the user's personas (keyset by created_at,id).
export async function fetchNotificationsPageAction(
  slug: string,
  cursor: string | null,
): Promise<NotifPage> {
  const ctx = await loadActionContext(slug);
  return getNotifications(
    ctx.campaign.id,
    ctx.myPersonas.map((p) => p.id),
    decodeNotifCursor(cursor),
  );
}
