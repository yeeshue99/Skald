"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships, personas } from "@/db/schema";
import { loadActionContext, ownsPersona } from "@/lib/campaign";
import { personaSchema } from "@/lib/validation";
import { type FormState, isUniqueViolation } from "@/lib/form";

// DM creates a new NPC persona to post as.
export async function createPersonaAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const slug = String(formData.get("slug") ?? "");
  const ctx = await loadActionContext(slug);
  if (ctx.role !== "dm") return { error: "Only the DM can create NPCs." };

  // absent optional fields arrive as null from FormData; coerce to undefined so
  // the schema defaults apply (the NPC form omits bannerUrl / avatarFrame)
  const parsed = personaSchema.safeParse({
    handle: formData.get("handle"),
    displayName: formData.get("displayName"),
    bio: formData.get("bio") ?? undefined,
    avatarUrl: formData.get("avatarUrl") ?? undefined,
    bannerUrl: formData.get("bannerUrl") ?? undefined,
    avatarFrame: formData.get("avatarFrame") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { handle, displayName, bio, avatarUrl, bannerUrl, avatarFrame } =
    parsed.data;

  try {
    await db.insert(personas).values({
      campaignId: ctx.campaign.id,
      ownerUserId: ctx.user.id,
      handle,
      handleLower: handle.toLowerCase(),
      displayName,
      bio: bio || null,
      avatarUrl: avatarUrl || null,
      bannerUrl: bannerUrl || null,
      avatarFrame,
      isNpc: true,
    });
  } catch (e) {
    if (isUniqueViolation(e))
      return { error: "That handle is already used in this campaign." };
    throw e;
  }

  revalidatePath(`/c/${slug}`, "layout");
  revalidatePath(`/c/${slug}/settings`);
  return { ok: true };
}

// DM creates a character and assigns it to a campaign member. isNpc follows the
// target's role: a player gets a real character they control; the DM gets an NPC.
export async function createPlayerPersonaAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const slug = String(formData.get("slug") ?? "");
  const ctx = await loadActionContext(slug);
  if (ctx.role !== "dm") return { error: "Only the DM can assign characters." };

  const memberUserId = Number(formData.get("memberUserId"));
  if (!Number.isInteger(memberUserId)) return { error: "Pick a player." };
  const target = (
    await db
      .select({ role: memberships.role })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, memberUserId),
          eq(memberships.campaignId, ctx.campaign.id),
        ),
      )
      .limit(1)
  )[0];
  if (!target) return { error: "That player isn't in this campaign." };

  // this form only sends handle + displayName; absent optional fields arrive as
  // null from FormData, so coerce to undefined to let the schema defaults apply
  const parsed = personaSchema.safeParse({
    handle: formData.get("handle"),
    displayName: formData.get("displayName"),
    bio: formData.get("bio") ?? undefined,
    avatarUrl: formData.get("avatarUrl") ?? undefined,
    bannerUrl: formData.get("bannerUrl") ?? undefined,
    avatarFrame: formData.get("avatarFrame") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { handle, displayName, bio, avatarUrl, bannerUrl, avatarFrame } =
    parsed.data;

  try {
    await db.insert(personas).values({
      campaignId: ctx.campaign.id,
      ownerUserId: memberUserId,
      handle,
      handleLower: handle.toLowerCase(),
      displayName,
      bio: bio || null,
      avatarUrl: avatarUrl || null,
      bannerUrl: bannerUrl || null,
      avatarFrame,
      isNpc: target.role === "dm",
    });
  } catch (e) {
    if (isUniqueViolation(e))
      return { error: "That handle is already used in this campaign." };
    throw e;
  }

  revalidatePath(`/c/${slug}`, "layout");
  revalidatePath(`/c/${slug}/settings`);
  return { ok: true };
}

// DM reassigns a persona to a different member. isNpc follows the new owner's
// role (player -> their character, DM -> an NPC). Clears any acting-persona
// pointer the previous owner held to it.
export async function reassignPersonaAction(
  slug: string,
  personaId: number,
  newOwnerUserId: number,
): Promise<void> {
  const ctx = await loadActionContext(slug);
  if (ctx.role !== "dm") throw new Error("Only the DM can reassign characters.");
  if (!Number.isInteger(personaId) || !Number.isInteger(newOwnerUserId))
    throw new Error("Bad request.");

  const persona = (
    await db
      .select({ id: personas.id })
      .from(personas)
      .where(
        and(eq(personas.id, personaId), eq(personas.campaignId, ctx.campaign.id)),
      )
      .limit(1)
  )[0];
  if (!persona) throw new Error("Persona not found.");

  const target = (
    await db
      .select({ role: memberships.role })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, newOwnerUserId),
          eq(memberships.campaignId, ctx.campaign.id),
        ),
      )
      .limit(1)
  )[0];
  if (!target) throw new Error("That member isn't in this campaign.");

  await db
    .update(personas)
    .set({ ownerUserId: newOwnerUserId, isNpc: target.role === "dm" })
    .where(eq(personas.id, personaId));

  // whoever was acting as it no longer owns it; fall back to their default
  await db
    .update(memberships)
    .set({ actingPersonaId: null })
    .where(
      and(
        eq(memberships.campaignId, ctx.campaign.id),
        eq(memberships.actingPersonaId, personaId),
      ),
    );

  revalidatePath(`/c/${slug}`, "layout");
  revalidatePath(`/c/${slug}/settings`);
}

