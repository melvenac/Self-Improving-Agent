import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readProjectState, readOptional, readStateJson } from "../../../src/pipelines/session-start/state-reader.js";

const stateFixture = join(import.meta.dirname, "../../fixtures-state/state.json");

describe("readProjectState", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "ob-start-"));
    cpSync(join(import.meta.dirname, "../../fixtures"), tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("detects project mode when .agents/ exists", () => {
    const state = readProjectState(tempDir);
    expect(state.mode).toBe("project");
    expect(state.hasAgents).toBe(true);
  });

  it("detects lightweight mode when .agents/ is absent", () => {
    rmSync(join(tempDir, ".agents"), { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
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

  /**
   * Loop 1: the 50-line default truncation is gone. No budget means the whole
   * file; a budget cuts and FLAGS, so truncated and absent never look alike.
   */
  describe("budget and sizes", () => {
    const longFile = (n: number) => Array.from({ length: n }, (_, i) => `row ${i + 1}`).join("\n");

    it("returns the whole file when no budget is set", () => {
      writeFileSync(join(tempDir, ".agents", "SYSTEM", "SUMMARY.md"), longFile(120));
      const state = readProjectState(tempDir);
      expect(state.summary!.split("\n")).toHaveLength(120);
      expect(state.summary).not.toContain("...(truncated)");
      const size = state.sizes.find((s) => s.file === "summary")!;
      expect(size).toMatchObject({ present: true, lines: 120, sourceLines: 120, words: 240, truncated: false });
      expect(size.estTokens).toBe(Math.ceil(state.summary!.length / 4));
    });

    it("cuts at an explicit budget and flags it with the source line count", () => {
      writeFileSync(join(tempDir, ".agents", "SYSTEM", "SUMMARY.md"), longFile(120));
      const state = readProjectState(tempDir, { stateBudgetLines: 5 });
      expect(state.summary).toBe("row 1\nrow 2\nrow 3\nrow 4\nrow 5\n...(truncated)");
      const size = state.sizes.find((s) => s.file === "summary")!;
      expect(size).toMatchObject({ present: true, lines: 6, sourceLines: 120, truncated: true });
    });

    it("does not flag a file that fits inside the budget", () => {
      writeFileSync(join(tempDir, ".agents", "SYSTEM", "SUMMARY.md"), longFile(3));
      const state = readProjectState(tempDir, { stateBudgetLines: 5 });
      expect(state.sizes.find((s) => s.file === "summary")!.truncated).toBe(false);
    });

    it("reports absent files as not present, not as truncated", () => {
      const state = readProjectState(tempDir, { stateBudgetLines: 1 });
      expect(state.sizes.map((s) => s.file)).toEqual(["summary", "inbox", "taskFile", "nextSession"]);
      const next = state.sizes.find((s) => s.file === "nextSession")!;
      expect(next).toEqual({
        file: "nextSession",
        path: ".agents/SESSIONS/next-session.md",
        present: false,
        lines: 0,
        sourceLines: 0,
        words: 0,
        estTokens: 0,
        truncated: false,
      });
    });

    it("state.json: absent, invalid and valid are three distinguishable results (V2)", () => {
      expect(readStateJson(tempDir)).toEqual({ present: false, valid: false });
      expect(readProjectState(tempDir).stateJson).toEqual({ present: false, valid: false });
      // Absent adds nothing to the size block — v0.28.0 shape preserved.
      expect(readProjectState(tempDir).sizes.map((s) => s.file)).toEqual(["summary", "inbox", "taskFile", "nextSession"]);

      writeFileSync(join(tempDir, ".agents", "state.json"), "{ definitely not json");
      const invalid = readStateJson(tempDir);
      expect(invalid.present).toBe(true);
      expect(invalid.valid).toBe(false);
      expect(invalid.error).toMatch(/^\$: not valid JSON/);
      expect(invalid.data).toBeUndefined();

      writeFileSync(join(tempDir, ".agents", "state.json"), JSON.stringify({ schema_version: 1 }));
      const schemaFail = readProjectState(tempDir).stateJson;
      expect(schemaFail).toMatchObject({ present: true, valid: false });
      expect(schemaFail.error).toMatch(/^revision: /);

      cpSync(stateFixture, join(tempDir, ".agents", "state.json"));
      const state = readProjectState(tempDir);
      expect(state.stateJson.present).toBe(true);
      expect(state.stateJson.valid).toBe(true);
      expect(state.stateJson.data!.revision).toBe(7);
      // Present: it joins the size block as a fifth entry, never truncated.
      const size = state.sizes.find((s) => s.file === "stateJson")!;
      expect(size).toMatchObject({ path: ".agents/state.json", present: true, truncated: false });
      expect(size.words).toBeGreaterThan(100);
      // The prose files are still read alongside it (the size block shows the shrink).
      expect(state.summary).toContain("Knowledge recall");
    });

    it("readOptional: absent, whole, and cut are three distinguishable results", () => {
      const p = join(tempDir, "probe.md");
      expect(readOptional(p)).toEqual({ content: null, truncated: false, sourceLines: 0 });
      writeFileSync(p, "a\nb\nc");
      expect(readOptional(p)).toEqual({ content: "a\nb\nc", truncated: false, sourceLines: 3 });
      expect(readOptional(p, 2)).toEqual({ content: "a\nb\n...(truncated)", truncated: true, sourceLines: 3 });
      expect(readOptional(p, 3)).toEqual({ content: "a\nb\nc", truncated: false, sourceLines: 3 });
    });
  });
});
