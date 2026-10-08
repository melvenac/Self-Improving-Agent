// QA 292 row 2: each mutant is one commit on ffe65478; show parent, files, the src diff; and check that the parent's
// open-brain/src equals the head's apart from master's changes (merge-tree(parent, master) src == head src).
// Adapted from QA 291's docs/loops/qa-291/s164d/mut-topo.mjs.
import { execFileSync } from "node:child_process";
const g = (...a) => execFileSync("git", ["-C", "C:/qa-scratch/qa292-wt", ...a], { encoding: "utf8", maxBuffer: 64 << 20 }).trim();
const HEAD = "854c6ced526e1e63f998bcafd8c1384068fb0c70";
const R3 = "ffe65478fa692addc2ea7d6e766b86c55baef7a6";
const MASTER = "1bbf2a5d4828ca88a09b93c1cd418e5ec663e5df";
const M = ["end-fix-mut-r3-hash", "end-fix-mut-r3-ids", "end-fix-mut-r3-state"];
g("fetch", "-q", "origin", ...M.map((m) => `+refs/heads/loop/${m}:refs/remotes/origin/loop/${m}`));
const headSrc = g("rev-parse", `${HEAD}:open-brain/src`);
for (const name of M) {
  const sha = g("rev-parse", `origin/loop/${name}`);
  const parents = g("rev-list", "--parents", "-n1", sha).split(" ").slice(1);
  const p = parents[0];
  let merged = "";
  try { merged = g("merge-tree", "--write-tree", p, MASTER).split("\n")[0]; } catch (e) { merged = String(e.stdout ?? "").split("\n")[0]; }
  const mergedSrc = g("rev-parse", `${merged}:open-brain/src`);
  console.log(`=== ${name} ${sha} parents=${parents.map((x) => x.slice(0, 8)).join(",")} parent==ffe65478:${p === R3}`);
  console.log(`    merge-tree(parent, master) src ${mergedSrc.slice(0, 12)} == head src ${headSrc.slice(0, 12)}: ${mergedSrc === headSrc}`);
  console.log("    files: " + g("diff", "--name-only", p, sha).split("\n").join(", "));
  console.log(g("diff", "-U1", p, sha, "--", "open-brain/src").split("\n").filter((l) => /^[-+@]/.test(l) && !/^(\+\+\+|---)/.test(l)).join("\n"));
}
