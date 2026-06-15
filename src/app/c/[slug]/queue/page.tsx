import { requireCampaignContext } from "@/lib/campaign";
import { getQueue } from "@/lib/queries";
import { QueueList } from "@/components/QueueList";
import { PageHeader } from "@/components/PageHeader";

export default async function QueuePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireCampaignContext(slug);
  const ownedIds = ctx.myPersonas.map((p) => p.id);
  const { scheduled, drafts } = await getQueue(ctx.campaign.id, ownedIds);

  return (
    <>
      <PageHeader
        title="Queue"
        subtitle="Posts waiting to go live, and your drafts"
      />
      <QueueList slug={slug} scheduled={scheduled} drafts={drafts} />
    </>
  );
}
