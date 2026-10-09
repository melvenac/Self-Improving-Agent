/**
 * BRIEFING-FIX acceptance rows BF-H, BF-U, BF-R, BF-F (docs/loops/briefing-fix-brief.md §6).
 */
import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseState, type State } from "../../../src/shared/state-schema.js";
import {
  BRIEFING_END,
  chicagoStamp,
  describeUsage,
  renderBriefing,
  type BriefingInput,
} from "../../../src/pipelines/session-start/briefing.js";
import { describeReadsOwed } from "../../../src/pipelines/session-start/reads-owed.js";
import { describeFleet, fleetProjectKey } from "../../../src/pipelines/session-start/fleet.js";

const FIXTURE = JSON.parse(readFileSync(join(import.meta.dirname, "../../fixtures-state/state.json"), "utf8"));
const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});
function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  tmps.push(d);
  return d;
}
function git(cwd: string, ...args: string[]): void {
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
function gitAt(cwd: string, when: string, ...args: string[]): void {
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_COMMITTER_DATE: when, GIT_AUTHOR_DATE: when },
  });
}
function slots(dir: string, body: string): string {
  const p = join(dir, "slots.json");
  writeFileSync(p, body);
  return p;
}
function seatUsage(root: string, path: string): void {
  mkdirSync(join(root, ".agents"), { recursive: true });
  writeFileSync(join(root, ".agents", "AGENT.md"), `---\nusage_file: ${path}\n---\n`);
}

const baseInput = (over: Partial<BriefingInput> = {}): BriefingInput => {
  const raw = structuredClone(FIXTURE);
  const parsed = parseState(JSON.stringify(raw));
  if (!parsed.ok) throw new Error(parsed.error);
  return {
    state: parsed.data,
    version: "1.0.0",
    seat: "developer",
    sessionNumber: 10,
    sessionNote: null,
    date: "2026-10-08",
    drift: [],
    serving: "Serving build: x",
    usage: "Usage: GREEN → dispatches open",
    latestBrief: "Latest brief: docs/loops/x-brief.md (2026-10-01)",
    workingTree: "Working tree: clean",
    skills: "Skills: none",
    ...over,
  };
};

describe("BF-H1: plain ## Briefing header", () => {
  it("legacy and budgeted layouts open with ## Briefing", () => {
    expect(renderBriefing(baseInput())[0]).toBe("## Briefing");
    expect(renderBriefing(baseInput({ budget: true }))[0]).toBe("## Briefing");
  });
});

describe("BF-U: usage line head and STALE", () => {
  const now = new Date("2026-10-08T22:00:00.000Z");

  it("BF-U1: fresh usage file prints the ruled head and consequence", () => {
    const root = tmp("bf-u1-");
    const body = JSON.stringify({
      usageLevel: {
        level: "GREEN",
        fiveHourPct: 18,
        sevenDayPct: 45,
        fiveHourResetsAt: "2026-10-09T02:40:00.000Z",
        set: "2026-10-08T21:50:00.000Z",
        pace: { level: "WELL AHEAD" },
      },
    });
    seatUsage(root, slots(root, body));
    expect(describeUsage(root, {}, now)).toBe(
      "Usage: GREEN (5h 18%, resets 10-08 21:40 CDT; week 45% WELL AHEAD) → dispatches open",
    );
  });

  it("BF-U2: stale set appends STALE with minutes", () => {
    const root = tmp("bf-u2-");
    const body = JSON.stringify({
      usageLevel: {
        level: "GREEN",
        fiveHourPct: 18,
        sevenDayPct: 45,
        fiveHourResetsAt: "2026-10-09T02:40:00.000Z",
        set: "2026-10-08T21:08:00.000Z",
        pace: { level: "WELL AHEAD" },
      },
    });
    seatUsage(root, slots(root, body));
    const line = describeUsage(root, {}, now);
    expect(line.endsWith(` · STALE (set ${chicagoStamp(new Date("2026-10-08T21:08:00.000Z"))}, 52 min ago)`)).toBe(true);
  });

  it("BF-U3: reset passed and both stale reasons joined", () => {
    const root = tmp("bf-u3a-");
    const pastReset = JSON.stringify({
      usageLevel: {
        level: "GREEN",
        fiveHourPct: 18,
        fiveHourResetsAt: "2026-10-08T20:00:00.000Z",
        set: "2026-10-08T21:55:00.000Z",
      },
    });
    seatUsage(root, slots(root, pastReset));
    expect(describeUsage(root, {}, now)).toContain(` · STALE (reset ${chicagoStamp(new Date("2026-10-08T20:00:00.000Z"))} passed)`);

    const root2 = tmp("bf-u3b-");
    const both = JSON.stringify({
      usageLevel: {
        level: "GREEN",
        fiveHourPct: 18,
        fiveHourResetsAt: "2026-10-08T20:00:00.000Z",
        set: "2026-10-08T21:08:00.000Z",
      },
    });
    seatUsage(root2, slots(root2, both));
    const line = describeUsage(root2, {}, now);
    expect(line).toContain(
      ` · STALE (set ${chicagoStamp(new Date("2026-10-08T21:08:00.000Z"))}, 52 min ago; reset ${chicagoStamp(new Date("2026-10-08T20:00:00.000Z"))} passed)`,
    );
  });

  it("BF-U4: winter date prints CST", () => {
    const winter = new Date("2026-01-15T18:00:00.000Z");
    expect(chicagoStamp(winter)).toMatch(/ CST$/);
  });
});

