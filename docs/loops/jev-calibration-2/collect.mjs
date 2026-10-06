// collect.mjs — every QA run with a report since QA 250, one case PER PR VERDICT (atlas s162, JEV-CAL-2 r2).
//
// What it reads: the headless prompts on origin/master (the QA numbers), each run's own text (resolve.mjs: prefix ->
// report branch -> report file), and each report's verdict table or verdict lines (verdicts.mjs). It never takes a
// report branch from a dispatch file name, and it never fills in a head it cannot read.
//
// Output: collect.json (cases, unresolved, runs, pool), pool.json (counts), dispatches.json (plan pointers).
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";
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
 * The base and merge commit of a case's candidate head.
 *   merged (the head is an ancestor of origin/master): the commit that brought it into master's first-parent line is the
 *   OLDEST commit of `head..master` on that line; the base is the merge-base of the head with that commit's FIRST
 *   parent, which is where the PR forked from master. (r2 took the NEWEST commit of that range, whose parent descends
 *   from the head, so base and candidate came out equal for 66 of 88 cases.)
 *   not merged: the merge-base of the head with origin/master.
 */
export function baseFor(cand, resolved) {
  if (!resolved) return { merged: false, merge_commit: null, base_sha: null, base_how: "head not in this checkout" };
  const onMaster = git(["merge-base", "--is-ancestor", cand, "origin/master"], { allowFail: true }) !== null;
  if (!onMaster) {
    return { merged: false, merge_commit: cand, base_sha: git(["merge-base", cand, "origin/master"], { allowFail: true })?.trim() ?? null, base_how: "merge-base with origin/master (not merged)" };
  }
  // Oldest-first merge commits that descend from the head. The one that brought the head in is the first whose first parent
  // does NOT hold the head and another parent does. (`--first-parent --ancestry-path` together return nothing for a head
  // that entered master through a second parent, which is every PR head.)
  const merges = (git(["rev-list", "--ancestry-path", "--merges", "--topo-order", "--reverse", `${cand}..origin/master`], { allowFail: true }) ?? "").trim().split("\n").filter(Boolean);
  const holds = (a, b) => git(["merge-base", "--is-ancestor", a, b], { allowFail: true }) !== null;
  let merge = null;
  let parents = [];
  for (const m of merges) {
    const ps = (git(["rev-list", "--parents", "-n", "1", m], { allowFail: true }) ?? "").trim().split(" ").slice(1);
    if (ps.length >= 2 && !holds(cand, ps[0]) && ps.slice(1).some((q) => holds(cand, q))) { merge = m; parents = ps; break; }
  }
  if (merge === null) {
    // No merge commit brought it in: a fast-forward or a squash left the head on master's line itself.
    const next = (git(["rev-list", "--first-parent", "--reverse", "-n", "1", `${cand}..origin/master`], { allowFail: true }) ?? "").trim();
    if (next === "") return { merged: true, merge_commit: cand, base_sha: null, base_how: "the head is master's tip: nothing brought it in" };
    const ps = (git(["rev-list", "--parents", "-n", "1", cand], { allowFail: true }) ?? "").trim().split(" ").slice(1);
    return { merged: true, merge_commit: next, base_sha: ps[0] ?? null, base_how: "no merge commit (fast-forward or squash): the head's own parent" };
  }
  if (parents.length >= 2) {
    return { merged: true, merge_commit: merge, base_sha: git(["merge-base", cand, parents[0]], { allowFail: true })?.trim() ?? null, base_how: "merge-commit first parent, merge-base with the head" };
  }
  return { merged: true, merge_commit: merge, base_sha: parents[0] ?? null, base_how: "single-parent commit on master's first-parent line: its parent" };
}

/** The size and paths of base..candidate, or null when either end is missing. */
export function diffOf(c) {
  if (!c.head_resolved || !c.base_sha) return { diff: null };
  const out = git(["diff", "--numstat", c.base_sha, c.candidate_sha], { allowFail: true });
  if (out === null) return { diff: null };
  const rows = out.trim().split("\n").filter(Boolean).map((l) => l.split("\t"));
  const num = (x) => (/^\d+$/.test(x) ? Number(x) : 0);
  return { diff: { files: rows.length, insertions: rows.reduce((a, r) => a + num(r[0]), 0), deletions: rows.reduce((a, r) => a + num(r[1]), 0), paths: rows.map((r) => r[2]).slice(0, 300) } };
}

