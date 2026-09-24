// node tabmut-a4.mjs <mutant>... — failed tests per mutant (rows JSON) plus its probe outcomes. QA session 89 (from 87's tabmut).
import { existsSync, readFileSync } from "node:fs";
const short = (s, n) => String(s).replace(/candidate A — /g, "").replace(/CA-15 — restore does not follow links /g, "").slice(0, n);
const KEYS = ["victimUnchanged", "victimBytesUnchanged", "watchedPathAfter", "readThroughHardLink", "victimHashesInRecord", "victimHashInRecord",
  "hookHashInRecord", "hookAfter", "outsideEqualsBase", "outsideEqualsBasePlusRoleEdit", "exceptionTextInRecord", "nlinkAfter",
  "globalFindingsPerStage", "newFileHashesInRecord", "notRestored"];
for (const m of process.argv.slice(2)) {
  const f = `mut/${m}.rows.json`;
  if (!existsSync(f)) { console.log(`${m}: NO ROWS JSON`); continue; }
  const j = JSON.parse(readFileSync(f, "utf-8"));
  const failed = [];
  for (const t of j.testResults) for (const a of t.assertionResults) if (a.status === "failed") failed.push(`${t.name.split(/[\\/]/).pop().replace(".test.ts", "")}: ${short(a.fullName, 140)}`);
  const unhandled = (readFileSync(`mut/${m}.rows.out`, "utf-8").match(/Unhandled|onTaskUpdate/g) ?? []).length;
  console.log(`\n${m}: tests=${j.numTotalTests} passed=${j.numPassedTests} failed=${j.numFailedTests} skipped=${j.numPendingTests} unhandledMarks=${unhandled}`);
  for (const x of failed) console.log(`   RED ${x}`);
  const p = `mut/${m}.p15.json`;
  if (existsSync(p)) {
    const pj = JSON.parse(readFileSync(p, "utf-8"));
    for (const [probe, R] of Object.entries(pj)) {
      if (probe === "tree" || probe === "at") continue;
      const s = R.summary ?? {};
      const cvs = s.configVerdicts ?? R.configVerdicts ?? [];
      const rootNamed = cvs.some((v) => (v.changes ?? []).some((c) => /symlink/.test(c.after) && /(hooks|info)$/.test(c.path)));
      const o = { probe, status: s.status ?? R.status, code: s.code ?? R.code, stage: s.stage ?? R.stage, rootNamed, unrestored: cvs.flatMap((v) => v.unrestored ?? []).length };
      for (const k of KEYS) if (R[k] !== undefined) o[k] = R[k];
      if (Array.isArray(R.baseNoteFindings)) o.baseNotes = R.baseNoteFindings.length;
      if (R.eachTargetOnceInDeveloperWithBothHashes) o.ca4f = R.eachTargetOnceInDeveloperWithBothHashes.map((x) => `${x.n}/${x.stage}/${x.hex}`).join(",");
      if (R.probeError) o.probeError = short(R.probeError, 200);
      console.log(`   PROBE ${JSON.stringify(o)}`);
    }
  }
  const p2 = `mut/${m}.p2.json`;
  if (existsSync(p2)) console.log(`   PROBE2 ${readFileSync(p2, "utf-8").replace(/\s+/g, " ").slice(0, 500)}`);
}