describe("BF-R: READS OWED", () => {
  function stateWithSessions(sessions: State["sessions"], handoffs?: State["handoffs"]): State {
    const raw = structuredClone(FIXTURE);
    raw.sessions = sessions;
    if (handoffs) raw.handoffs = handoffs;
    const parsed = parseState(JSON.stringify(raw));
    if (!parsed.ok) throw new Error(parsed.error);
    return parsed.data;
  }

  it("BF-R1: no previous session row owes latest brief and agent files", () => {
    const root = tmp("bf-r1-");
    git(root, "init", "-q", "-b", "main");
    git(root, "config", "user.email", "t@example.com");
    git(root, "config", "user.name", "T");
    mkdirSync(join(root, "docs", "loops"), { recursive: true });
    mkdirSync(join(root, ".agents", "SYSTEM"), { recursive: true });
    writeFileSync(join(root, "docs", "loops", "x-brief.md"), "# brief\n", "utf8");
    writeFileSync(join(root, ".agents", "AGENT.md"), "# agent\n", "utf8");
    writeFileSync(join(root, ".agents", "SYSTEM", "domains.json"), "{}\n", "utf8");
    gitAt(root, "2026-10-01T12:00:00", "add", "-A");
    gitAt(root, "2026-10-01T12:00:00", "commit", "-q", "-m", "seed");
    const state = stateWithSessions([]);
    const line = describeReadsOwed(root, state, 5, "developer", "sia-forge");
    expect(line).toContain("docs/loops/x-brief.md");
    expect(line).toContain(".agents/AGENT.md");
    expect(line).toContain(".agents/SYSTEM/domains.json");
  });

  it("BF-R2: handoff paths appear in source order, de-duplicated", () => {
    const root = tmp("bf-r2-");
    git(root, "init", "-q", "-b", "main");
    git(root, "config", "user.email", "t@example.com");
    git(root, "config", "user.name", "T");
    mkdirSync(join(root, "docs", "loops"), { recursive: true });
    mkdirSync(join(root, ".agents", "roles"), { recursive: true });
    writeFileSync(join(root, "docs", "loops", "x-brief.md"), "# b\n", "utf8");
    writeFileSync(join(root, ".agents", "roles", "developer.md"), "# d\n", "utf8");
    gitAt(root, "2026-10-01T12:00:00", "add", "-A");
    gitAt(root, "2026-10-01T12:00:00", "commit", "-q", "-m", "seed");
    const handoffs = [
      {
        ...FIXTURE.handoffs[0],
        seat: "developer",
        session_uuid: "u-1",
        checkout: "sia-forge",
        pick_up: "read docs/loops/x-brief.md and docs/loops/x-brief.md",
        watch_out: ["see .agents/roles/developer.md"],
        open_questions: [],
      },
    ];
    const state = stateWithSessions([{ n: 1, date: "2026-09-01", uuid: "a", seat: "developer", checkout: "sia-forge", first_rev: null }], handoffs);
    const line = describeReadsOwed(root, state, 5, "developer", "sia-forge");
    const idxBrief = line.indexOf("docs/loops/x-brief.md");
    const idxRole = line.indexOf(".agents/roles/developer.md");
    expect(idxBrief).toBeGreaterThan(-1);
    expect(idxRole).toBeGreaterThan(idxBrief);
  });

  it("BF-R3: previous session after every commit date → none", () => {
    const root = tmp("bf-r3-");
    git(root, "init", "-q", "-b", "main");
    git(root, "config", "user.email", "t@example.com");
    git(root, "config", "user.name", "T");
    mkdirSync(join(root, ".agents"), { recursive: true });
    writeFileSync(join(root, ".agents", "AGENT.md"), "# a\n");
    gitAt(root, "2026-10-01T12:00:00", "add", "-A");
    gitAt(root, "2026-10-01T12:00:00", "commit", "-q", "-m", "seed");
    const state = stateWithSessions([{ n: 1, date: "2026-10-09", uuid: "a", seat: "developer", checkout: "sia-forge", first_rev: null }]);
    expect(describeReadsOwed(root, state, 5, "developer", "sia-forge")).toBe("READS OWED: none");
  });

  it("BF-R4: eight owed paths show six then +2 more", () => {
    const root = tmp("bf-r4-");
    git(root, "init", "-q", "-b", "main");
    git(root, "config", "user.email", "t@example.com");
    git(root, "config", "user.name", "T");
    mkdirSync(join(root, "docs", "loops"), { recursive: true });
    for (let i = 0; i < 8; i++) {
      writeFileSync(join(root, "docs", "loops", `p${i}.md`), `# ${i}\n`, "utf8");
    }
    gitAt(root, "2026-10-01T12:00:00", "add", "-A");
    gitAt(root, "2026-10-01T12:00:00", "commit", "-q", "-m", "seed");
    const pick = Array.from({ length: 8 }, (_, i) => `docs/loops/p${i}.md`).join(" ");
    const handoffs = [
      {
        ...FIXTURE.handoffs[0],
        seat: "developer",
        session_uuid: "u-1",
        checkout: "sia-forge",
        pick_up: pick,
        watch_out: [],
        open_questions: [],
      },
    ];
    const state = stateWithSessions([], handoffs);
    const line = describeReadsOwed(root, state, 1, "developer", "sia-forge");
    expect(line).toMatch(/READS OWED \(8\):/);
    expect(line).toContain(" · +2 more");
    expect(line.split(" · ").length).toBeLessThanOrEqual(7);
  });
});

