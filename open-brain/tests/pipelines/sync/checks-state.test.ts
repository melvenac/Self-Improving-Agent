import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { checkSummary } from "../../../src/pipelines/sync/checks.js";
import {
  checkStateViews,
  checkCiStatus,
  checkMergeMarkers,
  readViewHeaders,
  VIEW_FILES,
  classifyCiConclusion,
  CI_STATUS_LIMIT,
  type CommandRunner,
  type CiJobRow,
} from "../../../src/pipelines/sync/checks-state.js";
import neverStartedList from "../../fixtures/ci-status/never-started-run-list.json";
import neverStartedView from "../../fixtures/ci-status/never-started-run-view.json";
import neverStartedAnn from "../../fixtures/ci-status/never-started-annotations.json";
import successList from "../../fixtures/ci-status/success-run-list.json";
import successView from "../../fixtures/ci-status/success-run-view.json";
import failureList from "../../fixtures/ci-status/failure-run-list.json";
import failureView from "../../fixtures/ci-status/failure-run-view.json";
import { applyStateOps } from "../../../src/shared/state-writer.js";
import { SUMMARY_BEGIN, SUMMARY_END } from "../../../src/pipelines/state-views/index.js";

const fixturesDir = join(import.meta.dirname, "../../fixtures");
const stateFixture = join(import.meta.dirname, "../../fixtures-state/state.json");
const STATE = ".agents/state.json";

/** Lines of SUMMARY.md outside the generated region — the prose the migration must never grow. */
function proseLines(root: string): string[] {
  const text = readFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "utf-8");
  const b = text.indexOf(SUMMARY_BEGIN);
  const e = text.indexOf(SUMMARY_END);
  const outside = b === -1 ? text : text.slice(0, b) + text.slice(e + SUMMARY_END.length);
  // Blank lines are layout (the first insertion pads the region); prose is any non-empty line.
  return outside.split(/\r?\n/).filter((l) => l.trim() !== "");
}

describe("summary-version with state.json present (Loop 4 R3)", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ob-r3-"));
    cpSync(fixturesDir, root, { recursive: true });
    cpSync(stateFixture, join(root, STATE));
    // The copied fixture tree brings its own package.json, so it is overwritten
    // here to pin the version these tests assert on. Since Loop 8 R3 this is the
    // only place a version comes from — state.json no longer carries one — so
    // this line alone decides what the views should render.
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", version: "0.29.0" }));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("absent state.json keeps the prose regime (P1)", () => {
    rmSync(join(root, STATE));
    const r = checkSummary("0.29.0", root);
    expect(r.name).toBe("summary-version");
    expect(r.severity).toBe("issue");
    expect(r.message).toBe("SUMMARY.md does not mention version 0.29.0");
  });

  it("views never rendered → re-renders them through the shared renderers; revision unchanged; no prose inserted (V2)", () => {
    const stateBefore = readFileSync(join(root, STATE), "utf-8");
    const proseBefore = proseLines(root);
    const r = checkSummary("0.29.0", root, false);
    expect(r.severity).toBe("fixed");
    expect(r.autoFixed).toBe(true);
    expect(r.message).toMatch(/re-rendered 4 views at rev 7 \/ v0\.29\.0 \(revision unchanged/);
    expect(readFileSync(join(root, STATE), "utf-8")).toBe(stateBefore);
    for (const h of readViewHeaders(root)) expect(h).toMatchObject({ present: true, rev: 7, version: "0.29.0" });
    expect(proseLines(root)).toEqual(proseBefore);
    // Second run is a pass, and idempotent on the views.
    const again = checkSummary("0.29.0", root, false);
    expect(again.severity).toBe("pass");
    expect(again.message).toBe("views carry rev 7 / v0.29.0 — nothing to insert");
  });

  it("a version bump followed by sync re-renders with the new version and leaves the revision alone (V2)", () => {
    applyStateOps(root, { session: 55, expected_revision: 7, ops: [], render: true });
    // Loop 8 R3: bumping package.json is now the whole bump — state.json no
    // longer carries a copy to keep in step, which is the point of removing it.
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", version: "0.31.0" }));
    const proseBefore = proseLines(root);

    const r = checkSummary("0.31.0", root, false);
    expect(r.severity).toBe("fixed");
    expect(r.message).toContain("was stale: .agents/TASKS/INBOX.md (rev 7, v0.29.0)");
    for (const h of readViewHeaders(root)) expect(h).toMatchObject({ rev: 7, version: "0.31.0" });
    expect(JSON.parse(readFileSync(join(root, STATE), "utf-8")).revision).toBe(7);
    expect(proseLines(root)).toEqual(proseBefore);
    const summary = readFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "utf-8");
    expect(summary).toContain("> **Status:** v0.31.0 —");
  });

  it("--check reports stale views as an issue and writes nothing", () => {
    const r = checkSummary("0.29.0", root, true);
    expect(r.severity).toBe("issue");
    expect(r.message).toMatch(/^views stale vs rev 7 \/ v0\.29\.0: /);
    expect(existsSync(join(root, ".agents/TASKS/task.md"))).toBe(false);
  });

  // Loop 8 R3 / ADR-027: deleted with the check. It asserted that state.json
  // disagreeing with package.json about the version was an issue; there is now
  // only one place that value lives, so the two cannot disagree.

  it("invalid state.json skips with the reason and touches nothing", () => {
    writeFileSync(join(root, STATE), "{ \"schema_version\": 1 }");
    const r = checkSummary("0.29.0", root, false);
    expect(r.severity).toBe("skip");
    expect(r.message).toMatch(/^skipped — \.agents\/state\.json invalid at /);
  });
});

