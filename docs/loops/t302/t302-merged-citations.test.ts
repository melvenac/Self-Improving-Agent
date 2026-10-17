// T-302: the greeting names the SHAs the reader's own handoff cites that the upstream branch already contains.
// Rows cite FULL 40-char SHAs: a short prefix of a fresh commit can be all digits (about 2% for 8 chars), which the scan
// skips by design, and that would make a row flaky (SIM T302, 10-16).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { citedShas, describeMergedCitations } from "../../../src/pipelines/session-start/handoff-merged.js";
import { renderBriefing, type BriefingInput } from "../../../src/pipelines/session-start/briefing.js";
import { parseState, type Handoff, type State } from "../../../src/shared/state-schema.js";

const FIXTURES = join(import.meta.dirname, "../../fixtures-state");
let root = "";
const main: string[] = [];
let side = "";
const short = (s: string): string => s.slice(0, 8);

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "ob-t302-"));
  git(["init", "-q", "-b", "work"]);
  git(["config", "user.email", "t302@example.invalid"]);
  git(["config", "user.name", "t302"]);
  for (let i = 1; i <= 5; i++) { git(["commit", "-q", "--allow-empty", "-m", `main ${i}`]); main.push(git(["rev-parse", "HEAD"])); }
  git(["update-ref", "refs/remotes/origin/main", main[4]!]);
  git(["commit", "-q", "--allow-empty", "-m", "side, not in origin/main"]);
  side = git(["rev-parse", "HEAD"]);
});
afterAll(() => { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });

function handoff(over: Partial<Handoff> = {}): Handoff {
  return { seat: "planner", pick_up: "", watch_out: [], open_questions: [], session: 1, loop_state: null, session_uuid: "u-1", checkout: "c", first_rev: 1, ...over } as unknown as Handoff;
}

describe("T-302", () => {
  it("M1: a cited SHA the upstream contains is named; one it does not contain is not", () => {
    const h = handoff({ pick_up: `PR heads ${main[1]} and ${side} wait on Aaron's merge word.` });
    expect(describeMergedCitations(root, h, "origin/main")).toBe(`Already in origin/main (last fetch): ${short(main[1]!)}`);
  });

  it("M2: nothing contained, no handoff, or an unknown ref prints nothing", () => {
    expect(describeMergedCitations(root, handoff({ pick_up: `only ${side}` }), "origin/main")).toBeNull();
    expect(describeMergedCitations(root, null, "origin/main")).toBeNull();
    expect(describeMergedCitations(root, handoff({ pick_up: main[0]! }), "origin/nope")).toBeNull();
  });

  it("M3: scans watch-outs, UNRESOLVED questions and open PRs; skips resolved questions and all-digit tokens", () => {
    const h = handoff({
      pick_up: "rev 20261016 and 1234567 are numbers",
      watch_out: [`watch ${main[0]}`],
      open_questions: [{ text: `merge ${main[1]}?`, owner: "aaron" }, { text: `old ${main[2]}`, resolved_by: "done" }],
      loop_state: { open_prs: [{ ref: "#7", qa_status: "accepted", note: `head ${main[3]}` }], frozen_sha: null, questions_for_aaron: [], rulings: [] },
    } as Partial<Handoff>);
    expect(citedShas(h)).toEqual([main[0], main[1], main[3]]);
  });

  it("M4: at most four are shown, then (+N)", () => {
    const h = handoff({ pick_up: main.join(" ") });
    expect(describeMergedCitations(root, h, "origin/main")).toBe(`Already in origin/main (last fetch): ${main.slice(0, 4).map(short).join(", ")} (+1)`);
  });

  describe("M5-M6: the briefing carries it without adding a budgeted line or growing the pick-up line", () => {
    const stateWithPickUp = (pick_up: string): State => {
      const raw = JSON.parse(readFileSync(join(FIXTURES, "state.json"), "utf8"));
      raw.handoffs = [{ seat: "developer", session: 5, pick_up, watch_out: [], open_questions: [], loop_state: null, session_uuid: "u-own", checkout: "sia-builder", first_rev: 1 }];
      const parsed = parseState(JSON.stringify(raw));
      if (!parsed.ok) throw new Error(parsed.error);
      return parsed.data;
    };
    const base = (state: State, over: Partial<BriefingInput> = {}): BriefingInput => ({
      state, version: "9.9.9", seat: "developer", sessionNumber: 160, sessionNote: null, date: "2026-10-03", drift: [],
      serving: "Build abc1234 · current", usage: "Usage: GREEN → dispatches open", latestBrief: null,
      workingTree: "Working tree: clean", skills: "Skills: none", ...over,
    });
    const NOTE = "Already in origin/main (last fetch): 429d521e";
    const pickUpLine = (lines: string[]): string => lines[lines.indexOf("PICK UP HERE") + 1]!;

    it("M5 budgeted: appended after the missing-handoff notice; same line count", () => {
      const s = stateWithPickUp("pick up 5");
      const without = renderBriefing(base(s, { budget: true }));
      const withIt = renderBriefing(base(s, { budget: true, mergedCitations: NOTE }));
      expect(withIt).toHaveLength(without.length);
      expect(pickUpLine(withIt)).toBe(`pick up 5 · ${NOTE}`);
      expect(pickUpLine(renderBriefing(base(s, { budget: true, missingHandoff: "Handoff MISSING: x", mergedCitations: NOTE })))).toBe(`pick up 5 · Handoff MISSING: x · ${NOTE}`);
    });

    it("M5 legacy: its own line after the pick-up; absent or null is byte-identical", () => {
      const s = stateWithPickUp("pick up 5");
      const lines = renderBriefing(base(s, { mergedCitations: NOTE }));
      expect(lines[lines.indexOf("PICK UP HERE") + 2]).toBe(NOTE);
      expect(renderBriefing(base(s, { mergedCitations: null }))).toEqual(renderBriefing(base(s)));
      expect(renderBriefing(base(s, { budget: true, mergedCitations: null }))).toEqual(renderBriefing(base(s, { budget: true })));
    });

    it("M6 budgeted: a pick-up past its cap gives up the note's room, so the line is no longer than without the note", () => {
      const s = stateWithPickUp("x".repeat(1500));
      const without = pickUpLine(renderBriefing(base(s, { budget: true })));
      const withIt = pickUpLine(renderBriefing(base(s, { budget: true, mergedCitations: NOTE })));
      expect(withIt.endsWith(` · ${NOTE}`)).toBe(true);
      expect(withIt.length).toBeLessThanOrEqual(without.length);
    });
  });
});
