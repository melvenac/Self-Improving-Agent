// QA 151 mutants on 7913c5f's checks.ts. Run from <mut>/open-brain: node mutants-qa151.cjs <evidence dir> [id...]
// Each mutant: exact-string replace (must match once), build, the developer's 14 rows, then real-path probes
// against C:/qa-scratch/t048/rc (ACL denies are set by the caller; run the whole driver with SeBackupPrivilege
// disabled). Restores checks.ts after each mutant and at the end.
const fs = require("node:fs"), { execSync, spawnSync } = require("node:child_process"), path = require("node:path");
const F = "src/pipelines/sync/checks.ts", EV = process.argv[2], only = process.argv.slice(3);
const orig = fs.readFileSync(F, "utf8");
const RC = "C:/qa-scratch/t048/rc", FIVE = "C:/qa-scratch/t048/s/five.mjs", BUILD = path.resolve("build");
const probe = (label, env = {}) => {
  const r = spawnSync("node", [FIVE, BUILD, RC, label], { encoding: "utf8", env: { ...process.env, ...env } });
  return (r.stdout + r.stderr).trim();
};
const M = [
  { id: "P1", what: "SILENT 1 (developer's P1, re-run): retirements read `catch { continue }` put back",
    find: "try { texts.set(rel, readFileSync(join(projectRoot, rel), \"utf8\")); } catch (e) {\n      unreadable.push(`${rel} (${(e as NodeJS.ErrnoException).code ?? \"error\"})`);\n    }",
    repl: "try { texts.set(rel, readFileSync(join(projectRoot, rel), \"utf8\")); } catch { continue; }",
    probes: [["P1 real: ACL-denied files, git path"]] },
  { id: "Q1", what: "SILENT 1: unreadable paths make it an issue but are not NAMED in the message",
    find: "const all = [...unreadable.map((u) => `unreadable: ${u}`), ...unexpected, ...stale];",
    repl: "const all = [...unexpected, ...stale];",
    probes: [["Q1 real: ACL-denied files, git path"]] },
  { id: "Q2", what: "SILENT 20: the widened list loses yml|yaml|toml (only .sh has a row)",
    find: String.raw`const SCANNED_EXT = /\.(md|ts|mts|cts|mjs|cjs|js|json|sh|ps1|yml|yaml|toml)$/;`,
    repl: String.raw`const SCANNED_EXT = /\.(md|ts|mts|cts|mjs|cjs|js|json|sh|ps1)$/;`,
    probes: [["Q2 real: staged scripts/qa151-plant.yml names knowledge-mcp"]] },
  { id: "Q3", what: "SILENT 26 / addition (d): `git ls-files` listing nothing is trusted as a git listing (no fallback)",
    find: "if (files.length > 0) return { files, source: \"git\", label: \"listed by git ls-files\", unreadable: [] };",
    repl: "return { files, source: \"git\", label: \"listed by git ls-files\", unreadable: [] };",
    probes: [["Q3 real: GIT_INDEX_FILE -> nonexistent (ls-files lists nothing)", { GIT_INDEX_FILE: "C:/qa-tmp/t048-no-such-index" }]] },
  { id: "Q4", what: "SILENT 2: module-boundary records an unreadable .ts only when the code is EACCES (the mock's code)",
    find: "try { sources.set(rel, readFileSync(join(srcDir, rel), \"utf8\")); } catch (e) {\n      unreadable.push(",
    repl: "try { sources.set(rel, readFileSync(join(srcDir, rel), \"utf8\")); } catch (e) {\n      if ((e as NodeJS.ErrnoException).code === \"EACCES\") unreadable.push(",
    probes: [["Q4 real: ACL-denied relocate.ts (EPERM)"]] },
  { id: "Q5", what: "SILENT 3: template treats any read error but EACCES as a binary (the old comment, restored by code)",
    find: "try { txt = readFileSync(full, \"utf-8\"); } catch (e) {\n        unreadable.push(",
    repl: "try { txt = readFileSync(full, \"utf-8\"); } catch (e) {\n        if ((e as NodeJS.ErrnoException).code !== \"EACCES\") continue;\n        unreadable.push(",
    probes: [["Q5 real: ACL-denied template file (EPERM); .cursor dir denied too"]] },
  { id: "Q6", what: "SILENT 26: the walk's unreadable paths reach the LABEL (PARTIAL) but not the verdict",
    find: "const unreadable = [...listing.unreadable];",
    repl: "const unreadable: string[] = [];",
    probes: [["Q6 real: GIT_DIR -> nonexistent (fallback) with denied dirs", { GIT_DIR: "C:/qa-tmp/t048-no-such-gitdir" }]] },
  { id: "Q7", what: "SILENT 3: template does not report an unreadable DOT directory (.claude/.cursor)",
    find: "try { entries = readdirSync(dir, { withFileTypes: true }); } catch (e) {\n      unreadable.push(`${rel(dir)}/",
    repl: "try { entries = readdirSync(dir, { withFileTypes: true }); } catch (e) {\n      if (!dir.slice(Math.max(dir.lastIndexOf(\"/\"), dir.lastIndexOf(String.fromCharCode(92))) + 1).startsWith(\".\")) unreadable.push(`${rel(dir)}/",
    probes: [["Q7 real: ACL-denied project-template/.cursor"]] },
];
const TESTS = (process.env.QA_TESTS || "tests/pipelines/sync/t048-unreadable.test.ts").split(",");
const TAG = process.env.QA_TAG || "";
const out = [];
const log = (s) => { console.log(s); out.push(s); };
try {
  for (const m of M) {
    if (only.length && !only.includes(m.id)) continue;
    const n = orig.split(m.find).length - 1;
    if (n !== 1) { log(`${m.id}: FIND MATCHED ${n} TIMES — not applied`); continue; }
    fs.writeFileSync(F, orig.replace(m.find, m.repl));
    log(`\n######## ${m.id}: ${m.what}`);
    const b = spawnSync("npm", ["run", "build"], { encoding: "utf8", shell: true });
    log(`build exit ${b.status}${b.status ? "\n" + (b.stdout + b.stderr).split("\n").filter((l) => /error/i.test(l)).slice(0, 5).join("\n") : ""}`);
    const v = spawnSync("npx", ["vitest", "run", ...TESTS, "--reporter=json", `--outputFile=${EV}/${m.id}${TAG}-vitest.json`], { encoding: "utf8", shell: true });
    let summary = `vitest exit ${v.status}`;
    try {
      const j = JSON.parse(fs.readFileSync(`${EV}/${m.id}${TAG}-vitest.json`, "utf8"));
      const failed = j.testResults.flatMap((f) => f.assertionResults.filter((a) => a.status === "failed").map((a) => a.fullName));
      summary += `; ${j.numPassedTests} passed, ${j.numFailedTests} failed${failed.length ? ": " + failed.join(" | ") : ""}`;
      summary += `\nROWS (${TESTS.map((t) => t.split("/").pop()).join(", ")}): ${j.numFailedTests > 0 ? "KILLED" : "SURVIVED"}`;
    } catch (e) { summary += ` (no json: ${e.message})`; }
    log(summary);
    if (!process.env.QA_NOPROBE) for (const [label, env] of m.probes) log(probe(label, env));
  }
} finally {
  fs.writeFileSync(F, orig);
  spawnSync("npm", ["run", "build"], { encoding: "utf8", shell: true });
  fs.writeFileSync(`${EV}/mutants-qa151${TAG}.out`, out.join("\n") + "\n");
  console.log("restored checks.ts and rebuilt");
}
