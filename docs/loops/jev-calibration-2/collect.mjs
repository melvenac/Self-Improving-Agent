// collect.mjs — QA 253+ cases from master dispatch files + matching origin/qa/*-report branches.
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { git, writeJson, MIN_QA } from "./lib.mjs";
import { derivePlanFromDispatch } from "./dispatch-derive.mjs";
import { leakHitsFromPlan } from "./leak.mjs";

export function runCollect() {

const LOOPS = "docs/loops";
const MAX_QA = 320;

const masterSha = git(["rev-parse", "origin/master"]).trim();

/** @type {{ qaNo: number, slug: string, dispatch_path: string }[]} */
const dispatches = [];
for (const p of git(["ls-tree", "--name-only", "origin/master", `${LOOPS}/`], { allowFail: true })?.trim().split("\n").filter(Boolean) ?? []) {
  const b = p.slice(LOOPS.length + 1);
  const m = /^qa-(\d{3})-(.+)-dispatch\.md$/.exec(b);
  if (!m) continue;
  const qaNo = Number(m[1]);
  if (qaNo < MIN_QA || qaNo > MAX_QA) continue;
  dispatches.push({ qaNo, slug: m[2], dispatch_path: p });
}

const show = (ref, path) => git(["show", `${ref}:${path}`], { allowFail: true });
const resolveCommit = (h) => {
  const out = git(["rev-parse", "--verify", "--quiet", `${h}^{commit}`], { allowFail: true });
  return out === null || out.trim() === "" ? null : out.trim();
};

function candidatesOf(text) {
  const head = text.split("\n").slice(0, 80).join("\n");
  const found = [];
  for (const m of head.matchAll(/`([0-9a-f]{7,40})`/g)) found.push(m[1]);
  return [...new Set(found.map(resolveCommit).filter(Boolean))];
}

function qaNumberOf(text) {
  const m = /\bQA[ -]?(\d{2,3})\b/.exec(text.split("\n").slice(0, 6).join("\n"));
  return m ? Number(m[1]) : null;
}

function verdictLabel(text) {
  const head = text.split("\n").slice(0, 40).join("\n");
  if (/\bREJECT(?:ED)?\b/.test(head) || /return to Forge/i.test(head)) return "REJECT";
  if (/\bACCEPT(?:ED)?\b/.test(head)) return "ACCEPT";
  return null;
}

function provenanceOf(text) {
  if (/\bruntime-built\b/i.test(text) && !/\b0\s+runtime-built\b/i.test(text)) return "runtime-built";
  return "seat-built";
}

function leakFromDispatch(dispatchText, entry) {
  const plan = derivePlanFromDispatch(dispatchText, entry);
  if (!plan) return [];
  return leakHitsFromPlan(plan);
}

function checksHint(text) {
  const buildOk = /(?:build|npm run build)[^\n]{0,80}\bexit\s+0\b/i.test(text) || /"build"[^}]*"exit_code"\s*:\s*0/.test(text);
  const unitOk = /(?:unit|vitest|npm test)[^\n]{0,80}\bexit\s+0\b/i.test(text) || /"unit"[^}]*"exit_code"\s*:\s*0/.test(text);
  if (buildOk && unitOk) return { checks: "recorded", source: "qa-report", build_exit: 0, unit_exit: 0 };
  return { checks: "none", source: "none", build_exit: 1, unit_exit: 1 };
}

