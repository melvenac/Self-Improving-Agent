// manifest.mjs: write MANIFEST.json and runlist.json. No timestamps, no host paths, sorted keys: two runs over the
// same inputs give a byte-identical file (B-2). Everything is derived from the other scripts' outputs.
//   node docs/loops/jev-calibration-1/manifest.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { HERE, SEED, git, readJson, sha256, writeJson } from "./lib.mjs";

const collect = readJson("collect.json");
const labels = readJson("labels.json");
const inputs = readJson("inputs.json");
const sample = readJson("sample.json");
const dispatches = readJson("dispatches.json");

const countBy = (xs, f) => xs.reduce((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});
const lab = (id) => labels.find((l) => l.case_id === id);
const col = (id) => collect.cases.find((c) => c.case_id === id);
const disp = (id) => dispatches.find((d) => d.case_id === id);

/** The kind of text a case's D_t came from, by the dispatch file's name (the brief's three kinds). */
function sourceKind(path) {
  const b = path.split("/").pop();
  if (/dispatch-qa|^qa-\d+-/.test(b)) return "qa-dispatch";
  if (/brief/.test(b)) return "brief";
  return "dev-dispatch";
}

// --- the cases that could not become cases -----------------------------------------------------------------
const reasonKind = (r) => (r.startsWith("no-dispatch") ? "no-dispatch" : r);
const dropped = collect.unusable.map((u) => ({ what: u.report, candidate: u.candidate ?? null, reason: `dropped: ${reasonKind(u.reason)}` }));
for (const d of inputs.dropped) dropped.push({ what: d.case_id, candidate: null, reason: `dropped: ${d.reason}` });
// Must-includes with no source at all. T-194 r1 and r8 have no QA report: there is no origin/qa/t194-rN-report ref.
const qaRefs = new Set(collect.refs);
for (const n of [1, 8]) {
  const id = `t194-r${n}`;
  if (!col(id) && !qaRefs.has(`origin/qa/t194-r${n}-report`)) dropped.push({ what: id, candidate: null, reason: "dropped: no-qa-report" });
}
// Candidate A's early rounds (A, A2, A3) are in the unusable list above under their report paths; name them.
const A_ROUNDS = { "loop-15-slice-3-qa-report-a.md": "A", "loop-15-slice-3-qa-report-a2.md": "A2", "loop-15-slice-3-qa-report-a3.md": "A3" };
for (const d of dropped) {
  const k = Object.keys(A_ROUNDS).find((f) => d.what.endsWith(f));
  if (k) d.must_include = `candidate A round ${A_ROUNDS[k]}`;
}
dropped.sort((a, b) => a.what.localeCompare(b.what));

// --- per-case leak check -------------------------------------------------------------------------------------
const cases = collect.cases
  .map((c) => {
    const l = lab(c.case_id);
    const s = sample.status_by_case[c.case_id];
    return {
      case_id: c.case_id,
      case_no: c.case_no,
      source_kind: sourceKind(c.dispatch_path),
      dispatch_path: c.dispatch_path,
      dispatch_commit: c.dispatch_commit,
      dispatch_commit_date: c.dispatch_commit_date,
      qa_report_first_commit_date: l.qa_report_first_commit_date,
      qa_report_last_commit_date: l.qa_report_commit_date,
      dispatch_after_first_report: Date.parse(c.dispatch_commit_date) > Date.parse(l.qa_report_first_commit_date),
      verdict_words_in_dt: s.leak_count,
      verdict_words: s.leak_hits,
      label: l.label,
      excluded: l.excluded,
      status: s.status,
    };
  })
  .sort((a, b) => a.case_no - b.case_no);

const ambiguous = labels.filter((l) => l.excluded === "ambiguous-verdict").map((l) => ({ case_id: l.case_id, trigger: l.ambiguous_trigger })).sort((a, b) => a.case_id.localeCompare(b.case_id));

// --- B-1: what inputs.mjs reads ------------------------------------------------------------------------------
const inputsSrc = readFileSync(join(HERE, "inputs.mjs"), "utf-8");
const codeOnly = inputsSrc.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
const b1 = {
  reads_in_code: [...codeOnly.matchAll(/\b(readJson|readFileSync|git)\(\s*([^,)]+)/g)].map((m) => `${m[1]}(${m[2].trim()})`).sort(),
  imports_lib_only_from_here: [...codeOnly.matchAll(/from "(\.[^"]+)"/g)].map((m) => m[1]).sort(),
  dispatch_paths_that_look_like_report_or_ruling: dispatches.map((d) => d.dispatch_path).filter((p) => /qa-report|ruling|labels|verdict/i.test(p)),
  mentions_of_labels_or_reports_in_code: (codeOnly.match(/labels\.json|qa-report|rulings?\b/gi) ?? []).length,
};

