// QA 285 step 7: score the DEV phase.
//  1. score.mjs's own scorePhases(), UNEDITED, run (i) on the records as written and (ii) on the same records with
//     `pr` rewritten to the runlist row's case_no, matched by input path (record.dt.path === row.input). (i) scores
//     0/33 because the runner writes pr = state.scored_diff.pr (the GitHub PR number), not case_no.
//  2. Extra measurements the dispatch asks for that score.mjs does not compute: per requirement-row answers by
//     verdict, AUC of the combined per-row score (min over rows = how the policy combines them; mean shown too),
//     the BA-maximising cut on these rows (FITTED TO THE DEVELOPMENT SET), and confident misses.
// Reads no key, makes no call, writes only under C:/qa-tmp/qa285.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const RUN = "C:/qa-scratch/qa285-run";
const HERE = join(RUN, "docs/loops/jev-calibration-2");
const score = await import(pathToFileURL(join(HERE, "score.mjs")).href);
const { decideDoneGate } = await import(pathToFileURL(join(RUN, "open-brain/src/harness/policies.ts")).href);
const policy = JSON.parse(readFileSync(join(RUN, "open-brain/src/harness/policies/developer-done-cal2-r2.json"), "utf-8"));
const runlist = JSON.parse(readFileSync(join(HERE, "runlist.json"), "utf-8"));
const RECS = join(HERE, "records");
const records = readdirSync(RECS).filter((f) => /\.G_done\..*\.json$/.test(f)).map((f) => ({ f, ...JSON.parse(readFileSync(join(RECS, f), "utf-8")) }));
const dev = runlist.phases.dev;
const byInput = new Map(dev.map((r: any) => [r.input, r]));

const asIs = score.scorePhases(records, runlist);
const joined = records.map((r: any) => ({ ...r, pr: byInput.get(r.dt.path)?.case_no ?? -1 }));
const fixed = score.scorePhases(joined, runlist);
const out: any = { as_committed: { dev_n: asIs.phases.dev.summary.n, dev_unscored: asIs.phases.dev.unscored.length, heldout_n: asIs.phases.heldout.summary.n },
  joined_by_input: { dev: fixed.phases.dev, heldout_n: fixed.phases.heldout.summary.n, spend: fixed.spend } };

// Per-case table.
const cases: any[] = [];
for (const row of dev) {
  const mine = joined.filter((r: any) => r.dt.path === row.input);
  const ans = mine.filter((r: any) => r.outcome_class === "answered" && r.answer);
  const rec = ans[ans.length - 1];
  const bytes = Buffer.byteLength(JSON.stringify(JSON.parse(readFileSync(join(RUN, row.input), "utf-8")).request));
  if (!rec) { cases.push({ case_id: row.case_id, label: row.label, answered: false, bytes, note: mine.map((r: any) => r.note).join(" | ") }); continue; }
  const ids = rec.request.state.plan.acceptance.map((a: any) => a.id);
  const rows = ids.map((id: string) => rec.answer[`plan_row:${id}`]?.noul);
  const checks = rec.request.state.checks;
  const checksPassed = checks?.build?.exit_code === 0 && checks?.unit?.exit_code === 0;
  cases.push({ case_id: row.case_id, label: row.label, answered: true, bytes, usage: rec.usage, checks_source: checks?.source, checks_passed: checksPassed,
    rows, row_min: Math.min(...rows), row_mean: rows.reduce((s: number, x: number) => s + x, 0) / rows.length,
    touches: rec.answer.touches_out_of_scope?.noul, tests: rec.answer.local_tests_support_claim?.noul, stuck: rec.answer.stuck_repeating_prior_failure?.noul,
    risk: rec.answer.risk_of_regression?.score, built: rec.decision?.verdict, built_reasons: rec.decision?.reasons ?? [], model: rec.model_resolved, ids, answer: rec.answer });
}
out.cases = cases;
const ans = cases.filter((c) => c.answered);

// Per requirement-row answers by verdict.
const rowVals = (lab: string) => ans.filter((c) => c.label === lab).flatMap((c) => c.rows);
const dist = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
  return { n: s.length, min: s[0], p25: q(0.25), median: q(0.5), p75: q(0.75), max: s[s.length - 1], mean: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(4),
    lt_0_5: s.filter((x) => x < 0.5).length, "0_5_to_0_7": s.filter((x) => x >= 0.5 && x < 0.7).length, ge_0_7: s.filter((x) => x >= 0.7).length }; };
out.per_row_by_verdict = { ACCEPT: dist(rowVals("ACCEPT")), REJECT: dist(rowVals("REJECT")) };

// AUC (Mann-Whitney, ties 0.5), ACCEPT positive, higher score = more acceptable.
const auc = (key: string, cs = ans) => { const P = cs.filter((c) => c.label === "ACCEPT").map((c) => c[key]); const N = cs.filter((c) => c.label === "REJECT").map((c) => c[key]);
  let s = 0; for (const p of P) for (const n of N) s += p > n ? 1 : p === n ? 0.5 : 0; return P.length && N.length ? +(s / (P.length * N.length)).toFixed(4) : null; };
