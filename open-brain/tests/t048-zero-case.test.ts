/**
 * T-048 round 2 (QA 258 row 9): absent and zero must not collapse FOR THE READER. Round 1 printed a count only when it
 * was above zero, so "nothing was unreadable" and "the scan did not run" produced the same silence. Each row here is the
 * ZERO case (and the did-not-run case) of a site round 1 fixed.
 */
import { describe, it, expect, afterAll } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sessionStart } from "../src/pipelines/session-start/index.js";
import { runHealthChecks } from "../src/pipelines/session-start/health-checks.js";
import { formatScanCounts } from "../src/pipelines/session-start/scan-counts.js";
import { checkHubSeats } from "../src/pipelines/sync/hub-seats.js";
import { describeWorkspaceDir } from "../src/shared/active-session.js";

const made: string[] = [];
const tmp = (p: string): string => {
  const d = mkdtempSync(join(tmpdir(), `t048z-${p}-`));
  made.push(d);
  return d;
};
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

function project(): string {
  const root = tmp("proj");
  for (const d of ["SYSTEM", "TASKS", "SESSIONS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
  for (const [f, t] of [["SYSTEM/SUMMARY.md", "# S\n"], ["TASKS/INBOX.md", "# I\n"], ["TASKS/task.md", "# T\n"], ["SESSIONS/next-session.md", "# H\n"]]) writeFileSync(join(root, ".agents", f), t);
  return root;
}

describe("T-048 round 2: zero is printed, and 'did not look' is a different line", () => {
  it("DC-4z: sessionStart counts unreadable session logs at zero, and leaves the count undefined when it did not search", () => {
    const root = project();
    const home = tmp("home");
    expect(sessionStart({ projectRoot: root, homePath: home, sessionId: "abc" }).session.unreadableLogs).toBe(0);
    // no session id: findExistingSessionLog returns before reading anything, so the count is NOT 0, it is absent
    expect(sessionStart({ projectRoot: root, homePath: home, sessionId: null }).session.unreadableLogs).toBeUndefined();
    mkdirSync(join(root, ".agents", "SESSIONS", "Session_90.md")); // a directory where a log should be
    expect(sessionStart({ projectRoot: root, homePath: home, sessionId: "abc" }).session.unreadableLogs).toBe(1);
  });

  it("DC-5z: runHealthChecks reports transcript directories unreadable at zero, null when ~/.claude/projects is absent", () => {
    const clean = tmp("h-clean");
    mkdirSync(join(clean, ".claude", "projects", "good"), { recursive: true });
    expect(runHealthChecks(clean).transcriptDirsUnreadable).toBe(0);
    expect(runHealthChecks(tmp("h-none")).transcriptDirsUnreadable).toBeNull();
    const bad = tmp("h-bad");
    mkdirSync(join(bad, ".claude", "projects"), { recursive: true });
    writeFileSync(join(bad, ".claude", "projects", "not-a-dir"), "x");
    expect(runHealthChecks(bad).transcriptDirsUnreadable).toBe(1);
  });

  it("DC-4z/DC-5z: the ob_start lines say a number at zero and 'not searched/not scanned' when the scan did not run", () => {
    expect(formatScanCounts({ unreadableLogs: 0 }, { transcriptDirsUnreadable: 0 })).toEqual(["Session logs unreadable: 0", "Transcript directories unreadable: 0"]);
    expect(formatScanCounts({ unreadableLogs: 2 }, { transcriptDirsUnreadable: 3 })).toEqual(["Session logs unreadable: 2", "Transcript directories unreadable: 3"]);
    const none = formatScanCounts({}, { transcriptDirsUnreadable: null });
    expect(none[0]).toContain("not searched");
    expect(none[1]).toContain("not scanned");
    expect(none).not.toEqual(formatScanCounts({ unreadableLogs: 0 }, { transcriptDirsUnreadable: 0 }));
  });

  it("DC-6z: a passing hub-seats check says '0 seat names ignored' and is reported", () => {
    const root = tmp("hub");
    mkdirSync(join(root, ".agents", "SYSTEM"), { recursive: true });
    writeFileSync(join(root, ".agents", "SYSTEM", "worktree-seats.json"), JSON.stringify({ seats: ["planner", "qa"] }));
    writeFileSync(
      join(root, ".agents", "SYSTEM", "hub-partner-seats.json"),
      JSON.stringify({ talk: "hub-talk {hub_name} {room}", seats: {}, readers: { planner: { partners: [{ label: "a", hub_as: "b", session_id: "c" }] } } }),
    );
    const r = checkHubSeats(root);
    expect(r.severity).toBe("pass");
    expect(r.report).toBe(true);
    expect(r.message).toContain("; 0 seat names ignored");
  });

  it("DC-7z: describeWorkspaceDir's unusable_roots is 0 (not undefined) when every root is usable, and absent roots give 0 too", () => {
    expect(describeWorkspaceDir({ workspace_roots: ["C:/p/one", "C:/p/two"] }, "C:/fallback").unusable_roots).toBe(0);
    expect(describeWorkspaceDir({ workspace_roots: ["C:/p/one", 7] }, "C:/fallback").unusable_roots).toBe(1);
    expect(describeWorkspaceDir({}, "C:/fallback").unusable_roots).toBe(0);
  });
});
