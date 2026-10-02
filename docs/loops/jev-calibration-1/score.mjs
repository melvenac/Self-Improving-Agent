// score.mjs: score the Phase 2 records against the frozen labels. Phase 2 runs it; Phase 1 only freezes it.
//   node open-brain/node_modules/tsx/dist/cli.mjs docs/loops/jev-calibration-1/score.mjs [--records <dir>] [--out <dir>]
//   node open-brain/node_modules/tsx/dist/cli.mjs docs/loops/jev-calibration-1/score.mjs --selftest
// It makes NO network call and reads no key. It imports the done-gate from the product (decideDoneGate) and
// the policy file as it stands; it changes neither (rulings-1 item 3: no policy file changes).
//
// Two decisions per case, both reported, neither hidden (rulings-1 item 3):
//   (a) GATE AS BUILT           the decision recorded in the record. With `--checks none` the policy's
//                               hand_to_qa_requires_green_checks rejects every case whatever Jev answers.
//   (b) JEV'S JUDGEMENT ALONE   the decision recomputed from the recorded answers with checksPassed: true.
//                               A COUNTERFACTUAL: no run produced it; it is the same policy with the one
//                               rule that cannot be met here set aside.
// Calibration and the Brier score use the per-question answers, so the checks rule does not touch them.
//
// Per-question confidence (the OPERATIONALISATION; Atlas to confirm): each done-gate question gives a probability
// p that the diff is acceptable: diff_matches_plan -> noul, local_tests_support_claim -> noul,
// touches_out_of_scope -> 1 - noul, stuck_repeating_prior_failure -> 1 - noul, risk_of_regression -> 1 - score/2
// (score is on 0..2). The question's stance is ACCEPT when p >= 0.5, else REJECT; its confidence is max(p, 1-p).
// A question is "correct" when its stance equals the case's label. Bands: <0.7, 0.7 to 0.9, >=0.9.
// Brier = mean (p - y)^2 with y = 1 for ACCEPT. A "confident miss" is confidence >= 0.9 and wrong.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { HERE, REPO, readJson, stable } from "./lib.mjs";
import { decideDoneGate } from "../../../open-brain/src/harness/policies.ts";

const QUESTIONS = {
  diff_matches_plan: (a) => a?.noul,
  touches_out_of_scope: (a) => (typeof a?.noul === "number" ? 1 - a.noul : undefined),
  local_tests_support_claim: (a) => a?.noul,
  stuck_repeating_prior_failure: (a) => (typeof a?.noul === "number" ? 1 - a.noul : undefined),
  risk_of_regression: (a) => (typeof a?.score === "number" ? 1 - a.score / 2 : undefined),
};
const DRIVING = ["diff_matches_plan", "touches_out_of_scope"];
const BANDS = [
  { name: "<0.7", test: (c) => c < 0.7 },
  { name: "0.7-0.9", test: (c) => c >= 0.7 && c < 0.9 },
  { name: ">=0.9", test: (c) => c >= 0.9 },
];
const SLICE_FOUR = ["s3-b-step1", "s3-a13", "s3-b2", "s3-c-r4", "t195-r2", "t158-r2", "t196-t197-r2", "t198-r2"];
const policy = JSON.parse(readFileSync(join(REPO, "open-brain/src/harness/policies/developer-done.json"), "utf-8"));

const rate = (n, d) => (d === 0 ? null : Math.round((n / d) * 10000) / 10000);

function decisions(record) {
  const built = record.decision?.verdict ?? null;
  const cf = decideDoneGate(record.answer, policy, { checksPassed: true });
  return { built, counterfactual: cf.verdict, built_reasons: record.decision?.reasons ?? [], counterfactual_reasons: cf.reasons };
}

/** Which questions drove a reject: the question ids named in the reasons. */
function drivers(reasons) {
  const ids = [...Object.keys(QUESTIONS), "the deterministic checks", "the gate did not answer"];
  return ids.filter((id) => reasons.some((r) => r.startsWith(id) || r.includes(`${id} `)));
}

