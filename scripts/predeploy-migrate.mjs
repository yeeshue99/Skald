// Apply pending DB migrations during a Vercel PRODUCTION build, then let the
// build proceed. Wired in via vercel.json "buildCommand"
// (`node scripts/predeploy-migrate.mjs && pnpm build`), so it runs on every
// push-triggered production deploy.
//
// Guards:
// - Production only. Preview/branch builds (VERCEL_ENV !== "production") skip
//   migrating, so a PR build can never mutate the production schema.
// - Fails the build loudly if DATABASE_URL is missing in a production build.
// - Pre-checks the migration journal so the two normal cases just work
//   (a brand-new empty DB, or an already-baselined DB), and the one broken case
//   (a DB built by `db:push` with no journal) fails with the exact one-time fix
//   instead of a cryptic "relation already exists".
//
// Applies only the committed drizzle/000N_*.sql files via `drizzle-kit migrate`
// (forward-only, idempotent, tracked in drizzle.__drizzle_migrations).
import { execSync } from "node:child_process";
import { Client } from "pg";

const env = process.env.VERCEL_ENV;

if (env !== "production") {
  console.log(
    `[predeploy-migrate] VERCEL_ENV=${env ?? "(unset)"} — skipping migrations (production deploys only).`,
  );
  process.exit(0);
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error(
    "[predeploy-migrate] DATABASE_URL is not set in the production build environment. " +
      "Add it in Vercel project settings (Production) so migrations can run.",
  );
  process.exit(1);
}

// Inspect the journal: does the DB already have app tables, and is the drizzle
// migration journal populated? Connection failures here are non-fatal — we fall
// through to migrate, which is the authority and will surface its own error.
async function journalState() {
  let client;
  try {
    const u = new URL(dbUrl);
    u.search = ""; // drop sslmode/channel_binding; set ssl explicitly below
    client = new Client({
      connectionString: u.toString(),
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    const tables =
      (await client.query("select to_regclass('public.campaigns') as t")).rows[0].t !== null;
    const journalTable =
      (await client.query("select to_regclass('drizzle.__drizzle_migrations') as t")).rows[0].t !== null;
    const rows = journalTable
      ? Number(
          (await client.query("select count(*)::int as c from drizzle.__drizzle_migrations")).rows[0].c,
        )
      : 0;
    return { ok: true, tables, rows };
  } catch (err) {
    console.warn("[predeploy-migrate] could not inspect journal:", err?.message ?? err);
    return { ok: false, tables: false, rows: 0 };
  } finally {
    await client?.end().catch(() => {});
  }
}

const state = await journalState();

if (state.ok && state.tables && state.rows === 0) {
  console.error(
    [
      "",
      "[predeploy-migrate] This production database has tables but an un-baselined",
      "migration journal, so 'drizzle-kit migrate' would try to recreate existing",
      "tables and fail. This happens to a DB first built with `db:push`.",
      "",
      "Baseline it ONCE (run locally with DATABASE_URL pointing at THIS database):",
      "",
      "  pnpm db:push                   # bring its schema up to date with schema.ts",
      "  pnpm db:mark-migrations --yes  # record the existing migrations as applied",
      "",
      "Then redeploy. (A brand-new empty database does not need this.)",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

console.log("[predeploy-migrate] production build — applying pending migrations…");
try {
  execSync("pnpm exec drizzle-kit migrate", { stdio: "inherit" });
  console.log("[predeploy-migrate] migrations up to date.");
} catch (err) {
  console.error(
    "[predeploy-migrate] drizzle-kit migrate failed; failing the build.",
    err?.message ?? err,
  );
  process.exit(1);
}