describe("state-views (Loop 4 R6)", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ob-r6-"));
    cpSync(fixturesDir, root, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("skips with a reason when state.json is absent", () => {
    const r = checkStateViews(root);
    expect(r.severity).toBe("skip");
    expect(r.message).toMatch(/^skipped — no \.agents\/state\.json/);
  });

  it("warns 'views stale — re-render' when views are missing or carry another rev; passes after a render", () => {
    cpSync(stateFixture, join(root, STATE));
    const missing = checkStateViews(root);
    expect(missing.severity).toBe("warn");
    expect(missing.message).toMatch(/^views stale — re-render: state\.json is rev 7; /);
    expect(missing.message).toContain(".agents/TASKS/task.md (missing)");
    expect(missing.message).toContain(".agents/SYSTEM/SUMMARY.md (no generated header)");

    applyStateOps(root, { session: 55, expected_revision: 7, ops: [], render: true, version: "0.29.0" });
    const fresh = checkStateViews(root);
    expect(fresh.severity).toBe("pass");
    expect(fresh.message).toBe("all 4 views carry rev 7");

    // A write bumps the revision; a view edited back to the old header is stale.
    applyStateOps(root, { session: 55, expected_revision: 7, ops: [{ op: "set_objective", text: "bumped" }], version: "0.29.0" });
    const taskPath = join(root, VIEW_FILES[1]);
    writeFileSync(taskPath, readFileSync(taskPath, "utf-8").replace("rev 8", "rev 7"));
    const stale = checkStateViews(root);
    expect(stale.severity).toBe("warn");
    expect(stale.message).toBe("views stale — re-render: state.json is rev 8; .agents/TASKS/task.md (rev 7)");
  });
});

