// QA 241: classify every disagreement in QA 237's re-run outputs against r6.
//   fail-open  : QA's oracle required a deny/grant/named refusal and the hook ALLOWED
//   p0         : the hook refused with the parse gate (reason starts "Planner hook: denied — not statically parseable")
//   closed     : the hook denied by another rule (P1-P3), not what QA's oracle expected (fail-closed)
import { readFileSync, writeFileSync } from "node:fs";

const O = "C:/qa-scratch/qa241-wt/docs/loops/qa-241/qa237-out";
const P0 = /^Planner hook: denied — not statically parseable: /;
const res = {};
for (const g of ["gen-p1", "gen-p2", "gen-p2b", "gen-p3"]) {
  const j = JSON.parse(readFileSync(`${O}/${g}-r6.json`, "utf8"));
  const rows = j.all;
  const c = { cases: rows.length, agree: 0, failOpen: [], p0: 0, closedOther: [], p0OnAllowExpected: [] };
  for (const r of j.disagreements) {
    const exp = r.expect ?? r.expected;
    if (r.got === "allow") c.failOpen.push({ cmd: r.id, exp });
    else if (P0.test(r.reason ?? "")) {
      c.p0++;
      if (/allow|read/.test(String(exp))) c.p0OnAllowExpected.push(r.id);
    } else c.closedOther.push({ cmd: r.id, exp, got: r.got, reason: (r.reason ?? "").slice(0, 200) });
  }
  c.agree = rows.length - j.disagreements.length;
  c.p0AllRows = rows.filter((r) => P0.test(r.reason ?? "")).length;
  res[g] = c;
  console.log(`${g}: cases ${c.cases}, agree ${c.agree}, disagree->P0 ${c.p0} (of which allow-expected ${c.p0OnAllowExpected.length}), fail-open ${c.failOpen.length}, fail-closed other ${c.closedOther.length}; P0 refusals in all rows ${c.p0AllRows}`);
  for (const f of c.failOpen) console.log("   FAIL-OPEN", JSON.stringify(f));
  for (const f of c.closedOther) console.log("   CLOSED", JSON.stringify(f));
}
writeFileSync(`${O}/classified.json`, JSON.stringify(res, null, 1));
