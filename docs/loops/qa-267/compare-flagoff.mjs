// QA 267: compare the probe's ob_start outputs, master tree vs candidate trees, after masking the three
// lines that carry the environment (the tree's own path, the test process's pid and temp dir, and the
// token estimate, which counts the path's length). Word counts are kept: they do not depend on the path.
// Usage: node compare-flagoff.mjs <out dir> <base tree> <candidate tree>...
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const [out, base, ...cands] = process.argv.slice(2);
const CASES = ["sia-absent", "sia-false", "a2a-absent", "a2a-false"];
const norm = (tree, text) => text
  .split(`/home/agents/qa-scratch/${tree}/`).join("TREE/")
  .replace(/^Session ID: none .*$/m, "SESSION-LINE")
  .replace(/^(Total returned words: \d+) .*$/m, "$1");
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
let bad = 0;
for (const c of CASES) {
  const b = norm(base, readFileSync(join(out, base, `${c}.txt`), "utf8"));
  for (const t of cands) {
    const x = norm(t, readFileSync(join(out, t, `${c}.txt`), "utf8"));
    const same = b === x;
    if (!same) bad++;
    console.log(`${same ? "IDENTICAL" : "DIFFERENT"} ${c}: ${base} ${sha(b)} vs ${t} ${sha(x)} (${Buffer.byteLength(x)} bytes normalized)`);
  }
}
process.exit(bad ? 1 : 0);
