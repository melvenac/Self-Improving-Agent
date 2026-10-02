import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseState, type State } from "../../../src/shared/state-schema.js";
import { applyStateOps } from "../../../src/shared/state-writer.js";
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
  usage: "Usage: GREEN → dispatches open",
  latestBrief: "Latest brief: docs/loops/x-brief.md (2026-10-02)",
  workingTree: "Working tree: clean",
  skills: "Skills: none",
  ...over,
});

describe("renderBriefing: the sections, from the record alone", () => {
  const state = stateWith({ pick_up: "Do the thing.", watch_out: ["first <b>verbatim</b>", "second"], open_questions: ["still open?"] });
  const out = renderBriefing(input(state));

  it("opens and closes on the marked block, usage first, then the session line", () => {
    expect(out[0]).toBe(BRIEFING_START);
    expect(out[out.length - 1]).toBe(BRIEFING_END);
    expect(out[1]).toBe("Usage: GREEN → dispatches open");
    expect(out[2]).toBe(`Session 12 — 2026-10-03 · ${state.project.name} v9.9.9 · state rev ${state.revision}`);
    expect(out[3]).toBe("Drift: none");
  });

  it("the session number is the caller's (the record's), and a missing log says why instead of inventing one", () => {
    const none = renderBriefing(input(state, { sessionNumber: null, sessionNote: "no .agents/SESSIONS/ dir — log not created" }));
    expect(none[2]).toContain("Session (no .agents/SESSIONS/ dir — log not created)");
    expect(none[2]).not.toMatch(/^Session \d/);
  });

  it("drift is named, in one line", () => {
    const d = renderBriefing(input(state, { drift: [{ field: "summary-version", expected: "1.2.3", actual: "0.0.1", fixed: false }] }));
    expect(d[3]).toBe("Drift detected (1): summary-version: expected 1.2.3, got 0.0.1 (not fixed)");
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
    ["GREEN", "Usage: GREEN → dispatches open"],
    ["amber", "Usage: AMBER → small LIGHT tasks only, QA cap 2"],
    ["RED", "Usage: RED → devs finish the current step then park; planners rule and merge only"],
    ["STOP", "Usage: STOP → everyone parks until the 5-hour reset"],
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
    expect(describeUsage(root, { SIA_USAGE_FILE: green })).toBe("Usage: GREEN → dispatches open");
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
      ['{"usageLevel": "PURPLE"}', 'usageLevel "PURPLE" is not one of'],
      ["[1]", "has no usageLevel string"],
    ] as const) {
      seatFile(root, [`usage_file: ${slots(root, body)}`]);
      const line = describeUsage(root, {});
      expect(line.startsWith("Usage: not checked ("), line).toBe(true);
      expect(line).toContain(frag);
    }
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
    const sessionLine = block[2]!;
    const n = Number(sessionLine.match(/^Session (\d+) /)![1]);
    const expected = renderBriefing(
      input(parsed.data, {
        version: "1.0.0",
        sessionNumber: n,
        date: new Date().toISOString().slice(0, 10),
        usage: describeUsage(root),
        latestBrief: null,
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

  it("every start.md copy says to print the block verbatim and no longer carries the assembly template", () => {
    const repo = resolve(__dirname, "../../../..");
    for (const f of [".claude/commands/start.md", "project-template/.claude/commands/start.md", "project-template/.cursor/commands/start.md"]) {
      const body = readFileSync(join(repo, f), "utf8");
      expect(body, f).toContain("## End Briefing");
      expect(body, f).toContain("verbatim");
      expect(body, f).not.toContain("{objective text}");
      expect(body, f).not.toContain("top 3 by priority from the State block");
    }
  });
});