// --- runlist for Phase 2 ----------------------------------------------------------------------------------------
const scored = [...sample.headline.map((id) => ["headline", id]), ...sample.leak_group.map((id) => ["leak_group", id])];
const dtFile = new Map(inputs.built.map((b) => [b.case_id, b.file]));
const runlist = scored
  .map(([group, id]) => {
    const c = col(id);
    return {
      pr: c.case_no,
      case_id: id,
      group,
      merge_commit: c.merge_commit,
      scored_sha: c.candidate_sha,
      base_sha: c.base_sha,
      dt: `docs/loops/jev-calibration-1/${dtFile.get(id)}`,
      checks: "none",
    };
  })
  .sort((a, b) => a.pr - b.pr);
writeJson("runlist.json", runlist);

// --- hashes --------------------------------------------------------------------------------------------------------
const SCRIPTS = ["lib.mjs", "collect.mjs", "inputs.mjs", "labels.mjs", "sample.mjs", "manifest.mjs", "score.mjs"];
const DATA = ["collect.json", "dispatches.json", "inputs.json", "labels.json", "sample.json", "runlist.json"];
const fileHash = (rel) => sha256(readFileSync(join(HERE, rel)));
const hashes = {
  scripts: Object.fromEntries(SCRIPTS.map((f) => [f, fileHash(f)])),
  data: Object.fromEntries(DATA.map((f) => [f, fileHash(f)])),
  inputs: Object.fromEntries(readdirSync(join(HERE, "inputs")).sort().map((f) => [`inputs/${f}`, fileHash(`inputs/${f}`)])),
};

// --- the refs the case set was built from ---------------------------------------------------------------------------
const tips = collect.refs.map((r) => `${r} ${git(["rev-parse", r]).trim()}`).sort();

const inPool = labels.filter((l) => !l.excluded && l.label);
writeJson("MANIFEST.json", {
  freeze: "Jev calibration 1, Phase 1. Frozen by one commit, before any Jev call. No record exists under records/.",
  seed: SEED,
  built_from: { origin_master: collect.origin_master, refs_count: collect.refs.length, refs_sha256: sha256(tips.join("\n")) },
  counts: {
    reports_found: collect.cases.length + collect.unusable.length,
    pool_cases: collect.cases.length,
    unusable_reports_by_reason: countBy(collect.unusable, (u) => reasonKind(u.reason)),
    d_t_built: inputs.built.length,
    d_t_dropped: inputs.dropped.length,
    labelled_not_excluded: { total: inPool.length, ACCEPT: inPool.filter((l) => l.label === "ACCEPT").length, REJECT: inPool.filter((l) => l.label === "REJECT").length },
    excluded_by_reason: countBy(labels.filter((l) => l.excluded), (l) => l.excluded),
    d_t_with_verdict_wording_all_cases: cases.filter((c) => c.verdict_words_in_dt > 0).length,
    headline: { n: sample.headline_n, ACCEPT: sample.headline_accept, REJECT: sample.headline_reject, meets_50: sample.headline_meets_minimum, pool_before_balance: sample.headline_pool_unsampled },
    leak_wording_group: { n: sample.leak_group_n, ACCEPT: sample.leak_group_accept, REJECT: sample.leak_group_reject },
    scored_total: sample.headline_n + sample.leak_group_n,
    source_kind: countBy(cases, (c) => c.source_kind),
  },
  note_on_headline_n:
    sample.headline_n < sample.min_scored_required
      ? `The headline set is ${sample.headline_n}, below the brief's ${sample.min_scored_required}: rulings-1 item 5 excludes leak-wording D_t from the headline and says to report the real N. The rule is not relaxed and no text was edited.`
      : "The headline set meets the minimum.",
  dropped,
  ambiguous_verdict: ambiguous,
  must_include: sample.must_include,
  b1,
  cases,
  hashes,
  ref_tips_note: "refs_sha256 is the sha256 of the sorted 'ref sha' lines of every origin/qa/* ref and origin/master used.",
});
console.log(`manifest: pool ${collect.cases.length}, scored ${sample.headline_n + sample.leak_group_n} (headline ${sample.headline_n}, leak group ${sample.leak_group_n}), dropped ${dropped.length}`);
