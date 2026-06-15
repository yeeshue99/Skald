import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getCampaignBySlug } from "@/lib/campaign";
import { AuthShell } from "@/components/AuthShell";
import { JoinForm } from "@/components/forms/JoinForm";

export default async function JoinCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { slug } = await params;
  const { code } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join/${slug}`)}`);

  const campaign = await getCampaignBySlug(slug);
  if (!campaign) redirect("/");

  const existing = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, user.id),
        eq(memberships.campaignId, campaign.id),
      ),
    )
    .limit(1);
  if (existing.length) redirect(`/c/${slug}`);

  return (
    <AuthShell
      title={`Join ${campaign.name}`}
      subtitle="Confirm the invite code and create your character for this campaign."
    >
      <JoinForm defaultCode={code?.trim().toUpperCase()} />
    </AuthShell>
  );
}
