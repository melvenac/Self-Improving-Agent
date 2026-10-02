/**
 * Loop 4 sync checks (R3, R4, R6, R7): the ones that read `.agents/state.json`
 * and its rendered views, ask GitHub for the CI conclusion, and scan the
 * tracked tree for conflict markers.
 *
 * Every check here prints its number unconditionally (a conclusion, a
 * revision, a marker count): absent is not green, and a gate that cannot see
 * the file it protects is not a gate (bb68600 shipped conflict markers in
 * CHANGELOG.md with CI green because nothing reads that file).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import type { CheckResult } from "./types.js";
import { parseState, lastSession, type State } from "../../shared/state-schema.js";
import { applyStateOps } from "../../shared/state-writer.js";

const STATE_REL = ".agents/state.json";

/** The four generated views and the header the renderers stamp on them. */
export const VIEW_FILES = [
  ".agents/TASKS/INBOX.md",
  ".agents/TASKS/task.md",
  ".agents/SESSIONS/next-session.md",
  ".agents/SYSTEM/SUMMARY.md",
] as const;

const HEADER_RE = /<!-- generated from \.agents\/state\.json rev (\d+) by open-brain v([^\s]+) — do not edit; change state via ob_state -->/;

export interface ViewHeader {
  rel: string;
  present: boolean;
  rev: number | null;
  version: string | null;
}

/** Reads the generated header of each view; `rev`/`version` are null when the header is missing. */
export function readViewHeaders(projectRoot: string): ViewHeader[] {
  return VIEW_FILES.map((rel) => {
    const p = join(projectRoot, rel);
    if (!existsSync(p)) return { rel, present: false, rev: null, version: null };
    const m = readFileSync(p, "utf-8").match(HEADER_RE);
    return { rel, present: true, rev: m ? parseInt(m[1], 10) : null, version: m ? m[2] : null };
  });
}

type StateRead = { kind: "absent" } | { kind: "invalid"; error: string } | { kind: "valid"; state: State };

function readState(projectRoot: string): StateRead {
  const p = join(projectRoot, STATE_REL);
  if (!existsSync(p)) return { kind: "absent" };
  const parsed = parseState(readFileSync(p, "utf-8"));
  return parsed.ok ? { kind: "valid", state: parsed.data } : { kind: "invalid", error: parsed.error };
}

/**
 * R3 — the state.json half of `summary-version`. Called by checkSummary when
 * the file is present; the prose fixer (version string in SUMMARY.md) runs
 * only when it is absent. Stale here means a view header whose `rev` is not
 * state.json's revision or whose version is not package.json's. The fix is a
 * re-render through the shared renderers (ob_state with an empty batch),
 * never a prose line: this check is where SUMMARY.md grew 5,340 → 5,687
 * words in one day, and it stops here.
 */
export function checkSummaryFromState(version: string, projectRoot: string, checkOnly: boolean): CheckResult {
  const name = "summary-version";
  const read = readState(projectRoot);
  if (read.kind === "absent") throw new Error("checkSummaryFromState called without state.json — caller must route absent to the prose check");
  if (read.kind === "invalid") {
    return { name, severity: "skip", message: `skipped — ${STATE_REL} invalid at ${read.error} (see state-schema); not touching SUMMARY.md` };
  }
  const state = read.state;
  // Loop 8 R3 / ADR-027: the project.version comparison is gone with the field.
  // The views still carry a version header and it is still checked below — but
  // it is checked against package.json, which is the only place that value now
  // lives.
  const stale = readViewHeaders(projectRoot).filter((h) => !h.present || h.rev !== state.revision || h.version !== version);
  if (stale.length === 0) {
    return { name, severity: "pass", message: `views carry rev ${state.revision} / v${version} — nothing to insert` };
  }
  const named = stale.map((h) => `${h.rel} (${!h.present ? "missing" : `rev ${h.rev ?? "none"}, v${h.version ?? "none"}`})`).join(", ");
  if (checkOnly) {
    return { name, severity: "issue", message: `views stale vs rev ${state.revision} / v${version}: ${named} — run sync without --check to re-render` };
  }
  const r = applyStateOps(projectRoot, { session: lastSession(state)?.n ?? 0, expected_revision: state.revision, ops: [], render: true, version });
  if (!r.ok) {
    return { name, severity: "issue", message: `re-render refused: ${r.error}` };
  }
  return {
    name,
    severity: "fixed",
    autoFixed: true,
    message: `re-rendered ${r.rendered.length} views at rev ${r.revision_after} / v${version} (revision unchanged; was stale: ${named})`,
  };
}

