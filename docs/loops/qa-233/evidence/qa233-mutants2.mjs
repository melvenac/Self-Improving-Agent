// QA 233: hand re-application of r1 mutants ph3/ph4/ph7 (their patches do not apply to 699789e1), plus
// typechecking forms of ph1/ph2 (the developer's forms fail tsc on the candidate). Same protocol as qa233-mutants.mjs.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const WT = "C:/qa-scratch/qa233-mut";
const OB = join(WT, "open-brain");
const CAND = "699789e1a21763d1e7e4e15a6a501cbbf4756f83";
const env = { ...process.env, TEMP: "C:\\qa-tmp", TMP: "C:\\qa-tmp" };
const git = (...a) => execFileSync("git", ["-C", WT, ...a], { encoding: "utf8", env }).trim();
const TRAILER = "\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>";

const ONLY = process.argv[2];
const allMuts = [
  { id: "ph3-tc", commit: true, file: "src/planner-hook/run.ts", from: "if (!isRestrictedOutwardBash(command)) return null;", to: "if (!isRestrictedOutwardBash(command) || command.length >= 0) return null;" },
  { id: "ph3",commit: false, file: "src/planner-hook/run.ts", from: "if (!isRestrictedOutwardBash(command)) return null;", to: "if (true) return null;" },
  { id: "ph4", commit: false, file: "src/planner-hook/run.ts", from: "  if (isProtectedArtifactPath(rawPath)) {", to: '  if (tool === "Write" && isAllowedDocsLoopsPath(rawPath)) {\n    return { decision: "deny", reason: "mutant ph4: docs/loops write denied" };\n  }\n\n  if (isProtectedArtifactPath(rawPath)) {' },
  { id: "ph7", commit: false, file: "src/cli-planner-hook.ts", from: '    process.stdout.write(formatDeny("Planner hook: denied — hook payload is not valid JSON (fail closed)."));\n    process.exit(2);', to: "    process.exit(0);" },
  { id: "ph1-tc", commit: true, file: "src/planner-hook/run.ts", from: "  if (isProtectedArtifactPath(rawPath)) {", to: '  if (rawPath === "\\u0000" && isProtectedArtifactPath(rawPath)) {' },
  { id: "ph2-tc", commit: true, file: "src/planner-hook/run.ts", from: "  if (isRenderedViewPath(rawPath)) {", to: '  if (rawPath === "\\u0000" && isRenderedViewPath(rawPath)) {' },
];
const muts = ONLY ? allMuts.filter((m) => m.id === ONLY) : allMuts;

function runSuite() {
  const tsc = spawnSync("npx", ["tsc", "--noEmit"], { cwd: OB, env, encoding: "utf8", shell: true });
  if (tsc.status !== 0) return { tsc: tsc.status, tscOut: (tsc.stdout + tsc.stderr).slice(0, 800) };
  const v = spawnSync("npx", ["vitest", "run", "tests/planner-hook"], { cwd: OB, env, encoding: "utf8", shell: true, maxBuffer: 64 << 20 });
  const txt = (v.stdout + v.stderr).replace(/\x1b\[[0-9;]*m/g, "");
  const tests = txt.match(/Tests\s+([^\n]+)/)?.[1]?.trim();
  const failed = [...txt.matchAll(/^\s*FAIL\s+(tests\/.+)$/gm)].map((m) => m[1].trim());
  return { tsc: 0, vitestExit: v.status, tests, failed: [...new Set(failed)] };
}

const results = [];
for (const m of muts) {
  git("checkout", "-f", "--detach", CAND);
  const branch = `qa/t194-r2-mut-${m.id}`;
  if (m.commit) git("checkout", "-B", branch);
  const f = join(OB, m.file);
  const src = readFileSync(f, "utf8").replace(/\r\n/g, "\n");
  if (!src.includes(m.from)) { results.push({ id: m.id, landed: false }); console.log(JSON.stringify(results.at(-1))); continue; }
  writeFileSync(f, src.replace(m.from, m.to));
  const landed = git("diff", "--stat", "--", `open-brain/${m.file}`).split("\n").pop();
  let extra = {};
  if (m.commit) {
    git("add", "--", `open-brain/${m.file}`);
    git("commit", "-q", "-m", `mutant(t194-r2 QA 233 ${m.id}): not to be merged${TRAILER}`);
    extra = { branch, sha: git("rev-parse", "HEAD") };
  }
  results.push({ id: m.id, landed, ...extra, ...runSuite() });
  console.log(JSON.stringify(results.at(-1)));
}
git("checkout", "-f", "--detach", CAND);
writeFileSync(`C:/qa-scratch/qa233-mutants2${ONLY ? "-" + ONLY : ""}-out.json`, JSON.stringify(results, null, 1));
