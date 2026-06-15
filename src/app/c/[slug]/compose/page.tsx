import { requireCampaignContext } from "@/lib/campaign";
import type { PersonaSummary } from "@/lib/queries";
import { Composer } from "@/components/Composer";
import { PageHeader } from "@/components/PageHeader";

export default async function ComposePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireCampaignContext(slug);

  const personas: PersonaSummary[] = ctx.myPersonas.map((p) => ({
    id: p.id,
    handle: p.handle,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    isNpc: p.isNpc,
  }));

  return (
    <>
      <PageHeader title="New post" backHref={`/c/${slug}`} desktopOnly={false} />
      <Composer
        slug={slug}
        personas={personas}
        actingPersonaId={ctx.actingPersona.id}
        autoFocus
      />
    </>
  );
}
