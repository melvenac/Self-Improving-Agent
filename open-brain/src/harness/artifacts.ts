/**
 * The loop's artifacts on disk: `D_t.md`, `A_t.gitref`, `E_t.json`, and — when
 * the loop fails — `FAILED.md`.
 *
 * **A failure is an artifact.** *An exhausted cap is a recorded failure, never a
 * silent pass*, and a failure that exists only as a non-zero exit code and some
 * scrollback is not recorded. `FAILED.md` is written into the same iteration
 * directory as everything else, so a later reader finds the failure where they
 * would have found the evidence.
 *
 * Every artifact carries **what it was derived from** — the sha, the branch,
 * the time. A bare value in a file is correct on the day it was written and
 * unverifiable afterwards.
 */

import type { Plan, Evidence } from "./schema.js";
import type { FrozenCandidate } from "./workspace.js";

/** Repo-relative directory for one iteration's artifacts. */
export const iterationDir = (loop: string): string => `artifacts/iterations/${loop}`;

export const planMarkdownPath = (loop: string): string => `${iterationDir(loop)}/D_t.md`;
export const planJsonPath = (loop: string): string => `${iterationDir(loop)}/D_t.json`;
export const gitrefPath = (loop: string): string => `${iterationDir(loop)}/A_t.gitref`;
export const evidencePath = (loop: string): string => `${iterationDir(loop)}/E_t.json`;
export const failurePath = (loop: string): string => `${iterationDir(loop)}/FAILED.md`;

/** Which gate a record belongs to. The file name follows the gate, not the stage. */
export type GateRecordKind = "plan" | "done" | "qa";

const GATE_RECORD_FILE: Readonly<Record<GateRecordKind, string>> = { plan: "G_plan", done: "G_done", qa: "G_qa" };

export const gateRecordPath = (loop: string, kind: GateRecordKind): string =>
  `${iterationDir(loop)}/${GATE_RECORD_FILE[kind]}.json`;

/**
 * One gate's whole story: what was asked, what came back, which thresholds were
 * applied, and what the runtime then did.
 *
 * **Written in every mode.** `sent` is the difference between a dry run and a
 * live one — not the presence of the file. A record that exists only when a
 * gate was consulted cannot be used to check what a dry run WOULD have asked,
 * which is the only thing a dry run is for.
 *
 * `request` is the body as it goes on the wire, **redacted**. The credential is
 * an HTTP header and is never part of this object in the first place; the
 * redaction is the second layer, for anything that reached the state by another
 * route.
 */
export interface GateRecord {
  gate: string;
  loop: string;
  mode: string;
  /** False in `skip` and `dry-run`. True only when a request actually left. */
  sent: boolean;
  requested_at: string;
  answered_at: string | null;
  model_requested: string;
  /** The concrete version the alias resolved to, e.g. `jev-1.13.0`. Null when not sent. */
  model_resolved: string | null;
  request: Record<string, unknown>;
  answer: Record<string, unknown> | null;
  usage: Record<string, unknown> | null;
  /** The policy verdict, its reasons, and the threshold values used. Null when not consulted. */
  decision: Record<string, unknown> | null;
  /** What the runtime did as a result, in its own words. Never inferred by a reader. */
  runtime_action: string;
  note: string;
  /**
   * Who produced the record (S4-4a): the loop's own runtime, or a seat running a gate out of
   * loop. Never inferred from the loop id: a seat-built `t195` matches the runtime pattern.
   */
  source?: "seat" | "runtime";
  /** Whether the plan was written before the work (`written-before`) or rebuilt from the diff afterwards. */
  plan_provenance?: "reconstructed-after" | "written-before";
}

export const renderGateRecord = (record: GateRecord): string => `${JSON.stringify(record, null, 2)}\n`;

const bullets = (items: readonly string[]): string =>
  items.length === 0 ? "_none_\n" : `${items.map((i) => `- ${i}`).join("\n")}\n`;