/**
 * R6 — every view must carry the generated header with state.json's revision.
 * A warning, not an issue: a stale view is wrong information, not a broken
 * build, and R3's fixer is the remedy.
 */
export function checkStateViews(projectRoot: string): CheckResult {
  const name = "state-views";
  const read = readState(projectRoot);
  if (read.kind === "absent") {
    return { name, severity: "skip", message: `skipped — no ${STATE_REL} (views are prose, not generated)` };
  }
  if (read.kind === "invalid") {
    return { name, severity: "skip", message: `skipped — ${STATE_REL} invalid at ${read.error} (see state-schema)` };
  }
  const rev = read.state.revision;
  const headers = readViewHeaders(projectRoot);
  const stale = headers.filter((h) => !h.present || h.rev !== rev);
  if (stale.length === 0) {
    return { name, severity: "pass", message: `all ${headers.length} views carry rev ${rev}` };
  }
  const named = stale.map((h) => `${h.rel} (${!h.present ? "missing" : h.rev === null ? "no generated header" : `rev ${h.rev}`})`).join(", ");
  return { name, severity: "warn", message: `views stale — re-render: state.json is rev ${rev}; ${named}` };
}

export type CommandResult = { ok: true; stdout: string } | { ok: false; error: string };
export type CommandRunner = (cmd: string, args: string[], cwd: string) => CommandResult;

export const execRunner: CommandRunner = (cmd, args, cwd) => {
  try {
    const stdout = execFileSync(cmd, args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], timeout: 15000 });
    return { ok: true, stdout };
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
    const detail = (e.stderr && String(e.stderr).trim()) || e.message || String(err);
    return { ok: false, error: e.code === "ENOENT" ? `${cmd} not found (ENOENT)` : detail };
  }
};

/**
 * R4 — the last CI run on master, via `gh run list`. Pass on success, warn on
 * anything else naming the sha, skip with the reason when `gh` is absent, not
 * authenticated, or cannot see a repository. The conclusion is in every
 * message, because absent is not green.
 *
 * T-192: a failure whose `test` job recorded no steps is `never-started`, not
 * `failure`. GitHub's billing refusal looks like a failure and has no log.
 * The check reads `gh run view <id> --json jobs` and the `test` job's `steps`
 * array. It does not read the check-run annotation. A view that succeeded
 * with no job named `test` is `steps not read: job test absent in run view`.
 * A `test` job whose `steps` field is not an array (absent or null, not `[]`)
 * is `steps not read: steps field missing`. An empty array stays never-started.
 */
