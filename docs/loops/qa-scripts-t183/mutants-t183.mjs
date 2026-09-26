#!/usr/bin/env node
// QA 114 (T-183): mutants, the developer's four and this seat's own, run in a scratch worktree at 0f0e7ad.
//
// Each mutant: apply (a single exact match is asserted, and the file must change), `npx tsc --noEmit -p .`,
// then vitest on the named test files with the JSON reporter, read per test. The file is restored with
// `git checkout` in a finally, and the worktree is asserted clean at the end.
// The developer's mutants are applied by taking the mutated file from their branch (`git show`), after
// asserting that branch differs from 0f0e7ad in that one file only.
//
// Usage: node mutants-t183.mjs <worktree-at-0f0e7ad> [id ...]
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const wt = process.argv[2];
const only = new Set(process.argv.slice(3));
const ob = join(wt, "open-brain");
const git = (...a) => execFileSync("git", ["-C", wt, ...a], { encoding: "utf8" }).trim();
const RENDER = "open-brain/src/pipelines/session-start/state-render.ts";
const CHECKS = "open-brain/src/pipelines/sync/checks.ts";
const INDEX = "open-brain/src/pipelines/sync/index.ts";
const T_RENDER = "tests/pipelines/session-start/state-render.test.ts";
const T_SIZE = "tests/pipelines/sync/greeting-size.test.ts";
const T_BOTH = [T_RENDER, T_SIZE];
const T_WIDE = [T_RENDER, T_SIZE, "tests/pipelines/sync", "tests/server.test.ts"];

