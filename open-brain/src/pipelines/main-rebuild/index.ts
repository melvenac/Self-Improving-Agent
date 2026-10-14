import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";
import { resolveNpm } from "../../harness/checks.js";
import { isMainCheckout } from "../../shared/main-checkout.js";
import { resolvePaths } from "../../shared/paths.js";
import { byPidDir, loadWin32ProcessTable, processStartTime, type ProcessParentInfo } from "../../shared/process-session.js";
import { readStampedCommit, SERVING_UPSTREAM } from "../session-start/serving-build.js";
import { fetchOrigin, readLastFetchAt } from "../session-start/tree-currency.js";

/**
 * T-172 half 2: `open-brain main-rebuild [<sha>] [--dry-run] [--no-fetch]`.
 *
 * The main checkout's `open-brain/build/` serves EVERY session's hooks and MCP servers. This command updates it,
 * rebuilds it and verifies it, or refuses and changes nothing. Its stand-in (an untracked shell script) decided
 * "already at" by HEAD rather than the build stamp, checked out over a dirty tree, ran `npm ci` under servers that
 * hold `better_sqlite3.node`, ignored the build's exit code with no restore, and never verified the stamp.
 *
 * STATIC IMPORTS ONLY. The CLI runs from the very build this replaces: `npm run build` deletes `build/` first, so a
 * module loaded lazily after that point would be loaded from a half-written build, or not at all. A test pins it.
 *
 * Every runner takes an argument array and never a shell. The verdict on the build is the stamp and two fresh child
 * processes, never the build's exit code alone.
 */

export interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
  /** Set when the process could not be spawned at all (or timed out). */
  error?: string;
}

/** Runs one program in `cwd` with `args`, never through a shell. */
export type Runner = (args: readonly string[], cwd: string) => Run;

export interface MainRebuildDeps {
  git: Runner;
  /** null: npm could not be located (refusal 8). */
  npm: Runner | null;
  node: Runner;
  startTimeOf: (pid: number) => string | null;
  /** null when the table cannot be read; every live proof is then listed. */
  processTable: () => Map<number, ProcessParentInfo> | null;
  now: () => Date;
}

export interface MainRebuildOptions {
  positionals?: readonly string[];
  dryRun?: boolean;
  noFetch?: boolean;
  /** The by-pid session proofs. Default: beside active-session.json. */
  proofDir?: string;
}

export interface MainRebuildResult {
  exitCode: number;
  lines: string[];
}

/** How many build backups are kept under `<git common dir>/open-brain-build-backups/`. */
export const BACKUPS_KEPT = 3;

const BACKUPS_DIR = "open-brain-build-backups";
const BACKUP_NAME = /^[0-9a-f]{7}-\d{8}T\d{9}Z$/;
const BUILD_TIMEOUT_MS = 600_000;

const runner =
  (command: string, prefix: readonly string[], timeout: number): Runner =>
  (args, cwd) => {
    const r = spawnSync(command, [...prefix, ...args], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      maxBuffer: 64 * 1024 * 1024,
    });
    return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "", ...(r.error ? { error: r.error.message } : {}) };
  };

function defaultProcessTable(): Map<number, ProcessParentInfo> | null {
  if (process.platform !== "win32") return null;
  const t = loadWin32ProcessTable();
  return t.ok ? t.table : null;
}

export function defaultDeps(): MainRebuildDeps {
  const npm = resolveNpm();
  return {
    git: runner("git", [], 120_000),
    npm: npm ? runner(npm.command, npm.args, BUILD_TIMEOUT_MS) : null,
    node: runner(process.execPath, [], 120_000),
    startTimeOf: processStartTime,
    processTable: defaultProcessTable,
    now: () => new Date(),
  };
}

