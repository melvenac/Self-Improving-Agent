// score.mjs: score calibration 2 records (fork of calibration 1 with T-222 F6 driver text).
//   node open-brain/node_modules/tsx/dist/cli.mjs docs/loops/jev-calibration-2/score.mjs [--records <dir>] [--out <dir>]
//   node open-brain/node_modules/tsx/dist/cli.mjs docs/loops/jev-calibration-2/score.mjs --selftest
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
import { POLICY_REL } from "./lib.mjs";

const QUESTIONS = {
  diff_matches_plan: (a) => a?.noul,
  touches_out_of_scope: (a) => (typeof a?.noul === "number" ? 1 - a.noul : undefined),
  local_tests_support_claim: (a) => a?.noul,
  stuck_repeating_prior_failure: (a) => (typeof a?.noul === "number" ? 1 - a.noul : undefined),
  risk_of_regression: (a) => (typeof a?.score === "number" ? 1 - a.score / 2 : undefined),
};
const policy = JSON.parse(readFileSync(join(REPO, POLICY_REL), "utf-8"));

function probForQuestion(q, a) {
  if (q.startsWith("plan_row:")) return a?.noul;
  const f = QUESTIONS[q];
  return f ? f(a) : undefined;
}

function drivingQuestionIds(answer) {
  if (!answer) return [];
  return Object.keys(answer).filter((k) => k.startsWith("plan_row:") || k === "touches_out_of_scope");
}

function allQuestionIds(rows) {
  return [...new Set(rows.flatMap((r) => Object.keys(r.answer ?? {})))].sort();
}

function posix(p) {
  return String(p).replace(/\\/g, "/");
}

function recordMatchesRunlistEntry(record, entry) {
  if (record.cal2_case_id === entry.case_id) return true;
  const dt = record.dt?.path;
  if (dt && posix(dt) === posix(entry.input)) return true;
  return false;
}
const BANDS = [
  { name: "<0.7", test: (c) => c < 0.7 },
  { name: "0.7-0.9", test: (c) => c >= 0.7 && c < 0.9 },
  { name: ">=0.9", test: (c) => c >= 0.9 },
];
const rate = (n, d) => (d === 0 ? null : Math.round((n / d) * 10000) / 10000);

function planAcceptanceIds(record) {
  const acc = record.request?.state?.plan?.acceptance;
  return Array.isArray(acc) ? acc.map((r) => r.id) : undefined;
}

function decisions(record) {
  const built = record.decision?.verdict ?? null;
  const ids = planAcceptanceIds(record);
  const cf = decideDoneGate(record.answer, policy, { checksPassed: true, planAcceptanceIds: ids });
  const builtDecision = record.answer
    ? decideDoneGate(record.answer, policy, {
        checksPassed:
          record.request?.state?.checks?.build?.exit_code === 0 && record.request?.state?.checks?.unit?.exit_code === 0,
        checksSource: record.request?.state?.checks?.source ?? "none",
        planAcceptanceIds: ids,
      })
    : null;
  return {
    built: built ?? builtDecision?.verdict ?? null,
    counterfactual: cf.verdict,
    built_reasons: record.decision?.reasons ?? builtDecision?.reasons ?? [],
    counterfactual_reasons: cf.reasons,
  };
}

/** Which questions drove a reject: the question ids named in the reasons. */
export function drivers(reasons) {
  const fromReasons = new Set();
  for (const r of reasons) {
    for (const id of Object.keys(QUESTIONS)) if (r.startsWith(id) || r.includes(`${id} `)) fromReasons.add(id);
    const m = /^plan_row:([^\s]+)/.exec(r);
    if (m) fromReasons.add(`plan_row:${m[1]}`);
    if (r.includes("no deterministic checks were supplied")) fromReasons.add("no deterministic checks were supplied");
    if (r.startsWith("the deterministic checks")) fromReasons.add("the deterministic checks");
    if (r.startsWith("the gate did not answer")) fromReasons.add("the gate did not answer");
  }
  return [...fromReasons];
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
    const qs = questionIds ?? drivingQuestionIds(r.answer);
    for (const q of qs) {
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
    calibration_driving_questions: calibration(
      rows,
      rows.length ? [...new Set(rows.flatMap((r) => drivingQuestionIds(r.answer)))] : [],
    ),
    calibration_all_questions: calibration(rows, rows.length ? allQuestionIds(rows) : []),
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
    const p = Object.fromEntries(Object.entries(rec.answer ?? {}).map(([q, a]) => [q, probForQuestion(q, a)]));
    rows.push({
      case_id: id,
      case_no: l.case_no,
      source_kind: kinds[id] ?? "unknown",
      group: group(id),
      label: l.label,
      answer: rec.answer,
      ...decisions(rec),
      p,
    });
  }
  return { rows, unscored };
}