out.auc = { combined_row_min: auc("row_min"), combined_row_mean: auc("row_mean"), per_row_pooled: (() => {
  const P = rowVals("ACCEPT"), N = rowVals("REJECT"); let s = 0; for (const p of P) for (const n of N) s += p > n ? 1 : p === n ? 0.5 : 0; return +(s / (P.length * N.length)).toFixed(4); })(),
  touches_inverted: (() => { const cs = ans.map((c) => ({ ...c, t: 1 - c.touches })); return auc("t", cs); })(),
  n_accept: ans.filter((c) => c.label === "ACCEPT").length, n_reject: ans.filter((c) => c.label === "REJECT").length };

// BA-maximising cut on requirement_row_min_noul (all other policy terms as frozen). FITTED TO THE DEVELOPMENT SET.
const ba = (cs: any[], verdictOf: (c: any) => string) => { const A = cs.filter((c) => c.label === "ACCEPT"), R = cs.filter((c) => c.label === "REJECT");
  const tp = A.filter((c) => verdictOf(c) === "proceed").length, tn = R.filter((c) => verdictOf(c) === "reject").length;
  return { ba: +((tp / A.length + tn / R.length) / 2).toFixed(4), accept_proceed: tp, n_accept: A.length, reject_reject: tn, n_reject: R.length, far: +((R.length - tn) / R.length).toFixed(4) }; };
const cands = [...new Set([0, ...ans.map((c) => c.row_min), ...ans.map((c) => c.row_min + 1e-9), 1.01])].sort((a, b) => a - b);
const sweep = (cfOnly: boolean) => cands.map((t) => {
  const p = { ...policy, requirement_row_min_noul: t };
  const v = (c: any) => decideDoneGate(c.answer, p, { checksPassed: cfOnly ? true : c.checks_passed, checksSource: c.checks_source, planAcceptanceIds: c.ids }).verdict;
  return { t: +t.toFixed(6), ...ba(ans, v) }; });
const best = (xs: any[]) => { const m = Math.max(...xs.map((x) => x.ba)); return { max_ba: m, cuts: xs.filter((x) => x.ba === m) }; };
const sa = sweep(false), sb = sweep(true);
out.fitted_cut_FITTED_TO_THE_DEVELOPMENT_SET = { parameter: "requirement_row_min_noul (other terms frozen)", a_gate_as_built: best(sa), b_jev_alone_COUNTERFACTUAL: best(sb), frozen_value: policy.requirement_row_min_noul };
// Combined-score cut alone (row_min >= t -> proceed), ignoring all other terms.
const sc = cands.map((t) => ({ t: +t.toFixed(6), ...ba(ans, (c) => (c.row_min >= t ? "proceed" : "reject")) }));
out.fitted_cut_FITTED_TO_THE_DEVELOPMENT_SET.row_min_alone = best(sc);
// Which terms reject each answered case at the frozen policy, (b) counterfactual.
out.reasons_b = ans.map((c) => ({ case_id: c.case_id, label: c.label, reasons: decideDoneGate(c.answer, policy, { checksPassed: true, planAcceptanceIds: c.ids }).reasons }));
writeFileSync("C:/qa-tmp/qa285/analysis.json", JSON.stringify(out, null, 2));
const d = fixed.phases.dev;
console.log(JSON.stringify({ as_committed: out.as_committed, usefulness: d.usefulness, a: d.summary.a_gate_as_built, b: d.summary.b_jev_alone_COUNTERFACTUAL,
  cal_driving: { n: d.summary.calibration_driving_questions.n, brier: d.summary.calibration_driving_questions.brier, bands: d.summary.calibration_driving_questions.bands, confident_misses: d.summary.calibration_driving_questions.confident_misses },
  cal_all: { n: d.summary.calibration_all_questions.n, brier: d.summary.calibration_all_questions.brier, bands: d.summary.calibration_all_questions.bands, cm: d.summary.calibration_all_questions.confident_misses.length },
  drivers_a: d.summary.drivers_a, drivers_b: d.summary.drivers_b, unscored: d.unscored, spend: fixed.spend, per_row: out.per_row_by_verdict, auc: out.auc, fitted: out.fitted_cut_FITTED_TO_THE_DEVELOPMENT_SET }, null, 1));
for (const c of cases) console.log(c.answered ? `${c.case_id} ${c.label} checks ${c.checks_source}/${c.checks_passed} rows [${c.rows.join(",")}] min ${c.row_min} touches ${c.touches} tests ${c.tests} stuck ${c.stuck} risk ${c.risk} built ${c.built}` : `${c.case_id} ${c.label} UNANSWERED bytes ${c.bytes} ${c.note}`);
for (const r of out.reasons_b) console.log(`(b) ${r.case_id} ${r.label}: ${r.reasons.join(" ; ")}`);
