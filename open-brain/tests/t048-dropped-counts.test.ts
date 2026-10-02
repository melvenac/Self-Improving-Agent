/**
 * T-048: any filter that drops rows must emit the dropped count, so "absent" and "zero" never collapse into one
 * value. One row per fixed site; each is red on the base (the drop is invisible) and green after (the count appears).
 * The audit table and the sites NOT fixed are in docs/loops/t048-developer-handoff.md.
 */
import { describe, it, expect, afterAll } from "vitest";
import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logInvocations } from "../src/pipelines/session-end/invocation-logger.js";
import { formatSessionEndLines } from "../src/pipelines/session-end/index-v2.js";
import { formatRecalledResolution, resolveRecalledIds } from "../src/pipelines/session-end/recalled-ids.js";
import { findExistingSessionLog } from "../src/pipelines/session-start/session-log.js";
import { runHealthChecks } from "../src/pipelines/session-start/health-checks.js";
import { checkHubSeats } from "../src/pipelines/sync/hub-seats.js";
import { describeWorkspaceDir } from "../src/shared/active-session.js";
import { checkMergeMarkers } from "../src/pipelines/sync/checks-state.js";
import { initSchemaV2 } from "../src/db-v2.js";

const made: string[] = [];
const tmp = (p: string): string => {
  const d = mkdtempSync(join(tmpdir(), `t048-${p}-`));
  made.push(d);
  return d;
};
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

describe("T-048 session-end: invocation logging reports what it skipped", () => {
  function sessionDb(dir: string, name: string, id: string, events: Array<[string, string]>): void {
    const db = new Database(join(dir, name));
    db.exec("CREATE TABLE session_events (id INTEGER PRIMARY KEY, type TEXT, data TEXT, created_at TEXT); CREATE TABLE session_meta (session_id TEXT, project_dir TEXT);");
    db.prepare("INSERT INTO session_meta VALUES (?, ?)").run(id, "C:/p/proj");
    for (const [type, data] of events) db.prepare("INSERT INTO session_events (type, data, created_at) VALUES (?, ?, ?)").run(type, data, "2026-10-02T00:00:00Z");
    db.close();
  }

  it("DC-1: an unreadable session db and a failed append are counted, not swallowed; 'already logged' is its own number", () => {
    const dir = tmp("inv");
    sessionDb(dir, "a.db", "sess-a", [["skill", "demo-skill"], ["mcp", "open-brain:ob_start"]]);
    sessionDb(dir, "b.db", "sess-b", [["skill", "x"]]);
    writeFileSync(join(dir, "torn.db"), "this is not a sqlite database at all");
    const log = join(tmp("invlog"), "invocations.jsonl");
    writeFileSync(log, `${JSON.stringify({ session: "sess-b", ts: "2026-10-01T00:00:00Z" })}\n`);
    const r = logInvocations(dir, log);
    expect(r).toMatchObject({ logged: 2, skippedSessions: 1, unreadableSessions: 1, appendFailures: 0 });
    const failing = logInvocations(dir, join(dir, "no-such-dir", "log.jsonl"));
    expect(failing.appendFailures).toBeGreaterThan(0);
    expect(failing.logged).toBe(0);
  });

  it("DC-2: the Invocations line states all four numbers, including zeros", () => {
    const base = { summary: { written: true, selfGenerated: false, skip: null }, feedback: { processed: 0 }, shadow: { evaluated: false, skipped: "x", strategies: 0, queries: 0, leader: null }, topics: { written: 0, removed: 0, orphans: 0 } };
    const lines = formatSessionEndLines({ ...base, invocations: { logged: 3, skippedSessions: 0, unreadableSessions: 0, appendFailures: 0 } } as never);
    expect(lines).toContain("Invocations: 3 logged (0 already logged, 0 unreadable, 0 append failed)");
    const bad = formatSessionEndLines({ ...base, invocations: { logged: 0, skippedSessions: 2, unreadableSessions: 4, appendFailures: 1 } } as never);
    expect(bad).toContain("Invocations: 0 logged (2 already logged, 4 unreadable, 1 append failed)");
  });
});

describe("T-048 session-end: recalled-entries ids that cannot be rated are counted", () => {
  it("DC-3: entries with no numeric id in a trusted file are dropped AND counted, and the line says so", () => {
    const db = new Database(":memory:");
    initSchemaV2(db);
    const file = JSON.stringify({ session_id: "S", entries: [{ id: 1 }, { id: "2" }, { key: "no id" }, { id: 4 }] });
    const r = resolveRecalledIds({ db, sessionId: "S", filePaths: ["/f"], readFile: () => file });
    expect(r.ids).toEqual([1, 4]);
    expect(r.droppedEntries).toBe(2);
    expect(formatRecalledResolution(r)).toContain("  Recalled ids: 2 from file");
    expect(formatRecalledResolution(r)).toContain("  Dropped 2 of 4 entries in the file: no numeric id, so they were not rated");
  });

  it("DC-3b: a clean file says nothing extra (nothing was dropped), and the explicit/recall-log origins carry no count", () => {
    const db = new Database(":memory:");
    initSchemaV2(db);
    const file = JSON.stringify({ session_id: "S", entries: [{ id: 1 }] });
    const r = resolveRecalledIds({ db, sessionId: "S", filePaths: ["/f"], readFile: () => file });
    expect(r.droppedEntries).toBe(0);
    expect(formatRecalledResolution(r).join("\n")).not.toContain("Dropped");
    expect(resolveRecalledIds({ db, sessionId: "S", explicitIds: [9], filePaths: [], readFile: () => null }).droppedEntries).toBeUndefined();
  });
});