export function usefulnessFromSummary(summary) {
  const gate = summary.a_gate_as_built;
  const cal = summary.calibration_driving_questions;
  const band90 = cal.bands.find((b) => b.band === ">=0.9") ?? { n: 0, fraction_correct: null };
  const criteria = {
    balanced_accuracy_ge_0_75: gate.balanced_accuracy !== null && gate.balanced_accuracy >= 0.75,
    false_accept_le_0_10: gate.false_accept_rate !== null && gate.false_accept_rate <= 0.1,
    brier_le_0_20: cal.brier !== null && cal.brier <= 0.2,
    high_conf_ge_0_90_over_10: band90.n >= 10 && (band90.fraction_correct ?? 0) >= 0.9,
  };
  return {
    balanced_accuracy: gate.balanced_accuracy,
    false_accept_rate: gate.false_accept_rate,
    brier: cal.brier,
    brier_baseline: 0.25,
    high_conf_n: band90.n,
    high_conf_fraction_correct: band90.fraction_correct,
    criteria,
    useful: Object.values(criteria).every(Boolean),
  };
}

export function buildRowsFromRunlist(records, entries) {
  const rows = [];
  const unscored = [];
  for (const e of entries) {
    if (e.leak_excluded) continue;
    const mine = records.filter((r) => recordMatchesRunlistEntry(r, e));
    const answered = mine.filter((r) => r.outcome_class === "answered" && r.answer);
    if (answered.length === 0) {
      unscored.push({ case_id: e.case_id, records: mine.length, outcome_classes: mine.map((r) => r.outcome_class) });
      continue;
    }
    const rec = answered[answered.length - 1];
    const p = Object.fromEntries(Object.entries(rec.answer ?? {}).map(([q, a]) => [q, probForQuestion(q, a)]));
    rows.push({ case_id: e.case_id, case_no: e.case_no, phase: e.phase, label: e.label, answer: rec.answer, ...decisions(rec), p });
  }
  return { rows, unscored };
}

export function scorePhases(records, runlist) {
  const dev = buildRowsFromRunlist(records, runlist.phases.dev);
  const held = buildRowsFromRunlist(records, runlist.phases.heldout);
  const spend = records.reduce(
    (s, r) => ({ input_tokens: s.input_tokens + (r.usage?.input_tokens ?? 0), output_tokens: s.output_tokens + (r.usage?.output_tokens ?? 0) }),
    { input_tokens: 0, output_tokens: 0 },
  );
  const devSummary = summarise(dev.rows);
  const heldSummary = summarise(held.rows);
  return {
    policy: runlist.policy,
    note: "Per-phase scores for calibration 2 round 2 (development vs held-out). Leak-tagged runlist rows are omitted from the four usefulness criteria.",
    phases: {
      dev: { summary: devSummary, unscored: dev.unscored, usefulness: usefulnessFromSummary(devSummary) },
      heldout: { summary: heldSummary, unscored: held.unscored, usefulness: usefulnessFromSummary(heldSummary) },
    },
    spend,
  };
}

