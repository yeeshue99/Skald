// Apply pending DB migrations during a Vercel PRODUCTION build, then let the
// build proceed. Wired in via vercel.json "buildCommand"
// (`node scripts/predeploy-migrate.mjs && pnpm build`), so it runs on every
// push-triggered production deploy.
//
// Guards:
// - Production only. Preview/branch builds (VERCEL_ENV !== "production") skip
//   migrating, so a PR build can never mutate the production schema.
// - Fails the build loudly if DATABASE_URL is missing in a production build,
//   rather than shipping code that expects a schema it never applied.
//
// Applies only the committed drizzle/000N_*.sql files via `drizzle-kit migrate`
// (forward-only, idempotent, tracked in drizzle.__drizzle_migrations). The prod
// DB's journal must be baselined once (see README "Deploy to Vercel"), or the
// first migrate would try to replay 0000 against existing tables.
import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV;

if (env !== "production") {
  console.log(
    `[predeploy-migrate] VERCEL_ENV=${env ?? "(unset)"} — skipping migrations (production deploys only).`,
  );
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error(
    "[predeploy-migrate] DATABASE_URL is not set in the production build environment. " +
      "Add it in Vercel project settings (Production) so migrations can run.",
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
