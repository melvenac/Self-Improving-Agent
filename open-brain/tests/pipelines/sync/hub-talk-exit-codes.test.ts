import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EXIT2_WAIT_PHRASE,
  hubRoomGuardViolations,
  hubRoomSectionFromStart,
  violationsAtlasNextTurn,
  violationsHubVerbInTurn,
  violationsInTurnWait,
  violationsSeatFileWait,
  violationsWaitFlagCount,
} from "../../../src/pipelines/sync/hub-room-guard.js";

/**
 * T-228: relay's A2A Loop 13 contract for `hub-talk` exit codes (A2A-Hub master 8e59f58, docs/loops/loop-13-design-ruling.md).
 * Every Cursor-facing copy of the hub rule carries all four codes for `--inbox` and `--say`, including 3 (unavailable or
 * throttled) with its stderr line and its backoff, so a seat does not read a throttled hub as a refusal.
 */
const repo = join(process.cwd(), "..");
const read = (rel: string): string => readFileSync(join(repo, rel), "utf-8").replace(/\r\n/g, "\n");

const COPIES = ["project-template/.cursor/commands/start.md", ".cursor/rules/hub-room.mdc", "project-template/.cursor/rules/hub-room.mdc"];

/** Phrases that must appear, each in every copy. */
const REQUIRED = [
  "exit 0",
  "exit 1",
  "exit 2",
  "exit 3",
  "a turn was printed",
  "act on it",
  "refused or called wrong",
  "do not retry",
  "comes only from --wait",
  "seat with a waker does not run",
  "if you see it, end the turn",
  "unavailable or throttled",
  "[hub-talk] retry status=<code|network> retry-after=<seconds|unknown>",
  "wait `retry-after` seconds",
  "back off 5 s doubling to 60 s",
  "5 consecutive exit-3 results over 2 minutes with no `retry-after`",
  "stop and report",
];

