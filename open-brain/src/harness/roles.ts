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

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Allowlist } from "./workspace.js";
import { normaliseRepoPath, type FrozenCandidate } from "./workspace.js";
import type { CheckRunResults } from "./checks.js";
import type { DeveloperReport, Plan } from "./schema.js";
import { chooseEffort, loadEffortPolicy, type EffortChoice } from "./policies.js";
import {
  constructEnv,
  findOnPath,
  resolveLauncher,
  runBounded,
  type LauncherResolution,
  type SpawnOutcome,
} from "./process.js";

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
  /**
   * Produce the deliverable. Unvalidated on purpose — validation is the
   * runtime's. May return a promise: a real role is a process, and every
   * window the runtime keeps around a stage closes only after it has EXITED.
   */
  run(ctx: RoleContext): unknown | Promise<unknown>;
}

/* ------------------------------------------------------------------------- *
 * Provenance
 *
 * `G-041`: a role acted on the repository through a channel nobody watched.
 * The repair has two halves, and the runtime's half needs to know whether it
 * built the role in front of it. That question cannot be answered by looking at
 * the object — a foreign role can declare any `role`, implement `run`, and
 * behave exactly like a stub, because **behaviour is what an adversarial role
 * controls.**
 *
 * So the record is kept here, in a set this module does not export and no
 * caller can reach. A role is runtime-constructed if and only if its
 * constructor ran in this file. Nothing outside can add to the set — not by
 * importing a marker, not by copying a symbol, not by setting a property.
 *
 * **Every future real-role constructor registers itself the same way**, in this
 * module, passing its OWN class as the expected `new.target`. A role built
 * anywhere else — or a subclass of one built here — is foreign, which is the
 * intended answer.
 * ------------------------------------------------------------------------- */

const runtimeConstructed = new WeakSet<object>();

/**
 * Record a role as one this module built — **only when the class being
 * constructed is the one calling.**
 *
 * `newTarget` is `new.target` from the constructor. QA's D3: without this
 * check, `class Evil extends StubPlanner { run() { … } }` calls `super()`, the
 * registration runs, and a role whose `run()` is entirely foreign is
 * runtime-constructed as far as the mechanism can tell. The doc comment was
 * literally true — the constructor DID run in this file — and the property it
 * was defending was defeated by inheritance.
 *
 * Provenance is the exact class, not the constructor chain.
 */
function registerRuntimeRole(session: RoleSession, newTarget: unknown, expected: unknown): void {
  if (newTarget !== expected) return;
  runtimeConstructed.add(session);
}

/**
 * Whether the runtime constructed this role itself.
 *
 * LIMIT: this answers who built the object, not what it does. A
 * runtime-constructed role is still held to the allowlist, the commit boundary
 * and the ref-watch — provenance narrows who may run, never what they may do.
 */
