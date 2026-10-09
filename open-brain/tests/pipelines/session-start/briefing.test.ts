import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseState, type State } from "../../../src/shared/state-schema.js";
import { applyStateOps } from "../../../src/shared/state-writer.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describeServingBuild } from "../../../src/pipelines/session-start/serving-build.js";
import { handleStart } from "../../../src/server.js";
import {
  BRIEFING_END,
  BRIEFING_START,
  describeSkills,
  describeUsage,
  describeWorkingTree,
  renderBriefing,
  type BriefingInput,
} from "../../../src/pipelines/session-start/briefing.js";
import { describeReadsOwed } from "../../../src/pipelines/session-start/reads-owed.js";
import { describeFleet } from "../../../src/pipelines/session-start/fleet.js";
import { renderState } from "../../../src/pipelines/session-start/state-render.js";

/**
 * T-233 B: the whole briefing is rendered in code. Pure-function rows hand `renderBriefing` a record; the usage rows write
 * real files; the ob_start rows run the real handleStart on a real repository and diff its block against the function's.
 */
const FIXTURE = JSON.parse(readFileSync(resolve(__dirname, "../../fixtures-state/state.json"), "utf8"));
const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});
const tmp = (prefix: string): string => {
  const d = mkdtempSync(join(tmpdir(), prefix));
  made.push(d);
  return d;
};

function stateWith(handoff: Record<string, unknown>, extra: Record<string, unknown> = {}): State {
  const raw = structuredClone(FIXTURE);
  raw.handoffs = [{ ...raw.handoffs[0], seat: "developer", session_uuid: "u-1", checkout: "sia-forge", ...handoff }];
  Object.assign(raw, extra);
  const parsed = parseState(JSON.stringify(raw));
  if (!parsed.ok) throw new Error(`fixture invalid: ${parsed.error}`);
  return parsed.data;
}

const input = (state: State, over: Partial<BriefingInput> = {}): BriefingInput => ({
  state,
  version: "9.9.9",
  seat: "developer",
  sessionNumber: 12,
  sessionNote: null,
  date: "2026-10-03",
  drift: [],
  serving: "Serving build: synthetic",
  usage: "Usage: GREEN → dispatches open",
  latestBrief: "Latest brief: docs/loops/x-brief.md (2026-10-02)",
  workingTree: "Working tree: clean",
  skills: "Skills: none",
  ...over,
});

