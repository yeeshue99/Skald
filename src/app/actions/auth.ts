"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { campaigns, memberships, personas, users } from "@/db/schema";
import {
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import {
  loginSchema,
  registerSchema,
  normalizeUsername,
  USERNAME_RE,
} from "@/lib/validation";
import { type FormState, isUniqueViolation, safeNext } from "@/lib/form";

const accountOnly = z.object({
  username: z
    .string()
    .transform(normalizeUsername)
    .pipe(z.string().regex(USERNAME_RE, "3-20 letters, numbers, or underscore")),
  password: z.string().min(8, "At least 8 characters").max(200),
});

export async function registerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();

  // --- Path A: invite code present -> create account AND join the campaign ---
  if (code) {
    const parsed = registerSchema.safeParse({
      inviteCode: code,
      username: formData.get("username"),
      password: formData.get("password"),
      displayName: formData.get("displayName"),
      handle: formData.get("handle"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check your details." };
    }
    const { username, password, displayName, handle } = parsed.data;

    const campaign = (
      await db.select().from(campaigns).where(eq(campaigns.inviteCode, code)).limit(1)
    )[0];
    if (!campaign) {
      return { error: "That invite code didn't match a campaign." };
    }

    let newUserId: number;
    try {
      const passwordHash = await hashPassword(password);
      newUserId = await db.transaction(async (tx) => {
        const [u] = await tx
          .insert(users)
          .values({ username, usernameLower: username.toLowerCase(), passwordHash })
          .returning({ id: users.id });
        await tx
          .insert(memberships)
          .values({ userId: u.id, campaignId: campaign.id, role: "player" });
        const [p] = await tx
          .insert(personas)
          .values({
            campaignId: campaign.id,
            ownerUserId: u.id,
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
              eq(memberships.userId, u.id),
              eq(memberships.campaignId, campaign.id),
            ),
          );
        return u.id;
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        return { error: "That username or character handle is already taken." };
      }
      throw e;
    }

    await createSession(newUserId);
    redirect(`/c/${campaign.slug}`);
  }

  // --- Path B: no code -> create a bare account (e.g. a DM about to start one) ---
  const parsed = accountOnly.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }
  const { username, password } = parsed.data;

  let userId: number;
  try {
    const passwordHash = await hashPassword(password);
    const [u] = await db
      .insert(users)
      .values({ username, usernameLower: username.toLowerCase(), passwordHash })
      .returning({ id: users.id });
    userId = u.id;
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "That username is already taken." };
    throw e;
  }

  await createSession(userId);
  redirect("/");
}

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter your username and password." };

  const next = safeNext(String(formData.get("next") ?? ""));
  const { username, password } = parsed.data;

  const user = (
    await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.usernameLower, username.trim().toLowerCase()))
      .limit(1)
  )[0];

  // Same message either way, to avoid leaking which usernames exist.
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    return { error: "Incorrect username or password." };
  }

  await createSession(user.id);
  redirect(next);
}

// Self-service password change for the signed-in user. Verifies the current
// password, then re-hashes the new one. (Sessions are token-based, so the
// current session stays valid.)
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .max(200),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "New passwords don't match",
    path: ["confirmPassword"],
  });

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await getCurrentUser();
  if (!me) return { error: "You're not signed in." };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const { currentPassword, newPassword } = parsed.data;

  const row = (
    await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, me.id))
      .limit(1)
  )[0];
  if (!row) return { error: "Account not found." };

  const ok = await verifyPassword(currentPassword, row.passwordHash);
  if (!ok) return { error: "Your current password is incorrect." };
  if (newPassword === currentPassword) {
    return { error: "Your new password must be different." };
  }

  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, me.id));
  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
