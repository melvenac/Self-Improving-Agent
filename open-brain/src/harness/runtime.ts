/**
 * The loop: planner → developer → QA, with the boundaries enforced rather than
 * asked for.
 *
 * ## The ordering, and why it is this ordering
 *
 * Each stage starts from a **clean tree** and ends in a **commit**. That is what
 * makes the allowlist a one-line comparison instead of a diff of one dirty
 * state against another: with the tree clean at the start, everything git
 * reports at the end is what the stage did.
 *
 * The candidate is the **developer commit**, and `A_t.gitref` is written
 * afterwards, in the evidence commit. It cannot be otherwise — a file recording
 * a sha cannot be inside the commit it names. So the freeze is verified between
 * the two: after the developer commit and the deterministic checks, before QA
 * writes anything.
 *
 * ## What fails the loop, and what does not
 *
 * - A **schema violation retries that role**, capped. An exhausted cap is a
 *   recorded failure with `FAILED.md` on disk — never a silent continue.
 * - An **allowlist violation does not retry.** A role that wrote outside its
 *   boundary has not made a formatting mistake, and re-rolling it would be
 *   treating a breach as noise. The writes are reverted and the loop stops.
 * - **Failing build or unit tests do NOT stop the loop.** They are the
 *   evidence. A QA report about a red build is a real artifact and suppressing
 *   it would be widening the criteria until something passes. The loop
 *   completes and reports `checksPassed: false`; the CLI exits non-zero.
 *
 * ## What this runtime does NOT do
 *
 * It never merges, never pushes, and never touches a remote — `git.ts` refuses
 * those subcommands outright. It stops at a candidate commit and a set of local
 * tags. `D-019`: autonomous inside a branch, Aaron at master.
 */

import {
  commitPaths,
  currentBranch,
  firstParent,
  headSha,
  isRepo,
  refExists,
  resetHardTo,
  revertPaths,
  tagAt,
} from "./git.js";
import {
  Allowlist,
  enforceAllowlist,
  requireCleanTree,
  verifyFrozen,
  type AllowlistVerdict,
  type FrozenCandidate,
} from "./workspace.js";
import {
  isRuntimeConstructed,
  makeWriter,
  WriteRefused,
  type RoleContext,
  type RoleName,
  type RoleSession,
} from "./roles.js";
import {
  jsonSchemas,
  validateEvidence,
  validatePlan,
  type CheckOutcome,
  type Evidence,
  type Plan,
} from "./schema.js";
import {
  defaultChecks,
  reconcileReportedChecks,
  runDeterministicChecks,
  type CheckRunResults,
  type DeterministicChecks,
} from "./checks.js";
import {
  evidencePath,
  failurePath,
  gateRecordPath,
  gitrefPath,
  iterationDir,
  planJsonPath,
  planMarkdownPath,
  renderEvidence,
  renderFailure,
  renderGateRecord,
  renderGitref,
  renderPlanMarkdown,
  type FailureRecord,
  type GateRecord,
  type GateRecordKind,
} from "./artifacts.js";
import { RefWatch, type RefVerdict } from "./refwatch.js";
import {
  buildJevRequest,
  DryRunTransport,
  DONE_GATE_QUESTIONS,
  GateCallFailed,
  JevTransport,
  PLAN_GATE_QUESTIONS,
  redact,
  UnconfiguredTransport,
  type GateAnswer,
  type GatePayload,
  type GateTransport,
} from "./gate.js";
import {
  decideDoneGate,
  decidePlanGate,
  loadPolicies,
  policiesDir,
  PolicyUnreadable,
  type GateDecision,
  type Policies,
} from "./policies.js";

/** How the decision gates behave. Slice one defaults to `skip`; the client lands in slice two. */
export type GateMode = "skip" | "dry-run" | "live";

export interface LoopConfig {
  repoRoot: string;
  /** `t001`, `t002`, … */
  loop: string;
  roles: { planner: RoleSession; developer: RoleSession; qa: RoleSession };
  /** Repo-relative rules the developer stage may write. Narrow by default. */
  developerAllowlist?: readonly string[];
  checks?: DeterministicChecks;
  /** Attempts per schema-validated role, including the first. */
  maxAttempts?: number;
  /**
   * Watch every ref under `refs/` around each stage (`G-041`). **Defaults to
   * on**, and turning it off is the only way to run without it — a role the
   * runtime did not construct is then refused outright.
   */
  refWatch?: boolean;
  gateMode?: GateMode;
  transport?: GateTransport;
  /**
   * Where the gate thresholds are read from. Defaults to the module's own
   * `policies/` directory. A test points it at a temp directory to show that
   * changing a threshold changes the decision with no source change (A6).
   */
  policiesDir?: string;
  log?: (line: string) => void;
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
}

