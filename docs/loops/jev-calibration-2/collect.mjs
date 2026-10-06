// collect.mjs — every QA run with a report since QA 250, one case PER PR VERDICT (atlas s162, JEV-CAL-2 r2).
//
// What it reads: the headless prompts on origin/master (the QA numbers), each run's own text (resolve.mjs: prefix ->
// report branch -> report file), and each report's verdict table or verdict lines (verdicts.mjs). It never takes a
// report branch from a dispatch file name, and it never fills in a head it cannot read.
//
// Output: collect.json (cases, unresolved, runs, pool), pool.json (counts), dispatches.json (plan pointers).
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { git, gitDeps, writeJson, MIN_QA, HERE } from "./lib.mjs";
import { qaRuns, resolveRun, LOOPS } from "./resolve.mjs";
import { parseVerdicts } from "./verdicts.mjs";
import { derivePlanFromDispatch } from "./dispatch-derive.mjs";
import { leakHitsFromPlan } from "./leak.mjs";

const same = (a, b) => a.startsWith(b) || b.startsWith(a);
const clean = (s) => s.replace(/[*`]/g, "").replace(/\s+/g, " ").trim();

/** Sections of a markdown text whose HEADING names `needle` (a regexp), each with its sub-sections. */
export function sectionsNaming(text, needle) {
  const lines = text.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const h = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (!h || !needle.test(h[2])) continue;
    const level = h[1].length;
    let j = i + 1;
    while (j < lines.length) {
      const n = /^(#{1,6})\s/.exec(lines[j]);
      if (n && n[1].length <= level) break;
      j++;
    }
    out.push({ heading: clean(h[2]), level, text: lines.slice(i, j).join("\n") });
    i = j - 1;
  }
  return out;
}

const needleFor = (row) => {
  if (row.kind === "pr") return new RegExp(`${row.item}(?!\\d)`);
  return new RegExp(`(?<![\\w-])${row.item.replace("-", "[-]?")}(?![\\w])`, "i");
};

/**
 * Where the plan written before the work comes from, tried in this order; the first whose text yields a plan
 * (derivePlanFromDispatch) is the plan. A case none of them serves is kept and tagged no-plan.
 *   1. task-brief: a brief on master whose file name starts with the task's number ("t152-brief.md"), when exactly one does;
 *   2. qa-dispatch-section: the QA dispatch's sections (below the title) whose heading names the PR, the rows for that PR;
 *   3. qa-dispatch-whole: a QA dispatch whose TITLE names the PR, or the dispatch of a run with exactly one case. It is
 *      shared by every case of the run, and the case says how many.
 */
export function planCandidates(row, run, caseCountInRun, deps) {
  const out = [];
  const why = [];
  const task = row.task ?? (row.kind === "task" ? row.item : null);
  const num = task ? /^[TG]-(\d+)/.exec(task)?.[1] : null;
  if (num !== null && num !== undefined) {
    const re = new RegExp(`^${task[0].toLowerCase()}0*${Number(num)}[a-z]?-.*brief.*\.md$`);
    const hits = deps.masterFiles().filter((f) => re.test(f));
    if (hits.length === 1) {
      const path = `${LOOPS}/${hits[0]}`;
      out.push({ source: "task-brief", path, headings: [], text: deps.masterShow(path) ?? "" });
    } else if (hits.length > 1) why.push(`${hits.length} briefs match ${task}: ${hits.join(", ")}`);
  }
  for (const path of run.dispatch_paths) {
    const text = deps.masterShow(path);
    if (text === null) continue;
    const named = sectionsNaming(text, needleFor(row));
    // A title (level 1) that lists every PR of the batch names this PR without being ITS rows: that is the whole dispatch.
    const secs = named.filter((x) => x.level > 1);
    if (secs.length > 0) {
      const body = `# ${row.item} ${secs[0].heading}\n${secs.map((x) => x.text.replace(/^#{1,6}[^\n]*\n/, "")).join("\n")}`;
      out.push({ source: "qa-dispatch-section", path, headings: secs.map((x) => x.heading), text: body });
    } else if (named.length > 0 || caseCountInRun === 1) {
      out.push({ source: "qa-dispatch-whole", path, headings: named.map((x) => x.heading), text, shared_with_cases: caseCountInRun });
    }
  }
  return { candidates: out, why };
}

export function planFor(row, run, caseCountInRun, deps) {
  const { candidates, why } = planCandidates(row, run, caseCountInRun, deps);
  for (const c of candidates) {
    const derived = derivePlanFromDispatch(c.text, { case_no: run.qa_no, case_id: row.item, dispatch_path: c.path, dispatch_blob: "" });
    if (derived !== null) return { tag: "plan", ...c, derived, tried: [] };
    why.push(`${c.path} (${c.source}) has no task list or table to derive a plan from`);
  }
  return { tag: "no-plan", source: null, path: null, headings: [], text: null, derived: null, why: why.length > 0 ? why.join("; ") : "no brief matches its task and no dispatch names it" };
}

