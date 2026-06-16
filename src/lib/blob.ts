// Helpers for the app's Vercel Blob uploads (see app/api/upload). The composer
// and avatar/banner fields also accept pasted external image URLs, which we must
// never delete — this lets cleanup tell our own blobs apart and skip the rest.

const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

// Returns the store pathname (e.g. "uploads/u1-abc.png") for a URL that lives in
// our Vercel Blob store, or null for an external/pasted URL or anything unparsable.
export function blobPathname(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith(BLOB_HOST_SUFFIX)) return null;
    return u.pathname.replace(/^\/+/, "");
  } catch {
    return null;
  }
}

export function isOurBlobUrl(url: string | null | undefined): boolean {
  return blobPathname(url) !== null;
}
