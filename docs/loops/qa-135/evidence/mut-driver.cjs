// QA 135 mutant driver. For each mutant: apply exact-anchor edits (count asserted = 1), assert they landed,
// tsc --noEmit, run the named test files with vitest's JSON reporter, record every failing test and its first
// assertion line, restore every touched file and hash-check it. Runs in C:\qa-scratch\mut (6543e8e).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const ROOT = "C:/qa-scratch/mut";
const OB = path.join(ROOT, "open-brain");
const sha = (p) => (fs.existsSync(p) ? crypto.createHash("sha1").update(fs.readFileSync(p)).digest("hex") : "ABSENT");
const OLD_TEMPLATE_STATE = spawnSync("git", ["show", "f618b73:project-template/.agents/state.json"], { cwd: ROOT, encoding: "utf8" }).stdout;

const TESTS_DEFAULT = [
  "tests/pipelines/bootstrap-fix.test.ts",
  "tests/pipelines/template-seed.test.ts",
  "tests/pipelines/session-start/role-files.test.ts",
  "tests/pipelines/state-import.test.ts",
  "tests/pipelines/state-import-v3.test.ts",
];

const BI = "open-brain/src/pipelines/bootstrap/index.ts";
const SI = "open-brain/src/pipelines/state-import/index.ts";
const RF = "open-brain/src/pipelines/session-start/role-files.ts";

