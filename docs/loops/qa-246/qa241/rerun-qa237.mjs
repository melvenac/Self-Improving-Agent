// QA 241: re-run QA 237's probes and generators, unmodified except for paths, against the r6 candidate's BUILT CLI.
// Sequential. Writes <name>-r6.json into qa-241/qa237-out/ and prints each script's summary.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";

const Q = "C:/qa-scratch/qa246-wt/docs/loops/qa-246/qa241/qa237";
const O = "C:/qa-scratch/qa246-wt/docs/loops/qa-246/qa241/qa237-out";
mkdirSync(O, { recursive: true });
const BUILD = process.env.QA241_BUILD ?? "C:/qa-scratch/qa246-cand/open-brain/build";
const env = { ...process.env, TEMP: "C:\\qa-tmp", TMP: "C:\\qa-tmp", QA237_BUILD: BUILD, QA237_FX: "C:/qa-scratch/qa246-rq237-fx" };
const only = process.argv.slice(2);
const runs = [
  ["gen-p1", []], ["gen-p2", []], ["gen-p2b", []], ["gen-p3", []], ["probe-holes", []], ["probe-holes2", []],
  ["probe-merge-async", []], ["fail-closed", []], ["probe-comma", [BUILD, "C:/qa-scratch/qa246-rq237-fx-comma"]],
];
for (const [name, extra] of runs) {
  if (only.length && !only.includes(name)) continue;
  const out = `${O}/${name}-r6.json`;
  const r = spawnSync(process.execPath, [`${Q}/${name}.mjs`, ...(extra.length ? extra : [out])], { cwd: Q, env, encoding: "utf8", maxBuffer: 1 << 28 });
  console.log(`== ${name} exit ${r.status}`);
  console.log((r.stdout + r.stderr).split("\n").slice(-12).join("\n"));
  if (!extra.length) {
    try {
      const j = JSON.parse(readFileSync(out, "utf8"));
      if (j.summary) console.log("summary", JSON.stringify(j.summary));
    } catch (e) { console.log("no json", String(e).slice(0, 100)); }
  }
}
