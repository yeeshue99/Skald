import { describe, it, expect, beforeEach } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import { db } from "@/db";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  readJournalMigrations,
  missingMigrationRows,
} from "@/db/migration-journal";

const HAS_DB = !!process.env.TEST_DATABASE_URL;
const DRIZZLE_DIR = fileURLToPath(new URL("../../drizzle", import.meta.url));

interface JournalRow {
  id: number;
  hash: string;
  created_at: string | number | null;
}

function rowsOf<T>(res: unknown): T[] {
  const withRows = res as { rows?: T[] };
  if (withRows && Array.isArray(withRows.rows)) return withRows.rows;
  return Array.isArray(res) ? (res as T[]) : [];
}

async function readTable(): Promise<JournalRow[]> {
  const res = await db.execute(
    sql`SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id ASC`,
  );
  return rowsOf<JournalRow>(res);
}

// Re-create the journal table fresh for each test. The integration global setup
// uses `drizzle-kit push`, which manages schema.ts objects only — it does NOT
// create drizzle.__drizzle_migrations — so this models a hand-built dev DB whose
// journal is empty.
async function resetJournal(): Promise<void> {
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await db.execute(sql`DROP TABLE IF EXISTS drizzle.__drizzle_migrations`);
  await db.execute(sql`
    CREATE TABLE drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);
}

// The marker's core: insert every missing journal row with created_at set to the
// exact folderMillis. Mirrors scripts/mark-migrations.ts (which can't be
// imported here because it calls process.exit on completion).
async function runMarker(): Promise<number> {
  const journal = readJournalMigrations(DRIZZLE_DIR);
  const existing = await readTable();
  const missing = missingMigrationRows(
    existing.map((r) => r.hash),
    journal,
  );
  if (missing.length > 0) {
    await db.transaction(async (tx) => {
      for (const m of missing) {
        await tx.execute(
          sql`INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES (${m.hash}, ${m.when})`,
        );
      }
    });
  }
  return missing.length;
}

describe.skipIf(!HAS_DB)("mark-migrations marker", () => {
  beforeEach(resetJournal);

  it("backfills every journal row, then a subsequent migrate is a no-op", async () => {
    const journal = readJournalMigrations(DRIZZLE_DIR);
    expect(journal.length).toBeGreaterThan(0);

    // hand-built DB: no journal rows yet
    expect(await readTable()).toHaveLength(0);

    const inserted = await runMarker();
    expect(inserted).toBe(journal.length);

    const afterMark = await readTable();
    expect(afterMark).toHaveLength(journal.length);

    // created_at must equal the exact folderMillis (bigint comes back as a
    // string from node-postgres). The newest row's created_at is what migrate
    // compares against, so this is the load-bearing assertion.
    const newest = journal[journal.length - 1];
    const newestRow = afterMark.find((r) => r.hash === newest.hash);
    expect(newestRow).toBeDefined();
    expect(Number(newestRow!.created_at)).toBe(newest.when);

    // The actual migrator must now see the DB as up to date and insert nothing.
    // (drizzle-kit push already created the schema objects, so it would also
    // fail loudly if it tried to re-run a migration.)
    await migrate(db as unknown as NodePgDatabase, {
      migrationsFolder: DRIZZLE_DIR,
    });
    const afterMigrate = await readTable();
    expect(afterMigrate).toHaveLength(journal.length);
  });

  it("self-heals an arbitrary gap (only the middle row pre-applied)", async () => {
    const journal = readJournalMigrations(DRIZZLE_DIR);
    const mid = journal[Math.floor(journal.length / 2)];

    // Pre-apply just one middle migration by hand.
    await db.execute(
      sql`INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES (${mid.hash}, ${mid.when})`,
    );

    const inserted = await runMarker();
    expect(inserted).toBe(journal.length - 1);

    const after = await readTable();
    const hashes = new Set(after.map((r) => r.hash));
    for (const m of journal) {
      expect(hashes.has(m.hash)).toBe(true);
    }
  });

  it("is idempotent: a second run inserts zero rows", async () => {
    const first = await runMarker();
    expect(first).toBeGreaterThan(0);

    const second = await runMarker();
    expect(second).toBe(0);

    const journal = readJournalMigrations(DRIZZLE_DIR);
    expect(await readTable()).toHaveLength(journal.length);
  });
});
