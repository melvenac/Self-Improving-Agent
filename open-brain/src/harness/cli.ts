#!/usr/bin/env node
/**
 * `harness` — the command line for the HoH loop runtime.
 *
 * ## Two refusals this CLI makes on purpose
 *
 * 1. **There is no default subcommand.** `harness` with no arguments prints
 *    usage and exits non-zero. It does not run a loop.
 * 2. **An unrecognised flag refuses.** `T-150` in this project's backlog is
 *    exactly this defect found elsewhere: an unknown flag that fell through to
 *    the mutating default. A typo must stop the program, not pick an action for
 *    the user.
 *
 * Both are the same rule — *default unlisted things to the strict side so a
 * boundary cannot widen by omission* — applied to argument parsing.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runLoop, type GateMode } from "./runtime.js";
import { stubRoles } from "./roles.js";
import {
  BriefPlanGateError,
  checkBriefDispatchReady,
  runBriefDispatch,
  runBriefPlanGate,
  type BriefPlanGateMode,
} from "./brief-plan-gate.js";
import { jsonSchemas, serialiseSchema, validateEvidence, validatePlan, type DeliverableKind } from "./schema.js";
import { defaultChecks, type CheckSpec } from "./checks.js";
import { policyJsonSchemas } from "./policies.js";
import { decideShadowVerdict, isLowerHexSha, ledgerPath, prepareShadowVerdict, summariseLedger } from "./shadow-merge.js";

const USAGE = `harness — HoH loop runtime (slice one: roles are stubbed)

  harness run --loop <tNNN> [options]
  harness schemas [--write]
  harness validate evidence <file>
  harness shadow-verdict prepare --loop <id> --candidate <sha> --criteria-sha <sha> --criteria <path> --evidence <file>
  harness shadow-verdict decide --loop <id> --candidate <sha> (--merged <sha> | --declined | --replaced <sha>)
  harness shadow-verdict summary
  harness validate plan <file>
  harness plan-gate <D_t.json> [--brief <brief.md>] [--mode live|dry-run]
  harness dispatch-check <brief.md> [--repo <dir>]
  harness dispatch <brief.md> --say <message> [--repo <dir>]
  harness help

run options
  --loop <tNNN>        required; the iteration id, e.g. t001
  --repo <dir>         repository to run in (default: cwd)
  --allow <rule>       repeatable; a repo-relative path the DEVELOPER stage may
                       write. A rule ending in / is a directory prefix.
                       Default: artifacts/iterations/<loop>/
  --max-attempts <n>   schema retries per role, including the first (default 3)
  --gate <mode>        skip | dry-run | live (default: skip)
                       dry-run builds every gate payload, prints it, and sends
                       nothing. live sends to Jev and needs TYPESAFE_API_KEY in
                       the environment; thresholds come from harness/policies/.
  --dry-run            alias for --gate dry-run
  --build-cmd <cmd>    override the build check (split on spaces, no shell)
  --unit-cmd <cmd>     override the unit check (split on spaces, no shell)
  --json               print the loop result as JSON on stdout

The runtime never merges, pushes, or touches a remote. It stops at a candidate
commit and local tags (D-019: autonomous inside a branch, Aaron at master).
`;

interface ParsedRun {
  loop: string;
  repo: string;
  allow: string[];
  maxAttempts: number;
  gateMode: GateMode;
  buildCmd: string | null;
  unitCmd: string | null;
  json: boolean;
}

class UsageError extends Error {}

const RUN_FLAGS_WITH_VALUE = new Set([
  "--loop",
  "--repo",
  "--allow",
  "--max-attempts",
  "--build-cmd",
  "--unit-cmd",
  "--gate",
]);
const GATE_MODES: readonly GateMode[] = ["skip", "dry-run", "live"];
const RUN_FLAGS_BOOLEAN = new Set(["--dry-run", "--json"]);

function parseRun(argv: readonly string[]): ParsedRun {
  const out: ParsedRun = {
    loop: "",
    repo: process.cwd(),
    allow: [],
    maxAttempts: 3,
    gateMode: "skip",
    buildCmd: null,
    unitCmd: null,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (RUN_FLAGS_BOOLEAN.has(arg)) {
      if (arg === "--dry-run") out.gateMode = "dry-run";
      if (arg === "--json") out.json = true;
      continue;
    }
    if (RUN_FLAGS_WITH_VALUE.has(arg)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new UsageError(`${arg} needs a value`);
      }
      i += 1;
      if (arg === "--loop") out.loop = value;
      else if (arg === "--repo") out.repo = resolve(value);
      else if (arg === "--allow") out.allow.push(value);
      else if (arg === "--build-cmd") out.buildCmd = value;
      else if (arg === "--unit-cmd") out.unitCmd = value;
      else if (arg === "--gate") {
        // An unrecognised mode refuses rather than picking one. T-150 again.
        if (!GATE_MODES.includes(value as GateMode)) {
          throw new UsageError(`--gate must be one of ${GATE_MODES.join(", ")}, got "${value}"`);
        }
        out.gateMode = value as GateMode;
      }
      else if (arg === "--max-attempts") {
        const n = Number.parseInt(value, 10);
        if (!Number.isInteger(n) || n < 1) throw new UsageError(`--max-attempts must be a positive integer, got "${value}"`);
        out.maxAttempts = n;
      }
      continue;
    }
    // Rule T-150: refuse, never fall through to the default action.
    throw new UsageError(`unrecognised argument "${arg}"`);
  }

  if (out.loop === "") throw new UsageError("--loop is required, e.g. --loop t001");
  if (!/^t\d{3,}$/.test(out.loop)) throw new UsageError(`--loop must look like t001, got "${out.loop}"`);
  return out;
}

/** Split an override command on whitespace. No shell, so no quoting rules to get wrong. */
function toSpec(cmd: string): CheckSpec {
  const parts = cmd.trim().split(/\s+/).filter((p) => p !== "");
  if (parts.length === 0) throw new UsageError("command override is empty");
  return { command: parts[0]!, args: parts.slice(1) };
}

