/**
 * Git, run the only way this repo's record says it can be trusted.
 *
 * **`execFileSync` with an args array and no shell.** Every git failure in this
 * project's error record went through a shell: `cmd.exe` ate the `^` in
 * `<sha>^{commit}` and handed git `{commit}`; a heredoc ate backslashes. With
 * `shell: false` the arguments reach git verbatim, and `^`, `{`, `}` and spaces
 * stop being characters anybody has to think about.
 *
 * ## The outward-facing deny list
 *
 * `run` **refuses a subcommand that leaves this machine or moves a shared
 * ref**. Not because the runtime is expected to try, but because *each
 * outward-facing act needs authority for that act*, and a runtime cannot be
 * handed authority in advance for a push it has not described. `D-019` draws
 * the line at the same place: autonomous inside a branch, Aaron at master.
 *
 * The deny list is checked on the **subcommand actually passed to git**, not on
 * a string somebody assembled, so it cannot be slipped past by quoting.
 *
 * ## Every runtime git call goes through ONE function, and it carries three layers
 *
 * A role process can plant a hook, or a program-valued config key, and get
 * **code execution inside the runtime's own git calls**, with the runtime's
 * environment — which in live mode holds `TYPESAFE_API_KEY`. `--no-verify`
 * does not stop it: it skips `pre-commit` and `commit-msg` only. Measured
 * 2026-09-22 on git 2.54.0.windows.1 (design §2.3, reproduced by QA): a
 * planted `post-commit` ran under `commitPaths`' exact flags, a
 * `reference-transaction` hook ran ten times, and `core.fsmonitor` ran on
 * `status`, `add` and `commit`. A `filter.<x>.clean` in the GLOBAL config ran
 * with the repo-level overrides on (QA, rulings-2).
 *
 * - **Layer 0 (R7): the machine's git config is not read.** `GIT_CONFIG_GLOBAL`
 *   and `core.hooksPath` point at the NULL DEVICE, `GIT_CONFIG_NOSYSTEM=1`, and
 *   identity is passed with `-c`. The null device and not a runtime-owned empty
 *   file in a temp directory: a role can write to a file outside the
 *   repository, and a "known empty" file it can fill is a layer it can remove.
 *   Nothing can be written into `/dev/null` — measured on Git for Windows from
 *   both MSYS and Node, where git maps it to `NUL`.
 * - **Layer 1: repo-local program-valued keys are overridden on the command
 *   line.** `-c core.hooksPath=/dev/null -c core.fsmonitor=false`, which outrank
 *   every config file. Defence in depth against an ORDERING defect in layer 2
 *   (`configwatch.ts`), which restores `.git/config` and the hooks before any
 *   git read — a runtime git read moved ahead of that restore is exactly what
 *   this layer still stops (CA-4b-L1).
 * - Inherited environment variables that REDIRECT git (`GIT_DIR`,
 *   `GIT_CONFIG_PARAMETERS`, …) are removed, so a variable set in the shell
 *   that launched the runtime cannot point these calls somewhere else.
 *
 * **Limit, stated where the layers live:** these protect the RUNTIME's git
 * calls. A role's own git calls are the role's; what they leave behind is what
 * the ref, config and allowlist windows judge.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The identity the runtime commits and tags as. Passed with `-c` on every call,
 * because layer 0 removes the global config a repository would otherwise
 * inherit its identity from — and a layer that silences config and then cannot
 * commit is not a pass (CA-4c).
 */
export const RUNTIME_IDENTITY = {
  name: "HoH harness runtime",
  email: "harness-runtime@sia.invalid",
} as const;

/**
 * The null device, as git spells it on every platform it runs on here. Git for
 * Windows maps `/dev/null` to `NUL` itself; passing `NUL` would be read as a
 * relative path named `NUL` by git's own path handling.
 */
export const NULL_DEVICE = "/dev/null";

/** Layer 1 and identity: `-c` arguments placed before every subcommand. */
export const RUNTIME_GIT_OPTIONS: readonly string[] = [
  "-c",
  `core.hooksPath=${NULL_DEVICE}`,
  "-c",
  "core.fsmonitor=false",
  "-c",
  `user.name=${RUNTIME_IDENTITY.name}`,
  "-c",
  `user.email=${RUNTIME_IDENTITY.email}`,
];

