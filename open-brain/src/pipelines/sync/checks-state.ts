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

export const CI_STATUS_JOB = "test";
export const CI_NEVER_STARTED_PREFIX = "The job was not started because";
/** Stated in every ci-status message so a reader knows what was and was not inspected. */
export const CI_STATUS_LIMIT =
  "limit: job `test` only; check-run annotations fetched only when that job has zero steps";

export type CiRunRow = { conclusion?: string; headSha?: string; status?: string; databaseId?: number };
export type CiJobRow = { name: string; conclusion?: string; steps?: unknown[]; databaseId?: number };
export type CiAnnotationRow = { message?: string };

export type CiInspectState = {
  testJob?: CiJobRow;
  annotations?: CiAnnotationRow[] | null;
  viewOk?: boolean;
  viewParseOk?: boolean;
  annFetchOk?: boolean;
  annParseOk?: boolean;
};

/**
 * Classifies a run's conclusion for ci-status. "never started" is separate from
 * failure: GitHub reports conclusion `failure` with zero steps when billing blocks
 * the runner, and an annotation beginning CI_NEVER_STARTED_PREFIX.
 * When the inspect chain breaks, names the case instead of reporting plain failure.
 */
export function classifyCiConclusion(run: CiRunRow, inspect: CiInspectState = {}): string {
  const { testJob, annotations = null, viewOk, viewParseOk, annFetchOk, annParseOk } = inspect;
  const runConclusion = run.conclusion ?? "";
  if (runConclusion === "success") return "success";
  if (run.status && run.status !== "completed") {
    return runConclusion || `pending (${run.status})`;
  }
  if (runConclusion !== "failure") {
    return runConclusion || (run.status ? `pending (${run.status})` : "unknown");
  }

  const plain = (detail: string) => `failure (${detail})`;

  if (viewOk === false) return plain("run view failed; cannot inspect job test");
  if (viewParseOk === false) return plain("run view not JSON; cannot inspect job test");
  if (viewOk === true && viewParseOk === true && !testJob) {
    return plain("job test absent in run view");
  }
  if (testJob && (testJob.steps ?? []).length === 0) {
    if (annFetchOk === false) return plain("zero steps on job test; annotations fetch failed");
    if (annParseOk === false) return plain("zero steps on job test; annotations not JSON");
    const neverStarted = (annotations ?? []).some(
      (a) => typeof a.message === "string" && a.message.startsWith(CI_NEVER_STARTED_PREFIX),
    );
    if (neverStarted) return "never started";
    if (annFetchOk === true && annParseOk === true) {
      return plain("zero steps on job test; no never-started annotation prefix");
    }
  }
  return runConclusion;
}

/**
 * R4 — the last CI run on master, via `gh run list`. Pass on success, warn on
 * anything else naming the sha, skip with the reason when `gh` is absent, not
 * authenticated, or cannot see a repository. The conclusion is in every
 * message, because absent is not green.
 *
 * T-192: a job that never started (zero steps on `test`, annotation prefix above)
 * is reported as `never started`, not folded into `failure`.
 */
export function checkCiStatus(projectRoot: string, run: CommandRunner = execRunner, branch = "master"): CheckResult {
  const name = "ci-status";
  const r = run("gh", ["run", "list", "--branch", branch, "--limit", "1", "--json", "conclusion,headSha,status,databaseId"], projectRoot);
  if (!r.ok) {
    const why = /ENOENT|not found/i.test(r.error) ? "gh is not installed"
      : /auth|login|token|HTTP 401/i.test(r.error) ? "gh is not authenticated"
      : `gh failed: ${r.error.split("\n")[0]}`;
    return { name, report: true, severity: "skip", message: `skipped — ${why}; conclusion: unknown (absent is not green); ${CI_STATUS_LIMIT}` };
  }
  let runs: CiRunRow[];
  try {
    runs = JSON.parse(r.stdout);
  } catch {
    return { name, report: true, severity: "skip", message: `skipped — gh returned non-JSON; conclusion: unknown; ${CI_STATUS_LIMIT}` };
  }
  if (!Array.isArray(runs) || runs.length === 0) {
    return { name, report: true, severity: "warn", message: `no CI runs found on ${branch}; conclusion: none; ${CI_STATUS_LIMIT}` };
  }
  const latest = runs[0];
  const sha = (latest.headSha ?? "unknown").slice(0, 7);

  const inspect: CiInspectState = {};
  if (latest.conclusion === "failure" && latest.databaseId != null) {
    const view = run("gh", ["run", "view", String(latest.databaseId), "--json", "jobs"], projectRoot);
    inspect.viewOk = view.ok;
    if (view.ok) {
      try {
        const body = JSON.parse(view.stdout) as { jobs?: CiJobRow[] };
        inspect.viewParseOk = true;
        inspect.testJob = (body.jobs ?? []).find((j) => j.name === CI_STATUS_JOB);
        if (inspect.testJob && (inspect.testJob.steps ?? []).length === 0 && inspect.testJob.databaseId != null) {
          const ann = run("gh", ["api", `repos/{owner}/{repo}/check-runs/${inspect.testJob.databaseId}/annotations`], projectRoot);
          inspect.annFetchOk = ann.ok;
          if (ann.ok) {
            try {
              inspect.annotations = JSON.parse(ann.stdout) as CiAnnotationRow[];
              inspect.annParseOk = true;
            } catch {
              inspect.annParseOk = false;
            }
          }
        }
      } catch {
        inspect.viewParseOk = false;
      }
    }
  }

  const conclusion = classifyCiConclusion(latest, inspect);
  if (conclusion === "success") {
    return { name, report: true, severity: "pass", message: `${branch} ${sha} conclusion: success; ${CI_STATUS_LIMIT}` };
  }
  return { name, report: true, severity: "warn", message: `${branch} ${sha} conclusion: ${conclusion}; ${CI_STATUS_LIMIT}` };
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
