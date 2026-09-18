/**
 * Fails the build if any runtime source imports the development fixture.
 *
 * WHY THIS EXISTS: src/mockData.ts describes ONE specific family (the Millers). It is
 * the fixture that seeds a database. When a screen imported it as a fallback, every
 * newly signed-up family opened the app and found a stranger's relatives, medication
 * schedule and recipes sitting inside their own private circle -- in a product whose
 * single promise is "visible only to the people in your family circle".
 *
 * That is a privacy failure, not a cosmetic one, and it is invisible in development
 * because the seeded database contains the same family. Only a fresh signup reveals it,
 * which is exactly the path nobody re-tests. Hence a lint rule.
 *
 * Only server/src/seed.ts may read it.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const FIXTURE = /from\s+["'][^"']*mockData["']|require\(["'][^"']*mockData["']\)/;

/** The one file allowed to import it, plus the fixture itself. */
const ALLOWED = new Set(["server/src/seed.ts", "src/mockData.ts"]);

const offenders = [];
let scanned = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;

    const rel = full.slice(ROOT.length);
    if (ALLOWED.has(rel)) continue;

    scanned++;
    const text = readFileSync(full, "utf8");
    // Ignore matches inside comments: this rule is explained in prose in several files.
    for (const [i, line] of text.split("\n").entries()) {
      const code = line.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");
      if (FIXTURE.test(code)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
    }
  }
}

for (const dir of ["src", "server/src", "App.tsx"]) {
  const full = join(ROOT, dir);
  try {
    if (statSync(full).isDirectory()) walk(full);
    else {
      scanned++;
      const text = readFileSync(full, "utf8");
      for (const [i, line] of text.split("\n").entries()) {
        if (FIXTURE.test(line.replace(/\/\/.*$/, ""))) offenders.push(`${dir}:${i + 1}: ${line.trim()}`);
      }
    }
  } catch {
    // Path absent; nothing to check.
  }
}

if (offenders.length) {
  console.error("FAIL -- runtime code imports the development fixture src/mockData.ts:\n");
  for (const o of offenders) console.error("  " + o);
  console.error(
    "\nmockData.ts describes one specific family and must never reach a user's device." +
    "\nSeed the database instead (npm run api:reseed), or move shared copy to src/config.ts.",
  );
  process.exit(1);
}

console.log(`OK -- no runtime fixture imports in ${scanned} files`);
