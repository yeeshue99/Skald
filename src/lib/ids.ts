import { randomBytes, createHash } from "crypto";

// Server-only id/crypto helpers (Node crypto). Imported only from server code.

// Unambiguous alphabet — no 0/O/1/I/L to keep invite codes easy to read aloud.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateInviteCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only the hash is stored, so a DB leak never yields usable session tokens. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function randomSlugSuffix(length = 4): string {
  return randomBytes(8)
    .toString("base64url")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, length)
    .toLowerCase();
}
