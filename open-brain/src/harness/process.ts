/**
 * Running a role as an external process — the mechanics, with no policy.
 *
 * `roles.ts` owns WHO may run (the provenance registry and `ProcessRole`);
 * this module owns HOW a process is started, fed, bounded and read back:
 *
 * - **No shell, anywhere.** An executable and an argument array. A `.cmd` or
 *   `.bat` is never spawned: Node refuses it without a shell (CVE-2024-27980,
 *   `EINVAL`), and a shell is how `^` and `$` got eaten in this project's
 *   record. A launcher is RESOLVED to something that runs without one — a
 *   native executable, or `node <entry>` — or the role is refused, naming the
 *   path. There is no fallback to `shell: true` (CA-2.5).
 * - **The environment is constructed, never inherited** (G-044). An allowlist
 *   of names is copied from the parent, a fixed set is forced, and a fixed set
 *   is DENIED — asked for or not.
 * - **A bound is a bound on the process TREE.** A role that times out is killed
 *   with every process it started (`taskkill /T` on Windows, the process group
 *   elsewhere), and the caller still closes every window afterwards.
 *
 * LIMIT, stated where it lives: a child that DETACHES from the tree before the
 * bound, or outlives a role that exited normally, is not tracked here (U3).
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, delimiter, dirname, extname, join, resolve } from "node:path";

/* ------------------------------------------------------------------------- *
 * Launcher resolution
 * ------------------------------------------------------------------------- */

export type LauncherForm = "native" | "node-entry";

export type LauncherResolution =
  | {
      ok: true;
      /** What is actually spawned. */
      executable: string;
      /** Arguments placed before the adapter's own — `[entry]` for `node-entry`. */
      preArgs: string[];
      form: LauncherForm;
      /** The file the resolution started from, and how it got to `executable`. */
      resolvedFrom: string;
      how: string;
    }
  | { ok: false; reason: string };

const SCRIPT_EXTS = new Set([".js", ".cjs", ".mjs"]);

/**
 * The target an npm `cmd-shim` launches, read from the `.cmd` text.
 *
 * npm writes the target as `"%dp0%\<relative path>"`; the last such quoted
 * path on the command line is the program (earlier ones are `node.exe`
 * probes). Returns null when the file carries none — and the caller refuses.
 */
export function cmdShimTarget(cmdPath: string): string | null {
  const text = readFileSync(cmdPath, "utf-8");
  const re = /"%~?dp0%?\\([^"%]+)"/gi;
  let last: string | null = null;
  for (const m of text.matchAll(re)) {
    const rel = m[1]!;
    if (/^node(\.exe)?$/i.test(rel)) continue;
    last = rel;
  }
  return last === null ? null : resolve(dirname(cmdPath), last);
}

/**
 * Turn a launcher path into something that runs WITHOUT a shell.
 *
 * - `.exe`, or any file on POSIX that is not a script: spawned directly.
 * - `.js`/`.cjs`/`.mjs`: spawned as `node <file>` with this process's node.
 * - `.cmd`/`.bat`: read as an npm shim and resolved to its target by the two
 *   rules above. A shim whose target cannot be found is REFUSED, naming it.
 * - A POSIX symlink is followed first (npm's global bin links to the script).
 */
export function resolveLauncher(path: string): LauncherResolution {
  if (!existsSync(path)) return { ok: false, reason: `launcher ${path} does not exist` };
  const real = realpathSync(path);
  if (statSync(real).isDirectory()) return { ok: false, reason: `launcher ${path} is a directory` };
  const ext = extname(real).toLowerCase();

  if (ext === ".cmd" || ext === ".bat") {
    const target = cmdShimTarget(real);
    if (target === null) {
      return {
        ok: false,
        reason:
          `launcher ${real} is a batch file with no resolvable npm-shim target ("%dp0%\\…"). A batch file ` +
          `cannot be spawned without a shell, and this runtime does not use one — refused rather than run ` +
          `through cmd.exe.`,
      };
    }
    if (!existsSync(target)) {
      return { ok: false, reason: `launcher ${real} names ${target}, which does not exist` };
    }
    const inner = resolveLauncher(target);
    if (!inner.ok) return { ok: false, reason: `launcher ${real} → ${inner.reason}` };
    return { ...inner, resolvedFrom: real, how: `npm shim ${basename(real)} → ${inner.how}` };
  }

  if (SCRIPT_EXTS.has(ext)) {
    return { ok: true, executable: process.execPath, preArgs: [real], form: "node-entry", resolvedFrom: real, how: `node ${real}` };
  }

  if (process.platform === "win32") {
    if (ext === ".exe" || ext === ".com") {
      return { ok: true, executable: real, preArgs: [], form: "native", resolvedFrom: real, how: `native ${real}` };
    }
    return { ok: false, reason: `launcher ${real} has no extension Windows can spawn without a shell (.exe, .com, or a script run by node)` };
  }

  // POSIX: a script with a node shebang is run by node; anything else directly.
  const head = readFileSync(real).subarray(0, 128).toString("utf-8");
  if (head.startsWith("#!") && /\bnode\b/.test(head.split("\n")[0]!)) {
    return { ok: true, executable: process.execPath, preArgs: [real], form: "node-entry", resolvedFrom: real, how: `node ${real} (shebang)` };
  }
  return { ok: true, executable: real, preArgs: [], form: "native", resolvedFrom: real, how: `native ${real}` };
}