function provenanceOf(text) {
  if (/\bruntime-built\b/i.test(text) && !/\b0\s+runtime-built\b/i.test(text)) return "runtime-built";
  return "seat-built";
}

function checksHint(text) {
  const buildOk = /(?:build|npm run build)[^\n]{0,80}\bexit\s+0\b/i.test(text) || /"build"[^}]*"exit_code"\s*:\s*0/.test(text);
  const unitOk = /(?:unit|vitest|npm test)[^\n]{0,80}\bexit\s+0\b/i.test(text) || /"unit"[^}]*"exit_code"\s*:\s*0/.test(text);
  if (buildOk && unitOk) return { checks: "recorded", source: "qa-report", build_exit: 0, unit_exit: 0 };
  return { checks: "none", source: "none", build_exit: 1, unit_exit: 1 };
}

/** Calibration 1's 67 scored cases (44 headline + 23 leak group), by candidate commit. */
export function cal1Seen() {
  const dir = resolve(HERE, "../jev-calibration-1");
  const sample = JSON.parse(readFileSync(resolve(dir, "sample.json"), "utf-8"));
  const coll = JSON.parse(readFileSync(resolve(dir, "collect.json"), "utf-8"));
  const scored = new Set([...sample.headline, ...sample.leak_group]);
  return {
    scored: coll.cases.filter((c) => scored.has(c.case_id)).map((c) => c.candidate_sha),
    collected_unscored: coll.cases.filter((c) => !scored.has(c.case_id)).map((c) => c.candidate_sha),
  };
}

/**
 * Pairs: a PR REJECTed in one QA run and ACCEPTed in a later one. A PR still rejected is not a pair. A task-level row
 * (a report that names no PR) joins a PR's group only when that task id belongs to exactly one PR across the whole pool.
 */
export function tagPairs(cases) {
  const prsOfTask = new Map();
  for (const c of cases) if (c.pr && c.task) prsOfTask.set(c.task, new Set([...(prsOfTask.get(c.task) ?? []), c.pr]));
  const keyOf = (c) => {
    if (c.pr) return { key: c.pr, how: "pr" };
    const prs = c.task ? prsOfTask.get(c.task) : undefined;
    if (prs && prs.size === 1) return { key: [...prs][0], how: `task ${c.task} belongs to one PR only` };
    return { key: c.task ?? c.items[0], how: "task" };
  };
  const groups = new Map();
  for (const c of cases) {
    const k = keyOf(c);
    c.pair_key = k.key;
    c.pair_key_how = k.how;
    groups.set(k.key, [...(groups.get(k.key) ?? []), c]);
  }
  const pairs = [];
  for (const [key, list] of groups) {
    const ordered = [...list].sort((a, b) => a.qa_no - b.qa_no);
    for (const r of ordered.filter((c) => c.label === "REJECT")) {
      const fixed = ordered.find((c) => c.label === "ACCEPT" && c.qa_no > r.qa_no);
      if (fixed) pairs.push({ pair_key: key, rejected: r.case_id, fixed: fixed.case_id, rejected_qa: r.qa_no, fixed_qa: fixed.qa_no });
    }
  }
  const role = new Map();
  for (const p of pairs) {
    role.set(p.rejected, [...(role.get(p.rejected) ?? []), `rejected-then-fixed (fixed in ${p.fixed})`]);
    role.set(p.fixed, [...(role.get(p.fixed) ?? []), `fix of ${p.rejected}`]);
  }
  for (const c of cases) c.pair = role.get(c.case_id) ?? [];
  return pairs;
}

/**
 * @param {ReturnType<typeof gitDeps>} deps
 * @param {{ minQa?: number, commitOf?: (h: string) => string|null, cal1?: { scored: string[], collected_unscored: string[] },
 *   baseOf?: (c: object) => object }} [opts]
 */