const MUTANTS = [
  { name: "M1-residue-deleted", why: "move-residue deletes the residue and reports it moved", edits: [
    { file: BI, find: "import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync, renameSync, realpathSync, rmdirSync } from \"node:fs\";",
      repl: "import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync, renameSync, realpathSync, rmdirSync, rmSync } from \"node:fs\";" },
    { file: BI, find: "  const aside = join(root, `.agents.residue-moving-${process.pid}`);",
      repl: "  rmSync(agents, { recursive: true, force: true }); mkdirSync(join(root, rel), { recursive: true }); return { to: rel, entries: a.entries };\n  const aside = join(root, `.agents.residue-moving-${process.pid}`);" },
  ] },
  { name: "M1b-residue-emptied", why: "move-residue moves the names but not the bytes (each file emptied)", edits: [
    { file: BI, find: "  const landed = readdirSync(join(root, rel))",
      repl: "  for (const n of readdirSync(join(root, rel))) { const p = join(root, rel, n); if (statSync(p).isFile()) writeFileSync(p, \"\"); }\n  const landed = readdirSync(join(root, rel))" },
  ] },
  { name: "M2-no-zero-task-warning", why: "the 0-task WARNING is removed", edits: [
    { file: SI, find: "  const src = r.sources.inbox;\n  if (!src?.present || r.inbox.items > 0) return null;",
      repl: "  if (r) return null;\n  const src = r.sources.inbox;\n  if (!src?.present || r.inbox.items > 0) return null;" },
  ] },
  { name: "M3a-template-state-restored", why: "the template's placeholder state.json is back in project-template/", writes: [
    { file: "project-template/.agents/state.json", content: OLD_TEMPLATE_STATE },
  ] },
  { name: "M3b-template-state-copied", why: "the template state.json is back AND scaffold copies it", writes: [
    { file: "project-template/.agents/state.json", content: OLD_TEMPLATE_STATE },
  ], edits: [
    { file: BI, find: "  { path: \".agents/TASKS/INBOX.md\", from: \".agents/TASKS/INBOX.md\", tracked: true,",
      repl: "  { path: \".agents/state.json\", from: \".agents/state.json\", tracked: true, why: \"the record\" },\n  { path: \".agents/TASKS/INBOX.md\", from: \".agents/TASKS/INBOX.md\", tracked: true," },
  ] },
  { name: "M4-pre-state-is-residue", why: "prose TASKS/ is no longer PRE-STATE, so move-residue would move a real project's tasks aside", edits: [
    { file: BI, find: "  if (existsSync(join(agents, \"TASKS\"))) return { kind: \"pre-state\" };\n", repl: "" },
  ] },
  { name: "M5-record-is-residue", why: "a state.json no longer means BOOTSTRAPPED", edits: [
    { file: BI, find: "  if (existsSync(join(agents, \"state.json\"))) return { kind: \"bootstrapped\" };\n", repl: "" },
  ] },
  { name: "M6-not-a-seat-role-missing", why: "role: none reports ROLE FILE MISSING again (BF-5)", edits: [
    { file: RF, find: "      if (notASeat) continue;\n", repl: "" },
  ] },
  { name: "M7-template-eol-dropped", why: "the template gitattributes no longer forces eol=lf (BF-7)", edits: [
    { file: "project-template/gitattributes", find: "/.agents/** text eol=lf", repl: "/.agents/** text" },
  ] },
  { name: "M8-scaffold-overwrites", why: "scaffold overwrites an existing file", edits: [
    { file: BI, find: "    if (existsSync(dest)) { skipped.push({ path: f.path, reason: \"already exists — never overwritten\" }); continue; }\n", repl: "" },
  ] },
  { name: "M9-future-tracked-unchecked", why: "verify no longer checks that state.json/next-session.md will be tracked", edits: [
    { file: BI, find: "  for (const p of FUTURE_TRACKED) if (ignored(p)) problems.push(", repl: "  for (const p of FUTURE_TRACKED) if (ignored(p) && p === \"\") problems.push(" },
  ] },
  { name: "M10-agent-md-untracked", why: "the template gitignore no longer tracks AGENT.md (BF-5 in a clone)", edits: [
    { file: "project-template/gitignore", find: "!/.agents/AGENT.md\n", repl: "" },
  ] },
  { name: "M11-archive-counts-dirty", why: "the moved residue under archive/ makes the tree dirty (scaffold would refuse)", edits: [
    { file: BI, find: ".filter((l) => !(l.startsWith(\"?? \") && l.slice(3).replace(/^\"|\"$/g, \"\").startsWith(`.agents/archive/${RESIDUE_PREFIX}`)));",
      repl: ".filter((l) => l.length > 0);" },
  ] },
  { name: "M12-section-re-reverted", why: "SECTION_RE back to /^## (P[0-3])\\b/ (the template's emoji headings stop parsing)", edits: [
    { file: SI, find: "const SECTION_RE = /^## (?:[^\\w\\s]+\\s*)?(P[0-3])\\b/;", repl: "const SECTION_RE = /^## (P[0-3])\\b/;" },
  ] },
  { name: "M13-landed-check-removed", why: "move-residue no longer reads back what landed", edits: [
    { file: BI, find: "  if (JSON.stringify(landed) !== JSON.stringify(a.entries)) {", repl: "  if (JSON.stringify(landed) === \"never\") {" },
  ] },
  { name: "M14-claude-md-any-heading", why: "check treats any CLAUDE.md as already carrying the SIA section (the append is never offered)", edits: [
    { file: BI, find: "  return text.split(/\\r?\\n/).some((l) => l.trimEnd() === SIA_SECTION_HEADING) ? \"has-sia-section\" : \"present\";",
      repl: "  return text.length >= 0 ? \"has-sia-section\" : \"present\";" },
  ] },
  { name: "M1t-residue-deleted-typed", why: "M1 in a form that typechecks: delete the residue, report it moved", edits: [
    { file: BI, find: "import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync, renameSync, realpathSync, rmdirSync } from \"node:fs\";",
      repl: "import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync, renameSync, realpathSync, rmdirSync, rmSync } from \"node:fs\";" },
    { file: BI, find: "  const aside = join(root, `.agents.residue-moving-${process.pid}`);",
      repl: "  if (a.entries.length >= 0) { rmSync(agents, { recursive: true, force: true }); mkdirSync(join(root, rel), { recursive: true }); return { to: rel, entries: a.entries }; }\n  const aside = join(root, `.agents.residue-moving-${process.pid}`);" },
  ] },
  { name: "M2t-no-zero-task-warning-typed", why: "M2 in a form that typechecks: inboxWarning always null", edits: [
    { file: SI, find: "  if (!src?.present || r.inbox.items > 0) return null;", repl: "  if (!src?.present || r.inbox.items > 0 || r.inbox.items === 0) return null;" },
  ] },
  { name: "M15-agent-md-role-developer", why: "scaffold's AGENT.md declares role: developer (a fresh install is a seat again)", edits: [
    { file: BI, find: "role: none\npartner:", repl: "role: developer\npartner:" },
  ] },
];

