import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // a dummy URL so importing modules that build the db pool doesn't warn; no
    // unit test connects (the pool is lazy, and DB-bound code isn't unit-tested)
    env: { DATABASE_URL: "postgresql://test:test@localhost:5432/test_db" },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
