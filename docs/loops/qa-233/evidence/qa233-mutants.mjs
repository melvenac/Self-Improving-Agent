// QA 233 mutant driver. Every mutant is applied to the candidate code SHA 699789e1 in C:/qa-scratch/qa233-mut,
// asserted as landed, typechecked (tsc --noEmit), then tests/planner-hook is run. Foreground, sequential.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const WT = "C:/qa-scratch/qa233-mut";
const OB = join(WT, "open-brain");
const CAND = "699789e1a21763d1e7e4e15a6a501cbbf4756f83";
const env = { ...process.env, TEMP: "C:\\qa-tmp", TMP: "C:\\qa-tmp" };
const git = (...a) => execFileSync("git", ["-C", WT, ...a], { encoding: "utf8", env }).trim();
const TRAILER = "\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>";

const dev = [
  ...["m1", "m2", "m3", "m4", "m5"].map((m) => ({ id: m, kind: "dev-r2", diff: () => git("diff", CAND, `origin/loop/t194-r2-mut-${m}`, "--", "open-brain/src") })),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ id: `ph${i}`, kind: "dev-r1", diff: () => git("diff", `origin/loop/t194-planner-hook-mut-ph${i}~1`, `origin/loop/t194-planner-hook-mut-ph${i}`, "--", "open-brain/src") })),
];
const qa = [
  { id: "q1-spawn", file: "src/planner-hook/prfiles.ts", from: 'import { parse as parseYaml } from "yaml";', to: 'import { parse as parseYaml } from "yaml";\nimport { execFileSync } from "node:child_process";\nexport const qaPlantedSpawn = execFileSync;' },
  { id: "q2-token-order", file: "src/planner-hook/prfiles.ts", from: 'for (const k of ["GH_TOKEN", "GITHUB_TOKEN"])', to: 'for (const k of ["GITHUB_TOKEN", "GH_TOKEN"])' },
  { id: "q3-status-ignored", file: "src/planner-hook/prfiles.ts", from: "if (!res.ok) return", to: "if (res.status >= 500) return" },
  { id: "q4-rename-guard", file: "src/planner-hook/prfiles.ts", from: 'else if (f.status === "renamed") return fail("a renamed file has no previous_filename");', to: 'else if (f.status === "renamed") void 0;' },
];

const results = [];
function runSuite(label) {
  const tsc = spawnSync("npx", ["tsc", "--noEmit"], { cwd: OB, env, encoding: "utf8", shell: true });
  if (tsc.status !== 0) return { tsc: tsc.status, tscOut: (tsc.stdout + tsc.stderr).slice(0, 800) };
  const v = spawnSync("npx", ["vitest", "run", "tests/planner-hook"], { cwd: OB, env, encoding: "utf8", shell: true, maxBuffer: 64 << 20 });
  const txt = (v.stdout + v.stderr).replace(/\x1b\[[0-9;]*m/g, "");
  const tests = txt.match(/Tests\s+([^\n]+)/)?.[1]?.trim();
  const failed = [...txt.matchAll(/^\s*(?:FAIL|×)\s+(.+)$/gm)].map((m) => m[1].trim()).filter((s) => s.includes(">"));
  return { tsc: 0, vitestExit: v.status, tests, failed: [...new Set(failed)] };
}

for (const m of dev) {
  git("checkout", "-f", "--detach", CAND);
  const patch = m.diff();
  const pf = `C:/qa-tmp/qa233-${m.id}.patch`;
  writeFileSync(pf, patch + "\n");
  let applied = "clean";
  try { git("apply", pf); } catch { try { git("apply", "--3way", pf); applied = "3way"; } catch (e) { applied = "FAILED: " + String(e.stderr ?? e.message).slice(0, 400); } }
  const landed = git("diff", "--stat", "--", "open-brain/src");
  const r = applied.startsWith("FAILED") || !landed ? { applied, landed: !!landed } : { applied, landed: landed.split("\n").pop(), ...runSuite(m.id) };
  results.push({ id: m.id, kind: m.kind, ...r });
  console.log(JSON.stringify(results.at(-1)));
}

for (const m of qa) {
  git("checkout", "-f", "--detach", CAND);
  const branch = `qa/t194-r2-mut-${m.id}`;
  git("checkout", "-B", branch);
  const f = join(OB, m.file);
  const src = readFileSync(f, "utf8");
  if (!src.includes(m.from)) { results.push({ id: m.id, kind: "qa", landed: false }); continue; }
  writeFileSync(f, src.replace(m.from, m.to));
  git("add", "--", `open-brain/${m.file}`);
  git("commit", "-q", "-m", `mutant(t194-r2 QA 233 ${m.id}): not to be merged${TRAILER}`);
  const r = runSuite(m.id);
  results.push({ id: m.id, kind: "qa", branch, sha: git("rev-parse", "HEAD"), ...r });
  console.log(JSON.stringify(results.at(-1)));
}
git("checkout", "-f", "--detach", CAND);
writeFileSync("C:/qa-scratch/qa233-mutants-out.json", JSON.stringify(results, null, 1));