function run(cmd, args, cwd, env) {
  return spawnSync(cmd, args, { cwd, encoding: "utf8", shell: false, env: { ...process.env, ...(env || {}) }, maxBuffer: 1 << 28 });
}

const only = process.argv.slice(2);
const results = [];
for (const m of MUTANTS) {
  if (only.length && !only.includes(m.name)) continue;
  const touched = new Set([...(m.edits || []).map((e) => e.file), ...(m.writes || []).map((w) => w.file)]);
  const before = {}; const orig = {};
  for (const f of touched) { const p = path.join(ROOT, f); before[f] = sha(p); orig[f] = fs.existsSync(p) ? fs.readFileSync(p) : null; }
  const res = { name: m.name, why: m.why, landed: true, tsc: null, failed: [], passed: 0, total: 0, verdict: "", restored: false };
  try {
    for (const w of m.writes || []) fs.writeFileSync(path.join(ROOT, w.file), w.content);
    for (const e of m.edits || []) {
      const p = path.join(ROOT, e.file);
      const t = fs.readFileSync(p, "utf8");
      const n = t.split(e.find).length - 1;
      if (n !== 1) throw new Error(`anchor count ${n} in ${e.file}: ${e.find.slice(0, 60)}`);
      fs.writeFileSync(p, t.replace(e.find, () => e.repl));
      if (!fs.readFileSync(p, "utf8").includes(e.repl) && e.repl !== "") throw new Error(`edit did not land in ${e.file}`);
    }
    const tsc = run(process.execPath, [path.join(OB, "node_modules/typescript/bin/tsc"), "--noEmit", "-p", "."], OB);
    res.tsc = tsc.status;
    const out = path.join("C:/qa-tmp", `mut-${m.name}.json`);
    const tests = m.tests || TESTS_DEFAULT;
    run(process.execPath, [path.join(OB, "node_modules/vitest/vitest.mjs"), "run", ...tests, "--reporter=json", `--outputFile=${out}`], OB);
    const j = JSON.parse(fs.readFileSync(out, "utf8"));
    res.total = j.numTotalTests; res.passed = j.numPassedTests;
    for (const f of j.testResults) for (const a of f.assertionResults) if (a.status === "failed") {
      const msg = (a.failureMessages[0] || "").split("\n")[0].slice(0, 220);
      res.failed.push(`${path.basename(f.name)} > ${a.fullName} :: ${msg}`);
    }
    if (j.numFailedTestSuites > 0 && res.failed.length === 0) res.failed.push(`suite failed to load: ${j.testResults.filter((f) => f.status === "failed").map((f) => f.message.slice(0, 200)).join(" | ")}`);
    res.verdict = res.failed.length ? "KILLED" : "SURVIVED";
  } catch (err) {
    res.landed = false; res.verdict = `NOT RUN: ${err.message}`;
  } finally {
    for (const f of touched) { const p = path.join(ROOT, f); if (orig[f] === null) { if (fs.existsSync(p)) fs.unlinkSync(p); } else fs.writeFileSync(p, orig[f]); }
    res.restored = [...touched].every((f) => sha(path.join(ROOT, f)) === before[f]);
  }
  results.push(res);
  console.log(`${res.name}: ${res.verdict} (tsc ${res.tsc}; ${res.passed}/${res.total} passed; restored ${res.restored})`);
  for (const f of res.failed) console.log(`    - ${f}`);
}
fs.writeFileSync("C:/qa-scratch/logs/mutants.json", JSON.stringify(results, null, 2));
const dirty = run("git", ["status", "--porcelain"], ROOT).stdout.trim();
console.log(`mut worktree porcelain after all mutants: ${dirty === "" ? "clean" : dirty}`);
