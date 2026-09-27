// QA 142 check 6: the seat's own mutants, each applied to a scratch worktree at 706c029, built, and run against
// Forge's T-003 rows and QA 142's probes. Each site must occur exactly once; the tree is restored in `finally`.
// usage: node mutants-qa142.mjs <mut-root> <scratch-dir> <scripts-dir>
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const [MUT, S, SCRIPTS, ONLY] = process.argv.slice(2);
const OB = join(MUT, "open-brain");
const SV = "open-brain/src/server.ts", PSF = "open-brain/src/shared/process-session.ts";
const MUTANTS = [
  { id: "Q1-cached-at-first-use", why: "the proof read once, at the first attributed write, and kept for the server's life", edits: [
    [SV, "let _parentStart: { pid: number; start: string | null } | null = null;", "let _cachedProof: ProvenSession | null = null;\nlet _parentStart: { pid: number; start: string | null } | null = null;"],
    [SV, "  return proveSession(byPidDir(resolvePaths(process.cwd()).activeSession), parent, _parentStart.start);", "  return (_cachedProof ??= proveSession(byPidDir(resolvePaths(process.cwd()).activeSession), parent, _parentStart.start));"]] },
  { id: "Q2-claude-pid", why: "the server keys the proof on CLAUDE_PID (inherited) instead of process.ppid", edits: [
    [SV, "  const parent = process.ppid;", "  const parent = Number(process.env.CLAUDE_PID) || process.ppid;"]] },
  { id: "Q3-no-start-time", why: "the start-time comparison skipped (a reused pid is believed)", edits: [
    [PSF, "  if (proof.proc_start !== parentStart) {", "  if (false && proof.proc_start !== parentStart) {"]] },
  { id: "Q4-slot-adoption", why: "with no proof, the per-project slot is adopted again", edits: [
    [SV, 'import { byPidDir, processStartTime, proveSession, type ProvenSession } from "./shared/process-session.js";',
      'import { byPidDir, processStartTime, proveSession, type ProvenSession } from "./shared/process-session.js";\nimport { readActiveSession as _ras, activeSessionKey as _ask, currentIde as _ci } from "./shared/active-session.js";'],
    [SV, "  return proveSession(byPidDir(resolvePaths(process.cwd()).activeSession), parent, _parentStart.start);",
      "  const _p = proveSession(byPidDir(resolvePaths(process.cwd()).activeSession), parent, _parentStart.start);\n  if (_p.id !== null) return _p;\n  const _cwd = process.cwd();\n  const _slot = _ras(resolvePaths(_cwd).activeSession, _ask(canonicalizeProjectDir(_cwd) || _cwd, _ci()));\n  return _slot ? { id: _slot.uuid, pid: parent } : _p;"]] },
  { id: "Q5-claims-unchecked", why: "attributedSession accepts a named id that differs from the proof (ob_end, ob_store_chunk)", edits: [
    [SV, "  if (claim && claim !== proven.id) {\n    return { id: null, refusal:", "  if (claim && claim !== proven.id && claim === \"qa142-never-a-session-id\") {\n    return { id: null, refusal:"]] },
];