export function isRuntimeConstructed(session: RoleSession): boolean {
  return runtimeConstructed.has(session as unknown as object);
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
  constructor(private readonly overrides: Partial<Plan> = {}) {
    registerRuntimeRole(this, new.target, StubPlanner);
  }

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
  constructor(private readonly writes: ReadonlyArray<{ path: string; content: string }> = []) {
    registerRuntimeRole(this, new.target, StubDeveloper);
  }

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
    // A schema-valid R_t that matches what it wrote, so a stub loop records
    // no disagreement between the report and the measured diff.
    const report: DeveloperReport = {
      loop: ctx.loop,
      summary: `stub developer: wrote ${writes.length} file(s)`,
      changes: writes.map((w) => ({ path: w.path, what: "written by the stub" })),
      commands: [],
      claims: [],
    };
    return report;
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
  constructor(private readonly overrides: Record<string, unknown> = {}) {
    registerRuntimeRole(this, new.target, StubQa);
  }

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

/* ------------------------------------------------------------------------- *
 * A real role: an external process
 *
 * Slice three, candidate A. **The developer is the only role that may be a
 * process in this slice** (rulings-1 R1) and the constructor refuses any other.
 * Everything the runtime relies on is a CHECK it makes after the process
 * exits — the ref window, the config window, the allowlist — never a rule in
 * the prompt. Step-Back §5.1: a fact delivered at 100% reliability did not
 * change behaviour, and a role prompt will not do better.
 * ------------------------------------------------------------------------- */

/** How a harness is launched: one adapter per harness, no shell in any of them. */
export interface RoleAdapter {
  /** `claude-code`, or `command` for a plain argv. */
  readonly name: string;
  /** Resolve what will actually be spawned, from the environment the role runs in. */
  resolve(env: NodeJS.ProcessEnv): LauncherResolution;
  /** Arguments after the resolved executable and its pre-args. `effort` is the policy's level for this launch. */
  args(run: { sessionId: string; effort: string }): string[];
  /** Parent variables this harness needs beyond the base allowlist (never a denied one). */
  readonly envAllow: readonly string[];
  /** Where this harness left the run's transcript, if it can be found. */
  transcriptFor?(sessionId: string, env: NodeJS.ProcessEnv): string | null;
}

/** A plain launcher and argument list. Resolved like any other launcher — a `.cmd` is never spawned as one. */
export function commandAdapter(launcher: string, args: readonly string[] = [], envAllow: readonly string[] = []): RoleAdapter {
  return {
    name: "command",
    resolve: () => resolveLauncher(launcher),
    args: () => [...args],
    envAllow,
  };
}

export interface ClaudeAdapterOptions {
  /** A specific launcher path. Default: `claude` found on the role environment's PATH. */
  launcher?: string;
  model?: string;
  maxBudgetUsd?: number;
}

/**
 * The flags this adapter passes, as data, so the test that reads the installed
 * `claude --help` can assert each one exists (CA-9) rather than a flag changing
 * upstream failing the loop instead of the suite.
 */
export const CLAUDE_ADAPTER_FLAGS: readonly string[] = [
  "--print",
  "--output-format",
  "--session-id",
  "--permission-mode",
  "--permission-prompts",
  "--strict-mcp-config",
  "--setting-sources",
  "--allowed-tools",
  "--disallowed-tools",
  "--effort",
];

/**
 * Claude Code, headless.
 *
 * Each flag is here for a reason the record can name:
 * - `--strict-mcp-config` with no `--mcp-config`: the role gets NO MCP
 *   servers. With the user's servers it could call `ob_state` and write the
 *   project record from outside the repository — a channel no window sees.
 * - `--setting-sources local`: the user's settings, and so the user's hooks,
 *   are not loaded. Otherwise the SessionStart hook would stamp the shared
 *   active-session slot and the SessionEnd hook would write this run into the
 *   knowledge store (the slot-overwrite family, T-163).
 * - `--permission-prompts none` with an explicit allow and deny list: defence
 *   in depth, NOT enforcement — a host rule that pattern-matches a Bash command
 *   can be routed around. The runtime observes the effect regardless.
 * - `--session-id`: a runtime-chosen id, so the transcript can be found and
 *   its absence reported rather than guessed at.
 * - `--effort`: the level from the effort policy for this launch (T-173). It is
 *   always passed. A Claude Code that does not recognise the flag exits nonzero
 *   and the stage fails; that is the intended failure on an older CLI (T-182).
 *   There is no construction-time effort option.
 */
export function claudeAdapter(opts: ClaudeAdapterOptions = {}): RoleAdapter {
  return {
    name: "claude-code",
    resolve: (env) => {
      const launcher = opts.launcher ?? findOnPath("claude", env);
      if (launcher === null) {
        return { ok: false, reason: "no `claude` launcher on the role environment's PATH" };
      }
      return resolveLauncher(launcher);
    },
    args: ({ sessionId, effort }) => {
      if (effort === "") {
        throw new Error("claudeAdapter requires the effort level from the effort policy (T-173); there is no default");
      }
      const a = [
        "--print",
        "--output-format", "json",
        "--session-id", sessionId,
        "--permission-mode", "acceptEdits",
        "--permission-prompts", "none",
        "--strict-mcp-config",
        "--setting-sources", "local",
        "--allowed-tools", "Read Edit Write Glob Grep Bash",
        "--disallowed-tools",
        "Bash(git push:*) Bash(git fetch:*) Bash(git pull:*) Bash(git remote:*) Bash(git clone:*) WebFetch WebSearch",
        "--effort", effort,
      ];
      if (opts.model) a.push("--model", opts.model);
      if (opts.maxBudgetUsd !== undefined) a.push("--max-budget-usd", String(opts.maxBudgetUsd));
      return a;
    },
    envAllow: ["ANTHROPIC_API_KEY", "CLAUDE_CONFIG_DIR"],
    transcriptFor: (sessionId, env) => {
      const home = env.HOME ?? env.USERPROFILE ?? "";
      const base = env.CLAUDE_CONFIG_DIR ?? (home === "" ? "" : join(home, ".claude"));
      const projects = join(base, "projects");
      if (base === "" || !existsSync(projects)) return null;
      for (const d of readdirSync(projects, { withFileTypes: true })) {
        if (!d.isDirectory()) continue;
        const p = join(projects, d.name, `${sessionId}.jsonl`);
        if (existsSync(p)) return p;
      }
      return null;
    },
  };
}

/** Everything the runtime records about one role process, beside its deliverable. */
export interface ProcessRunRecord {
  deliverable: unknown;
  /** Set when there is no usable deliverable; used as the schema-retry problem. */
  deliverableProblem: string | null;
  adapter: string;
  form: string;
  resolvedFrom: string;
  how: string;
  /** What was spawned: the executable and the first argument. */
  argvHead: [string, string | null];
  sessionId: string;
  /** Names only — never values. */
  childEnvNames: string[];
  transcriptPath: string | null;
  outcome: SpawnOutcome;
  /** The policy's choice for this launch, beside the process result (T-173). */
  effort: EffortChoice;
}

export interface ProcessRoleOptions {
  adapter: RoleAdapter;
  /** Wall-clock bound on the process tree. Default 30 minutes. */
  timeoutMs?: number;
  /** The environment the role's is constructed FROM. Default `process.env`. */
  parentEnv?: NodeJS.ProcessEnv;
  /** Extra variables forced into the child (never a denied one). */
  envSet?: Readonly<Record<string, string>>;
  /** Effort policy directory. Default: the harness policies directory. */
  policiesDir?: string;
}

export type Preflight = { ok: true; resolution: Extract<LauncherResolution, { ok: true }> } | { ok: false; reason: string };

/** Whether a role is a process the runtime must bound, watch and record. */
export function isProcessRole(r: RoleSession): r is ProcessRole {
  return r instanceof ProcessRole;
}

export class ProcessRole implements RoleSession {
  readonly role: RoleName;
  private readonly opts: ProcessRoleOptions;
  private resolution: Extract<LauncherResolution, { ok: true }> | null = null;

  constructor(role: RoleName, opts: ProcessRoleOptions) {
    if (role !== "developer") {
      throw new Error(
        `a process role may only be the developer in this slice (rulings-1 R1); ${role} was requested. ` +
          `A model-backed QA would replace the instrument the shadow count is measured against.`,
      );
    }
    this.role = role;
    this.opts = opts;
    // Validate the environment shape now: a denied name asked for is refused at
    // construction, before any loop could start.
    constructEnv({}, opts.adapter.envAllow, opts.envSet ?? {});
    registerRuntimeRole(this, new.target, ProcessRole);
  }

  get adapterName(): string {
    return this.opts.adapter.name;
  }

  private parentEnv(): NodeJS.ProcessEnv {
    return this.opts.parentEnv ?? process.env;
  }

  /** Resolve the launcher. Called by the runtime BEFORE any tag; a failure refuses the loop, naming the path. */
  preflight(): Preflight {
    const env = constructEnv(this.parentEnv(), this.opts.adapter.envAllow, this.opts.envSet ?? {});
    const r = this.opts.adapter.resolve(env);
    if (!r.ok) return { ok: false, reason: r.reason };
    this.resolution = r;
    return { ok: true, resolution: r };
  }

  run(ctx: RoleContext): Promise<unknown> {
    return this.execute(ctx).then((r) => r.deliverable);
  }

  /**
   * Run the process once. The deliverable is a JSON file the role writes to a
   * runtime-chosen path OUTSIDE the repository, so it is neither a repository
   * write nor an allowlist question.
   */
  async execute(ctx: RoleContext): Promise<ProcessRunRecord> {
    const resolution = this.resolution ?? (() => {
      const p = this.preflight();
      if (!p.ok) throw new Error(`the role's launcher could not be resolved: ${p.reason}`);
      return p.resolution;
    })();

    const effort = chooseEffort({
      policy: loadEffortPolicy(this.opts.policiesDir),
      stage: this.role,
      repairTargets: ctx.plan?.repair_targets ?? [],
      attempt: ctx.attempt,
    });

    const sessionId = randomUUID();
    const dir = mkdtempSync(join(tmpdir(), "hoh-role-"));
    const deliverablePath = join(dir, "R_t.json");
    const contextPath = join(dir, "context.json");
    writeFileSync(
      contextPath,
      `${JSON.stringify(
        {
          loop: ctx.loop,
          role: ctx.role,
          attempt: ctx.attempt,
          repo_root: ctx.repoRoot,
          allowlist: ctx.allowlist.rules,
          previous_problems: ctx.previousProblems,
          deliverable_path: deliverablePath,
          deliverable_schema: ctx.schema,
          plan: ctx.plan,
        },
        null,
        2,
      )}\n`,
    );

    const env = constructEnv(this.parentEnv(), this.opts.adapter.envAllow, {
      ...(this.opts.envSet ?? {}),
      HOH_CONTEXT_PATH: contextPath,
      HOH_DELIVERABLE_PATH: deliverablePath,
      HOH_REPO_ROOT: ctx.repoRoot,
      HOH_LOOP: ctx.loop,
      HOH_ROLE: ctx.role,
      HOH_ATTEMPT: String(ctx.attempt),
    });

    const args = [...resolution.preArgs, ...this.opts.adapter.args({ sessionId, effort: effort.level })];
    const outcome = await runBounded(resolution.executable, args, {
      cwd: ctx.repoRoot,
      env,
      stdin: rolePrompt(ctx, deliverablePath, contextPath),
      timeoutMs: this.opts.timeoutMs ?? 30 * 60_000,
    });

    let deliverable: unknown = undefined;
    let deliverableProblem: string | null = null;
    if (!existsSync(deliverablePath)) {
      deliverableProblem = `deliverable: the role wrote no file at ${deliverablePath}`;
    } else {
      try {
        deliverable = JSON.parse(readFileSync(deliverablePath, "utf-8"));
      } catch (err) {
        deliverableProblem = `deliverable: ${deliverablePath} is not valid JSON (${(err as Error).message})`;
      }
    }
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // A temp directory that outlives the run is clutter, not a fault.
    }

    return {
      deliverable,
      deliverableProblem,
      adapter: this.opts.adapter.name,
      form: resolution.form,
      resolvedFrom: resolution.resolvedFrom,
      how: resolution.how,
      argvHead: [resolution.executable, args[0] ?? null],
      sessionId,
      childEnvNames: Object.keys(env).sort(),
      transcriptPath: this.opts.adapter.transcriptFor?.(sessionId, env) ?? null,
      outcome,
      effort,
    };
  }
}