/** Is the base a real base: not the candidate itself, and a diff that holds something? */
export const baseOk = (c) => c.base_sha !== null && c.base_sha !== c.candidate_sha && c.diff !== null && c.diff.files > 0;

/** Does the diff touch the PR's files (as `gh pr view --json files` lists them, recorded in gh-facts.json)? */
export function prFilesCheck(c, prFiles) {
  if (c.pr === null) return { checked: false, reason: "the report names a task, not a PR" };
  if (prFiles === null) return { checked: false, reason: "no PR file list recorded (run gh-facts.mjs)" };
  if (c.diff === null) return { checked: false, reason: "no diff" };
  const set = new Set(prFiles);
  const overlap = c.diff.paths.filter((p) => set.has(p)).length;
  return { checked: true, pr_files: prFiles.length, diff_files: c.diff.files, overlap, ok: overlap > 0 };
}

export function loadFacts() {
  const p = resolve(HERE, "gh-facts.json");
  if (!existsSync(p)) return { fetched_at: null, checks: {}, pr_files: {} };
  return JSON.parse(readFileSync(p, "utf-8"));
}

/** Build/unit exit codes from the CI test job: success is 0 and 0; a failed job is read from its steps. */
export function checksFor(c, facts) {
  const none = (reason) => ({ checks: "none", source: "none", reason, build_exit: 1, unit_exit: 1 });
  if (!c.head_resolved) return none("head not in this checkout, so no CI run could be looked up");
  const f = facts.checks?.[c.candidate_sha];
  if (!f) return none("no CI facts recorded for this head (run gh-facts.mjs)");
  if (f.none) return none(f.reason);
  if (f.test_job !== "success" && f.test_job !== "failure") return none(`CI run ${f.run_id}: the test job is ${f.test_job}, not a finished pass or fail`);
  const stepExit = (re) => {
    const hit = (f.steps ?? []).filter((s) => re.test(s.name));
    if (hit.length === 0) return null;
    return hit.every((s) => s.conclusion === "success") ? 0 : hit.some((s) => s.conclusion === "failure") ? 1 : null;
  };
  const ok = f.test_job === "success";
  return {
    checks: "recorded", source: "ci", ci_run_id: f.run_id, ci_event: f.event, test_job: f.test_job, runs_found: f.runs_found,
    build_exit: ok ? 0 : stepExit(/^(build|typecheck)\b(?!.*tests)/i),
    unit_exit: ok ? 0 : stepExit(/^(test|run (unit )?tests?)$/i),
  };
}