const sh = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: OB, encoding: "utf8", shell: process.platform === "win32", timeout: 900_000, ...opts });
const restore = () => { execFileSync("git", ["checkout", "--", "open-brain/src"], { cwd: MUT }); };
const build = () => { const r = sh("npm", ["run", "build"]); return r.status === 0 ? "ok" : `BUILD FAILED ${r.stdout.slice(-400)}${r.stderr.slice(-400)}`; };
const vitest = () => {
  const r = sh("npx", ["vitest", "run", "tests/t003-session-proof.test.ts", "tests/server.test.ts", "tests/active-session.test.ts"]);
  const out = (r.stdout || "") + (r.stderr || "");
  const tests = (out.match(/Tests\s+([^\n]+)/) || [])[1] ?? "?";
  const failed = [...out.matchAll(/(?:FAIL|×|✗)\s+([^\n]+)/g)].map((m) => m[1].trim()).filter((l) => !/^tests\/[\w.-]+\.ts\s*$/.test(l)).slice(0, 8);
  return { rc: r.status, tests: tests.trim(), failed };
};
const probe = (script, dir, label) => {
  mkdirSync(join(S, dir), { recursive: true });
  if (script === "c1-t003.mjs") { rmSync(join(S, dir, "c1-proj"), { recursive: true, force: true }); cpSync(join(S, "s1", "live-rev132.json"), join(S, dir, "live-rev132.json")); }
  const r = spawnSync("node", [join(SCRIPTS, script), MUT, join(S, dir), label], { encoding: "utf8", timeout: 900_000 });
  const out = r.stdout + r.stderr;
  return { summary: (out.match(/(\d+) BROKEN\s*$/m) || [])[0] ?? `no summary (rc ${r.status}; last stderr: ${r.stderr.trim().split("\n").slice(-3).join(" | ").slice(0, 300)})`, broken: out.split("\n").filter((l) => l.startsWith("BROKEN")).map((l) => l.slice(8).trim()) };
};

// Baseline on the unmutated tree first: which probe rows are already BROKEN (so a mutant is judged by NEW breaks).
const results = [];
const base = {};
{
  console.log(`# baseline (unmutated 706c029): build ${build()}`);
  for (const [s, d] of [["c1-t003.mjs", "m-c1"], ["c2-stdio.mjs", "m-c2"], ["c4-hooks.mjs", "m-c4"]]) {
    base[s] = probe(s, d, "mut-baseline"); console.log(`  ${s}: ${base[s].summary}`);
  }
  const v = vitest(); console.log(`  vitest (3 files): rc ${v.rc}, ${v.tests}`);
}
for (const m of MUTANTS.filter((x) => !ONLY || ONLY.split(",").includes(x.id.split("-")[0]))) {
  let line = `## ${m.id}: ${m.why}\n`;
  try {
    for (const [file, from, to] of m.edits) {
      const p = join(MUT, file); const src = readFileSync(p, "utf8");
      const count = src.split(from).length - 1;
      if (count !== 1) throw new Error(`site occurs ${count} times in ${file}: ${from.slice(0, 60)}`);
      writeFileSync(p, src.replace(from, to));
      if (!readFileSync(p, "utf8").includes(to)) throw new Error("edit did not land");
    }
    const b = build();
    line += `  build+tsc: ${b}\n`;
    if (b !== "ok") { results.push({ id: m.id, verdict: "INVALID (does not build)" }); console.log(line); continue; }
    const v = vitest();
    line += `  Forge's rows (t003 + server + active-session): rc ${v.rc}, ${v.tests}${v.failed.length ? "\n    failing: " + v.failed.join("\n    failing: ") : ""}\n`;
    const newBreaks = [];
    for (const [s, d] of [["c1-t003.mjs", "m-c1"], ["c2-stdio.mjs", "m-c2"], ["c4-hooks.mjs", "m-c4"]]) {
      const r = probe(s, d, m.id);
      const fresh = r.broken.filter((b) => !base[s].broken.includes(b));
      newBreaks.push(...fresh.map((f) => `${s}: ${f}`));
      line += `  ${s}: ${r.summary}${fresh.length ? " — NEW: " + fresh.join(" || ") : ""}\n`;
    }
    const killed = v.rc !== 0 || newBreaks.length > 0;
    results.push({ id: m.id, verdict: killed ? `KILLED (${v.rc !== 0 ? "Forge rows" : ""}${v.rc !== 0 && newBreaks.length ? " + " : ""}${newBreaks.length ? `QA probes x${newBreaks.length}` : ""})` : "SURVIVED" });
  } catch (e) {
    line += `  INVALID: ${e.message}\n`; results.push({ id: m.id, verdict: "INVALID" });
  } finally {
    restore();
  }
  console.log(line);
}
console.log(`# restored: build ${build()}; git diff --stat: '${execFileSync("git", ["diff", "--stat"], { cwd: MUT, encoding: "utf8" }).trim()}'`);
for (const r of results) console.log(`${r.id}: ${r.verdict}`);