describe("BF-F: Fleet block", () => {
  const fleetFixture = (over: Record<string, unknown> = {}) =>
    JSON.stringify({
      verifiedAt: "2026-10-08T21:40:00.000Z",
      coordinator: { name: "clark" },
      hub: { version: "1.21.0", url: "http://100.124.212.87:4000" },
      dashboard: { version: "1.15.0", url: "http://100.124.212.87:4100" },
      seats: [
        {
          name: "atlas-sia",
          project: "SIA",
          kind: "planner",
          runtime: "claude-code",
          model: "opus",
          host: "DESKTOP-UGEKR74",
          status: "active",
        },
        {
          name: "cursor-infra",
          project: "SIA",
          kind: "dev",
          runtime: "cursor",
          model: "composer-2.5",
          host: "DESKTOP-O4EGB1E",
          status: "active",
        },
      ],
      ...over,
    });

  const now = new Date("2026-10-08T22:00:00.000Z");

  function gitRepo(dir: string): void {
    git(dir, "init", "-q", "-b", "main");
    git(dir, "config", "user.email", "t@example.com");
    git(dir, "config", "user.name", "T");
    writeFileSync(join(dir, "marker"), "x");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "init");
  }

  it("BF-F1: valid fleet file legacy block and budget line", () => {
    const root = tmp("bf-f1-");
    gitRepo(root);
    const path = join(root, "fleet.json");
    writeFileSync(path, fleetFixture());
    const env = { FLEET_JSON: path };
    const { legacy, budget } = describeFleet(root, "SIA", env, now);
    expect(legacy).toEqual([
      "## Fleet (fleet.json, verified 10-08 16:40 CDT)",
      "Coordinator: clark · questions and Aaron's decisions go to clark",
      "Hub: v1.21.0 http://100.124.212.87:4000/ · Dashboard: v1.15.0 http://100.124.212.87:4100/",
      "Seats (SIA): atlas-sia planner claude-code/opus DESKTOP-UGEKR74 active · cursor-infra dev cursor/composer-2.5 DESKTOP-O4EGB1E active",
    ]);
    expect(budget).toBe(
      "FLEET: coordinator clark · hub v1.21.0 · dashboard v1.15.0 · seats atlas-sia, cursor-infra (verified 10-08 16:40 CDT)",
    );
  });

  it("BF-F11: version strings are not double-prefixed with v", () => {
    const root = tmp("bf-f11-");
    gitRepo(root);
    const path = join(root, "fleet.json");
    writeFileSync(
      path,
      fleetFixture({
        hub: { version: "v1.22.0", url: "http://100.124.212.87:4000" },
        dashboard: { version: "1.16.0", url: "http://100.124.212.87:4100" },
      }),
    );
    const { legacy, budget } = describeFleet(root, "SIA", { FLEET_JSON: path }, now);
    const block = legacy.join("\n");
    expect(block).toContain("Hub: v1.22.0 ");
    expect(block).toContain("Dashboard: v1.16.0 ");
    expect(budget).toContain("hub v1.22.0 · dashboard v1.16.0");
    expect(block).not.toMatch(/vv/);
    expect(budget).not.toMatch(/vv/);
  });

  it("BF-F2: budget line with 40 seats stays within 200 chars", () => {
    const seats = Array.from({ length: 40 }, (_, i) => ({
      name: `seat-${String(i).padStart(2, "0")}`,
      project: "SIA",
      kind: "dev",
      runtime: "cursor",
      model: "m",
      host: "h",
      status: "active",
    }));
    const root = tmp("bf-f2-");
    const path = join(root, "fleet.json");
    writeFileSync(path, fleetFixture({ seats }));
    gitRepo(root);
    const { budget } = describeFleet(root, "SIA", { FLEET_JSON: path }, now);
    expect(budget.length).toBeLessThanOrEqual(200);
    if (budget.includes("+")) expect(budget).toMatch(/ \+\d+ more/);
  });

  it("BF-F3: verifiedAt 25h old appends STALE in both layouts", () => {
    const root = tmp("bf-f3-");
    const path = join(root, "fleet.json");
    writeFileSync(path, fleetFixture({ verifiedAt: "2026-10-07T20:00:00.000Z" }));
    const staleNow = new Date("2026-10-08T22:00:00.000Z");
    gitRepo(root);
    const { legacy, budget } = describeFleet(root, "SIA", { FLEET_JSON: path }, staleNow);
    expect(legacy[0]).toContain(" · STALE (verified ");
    expect(budget).toContain(" · STALE (verified ");
  });

  it("BF-F4: missing and invalid JSON still render briefing end", () => {
    const root = tmp("bf-f4-");
    const missing = join(root, "missing.json");
    const bad = join(root, "bad.json");
    writeFileSync(bad, "{");
    gitRepo(root);
    expect(describeFleet(root, "SIA", { FLEET_JSON: missing }, now).budget).toBe(`FLEET: unavailable (${missing}: not found)`);
    expect(describeFleet(root, "SIA", { FLEET_JSON: bad }, now).budget).toBe(`FLEET: unavailable (${bad}: invalid JSON)`);
    const lines = renderBriefing(baseInput({ fleet: describeFleet(root, "SIA", { FLEET_JSON: missing }, now) }));
    expect(lines[lines.length - 1]).toBe(BRIEFING_END);
  });

  it("BF-F5: fleet placement in legacy and budget layouts", () => {
    const froot = tmp("bf-f5-");
    gitRepo(froot);
    const fpath = join(froot, "fleet.json");
    writeFileSync(fpath, fleetFixture());
    const fleet2 = describeFleet(froot, "SIA", { FLEET_JSON: fpath }, now);
    const legacy = renderBriefing(baseInput({ fleet: fleet2 }));
    const pick = legacy.indexOf("PICK UP HERE");
    const fleetHeader = legacy.findIndex((l) => l.startsWith("## Fleet"));
    expect(fleetHeader).toBeGreaterThan(-1);
    expect(pick - fleetHeader).toBeGreaterThan(0);
    expect(legacy[pick - 1]).toBe("");

    const budget = renderBriefing(
      baseInput({
        budget: true,
        fleet: fleet2,
        focus: { seats: "SEATS: atlas · forge", focus: null },
      }),
    );
    const seatsAt = budget.findIndex((l) => l.startsWith("SEATS:"));
    const fleetAt = budget.findIndex((l) => l.startsWith("FLEET:"));
    const pickAt = budget.indexOf("PICK UP HERE");
    expect(seatsAt).toBeGreaterThan(-1);
    expect(fleetAt).toBe(seatsAt + 1);
    expect(pickAt).toBeGreaterThan(fleetAt);
  });

  it("BF-F6: fleetProjectKey maps repo folder to fleet name from main and linked worktree", () => {
    const main = tmp("bf-f6-main-");
    git(main, "init", "-q", "-b", "main");
    git(main, "config", "user.email", "t@example.com");
    git(main, "config", "user.name", "T");
    writeFileSync(join(main, "x"), "1");
    git(main, "add", "-A");
    git(main, "commit", "-q", "-m", "init");
    const repoFolder = main.split(/[/\\]/).pop()!;
    const wt = join(main, "wt");
    git(main, "worktree", "add", "-b", "linked", wt);
    const fleet = { projects: [{ name: "SIA", repo: repoFolder }] };
    expect(fleetProjectKey(main, "self-improving-agent", fleet)).toBe("SIA");
    expect(fleetProjectKey(wt, "self-improving-agent", fleet)).toBe("SIA");
  });

  it("BF-F7: describeFleet never throws on bad JSON shapes", () => {
    const root = tmp("bf-f7-");
    gitRepo(root);
    const cases: Array<[string, (line: string) => void]> = [
      ["null", (l) => expect(l).toMatch(/invalid shape: not an object/)],
      ["[]", (l) => expect(l).toMatch(/invalid shape: not an object/)],
      ['{"seats":[{"name":"a"}]}', (l) => expect(l).toContain("seats none")],
      ['{"seats":"x"}', (l) => expect(l).toContain("seats none")],
    ];
    for (const [body, assert] of cases) {
      const path = join(root, `fleet-${body.length}.json`);
      writeFileSync(path, body);
      expect(() => describeFleet(root, "SIA", { FLEET_JSON: path }, now)).not.toThrow();
      assert(describeFleet(root, "SIA", { FLEET_JSON: path }, now).budget);
    }
  });

  it("BF-F9: empty seat list prints seats none without double space", () => {
    const root = tmp("bf-f9-");
    gitRepo(root);
    const path = join(root, "fleet.json");
    writeFileSync(path, fleetFixture({ seats: [] }));
    const { budget } = describeFleet(root, "SIA", { FLEET_JSON: path }, now);
    expect(budget).toContain("seats none");
    expect(budget).not.toMatch(/seats  +/);
  });
});

describe("BF-F8: READS OWED placement in budgeted layout", () => {
  it("without SEATS, READS OWED is directly after Latest brief", () => {
    const reads = "READS OWED: none";
    const lines = renderBriefing(
      baseInput({
        budget: true,
        focus: { seats: null, focus: null },
        readsOwed: reads,
      }),
    );
    const briefAt = lines.findIndex((l) => l.includes("Latest brief:"));
    expect(briefAt).toBeGreaterThan(-1);
    expect(lines[briefAt + 1]).toBe(reads);
    expect(lines[briefAt + 2]).toMatch(/^Skills:/);
  });

  it("with SEATS, READS OWED is directly after the Latest brief line", () => {
    const reads = "READS OWED (1): docs/loops/x.md";
    const lines = renderBriefing(
      baseInput({
        budget: true,
        focus: { seats: "SEATS: a", focus: null },
        readsOwed: reads,
      }),
    );
    const briefAt = lines.findIndex((l) => l.includes("Latest brief:"));
    expect(briefAt).toBeGreaterThan(-1);
    expect(lines[briefAt + 1]).toBe(reads);
  });
});