const mutants = [
  // The developer's, from their branches.
  { id: "dev-i-marker", branch: "origin/loop/t183-mut-i-marker", file: RENDER, tests: T_BOTH },
  { id: "dev-ii-verbatim", branch: "origin/loop/t183-mut-ii-verbatim", file: RENDER, tests: T_BOTH },
  { id: "dev-iii-threshold", branch: "origin/loop/t183-mut-iii-threshold", file: CHECKS, tests: T_BOTH },
  { id: "dev-iv-omission", branch: "origin/loop/t183-mut-iv-omission", file: RENDER, tests: T_BOTH },
  // This seat's own.
  { id: "q1-reopened-dropped", file: RENDER, find: `newest.has(v) || v.status === "reopened"`, repl: `newest.has(v)`, tests: T_BOTH,
    why: "a reopened claim older than the newest 10 is no longer shown" },
  { id: "q2-oldest-ten", file: RENDER, find: `state.verified.slice(-VERIFIED_SHOWN)`, repl: `state.verified.slice(0, VERIFIED_SHOWN)`, tests: T_BOTH,
    why: "the OLDEST ten are shown instead of the newest" },
  { id: "q3-marker-length-of-cut", file: RENDER, find: "return `${cut}… (${text.length} chars;", repl: "return `${cut}… (${cut.length} chars;", tests: T_BOTH,
    why: "the marker states the cut's length, not the full length" },
  { id: "q4-multiline-short-whole", file: RENDER, find: "if (text.length <= limit && !/[\\r\\n]/.test(text)) return text;", repl: "if (text.length <= limit) return text;", tests: T_BOTH,
    why: "a short multi-line text is printed whole, breaking the one-line rule" },
  { id: "q5-no-sentence-cut", file: RENDER, find: "const end = /[.!?](?=\\s)|[\\r\\n]/.exec(head);", repl: "const end = /[\\r\\n]/.exec(head);", tests: T_BOTH,
    why: "the first-sentence rule is gone: cut only at the limit or a line break" },
  { id: "q6-omission-count-assumes-ten", file: RENDER, find: "const omitted = state.verified.length - shown.length;", repl: "const omitted = state.verified.length - VERIFIED_SHOWN;", tests: T_BOTH,
    why: "the omission count ignores the reopened claims shown beyond the ten" },
  { id: "q7-omission-command-wrong", file: RENDER, find: `"node open-brain/build/cli.js state show --json"`, repl: `"node open-brain/build/cli.js state show"`, tests: T_BOTH,
    why: "the omission line names the command that prints only the count" },
  { id: "q8-open-questions-clipped", file: RENDER, find: "for (const q of h.open_questions) lines.push(`    - ${q}`);", repl: "for (const q of h.open_questions) lines.push(`    - ${clip(q, GAP_CLIP, \"handoff\")}`);", tests: T_BOTH,
    why: "open questions clipped (the developer's mutant ii covers watch-outs only)" },
  { id: "q9-pickup-clipped", file: RENDER, find: "lines.push(`  pick up: ${h.pick_up}`);", repl: "lines.push(`  pick up: ${clip(h.pick_up, GAP_CLIP, \"handoff\")}`);", tests: T_BOTH,
    why: "the own handoff's pick-up clipped" },
  { id: "q10-loopstate-rulings-clipped", file: RENDER, find: "for (const r of ls.rulings) lines.push(`      - ${r}`);", repl: "for (const r of ls.rulings) lines.push(`      - ${clip(r, GAP_CLIP, \"handoff\")}`);", tests: T_BOTH,
    why: "loop-state rulings clipped (brief §2.3: the loop state unchanged)" },
  { id: "q11-threshold-inclusive", file: CHECKS, find: "return n > limit", repl: "return n >= limit", tests: T_BOTH,
    why: "boundary: exactly 40,000 becomes an ISSUE" },
  { id: "q12-role-files-not-composed", file: CHECKS, find: "const text = [treeAndSeat, state, roleFiles].join(\"\\n\");", repl: "const text = [treeAndSeat, state].join(\"\\n\");", tests: T_BOTH,
    why: "greeting-size stops counting the role files (a fifth of the greeting)" },
  { id: "q13-state-not-composed", file: CHECKS, find: "const text = [treeAndSeat, state, roleFiles].join(\"\\n\");", repl: "const text = [treeAndSeat, roleFiles].join(\"\\n\");", tests: T_BOTH,
    why: "greeting-size stops counting the state render" },
  // First run used "warning", which tsc rejected (CheckSeverity is "warn"): this seat's error, rerun as q14b.
  { id: "q14b-severity-warn", file: CHECKS, find: "{ name, severity: \"issue\", message: `greeting is ${n} characters, over", repl: "{ name, severity: \"warn\", message: `greeting is ${n} characters, over", tests: T_BOTH,
    why: "over the limit reported as a warning, not an ISSUE" },
  { id: "q18-other-seats-line-shortened", file: RENDER, find: "return line.length > 160 ? `${line.slice(0, 157)}...` : line", repl: "return line.length > 60 ? `${line.slice(0, 57)}...` : line", tests: T_BOTH,
    why: "the other seats' lines shortened (brief §2.3: unchanged)" },
  { id: "q19-questions-for-aaron-clipped", file: RENDER, find: "for (const q of ls.questions_for_aaron) lines.push(`      - ${q}`);", repl: "for (const q of ls.questions_for_aaron) lines.push(`      - ${clip(q, GAP_CLIP, \"handoff\")}`);", tests: T_BOTH,
    why: "loop-state questions for Aaron clipped (brief §2.3: the loop state unchanged)" },
  { id: "q20-tasks-dropped-blocked", file: RENDER, find: "const active = state.tasks.filter((t) => t.status !== \"done\");", repl: "const active = state.tasks.filter((t) => t.status !== \"done\" && t.status !== \"blocked\");", tests: T_BOTH,
    why: "blocked tasks silently dropped from the task list (brief §2.3: tasks unchanged)" },
  { id: "q15-not-wired", file: INDEX, find: "  checks.push(checkGreetingSize(version, options.projectRoot));\n", repl: "", tests: T_WIDE,
    why: "greeting-size is never run by /sync" },
  { id: "q16-seat-ignored-in-compose", file: CHECKS, find: "seat: seat?.success ? seat.data : null,", repl: "seat: null,", tests: T_BOTH,
    why: "greeting-size renders every handoff as the unresolved reader, not this seat's" },
  { id: "q17-gaps-unclipped", file: RENDER, find: "lines.push(`  ${g.id} — ${clip(g.what, GAP_CLIP, `gaps[${g.id}]`)} (opened", repl: "lines.push(`  ${g.id} — ${g.what} (opened", tests: T_BOTH,
    why: "gaps printed whole again (the base behaviour)" },
];

