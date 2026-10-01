// QA 242: re-derive the r2 disclosure independently (QA 240's qa240-touch2 method, plus the named source files).
// For each of the eight merge commits: which of the files the handoff names does the PR touch, and which files had
// the builder edited before the reconstruction commit 1da79279 that the PR also touches.
import { execFileSync } from "node:child_process";
const R = process.argv[2];
const git = (...a) => execFileSync("git", ["-C", R, ...a], { encoding: "utf8" }).trim();
const edited = new Set(git("diff", "--name-only", "2448a6ea", "1da79279^").split("\n").filter(Boolean));
const named = ["runtime.ts", "schema.ts", "artifacts.ts", "gate.ts", "declared.ts", "cli.ts", "policies.ts", "brief-plan-gate.ts", "t195-plan-gate.test.ts"];
const diffs = [["677c1dd5", 182], ["7640b935", 165], ["c9a7acc1", 187], ["ddd43526", 195], ["7fcbfa0e", 209], ["c1296f2b", 227], ["066ed8ca", 220], ["d5dfa745", 218]];
for (const [c, p] of diffs) {
  const t = git("diff", "--name-only", `${c}^1`, c).split("\n").filter(Boolean);
  const hit = named.filter((n) => t.some((f) => f.endsWith(`/${n}`)));
  const both = t.filter((f) => edited.has(f)).map((f) => f.split("/").pop());
  console.log(`#${p} (${c}): named files touched: ${hit.join(", ") || "none"}; overlap with pre-1da79279 edits: ${both.join(", ") || "none"}`);
}
