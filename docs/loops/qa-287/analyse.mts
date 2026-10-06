// QA 287 step 9: extra dev-phase measurements beside score.mjs (which is run as committed, separately).
//  - score.mjs's own exported scorePhases(), UNEDITED, over records-dev-r2 with NO re-join (records as written).
//  - per requirement-row answers by verdict; AUC of the combined per-row score (min over rows, as the policy
//    combines them), mean over rows, pooled rows, and 1 - touches_out_of_scope, as QA 285 gave them;
//  - the BA-maximising cut on requirement_row_min_noul: FITTED TO THE DEVELOPMENT SET;
//  - side-by-side with QA 285 (origin/qa/jev-cal-2-dev-report) for the cases both runs answered.
// Same method as QA 285's analyse.mts; paths changed to this run. Reads no key, makes no call.
// Run from the run tree root: node open-brain/node_modules/tsx/dist/cli.mjs docs/loops/qa-287/analyse.mts
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const RUN = resolve(".");
const HERE = join(RUN, "docs/loops/jev-calibration-2");
const score = await import(pathToFileURL(join(HERE, "score.mjs")).href);
const { decideDoneGate } = await import(pathToFileURL(join(RUN, "open-brain/src/harness/policies.ts")).href);
const policy = JSON.parse(readFileSync(join(RUN, "open-brain/src/harness/policies/developer-done-cal2-r2.json"), "utf-8"));
const runlist = JSON.parse(readFileSync(join(HERE, "runlist.json"), "utf-8"));
const RECS = join(HERE, "records-dev-r2");
const records = readdirSync(RECS).filter((f) => /\.G_done\..*\.json$/.test(f)).map((f) => ({ f, ...JSON.parse(readFileSync(join(RECS, f), "utf-8")) }));
const dev = runlist.phases.dev;

const scored = score.scorePhases(records, runlist); // no re-join
const out: any = { scorePhases_no_rejoin: { dev_n: scored.phases.dev.summary.n, dev_unscored: scored.phases.dev.unscored.length, heldout_n: scored.phases.heldout.summary.n } };

// Outcome classes, usage, models, retries.
out.outcomes = records.reduce((m: any, r: any) => ((m[r.outcome_class] = (m[r.outcome_class] ?? 0) + 1), m), {});
out.usage = records.reduce((s: any, r: any) => ({ input_tokens: s.input_tokens + (r.usage?.input_tokens ?? 0), output_tokens: s.output_tokens + (r.usage?.output_tokens ?? 0) }), { input_tokens: 0, output_tokens: 0 });
out.models = [...new Set(records.map((r: any) => r.model_resolved))];
out.attempts_gt_1 = records.filter((r: any) => r.attempt !== 1).length;
out.sent_true = records.filter((r: any) => r.sent).length;

const nums = (xs: any[]) => xs.filter((x) => typeof x === "number");
const cases: any[] = [];
for (const row of dev) {
  const mine = records.filter((r: any) => r.dt.path === row.input);
  const ans = mine.filter((r: any) => r.outcome_class === "answered" && r.answer);
  const rec = ans[ans.length - 1];
  if (!rec) { cases.push({ case_id: row.case_id, label: row.label, answered: false, note: mine.map((r: any) => r.note).join(" | ") }); continue; }
  const ids = rec.request.state.plan.acceptance.map((a: any) => a.id);
  const raw = ids.map((id: string) => rec.answer[`plan_row:${id}`]?.noul);
  const rows = nums(raw);
  const checks = rec.request.state.checks;
  const checksPassed = checks?.build?.exit_code === 0 && checks?.unit?.exit_code === 0;
  cases.push({ case_id: row.case_id, label: row.label, answered: true, usage: rec.usage, checks_source: checks?.source, checks_passed: checksPassed,
    n_ids: ids.length, missing_rows: raw.length - rows.length, rows, row_min: Math.min(...rows), row_mean: rows.reduce((s: number, x: number) => s + x, 0) / rows.length,
    touches: rec.answer.touches_out_of_scope?.noul, tests: rec.answer.local_tests_support_claim?.noul, stuck: rec.answer.stuck_repeating_prior_failure?.noul,
    risk: rec.answer.risk_of_regression?.score, built: rec.decision?.verdict, built_reasons: rec.decision?.reasons ?? [], model: rec.model_resolved, ids, answer: rec.answer });
}
out.cases = cases;
const ans = cases.filter((c) => c.answered);