export function collectCases(deps, opts = {}) {
  const minQa = opts.minQa ?? MIN_QA;
  const commitOf = opts.commitOf ?? ((h) => {
    const out = git(["rev-parse", "--verify", "--quiet", `${h}^{commit}`], { allowFail: true });
    return out === null || out.trim() === "" ? null : out.trim();
  });
  const cal1 = opts.cal1 ?? { scored: [], collected_unscored: [] };
  const runNumbers = qaRuns(deps, minQa);
  const runs = [];
  const unresolved = [];
  const raw = [];

  for (const n of runNumbers) {
    const run = resolveRun(n, deps);
    runs.push({ qa_no: n, resolved: run.resolved, prefix: run.prefix, prefix_source: run.prefix_source, branch: run.branch, report_path: run.report_path, notes: run.notes, reason: run.reason, cases: 0 });
    const entry = runs[runs.length - 1];
    if (!run.resolved) { unresolved.push({ qa_no: n, scope: "run", prefix: run.prefix, reason: run.reason }); continue; }
    const text = deps.refShow(run.branch, run.report_path) ?? "";
    const { rows, skipped } = parseVerdicts(text);
    if (rows.length === 0) {
      unresolved.push({ qa_no: n, scope: "run", prefix: run.prefix, reason: "report resolved but it has no PR verdict rows (no verdict table and no ACCEPT/REJECT verdict lines naming a PR or task)" });
      continue;
    }
    const usable = [];
    for (const row of rows) {
      if (!row.sha) { unresolved.push({ qa_no: n, scope: "case", item: row.items.join("+"), reason: row.head_note ?? "no head named" }); continue; }
      // A head this checkout does not hold (a deleted PR branch, a shallow clone) is still the report's verdict on that head:
      // the case is kept with the head as the report wrote it and `head_resolved: false`, so the pool counts do not
      // depend on which objects the checkout has. Whoever builds inputs from a case needs the commit and filters on the flag.
      const full = commitOf(row.sha);
      usable.push({ row, sha: full ?? row.sha, head_resolved: full !== null });
    }
    for (const { row, sha, head_resolved } of usable) {
      const plan = planFor(row, run, usable.length, deps);
      const leak_hits = plan.derived ? leakHitsFromPlan(plan.derived) : [];
      raw.push({ qa_no: n, run, row, sha, head_resolved, plan, leak_hits, report: text, skipped_in_report: skipped.length });
      entry.cases++;
    }
  }

  const masterSha = git(["rev-parse", "origin/master"], { allowFail: true })?.trim() ?? null;
  const caseIdOf = (r) => {
    const items = r.row.items.map((i) => (i.startsWith("#") ? `pr${i.slice(1)}` : i.toLowerCase())).join("+");
    return `qa${r.qa_no}-${items}${r.row.round ? `-${r.row.round}` : ""}`;
  };
  raw.sort((a, b) => a.qa_no - b.qa_no || caseIdOf(a).localeCompare(caseIdOf(b)));

  const cases = [];
  for (const r of raw) {
    const dup = cases.find((c) => same(c.candidate_sha, r.sha));
    const id = caseIdOf(r);
    if (dup) {
      unresolved.push({ qa_no: r.qa_no, scope: "case", item: r.row.items.join("+"), reason: `same head ${r.sha.slice(0, 8)} as ${dup.case_id} (QA ${dup.qa_no}, ${dup.label}); the earlier verdict stands${dup.label !== r.row.label ? `. LATER RUN DISAGREES: ${r.row.label ?? "unlabelled"}` : ""}` });
      continue;
    }
    const pr = r.row.kind === "pr" ? Number(r.row.item.slice(1)) : null;
    const dispatchPath = r.plan.tag === "plan" && r.plan.source !== "task-brief" ? r.plan.path : null;
    cases.push({
      case_id: cases.some((c) => c.case_id === id) ? `${id}-${r.sha.slice(0, 7)}` : id,
      qa_no: r.qa_no,
      pr,
      items: r.row.items,
      task: r.row.task,
      round: r.row.round,
      candidate_sha: r.sha,
      head_resolved: r.head_resolved,
      head_from: r.row.sha_from,
      label: r.row.label,
      verdict_text: r.row.verdict_text,
      conflict: r.row.conflict === true,
      provenance: provenanceOf(r.report),
      provenance_from: "report text (a case is runtime-built only when its report says so)",
      leak_group: r.leak_hits.length > 0,
      leak_hits: r.leak_hits,
      plan: r.plan.tag,
      plan_source: r.plan.source,
      plan_path: r.plan.path,
      plan_blob: r.plan.path ? (git(["rev-parse", `origin/master:${r.plan.path}`], { allowFail: true })?.trim() ?? null) : null,
      plan_headings: r.plan.headings,
      plan_why: r.plan.why ?? null,
      plan_shared_with_cases: r.plan.shared_with_cases ?? 1,
      cal1_seen: cal1.scored.some((s) => same(s, r.sha)),
      cal1_collected_unscored: cal1.collected_unscored.some((s) => same(s, r.sha)),
      checks_hint: checksHint(r.report),
      dispatch_path: dispatchPath,
      dispatch_commit: masterSha,
      qa_report_ref: { path: r.run.report_path, ref: r.run.branch, commit: git(["rev-parse", r.run.branch], { allowFail: true })?.trim() ?? null },
      prefix: r.run.prefix,
    });
  }
  const pairs = tagPairs(cases);
  cases.forEach((c, i) => { c.case_no = i + 1; });

  const isAncestor = (a, b) => git(["merge-base", "--is-ancestor", a, b], { allowFail: true }) !== null;
  for (const c of cases) {
    if (!c.head_resolved) { c.merged = false; c.merge_commit = null; c.base_sha = null; c.base_how = "head not in this checkout"; continue; }
    const onMaster = isAncestor(c.candidate_sha, "origin/master");
    const merge = onMaster ? git(["rev-list", "-n", "1", "--first-parent", `${c.candidate_sha}..origin/master`], { allowFail: true })?.trim() ?? null : null;
    c.merged = merge !== null && merge !== "";
    c.merge_commit = c.merged ? merge : c.candidate_sha;
    if (c.merged && merge) {
      const parent = git(["rev-parse", `${merge}^1`], { allowFail: true })?.trim();
      c.base_sha = parent ? git(["merge-base", c.candidate_sha, parent], { allowFail: true })?.trim() ?? null : null;
      c.base_how = "merge-parent";
    } else {
      c.base_sha = git(["merge-base", c.candidate_sha, "origin/master"], { allowFail: true })?.trim() ?? null;
      c.base_how = "origin/master";
    }
  }

  const count = (f) => cases.filter(f).length;
  const heldOut = cases.filter((c) => !c.leak_group && !c.cal1_seen && c.label !== null);
  const pool = {
    total: cases.length,
    ACCEPT: count((c) => c.label === "ACCEPT"),
    REJECT: count((c) => c.label === "REJECT"),
    unlabelled: count((c) => c.label === null),
    leak_group: count((c) => c.leak_group),
    headline_pool: count((c) => !c.leak_group),
    seat_built: count((c) => c.provenance === "seat-built"),
    runtime_built: count((c) => c.provenance === "runtime-built"),
    checks_recorded: count((c) => c.checks_hint.checks === "recorded"),
    checks_none: count((c) => c.checks_hint.checks === "none"),
    plan: count((c) => c.plan === "plan"),
    no_plan: count((c) => c.plan === "no-plan"),
    plan_by_source: Object.fromEntries(["qa-dispatch-section", "qa-dispatch-whole", "task-brief"].map((s) => [s, count((c) => c.plan_source === s)])),
    heads_unresolved: count((c) => !c.head_resolved),
    cal1_seen: count((c) => c.cal1_seen),
    cal1_collected_unscored: count((c) => c.cal1_collected_unscored),
    pairs: pairs.length,
    pair_prs: new Set(pairs.map((p) => p.pair_key)).size,
    pair_cases: count((c) => c.pair.length > 0),
    held_out_candidates: {
      total: heldOut.length,
      ACCEPT: heldOut.filter((c) => c.label === "ACCEPT").length,
      REJECT: heldOut.filter((c) => c.label === "REJECT").length,
      with_plan: heldOut.filter((c) => c.plan === "plan").length,
      no_plan: heldOut.filter((c) => c.plan === "no-plan").length,
      rule: "labelled ACCEPT or REJECT, not in the leak group, not cal1-seen",
    },
    runs_considered: runs.length,
    runs_resolved: runs.filter((r) => r.resolved).length,
    runs_with_cases: runs.filter((r) => r.cases > 0).length,
    unresolved: unresolved.length,
    min_qa: minQa,
    max_qa: runNumbers.length > 0 ? runNumbers[runNumbers.length - 1] : null,
  };
  return { cases, pool, pairs, runs, unresolved, masterSha };
}

