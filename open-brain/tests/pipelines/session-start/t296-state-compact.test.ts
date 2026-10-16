import { describe, it, expect } from "vitest";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { renderState } from "../../../src/pipelines/session-start/state-render.js";
import { handleStart } from "../../../src/server.js";
import { composeGreeting } from "../../../src/pipelines/sync/checks.js";
import type { State } from "../../../src/shared/state-schema.js";

/**
 * T-296 (3): `state_compact` in greeting.json, OPT-IN per repo and default OFF, turns three State
 * sections that are surplus to a starting session into one line each: the verified claims (reopened
 * ones still print), the open gaps, and the other seats' handoffs. Without the key every render is
 * byte-identical, which C4 pins.
 */

const base: State = {
  schema_version: 2,
  revision: 14,
  project: { name: "test-project" },
  objective: { text: "prove the renderer is a view, not a dump", since_session: 60 },
  tasks: [
    {
      id: "T-100",
      title: "a short scannable title",
      priority: "P0",
      status: "open",
      opened_session: 1,
      closed_session: null,
      supersedes: null,
      note: "RATIONALE-SENTINEL: a paragraph of reasoning that belongs in state.json, not in the startup read.",
    },
    {
      id: "T-101",
      title: "an in-progress item",
      priority: "P1",
      status: "in_progress",
      opened_session: 2,
      closed_session: null,
      supersedes: "T-099",
      note: null,
    },
    {
      id: "T-102",
      title: "a finished item",
      priority: "P2",
      status: "done",
      opened_session: 1,
      closed_session: 3,
      supersedes: null,
      note: "closure note",
    },
  ],
  verified: [],
  gaps: [],
  decisions: [],
  handoffs: [{ seat: "developer", session: 60, pick_up: "here", watch_out: ["a hazard"], open_questions: [] , loop_state: null, session_uuid: "u-60", checkout: "sia-builder" }],
  sessions: [{ n: 60, date: "2026-09-17", uuid: "u-60", seat: "developer", checkout: "sia-builder" }],
} as unknown as State;

const manyVerified = Array.from({ length: 15 }, (_, i) => ({
  id: `V-${String(i + 1).padStart(3, "0")}`,
  claim: `claim ${i + 1}`,
  evidence: [],
  since_session: 1,
  status: i === 1 ? "reopened" : "active",
}));

const gap = (n: number, opened_session: number, extra: object = {}) => ({
  id: `G-${String(n).padStart(3, "0")}`, what: `gap ${n}`, evidence: "", recommended_update: "", opened_session, ...extra,
});
const many = (open: number, closed = 0): State =>
  ({
    ...base,
    gaps: [
      ...Array.from({ length: open }, (_, i) => gap(i + 1, 50 + i)),
      ...Array.from({ length: closed }, (_, i) => gap(900 + i, 200, { status: "closed", closed_session: 201, closed_rev: 3 })),
    ],
  }) as unknown as State;

const e = (session: number, checkout: string) => ({
  seat: "developer", session, pick_up: `words from ${checkout}`, watch_out: [], open_questions: [], loop_state: null, session_uuid: `u-${checkout}`, checkout,
});

const qa = { seat: "qa", session: 110, pick_up: "words from sia-qa", watch_out: [], open_questions: [], loop_state: null, session_uuid: "u-sia-qa", checkout: "sia-qa" };

function proseProject(dir: string): void {
  mkdirSync(join(dir, ".agents", "TASKS"), { recursive: true });
  mkdirSync(join(dir, ".agents", "SESSIONS"), { recursive: true });
  mkdirSync(join(dir, ".agents", "SYSTEM"), { recursive: true });
  mkdirSync(join(dir, ".agents", "roles"), { recursive: true });
  writeFileSync(join(dir, ".agents", "AGENT.md"), "---\nname: Builder\nrole: developer\npartner: Atlas\n---\n\n# Seat\n");
  writeFileSync(join(dir, ".agents", "roles", "developer.md"), readFileSync(join(import.meta.dirname, "../../../..", ".agents/roles/developer.md"), "utf8"));
  writeFileSync(join(dir, ".agents", "roles", "shared.md"), "# shared\n");
  writeFileSync(join(dir, ".agents", "TASKS", "INBOX.md"), "# Inbox\n");
  writeFileSync(join(dir, ".agents", "TASKS", "task.md"), "# Task\n");
  writeFileSync(join(dir, ".agents", "SESSIONS", "next-session.md"), "# Next\n");
  writeFileSync(join(dir, ".agents", "SYSTEM", "SUMMARY.md"), "# Summary\n<!-- state:begin -->\n<!-- state:end -->\n");
  writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "0.45.0" }));
}

