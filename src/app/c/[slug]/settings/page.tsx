import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { personas } from "@/db/schema";
import { requireDmContext } from "@/lib/campaign";
import { getCampaignMembers } from "@/lib/queries";
import { ThemeEditorForm } from "@/components/forms/ThemeEditorForm";
import { AddMemberForm } from "@/components/AddMemberForm";
import { InviteManager } from "@/components/InviteManager";
import { MembersAdmin } from "@/components/MembersAdmin";
import { NpcManager } from "@/components/NpcManager";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireDmContext(slug);
  const members = await getCampaignMembers(ctx.campaign.id);

  const npcRows = await db
    .select({
      id: personas.id,
      handle: personas.handle,
      displayName: personas.displayName,
      bio: personas.bio,
      avatarUrl: personas.avatarUrl,
      bannerUrl: personas.bannerUrl,
      avatarFrame: personas.avatarFrame,
    })
    .from(personas)
    .where(
      and(eq(personas.campaignId, ctx.campaign.id), eq(personas.isNpc, true)),
    )
    .orderBy(asc(personas.displayName));

  return (
    <>
      <PageHeader title="Settings" subtitle={ctx.campaign.name} backHref={`/c/${slug}`} />
      <div className="space-y-6 p-4">
        <Section
          title="Theme"
          description="Restyle this campaign. Changes apply instantly for everyone."
        >
          <ThemeEditorForm slug={slug} initial={ctx.campaign.theme} />
        </Section>

        <Section title="Invite" description="How players join this campaign.">
          <InviteManager slug={slug} code={ctx.campaign.inviteCode} />
        </Section>

        <Section
          title="NPCs"
          description="Personas only you can post as. Switch to them in the composer."
        >
          <NpcManager slug={slug} npcs={npcRows} />
        </Section>

        <Section title="Members" description="Everyone in this campaign.">
          <AddMemberForm slug={slug} />
          <MembersAdmin
            slug={slug}
            members={members}
            creatorUserId={ctx.campaign.createdByUserId}
            meUserId={ctx.user.id}
          />
        </Section>
      </div>
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <h2 className="font-display text-xl font-bold text-text">{title}</h2>
      {description ? (
        <p className="mb-4 mt-0.5 text-sm text-muted">{description}</p>
      ) : (
        <div className="mb-4" />
      )}
      {children}
    </Card>
  );
}
