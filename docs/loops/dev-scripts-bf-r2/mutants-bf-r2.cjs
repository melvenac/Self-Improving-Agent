// BF mutants re-run on the merged tree (record 133). Run from the repo root:
//   node docs/loops/dev-scripts-bf-r2/mutants-bf-r2.cjs
// Each mutant: exact anchor with an asserted count, tsc --noEmit, one vitest file, restore + hash check.
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const { spawnSync, execFileSync } = require("child_process");
const ROOT = process.cwd(), OB = path.join(ROOT, "open-brain");
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const old = (ref, rel) => execFileSync("git", ["show", `${ref}:${rel}`], { cwd: ROOT, maxBuffer: 1 << 24 }).toString();
const BMD = "project-template/.claude/commands/bootstrap.md";
const TEST = "tests/pipelines/bootstrap-fix.test.ts";
const MUTANTS = [
  { name: "verify-always-ok", file: "open-brain/src/pipelines/bootstrap/index.ts",
    from: "  return { ok: problems.length === 0, problems };", to: "  return { ok: true, problems };", count: 1 },
  { name: "cli-start-header-reverted", file: "open-brain/src/cli.ts",
    from: "console.log(recordName ? `Project: ${recordName} v${result.state.version}` : `Project: v${result.state.version}`);",
    to: "console.log(`Project: v${result.state.version}`);", count: 1 },
  { name: "order-guard-vs-1c9cb74", file: BMD, whole: () => old("1c9cb74", BMD), grep: "every step that makes the tree dirty" },
  { name: "order-guard-vs-a71b4cb", file: BMD, whole: () => old("a71b4cb", BMD), grep: "every step that makes the tree dirty" },
  { name: "merge-hunk3-unfloored", file: "open-brain/src/pipelines/state-import/index.ts",
    from: "closed_session = ${retentionEdge(r.current_session)}.", to: "closed_session = ${r.current_session - DONE_RETENTION_SESSIONS}.", count: 1,
    // the report only prints an inferred done item's stamp when there is one; BF-8's row has one
    grep: "BF-8" },
];
const results = [];
for (const m of MUTANTS) {
  const abs = path.join(ROOT, m.file), before = sha(abs), orig = fs.readFileSync(abs, "utf8");
  let mutated;
  if (m.whole) mutated = m.whole();
  else {
    const n = orig.split(m.from).length - 1;
    if (n !== m.count) { results.push({ name: m.name, verdict: `VOID: anchor matched ${n}, expected ${m.count}` }); continue; }
    mutated = orig.split(m.from).join(m.to);
  }
  if (mutated === orig) { results.push({ name: m.name, verdict: "VOID: edit did not change the file" }); continue; }
  fs.writeFileSync(abs, mutated);
  try {
    const landed = sha(abs) !== before;
    const tsc = spawnSync("npx", ["tsc", "--noEmit", "-p", "."], { cwd: OB, shell: true, encoding: "utf8" });
    const vargs = ["vitest", "run", TEST, "--reporter=verbose"]; if (m.grep) vargs.push("-t", JSON.stringify(m.grep));
    const v = spawnSync("npx", vargs, { cwd: OB, shell: true, encoding: "utf8", maxBuffer: 1 << 26 });
    const out = (v.stdout + v.stderr).replace(/\x1b\[[0-9;]*m/g, "");
    const failed = out.split("\n").filter((l) => /^\s+× /.test(l)).map((l) => l.trim().slice(0, 200));
    const errs = [...new Set(out.split("\n").filter((l) => /^(AssertionError|TypeError|Error):|expected .* to /.test(l.trim())).map((l) => l.trim().slice(0, 240)))].slice(0, 6);
    const summary = out.split("\n").filter((l) => /Tests\s+\d/.test(l)).map((l) => l.trim());
    results.push({ name: m.name, landed, tsc: tsc.status, vitest_exit: v.status, red: failed.length, failed, errs, summary,
      verdict: tsc.status !== 0 ? "VOID: tsc" : failed.length > 0 ? "KILLED" : "SURVIVED" });
  } finally {
    fs.writeFileSync(abs, orig);
    results[results.length - 1].restored = sha(abs) === before;
  }
}
console.log(JSON.stringify(results, null, 2));
