// QA 235 mutant runner. LOCAL only (T-207). Applies each mutant to a clean d37e09dc tree, checks it landed
// (git diff --numstat), runs tsc --noEmit and vitest run tests/planner-hook, then restores src/.
// Usage: node qa235-mutants.mjs <mutation worktree> <dev mutant dir> <qa234 prefix diff> <out.json> <diff out dir>
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const [WT, DEVDIR, QA234_PREFIX, OUT, DIFFDIR, ONLY = "all"] = process.argv.slice(2);
const OB = join(WT, "open-brain");
const env = { ...process.env, TEMP: "C:\\qa-tmp", TMP: "C:\\qa-tmp" };
const sh = (cmd, cwd = WT) => spawnSync(cmd, { cwd, env, shell: true, encoding: "utf8", maxBuffer: 64 << 20 });
const restore = () => sh("git checkout -- open-brain/src");

const SRC = "open-brain/src/planner-hook";
// QA 235's own mutants: [id, row, file, from, to]
const QA = [
  ["qa-r41-resolve-root", "r4-1", `${SRC}/paths.ts`, "p = `${base}/${p}`;", "p = `${root}/${p}`;"],
  ["qa-r41-cwd-raw", "r4-1", `${SRC}/paths.ts`, 'const base = toFwd(cwd, winRoot).replace(/\\/+$/, "");', 'const base = cwd.replace(/\\/+$/, "");'],
  ["qa-r42-outside-cause", "r4-2", `${SRC}/paths.ts`, "  return { ok: true, outside: true };\n}", '  return { ok: false, cause: "outside the repository" };\n}'],
  ["qa-r42-dollar-dropped", "r4-2", `${SRC}/bash.ts`, "if (/[$`]/.test(p))", "if (/[`]/.test(p))"],
  ["qa-r43-ci-off", "r4-3", `${SRC}/paths.ts`, "rel: abs.slice(root.length + 1), ci: winRoot }", "rel: abs.slice(root.length + 1), ci: false }"],
  ["qa-r43-summary-cs", "r4-3", `${SRC}/run.ts`, "if (isSummaryPath(relPath, ci)) {", "if (isSummaryPath(relPath)) {"],
  ["qa-r44-env-prefix-ok", "r4-4", `${SRC}/git.ts`, "const GH_PR_MERGE_START_RE = /^[\"']?gh", "const GH_PR_MERGE_START_RE = /^(?:(?:env\\s+)?\\w+=\\S*\\s+)*[\"']?gh"],
  ["qa-r45-no-squash", "r4-5", `${SRC}/grant.ts`, 'const squash = (s: string): string => s.trim().replace(/\\s+/g, " ");', "const squash = (s: string): string => s.trim();"],
  ["qa-r46-ref-old", "r4-6", `${SRC}/git.ts`, "const m = command.match(/(?<![\\w-])[\"']?gh(?:\\.exe)?[\"']?\\s+pr\\s+merge\\s+(\\S+)/);", "const m = command.match(/\\bgh\\s+pr\\s+merge\\s+(\\S+)/);"],
  ["qa-r46-start-no-exe", "r4-6", `${SRC}/git.ts`, "const GH_PR_MERGE_START_RE = /^[\"']?gh(?:\\.exe)?[\"']?", "const GH_PR_MERGE_START_RE = /^[\"']?gh[\"']?"],
];

function run(id, row, origin, apply) {
  restore();
  const ok = apply();
  const numstat = sh("git diff --numstat -- open-brain/src").stdout.trim();
  const landed = ok && numstat.length > 0;
  const diff = sh("git diff -- open-brain/src").stdout;
  if (DIFFDIR && landed && origin !== "dev") writeFileSync(join(DIFFDIR, `${id}.diff`), diff);
  let tsc = null, vitest = null, failed = null, passed = null;
  if (landed) {
    tsc = sh("npx tsc --noEmit", OB).status;
    const rep = join("C:/qa-tmp", `qa235-${id}.json`);
    if (existsSync(rep)) rmSync(rep);
    vitest = sh(`npx vitest run tests/planner-hook --reporter=json --outputFile=${rep}`, OB).status;
    try { const j = JSON.parse(readFileSync(rep, "utf8")); failed = j.numFailedTests; passed = j.numPassedTests; } catch { /* no report */ }
  }
  const r = { id, row, origin, landed, numstat, tsc, vitest, failed, passed, red: landed && tsc === 0 && vitest !== 0 };
  console.log(JSON.stringify(r));
  restore();
  return r;
}

const results = [];
if (ONLY !== "qa") for (const f of readdirSync(DEVDIR).filter((f) => f.endsWith(".diff")).sort()) {
  results.push(run(f.replace(/\.diff$/, ""), "dev", "dev", () => sh(`git apply "${join(DEVDIR, f)}"`).status === 0));
}
// QA 234's qa-r32-prefix as committed (it no longer applies: r4 moved the check into startsWithGhPrMerge), then
// ported to r4's code at the helper itself, a different spot from the developer's prefix-half.
if (ONLY !== "dev") results.push(run("qa234-qa-r32-prefix-asis", "r4-4", "qa234", () => sh(`git apply "${QA234_PREFIX}"`).status === 0));
QA.unshift(["qa234-qa-r32-prefix-port", "r4-4", `${SRC}/git.ts`, "return GH_PR_MERGE_START_RE.test(command.trim());", "return GH_PR_MERGE_RE.test(command.trim());"]);
if (ONLY !== "dev") for (const [id, row, file, from, to] of QA) {
  results.push(run(id, row, "qa235", () => {
    const p = join(WT, file);
    const s = readFileSync(p, "utf8");
    if (s.split(from).length !== 2) return false;
    writeFileSync(p, s.replace(from, to));
    return true;
  }));
}
restore();
writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log(`red ${results.filter((r) => r.red).length}/${results.length}; not landed: ${results.filter((r) => !r.landed).map((r) => r.id).join(", ") || "none"}`);
