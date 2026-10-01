// QA 236: local mutants of T-216 (plan gets its own copy of the loop-id regex). Runs in C:/qa-scratch/qa236-mut.
// For each mutant: restore tree, edit schema.ts, optionally regenerate the JSON schemas with the project's
// generator, save the diff, run the target test files with the json reporter, record failures.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";

const WT = "C:/qa-scratch/qa236-mut";
const OB = `${WT}/open-brain`;
const SCHEMA = `${OB}/src/harness/schema.ts`;
const OUT = "C:/qa-scratch/qa236/mutants";
mkdirSync(OUT, { recursive: true });
const env = { ...process.env, TEMP: "C:/qa-tmp", TMP: "C:/qa-tmp", TMPDIR: "C:/qa-tmp" };
const FILES = (process.env.FILES ?? "tests/harness/t216-loop-id.test.ts tests/harness/b2-et.test.ts tests/harness/schema.test.ts").split(" ");

const PLAN_LINE = "    loop: z.string().regex(LOOP_ID_PATTERN, LOOP_ID_MESSAGE),\n    objective:";
const own = (re) => `    loop: z.string().regex(${re}, LOOP_ID_MESSAGE),\n    objective:`;

const MUTANTS = [
  { id: "M1-builder-m1-narrow-tNNN", re: String.raw`/^t\d{3,}$/`, regen: false },
  { id: "M2-narrow-t3to6-norgen", re: String.raw`/^(?:t\d{3,6}|[0-9]+(?:-[a-z0-9]+)+)$/`, regen: false },
  { id: "M3-narrow-t3to6-regen", re: String.raw`/^(?:t\d{3,6}|[0-9]+(?:-[a-z0-9]+)+)$/`, regen: true },
  { id: "M4-widen-uppercase-norgen", re: String.raw`/^(?:t\d{3,}|[0-9]+(?:-[a-zA-Z0-9]+)+)$/`, regen: false },
  { id: "M5-widen-uppercase-regen", re: String.raw`/^(?:t\d{3,}|[0-9]+(?:-[a-zA-Z0-9]+)+)$/`, regen: true },
  { id: "M6-identical-literal-copy-regen", re: String.raw`/^(?:t\d{3,}|[0-9]+(?:-[a-z0-9]+)+)$/`, regen: true },
  { id: "M7-widen-i-flag-regen", re: String.raw`/^(?:t\d{3,}|[0-9]+(?:-[a-z0-9]+)+)$/i`, regen: true },
  { id: "M8-widen-m-flag-regen", re: String.raw`/^(?:t\d{3,}|[0-9]+(?:-[a-z0-9]+)+)$/m`, regen: true },
  { id: "M7b-widen-i-flag-norgen", re: String.raw`/^(?:t\d{3,}|[0-9]+(?:-[a-z0-9]+)+)$/i`, regen: false },
];

const only = (process.argv[2] ?? process.env.ONLY)?.split(",");
if (process.argv[3]) process.env.TAG = process.argv[3];
const results = [];
for (const m of MUTANTS) {
  if (only && !only.includes(m.id)) continue;
  execFileSync("git", ["-C", WT, "checkout", "--", "."]);
  const src = readFileSync(SCHEMA, "utf8");
  if (!src.includes(PLAN_LINE)) throw new Error("anchor not found");
  writeFileSync(SCHEMA, src.replace(PLAN_LINE, own(m.re)));
  if (m.regen) {
    const g = spawnSync("npx", ["tsx", "src/harness/cli.ts", "schemas", "--write"], { cwd: OB, env, shell: true, encoding: "utf8" });
    if (g.status !== 0) throw new Error(`regen failed: ${g.stderr}`);
  }
  const diff = execFileSync("git", ["-C", WT, "diff"], { encoding: "utf8" });
  writeFileSync(`${OUT}/${m.id}.diff`, diff);
  const jf = `C:/qa-tmp/qa236-${m.id}.json`;
  if (existsSync(jf)) rmSync(jf);
  const r = spawnSync("npx", ["vitest", "run", ...FILES, "--reporter=json", `--outputFile=${jf}`], { cwd: OB, env, shell: true, encoding: "utf8", maxBuffer: 1 << 28, timeout: 900_000 });
  let failed = [], counts = "no json";
  if (existsSync(jf)) {
    const j = JSON.parse(readFileSync(jf, "utf8"));
    counts = `passed=${j.numPassedTests} failed=${j.numFailedTests} skipped=${j.numPendingTests}`;
    for (const f of j.testResults) for (const a of f.assertionResults) if (a.status === "failed") failed.push(`${f.name.split(/[\\/]/).pop()} :: ${a.title}`);
  }
  const row = { id: m.id, regen: m.regen, exit: r.status, counts, killed: failed.length > 0 || r.status !== 0, failed };
  console.log(JSON.stringify(row));
  results.push(row);
}
execFileSync("git", ["-C", WT, "checkout", "--", "."]);
writeFileSync(`${OUT}/results${process.env.TAG ?? ""}.json`, JSON.stringify(results, null, 2));