/** Where the derived schema files live, resolved from this module rather than from cwd. */
export function schemaDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "schemas");
}

export const schemaFileName = (kind: DeliverableKind): string =>
  kind === "plan" ? "plan.schema.json" : "evidence.schema.json";

/**
 * The derived JSON Schema for each POLICY file.
 *
 * These live beside the deliverable schemas rather than in `policies/`, which
 * stays purely data: the build copies `policies/` into `build/` because the
 * runtime opens it there, and a derived file in that directory would be copied
 * too — becoming exactly the stale authoritative-looking artifact this file
 * already refuses to create.
 */
export const policySchemaFileName = (kind: "plan" | "done" | "merge"): string =>
  kind === "plan"
    ? "policy-plan.schema.json"
    : kind === "done"
      ? "policy-developer-done.schema.json"
      : "policy-merge.schema.json";

/**
 * Validate an `E_t` file with the runtime's own validator.
 *
 * Prints every problem `validateEvidence` returns. This is not a JSON Schema
 * check: the derived file cannot see the refinements (order on met, duplicate
 * ids), and a seat that used one would accept a document the runtime refuses.
 */
function cmdValidate(argv: readonly string[]): number {
  if (argv.length !== 2) {
    throw new UsageError("usage: harness validate (evidence|plan) <file>");
  }
  const kind = argv[0]!;
  const file = resolve(argv[1]!);
  if (kind !== "evidence" && kind !== "plan") {
    throw new UsageError("usage: harness validate (evidence|plan) <file>");
  }
  let text: string;
  try {
    text = readFileSync(file, "utf-8");
  } catch (err) {
    throw new UsageError(`cannot read ${file}: ${(err as Error).message}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    process.stdout.write(`(root): not JSON: ${(err as Error).message}\n`);
    return 1;
  }
  const result = kind === "plan" ? validatePlan(json) : validateEvidence(json);
  if (result.ok) return 0;
  for (const problem of result.problems) process.stdout.write(`${problem}\n`);
  return 1;
}

/**
 * Master's commands (plan-gate takes a positional file) skip positionals; the
 * shadow-verdict rows pass strict=true and reject any stray positional.
 */
function flagMap(argv: readonly string[], strict = false): Map<string, string | true> {
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) {
      if (strict) throw new UsageError(`unrecognised argument "${arg}"`);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) flags.set(key, true);
    else {
      flags.set(key, next);
      i += 1;
    }
  }
  return flags;
}

function requiredFlag(flags: Map<string, string | true>, name: string): string {
  const value = flags.get(name);
  if (typeof value !== "string" || value === "") throw new UsageError(`--${name} requires a value`);
  return value;
}

/**
 * T-155. prepare writes the verdict. decide records Aaron's action. Neither
 * merges, pushes, or touches a remote.
 */
function requireCliSha(flag: string, value: unknown): string {
  if (!isLowerHexSha(value)) {
    const shown = typeof value === "string" && value !== "" ? value : "(none)";
    throw new UsageError(`--${flag} refuses ${shown}: a sha must be 40 lowercase hex characters`);
  }
  return value;
}

function cmdShadow(argv: readonly string[]): number {
  const [action, ...rest] = argv;
  if (action !== "prepare" && action !== "decide" && action !== "summary") {
    throw new UsageError("usage: harness shadow-verdict <prepare|decide|summary>");
  }
  const flags = flagMap(rest, true);
  const allowed: Record<typeof action, ReadonlySet<string>> = {
    summary: new Set(["repo"]),
    prepare: new Set(["repo", "loop", "candidate", "criteria-sha", "criteria", "evidence", "gate"]),
    decide: new Set(["repo", "loop", "candidate", "merged", "declined", "replaced"]),
  };
  for (const key of flags.keys()) {
    if (!allowed[action].has(key)) throw new UsageError(`unrecognised flag "--${key}"`);
  }
  const repo = typeof flags.get("repo") === "string" ? (flags.get("repo") as string) : process.cwd();
  if (action === "summary") {
    // Summary reads the ledger and writes nothing. It takes no sha.
    const path = ledgerPath(repo);
    const text = existsSync(path) ? readFileSync(path, "utf8") : "";
    process.stdout.write(`${JSON.stringify(summariseLedger(text), null, 2)}\n`);
    return 0;
  }
  const loop = requiredFlag(flags, "loop");
  const candidate = requireCliSha("candidate", requiredFlag(flags, "candidate"));
  if (action === "prepare") {
    const gate = flags.get("gate");
    if (gate !== undefined && gate !== "live" && gate !== "dry-run" && gate !== "skip") {
      throw new UsageError(`--gate must be skip, dry-run, or live, not "${String(gate)}"`);
    }
    const gateMode = gate === "live" || gate === "dry-run" ? gate : "skip";
    const evidencePath = resolve(requiredFlag(flags, "evidence"));
    let evidence: unknown;
    try {
      evidence = JSON.parse(readFileSync(evidencePath, "utf8")) as unknown;
    } catch (err) {
      evidence = { error: `unreadable evidence: ${(err as Error).message}` };
    }
    const result = prepareShadowVerdict({
      repo,
      loop,
      candidateSha: candidate,
      criteriaSha: requireCliSha("criteria-sha", requiredFlag(flags, "criteria-sha")),
      criteriaPath: requiredFlag(flags, "criteria"),
      evidence,
      gateMode,
    });
    process.stdout.write(`${result.path}\n`);
    return 0;
  }
  const merged = flags.get("merged");
  const replaced = flags.get("replaced");
  const declined = flags.get("declined");
  if (replaced === true) throw new UsageError("--replaced requires a 40-character sha");
  if (typeof replaced === "string") requireCliSha("replaced", replaced);
  if (typeof merged === "string") requireCliSha("merged", merged);
  const chosen = [merged, replaced, declined].filter((v) => v !== undefined).length;
  if (chosen !== 1) throw new UsageError("decide takes exactly one of --merged, --declined, --replaced");
  const result = decideShadowVerdict({
    repo,
    loop,
    candidateSha: candidate,
    action: typeof merged === "string" ? "merged" : typeof replaced === "string" ? "replaced" : "declined",
    mergeCommitSha: typeof merged === "string" ? merged : undefined,
    replacedSha: typeof replaced === "string" ? replaced : undefined,
  });
  process.stdout.write(`${JSON.stringify(result.line)}\n`);
  return 0;
}

const PLAN_GATE_MODES: readonly BriefPlanGateMode[] = ["live", "dry-run"];

function positionalArgs(argv: readonly string[], flags: Map<string, string | true>): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) {
      out.push(arg);
      continue;
    }
    const val = flags.get(arg.slice(2));
    if (typeof val === "string") i += 1;
  }
  return out;
}

async function cmdPlanGate(argv: readonly string[]): Promise<number> {
  const flags = flagMap(argv);
  for (const key of flags.keys()) {
    if (key !== "brief" && key !== "mode" && key !== "repo") {
      throw new UsageError(`unrecognised flag "--${key}"`);
    }
  }
  const positional = positionalArgs(argv, flags);
  if (positional.length !== 1) throw new UsageError("usage: harness plan-gate <D_t.json> [--brief <brief.md>] [--mode live|dry-run]");
  const modeRaw = flags.get("mode");
  const mode: BriefPlanGateMode =
    modeRaw === undefined ? "live" : modeRaw === true ? "live" : (modeRaw as BriefPlanGateMode);
  if (!PLAN_GATE_MODES.includes(mode)) {
    throw new UsageError(`--mode must be one of ${PLAN_GATE_MODES.join(", ")}, got "${String(modeRaw)}"`);
  }
  const brief = flags.get("brief");
  if (brief === true) throw new UsageError("--brief requires a path");
  const repo = typeof flags.get("repo") === "string" ? resolve(flags.get("repo") as string) : process.cwd();
  try {
    const result = await runBriefPlanGate({
      dtPath: resolve(positional[0]!),
      briefPath: typeof brief === "string" ? resolve(brief) : null,
      repoRoot: repo,
      mode,
    });
    process.stdout.write(`${result.recordPath}\n`);
    for (const [field, source] of Object.entries(result.record.sources)) {
      process.stdout.write(`source ${field}: ${source}\n`);
    }
    return result.exitCode;
  } catch (err) {
    if (err instanceof BriefPlanGateError) {
      process.stderr.write(`${err.message}\n`);
      return err.exitCode;
    }
    throw err;
  }
}

function cmdDispatchCheck(argv: readonly string[]): number {
  const flags = flagMap(argv);
  for (const key of flags.keys()) {
    if (key !== "repo") throw new UsageError(`unrecognised flag "--${key}"`);
  }
  const positional = positionalArgs(argv, flags);
  if (positional.length !== 1) throw new UsageError("usage: harness dispatch-check <brief.md> [--repo <dir>]");
  const repo = typeof flags.get("repo") === "string" ? resolve(flags.get("repo") as string) : process.cwd();
  const check = checkBriefDispatchReady(resolve(positional[0]!), repo);
  if (check.ok) {
    process.stdout.write("dispatch-check: ok\n");
    return 0;
  }
  if (check.checked_sha) process.stderr.write(`dispatch-check: checked ${check.checked_sha} (origin/master)\n`);
  for (const reason of check.reasons) process.stderr.write(`dispatch-check: ${reason}\n`);
  return 1;
}

async function cmdDispatch(argv: readonly string[]): Promise<number> {
  const flags = flagMap(argv);
  for (const key of flags.keys()) {
    if (key !== "repo" && key !== "say") throw new UsageError(`unrecognised flag "--${key}"`);
  }
  const say = flags.get("say");
  if (say === undefined || say === true) {
    throw new UsageError("usage: harness dispatch <brief.md> --say <message> [--repo <dir>]");
  }
  const positional = positionalArgs(argv, flags);
  if (positional.length !== 1) throw new UsageError("usage: harness dispatch <brief.md> --say <message> [--repo <dir>]");
  const repo = typeof flags.get("repo") === "string" ? resolve(flags.get("repo") as string) : process.cwd();
  const result = await runBriefDispatch({
    briefPath: resolve(positional[0]!),
    message: say,
    repoRoot: repo,
  });
  if (result.ok) {
    process.stdout.write("dispatch: sent\n");
    return 0;
  }
  if (result.checked_sha) process.stderr.write(`dispatch: checked ${result.checked_sha} (origin/master)\n`);
  for (const reason of result.reasons) process.stderr.write(`dispatch: ${reason}\n`);
  return 1;
}

function cmdSchemas(argv: readonly string[]): number {
  let write = false;
  for (const arg of argv) {
    if (arg === "--write") write = true;
    else throw new UsageError(`unrecognised argument "${arg}"`);
  }
  const dir = schemaDir();
  if (write && /[\\/]build[\\/]/.test(`${dir}/`)) {
    // The derived files belong beside their source. Writing them into build/
    // would produce a copy that looks authoritative, is never read, and
    // disappears on the next `prebuild` rm — a stale artifact by construction.
    throw new UsageError(
      `refusing to write schemas into a build directory (${dir}). ` +
        `Regenerate from source: npx tsx src/harness/cli.ts schemas --write`,
    );
  }
  const schemas = jsonSchemas();
  const policySchemas = policyJsonSchemas();
  for (const kind of ["plan", "done", "merge"] as const) {
    const text = serialiseSchema(policySchemas[kind]);
    if (write) {
      const target = join(schemaDir(), policySchemaFileName(kind));
      writeFileSync(target, text, "utf-8");
      process.stdout.write(`wrote ${target}\n`);
    } else {
      process.stdout.write(text);
    }
  }
  for (const kind of ["plan", "evidence"] as const) {
    const text = serialiseSchema(schemas[kind]);
    if (write) {
      const target = join(schemaDir(), schemaFileName(kind));
      writeFileSync(target, text, "utf-8");
      process.stdout.write(`wrote ${target}\n`);
    } else {
      process.stdout.write(text);
    }
  }
  return 0;
}

async function cmdRun(argv: readonly string[]): Promise<number> {
  const opts = parseRun(argv);
  const lines: string[] = [];
  const log = (line: string): void => {
    lines.push(line);
    if (!opts.json) process.stdout.write(`${line}\n`);
  };

  const base = defaultChecks();
  const result = await runLoop({
    repoRoot: opts.repo,
    loop: opts.loop,
    roles: stubRoles(),
    developerAllowlist: opts.allow.length > 0 ? opts.allow : undefined,
    maxAttempts: opts.maxAttempts,
    gateMode: opts.gateMode,
    checks: {
      build: opts.buildCmd ? toSpec(opts.buildCmd) : base.build,
      unit: opts.unitCmd ? toSpec(opts.unitCmd) : base.unit,
    },
    log,
  });

  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ ...result, log: lines }, null, 2)}\n`);
  }
  return result.exitCode;
}