export type FailureCode =
  | "not-a-repo"
  | "dirty-tree"
  | "tag-exists"
  | "schema-cap-exhausted"
  | "allowlist-violation"
  | "role-threw"
  | "stage-committed"
  | "developer-no-change"
  | "candidate-moved"
  | "tag-target-moved"
  | "candidate-not-parent-of-evidence"
  | "evidence-disagrees-with-runtime"
  | "gate-unavailable"
  | "foreign-role-unwatched"
  | "stage-changed-ref"
  | "gate-rejected"
  | "gate-halted"
  | "policy-unreadable";

/**
 * A refusal to START, thrown rather than returned.
 *
 * Every other failure in this file is a `LoopResult` with a `FailureCode`: the
 * loop ran and something in it failed. This one is different in kind — the
 * runtime declines to begin — and it is thrown so that difference cannot be
 * read as a graded outcome. A caller that ignores the distinction gets an
 * exception rather than an exit code it might not check.
 */
export class LoopRefused extends Error {
  readonly code: FailureCode;
  /** The seats that caused the refusal, in stage order. */
  readonly roles: readonly RoleName[];
  constructor(code: FailureCode, roles: readonly RoleName[], message: string) {
    super(message);
    this.name = "LoopRefused";
    this.code = code;
    this.roles = roles;
  }
}

export interface LoopResult {
  status: "completed" | "failed";
  loop: string;
  repoRoot: string;
  baseSha: string | null;
  candidateSha: string | null;
  evidenceSha: string | null;
  tags: string[];
  /** Repo-relative artifact paths this run wrote. */
  artifacts: string[];
  checks: CheckRunResults | null;
  checksPassed: boolean;
  plan: Plan | null;
  evidence: Evidence | null;
  gatePayloads: GatePayload[];
  gateAnswers: GateAnswer[];
  /** One per gate consulted or dry-run, in order. Also written to disk. */
  gateRecords: GateRecord[];
  failure: FailureRecord | null;
  /** 0 only when the loop completed AND the deterministic checks were green. */
  exitCode: number;
}

const isoOf = (now: () => Date): string => now().toISOString();

/** `t001` → `001`, for tag names. */
const loopNumber = (loop: string): string => loop.replace(/^t/, "");

/**
 * Run one loop.
 *
 * **Synchronous on the way in, asynchronous on the way through.** The foreign-
 * role refusal below is thrown by this function itself, not by the promise it
 * returns: a refusal to start must not be deferred to a microtask, because
 * "refuses before any stage runs" is a claim about ordering. Everything after
 * it is async, because a live gate is an HTTP call and the alternatives to
 * awaiting one are a spawned process or a wedged runtime.
 */
export function runLoop(config: LoopConfig): Promise<LoopResult> {
  // --- The one flag, before anything else ---------------------------------
  //
  // `G-041` and slice two's A1. Nothing above this line: not a git call, not a
  // tag, not an artifact, not a log line. "Refuses before any stage runs" is
  // only checkable if there is nothing to undo when it refuses.
  //
  // Slice one was safe because `cli.ts` passes `stubRoles()` and nothing else
  // called `runLoop`. That is a property of one call site, and a property of
  // one call site is an intention. This is the rule.
  const refWatchEnabled = config.refWatch ?? true;
  if (!refWatchEnabled) {
    const stageOrder: readonly RoleName[] = ["planner", "developer", "qa"];
    const foreignRoles = stageOrder.filter((r) => !isRuntimeConstructed(config.roles[r]));
    if (foreignRoles.length > 0) {
      throw new LoopRefused(
        "foreign-role-unwatched",
        foreignRoles,
        `refusing to start loop ${config.loop}: ${foreignRoles.join(", ")} ` +
          `${foreignRoles.length === 1 ? "is a role" : "are roles"} this runtime did not construct, and the ` +
          `ref-watch is off. A role the runtime did not build can reach the repository through channels the ` +
          `stage checks do not watch — refs were the last one found (G-041), and the list of channels is not ` +
          `known to be complete. Run with the ref-watch on, or pass roles this runtime constructed.`,
      );
    }
  }

  return runLoopInner(config, refWatchEnabled);
}

