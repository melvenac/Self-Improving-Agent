/**
 * The fifth channel: **git config and hooks** — layer 2 of three.
 *
 * A role can plant a hook or a program-valued config key and have it run
 * inside the RUNTIME's next git call (design §2.3, reproduced by QA). Layers 0
 * and 1 (`git.ts`) stop the runtime's calls from reading machine config and
 * override the repo-local keys on the command line. This layer is the one that
 * catches the whole CLASS: it does not enumerate dangerous keys — there is no
 * complete list of program-valued config, and git adds to it — it refuses ANY
 * change to the files git reads config and hooks from.
 *
 * ## It reads FILES, never git, and it restores before anything reads HEAD
 *
 * `git status` is itself an execution point: `core.fsmonitor` runs on it. So
 * the comparison and the restore here are plain file reads and writes, and the
 * runtime runs them BEFORE the ref window closes and before `enforceAllowlist`
 * — G-045's "restore before any read", moved one channel earlier. A git call
 * placed ahead of this restore is the ordering defect layer 1 exists to catch.
 *
 * ## Where the files are is decided ONCE, at preflight (R12)
 *
 * In a linked worktree `.git` is a file, config and hooks live in the COMMON
 * dir, and `config.worktree` lives in the worktree's own git dir. Both are
 * resolved before any role runs and never re-resolved: a role that rewrites the
 * worktree's `.git` file to point elsewhere must not move the snapshot. That
 * `.git` file is itself in the snapshot, so the rewrite is caught and undone.
 *
 * ## What this does NOT see, and says so in its verdict
 *
 * Config outside the repository — global, XDG, system — is not this layer's:
 * the runtime's calls do not read it (layer 0), and a role's writes to it are
 * HASHED AND REPORTED, never restored, by {@link MachineConfigWatch} (R8). The
 * index, submodules and the reflog are unprobed.
 */

import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  existsSync,
  ftruncateSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { git, gitTry } from "./git.js";

/** Where git keeps the files this layer watches, resolved once. */
export interface GitDirs {
  /** `git rev-parse --git-dir`: this worktree's own git dir. */
  gitDir: string;
  /** `git rev-parse --git-common-dir`: config, hooks and info live here. */
  commonDir: string;
  /** `<worktree>/.git` when it is a FILE (a linked worktree), else null. */
  gitFile: string | null;
}

const toAbs = (repoRoot: string, p: string): string => resolve(isAbsolute(p) ? p : join(repoRoot, p));

/**
 * Resolve the git dirs. Called at preflight, before any role has run — the
 * only moment the answer is the repository's rather than a role's.
 */
export function resolveGitDirs(repoRoot: string): GitDirs {
  const gitDir = toAbs(repoRoot, git(repoRoot, ["rev-parse", "--git-dir"]));
  const commonDir = toAbs(repoRoot, git(repoRoot, ["rev-parse", "--git-common-dir"]));
  const dotGit = join(repoRoot, ".git");
  const gitFile = existsSync(dotGit) && lstatSync(dotGit).isFile() ? dotGit : null;
  return { gitDir, commonDir, gitFile };
}

/** The exact files and directories this layer snapshots. Stated so a verdict can say what it looked at. */
export function watchedLocations(dirs: GitDirs): { files: string[]; trees: string[] } {
  const files = new Set<string>([
    join(dirs.commonDir, "config"),
    join(dirs.gitDir, "config.worktree"),
    join(dirs.commonDir, "config.worktree"),
  ]);
  if (dirs.gitFile !== null) files.add(dirs.gitFile);
  const trees = [join(dirs.commonDir, "hooks"), join(dirs.commonDir, "info")];
  if (dirs.gitDir !== dirs.commonDir) trees.push(join(dirs.gitDir, "info"));
  return { files: [...files].sort(), trees: [...new Set(trees)].sort() };
}