const quantile = (sorted, q) => (sorted.length === 0 ? null : sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1) + 0.5))]);
export function distribution(values) {
  const v = [...values].sort((a, b) => a - b);
  return { n: v.length, min: v[0] ?? null, p25: quantile(v, 0.25), median: quantile(v, 0.5), p75: quantile(v, 0.75), p90: quantile(v, 0.9), max: v[v.length - 1] ?? null };
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
  const conflicts = [];
  for (const r of raw) {
    const dup = cases.find((c) => same(c.candidate_sha, r.sha));
    const id = caseIdOf(r);
    if (dup) {
      if (dup.label !== r.row.label) {
        // The same head, two verdicts: the label is disputed, the case stays out of the held-out candidates.
        dup.label_disputed = true;
        conflicts.push({ candidate_sha: dup.candidate_sha, case_id: dup.case_id, kept: { qa_no: dup.qa_no, label: dup.label, verdict_text: dup.verdict_text }, other: { qa_no: r.qa_no, label: r.row.label, verdict_text: r.row.verdict_text } });
      }
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
      label_disputed: r.row.conflict === true,
      cal1_seen: cal1.scored.some((s) => same(s, r.sha)),
      cal1_collected_unscored: cal1.collected_unscored.some((s) => same(s, r.sha)),
      checks_hint: null,
      dispatch_path: dispatchPath,
      dispatch_commit: masterSha,
      qa_report_ref: { path: r.run.report_path, ref: r.run.branch, commit: git(["rev-parse", r.run.branch], { allowFail: true })?.trim() ?? null },
      prefix: r.run.prefix,
    });
  }
  const pairs = tagPairs(cases);
  cases.forEach((c, i) => { c.case_no = i + 1; });

  const facts = opts.facts ?? loadFacts();
  for (const c of cases) {
    Object.assign(c, baseFor(c.candidate_sha, c.head_resolved));
    Object.assign(c, diffOf(c));
    c.checks_hint = checksFor(c, facts);
    const prFiles = c.pr !== null ? facts.pr_files?.[String(c.pr)] ?? null : null;
    c.pr_files_check = prFilesCheck(c, prFiles);
  }

  const count = (f) => cases.filter(f).length;
  const heldOut = cases.filter((c) => !c.leak_group && !c.cal1_seen && !c.label_disputed && c.label !== null);
  const withDiff = cases.filter((c) => c.diff !== null);
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
      rule: "labelled ACCEPT or REJECT, not in the leak group, not cal1-seen, label not disputed",
    },
    conflicts: conflicts.length,
    label_disputed: count((c) => c.label_disputed),
    base_invariant_failures: count((c) => c.head_resolved && !baseOk(c)),
    diff_files: distribution(withDiff.map((c) => c.diff.files)),
    diff_lines: distribution(withDiff.map((c) => c.diff.insertions + c.diff.deletions)),
    pr_files_checked: count((c) => c.pr_files_check.checked),
    pr_files_failed: count((c) => c.pr_files_check.checked && !c.pr_files_check.ok),
    checks_by_test_job: Object.fromEntries([...new Set(cases.map((c) => c.checks_hint.test_job ?? "none"))].sort().map((k) => [k, count((c) => (c.checks_hint.test_job ?? "none") === k)])),
    runs_considered: runs.length,
    runs_resolved: runs.filter((r) => r.resolved).length,
    runs_with_cases: runs.filter((r) => r.cases > 0).length,
    unresolved: unresolved.length,
    min_qa: minQa,
    max_qa: runNumbers.length > 0 ? runNumbers[runNumbers.length - 1] : null,
  };
  return { cases, pool, pairs, conflicts, runs, unresolved, masterSha, facts_fetched_at: facts.fetched_at };
}

export function runCollect() {
  const deps = gitDeps();
  const out = collectCases(deps, { cal1: cal1Seen() });
  writeJson("collect.json", { origin_master: out.masterSha, min_qa: out.pool.min_qa, max_qa: out.pool.max_qa, runs: out.runs, cases: out.cases, pairs: out.pairs, conflicts: out.conflicts, unresolved: out.unresolved, gh_facts_fetched_at: out.facts_fetched_at, pool: out.pool });
  writeJson("pool.json", out.pool);
  writeJson("dispatches.json", out.cases.map((c) => ({ case_id: c.case_id, case_no: c.case_no, dispatch_path: c.dispatch_path, dispatch_commit: c.dispatch_commit, dispatch_blob: c.plan_blob, plan: c.plan, plan_source: c.plan_source, plan_path: c.plan_path })));
  const p = out.pool;
  console.log(`collect: ${p.total} case(s) from ${p.runs_with_cases}/${p.runs_considered} QA runs (QA ${p.min_qa}..${p.max_qa}), ACCEPT ${p.ACCEPT} REJECT ${p.REJECT} unlabelled ${p.unlabelled}, leak ${p.leak_group}, plan ${p.plan} / no-plan ${p.no_plan}, cal1-seen ${p.cal1_seen}, pairs ${p.pairs}, held-out candidates ${p.held_out_candidates.total} (ACCEPT ${p.held_out_candidates.ACCEPT}, REJECT ${p.held_out_candidates.REJECT}), unresolved ${p.unresolved}`);
  // The invariant: a resolved head has a base that is not the head, and base..head holds a diff. A case that fails it would
  // hand Jev an empty diff. The outputs are written first so the failing cases can be read.
  const bad = out.cases.filter((c) => c.head_resolved && !baseOk(c));
  if (bad.length > 0) {
    console.error(`collect: base invariant FAILED for ${bad.length} case(s): ${bad.map((c) => `${c.case_id} (${c.base_how})`).join("; ")}`);
    process.exitCode = 1;
  }
  return out;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) runCollect();
