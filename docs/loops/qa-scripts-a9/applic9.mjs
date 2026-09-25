// node applic8.mjs — QA 104. For every spec in mutants-a8.mjs, count each edit's find text in A9 6bd97f2's blobs.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
const { MUTANTS, OWN_NAMES } = await import(pathToFileURL("C:/qa104/mutants-a9.mjs").href);
const REPO = "C:/Users/Aaron Melven/Worktrees/sia-qa";
const cache = {};
const blob = (f) => (cache[f] ??= execFileSync("git", ["-C", REPO, "show", `6bd97f2:open-brain/${f}`], { encoding: "utf-8", maxBuffer: 1 << 26 }));
let ok = 0, no = 0; const okNames = [];
for (const [name, spec] of Object.entries(MUTANTS)) {
  if (!Array.isArray(spec)) { console.log(`${name.padEnd(26)} PINNED ${spec.sha}`); continue; }
  const bad = spec.filter((e) => blob(e.file).split(e.find).length - 1 !== e.count).map((e) => `${e.file}:${blob(e.file).split(e.find).length - 1}/${e.count}`);
  if (bad.length) { no++; console.log(`${name.padEnd(26)} NOT APPLICABLE ${bad.join(" ")}`); } else { ok++; okNames.push(name); }
}
console.log(`applicable ${ok}, not applicable ${no}, total ${Object.keys(MUTANTS).length}; own ${OWN_NAMES.length}`);
console.log("APPLICABLE: " + okNames.join(" "));