/** Every regular file under `dir`, recursively. A missing dir has none. */
function listTree(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else out.push(p);
    }
  };
  if (statSync(dir).isDirectory()) walk(dir);
  else out.push(dir);
  return out;
}

const hashOf = (bytes: Buffer | null): string =>
  bytes === null ? "absent" : createHash("sha256").update(bytes).digest("hex").slice(0, 16);

export interface ConfigChange {
  path: string;
  kind: "created" | "deleted" | "modified";
  before: string;
  after: string;
}

export interface ConfigVerdict {
  ok: boolean;
  stage: string;
  /** How many files were compared. A check must prove it looked. */
  examined: number;
  changes: ConfigChange[];
  /** Files the restore could not put back, with why. */
  unrestored: string[];
  message: string;
}

export const CONFIG_WATCH_LIMIT =
  "LIMIT: repository config and hooks (the common dir's config, hooks/ and info/, config.worktree, and a " +
  "linked worktree's .git file) — not global, XDG or system config (hashed and reported separately, never " +
  "restored), not the index, submodules or the reflog.";

/**
 * A byte snapshot of the repository's config and hooks around one stage.
 *
 * Compare and restore are one call, {@link closeAndRestore}, because the only
 * safe moment to have looked is also the moment to put things back: between
 * the two, nothing may run git.
 */
/** A watched file's content AND mode — a hook is enabled by its executable bit as much as by its bytes. */
interface FileState {
  bytes: Buffer;
  mode: number;
}

const readState = (p: string): FileState | null =>
  existsSync(p) && !statSync(p).isDirectory() ? { bytes: readFileSync(p), mode: statSync(p).mode & 0o777 } : null;

const sameState = (a: FileState | null, b: FileState | null): boolean =>
  a === null || b === null ? a === b : a.mode === b.mode && a.bytes.equals(b.bytes);

const stateHash = (s: FileState | null): string =>
  s === null ? "absent" : `${hashOf(s.bytes)}/${s.mode.toString(8)}`;

/**
 * Put `bytes` back into `path`. An EXISTING file is rewritten in place — open
 * `r+`, truncate, write — not recreated: on Windows a hidden file cannot be
 * opened for create-and-truncate (`EPERM`), and Git for Windows marks a linked
 * worktree's `.git` pointer hidden. `writeFileSync` there fails on exactly the
 * file the redirection probe targets (found by running it, not by reading).
 */
function writeBack(path: string, bytes: Buffer): void {
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
    return;
  }
  const fd = openSync(path, "r+");
  try {
    ftruncateSync(fd, 0);
    writeSync(fd, bytes, 0, bytes.length, 0);
  } finally {
    closeSync(fd);
  }
}

export class ConfigWatch {
  private snapshot: Map<string, FileState | null> | null = null;
  private stage = "";
  readonly dirs: GitDirs;

  constructor(dirs: GitDirs) {
    this.dirs = dirs;
  }

  private currentFiles(): string[] {
    const { files, trees } = watchedLocations(this.dirs);
    const all = new Set<string>(files);
    for (const t of trees) for (const f of listTree(t)) all.add(f);
    return [...all].sort();
  }

  /** Open a window: read every watched file's bytes. File I/O only. */
  begin(stage: string): void {
    this.stage = stage;
    const snap = new Map<string, FileState | null>();
    for (const f of this.currentFiles()) snap.set(f, readState(f));
    this.snapshot = snap;
  }

  get open(): boolean {
    return this.snapshot !== null;
  }