describe("T-048 ob_start: session log and transcript scans report what they could not read", () => {
  it("DC-4: an unreadable Session_N.md is reported to the caller, so a duplicate log is not minted in silence", () => {
    const root = tmp("slog");
    const dir = join(root, ".agents", "SESSIONS");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "Session_3.md"), "# s\n\n**Session ID:** abc\n");
    mkdirSync(join(dir, "Session_9.md")); // a directory where a log should be: readFileSync throws
    const unreadable: string[] = [];
    const found = findExistingSessionLog(root, "nobody", (name) => unreadable.push(name));
    expect(found).toBeNull();
    expect(unreadable).toEqual(["Session_9.md"]);
    const none: string[] = [];
    findExistingSessionLog(root, "abc", (name) => none.push(name));
    expect(none).toEqual(["Session_9.md"]);
  });

  it("DC-5: a transcript directory that cannot be read is a warning naming how many, not a silent narrowing", () => {
    const home = tmp("home");
    const projects = join(home, ".claude", "projects");
    mkdirSync(join(projects, "good"), { recursive: true });
    writeFileSync(join(projects, "not-a-dir"), "a file where a project directory should be");
    const warnings = runHealthChecks(home).warnings;
    const w = warnings.find((x) => x.message.includes("could not be read"));
    expect(w, JSON.stringify(warnings)).toBeDefined();
    expect(w!.message).toContain("1 transcript director");
    // and a clean tree adds no such warning
    const clean = tmp("home2");
    mkdirSync(join(clean, ".claude", "projects", "good"), { recursive: true });
    expect(runHealthChecks(clean).warnings.some((x) => x.message.includes("could not be read"))).toBe(false);
  });
});

describe("T-048 sync checks and the slot file", () => {
  it("DC-6: hub-seats names the seat names it could not read instead of treating them as absent", () => {
    const root = tmp("hub");
    mkdirSync(join(root, ".agents", "SYSTEM"), { recursive: true });
    writeFileSync(join(root, ".agents", "SYSTEM", "worktree-seats.json"), JSON.stringify({ seats: ["planner", 7, null, "qa"] }));
    writeFileSync(
      join(root, ".agents", "SYSTEM", "hub-partner-seats.json"),
      JSON.stringify({ talk: "hub-talk {hub_name} {room}", seats: {}, readers: { planner: { partners: [{ label: "a", hub_as: "b", session_id: "c" }] } } }),
    );
    const r = checkHubSeats(root);
    expect(r.message).toContain("worktree-seats.json has 2 seat name(s) that are not strings and were ignored");
  });

  it("DC-7: describeWorkspaceDir reports how many workspace_roots entries it could not use", () => {
    const r = describeWorkspaceDir({ workspace_roots: ["C:/p/one", 7, { nothing: 1 }, "   "] }, "C:/fallback");
    expect(r.dir).toBe("C:/p/one");
    expect(r.root_count).toBe(1);
    expect(r.unusable_roots).toBe(3);
    expect(describeWorkspaceDir({}, "C:/fallback").unusable_roots).toBe(0);
    expect(describeWorkspaceDir({ workspace_roots: [] }, "C:/fallback").unusable_roots).toBe(0);
  });

  it("DC-8: merge-markers says how many tracked files it did not scan, by reason, at zero as well", () => {
    const root = tmp("mm");
    const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", ...a], { cwd: root, stdio: "ignore" });
    git("init", "-q");
    writeFileSync(join(root, "a.md"), "fine\n");
    git("add", "-A");
    expect(checkMergeMarkers(root).message).toBe("0 conflict markers in 1 tracked text files; 0 tracked files not scanned (0 deleted, 0 unreadable, 0 binary)");
    writeFileSync(join(root, "blob.bin"), Buffer.from([0, 1, 2, 3]));
    writeFileSync(join(root, "gone.md"), "x\n");
    git("add", "-A");
    rmSync(join(root, "gone.md"));
    const r = checkMergeMarkers(root);
    expect(r.message).toBe("0 conflict markers in 1 tracked text files; 2 tracked files not scanned (1 deleted, 0 unreadable, 1 binary)");
  });
});
