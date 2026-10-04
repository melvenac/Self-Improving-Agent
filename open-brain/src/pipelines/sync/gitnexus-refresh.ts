import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult } from "./types.js";

/**
 * T-187 / D-049. Plain `/sync` rebuilds a stale GitNexus index, then reads
 * `lastCommit` back and requires it to equal HEAD. `sync --check` never spawns.
 *
 * The command is the one T-055 measured (incremental analyze, `--index-only`,
 * `--skip-skills`) plus `--no-stats`. `gitnexus clean` is refused (G-043: it
 * deletes nothing without `--force`, and `/sync` must not run it).
 *
 * FTS row (atlas, on the T-055 measure): analyze can exit 0 while BM25 is
 * disabled. On Windows that is Git's `mingw64\bin` missing from PATH, and
 * `analyze --repair-fts` then exits 1. A no-FTS index is an issue, never a pass.
 * Version pin `gitnexus@1.6.12` is the CLI the measure actually ran; gitnexus
 * was not on PATH.
 */

export const GITNEXUS_ANALYZE_ARGS = ["analyze", "--index-only", "--skip-skills", "--no-stats"] as const;
export const GITNEXUS_REPAIR_FTS_ARGS = ["analyze", "--repair-fts"] as const;

const CHECK = "gitnexus-index";

export interface GitNexusRunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Tests inject this. Production uses {@link defaultGitNexusRunner}. */
export type GitNexusRunner = (args: readonly string[], cwd: string) => GitNexusRunResult;

export interface GitNexusCheckOptions {
  /**
   * `true` for `sync --check`: report only. `false` for plain `/sync`: rebuild
   * when `lastCommit` is not HEAD. Omitted means the historical read-only
   * inspect (session start), which never reaches this module.
   */
  checkOnly: boolean;
  run?: GitNexusRunner;
}

interface MetaFields {
  lastCommit?: string;
  ftsProfile?: unknown;
}

function issue(message: string): CheckResult {
  return { name: CHECK, severity: "issue", message, report: true };
}

function readMeta(projectRoot: string): MetaFields | "missing" | "unreadable" {
  const metaPath = join(projectRoot, ".gitnexus", "meta.json");
  if (!existsSync(metaPath)) return "missing";
  try {
    const parsed = JSON.parse(readFileSync(metaPath, "utf8")) as { lastCommit?: unknown; ftsProfile?: unknown };
    if (parsed === null || typeof parsed !== "object") return "unreadable";
    return {
      lastCommit: typeof parsed.lastCommit === "string" ? parsed.lastCommit : undefined,
      ftsProfile: parsed.ftsProfile,
    };
  } catch {
    return "unreadable";
  }
}

