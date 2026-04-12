import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readProjectState } from "../../../src/pipelines/session-start/state-reader.js";

describe("readProjectState", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "ob-start-"));
    cpSync(join(import.meta.dirname, "../../fixtures"), tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("detects project mode when .agents/ exists", () => {
    const state = readProjectState(tempDir);
    expect(state.mode).toBe("project");
    expect(state.hasAgents).toBe(true);
  });

  it("detects lightweight mode when .agents/ is absent", () => {
    rmSync(join(tempDir, ".agents"), { recursive: true, force: true });
    const state = readProjectState(tempDir);
    expect(state.mode).toBe("lightweight");
    expect(state.hasAgents).toBe(false);
  });

  it("detects meta mode when .agents/META/ exists", () => {
    mkdirSync(join(tempDir, ".agents", "META"), { recursive: true });
    const state = readProjectState(tempDir);
    expect(state.mode).toBe("meta");
    expect(state.hasMeta).toBe(true);
  });

  it("reads version from package.json", () => {
    const state = readProjectState(tempDir);
    expect(state.version).toBe("0.6.0");
  });

  it("reads SUMMARY.md content", () => {
    const state = readProjectState(tempDir);
    expect(state.summary).toContain("Knowledge recall");
  });

  it("reads INBOX.md content", () => {
    const state = readProjectState(tempDir);
    expect(state.inbox).toContain("session-start pipeline");
  });

  it("returns null for missing optional files", () => {
    const state = readProjectState(tempDir);
    expect(state.nextSession).toBeNull();
    expect(state.taskFile).toBeNull();
  });
});
