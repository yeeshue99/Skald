import { z } from "zod";
import { PERSONA_AVATAR_FRAMES } from "./theme-types";

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
export const HANDLE_RE = /^[a-zA-Z0-9_]{2,24}$/;

export const MAX_POST_LENGTH = 500;
export const MAX_BIO_LENGTH = 200;
export const MAX_DISPLAY_NAME = 40;

export function normalizeUsername(input: string): string {
  return input.trim();
}

/** strip a leading @ and surrounding whitespace */
export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@+/, "");
}

export function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "campaign";
}

const handle = z
  .string()
  .transform(normalizeHandle)
  .pipe(z.string().regex(HANDLE_RE, "2-24 letters, numbers, or underscore"));

const displayName = z
  .string()
  .trim()
  .min(1, "Required")
  .max(MAX_DISPLAY_NAME, `Keep it under ${MAX_DISPLAY_NAME} characters`);

const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => v === "" || /^https?:\/\//.test(v), "Must be a valid http(s) URL")
  .optional()
  .default("");

export const registerSchema = z.object({
  inviteCode: z.string().trim().min(1, "Invite code required"),
  username: z
    .string()
    .transform(normalizeUsername)
    .pipe(z.string().regex(USERNAME_RE, "3-20 letters, numbers, or underscore")),
  password: z.string().min(8, "At least 8 characters").max(200),
  displayName,
  handle,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  username: z.string().min(1, "Required"),
  password: z.string().min(1, "Required"),
});

export const createCampaignSchema = z.object({
  name: displayName,
  presetId: z.string().min(1),
  dmDisplayName: displayName,
  dmHandle: handle,
});

export const personaSchema = z.object({
  handle,
  displayName,
  bio: z.string().trim().max(MAX_BIO_LENGTH).optional().default(""),
  avatarUrl: optionalUrl,
  bannerUrl: optionalUrl,
  avatarFrame: z.enum(PERSONA_AVATAR_FRAMES).optional().default("default"),
});

export const profileSchema = z.object({
  displayName,
  bio: z.string().trim().max(MAX_BIO_LENGTH).optional().default(""),
  avatarUrl: optionalUrl,
});

export const composeSchema = z.object({
  content: z.string().max(MAX_POST_LENGTH),
  imageUrl: optionalUrl,
  // ISO instant computed on the client from the local wall-clock picker
  scheduledAt: z.string().trim().optional().default(""),
  asDraft: z.coerce.boolean().optional().default(false),
  replyToPostId: z.coerce.number().int().positive().optional(),
});
