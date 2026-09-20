/**
 * The three seats as the runtime sees them, and the stubs that stand in for
 * real sessions in slice one.
 *
 * A role is a function from a context to a deliverable. That is the whole
 * interface, and it is deliberately thin: in slice two a role becomes a spawned
 * Claude Code session and the runtime's side of this contract does not change.
 * **Nothing here knows how a role does its work** — *constrain deliverable
 * schemas, not the agent's internal workflow.*
 *
 * ## The write helper is a convenience, not the enforcement
 *
 * {@link RoleContext.write} refuses a path outside the allowlist. A stub that
 * ignores it and calls `node:fs` directly is still caught, by the tree diff in
 * `workspace.ts`. That ordering matters: the helper is what a well-behaved role
 * uses, and the diff is what makes the boundary true for a role that is not
 * well-behaved — which is every role, once they are separate processes.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Allowlist } from "./workspace.js";
import { normaliseRepoPath, type FrozenCandidate } from "./workspace.js";
import type { CheckRunResults } from "./checks.js";
import type { Plan } from "./schema.js";

export type RoleName = "planner" | "developer" | "qa";

export class WriteRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WriteRefused";
  }
}

export interface RoleContext {
  readonly role: RoleName;
  readonly loop: string;
  readonly repoRoot: string;
  /** 1-based. A role that is being retried is told so, and why. */
  readonly attempt: number;
  readonly allowlist: Allowlist;
  /**
   * The schema problems that rejected the previous attempt, empty on the first.
   * Handed back verbatim: a retry that is not told what was wrong is a re-roll.
   */
  readonly previousProblems: readonly string[];
  /** The role's own JSON Schema, so a retry sees the contract it missed. */
  readonly schema: Record<string, unknown> | null;
  readonly plan: Plan | null;
  readonly candidate: FrozenCandidate | null;
  readonly checks: CheckRunResults | null;
  /** Write a repo-relative file, refused outside the allowlist. */
  write(repoPath: string, content: string): void;
}

export interface RoleSession {
  readonly role: RoleName;
  /** Produce the deliverable. Unvalidated on purpose — validation is the runtime's. */
  run(ctx: RoleContext): unknown;
}

/** Build the write helper for one stage. */
export function makeWriter(repoRoot: string, allow: Allowlist, role: RoleName) {
  return (repoPath: string, content: string): void => {
    const n = normaliseRepoPath(repoPath);
    if (!n.ok) {
      throw new WriteRefused(`${role} tried to write "${repoPath}": ${n.reason}`);
    }
    if (!allow.permits(n.value)) {
      throw new WriteRefused(
        `${role} tried to write "${n.value}", which is outside its allowlist (${allow.describe()})`,
      );
    }
    const abs = join(repoRoot, n.value);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf-8");
  };
}

/* ------------------------------------------------------------------------- *
 * Stubs
 *
 * These are fixtures, not simulations of a model. They exist so the runtime can
 * be exercised end to end, and so a test can hand a stage a deliberately bad
 * deliverable and watch the runtime refuse it. Keeping them dumb is the point:
 * a clever stub would make it possible for the runtime to pass because the stub
 * compensated.
 * ------------------------------------------------------------------------- */

/** A planner stub that returns a valid plan. */
export class StubPlanner implements RoleSession {
  readonly role = "planner" as const;
  constructor(private readonly overrides: Partial<Plan> = {}) {}

  run(ctx: RoleContext): unknown {
    const base: Plan = {
      loop: ctx.loop,
      objective: "The harness runs one loop end to end and produces a versioned artifact set.",
      tasks: ["Run the three stages", "Write D_t, A_t.gitref and E_t"],
      out_of_scope: ["Jev client", "real role prompts"],
      preserve: ["/start and /end keep working", "ob_state remains the only writer of state.json"],
      acceptance: [
        { id: "A1", observable: "artifacts/iterations/<loop>/ contains the three files", type: "blackbox" },
      ],
      repair_targets: ["nothing enforces the seat boundaries the role files describe"],
      new_capability: "harness runs a loop end to end with stubbed roles",
    };
    return { ...base, ...this.overrides };
  }
}

/** A developer stub that writes one file inside its allowlist. */
export class StubDeveloper implements RoleSession {
  readonly role = "developer" as const;
  constructor(private readonly writes: ReadonlyArray<{ path: string; content: string }> = []) {}

  run(ctx: RoleContext): unknown {
    const writes =
      this.writes.length > 0
        ? this.writes
        : [
            {
              path: `artifacts/iterations/${ctx.loop}/developer-note.md`,
              content:
                `# Developer stage — ${ctx.loop}\n\n` +
                `Stubbed role. Wrote this file to produce a candidate commit.\n`,
            },
          ];
    for (const w of writes) ctx.write(w.path, w.content);
    return { summary: `wrote ${writes.length} file(s)`, paths: writes.map((w) => w.path) };
  }
}

/**
 * A QA stub that returns a valid evidence report for the frozen candidate.
 *
 * It deliberately leaves `runtime_checks` to the runtime. A QA role does not
 * get to decide what the build did — see `reconcileReportedChecks`.
 */
export class StubQa implements RoleSession {
  readonly role = "qa" as const;
  constructor(private readonly overrides: Record<string, unknown> = {}) {}

  run(ctx: RoleContext): unknown {
    const candidate = ctx.candidate;
    if (!candidate) {
      throw new Error("QA stub ran without a frozen candidate — the runtime should have refused first");
    }
    const acceptance = (ctx.plan?.acceptance ?? []).map((a) => ({
      id: a.id,
      status: "not_evaluated" as const,
      evidence: "stub QA seat: this criterion was not evaluated. Missing evidence is a gap, not a pass.",
    }));
    return {
      loop: ctx.loop,
      candidate_git: { sha: candidate.sha, branch: candidate.branch, frozen_at: candidate.frozenAt },
      requirements: [],
      acceptance:
        acceptance.length > 0
          ? acceptance
          : [{ id: "A0", status: "not_evaluated", evidence: "no acceptance criteria in the plan" }],
      regressions: [],
      gaps: ["evaluated by a stub, not by the QA seat — this report establishes nothing about the candidate"],
      notes: "Stub evidence produced by the slice-one harness.",
      ...this.overrides,
    };
  }
}

/** The three stubs, wired for a default self-test loop. */
export function stubRoles(): { planner: RoleSession; developer: RoleSession; qa: RoleSession } {
  return { planner: new StubPlanner(), developer: new StubDeveloper(), qa: new StubQa() };
}
