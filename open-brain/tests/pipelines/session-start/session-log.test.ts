import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { findNextSessionNumber, createSessionLog } from "../../../src/pipelines/session-start/session-log.js";

describe("findNextSessionNumber", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "ob-session-"));
    mkdirSync(join(tempDir, ".agents", "SESSIONS"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
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
    rmSync(tempDir, { recursive: true, force: true });
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
});
