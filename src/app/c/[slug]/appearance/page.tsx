import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { decorations } from "@/db/schema";
import { requireCampaignContext } from "@/lib/campaign";
import { PageHeader } from "@/components/PageHeader";
import { DecorationManager } from "@/components/DecorationManager";

// Any member's personal "appearance" page: author decoration mods and pick which
// one applies to you in this campaign. The DM's campaign-wide theme lives under
// Settings; this is the per-player override on top of it.
export default async function AppearancePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireCampaignContext(slug);

  const rows = await db
    .select({
      id: decorations.id,
      name: decorations.name,
      spec: decorations.spec,
    })
    .from(decorations)
    .where(
      and(
        eq(decorations.campaignId, ctx.campaign.id),
        eq(decorations.ownerUserId, ctx.user.id),
      ),
    )
    .orderBy(asc(decorations.id));

  return (
    <>
      <PageHeader
        title="Appearance"
        subtitle="Your decorations"
        backHref={`/c/${slug}`}
      />
      <div className="p-4">
        <DecorationManager
          slug={slug}
          decorations={rows}
          selectedId={ctx.membership.selectedDecorationId ?? null}
          uploadEnabled={Boolean(process.env.BLOB_READ_WRITE_TOKEN)}
        />
      </div>
    </>
  );
}