describe("ci-status (Loop 4 R4, T-192 item 2)", () => {
  const root = tmpdir();
  const limitSuffix = `; ${CI_STATUS_LIMIT}`;

  function fixtureRunner(list: unknown, view?: unknown, annotations?: unknown): CommandRunner {
    return (cmd, args) => {
      if (cmd === "gh" && args[0] === "run" && args[1] === "list") {
        return { ok: true, stdout: JSON.stringify(list) };
      }
      if (cmd === "gh" && args[0] === "run" && args[1] === "view") {
        return { ok: true, stdout: JSON.stringify(view ?? { jobs: [] }) };
      }
      if (cmd === "gh" && args[0] === "api" && args[1]?.includes("/annotations")) {
        return { ok: true, stdout: JSON.stringify(annotations ?? []) };
      }
      return { ok: false, error: `unexpected ${cmd} ${args.join(" ")}` };
    };
  }

  const testJob = (jobs: CiJobRow[]) => jobs.find((j) => j.name === "test");

  it("passes on success and names the sha (recorded gh response)", () => {
    const run = successList[0];
    const r = checkCiStatus(root, fixtureRunner(successList, successView));
    expect(r).toEqual({
      name: "ci-status",
      report: true,
      severity: "pass",
      message: `master ${run.headSha!.slice(0, 7)} conclusion: success${limitSuffix}`,
    });
    expect(classifyCiConclusion(run)).toBe("success");
  });

  it("reports never started separately from failure (recorded gh response)", () => {
    const run = neverStartedList[0];
    const job = testJob(neverStartedView.jobs)!;
    expect(
      classifyCiConclusion(run, {
        testJob: job,
        annotations: neverStartedAnn,
        viewOk: true,
        viewParseOk: true,
        annFetchOk: true,
        annParseOk: true,
      }),
    ).toBe("never started");
    const r = checkCiStatus(root, fixtureRunner(neverStartedList, neverStartedView, neverStartedAnn));
    expect(r.severity).toBe("warn");
    expect(r.message).toBe(`master ${run.headSha!.slice(0, 7)} conclusion: never started${limitSuffix}`);
  });

  it("reports a real test failure when steps ran (recorded gh response)", () => {
    const run = failureList[0];
    const job = testJob(failureView.jobs)!;
    expect((job.steps ?? []).length).toBeGreaterThan(0);
    expect(classifyCiConclusion(run, { testJob: job, viewOk: true, viewParseOk: true })).toBe("failure");
    const r = checkCiStatus(root, fixtureRunner(failureList, failureView));
    expect(r.severity).toBe("warn");
    expect(r.message).toBe(`master ${run.headSha!.slice(0, 7)} conclusion: failure${limitSuffix}`);
  });

  it("names each inconclusive case instead of plain failure (red-first rows)", () => {
    const run = neverStartedList[0];
    const job = testJob(neverStartedView.jobs)!;
    expect(classifyCiConclusion(run, { viewOk: false })).toBe("failure (run view failed; cannot inspect job test)");
    expect(classifyCiConclusion(run, { viewOk: true, viewParseOk: false })).toBe(
      "failure (run view not JSON; cannot inspect job test)",
    );
    expect(classifyCiConclusion(run, { viewOk: true, viewParseOk: true, testJob: undefined })).toBe(
      "failure (job test absent in run view)",
    );
    expect(
      classifyCiConclusion(run, {
        testJob: job,
        viewOk: true,
        viewParseOk: true,
        annFetchOk: false,
      }),
    ).toBe("failure (zero steps on job test; annotations fetch failed)");
    expect(
      classifyCiConclusion(run, {
        testJob: job,
        viewOk: true,
        viewParseOk: true,
        annFetchOk: true,
        annParseOk: false,
      }),
    ).toBe("failure (zero steps on job test; annotations not JSON)");
    expect(
      classifyCiConclusion(run, {
        testJob: job,
        annotations: [{ message: "unrelated notice" }],
        viewOk: true,
        viewParseOk: true,
        annFetchOk: true,
        annParseOk: true,
      }),
    ).toBe("failure (zero steps on job test; no never-started annotation prefix)");
  });

  it("warns on a pending run and when no runs exist", () => {
    const pending = checkCiStatus(root, fixtureRunner([{ conclusion: "", headSha: "0123456789abcdef", status: "in_progress", databaseId: 1 }]));
    expect(pending.severity).toBe("warn");
    expect(pending.message).toBe(`master 0123456 conclusion: pending (in_progress)${limitSuffix}`);
    const none = checkCiStatus(root, fixtureRunner([]));
    expect(none.severity).toBe("warn");
    expect(none.message).toBe(`no CI runs found on master; conclusion: none${limitSuffix}`);
  });

  it("skips with the reason when gh is absent or not authenticated — conclusion printed as unknown", () => {
    const runner = (result: ReturnType<CommandRunner>): CommandRunner => () => result;
    const absent = checkCiStatus(root, runner({ ok: false, error: "gh not found (ENOENT)" }));
    expect(absent.severity).toBe("skip");
    expect(absent.message).toBe(`skipped — gh is not installed; conclusion: unknown (absent is not green)${limitSuffix}`);
    const unauth = checkCiStatus(root, runner({ ok: false, error: "To get started with GitHub CLI, please run:  gh auth login" }));
    expect(unauth.severity).toBe("skip");
    expect(unauth.message).toBe(`skipped — gh is not authenticated; conclusion: unknown (absent is not green)${limitSuffix}`);
  });

  it("the real runner in a directory with no git repo skips rather than throws", () => {
    const r = checkCiStatus(mkdtempSync(join(tmpdir(), "ob-r4-")));
    expect(r.severity).toBe("skip");
    expect(r.message).toMatch(/^skipped — /);
    expect(r.message).toContain("conclusion: unknown");
    expect(r.message).toContain(CI_STATUS_LIMIT);
  });
});

describe("merge-markers (Loop 4 R7)", () => {
  let root: string;
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
  // Built at runtime so this test file never contains a marker line itself.
  const marker = (ch: string) => ch.repeat(7);

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ob-r7-"));
    git("init", "-q");
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("passes on a clean tracked tree and prints the count", () => {
    writeFileSync(join(root, "a.md"), "# Title\n\nno markers here\n");
    writeFileSync(join(root, "b.txt"), "===== five equals is not a marker\n>>>>>>>no-space is not a marker\n");
    mkdirSync(join(root, "bin"));
    writeFileSync(join(root, "bin", "blob.bin"), Buffer.from([0, 1, 2, 60, 60, 60, 60, 60, 60, 60, 32]));
    git("add", "-A");
    const r = checkMergeMarkers(root);
    expect(r).toEqual({ name: "merge-markers", report: true, severity: "pass", message: "0 conflict markers in 2 tracked text files" });
  });

  it("fails (issue) naming file and lines when a tracked file carries markers; untracked files are not scanned", () => {
    writeFileSync(join(root, "CHANGELOG.md"), ["# Log", `${marker("<")} HEAD`, "ours", marker("="), "theirs", `${marker(">")} master`, ""].join("\n"));
    writeFileSync(join(root, "clean.md"), "fine\n");
    writeFileSync(join(root, "untracked.md"), `${marker("<")} HEAD\n`);
    git("add", "CHANGELOG.md", "clean.md");
    const r = checkMergeMarkers(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toBe("3 conflict marker line(s) in 1 of 2 tracked text files: CHANGELOG.md:2,4,6");
  });

  it("skips with the reason outside a git repository", () => {
    const bare = mkdtempSync(join(tmpdir(), "ob-r7-nogit-"));
    try {
      const r = checkMergeMarkers(bare, () => ({ ok: false, error: "fatal: not a git repository" }));
      expect(r.severity).toBe("skip");
      expect(r.message).toBe("skipped — git ls-files failed (fatal: not a git repository); markers: unknown");
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});