/**
 * Inherited variables that redirect where git reads config or which repository
 * it operates on. Removed from the runtime's git environment, whoever set them.
 */
const REDIRECTING_GIT_VARS = /^GIT_(CONFIG(_.*)?|DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|NAMESPACE)$/;

/** The three variables that DEFINE the machine config — kept, and only, when reading it (R19). */
const MACHINE_CONFIG_VARS = new Set(["GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM", "GIT_CONFIG_NOSYSTEM"]);

/**
 * Layer 1 as ENVIRONMENT (R17). `-c` reaches only the git process it is
 * passed to; `GIT_CONFIG_COUNT` reaches every git a child process starts —
 * `write-build-info.mjs` runs git inside the build check, where a `-c` never
 * arrives. Both are applied: the argument for the runtime's own call, the
 * environment for anything downstream of it.
 */
export const LAYER1_ENV: Readonly<Record<string, string>> = {
  GIT_CONFIG_COUNT: "2",
  GIT_CONFIG_KEY_0: "core.hooksPath",
  GIT_CONFIG_VALUE_0: NULL_DEVICE,
  GIT_CONFIG_KEY_1: "core.fsmonitor",
  GIT_CONFIG_VALUE_1: "false",
};

/* ------------------------------------------------------------------------- *
 * The per-repository pin (R18, R19)
 *
 * A loop resolves, at preflight and once, which git dir and work tree it is
 * operating on, and which generated global config it runs under. Every runtime
 * git call in that repository then carries them in its environment. A role
 * that rewrites a linked worktree's `.git` pointer file cannot send the next
 * call into another repository (measured by QA), and a role that edits the
 * generated config file is caught before the call that would read it.
 * ------------------------------------------------------------------------- */

export interface RepoPin {
  gitDir: string;
  workTree: string;
  /**
   * The generated global config (R19). Its exact bytes are checked before every
   * call. Null during the part of preflight that runs BEFORE the safe keys have
   * been read: the pin is in place from the moment the dirs are resolved, with
   * the null device as the global config, so every preflight query already runs
   * pinned (the planner's ordering condition on R19).
   */
  globalConfigPath: string | null;
  globalConfigBytes: Buffer | null;
}

const pins = new Map<string, RepoPin>();
const pinKey = (p: string): string => {
  const r = resolve(p);
  return process.platform === "win32" ? r.toLowerCase() : r;
};

/** Pin a repository for the duration of a loop. The runtime calls this at preflight. */
export function pinRepo(repoRoot: string, pin: RepoPin): void {
  pins.set(pinKey(repoRoot), pin);
}

/** Release a pin. The runtime calls this when the loop ends, however it ends. */
export function unpinRepo(repoRoot: string): void {
  pins.delete(pinKey(repoRoot));
}

/** The pin in force for `cwd`, if any. Exported for tests and for the iteration record. */
export function pinFor(cwd: string): RepoPin | null {
  return pins.get(pinKey(cwd)) ?? null;
}

/**
 * Layer 0: the environment every runtime git call runs with.
 *
 * Built from the current process environment on each call rather than cached,
 * so a test that changes `process.env` sees the change — and so nothing here
 * depends on remembering to rebuild it.
 *
 * `machineRead` is the ONE exception, used only at preflight (R19): reading
 * the machine's non-program keys needs the machine's config visible. It still
 * carries layer 1, and it never runs after a role has.
 */
export function runtimeGitEnv(
  base: NodeJS.ProcessEnv = process.env,
  pin: RepoPin | null = null,
  machineRead = false,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(base)) {
    const K = k.toUpperCase();
    if (machineRead && MACHINE_CONFIG_VARS.has(K)) {
      env[k] = v;
      continue;
    }
    if (REDIRECTING_GIT_VARS.test(K)) continue;
    env[k] = v;
  }
  if (!machineRead) {
    env.GIT_CONFIG_GLOBAL = pin?.globalConfigPath ?? NULL_DEVICE;
    env.GIT_CONFIG_NOSYSTEM = "1";
  }
  Object.assign(env, LAYER1_ENV);
  if (pin !== null) {
    env.GIT_DIR = pin.gitDir;
    env.GIT_WORK_TREE = pin.workTree;
  }
  return env;
}