describe("renderBriefing: the sections, from the record alone", () => {
  const state = stateWith({ pick_up: "Do the thing.", watch_out: ["first <b>verbatim</b>", "second"], open_questions: ["still open?"] });
  const out = renderBriefing(input(state));

  it("opens and closes on the marked block: serving build first, then usage, then the session line", () => {
    expect(out[0]).toBe(BRIEFING_START);
    expect(out[out.length - 1]).toBe(BRIEFING_END);
    expect(out[1]).toBe("Serving build: synthetic");
    expect(out[2]).toBe("Usage: GREEN → dispatches open");
    expect(out[3]).toBe(`Session 12 — 2026-10-03 · ${state.project.name} v9.9.9 · state rev ${state.revision}`);
    expect(out[4]).toBe("Drift: none");
  });

  it("the session number is the caller's (the record's), and a missing log says why instead of inventing one", () => {
    const none = renderBriefing(input(state, { sessionNumber: null, sessionNote: "no .agents/SESSIONS/ dir — log not created" }));
    expect(none[3]).toContain("Session (no .agents/SESSIONS/ dir — log not created)");
    expect(none[3]).not.toMatch(/^Session \d/);
  });

  it("drift is named, in one line", () => {
    const d = renderBriefing(input(state, { drift: [{ field: "summary-version", expected: "1.2.3", actual: "0.0.1", fixed: false }] }));
    expect(d[4]).toBe("Drift detected (1): summary-version: expected 1.2.3, got 0.0.1 (not fixed)");
  });

  it("NEXT is the top 3 by priority with the counts, and says it is a backlog and not a decision", () => {
    const i = out.indexOf("NEXT");
    expect(out.slice(i + 1, i + 4).every((l) => l.startsWith("- ["))).toBe(true);
    expect(out[i + 4]).toMatch(/^\d+ active \(\d+ P0, \d+ P1, \d+ P2, \d+ P3\); \d+ done\. Backlog order, not a decision/);
  });

  it("P2 and P3 are counts, never titles: NEXT skips them and a blocked one is counted (the State block treats them the same way)", () => {
    const t = (id: string, priority: string, status: string) => ({ ...FIXTURE.tasks[0], id, title: `${id} title text`, priority, status, closed_session: status === "done" ? 1 : null });
    const only = stateWith({ pick_up: "x", watch_out: [], open_questions: [] }, { tasks: [t("T-900", "P2", "blocked"), t("T-901", "P3", "open"), t("T-902", "P0", "done")] });
    const o = renderBriefing(input(only)).join("\n");
    expect(o).toContain("- (no active P0 or P1 task)");
    expect(o).toContain("- blocked: 1 P2/P3 task(s): INBOX.md");
    expect(o).not.toContain("T-900");
    expect(o).not.toContain("T-901");
    const mixed = stateWith({ pick_up: "x", watch_out: [], open_questions: [] }, { tasks: [t("T-910", "P1", "blocked"), t("T-911", "P0", "open")] });
    const m = renderBriefing(input(mixed)).join("\n");
    expect(m.indexOf("T-911 title text")).toBeLessThan(m.indexOf("T-910 title text")); // P0 before P1
    expect(m).toContain("- blocked: T-910 T-910 title text");
  });

  it("WATCH OUT prints every item verbatim", () => {
    const i = out.indexOf("WATCH OUT");
    expect(out.slice(i + 1, i + 3)).toEqual(["- first <b>verbatim</b>", "- second"]);
  });

  it("PICK UP HERE is the reader's OWN handoff, in full", () => {
    expect(out[out.indexOf("PICK UP HERE") + 1]).toBe("Do the thing.");
  });

  it("no handoff for the seat, and an unresolved seat, each say so", () => {
    expect(renderBriefing(input(state, { seat: "qa" })).join("\n")).toContain("none recorded for this seat (qa)");
    expect(renderBriefing(input(state, { seat: null })).join("\n")).toContain("this reader's seat is unresolved");
  });

  it("WATCH OUT and OPEN QUESTIONS are omitted when empty, not printed as placeholders", () => {
    const empty = renderBriefing(input(stateWith({ pick_up: "x", watch_out: [], open_questions: [] })));
    expect(empty).not.toContain("WATCH OUT");
    expect(empty).not.toContain("OPEN QUESTIONS");
  });

  it("BROKEN counts open gaps, names the newest, lists up to 5 newest first", () => {
    const i = out.findIndex((l) => l.startsWith("BROKEN ("));
    expect(i).toBeGreaterThan(0);
    expect(out[i]).toMatch(/^BROKEN \(\d+ gaps open; newest G-\d+\)$/);
    const listed = out.slice(i + 1).filter((l) => l.startsWith("- G-"));
    expect(listed.length).toBeLessThanOrEqual(5);
    const ids = listed.map((l) => Number(l.match(/^- G-(\d+)/)![1]));
    expect([...ids].sort((a, b) => b - a)).toEqual(ids);
  });

  it("the working tree, latest brief and skills lines come last, in that order; no brief means no line", () => {
    const tail = out.slice(-4);
    expect(tail).toEqual(["Working tree: clean", "Latest brief: docs/loops/x-brief.md (2026-10-02)", "Skills: none", BRIEFING_END]);
    expect(renderBriefing(input(state, { latestBrief: null })).join("\n")).not.toContain("Latest brief");
  });
});

