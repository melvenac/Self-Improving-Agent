// QA 240: which of the files the builder says it read does each of the eight diffs touch?
import { execFileSync } from "node:child_process";
const R = "/home/agents/qa-scratch/qa240-cand";
const git = (...a) => execFileSync("git", ["-C", R, ...a], { encoding: "utf8" }).trim();
const files = ["brief-plan-gate.ts", "runtime.ts", "gate.ts", "schema.ts", "declared.ts", "policies.ts"].map((f) => `open-brain/src/harness/${f}`);
const diffs = [["677c1dd5", 182], ["7640b935", 165], ["c9a7acc1", 187], ["ddd43526", 195], ["7fcbfa0e", 209], ["c1296f2b", 227], ["066ed8ca", 220], ["d5dfa745", 218]];
for (const [c, p] of diffs) {
  const t = git("diff", "--name-only", `${c}^1`, c, "--", ...files).split("\n").filter(Boolean).map((f) => f.split("/").pop());
  console.log(`#${p} ${c}: ${t.join(", ") || "(none of the six)"}`);
}
for (const f of files) {
  try { git("cat-file", "-e", `2448a6ea:${f}`); console.log(`base has ${f}`); } catch { console.log(`base LACKS ${f}`); }
}
console.log(git("grep", "-n", "-E", "export const (EVIDENCE_LOOP_PATTERN|MergePolicySchema)", "2448a6ea", "--", "open-brain/src/harness"));
for (const [c, p] of diffs) {
  const d = git("diff", `${c}^1`, c, "--", ...files);
  const hits = ["EVIDENCE_LOOP_PATTERN", "MergePolicySchema", "declared"].filter((s) => d.includes(s));
  if (hits.length) console.log(`#${p} diff text mentions: ${hits.join(", ")}`);
}
// handoffs named by the map exist at base
for (const h of ["loop-15-slice-3-a13-developer-handoff.md", "loop-15-slice-3-b-step1-developer-handoff.md", "loop-15-slice-3-b2-developer-handoff.md", "loop-15-slice-3-c-r4-developer-handoff.md", "t195-developer-handoff.md", "t198-r2-developer-handoff.md", "t196-developer-handoff.md", "t158-developer-handoff.md"]) {
  try { git("cat-file", "-e", `2448a6ea:docs/loops/${h}`); console.log(`base has handoff ${h}`); } catch { console.log(`base LACKS handoff ${h}`); }
}
// the briefs named in reconstructed_from: blob at base == blob at candidate
for (const b of ["loop-15-slice-3-brief.md", "loop-15-slice-3-b-step1-brief.md", "loop-15-slice-3-b2-brief.md", "loop-15-slice-3-c-brief.md", "t194-t195-dispatch.md", "t198-presence-dispatch.md", "t196-t197-dispatch.md", "t158-t164-dispatch.md"]) {
  const a = git("rev-parse", `2448a6ea:docs/loops/${b}`), c = git("rev-parse", `2d4cd863:docs/loops/${b}`);
  console.log(`brief ${b}: base ${a.slice(0, 8)} cand ${c.slice(0, 8)} ${a === c ? "same" : "DIFFERENT"}`);
}