  /**
   * Close the window: compare by bytes and put every changed file back. File
   * I/O only — no git call happens anywhere in here, which is what makes it
   * safe to run while a planted `core.fsmonitor` is still in `.git/config`.
   */
  closeAndRestore(): ConfigVerdict {
    const before = this.snapshot;
    if (before === null) {
      throw new Error(
        "ConfigWatch.closeAndRestore() was called with no open window — a verdict with no baseline would " +
          "report 'nothing changed' for a stage nobody watched.",
      );
    }
    this.snapshot = null;

    const names = new Set<string>([...before.keys(), ...this.currentFiles()]);
    const changes: ConfigChange[] = [];
    const unrestored: string[] = [];

    for (const path of [...names].sort()) {
      const b = before.has(path) ? before.get(path)! : null;
      const a = readState(path);
      if (sameState(b, a)) continue;
      changes.push({
        path,
        kind: b === null ? "created" : a === null ? "deleted" : "modified",
        before: stateHash(b),
        after: stateHash(a),
      });
      try {
        if (b === null) rmSync(path, { force: true });
        else {
          writeBack(path, b.bytes);
          chmodSync(path, b.mode);
        }
        const now = readState(path);
        if (!sameState(now, b)) unrestored.push(`${path} (read back ${stateHash(now)}, expected ${stateHash(b)})`);
      } catch (err) {
        unrestored.push(`${path} (${(err as Error).message})`);
      }
    }

    const rel = (p: string): string => {
      const r = relative(this.dirs.commonDir, p);
      return r.startsWith("..") ? p : `<common>/${r.replace(/\\/g, "/")}`;
    };
    const scale = `examined ${names.size} file(s) around the ${this.stage} stage`;
    const ok = changes.length === 0;
    const message = ok
      ? `no repository config or hook changed (${scale}). ${CONFIG_WATCH_LIMIT}`
      : `${changes.length} repository config/hook file(s) changed during the ${this.stage} stage: ` +
        `${changes.map((c) => `${rel(c.path)} ${c.kind} (${c.before} → ${c.after})`).join("; ")}. ` +
        `A role may not change what git executes: a hook or a program-valued config key runs inside the ` +
        `runtime's own git calls. ` +
        (unrestored.length === 0
          ? `Every file was put back by bytes before any git call read the repository. `
          : `${unrestored.length} FILE(S) COULD NOT BE PUT BACK: ${unrestored.join("; ")}. Recover by hand before rerunning. `) +
        `${scale}. ${CONFIG_WATCH_LIMIT}`;

    return { ok, stage: this.stage, examined: names.size, changes, unrestored, message };
  }
}

/* ------------------------------------------------------------------------- *
 * R8 — the machine-wide half: HASHED AND REPORTED, never refused or restored
 * ------------------------------------------------------------------------- */

export interface MachineConfigPath {
  /** `global`, `xdg` or `system`. */
  scope: "global" | "xdg" | "system";
  path: string;
  /** How the path was arrived at, so a reader can check it. */
  source: string;
}

export interface MachineConfigFinding {
  stage: string;
  scope: string;
  path: string;
  before: string;
  after: string;
}

/**
 * The files git would read as global and system config for THIS environment.
 *
 * Derived from the environment the runtime was given, not from `os.homedir()`,
 * so a test that points HOME and XDG_CONFIG_HOME at scratch dirs is watching
 * the files it wrote rather than the real ones.
 *
 * The system path is DERIVED, not asked of git: asking would mean a git call
 * that reads the system config, which layer 0 forbids. `GIT_CONFIG_SYSTEM`
 * wins when set; otherwise Git for Windows keeps it at `<install>/etc/gitconfig`
 * three levels above `git --exec-path`, and other platforms at
 * `/etc/gitconfig`. That derivation is a reading of the install layout, and
 * the test that checks it on this machine compares it with git's own
 * `--show-origin`.
 */