async function runLoopInner(config: LoopConfig, refWatchEnabled: boolean): Promise<LoopResult> {
  const log = config.log ?? (() => {});
  const now = config.now ?? (() => new Date());
  const env = config.env ?? process.env;
  const maxAttempts = config.maxAttempts ?? 3;
  const gateMode: GateMode = config.gateMode ?? "skip";
  const transport: GateTransport =
    config.transport ??
    (gateMode === "dry-run"
      ? new DryRunTransport(log, env)
      : gateMode === "live"
        ? new JevTransport({ env, log })
        : new UnconfiguredTransport());

  // Thresholds are data, loaded once, before any gate is asked. A policy file
  // that will not parse must stop the loop at the start rather than halfway
  // through, and there is deliberately no built-in default to fall back to.
  const policiesRoot = config.policiesDir ?? policiesDir();
  let policies: Policies | null = null;
  let policyError: string | null = null;
  if (gateMode !== "skip") {
    try {
      policies = loadPolicies(policiesRoot);
    } catch (err) {
      policyError = err instanceof PolicyUnreadable ? err.message : (err as Error).message;
    }
  }

  const { repoRoot, loop } = config;
  const refWatch = refWatchEnabled ? new RefWatch(repoRoot) : null;
  const schemas = jsonSchemas();
  const gatePayloads: GatePayload[] = [];
  const gateAnswers: GateAnswer[] = [];
  const gateRecords: GateRecord[] = [];
  /** Gate records written to disk already, so `fail()` does not write one twice. */
  const gateRecordsWritten = new Set<GateRecordKind>();
  const artifacts: string[] = [];
  const tags: string[] = [];

  const result: LoopResult = {
    status: "failed",
    loop,
    repoRoot,
    baseSha: null,
    candidateSha: null,
    evidenceSha: null,
    tags,
    artifacts,
    checks: null,
    checksPassed: false,
    plan: null,
    evidence: null,
    gatePayloads,
    gateAnswers,
    gateRecords,
    failure: null,
    exitCode: 1,
  };

  /**
   * Write one gate record into the iteration directory.
   *
   * Returns the repo-relative path so the caller can include it in the commit
   * it is already making. Nothing here commits: a write between the candidate
   * commit and QA's freeze check would dirty the tree the freeze is about.
   */
  const writeGateRecord = (kind: GateRecordKind, record: GateRecord): string => {
    const path = gateRecordPath(loop, kind);
    const write = makeWriter(repoRoot, new Allowlist([`${iterationDir(loop)}/`]), "planner");
    write(path, renderGateRecord(record));
    gateRecordsWritten.add(kind);
    artifacts.push(path);
    return path;
  };

  /**
   * Record a failure, write `FAILED.md`, and return.
   *
   * The write is best-effort and says so: if the artifacts directory cannot be
   * written the failure still travels in the returned value, and the inability
   * to record it is appended to the reason rather than swallowed.
   */
  const fail = (stage: string, code: FailureCode, reason: string, extra: Partial<FailureRecord> = {}): LoopResult => {
    const record: FailureRecord = { loop, stage, code, reason, at: isoOf(now), ...extra };
    try {
      const write = makeWriter(repoRoot, new Allowlist([`${iterationDir(loop)}/`]), "planner");
      write(failurePath(loop), renderFailure(record));
      artifacts.push(failurePath(loop));
    } catch (err) {
      record.reason = `${record.reason} (FAILED.md could not be written: ${(err as Error).message})`;
    }
    // A gate that was asked before the loop failed still has a record, and a
    // record that only survives a successful loop is no use for reading why an
    // unsuccessful one went the way it did. Separate try: a gate record that
    // cannot be written must not be reported as FAILED.md failing to write.
    try {
      for (const pending of gateRecords) {
        if (pending.gate !== "plan" && pending.gate !== "developer-done") continue;
        const kind: GateRecordKind = pending.gate === "plan" ? "plan" : "done";
        if (!gateRecordsWritten.has(kind)) writeGateRecord(kind, pending);
      }
    } catch (err) {
      record.reason = `${record.reason} (a gate record could not be written: ${(err as Error).message})`;
    }
    log(`LOOP ${loop} FAILED at ${stage} [${code}]: ${record.reason}`);
    result.failure = record;
    result.status = "failed";
    result.exitCode = 1;
    return result;
  };

  /**
   * Ask a gate, apply the policy, and record all of it. Never silently approves.
   *
   * Three modes, three shapes, and the record distinguishes them by field
   * rather than by absence:
   *
   * - `skip` — nothing is asked. `sent: false`, `answer: null`, `decision:
   *   null`, and a note that says it is not an approval.
   * - `dry-run` — the payload is built and printed and no request is made.
   *   `sent: false`, and the `request` field is the body that WOULD have gone,
   *   which is the only thing a dry run is for.
   * - `live` — the request goes, the answer comes back typed, and the policy
   *   from `policies/` decides. `sent: true`.
   *
   * A gate that could not be reached is a failure, never a pass: *a gate that
   * cannot reach Jev must not become a gate that passes.*
   */
  const consultGate = async (
    kind: GateRecordKind,
    payload: GatePayload,
    decide: (answers: Record<string, unknown> | null) => GateDecision,
  ): Promise<
    | { ok: true; answer: GateAnswer; decision: GateDecision | null; record: GateRecord }
    | { ok: false; code: FailureCode; reason: string }
  > => {
    gatePayloads.push(payload);
    const requestedAt = isoOf(now);
    const record: GateRecord = {
      gate: payload.gate,
      loop,
      mode: gateMode,
      sent: false,
      requested_at: requestedAt,
      answered_at: null,
      model_requested: payload.model,
      model_resolved: null,
      // The body exactly as it would go on the wire. Redacted as a second
      // layer; the credential is a header and never reaches this object.
      request: redact(buildJevRequest(payload), env),
      answer: null,
      usage: null,
      decision: null,
      runtime_action: "",
      note: "",
    };

    if (gateMode === "skip") {
      const answer: GateAnswer = {
        gate: payload.gate,
        answers: null,
        consulted: false,
        note: "gate mode is skip; nothing was asked and no decision was taken. Not an approval.",
      };
      gateAnswers.push(answer);
      record.runtime_action = "proceeded without consulting the gate (mode: skip)";
      record.note = answer.note;
      gateRecords.push(record);
      return { ok: true, answer, decision: null, record };
    }

    let answer: GateAnswer;
    try {
      answer = await transport.dispatch(payload);
    } catch (err) {
      record.runtime_action = "failed the loop — the gate could not be reached";
      record.note =
        err instanceof GateCallFailed
          ? `${err.classification} (HTTP ${err.status ?? "none"}, retryable: ${err.retryable}): ${err.message}` +
            (err.fields.length > 0 ? ` fields: ${err.fields.join(", ")}` : "") +
            (err.detail === "" ? "" : ` body: ${err.detail}`)
          : (err as Error).message;
      gateRecords.push(record);
      return { ok: false, code: "gate-unavailable", reason: record.note };
    }

    gateAnswers.push(answer);
    record.sent = answer.consulted;
    record.answered_at = isoOf(now);
    record.answer = answer.answers;
    record.model_resolved = answer.resolvedModel ?? null;
    record.usage = (answer.usage ?? null) as Record<string, unknown> | null;
    record.note = answer.note;

    // A dry run produces no answers, so there is nothing to apply a policy to.
    // Applying one anyway would manufacture a rejection out of a mode whose
    // whole purpose is not to decide.
    if (!answer.consulted || answer.answers === null) {
      record.runtime_action = "proceeded without a decision — the transport did not consult a gate";
      gateRecords.push(record);
      return { ok: true, answer, decision: null, record };
    }

    const decision = decide(answer.answers);
    record.decision = { ...decision } as unknown as Record<string, unknown>;
    if (decision.verdict === "proceed") {
      record.runtime_action = "proceeded — the policy found no rule against it";
      gateRecords.push(record);
      return { ok: true, answer, decision, record };
    }
    record.runtime_action =
      decision.verdict === "halt" ? "halted the loop on the gate's verdict" : "failed the loop on the gate's verdict";
    gateRecords.push(record);
    return {
      ok: false,
      code: decision.verdict === "halt" ? "gate-halted" : "gate-rejected",
      reason:
        `the ${payload.gate} gate's answer was ${decision.verdict}ed by the policy in ${policiesRoot}: ` +
        `${decision.reasons.join("; ")}. Thresholds applied: ${JSON.stringify(decision.applied)}. ` +
        `Answered by ${answer.resolvedModel ?? "an unreported model version"}. ` +
        `LIMIT: typed output guarantees the interface, not truth — this is the gate's judgement, not a measurement.`,
    };
  };

  // --- Preconditions ------------------------------------------------------

  if (!isRepo(repoRoot)) {
    return fail("preflight", "not-a-repo", `${repoRoot} is not inside a git work tree — the loop versions by commit and cannot run without one`);
  }

  const clean = requireCleanTree(repoRoot, "preflight");
  if (!clean.ok) return fail("preflight", "dirty-tree", clean.reason);

  if (policyError !== null) {
    return fail(
      "preflight",
      "policy-unreadable",
      `the gate thresholds could not be read, and gate mode is "${gateMode}": ${policyError}`,
    );
  }

  const n = loopNumber(loop);
  const baseTag = `loop-${n}-base`;
  const developerTag = `loop-${n}-developer`;
  const qaTag = `loop-${n}-qa`;
  for (const t of [baseTag, developerTag, qaTag]) {
    if (refExists(repoRoot, t)) {
      return fail(
        "preflight",
        "tag-exists",
        `tag ${t} already exists — loop ${loop} has run in this repository. Refusing rather than moving a rollback marker.`,
      );
    }
  }

  const baseSha = headSha(repoRoot);
  const branch = currentBranch(repoRoot);
  result.baseSha = baseSha;
  refWatch?.authorise(`refs/tags/${baseTag}`);
  tagAt(repoRoot, baseTag, baseSha, `HoH loop ${loop}: tree before the loop ran`);
  tags.push(baseTag);
  log(`loop ${loop}: base ${baseSha} on ${branch}, tagged ${baseTag}`);

  /**
   * Run one stage, with the allowlist enforced against the tree afterwards.
   *
   * Returns the role's raw deliverable. A boundary violation reverts the
   * offending paths and is reported as a failure — it never retries.
   */
  const runStage = (
    role: RoleSession,
    allow: Allowlist,
    attempt: number,
    previousProblems: readonly string[],
    extras: Pick<RoleContext, "plan" | "candidate" | "checks">,
  ):
    | { ok: true; deliverable: unknown; verdict: AllowlistVerdict }
    | { ok: false; code: FailureCode; reason: string } => {
    const roleName: RoleName = role.role;
    const ctx: RoleContext = {
      role: roleName,
      loop,
      repoRoot,
      attempt,
      allowlist: allow,
      previousProblems,
      schema: roleName === "planner" ? schemas.plan : roleName === "qa" ? schemas.evidence : null,
      plan: extras.plan,
      candidate: extras.candidate,
      checks: extras.checks,
      write: makeWriter(repoRoot, allow, roleName),
    };

    // The base this stage is judged against. Every path difference between
    // here and the stage's end is the stage's doing, committed or not.
    const stageBase = headSha(repoRoot);
    // …and every REF difference likewise. The runtime writes its own refs
    // between stages, never inside a window, so a delta here is a role's.
    refWatch?.begin(roleName);

    /**
     * Close the ref window and put back anything the role wrote.
     *
     * Runs BEFORE the allowlist comparison, deliberately: moving
     * `refs/heads/<branch>` changes what `git rev-parse HEAD` answers, so a
     * path verdict computed first would be measured against a HEAD the role
     * chose.
     */
    const closeRefWindow = (): { ok: true; verdict: RefVerdict | null } | { ok: false; reason: string } => {
      if (!refWatch) return { ok: true, verdict: null };
      const verdict = refWatch.compare();
      if (verdict.ok) return { ok: true, verdict };
      return { ok: false, reason: `${verdict.message}${refWatch.restore(verdict)}` };
    };

    /**
     * Undo whatever the stage left behind.
     *
     * Order matters: a rogue commit has to be unwound before reverting paths,
     * because once HEAD has moved `git checkout HEAD -- <path>` restores the
     * ROGUE content rather than the original.
     */
    const rollBack = (verdict: ReturnType<typeof enforceAllowlist>): string => {
      if (verdict.headMoved) {
        try {
          resetHardTo(repoRoot, stageBase);
          return ` The rogue commit was discarded and the tree reset to ${stageBase.slice(0, 12)}.`;
        } catch (err) {
          return ` THE TREE COULD NOT BE ROLLED BACK: ${(err as Error).message} Recover by hand before rerunning.`;
        }
      }
      const bad = [...verdict.violations, ...verdict.unsafe.map((u) => u.path)];
      if (bad.length > 0) revertPaths(repoRoot, bad);
      return " The offending paths were reverted.";
    };

    let deliverable: unknown;
    try {
      deliverable = role.run(ctx);
    } catch (err) {
      // The in-process helper refusing is still a boundary violation: the role
      // tried. It is reported as one so the two mechanisms agree.
      const thrownCode: FailureCode = err instanceof WriteRefused ? "allowlist-violation" : "role-threw";
      // A role that threw may still have written a ref on its way out, and a
      // thrown error is not a reason to stop looking at the other channels.
      const refAfterThrow = closeRefWindow();
      const verdictAfterThrow = enforceAllowlist(repoRoot, allow, stageBase);
      const undone = verdictAfterThrow.ok ? "" : rollBack(verdictAfterThrow);
      if (!refAfterThrow.ok) {
        return {
          ok: false,
          code: "stage-changed-ref",
          reason: `${roleName} stage: ${refAfterThrow.reason}${undone} The stage also threw: ${(err as Error).message}`,
        };
      }
      return { ok: false, code: thrownCode, reason: `${roleName} stage: ${(err as Error).message}${undone}` };
    }

    const refClose = closeRefWindow();
    if (!refClose.ok) {
      const verdictAfterRef = enforceAllowlist(repoRoot, allow, stageBase);
      const undone = verdictAfterRef.ok ? "" : rollBack(verdictAfterRef);
      return { ok: false, code: "stage-changed-ref", reason: `${roleName} was refused, not warned. ${refClose.reason}${undone}` };
    }
    if (refClose.verdict) log(`  ${roleName} refs: ${refClose.verdict.message}`);

    const verdict = enforceAllowlist(repoRoot, allow, stageBase);
    log(`  ${roleName} attempt ${attempt}: ${verdict.message}`);
    if (!verdict.ok) {
      const undone = rollBack(verdict);
      // A stage that COMMITTED is reported as that, not as "wrote outside its
      // allowlist" and never as "changed nothing". QA found this exact
      // misreport: a developer that committed a backdoor failed with
      // "the developer stage changed nothing", which is the opposite of true.
      const code: FailureCode = verdict.headMoved ? "stage-committed" : "allowlist-violation";
      return {
        ok: false,
        code,
        reason:
          `${roleName} was refused, not warned. ${verdict.message}${undone} ` +
          `A boundary breach is not retried.`,
      };
    }

    return { ok: true, deliverable, verdict };
  };

  /**
   * Refuse to tag anything other than the commit we believe we are tagging.
   *
   * A tag is the rollback contract, and QA showed a tag landing on an evidence
   * commit whose parent was a rogue commit rather than the candidate. Checking
   * identity at the moment of tagging costs one `rev-parse`.
   */
  const tagVerified = (tag: string, sha: string, message: string): { ok: true } | { ok: false; reason: string } => {
    const observed = headSha(repoRoot);
    if (observed !== sha) {
      return {
        ok: false,
        reason:
          `refusing to create ${tag} at ${sha.slice(0, 12)}: HEAD is ${observed.slice(0, 12)}. ` +
          `The tree moved between making that commit and tagging it, so the tag would not mean what it says.`,
      };
    }
    // Declare the exact ref before writing it. The runtime tags between stages,
    // never inside a window, so this is currently consumed by nothing — and
    // that is the point: if tagging ever moves inside a stage, the ledger is
    // already correct rather than something a later reader has to notice.
    refWatch?.authorise(`refs/tags/${tag}`);
    tagAt(repoRoot, tag, sha, message);
    tags.push(tag);
    return { ok: true };
  };

  // --- Stage 1: planner ---------------------------------------------------

  const plannerAllow = new Allowlist([`${iterationDir(loop)}/`]);
  let plan: Plan | null = null;
  let problems: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const staged = runStage(config.roles.planner, plannerAllow, attempt, problems, {
      plan: null,
      candidate: null,
      checks: null,
    });
    if (!staged.ok) return fail("planner", staged.code, staged.reason);

    const validated = validatePlan(staged.deliverable);
    if (validated.ok) {
      plan = validated.value;
      break;
    }
    problems = validated.problems;
    log(`  planner attempt ${attempt} rejected by schema: ${problems.join("; ")}`);
  }

  if (!plan) {
    return fail(
      "planner",
      "schema-cap-exhausted",
      `the planner produced a schema-invalid D_t on all ${maxAttempts} attempt(s). ` +
        `An exhausted retry cap is a recorded failure, not a pass and not a silent continue.`,
      { attempts: maxAttempts, problems },
    );
  }
  result.plan = plan;

  const planGate = await consultGate(
    "plan",
    {
      gate: "plan",
      loop,
      model: "jev-latest",
      questions: PLAN_GATE_QUESTIONS,
      // §4's state for this gate. `prior_failures` and the validated set are
      // what the record already knows; the gate is not asked to recall them.
      context: {
        plan,
        prior_failures: [],
        validated_behaviours: plan.preserve,
        changed_areas: [],
      },
    },
    (answers) =>
      decidePlanGate(answers, policies!.plan, {
        // Neither is inferred from the gate. A stop-ship needs support from the
        // deterministic checks and QA history, and at the PLAN gate neither has
        // run for this loop — so both are false and a stop-ship is refused
        // rather than honoured. Slice four's index is what makes them real.
        deterministicFailure: false,
        qaHistorySupportsStopShip: false,
      }),
  );
  if (!planGate.ok) return fail("planner", planGate.code, planGate.reason);
  const planGatePath = writeGateRecord("plan", planGate.record);
  log(`  plan gate: ${planGate.record.runtime_action}`);

  const writePlan = makeWriter(repoRoot, plannerAllow, "planner");
  writePlan(planMarkdownPath(loop), renderPlanMarkdown(plan, isoOf(now)));
  writePlan(planJsonPath(loop), `${JSON.stringify(plan, null, 2)}\n`);
  artifacts.push(planMarkdownPath(loop), planJsonPath(loop));
  commitPaths(
    repoRoot,
    [planMarkdownPath(loop), planJsonPath(loop), planGatePath],
    `harness(${loop}): plan D_t`,
  );
  log(`  planner: D_t committed`);

  // --- Stage 2: developer -------------------------------------------------

  const devClean = requireCleanTree(repoRoot, "developer");
  if (!devClean.ok) return fail("developer", "dirty-tree", devClean.reason);

  const devAllow = new Allowlist(config.developerAllowlist ?? [`${iterationDir(loop)}/`]);
  const devStage = runStage(config.roles.developer, devAllow, 1, [], { plan, candidate: null, checks: null });
  if (!devStage.ok) return fail("developer", devStage.code, devStage.reason);

  // Reuse the verdict runStage already computed: a second scan is another
  // blocking git call per loop, and two scans of a tree that cannot have
  // changed between them is also two chances to disagree.
  const devVerdict = devStage.verdict;
  if (devVerdict.permitted.length === 0) {
    return fail(
      "developer",
      "developer-no-change",
      `the developer stage changed nothing, so there is no candidate for QA to evaluate. ` +
        `An empty candidate is a failed loop, not a clean one.`,
    );
  }

  const candidateSha = commitPaths(repoRoot, devVerdict.permitted, `harness(${loop}): candidate A_t`);
  result.candidateSha = candidateSha;
  const devTagged = tagVerified(developerTag, candidateSha, `HoH loop ${loop}: developer candidate`);
  if (!devTagged.ok) return fail("developer", "tag-target-moved", devTagged.reason);
  log(`  developer: candidate ${candidateSha}, tagged ${developerTag}`);

  // --- Deterministic checks ----------------------------------------------

  const checks = runDeterministicChecks(config.checks ?? defaultChecks(), repoRoot);
  result.checks = checks;
  result.checksPassed = checks.allPassed;
  log(`  checks: build ${checks.build.detail}; unit ${checks.unit.detail}`);

  // §4: the done-gate's state carries the TEST EXIT CODES as data, and no
  // question in it asks whether the tests passed. The runtime read that from
  // the process; asking a model to re-derive it would be requesting an opinion
  // about a measurement.
  const doneGate = await consultGate(
    "done",
    {
      gate: "developer-done",
      loop,
      model: "jev-latest",
      questions: DONE_GATE_QUESTIONS,
      context: {
        plan,
        candidate: candidateSha,
        diffstat: devVerdict.permitted,
        checks: {
          build: { command: checks.build.command, exit_code: checks.build.exit_code },
          unit: { command: checks.unit.command, exit_code: checks.unit.exit_code },
        },
        prior_failures: [],
      },
    },
    (answers) => decideDoneGate(answers, policies!.done, { checksPassed: checks.allPassed }),
  );
  if (!doneGate.ok) return fail("developer", doneGate.code, doneGate.reason);
  log(`  done gate: ${doneGate.record.runtime_action}`);

  // --- Freeze -------------------------------------------------------------

  const candidate: FrozenCandidate = { sha: candidateSha, branch, frozenAt: isoOf(now) };
  const frozen = verifyFrozen(repoRoot, candidate);
  log(`  freeze: ${frozen.reason}`);
  if (!frozen.ok) return fail("qa", "candidate-moved", frozen.reason);

  // --- Stage 3: QA --------------------------------------------------------

  const qaAllow = new Allowlist([evidencePath(loop), gitrefPath(loop)]);
  let evidenceRaw: unknown = null;
  let evidence: Evidence | null = null;
  problems = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const staged = runStage(config.roles.qa, qaAllow, attempt, problems, { plan, candidate, checks });
    if (!staged.ok) return fail("qa", staged.code, staged.reason);
    evidenceRaw = staged.deliverable;

    const reported = (evidenceRaw as { runtime_checks?: { build: CheckOutcome; unit: CheckOutcome } })?.runtime_checks;
    const agreed = reconcileReportedChecks(checks, reported);
    if (!agreed.ok) {
      return fail(
        "qa",
        "evidence-disagrees-with-runtime",
        `the QA report's runtime_checks disagree with what the runtime measured from exit codes. ` +
          `${agreed.problems.join("; ")}. The runtime does not overwrite them: a report that ` +
          `contradicts the measurement is a defect in the evidence, and silently correcting it ` +
          `would hide exactly what a separate QA seat exists to make visible.`,
        { problems: agreed.problems },
      );
    }

    // The role does not supply runtime_checks; the runtime does, from exit codes.
    const candidateEvidence = {
      ...(evidenceRaw as Record<string, unknown>),
      runtime_checks: { build: checks.build, unit: checks.unit },
    };
    const validated = validateEvidence(candidateEvidence);
    if (validated.ok) {
      evidence = validated.value;
      break;
    }
    problems = validated.problems;
    log(`  qa attempt ${attempt} rejected by schema: ${problems.join("; ")}`);
  }

  if (!evidence) {
    return fail(
      "qa",
      "schema-cap-exhausted",
      `the QA seat produced a schema-invalid E_t on all ${maxAttempts} attempt(s). ` +
        `An exhausted retry cap is a recorded failure, not a pass and not a silent continue.`,
      { attempts: maxAttempts, problems },
    );
  }
  result.evidence = evidence;

  // --- The QA scoring gate is NOT built in this slice ---------------------
  //
  // `docs/HOH-JEV.md` §7 puts QA scoring in slice three, and the slice-two
  // brief lists it out of scope. Slice one had a placeholder question here;
  // sending it live would spend a real call on a question nobody designed and
  // return an answer that reads like a verdict.
  //
  // So it is not asked, and the absence is RECORDED rather than left as a
  // missing file. A gate nobody consulted is not a gate that approved.
  log(
    `  qa-score gate: NOT CONSULTED — QA scoring through Jev is slice three ` +
      `(docs/HOH-JEV.md §7). Nothing about this candidate was judged by a gate at the QA stage.`,
  );

  const writeQa = makeWriter(repoRoot, qaAllow, "qa");
  writeQa(evidencePath(loop), renderEvidence(evidence));
  writeQa(gitrefPath(loop), renderGitref(candidate, loop));
  artifacts.push(evidencePath(loop), gitrefPath(loop));

  // G_done is written HERE, into the evidence commit, and not when the gate
  // answered. Between the candidate commit and QA's freeze check the tree must
  // stay exactly the candidate — a gate record written there would dirty the
  // very thing the freeze is asserting. LIMIT: on a loop that fails after the
  // done-gate, G_done.json is written by the failure path instead, beside
  // FAILED.md, and is not in any commit.
  const doneGatePath = writeGateRecord("done", doneGate.record);

  const evidenceSha = commitPaths(
    repoRoot,
    [evidencePath(loop), gitrefPath(loop), doneGatePath],
    `harness(${loop}): evidence E_t for ${candidateSha.slice(0, 12)}`,
  );
  result.evidenceSha = evidenceSha;
  // The invariant QA's D1 broke, asserted directly rather than inferred from
  // the stage checks that are supposed to make it true. A tag landed on an
  // evidence commit whose parent was a rogue commit instead of the candidate,
  // while E_t named the candidate — the record and the tree disagreeing with
  // nothing to notice. One rev-parse closes it.
  const evidenceParent = firstParent(repoRoot, evidenceSha);
  if (evidenceParent !== candidateSha) {
    return fail(
      "qa",
      "candidate-not-parent-of-evidence",
      `the evidence commit ${evidenceSha.slice(0, 12)} has parent ${evidenceParent?.slice(0, 12) ?? "(none)"} ` +
        `but the candidate is ${candidateSha.slice(0, 12)}. Something was committed between the candidate and ` +
        `the evidence, so E_t describes a tree that is not the candidate's.`,
    );
  }

  const qaTagged = tagVerified(qaTag, evidenceSha, `HoH loop ${loop}: QA evidence`);
  if (!qaTagged.ok) return fail("qa", "tag-target-moved", qaTagged.reason);
  log(`  qa: evidence ${evidenceSha}, tagged ${qaTag}`);

  result.status = "completed";
  result.exitCode = checks.allPassed ? 0 : 1;
  log(
    `loop ${loop} completed: candidate ${candidateSha}, evidence ${evidenceSha}, ` +
      `checks ${checks.allPassed ? "green" : "RED"}. Restore with: git reset --hard ${baseTag}`,
  );
  return result;
}