const rowVals = (lab: string, cs = ans) => cs.filter((c) => c.label === lab).flatMap((c) => c.rows);
const dist = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
  return { n: s.length, min: s[0], p25: q(0.25), median: q(0.5), p75: q(0.75), max: s[s.length - 1], mean: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(4),
    lt_0_5: s.filter((x) => x < 0.5).length, "0_5_to_0_7": s.filter((x) => x >= 0.5 && x < 0.7).length, ge_0_7: s.filter((x) => x >= 0.7).length }; };
out.per_row_by_verdict = { ACCEPT: dist(rowVals("ACCEPT")), REJECT: dist(rowVals("REJECT")) };

const aucOf = (P: number[], N: number[]) => { let s = 0; for (const p of P) for (const n of N) s += p > n ? 1 : p === n ? 0.5 : 0; return P.length && N.length ? +(s / (P.length * N.length)).toFixed(4) : null; };
const auc = (key: string, cs = ans) => aucOf(cs.filter((c) => c.label === "ACCEPT").map((c) => c[key]), cs.filter((c) => c.label === "REJECT").map((c) => c[key]));
const aucBlock = (cs: any[]) => ({ combined_row_min: auc("row_min", cs), combined_row_mean: auc("row_mean", cs), per_row_pooled: aucOf(rowVals("ACCEPT", cs), rowVals("REJECT", cs)),
  touches_inverted: auc("t", cs.map((c) => ({ ...c, t: 1 - c.touches }))),
  n_accept: cs.filter((c) => c.label === "ACCEPT").length, n_reject: cs.filter((c) => c.label === "REJECT").length });
out.auc = aucBlock(ans);

// BA-maximising cut on requirement_row_min_noul (all other terms frozen). FITTED TO THE DEVELOPMENT SET.
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
const sc = cands.map((t) => ({ t: +t.toFixed(6), ...ba(ans, (c) => (c.row_min >= t ? "proceed" : "reject")) }));
out.fitted_cut_FITTED_TO_THE_DEVELOPMENT_SET = { parameter: "requirement_row_min_noul (other terms frozen)", frozen_value: policy.requirement_row_min_noul,
  a_gate_as_built: best(sa), b_jev_alone_COUNTERFACTUAL: best(sb), row_min_alone: best(sc), sweep_a: sa };
out.reasons_b = ans.map((c) => ({ case_id: c.case_id, label: c.label, reasons: decideDoneGate(c.answer, policy, { checksPassed: true, planAcceptanceIds: c.ids }).reasons }));

