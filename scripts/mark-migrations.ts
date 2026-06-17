// Mark drizzle migrations as already-applied on a hand-built dev DB.
//
// Why: if you built a dev database with `drizzle-kit push` (or by hand) the
// drizzle.__drizzle_migrations journal is empty, so a fresh `pnpm db:migrate`
// would try to re-run every migration and fail on objects that already exist.
// This script backfills the journal rows (hash + folderMillis) so migrate sees
// the DB as up to date and becomes a no-op. It is idempotent: rows already
// present are left alone, and a second run inserts nothing.
//
// Usage:
//   pnpm db:mark-migrations --dry-run   # show the full journal table + planned inserts, write nothing
//   pnpm db:mark-migrations             # backfill missing rows on a dev DB
//   pnpm db:mark-migrations --yes       # required when DATABASE_URL looks production-ish
//
// load-env MUST be imported before ./index so dotenv populates process.env
// before the pool is constructed.
import "../src/db/load-env";
import { sql } from "drizzle-orm";
import { fileURLToPath } from "node:url";
import { db } from "../src/db/index";
import {
  readJournalMigrations,
  missingMigrationRows,
} from "../src/db/migration-journal";

const DRIZZLE_DIR = fileURLToPath(new URL("../drizzle", import.meta.url));

const DRY_RUN = process.argv.includes("--dry-run");
const YES = process.argv.includes("--yes");

// A connection string drizzle/the pool would never reach. We refuse rather than
// silently no-op, so the operator notices their env is wrong.
const PLACEHOLDER_HOSTS = new Set(["invalid", "localhost", "127.0.0.1"]);

interface ExistingRow {
  id: number;
  hash: string;
  created_at: string | number | null;
}

function parseUrl(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

// "Production-looking" is a heuristic: anything that is not an obvious local
// host. We never want to backfill a journal on a real DB without an explicit ack.
function looksProduction(u: URL): boolean {
  const host = u.hostname.toLowerCase();
  if (PLACEHOLDER_HOSTS.has(host)) return false;
  if (host.endsWith(".local")) return false;
  return true;
}

// db.execute returns { rows } on node-postgres and a bare array on the Neon
// driver; normalise both to an array.
function rowsOf<T>(res: unknown): T[] {
  const withRows = res as { rows?: T[] };
  if (withRows && Array.isArray(withRows.rows)) return withRows.rows;
  return Array.isArray(res) ? (res as T[]) : [];
}

async function main() {
  const rawUrl = process.env.DATABASE_URL;
  const parsed = parseUrl(rawUrl);

  // Refuse a missing / unparseable / placeholder URL outright.
  if (!parsed) {
    console.error(
      "DATABASE_URL is missing or not a valid connection string. " +
        "Set it in .env.local to point at your dev database, then re-run.",
    );
    process.exit(1);
  }
  // The index.ts fallback URL is postgresql://invalid:invalid@127.0.0.1:5432/invalid;
  // refuse the placeholder host or username/database "invalid" so a script run
  // with an unset env can't silently target nothing.
  if (
    parsed.hostname.toLowerCase() === "invalid" ||
    parsed.username.toLowerCase() === "invalid" ||
    parsed.pathname.toLowerCase() === "/invalid"
  ) {
    console.error(
      `Refusing to run against the placeholder connection string ("${parsed.hostname}"). ` +
        "Set a real DATABASE_URL in .env.local.",
    );
    process.exit(1);
  }

  const host = parsed.hostname;

  // Production guardrail: require --yes and echo the host so a misconfigured
  // .env can't quietly mutate a real database's migration journal.
  if (!DRY_RUN && looksProduction(parsed) && !YES) {
    console.error(
      `DATABASE_URL host "${host}" looks like a real (non-local) database.\n` +
        "This script writes to drizzle.__drizzle_migrations. If that is intended, " +
        "re-run with --yes. To preview without writing, use --dry-run.",
    );
    process.exit(1);
  }

  console.log(`Target database host: ${host}`);

  const journal = readJournalMigrations(DRIZZLE_DIR);
  console.log(`Journal has ${journal.length} migration(s).`);

  // Make sure the journal table exists; CREATE ... IF NOT EXISTS mirrors what
  // drizzle's own migrator does, so the column shape is identical (id serial pk,
  // hash text not null, created_at bigint).
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const existingRes = await db.execute(
    sql`SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id ASC`,
  );
  const existing = rowsOf<ExistingRow>(existingRes);
  const appliedHashes = existing.map((r) => r.hash);

  const missing = missingMigrationRows(appliedHashes, journal);

  if (DRY_RUN) {
    // Print the FULL existing table, not just planned inserts, so a human can
    // spot a corrupt or unexpectedly-newer row (which would silently make
    // migrate skip a real migration).
    console.log(
      `\nExisting drizzle.__drizzle_migrations (${existing.length} row(s)):`,
    );
    if (existing.length === 0) {
      console.log("  (empty)");
    } else {
      for (const r of existing) {
        console.log(
          `  id=${r.id}  created_at=${r.created_at}  hash=${r.hash}`,
        );
      }
    }
    console.log(`\nRows that would be inserted (${missing.length}):`);
    if (missing.length === 0) {
      console.log("  (none — journal already fully marked)");
    } else {
      for (const m of missing) {
        console.log(
          `  ${m.tag}  created_at=${m.when}  hash=${m.hash}`,
        );
      }
    }
    console.log("\nDry run: no rows were written.");
    await shutdown(0);
    return;
  }

  if (missing.length === 0) {
    console.log("Nothing to do: every journal row is already marked applied.");
    await shutdown(0);
    return;
  }

  // Insert every missing row in one transaction (self-healing across arbitrary
  // gaps). created_at is the exact folderMillis as a bigint — never Date.now()
  // and never a string — because migrate's skip predicate is
  // Number(lastRow.created_at) < folderMillis.
  await db.transaction(async (tx) => {
    for (const m of missing) {
      await tx.execute(
        sql`INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES (${m.hash}, ${m.when})`,
      );
    }
  });

  console.log(`Inserted ${missing.length} journal row(s):`);
  for (const m of missing) {
    console.log(`  ${m.tag}  created_at=${m.when}`);
  }
  console.log("Done. `pnpm db:migrate` should now be a no-op on this database.");
  await shutdown(0);
}

// The dev Neon driver pool keeps the event loop alive, so explicitly end the
// pool and then exit, matching seed.ts's clean termination.
async function shutdown(code: number) {
  try {
    const client = (db as unknown as { $client?: { end?: () => Promise<void> } })
      .$client;
    if (client && typeof client.end === "function") {
      await client.end();
    }
  } catch {
    // ignore pool teardown errors; we're exiting anyway
  }
  process.exit(code);
}

main().catch(async (err) => {
  console.error(err);
  await shutdown(1);
});
