// node tabmut.mjs <mutant>... — failed tests per mutant (rows JSON) plus its probe outcomes. QA session 87.
import { existsSync, readFileSync } from "node:fs";
const short = (s, n) => String(s).replace(/candidate A — /g, "").slice(0, n);
for (const m of process.argv.slice(2)) {
  const f = `mut/${m}.rows.json`;
  if (!existsSync(f)) { console.log(`${m}: NO ROWS JSON`); continue; }
  const j = JSON.parse(readFileSync(f, "utf-8"));
  const failed = [];
  for (const t of j.testResults) for (const a of t.assertionResults) if (a.status === "failed") failed.push(`${t.name.split(/[\\/]/).pop().replace(".test.ts", "")}: ${short(a.fullName, 150)}`);
  const unhandled = (readFileSync(`mut/${m}.rows.out`, "utf-8").match(/Unhandled|onTaskUpdate/g) ?? []).length;
  console.log(`\n${m}: tests=${j.numTotalTests} passed=${j.numPassedTests} failed=${j.numFailedTests} skipped=${j.numPendingTests} unhandledMarks=${unhandled}`);
  for (const x of failed) console.log(`   RED ${x}`);
  const p = `mut/${m}.p15.json`;
  if (existsSync(p)) {
    const pj = JSON.parse(readFileSync(p, "utf-8"));
    for (const [probe, R] of Object.entries(pj)) {
      if (probe === "tree" || probe === "at") continue;
      const s = R.summary ?? {};
      const rootNamed = (s.configVerdicts ?? []).some((v) => (v.changes ?? []).some((c) => /symlink/.test(c.after) && /(hooks|info)$/.test(c.path)));
      const o = { probe, status: s.status, code: s.code, victimUnchanged: R.victimUnchanged, victimBytesUnchanged: R.victimBytesUnchanged, watchedPathAfter: R.watchedPathAfter, readThroughHardLink: R.readThroughHardLink, victimHashesInRecord: R.victimHashesInRecord, victimHashInRecord: R.victimHashInRecord, baseNoteFindings: R.baseNoteFindings && R.baseNoteFindings.length, rootNamed, anc: (s.configVerdicts ?? []).map((v) => v.ancestorLink).filter(Boolean).length, unrestored: (s.configVerdicts ?? []).flatMap((v) => v.unrestored ?? []).length, probeError: R.probeError && short(R.probeError, 200) };
      for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
      console.log(`   PROBE ${JSON.stringify(o)}`);
      if (probe === "a5" && s.reason) console.log(`      a5 reason: ${short(s.reason, 260)}`);
    }
  }
  const p2 = `mut/${m}.p2.json`;
  if (existsSync(p2)) console.log(`   PROBE2 ${readFileSync(p2, "utf-8").replace(/\s+/g, " ").slice(0, 600)}`);
}
