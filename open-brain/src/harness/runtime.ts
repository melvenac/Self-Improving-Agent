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
  gitrefPath,
  iterationDir,
  planJsonPath,
  planMarkdownPath,
  renderEvidence,
  renderFailure,
  renderGitref,
  renderPlanMarkdown,
  type FailureRecord,
} from "./artifacts.js";
import { RefWatch, type RefVerdict } from "./refwatch.js";
import {
  DryRunTransport,
  UnconfiguredTransport,
  type GateAnswer,
  type GatePayload,
  type GateTransport,
} from "./gate.js";

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
  | "stage-changed-ref";

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
  failure: FailureRecord | null;
  /** 0 only when the loop completed AND the deterministic checks were green. */
  exitCode: number;
}

const isoOf = (now: () => Date): string => now().toISOString();

/** `t001` → `001`, for tag names. */
const loopNumber = (loop: string): string => loop.replace(/^t/, "");

export function runLoop(config: LoopConfig): LoopResult {
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

  const log = config.log ?? (() => {});
  const now = config.now ?? (() => new Date());
  const env = config.env ?? process.env;
  const maxAttempts = config.maxAttempts ?? 3;
  const gateMode: GateMode = config.gateMode ?? "skip";
  const transport: GateTransport =
    gateMode === "dry-run"
      ? new DryRunTransport(log, env)
      : (config.transport ?? new UnconfiguredTransport());

  const { repoRoot, loop } = config;
  const refWatch = refWatchEnabled ? new RefWatch(repoRoot) : null;
  const schemas = jsonSchemas();
  const gatePayloads: GatePayload[] = [];
  const gateAnswers: GateAnswer[] = [];
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
    failure: null,
    exitCode: 1,
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
    log(`LOOP ${loop} FAILED at ${stage} [${code}]: ${record.reason}`);
    result.failure = record;
    result.status = "failed";
    result.exitCode = 1;
    return result;
  };

  /** Ask a gate, in whichever mode this run is in. Never silently approves. */
  const consultGate = (payload: GatePayload): { ok: true; answer: GateAnswer } | { ok: false; reason: string } => {
    gatePayloads.push(payload);
    if (gateMode === "skip") {
      const answer: GateAnswer = {
        gate: payload.gate,
        answers: null,
        consulted: false,
        note: "gates are stubbed in slice one; no decision was taken. Not an approval.",
      };
      gateAnswers.push(answer);
      return { ok: true, answer };
    }
    try {
      const answer = transport.dispatch(payload);
      gateAnswers.push(answer);
      return { ok: true, answer };
    } catch (err) {
      return { ok: false, reason: (err as Error).message };
    }
  };

  // --- Preconditions ------------------------------------------------------

  if (!isRepo(repoRoot)) {
    return fail("preflight", "not-a-repo", `${repoRoot} is not inside a git work tree — the loop versions by commit and cannot run without one`);
  }

  const clean = requireCleanTree(repoRoot, "preflight");
  if (!clean.ok) return fail("preflight", "dirty-tree", clean.reason);

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

  const planGate = consultGate({
    gate: "plan",
    loop,
    model: "jev-latest",
    questions: [
      { id: "bounded", kind: "score", prompt: "Is this increment bounded and locally complete?", legend: ["not bounded", "bounded and complete"] },
      { id: "repairs", kind: "choice", prompt: "Does the plan both repair and add a capability?", options: ["both", "repair only", "capability only"] },
    ],
    context: { plan },
  });
  if (!planGate.ok) return fail("planner", "gate-unavailable", planGate.reason);

  const writePlan = makeWriter(repoRoot, plannerAllow, "planner");
  writePlan(planMarkdownPath(loop), renderPlanMarkdown(plan, isoOf(now)));
  writePlan(planJsonPath(loop), `${JSON.stringify(plan, null, 2)}\n`);
  artifacts.push(planMarkdownPath(loop), planJsonPath(loop));
  commitPaths(repoRoot, [planMarkdownPath(loop), planJsonPath(loop)], `harness(${loop}): plan D_t`);
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

  const doneGate = consultGate({
    gate: "developer-done",
    loop,
    model: "jev-latest",
    questions: [
      { id: "complete", kind: "choice", prompt: "Is the increment complete against D_t?", options: ["yes", "no"] },
    ],
    context: { plan, candidate: candidateSha, checks },
  });
  if (!doneGate.ok) return fail("developer", "gate-unavailable", doneGate.reason);

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

  const scoreGate = consultGate({
    gate: "qa-score",
    loop,
    model: "jev-latest",
    questions: [
      { id: "accept", kind: "score", prompt: "How well does the candidate meet D_t's acceptance?", legend: ["not met", "fully met"] },
    ],
    context: { plan, evidence, candidate: candidateSha },
  });
  if (!scoreGate.ok) return fail("qa", "gate-unavailable", scoreGate.reason);

  const writeQa = makeWriter(repoRoot, qaAllow, "qa");
  writeQa(evidencePath(loop), renderEvidence(evidence));
  writeQa(gitrefPath(loop), renderGitref(candidate, loop));
  artifacts.push(evidencePath(loop), gitrefPath(loop));

  const evidenceSha = commitPaths(
    repoRoot,
    [evidencePath(loop), gitrefPath(loop)],
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
