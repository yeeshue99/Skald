import { del, list } from "@vercel/blob";
import { isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { personas, posts } from "@/db/schema";
import { blobPathname } from "@/lib/blob";

export type SweepResult = {
  // false when BLOB_READ_WRITE_TOKEN isn't set (the uploader falls back to pasted
  // URLs, so there are no blobs of ours to sweep)
  configured: boolean;
  scanned: number;
  referenced: number;
  orphans: number;
  deleted: number;
  bytes: number;
};

type BlobLike = { pathname: string; url: string; size: number };

// Pure core: the listed blobs that no row points at. Exported so it can be
// tested without a live blob store.
export function pickOrphans(
  referenced: Set<string>,
  blobs: BlobLike[],
): BlobLike[] {
  return blobs.filter((b) => !referenced.has(b.pathname));
}

// Every uploads/ pathname still referenced by a persona avatar/banner or a post
// image. Soft-deleted posts keep their row, so their image stays referenced (and
// safe) until the post is actually purged. Pasted/external URLs are skipped.
export async function collectReferencedBlobPaths(): Promise<Set<string>> {
  const referenced = new Set<string>();
  const add = (url: string | null) => {
    const p = blobPathname(url);
    if (p) referenced.add(p);
  };
  const [avatars, banners, images] = await Promise.all([
    db.select({ url: personas.avatarUrl }).from(personas).where(isNotNull(personas.avatarUrl)),
    db.select({ url: personas.bannerUrl }).from(personas).where(isNotNull(personas.bannerUrl)),
    db.select({ url: posts.imageUrl }).from(posts).where(isNotNull(posts.imageUrl)),
  ]);
  for (const r of avatars) add(r.url);
  for (const r of banners) add(r.url);
  for (const r of images) add(r.url);
  return referenced;
}

// Delete every blob under uploads/ that no row references: images replaced by a
// newer upload, or belonging to a hard-deleted persona / post (cascades). A
// dry-run reports without deleting. No-op when the blob store isn't configured.
export async function sweepOrphanedBlobs(
  opts: { dryRun?: boolean } = {},
): Promise<SweepResult> {
  const res: SweepResult = {
    configured: false,
    scanned: 0,
    referenced: 0,
    orphans: 0,
    deleted: 0,
    bytes: 0,
  };
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res;
  res.configured = true;

  const referenced = await collectReferencedBlobPaths();
  res.referenced = referenced.size;

  const orphanUrls: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "uploads/", cursor, limit: 1000 });
    res.scanned += page.blobs.length;
    for (const b of pickOrphans(referenced, page.blobs)) {
      orphanUrls.push(b.url);
      res.bytes += b.size ?? 0;
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  res.orphans = orphanUrls.length;

  if (!opts.dryRun) {
    // del() takes up to a sensible batch at a time
    for (let i = 0; i < orphanUrls.length; i += 100) {
      const batch = orphanUrls.slice(i, i + 100);
      await del(batch);
      res.deleted += batch.length;
    }
  }
  return res;
}
