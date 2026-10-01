// QA 243, R3-1 on the REAL tree: in the candidate scratch tree, make scratch commits (local, never pushed) that plant
// spawning tests in COMMITTED files, run s4-timeouts after each, and record T1. Then return the tree to the
// candidate commit and prove it clean. Usage: node qa243-timeouts-commit.mjs <candidate tree> <candidate sha> <out.json>
import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const [tree, cand, out] = process.argv.slice(2);
const T = "/home/agents/qa-tmp";
const env = { HOME: "/home/agents", PATH: "/home/agents/.local/bin:/usr/local/bin:/usr/bin:/bin", TMPDIR: T, TEMP: T, TMP: T, CI: "1", KNOWLEDGE_V2_DB: `${T}/qa243-kb.db` };
const git = (...a) => {
  const r = spawnSync("git", ["-C", tree, "-c", "user.name=QA 243", "-c", "user.email=qa243@example.invalid", "-c", "commit.gpgsign=false", ...a], { encoding: "utf8", env });
  if (r.status !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};
const H = "open-brain/tests/harness";
const SPAWN = 'spawnSync(process.execPath, ["-e", "0"])';
const IMPORTS = 'import { describe, it, expect } from "vitest";\nimport { spawnSync } from "node:child_process";\n';
const steps = [
  { name: "A: top-level describe with no timeout, direct spawnSync, appended to the committed s4-g6-closeout.test.ts",
    append: { [`${H}/s4-g6-closeout.test.ts`]: `describe("qa243 planted A", () => {\n  it("a", () => { expect(${SPAWN}.status).toBe(0); });\n});` } },
  { name: "B: spawn through an imported helper (new committed helper + s4 file), describe with no timeout",
    write: { [`${H}/qa243-helper.ts`]: `import { spawnSync } from "node:child_process";\nexport function runNode(): number | null {\n  return ${SPAWN}.status;\n}\n`,
             [`${H}/s4-qa243-b.test.ts`]: `import { describe, it, expect } from "vitest";\nimport { runNode } from "./qa243-helper.js";\ndescribe("qa243 planted B", () => {\n  it("b", () => { expect(runNode()).toBe(0); });\n});\n` },
    run: `tests/harness/s4-qa243-b.test.ts` },
  { name: "C: timeout given only on the inner it (120_000), describe with none",
    write: { [`${H}/s4-qa243-c.test.ts`]: `${IMPORTS}describe("qa243 planted C", () => {\n  it("c", () => { expect(${SPAWN}.status).toBe(0); }, 120_000);\n});\n` } },
  { name: "C2: describe carries 120_000 but the spawning inner it overrides it down to 1 ms",
    write: { [`${H}/s4-qa243-c2.test.ts`]: `${IMPORTS}describe("qa243 planted C2", { timeout: 120_000 }, () => {\n  it("c2", () => { expect(${SPAWN}.status).toBe(0); }, 1);\n});\n` } },
  { name: "D: top-level describe.concurrent with no timeout, direct spawnSync",
    write: { [`${H}/s4-qa243-d.test.ts`]: `${IMPORTS}describe.concurrent("qa243 planted D", () => {\n  it("d", () => { expect(${SPAWN}.status).toBe(0); });\n});\n` } },
  { name: "E: aliased import (spawnSync as run), describe with no timeout",
    write: { [`${H}/s4-qa243-e.test.ts`]: `import { describe, it, expect } from "vitest";\nimport { spawnSync as run } from "node:child_process";\ndescribe("qa243 planted E", () => {\n  it("e", () => { expect(run(process.execPath, ["-e", "0"]).status).toBe(0); });\n});\n` } },
  { name: "F: a top-level it with no describe at all, direct spawnSync",
    write: { [`${H}/s4-qa243-f.test.ts`]: `${IMPORTS}it("qa243 planted F", () => { expect(${SPAWN}.status).toBe(0); });\n` } },
  { name: "G: multi-line describe( whose options are on the next line (false-positive probe)",
    write: { [`${H}/s4-qa243-g.test.ts`]: `${IMPORTS}describe(\n  "qa243 planted G",\n  { timeout: 120_000 },\n  () => {\n    it("g", () => { expect(${SPAWN}.status).toBe(0); });\n  },\n);\n` } },
];
const results = [];
if (git("status", "--porcelain") !== "") throw new Error("tree not clean at start");
for (const s of steps) {
  const files = [];
  for (const [f, text] of Object.entries(s.append ?? {})) { appendFileSync(join(tree, f), `\n${text}\n`); files.push(f); }
  for (const [f, text] of Object.entries(s.write ?? {})) { writeFileSync(join(tree, f), text); files.push(f); }
  git("add", ...files);
  git("commit", "-q", "-m", `qa243 scratch: ${s.name}`);
  const head = git("rev-parse", "HEAD");
  const json = `${T}/qa243-to-${results.length}.json`;
  const runFiles = ["tests/harness/s4-timeouts.test.ts", ...(s.run ? [s.run] : [])];
  const r = spawnSync("node", ["node_modules/vitest/vitest.mjs", "run", ...runFiles, "--reporter=json", `--outputFile=${json}`],
    { cwd: join(tree, "open-brain"), env, encoding: "utf8" });
  const tests = {};
  try {
    const j = JSON.parse(readFileSync(json, "utf8"));
    for (const f of j.testResults) for (const a of f.assertionResults) tests[a.title] = { status: a.status, message: (a.failureMessages ?? []).join("\n").split("\n").slice(0, 3).join(" | ") };
  } catch (e) { tests.error = `no json: ${e.message}`; }
  const t1 = Object.entries(tests).find(([k]) => k.startsWith("T1"))?.[1] ?? { status: "?" };
  results.push({ step: s.name, files, scratch_commit: head, vitest_exit: r.status, T1: t1, tests });
  console.log(`${s.name}\n  scratch ${head.slice(0, 8)}; vitest exit ${r.status}; T1 ${t1.status}${t1.message ? ": " + t1.message.slice(0, 220) : ""}`);
  for (const [k, v] of Object.entries(tests)) if (!k.startsWith("T")) console.log(`  also ran: ${k}: ${v.status}`);
  git("reset", "-q", "--hard", cand);
  git("clean", "-fdq", "--", "open-brain/tests/harness");
}
const back = git("rev-parse", "HEAD");
const clean = git("status", "--porcelain") === "";
console.log(`tree back at ${back}; clean ${clean}`);
writeFileSync(out, JSON.stringify({ candidate: cand, back_at: back, clean, results }, null, 2));
