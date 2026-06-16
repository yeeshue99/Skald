import { execSync } from "node:child_process";

// Apply the current schema (schema.ts, exactly) to the throwaway test database
// before the integration suite runs. `drizzle-kit push` is used rather than the
// migrator so the test DB always matches schema.ts regardless of migration
// drift. Skips entirely when TEST_DATABASE_URL is unset.
//
// Safety: this pushes a schema (dropping/creating objects). Point
// TEST_DATABASE_URL at a throwaway database, never your dev or production one.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.log(
      "[integration] TEST_DATABASE_URL not set; integration tests will skip.",
    );
    return;
  }
  console.log("[integration] pushing schema to the test database...");
  // dotenv in drizzle.config does not override an already-set DATABASE_URL, so
  // passing it here targets the test DB (not whatever .env.local holds).
  execSync("pnpm drizzle-kit push --force", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
