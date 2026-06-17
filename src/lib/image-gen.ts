// Optional text-to-image for the seeder. When IMAGE_GEN_API_KEY is set, persona
// avatars and post images are generated from their avatarHint/imageHint; with no
// key, the deterministic placeholders below are returned and behavior is
// byte-for-byte identical to the keyless seed.
//
// The two placeholder generators are the single source of truth (the seeder used
// to inline them). Everything here always resolves to a URL string: any provider
// error, timeout, or unusable hint falls back to the matching placeholder, so the
// seed can never fail or hang on image generation.
//
// Note: with a key set, reseeds call the provider afresh, so generated images are
// NOT deterministic and will differ between runs. The placeholders, used when no
// key is set, stay stable across reseeds (seeded by handle / post ref).

import { put } from "@vercel/blob";

// Roughly how long to wait on the provider before giving up and using the
// placeholder. A hung provider must never stall the seed.
const PROVIDER_TIMEOUT_MS = 30_000;

// Read the key on each call (NOT a module-level const) so env toggles between
// calls / tests are honored.
export function imageGenEnabled(): boolean {
  return Boolean(process.env.IMAGE_GEN_API_KEY?.trim());
}

// Keyless, deterministic avatar per persona (DiceBear, seeded by handle), so a
// seeded campaign reads as populated instead of a wall of initials.
export function placeholderAvatar(handle: string): string {
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(handle)}`;
}

// Placeholder image for a post that carries an imageHint. It does NOT match the
// hint; it just fills the image slot so layouts with media are exercised. Seeded
// by the post ref so it's stable across reseeds.
export function placeholderPostImage(ref: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent("skald-" + ref)}/900/506`;
}

function usableHint(hint: string | undefined | null): string | null {
  const t = hint?.trim();
  return t ? t : null;
}

interface AvatarArgs {
  handle: string;
  hint?: string;
}
interface PostImageArgs {
  ref: string;
  hint?: string;
}

// Generate (or fall back to) a persona avatar. Never rejects: any failure during
// prompt build, fetch setup, the request itself, or a blob upload resolves to the
// deterministic placeholder.
export async function generateAvatar({ handle, hint }: AvatarArgs): Promise<string> {
  const placeholder = placeholderAvatar(handle);
  const h = usableHint(hint);
  if (!imageGenEnabled() || !h) return placeholder;
  try {
    const prompt = `Portrait avatar, head and shoulders, for a fantasy social profile: ${h}`;
    const url = await callProvider(prompt);
    return url ?? placeholder;
  } catch {
    return placeholder;
  }
}

// Generate (or fall back to) a post image. Never rejects (see generateAvatar).
export async function generatePostImage({ ref, hint }: PostImageArgs): Promise<string> {
  const placeholder = placeholderPostImage(ref);
  const h = usableHint(hint);
  if (!imageGenEnabled() || !h) return placeholder;
  try {
    const prompt = `Wide social-media post image, 16:9: ${h}`;
    const url = await callProvider(prompt);
    return url ?? placeholder;
  } catch {
    return placeholder;
  }
}

interface ProviderResult {
  /** a hosted image URL the provider returned directly */
  url?: string;
  /** raw base64 image data (no data: prefix), which we upload to Blob ourselves */
  b64?: string;
}

// Call the configured provider and resolve to a usable URL, or null to signal the
// caller should use the placeholder. Reads the key itself on each call. Wraps the
// request in an AbortController timeout so a hung provider falls back rather than
// stalling the seed; an abort is treated as the normal fall-back path.
async function callProvider(prompt: string): Promise<string | null> {
  const apiKey = process.env.IMAGE_GEN_API_KEY?.trim();
  if (!apiKey) return null;

  const provider = (process.env.IMAGE_GEN_PROVIDER ?? "openai").trim().toLowerCase();
  const model = process.env.IMAGE_GEN_MODEL?.trim();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const result = await requestProvider(provider, apiKey, model, prompt, controller.signal);
    if (!result) return null;
    if (result.url) return result.url;
    if (result.b64) return await uploadBase64(result.b64);
    return null;
  } catch {
    // Includes AbortError on timeout: treat as a normal fall-back to placeholder.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Provider request. Default provider is OpenAI's image generation endpoint, which
// returns base64 (no hosted URL), so the b64 branch uploads to Blob. Add more
// providers here as needed; the env note documents the contract.
async function requestProvider(
  provider: string,
  apiKey: string,
  model: string | undefined,
  prompt: string,
  signal: AbortSignal,
): Promise<ProviderResult | null> {
  switch (provider) {
    case "openai":
    default: {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model ?? "gpt-image-1",
          prompt,
          n: 1,
          size: "1024x1024",
        }),
        signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        data?: Array<{ url?: string; b64_json?: string }>;
      };
      const first = data.data?.[0];
      if (!first) return null;
      if (first.url) return { url: first.url };
      if (first.b64_json) return { b64: first.b64_json };
      return null;
    }
  }
}

// Upload base64 image bytes to Vercel Blob and return the public URL, or null if
// the blob store isn't configured or the upload fails. Mirrors the put() pattern
// in app/api/upload.
async function uploadBase64(b64: string): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const bytes = Buffer.from(b64, "base64");
    const blob = await put("seed/avatar.png", bytes, {
      access: "public",
      addRandomSuffix: true,
      contentType: "image/png",
    });
    return blob.url;
  } catch {
    return null;
  }
}
