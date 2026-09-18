/**
 * Dev-only guard: fails if any source file still contains an emoji or a decorative
 * dingbat character.
 *
 * The UI refresh replaced the app's entire emoji "icon set" with vector glyphs
 * (see docs/design_system_2020s.md). Emoji are easy to reintroduce by accident --
 * a chip label here, a "Sent ✓" there -- and each one silently undoes the work,
 * because it renders as different artwork on every OS and cannot inherit colour.
 * So the rule is enforced mechanically rather than by review.
 *
 *   node scripts/check-emoji.mjs [...paths]
 *
 * Exits non-zero and lists every offending line. Icon.tsx is exempt: it is where
 * emoji-free semantic names are mapped, and its prose explains the ban.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = process.argv.slice(2).length ? process.argv.slice(2) : ["src"];

/** Pictographs, dingbats, arrows, geometric shapes, and the emoji variation selector. */
const EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2713}\u{2714}\u{2022}]/u;

const files = [];
const walk = (p) => {
  const st = statSync(p);
  if (st.isDirectory()) for (const e of readdirSync(p)) walk(join(p, e));
  else if (/\.(ts|tsx)$/.test(p)) files.push(p);
};
for (const r of ROOTS) walk(r);

let bad = 0;
for (const f of files) {
  // The icon map itself is allowed to mention what it replaced.
  if (f.endsWith("components/Icon.tsx")) continue;
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    // Comments may name the characters they banned; only real code counts.
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
    if (EMOJI.test(line)) {
      console.log(`${f}:${i + 1}: ${line.trim().slice(0, 110)}`);
      bad++;
    }
  });
}

console.log(bad === 0 ? `OK -- no emoji in ${files.length} files` : `FAIL -- ${bad} emoji occurrence(s)`);
process.exit(bad === 0 ? 0 : 1);
