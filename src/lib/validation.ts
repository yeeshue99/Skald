import { z } from "zod";
import {
  PERSONA_AVATAR_FRAMES,
  DECORATION_SCOPES,
  DECORATION_NAME_MAX,
  DECORATION_SIZE_MIN,
  DECORATION_SIZE_MAX,
  DECORATION_SIZE_DEFAULT,
} from "./theme-types";
import {
  DECORATION_FIELDS,
  DECORATION_VALUES,
  AMBIENT_EFFECT_VALUES,
} from "./decoration-options";
import { safeCssUrl } from "./themes";

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

// A decoration "mod". Declarative only: a partial override of the campaign's
// named decoration dimensions, plus an optional custom backdrop image. Built
// from the shared option list so the accepted values never drift from the
// editor. The backdrop image must pass the same url() safety check used at
// render time (safeCssUrl), so a URL that would be dropped on screen is rejected
// at creation instead.
const tuple = (vals: string[]) => vals as [string, ...string[]];

const decorationOverridesSchema = z
  .object(
    Object.fromEntries([
      ...DECORATION_FIELDS.map((f) => [
        f.key,
        z.enum(tuple(f.options.map((o) => o[0]))).optional(),
      ]),
      ["effects", z.array(z.enum(tuple(AMBIENT_EFFECT_VALUES))).max(9).optional()],
    ]),
  )
  .strict();

const backdropSchema = z.object({
  imageUrl: z
    .string()
    .trim()
    .min(1, "Upload or paste an image first")
    .max(2000)
    .refine((v) => safeCssUrl(v) !== "none", "That image URL isn't supported"),
  fit: z.enum(["tile", "cover"]).optional().default("tile"),
  size: z.coerce
    .number()
    .int()
    .min(DECORATION_SIZE_MIN)
    .max(DECORATION_SIZE_MAX)
    .optional()
    .default(DECORATION_SIZE_DEFAULT),
  opacity: z.coerce.number().min(0).max(1).optional().default(0.2),
  scroll: z.enum(tuple(DECORATION_VALUES.bgScroll)).optional().default("static"),
});

export const decorationSpecSchema = z
  .object({
    overrides: decorationOverridesSchema.optional().default({}),
    backdrop: backdropSchema.nullish(),
  })
  .refine(
    (s) =>
      (s.backdrop && safeCssUrl(s.backdrop.imageUrl) !== "none") ||
      Object.keys(s.overrides ?? {}).length > 0,
    "Pick at least one decoration or add a backdrop image",
  );

export const decorationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name your decoration")
    .max(DECORATION_NAME_MAX, `Keep it under ${DECORATION_NAME_MAX} characters`),
  scope: z.enum(DECORATION_SCOPES).optional().default("personal"),
  spec: decorationSpecSchema,
});
export type DecorationInput = z.infer<typeof decorationSchema>;

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

// Polls: 2-4 options, each a short label; voting runs for a whole number of days.
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 4;
export const POLL_OPTION_MAX = 40;
export const POLL_DAY_CHOICES = [1, 3, 7] as const;

export const pollInputSchema = z.object({
  options: z
    .array(z.string().trim().min(1, "Poll options can't be blank").max(POLL_OPTION_MAX))
    .min(POLL_MIN_OPTIONS, `A poll needs at least ${POLL_MIN_OPTIONS} options`)
    .max(POLL_MAX_OPTIONS, `A poll can have at most ${POLL_MAX_OPTIONS} options`),
  days: z.coerce
    .number()
    .int()
    .refine((d) => (POLL_DAY_CHOICES as readonly number[]).includes(d), "Pick a valid poll length"),
});
