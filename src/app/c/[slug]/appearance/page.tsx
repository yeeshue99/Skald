import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { decorations } from "@/db/schema";
import { requireCampaignContext } from "@/lib/campaign";
import { PageHeader } from "@/components/PageHeader";
import { DecorationManager } from "@/components/DecorationManager";

// Any member's personal "appearance" page: author decoration mods (overriding any
// campaign decoration dimension, plus an optional uploaded backdrop) and pick
// which one applies to you. A DM additionally shares decorations campaign-wide
// and promotes one to the campaign default. The DM's base campaign theme lives
// under Settings; this layers on top of it.
export default async function AppearancePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireCampaignContext(slug);

  // your personal decorations + the shared campaign library, in one query
  const rows = await db
    .select({
      id: decorations.id,
      name: decorations.name,
      spec: decorations.spec,
      scope: decorations.scope,
      ownerUserId: decorations.ownerUserId,
    })
    .from(decorations)
    .where(eq(decorations.campaignId, ctx.campaign.id))
    .orderBy(asc(decorations.id));

  const personal = rows
    .filter((r) => r.scope === "personal" && r.ownerUserId === ctx.user.id)
    .map(({ id, name, spec }) => ({ id, name, spec }));
  const campaign = rows
    .filter((r) => r.scope === "campaign")
    .map(({ id, name, spec }) => ({ id, name, spec }));

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
          isDm={ctx.role === "dm"}
          personal={personal}
          campaign={campaign}
          selectedId={ctx.membership.selectedDecorationId ?? null}
          worldId={ctx.campaign.worldDecorationId ?? null}
          campaignTheme={ctx.campaign.theme}
          uploadEnabled={Boolean(process.env.BLOB_READ_WRITE_TOKEN)}
        />
      </div>
    </>
  );
}
