// QA 241: copy QA 237's scripts (origin/qa/t194-r5-report, 1a658b39) into qa-241/qa237/, re-pointing every
// C:/qa-scratch/qa237-* path to C:/qa-scratch/qa241-q237-* so that this QA writes only under qa241-*. No other change.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REF = "1a658b3980eb7d56bbbe0ff4bd41db12d3259264";
const OUT = "C:/qa-scratch/qa241-wt/docs/loops/qa-241/qa237";
const FILES = ["lib.mjs", "gen-p1.mjs", "gen-p2.mjs", "gen-p2b.mjs", "gen-p3.mjs", "probe-holes.mjs", "probe-holes2.mjs",
  "probe-merge-async.mjs", "probe-comma.mjs", "fail-closed.mjs", "shell-truth.mjs", "truth-check.mjs"];
mkdirSync(OUT, { recursive: true });
const changed = [];
for (const f of FILES) {
  const src = execFileSync("git", ["-C", "C:/qa-scratch/qa241-wt", "show", `${REF}:docs/loops/qa-237/${f}`], { encoding: "utf8" });
  const dst = src.replaceAll("C:/qa-scratch/qa237-", "C:/qa-scratch/qa241-q237-").replaceAll("C:/qa-tmp/qa237-", "C:/qa-tmp/qa241-q237-");
  writeFileSync(join(OUT, f), dst);
  changed.push({ f, lines: src.split("\n").filter((l, i) => l !== dst.split("\n")[i]).length });
}
console.log(JSON.stringify(changed));