export type ServingClass = { kind: "current" } | { kind: "stale"; codeCommits: number } | { kind: "other" };

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** V3's verdict on describeServingBuild()'s line, for the build stamped `sha7`. */
export function classifyServingLine(line: string, sha7: string): ServingClass {
  const l = line.trim();
  const s = escapeRe(sha7);
  if (new RegExp(`^Build ${s} · current( \\(\\d+ records-only commits? behind\\))?$`).test(l)) return { kind: "current" };
  if (new RegExp(`^Build ${s} · STALE: `).test(l)) {
    const n = /(\d+) code commits? behind/.exec(l);
    return { kind: "stale", codeCommits: n ? Number(n[1]) : 0 };
  }
  return { kind: "other" };
}

class StepFailure extends Error {
  constructor(
    readonly step: string,
    cause: string,
  ) {
    super(cause);
  }
}

const firstLine = (s: string): string => s.trim().split(/\r?\n/).find((l) => l.trim() !== "")?.trim() ?? "";

const CAUSE_MAX = 300;
/** The first line naming an error (stdout first: tsc writes its errors there, and npm's own "npm error" lines go to
 *  stderr), joined to the next line when it ends with ":" (git names the blocking file there). Else the first line. */
function errorLine(s: string): string {
  const ls = s.split(/\r?\n/).map((l) => l.trim());
  const i = ls.findIndex((l) => /\berror\b/i.test(l));
  if (i < 0) return "";
  const next = ls.slice(i + 1).find((l) => l !== "");
  return ls[i]!.endsWith(":") && next !== undefined ? `${ls[i]} ${next}` : ls[i]!;
}
export function runCause(r: Run): string {
  const c = r.error ?? (errorLine(r.stdout) || errorLine(r.stderr) || firstLine(r.stderr) || firstLine(r.stdout) || `exit ${r.status}`);
  return c.length > CAUSE_MAX ? `${c.slice(0, CAUSE_MAX - 1)}…` : c;
}

/** V2's child: import the new server.js, then construct a Database through the build's own dependency (better-sqlite3
 *  loads its native binding in the constructor, not on import; T-172 r3, F2). */
export function v2Args(serverUrl: string): string[] {
  const u = JSON.stringify(serverUrl);
  return ["--input-type=module", "-e", `import ${u}; import { createRequire } from "node:module"; const Database = createRequire(${u})("better-sqlite3"); new Database(":memory:").close();`];
}

/** `<built7>-<UTC>`, sortable by its time part. */
const utcStamp = (d: Date): string => d.toISOString().replace(/[-:]/g, "").replace(".", "");
const backupTime = (name: string): string => name.slice(name.indexOf("-") + 1);