/**
 * The prompt. It POINTS at the role files and the plan rather than restating
 * them (HOH-JEV §6.4), and it carries no rule the runtime relies on: every
 * boundary named here is also a check the runtime makes after the process
 * exits. It is information, not enforcement.
 */
export function rolePrompt(ctx: RoleContext, deliverablePath: string, contextPath: string): string {
  const roleFiles = [".agents/roles/shared.md", `.agents/roles/${ctx.role}.md`].filter((p) =>
    existsSync(join(ctx.repoRoot, p)),
  );
  return [
    `You are the ${ctx.role} seat in HoH loop ${ctx.loop}, attempt ${ctx.attempt}, running inside a runtime that checks your work after you exit.`,
    roleFiles.length > 0 ? `Read these first: ${roleFiles.join(", ")}.` : "",
    `The plan is in artifacts/iterations/${ctx.loop}/D_t.md (machine copy D_t.json). Full context: ${contextPath}.`,
    `You may change only these repository paths: ${ctx.allowlist.describe()}. Do not commit, do not create or move any git ref, and do not change git config or hooks — the runtime refuses the stage if you do.`,
    `When you are done, write a JSON report to ${deliverablePath} matching the schema in the context file (loop, summary, changes[{path, what}], commands[{argv, exit_code}], claims[]). The runtime compares it with the diff it measures.`,
    ctx.previousProblems.length > 0 ? `Your previous report was rejected: ${ctx.previousProblems.join("; ")}` : "",
  ]
    .filter((l) => l !== "")
    .join("\n\n");
}
