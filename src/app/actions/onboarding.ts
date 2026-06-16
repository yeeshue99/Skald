"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { memberships, personas } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getCampaignBySlug } from "@/lib/campaign";
import {
  HANDLE_RE,
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME,
  normalizeHandle,
} from "@/lib/validation";
import { type FormState, isUniqueViolation } from "@/lib/form";

const onboardingSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Pick a character name")
    .max(MAX_DISPLAY_NAME, `Keep it under ${MAX_DISPLAY_NAME} characters`),
  handle: z
    .string()
    .transform(normalizeHandle)
    .pipe(z.string().regex(HANDLE_RE, "2-24 letters, numbers, or underscore")),
  bio: z.string().trim().max(MAX_BIO_LENGTH).optional().default(""),
});

// A brand-new player picks their own character on first sign-in. Creates the
// player-character persona and sets it as their acting persona.
export async function completeOnboardingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const slug = String(formData.get("slug") ?? "");
  const user = await getCurrentUser();
  if (!user) return { error: "You're not signed in." };
  const campaign = await getCampaignBySlug(slug);
  if (!campaign) return { error: "Campaign not found." };

  const membership = (
    await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, user.id),
          eq(memberships.campaignId, campaign.id),
        ),
      )
      .limit(1)
  )[0];
  if (!membership) return { error: "You're not a member of this campaign." };

  // already have a character? nothing to do — go to the feed (idempotent).
  const already = (
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
  if (already) redirect(`/c/${slug}`);

  const parsed = onboardingSchema.safeParse({
    displayName: formData.get("displayName"),
    handle: formData.get("handle"),
    bio: formData.get("bio"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }
  const { displayName, handle, bio } = parsed.data;

  const taken = (
    await db
      .select({ id: personas.id })
      .from(personas)
      .where(
        and(
          eq(personas.campaignId, campaign.id),
          eq(personas.handleLower, handle.toLowerCase()),
        ),
      )
      .limit(1)
  )[0];
  if (taken) return { error: "That handle is taken in this campaign." };

  try {
    await db.transaction(async (tx) => {
      const [p] = await tx
        .insert(personas)
        .values({
          campaignId: campaign.id,
          ownerUserId: user.id,
          handle,
          handleLower: handle.toLowerCase(),
          displayName,
          bio: bio || null,
          isNpc: false,
        })
        .returning({ id: personas.id });
      await tx
        .update(memberships)
        .set({ actingPersonaId: p.id })
        .where(eq(memberships.id, membership.id));
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "That handle was just taken." };
    throw e;
  }

  redirect(`/c/${slug}`);
}
