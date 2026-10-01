// QA 240: files the builder edited BEFORE the reconstruction commit (2448a6ea..1da79279^), intersected
// with each diff's touched files. A file the builder edited, it had read.
import { execFileSync } from "node:child_process";
const R = "/home/agents/qa-scratch/qa240-cand";
const git = (...a) => execFileSync("git", ["-C", R, ...a], { encoding: "utf8" }).trim();
const edited = new Set(git("diff", "--name-only", "2448a6ea", "1da79279^").split("\n").filter(Boolean));
console.log(`builder edited before 1da79279: ${[...edited].join(", ")}`);
const diffs = [["677c1dd5", 182], ["7640b935", 165], ["c9a7acc1", 187], ["ddd43526", 195], ["7fcbfa0e", 209], ["c1296f2b", 227], ["066ed8ca", 220], ["d5dfa745", 218]];
for (const [c, p] of diffs) {
  const t = git("diff", "--name-only", `${c}^1`, c).split("\n").filter(Boolean);
  const both = t.filter((f) => edited.has(f));
  console.log(`#${p}: ${t.length} files; overlap with builder's pre-G4 edits: ${both.join(", ") || "none"}`);
}
