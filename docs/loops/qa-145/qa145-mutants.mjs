// QA 145 mutants (record session 145), run in a worktree of 7f4ca74 that carries qa145-bootstrap-r3.test.ts.
//   node qa145-mutants.mjs <mutant worktree> <out.json> [ids...]
// Each mutant: the anchor must match exactly once, the edit must land, tsc must exit 0, the build is rebuilt
// (the probes run the BUILT hook), five test files run through vitest's JSON reporter, the probe script runs,
// then the file is restored with git and its blob checked against 7f4ca74's.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const W = resolve(process.argv[2]);
const OUT = resolve(process.argv[3]);
const only = process.argv.slice(4);
const OB = join(W, "open-brain");
const PROBES = resolve(import.meta.dirname, "qa145-probes.mjs");
const FILES = ["tests/pipelines/qa145-bootstrap-r3.test.ts", "tests/pipelines/qa135-bootstrap.test.ts",
  "tests/pipelines/bootstrap-fix-r3.test.ts", "tests/pipelines/bootstrap-fix.test.ts", "tests/pipelines/sync/repo-root.test.ts"];

const MUTANTS = [
  { id: "Q1", name: "isProjectRoot reverted to b45900f's rule (package.json required)", file: "src/shared/repo-root.ts",
    from: String.raw`  if (existsSync(join(dir, ".agents", "SYSTEM"))
    || existsSync(join(dir, ".agents", "META"))
    || existsSync(join(dir, ".agents", "state.json"))) return true;
  return existsSync(join(dir, "package.json")) && existsSync(join(dir, "open-brain"));`,
    to: String.raw`  if (!existsSync(join(dir, "package.json"))) return false;
  return existsSync(join(dir, ".agents", "SYSTEM"))
    || existsSync(join(dir, ".agents", "META"))
    || existsSync(join(dir, "open-brain"));` },
  { id: "Q2", name: "archive/ treated as residue again", file: "src/pipelines/bootstrap/index.ts",
    from: String.raw`    .filter((n) => !(n === "archive" && statSync(join(agents, n)).isDirectory()))`,
    to: String.raw`    .filter((n) => n.length > 0)` },
  { id: "Q3", name: "move-residue accepts a parseable state.json (a record)", file: "src/pipelines/bootstrap/index.ts",
    from: String.raw`  if (a.kind !== "residue" && a.kind !== "not-a-record") throw`,
    to: String.raw`  if (a.kind !== "residue" && a.kind !== "not-a-record" && a.kind !== "bootstrapped") throw` },
  { id: "Q4", name: "the SCAFFOLDED state removed", file: "src/pipelines/bootstrap/index.ts",
    from: String.raw`  if (isScaffoldAgentMd(join(agents, "AGENT.md"))) {`,
    to: String.raw`  if (false && isScaffoldAgentMd(join(agents, "AGENT.md"))) {` },
  { id: "Q5", name: "gitState's archive/ filter hides TRACKED changes too", file: "src/pipelines/bootstrap/index.ts",
    from: String.raw`      .filter((l) => !(l.startsWith("?? ") && l.slice(3).replace(/^"|"$/g, "").startsWith(".agents/archive/")));`,
    to: String.raw`      .filter((l) => !l.slice(3).replace(/^"|"$/g, "").startsWith(".agents/archive/"));` },
  { id: "Q6", name: "isProjectRoot without the .agents/state.json clause", file: "src/shared/repo-root.ts",
    from: String.raw`    || existsSync(join(dir, ".agents", "META"))
    || existsSync(join(dir, ".agents", "state.json"))) return true;`,
    to: String.raw`    || existsSync(join(dir, ".agents", "META"))) return true;` },
  { id: "Q7", name: "notARecord: the {{...}} seed check removed", file: "src/pipelines/bootstrap/index.ts",
    from: String.raw`  if (typeof name === "string" && name.includes("{{")) return`,
    to: String.raw`  if (typeof name === "string" && name.includes("{{never")) return` },
  { id: "Q8", name: "state import walks up again (resolveRepoRoot ?? literal)", file: "src/cli.ts",
    from: String.raw`  const projectRoot = resolve(positionals[0] ?? ".");
  if (!(existsSync(`,
    to: String.raw`  const projectRoot = resolveRepoRoot(resolve(positionals[0] ?? ".")) ?? resolve(positionals[0] ?? ".");
  if (!(existsSync(` },
];

const sh = (cmd, args, cwd, extra = {}) => spawnSync(cmd, args, { cwd, encoding: "utf8", shell: false, maxBuffer: 1 << 28, ...extra });
const blob = (f) => sh("git", ["hash-object", join("open-brain", f)], W).stdout.trim();
const want = (f) => sh("git", ["rev-parse", `7f4ca74:open-brain/${f}`], W).stdout.trim();
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const results = [];

for (const m of MUTANTS.filter((m) => only.length === 0 || only.includes(m.id))) {
  const path = join(OB, m.file);
  const src = readFileSync(path, "utf8");
  const n = src.split(m.from).length - 1;
  if (n !== 1) { results.push({ id: m.id, error: `anchor matched ${n} times` }); continue; }
  writeFileSync(path, src.replace(m.from, m.to));
  const landed = readFileSync(path, "utf8").includes(m.to);
  const tsc = sh(process.execPath, [join(OB, "node_modules/typescript/bin/tsc"), "--noEmit", "-p", "."], OB);
  const build = sh(process.execPath, [join(OB, "node_modules/typescript/bin/tsc")], OB);
  const jsonOut = join(mkdtempSync(join(tmpdir(), "qa145-mut-")), "v.json");
  sh(process.execPath, [join(OB, "node_modules/vitest/vitest.mjs"), "run", ...FILES, "--reporter=json", `--outputFile=${jsonOut}`], OB);
  let failed = [], total = 0;
  try {
    const j = JSON.parse(readFileSync(jsonOut, "utf8"));
    for (const f of j.testResults) for (const a of f.assertionResults) {
      total++;
      if (a.status === "failed") failed.push({ file: f.name.split(/[\\/]/).pop(), title: a.title, msg: (a.failureMessages[0] ?? "").split("\n")[0].slice(0, 200) });
    }
  } catch (e) { failed = [{ file: "?", title: "vitest JSON unreadable", msg: String(e) }]; }
  const probeOut = join(tmpdir(), `qa145-probes-${m.id}.md`);
  const p = sh(process.execPath, [PROBES, W, probeOut], W);
  const probeFails = (p.stdout.match(/^FAIL .*/gm) ?? []).map((l) => l.slice(0, 200));
  sh("git", ["checkout", "--", join("open-brain", m.file)], W);
  const restored = blob(m.file) === want(m.file);
  const r = { id: m.id, name: m.name, landed, tsc: tsc.status, build: build.status, tests: total, failedTests: failed.length, failed, probeFails, restored };
  results.push(r);
  console.log(`${m.id} ${m.name}: landed=${landed} tsc=${tsc.status} build=${build.status} tests ${failed.length}/${total} red; probe rows red ${probeFails.length}; restored=${restored}`);
  for (const f of failed) console.log(`   test  ${f.file} :: ${f.title} :: ${f.msg}`);
  for (const f of probeFails) console.log(`   probe ${f}`);
}
// The build is left matching 7f4ca74 again.
const rebuilt = sh(process.execPath, [join(OB, "node_modules/typescript/bin/tsc")], OB).status;
writeFileSync(OUT, JSON.stringify({ results, rebuilt }, null, 2));
console.log(`rebuilt at 7f4ca74: tsc exit ${rebuilt}`);
