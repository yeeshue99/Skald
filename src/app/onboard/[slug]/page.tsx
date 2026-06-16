import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships, personas } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getCampaignBySlug } from "@/lib/campaign";
import { AuthShell } from "@/components/AuthShell";
import { OnboardingForm } from "@/components/forms/OnboardingForm";

// First sign-in for a player the DM provisioned without a character: they pick
// their own. Lives outside the /c/[slug] layout (which requires a persona) to
// avoid a redirect loop.
export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/onboard/${slug}`)}`);

  const campaign = await getCampaignBySlug(slug);
  if (!campaign) redirect("/");

  const membership = (
    await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, user.id),
          eq(memberships.campaignId, campaign.id),
        ),
      )
      .limit(1)
  )[0];
  if (!membership) redirect(`/join/${slug}`);

  // already has a character -> straight into the campaign
  const persona = (
    await db
      .select({ id: personas.id })
      .from(personas)
      .where(
        and(
          eq(personas.ownerUserId, user.id),
          eq(personas.campaignId, campaign.id),
        ),
      )
      .limit(1)
  )[0];
  if (persona) redirect(`/c/${slug}`);

  return (
    <AuthShell
      title={`Welcome to ${campaign.name}`}
      subtitle="Create your character to step into the feed."
    >
      <OnboardingForm slug={slug} />
    </AuthShell>
  );
}
