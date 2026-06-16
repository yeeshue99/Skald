// Delete orphaned Vercel Blob images. Dry-run by default; pass --apply to delete.
//   pnpm tsx src/db/blob-sweep.ts          # report what would be deleted
//   pnpm tsx src/db/blob-sweep.ts --apply  # actually delete
import "./load-env";
import { sweepOrphanedBlobs } from "../lib/blob-cleanup";

async function main() {
  const apply = process.argv.includes("--apply");
  const r = await sweepOrphanedBlobs({ dryRun: !apply });
  if (!r.configured) {
    console.log("BLOB_READ_WRITE_TOKEN not set; nothing to sweep.");
    process.exit(0);
  }
  const kb = (r.bytes / 1024).toFixed(0);
  console.log(
    `${apply ? "Deleted" : "Would delete"} ${r.orphans} orphan blob(s) (~${kb} KB). ` +
      `Scanned ${r.scanned} under uploads/, ${r.referenced} referenced.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
