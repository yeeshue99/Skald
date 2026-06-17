"use server";

import { revalidatePath } from "next/cache";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { campaigns, decorations, memberships } from "@/db/schema";
import { loadActionContext } from "@/lib/campaign";
import { decorationSchema } from "@/lib/validation";
import { normalizeDecorationSpec, type DecorationSpec } from "@/lib/themes";
import { type FormState } from "@/lib/form";

// Author a decoration. A "personal" decoration is the member's own and is
// auto-selected for them (the "make it, it's mine" flow). A "campaign"
// decoration is shared by the DM with every member and is NOT auto-applied — the
// DM is curating the library, not changing their own view. The spec is a
// declarative override set (+ optional backdrop image), never executed.
export async function createDecorationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const slug = String(formData.get("slug") ?? "");
  const ctx = await loadActionContext(slug);

  let specRaw: unknown;
  try {
    specRaw = JSON.parse(String(formData.get("spec") ?? ""));
  } catch {
    return { error: "Could not read the decoration." };
  }

  const parsed = decorationSchema.safeParse({
    name: formData.get("name"),
    scope: formData.get("scope") ?? undefined,
    spec: specRaw,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { name, scope } = parsed.data;
  if (scope === "campaign" && ctx.role !== "dm") {
    return { error: "Only the DM can share a campaign decoration." };
  }
  // the zod tuple-enums widen `scroll` to string; normalize re-validates it
  const spec = normalizeDecorationSpec(parsed.data.spec as DecorationSpec);

  const inserted = await db
    .insert(decorations)
    .values({
      campaignId: ctx.campaign.id,
      ownerUserId: ctx.user.id,
      name,
      spec,
      scope,
    })
    .returning({ id: decorations.id });
  const newId = inserted[0]?.id;

  // auto-select only a personal decoration for its creator; a shared one is
  // added to the library without changing the DM's own view
  if (newId != null && scope === "personal") {
    await db
      .update(memberships)
      .set({ selectedDecorationId: newId })
      .where(
        and(
          eq(memberships.userId, ctx.user.id),
          eq(memberships.campaignId, ctx.campaign.id),
        ),
      );
  }

  revalidatePath(`/c/${slug}`, "layout");
  return { ok: true };
}

// Apply a decoration to yourself, or pass null to fall back to the campaign
// default. You may select your own personal decoration or any shared campaign one.
export async function selectDecorationAction(
  slug: string,
  decorationId: number | null,
): Promise<void> {
  const ctx = await loadActionContext(slug);

  if (decorationId !== null) {
    if (!Number.isInteger(decorationId)) throw new Error("Bad request.");
    const ok = await db
      .select({ id: decorations.id })
      .from(decorations)
      .where(
        and(
          eq(decorations.id, decorationId),
          eq(decorations.campaignId, ctx.campaign.id),
          or(
            eq(decorations.ownerUserId, ctx.user.id),
            eq(decorations.scope, "campaign"),
          ),
        ),
      )
      .limit(1);
    if (!ok[0]) throw new Error("You can't select that decoration.");
  }

  await db
    .update(memberships)
    .set({ selectedDecorationId: decorationId })
    .where(
      and(
        eq(memberships.userId, ctx.user.id),
        eq(memberships.campaignId, ctx.campaign.id),
      ),
    );

  revalidatePath(`/c/${slug}`, "layout");
}

// DM promotes a shared campaign decoration to the campaign default (applied to
// anyone without a personal pick), or passes null to clear it.
export async function setWorldDecorationAction(
  slug: string,
  decorationId: number | null,
): Promise<void> {
  const ctx = await loadActionContext(slug);
  if (ctx.role !== "dm") {
    throw new Error("Only the DM can set the campaign default.");
  }

  if (decorationId !== null) {
    if (!Number.isInteger(decorationId)) throw new Error("Bad request.");
    const shared = await db
      .select({ id: decorations.id })
      .from(decorations)
      .where(
        and(
          eq(decorations.id, decorationId),
          eq(decorations.campaignId, ctx.campaign.id),
          eq(decorations.scope, "campaign"),
        ),
      )
      .limit(1);
    if (!shared[0]) {
      throw new Error("The campaign default must be a shared decoration.");
    }
  }

  await db
    .update(campaigns)
    .set({ worldDecorationId: decorationId })
    .where(eq(campaigns.id, ctx.campaign.id));

  revalidatePath(`/c/${slug}`, "layout");
}

// Delete one of your own decorations (personal, or a shared one you created).
// FKs are ON DELETE SET NULL, so any member selection and the campaign default
// that pointed at it silently fall back.
export async function deleteDecorationAction(
  slug: string,
  decorationId: number,
): Promise<void> {
  const ctx = await loadActionContext(slug);
  if (!Number.isInteger(decorationId)) throw new Error("Bad request.");

  await db
    .delete(decorations)
    .where(
      and(
        eq(decorations.id, decorationId),
        eq(decorations.campaignId, ctx.campaign.id),
        eq(decorations.ownerUserId, ctx.user.id),
      ),
    );

  revalidatePath(`/c/${slug}`, "layout");
}