function confusion(rows, key) {
  const m = { accept_proceed: 0, accept_reject: 0, reject_proceed: 0, reject_reject: 0, other: 0 };
  for (const r of rows) {
    const d = r[key];
    if (r.label === "ACCEPT" && d === "proceed") m.accept_proceed += 1;
    else if (r.label === "ACCEPT" && d === "reject") m.accept_reject += 1;
    else if (r.label === "REJECT" && d === "proceed") m.reject_proceed += 1;
    else if (r.label === "REJECT" && d === "reject") m.reject_reject += 1;
    else m.other += 1;
  }
  const nAccept = m.accept_proceed + m.accept_reject;
  const nReject = m.reject_proceed + m.reject_reject;
  return {
    n: rows.length,
    ...m,
    accuracy: rate(m.accept_proceed + m.reject_reject, rows.length),
    // Per-class rates and their mean: raw accuracy alone hides a skewed pool (rulings-2).
    accept_class_rate: rate(m.accept_proceed, nAccept),
    reject_class_rate: rate(m.reject_reject, nReject),
    balanced_accuracy: nAccept === 0 || nReject === 0 ? null : Math.round(((m.accept_proceed / nAccept + m.reject_reject / nReject) / 2) * 10000) / 10000,
    // The headline: proceed on a REJECTED candidate.
    false_accept_rate: rate(m.reject_proceed, nReject),
    false_reject_rate: rate(m.accept_reject, nAccept),
  };
}

function calibration(rows, questionIds) {
  const pts = [];
  for (const r of rows) {
    for (const q of questionIds) {
      const p = r.p[q];
      if (typeof p !== "number") continue;
      const stance = p >= 0.5 ? "ACCEPT" : "REJECT";
      pts.push({ case_id: r.case_id, question: q, p, confidence: Math.max(p, 1 - p), stance, label: r.label, correct: stance === r.label });
    }
  }
  const bands = BANDS.map((b) => {
    const inBand = pts.filter((x) => b.test(x.confidence));
    return { band: b.name, n: inBand.length, correct: inBand.filter((x) => x.correct).length, fraction_correct: rate(inBand.filter((x) => x.correct).length, inBand.length) };
  });
  const brier = pts.length === 0 ? null : Math.round((pts.reduce((s, x) => s + (x.p - (x.label === "ACCEPT" ? 1 : 0)) ** 2, 0) / pts.length) * 10000) / 10000;
  const confident_misses = pts.filter((x) => x.confidence >= 0.9 && !x.correct).map((x) => ({ case_id: x.case_id, question: x.question, p: x.p, stance: x.stance, label: x.label }));
  return { n: pts.length, bands, brier, confident_misses };
}

function summarise(rows) {
  const driverCount = (key) => {
    const c = {};
    for (const r of rows.filter((x) => x[key] === "reject")) for (const d of drivers(r[`${key === "built" ? "built" : "counterfactual"}_reasons`])) c[d] = (c[d] ?? 0) + 1;
    return c;
  };
  return {
    n: rows.length,
    a_gate_as_built: confusion(rows, "built"),
    b_jev_alone_COUNTERFACTUAL: confusion(rows, "counterfactual"),
    calibration_driving_questions: calibration(rows, DRIVING),
    calibration_all_questions: calibration(rows, Object.keys(QUESTIONS)),
    drivers_a: driverCount("built"),
    drivers_b: driverCount("counterfactual"),
  };
}

/** One row per scored case with an answered record. */
export function buildRows(records, sample, labels, kinds = {}) {
  const byNo = new Map(labels.map((l) => [l.case_no, l]));
  const group = (id) => (sample.headline.includes(id) ? "headline" : sample.leak_group.includes(id) ? "leak_group" : null);
  const rows = [];
  const unscored = [];
  for (const id of [...sample.headline, ...sample.leak_group]) {
    const l = labels.find((x) => x.case_id === id);
    const mine = records.filter((r) => byNo.get(r.pr)?.case_id === id);
    const answered = mine.filter((r) => r.outcome_class === "answered" && r.answer);
    if (answered.length === 0) { unscored.push({ case_id: id, records: mine.length, outcome_classes: mine.map((r) => r.outcome_class) }); continue; }
    const rec = answered[answered.length - 1];
    const p = Object.fromEntries(Object.entries(QUESTIONS).map(([q, f]) => [q, f(rec.answer[q])]));
    rows.push({ case_id: id, case_no: l.case_no, source_kind: kinds[id] ?? "unknown", group: group(id), label: l.label, ...decisions(rec), p });
  }
  return { rows, unscored };
}

