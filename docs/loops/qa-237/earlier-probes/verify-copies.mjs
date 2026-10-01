// QA 237 re-run: check the probe scripts and recorded outputs copied by the first attempt are byte-identical to origin.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const G = (ref) => execFileSync("git", ["-C", "C:/qa-scratch/qa237-wt", "show", ref], { maxBuffer: 1e8 });
const D = "C:/qa-scratch/qa237-probes";
for (const [ref, f] of [
  ["origin/qa/t194-r2-report:docs/loops/qa-233/evidence/qa233-probe.mjs", "233-qa233-probe.mjs"],
  ["origin/qa/t194-r2-report:docs/loops/qa-233/evidence/probe-out.json", "233-probe-out.json"],
  ["origin/qa/t194-r3-report:docs/loops/qa-234/evidence/qa234-probe.mjs", "234-qa234-probe.mjs"],
  ["origin/qa/t194-r3-report:docs/loops/qa-234/evidence/qa234-probe2.mjs", "234-qa234-probe2.mjs"],
  ["origin/qa/t194-r3-report:docs/loops/qa-234/evidence/probe-cand-out.json", "234-probe-cand-out.json"],
  ["origin/qa/t194-r3-report:docs/loops/qa-234/evidence/probe2-cand-out.json", "234-probe2-cand-out.json"],
  ["e6e1d085:docs/loops/qa-235/evidence/qa235-probe.mjs", "235-qa235-probe.mjs"],
  ["e6e1d085:docs/loops/qa-235/evidence/probe-cand-out.json", "235-probe-cand-out.json"],
]) console.log(G(ref).equals(readFileSync(`${D}/${f}`)) ? "same" : "DIFF", f, "<-", ref);
