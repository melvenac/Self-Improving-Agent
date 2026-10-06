// inputs.mjs — offline G_done requests for Jev calibration 2 (no live call).
//   node open-brain/node_modules/tsx/dist/cli.mjs docs/loops/jev-calibration-2/inputs.mjs
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HERE, REPO, POLICY_REL, git, readJson, stable, writeJson } from "./lib.mjs";
import { derivePlanFromDispatch } from "./dispatch-derive.mjs";
import { filterPathList, filterUnifiedDiff } from "./diff-filter.mjs";
import { requirementRowsWithHunks, trimRequirementRows } from "./diff-hunks.mjs";
import { CAL2_MAX_WIRE_BYTES, sliceTopLevelRequestBytes } from "../../../open-brain/src/harness/cal2-frozen.ts";
import {
  leakHitsDetailedFromRequestDiff,
  leakHitsFromRequest,
  redactPlanVerdictSentences,
  verdictLeaksFromDiffText,
} from "./leak.mjs";
import { validatePlan } from "../../../open-brain/src/harness/schema.ts";
import { buildDoneGateQuestions, buildJevRequest } from "../../../open-brain/src/harness/gate.ts";
import { committedPaths } from "../../../open-brain/src/harness/git.ts";

export { POLICY_REL } from "./lib.mjs";

export function isEligibleCase(c) {
  return (
    (c.label === "ACCEPT" || c.label === "REJECT") &&
    !c.leak_group &&
    !c.cal1_seen &&
    !c.label_disputed &&
    c.head_resolved
  );
}

export function buildGDoneRequestForCase(c, policy, { gitFn = git, repoRoot = REPO } = {}) {
  const base = c.base_sha;
  const candidate = c.candidate_sha;
  if (!base || !candidate) return { refuse: "missing-sha" };
  if (base === candidate) return { refuse: "empty-diff-range" };
  const rawDiff = gitFn(["diff", `${base}..${candidate}`, "-U3"], { allowFail: true }) ?? "";
  if (rawDiff.trim() === "") return { refuse: "empty-diff" };
  const { diff, excluded_paths: diff_paths_excluded } = filterUnifiedDiff(rawDiff);
  const diffPathsExcluded = diff_paths_excluded;
  if (diff.trim() === "") return { refuse: "empty-diff-after-filter", diff_paths_excluded };
  const planText =
    (c.plan_blob ? gitFn(["cat-file", "-p", c.plan_blob], { allowFail: true }) : null) ??
    (c.plan_path && c.dispatch_commit ? gitFn(["show", `${c.dispatch_commit}:${c.plan_path}`], { allowFail: true }) : null);
  if (!planText) return { refuse: "plan-unreadable" };
  const derived = derivePlanFromDispatch(planText, {
    case_no: c.case_no ?? c.qa_no ?? 0,
    case_id: c.case_id,
    dispatch_path: c.plan_path ?? c.dispatch_path,
    dispatch_blob: c.plan_blob ?? "",
  });
  if (!derived) return { refuse: "plan-no-rows" };
  const v = validatePlan(derived);
  if (!v.ok) return { refuse: `plan-invalid: ${v.problems.slice(0, 2).join("; ")}` };
  let plan = v.value;
  if (!plan.acceptance?.length) return { refuse: "plan-no-rows" };
  const { plan: redactedPlan, redacted_sentences } = redactPlanVerdictSentences(plan);
  plan = redactedPlan;
  const vRed = validatePlan(plan);
  if (!vRed.ok) return { refuse: `plan-invalid-after-redaction: ${vRed.problems.slice(0, 2).join("; ")}`, redacted_sentences };
  plan = vRed.value;
  if (!plan.acceptance?.length) return { refuse: "plan-no-rows-after-redaction", redacted_sentences };
  const hint = c.checks_hint ?? { checks: "none", source: "none", build_exit: 1, unit_exit: 1 };
  const checks = {
    source: hint.source ?? "none",
    build: { exit_code: hint.build_exit ?? 1 },
    unit: { exit_code: hint.unit_exit ?? 1 },
  };
  let diffstat;
  try {
    const allPaths = committedPaths(repoRoot, base, candidate);
    diffstat = filterPathList(allPaths).paths;
  } catch {
    return { refuse: "diffstat-failed" };
  }
  let requirementRows = requirementRowsWithHunks(plan, diff, diffstat);
  const payloadFor = (rows) => ({
    gate: "developer-done",
    loop: plan.loop,
    model: "jev-latest",
    questions: buildDoneGateQuestions(plan, policy),
    context: {
      plan,
      candidate,
      diffstat,
      requirement_rows: rows,
      checks,
      prior_failures: [...(plan.repair_targets ?? [])],
      scored_diff: {
        pr: c.pr ?? c.case_no,
        base_sha: base,
        scored_sha: candidate,
        merge_commit: c.merge_commit ?? candidate,
      },
    },
  });
  const wireBytesFor = (request, meta) => {
    const file = stable({ ...meta, leak_hits: [], leak_details: [], request });
    return sliceTopLevelRequestBytes(file).length;
  };
  const metaStub = {
    case_id: c.case_id,
    case_no: c.case_no,
    label: c.label,
    base_sha: base,
    candidate_sha: candidate,
    merge_commit: c.merge_commit,
    policy: POLICY_REL,
    checks_hint: hint,
    diff_paths_excluded: diffPathsExcluded,
    plan_redacted_sentences: redacted_sentences,
  };
  let perRowBudget = 16_000;
  let request;
  let wireBytes = Infinity;
  for (let pass = 0; pass < 40 && wireBytes > CAL2_MAX_WIRE_BYTES; pass += 1) {
    requirementRows = trimRequirementRows(requirementRowsWithHunks(plan, diff, diffstat), perRowBudget);
    request = buildJevRequest(payloadFor(requirementRows));
    wireBytes = wireBytesFor(request, metaStub);
    if (wireBytes <= CAL2_MAX_WIRE_BYTES) break;
    perRowBudget = Math.max(400, Math.floor(perRowBudget * 0.82));
  }
  if (wireBytes > CAL2_MAX_WIRE_BYTES) {
    return { refuse: `request-wire-exceeds-${CAL2_MAX_WIRE_BYTES}`, wire_bytes: wireBytes };
  }
  const diffHunksSample = requirementRows.flatMap((r) => r.hunks).join("\n").slice(0, 16_000);
  const leak_hits = leakHitsFromRequest(request);
  const leak_details = leakHitsDetailedFromRequestDiff(request);
  const diffLeaksBeforeRecordFilter = verdictLeaksFromDiffText(rawDiff.slice(0, 16_000));
  const diffLeaksAfterRecordFilter = verdictLeaksFromDiffText(diffHunksSample);

  return {
    request,
    leak_hits,
    leak_details,
    diffLeaksBeforeRecordFilter,
    diffLeaksAfterRecordFilter,
    redacted_sentences,
    meta: {
      case_id: c.case_id,
      case_no: c.case_no,
      label: c.label,
      base_sha: base,
      candidate_sha: candidate,
      merge_commit: c.merge_commit,
      policy: POLICY_REL,
      checks_hint: hint,
      diff_paths_excluded,
      plan_redacted_sentences: redacted_sentences,
    },
  };
}