/**
 * `D_t` as markdown, for a human.
 *
 * `D_t.json` beside it is the machine copy and is written from the same
 * validated object in the same call, so the two cannot describe different
 * plans.
 */
export function renderPlanMarkdown(plan: Plan, writtenAt: string): string {
  const lines: string[] = [
    `# D_t — plan for loop ${plan.loop}`,
    "",
    `**Written:** ${writtenAt} · **Machine copy:** \`D_t.json\` in this directory`,
    "",
    "## Objective",
    "",
    plan.objective,
    "",
    "## New capability",
    "",
    plan.new_capability.trim() === ""
      ? `_none — stop-ship requested: ${plan.stop_ship?.justification ?? "(no justification)"}_`
      : plan.new_capability,
    "",
    "## Repair targets",
    "",
    bullets(plan.repair_targets),
    "## Tasks",
    "",
    bullets(plan.tasks),
    "## Acceptance",
    "",
    "| id | type | observable |",
    "| --- | --- | --- |",
    ...plan.acceptance.map((a) => `| ${a.id} | ${a.type} | ${a.observable} |`),
    "",
    "## Out of scope",
    "",
    bullets(plan.out_of_scope),
    "## Must be preserved",
    "",
    bullets(plan.preserve),
  ];
  return `${lines.join("\n")}\n`;
}

/**
 * `A_t.gitref` — the candidate, and the three facts that make it checkable.
 *
 * Plain text rather than JSON so `git show` and `cat` are enough. The sha is on
 * its own line after the key, which is what a later script should parse; the
 * rest is for a reader.
 */
export function renderGitref(candidate: FrozenCandidate, loop: string): string {
  return [
    `loop: ${loop}`,
    `sha: ${candidate.sha}`,
    `branch: ${candidate.branch}`,
    `frozen_at: ${candidate.frozenAt}`,
    "",
    "# This is the candidate QA was given.",
    "#",
    "# WHAT THE RUNTIME GUARANTEES ABOUT IT: the tree matched this sha when the QA",
    "# stage began; the QA stage neither committed nor wrote outside its allowlist;",
    "# and this sha is the first parent of the commit holding E_t.",
    "#",
    "# WHAT IT DOES NOT: nothing here describes the tree after the loop ended, and",
    "# an earlier version of this comment claimed only that HEAD had not moved BEFORE",
    "# QA ran - which was true, silent about the stage that could move it, and read",
    "# by a reader as a property of the record.",
    "",
  ].join("\n");
}

export const renderEvidence = (evidence: Evidence): string => `${JSON.stringify(evidence, null, 2)}\n`;

export interface FailureRecord {
  loop: string;
  stage: string;
  reason: string;
  /** Machine-readable cause, so a caller can branch without parsing prose. */
  code: string;
  attempts?: number;
  problems?: readonly string[];
  at: string;
  /** Rendered after the reason: the loop's findings and developer record, so they survive a failure. */
  appendix?: string;
}

/**
 * `FAILED.md` — why the loop stopped, in the iteration directory.
 *
 * States the stage, the code and the attempts. An exhausted retry cap reads as
 * an exhausted retry cap, not as "the loop did not finish".
 */
export function renderFailure(f: FailureRecord): string {
  const lines: string[] = [
    `# Loop ${f.loop} FAILED`,
    "",
    `**Stage:** ${f.stage} · **Code:** \`${f.code}\` · **At:** ${f.at}`,
    f.attempts !== undefined ? `**Attempts:** ${f.attempts}` : "",
    "",
    "## Reason",
    "",
    f.reason,
    "",
  ];
  if (f.problems && f.problems.length > 0) {
    lines.push("## Problems", "", bullets(f.problems));
  }
  if (f.appendix !== undefined && f.appendix !== "") lines.push(f.appendix);
  lines.push(
    "---",
    "",
    "This file is the record of a refusal, not of an incomplete run. The loop stopped",
    "deliberately; nothing downstream should read its absence of evidence as a pass.",
    "",
  );
  return `${lines.filter((l) => l !== "").join("\n")}\n`;
}
