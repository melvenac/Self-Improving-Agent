import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { findNextSessionNumber, createSessionLog, findExistingSessionLog } from "../../../src/pipelines/session-start/session-log.js";
import { sessionStart } from "../../../src/pipelines/session-start/index.js";

describe("findNextSessionNumber", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "ob-session-"));
    mkdirSync(join(tempDir, ".agents", "SESSIONS"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("returns 1 when no session logs exist", () => {
    expect(findNextSessionNumber(tempDir)).toBe(1);
  });

  it("returns next number after existing sessions", () => {
    writeFileSync(join(tempDir, ".agents", "SESSIONS", "Session_1.md"), "");
    writeFileSync(join(tempDir, ".agents", "SESSIONS", "Session_2.md"), "");
    writeFileSync(join(tempDir, ".agents", "SESSIONS", "Session_3.md"), "");
    expect(findNextSessionNumber(tempDir)).toBe(4);
  });

  it("handles gaps in session numbers", () => {
    writeFileSync(join(tempDir, ".agents", "SESSIONS", "Session_1.md"), "");
    writeFileSync(join(tempDir, ".agents", "SESSIONS", "Session_5.md"), "");
    expect(findNextSessionNumber(tempDir)).toBe(6);
  });
});

describe("createSessionLog", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "ob-session-"));
    cpSync(join(import.meta.dirname, "../../fixtures"), tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("creates a session log file with filled metadata", () => {
    const result = createSessionLog(tempDir, 10, "abc-123", "2026-04-12");
    expect(result).toContain("Session_10.md");

    const content = readFileSync(result, "utf-8");
    expect(content).toContain("Session 10");
    expect(content).toContain("2026-04-12");
    expect(content).toContain("abc-123");
  });

  it("creates session log without session ID when null", () => {
    const result = createSessionLog(tempDir, 1, null, "2026-04-12");
    const content = readFileSync(result, "utf-8");
    expect(content).toContain("Session 1");
    expect(content).not.toContain("Session ID");
  });

  /** R1 (Loop 2): .agents/ without SESSIONS/ used to throw ENOENT out of ob_start. */
  it("returns an empty path and writes nothing when SESSIONS/ does not exist", () => {
    rmSync(join(tempDir, ".agents", "SESSIONS"), { recursive: true, force: true });
    expect(createSessionLog(tempDir, 3, "abc-123", "2026-09-14")).toBe("");
    expect(existsSync(join(tempDir, ".agents", "SESSIONS"))).toBe(false);

    const result = sessionStart({ projectRoot: tempDir, homePath: tempDir, sessionId: "abc-123" });
    expect(result.session).toEqual({
      sessionId: "abc-123",
      sessionNumber: 0,
      logPath: "",
      reused: false,
      skippedReason: "no .agents/SESSIONS/ dir — log not created",
    });
  });
});

/** R2 (Loop 2): one Session_N.md per session id, as a property of the code. */
describe("findExistingSessionLog / idempotent sessionStart", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "ob-session-"));
    cpSync(join(import.meta.dirname, "../../fixtures"), tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  const sessionsDir = () => join(tempDir, ".agents", "SESSIONS");
  const logs = () => readdirSync(sessionsDir()).filter((f) => /^Session_\d+\.md$/.test(f)).sort();

  it("finds the log carrying this session id and ignores others", () => {
    createSessionLog(tempDir, 4, "other-id", "2026-09-13");
    createSessionLog(tempDir, 5, "mine", "2026-09-14");
    expect(findExistingSessionLog(tempDir, "mine")).toEqual({ sessionNumber: 5, logPath: join(sessionsDir(), "Session_5.md") });
    expect(findExistingSessionLog(tempDir, "nobody")).toBeNull();
    expect(findExistingSessionLog(tempDir, null)).toBeNull();
  });

  it("two sessionStart calls with the same registered id create exactly one file", () => {
    const first = sessionStart({ projectRoot: tempDir, homePath: tempDir, sessionId: "same-id" });
    expect(first.session.reused).toBe(false);
    expect(logs()).toEqual(["Session_1.md"]);

    const second = sessionStart({ projectRoot: tempDir, homePath: tempDir, sessionId: "same-id" });
    expect(second.session.sessionNumber).toBe(first.session.sessionNumber);
    expect(second.session.logPath).toBe(first.session.logPath);
    expect(second.session.reused).toBe(true);
    expect(logs()).toEqual(["Session_1.md"]);

    // A different session still gets its own log.
    const third = sessionStart({ projectRoot: tempDir, homePath: tempDir, sessionId: "another-id" });
    expect(third.session.sessionNumber).toBe(2);
    expect(logs()).toEqual(["Session_1.md", "Session_2.md"]);
  });

  it("a null session id never matches an existing log", () => {
    sessionStart({ projectRoot: tempDir, homePath: tempDir, sessionId: null });
    sessionStart({ projectRoot: tempDir, homePath: tempDir, sessionId: null });
    // Two anonymous starts are two logs — there is nothing to match on.
    expect(logs()).toEqual(["Session_1.md", "Session_2.md"]);
  });
});
