"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { campaignApiKeys } from "@/db/schema";
import { loadActionContext } from "@/lib/campaign";
import { generateSessionToken, hashToken } from "@/lib/ids";

// The raw token is returned ONCE, on creation; only its hash is stored.
export type ApiKeyFormState = { ok?: boolean; error?: string; token?: string };

export async function createApiKeyAction(
  _prev: ApiKeyFormState,
  formData: FormData,
): Promise<ApiKeyFormState> {
  const slug = String(formData.get("slug") ?? "");
  const ctx = await loadActionContext(slug);
  if (ctx.role !== "dm") return { error: "Only the DM can create API keys." };
  const label = String(formData.get("label") ?? "")
    .trim()
    .slice(0, 60);

  const raw = `skald_${generateSessionToken()}`;
  await db.insert(campaignApiKeys).values({
    campaignId: ctx.campaign.id,
    tokenHash: hashToken(raw),
    prefix: raw.slice(0, 12),
    label,
    createdByUserId: ctx.user.id,
  });

  revalidatePath(`/c/${slug}/settings`);
  return { ok: true, token: raw };
}

export async function revokeApiKeyAction(
  slug: string,
  keyId: number,
): Promise<void> {
  const ctx = await loadActionContext(slug);
  if (ctx.role !== "dm") throw new Error("Only the DM can revoke API keys.");
  await db
    .update(campaignApiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(campaignApiKeys.id, keyId),
        eq(campaignApiKeys.campaignId, ctx.campaign.id),
      ),
    );
  revalidatePath(`/c/${slug}/settings`);
}
