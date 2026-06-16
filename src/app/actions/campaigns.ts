"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { campaigns, memberships, personas, users } from "@/db/schema";
import { getCurrentUser, hashPassword, revokeUserSessions } from "@/lib/auth";
import { loadActionContext } from "@/lib/campaign";
import {
  createCampaignSchema,
  slugify,
  HANDLE_RE,
  USERNAME_RE,
  normalizeHandle,
  normalizeUsername,
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
  // Optional so old payloads (no decorations) and new ones both validate.
  // Keys mirror the canonical Decorations unions in theme-types.ts.
  decorations: z
    .object({
      texture: z.enum([
        "none",
        "starchart",
        "parchment",
        "circuit",
        "constellations",
        "squiggle",
        "florets",
        "vinework",
      ]),
      bgScroll: z.enum([
        "static",
        "down",
        "up",
        "left",
        "right",
        "diagonal",
        "sineDown",
        "sway",
        "sineUp",
      ]),
      divider: z.enum([
        "plain",
        "asterism",
        "diamond",
        "dataline",
        "vine",
        "laurel",
      ]),
      buttons: z.enum(["flat", "arcaneGlow", "wax", "neon", "petal", "dew"]),
      avatarFrame: z.enum([
        "none",
        "manaHalo",
        "medallion",
        "hudBracket",
        "wreath",
        "blossom",
      ]),
      depth: z.enum([
        "flat",
        "violetAmbient",
        "paperMatte",
        "cyanBloom",
        "verdantAmbient",
        "roseGlow",
      ]),
      reactions: z.enum(["none", "sparkle", "stamp", "pulse", "petals", "bloom"]),
      cardFrame: z.enum([
        "plain",
        "gilded",
        "deckled",
        "chamfer",
        "botanical",
        "pressed",
      ]),
      wordmark: z.enum(["plain", "sigil", "dropcap", "caret", "sprig", "rosette"]),
      chrome: z.enum([
        "plain",
        "stainedGlass",
        "banner",
        "hudStrip",
        "trellis",
        "garland",
      ]),
      effects: z
        .array(
          z.enum([
            "embers",
            "motes",
            "dust",
            "scanlines",
            "fog",
            "pagecurl",
            "petalfall",
            "pollen",
            "leaves",
          ]),
        )
        .max(9),
    })
    .optional(),
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

// Provision a new human member directly: creates a login + player membership.
// The character is OPTIONAL — leave it blank and the player picks/confirms their
// own character on first sign-in (the onboarding flow); fill it in to preset one.
// The DM shares the username + password with the player. The invite-code flow's
// manual counterpart.
const addMemberAccountSchema = z.object({
  username: z
    .string()
    .transform(normalizeUsername)
    .pipe(
      z
        .string()
        .regex(USERNAME_RE, "Username: 3-20 letters, numbers, or underscore"),
    ),
  password: z.string().min(8, "Password: at least 8 characters").max(200),
});
const addMemberCharacterSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Character name is required")
    .max(MAX_DISPLAY_NAME, `Character name under ${MAX_DISPLAY_NAME} characters`),
  handle: z
    .string()
    .transform(normalizeHandle)
    .pipe(
      z.string().regex(HANDLE_RE, "Handle: 2-24 letters, numbers, or underscore"),
    ),
});

export async function addMemberAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const slug = String(formData.get("slug") ?? "");
  const ctx = await loadActionContext(slug);
  if (ctx.role !== "dm") return { error: "Only the DM can add members." };

  const account = addMemberAccountSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!account.success) {
    return { error: account.error.issues[0]?.message ?? "Check the details." };
  }
  const { username, password } = account.data;

  // The character is optional. If either field is filled, both must be valid;
  // if both are blank, the player creates their character on first sign-in.
  const rawName = String(formData.get("displayName") ?? "").trim();
  const rawHandle = String(formData.get("handle") ?? "").trim().replace(/^@+/, "");
  let character: { displayName: string; handle: string } | null = null;
  if (rawName || rawHandle) {
    const cp = addMemberCharacterSchema.safeParse({
      displayName: rawName,
      handle: rawHandle,
    });
    if (!cp.success) {
      return { error: cp.error.issues[0]?.message ?? "Check the character." };
    }
    character = cp.data;
  }

  // friendly pre-checks; the unique indexes remain the real guard against races
  const takenUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.usernameLower, username.toLowerCase()))
    .limit(1);
  if (takenUser.length) return { error: "That username is already taken." };

  if (character) {
    const takenHandle = await db
      .select({ id: personas.id })
      .from(personas)
      .where(
        and(
          eq(personas.campaignId, ctx.campaign.id),
          eq(personas.handleLower, character.handle.toLowerCase()),
        ),
      )
      .limit(1);
    if (takenHandle.length)
      return { error: "That character handle is taken in this campaign." };
  }

  const passwordHash = await hashPassword(password);
  try {
    await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({
          username,
          usernameLower: username.toLowerCase(),
          passwordHash,
        })
        .returning({ id: users.id });
      await tx
        .insert(memberships)
        .values({ userId: u.id, campaignId: ctx.campaign.id, role: "player" });
      if (character) {
        const [p] = await tx
          .insert(personas)
          .values({
            campaignId: ctx.campaign.id,
            ownerUserId: u.id,
            handle: character.handle,
            handleLower: character.handle.toLowerCase(),
            displayName: character.displayName,
            isNpc: false,
          })
          .returning({ id: personas.id });
        await tx
          .update(memberships)
          .set({ actingPersonaId: p.id })
          .where(
            and(
              eq(memberships.userId, u.id),
              eq(memberships.campaignId, ctx.campaign.id),
            ),
          );
      }
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { error: "That username or character handle was just taken." };
    }
    throw e;
  }

  revalidatePath(`/c/${slug}/settings`);
  return { ok: true };
}

// DM resets a member's login password (e.g. when they forget the temporary one).
// Forces that member to sign in again with the new password.
export async function resetMemberPasswordAction(
  slug: string,
  targetUserId: number,
  newPassword: string,
): Promise<void> {
  const ctx = await loadActionContext(slug);
  if (ctx.role !== "dm") throw new Error("Only the DM can reset passwords.");
  if (targetUserId === ctx.user.id)
    throw new Error("Use Change password for your own account.");

  const member = (
    await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.campaignId, ctx.campaign.id),
          eq(memberships.userId, targetUserId),
        ),
      )
      .limit(1)
  )[0];
  if (!member) throw new Error("That user isn't a member of this campaign.");

  if (typeof newPassword !== "string" || newPassword.length < 8)
    throw new Error("Password must be at least 8 characters.");

  const passwordHash = await hashPassword(newPassword);
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, targetUserId));
  await revokeUserSessions(targetUserId);
}

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