// Edit a persona you own (your character, or an NPC). DM may edit any persona.
export async function updatePersonaAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const slug = String(formData.get("slug") ?? "");
  const personaId = Number(formData.get("personaId"));
  const ctx = await loadActionContext(slug);
  if (!Number.isInteger(personaId)) return { error: "Unknown persona." };
  if (!ownsPersona(ctx, personaId) && ctx.role !== "dm")
    return { error: "You can't edit that persona." };

  const parsed = personaSchema.safeParse({
    handle: formData.get("handle"),
    displayName: formData.get("displayName"),
    bio: formData.get("bio") ?? undefined,
    avatarUrl: formData.get("avatarUrl") ?? undefined,
    bannerUrl: formData.get("bannerUrl") ?? undefined,
    avatarFrame: formData.get("avatarFrame") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { handle, displayName, bio, avatarUrl, bannerUrl, avatarFrame } =
    parsed.data;

  try {
    await db
      .update(personas)
      .set({
        handle,
        handleLower: handle.toLowerCase(),
        displayName,
        bio: bio || null,
        avatarUrl: avatarUrl || null,
        bannerUrl: bannerUrl || null,
        avatarFrame,
      })
      .where(
        and(eq(personas.id, personaId), eq(personas.campaignId, ctx.campaign.id)),
      );
  } catch (e) {
    if (isUniqueViolation(e))
      return { error: "That handle is already used in this campaign." };
    throw e;
  }

  revalidatePath(`/c/${slug}`, "layout");
  return { ok: true };
}

// DM deletes one of their NPC personas (and, by cascade, its posts).
export async function deletePersonaAction(
  slug: string,
  personaId: number,
): Promise<void> {
  const ctx = await loadActionContext(slug);
  const persona = (
    await db
      .select()
      .from(personas)
      .where(
        and(eq(personas.id, personaId), eq(personas.campaignId, ctx.campaign.id)),
      )
      .limit(1)
  )[0];
  if (!persona) throw new Error("Persona not found.");
  if (!persona.isNpc) throw new Error("Player characters can't be deleted here.");
  if (persona.ownerUserId !== ctx.user.id && ctx.role !== "dm")
    throw new Error("Not your persona.");

  await db.delete(personas).where(eq(personas.id, personaId));
  revalidatePath(`/c/${slug}`, "layout");
  revalidatePath(`/c/${slug}/settings`);
}

// Switch which persona you're acting as (server-side, not a forgeable cookie).
export async function setActingPersonaAction(
  slug: string,
  personaId: number,
): Promise<void> {
  const ctx = await loadActionContext(slug);
  if (!ownsPersona(ctx, personaId)) throw new Error("You don't own that persona.");
  await db
    .update(memberships)
    .set({ actingPersonaId: personaId })
    .where(
      and(
        eq(memberships.userId, ctx.user.id),
        eq(memberships.campaignId, ctx.campaign.id),
      ),
    );
  revalidatePath(`/c/${slug}`, "layout");
}