export function checkCiStatus(projectRoot: string, run: CommandRunner = execRunner, branch = "master"): CheckResult {
  const name = "ci-status";
  const r = run("gh", ["run", "list", "--branch", branch, "--limit", "1", "--json", "databaseId,conclusion,headSha,status"], projectRoot);
  if (!r.ok) {
    // T-188: gh prints "please run: gh auth login" when the repository's remote is not GitHub at all, and the
    // auth pattern below matches that hint. A remote that gh cannot read is not an unauthenticated gh, so the
    // remote is looked at first and named. A genuine auth failure on a GitHub origin falls through unchanged.
    if (!/ENOENT|not found/i.test(r.error) && /auth|login|token|HTTP 401/i.test(r.error)) {
      const origin = run("git", ["remote", "get-url", "origin"], projectRoot);
      const url = origin.ok ? origin.stdout.trim() : "";
      if (url !== "" && !/(^|[@/.])github.com[:/]/i.test(url)) {
        return { name, report: true, severity: "skip", message: `skipped — origin ${url} is not a GitHub remote, so gh cannot read its runs; conclusion: unknown (absent is not green)` };
      }
    }
    const why = /ENOENT|not found/i.test(r.error) ? "gh is not installed"
      : /auth|login|token|HTTP 401/i.test(r.error) ? "gh is not authenticated"
      : `gh failed: ${r.error.split("\n")[0]}`;
    return { name, report: true, severity: "skip", message: `skipped — ${why}; conclusion: unknown (absent is not green)` };
  }
  let runs: Array<{ conclusion?: string; headSha?: string; status?: string; databaseId?: number }>;
  try {
    runs = JSON.parse(r.stdout);
  } catch {
    return { name, report: true, severity: "skip", message: `skipped — gh returned non-JSON; conclusion: unknown` };
  }
  if (!Array.isArray(runs) || runs.length === 0) {
    return { name, report: true, severity: "warn", message: `no CI runs found on ${branch}; conclusion: none` };
  }
  const latest = runs[0];
  const sha = (latest.headSha ?? "unknown").slice(0, 7);
  const conclusion = latest.conclusion || (latest.status ? `pending (${latest.status})` : "unknown");
  if (conclusion === "success") {
    return { name, report: true, severity: "pass", message: `${branch} ${sha} conclusion: success` };
  }
  if (conclusion === "failure" && latest.databaseId == null) {
    return { name, report: true, severity: "warn", message: `${branch} ${sha} conclusion: failure (steps not read: no databaseId)` };
  }
  if (conclusion === "failure") {
    const view = run("gh", ["run", "view", String(latest.databaseId), "--json", "jobs"], projectRoot);
    if (!view.ok) {
      return { name, report: true, severity: "warn", message: `${branch} ${sha} conclusion: failure (steps not read: ${view.error.split("\n")[0]})` };
    }
    let body: { jobs?: Array<{ name?: string; steps?: unknown[] }> };
    try {
      body = JSON.parse(view.stdout) as { jobs?: Array<{ name?: string; steps?: unknown[] }> };
    } catch {
      return { name, report: true, severity: "warn", message: `${branch} ${sha} conclusion: failure (steps not read: unparseable job list)` };
    }
    const test = body.jobs?.find((j) => j.name === "test");
    if (!test) {
      return { name, report: true, severity: "warn", message: `${branch} ${sha} conclusion: failure (steps not read: job test absent in run view)` };
    }
    if (!Array.isArray(test.steps)) {
      return { name, report: true, severity: "warn", message: `${branch} ${sha} conclusion: failure (steps not read: steps field missing)` };
    }
    if (test.steps.length === 0) {
      return {
        name,
        report: true,
        severity: "warn",
        message: `${branch} ${sha} conclusion: never-started — job test recorded 0 steps. LIMIT: read from gh run view jobs[].steps, not the billing annotation; a failure with no steps for another reason is named never-started`,
      };
    }
  }
  return { name, report: true, severity: "warn", message: `${branch} ${sha} conclusion: ${conclusion}` };
}

const MARKER_RES = [/^<<<<<<< /, /^=======$/, /^>>>>>>> /];

/**
 * R7 — no git-tracked text file may contain a conflict-marker line. An issue,
 * not a warning: a marker in a committed file is a broken merge whatever CI
 * says. Binary files (a NUL in the first 8 KB) are skipped; the count of
 * files scanned and markers found is printed unconditionally.
 */
export function checkMergeMarkers(projectRoot: string, run: CommandRunner = execRunner): CheckResult {
  const name = "merge-markers";
  const ls = run("git", ["ls-files", "-z"], projectRoot);
  if (!ls.ok) {
    return { name, report: true, severity: "skip", message: `skipped — git ls-files failed (${ls.error.split("\n")[0]}); markers: unknown` };
  }
  const files = ls.stdout.split("\0").filter((f) => f.length > 0);
  const hits: string[] = [];
  let scanned = 0;
  let markers = 0;
  for (const rel of files) {
    const p = join(projectRoot, rel);
    if (!existsSync(p)) continue; // tracked but deleted in the working tree
    let buf: Buffer;
    try { buf = readFileSync(p); } catch { continue; }
    if (buf.subarray(0, 8192).includes(0)) continue; // binary
    scanned++;
    const lines = buf.toString("utf-8").split(/\r?\n/);
    const found: number[] = [];
    lines.forEach((line, i) => { if (MARKER_RES.some((re) => re.test(line))) found.push(i + 1); });
    if (found.length > 0) {
      markers += found.length;
      hits.push(`${rel}:${found.slice(0, 5).join(",")}${found.length > 5 ? ",…" : ""}`);
    }
  }
  if (markers === 0) {
    return { name, report: true, severity: "pass", message: `0 conflict markers in ${scanned} tracked text files` };
  }
  return { name, report: true, severity: "issue", message: `${markers} conflict marker line(s) in ${hits.length} of ${scanned} tracked text files: ${hits.join("; ")}` };
}
