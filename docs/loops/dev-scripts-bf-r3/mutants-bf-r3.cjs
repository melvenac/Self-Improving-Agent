// Round 3 mutants (Forge, record 141): one per protection R-BF-9..13 adds. Run from the repo root:
//   node docs/loops/dev-scripts-bf-r3/mutants-bf-r3.cjs > docs/loops/dev-scripts-bf-r3/mutants-local.json
// Each mutant: every anchor matched exactly once, the edit asserted to have landed, tsc --noEmit,
// the four test files through vitest's JSON reporter, then restore and a hash check.
const fs = require("fs"), path = require("path"), crypto = require("crypto"), os = require("os");
const { spawnSync } = require("child_process");
const ROOT = process.cwd(), OB = path.join(ROOT, "open-brain");
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const CLI = "open-brain/src/cli.ts", BS = "open-brain/src/pipelines/bootstrap/index.ts";
const IMP = "open-brain/src/pipelines/state-import/index.ts", RR = "open-brain/src/shared/repo-root.ts";
const BMD = "project-template/.claude/commands/bootstrap.md";
const TESTS = ["tests/pipelines/bootstrap-fix-r3.test.ts", "tests/pipelines/qa135-bootstrap.test.ts",
  "tests/pipelines/bootstrap-fix.test.ts", "tests/pipelines/sync/repo-root.test.ts"];
const MUTANTS = [
  { name: "R9-import-walks-again", why: "state import resolves up through resolveRepoRoot again", file: CLI, edits: [[
    `  const projectRoot = resolve(positionals[0] ?? ".");`,
    `  const projectRoot = resolveRepoRoot(resolve(positionals[0] ?? ".")) ?? resolve(positionals[0] ?? ".");`]] },
  { name: "R9-name-unknown", why: "no package.json: the name is 'unknown' instead of the folder's", file: IMP, edits: [[
    `: { name: basename(root), version: pkg?.version ?? "0.0.0", name_from: "folder" },`,
    `: { name: "unknown", version: pkg?.version ?? "0.0.0", name_from: "folder" },`]] },
  { name: "R9-sibling-root-needs-package-json", why: "isProjectRoot requires package.json beside the protocol layout again", file: RR, edits: [[
    `|| existsSync(join(dir, ".agents", "state.json"))) return true;`,
    `|| existsSync(join(dir, ".agents", "state.json"))) return existsSync(join(dir, "package.json"));`]] },
  { name: "R10-scaffolded-never-seen", why: "check never recognises scaffold's AGENT.md", file: BS, edits: [[
    `return existsSync(path) && statSync(path).isFile() && readFileSync(path, "utf8").includes(SCAFFOLD_SIGNATURE);`,
    `return existsSync(path) && statSync(path).isFile() && readFileSync(path, "utf8").includes(SCAFFOLD_SIGNATURE + "#");`]] },
  { name: "R10-template-inbox-warning-off", why: "the importer never flags a template INBOX", file: IMP, edits: [[
    `      template_copy: isTemplateInbox(texts.inbox, templateDir),`,
    `      template_copy: isTemplateInbox(texts.inbox, templateDir) && false,`]] },
  { name: "R10-scaffold-rerun-not-refused-first", why: "scaffold's scaffolded refusal removed (the dirty check answers instead)", file: BS, edits: [[
    `  if (ins.agents.kind === "scaffolded") throw new Error("already scaffolded (.agents/AGENT.md is scaffold's) and not yet imported — continue at step 4. Nothing written");\n`,
    ``]] },
  { name: "R11-any-state-json-is-a-record", why: "notARecord always null: a zero-byte or seed state.json is BOOTSTRAPPED again", file: BS, edits: [[
    `  const text = readFileSync(path, "utf8");\n  if (text.trim() === "")`,
    `  const text = readFileSync(path, "utf8");\n  if (text.length >= 0) return null;\n  if (text.trim() === "")`]] },
  { name: "R11-seed-accepted", why: "the {{PROJECT}} seed check never matches", file: BS, edits: [[
    `name.includes("{{")) return`, `name.includes("{{{{")) return`]] },
  { name: "R12-archive-is-residue-again", why: "archive/ counted as residue, so a second move nests the first", file: BS, edits: [[
    `.filter((n) => !(n === "archive" && statSync(join(agents, n)).isDirectory()))`,
    `.filter((n) => n !== "")`]] },
  { name: "R12-no-suffix", why: "the second move on one day reuses the first folder", file: BS, edits: [[
    `for (let n = 2; existsSync(join(root, rel)); n++)`, `for (let n = 2; n < 2 && existsSync(join(root, rel)); n++)`]] },
  { name: "R12-M13-readback-removed", why: "moveResidue no longer reads back what landed (QA 135's surviving M13)", file: BS, edits: [[
    `  if (missing.length > 0 || stayed.length > 0) {`, `  if ((missing.length > 0 || stayed.length > 0) && root === "") {`]] },
  { name: "R12-cli-readback-says-refused", why: "the CLI prints a read-back mismatch as 'refused' again (expected to SURVIVE: no CLI row reaches it)", file: CLI, edits: [[
    "? `bootstrap move-residue — MOVED, but ${err.message}`", "? `bootstrap move-residue refused: ${err.message}`"]] },
  { name: "R13-empty-never-detected", why: "check never sees an empty project (both git states)", file: BS, edits: [
    [`empty: readdirSync(root).every((n) => n === ".agents" || n === ".git") };`, `empty: readdirSync(root).every((n) => n === ".agents" || n === ".git") && root === "" };`],
    [`const empty = !commits && dirty.every(`, `const empty = root === "" && !commits && dirty.every(`]] },
  { name: "R13-doc-allow-empty-dropped", why: "bootstrap.md step 2.2 loses the empty commit", file: BMD, edits: [[
    `   git commit --allow-empty -m "The project before SIA"\n`, `   git commit -m "The project before SIA"\n`]] },
];

