// node tabcmp.mjs <label>... — one line per probe per tree, verdict fields only. QA session 89.
import { readFileSync } from "node:fs";
const labels = process.argv.slice(2);
const J = Object.fromEntries(labels.map((l) => [l, JSON.parse(readFileSync(`p15-${l}.json`, "utf-8"))]));
const probes = Object.keys(J[labels[0]]).filter((k) => k !== "tree" && k !== "at");
const KEYS = [
  "isLoopRefused", "tags", "headUnmoved", "artifacts", "artifactsInRepo", "watchedPathAfter", "victimUnchanged", "asideUnchanged",
  "readThroughHardLink", "victimBytesUnchanged", "victimNlinkAfter", "victimHashesInRecord", "victimHashInRecord",
  "nlinkAtBase", "outsideUnchanged", "outsideEqualsBase", "outsideEqualsBasePlusRoleEdit", "nlinkAfter", "watchedEqualsBase",
  "exceptionTextInRecord", "hookHashInRecord", "hookAfter", "newFileHashesInRecord", "globalFindingsPerStage",
  "eachTargetOnceInDeveloperWithBothHashes", "notRestored", "victimConfigUnchangedExceptQaEdit", "gitDirInfoAtBase",
];
for (const p of probes) {
  console.log(`\n## ${p}`);
  for (const l of labels) {
    const R = J[l][p] ?? {};
    const s = R.summary ?? {};
    const o = {};
    if (R.probeError) o.probeError = String(R.probeError).slice(0, 300);
    o.status = s.status ?? R.status ?? null;
    o.code = s.code ?? R.code ?? null;
    const st = s.stage ?? R.stage; if (st) o.stage = st;
    if (s.failedMd !== undefined) o.failedMd = s.failedMd;
    if (s.planted && Object.keys(s.planted).length) o.planted = s.planted;
    if (s.tokenInRepo) o.tokenRepoHits = s.tokenInRepo.length;
    if (s.tokenInLoopResult !== undefined) o.tokenInLR = s.tokenInLoopResult;
    if (s.tokenKnownPositive !== null && s.tokenKnownPositive !== undefined) o.tokenKP = s.tokenKnownPositive;
    for (const k of KEYS) if (R[k] !== undefined) o[k] = R[k];
    if (Array.isArray(R.baseNoteFindings)) o.baseNotes = R.baseNoteFindings.length;
    if (R.thrown) o.thrown = String(R.thrown).slice(0, 160);
    console.log(`  ${l.padEnd(3)} ${JSON.stringify(o).replace(/C:\\\\Users\\\\melve\\\\AppData\\\\Local\\\\Temp\\\\/g, "%T%\\")}`);
  }
}
