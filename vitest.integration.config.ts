import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Integration tests run against a real Postgres named by TEST_DATABASE_URL,
// using the node-postgres driver (DB_DRIVER=pg). When TEST_DATABASE_URL is
// unset the tests skip themselves, so this config is a safe no-op without a DB.
const url =
  process.env.TEST_DATABASE_URL ??
  "postgresql://invalid:invalid@127.0.0.1:5432/invalid";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.itest.ts"],
    globalSetup: ["./src/test/integration-global-setup.ts"],
    // every test shares one database; run files serially so truncation between
    // tests can't race across workers
    fileParallelism: false,
    hookTimeout: 60_000,
    env: { DATABASE_URL: url, DB_DRIVER: "pg" },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