const results = [];
for (const m of MUTANTS) {
  const abs = path.join(ROOT, m.file), before = sha(abs), orig = fs.readFileSync(abs, "utf8");
  let mutated = orig, bad = null;
  for (const [from, to] of m.edits) {
    const n = mutated.split(from).length - 1;
    if (n !== 1) { bad = `VOID: anchor matched ${n}, expected 1: ${from.slice(0, 60)}`; break; }
    mutated = mutated.split(from).join(to);
  }
  if (bad) { results.push({ name: m.name, verdict: bad }); continue; }
  const r = { name: m.name, why: m.why };
  results.push(r);
  fs.writeFileSync(abs, mutated);
  try {
    r.landed = sha(abs) !== before;
    if (!r.landed) { r.verdict = "VOID: edit did not land"; continue; }
    const tsc = spawnSync("npx", ["tsc", "--noEmit", "-p", "."], { cwd: OB, shell: true, encoding: "utf8" });
    r.tsc = tsc.status;
    const out = path.join(os.tmpdir(), `bf-r3-mut-${m.name}.json`);
    const v = spawnSync("npx", ["vitest", "run", ...TESTS, "--reporter=json", `--outputFile=${out}`], { cwd: OB, shell: true, encoding: "utf8", maxBuffer: 1 << 26 });
    r.vitest_exit = v.status;
    const j = JSON.parse(fs.readFileSync(out, "utf8"));
    const failed = [];
    for (const f of j.testResults) for (const t of f.assertionResults) if (t.status === "failed") {
      failed.push({ file: path.basename(f.name), test: t.title.slice(0, 140), first: (t.failureMessages[0] || "").split("\n")[0].slice(0, 200) });
    }
    r.passed = `${j.numPassedTests}/${j.numTotalTests}`;
    r.red = failed.length;
    r.failed = failed;
    r.verdict = tsc.status !== 0 ? "VOID: tsc" : failed.length === 0 ? "SURVIVED"
      : failed.every((f) => /^AssertionError/.test(f.first)) ? "KILLED" : "KILLED (not all on AssertionError: read the rows)";
  } finally {
    fs.writeFileSync(abs, orig);
    r.restored = sha(abs) === before;
  }
}
console.log(JSON.stringify(results, null, 2));
