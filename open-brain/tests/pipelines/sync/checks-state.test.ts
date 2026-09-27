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
  type CommandRunner,
} from "../../../src/pipelines/sync/checks-state.js";
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

describe("ci-status (Loop 4 R4)", () => {
  const root = tmpdir();
  const runner = (result: ReturnType<CommandRunner>): CommandRunner => () => result;

  it("passes on success and names the sha", () => {
    const r = checkCiStatus(root, runner({ ok: true, stdout: JSON.stringify([{ conclusion: "success", headSha: "86ea0107c47f16d12b5077c3f6f13ecfe01b3c73", status: "completed" }]) }));
    expect(r).toEqual({ name: "ci-status", report: true, severity: "pass", message: "master 86ea010 conclusion: success" });
  });

  it("warns on failure naming the sha, and on a pending run", () => {
    const failed = checkCiStatus(root, runner({ ok: true, stdout: JSON.stringify([{ conclusion: "failure", headSha: "deadbeefcafe", status: "completed" }]) }));
    expect(failed.severity).toBe("warn");
    expect(failed.message).toBe("master deadbee conclusion: failure (steps not read: no databaseId)");
    const pending = checkCiStatus(root, runner({ ok: true, stdout: JSON.stringify([{ conclusion: "", headSha: "0123456789", status: "in_progress" }]) }));
    expect(pending.severity).toBe("warn");
    expect(pending.message).toBe("master 0123456 conclusion: pending (in_progress)");
    const none = checkCiStatus(root, runner({ ok: true, stdout: "[]" }));
    expect(none.severity).toBe("warn");
    expect(none.message).toBe("no CI runs found on master; conclusion: none");
  });

  it("skips with the reason when gh is absent or not authenticated — conclusion printed as unknown", () => {
    const absent = checkCiStatus(root, runner({ ok: false, error: "gh not found (ENOENT)" }));
    expect(absent.severity).toBe("skip");
    expect(absent.message).toBe("skipped — gh is not installed; conclusion: unknown (absent is not green)");
    const unauth = checkCiStatus(root, runner({ ok: false, error: "To get started with GitHub CLI, please run:  gh auth login" }));
    expect(unauth.severity).toBe("skip");
    expect(unauth.message).toBe("skipped — gh is not authenticated; conclusion: unknown (absent is not green)");
    const other = checkCiStatus(root, runner({ ok: false, error: "could not determine base repo\nsecond line" }));
    expect(other.severity).toBe("skip");
    expect(other.message).toBe("skipped — gh failed: could not determine base repo; conclusion: unknown (absent is not green)");
  });

  it("the real runner in a directory with no git repo skips rather than throws", () => {
    const r = checkCiStatus(mkdtempSync(join(tmpdir(), "ob-r4-")));
    expect(r.severity).toBe("skip");
    expect(r.message).toMatch(/^skipped — /);
    expect(r.message).toContain("conclusion: unknown");
  });
});

describe("ci-status names a job that never started (T-192)", () => {
  const root = tmpdir();
  /** Recorded `gh` payloads. The runner answers `run list` and `run view` separately. */
  function gh(list: unknown, view?: unknown): CommandRunner {
    return (_cmd, args) => {
      if (args[1] === "list") return { ok: true, stdout: JSON.stringify(list) };
      if (args[1] === "view") return { ok: true, stdout: JSON.stringify(view) };
      return { ok: false, error: `unexpected gh ${args.join(" ")}` };
    };
  }

  it("a failure with zero steps is never-started, not a failure", () => {
    // gh run view 36304185040: job test conclusion failure, steps 0.
    // Annotation on check-run 108577433405 begins "The job was not started because".
    const r = checkCiStatus(root, gh(
      [{ conclusion: "failure", headSha: "e201baa324414e52a37b5051aa76e4bdba1d1523", status: "completed", databaseId: 36304185040 }],
      { jobs: [{ name: "test", conclusion: "failure", steps: [] }, { name: "test-windows", conclusion: "skipped", steps: [] }] },
    ));
    expect(r.severity).toBe("warn");
    expect(r.message).toBe(
      "master e201baa conclusion: never-started — job test recorded 0 steps. LIMIT: read from gh run view jobs[].steps, not the billing annotation; a failure with no steps for another reason is named never-started",
    );
    expect(r.message).not.toContain("conclusion: failure");
  });

  it("a failure whose test job ran steps stays a failure", () => {
    // gh run view 36301870766: job test conclusion failure, 10 steps.
    const r = checkCiStatus(root, gh(
      [{ conclusion: "failure", headSha: "98c40af97622098645789c2cd22bef1d0019da35", status: "completed", databaseId: 36301870766 }],
      { jobs: [{ name: "test", conclusion: "failure", steps: Array.from({ length: 10 }, () => ({ name: "step" })) }, { name: "test-windows", conclusion: "skipped", steps: [] }] },
    ));
    expect(r.severity).toBe("warn");
    expect(r.message).toBe("master 98c40af conclusion: failure");
  });

  it("a success stays a success", () => {
    // gh run view 36304366630.
    const r = checkCiStatus(root, gh(
      [{ conclusion: "success", headSha: "2dcc68a52f8fe1e2423ca5a3530d72ed293cecf8", status: "completed", databaseId: 36304366630 }],
    ));
    expect(r).toEqual({ name: "ci-status", report: true, severity: "pass", message: "master 2dcc68a conclusion: success" });
  });
});

describe("ci-status names an unreadable step list (T-192 r181b)", () => {
  const root = tmpdir();
  const failed = [{ conclusion: "failure", headSha: "deadbeefcafe", status: "completed", databaseId: 1 }];
  function gh(list: unknown, view?: { ok: true; stdout: string } | { ok: false; error: string }): CommandRunner {
    return (_cmd, args) => {
      if (args[1] === "list") return { ok: true, stdout: JSON.stringify(list) };
      if (args[1] === "view" && view) return view;
      return { ok: false, error: `unexpected gh ${args.join(" ")}` };
    };
  }

  it("a failed run view names the error's first line", () => {
    const r = checkCiStatus(root, gh(failed, { ok: false, error: "could not find run\nsecond line" }));
    expect(r.severity).toBe("warn");
    expect(r.message).toBe("master deadbee conclusion: failure (steps not read: could not find run)");
  });

  it("an unparseable job list says so", () => {
    const r = checkCiStatus(root, gh(failed, { ok: true, stdout: "not json" }));
    expect(r.severity).toBe("warn");
    expect(r.message).toBe("master deadbee conclusion: failure (steps not read: unparseable job list)");
  });

  it("a failure with no databaseId says the steps were not read", () => {
    const r = checkCiStatus(root, gh([{ conclusion: "failure", headSha: "deadbeefcafe", status: "completed" }]));
    expect(r.severity).toBe("warn");
    expect(r.message).toBe("master deadbee conclusion: failure (steps not read: no databaseId)");
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
