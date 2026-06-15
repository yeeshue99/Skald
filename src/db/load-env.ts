// Side-effect module: load env BEFORE anything imports the db client. Because
// ES module imports run in order, importing this first guarantees dotenv has
// populated process.env before ./index.ts constructs its pool.
import { config } from "dotenv";

config({ path: ".env.local" });
config();