export function score(records, sample, labels, manifest = { cases: [] }) {
  const kinds = Object.fromEntries(manifest.cases.map((c) => [c.case_id, c.source_kind]));
  const { rows, unscored } = buildRows(records, sample, labels, kinds);
  const headline = rows.filter((r) => r.group === "headline");
  const leak = rows.filter((r) => r.group === "leak_group");
  const spend = records.reduce((s, r) => ({ input_tokens: s.input_tokens + (r.usage?.input_tokens ?? 0), output_tokens: s.output_tokens + (r.usage?.output_tokens ?? 0) }), { input_tokens: 0, output_tokens: 0 });
  return {
    note: "(a) is the gate as built. (b) is a COUNTERFACTUAL: the same policy recomputed from the recorded answers with checksPassed true. Neither changes a policy file.",
    headline: summarise(headline),
    leak_group: summarise(leak),
    all_scored: summarise(rows),
    // D_t source kind (qa-dispatch, dev-dispatch, brief): does the text Jev saw change the answer?
    by_source_kind: Object.fromEntries([...new Set(rows.map((r) => r.source_kind))].sort().map((k) => [k, summarise(rows.filter((r) => r.source_kind === k))])),
    unscored,
    spend,
    per_case: rows.map((r) => ({ case_id: r.case_id, group: r.group, label: r.label, a_built: r.built, b_counterfactual: r.counterfactual, drivers_a: drivers(r.built_reasons), drivers_b: drivers(r.counterfactual_reasons) })),
  };
}

function markdownPhaseBlock(phaseName, block) {
  const pct = (x) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`);
  const g = block.summary;
  const out = [`## ${phaseName} (N = ${g.n})`, ""];
  out.push(
    "| decision | n | accuracy | balanced accuracy | proceed on ACCEPT | reject on REJECT | false-accept rate | false-reject rate |",
    "|---|---|---|---|---|---|---|---|",
  );
  for (const [label, c] of [["(a) gate as built", g.a_gate_as_built], ["(b) Jev alone, COUNTERFACTUAL", g.b_jev_alone_COUNTERFACTUAL]]) {
    out.push(
      `| ${label} | ${c.n} | ${pct(c.accuracy)} | ${pct(c.balanced_accuracy)} | ${pct(c.accept_class_rate)} | ${pct(c.reject_class_rate)} | ${pct(c.false_accept_rate)} | ${pct(c.false_reject_rate)} |`,
    );
  }
  out.push("");
  for (const [label, c] of [["driving questions", g.calibration_driving_questions], ["all questions", g.calibration_all_questions]]) {
    out.push(`Calibration, ${label} (N = ${c.n}, Brier = ${c.brier ?? "n/a"}):`, "", "| band | n | fraction correct |", "|---|---|---|");
    for (const b of c.bands) out.push(`| ${b.band} | ${b.n} | ${pct(b.fraction_correct)} |`);
    out.push("");
  }
  if (block.unscored.length > 0) {
    out.push("### Unscored", "", ...block.unscored.map((u) => `- ${u.case_id}: ${u.records} record(s)`), "");
  }
  return out.join("\n");
}

function markdownPhases(s) {
  const out = [
    "# Jev calibration 2: scores (generated by score.mjs; do not hand-edit)",
    "",
    `> ${s.note}`,
    "",
    `Policy: ${s.policy}`,
    "",
  ];
  out.push(markdownPhaseBlock("Development phase", s.phases.dev));
  out.push(markdownPhaseBlock("Held-out phase", s.phases.heldout));
  out.push(`Spend (summed usage): ${s.spend.input_tokens} input tokens, ${s.spend.output_tokens} output tokens.`, "");
  return out.join("\n");
}

