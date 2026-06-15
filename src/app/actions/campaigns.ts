"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { campaigns, memberships, personas } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { loadActionContext } from "@/lib/campaign";
import {
  createCampaignSchema,
  slugify,
  HANDLE_RE,
  normalizeHandle,
  MAX_DISPLAY_NAME,
} from "@/lib/validation";
import { AVAILABLE_FONTS, getPreset, type Theme } from "@/lib/themes";
import { generateInviteCode, randomSlugSuffix } from "@/lib/ids";
import { type FormState, isUniqueViolation } from "@/lib/form";

// ---------------------------------------------------------------------------
// Create a campaign (the creator becomes its DM).
// ---------------------------------------------------------------------------
export async function createCampaignAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/new-campaign");

  const parsed = createCampaignSchema.safeParse({
    name: formData.get("name"),
    presetId: formData.get("presetId"),
    dmDisplayName: formData.get("dmDisplayName"),
    dmHandle: formData.get("dmHandle"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }
  const { name, presetId, dmDisplayName, dmHandle } = parsed.data;

  const preset = getPreset(presetId);
  const theme: Theme = { ...preset, appName: name };

  // pick an unused slug
  const base = slugify(name);
  let slug = base;
  for (let i = 0; i < 6; i++) {
    const exists = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.slug, slug))
      .limit(1);
    if (exists.length === 0) break;
    slug = `${base}-${randomSlugSuffix()}`;
  }

  let createdSlug: string | null = null;
  for (let attempt = 0; attempt < 3 && !createdSlug; attempt++) {
    const inviteCode = generateInviteCode();
    try {
      createdSlug = await db.transaction(async (tx) => {
        const [c] = await tx
          .insert(campaigns)
          .values({ slug, name, theme, inviteCode, createdByUserId: user.id })
          .returning({ id: campaigns.id, slug: campaigns.slug });
        await tx
          .insert(memberships)
          .values({ userId: user.id, campaignId: c.id, role: "dm" });
        const [p] = await tx
          .insert(personas)
          .values({
            campaignId: c.id,
            ownerUserId: user.id,
            handle: dmHandle,
            handleLower: dmHandle.toLowerCase(),
            displayName: dmDisplayName,
            isNpc: false,
          })
          .returning({ id: personas.id });
        await tx
          .update(memberships)
          .set({ actingPersonaId: p.id })
          .where(
            and(eq(memberships.userId, user.id), eq(memberships.campaignId, c.id)),
          );
        return c.slug;
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        // invite-code or slug collision — nudge the slug and retry
        slug = `${base}-${randomSlugSuffix()}`;
        continue;
      }
      throw e;
    }
  }

  if (!createdSlug) return { error: "Couldn't create the campaign. Try again." };
  redirect(`/c/${createdSlug}`);
}

// ---------------------------------------------------------------------------
// Join an existing campaign with your existing account.
// ---------------------------------------------------------------------------
const joinSchema = z.object({
  code: z.string().trim().min(1),
  displayName: z.string().trim().min(1).max(MAX_DISPLAY_NAME),
  handle: z
    .string()
    .transform(normalizeHandle)
    .pipe(z.string().regex(HANDLE_RE, "2-24 letters, numbers, or underscore")),
});

export async function joinCampaignAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = joinSchema.safeParse({
    code: String(formData.get("code") ?? "").toUpperCase(),
    displayName: formData.get("displayName"),
    handle: formData.get("handle"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }
  const { code, displayName, handle } = parsed.data;

  const campaign = (
    await db.select().from(campaigns).where(eq(campaigns.inviteCode, code)).limit(1)
  )[0];
  if (!campaign) return { error: "That invite code didn't match a campaign." };

  const already = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(eq(memberships.userId, user.id), eq(memberships.campaignId, campaign.id)),
    )
    .limit(1);
  if (already.length) redirect(`/c/${campaign.slug}`);

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(memberships)
        .values({ userId: user.id, campaignId: campaign.id, role: "player" });
      const [p] = await tx
        .insert(personas)
        .values({
          campaignId: campaign.id,
          ownerUserId: user.id,
          handle,
          handleLower: handle.toLowerCase(),
          displayName,
          isNpc: false,
        })
        .returning({ id: personas.id });
      await tx
        .update(memberships)
        .set({ actingPersonaId: p.id })
        .where(
          and(
            eq(memberships.userId, user.id),
            eq(memberships.campaignId, campaign.id),
          ),
        );
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { error: "That character handle is already taken in this campaign." };
    }
    throw e;
  }

  redirect(`/c/${campaign.slug}`);
}

