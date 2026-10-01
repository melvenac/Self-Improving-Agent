// QA 240: S4-5b, S4-9.1, S4-9.2, S4-8.3 by own scan of `git diff 2448a6ea 2d4cd863` (committed trees only).
import { execFileSync } from "node:child_process";
const R = "/home/agents/qa-scratch/qa240-cand";
const git = (...a) => execFileSync("git", ["-C", R, ...a], { encoding: "utf8", maxBuffer: 1 << 28 });
const BASE = "2448a6ea", CAND = "2d4cd863";
const added = (...paths) => {
  const out = []; let file = "";
  for (const l of git("diff", "--unified=0", BASE, CAND, "--", ...paths).split("\n")) {
    if (l.startsWith("+++ ")) file = l.slice(6);
    else if (l.startsWith("+")) out.push({ file, text: l.slice(1) });
  }
  return out;
};
const all = added(".");
const word = new RegExp("\\bcalibrat" + "ed\\b", "i");
const excl = ["docs/loops/loop-15-slice-4-brief.md", "docs/loops/loop-15-slice-4-brief-draft.md", "docs/loops/loop-15-slice-4-brief.D_t.json", ".agents/state.json", "docs/loops/loop-15-slice-4-criteria.md"];
const w = all.filter((x) => !excl.includes(x.file) && word.test(x.text));
console.log(`S4-5b: ${all.length} added lines scanned; whole-word hits: ${w.length}`);
// known positive for my scan
console.log(`S4-5b known positive: ${word.test("NOT " + "CALIBRAT" + "ED here")} / negative: ${word.test("miscalibration")}`);
const src = added("open-brain/src");
const jm = src.filter((x) => new RegExp("jev-" + "mcp|mcp__" + "jev").test(x.text));
console.log(`S4-9.1: ${src.length} added src lines; jev-mcp hits: ${jm.length}`);
const tests = added("open-brain/tests");
const skipRe = new RegExp("\\.(sk" + "ip|to" + "do)\\b|sk" + "ipIf|run" + "If");
const sk = tests.filter((x) => skipRe.test(x.text));
console.log(`S4-9.2: ${tests.length} added test lines; skip/todo/skipIf/runIf matches: ${sk.length}`);
for (const s of sk) console.log(`   ${s.file}: ${s.text.trim().slice(0, 140)}`);
// does any match occur in an actual call position (it.skip / describe.skip / test.todo / .skipIf( / .runIf( )?
const call = new RegExp("\\b(it|test|describe)\\.(sk" + "ip|to" + "do|sk" + "ipIf|run" + "If)\\b");
console.log(`S4-9.2 call-position matches: ${sk.filter((x) => call.test(x.text)).length}`);
console.log(`S4-9.2 deleted test files: ${JSON.stringify(git("diff", "--diff-filter=D", "--name-only", BASE, CAND, "--", "open-brain/tests").trim())}`);
console.log(`S4-9.2 modified test files: ${JSON.stringify(git("diff", "--diff-filter=M", "--name-only", BASE, CAND, "--", "open-brain/tests").trim())}`);
const count = (t) => (t.match(/^\s*(?:it|test)(?:\.each\([^)]*\))?\(/gm) ?? []).length;
for (const f of git("diff", "--diff-filter=M", "--name-only", BASE, CAND, "--", "open-brain/tests").trim().split("\n").filter(Boolean)) {
  console.log(`   ${f}: tests ${count(git("show", `${BASE}:${f}`))} -> ${count(git("show", `${CAND}:${f}`))}`);
}
const ext = (t) => { const s = t.indexOf("export const LOOP_LIMITS ="); const e = t.indexOf("guarantees depend on each other.\";", s); return t.slice(s, e); };
const a = ext(git("show", `${BASE}:open-brain/src/harness/runtime.ts`)), b = ext(git("show", `${CAND}:open-brain/src/harness/runtime.ts`));
console.log(`S4-8.3: LOOP_LIMITS ${a.length} chars at base; identical at candidate: ${a === b}`);
console.log(`S4-8.1: 3b192871 ancestor of candidate: ${(() => { try { git("merge-base", "--is-ancestor", "3b192871", CAND); return true; } catch { return false; } })()}`);