function getText(res: { content?: { type: string; text?: string }[]; isError?: boolean }): string {
  return res.content?.map((c) => c.text ?? "").join("\n") ?? "";
}

const stateFixture = join(import.meta.dirname, "../../fixtures-state/state.json");

const V = /^ {2}V-\d+ — /;
const G = /^ {2}G-\d+ — /;

const c1State = { ...base, verified: manyVerified } as unknown as State;
const c3State = { ...base, handoffs: [e(107, "sia-forge"), qa, e(118, "sia-builder")] } as unknown as State;

function flaggedProject(dir: string): void {
  proseProject(dir);
  cpSync(stateFixture, join(dir, ".agents", "state.json"));
  writeFileSync(join(dir, ".agents", "SYSTEM", "greeting.json"), `{"state_compact":true}\n`);
}

describe("T-296-S2: opt-in compact State block (state_compact, default off)", () => {
  it("C1: compact Verified prints only reopened claims plus one count line", () => {
    const out = renderState(c1State, "x", { compact: true });
    expect(out.join("\n")).toContain("Verified (15):");
    expect(out).toContain("  V-002 — claim 2 (0 evidence) [REOPENED]");
    expect(out).toContain("  … 14 claim(s) not shown (newest V-015); all of them: node open-brain/build/cli.js state show --json");
    expect(out.filter((l) => V.test(l))).toHaveLength(1);
  });

  it("C2: compact Gaps is one line naming the newest and the count", () => {
    const out = renderState(many(40, 3), "x", { compact: true });
    expect(out.join("\n")).toContain("Gaps (40):");
    expect(out).toContain("  newest G-040; all 40 open: state.json gaps[]");
    expect(out.filter((l) => G.test(l))).toHaveLength(0);
  });

  it("C3: compact other handoffs are one line; the reader's own handoff is whole", () => {
    const text = renderState(c3State, "x", { seat: "developer", compact: true }).join("\n");
    expect(text).toContain("Your handoff — developer [sia-builder], session 118:");
    expect(text).toContain("words from sia-builder");
    expect(text).toContain("Other handoffs (2): developer [sia-forge] (session 107) · qa [sia-qa] (session 110): state.json handoffs[]");
    expect(text).not.toContain("words from sia-forge");
    expect(text).not.toContain("words from sia-qa");
  });

  it("C4: the default is unchanged — no compact equals compact: false", () => {
    const inputs: [State, { seat?: string }][] = [
      [c1State, {}],
      [many(40, 3), {}],
      [c3State, { seat: "developer" }],
    ];
    for (const [s, opts] of inputs) {
      expect(renderState(s, "x", opts)).toEqual(renderState(s, "x", { ...opts, compact: false }));
    }
    expect(renderState(c1State, "x", {})).toContain("  V-015 — claim 15 (0 evidence)");
  });

  it("C5: the reader's own handoff is identical with and without compact", () => {
    const slice = (out: string[]) => {
      const from = out.findIndex((l) => l.startsWith("\nYour handoff"));
      const to = out.findIndex((l) => l.startsWith("\nOther handoffs"));
      return from >= 0 && to > from ? out.slice(from, to) : [];
    };
    const on = slice(renderState(c3State, "x", { seat: "developer", compact: true }));
    const off = slice(renderState(c3State, "x", { seat: "developer" }));
    expect(on.length).toBeGreaterThan(0);
    expect(on).toEqual(off);
  });

  it("C6: ob_start reads state_compact from greeting.json", async () => {
    const dir1 = mkdtempSync(join(tmpdir(), "t296s2-"));
    const dir2 = mkdtempSync(join(tmpdir(), "t296s2-"));
    try {
      proseProject(dir1);
      cpSync(stateFixture, join(dir1, ".agents", "state.json"));
      flaggedProject(dir2);
      const off = getText(await handleStart({ project_root: dir1 }));
      const on = getText(await handleStart({ project_root: dir2 }));
      expect(off.split("\n").filter((l) => V.test(l)).length).toBeGreaterThan(1);
      expect(off).not.toContain("claim(s) not shown (newest");
      expect(on).toContain("claim(s) not shown (newest V-008)");
      expect(on.split("\n").filter((l) => V.test(l))).toHaveLength(1);
    } finally {
      rmSync(dir1, { recursive: true, force: true });
      rmSync(dir2, { recursive: true, force: true });
    }
  }, 120000);

  it("C7: the size check composes what ob_start returns", () => {
    const dir = mkdtempSync(join(tmpdir(), "t296s2-"));
    try {
      flaggedProject(dir);
      expect(composeGreeting(dir, "0.45.0")!.text).toContain("claim(s) not shown (newest V-008)");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);
});