/**
 * Find `name` on the PATH of the environment the role will run in, the way the
 * OS would: first directory wins, and on Windows `.exe` before `.cmd` within a
 * directory (PATHEXT order). Returns the path to resolve, or null.
 */
export function findOnPath(name: string, env: NodeJS.ProcessEnv): string | null {
  const pathVar = env.PATH ?? env.Path ?? "";
  const exts = process.platform === "win32" ? [".exe", ".com", ".cmd", ".bat"] : [""];
  for (const dir of pathVar.split(delimiter)) {
    if (dir.trim() === "") continue;
    for (const ext of exts) {
      const p = join(dir, `${name}${ext}`);
      if (existsSync(p) && statSync(p).isFile()) return p;
    }
  }
  return null;
}

/* ------------------------------------------------------------------------- *
 * Environment
 * ------------------------------------------------------------------------- */

/** Names every role process may inherit — what a program needs to start, and nothing that authorises anything. */
export const BASE_ENV_ALLOW: readonly string[] = [
  "PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "SYSTEMDRIVE", "COMSPEC", "TEMP", "TMP", "TMPDIR",
  "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "PROGRAMDATA", "HOMEDRIVE", "HOMEPATH",
  "USERNAME", "USER", "LOGNAME", "LANG", "LC_ALL", "XDG_CONFIG_HOME",
];

/**
 * Names a role process must never receive, whatever it is configured to ask for.
 *
 * - `TYPESAFE_API_KEY`: the gate credential, which lives in the runtime.
 * - `CLAUDE_CODE_CHILD_SESSION`: inherited from a parent session it makes the
 *   child write NO transcript — the variable's PRESENCE misread as a host
 *   property by three seats in Loop 16 (G-044's mirror, T-161). It is removed,
 *   not warned about.
 */
export const DENIED_ENV: readonly string[] = ["TYPESAFE_API_KEY", "CLAUDE_CODE_CHILD_SESSION"];

/** Set on every role process. The transcript is evidence (T-161). */
export const FORCED_ENV: Readonly<Record<string, string>> = {
  CLAUDE_CODE_FORCE_SESSION_PERSISTENCE: "1",
};

/**
 * Build a child environment from nothing: allowlisted names copied from the
 * parent (case-insensitively, as Windows treats them), then the forced set,
 * then the caller's own values. Denied names are refused if asked for, and
 * asserted absent afterwards — a construction that cannot fail is not a check.
 */
export function constructEnv(
  parent: NodeJS.ProcessEnv,
  allow: readonly string[],
  set: Readonly<Record<string, string>>,
  opts: { forced?: boolean } = {},
): NodeJS.ProcessEnv {
  const denied = new Set(DENIED_ENV.map((n) => n.toUpperCase()));
  for (const n of [...allow, ...Object.keys(set)]) {
    if (denied.has(n.toUpperCase())) {
      throw new Error(`the role environment may not carry ${n}: it is on the denied list (${DENIED_ENV.join(", ")})`);
    }
  }
  const wanted = new Set([...BASE_ENV_ALLOW, ...allow].map((n) => n.toUpperCase()));
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(parent)) {
    if (v !== undefined && wanted.has(k.toUpperCase())) env[k] = v;
  }
  for (const [k, v] of Object.entries({ ...(opts.forced === false ? {} : FORCED_ENV), ...set })) env[k] = v;
  for (const k of Object.keys(env)) {
    if (denied.has(k.toUpperCase())) throw new Error(`constructed role environment carries denied ${k} — refusing to spawn`);
  }
  return env;
}

/* ------------------------------------------------------------------------- *
 * Spawn, bound, kill
 * ------------------------------------------------------------------------- */

export interface SpawnOutcome {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  /** What the tree kill did, when it ran. Empty otherwise. */
  killNote: string;
  durationMs: number;
  pid: number | null;
  stdoutTail: string;
  stderrTail: string;
  /** Set when the process could not be started at all. */
  spawnError: string | null;
}

