import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import {
  buildGreetingOutcomeRow,
  findGreetingRow,
  firstActionAfter,
  matchFirstAction,
  recordGreetingOutcome,
} from "../../../src/pipelines/session-start/greeting-outcome.js";
import { writeObEndStamp } from "../../../src/shared/end-record-guard.js";

/**
 * T-324 S2 (dashboard T-054): SessionEnd appends one schema-2 outcome row for the session's greeting:
 * {schema:2, kind:"outcome", id, ts, greeting_id, session, first_action:{t,tool,ids}|null, first_action_match, ended}.
 * - first_action: the first main-thread tool_use after the greeting row's ts, skipping ToolSearch, TodoWrite,
 *   ob_set_session and ob_start; ids are the T-/V-/#ids in its input.
 * - first_action_match: true if an id is in the greeting's pick_up_ids; false if none is (or the action has none);
 *   null when pick_up_ids is [] or absent, or there is no action.
 * - ended: ob_end's stamp names this session.
 * The greeting row is never edited.
 */
const hookEntry = join(import.meta.dirname, "../../../src/cli-session-end.ts");
const tsxCli = join(import.meta.dirname, "../../../node_modules/tsx/dist/cli.mjs");
const TIMEOUT = 120_000;
const U1 = "aaaaaaaa-0000-4000-8000-000000000001";
const U2 = "aaaaaaaa-0000-4000-8000-000000000002";
const T0 = "2026-10-27T12:00:00.000Z";
const GREET_TS = "2026-10-27T12:00:05.000Z";
const at = (s: number): string => new Date(Date.parse(T0) + s * 1000).toISOString();

const tool = (ts: string, name: string, input: unknown, extra: Record<string, unknown> = {}) => ({
  type: "assistant",
  timestamp: ts,
  ...extra,
  message: { content: [{ type: "tool_use", name, input }] },
});
const jsonl = (lines: unknown[]): string => lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
const greetingRow = (checkout: string, ts: string, extra: Record<string, unknown> = {}) => ({
  schema: 1,
  id: `g-${ts}`,
  ts,
  caller: "mcp",
  checkout,
  session: 7,
  pick_up_ids: ["T-324", "#1004"],
  ...extra,
});

