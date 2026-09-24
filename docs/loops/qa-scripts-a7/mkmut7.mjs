// node mkmut7.mjs — QA 96. Writes mutated copies of configwatch.ts at A7 d223d1d for CI branches.
// Asserts each edit's count BEFORE applying, reads the file back, and prints the byte delta. tsc runs in CI's build step
// (and is also run locally on each copy before any branch is pushed).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const REPO = "C:/Users/melve/Worktrees/sia-qa";
const src = execFileSync("git", ["-C", REPO, "show", "d223d1d:open-brain/src/harness/configwatch.ts"], { encoding: "utf-8" });
const TYPE = '    if (gate && lexical.kind === "symlink" && gate.lexicalKind !== "symlink") {\n      return { ...note, reason: "type change" };\n    }\n';
const DIFF = '    if (!same) return { ...note, reason: "different file" };\n';
const SINGLE = '    const singleName = kind === "file" && nlink === 1 && gate !== null && gate.resolvedPath === resolvedPath;\n';
const SAME = '    const same = gate === null || (gate.resolvedPath === resolvedPath && (sameObject || singleName));\n';
const M = {
  // (a) R29: the gate reads through a link the role planted. Both guards that stop it (the at-path type change and
  // the realpath/object gate) removed, so the open of the planted link IS attempted.
  "M-R29-both": [[TYPE, ""], [DIFF, ""]],
  // R67 condition 1 alone: the realpath comparison removed from both halves of the gate; condition 2 kept.
  "M-R67-realpath": [
    [SINGLE, '    const singleName = kind === "file" && nlink === 1 && gate !== null;\n'],
    [SAME, "    const same = gate === null || sameObject || singleName;\n"],
  ],
  // (b) R67's protective direction: `nlink === 1` dropped, so ANY file at the same real path is read.
  "M-R67-nlink": [[SINGLE, '    const singleName = kind === "file" && gate !== null && gate.resolvedPath === resolvedPath;\n']],
};
for (const [name, edits] of Object.entries(M)) {
  let s = src;
  for (const [f, r] of edits) {
    const n = s.split(f).length - 1;
    if (n !== 1) { console.error(`${name}: expected 1, found ${n}`); process.exit(3); }
    s = s.split(f).join(r);
  }
  mkdirSync(`ci-mut/${name}`, { recursive: true });
  writeFileSync(`ci-mut/${name}/configwatch.ts`, s);
  const back = readFileSync(`ci-mut/${name}/configwatch.ts`, "utf-8");
  console.log(`${name}: ${edits.length} edit(s) landed; read back equal ${back === s}; differs from A7 ${back !== src}; bytes ${src.length}->${back.length}`);
}
