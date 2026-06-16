import type { Metadata } from "next";
import { requireCampaignContext } from "@/lib/campaign";
import { getNotifications, pruneReadNotifications } from "@/lib/queries";
import { PageHeader } from "@/components/PageHeader";
import { NotificationList } from "@/components/NotificationList";
import { MarkNotificationsRead } from "@/components/MarkNotificationsRead";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireCampaignContext(slug);
  const personaIds = ctx.myPersonas.map((p) => p.id);
  // lazy retention: clear out long-read notifications on each visit
  await pruneReadNotifications(ctx.campaign.id, personaIds);
  const { items, nextCursor } = await getNotifications(
    ctx.campaign.id,
    personaIds,
  );
  const hasUnread = items.some((n) => n.readAt == null);

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Likes, replies, quotes, follows, and mentions"
      />
      <MarkNotificationsRead slug={slug} hasUnread={hasUnread} />
      <NotificationList
        slug={slug}
        initialItems={items}
        initialCursor={nextCursor}
        multiPersona={ctx.myPersonas.length > 1}
      />
    </>
  );
}
