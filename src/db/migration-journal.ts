// Pure helpers for reading the drizzle migration journal and computing which
// journal rows are missing from drizzle.__drizzle_migrations. No DB import: the
// only side effect is reading the migration files off disk, exactly the way
// drizzle-orm's own migrator does. Keeping this module DB-free lets it be unit
// tested without a connection.
//
// The marker (scripts/mark-migrations.ts) uses these to backfill journal rows
// on a hand-built dev DB so a from-scratch `pnpm db:migrate` becomes a no-op.
import { existsSync, readFileSync } from "node:fs";
import { readMigrationFiles } from "drizzle-orm/migrator";

export interface JournalMigration {
  /** The migration tag, e.g. "0000_first_falcon". */
  tag: string;
  /**
   * sha256 hex of the ENTIRE raw .sql file. This is byte-for-byte what
   * drizzle-orm writes into drizzle.__drizzle_migrations.hash, so matching on it
   * is exact. We delegate the hash to drizzle-orm's readMigrationFiles rather
   * than recomputing it, so we can never drift from its algorithm.
   */
  hash: string;
  /**
   * The migration's folderMillis, i.e. the `when` field in meta/_journal.json.
   * drizzle writes this verbatim into created_at (a bigint), and its migrate
   * skip predicate is `Number(lastRow.created_at) < folderMillis`, so the value
   * MUST be inserted exactly, never Date.now().
   */
  when: number;
}

/**
 * Read the drizzle journal (meta/_journal.json + each tag.sql) and return one
 * entry per migration with its tag, file hash, and folderMillis. The hash and
 * ordering come straight from drizzle-orm's readMigrationFiles, so the output is
 * guaranteed to match what the migrator would insert.
 */
export function readJournalMigrations(drizzleDir: string): JournalMigration[] {
  const files = readMigrationFiles({ migrationsFolder: drizzleDir });
  // readMigrationFiles returns entries in journal order but without the tag, so
  // re-read the journal to recover tags by index for human-readable output.
  // (folderMillis + hash are the load-bearing fields; tag is for logging.)
  const tags = readJournalTags(drizzleDir);
  return files.map((f, i) => ({
    tag: tags[i] ?? `migration_${i}`,
    hash: f.hash,
    when: f.folderMillis,
  }));
}

/**
 * Filter a set of journal migrations down to the ones whose hash is not already
 * present in the database. `appliedHashes` is the set of hashes already in
 * drizzle.__drizzle_migrations. When every migration is applied this returns an
 * empty array (the all-applied no-op case).
 */
export function missingMigrationRows(
  appliedHashes: Iterable<string>,
  all: JournalMigration[],
): JournalMigration[] {
  const applied = new Set(appliedHashes);
  return all.filter((m) => !applied.has(m.hash));
}

// --- internals ---

interface JournalFile {
  entries?: { tag?: string }[];
}

// readMigrationFiles drops the tag, so read the journal ourselves purely for the
// tag labels. We deliberately do NOT recompute hashes here.
function readJournalTags(drizzleDir: string): string[] {
  const journalPath = `${drizzleDir}/meta/_journal.json`;
  if (!existsSync(journalPath)) return [];
  const journal = JSON.parse(
    readFileSync(journalPath).toString(),
  ) as JournalFile;
  return (journal.entries ?? []).map((e) => e.tag ?? "");
}
