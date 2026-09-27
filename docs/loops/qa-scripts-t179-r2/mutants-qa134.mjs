// QA 134 mutants on candidate 1646567. Each mutant is a set of anchored substitutions; each anchor must match
// EXACTLY once, the diff must be non-empty, `tsc --noEmit -p .` must exit 0, then the named test files run locally.
// Sources are restored (and hash-checked) after each. With --commit <name>, the one mutant is applied and left in
// place for a commit on qa/t179-r2-mut-<name> (no tests run).
// usage: node mutants-qa134.mjs <mut-worktree-root> [--commit <name>]
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const [ROOT, flag, only0] = process.argv.slice(2);
const only = flag === "--only" || flag === "--commit" ? only0 : undefined;
const OB = join(ROOT, "open-brain");
const F = {
  writer: "src/shared/state-writer.ts",
  schema: "src/shared/state-schema.ts",
  views: "src/pipelines/state-views/index.ts",
  server: "src/server.ts",
  erasure: "src/pipelines/sync/record-erasure.ts",
};
const MUTANTS = [
  { name: "firstrev-caller", what: "first_rev taken from the caller's session number (dispatch)",
    subs: [[F.writer, "const firstRev = mine?.first_rev ?? before + 1;", "const firstRev = mine?.first_rev ?? options.session;"]] },
  { name: "last-by-n", what: "lastSession() by the session NUMBER again (dispatch: one of lastSession/retention/done)",
    subs: [[F.schema, "for (const s of state.sessions) if (best === null || compareFirstRev(s.first_rev, best.first_rev) >= 0) best = s;",
      "for (const s of state.sessions) if (best === null || s.n >= best.n) best = s;"]] },
  { name: "done-by-n", what: "done-task retention by NUMBER again: closed_session <= newest n - 3 (dispatch: done-task retention)",
    subs: [[F.views, "const since = sessionFirstRevs.filter((r) => compareFirstRev(r, t.closed_rev) > 0).length;\n  return since >= DONE_RETENTION_SESSIONS;",
      "return t.closed_session !== null && t.closed_session <= Math.max(-1, ...sessionFirstRevs.map((r) => r ?? -1)) - DONE_RETENTION_SESSIONS;"],
      [F.writer, "const revs = s.sessions.map((x) => x.first_rev);\n  s.tasks = s.tasks.filter(", "const revs = s.sessions.map((x) => x.n);\n  s.tasks = s.tasks.filter("]] },
  { name: "checkout-refusal-off", what: "R179-2's different-checkout refusal skipped (dispatch)",
    // Re-anchored after a VOID first try (`false && rec …` left `rec` possibly undefined in the body: tsc exit 2).
    // The lookup now only finds a record of THIS checkout, so the refusal can never fire.
    subs: [[F.server, "const rec = st.data.sessions.find((x) => x.uuid === session_id);", "const rec = st.data.sessions.find((x) => x.uuid === session_id && x.checkout === here);"]] },
  { name: "closed-rev-firstrev", what: "close_task records the closing SESSION's first-write revision, not the closing write's",
    subs: [[F.writer, "t.closed_rev = ctx.rev;", "t.closed_rev = ctx.firstRev;"]] },
  { name: "erasure-legacy-session", what: "record-erasure explains the removal of a legacy SESSION record as R179-3 (only handoffs yield)",
    subs: [[F.erasure, "return isSuperseded(entry, all, revs, r.kind === \"handoff\");", "return isSuperseded(entry, all, revs, true);"]] },
];
const TESTS = ["tests/shared/session-order.test.ts", "tests/shared/state-writer.test.ts", "tests/shared/state-schema.test.ts",
  "tests/shared/closeout-erasure.test.ts", "tests/pipelines/sync/record-erasure.test.ts", "tests/pipelines/state-views.test.ts",
  "tests/server.test.ts", "tests/pipelines/state-migrate.test.ts", "tests/pipelines/state-import.test.ts", "tests/pipelines/state-import-v3.test.ts",
  "tests/setup-hooks.test.ts", "tests/pipelines/sync/checks-state.test.ts"];

const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const apply = (m) => {
  const saved = new Map();
  for (const [rel, from, to] of m.subs) {
    const p = join(OB, rel);
    const src = saved.has(p) ? readFileSync(p, "utf8") : (saved.set(p, { text: readFileSync(p, "utf8"), sha: sha(p) }), readFileSync(p, "utf8"));
    const count = src.split(from).length - 1;
    if (count !== 1) { restore(saved); throw new Error(`${m.name}: anchor in ${rel} matched ${count} times`); }
    writeFileSync(p, src.replace(from, to));
  }
  return saved;
};
function restore(saved) { for (const [p, v] of saved) writeFileSync(p, v.text); return [...saved].every(([p, v]) => sha(p) === v.sha); }

if (flag === "--commit") {
  const m = MUTANTS.find((x) => x.name === only);
  apply(m);
  console.log(execFileSync("git", ["diff", "--stat"], { cwd: ROOT, encoding: "utf8" }));
  process.exit(0);
}
const summary = [];
for (const m of MUTANTS.filter((x) => !only || x.name === only)) {
  const saved = apply(m);
  const diff = execFileSync("git", ["diff"], { cwd: ROOT, encoding: "utf8" });
  const tsc = spawnSync("npx", ["tsc", "--noEmit", "-p", "."], { cwd: OB, encoding: "utf8", shell: true });
  let red = null, out = "";
  if (tsc.status === 0 && diff.length > 0) {
    const t = spawnSync("npx", ["vitest", "run", ...TESTS], { cwd: OB, encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" } });
    out = ((t.stdout || "") + (t.stderr || "")).replace(new RegExp(String.fromCharCode(27) + "[[][0-9;]*m", "g"), "");
    const failed = out.match(/Tests\s+(\d+) failed/);
    const passed = out.match(/Tests\s+(\d+ failed \| )?(\d+) passed/);
    red = failed ? Number(failed[1]) : passed ? 0 : null; // null: no summary line, so the run is VOID, not a survivor
    const fails = [...new Set(out.split("\n").filter((l) => /^\s*(×|FAIL)\s/.test(l)).map((l) => l.trim().slice(0, 200)))];
    console.log(`\n=== ${m.name}: ${m.what}\n  diff lines ${diff.split("\n").filter((l) => /^[+-][^+-]/.test(l)).length}; tsc ${tsc.status}; ${red === null ? "VOID (no test summary)" : red === 0 ? "SURVIVED (0 red)" : `KILLED: ${red} red`}\n  ${out.split("\n").filter((l) => /Test Files|Tests\s/.test(l)).join(" | ").trim()}`);
    for (const f of fails.slice(0, 20)) console.log("    " + f);
  } else {
    console.log(`\n=== ${m.name}: VOID (tsc ${tsc.status}, diff ${diff.length})\n${(tsc.stdout || "").slice(0, 800)}`);
  }
  const restored = restore(saved);
  summary.push({ name: m.name, tsc: tsc.status, red, restored });
}
console.log("\n" + JSON.stringify(summary));
