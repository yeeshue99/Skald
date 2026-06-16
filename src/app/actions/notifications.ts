"use server";

import { revalidatePath } from "next/cache";
import { loadActionContext } from "@/lib/campaign";
import { markNotificationsRead } from "@/lib/queries";

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
