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
  normaliseRepoPath,
  requireCleanTree,
  verifyFrozen,
  type AllowlistVerdict,
  type FrozenCandidate,
} from "./workspace.js";
import {
  isProcessRole,
  isRuntimeConstructed,
  makeWriter,
  WriteRefused,
  type ProcessRunRecord,
  type RoleContext,
  type RoleName,
  type RoleSession,
} from "./roles.js";
import {
  developerReportJsonSchema,
  jsonSchemas,
  validateDeveloperReport,
  validateEvidence,
  validatePlan,
  type CheckOutcome,
  type DeveloperReport,
  type Evidence,
  type Plan,
} from "./schema.js";
import {
  ConfigWatch,
  dotGitLink,
  gitExecPath,
  includesAtBase,
  unsafeLocalKeys,
  machineConfigPaths,
  MachineConfigWatch,
  repositoryLinksAtBase,
  resolveGitDirs,
  type ConfigVerdict,
  type GitDirs,
  type MachineConfigFinding,
} from "./configwatch.js";
import {
  GitFailed,
  GitRefused,
  gitTry,
  NULL_DEVICE,
  pinRepo,
  filtersUsedByTrackedPaths,
  readMachineSafeConfig,
  renderSafeConfig,
  unpinRepo,
} from "./git.js";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";
import {
  defaultChecks,
  reconcileReportedChecks,
  checkEnv,
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
import { TREE_KILL_STATEMENT } from "./process.js";
import {
  buildJevRequest,
  DryRunTransport,
  DONE_GATE_QUESTIONS,
  GateCallFailed,
  JEV_KEY_VAR,
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
  | "policy-unreadable"
  | "stage-changed-config"
  | "role-timeout"
  | "process-role-unwatched"
  | "remote-configured"
  | "include-at-base"
  | "role-unresolvable"
  | "git-dirs-unresolvable"
  | "unsafe-config-at-base"
  | "link-at-base"
  | "required-filter"
  | "runtime-git-failed"
  | "runtime-git-refused"
  | "runtime-error";

/**
 * F11, as ruled (rulings-1 R6, amended by rulings-2 R8), and the channel
 * table (CA-11). Printed at the end of every loop, pass or fail, because a
 * green loop that does not say what it did not look at invites its reader to
 * assume it looked everywhere.
 */
export const LOOP_LIMITS =
  "WHAT A GREEN LOOP MEANS: the runtime completed; build and unit exited 0; the gates were consulted as " +
  "their mode says; the ref and config windows were clean at every stage; E_t came from the QA seat. It does " +
  "NOT mean the candidate is correct, safe or mergeable. The clean windows mean clean ON THE PROBED CHANNELS " +
  "ONLY — refs, HEAD after a deleted ref, hooks and config. The index, submodules, reflog and everything " +
  "outside .git/ were not checked, except the global/system git config files, which are hashed and reported, " +
  "not restored.\n" +
  "CHANNELS: refs — watched (G-041) | HEAD after a deleted ref — watched (G-045) | hooks — watched, restored " +
  "by bytes | repository config (common config, config.worktree, info/, a linked worktree's .git file) — " +
  "watched, restored by bytes | config outside the repository (global, XDG, system) — runtime reads closed " +
  "(layer 0 carries only the machine's non-program keys, in a generated file whose bytes are checked before " +
  "every runtime git call); role writes hashed and reported, not restored | includes and any non-allowlisted key " +
  "in the target's own config at base — refused at preflight | HEAD, index or config left UNREADABLE by a stage " +
  "— recorded (a LoopResult and FAILED.md naming the failing call), NOT repaired | " +
  "index — unprobed | submodules — unprobed | reflog — unprobed | outside .git/ (writes, network, surviving " +
  "processes) — invisible to the runtime.\n" +
  "RESIDUAL LIMIT (R20): the generated global config is compare-then-call. A process that OUTLIVES the role " +
  "could write it between the comparison and the call. The role-timeout tree kill closes that for a role " +
  "that times out; a child that detaches from a role that exits normally is not tracked (U3), so the two " +
  "guarantees depend on each other.";

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
  /** One per stage window that closed, in order. */
  configVerdicts: ConfigVerdict[];
  /** R8: machine-wide git config that changed during a stage. Reported, never restored, never a failure. */
  machineConfigFindings: MachineConfigFinding[];
  /** The developer's R_t, when one validated. Never trusted — see `findings`. */
  developerReport: DeveloperReport | null;
  /** The developer process, when the developer is one: exit code, form, transcript, env names. */
  developerRun: Omit<ProcessRunRecord, "deliverable"> | null;
  /** Everything recorded that is not a failure: R_t disagreements, a role's exit code, machine-config changes. */
  findings: string[];
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

  // --- A role that is a PROCESS, and the repository it would run in -------
  //
  // Candidate A's preflight refusals (CA-3). Every one is thrown from here —
  // synchronously, before `runLoopInner` — so "refused before any tag, commit
  // or artefact" is true by construction: nothing below this block has run.
  const processRoles = (["planner", "developer", "qa"] as const).filter((r) => isProcessRole(config.roles[r]));
  if (processRoles.length > 0 && !refWatchEnabled) {
    throw new LoopRefused(
      "process-role-unwatched",
      processRoles,
      `refusing to start loop ${config.loop}: ${processRoles.join(", ")} ${processRoles.length === 1 ? "is a" : "are"} ` +
        `process role(s) and the ref-watch is off. A runtime-constructed process is still a process: it can run ` +
        `any git command, and the ref window is how a ref it writes is seen.`,
    );
  }

  const repoOk = gitTry(config.repoRoot, ["rev-parse", "--is-inside-work-tree"]);
  let gitDirs: GitDirs | null = null;
  let carried: CarriedConfig | null = null;
  let workTree = resolvePath(config.repoRoot);
  if (repoOk.ok && repoOk.stdout === "true") {
    const linked = dotGitLink(config.repoRoot);
    if (linked !== null) {
      throw new LoopRefused(
        "link-at-base",
        [],
        `refusing to start loop ${config.loop}: ${linked} is a link at base. A restore or a git call through it ` +
          `would write outside the repository. Refused before any tag, commit or artefact.`,
      );
    }
    // R12: resolved ONCE, here, before any role has run — the only moment the
    // answer is the repository's rather than a role's.
    try {
      gitDirs = resolveGitDirs(config.repoRoot);
    } catch (err) {
      throw new LoopRefused(
        "git-dirs-unresolvable",
        [],
        `refusing to start loop ${config.loop}: the repository's git dirs could not be resolved, so the config ` +
          `window would have nothing to watch: ${(err as Error).message}`,
      );
    }

    // R18: pinned from the moment the dirs are resolved, so EVERY preflight
    // query below — includes, R21, and R19's attribute query — already runs
    // pinned, under layers 0 and 1 (the planner's ordering condition on R19).
    workTree = resolveWorkTree(config.repoRoot);
    pinRepo(config.repoRoot, { gitDir: gitDirs.gitDir, workTree, globalConfigPath: null, globalConfigBytes: null });
  }

  try {
    if (gitDirs !== null) carried = preflightConfig(config, gitDirs, workTree);
    preflightUnderPin(config, processRoles, gitDirs !== null);
  } catch (err) {
    releasePin(config.repoRoot, carried);
    throw err;
  }

  return runLoopInner(config, refWatchEnabled, gitDirs, carried);
}

/**
 * The target's config at base, in the order the planner ruled:
 * R13 includes → R21 local config default-deny → R19 attributes. R21 runs before
 * R19's `check-attr` query because that query is itself a runtime git call
 * against the base, and a program key already in local config would otherwise
 * execute during the very query meant to protect against it. Returns what
 * layer 0 carries, after re-pinning with the generated global config.
 */
function preflightConfig(config: LoopConfig, gitDirs: GitDirs, workTree: string): CarriedConfig {
  const links = repositoryLinksAtBase(config.repoRoot, gitDirs);
  if (links.length > 0) {
    throw new LoopRefused(
      "link-at-base",
      [],
      `refusing to start loop ${config.loop}: a link is already at a repository watched path at base — ` +
        `${links.join("; ")}. Refused before any tag, commit or artefact. A machine-config path that is a ` +
        `link at base is not this check.`,
    );
  }

  // R13: an include present at base puts its target outside every window.
  const inc = includesAtBase(config.repoRoot, gitDirs);
  if (inc.error !== null) {
    throw new LoopRefused(
      "include-at-base",
      [],
      `refusing to start loop ${config.loop}: the repository's config could not be checked for includes ` +
        `(${inc.error}). Refused rather than read as "no includes".`,
    );
  }
  if (inc.keys.length > 0) {
    throw new LoopRefused(
      "include-at-base",
      [],
      `refusing to start loop ${config.loop}: the repository's own config carries ${inc.keys.length} include ` +
        `key(s) at base — ${inc.keys.join("; ")}. An include's target is outside every window this runtime ` +
        `keeps, so a role could change what git executes without changing a watched file. Remove the key; the ` +
        `target of a loop is a scratch clone, which has no reason to carry one (rulings-2 R13).`,
    );
  }

  // R21: the target's own config is default-deny at base. Checked after the
  // include refusal so an include is named as one.
  const unsafe = unsafeLocalKeys(config.repoRoot, gitDirs);
  if (unsafe.error !== null || unsafe.keys.length > 0) {
    throw new LoopRefused(
      "unsafe-config-at-base",
      [],
      unsafe.error !== null
        ? `refusing to start loop ${config.loop}: the repository's config could not be read (${unsafe.error}). ` +
          `Refused rather than read as "nothing there".`
        : `refusing to start loop ${config.loop}: the repository's own config carries ${unsafe.keys.length} key(s) ` +
          `outside the safe allowlist — ${unsafe.keys.join("; ")}. A key the runtime has not vetted may name a ` +
          `program that runs inside the runtime's own git calls; the allowlist is what a fresh clone writes plus ` +
          `identity and file-handling keys (rulings-2 R21). Remove it: the target is a scratch clone.`,
    );
  }

  // R19: the machine's NON-program keys, carried in a generated global
  // config; a required filter the target needs is refused by name.
  const safe = readMachineSafeConfig(config.repoRoot);
  if (safe.requiredFilters.length > 0) {
    const used = filtersUsedByTrackedPaths(config.repoRoot);
    const needed = safe.requiredFilters.filter((f) => used.has(f.split(".")[1] ?? ""));
    if (needed.length > 0) {
      throw new LoopRefused(
        "required-filter",
        [],
        `refusing to start loop ${config.loop}: the target's tracked files need ${needed.join("; ")} — a ` +
          `required filter names a program, and layer 0 does not carry program-valued keys into the runtime's ` +
          `git calls, so the target could not be read faithfully without running it.`,
      );
    }
  }
  const configDir = mkdtempSync(join(tmpdir(), "hoh-gitconfig-"));
  const globalConfigPath = join(configDir, "global-config");
  const globalConfigBytes = Buffer.from(renderSafeConfig(safe.values), "utf-8");
  writeFileSync(globalConfigPath, globalConfigBytes);
  pinRepo(config.repoRoot, { gitDir: gitDirs.gitDir, workTree, globalConfigPath, globalConfigBytes });
  return { values: safe.values, path: globalConfigPath, dir: configDir };
}

/** The work tree's top level, as git reports it. Resolved before the pin exists. */
function resolveWorkTree(repoRoot: string): string {
  const r = gitTry(repoRoot, ["rev-parse", "--show-toplevel"]);
  return r.ok && r.stdout !== "" ? resolvePath(r.stdout) : resolvePath(repoRoot);
}

/** What layer 0 carried for this loop, recorded in the iteration record (R19). */
interface CarriedConfig {
  values: Record<string, string>;
  path: string;
  dir: string;
}

function releasePin(repoRoot: string, carried: CarriedConfig | null): void {
  unpinRepo(repoRoot);
  if (carried !== null) {
    try {
      rmSync(carried.dir, { recursive: true, force: true });
    } catch {
      // A temp file that outlives the loop is clutter, not a fault.
    }
  }
}

/** Refusals that run git, and so run AFTER the pin is in place. */
function preflightUnderPin(config: LoopConfig, processRoles: readonly RoleName[], isRepository: boolean): void {
  if (isRepository) {
    if (processRoles.length > 0) {
      // Structural, not a promise: a push with nowhere configured to go. `git
      // remote` is itself refused by the runtime, so the config is read.
      const remotes = gitTry(config.repoRoot, ["config", "--get-regexp", "^remote\\..*\\.url$"]);
      if (remotes.status !== 1) {
        throw new LoopRefused(
          "remote-configured",
          processRoles,
          remotes.ok
            ? `refusing to start loop ${config.loop} with a process role: the target repository has remote(s) ` +
              `configured — ${remotes.stdout.split("\n").join("; ")}. Run against a scratch clone with no ` +
              `remote. LIMIT: this removes the configured destination only; a role can still push to an ` +
              `explicit URL, and nothing inside the runtime can see the network.`
            : `refusing to start loop ${config.loop}: remotes could not be checked (${remotes.stderr || `exit ${remotes.status}`}). ` +
              `Refused rather than read as "no remotes".`,
        );
      }
      for (const r of processRoles) {
        const role = config.roles[r];
        if (!isProcessRole(role)) continue;
        const p = role.preflight();
        if (!p.ok) {
          throw new LoopRefused(
            "role-unresolvable",
            [r],
            `refusing to start loop ${config.loop}: the ${r} role's launcher cannot be run without a shell — ` +
              `${p.reason}. There is no fallback to a shell.`,
          );
        }
      }
    }
  }
}

async function runLoopInner(
  config: LoopConfig,
  refWatchEnabled: boolean,
  gitDirs: GitDirs | null,
  carried: CarriedConfig | null,
): Promise<LoopResult> {
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
    configVerdicts: [],
    machineConfigFindings: [],
    developerReport: null,
    developerRun: null,
    findings: [],
  };

  // Layer 2 and R8. Null only when the target is not a repository, which the
  // preconditions below turn into a recorded failure before any stage runs.
  const configWatch = gitDirs === null ? null : new ConfigWatch(gitDirs, repoRoot);
  const machineWatch =
    gitDirs === null ? null : new MachineConfigWatch(machineConfigPaths(env, gitExecPath(repoRoot)));
  for (const note of machineWatch?.baseNotes() ?? []) result.findings.push(note);

  /**
   * The iteration record for everything that is not a failure. Written beside
   * `E_t` on a completed loop and beside `FAILED.md` on a failed one, so the
   * findings of a run survive whichever way it ended.
   */
  const findingsPath = `${iterationDir(loop)}/findings.json`;
  const developerReportPath = `${iterationDir(loop)}/R_t.json`;
  const renderFindings = (): string =>
    `${JSON.stringify(
      {
        loop,
        findings: result.findings,
        machine_config_findings: result.machineConfigFindings,
        machine_config_paths: machineWatch?.paths ?? [],
        // R19: exactly what layer 0 carried from the machine, and where.
        layer0_carried_keys: carried?.values ?? {},
        layer0_global_config: carried?.path ?? NULL_DEVICE,
        config_verdicts: result.configVerdicts.map((v) => ({ stage: v.stage, ok: v.ok, examined: v.examined, changes: v.changes })),
        limits: LOOP_LIMITS,
        tree_kill: TREE_KILL_STATEMENT,
      },
      null,
      2,
    )}\n`;
  const renderDeveloperRecord = (): string =>
    `${JSON.stringify(
      {
        note: "R_t is the developer role's own account and is NEVER TRUSTED; the runtime's measurement is the diff and the exit codes.",
        report: result.developerReport,
        runtime: result.developerRun,
      },
      null,
      2,
    )}\n`;

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
    // Findings and the developer record survive a failed loop too — the run
    // that failed is exactly the one a reader needs them for. They travel
    // INSIDE FAILED.md rather than beside it: one failure artifact, as before.
    if (result.baseSha !== null) {
      record.appendix =
        `## Findings (recorded, not failures)\n\n\`\`\`json\n${renderFindings()}\`\`\`\n` +
        (result.developerReport !== null || result.developerRun !== null
          ? `\n## Developer record\n\n\`\`\`json\n${renderDeveloperRecord()}\`\`\`\n`
          : "");
    }
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
    log(LOOP_LIMITS);
    log(TREE_KILL_STATEMENT);
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

  /** Which stage the loop is in, for the R14 backstop's record. */
  let currentStage = "preflight";

  // R14: once preflight has passed, NOTHING leaves this function as an exception.
  // A role that writes garbage to .git/HEAD, .git/index or .git/config can make
  // the runtime's next git call fail (QA, measured on three channels) — that is
  // G-045's class through channels this runtime does not repair. So the CLASS is
  // caught: any throw becomes a LoopResult and FAILED.md naming the failing call.
  // It is a RECORD, not a repair: the repository may be left as the role made it.
  try {
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

    // QA's F3. A missing credential is the same KIND of fact as an unreadable
    // policy file — a precondition of running live that is knowable before any
    // work starts — and it was being discovered at the planner gate, after
    // loop-001-base had been created in the target repository. Checked here, in
    // the same place, for the same reason.
    //
    // Only when the runtime builds its own transport: an injected one is a test's
    // or a caller's, and it has no key to look for.
    if (gateMode === "live" && config.transport === undefined) {
      const key = env[JEV_KEY_VAR];
      if (typeof key !== "string" || key.trim() === "") {
        return fail(
          "preflight",
          "gate-unavailable",
          `gate mode is "live" and ${JEV_KEY_VAR} is not set in this process's environment. It is read ` +
            `from the environment only — never from a file in this repo, a config key, a CLI flag or a ` +
            `prompt. Set it in the shell that runs the harness, or use --gate dry-run. Refused before ` +
            `the loop tagged or wrote anything.`,
        );
      }
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
    const runStage = async (
      role: RoleSession,
      allow: Allowlist,
      attempt: number,
      previousProblems: readonly string[],
      extras: Pick<RoleContext, "plan" | "candidate" | "checks">,
    ): Promise<
      | { ok: true; deliverable: unknown; verdict: AllowlistVerdict; processRun: ProcessRunRecord | null }
      | { ok: false; code: FailureCode; reason: string; processRun: ProcessRunRecord | null }
    > => {
      const roleName: RoleName = role.role;
      const ctx: RoleContext = {
        role: roleName,
        loop,
        repoRoot,
        attempt,
        allowlist: allow,
        previousProblems,
        schema: roleName === "planner" ? schemas.plan : roleName === "qa" ? schemas.evidence : developerReportJsonSchema(),
        plan: extras.plan,
        candidate: extras.candidate,
        checks: extras.checks,
        write: makeWriter(repoRoot, allow, roleName),
      };

      // The base this stage is judged against. Every path difference between
      // here and the stage's end is the stage's doing, committed or not.
      const stageBase = headSha(repoRoot);
      // The config/hooks window and the machine-config hash open at the stage
      // boundary, not at loop start (rulings-1 refinement), so the runtime's own
      // between-stage writes are never inside a window.
      configWatch?.begin(roleName);
      machineWatch?.begin(roleName);
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
      let refVerdict: RefVerdict | null = null;

      /**
       * Close the ref window — READ ONLY — and put HEAD back before anything
       * else looks at it.
       *
       * The ordering is QA's D1. A role that runs `git checkout -b evil` leaves
       * HEAD naming a branch the watch is about to delete; deleting it first
       * makes `git rev-parse HEAD` fail, and `enforceAllowlist` reads HEAD as
       * its first act. Restoring HEAD moves nothing but HEAD, so the allowlist
       * still sees every path the stage touched.
       *
       * Nothing else is restored here: the verdict has to be computed against
       * the repository the ROLE left, and a backwards move of the checked-out
       * branch is a fact `enforceAllowlist` must still see.
       *
       * **With one exception, and it is the narrowest one that works: a deferred
       * ref the stage DELETED** (`G-045`). `restoreHead` compares HEAD's symbolic
       * NAME, which `update-ref -d` does not change — only the referent goes —
       * so HEAD is left naming a ref that is not there and `enforceAllowlist`'s
       * first `rev-parse HEAD` fails, taking `GitFailed` out of `runLoop` ahead
       * of the rollback. The deletion is put back here because it is the only
       * delta that makes the READ ITSELF impossible; a MOVE is still left alone,
       * so D2's backwards move is seen and reported rather than quietly undone.
       * The comparison above has already recorded the deletion, so the loop still
       * fails with `stage-changed-ref`.
       */
      const closeRefWindow = (): { verdict: RefVerdict | null; headNote: string } => {
        if (!refWatch) return { verdict: null, headNote: "" };
        const verdict = refWatch.compare();
        const headNote = refWatch.restoreHead();
        return { verdict, headNote: headNote + refWatch.restoreDeletedDeferred(verdict) };
      };

      /**
       * Undo whatever the stage left behind.
       *
       * Order matters: a rogue commit has to be unwound before reverting paths,
       * because once HEAD has moved `git checkout HEAD -- <path>` restores the
       * ROGUE content rather than the original.
       */
      const rollBack = (verdict: ReturnType<typeof enforceAllowlist>): string => {
        // Refs first, HEAD included. After this the checked-out branch is back
        // where the stage found it, so `resetHardTo` below is resetting to a
        // commit that IS an ancestor of HEAD — which is why QA's D2 ended in
        // "recover by hand" without it.
        const refNote = refWatch && refVerdict ? refWatch.restore(refVerdict) : "";
        const refMoved = refVerdict !== null && (refVerdict.unauthored.length > 0 || refVerdict.deferredDelta !== null);

        if (verdict.headMoved || refMoved) {
          try {
            resetHardTo(repoRoot, stageBase);
            return `${refNote} The stage's work was discarded and the tree reset to ${stageBase.slice(0, 12)}.`;
          } catch (err) {
            return `${refNote} THE TREE COULD NOT BE ROLLED BACK: ${(err as Error).message} Recover by hand before rerunning.`;
          }
        }
        const bad = [...verdict.violations, ...verdict.unsafe.map((u) => u.path)];
        if (bad.length > 0) revertPaths(repoRoot, bad);
        return `${refNote} The offending paths were reverted.`;
      };

      let deliverable: unknown;
      let processRun: ProcessRunRecord | null = null;
      let thrown: unknown = null;
      try {
        if (isProcessRole(role)) {
          processRun = await role.execute(ctx);
          deliverable = processRun.deliverable;
          if (processRun.outcome.spawnError !== null) {
            thrown = new Error(`the role process could not be started: ${processRun.outcome.spawnError}`);
          }
        } else {
          deliverable = await role.run(ctx);
        }
      } catch (err) {
        thrown = err;
      }

      // ===================================================================
      // Everything below runs after the role has EXITED (CA-1), and its
      // ORDER is load-bearing:
      //
      //   1. the config/hooks window — FILE I/O ONLY. A planted
      //      `core.fsmonitor` runs on the next `git status`, so the restore
      //      must finish before any git call reads the repository (G-045's
      //      "restore before any read", one channel earlier). Moving a git
      //      read above this line is the defect layer 1 still catches.
      //   2. the machine-wide config hash — file I/O only, reported.
      //   3. the ref window — git, with layers 0 and 1 on every call.
      //   4. the allowlist — git.
      // ===================================================================
      const configVerdict = configWatch ? configWatch.closeAndRestore() : null;
      if (configVerdict) {
        result.configVerdicts.push(configVerdict);
        log(`  ${roleName} config: ${configVerdict.message}`);
      }
      if (machineWatch) {
        for (const f of machineWatch.compare()) {
          result.machineConfigFindings.push(f);
          const typeChange = f.after.startsWith("type change:");
          const line =
            `machine-wide git config changed during the ${f.stage} stage: ${f.scope} ${f.path} ${f.before} → ${f.after}. ` +
            (typeChange ? `Reported as a type change. ` : "") +
            `REPORTED, NOT RESTORED — this file is read by git for every session on the machine, and the runtime ` +
            `does not rewrite a person's own config (rulings-2 R8).`;
          result.findings.push(line);
          log(`  FINDING: ${line}`);
        }
      }

      // R38: an ancestor link means the next git call, including rollback, would
      // write outside the repository. Stop before any of those calls.
      const timedOut = processRun?.outcome.timedOut === true;
      if (configVerdict?.ancestorLink) {
        const ancestor = configVerdict.ancestorLink;
        const kill =
          timedOut
            ? `${roleName} exceeded its bound after ${processRun!.outcome.durationMs}ms. The kill that ran: ${processRun!.outcome.killNote}. ` +
              `That is the kill's own result, not a census of descendants. A double-forked process can survive it ` +
              `(named limit; the double-fork is not closed). `
            : "";
        return {
          ok: false,
          code: timedOut ? "role-timeout" : "stage-changed-config",
          processRun,
          reason:
            `${kill}${roleName} was refused, not warned. ${configVerdict.message} ` +
            `Rollback was not performed: ${ancestor} is a link, and a git reset or checkout through it would write ` +
            `outside the repository. The tree is left for a human. A boundary breach is not retried.`,
        };
      }

      const closed = closeRefWindow();
      refVerdict = closed.verdict;
      const headNote = closed.headNote;
      const verdict = enforceAllowlist(repoRoot, allow, stageBase);

      const refBad = refVerdict !== null && !refVerdict.ok;
      const configBad = configVerdict !== null && !configVerdict.ok;
      const configPart = configBad ? ` ${configVerdict!.message}` : "";

      if (timedOut) {
        const undone = verdict.ok && !refBad ? "" : rollBack(verdict);
        return {
          ok: false,
          code: "role-timeout",
          processRun,
          reason:
            `${roleName} exceeded its bound after ${processRun!.outcome.durationMs}ms. ` +
            `The kill that ran: ${processRun!.outcome.killNote}. ` +
            `That is the kill's own result, not a census of descendants. ` +
            `A double-forked process can survive it (named limit; the double-fork is not closed).` +
            `${configPart}${refBad ? ` ${refVerdict!.message}` : ""}${headNote}${undone}`,
        };
      }

      if (thrown !== null) {
        const err = thrown as Error;
        // The in-process helper refusing is still a boundary violation: the role
        // tried. It is reported as one so the two mechanisms agree.
        const thrownCode: FailureCode = err instanceof WriteRefused ? "allowlist-violation" : "role-threw";
        const undone = verdict.ok && !refBad ? "" : rollBack(verdict);
        if (configBad) {
          return {
            ok: false,
            code: "stage-changed-config",
            processRun,
            reason: `${roleName} stage:${configPart}${refBad ? ` ${refVerdict!.message}` : ""}${headNote}${undone} The stage also threw: ${err.message}`,
          };
        }
        if (refBad) {
          return {
            ok: false,
            code: "stage-changed-ref",
            processRun,
            reason: `${roleName} stage: ${refVerdict!.message}${headNote}${undone} The stage also threw: ${err.message}`,
          };
        }
        return { ok: false, code: thrownCode, processRun, reason: `${roleName} stage: ${err.message}${headNote}${undone}` };
      }

      if (configBad) {
        const undone = rollBack(verdict);
        return {
          ok: false,
          code: "stage-changed-config",
          processRun,
          reason:
            `${roleName} was refused, not warned.${configPart}` +
            `${refBad ? ` ${refVerdict!.message}` : ""}${headNote}${undone} A boundary breach is not retried.`,
        };
      }

      if (refBad) {
        const undone = rollBack(verdict);
        return {
          ok: false,
          code: "stage-changed-ref",
          processRun,
          reason: `${roleName} was refused, not warned. ${refVerdict!.message}${headNote}${undone}`,
        };
      }
      if (refVerdict) log(`  ${roleName} refs: ${refVerdict.message}`);
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
          processRun,
          reason:
            `${roleName} was refused, not warned. ${verdict.message}${undone} ` +
            `A boundary breach is not retried.`,
        };
      }

      return { ok: true, deliverable, verdict, processRun };
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
    currentStage = "planner";

    const plannerAllow = new Allowlist([`${iterationDir(loop)}/`]);
    let plan: Plan | null = null;
    let problems: string[] = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const staged = await runStage(config.roles.planner, plannerAllow, attempt, problems, {
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

    // Slice four's artifact index is what will fill this. Until then it is
    // empty, stated once here rather than spelled `[]` at three call sites where
    // a reader would have to work out whether the emptiness meant anything.
    const priorFailures: readonly string[] = [];

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
          prior_failures: priorFailures,
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
          // Read from the state the runtime assembled, not from the gate. Until
          // the index lands this is always empty, which is exactly why the
          // threshold on `addresses_top_failures` had nothing to be about (F5).
          hasPriorFailures: priorFailures.length > 0,
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
    currentStage = "developer";

    const devAllow = new Allowlist(config.developerAllowlist ?? [`${iterationDir(loop)}/`]);
    let devVerdict: AllowlistVerdict | null = null;
    let developerReport: DeveloperReport | null = null;
    problems = [];

    // The developer's R_t is schema-validated with the same capped retry as D_t
    // and E_t. A retried attempt starts from a clean tree: the rejected
    // attempt's permitted writes are put back first, so what the next attempt
    // is judged on is its own work.
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const devClean = requireCleanTree(repoRoot, "developer");
      if (!devClean.ok) return fail("developer", "dirty-tree", devClean.reason);

      const staged = await runStage(config.roles.developer, devAllow, attempt, problems, { plan, candidate: null, checks: null });
      if (staged.processRun !== null) {
        const { deliverable: _omit, ...run } = staged.processRun;
        result.developerRun = run;
      }
      if (!staged.ok) return fail("developer", staged.code, staged.reason);

      const validated =
        staged.processRun !== null && staged.processRun.deliverableProblem !== null
          ? { ok: false as const, problems: [staged.processRun.deliverableProblem] }
          : validateDeveloperReport(staged.deliverable);
      if (validated.ok) {
        developerReport = validated.value;
        devVerdict = staged.verdict;
        break;
      }
      problems = validated.problems;
      log(`  developer attempt ${attempt} rejected by schema: ${problems.join("; ")}`);
      if (staged.verdict.permitted.length > 0) revertPaths(repoRoot, staged.verdict.permitted);
    }

    if (developerReport === null || devVerdict === null) {
      return fail(
        "developer",
        "schema-cap-exhausted",
        `the developer produced no schema-valid R_t on all ${maxAttempts} attempt(s). ` +
          `An exhausted retry cap is a recorded failure, not a pass and not a silent continue.`,
        { attempts: maxAttempts, problems },
      );
    }
    result.developerReport = developerReport;

    // R_t against the measurement. The report is the role's account; the diff
    // is the runtime's. Every disagreement is recorded, in both directions, and
    // neither side is corrected to match the other.
    const firstNewFinding = result.findings.length;
    const claimed = new Set<string>();
    for (const c of developerReport.changes) {
      const n = normaliseRepoPath(c.path);
      claimed.add(n.ok ? n.value : c.path);
    }
    const measured = new Set(devVerdict.permitted);
    for (const p of [...claimed].sort()) {
      if (!measured.has(p)) {
        result.findings.push(`R_t claims a change to ${p}, which the measured diff does not contain.`);
      }
    }
    for (const p of [...measured].sort()) {
      if (!claimed.has(p)) {
        result.findings.push(`the measured diff changes ${p}, which R_t does not report.`);
      }
    }
    const roleExit = result.developerRun?.outcome.exitCode;
    if (result.developerRun !== null && roleExit !== 0) {
      result.findings.push(
        `the developer process exited ${roleExit ?? "with no code"}${result.developerRun.outcome.signal ? ` (signal ${result.developerRun.outcome.signal})` : ""} ` +
          `and produced a schema-valid R_t. Recorded beside it and handed to the done-gate as data; it neither fails ` +
          `the stage nor is accepted silently.`,
      );
    }
    for (const f of result.findings.slice(firstNewFinding)) log(`  FINDING: ${f}`);
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
    currentStage = "checks";

    // R15: the checks run code the role wrote, so they get a constructed
    // environment, with layer 0 carried as the same generated global config.
    const checks = runDeterministicChecks(
      config.checks ?? defaultChecks(),
      repoRoot,
      checkEnv(env, carried?.path ?? NULL_DEVICE),
    );
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
          prior_failures: priorFailures,
          // The role's own account, LABELLED as such (CA-7): the measured
          // diffstat and exit codes above are the facts; these are claims, and
          // the disagreements between the two are carried beside them.
          developer_claims: {
            note: "reported by the developer role, not measured by the runtime",
            role_exit_code: result.developerRun === null ? null : result.developerRun.outcome.exitCode,
            reported_commands: developerReport.commands,
            disagreements_with_measured_diff: result.findings.filter((f) => f.startsWith("R_t claims") || f.startsWith("the measured diff")),
          },
        },
      },
      (answers) => decideDoneGate(answers, policies!.done, { checksPassed: checks.allPassed }),
    );
    if (!doneGate.ok) return fail("developer", doneGate.code, doneGate.reason);
    log(`  done gate: ${doneGate.record.runtime_action}`);

    // --- Freeze -------------------------------------------------------------
    currentStage = "freeze";

    const candidate: FrozenCandidate = { sha: candidateSha, branch, frozenAt: isoOf(now) };
    const frozen = verifyFrozen(repoRoot, candidate);
    log(`  freeze: ${frozen.reason}`);
    if (!frozen.ok) return fail("qa", "candidate-moved", frozen.reason);

    // --- Stage 3: QA --------------------------------------------------------
    currentStage = "qa";

    const qaAllow = new Allowlist([evidencePath(loop), gitrefPath(loop)]);
    let evidenceRaw: unknown = null;
    let evidence: Evidence | null = null;
    problems = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const staged = await runStage(config.roles.qa, qaAllow, attempt, problems, { plan, candidate, checks });
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

    // The iteration record: findings and the developer's R_t with the runtime's
    // own account of the process beside it. In the evidence commit, not the
    // candidate — the candidate is what the developer produced.
    const writeRecord = makeWriter(repoRoot, new Allowlist([`${iterationDir(loop)}/`]), "planner");
    writeRecord(findingsPath, renderFindings());
    writeRecord(developerReportPath, renderDeveloperRecord());
    artifacts.push(findingsPath, developerReportPath);

    const evidenceSha = commitPaths(
      repoRoot,
      [evidencePath(loop), gitrefPath(loop), doneGatePath, findingsPath, developerReportPath],
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
    log(LOOP_LIMITS);
    log(TREE_KILL_STATEMENT);
    return result;
  } catch (err) {
    const code: FailureCode =
      err instanceof GitFailed ? "runtime-git-failed" : err instanceof GitRefused ? "runtime-git-refused" : "runtime-error";
    return fail(
      currentStage,
      code,
      `the runtime could not continue after the ${currentStage} stage: ${(err as Error).message}. ` +
        `This is a RECORD, not a repair (R14): a stage may have left the repository in a state the runtime cannot ` +
        `read — HEAD, the index or config — and nothing here put it back. Recover by hand before rerunning.`,
    );
  } finally {
    releasePin(repoRoot, carried);
  }
}
