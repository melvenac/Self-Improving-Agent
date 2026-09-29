import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseDeclared } from "./declared.js";
import { git, gitTry, isAncestor } from "./git.js";
import { loadMergePolicy } from "./policies.js";
import { validateEvidence } from "./schema.js";
import type { CheckResult } from "../pipelines/sync/types.js";

/**
 * T-155. A pure verdict, then a prepare/decide pair that records it.
 * The runtime never merges. prepare writes the verdict before Aaron decides.
 *
 * Human-seat loops (CC-29) write under docs/loops/shadow-merge/ so the files
 * are tracked. Runtime loops stay at artifacts/iterations/<loop>/<sha>/.
 */
export type ShadowVerdict = "would-merge" | "would-not-merge" | "undefined";

export interface MergePolicyFlags {
  require_plan_gate: boolean;
  require_done_gate: boolean;
  unmet_is_would_not_merge?: boolean;
  not_evaluated_is_would_not_merge?: boolean;
  partial_is_would_not_merge?: boolean;
  failed_check_is_would_not_merge?: boolean;
  gate_reject_or_halt_is_would_not_merge?: boolean;
}

export interface DeclaredLists {
  unrunnable: string[];
  outOfScope: string[];
}

export interface ShadowVerdictResult {
  verdict: ShadowVerdict;
  reasons: string[];
  declared: DeclaredLists;
}

const NOTE =
  "Zero disagreements is not evidence the gate can be removed. undefined is excluded from evaluated.";

/** A stored git object name. The gate refuses anything else before it writes. */
export function isLowerHexSha(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
}

