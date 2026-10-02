// QA 247: run the candidate's target tests clean, then under each mutant, one at a time.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";

const WT = "/home/agents/qa-scratch/qa247-cand";
const OB = `${WT}/open-brain`;
const OUT = "/home/agents/qa-scratch/qa247-out";
mkdirSync(OUT, { recursive: true });
const env = { ...process.env, TMPDIR: "/home/agents/qa-tmp" };
const FILES = ["tests/harness/t216-loop-id.test.ts", "tests/harness/t214-declared-blank.test.ts"];
const KEPT = "docs/loops/t217-t218/mutants";

const SCHEMA = `${OB}/src/harness/schema.ts`;
const DECL = `${OB}/src/harness/declared.ts`;
const PLAN_LINE = "    loop: z.string().regex(LOOP_ID_PATTERN, LOOP_ID_MESSAGE),\n    objective:";
const LINE_ANCHOR = `    const line = raw.replace(/\\r$/, "");`;

const edit = (file, from, to) => {
  const s = readFileSync(file, "utf8");
  if (!s.includes(from)) throw new Error(`anchor not found in ${file}`);
  writeFileSync(file, s.replace(from, to));
};

const MUTANTS = [
  { id: "clean" },
  // The originals: QA 236's M6/M7 (schema.ts only; regen was a no-op, see the kept diffs) and QA 239's q5.
  { id: "qa236-M6", apply: `${WT}/${KEPT}/qa236-M6-identical-literal-copy-regen.diff` },
  { id: "qa236-M7", apply: `${WT}/${KEPT}/qa236-M7-widen-i-flag-regen.diff` },
  { id: "qa239-q5", apply: `${WT}/${KEPT}/qa239-q5-leading-space-tab-stripped.diff` },
  // QA 247's own.
  { id: "qa247-A-new-RegExp-source", fn: () => edit(SCHEMA, PLAN_LINE,
      "    loop: z.string().regex(new RegExp(LOOP_ID_PATTERN.source), LOOP_ID_MESSAGE),\n    objective:") },
  { id: "qa247-B-strip-leading-tab-only", fn: () => edit(DECL, LINE_ANCHOR,
      `    const line = raw.replace(/\\r$/, "").replace(/^\\t+/, "");`) },
];

const only = process.argv[2]?.split(",");
const results = [];
for (const m of MUTANTS) {
  if (only && !only.includes(m.id)) continue;
  execFileSync("git", ["-C", WT, "checkout", "--", "open-brain"]);
  if (m.apply) execFileSync("git", ["-C", WT, "apply", m.apply]);
  if (m.fn) m.fn();
  const diff = execFileSync("git", ["-C", WT, "diff"], { encoding: "utf8" });
  writeFileSync(`${OUT}/${m.id}.diff`, diff);
  const tsc = spawnSync("npx", ["tsc", "-p", ".", "--noEmit"], { cwd: OB, env, encoding: "utf8" });
  const jf = `${OUT}/${m.id}.vitest.json`;
  if (existsSync(jf)) rmSync(jf);
  const r = spawnSync("npx", ["vitest", "run", ...FILES, "--reporter=json", `--outputFile=${jf}`], { cwd: OB, env, encoding: "utf8", maxBuffer: 1 << 28, timeout: 900_000 });
  let failed = [], counts = "no json";
  if (existsSync(jf)) {
    const j = JSON.parse(readFileSync(jf, "utf8"));
    counts = `passed=${j.numPassedTests} failed=${j.numFailedTests} skipped=${j.numPendingTests}`;
    for (const f of j.testResults) for (const a of f.assertionResults) if (a.status === "failed") {
      failed.push(`${f.name.split("/").pop()} :: ${a.title} :: ${(a.failureMessages[0] ?? "").split("\n")[0].slice(0, 200)}`);
    }
  }
  const row = { id: m.id, diffLines: diff.split("\n").length, tsc: tsc.status, exit: r.status, counts, killed: failed.length > 0 || r.status !== 0, failed };
  console.log(JSON.stringify(row, null, 1));
  results.push(row);
}
execFileSync("git", ["-C", WT, "checkout", "--", "open-brain"]);
console.log("tree clean after:", execFileSync("git", ["-C", WT, "status", "--porcelain"], { encoding: "utf8" }) === "");
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