const TAIL = 64 * 1024;
const keepTail = (acc: string, chunk: Buffer): string => {
  const s = acc + chunk.toString("utf-8");
  return s.length > TAIL ? s.slice(s.length - TAIL) : s;
};

/**
 * What this platform does about a role's descendants, stated in every loop's
 * own output (planner's ruling (b), condition 1): a limit nobody reads at the
 * point of use is the G-034 shape. The runtime must not claim a group kill it
 * does not perform.
 */
export const TREE_KILL_STATEMENT: string =
  process.platform === "win32"
    ? "normal-exit tree-kill: unavailable on win32 (no job object); timeout path killed via taskkill /T while the root is alive"
    : "normal-exit tree-kill: the role's process group is sent SIGKILL on every exit path — normal, timeout and error — before any runtime git call";

/** The kill note of a normal exit on win32: an exact sentence, so a test can assert it by equality. */
export const WIN32_NORMAL_EXIT_NOTE =
  "no descendant of a normally-exited role is signalled on win32 (no job object; stated limit)";

/** Kill a process and everything it started. Synchronous so the caller knows it ran. */
export function killTree(pid: number): string {
  if (process.platform === "win32") {
    const taskkill = join(process.env.SystemRoot ?? process.env.SYSTEMROOT ?? "C:\\Windows", "System32", "taskkill.exe");
    const r = spawnSync(taskkill, ["/PID", String(pid), "/T", "/F"], { encoding: "utf-8", shell: false });
    return `taskkill /PID ${pid} /T /F exited ${r.status ?? "none"}${r.error ? ` (${r.error.message})` : ""}`;
  }
  try {
    process.kill(-pid, "SIGKILL");
    return `SIGKILL sent to process group ${pid}`;
  } catch (err) {
    return `could not signal process group ${pid}: ${(err as Error).message}`;
  }
}

/**
 * Spawn with no shell, write `stdin`, and resolve when the process EXITS.
 *
 * "Exits", not "closes": a grandchild holding the stdout pipe would otherwise
 * hold this promise open past the role's own exit. The streams are destroyed on
 * exit so a lingering holder cannot keep the runtime waiting.
 */
export function runBounded(
  executable: string,
  args: readonly string[],
  opts: { cwd: string; env: NodeJS.ProcessEnv; stdin: string; timeoutMs: number },
): Promise<SpawnOutcome> {
  const started = Date.now();
  return new Promise((resolvePromise) => {
    let stdoutTail = "";
    let stderrTail = "";
    let timedOut = false;
    let killNote = "";
    let settled = false;

    const child = spawn(executable, [...args], {
      cwd: opts.cwd,
      env: opts.env,
      shell: false,
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const finish = (o: Partial<SpawnOutcome>): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdout?.destroy();
      child.stderr?.destroy();
      resolvePromise({
        exitCode: null,
        signal: null,
        timedOut,
        killNote,
        durationMs: Date.now() - started,
        pid: child.pid ?? null,
        stdoutTail,
        stderrTail,
        spawnError: null,
        ...o,
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killNote = child.pid !== undefined ? killTree(child.pid) : "no pid to kill";
    }, opts.timeoutMs);

    child.stdout?.on("data", (c: Buffer) => { stdoutTail = keepTail(stdoutTail, c); });
    child.stderr?.on("data", (c: Buffer) => { stderrTail = keepTail(stderrTail, c); });
    child.on("error", (err) => finish({ spawnError: err.message }));
    child.on("exit", (code, signal) => {
      // Tree kill on EVERY exit path, not only the timeout (planner, on Probe's
      // question 2): a descendant that outlives the role could write between the
      // runtime's compare and its next git call (R20). On POSIX the role leads its
      // own process group, which survives the leader's exit while any member
      // lives, so one signal to the group reaches every descendant.
      if (!timedOut && process.platform !== "win32" && child.pid !== undefined) {
        try {
          process.kill(-child.pid, "SIGKILL");
          killNote = `process group ${child.pid} swept after exit (SIGKILL)`;
        } catch (err) {
          const e = err as NodeJS.ErrnoException;
          killNote = e.code === "ESRCH" ? `process group ${child.pid} was already empty after exit` : `could not sweep process group ${child.pid}: ${e.message}`;
        }
      } else if (!timedOut && process.platform === "win32") {
        killNote = WIN32_NORMAL_EXIT_NOTE;
      }
      finish({ exitCode: code, signal: signal ?? null });
    });

    child.stdin?.on("error", () => {});
    child.stdin?.end(opts.stdin);
  });
}