/**
 * THE one place the runtime spawns git. Every other function in this module,
 * and every other module, goes through here — asserted by a scan in the tests
 * that is itself shown to find a planted bare spawn (CA-4b, R16).
 */
function spawnGit(cwd: string, args: readonly string[], machineRead = false) {
  assertAllowed(args);
  const pin = machineRead ? null : pinFor(cwd);
  if (pin !== null && pin.globalConfigPath !== null && pin.globalConfigBytes !== null) {
    // R19's file lives outside the repository, so a role can write it. The
    // runtime holds its exact bytes and refuses to run git over a changed one.
    let now: Buffer | null = null;
    try {
      now = readFileSync(pin.globalConfigPath);
    } catch {
      now = null;
    }
    if (now === null || !now.equals(pin.globalConfigBytes)) {
      throw new GitRefused(
        `the runtime's generated global git config at ${pin.globalConfigPath} is ${now === null ? "missing" : "not the bytes the runtime wrote"} — ` +
          `something outside the runtime changed it, and running git over it would read config nobody vetted. ` +
          `Refused before the call: git ${args.join(" ")}`,
      );
    }
  }
  return spawnSync("git", [...RUNTIME_GIT_OPTIONS, ...args], {
    cwd,
    encoding: "utf-8",
    shell: false,
    env: runtimeGitEnv(process.env, pin, machineRead),
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

/* ------------------------------------------------------------------------- *
 * R19 — the machine's NON-program keys, carried; everything else, not
 * ------------------------------------------------------------------------- */

/**
 * Keys that change how git reads and writes files but never name a program.
 * Dropping them changes behaviour: with `core.autocrlf=true` on the machine
 * and layer 0 reading nothing, an untouched file reads as modified and a CRLF
 * save commits as CRLF (QA, measured). An ALLOWLIST: a key not named here is
 * not carried, whatever it is.
 */
export const SAFE_MACHINE_KEYS: readonly string[] = [
  "core.autocrlf",
  "core.eol",
  "core.safecrlf",
  "core.symlinks",
  "core.ignorecase",
  "core.longpaths",
  "core.filemode",
  "core.precomposeunicode",
  "core.protectntfs",
  "core.checkstat",
  "core.trustctime",
];

export interface MachineSafeConfig {
  /** key → value, the machine's effective value (global over system). */
  values: Record<string, string>;
  /** `filter.<x>.required` set true in machine OR repository config: refused, by name. */
  requiredFilters: string[];
}

function readScope(cwd: string, scope: "--system" | "--global" | "--local", pattern: string): Array<[string, string]> {
  const r = spawnGit(cwd, ["config", scope, "--get-regexp", pattern], scope !== "--local");
  if (r.status === 1) return [];
  if (r.error || r.status !== 0) {
    throw new GitFailed(`git config ${scope} --get-regexp ${pattern} failed in ${cwd}: ${(r.stderr ?? "").trim() || `exit ${r.status}`}`, r.status ?? null, (r.stderr ?? "").trim());
  }
  const out: Array<[string, string]> = [];
  for (const line of (r.stdout ?? "").split("\n")) {
    const t = line.trim();
    if (t === "") continue;
    const i = t.indexOf(" ");
    out.push(i < 0 ? [t.toLowerCase(), ""] : [t.slice(0, i).toLowerCase(), t.slice(i + 1)]);
  }
  return out;
}

/**
 * Read the machine's effective values for {@link SAFE_MACHINE_KEYS}, and every
 * required filter. Preflight only: this is the one call made with the
 * machine's config visible, and it reads — `git config --get-regexp` runs no
 * hook, filter or monitor.
 */
export function readMachineSafeConfig(repoRoot: string): MachineSafeConfig {
  const keyPattern = `^(${SAFE_MACHINE_KEYS.map((k) => k.replace(/\./g, "\\.")).join("|")})$`;
  const values: Record<string, string> = {};
  for (const scope of ["--system", "--global"] as const) {
    for (const [k, v] of readScope(repoRoot, scope, keyPattern)) values[k] = v;
  }
  const requiredFilters: string[] = [];
  for (const scope of ["--system", "--global", "--local"] as const) {
    for (const [k, v] of readScope(repoRoot, scope, "^filter\\..*\\.required$")) {
      if (/^(true|yes|on|1)$/i.test(v.trim())) requiredFilters.push(`${k} (${scope.slice(2)})`);
    }
  }
  return { values, requiredFilters };
}

/**
 * Which `filter` attribute values the target's TRACKED paths carry.
 *
 * R19 refuses "a target that NEEDS" a required filter. Having one CONFIGURED
 * is not needing it: Git for Windows ships `filter.lfs.required=true` in its
 * system config, so refusing on configuration alone would refuse every loop on
 * every Git for Windows machine (measured: 144 of this suite's loops). A target
 * needs a filter when a tracked path's attributes name it — asked of git's own
 * attribute parser, `check-attr`, which runs no filter. Chunked so a large tree
 * cannot exceed a command-line limit.
 */
export function filtersUsedByTrackedPaths(repoRoot: string): Set<string> {
  const listed = gitRaw(repoRoot, ["ls-files", "-z"]).split("\0").filter((p) => p !== "");
  const used = new Set<string>();
  const CHUNK = 200;
  for (let i = 0; i < listed.length; i += CHUNK) {
    const out = gitRaw(repoRoot, ["check-attr", "-z", "filter", "--", ...listed.slice(i, i + CHUNK)]);
    // -z output: path NUL attribute NUL value NUL, repeated.
    const f = out.split("\0");
    for (let j = 0; j + 2 < f.length; j += 3) {
      const value = f[j + 2]!;
      if (value !== "unspecified" && value !== "unset" && value !== "set" && value !== "") used.add(value);
    }
  }
  return used;
}

/** The generated global config's text: one section per key, values quoted, nothing else. */
export function renderSafeConfig(values: Readonly<Record<string, string>>): string {
  const lines = ["# Generated by the HoH runtime at preflight (rulings R19): non-program keys only.", ""];
  const bySection = new Map<string, Array<[string, string]>>();
  for (const [key, value] of Object.entries(values).sort()) {
    const dot = key.indexOf(".");
    const section = key.slice(0, dot);
    const name = key.slice(dot + 1);
    if (!bySection.has(section)) bySection.set(section, []);
    bySection.get(section)!.push([name, value]);
  }
  for (const [section, entries] of bySection) {
    lines.push(`[${section}]`);
    for (const [name, value] of entries) lines.push(`\t${name} = "${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  }
  return `${lines.join("\n")}\n`;
}

/** Subcommands the harness must never run. Refused at the call, not reviewed later. */
export const DENIED_SUBCOMMANDS: readonly string[] = [
  "push",
  "fetch",
  "pull",
  "clone",
  "remote",
  "submodule",
  "request-pull",
  "send-email",
  "svn",
  "daemon",
  "p4",
];

export class GitRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitRefused";
  }
}

export class GitFailed extends Error {
  readonly exitCode: number | null;
  readonly stderr: string;
  constructor(message: string, exitCode: number | null, stderr: string) {
    super(message);
    this.name = "GitFailed";
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

function assertAllowed(args: readonly string[]): void {
  // Two informational flags that take no subcommand and touch no repository.
  if (args.length === 1 && (args[0] === "--exec-path" || args[0] === "--version")) return;
  // The subcommand is the first argument that is not a leading global option.
  let i = 0;
  while (i < args.length && args[i]!.startsWith("-")) {
    // `-c key=value` and `-C <dir>` take a value; skip it too.
    if (args[i] === "-c" || args[i] === "-C") i += 1;
    i += 1;
  }
  const sub = args[i];
  if (sub === undefined) {
    throw new GitRefused("no git subcommand given — refusing rather than guessing");
  }
  if (DENIED_SUBCOMMANDS.includes(sub)) {
    throw new GitRefused(
      `git ${sub} is refused by the harness: it reaches the network or moves a shared ref, ` +
        `and each outward-facing act needs authority for that act. The runtime stops at a ` +
        `candidate commit (D-019).`,
    );
  }
}

/**
 * Run git in `cwd` and return trimmed stdout. Throws {@link GitFailed} on a
 * non-zero exit, with git's own stderr attached — a failure never returns a
 * value that could be mistaken for an answer.
 */
export function git(cwd: string, args: readonly string[]): string {
  return gitRaw(cwd, args).trim();
}

/**
 * {@link git} without the trim — for `-z` output, where a leading or trailing
 * NUL is part of the record structure.
 */
function gitRaw(cwd: string, args: readonly string[]): string {
  const r = spawnGit(cwd, args);
  const stderr = (r.stderr ?? "").trim();
  if (r.error || r.status !== 0) {
    throw new GitFailed(
      `git ${args.join(" ")} failed in ${cwd}: ${stderr || r.error?.message || `exit ${r.status ?? "none"}, no stderr`}`,
      r.status ?? null,
      stderr,
    );
  }
  return r.stdout ?? "";
}

/**
 * Run git and report the outcome instead of throwing.
 *
 * Used where a non-zero exit is an ANSWER rather than a fault — `rev-parse
 * --verify` on a ref that may not exist. Note `ok` comes from the status, never
 * from whether stdout looked plausible.
 */
export function gitTry(
  cwd: string,
  args: readonly string[],
): { ok: boolean; stdout: string; stderr: string; status: number | null } {
  const r = spawnGit(cwd, args);
  if (r.error) {
    return { ok: false, stdout: "", stderr: String(r.error.message), status: null };
  }
  return {
    ok: r.status === 0,
    stdout: (r.stdout ?? "").trim(),
    stderr: (r.stderr ?? "").trim(),
    status: r.status,
  };
}

/** The full 40-character sha at HEAD. */
export const headSha = (cwd: string): string => git(cwd, ["rev-parse", "HEAD"]);

/** The current branch name, or `HEAD` when detached. */
export const currentBranch = (cwd: string): string =>
  git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);

/**
 * Every path git considers changed, tracked or not, as repo-relative POSIX
 * paths.
 *
 * `--porcelain=v1 -z --untracked-files=all` is deliberate on all three counts:
 * v1 is a stable format, `-z` means a path with a space or a quote cannot be
 * mis-split, and `all` lists files inside a new directory rather than the
 * directory alone. A directory-only listing would let a role write
 * `secret/thing.ts` and be reported as touching `secret/`, which a prefix
 * allowlist might well permit.
 */
export function changedPaths(cwd: string): string[] {
  const raw = gitRaw(cwd, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  const out: string[] = [];
  const records = raw.split("\0");
  for (let i = 0; i < records.length; i += 1) {
    const rec = records[i];
    if (!rec) continue;
    const status = rec.slice(0, 2);
    const path = rec.slice(3);
    if (path) out.push(path);
    // A rename record is `R  <new>\0<old>\0` — the old path is its own record
    // and must be counted as touched, not skipped.
    if (status.startsWith("R") || status.startsWith("C")) {
      const old = records[i + 1];
      if (old) {
        out.push(old);
        i += 1;
      }
    }
  }
  return out;
}

/** True when git reports nothing changed, tracked or untracked. */
export const isClean = (cwd: string): boolean => changedPaths(cwd).length === 0;

/**
 * Paths changed by the commits between `base` and `head`.
 *
 * **This is the half `git status` cannot see, and not seeing it was the defect
 * that failed QA.** A role that writes a file and then commits it leaves a
 * CLEAN working tree, so an enforcement mechanism built on `git status` alone
 * reports "nothing changed" while the file sits in history. Slice two makes
 * this the normal case, not an exotic one: committing is how a real session
 * leaves its work.
 *
 * `--no-renames` is deliberate. Rename detection would report only the new
 * path for a move, and a role that moved a protected file OUT of the allowlist
 * would be judged on its destination alone. Without it both sides appear as a
 * delete and an add, which is what the allowlist must see.
 */
export function committedPaths(cwd: string, base: string, head: string): string[] {
  if (base === head) return [];
  const raw = gitRaw(cwd, ["diff", "--name-only", "--no-renames", "-z", base, head]);
  return raw.split("\0").filter((p) => p !== "");
}

/** Whether `maybeAncestor` is an ancestor of `descendant` (a commit is its own ancestor). */
export function isAncestor(cwd: string, maybeAncestor: string, descendant: string): boolean {
  if (maybeAncestor === descendant) return true;
  return gitTry(cwd, ["merge-base", "--is-ancestor", maybeAncestor, descendant]).ok;
}

/** The first parent of a commit, or null when it has none. */
export function firstParent(cwd: string, sha: string): string | null {
  const r = gitTry(cwd, ["rev-parse", "--verify", "--quiet", `${sha}^1`]);
  return r.ok && /^[0-9a-f]{40}$/.test(r.stdout) ? r.stdout : null;
}

/**
 * Discard everything back to `base`: commits, tracked edits and untracked files.
 *
 * **Refuses unless `base` is an ancestor of HEAD.** `reset --hard` destroys
 * work, and the one case where it must not run is the one where the runtime has
 * lost track of where it is. If the tree is somewhere unexpected this throws and
 * says so, leaving the mess for a human rather than deleting an unknown history
 * to tidy up.
 */
export function resetHardTo(cwd: string, base: string): void {
  const head = headSha(cwd);
  if (!isAncestor(cwd, base, head)) {
    throw new GitRefused(
      `refusing to reset ${cwd} to ${base}: it is not an ancestor of HEAD (${head}). ` +
        `Something moved the tree somewhere this runtime did not expect, and discarding ` +
        `unknown history to recover from that would be worse than stopping. Recover by hand.`,
    );
  }
  git(cwd, ["reset", "--hard", base]);
  git(cwd, ["clean", "-fd"]);
}

/** Whether `cwd` is inside a git work tree at all. */
export function isRepo(cwd: string): boolean {
  const r = gitTry(cwd, ["rev-parse", "--is-inside-work-tree"]);
  return r.ok && r.stdout === "true";
}

/** Whether a ref resolves. Used to assert a tag exists — and that it does not, first. */
export function refExists(cwd: string, ref: string): boolean {
  return gitTry(cwd, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).ok;
}

/** The commit a ref points at, or null when it does not resolve. */
export function resolveRef(cwd: string, ref: string): string | null {
  const r = gitTry(cwd, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  return r.ok && /^[0-9a-f]{40}$/.test(r.stdout) ? r.stdout : null;
}

/**
 * Every ref under `refs/`, as ref name → the object it points at.
 *
 * `%(objectname)` is the ref's own target, **not the peeled commit**, and that
 * is deliberate: `git tag -f` on an annotated tag writes a new tag object, so a
 * watch that peeled to the commit would see the same sha before and after a
 * forced retag that changed the message. Identity of the target object is the
 * thing being watched.
 *
 * The sha is printed first because it is fixed-width: the parse is a slice at
 * 40, never a split on a separator a ref name might contain. (Ref names cannot
 * contain spaces, but a parser that does not need that fact cannot be wrong
 * about it.)
 *
 * LIMIT: `refs/` only. `HEAD` itself, `ORIG_HEAD`, the index, reflogs, hooks
 * and config are not refs and are not seen here.
 */
export function allRefs(cwd: string): Map<string, string> {
  const raw = git(cwd, ["for-each-ref", "--format=%(objectname) %(refname)"]);
  const out = new Map<string, string>();
  if (raw === "") return out;
  for (const line of raw.split("\n")) {
    const trimmed = line.trimEnd();
    if (trimmed === "") continue;
    const sha = trimmed.slice(0, 40);
    const name = trimmed.slice(41);
    if (!/^[0-9a-f]{40}$/.test(sha) || name === "") {
      throw new GitFailed(`for-each-ref produced a line this parser cannot read: "${line}"`, null, "");
    }
    out.set(name, sha);
  }
  return out;
}

/**
 * The ref `HEAD` symbolically points at — `refs/heads/main` — or null when the
 * checkout is detached and HEAD names a commit directly.
 */
export function symbolicHeadRef(cwd: string): string | null {
  const r = gitTry(cwd, ["symbolic-ref", "--quiet", "HEAD"]);
  return r.ok && r.stdout !== "" ? r.stdout : null;
}

/**
 * Point `HEAD` at a branch ref, without touching the index or the worktree.
 *
 * `git symbolic-ref` and not `git checkout`: the runtime is undoing a role's
 * change to what HEAD names, not moving the tree. `checkout` would do both and
 * the second half is not ours to do here.
 */
export function setSymbolicHead(cwd: string, ref: string): void {
  git(cwd, ["symbolic-ref", "HEAD", ref]);
}

/**
 * Point `HEAD` directly at a commit, detaching it, without touching the index
 * or the worktree.
 *
 * `--no-deref` is the whole point: without it this would move whatever branch
 * HEAD currently names, which is the opposite of detaching.
 */
export function detachHeadTo(cwd: string, sha: string): void {
  git(cwd, ["update-ref", "--no-deref", "HEAD", sha]);
}

/**
 * Point a ref at `sha`, refusing unless it currently points at `expectedOld`.
 *
 * The old-value argument is git's own compare-and-swap. Without it a restore
 * races whatever moved the ref in the first place, and a restore that can lose
 * that race is not a restore.
 */
export function setRefTo(cwd: string, ref: string, sha: string, expectedOld: string | null): void {
  git(cwd, expectedOld === null ? ["update-ref", ref, sha] : ["update-ref", ref, sha, expectedOld]);
}

/** Delete a ref, refusing unless it currently points at `expectedOld`. */
export function deleteRef(cwd: string, ref: string, expectedOld: string): void {
  git(cwd, ["update-ref", "-d", ref, expectedOld]);
}

/**
 * Stage the given paths and commit. Returns the new sha.
 *
 * Paths are passed after `--` so a path that looks like a flag cannot become
 * one, and each is staged explicitly — never `git add -A`, which would sweep in
 * whatever else happened to be in the tree and quietly widen the commit past
 * the allowlist the stage was held to.
 */
export function commitPaths(cwd: string, paths: readonly string[], message: string): string {
  if (paths.length === 0) {
    throw new GitRefused("commitPaths called with no paths — refusing to commit an empty change set");
  }
  git(cwd, ["add", "--", ...paths]);
  git(cwd, ["commit", "--no-verify", "--no-gpg-sign", "-m", message]);
  return headSha(cwd);
}

/**
 * Create an annotated tag at `sha`.
 *
 * Refuses to move an existing tag. A rollback marker that can be silently
 * repointed is not a marker, and `--force` here would make `loop-001-developer`
 * mean "wherever the last run left it".
 */
export function tagAt(cwd: string, tag: string, sha: string, message: string): void {
  if (refExists(cwd, tag)) {
    throw new GitRefused(
      `tag ${tag} already exists at ${resolveRef(cwd, tag)} — refusing to move it; ` +
        `a rollback marker that moves is not a marker`,
    );
  }
  git(cwd, ["tag", "-a", tag, sha, "-m", message]);
}

/**
 * Discard working-tree changes to the given paths: tracked files go back to
 * HEAD, untracked files are removed.
 *
 * Used to undo an allowlist violation. Both halves are needed — `checkout --`
 * does nothing to a file git has never seen, so an untracked write outside the
 * allowlist would survive a "revert" that reported success.
 */
export function revertPaths(cwd: string, paths: readonly string[]): void {
  if (paths.length === 0) return;
  const tracked: string[] = [];
  const untracked: string[] = [];
  for (const p of paths) {
    (gitTry(cwd, ["ls-files", "--error-unmatch", "--", p]).ok ? tracked : untracked).push(p);
  }
  if (tracked.length > 0) git(cwd, ["checkout", "HEAD", "--", ...tracked]);
  if (untracked.length > 0) git(cwd, ["clean", "-fdx", "--", ...untracked]);
}
