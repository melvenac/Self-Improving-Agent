/**
 * T-348: ob_start keeps the READS OWED list for the session it started, and that session's first applied ob_state write
 * repeats it once. Temp projects only; the record lands under the test KNOWLEDGE_V2_DB directory (tests/setup-env.ts),
 * never under the real ~/.claude.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { recordReadsOwed, readsOwedReminder } from "../../../src/pipelines/session-start/reads-owed.js";
import * as sr from "../../../src/pipelines/session-start/start-report.js";
import { handleSetSession, handleState } from "../../../src/server.js";
import { byPidDir, processStartTime, writeProcessSession } from "../../../src/shared/process-session.js";
import { endRecordProjectDir } from "../../../src/shared/end-record-store.js";

vi.mock("../../../src/pipelines/session-start/hub-presence.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/pipelines/session-start/hub-presence.js")>();
  return { ...actual, describeHubPresence: async () => ({ lines: [], sourceRel: null, charCount: 0 }) };
});

const STATE_FIXTURE = resolve(import.meta.dirname, "../../fixtures-state/state.json");
const SELF = "00000348-0000-4000-8000-000000000001";
const OTHER = "00000348-0000-4000-8000-000000000002";
const LINE = "READS OWED at start";

const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  rmSync(byPidDir(process.env.OPEN_BRAIN_ACTIVE_SESSION!), { recursive: true, force: true });
});
const tmp = (prefix: string): string => {
  const d = mkdtempSync(join(tmpdir(), prefix));
  tmps.push(d);
  return d;
};
const git = (cwd: string, ...args: string[]): void => {
  execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=T", ...args], { cwd, stdio: "ignore" });
};

describe("T-348: the reads-owed record and its one reminder", () => {
  it("T348-1 a session with owed reads gets the line once, naming every path, and not a second time", () => {
    const root = tmp("t348-a-");
    recordReadsOwed(root, SELF, ["docs/loops/x-brief.md", ".agents/AGENT.md"]);
    expect(readsOwedReminder(root, SELF, false)).toBe(`${LINE} (2), confirm each was read: docs/loops/x-brief.md, .agents/AGENT.md`);
    expect(readsOwedReminder(root, SELF, false)).toBeNull();
  });

  it("T348-2 a session with no owed reads, and a project with no record, get no line", () => {
    const root = tmp("t348-b-");
    expect(readsOwedReminder(root, SELF, false)).toBeNull();
    recordReadsOwed(root, SELF, []);
    expect(readsOwedReminder(root, SELF, false)).toBeNull();
  });

  it("T348-3 a dry run gets no line and leaves the reminder for the first real write", () => {
    const root = tmp("t348-c-");
    recordReadsOwed(root, SELF, [".agents/AGENT.md"]);
    expect(readsOwedReminder(root, SELF, true)).toBeNull();
    expect(readsOwedReminder(root, SELF, true)).toBeNull();
    expect(readsOwedReminder(root, SELF, false)).toBe(`${LINE} (1), confirm each was read: .agents/AGENT.md`);
  });

  it("T348-4 the record is the session's own: another session and no session get nothing; a second start does not arm it again; a new session's start does", () => {
    const root = tmp("t348-d-");
    recordReadsOwed(root, SELF, [".agents/AGENT.md"]);
    expect(readsOwedReminder(root, OTHER, false)).toBeNull();
    expect(readsOwedReminder(root, null, false)).toBeNull();
    expect(readsOwedReminder(root, SELF, false)).toBe(`${LINE} (1), confirm each was read: .agents/AGENT.md`);
    recordReadsOwed(root, SELF, [".agents/AGENT.md"]);
    expect(readsOwedReminder(root, SELF, false)).toBeNull();
    recordReadsOwed(root, OTHER, ["a.md", "b.md", "c.md", "d.md", "e.md", "f.md", "g.md"]);
    expect(readsOwedReminder(root, OTHER, false)).toBe(`${LINE} (7), confirm each was read: a.md, b.md, c.md, d.md, e.md, f.md, +1 more`);
  });
});

describe("T-348: renderStartReport records what it printed", { timeout: 120_000 }, () => {
  function fixture(): string {
    const dir = tmp("t348-proj-");
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "t348-fixture", version: "0.1.0" }));
    mkdirSync(join(dir, ".agents", "SYSTEM"), { recursive: true });
    mkdirSync(join(dir, ".agents", "SESSIONS"), { recursive: true });
    copyFileSync(STATE_FIXTURE, join(dir, ".agents", "state.json"));
    mkdirSync(join(dir, "docs", "loops"), { recursive: true });
    writeFileSync(join(dir, "docs", "loops", "t348x-brief.md"), "# brief\n");
    git(dir, "init", "-q");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "fixture");
    return dir;
  }

  it("T348-5 a real start records the owed paths for its session; a read-only start records nothing", async () => {
    const real = fixture();
    const report = await sr.renderStartReport({ projectRoot: real, proven: { id: SELF, pid: 4242 }, callerLabel: "T348" });
    const printed = report.text.split("\n").find((l) => /^READS (OWED|FIRST) \(/.test(l));
    expect(printed, report.text).toContain("docs/loops/t348x-brief.md");
    const reminder = readsOwedReminder(real, SELF, false);
    expect(reminder).toMatch(/^READS OWED at start \(\d+\), confirm each was read: /);
    expect(reminder).toContain("docs/loops/t348x-brief.md");

    const probe = fixture();
    await sr.renderStartReport({ projectRoot: probe, proven: { id: SELF, pid: 4242 }, callerLabel: "T348", readOnly: true });
    expect(readsOwedReminder(probe, SELF, false)).toBeNull();
  });

  it("T348-7 a start that owes more than six paths records all of them: the reminder's count is the start line's, with the same first six and the rest as +K more", async () => {
    const dir = tmp("t348-many-");
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "t348-fixture", version: "0.1.0" }));
    mkdirSync(join(dir, ".agents", "SYSTEM"), { recursive: true });
    mkdirSync(join(dir, ".agents", "SESSIONS"), { recursive: true });
    writeFileSync(join(dir, ".agents", "AGENT.md"), "---\nname: Builder\nrole: developer\npartner: Atlas\n---\n\n# Seat\n");
    const state = JSON.parse(readFileSync(STATE_FIXTURE, "utf8")) as { handoffs: { pick_up: string }[] };
    const notes = ["docs/n1.md", "docs/n2.md", "docs/n3.md", "docs/n4.md", "docs/n5.md", "docs/n6.md"];
    state.handoffs[0].pick_up = `Read ${notes.join(", ")} first.`;
    writeFileSync(join(dir, ".agents", "state.json"), JSON.stringify(state, null, 2));
    mkdirSync(join(dir, "docs", "loops"), { recursive: true });
    writeFileSync(join(dir, "docs", "loops", "t348x-brief.md"), "# brief\n");
    for (const n of notes) writeFileSync(join(dir, ...n.split("/")), "# note\n");
    git(dir, "init", "-q");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "fixture");

    const report = await sr.renderStartReport({ projectRoot: dir, proven: { id: SELF, pid: 4242 }, callerLabel: "T348" });
    const printed = report.text.split("\n").find((l) => /^READS (OWED|FIRST) \(/.test(l));
    expect(printed, report.text).toBeDefined();
    const owed = Number(/^READS (?:OWED|FIRST) \((\d+)\)/.exec(printed!)![1]);
    expect(owed, printed).toBeGreaterThanOrEqual(7);
    const PATHS = /(?:docs|\.agents)\/[A-Za-z0-9._/-]+\.md/g;
    const shownAtStart = printed!.match(PATHS);
    expect(shownAtStart, printed).toHaveLength(6);
    for (const n of notes.slice(0, 5)) expect(shownAtStart).toContain(n);

    const reminder = readsOwedReminder(dir, SELF, false);
    expect(reminder).not.toBeNull();
    expect(reminder!.startsWith(`${LINE} (${owed}), confirm each was read: `), reminder!).toBe(true);
    expect(reminder!.match(PATHS)).toEqual(shownAtStart);
    expect(reminder!.endsWith(`, +${owed - 6} more`), reminder!).toBe(true);
  });
});

describe("T-348: ob_state prints the reminder", { timeout: 120_000 }, () => {
  /** The proof server.test.ts gives the server: this worker's real parent process and its real start time. */
  function proveOwn(id: string): void {
    writeProcessSession(byPidDir(process.env.OPEN_BRAIN_ACTIVE_SESSION!), {
      session_id: id, claude_pid: process.ppid, proc_start: processStartTime(process.ppid)!, ide: "claude", written_at: new Date().toISOString(),
    });
  }
  function project(): string {
    const dir = tmp("t348-state-");
    writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "0.29.0" }));
    mkdirSync(join(dir, ".agents", "SYSTEM"), { recursive: true });
    mkdirSync(join(dir, ".agents", "TASKS"), { recursive: true });
    mkdirSync(join(dir, ".agents", "SESSIONS"), { recursive: true });
    writeFileSync(join(dir, ".agents", "SYSTEM", "SUMMARY.md"), "# Summary\n");
    writeFileSync(join(dir, ".agents", "TASKS", "INBOX.md"), "# Inbox\n");
    writeFileSync(join(dir, ".agents", "TASKS", "task.md"), "# Task\n");
    writeFileSync(join(dir, ".agents", "SESSIONS", "next-session.md"), "# Handoff\n");
    copyFileSync(STATE_FIXTURE, join(dir, ".agents", "state.json"));
    return dir;
  }
  const revision = (dir: string): number => JSON.parse(readFileSync(join(dir, ".agents", "state.json"), "utf8")).revision as number;
  const text = (r: { content: { type: string; text: string }[] }): string => r.content[0].text;

  it("T348-6 a dry run has no line and does not use it up; the first applied write ends with it; the second has none", async () => {
    const dir = project();
    proveOwn(SELF);
    await handleSetSession({ session_id: SELF, project_dir: dir });
    recordReadsOwed(dir, SELF, ["docs/loops/x-brief.md", ".agents/AGENT.md"]);
    const write = async (objective: string, dry: boolean) =>
      handleState({ project_root: dir, session: 61, expected_revision: revision(dir), ops: [{ op: "set_objective", text: objective }], dry_run: dry });

    const dry = await write("t348 dry", true);
    expect(dry.isError).toBeUndefined();
    expect(text(dry)).toContain("ob_state dry run");
    expect(text(dry)).not.toContain(LINE);

    const first = await write("t348 first", false);
    expect(first.isError, text(first)).toBeUndefined();
    expect(text(first)).toContain("ob_state applied");
    expect(text(first).split("\n").at(-1)).toBe(`${LINE} (2), confirm each was read: docs/loops/x-brief.md, .agents/AGENT.md`);

    const second = await write("t348 second", false);
    expect(second.isError, text(second)).toBeUndefined();
    expect(text(second)).toContain("ob_state applied");
    expect(text(second)).not.toContain(LINE);
  });

  it("T348-8 a refused write has no line and does not use it up; the next applied write ends with it; the one after has none", async () => {
    const dir = project();
    proveOwn(SELF);
    await handleSetSession({ session_id: SELF, project_dir: dir });
    recordReadsOwed(dir, SELF, ["docs/loops/x-brief.md", ".agents/AGENT.md"]);
    const write = async (objective: string, rev: number) =>
      handleState({ project_root: dir, session: 61, expected_revision: rev, ops: [{ op: "set_objective", text: objective }] });

    const before = revision(dir);
    const refused = await write("t348 refused", before + 5);
    expect(refused.isError).toBe(true);
    expect(text(refused)).toContain("ob_state refused: revision mismatch");
    expect(text(refused)).not.toContain(LINE);
    expect(revision(dir)).toBe(before);

    const first = await write("t348 first", revision(dir));
    expect(first.isError, text(first)).toBeUndefined();
    expect(text(first)).toContain("ob_state applied");
    expect(text(first).split("\n").at(-1)).toBe(`${LINE} (2), confirm each was read: docs/loops/x-brief.md, .agents/AGENT.md`);

    const second = await write("t348 second", revision(dir));
    expect(second.isError, text(second)).toBeUndefined();
    expect(text(second)).toContain("ob_state applied");
    expect(text(second)).not.toContain(LINE);
  });

  it("T348-9 a hand-edited record whose paths are not all strings gives no line, and the write still applies", async () => {
    const dir = project();
    proveOwn(SELF);
    await handleSetSession({ session_id: SELF, project_dir: dir });
    writeFileSync(join(endRecordProjectDir(dir), ".reads-owed.json"), `${JSON.stringify({ session: SELF, paths: ["docs/a.md", 2], reminded: false })}\n`);
    const res = await handleState({ project_root: dir, session: 61, expected_revision: revision(dir), ops: [{ op: "set_objective", text: "t348 hand-edited" }] });
    expect(res.isError, text(res)).toBeUndefined();
    expect(text(res)).toContain("ob_state applied");
    expect(text(res)).not.toContain(LINE);
  });
});
