import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sessionStart } from "../../../src/pipelines/session-start/index.js";

describe("sessionStart", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "ob-start-int-"));
    cpSync(join(import.meta.dirname, "../../fixtures"), tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("returns project state with correct mode", () => {
    const result = sessionStart({ projectRoot: tempDir, homePath: tempDir });
    expect(result.state.mode).toBe("project");
    expect(result.state.version).toBe("0.6.0");
  });

  it("detects drift in project state", () => {
    const result = sessionStart({ projectRoot: tempDir, homePath: tempDir });
    expect(Array.isArray(result.drift)).toBe(true);
  });

  it("creates a session log", () => {
    const result = sessionStart({ projectRoot: tempDir, homePath: tempDir });
    expect(result.session.logPath).toContain("Session_");
    expect(existsSync(result.session.logPath)).toBe(true);
  });

  it("returns null session ID when discovery fails", () => {
    const result = sessionStart({ projectRoot: tempDir, homePath: tempDir });
    expect(result.session.sessionId).toBeNull();
  });

  it("uses the caller-supplied session ID instead of transcript discovery", () => {
    const result = sessionStart({
      projectRoot: tempDir,
      homePath: tempDir,
      sessionId: "11111111-2222-3333-4444-555555555555",
    });
    expect(result.session.sessionId).toBe("11111111-2222-3333-4444-555555555555");
  });

  it("falls back to discovery when the supplied session ID is null", () => {
    const result = sessionStart({ projectRoot: tempDir, homePath: tempDir, sessionId: null });
    expect(result.session.sessionId).toBeNull();
  });

  it("skips session log creation in lightweight mode", () => {
    rmSync(join(tempDir, ".agents"), { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    const result = sessionStart({ projectRoot: tempDir, homePath: tempDir });
    expect(result.state.mode).toBe("lightweight");
    expect(result.session.logPath).toBe("");
  });
});
