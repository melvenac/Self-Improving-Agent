import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  renderInbox,
  renderTaskFile,
  renderNextSession,
  renderSummaryRegion,
  applySummaryRegion,
  SUMMARY_BEGIN,
  SUMMARY_END,
} from "../../src/pipelines/state-views/index.js";
import { parseState, type State } from "../../src/shared/state-schema.js";

const fixtureText = readFileSync(join(import.meta.dirname, "../fixtures-state/state.json"), "utf-8");
const fixtureSummary = readFileSync(join(import.meta.dirname, "../fixtures/.agents/SYSTEM/SUMMARY.md"), "utf-8");
const state: State = (() => { const r = parseState(fixtureText); if (!r.ok) throw new Error(r.error); return r.data; })();
const opts = { version: "0.30.0" };
const HEADER = "<!-- generated from .agents/state.json rev 7 by open-brain v0.30.0 — do not edit; change state via ob_state -->";

describe("state views (Loop 3 C3)", () => {
  it("INBOX.md: generated header, legend, P0→P3 active sections, done section (V4)", () => {
    const text = renderInbox(state, opts);
    expect(text.split("\n")[0]).toBe(HEADER);
    expect(text).toContain("Legend: `[ ]` open · `[~]` in_progress · `[!]` blocked");
    expect(text).toContain("## P0\n\n- [~] **T-005** state.json strict schema module with parseState / serializeState — Loop 2 capability half");
    expect(text).toContain("- [!] **T-012** /end writes state.json through one structured tool — Loop 3; blocked on Loop 2 acceptance");
    expect(text).toContain("- [ ] **T-008** /sync state-schema check with skip-with-reason");
    expect(text).toContain("(supersedes T-023)");
    expect(text).toContain("## Done (last 3 sessions)\n\n- [x] **T-001** ob_start returns state, drift and session instead of booleans (session 54) — Loop 1, v0.28.0");
    // Order inside the sections follows priority, then file order.
    expect(text.indexOf("## P0")).toBeLessThan(text.indexOf("## P1"));
    expect(text.indexOf("## P1")).toBeLessThan(text.indexOf("## P2"));
    expect(text.indexOf("## P3")).toBeLessThan(text.indexOf("## Done"));
    expect(text.endsWith("\n")).toBe(true);
  });

  it("task.md: objective and the top 5 active tasks by priority (V4)", () => {
    const text = renderTaskFile(state, opts);
    expect(text.split("\n")[0]).toBe(HEADER);
    expect(text).toContain("## Objective\n\nReplace the four prose state files with a record: state.json read side, then /end writes it, then dogfood on this repo. _(since session 54)_");
    const items = text.split("\n").filter((l) => /^- \[.\] \*\*T-/.test(l));
    expect(items).toHaveLength(5);
    expect(items[0]).toBe("- [~] **T-005** [P0] state.json strict schema module with parseState / serializeState");
    // Fixture has four active P0 tasks (T-005/006/007/012), so the fifth slot is the first P1.
    expect(items.slice(0, 4).every((l) => l.includes("[P0]"))).toBe(true);
    expect(items[4]).toBe("- [ ] **T-008** [P1] /sync state-schema check with skip-with-reason");
    const noObjective = renderTaskFile({ ...state, objective: null }, opts);
    expect(noObjective).toContain("_No objective set._");
  });

  it("next-session.md: handoff fields and last session (V4)", () => {
    const text = renderNextSession(state, opts);
    expect(text.split("\n")[0]).toBe(HEADER);
    expect(text).toContain("## Pick up here _(written session 54)_\n\nLoop 2: run V1–V9 on the frozen tag");
    expect(text).toContain("## Watch out\n\n- The live MCP server stays on the old build until /mcp reconnect open-brain.");
    expect(text).toContain("## Open questions\n\n- Q2:");
    expect(text).toContain("## Last session\n\nSession 54 — 2026-09-14 — `f7a1b3d9-ef6d-482f-aba1-ddaa296f722b`");
  });

  it("SUMMARY region: status line, working / broken / next / decisions (V4)", () => {
    const region = renderSummaryRegion(state, opts);
    expect(region.startsWith(SUMMARY_BEGIN + "\n" + HEADER + "\n> **Status:** v0.30.0 — Replace the four prose state files")).toBe(true);
    expect(region.endsWith(SUMMARY_END)).toBe(true);
    expect(region).toContain("## What's working\n\n- ob_start returns non-empty summary, inbox, taskFile and nextSession for this repo _(V-001, 1 evidence)_");
    expect(region).toContain("- **[REOPENED]** ob_start honours the registered session id");
    expect(region).toContain("## What's broken\n\n- Gap G-001: Cursor start.md copies");
    expect(region).toContain("- Blocked T-012: /end writes state.json through one structured tool — Loop 3; blocked on Loop 2 acceptance");
    expect(region).toContain("## What's next\n\n- [P1] T-008 /sync state-schema check with skip-with-reason");
    // Decisions: last 5, newest (last-listed) first — R2, no date sort.
    const decisions = region.slice(region.indexOf("## Decisions")).split("\n").filter((l) => l.startsWith("- "));
    expect(decisions).toHaveLength(5);
    expect(decisions[0]).toMatch(/^- 2026-08-31 — Lifecycle evaluation stays out/);
    expect(decisions[4]).toMatch(/^- 2026-09-14 — Loop 2 is read side only/);
  });

  it("applySummaryRegion inserts after the title when markers are absent and preserves everything else (V4)", () => {
    const region = renderSummaryRegion(state, opts);
    const out = applySummaryRegion(fixtureSummary, region);
    const [before, after] = [out.slice(0, out.indexOf(SUMMARY_BEGIN)), out.slice(out.indexOf(SUMMARY_END) + SUMMARY_END.length)];
    // Title, a blank line, the region, then the original body from its first blank line on.
    expect(before).toBe("# Project Summary\n\n");
    expect(after).toBe(fixtureSummary.slice("# Project Summary".length));
    // Nothing of the original text is lost or reordered: only two newlines were added around the region.
    expect(before + after).toBe(fixtureSummary.replace("# Project Summary\n\n", "# Project Summary\n\n\n\n"));
  });

  it("applySummaryRegion replaces only the marked region; prose before and after is byte-identical (V4)", () => {
    const prose = "# Title\n\nIntro paragraph with **bold** and `code`.\n\n" + SUMMARY_BEGIN + "\nOLD GENERATED CONTENT\n" + SUMMARY_END + "\n\n## Architecture\n\nHand-written section.\n\n## History\n\n- 2026-01-01 something\n";
    const region = renderSummaryRegion(state, opts);
    const out = applySummaryRegion(prose, region);
    expect(out.startsWith("# Title\n\nIntro paragraph with **bold** and `code`.\n\n" + SUMMARY_BEGIN)).toBe(true);
    expect(out.endsWith(SUMMARY_END + "\n\n## Architecture\n\nHand-written section.\n\n## History\n\n- 2026-01-01 something\n")).toBe(true);
    expect(out).not.toContain("OLD GENERATED CONTENT");
    expect(out.slice(0, out.indexOf(SUMMARY_BEGIN))).toBe(prose.slice(0, prose.indexOf(SUMMARY_BEGIN)));
    expect(out.slice(out.indexOf(SUMMARY_END))).toBe(prose.slice(prose.indexOf(SUMMARY_END)));
  });

  it("re-rendering an already-rendered SUMMARY is idempotent (V4)", () => {
    const region = renderSummaryRegion(state, opts);
    const once = applySummaryRegion(fixtureSummary, region);
    const twice = applySummaryRegion(once, region);
    const thrice = applySummaryRegion(twice, renderSummaryRegion(state, opts));
    expect(twice).toBe(once);
    expect(thrice).toBe(once);
    expect(once.split(SUMMARY_BEGIN)).toHaveLength(2);
  });

  it("applySummaryRegion refuses an unpaired marker rather than guessing", () => {
    expect(() => applySummaryRegion("# T\n" + SUMMARY_BEGIN + "\nno end\n", "x")).toThrow(/unpaired state marker/);
  });

  it("applySummaryRegion keeps CRLF files CRLF", () => {
    const crlf = "# Title\r\n\r\nProse\r\n";
    const out = applySummaryRegion(crlf, SUMMARY_BEGIN + "\nline\n" + SUMMARY_END);
    expect(out).toBe("# Title\r\n\r\n" + SUMMARY_BEGIN + "\r\nline\r\n" + SUMMARY_END + "\r\n\r\nProse\r\n");
  });
});