export function runCollect() {
  const deps = gitDeps();
  const out = collectCases(deps, { cal1: cal1Seen() });
  writeJson("collect.json", { origin_master: out.masterSha, min_qa: out.pool.min_qa, max_qa: out.pool.max_qa, runs: out.runs, cases: out.cases, pairs: out.pairs, unresolved: out.unresolved, pool: out.pool });
  writeJson("pool.json", out.pool);
  writeJson("dispatches.json", out.cases.map((c) => ({ case_id: c.case_id, case_no: c.case_no, dispatch_path: c.dispatch_path, dispatch_commit: c.dispatch_commit, dispatch_blob: c.plan_blob, plan: c.plan, plan_source: c.plan_source, plan_path: c.plan_path })));
  const p = out.pool;
  console.log(`collect: ${p.total} case(s) from ${p.runs_with_cases}/${p.runs_considered} QA runs (QA ${p.min_qa}..${p.max_qa}), ACCEPT ${p.ACCEPT} REJECT ${p.REJECT} unlabelled ${p.unlabelled}, leak ${p.leak_group}, plan ${p.plan} / no-plan ${p.no_plan}, cal1-seen ${p.cal1_seen}, pairs ${p.pairs}, held-out candidates ${p.held_out_candidates.total} (ACCEPT ${p.held_out_candidates.ACCEPT}, REJECT ${p.held_out_candidates.REJECT}), unresolved ${p.unresolved}`);
  return out;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) runCollect();
