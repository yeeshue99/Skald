import { cache } from "react";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  campaigns,
  memberships,
  personas,
  type Campaign,
  type Membership,
  type Persona,
  type Role,
} from "@/db/schema";
import { getCurrentUser, type PublicUser } from "./auth";

export const getCampaignBySlug = cache(
  async (slug: string): Promise<Campaign | null> => {
    const rows = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.slug, slug))
      .limit(1);
    return rows[0] ?? null;
  },
);

export type CampaignContext = {
  user: PublicUser;
  campaign: Campaign;
  membership: Membership;
  role: Role;
  /** the persona the user is currently acting as (server-resolved, not forgeable) */
  actingPersona: Persona;
  /** every persona this user may act as in this campaign (own PC + any NPCs they own) */
  myPersonas: Persona[];
};

export const getCampaignContext = cache(
  async (slug: string): Promise<CampaignContext | null> => {
    // user lookup and campaign lookup are independent — run them together
    const [user, campaign] = await Promise.all([
      getCurrentUser(),
      getCampaignBySlug(slug),
    ]);
    if (!user || !campaign) return null;

    // membership and personas both depend only on (user, campaign) — parallel
    const [membershipRows, myPersonas] = await Promise.all([
      db
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, user.id),
            eq(memberships.campaignId, campaign.id),
          ),
        )
        .limit(1),
      db
        .select()
        .from(personas)
        .where(
          and(
            eq(personas.ownerUserId, user.id),
            eq(personas.campaignId, campaign.id),
          ),
        )
        // player character (is_npc = false) first, then NPCs by creation order
        .orderBy(asc(personas.isNpc), asc(personas.id)),
    ]);
    const membership = membershipRows[0];
    if (!membership) return null;
    if (myPersonas.length === 0) return null;

    const actingPersona =
      myPersonas.find((p) => p.id === membership.actingPersonaId) ??
      myPersonas[0];

    return {
      user,
      campaign,
      membership,
      role: membership.role,
      actingPersona,
      myPersonas,
    };
  },
);

/** Pages: returns the context or redirects (to login / join / home). */
export async function requireCampaignContext(
  slug: string,
): Promise<CampaignContext> {
  const ctx = await getCampaignContext(slug);
  if (ctx) return ctx;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/c/${slug}`)}`);

  const campaign = await getCampaignBySlug(slug);
  if (!campaign) redirect("/");
  // ctx was null: tell apart "a member who hasn't created a character yet" (the
  // DM provisioned a login but left the character to them) from "not a member".
  const membership = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(eq(memberships.userId, user.id), eq(memberships.campaignId, campaign.id)),
    )
    .limit(1);
  if (membership.length) redirect(`/onboard/${slug}`);
  redirect(`/join/${slug}`);
}

export async function requireDmContext(slug: string): Promise<CampaignContext> {
  const ctx = await requireCampaignContext(slug);
  if (ctx.role !== "dm") redirect(`/c/${slug}`);
  return ctx;
}

/** Actions: returns the context or throws (no redirect). */
export async function loadActionContext(
  slug: string,
): Promise<CampaignContext> {
  const ctx = await getCampaignContext(slug);
  if (!ctx) throw new Error("You don't have access to this campaign.");
  return ctx;
}

/** True when the user may post / act as the given persona in this campaign. */
export function ownsPersona(ctx: CampaignContext, personaId: number): boolean {
  return ctx.myPersonas.some((p) => p.id === personaId);
}

/** All campaigns the user belongs to (for the launcher / landing). */
export const getMyCampaigns = cache(
  async (
    userId: number,
  ): Promise<Array<Campaign & { role: Role }>> => {
    const rows = await db
      .select({ campaign: campaigns, role: memberships.role })
      .from(memberships)
      .innerJoin(campaigns, eq(campaigns.id, memberships.campaignId))
      .where(eq(memberships.userId, userId))
      .orderBy(asc(campaigns.name));
    return rows.map((r) => ({ ...r.campaign, role: r.role }));
  },
);
