// QA 237: gather the batch outputs into committed evidence files. Run from the working copy root.
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const r = (f) => JSON.parse(readFileSync(f, "utf8"));
const forge = [1, 2, 3, 4].flatMap((i) => r(`C:/qa-tmp/forge-b${i}.json`));
writeFileSync("docs/loops/qa-237/mutants-forge-out.json", JSON.stringify(forge, null, 1));
const qa = [...r("C:/qa-tmp/qa-m1.json"), ...r("C:/qa-tmp/qa-m2.json"), ...r("C:/qa-tmp/qa-m3b.json"),
  ...r("C:/qa-tmp/qa-m3.json").filter((x) => x.name === "qa-p3-comma-list-off")];
writeFileSync("docs/loops/qa-237/mutants-qa-out.json", JSON.stringify(qa, null, 1));
console.log("forge", forge.length, "killed", forge.filter((x) => x.killedByForgeTests).length, "tsc!=0", forge.filter((x) => x.typecheckExit !== 0).length);
for (const x of qa) console.log(x.name, x.killedByForgeTests, x.failedTests, JSON.stringify(x.qaGenerator ?? {}), x.typecheckExit);
const P = "C:/qa-scratch/qa237-probes";
const E = "docs/loops/qa-237/earlier-probes";
mkdirSync(E, { recursive: true });
for (const f of ["rerun.mjs", "compare.mjs", "verify-copies.mjs", "out233-cand2.json", "out234-cand2.txt", "out234b-cand2.json", "out235-cand2.json", "out235-cand2.txt"]) copyFileSync(`${P}/${f}`, `${E}/${f}`);
writeFileSync(`${E}/compare-cand2.txt`, execFileSync(process.execPath, [`${P}/compare.mjs`, "cand2"], { encoding: "utf8" }));
console.log("copied earlier-probe evidence");