describe("T-233 B item 6: a resolved open question is omitted and counted", () => {
  it("resolved ones are not printed, and N resolved, not shown is", () => {
    const state = stateWith({
      pick_up: "x",
      watch_out: [],
      open_questions: ["alive?", { text: "answered one", resolved_by: "D-110" }, { text: "object but unresolved" }, { text: "another answered", resolved_by: "PR #1" }],
    });
    const out = renderBriefing(input(state));
    const i = out.indexOf("OPEN QUESTIONS");
    expect(out.slice(i + 1, i + 4)).toEqual(["- alive?", "- object but unresolved", "(2 resolved, not shown)"]);
    expect(out.join("\n")).not.toContain("answered one");
  });

  it("all resolved: the header and the count remain, so 'none' and 'all answered' stay different facts", () => {
    const state = stateWith({ pick_up: "x", watch_out: [], open_questions: [{ text: "q", resolved_by: "D-1" }] });
    const out = renderBriefing(input(state));
    const i = out.indexOf("OPEN QUESTIONS");
    expect(out.slice(i, i + 2)).toEqual(["OPEN QUESTIONS", "(1 resolved, not shown)"]);
  });

  it("the State block of the same greeting does the same", () => {
    const state = stateWith({ pick_up: "x", watch_out: [], open_questions: ["open", { text: "gone", resolved_by: "D-9" }] });
    const text = renderState(state, "1.0.0", { seat: "developer" }).join("\n");
    expect(text).toContain("    - open");
    expect(text).toContain("(1 resolved, not shown)");
    expect(text).not.toContain("gone");
  });

  it("ob_state accepts resolved_by on set_handoff, and refuses an unknown key or an empty text", () => {
    const root = tmp("t233b-writer-");
    mkdirSync(join(root, ".agents"), { recursive: true });
    const base = structuredClone(FIXTURE);
    base.handoffs = [];
    writeFileSync(join(root, ".agents", "state.json"), JSON.stringify(base, null, 2) + "\n");
    const run = (open_questions: unknown[]) =>
      applyStateOps(root, {
        session: 1000,
        expected_revision: base.revision,
        ops: [{ op: "set_handoff", seat: "developer", pick_up: "p", watch_out: [], open_questions }],
        dry_run: true,
        render: false,
        session_uuid: "00000000-0000-4000-8000-0000000000aa",
      });
    const ok = run([{ text: "q", resolved_by: "D-1" }, "plain"]);
    expect(ok.ok, ok.error).toBe(true);
    expect(run([{ text: "q", surprise: 1 }]).ok).toBe(false);
    expect(run([{ text: "" }]).ok).toBe(false);
  });
});

