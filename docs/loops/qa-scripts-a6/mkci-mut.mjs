// node mkci-mut.mjs — QA 94. Writes mutated copies of configwatch.ts at A6 for CI branches (tsc runs in CI's build).
// Asserts each edit's count and reads the file back. No local tsc (a mutant run is in progress; no concurrent load).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const src = execFileSync("git", ["-C", "C:/Users/melve/Worktrees/sia-qa", "show", "dc35b24:open-brain/src/harness/configwatch.ts"], { encoding: "utf-8" });
const TYPE = '    if (gate && lexical.kind === "symlink" && gate.lexicalKind !== "symlink") {\n      return { ...note, reason: "type change" };\n    }\n';
const DIFF = '    if (!same) return { ...note, reason: "different file" };\n';
const M = {
  // R29's protection in its strongest form: the read through a planted link to a mode-000 victim IS attempted.
  "M-R29-attempt6": [[TYPE, ""], [DIFF, ""]],
  // CA-15 clause 4 (kept by R60): a link planted AT the watched path is a type change.
  "M-typechange6": [[TYPE, ""]],
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
  console.log(`${name}: ${edits.length} edit(s) landed; read back equal ${back === s}; differs from A6 ${back !== src}; bytes ${src.length}->${back.length}`);
}