export function machineConfigPaths(env: NodeJS.ProcessEnv, execPath: string | null): MachineConfigPath[] {
  const home = env.HOME ?? env.USERPROFILE ?? "";
  const out: MachineConfigPath[] = [];
  if (home !== "") out.push({ scope: "global", path: join(home, ".gitconfig"), source: "HOME (or USERPROFILE)/.gitconfig" });
  const xdgBase = env.XDG_CONFIG_HOME && env.XDG_CONFIG_HOME !== "" ? env.XDG_CONFIG_HOME : home !== "" ? join(home, ".config") : "";
  if (xdgBase !== "") {
    out.push({
      scope: "xdg",
      path: join(xdgBase, "git", "config"),
      source: env.XDG_CONFIG_HOME ? "XDG_CONFIG_HOME/git/config" : "HOME/.config/git/config (XDG default)",
    });
  }
  if (env.GIT_CONFIG_SYSTEM && env.GIT_CONFIG_SYSTEM !== "") {
    out.push({ scope: "system", path: env.GIT_CONFIG_SYSTEM, source: "GIT_CONFIG_SYSTEM" });
  } else if (process.platform === "win32" && execPath !== null) {
    out.push({ scope: "system", path: resolve(execPath, "..", "..", "..", "etc", "gitconfig"), source: "git --exec-path/../../../etc/gitconfig (Git for Windows layout)" });
  } else {
    out.push({ scope: "system", path: "/etc/gitconfig", source: "/etc/gitconfig (default prefix)" });
  }
  return out;
}

/** `git --exec-path` — reads no config, so it is safe to ask. Null when it cannot be answered. */
export function gitExecPath(repoRoot: string): string | null {
  const r = gitTry(repoRoot, ["--exec-path"]);
  return r.ok && r.stdout !== "" ? r.stdout : null;
}

/**
 * Hash the machine-wide config files before and after each stage. A change is
 * a FINDING, with the path and both hashes. It fails nothing and restores
 * nothing: a role that wrote `~/.gitconfig` has changed git for every session
 * on the machine, and the runtime must not "restore" a person's own file (R8).
 */
export class MachineConfigWatch {
  private snapshot: Map<string, string> | null = null;
  private stage = "";
  readonly paths: readonly MachineConfigPath[];

  constructor(paths: readonly MachineConfigPath[]) {
    this.paths = paths;
  }

  private hashNow(p: string): string {
    return existsSync(p) && statSync(p).isFile() ? hashOf(readFileSync(p)) : "absent";
  }

  begin(stage: string): void {
    this.stage = stage;
    this.snapshot = new Map(this.paths.map((p) => [p.path, this.hashNow(p.path)]));
  }

  compare(): MachineConfigFinding[] {
    const before = this.snapshot;
    if (before === null) throw new Error("MachineConfigWatch.compare() was called with no open window.");
    this.snapshot = null;
    const out: MachineConfigFinding[] = [];
    for (const p of this.paths) {
      const b = before.get(p.path) ?? "absent";
      const a = this.hashNow(p.path);
      if (a !== b) out.push({ stage: this.stage, scope: p.scope, path: p.path, before: b, after: a });
    }
    return out;
  }
}

/* ------------------------------------------------------------------------- *
 * R21 — the target's own config is DEFAULT-DENY at base
 * ------------------------------------------------------------------------- */

/**
 * The keys a target repository's local config may carry at base. Anything else
 * is refused, by name, before any role runs.
 *
 * Not a list of dangerous keys — there is no complete one, and git adds to it —
 * but a list of SAFE ones, which is the strict side (shared.md). Measured, not
 * recalled: `git init`, `git clone` and `git worktree add` on git
 * 2.54.0.windows.1 write exactly the six `core.*` keys below, plus
 * `remote.origin.url`/`fetch` and `branch.<b>.remote`/`merge` for a clone; the
 * test that runs them re-measures on whatever git runs the suite, so CI's git
 * checks it too.
 *
 * Beyond what init and clone write: the planner's NAMED list of reviewed
 * non-program keys (ruling on Probe's question 1), each with its reason below.
 * Any key that names or selects a program stays refused — `gpg.program`,
 * `tag.gpgSign`, `filter.*`, `core.sshCommand`, `core.fsmonitor`, … — and so
 * does every key nobody has reviewed. `remote.<x>.url` and `.fetch` are the
 * clone's own keys; `receivepack`/`uploadpack` name programs and are not in
 * the list. A loop with a process role refuses any remote separately.
 */