function requireLowerHexSha(label: string, value: unknown): asserts value is string {
  if (!isLowerHexSha(value)) {
    const shown = typeof value === "string" && value !== "" ? value : "(none)";
    throw new Error(`${label} refuses ${shown}: a sha must be 40 lowercase hex characters`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function computeShadowMergeVerdict(input: {
  evidence: unknown;
  candidateSha: string;
  loop: string;
  criteriaText: string | { error: string };
  policy: MergePolicyFlags;
  doneGate: { verdict: string } | null | "missing";
  planGate: { verdict: string } | null | "missing";
  gateMode: "skip" | "live" | "dry-run";
}): ShadowVerdictResult {
  const empty: DeclaredLists = { unrunnable: [], outOfScope: [] };
  const validated = validateEvidence(input.evidence);
  if (!validated.ok) {
    return { verdict: "undefined", reasons: ["E_t refused by validateEvidence"], declared: empty };
  }
  const ev = validated.value;
  if (ev.loop !== input.loop) {
    return { verdict: "undefined", reasons: [`loop ${ev.loop} is not ${input.loop}`], declared: empty };
  }
  if (ev.candidate_git.sha !== input.candidateSha) {
    return { verdict: "undefined", reasons: ["candidate sha does not match E_t.candidate_git.sha"], declared: empty };
  }
  if (isRecord(input.criteriaText) && typeof input.criteriaText.error === "string") {
    return { verdict: "undefined", reasons: [`criteria unreadable: ${input.criteriaText.error}`], declared: empty };
  }

  let declared: DeclaredLists = empty;
  try {
    const parsed = parseDeclared(input.criteriaText as string);
    if (parsed.present) declared = { unrunnable: [...parsed.unrunnable], outOfScope: [...parsed.outOfScope] };
  } catch (err) {
    return { verdict: "undefined", reasons: [`criteria block refused: ${(err as Error).message}`], declared: empty };
  }

  const pending = ev.acceptance.find((row) => row.status === "pending");
  if (pending) {
    return { verdict: "undefined", reasons: [`${pending.id}: pending`], declared };
  }

  const gateUndefined = requiredGateMissing(input.policy.require_done_gate, input.doneGate, input.gateMode, "G_done")
    ?? requiredGateMissing(input.policy.require_plan_gate, input.planGate, input.gateMode, "G_plan");
  if (gateUndefined) return { verdict: "undefined", reasons: [gateUndefined], declared };

  const gateRefuse = input.policy.gate_reject_or_halt_is_would_not_merge === false
    ? null
    : gateWouldNotMerge(input.doneGate) ?? gateWouldNotMerge(input.planGate);
  if (gateRefuse) return { verdict: "would-not-merge", reasons: [gateRefuse], declared };

  if (
    input.policy.failed_check_is_would_not_merge !== false &&
    (!ev.runtime_checks.build.passed || !ev.runtime_checks.unit.passed)
  ) {
    return { verdict: "would-not-merge", reasons: ["runtime_checks did not pass"], declared };
  }

  const excluded = new Set([...declared.unrunnable, ...declared.outOfScope]);
  const inScope = ev.acceptance.filter((row) => !excluded.has(row.id));
  const blocks = (status: string): boolean => {
    if (status === "unmet") return input.policy.unmet_is_would_not_merge !== false;
    if (status === "partial") return input.policy.partial_is_would_not_merge !== false;
    if (status === "not_evaluated") return input.policy.not_evaluated_is_would_not_merge !== false;
    return false;
  };
  const bad = inScope.find((row) => blocks(row.status));
  if (bad) {
    return { verdict: "would-not-merge", reasons: [`${bad.id}: ${bad.status}`], declared };
  }

  const reasons = inScope.map((row) =>
    row.status === "met" && row.order === "attributed" ? `${row.id}: met (attributed)` : `${row.id}: ${row.status}`,
  );
  return { verdict: "would-merge", reasons, declared };
}

function requiredGateMissing(
  required: boolean,
  gate: { verdict: string } | null | "missing",
  mode: string,
  name: string,
): string | null {
  if (!required) return null;
  if (gate === "missing") return `${name} required and missing`;
  if (gate === null && mode === "skip") return `${name} required and the gate mode was skip`;
  if (gate === null) return `${name} required and missing`;
  return null;
}

function gateWouldNotMerge(gate: { verdict: string } | null | "missing"): string | null {
  if (!gate || gate === "missing" || typeof gate === "string") return null;
  if (gate.verdict === "reject" || gate.verdict === "halt") return `gate ${gate.verdict}`;
  return null;
}

export function isHumanSeatLoop(loop: string): boolean {
  return /^[0-9]/.test(loop);
}

export function verdictPath(repo: string, loop: string, candidateSha: string): string {
  const rel = isHumanSeatLoop(loop)
    ? join("docs", "loops", "shadow-merge", loop, candidateSha, "shadow_merge.json")
    : join("artifacts", "iterations", loop, candidateSha, "shadow_merge.json");
  return join(repo, rel);
}

export function ledgerPath(repo: string): string {
  return join(repo, "docs", "loops", "shadow-merge", "ledger.jsonl");
}

export function prepareShadowVerdict(input: {
  repo: string;
  loop: string;
  candidateSha: string;
  criteriaSha: string;
  criteriaPath: string;
  evidence: unknown;
  gateMode: "skip" | "live" | "dry-run";
  policy?: MergePolicyFlags;
  doneGate?: { verdict: string } | null | "missing";
  planGate?: { verdict: string } | null | "missing";
}): { path: string; verdict: ShadowVerdictResult } {
  requireLowerHexSha("prepare candidate_sha", input.candidateSha);
  // QA MUTANT: criteria SHA validation removed.
  const path = verdictPath(input.repo, input.loop, input.candidateSha);
  if (existsSync(path)) {
    throw new Error(`${path} already exists. A verdict is written once.`);
  }
  let criteriaText: string | { error: string };
  try {
    criteriaText = git(input.repo, ["show", `${input.criteriaSha}:${input.criteriaPath}`]);
  } catch (err) {
    criteriaText = { error: (err as Error).message };
  }
  const verdict = computeShadowMergeVerdict({
    evidence: input.evidence,
    candidateSha: input.candidateSha,
    loop: input.loop,
    criteriaText,
    policy: input.policy ?? loadMergePolicy(),
    doneGate: input.doneGate ?? null,
    planGate: input.planGate ?? null,
    gateMode: input.gateMode,
  });
  const writtenAt = new Date().toISOString();
  const evidenceRecord = isRecord(input.evidence) ? input.evidence : null;
  const acceptance = Array.isArray(evidenceRecord?.acceptance)
    ? evidenceRecord.acceptance.filter(isRecord).map((row) => ({
        id: typeof row.id === "string" ? row.id : "",
        status: typeof row.status === "string" ? row.status : "",
        ...(typeof row.order === "string" ? { order: row.order } : {}),
      }))
    : [];
  const body = {
    loop: input.loop,
    candidate_sha: input.candidateSha,
    criteria_sha: input.criteriaSha,
    verdict: verdict.verdict,
    reasons: verdict.reasons,
    written_at: writtenAt,
    inputs: {
      runtime_checks: evidenceRecord && isRecord(evidenceRecord.runtime_checks) ? evidenceRecord.runtime_checks : null,
      acceptance,
      gates: {
        plan: input.planGate ?? null,
        done: input.doneGate ?? null,
      },
      declared: verdict.declared,
    },
  };
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  return { path, verdict };
}

export function decideShadowVerdict(input: {
  repo: string;
  loop: string;
  candidateSha: string;
  action: "merged" | "declined" | "replaced";
  mergeCommitSha?: string;
  replacedSha?: string;
}): { line: Record<string, unknown> } {
  requireLowerHexSha("decide --candidate", input.candidateSha);
  if (input.action === "merged") requireLowerHexSha("decide --merged", input.mergeCommitSha);
  if (input.action === "replaced") requireLowerHexSha("decide --replaced", input.replacedSha);
  const path = verdictPath(input.repo, input.loop, input.candidateSha);
  if (!existsSync(path)) throw new Error(`no verdict at ${path}. prepare comes first.`);
  const verdict = JSON.parse(readFileSync(path, "utf8")) as { verdict: ShadowVerdict; written_at: string };
  if (input.action === "merged") {
    if (!isAncestor(input.repo, input.mergeCommitSha as string, "origin/master")) {
      throw new Error(`decide --merged refuses ${input.mergeCommitSha}: it is not reachable from origin/master`);
    }
  }
  const shadow = verdict.verdict;
  let disagreed: boolean | null;
  if (shadow === "undefined") disagreed = null;
  else if (shadow === "would-merge") disagreed = input.action !== "merged";
  else disagreed = input.action === "merged";
  const writtenAt = verdict.written_at;
  let decidedAt = new Date().toISOString();
  if (decidedAt <= writtenAt) decidedAt = new Date(Date.parse(writtenAt) + 1).toISOString();
  const line: Record<string, unknown> = {
    loop: input.loop,
    candidate_sha: input.candidateSha,
    shadow_verdict: shadow,
    aaron_action: input.action,
    merge_commit_sha: input.action === "merged" ? input.mergeCommitSha : null,
    replaced_sha: input.action === "replaced" ? input.replacedSha : null,
    disagreed,
    written_at: writtenAt,
    decided_at: decidedAt,
  };
  const hash = createHash("sha256").update(JSON.stringify(line)).digest("hex");
  line.line_hash = hash;
  const ledger = ledgerPath(input.repo);
  mkdirSync(join(ledger, ".."), { recursive: true });
  appendFileSync(ledger, `${JSON.stringify(line)}\n`, "utf8");
  return { line };
}

export function summariseLedger(text: string): {
  disagreements: number;
  evaluated: number;
  undefined_count: number;
  note: string;
} {
  const rows = text.split(/\r?\n/).filter((l) => l.trim() !== "").map((l) => JSON.parse(l) as {
    shadow_verdict?: string;
    disagreed?: boolean | null;
  });
  let disagreements = 0;
  let evaluated = 0;
  let undefinedCount = 0;
  for (const row of rows) {
    if (row.shadow_verdict === "undefined") {
      undefinedCount += 1;
      continue;
    }
    evaluated += 1;
    if (row.disagreed === true) disagreements += 1;
  }
  return { disagreements, evaluated, undefined_count: undefinedCount, note: NOTE };
}

/** CC-13. Absent ledger is a first use, not a failure. */
export function checkShadowMergeLedger(projectRoot: string): CheckResult {
  const name = "shadow-merge-ledger";
  const path = ledgerPath(projectRoot);
  if (!existsSync(path)) {
    return { name, severity: "pass", report: true, message: "ledger absent — first use, nothing to check. LIMIT: does not prove a merge was gated." };
  }
  const text = readFileSync(path, "utf8");
  const problems: string[] = [];
  const raw = text.split(/\r?\n/);
  if (raw.length > 0 && raw[raw.length - 1] === "") raw.pop();
  const committed = gitTry(projectRoot, ["show", "HEAD:docs/loops/shadow-merge/ledger.jsonl"]);
  const committedLines = committed.ok ? committed.stdout.split(/\r?\n/) : [];
  if (committed.ok && raw.length < committedLines.length) {
    problems.push(`ledger shrank from ${committedLines.length} lines to ${raw.length}`);
  }
  for (const [i, line] of raw.entries()) {
    if (line.trim() === "") {
      problems.push(`line ${i + 1}: empty line`);
      continue;
    }
    if (committedLines[i] !== undefined && committedLines[i] !== line) {
      problems.push(`line ${i + 1}: differs from the committed ledger`);
    }
    try {
      const row = JSON.parse(line) as {
        shadow_verdict?: string;
        disagreed?: boolean | null;
        candidate_sha?: string;
        loop?: string;
        line_hash?: string;
        decided_at?: string;
      };
      if (typeof row.line_hash !== "string" || row.line_hash === "") {
        problems.push(`line ${i + 1}: missing line_hash`);
      } else {
        const { line_hash: _hash, ...rest } = row;
        const again = createHash("sha256").update(JSON.stringify(rest)).digest("hex");
        if (again !== row.line_hash) problems.push(`line ${i + 1}: line_hash does not match the line`);
      }
      if (row.shadow_verdict !== "would-merge" && row.shadow_verdict !== "would-not-merge" && row.shadow_verdict !== "undefined") {
        problems.push(`line ${i + 1}: missing shadow_verdict`);
      }
      if (row.shadow_verdict === "undefined" && row.disagreed === false) {
        problems.push(`line ${i + 1}: undefined counted as agreement`);
      }
      if (typeof row.loop === "string" && typeof row.candidate_sha === "string") {
        const verdictFile = verdictPath(projectRoot, row.loop, row.candidate_sha);
        if (!existsSync(verdictFile)) problems.push(`line ${i + 1}: no shadow_merge.json at ${verdictFile}`);
        else {
          const written = JSON.parse(readFileSync(verdictFile, "utf8")) as { written_at?: string };
          if (typeof written.written_at === "string" && typeof row.decided_at === "string" && written.written_at > row.decided_at) {
            problems.push(`line ${i + 1}: verdict file is newer than decided_at`);
          }
        }
      }
    } catch (err) {
      problems.push(`line ${i + 1}: ${(err as Error).message}`);
    }
  }
  if (problems.length > 0) {
    return { name, severity: "issue", report: true, message: problems.join("; ") };
  }
  return { name, severity: "pass", report: true, message: `ledger parses (${raw.length} lines). LIMIT: does not re-derive verdicts.` };
}