function gitCommit(cwd: string, ref: string): string | null {
  try {
    return execFileSync("git", ["rev-parse", "--verify", `${ref}^{commit}`], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function capture(command: string, argv: readonly string[], cwd: string, shell: boolean): GitNexusRunResult {
  const result = spawnSync(command, argv, {
    cwd,
    encoding: "utf8",
    shell,
    windowsHide: true,
  });
  const stdout = typeof result.stdout === "string" ? result.stdout : "";
  const stderr = typeof result.stderr === "string" ? result.stderr : "";
  const extra = result.error ? result.error.message : "";
  return { code: typeof result.status === "number" ? result.status : 1, stdout, stderr: `${stderr}${extra}` };
}

export function defaultGitNexusRunner(args: readonly string[], cwd: string): GitNexusRunResult {
  if (args.includes("clean")) {
    return { code: 1, stdout: "", stderr: "refusing gitnexus clean" };
  }
  const runCjs = join(cwd, ".gitnexus", "run.cjs");
  if (existsSync(runCjs)) {
    return capture(process.execPath, [runCjs, ...args], cwd, false);
  }
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  return capture(command, ["--yes", "gitnexus@1.6.12", ...args], cwd, process.platform === "win32");
}

function named(last: string, head: string): string {
  return `lastCommit ${last}, HEAD ${head}`;
}

/**
 * Read-only FTS gate, or the repair-fts probe when this is a plain `/sync`.
 * Returns an issue, or null when this index may pass.
 */
function ftsBlock(projectRoot: string, checkOnly: boolean, run: GitNexusRunner): CheckResult | null {
  const meta = readMeta(projectRoot);
  const head = gitCommit(projectRoot, "HEAD") ?? "unknown";
  const last = meta !== "missing" && meta !== "unreadable" && meta.lastCommit ? meta.lastCommit : "missing";

  if (!checkOnly) {
    const probed = run(GITNEXUS_REPAIR_FTS_ARGS, projectRoot);
    if (probed.code !== 0) {
      return issue(
        `FTS unavailable: gitnexus analyze --repair-fts exited ${probed.code} — not a pass. ${named(last, head)}`,
      );
    }
    const again = readMeta(projectRoot);
    const profile = again !== "missing" && again !== "unreadable" ? again.ftsProfile : undefined;
    if (profile !== undefined && profile !== "full") {
      return issue(
        `FTS unavailable: ftsProfile is ${JSON.stringify(profile)} — not a pass. ${named(last, head)}`,
      );
    }
    return null;
  }

  const profile = meta !== "missing" && meta !== "unreadable" ? meta.ftsProfile : undefined;
  if (profile !== "full") {
    const shown = profile === undefined ? "missing" : JSON.stringify(profile);
    return issue(`FTS unavailable: ftsProfile is ${shown} — not a pass. ${named(last, head)}`);
  }
  return null;
}

type Rebuild = { kind: "skip" } | { kind: "issue"; result: CheckResult } | { kind: "moved"; before: string; after: string; head: string };

function rebuildIfStale(projectRoot: string, run: GitNexusRunner): Rebuild {
  const meta = readMeta(projectRoot);
  if (meta === "missing" || meta === "unreadable" || !meta.lastCommit) return { kind: "skip" };
  const head = gitCommit(projectRoot, "HEAD");
  if (head === null) return { kind: "skip" };
  const before = meta.lastCommit;
  const beforeResolved = gitCommit(projectRoot, before);
  if (beforeResolved !== null && beforeResolved === head) return { kind: "skip" };

  const result = run(GITNEXUS_ANALYZE_ARGS, projectRoot);
  const afterMeta = readMeta(projectRoot);
  const after =
    afterMeta !== "missing" && afterMeta !== "unreadable" && afterMeta.lastCommit ? afterMeta.lastCommit : before;

  if (result.code !== 0) {
    return { kind: "issue", result: issue(`gitnexus analyze exited ${result.code}; lastCommit ${before}; HEAD ${head}`) };
  }
  const afterResolved = gitCommit(projectRoot, after);
  if (afterResolved !== head) {
    const why = after === before ? "lastCommit did not move" : "lastCommit is not HEAD";
    return {
      kind: "issue",
      result: issue(`gitnexus analyze read back lastCommit ${after}; HEAD is ${head}; ${why}`),
    };
  }
  return { kind: "moved", before, after, head };
}

export function settleGitNexusIndex(
  projectRoot: string,
  options: GitNexusCheckOptions,
  inspect: (projectRoot: string) => CheckResult,
): CheckResult {
  const checkOnly = options.checkOnly !== false;
  const run = options.run ?? defaultGitNexusRunner;

  if (!checkOnly) {
    const rebuilt = rebuildIfStale(projectRoot, run);
    if (rebuilt.kind === "issue") return rebuilt.result;
    if (rebuilt.kind === "moved") {
      const inspected = inspect(projectRoot);
      if (inspected.severity !== "pass") {
        return issue(
          `index rebuild read lastCommit ${rebuilt.after} against HEAD ${rebuilt.head}, but the freshness check did not pass: ${inspected.message}`,
        );
      }
      const fts = ftsBlock(projectRoot, false, run);
      if (fts) return fts;
      return {
        name: CHECK,
        severity: "pass",
        message: `index rebuilt: lastCommit was ${rebuilt.before}, now ${rebuilt.after}, HEAD ${rebuilt.head}. ${inspected.message}`,
        report: true,
      };
    }
  }

  const inspected = inspect(projectRoot);
  if (inspected.severity !== "pass") return inspected;
  const fts = ftsBlock(projectRoot, checkOnly, run);
  return fts ?? inspected;
}
