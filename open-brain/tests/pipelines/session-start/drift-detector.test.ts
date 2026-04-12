import { describe, it, expect } from "vitest";
import { detectDrift } from "../../../src/pipelines/session-start/drift-detector.js";
import type { ProjectState } from "../../../src/pipelines/session-start/types.js";

describe("detectDrift", () => {
  const baseState: ProjectState = {
    mode: "project",
    version: "0.6.0",
    summary: "**Version:** 0.6.0\n## What's next\n- Build session-start",
    inbox: "- [x] Implement sync pipeline\n- [ ] Implement session-start pipeline",
    taskFile: null,
    nextSession: null,
    hasAgents: true,
    hasMeta: false,
  };

  it("returns empty array when no drift detected", () => {
    const drift = detectDrift(baseState);
    expect(drift).toHaveLength(0);
  });

  it("detects version mismatch in SUMMARY.md", () => {
    const state = { ...baseState, summary: "**Version:** 0.5.0\nSome content" };
    const drift = detectDrift(state);
    expect(drift.some((d) => d.field === "summary-version")).toBe(true);
  });

  it("detects completed INBOX items still listed as broken in SUMMARY", () => {
    const state = {
      ...baseState,
      summary: "**Version:** 0.6.0\n## What's broken\n- Implement sync pipeline",
      inbox: "- [x] Implement sync pipeline\n- [ ] Session-start",
    };
    const drift = detectDrift(state);
    expect(drift.some((d) => d.field === "summary-stale-broken")).toBe(true);
  });

  it("skips drift detection when SUMMARY is null", () => {
    const state = { ...baseState, summary: null };
    const drift = detectDrift(state);
    expect(drift).toHaveLength(0);
  });
});
