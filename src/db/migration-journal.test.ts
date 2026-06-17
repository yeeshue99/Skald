import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { readMigrationFiles } from "drizzle-orm/migrator";
import {
  readJournalMigrations,
  missingMigrationRows,
  type JournalMigration,
} from "./migration-journal";

// The drizzle folder lives at <repo>/drizzle. This test file is src/db/, so go
// up two levels. fileURLToPath keeps it correct on Windows and POSIX.
const DRIZZLE_DIR = fileURLToPath(new URL("../../drizzle", import.meta.url));

describe("readJournalMigrations", () => {
  it("matches drizzle-orm's own readMigrationFiles byte-for-byte", () => {
    // Assert parity against the library rather than hardcoding hashes, so this
    // stays correct regardless of line endings or platform: whatever the
    // migrator would insert is exactly what we backfill.
    const reference = readMigrationFiles({ migrationsFolder: DRIZZLE_DIR });
    const mine = readJournalMigrations(DRIZZLE_DIR);

    expect(mine).toHaveLength(reference.length);
    expect(reference.length).toBeGreaterThan(0);

    mine.forEach((m, i) => {
      expect(m.hash).toBe(reference[i].hash);
      expect(m.when).toBe(reference[i].folderMillis);
    });
  });

  it("labels each entry with its journal tag in journal order", () => {
    const mine = readJournalMigrations(DRIZZLE_DIR);
    // The first migration in this repo is the falcon baseline; tags must be the
    // real journal tags, not synthetic placeholders.
    expect(mine[0].tag).toMatch(/^0000_/);
    expect(mine.every((m) => m.tag.length > 0)).toBe(true);
    // tags are ordered by journal index
    const idxs = mine.map((m) => Number(m.tag.slice(0, 4)));
    const sorted = [...idxs].sort((a, b) => a - b);
    expect(idxs).toEqual(sorted);
  });
});

describe("missingMigrationRows", () => {
  const all: JournalMigration[] = [
    { tag: "0000_a", hash: "hash-a", when: 1 },
    { tag: "0001_b", hash: "hash-b", when: 2 },
    { tag: "0002_c", hash: "hash-c", when: 3 },
  ];

  it("returns rows whose hash is not yet applied", () => {
    const missing = missingMigrationRows(["hash-a"], all);
    expect(missing.map((m) => m.hash)).toEqual(["hash-b", "hash-c"]);
  });

  it("returns an empty array when every migration is applied", () => {
    const missing = missingMigrationRows(["hash-a", "hash-b", "hash-c"], all);
    expect(missing).toEqual([]);
  });

  it("returns all rows when nothing is applied", () => {
    const missing = missingMigrationRows([], all);
    expect(missing).toEqual(all);
  });

  it("ignores applied hashes that are not in the journal", () => {
    // A stray/extra db hash must not affect which journal rows are missing.
    const missing = missingMigrationRows(["hash-a", "stranger"], all);
    expect(missing.map((m) => m.hash)).toEqual(["hash-b", "hash-c"]);
  });

  it("preserves journal order and self-heals an arbitrary gap", () => {
    // Only the middle migration is applied (a hand-built DB can be in any
    // state); the marker must backfill BOTH the earlier and later rows.
    const missing = missingMigrationRows(["hash-b"], all);
    expect(missing.map((m) => m.tag)).toEqual(["0000_a", "0002_c"]);
  });
});
