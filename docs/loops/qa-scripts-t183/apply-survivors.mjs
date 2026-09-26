#!/usr/bin/env node
// QA 114 (T-183): apply every mutant that SURVIVED locally (q10, q11, q15, q16, q18, q19, q20) together, for
// one CI run of the FULL suite on tcm: does anything outside the two T-183 files catch any of them?
// Each edit asserts a single exact match. Usage: node apply-survivors.mjs <worktree-at-0f0e7ad> [--without-q20]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const wt = process.argv[2];
// --without-q20: drop q20 (killed on tcm by a pre-existing server.test.ts test, CI run 36209621699), to see the other six alone.
const withoutQ20 = process.argv.includes("--without-q20");
const R = "open-brain/src/pipelines/session-start/state-render.ts", C = "open-brain/src/pipelines/sync/checks.ts", I = "open-brain/src/pipelines/sync/index.ts";
const edits = [
  [R, "for (const r of ls.rulings) lines.push(`      - ${r}`);", "for (const r of ls.rulings) lines.push(`      - ${clip(r, GAP_CLIP, \"handoff\")}`);"],
  [C, "return n > limit", "return n >= limit"],
  [I, "  checks.push(checkGreetingSize(version, options.projectRoot));", ""],
  [C, "seat: seat?.success ? seat.data : null,", "seat: null,"],
  [R, "return line.length > 160 ? `${line.slice(0, 157)}...` : line", "return line.length > 60 ? `${line.slice(0, 57)}...` : line"],
  [R, "for (const q of ls.questions_for_aaron) lines.push(`      - ${q}`);", "for (const q of ls.questions_for_aaron) lines.push(`      - ${clip(q, GAP_CLIP, \"handoff\")}`);"],
  [R, "const active = state.tasks.filter((t) => t.status !== \"done\");", "const active = state.tasks.filter((t) => t.status !== \"done\" && t.status !== \"blocked\");"],
];
for (const [f, a, b] of withoutQ20 ? edits.slice(0, 6) : edits) {
  const p = join(wt, f); const s = readFileSync(p, "utf8");
  if (s.split(a).length !== 2) throw new Error(`no single match in ${f}: ${a}`);
  writeFileSync(p, s.replace(a, b));
}
console.log(`applied ${withoutQ20 ? 6 : edits.length} edits`);