export const SAFE_LOCAL_KEYS: ReadonlyArray<{ key: RegExp; value?: RegExp; why: string }> = [
  { key: /^core\.(repositoryformatversion|filemode|bare|logallrefupdates|symlinks|ignorecase)$/, why: "written by git init (measured)" },
  { key: /^branch\.[^.]+(\..+)?\.(remote|merge)$/, why: "written by git clone (measured)" },
  { key: /^remote\.[^.]+(\..+)?\.(url|fetch)$/, why: "written by git clone (measured)" },
  { key: /^user\.(name|email)$/, why: "identity: a name and an address, never a program" },
  { key: /^commit\.gpgsign$/, why: "every runtime commit passes --no-gpg-sign, so no signing program runs" },
  { key: /^core\.(autocrlf|eol)$/, why: "line-ending handling only" },
  { key: /^extensions\.worktreeconfig$/, why: "a flag enabling config.worktree, which is itself watched and held to this list" },
];

/** Every key in the repository's own config files that {@link SAFE_LOCAL_KEYS} does not allow. */
export function unsafeLocalKeys(repoRoot: string, dirs: GitDirs): { keys: string[]; error: string | null } {
  const files = [join(dirs.commonDir, "config"), join(dirs.gitDir, "config.worktree"), join(dirs.commonDir, "config.worktree")];
  const keys: string[] = [];
  for (const f of [...new Set(files)]) {
    if (!existsSync(f)) continue;
    // `-z`: key and value separated by a newline, entries by NUL, so a value
    // containing "=" or a newline cannot be mis-split.
    const r = gitTry(repoRoot, ["config", "--file", f, "--list", "-z"]);
    if (!r.ok) return { keys, error: `could not read ${f}: ${r.stderr || `exit ${r.status}`}` };
    for (const entry of r.stdout.split("\0")) {
      if (entry === "") continue;
      const nl = entry.indexOf("\n");
      const key = (nl < 0 ? entry : entry.slice(0, nl)).toLowerCase();
      const value = nl < 0 ? "" : entry.slice(nl + 1);
      const rule = SAFE_LOCAL_KEYS.find((s) => s.key.test(key));
      if (rule === undefined || (rule.value !== undefined && !rule.value.test(value.trim()))) {
        keys.push(`${key} (in ${f})`);
      }
    }
  }
  return { keys, error: null };
}

/* ------------------------------------------------------------------------- *
 * R13 — an include present at base is refused
 * ------------------------------------------------------------------------- */

/**
 * Every `include.*` / `includeIf.*` key in the repository's own config files.
 *
 * Read with `git config --file <path>`, one file at a time, so only the
 * repository's files are consulted (layer 0 already keeps the machine's out).
 * `--get-regexp` exits 1 when nothing matches — an ANSWER, not a fault — and
 * any other non-zero exit is returned as an error so the caller refuses rather
 * than reading a failure as "no includes".
 */
export function includesAtBase(repoRoot: string, dirs: GitDirs): { keys: string[]; error: string | null } {
  const files = [join(dirs.commonDir, "config"), join(dirs.gitDir, "config.worktree"), join(dirs.commonDir, "config.worktree")];
  const keys: string[] = [];
  for (const f of [...new Set(files)]) {
    if (!existsSync(f)) continue;
    const r = gitTry(repoRoot, ["config", "--file", f, "--name-only", "--get-regexp", "^include(if)?\\."]);
    if (r.status === 1) continue;
    if (!r.ok) return { keys, error: `could not read ${f}: ${r.stderr || `exit ${r.status}`}` };
    for (const k of r.stdout.split("\n")) if (k.trim() !== "") keys.push(`${k.trim()} (in ${f})`);
  }
  return { keys, error: null };
}
