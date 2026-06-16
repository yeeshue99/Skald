import { notFound } from "next/navigation";
import { requireCampaignContext } from "@/lib/campaign";
import { getThread, type PersonaSummary } from "@/lib/queries";
import { QuoteComposer } from "@/components/QuoteComposer";
import { PageHeader } from "@/components/PageHeader";

export default async function QuotePage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) notFound();

  const ctx = await requireCampaignContext(slug);
  const thread = await getThread(ctx.campaign.id, postId, ctx.actingPersona.id);
  if (!thread) notFound();

  const personas: PersonaSummary[] = ctx.myPersonas.map((p) => ({
    id: p.id,
    handle: p.handle,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    isNpc: p.isNpc,
    avatarFrame: p.avatarFrame,
  }));

  return (
    <>
      <PageHeader title="Quote post" backHref={`/c/${slug}`} desktopOnly={false} />
      <QuoteComposer
        slug={slug}
        personas={personas}
        actingPersonaId={ctx.actingPersona.id}
        quoted={thread.root}
      />
    </>
  );
}
