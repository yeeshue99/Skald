import { config } from "dotenv";
// load .env.local first (Next's convention), then .env as a fallback
config({ path: ".env.local" });
config();
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