export async function main(argv: readonly string[]): Promise<number> {
  const [sub, ...rest] = argv;
  try {
    if (sub === undefined || sub === "help" || sub === "--help" || sub === "-h") {
      process.stdout.write(USAGE);
      // No subcommand is not success: a bare `harness` did nothing that was asked for.
      return sub === undefined ? 2 : 0;
    }
    if (sub === "run") return await cmdRun(rest);
    if (sub === "schemas") return cmdSchemas(rest);
    if (sub === "validate") return cmdValidate(rest);
    if (sub === "shadow-verdict") return cmdShadow(rest);
    if (sub === "plan-gate") return await cmdPlanGate(rest);
    if (sub === "dispatch-check") return cmdDispatchCheck(rest);
    if (sub === "dispatch") return await cmdDispatch(rest);
    throw new UsageError(`unknown subcommand "${sub}"`);
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`harness: ${err.message}\n\n${USAGE}`);
      return 2;
    }
    process.stderr.write(`harness: ${(err as Error).message}\n`);
    return 1;
  }
}

// `process.argv[1]` is this file when run directly, and something else when
// imported by a test. Comparing resolved paths keeps the test import side-effect free.
const invokedDirectly = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return resolve(entry) === resolve(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  // `main` catches its own errors and returns an exit code, so the only way to
  // reach the `catch` here is a defect in that catch. It is written anyway:
  // an unhandled rejection in Node prints a warning and can exit 0, which is
  // the "reads the number instead of the output" failure with the numbers
  // swapped.
  main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    (err: unknown) => {
      process.stderr.write(`harness: ${(err as Error).message}
`);
      process.exitCode = 1;
    },
  );
}