const vitest = (tests) => {
  const outFile = join(process.env.TEMP ?? "C:\\qa-tmp", `qa114-vitest-${process.pid}.json`);
  const r = spawnSync("npx", ["vitest", "run", ...tests, "--reporter=json", `--outputFile=${outFile}`], { cwd: ob, encoding: "utf8", shell: true, maxBuffer: 1 << 28 });
  let j = null; try { j = JSON.parse(readFileSync(outFile, "utf8")); rmSync(outFile); } catch {}
  if (!j) return { exit: r.status, error: (r.stderr || r.stdout).slice(-400) };
  const failed = j.testResults.flatMap((f) => f.assertionResults.filter((a) => a.status === "failed").map((a) => a.fullName));
  return { exit: r.status, passed: j.numPassedTests, failed: j.numFailedTests, total: j.numTotalTests, failedNames: failed };
};
const tsc = () => spawnSync("npx", ["tsc", "--noEmit", "-p", "."], { cwd: ob, encoding: "utf8", shell: true });

if (git("rev-parse", "HEAD") !== git("rev-parse", "0f0e7ad")) throw new Error("worktree is not at 0f0e7ad");
if (git("status", "--porcelain", "--untracked-files=no")) throw new Error("worktree not clean at start");

const results = [];
const control = vitest(T_WIDE);
results.push({ id: "control (unmutated, wide set)", ...control });
for (const m of mutants) {
  if (only.size && !only.has(m.id)) continue;
  const path = join(wt, m.file);
  const orig = readFileSync(path, "utf8");
  try {
    let mutated;
    if (m.branch) {
      const files = git("diff", "--name-only", "0f0e7ad", m.branch).split("\n");
      if (files.length !== 1 || files[0] !== m.file) throw new Error(`${m.branch} differs in ${files.join(",")}`);
      mutated = git("show", `${m.branch}:${m.file}`) + "\n";
      m.why = git("diff", "0f0e7ad", m.branch).split("\n").filter((l) => /^[+-][^+-]/.test(l)).join(" | ").slice(0, 300);
    } else {
      const count = orig.split(m.find).length - 1;
      if (count !== 1) throw new Error(`${m.id}: expected one match, found ${count}`);
      mutated = orig.replace(m.find, m.repl);
    }
    // Keep the original line endings: git show and the find strings are LF.
    if (orig.includes("\r\n") && !mutated.includes("\r\n")) mutated = mutated.replace(/\n/g, "\r\n");
    if (mutated === orig) throw new Error(`${m.id}: file unchanged`);
    writeFileSync(path, mutated);
    const t = tsc();
    const v = t.status === 0 ? vitest(m.tests) : null;
    const verdict = t.status !== 0 ? "tsc-rejected" : v.failed > 0 ? "KILLED" : v.error ? "ERROR" : "SURVIVED";
    results.push({ id: m.id, why: m.why, tsc: t.status, verdict, ...v });
  } catch (e) {
    results.push({ id: m.id, verdict: "NOT APPLIED", error: String(e.message ?? e) });
  } finally {
    writeFileSync(path, orig);
    execFileSync("git", ["-C", wt, "checkout", "--", m.file]);
  }
}
const dirty = git("status", "--porcelain", "--untracked-files=no");
console.log(JSON.stringify({ results, worktree_clean_after: dirty === "" }, null, 2));