export function score(records, sample, labels, manifest = { cases: [] }) {
  const kinds = Object.fromEntries(manifest.cases.map((c) => [c.case_id, c.source_kind]));
  const { rows, unscored } = buildRows(records, sample, labels, kinds);
  const headline = rows.filter((r) => r.group === "headline");
  const leak = rows.filter((r) => r.group === "leak_group");
  const sliceFour = rows.filter((r) => SLICE_FOUR.includes(r.case_id));
  const spend = records.reduce((s, r) => ({ input_tokens: s.input_tokens + (r.usage?.input_tokens ?? 0), output_tokens: s.output_tokens + (r.usage?.output_tokens ?? 0) }), { input_tokens: 0, output_tokens: 0 });
  return {
    note: "(a) is the gate as built. (b) is a COUNTERFACTUAL: the same policy recomputed from the recorded answers with checksPassed true. Neither changes a policy file.",
    headline: summarise(headline),
    leak_group: summarise(leak),
    slice_four_must_include: summarise(sliceFour),
    all_scored: summarise(rows),
    // D_t source kind (qa-dispatch, dev-dispatch, brief): does the text Jev saw change the answer?
    by_source_kind: Object.fromEntries([...new Set(rows.map((r) => r.source_kind))].sort().map((k) => [k, summarise(rows.filter((r) => r.source_kind === k))])),
    unscored,
    spend,
    per_case: rows.map((r) => ({ case_id: r.case_id, group: r.group, label: r.label, a_built: r.built, b_counterfactual: r.counterfactual, drivers_a: drivers(r.built_reasons), drivers_b: drivers(r.counterfactual_reasons) })),
  };
}

function markdown(s) {
  const pct = (x) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`);
  const out = ["# Jev calibration 1: scores (generated by score.mjs; do not hand-edit)", "", `> ${s.note}`, ""];
  for (const [name, g] of [["Headline set", s.headline], ["Leak-wording group", s.leak_group], ["Slice-four must-includes", s.slice_four_must_include], ["All scored", s.all_scored], ...Object.entries(s.by_source_kind).map(([k, g]) => [`Source kind: ${k}`, g])]) {
    out.push(`## ${name} (N = ${g.n})`, "", "| decision | n | accuracy | balanced accuracy | proceed on ACCEPT | reject on REJECT | false-accept rate | false-reject rate | TP (A,proceed) | FR (A,reject) | FA (R,proceed) | TR (R,reject) |", "|---|---|---|---|---|---|---|---|---|---|---|");
    for (const [label, c] of [["(a) gate as built", g.a_gate_as_built], ["(b) Jev alone, COUNTERFACTUAL", g.b_jev_alone_COUNTERFACTUAL]]) {
      out.push(`| ${label} | ${c.n} | ${pct(c.accuracy)} | ${pct(c.balanced_accuracy)} | ${pct(c.accept_class_rate)} | ${pct(c.reject_class_rate)} | ${pct(c.false_accept_rate)} | ${pct(c.false_reject_rate)} | ${c.accept_proceed} | ${c.accept_reject} | ${c.reject_proceed} | ${c.reject_reject} |`);
    }
    out.push("");
    for (const [label, c] of [["driving questions", g.calibration_driving_questions], ["all questions", g.calibration_all_questions]]) {
      out.push(`Calibration, ${label} (N = ${c.n}, Brier = ${c.brier ?? "n/a"}):`, "", "| band | n | fraction correct |", "|---|---|---|");
      for (const b of c.bands) out.push(`| ${b.band} | ${b.n} | ${pct(b.fraction_correct)} |`);
      out.push("");
      if (label === "driving questions") out.push(`Confident misses (confidence >= 0.9 and wrong): ${c.confident_misses.length === 0 ? "none" : c.confident_misses.map((m) => `${m.case_id}/${m.question} (p ${m.p}, said ${m.stance}, label ${m.label})`).join("; ")}`, "");
    }
    out.push(`Drivers of a reject, (a): ${JSON.stringify(g.drivers_a)}; (b): ${JSON.stringify(g.drivers_b)}`, "");
  }
  if (s.unscored.length > 0) out.push("## Unscored (no answered record)", "", ...s.unscored.map((u) => `- ${u.case_id}: ${u.records} record(s), ${u.outcome_classes.join(", ") || "none"}`), "");
  out.push(`Spend (summed usage): ${s.spend.input_tokens} input tokens, ${s.spend.output_tokens} output tokens.`, "");
  return out.join("\n");
}

