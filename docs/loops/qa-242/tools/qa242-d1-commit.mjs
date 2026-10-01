// QA 242, D1 on the REAL tree: in the candidate scratch tree, make scratch commits (local, never pushed) that plant
// lines in a COMMITTED test file, run s4-guards after each, and record the S4-9.2 result. Then return the tree to
// the candidate commit and prove it clean. Usage: node qa242-d1-commit.mjs <candidate tree> <candidate sha> <out.json>
import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const [tree, cand, out] = process.argv.slice(2);
const T = "/home/agents/qa-tmp";
const env = { HOME: "/home/agents", PATH: "/home/agents/.local/bin:/usr/local/bin:/usr/bin:/bin", TMPDIR: T, TEMP: T, TMP: T, CI: "1", KNOWLEDGE_V2_DB: `${T}/qa242-kb.db` };
const git = (...a) => {
  const r = spawnSync("git", ["-C", tree, "-c", "user.name=QA 242", "-c", "user.email=qa242@example.invalid", "-c", "commit.gpgsign=false", ...a], { encoding: "utf8", env });
  if (r.status !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};
const FILE = "open-brain/tests/harness/s4-g6-closeout.test.ts";
const original = readFileSync(join(tree, FILE), "utf8");
const steps = [
  { name: "plant it.skip( in a committed file", lines: ['it.skip("qa242 planted", () => {});'] },
  { name: "a title that merely names skipIf / runIf / todo (not a call)", lines: ['it("qa242 names skipIf, runIf, todo and skip in a title", () => {});'] },
  { name: "three call positions the builder did not list", lines: ['test.only.skip("qa242 a", () => {});', 'describe.skipIf(true)("qa242 b", () => {});', 'it.concurrent.skip("qa242 c", () => {});'] },
  { name: "three that the pattern misses (nested parens in each, bracket access, suite alias)", lines: ['it.each([f(1)]).skip("qa242 d", () => {});', 'it["skip"]("qa242 e", () => {});', 'suite.skip("qa242 f", () => {});'] },
];
const results = [];
if (git("status", "--porcelain") !== "") throw new Error("tree not clean at start");
for (const s of steps) {
  writeFileSync(join(tree, FILE), original);
  appendFileSync(join(tree, FILE), `\n${s.lines.join("\n")}\n`);
  git("add", FILE);
  git("commit", "-q", "-m", `qa242 scratch: ${s.name}`);
  const head = git("rev-parse", "HEAD");
  const json = `${T}/qa242-d1-${results.length}.json`;
  const r = spawnSync("node", ["node_modules/vitest/vitest.mjs", "run", "tests/harness/s4-guards.test.ts", "-t", "S4-9.2", "--reporter=json", `--outputFile=${json}`, "--testTimeout=120000"],
    { cwd: join(tree, "open-brain"), env, encoding: "utf8" });
  let status = "?", message = "";
  try {
    const j = JSON.parse(readFileSync(json, "utf8"));
    for (const f of j.testResults) for (const a of f.assertionResults) if (a.title.startsWith("S4-9.2")) { status = a.status; message = (a.failureMessages ?? []).join("\n").split("\n").slice(0, 12).join("\n"); }
  } catch (e) { status = `no json: ${e.message}`; }
  results.push({ step: s.name, planted: s.lines, scratch_commit: head, vitest_exit: r.status, s4_9_2: status, message });
  console.log(`${s.name}: scratch ${head.slice(0, 8)}; vitest exit ${r.status}; S4-9.2 ${status}`);
  if (message) console.log(message.replace(/^/gm, "    "));
  git("reset", "-q", "--hard", cand);
}
const back = git("rev-parse", "HEAD");
const clean = git("status", "--porcelain") === "";
console.log(`tree back at ${back}; clean ${clean}`);
writeFileSync(out, JSON.stringify({ candidate: cand, back_at: back, clean, results }, null, 2));