export function runInputs() {
  const policy = JSON.parse(readFileSync(join(REPO, POLICY_REL), "utf-8"));
  const split = JSON.parse(readFileSync(join(HERE, "../jev-calibration-2-split.json"), "utf-8"));
  const collect = readJson("collect.json");
  const caseIds = new Set([...split.held_out.case_ids, ...split.development.case_ids]);
  const byId = new Map(collect.cases.map((c) => [c.case_id, c]));
  const dir = join(HERE, "inputs");
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) rmSync(join(dir, f));

  const built = [];
  const refused = [];
  const excluded_leak = [];
  const leak_table_before = [];
  const leak_table_after = [];
  const plan_redactions = [];

  for (const case_id of [...caseIds].sort()) {
    const c = byId.get(case_id);
    if (!c) {
      refused.push({ case_id, reason: "not-in-collect" });
      continue;
    }
    const r = buildGDoneRequestForCase(c, policy);
    if (r.refuse) {
      refused.push({ case_id, reason: r.refuse });
      continue;
    }
    const leak_hits = [...new Set(r.leak_hits ?? [])].sort();
    const beforeDetails = r.diffLeaksBeforeRecordFilter ?? [];
    const afterDetails = r.diffLeaksAfterRecordFilter ?? r.leak_details ?? [];
    if (beforeDetails.length > 0) {
      leak_table_before.push({ case_id, hits: beforeDetails });
    }
    if (afterDetails.length > 0) {
      leak_table_after.push({ case_id, hits: afterDetails });
      excluded_leak.push({ case_id, leak_hits, leak_details: afterDetails });
    }
    if ((r.redacted_sentences ?? []).length > 0) {
      plan_redactions.push({ case_id, redacted_sentences: r.redacted_sentences });
    }
    const file = `${String(c.case_no).padStart(3, "0")}-${c.case_id}.G_done-request.json`;
    writeFileSync(
      join(dir, file),
      stable({
        ...r.meta,
        leak_hits,
        leak_details: afterDetails,
        request: r.request,
      }),
    );
    built.push({
      case_id,
      case_no: c.case_no,
      label: c.label,
      file: `inputs/${file}`,
      eligible: isEligibleCase(c),
      leak_excluded: leak_hits.length > 0,
      plan_redacted: (r.redacted_sentences ?? []).length > 0,
    });
  }
  built.sort((a, b) => a.case_no - b.case_no);
  const out = {
    built,
    refused,
    excluded_leak,
    leak_report: {
      before_work_diff_filter: { excluded_case_count: leak_table_before.length, by_case: leak_table_before },
      after_work_diff_filter: { excluded_case_count: leak_table_after.length, by_case: leak_table_after },
      plan_redactions_by_case: plan_redactions,
      plan_redaction_case_count: plan_redactions.length,
    },
    policy: POLICY_REL,
    split_seed: split.seed,
  };
  writeJson("inputs.json", out);
  console.log(
    `inputs: ${built.length} built, ${refused.length} refused, leak-excluded before filter ${leak_table_before.length} after ${leak_table_after.length} (split ${caseIds.size} case ids)`,
  );
  return out;
}

/** @param {{ leak_excluded?: boolean }[]} built */
export function assertNoLeakExcludedInRunlistEntries(entries) {
  const bad = entries.filter((e) => e.leak_excluded);
  if (bad.length > 0) {
    throw new Error(`runlist includes ${bad.length} leak-excluded case(s): ${bad.map((e) => e.case_id).join(", ")}`);
  }
}

const mainScript = [process.argv[1], process.argv[2]].find((a) => a?.endsWith("inputs.mjs"));
const isMain = mainScript && fileURLToPath(import.meta.url) === resolve(mainScript);
if (isMain) runInputs();
