// Generic seed dispatcher — run any seed by filename, with no per-seed
// package.json script. Always invoked from the project root (via `pnpm seed`).
//
//   pnpm seed                  -> the STR/X demo (src/db/seeds/seed.ts)
//   pnpm seed <name>           -> src/db/seeds/<name>.ts  (or seed-<name>.ts)
//   pnpm seed <name> [args...] -> forwards [args...] to that seed's process.argv
//
// Drop a new <name>.ts in this folder and `pnpm seed <name>` just works — no new
// script entry needed. The <name>.ts file is a normal standalone seed (its own
// `main().then(() => process.exit(0))`); this dispatcher only resolves it, wires
// up its argv, and imports it so its top-level run kicks off.
import { readdirSync } from "node:fs";
import { join } from "node:path";

const seedsDir = join(process.cwd(), "src", "db", "seeds");

const available = () =>
  readdirSync(seedsDir)
    .filter((f) => f.endsWith(".ts") && f !== "run.ts" && !f.startsWith("_"))
    .map((f) => f.replace(/\.ts$/, ""))
    .join(", ");

const [rawName = "seed", ...forwarded] = process.argv.slice(2);
const name = rawName.replace(/\.ts$/, ""); // tolerate `pnpm seed thornfeed.ts`

const die = (msg: string): never => {
  console.error(msg);
  console.error(`Available seeds: ${available()}`);
  process.exit(1);
};

// reject the dispatcher itself and anything that could escape the folder
if (name === "run" || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
  die(`Bad seed name "${rawName}". Use lowercase letters, digits, and hyphens.`);
}

// resolve <name>.ts first, then the seed-<name>.ts convention (so `pnpm seed
// petalfall` finds seed-petalfall.ts without renaming it)
const files = readdirSync(seedsDir);
const file = [`${name}.ts`, `seed-${name}.ts`].find((c) => files.includes(c));
if (!file) die(`No seed "${name}" in src/db/seeds.`);

// Forward any remaining args so argv-driven seeds still receive them, e.g.
// `pnpm seed petalfall scripts/my.json my-slug` -> seed-petalfall.ts argv[2..].
process.argv = [process.argv[0], join(seedsDir, file!), ...forwarded];

console.log(`▶ seeding: src/db/seeds/${file}`);
// The target seed imports ../load-env first and calls process.exit() when done.
import(`./${file}`).catch((err) => {
  console.error(err);
  process.exit(1);
});