describe("T-228 hub-talk exit codes 0, 1, 2 and 3 in every Cursor copy of the hub rule", () => {
  for (const rel of COPIES) {
    it(`${rel} carries the whole contract`, () => {
      const t = read(rel);
      for (const phrase of REQUIRED) expect(t.toLowerCase(), `${rel}: ${phrase}`).toContain(phrase.toLowerCase());
    });
  }

  it("the old two-code wording ('and again on exit 2' / 'Exit 2: run the same command again') is gone", () => {
    expect(read("project-template/.cursor/commands/start.md")).not.toContain("and again on exit 2");
    for (const rel of [".cursor/rules/hub-room.mdc", "project-template/.cursor/rules/hub-room.mdc"]) {
      expect(read(rel)).not.toContain("Exit 2: run the same command again");
    }
  });

  it("no Cursor copy tells a waker seat to wait again on exit 2 (HUBROOM-TURN-END r2)", () => {
    for (const rel of COPIES) {
      expect(read(rel)).not.toContain("wait again");
    }
  });

  it("the two hub-room.mdc copies are identical (the repo's own rule and the template's)", () => {
    expect(read(".cursor/rules/hub-room.mdc")).toBe(read("project-template/.cursor/rules/hub-room.mdc"));
  });

  const QA281_REWORDINGS = {
    R1: "After posting, run hub-talk --wait for the next atlas turn.",
    R2: "When the post succeeds, run the `talk` line again with `--wait` and handle the next atlas turn in this run.",
    R3: "Then keep listening: append the seat file's `wait` suffix to the talk line and act on what it prints before you end the turn.",
    R4: "After posting, run the talk line with --wait --wait-timeout 3500.",
  } as const;

  const QA283_REWORDINGS = {
    Own1: "After you post, run hub-talk with `--inbox` again and repeat until atlas has replied, then act on the reply before ending this turn.",
    Own2: "Stay in this run after posting: rerun the talk line every minute until the next atlas turn is printed.",
    Own3: "Do not end the turn after posting, wait for hub-talk to print the next atlas turn and act on it.",
    Disp1: "Listen on the room until atlas answers.",
    Disp2: "Block on hub-talk for the next message.",
    Disp3: "Keep polling the room before ending.",
  } as const;

  const R3_PLANTS = {
    S1: "After posting, run the talk line again. Wait for the next atlas turn and act on it before you end the turn.",
    S2: "Run node scripts/hub-talk.mjs --as you --session room and wait for the reply.",
    S3: "Then keep listening for atlas's next turn before you end the turn.",
    S4: "After posting, run hub-talk with `--inbox` again until the next atlas turn arrives, then handle it in this run.",
    S5: "Once hub-talk has waited for atlas, act on its reply.",
    S6: "Don't wait on hub-talk after you post.",
  } as const;

  const STAY_CAUGHT = {
    C1: "Keep polling hub-talk until atlas replies, and do not end the turn before then.",
    C2: "Keep listening on the talk line and never end the turn before atlas answers.",
  } as const;

  const QA_REWORDINGS = { ...QA281_REWORDINGS, ...QA283_REWORDINGS };

  const MDC_ANCHOR = "Post when the work is done, not a bare acknowledgement.";
  const plantMdc = (mdc: string, line: string) => mdc.replace(MDC_ANCHOR, `${MDC_ANCHOR}\n\n${line}`);
  const plantStartHub = (start: string, suffix: string) => {
    const lines = start.split("\n");
    const at = lines.findIndex((l) => l.trim() === "### Hub room");
    expect(at).toBeGreaterThan(-1);
    const hubLine = lines[at + 1];
    lines[at + 1] = `${hubLine} ${suffix}`;
    return lines.join("\n");
  };

  const guardTargets: { label: string; text: () => string }[] = [
    { label: ".cursor/rules/hub-room.mdc", text: () => read(".cursor/rules/hub-room.mdc") },
    { label: "project-template/.cursor/rules/hub-room.mdc", text: () => read("project-template/.cursor/rules/hub-room.mdc") },
    {
      label: "start.md Hub room section",
      text: () => hubRoomSectionFromStart(read("project-template/.cursor/commands/start.md")),
    },
  ];

  it("tracked hub copies pass the sentence guard (HUBROOM-GUARD)", () => {
    for (const { label, text } of guardTargets) {
      expect(hubRoomGuardViolations(text()), label).toEqual([]);
    }
  });

  it("hub-partner-seats.json has no top-level wait key and start Hub section is non-empty (F6)", () => {
    const seats = JSON.parse(read(".agents/SYSTEM/hub-partner-seats.json")) as Record<string, unknown>;
    expect(seats).not.toHaveProperty("wait");
    const section = hubRoomSectionFromStart(read("project-template/.cursor/commands/start.md"));
    expect(section.trim().length).toBeGreaterThan(100);
  });

  it("QA-281/283 rewordings fail the sentence guard in every copy (HUBROOM-GUARD G1, QA-283 K1)", () => {
    for (const [id, line] of Object.entries(QA_REWORDINGS)) {
      const mdc = read(".cursor/rules/hub-room.mdc");
      const start = read("project-template/.cursor/commands/start.md");
      expect(hubRoomGuardViolations(plantMdc(mdc, line)), `${id} mdc`).not.toEqual([]);
      expect(hubRoomGuardViolations(hubRoomSectionFromStart(plantStartHub(start, line))), `${id} start`).not.toEqual([]);
    }
  });

  it("planner S1–S6 table (HUBROOM-GUARD r3)", () => {
    const mustCatch = ["S1", "S2", "S3", "S4", "S5"] as const;
    for (const id of mustCatch) {
      expect(hubRoomGuardViolations(R3_PLANTS[id]), id).not.toEqual([]);
    }
    expect(hubRoomGuardViolations(R3_PLANTS.S6), "S6").toEqual([]);
    for (const [id, line] of Object.entries(STAY_CAUGHT)) {
      expect(hubRoomGuardViolations(line), id).not.toEqual([]);
    }
  });

  it("allowlisted hub sentences stay green in isolation (QA-283 row 8, r3 throttled retry)", () => {
    const greens = [
      EXIT2_WAIT_PHRASE,
      "Never block on hub-talk waiting for the next atlas turn in this run — the waker starts the next run when that turn arrives.",
      "wait `retry-after` seconds",
      "run the `talk` line with `--inbox` before other work",
      "If hub-talk is throttled, wait 5 seconds and retry.",
      R3_PLANTS.S6,
    ];
    for (const s of greens) expect(hubRoomGuardViolations(s)).toEqual([]);
  });

  const ONLY_WAIT_COUNT = "The phrase --wait appears here without the exit-2 explain sentence.";
  const ONLY_SEAT_FILE = "Document the seat file's `wait` suffix in the runbook, not on the talk line.";
  const ONLY_HUB_VERB = "Block on hub-talk for the next message.";
  const ONLY_ATLAS_NEXT = R3_PLANTS.S3;
  const ONLY_CROSS_SENTENCE = R3_PLANTS.S1;
  const NEGATION_SAMPLE = R3_PLANTS.S6;

  it("each guard check has a positive only it catches (HUBROOM-GUARD r3 K2)", () => {
    expect(violationsWaitFlagCount(ONLY_WAIT_COUNT).length).toBeGreaterThan(0);
    expect(violationsSeatFileWait(ONLY_WAIT_COUNT)).toEqual([]);
    expect(violationsHubVerbInTurn(ONLY_WAIT_COUNT)).toEqual([]);
    expect(violationsAtlasNextTurn(ONLY_WAIT_COUNT)).toEqual([]);

    expect(violationsSeatFileWait(ONLY_SEAT_FILE).length).toBeGreaterThan(0);
    expect(violationsWaitFlagCount(ONLY_SEAT_FILE)).toEqual([]);
    expect(violationsHubVerbInTurn(ONLY_SEAT_FILE)).toEqual([]);
    expect(violationsAtlasNextTurn(ONLY_SEAT_FILE)).toEqual([]);

    expect(violationsHubVerbInTurn(ONLY_HUB_VERB).length).toBeGreaterThan(0);
    expect(violationsWaitFlagCount(ONLY_HUB_VERB)).toEqual([]);
    expect(violationsSeatFileWait(ONLY_HUB_VERB)).toEqual([]);
    expect(violationsAtlasNextTurn(ONLY_HUB_VERB)).toEqual([]);

    expect(violationsAtlasNextTurn(ONLY_ATLAS_NEXT).length).toBeGreaterThan(0);
    expect(violationsHubVerbInTurn(ONLY_ATLAS_NEXT)).toEqual([]);
    expect(violationsWaitFlagCount(ONLY_ATLAS_NEXT)).toEqual([]);

    expect(violationsAtlasNextTurn(ONLY_CROSS_SENTENCE).length).toBeGreaterThan(0);
    expect(violationsHubVerbInTurn(ONLY_CROSS_SENTENCE)).toEqual([]);
  });

  it("mutant table: disabling one check turns its positive red (HUBROOM-GUARD r3 K2)", () => {
    const rows: {
      name: string;
      sample: string;
      opts: Parameters<typeof hubRoomGuardViolations>[1];
      expectGreenWhenSkipped: boolean;
    }[] = [
      { name: "wait count", sample: ONLY_WAIT_COUNT, opts: { skipWaitCount: true }, expectGreenWhenSkipped: true },
      { name: "seat-file wait", sample: ONLY_SEAT_FILE, opts: { skipSeatFileWait: true }, expectGreenWhenSkipped: true },
      { name: "hub-verb in-turn", sample: ONLY_HUB_VERB, opts: { skipHubVerbInTurn: true }, expectGreenWhenSkipped: true },
      { name: "atlas/next-turn", sample: ONLY_ATLAS_NEXT, opts: { skipAtlasNextTurn: true }, expectGreenWhenSkipped: true },
      {
        name: "cross-sentence",
        sample: ONLY_CROSS_SENTENCE,
        opts: { skipAtlasNextTurn: true },
        expectGreenWhenSkipped: true,
      },
    ];

    for (const row of rows) {
      const full = hubRoomGuardViolations(row.sample);
      expect(full.length, `${row.name} full`).toBeGreaterThan(0);
      const skipped = hubRoomGuardViolations(row.sample, row.opts);
      if (row.expectGreenWhenSkipped) {
        expect(skipped, `${row.name} skipped`).toEqual([]);
      } else {
        expect(skipped.length, `${row.name} skipped`).toBeGreaterThan(0);
      }
    }

    expect(hubRoomGuardViolations(NEGATION_SAMPLE)).toEqual([]);
    expect(hubRoomGuardViolations(NEGATION_SAMPLE, { skipNegationScope: true }).length).toBeGreaterThan(0);

    const negationProbe = "Don't block on hub-talk for the next atlas turn.";
    expect(hubRoomGuardViolations(negationProbe)).toEqual([]);
    expect(hubRoomGuardViolations(negationProbe, { skipNegationScope: true }).length).toBeGreaterThan(0);
  });

  it("hub-room.mdc cites A2A-Hub shared.md Hub transport at b6a8de79 and D-120 (HUBROOM-TURN-END amendment 1)", () => {
    const cite = "b6a8de79";
    const section = "Hub transport: how a seat waits";
    for (const rel of [".cursor/rules/hub-room.mdc", "project-template/.cursor/rules/hub-room.mdc"]) {
      const t = read(rel);
      expect(t).toContain(cite);
      expect(t).toContain(section);
      expect(t).toContain("D-120:");
      expect(t).toContain("never waits inside its turn");
    }
  });

  it("start.md Hub section cites b6a8de79 and shared.md Hub transport (HUBROOM-TURN-END amendment 1)", () => {
    const t = read("project-template/.cursor/commands/start.md");
    expect(t).toContain("b6a8de79");
    expect(t).toContain("Hub transport: how a seat waits");
    expect(t).toContain("D-120:");
  });

  it("every changed Hub-room line in start.md is a complete line of the cursor_only table, so cursor-start-parity waives it (and only it)", () => {
    const table = JSON.parse(read("docs/loops/cursor-start-differences.json")) as { cursor_only: string[] };
    const lines = read("project-template/.cursor/commands/start.md").split("\n");
    const at = lines.indexOf("### Hub room");
    expect(at).toBeGreaterThan(-1);
    const section = lines.slice(at + 1).filter((l) => l.trim() !== "");
    const hubLines = section.filter((l) => /hub-talk|exit 3|Turn-end and wait/.test(l));
    expect(hubLines.length).toBeGreaterThanOrEqual(2);
    for (const l of hubLines) expect(table.cursor_only, l.slice(0, 60)).toContain(l);
  });
});