function selftest() {
  // Synthetic records in memory: no file written, no call made. Case 1 is ACCEPT and answered well; case 2 is
  // REJECT but Jev is confident the diff is fine (a confident miss); case 3 is unanswered.
  const labels = [1, 2, 3].map((n) => ({ case_no: n, case_id: `c${n}`, label: n === 1 ? "ACCEPT" : "REJECT" }));
  const sample = { headline: ["c1", "c2", "c3"], leak_group: [] };
  const good = { diff_matches_plan: { noul: 0.95 }, touches_out_of_scope: { noul: 0.05 }, local_tests_support_claim: { noul: 0.9 }, stuck_repeating_prior_failure: { noul: 0.05 }, risk_of_regression: { score: 0.2 } };
  const mk = (pr, answer, verdict) => ({ pr, outcome_class: "answered", answer, decision: { verdict, reasons: verdict === "reject" ? ["the deterministic checks failed (read from process exit codes, not from the gate)"] : [] }, usage: { input_tokens: 10, output_tokens: 2 } });
  const recs = [mk(1, good, "reject"), mk(2, good, "reject"), { pr: 3, outcome_class: "transport", answer: null }];
  const manifest = { cases: [{ case_id: "c1", source_kind: "qa-dispatch" }, { case_id: "c2", source_kind: "dev-dispatch" }] };
  const s = score(recs, sample, labels, manifest);
  const checks = [
    ["(a) rejects every case, as the gate was built", s.headline.a_gate_as_built.accept_reject === 1 && s.headline.a_gate_as_built.reject_reject === 1],
    ["(b) recomputed with checks true proceeds on both", s.headline.b_jev_alone_COUNTERFACTUAL.accept_proceed === 1 && s.headline.b_jev_alone_COUNTERFACTUAL.reject_proceed === 1],
    ["false-accept rate under (b) is 1", s.headline.b_jev_alone_COUNTERFACTUAL.false_accept_rate === 1],
    ["two confident misses (both driving questions), case c2 only", s.headline.calibration_driving_questions.confident_misses.length === 2 && s.headline.calibration_driving_questions.confident_misses.every((m) => m.case_id === "c2")],
    ["the unanswered case is listed, not scored", s.unscored.length === 1 && s.unscored[0].case_id === "c3" && s.headline.n === 2],
    ["spend is summed", s.spend.input_tokens === 20],
    ["balanced accuracy is the mean of the class rates (b: ACCEPT proceeds 1/1, REJECT rejects 0/1 -> 0.5)", s.headline.b_jev_alone_COUNTERFACTUAL.balanced_accuracy === 0.5 && s.headline.b_jev_alone_COUNTERFACTUAL.accept_class_rate === 1 && s.headline.b_jev_alone_COUNTERFACTUAL.reject_class_rate === 0],
    ["source_kind split is present and sums to the scored cases", s.by_source_kind["qa-dispatch"].n + s.by_source_kind["dev-dispatch"].n === s.all_scored.n],
  ];
  for (const [name, ok] of checks) console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
  return checks.every(([, ok]) => ok) ? 0 : 1;
}

const argv = process.argv.slice(2);
if (argv.includes("--selftest")) process.exit(selftest());
if (process.argv[1]?.endsWith("score.mjs")) {
  const flag = (name, dflt) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : dflt);
  const recordsDir = resolve(flag("records", join(HERE, "records")));
  const outDir = resolve(flag("out", join(HERE, "results")));
  if (!existsSync(recordsDir)) { console.error(`no records directory: ${recordsDir}`); process.exit(2); }
  const records = readdirSync(recordsDir)
    .filter((f) => /\.G_done\..*\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(join(recordsDir, f), "utf-8")));
  const s = score(records, readJson("sample.json"), readJson("labels.json"), readJson("MANIFEST.json"));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "scores.json"), stable(s));
  writeFileSync(join(outDir, "scores.md"), markdown(s));
  console.log(`scored ${s.all_scored.n} case(s); ${s.unscored.length} unscored; wrote ${join(outDir, "scores.json")} and scores.md`);
}