describe("T-324 S2: the greeting outcome row", { timeout: TIMEOUT }, () => {
  it("O1 first action: after the greeting, main thread only, plumbing skipped, ids de-duplicated in order", () => {
    const t = jsonl([
      { type: "user", timestamp: at(0), message: { content: "/start" } },
      tool(at(1), "mcp__open-brain__ob_set_session", { session_id: U1 }),
      tool(at(4), "mcp__open-brain__ob_start", { project_root: "C:/x" }),
      tool(at(6), "ToolSearch", { query: "select:SendMessage" }),
      tool(at(7), "mcp__open-brain__ob_start", { project_root: "C:/x" }),
      tool(at(8), "Read", { file_path: "T-999.md" }, { isSidechain: true }),
      tool(at(9), "Bash", { command: "gh pr view 1004 && echo T-324 #1004 V-096 T-324" }),
      tool(at(10), "Edit", { file_path: "T-1.md" }),
    ]);
    expect(firstActionAfter(t, GREET_TS)).toEqual({ t: at(9), tool: "Bash", ids: ["T-324", "#1004", "V-096"] });
    expect(firstActionAfter(t, at(10))).toBeNull();
  });

  it("O2 first action ids are capped at 10", () => {
    const many = Array.from({ length: 14 }, (_, i) => `T-${i + 1}`).join(" ");
    const a = firstActionAfter(jsonl([tool(at(9), "Bash", { command: many })]), GREET_TS);
    expect(a?.ids).toHaveLength(10);
    expect(a?.ids[9]).toBe("T-10");
  });

  it("O3 match: true on a shared id; false with no shared id or no ids; null without pick-up ids or an action", () => {
    const act = (ids: string[]) => ({ t: at(9), tool: "Bash", ids });
    expect(matchFirstAction(["T-324", "#1004"], act(["#1004"]))).toBe(true);
    expect(matchFirstAction(["T-324"], act(["T-170"]))).toBe(false);
    expect(matchFirstAction(["T-324"], act([]))).toBe(false);
    expect(matchFirstAction([], act(["T-324"]))).toBeNull();
    expect(matchFirstAction(undefined, act(["T-324"]))).toBeNull();
    expect(matchFirstAction(["T-324"], null)).toBeNull();
  });

  it("O4 the greeting row: the earliest schema-1 row of this checkout at or after the session start", () => {
    const metrics = jsonl([
      greetingRow("sia-planner", at(-60)),
      greetingRow("other-seat", at(2)),
      { schema: 2, kind: "outcome", id: "o-1", ts: at(3), greeting_id: "g-x", checkout: "sia-planner" },
      greetingRow("sia-planner", GREET_TS),
      greetingRow("sia-planner", at(30)),
    ]);
    expect(findGreetingRow(metrics, "sia-planner", T0)).toEqual({ id: `g-${GREET_TS}`, ts: GREET_TS, session: 7, pick_up_ids: ["T-324", "#1004"] });
    expect(findGreetingRow(metrics, "sia-planner", at(31))).toBeNull();
  });

  it("O5 the row: schema 2, kind outcome, the agreed keys in order", () => {
    const r = buildGreetingOutcomeRow(
      { id: "g-1", ts: GREET_TS, session: 7, pick_up_ids: ["T-324"] },
      { t: at(9), tool: "Bash", ids: ["T-324"] },
      true,
      new Date(at(100)),
    );
    expect(Object.keys(r)).toEqual(["schema", "kind", "id", "ts", "greeting_id", "session", "first_action", "first_action_match", "ended"]);
    expect(r).toMatchObject({ schema: 2, kind: "outcome", ts: at(100), greeting_id: "g-1", session: 7, first_action_match: true, ended: true });
  });

  describe("on disk", () => {
    let home: string;
    let proj: string;
    let kdb: string;
    let metricsPath: string;
    let prevKdb: string | undefined;

    beforeEach(() => {
      home = mkdtempSync(join(tmpdir(), "t324s2-home-"));
      proj = mkdtempSync(join(tmpdir(), "t324s2-proj-"));
      mkdirSync(join(proj, ".agents"), { recursive: true });
      kdb = join(home, "kv2", "knowledge-v2.db");
      mkdirSync(join(home, "kv2"), { recursive: true });
      metricsPath = join(home, "kv2", "greeting-metrics.jsonl");
      prevKdb = process.env.KNOWLEDGE_V2_DB;
      process.env.KNOWLEDGE_V2_DB = kdb;
      spawnSync("git", ["init", "-q"], { cwd: proj });
      spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "init"], { cwd: proj });
    });
    afterEach(() => {
      if (prevKdb === undefined) delete process.env.KNOWLEDGE_V2_DB;
      else process.env.KNOWLEDGE_V2_DB = prevKdb;
      rmSync(home, { recursive: true, force: true });
      rmSync(proj, { recursive: true, force: true });
    });

    const transcript = (): string => {
      const p = join(home, `${U1}.jsonl`);
      writeFileSync(
        p,
        jsonl([
          { type: "user", timestamp: at(0), message: { content: "/start" } },
          tool(at(4), "mcp__open-brain__ob_start", { project_root: proj }),
          tool(at(9), "Bash", { command: "gh pr view 1004", description: "Check PR #1004" }),
        ]),
      );
      return p;
    };
    const seed = (): string => {
      const text = jsonl([greetingRow(basename(proj), GREET_TS)]);
      writeFileSync(metricsPath, text);
      return text;
    };
    const lines = (): Array<Record<string, unknown>> =>
      readFileSync(metricsPath, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));

    it("O6 record: appends one outcome row after the untouched greeting row; no greeting row writes nothing", () => {
      const before = seed();
      const r = recordGreetingOutcome({ projectDir: proj, transcriptPath: transcript(), sessionStart: T0, ended: false });
      expect("written" in r).toBe(true);
      const text = readFileSync(metricsPath, "utf8");
      expect(text.startsWith(before)).toBe(true);
      const rows = lines();
      expect(rows).toHaveLength(2);
      expect(rows[1]).toMatchObject({
        schema: 2,
        kind: "outcome",
        greeting_id: `g-${GREET_TS}`,
        session: 7,
        first_action: { t: at(9), tool: "Bash", ids: ["#1004"] },
        first_action_match: true,
        ended: false,
      });

      writeFileSync(metricsPath, jsonl([greetingRow("other-seat", GREET_TS)]));
      const none = recordGreetingOutcome({ projectDir: proj, transcriptPath: transcript(), sessionStart: T0, ended: false });
      expect(none).toEqual({ skipped: "no greeting row for this session" });
      expect(lines()).toHaveLength(1);
    });

    const hook = () =>
      spawnSync(process.execPath, [tsxCli, hookEntry], {
        cwd: proj,
        input: JSON.stringify({ session_id: U1, transcript_path: transcript(), hook_event_name: "SessionEnd" }),
        encoding: "utf8",
        timeout: 90_000,
        env: { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_PROJECT_DIR: proj, KNOWLEDGE_V2_DB: kdb },
      });

    it("W1 SessionEnd writes the outcome; ob_end's stamp for THIS session makes ended true", () => {
      seed();
      writeObEndStamp(proj, { session: U1, ob_end_at: at(50), record_content_hash: "x" });
      const r = hook();
      expect(r.status, r.stdout + r.stderr).toBe(0);
      expect(r.stdout).toContain("[session-end] greeting outcome: written (match true, ended true)");
      expect(lines().at(-1)).toMatchObject({ kind: "outcome", ended: true, first_action_match: true });
    });

    it("W2 a stamp from ANOTHER session leaves ended false", () => {
      seed();
      writeObEndStamp(proj, { session: U2, ob_end_at: at(50), record_content_hash: "x" });
      const r = hook();
      expect(r.status, r.stdout + r.stderr).toBe(0);
      expect(r.stdout).toContain("[session-end] greeting outcome: written (match true, ended false)");
      expect(lines().at(-1)).toMatchObject({ kind: "outcome", ended: false });
    });
  });
});