describe("T-233 B item 4: the Usage line", () => {
  const seatFile = (root: string, keys: string[]): void => {
    mkdirSync(join(root, ".agents"), { recursive: true });
    writeFileSync(join(root, ".agents", "AGENT.local.md"), ["---", "name: X", "role: planner", ...keys, "---", ""].join("\n"));
  };
  const slots = (dir: string, body: string): string => {
    const p = join(dir, "slots.json");
    writeFileSync(p, body);
    return p;
  };

  it.each([
    ["GREEN", "Usage: GREEN + weekly not checked → dispatches open"],
    ["amber", "Usage: AMBER + weekly not checked → small LIGHT tasks only, QA cap 2"],
    ["RED", "Usage: RED + weekly not checked → devs finish the current step then park; planners rule and merge only"],
    ["STOP", "Usage: STOP + weekly not checked → everyone parks until the 5-hour reset"],
  ])("a valid file with usageLevel %s prints its consequence", (level, line) => {
    const root = tmp("t233b-usage-");
    seatFile(root, [`usage_file: ${slots(root, JSON.stringify({ usageLevel: level, other: 1 }))}`]);
    expect(describeUsage(root, {})).toBe(line);
  });

  it("the path may come from SIA_USAGE_FILE, and seat data wins over it", () => {
    const root = tmp("t233b-usage-env-");
    const green = slots(root, JSON.stringify({ usageLevel: "GREEN" }));
    mkdirSync(join(root, "b"));
    const red = slots(join(root, "b"), JSON.stringify({ usageLevel: "RED" }));
    expect(describeUsage(root, { SIA_USAGE_FILE: green })).toBe("Usage: GREEN + weekly not checked → dispatches open");
    seatFile(root, [`usage_file: ${red}`]);
    expect(describeUsage(root, { SIA_USAGE_FILE: green })).toMatch(/^Usage: RED/);
  });

  it("no path anywhere is not checked, with the reason", () => {
    expect(describeUsage(tmp("t233b-usage-none-"), {})).toBe("Usage: not checked (no usage_file in seat data and no SIA_USAGE_FILE)");
  });

  it("an ABSENT file is not checked and names the path", () => {
    const root = tmp("t233b-usage-absent-");
    const p = join(root, "gone.json");
    seatFile(root, [`usage_file: ${p}`]);
    expect(describeUsage(root, {})).toBe(`Usage: not checked (${p} does not exist)`);
  });

  it("MALFORMED JSON is not checked", () => {
    const root = tmp("t233b-usage-bad-");
    seatFile(root, [`usage_file: ${slots(root, "{ nope")}`]);
    expect(describeUsage(root, {})).toMatch(/^Usage: not checked \(.*is not readable JSON: /);
  });

  it("valid JSON with no usageLevel, a non-string level, and an unknown level are each not checked", () => {
    const root = tmp("t233b-usage-shape-");
    for (const [body, frag] of [
      ["{}", "has no usageLevel string"],
      ['{"usageLevel": 3}', "has no usageLevel string"],
      ['{"usageLevel": "PURPLE"}', 'usageLevel "PURPLE" does not start with one of'],
      ["[1]", "has no usageLevel string"],
    ] as const) {
      seatFile(root, [`usage_file: ${slots(root, body)}`]);
      const line = describeUsage(root, {});
      expect(line.startsWith("Usage: not checked ("), line).toBe(true);
      expect(line).toContain(frag);
    }
  });

  // The REAL file's shape (atlas-sia, from the desktop's slots.json): usageLevel is an object. Values here are synthetic.
  const realShape = (over: Record<string, unknown> = {}): string =>
    JSON.stringify({
      usageLevel: {
        level: "RED + WEEKLY95",
        fiveHourPct: 87,
        sevenDayPct: 95,
        fiveHourResetsAt: "2026-10-03T03:15:00.000Z",
        set: "2026-10-02T21:09:00.000Z",
        note: "synthetic note",
        rules: "~/Worktrees/usage-winddown-rules.md",
        ...over,
      },
    });
  /** After `set`, before `fiveHourResetsAt`, and within 45m of `set` — no STALE suffix. */
  const USAGE_NOW = new Date("2026-10-02T21:30:00.000Z");
  const usageFor = (body: string): string => {
    const root = tmp("t233b-usage-obj-");
    seatFile(root, [`usage_file: ${slots(root, body)}`]);
    return describeUsage(root, {}, USAGE_NOW);
  };

  it("the real object shape: the 5-hour token, the numbers, the weekly cap, in the ruled format", () => {
    expect(usageFor(realShape())).toBe(
      "Usage: RED (5h 87%, resets 10-02 22:15 CDT; week 95%) + WEEKLY 95% → devs finish the current step then park; planners rule and merge only; no new QA, tasks or dispatches",
    );
  });

  it("a one-word level, and free text with a LEADING WORD, both give the 5-hour level", () => {
    expect(usageFor(realShape({ level: "GREEN", fiveHourPct: 4, sevenDayPct: 40, fiveHourResetsAt: "2026-10-03T05:00:00Z" }))).toBe(
      "Usage: GREEN (5h 4%, resets 10-03 00:00 CDT; week 40%) → dispatches open",
    );
    expect(usageFor(realShape({ level: "amber (5h 60%); weekly 97%: hold except T-233", fiveHourPct: 60, sevenDayPct: 20 }))).toBe(
      "Usage: AMBER (5h 60%, resets 10-02 22:15 CDT; week 20%) → small LIGHT tasks only, QA cap 2",
    );
  });

  it("percentages are NEVER read out of the level text: the prose says 97, the number is absent, so weekly is not checked", () => {
    const { usageLevel } = JSON.parse(realShape({ level: "GREEN (5h 4%); weekly 97%: hold" })) as { usageLevel: Record<string, unknown> };
    delete usageLevel.sevenDayPct;
    const line = usageFor(JSON.stringify({ usageLevel }));
    expect(line).toContain("+ weekly not checked");
    expect(line).not.toContain("97");
    expect(line).not.toContain("no new QA");
  });

  it("an object without sevenDayPct says weekly not checked, and keeps the 5-hour part", () => {
    const { usageLevel } = JSON.parse(realShape()) as { usageLevel: Record<string, unknown> };
    delete usageLevel.sevenDayPct;
    expect(usageFor(JSON.stringify({ usageLevel }))).toBe(
      "Usage: RED (5h 87%, resets 10-02 22:15 CDT) + weekly not checked → devs finish the current step then park; planners rule and merge only",
    );
  });

  it("the weekly consequence follows sevenDayPct: below 95 adds nothing, 95 and 96 hold, 98 winds down", () => {
    expect(usageFor(realShape({ sevenDayPct: 94.9 }))).not.toContain("WEEKLY");
    expect(usageFor(realShape({ sevenDayPct: 95 }))).toContain("+ WEEKLY 95% →");
    expect(usageFor(realShape({ sevenDayPct: 96 }))).toContain("no new QA, tasks or dispatches");
    const wind = usageFor(realShape({ sevenDayPct: 98 }));
    expect(wind).toContain("park, push WIP");
    expect(wind).not.toContain("no new QA");
  });

  // T-234 A: the window that CAUSED the band comes first, and a weekly STOP is not blamed on (or lifted by) the 5-hour reset.
  it("a WEEKLY stop names the weekly window first and the 5-hour window last, in the pinned shape", () => {
    expect(usageFor(realShape({ level: "STOP", fiveHourPct: 14, sevenDayPct: 98, fiveHourResetsAt: "2026-10-03T02:50:00Z" }))).toBe(
      "Usage: STOP (weekly 98%) · park, push WIP · 5h 14%",
    );
    expect(usageFor(realShape({ level: "STOP (5h 14%, resets 02:50Z) + WEEKLY 98%", fiveHourPct: 14, sevenDayPct: 99 }))).toBe(
      "Usage: STOP (weekly 99%) · park, push WIP · 5h 14%",
    );
  });

  it("a weekly stop without a 5-hour number omits that segment; the 5-hour reset is never named", () => {
    const { usageLevel } = JSON.parse(realShape({ level: "STOP", sevenDayPct: 98 })) as { usageLevel: Record<string, unknown> };
    delete usageLevel.fiveHourPct;
    const line = usageFor(JSON.stringify({ usageLevel }));
    expect(line).toBe("Usage: STOP (weekly 98%) · park, push WIP");
    expect(line).not.toContain("5-hour reset");
  });

  it("QA 264: at weekly >= 98 the band word is STOP whatever the file's level says; GREEN is never printed", () => {
    for (const level of ["GREEN", "AMBER", "RED", "STOP"]) {
      expect(usageFor(realShape({ level, fiveHourPct: 10, sevenDayPct: 98 }))).toBe("Usage: STOP (weekly 98%) · park, push WIP · 5h 10%");
    }
    expect(usageFor(realShape({ level: "GREEN (5h 4%); weekly 99%", fiveHourPct: 4, sevenDayPct: 99 }))).toBe("Usage: STOP (weekly 99%) · park, push WIP · 5h 4%");
    // below the line the file's own band stands
    expect(usageFor(realShape({ level: "GREEN", fiveHourPct: 4, sevenDayPct: 97 }))).toMatch(/^Usage: GREEN \(5h 4%, resets /);
  });

  it("a weeklyOverride does not lift the weekly stop (it names a lifted hold at 95-97 only)", () => {
    expect(usageFor(realShape({ level: "STOP", fiveHourPct: 14, sevenDayPct: 98, weeklyOverride: "T-233" }))).toBe("Usage: STOP (weekly 98%) · park, push WIP · 5h 14%");
  });

  it("a STOP from the 5-hour window keeps the 5-hour reset text and the 5-hour window first", () => {
    expect(usageFor(realShape({ level: "STOP", fiveHourPct: 100, sevenDayPct: 40, fiveHourResetsAt: "2026-10-03T02:50:00Z" }))).toBe(
      "Usage: STOP (5h 100%, resets 10-02 21:50 CDT; week 40%) → everyone parks until the 5-hour reset",
    );
  });

  it("QA 263 F2: at >= 98 the wind-down holds even WITH an override, which is neither named nor allowed to hold instead", () => {
    for (const pct of [98, 99, 100]) {
      const line = usageFor(realShape({ level: "STOP", fiveHourPct: 10, sevenDayPct: pct, weeklyOverride: "T-233" }));
      expect(line).toBe(`Usage: STOP (weekly ${pct}%) · park, push WIP · 5h 10%`);
      expect(line).not.toContain("T-233");
      expect(line).not.toContain("no new QA");
    }
    expect(usageFor(realShape({ sevenDayPct: 97.9, weeklyOverride: "T-233" }))).toContain("except T-233 (Aaron's lift)");
  });

  it("QA 263: usage_file is read from the tracked AGENT.md when AGENT.local.md has no such key", () => {
    const root = tmp("t234b-usage-tracked-");
    const p = slots(root, JSON.stringify({ usageLevel: "AMBER" }));
    mkdirSync(join(root, ".agents"), { recursive: true });
    writeFileSync(join(root, ".agents", "AGENT.md"), ["---", "name: X", `usage_file: ${p}`, "---", ""].join("\n"));
    seatFile(root, []);
    expect(describeUsage(root, {})).toBe("Usage: AMBER + weekly not checked → small LIGHT tasks only, QA cap 2");
  });

  it("weeklyOverride names the lifted loop at >= 95 only; absent or null changes nothing", () => {
    expect(usageFor(realShape({ sevenDayPct: 96, weeklyOverride: "T-233" }))).toContain("no new QA, tasks or dispatches except T-233 (Aaron's lift)");
    expect(usageFor(realShape({ sevenDayPct: 96, weeklyOverride: null }))).toMatch(/no new QA, tasks or dispatches/);
    expect(usageFor(realShape({ sevenDayPct: 96, weeklyOverride: "  " }))).toMatch(/no new QA, tasks or dispatches$/);
    expect(usageFor(realShape({ sevenDayPct: 90, weeklyOverride: "T-233" }))).not.toContain("T-233");
  });

  it("an unknown or missing leading word is not checked; a number in the wrong place is not a level", () => {
    for (const level of ["PURPLE (5h 1%)", "", "   ", "87% RED", 5]) {
      const line = usageFor(realShape({ level }));
      expect(line.startsWith("Usage: not checked ("), `${JSON.stringify(level)} -> ${line}`).toBe(true);
    }
    expect(usageFor(JSON.stringify({ usageLevel: { fiveHourPct: 5 } }))).toContain("has no usageLevel string or usageLevel.level string");
  });

  it("a bad timestamp drops only the reset time", () => {
    const { usageLevel } = JSON.parse(realShape({ fiveHourResetsAt: "soon" })) as { usageLevel: Record<string, unknown> };
    delete usageLevel.sevenDayPct;
    expect(usageFor(JSON.stringify({ usageLevel }))).toBe(
      "Usage: RED (5h 87%) + weekly not checked → devs finish the current step then park; planners rule and merge only",
    );
  });

  it("a relative path and an unfilled placeholder are not checked", () => {
    const root = tmp("t233b-usage-path-");
    seatFile(root, ["usage_file: slots.json"]);
    expect(describeUsage(root, {})).toContain("is not an absolute path");
    seatFile(root, ["usage_file: <path-to-slots.json>"]);
    expect(describeUsage(root, {})).toContain("unfilled placeholder");
  });
});

describe("collectors: working tree and skills", () => {
  it("working tree: clean, dirty with paths, and not-a-repo each say so", () => {
    const root = tmp("t233b-wt-");
    execFileSync("git", ["init", "-q"], { cwd: root });
    expect(describeWorkingTree(root)).toBe("Working tree: clean");
    writeFileSync(join(root, "a.txt"), "x");
    writeFileSync(join(root, "b.txt"), "x");
    expect(describeWorkingTree(root)).toBe("Working tree: 2 uncommitted: a.txt, b.txt");
    expect(describeWorkingTree(tmp("t233b-wt-nogit-"))).toMatch(/^Working tree: not checked \(git: /);
  });

  it("skills: the table's names, none when the table is empty, and a named absence", () => {
    const root = tmp("t233b-skills-");
    expect(describeSkills(root)).toBe("Skills: none (no .agents/skills/INDEX.md)");
    mkdirSync(join(root, ".agents", "skills"), { recursive: true });
    const idx = join(root, ".agents", "skills", "INDEX.md");
    writeFileSync(idx, "# Skills\n\n| Skill | Directory | Description | Created |\n|---|---|---|---|\n| alpha | `alpha/` | d | 2026-01-01 |\n| beta | `beta/` | d | 2026-01-02 |\n");
    expect(describeSkills(root)).toBe("Skills: alpha, beta");
    writeFileSync(idx, "# Skills\n\n| Skill | Directory | Description | Created |\n|---|---|---|---|\n");
    expect(describeSkills(root)).toBe("Skills: none");
  });
});

describe("ob_start carries the same block, and every /start copy prints it verbatim", { timeout: 60_000 }, () => {
  function project(): string {
    const root = tmp("t233b-start-");
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["config", "user.email", "t@example.invalid"], { cwd: root });
    execFileSync("git", ["config", "user.name", "t"], { cwd: root });
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
    for (const d of ["SYSTEM", "TASKS", "SESSIONS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
    for (const [rel, body] of [["SYSTEM/SUMMARY.md", "# S\n"], ["TASKS/INBOX.md", "# I\n"], ["TASKS/task.md", "# T\n"], ["SESSIONS/next-session.md", "# N\n"]] as const) {
      writeFileSync(join(root, ".agents", rel), body);
    }
    const raw = structuredClone(FIXTURE);
    raw.handoffs = [{ ...raw.handoffs[0], seat: "developer", session_uuid: "u-1", checkout: "x", pick_up: "Pick this up.", watch_out: ["w1"], open_questions: ["q1", { text: "q2", resolved_by: "D-1" }] }];
    writeFileSync(join(root, ".agents", "state.json"), JSON.stringify(raw, null, 2) + "\n");
    writeFileSync(join(root, ".agents", "AGENT.local.md"), ["---", "name: Fixture", "role: developer", "partner: Other", "---", ""].join("\n"));
    execFileSync("git", ["add", "-A"], { cwd: root });
    execFileSync("git", ["commit", "-q", "-m", "seed"], { cwd: root });
    return root;
  }

  it("the block in ob_start's output is exactly renderBriefing's output for the same record", async () => {
    const root = project();
    const text = (await handleStart({ project_root: root })).content[0]!.text;
    const lines = text.split("\n");
    const a = lines.indexOf(BRIEFING_START);
    const b = lines.indexOf(BRIEFING_END);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    const block = lines.slice(a, b + 1);

    const parsed = parseState(readFileSync(join(root, ".agents", "state.json"), "utf8"));
    if (!parsed.ok) throw new Error(parsed.error);
    const sessionLine = block[3]!;
    const n = Number(sessionLine.match(/^Session (\d+) /)![1]);
    const startNow = new Date();
    const expected = renderBriefing(
      input(parsed.data, {
        version: "1.0.0",
        sessionNumber: n,
        serving: block[1]!,
        date: new Date().toISOString().slice(0, 10),
        usage: describeUsage(root, process.env, startNow),
        latestBrief: null,
        readsOwed: describeReadsOwed(root, parsed.data, n, "developer", "x"),
        fleet: describeFleet(parsed.data.project.name, process.env, startNow),
        workingTree: describeWorkingTree(root),
        skills: describeSkills(root),
      }),
    );
    expect(block).toEqual(expected);
    // and the facts that matter in it
    expect(block).toContain("Pick this up.");
    expect(block).toContain("- w1");
    expect(block).toContain("(1 resolved, not shown)");
    expect(block.join("\n")).not.toContain("q2");
  });

  /** A serving tree whose build is stamped `behind` commits before origin/master; returns its build directory. */
  function servingBuildDir(behind: number): string {
    const base = tmp("t233b-serving-");
    const origin = join(base, "origin.git");
    const seed = join(base, "seed");
    const tree = join(base, "tree");
    mkdirSync(origin);
    mkdirSync(seed);
    const g = (cwd: string, ...a: string[]): string => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    g(origin, "init", "-q", "--bare", "-b", "master");
    g(seed, "init", "-q", "-b", "master");
    g(seed, "config", "user.email", "t@example.invalid");
    g(seed, "config", "user.name", "t");
    g(seed, "remote", "add", "origin", origin);
    const shas: string[] = [];
    for (let i = 0; i < behind + 1; i++) {
      mkdirSync(join(seed, "open-brain", "src"), { recursive: true });
      writeFileSync(join(seed, "open-brain", "src", "f.txt"), `v${i}\n`); // a SERVED path: records-only commits are not stale (T-234 A)
      g(seed, "add", "-A");
      g(seed, "commit", "-q", "-m", `c${i}`);
      shas.push(g(seed, "rev-parse", "HEAD"));
    }
    g(seed, "push", "-q", "origin", "master");
    execFileSync("git", ["clone", "-q", origin, tree], { stdio: "ignore" });
    const buildDir = join(tree, "open-brain", "build");
    mkdirSync(buildDir, { recursive: true });
    writeFileSync(join(buildDir, "build-info.json"), JSON.stringify({ commit: shas[0], builtAt: "2026-10-01T10:00:00.000Z", reason: null }));
    return buildDir;
  }

  const blockOf = (text: string): string[] => {
    const lines = text.split("\n");
    return lines.slice(lines.indexOf(BRIEFING_START), lines.indexOf(BRIEFING_END) + 1);
  };

  it("T-233 A+B: the Briefing block's FIRST line is the serving-build line, and it is the greeting's first line too (not checked)", async () => {
    const text = (await handleStart({ project_root: project() })).content[0]!.text;
    const block = blockOf(text);
    expect(block[1]!.startsWith("Serving build: not checked (")).toBe(true);
    expect(block[1]).toBe(text.split("\n")[0]);
  });

  it("T-233 A+B: a STALE serving build is inside the block, above Usage, and the same line opens the greeting", async () => {
    const text = (await handleStart({ project_root: project(), serving_build_dir: servingBuildDir(2) })).content[0]!.text;
    const block = blockOf(text);
    expect(block[1]).toMatch(/^Build [0-9a-f]{7} · STALE: 2 code commits behind → ask Aaron to update$/);
    expect(block[2]!.startsWith("Usage: ")).toBe(true);
    expect(block[1]).toBe(text.split("\n")[0]);
  });

  it("QA 263 row 1: a LEVEL serving build is the block's first line too, and the greeting's", async () => {
    const text = (await handleStart({ project_root: project(), serving_build_dir: servingBuildDir(0) })).content[0]!.text;
    const block = blockOf(text);
    expect(block[1]).toMatch(/^Build [0-9a-f]{7} · current$/);
    expect(block[1]).toBe(text.split("\n")[0]);
  });

  // QA 263 F4 (A+B): serving_build_dir is a test seam, "deliberately NOT in the tool schema". Only a call through the real MCP
  // server (stdio, the path every runtime's /start takes) can show that; the key must be absent from tools/list and stripped on call.
  it("QA 263 F4: serving_build_dir is not in ob_start's MCP schema, is stripped from a call, and the MCP block is renderBriefing's", async () => {
    const ob = resolve(__dirname, "../../..");
    const transport = new StdioClientTransport({
      command: join(ob, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx"),
      args: [join(ob, "src", "server.ts")],
      cwd: ob,
      env: { ...(process.env as Record<string, string>) },
      stderr: "ignore",
    });
    const client = new Client({ name: "t234b-probe", version: "0.0.0" });
    await client.connect(transport);
    try {
      const start = (await client.listTools()).tools.find((t) => t.name === "ob_start")!;
      const props = Object.keys((start.inputSchema as { properties?: Record<string, unknown> }).properties ?? {});
      expect(props).toContain("project_root");
      expect(props).not.toContain("serving_build_dir");

      const stale = servingBuildDir(4);
      // Control: called directly this fixture IS stale, so a key that got through would print STALE.
      expect(describeServingBuild(stale)).toMatch(/ · STALE: 4 code commits behind/);

      const root = project();
      const res = (await client.callTool({ name: "ob_start", arguments: { project_root: root, serving_build_dir: stale } })) as {
        content: { type: string; text: string }[];
        isError?: boolean;
      };
      expect(res.isError ?? false).toBe(false);
      const text = res.content[0]!.text;
      const first = text.split("\n")[0]!;
      expect(first.startsWith("Serving build: not checked (")).toBe(true);
      expect(text).not.toContain("STALE");

      const block = blockOf(text);
      const parsed = parseState(readFileSync(join(root, ".agents", "state.json"), "utf8"));
      if (!parsed.ok) throw new Error(parsed.error);
      const startNow = new Date();
      const sessionNumber = Number(block[3]!.match(/^Session (\d+) /)![1]);
      expect(block).toEqual(
        renderBriefing(
          input(parsed.data, {
            version: "1.0.0",
            sessionNumber,
            serving: first,
            date: new Date().toISOString().slice(0, 10),
            usage: describeUsage(root, process.env, startNow),
            latestBrief: null,
            readsOwed: describeReadsOwed(root, parsed.data, sessionNumber, "developer", "x"),
            fleet: describeFleet(parsed.data.project.name, process.env, startNow),
            workingTree: describeWorkingTree(root),
            skills: describeSkills(root),
          }),
        ),
      );
    } finally {
      await client.close();
    }
  }, 120_000);

  it("every start.md copy says to print the block verbatim and no longer carries the assembly template", () => {
    const repo = resolve(__dirname, "../../../..");
    for (const f of [".claude/commands/start.md", "project-template/.claude/commands/start.md", "project-template/.cursor/commands/start.md"]) {
      const body = readFileSync(join(repo, f), "utf8");
      // QA 263 F7: the block's first line is the serving-build line, and the brief is the narrowed name, not `*brief*.md`.
      expect(body, f).toContain("the serving-build line first, then usage");
      expect(body, f).not.toContain("`*brief*.md`");
      expect(body, f).toContain("## End Briefing");
      expect(body, f).toContain("verbatim");
      expect(body, f).not.toContain("{objective text}");
      expect(body, f).not.toContain("top 3 by priority from the State block");
    }
  });
});