const rows = [];
const unusable = [];
for (const d of dispatches.sort((a, b) => a.qaNo - b.qaNo)) {
  const reportRef = `origin/qa/${d.slug}-report`;
  const reportPath = `${LOOPS}/${d.slug}-qa-report.md`;
  const text = show(reportRef, reportPath);
  if (text === null || text === "") {
    unusable.push({ dispatch: d.dispatch_path, reason: "report-missing", report_ref: reportRef, report_path: reportPath });
    continue;
  }
  const qaNo = qaNumberOf(text) ?? d.qaNo;
  const cands = candidatesOf(text);
  if (cands.length === 0) {
    unusable.push({ dispatch: d.dispatch_path, reason: "no-candidate-sha", qa_no: qaNo });
    continue;
  }
  const dispatchText = show("origin/master", d.dispatch_path) ?? "";
  const dispatch_blob = git(["rev-parse", `origin/master:${d.dispatch_path}`]).trim();
  const label = verdictLabel(text);
  const leak_hits = leakFromDispatch(dispatchText, {
    case_no: d.qaNo,
    case_id: d.slug,
    dispatch_path: d.dispatch_path,
    dispatch_blob,
  });
  rows.push({
    case_id: d.slug,
    candidate_sha: cands[0],
    other_candidates_named: cands.slice(1),
    qa_no: qaNo,
    label,
    provenance: provenanceOf(text),
    leak_group: leak_hits.length > 0,
    leak_hits,
    checks_hint: checksHint(text),
    dispatch_path: d.dispatch_path,
    dispatch_how: "master-dispatch",
    dispatch_commit: masterSha,
    dispatch_commit_date: git(["log", "-1", "--format=%cI", "origin/master"]).trim(),
    dispatch_blob: git(["rev-parse", `origin/master:${d.dispatch_path}`]).trim(),
    qa_report_ref: { path: reportPath, ref: reportRef, commit: git(["rev-parse", reportRef], { allowFail: true })?.trim() ?? null },
    verdict_text: text.split("\n").slice(0, 8).join(" ").slice(0, 200),
  });
}

rows.sort((a, b) => a.qa_no - b.qa_no || a.case_id.localeCompare(b.case_id));
const seen = new Set();
const cases = [];
for (const r of rows) {
  if (seen.has(r.candidate_sha)) { unusable.push({ report: r.qa_report_ref.path, reason: "duplicate-candidate", candidate: r.candidate_sha }); continue; }
  seen.add(r.candidate_sha);
  cases.push(r);
}
cases.forEach((c, i) => { c.case_no = i + 1; });

const isAncestor = (a, b) => git(["merge-base", "--is-ancestor", a, b], { allowFail: true }) !== null;
for (const c of cases) {
  const cand = c.candidate_sha;
  const onMaster = isAncestor(cand, "origin/master");
  const merge =
    onMaster ? git(["rev-list", "-n", "1", "--first-parent", `${cand}..origin/master`], { allowFail: true })?.trim() ?? null : null;
  c.merged = merge !== null && merge !== "";
  c.merge_commit = c.merged ? merge : cand;
  if (c.merged && merge) {
    const parent = git(["rev-parse", `${merge}^1`], { allowFail: true })?.trim();
    c.base_sha = parent ? git(["merge-base", cand, parent], { allowFail: true })?.trim() ?? null : null;
    c.base_how = "merge-parent";
  } else {
    c.base_sha = git(["merge-base", cand, "origin/master"], { allowFail: true })?.trim() ?? null;
    c.base_how = "origin/master";
  }
}

const pool = {
  total: cases.length,
  ACCEPT: cases.filter((c) => c.label === "ACCEPT").length,
  REJECT: cases.filter((c) => c.label === "REJECT").length,
  unlabelled: cases.filter((c) => c.label === null).length,
  leak_group: cases.filter((c) => c.leak_group).length,
  headline_pool: cases.filter((c) => !c.leak_group).length,
  seat_built: cases.filter((c) => c.provenance === "seat-built").length,
  runtime_built: cases.filter((c) => c.provenance === "runtime-built").length,
  checks_recorded: cases.filter((c) => c.checks_hint.checks === "recorded").length,
  checks_none: cases.filter((c) => c.checks_hint.checks === "none").length,
};

writeJson("collect.json", { origin_master: masterSha, min_qa: MIN_QA, max_qa: MAX_QA, cases, unusable, pool });
writeJson("pool.json", pool);
writeJson("dispatches.json", cases.map((c) => ({ case_id: c.case_id, case_no: c.case_no, dispatch_path: c.dispatch_path, dispatch_commit: c.dispatch_commit, dispatch_blob: c.dispatch_blob })));
console.log(`collect: ${cases.length} case(s) QA>=${MIN_QA}, pool ACCEPT ${pool.ACCEPT} REJECT ${pool.REJECT} leak ${pool.leak_group} seat ${pool.seat_built} runtime ${pool.runtime_built}`);
  return { cases, pool, unusable };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) runCollect();