function betterSqliteVersion(lockText: string | null): string | null {
  if (lockText === null) return null;
  try {
    const lock = JSON.parse(lockText) as { packages?: Record<string, { version?: unknown }>; dependencies?: Record<string, { version?: unknown }> };
    const v = lock.packages?.["node_modules/better-sqlite3"]?.version ?? lock.dependencies?.["better-sqlite3"]?.version;
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

interface LiveSession {
  pid: number;
  sessionId: string;
  project: string;
}

/** Proofs whose recorded start time equals the process's own: the MCP server's test of a live, not reused, pid. */
function liveSessions(proofDir: string, deps: MainRebuildDeps): { sessions: LiveSession[]; tableNote: string | null } {
  const sessions: LiveSession[] = [];
  let names: string[] = [];
  try {
    names = existsSync(proofDir) ? readdirSync(proofDir).filter((n) => /^\d+\.json$/.test(n)) : [];
  } catch {
    names = [];
  }
  const table = deps.processTable();
  const runsServer = (pid: number): boolean => {
    if (table === null) return true;
    const seen = new Set<number>();
    const walk = (p: number): boolean => {
      for (const row of table.values()) {
        if (row.ppid !== p || seen.has(row.pid)) continue;
        seen.add(row.pid);
        if (/open-brain/i.test(row.commandLine) && /server\.js/i.test(row.commandLine)) return true;
        if (walk(row.pid)) return true;
      }
      return false;
    };
    return walk(pid);
  };
  for (const n of names) {
    let proof: { session_id?: unknown; claude_pid?: unknown; proc_start?: unknown; transcript_path?: unknown };
    try {
      proof = JSON.parse(readFileSync(join(proofDir, n), "utf8"));
    } catch {
      continue;
    }
    if (typeof proof.claude_pid !== "number" || typeof proof.session_id !== "string" || typeof proof.proc_start !== "string") continue;
    if (Number(n.slice(0, -".json".length)) !== proof.claude_pid) continue;
    const start = deps.startTimeOf(proof.claude_pid);
    if (start === null || start !== proof.proc_start) continue;
    if (!runsServer(proof.claude_pid)) continue;
    const project = typeof proof.transcript_path === "string" && proof.transcript_path !== "" ? basename(dirname(proof.transcript_path)) : "(project unknown)";
    sessions.push({ pid: proof.claude_pid, sessionId: proof.session_id, project });
  }
  sessions.sort((a, b) => a.pid - b.pid);
  return { sessions, tableNote: table === null ? "(the process table could not be read, so every live proof is listed)" : null };
}

export async function mainRebuild(tree: string, opts: MainRebuildOptions, deps: MainRebuildDeps): Promise<MainRebuildResult> {
  const lines: string[] = [];
  const refuse = (reason: string, exitCode = 1): MainRebuildResult => {
    lines.push(`main-rebuild REFUSED: ${reason}`, "Nothing was changed.");
    return { exitCode, lines };
  };
  const git = (args: string[]): Run => deps.git(args, tree);
  // F1 (T-172 r3): npm 10.9.8 strips the "libc" fields newer npm writes, so any install dirties the tracked lock.
  const MANIFESTS = ["open-brain/package.json", "open-brain/package-lock.json"];
  const cleanManifests = (): Run => git(["checkout", "-q", "--", ...MANIFESTS]);
  const gitText = (args: string[]): string | null => {
    const r = git(args);
    return r.status === 0 && !r.error ? r.stdout.trim() : null;
  };
  const isAncestor = (a: string, b: string): boolean => git(["merge-base", "--is-ancestor", a, b]).status === 0;

  const positionals = opts.positionals ?? [];
  if (positionals.length > 1) {
    return refuse(`takes at most one <sha>, got ${positionals.map((p) => `"${p}"`).join(", ")}.`, 2);
  }
  const target = positionals[0];
  if (target !== undefined && target.startsWith("-")) return refuse(`"${target}" is not a commit: a <sha> never starts with "-".`, 2);
  const label7 = (s: string | undefined): string => (s === undefined ? SERVING_UPSTREAM : /^[0-9a-f]{40}$/i.test(s) ? s.slice(0, 7) : s);

  // 1. Only the main checkout's build serves.
  const main = isMainCheckout(tree);
  if (main === null) return refuse(`git cannot tell whether ${tree} is the main checkout.`);
  if (!main) {
    const common = gitText(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
    const mainPath = common === null ? "unknown" : dirname(common);
    return refuse(
      `${tree} is a linked worktree, not the main checkout (${mainPath}): only the main checkout's open-brain/build serves the hooks and MCP servers.`,
    );
  }

  // 2. A clean tree, untracked files included.
  const status = git(["status", "--porcelain=v1", "--untracked-files=all"]);
  if (status.status !== 0) return refuse(`git status failed (${runCause(status)}).`);
  const dirty = status.stdout.split(/\r?\n/).filter((l) => l.trim() !== "").map((l) => l.slice(3));
  if (dirty.length > 0) {
    return refuse(
      `the working tree is not clean, so the build would be stamped ${label7(target)} while carrying changes that are not in it: ${dirty.join(", ")}`,
    );
  }

  // 2b. A flag that hides a tracked file's changes from git status (T-172 r3, F4).
  const flags = git(["ls-files", "-v"]);
  if (flags.status !== 0 || flags.error) return refuse(`git ls-files failed (${runCause(flags)}).`);
  const hidden = flags.stdout
    .split(/\r?\n/)
    .filter((l) => /^(S|[a-z]) /.test(l))
    .map((l) => `${l.slice(2)} (${l[0] === "S" ? "skip-worktree" : l[0] === "s" ? "skip-worktree, assume-unchanged" : "assume-unchanged"})`);
  if (hidden.length > 0) {
    return refuse(
      `git hides changes to ${hidden.length} tracked file(s), so the build could be stamped ${label7(target)} while carrying changes that are not in it: ${hidden.join(", ")}. Clear the flag with git update-index --no-skip-worktree or --no-assume-unchanged.`,
    );
  }

  // 3. Nothing HEAD carries may be stranded by the checkout.
  const oldHead = gitText(["rev-parse", "HEAD"]);
  if (oldHead === null) return refuse("git cannot read HEAD.");
  const aheadText = gitText(["rev-list", "--count", `${SERVING_UPSTREAM}..HEAD`]);
  if (aheadText === null) return refuse(`git cannot count HEAD's commits against ${SERVING_UPSTREAM}.`);
  const ahead = Number.parseInt(aheadText, 10);
  if (ahead > 0) {
    return refuse(
      `HEAD carries ${ahead} commit(s) that ${SERVING_UPSTREAM} does not have: checking out ${label7(target)} would leave them reachable only through the reflog.`,
    );
  }

  // 4. A fresh reference, unless told to use the last one.
  let fetchTime: string;
  if (opts.noFetch) {
    fetchTime = readLastFetchAt(tree) ?? "an unknown time";
  } else {
    const f = fetchOrigin(tree);
    if (!f.ok) {
      return refuse(
        `git fetch origin failed (${f.cause}): refusing to compare against a reference that may be stale. --no-fetch uses the last fetch (${readLastFetchAt(tree) ?? "an unknown time"}).`,
      );
    }
    fetchTime = f.at;
  }

  // 5. Only merged code.
  const sha = gitText(["rev-parse", "--verify", "--quiet", `${target ?? SERVING_UPSTREAM}^{commit}`]);
  if (sha === null || !isAncestor(sha, SERVING_UPSTREAM)) {
    return refuse(`${sha === null ? label7(target) : sha.slice(0, 7)} is not on ${SERVING_UPSTREAM} (fetch ${fetchTime}): only merged code may serve every session.`);
  }
  const sha7 = sha.slice(0, 7);

  // 6. Against the BUILD STAMP, never HEAD: the build is what serves.
  const ob = join(tree, "open-brain");
  const build = join(ob, "build");
  const built = readStampedCommit(build);
  if (built === null) return refuse(`the serving build carries no stamp, so ${sha7} cannot be shown to be ahead of it.`);
  const built7 = built.slice(0, 7);
  if (built === sha) return refuse(`the serving build is already ${sha7}: nothing to do.`, 0);
  if (!isAncestor(built, sha)) return refuse(`${sha7} is not ahead of the serving build ${built7}: this would roll every session back.`);

  // 7. A native-module change cannot be installed under running servers.
  const lockAt = (rev: string): string | null => {
    const r = git(["show", `${rev}:open-brain/package-lock.json`]);
    return r.status === 0 ? r.stdout : null;
  };
  const sqliteBefore = betterSqliteVersion(lockAt(built));
  const sqliteAfter = betterSqliteVersion(lockAt(sha));
  if (sqliteBefore !== sqliteAfter) {
    return refuse(
      `open-brain/package-lock.json changes better-sqlite3 (${sqliteBefore ?? "absent"} -> ${sqliteAfter ?? "absent"}); every running open-brain server holds its native module and Windows will not replace it. Close every session first. Ask Aaron.`,
    );
  }

  // 8. npm.
  const npm = deps.npm;
  if (npm === null) return refuse("npm could not be located (set npm_execpath).");

  // The plan.
  const manifest = git(["diff", "--quiet", built, sha, "--", "open-brain/package.json", "open-brain/package-lock.json"]);
  if (manifest.status !== 0 && manifest.status !== 1) return refuse(`git cannot compare the manifests of ${built7} and ${sha7} (${runCause(manifest)}).`);
  const install = manifest.status === 1;
  const common = gitText(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  if (common === null) return refuse("git cannot name the common git directory for the backup.");
  const commonDir = isAbsolute(common) ? common : join(tree, common);
  const backupRoot = join(commonDir, BACKUPS_DIR);
  const backup = join(backupRoot, `${built7}-${utcStamp(deps.now())}`);
  const oldBranch = gitText(["symbolic-ref", "-q", "--short", "HEAD"]);

  if (opts.dryRun) {
    lines.push(
      `main-rebuild --dry-run: serving build ${built7} -> ${sha7} (fetch ${fetchTime}). Nothing was changed. It WOULD:`,
      `  1. back up open-brain/build to ${backup} (keeping the newest ${BACKUPS_KEPT})`,
      `  2. git checkout --detach ${sha}`,
      `  3. npm install: ${install ? "yes (open-brain/package.json or package-lock.json changes)" : "no (the manifests do not change)"}`,
      `  4. npm run build, then verify the stamp, import server.js, and classify the serving-build line`,
    );
    return { exitCode: 0, lines };
  }

  // Step 1: the backup, outside the work tree.
  try {
    mkdirSync(backupRoot, { recursive: true });
    cpSync(build, backup, { recursive: true });
  } catch (err) {
    rmSync(backup, { recursive: true, force: true });
    return refuse(`the backup of open-brain/build to ${backup} failed (${err instanceof Error ? err.message : String(err)}).`);
  }
  lines.push(`Backed up open-brain/build (stamp ${built7}) to ${backup}`);
  try {
    const old = readdirSync(backupRoot)
      .filter((n) => n !== basename(backup) && BACKUP_NAME.test(n))
      .sort((a, b) => backupTime(b).localeCompare(backupTime(a)));
    for (const n of old.slice(BACKUPS_KEPT - 1)) rmSync(join(backupRoot, n), { recursive: true, force: true });
  } catch {
    /* pruning is housekeeping: a failure leaves an extra backup, never a broken build */
  }

  let installed = false;
  let verdict: ServingClass;
  try {
    // Step 2.
    const co = git(["checkout", "-q", "--detach", sha]);
    if (co.status !== 0 || co.error) throw new StepFailure("checkout", runCause(co));
    // Step 3: install, never ci. A running server holds better_sqlite3.node, which ci would delete.
    if (install) {
      installed = true;
      const r = npm(["install"], ob);
      const c = cleanManifests();
      if (r.status !== 0 || r.error) throw new StepFailure("npm install", runCause(r));
      if (c.status !== 0 || c.error) throw new StepFailure("npm install", `could not put back the tracked manifests: ${runCause(c)}`);
    }
    // Step 4.
    const b = npm(["run", "build"], ob);
    if (b.status !== 0 || b.error) throw new StepFailure("npm run build", runCause(b));
    // V1: the stamp, read back from disk. A build that exits 0 over the old stamp did not build this commit.
    const stamped = readStampedCommit(build);
    if (stamped !== sha) throw new StepFailure("V1 (stamp)", `build-info.json says ${stamped === null ? "no commit" : stamped.slice(0, 7)}, not ${sha7}`);
    // V2: a fresh process imports the server AND opens an in-memory database: the binding loads in the constructor.
    const serverUrl = pathToFileURL(join(build, "server.js")).href;
    const v2 = deps.node(v2Args(serverUrl), ob);
    if (v2.status !== 0 || v2.error) throw new StepFailure("V2 (import server.js, open a database)", runCause(v2));
    // V3: a fresh process runs the NEW build's serving-build line.
    const sbUrl = pathToFileURL(join(build, "pipelines", "session-start", "serving-build.js")).href;
    const v3 = deps.node(
      ["--input-type=module", "-e", `import { describeServingBuild } from ${JSON.stringify(sbUrl)}; console.log(describeServingBuild());`],
      ob,
    );
    if (v3.status !== 0 || v3.error) throw new StepFailure("V3 (serving build)", runCause(v3));
    const line = firstLine(v3.stdout);
    verdict = classifyServingLine(line, sha7);
    if (verdict.kind === "other") throw new StepFailure("V3 (serving build)", `the serving-build line is not current: ${line || "(empty)"}`);
  } catch (err) {
    const step = err instanceof StepFailure ? err.step : "rebuild";
    const why = err instanceof Error ? err.message : String(err);
    lines.push(`main-rebuild FAILED at ${step}: ${why}`);
    // The restore, in order: HEAD, build/, install, then the stamp read back.
    try {
      const c0 = cleanManifests();
      if (c0.status !== 0 || c0.error) throw new Error(`git checkout -- open-brain/package*.json: ${runCause(c0)}`);
      const back = git(oldBranch !== null ? ["checkout", "-q", oldBranch] : ["checkout", "-q", "--detach", oldHead]);
      if (back.status !== 0 || back.error) throw new Error(`git checkout ${oldBranch ?? oldHead.slice(0, 7)}: ${runCause(back)}`);
      if (gitText(["rev-parse", "HEAD"]) !== oldHead) throw new Error(`HEAD is not ${oldHead.slice(0, 7)} after the checkout`);
      rmSync(build, { recursive: true, force: true });
      cpSync(backup, build, { recursive: true });
      if (installed) {
        const r = npm(["install"], ob);
        if (r.status !== 0 || r.error) throw new Error(`npm install: ${runCause(r)}`);
        const c1 = cleanManifests();
        if (c1.status !== 0 || c1.error) throw new Error(`git checkout -- open-brain/package*.json: ${runCause(c1)}`);
      }
      const back7 = readStampedCommit(build);
      if (back7 !== built) throw new Error(`the restored stamp is ${back7 === null ? "missing" : back7.slice(0, 7)}, not ${built7}`);
    } catch (restoreErr) {
      lines.push(
        `RESTORE FAILED: ${restoreErr instanceof Error ? restoreErr.message : String(restoreErr)}. Hooks and new MCP servers in EVERY session will fail. By hand: git checkout -- open-brain/package.json open-brain/package-lock.json; git checkout ${oldBranch ?? `--detach ${oldHead}`}; copy ${backup} to open-brain/build. Tell Aaron.`,
      );
      return { exitCode: 4, lines };
    }
    lines.push(`RESTORED: HEAD ${oldHead.slice(0, 7)}, open-brain/build is the backup (stamp ${built7}).`);
    return { exitCode: 3, lines };
  }

  if (verdict.kind === "stale" && target !== undefined) {
    lines.push(`REBUILT: serving build ${sha7} as asked · ${verdict.codeCommits} code commit(s) behind ${SERVING_UPSTREAM} (fetch ${fetchTime}).`);
  } else if (verdict.kind === "stale") {
    lines.push(`REBUILT ${sha7}, but ${SERVING_UPSTREAM} now has ${verdict.codeCommits} code commits past it: run main-rebuild again.`);
  } else {
    lines.push(`REBUILT: serving build ${sha7} · current (fetch ${fetchTime}).`);
  }

  // Every session's server loaded the OLD build and keeps it until it reconnects.
  const { sessions, tableNote } = liveSessions(opts.proofDir ?? byPidDir(resolvePaths(tree).activeSession), deps);
  if (sessions.length === 0) {
    lines.push("RECONNECT: no live session found");
  } else {
    lines.push(
      `RECONNECT: ${sessions.length} live ${sessions.length === 1 ? "session runs" : "sessions run"} an open-brain server started before this build; in EACH run /mcp reconnect open-brain:`,
    );
    for (const s of sessions) lines.push(`  pid ${s.pid}  session ${s.sessionId.slice(0, 8)}  ${s.project}`);
  }
  if (tableNote !== null) lines.push(tableNote);
  lines.push("Sessions with no proof are not listed; their greeting says STALE PROCESS until they reconnect.");
  return { exitCode: verdict.kind === "stale" && target === undefined ? 5 : 0, lines };
}
