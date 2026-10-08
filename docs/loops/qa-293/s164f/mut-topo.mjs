// QA 293 row 2: each r4 mutant is one commit on the head 09a31303; show its parent, files and the src diff.
// Adapted from QA 292's docs/loops/qa-292/s164e/mut-topo.mjs (constants for r4; the merge-tree step is gone because the
// mutants sit on the merged head itself).
import { execFileSync } from "node:child_process";
const g = (...a) => execFileSync("git", ["-C", "C:/qa-scratch/qa293-wt", ...a], { encoding: "utf8", maxBuffer: 64 << 20 }).trim();
const HEAD = "09a31303416f8e191b08adfed5953a83d77d4fd5";
const M = ["end-fix-mut-r4-revision", "end-fix-mut-r4-m1", "end-fix-mut-r4-m2"];
g("fetch", "-q", "origin", ...M.map((m) => `+refs/heads/loop/${m}:refs/remotes/origin/loop/${m}`));
for (const name of M) {
  const sha = g("rev-parse", `origin/loop/${name}`);
  const parents = g("rev-list", "--parents", "-n1", sha).split(" ").slice(1);
  console.log(`=== ${name} ${sha} parents=${parents.map((x) => x.slice(0, 8)).join(",")} parent==head:${parents.length === 1 && parents[0] === HEAD}`);
  console.log("    files: " + g("diff", "--name-only", parents[0], sha).split("\n").join(", "));
  console.log(g("diff", "-U1", parents[0], sha, "--", "open-brain/src").split("\n").filter((l) => /^[-+@]/.test(l) && !/^(\+\+\+|---)/.test(l)).join("\n"));
}