function markdown(s) {
  const pct = (x) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`);
  const out = ["# Jev calibration 2: scores (generated by score.mjs; do not hand-edit)", "", `> ${s.note}`, ""];
  for (const [name, g] of [["Headline set", s.headline], ["Leak-wording group", s.leak_group], ["All scored", s.all_scored], ...Object.entries(s.by_source_kind).map(([k, g]) => [`Source kind: ${k}`, g])]) {
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
  const good = {
    "plan_row:T1": { noul: 0.95 },
    touches_out_of_scope: { noul: 0.05 },
    local_tests_support_claim: { noul: 0.9 },
    stuck_repeating_prior_failure: { noul: 0.05 },
    risk_of_regression: { score: 0.2 },
  };
  const f6Reason = "no deterministic checks were supplied";
  const mk = (pr, answer, verdict) => ({
    pr,
    outcome_class: "answered",
    answer,
    request: { state: { plan: { acceptance: [{ id: "T1" }] }, checks: { build: { exit_code: 1 }, unit: { exit_code: 1 }, source: "none" } } },
    decision: { verdict, reasons: verdict === "reject" ? [f6Reason] : [] },
    usage: { input_tokens: 10, output_tokens: 2 },
  });
  const recs = [mk(1, good, "reject"), mk(2, good, "reject"), { pr: 3, outcome_class: "transport", answer: null }];
  const manifest = { cases: [{ case_id: "c1", source_kind: "qa-dispatch" }, { case_id: "c2", source_kind: "dev-dispatch" }] };
  const s = score(recs, sample, labels, manifest);
  const checks = [
    ["(a) rejects every case, as the gate was built", s.headline.a_gate_as_built.accept_reject === 1 && s.headline.a_gate_as_built.reject_reject === 1],
    ["(b) recomputed with checks true proceeds on both", s.headline.b_jev_alone_COUNTERFACTUAL.accept_proceed === 1 && s.headline.b_jev_alone_COUNTERFACTUAL.reject_proceed === 1],
    ["false-accept rate under (b) is 1", s.headline.b_jev_alone_COUNTERFACTUAL.false_accept_rate === 1],
    [
      "two confident misses on driving questions (plan_row + touches), case c2 only",
      s.headline.calibration_driving_questions.confident_misses.length === 2 &&
        s.headline.calibration_driving_questions.confident_misses.every((m) => m.case_id === "c2"),
    ],
    ["the unanswered case is listed, not scored", s.unscored.length === 1 && s.unscored[0].case_id === "c3" && s.headline.n === 2],
    ["spend is summed", s.spend.input_tokens === 20],
    ["balanced accuracy is the mean of the class rates (b: ACCEPT proceeds 1/1, REJECT rejects 0/1 -> 0.5)", s.headline.b_jev_alone_COUNTERFACTUAL.balanced_accuracy === 0.5 && s.headline.b_jev_alone_COUNTERFACTUAL.accept_class_rate === 1 && s.headline.b_jev_alone_COUNTERFACTUAL.reject_class_rate === 0],
    ["source_kind split is present and sums to the scored cases", s.by_source_kind["qa-dispatch"].n + s.by_source_kind["dev-dispatch"].n === s.all_scored.n],
    ["drivers() counts T-222 F6 checks text on a known positive", drivers([f6Reason]).includes("no deterministic checks were supplied") && s.headline.drivers_a["no deterministic checks were supplied"] === 2],
    [
      "all-questions calibration lists every answer key, not only driving ids",
      (() => {
        const extra = {
          pr: 9,
          outcome_class: "answered",
          answer: { ...good, extra_question: { noul: 0.99 } },
          request: { state: { plan: { acceptance: [{ id: "T1" }] }, checks: { build: { exit_code: 0 }, unit: { exit_code: 0 }, source: "ci" } } },
          decision: { verdict: "proceed", reasons: [] },
          usage: { input_tokens: 1, output_tokens: 1 },
        };
        const { rows } = buildRows([mk(1, good, "proceed"), extra], sample, labels, manifest);
        const sum = summarise(rows);
        return sum.calibration_all_questions.n > sum.calibration_driving_questions.n;
      })(),
    ],
    [
      "buildRowsFromRunlist joins on dt.path, not pr",
      (() => {
        const rec = {
          pr: 999,
          cal2_case_id: "c1",
          dt: { path: "docs/loops/jev-calibration-2/inputs/001-c1.G_done-request.json", blob: "a" },
          outcome_class: "answered",
          answer: good,
          request: { state: { plan: { acceptance: [{ id: "T1" }] }, checks: { build: { exit_code: 0 }, unit: { exit_code: 0 }, source: "ci" } } },
          decision: { verdict: "proceed", reasons: [] },
        };
        const { rows } = buildRowsFromRunlist([rec], [{ case_id: "c1", case_no: 1, phase: "dev", label: "ACCEPT", input: "docs/loops/jev-calibration-2/inputs/001-c1.G_done-request.json" }]);
        return rows.length === 1 && rows[0].case_id === "c1";
      })(),
    ],
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
  const runlist = readJson("runlist.json");
  const s = scorePhases(records, runlist);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "scores.json"), stable(s));
  writeFileSync(join(outDir, "scores.md"), markdownPhases(s));
  const devN = s.phases.dev.summary.n;
  const unscoredN = s.phases.dev.unscored.length + s.phases.heldout.unscored.length;
  console.log(`scored dev ${devN} case(s); ${unscoredN} unscored; wrote ${join(outDir, "scores.json")} and scores.md`);
}
