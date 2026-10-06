// inputs.mjs — offline G_done requests for Jev calibration 2 (no live call).
//   node open-brain/node_modules/tsx/dist/cli.mjs docs/loops/jev-calibration-2/inputs.mjs
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HERE, REPO, POLICY_REL, git, readJson, stable, writeJson } from "./lib.mjs";
import { derivePlanFromDispatch } from "./dispatch-derive.mjs";
import { leakHitsFromPlan, leakHitsFromRequest } from "./leak.mjs";
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
  const diff = gitFn(["diff", `${base}..${candidate}`, "-U3"], { allowFail: true }) ?? "";
  if (diff.trim() === "") return { refuse: "empty-diff" };
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
  const plan = v.value;
  if (!plan.acceptance?.length) return { refuse: "plan-no-rows" };
  const hint = c.checks_hint ?? { checks: "none", source: "none", build_exit: 1, unit_exit: 1 };
  const checks = {
    source: hint.source ?? "none",
    build: { exit_code: hint.build_exit ?? 1 },
    unit: { exit_code: hint.unit_exit ?? 1 },
  };
  let diffstat;
  try {
    diffstat = committedPaths(repoRoot, base, candidate);
  } catch {
    return { refuse: "diffstat-failed" };
  }
  const diffHunks = diff.slice(0, 16_000);
  const requirementRows = plan.acceptance.map((row) => ({
    id: row.id,
    observable: row.observable,
    hunks: diffHunks ? [diffHunks] : [],
  }));
  const payload = {
    gate: "developer-done",
    loop: plan.loop,
    model: "jev-latest",
    questions: buildDoneGateQuestions(plan, policy),
    context: {
      plan,
      candidate,
      diffstat,
      requirement_rows: requirementRows,
      checks,
      prior_failures: [...(plan.repair_targets ?? [])],
      scored_diff: {
        pr: c.pr ?? c.case_no,
        base_sha: base,
        scored_sha: candidate,
        merge_commit: c.merge_commit ?? candidate,
      },
    },
  };
  const request = buildJevRequest(payload);
  const leak_hits = leakHitsFromRequest(request);
  const plan_leak_hits = leakHitsFromPlan(plan);
  return {
    request,
    leak_hits,
    plan_leak_hits,
    meta: {
      case_id: c.case_id,
      case_no: c.case_no,
      label: c.label,
      base_sha: base,
      candidate_sha: candidate,
      merge_commit: c.merge_commit,
      policy: POLICY_REL,
      checks_hint: hint,
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
    const leak_hits = [...new Set([...(r.leak_hits ?? []), ...(r.plan_leak_hits ?? [])])].sort();
    if (leak_hits.length > 0) excluded_leak.push({ case_id, leak_hits });
    const file = `${String(c.case_no).padStart(3, "0")}-${c.case_id}.G_done-request.json`;
    writeFileSync(join(dir, file), stable({ ...r.meta, leak_hits, request: r.request }));
    built.push({
      case_id,
      case_no: c.case_no,
      label: c.label,
      file: `inputs/${file}`,
      eligible: isEligibleCase(c),
      leak_excluded: leak_hits.length > 0,
    });
  }
  built.sort((a, b) => a.case_no - b.case_no);
  const out = { built, refused, excluded_leak, policy: POLICY_REL, split_seed: split.seed };
  writeJson("inputs.json", out);
  console.log(
    `inputs: ${built.length} built, ${refused.length} refused, ${excluded_leak.length} leak-excluded (split ${caseIds.size} case ids)`,
  );
  return out;
}

const mainScript = [process.argv[1], process.argv[2]].find((a) => a?.endsWith("inputs.mjs"));
const isMain = mainScript && fileURLToPath(import.meta.url) === resolve(mainScript);
if (isMain) runInputs();