// Side-by-side with QA 285: read its records from the report branch, read-only.
const REF = "origin/qa/jev-cal-2-dev-report";
const files = execFileSync("git", ["ls-tree", "--name-only", `${REF}:docs/loops/jev-calibration-2/records/`], { encoding: "utf8" }).split("\n").filter((f) => f.endsWith(".json"));
const old = files.map((f) => JSON.parse(execFileSync("git", ["show", `${REF}:docs/loops/jev-calibration-2/records/${f}`], { encoding: "utf8", maxBuffer: 64 << 20 })));
const oldAns = new Map<string, any>();
for (const r of old) if (r.outcome_class === "answered" && r.answer) {
  const id = dev.find((d: any) => d.input === r.dt.path)?.case_id ?? r.cal2_case_id;
  oldAns.set(id, r);
}
const sbs = [];
for (const c of ans) {
  const o = oldAns.get(c.case_id);
  if (!o) continue;
  const oids = o.request.state.plan.acceptance.map((a: any) => a.id);
  const orows = nums(oids.map((id: string) => o.answer[`plan_row:${id}`]?.noul));
  sbs.push({ case_id: c.case_id, label: c.label, verdict_then: o.decision?.verdict, verdict_now: c.built, rows_then: orows.length, rows_now: c.rows.length,
    min_then: Math.min(...orows), min_now: c.row_min, mean_then: +(orows.reduce((s: number, x: number) => s + x, 0) / orows.length).toFixed(4), mean_now: +c.row_mean.toFixed(4),
    touches_then: o.answer.touches_out_of_scope?.noul, touches_now: c.touches, input_tokens_then: o.usage?.input_tokens, input_tokens_now: c.usage?.input_tokens });
}
out.side_by_side_qa285 = { n: sbs.length, same_verdict: sbs.filter((x) => x.verdict_then === x.verdict_now).length, rows: sbs,
  auc_then_same17: aucOf(sbs.filter((x) => x.label === "ACCEPT").map((x) => x.min_then), sbs.filter((x) => x.label === "REJECT").map((x) => x.min_then)),
  auc_now_same17: aucOf(sbs.filter((x) => x.label === "ACCEPT").map((x) => x.min_now), sbs.filter((x) => x.label === "REJECT").map((x) => x.min_now)) };
out.auc_now_on_the_17 = aucBlock(ans.filter((c) => oldAns.has(c.case_id)));
out.auc_now_on_the_16_new = aucBlock(ans.filter((c) => !oldAns.has(c.case_id)));

writeFileSync(join(RUN, "docs/loops/qa-287/analysis.json"), JSON.stringify(out, null, 2) + "\n");
const f = out.fitted_cut_FITTED_TO_THE_DEVELOPMENT_SET;
console.log(JSON.stringify({ scorePhases_no_rejoin: out.scorePhases_no_rejoin, outcomes: out.outcomes, usage: out.usage, models: out.models, attempts_gt_1: out.attempts_gt_1, sent_true: out.sent_true,
  per_row: out.per_row_by_verdict, auc: out.auc, auc_now_on_the_17: out.auc_now_on_the_17, auc_now_on_the_16_new: out.auc_now_on_the_16_new,
  fitted: { frozen: f.frozen_value, a: f.a_gate_as_built, b: f.b_jev_alone_COUNTERFACTUAL, row_min_alone: f.row_min_alone },
  sbs: { n: out.side_by_side_qa285.n, same_verdict: out.side_by_side_qa285.same_verdict, auc_then: out.side_by_side_qa285.auc_then_same17, auc_now: out.side_by_side_qa285.auc_now_same17 } }, null, 1));
for (const c of cases) console.log(c.answered ? `${c.case_id} ${c.label} checks ${c.checks_source}/${c.checks_passed} ids ${c.n_ids} missing ${c.missing_rows} rows [${c.rows.join(",")}] min ${c.row_min} touches ${c.touches} tests ${c.tests} stuck ${c.stuck} risk ${c.risk} built ${c.built} in_tok ${c.usage?.input_tokens}` : `${c.case_id} ${c.label} UNANSWERED ${c.note}`);
for (const x of sbs) console.log(`sbs ${x.case_id} ${x.label} verdict ${x.verdict_then}->${x.verdict_now} rows ${x.rows_then}->${x.rows_now} min ${x.min_then}->${x.min_now} mean ${x.mean_then}->${x.mean_now} touches ${x.touches_then}->${x.touches_now} in_tok ${x.input_tokens_then}->${x.input_tokens_now}`);
for (const r of out.reasons_b) console.log(`(b) ${r.case_id} ${r.label}: ${r.reasons.join(" ; ")}`);
