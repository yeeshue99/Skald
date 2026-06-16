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

  const parsed = personaSchema.safeParse({
    handle: formData.get("handle"),
    displayName: formData.get("displayName"),
    bio: formData.get("bio"),
    avatarUrl: formData.get("avatarUrl"),
    avatarFrame: formData.get("avatarFrame"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { handle, displayName, bio, avatarUrl, avatarFrame } = parsed.data;

  try {
    await db.insert(personas).values({
      campaignId: ctx.campaign.id,
      ownerUserId: ctx.user.id,
      handle,
      handleLower: handle.toLowerCase(),
      displayName,
      bio: bio || null,
      avatarUrl: avatarUrl || null,
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
    bio: formData.get("bio"),
    avatarUrl: formData.get("avatarUrl"),
    avatarFrame: formData.get("avatarFrame"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { handle, displayName, bio, avatarUrl, avatarFrame } = parsed.data;

  try {
    await db
      .update(personas)
      .set({
        handle,
        handleLower: handle.toLowerCase(),
        displayName,
        bio: bio || null,
        avatarUrl: avatarUrl || null,
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
