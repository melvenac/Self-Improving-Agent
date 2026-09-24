// node mf.mjs <probe> <label>... — QA 94. Machine findings + verdict fields + base notes per tree, normalised.
import { readFileSync } from "node:fs";
const [p, ...labels] = process.argv.slice(2);
const norm = (s) =>
  String(s)
    .replace(/C:\\\\?Users\\\\?melve\\\\?AppData\\\\?Local\\\\?Temp\\\\?/g, "%T%/")
    .replace(/qa\d+-[a-z]+(-[a-z]+)*-[A-Za-z0-9]{6}/g, "Q")
    .replace(/\\\\?/g, "/");
const VERD = ["victimHashesInRecord", "victimHashInRecord", "hookHashInRecord", "newFileHashesInRecord", "readThroughHardLink", "globalFindingsPerStage", "eachTargetOnceInDeveloperWithBothHashes", "outsideEqualsBasePlusRoleEdit", "exceptionTextInRecord"];
console.log(`## ${p}`);
for (const l of labels) {
  const R = JSON.parse(readFileSync(`p15-${l}.json`, "utf-8"))[p];
  const s = R.summary ?? {};
  const v = Object.fromEntries(VERD.filter((k) => R[k] !== undefined).map((k) => [k, R[k]]));
  console.log(`  ${l} status=${s.status} code=${s.code} verd=${JSON.stringify(v)}`);
  for (const f of s.machineFindings ?? []) console.log(`     mf[${f.stage}] ${f.scope} ${norm(f.path).split("/").slice(-2).join("/")}: ${norm(f.before)} -> ${norm(f.after)}`);
  for (const f of (s.findings ?? []).filter((x) => x.startsWith("machine config "))) console.log(`     note: ${norm(f).slice(0, 300)}`);
}