// ---------------------------------------------------------------------------
// Update theme / wordmark (DM only).
// ---------------------------------------------------------------------------
const hex = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Invalid color");
const fontName = z.string().refine((v) => AVAILABLE_FONTS.includes(v), "Unknown font");

const themeInputSchema = z.object({
  id: z.string().min(1).max(40),
  appName: z.string().trim().min(1).max(MAX_DISPLAY_NAME),
  tagline: z.string().trim().max(140).default(""),
  mode: z.enum(["dark", "light"]),
  radius: z.string().regex(/^[0-9.]+(rem|px|em)$/, "Invalid radius"),
  fonts: z.object({ display: fontName, body: fontName }),
  colors: z.object({
    background: hex,
    surface: hex,
    surfaceHover: hex,
    border: hex,
    text: hex,
    textMuted: hex,
    primary: hex,
    primaryHover: hex,
    onPrimary: hex,
    accent: hex,
    like: hex,
    repost: hex,
    link: hex,
  }),
});

export async function updateThemeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const slug = String(formData.get("slug") ?? "");
  const ctx = await loadActionContext(slug);
  if (ctx.role !== "dm") return { error: "Only the DM can change the theme." };

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("theme") ?? ""));
  } catch {
    return { error: "Could not read the theme data." };
  }
  const parsed = themeInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid theme." };
  }
  const theme = parsed.data as Theme;

  await db
    .update(campaigns)
    .set({ name: theme.appName, theme })
    .where(eq(campaigns.id, ctx.campaign.id));

  revalidatePath(`/c/${slug}`, "layout");
  return { ok: true };
}

export async function regenerateInviteAction(slug: string): Promise<void> {
  const ctx = await loadActionContext(slug);
  if (ctx.role !== "dm") throw new Error("Only the DM can rotate the invite code.");
  // try a few times in the astronomically unlikely event of a collision
  for (let i = 0; i < 4; i++) {
    try {
      await db
        .update(campaigns)
        .set({ inviteCode: generateInviteCode() })
        .where(eq(campaigns.id, ctx.campaign.id));
      break;
    } catch (e) {
      if (isUniqueViolation(e)) continue;
      throw e;
    }
  }
  revalidatePath(`/c/${slug}/settings`);
}

// ---------------------------------------------------------------------------
// Member admin (DM only).
// ---------------------------------------------------------------------------
export async function setMemberRoleAction(
  slug: string,
  targetUserId: number,
  role: "dm" | "player",
): Promise<void> {
  const ctx = await loadActionContext(slug);
  if (ctx.role !== "dm") throw new Error("Only the DM can change roles.");
  if (targetUserId === ctx.user.id) throw new Error("You can't change your own role.");
  if (targetUserId === ctx.campaign.createdByUserId)
    throw new Error("The campaign creator's role is fixed.");

  await db
    .update(memberships)
    .set({ role })
    .where(
      and(
        eq(memberships.campaignId, ctx.campaign.id),
        eq(memberships.userId, targetUserId),
      ),
    );
  revalidatePath(`/c/${slug}/settings`);
}

export async function removeMemberAction(
  slug: string,
  targetUserId: number,
): Promise<void> {
  const ctx = await loadActionContext(slug);
  if (ctx.role !== "dm") throw new Error("Only the DM can remove members.");
  if (targetUserId === ctx.user.id) throw new Error("You can't remove yourself.");
  if (targetUserId === ctx.campaign.createdByUserId)
    throw new Error("You can't remove the campaign creator.");

  await db.transaction(async (tx) => {
    // removing their personas cascade-deletes that member's posts/follows/likes
    await tx
      .delete(personas)
      .where(
        and(
          eq(personas.campaignId, ctx.campaign.id),
          eq(personas.ownerUserId, targetUserId),
        ),
      );
    await tx
      .delete(memberships)
      .where(
        and(
          eq(memberships.campaignId, ctx.campaign.id),
          eq(memberships.userId, targetUserId),
        ),
      );
  });
  revalidatePath(`/c/${slug}/settings`);
}
