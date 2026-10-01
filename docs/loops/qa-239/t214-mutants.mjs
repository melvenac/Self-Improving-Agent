// QA 239 mutant driver for T-214. Applies each mutant to the CANDIDATE scratch tree's declared.ts, runs the
// builder's test file and QA 239's generator, records red/green, restores the file with git checkout.
// Usage: node t214-mutants.mjs <candidate worktree> <base worktree> <qa dir (this directory)>
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const [cand, baseWt, qaDir] = process.argv.slice(2);
const ob = join(cand, "open-brain");
const SRC = "open-brain/src/harness/declared.ts";
const T = "/home/agents/qa-tmp";
const env = { ...process.env, TMPDIR: T, TEMP: T, TMP: T };
const sh = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, env, encoding: "utf8" });

const own = {
  "q1-blank-class-is-backslash-s": [/const BLANK_RE = \/\^\[ \\t\\r\]\*\$\/;/, "const BLANK_RE = /^\\s*$/;"],
  "q2-blank-class-drops-tab": [/const BLANK_RE = \/\^\[ \\t\\r\]\*\$\/;/, "const BLANK_RE = /^[ \\r]*$/;"],
  "q3-blank-refused-before-first-header": [/if \(BLANK_RE\.test\(line\)\) continue;/, "if (BLANK_RE.test(line) && (header !== null || !allowHeaders)) continue;"],
  "q4-blank-resets-section": [/if \(BLANK_RE\.test\(line\)\) continue;/, "if (BLANK_RE.test(line)) { header = null; continue; }"],
  "q5-leading-space-tab-stripped": [/const line = raw\.replace\(\/\\r\$\/, ""\);/, 'const line = raw.replace(/\\r$/, "").replace(/^[ \\t]+/, "");'],
};

const builderDir = join(cand, "docs/loops/t214/mutants");
const mutants = [
  ...readdirSync(builderDir).filter((f) => f.endsWith(".diff")).sort().map((f) => ({ name: f.replace(/\.diff$/, ""), by: "builder", diff: join(builderDir, f) })),
  ...Object.entries(own).map(([name, [re, rep]]) => ({ name, by: "qa239", re, rep })),
];

const results = [];
for (const m of mutants) {
  if (m.by === "builder") {
    const a = sh("git", ["apply", m.diff], cand);
    if (a.status !== 0) { results.push({ ...m, applied: false, err: a.stderr }); continue; }
  } else {
    const p = join(cand, SRC);
    const src = readFileSync(p, "utf8");
    if (!m.re.test(src)) { results.push({ name: m.name, by: m.by, applied: false }); continue; }
    writeFileSync(p, src.replace(m.re, m.rep));
    writeFileSync(join(qaDir, "mutants", `${m.name}.diff`), sh("git", ["diff", "--", SRC], cand).stdout);
  }
  const vt = sh("npx", ["vitest", "run", "tests/harness/t214-declared-blank.test.ts"], ob);
  const failedTests = [...vt.stdout.matchAll(/[×✗] T-214 P-blank > (\S+)/g)].map((x) => x[1]);
  const gen = sh("npx", ["tsx", join(qaDir, "t214-gen.mts"), join(cand, SRC), join(baseWt, SRC)], ob);
  const genRows = gen.stdout.split("\n").filter((l) => /disagreements$/.test(l) && !/, 0 disagreements$/.test(l));
  sh("git", ["checkout", "--", SRC], cand);
  results.push({ name: m.name, by: m.by, applied: true, builderTest: vt.status === 0 ? "green" : "RED", builderFailed: failedTests, qaGen: gen.status === 0 ? "green" : "RED", qaGenRows: genRows });
  console.log(JSON.stringify(results.at(-1)));
}
const clean = sh("git", ["status", "--porcelain", "--", SRC], cand).stdout.trim();
console.log(`restored: ${clean === "" ? "yes, declared.ts clean" : "NO: " + clean}`);
writeFileSync(join(T, "mutants.json"), JSON.stringify(results, null, 2));
