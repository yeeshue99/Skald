import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { Pool as PgPool } from "pg";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import ws from "ws";
import * as schema from "./schema";

// Pick the driver from the connection string: Neon's serverless driver for Neon
// (Vercel deploy target), node-postgres for any other Postgres (local dev,
// Docker, self-host). Set DB_DRIVER=neon|pg to force one.
const url =
  process.env.DATABASE_URL ||
  "postgresql://invalid:invalid@127.0.0.1:5432/invalid";

const useNeon =
  process.env.DB_DRIVER === "neon" ||
  (process.env.DB_DRIVER !== "pg" && /neon\.(tech|build)|\.neon\.|neon\.database/i.test(url));

if (!process.env.DATABASE_URL && process.env.NODE_ENV !== "production") {
  console.warn(
    "DATABASE_URL is not set — database calls will fail. Add it to .env.local.",
  );
}

// derive the database type without depending on a named export
const probe = () => drizzleNeon(null as unknown as NeonPool, { schema });
export type Db = ReturnType<typeof probe>;

function build(): Db {
  if (useNeon) {
    neonConfig.webSocketConstructor = ws;
    neonConfig.poolQueryViaFetch = true;
    return drizzleNeon(new NeonPool({ connectionString: url }), { schema });
  }
  return drizzlePg(new PgPool({ connectionString: url }), {
    schema,
  }) as unknown as Db;
}

// Reuse one client across warm serverless invocations / HMR.
const globalForDb = globalThis as unknown as { __twttrDb?: Db };
export const db: Db = globalForDb.__twttrDb ?? build();
globalForDb.__twttrDb = db;

export { schema };
