"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { decorations, memberships } from "@/db/schema";
import { loadActionContext } from "@/lib/campaign";
import { decorationSchema } from "@/lib/validation";
import { normalizeDecorationSpec } from "@/lib/themes";
import type { DecorationSpec } from "@/lib/theme-types";
import { type FormState } from "@/lib/form";

// Any member can author their own decoration in a campaign. It's stored as a
// declarative spec (never executed) and auto-selected for its creator — the
// "upload it, then it's mine until I change it" flow. Everyone else is
// unaffected; their membership has no selection, so they keep the world default.
export async function createDecorationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const slug = String(formData.get("slug") ?? "");
  const ctx = await loadActionContext(slug);

  // absent optional knobs arrive as null from FormData; coerce to undefined so
  // the schema defaults apply (the form may omit fit/size/opacity/scroll)
  const parsed = decorationSchema.safeParse({
    name: formData.get("name"),
    imageUrl: formData.get("imageUrl"),
    fit: formData.get("fit") ?? undefined,
    size: formData.get("size") ?? undefined,
    opacity: formData.get("opacity") ?? undefined,
    scroll: formData.get("scroll") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { name, imageUrl, fit, size, opacity, scroll } = parsed.data;
  const spec: DecorationSpec = normalizeDecorationSpec({
    kind: "backdrop",
    imageUrl,
    fit,
    size,
    opacity,
    scroll,
  });

  const inserted = await db
    .insert(decorations)
    .values({
      campaignId: ctx.campaign.id,
      ownerUserId: ctx.user.id,
      name,
      spec,
    })
    .returning({ id: decorations.id });
  const newId = inserted[0]?.id;

  if (newId != null) {
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

  // "layout" so the campaign backdrop (rendered in the campaign layout) updates,
  // along with the appearance page nested under it.
  revalidatePath(`/c/${slug}`, "layout");
  return { ok: true };
}

// Apply one of your decorations to yourself, or pass null to fall back to the
// campaign (world) default. Only your own decorations are selectable.
export async function selectDecorationAction(
  slug: string,
  decorationId: number | null,
): Promise<void> {
  const ctx = await loadActionContext(slug);

  if (decorationId !== null) {
    if (!Number.isInteger(decorationId)) throw new Error("Bad request.");
    const owned = await db
      .select({ id: decorations.id })
      .from(decorations)
      .where(
        and(
          eq(decorations.id, decorationId),
          eq(decorations.campaignId, ctx.campaign.id),
          eq(decorations.ownerUserId, ctx.user.id),
        ),
      )
      .limit(1);
    if (!owned[0]) throw new Error("That decoration isn't yours.");
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

// Delete one of your own decorations. The membership FK is ON DELETE SET NULL,
// so if it was your active pick you silently fall back to the world default.
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
