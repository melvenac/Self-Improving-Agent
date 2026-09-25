// node applic7.mjs — QA 96. For every spec in mutants-a7.mjs, count each edit's find text in A7 d223d1d's blobs.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
const S = process.cwd();
const { MUTANTS } = await import(pathToFileURL(`${S}/mutants-a7.mjs`).href);
const cache = {};
const blob = (f) => (cache[f] ??= execFileSync("git", ["-C", "C:/Users/melve/Worktrees/sia-qa", "show", `d223d1d:open-brain/${f}`], { encoding: "utf-8", maxBuffer: 1 << 26 }));
let ok = 0, no = 0;
for (const [name, spec] of Object.entries(MUTANTS)) {
  if (!Array.isArray(spec)) { console.log(`${name.padEnd(26)} PINNED ${spec.sha}`); continue; }
  const bad = spec.filter((e) => blob(e.file).split(e.find).length - 1 !== e.count).map((e) => `${e.file}:${blob(e.file).split(e.find).length - 1}/${e.count}`);
  if (bad.length) { no++; console.log(`${name.padEnd(26)} NOT APPLICABLE ${bad.join(" ")}`); } else ok++;
}
console.log(`applicable ${ok}, not applicable ${no}, total ${Object.keys(MUTANTS).length}`);
