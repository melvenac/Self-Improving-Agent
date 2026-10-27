import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import * as go from "../../../src/pipelines/session-start/greeting-outcome.js";
import { openV2Database } from "../../../src/db-v2.js";

/**
 * T-324 S3 (dashboard T-054 item 3): the schema-2 outcome row also carries, after `ended`,
 * - `session_uuid`: the session's uuid when the hook knows it;
 * - `trigger: {asked, injected, seat_skip, path_match, error_match}`: this session's trigger_fires as counts.
 *   asked = state not 'not-asked'; injected = state 'injected'; the other three count rows whose query has the
 *   space-separated token `seat-skip:`, `path-match:` or `error-match:` (trigger/run.ts).
 * No store read (no DB file, no table, no uuid) OMITS `trigger`; a store read with nothing fired is all zeros.
 * Rows built without these extras keep S2's exact keys.
 */
const hookEntry = join(import.meta.dirname, "../../../src/cli-session-end.ts");
const tsxCli = join(import.meta.dirname, "../../../node_modules/tsx/dist/cli.mjs");
const TIMEOUT = 120_000;
const U1 = "bbbbbbbb-0000-4000-8000-000000000001";
const U2 = "bbbbbbbb-0000-4000-8000-000000000002";
const T0 = "2026-10-27T12:00:00.000Z";
const GREET_TS = "2026-10-27T12:00:05.000Z";
const at = (s: number): string => new Date(Date.parse(T0) + s * 1000).toISOString();
const S2_KEYS = ["schema", "kind", "id", "ts", "greeting_id", "session", "first_action", "first_action_match", "ended"];

const tool = (ts: string, name: string, input: unknown) => ({
  type: "assistant",
  timestamp: ts,
  message: { content: [{ type: "tool_use", name, input }] },
});
const jsonl = (lines: unknown[]): string => lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
const greetingRow = (checkout: string) => ({
  schema: 1,
  id: `g-${GREET_TS}`,
  ts: GREET_TS,
  caller: "mcp",
  checkout,
  session: 7,
  pick_up_ids: ["T-324"],
});

describe("T-324 S3: trigger counts on the outcome row", { timeout: TIMEOUT }, () => {
  it("R1 counts: asked skips not-asked, injected by state, tokens only as query elements", () => {
    const rows = [
      { state: "not-asked", query: "" },
      { state: "silent", query: "gh pr view match:12" },
      { state: "injected", query: "git push match:12,14 seat-skip:9" },
      { state: "silent", query: "cat path-match:3" },
      { state: "silent", query: "npm error-match:4 path-match:6" },
      { state: "silent", query: '"seat-skip" notes' },
    ];
    expect(go.triggerCounts(rows)).toEqual({ asked: 5, injected: 1, seat_skip: 1, path_match: 2, error_match: 1 });
  });

  it("R2 a store read with nothing fired is a real zero", () => {
    expect(go.triggerCounts([])).toEqual({ asked: 0, injected: 0, seat_skip: 0, path_match: 0, error_match: 0 });
  });

  it("R3 the row: S2's keys without extras; session_uuid then trigger appended when given", () => {
    const g = { id: "g-1", ts: GREET_TS, session: 7, pick_up_ids: ["T-324"] };
    const a = { t: at(9), tool: "Bash", ids: ["T-324"] };
    expect(Object.keys(go.buildGreetingOutcomeRow(g, a, true, new Date(at(100))))).toEqual(S2_KEYS);
    const trigger = { asked: 2, injected: 1, seat_skip: 0, path_match: 1, error_match: 0 };
    const r = go.buildGreetingOutcomeRow(g, a, true, new Date(at(100)), { sessionUuid: U1, trigger });
    expect(Object.keys(r)).toEqual([...S2_KEYS, "session_uuid", "trigger"]);
    expect(r).toMatchObject({ session_uuid: U1, trigger });
  });

  describe("on disk", () => {
    let home: string;
    let proj: string;
    let kdb: string;
    let metricsPath: string;
    let prevKdb: string | undefined;

    beforeEach(() => {
      home = mkdtempSync(join(tmpdir(), "t324s3-home-"));
      proj = mkdtempSync(join(tmpdir(), "t324s3-proj-"));
      mkdirSync(join(proj, ".agents"), { recursive: true });
      kdb = join(home, "kv2", "knowledge-v2.db");
      mkdirSync(join(home, "kv2"), { recursive: true });
      metricsPath = join(home, "kv2", "greeting-metrics.jsonl");
      prevKdb = process.env.KNOWLEDGE_V2_DB;
      process.env.KNOWLEDGE_V2_DB = kdb;
      spawnSync("git", ["init", "-q"], { cwd: proj });
      spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "init"], { cwd: proj });
      writeFileSync(metricsPath, jsonl([greetingRow(basename(proj))]));
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
          tool(at(9), "Bash", { command: "echo T-324" }),
        ]),
      );
      return p;
    };
    const last = (): Record<string, unknown> => {
      const rows = readFileSync(metricsPath, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
      return rows.at(-1);
    };
    const hook = () =>
      spawnSync(process.execPath, [tsxCli, hookEntry], {
        cwd: proj,
        input: JSON.stringify({ session_id: U1, transcript_path: transcript(), hook_event_name: "SessionEnd" }),
        encoding: "utf8",
        timeout: 90_000,
        // A missing vault: with a DB present the hook goes on past the outcome block, and this stops it at its
        // "v2 vault not found" exit instead of running the session-end pipeline on the temp store.
        env: { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_PROJECT_DIR: proj, KNOWLEDGE_V2_DB: kdb, OPEN_BRAIN_VAULT_DIR: join(home, "no-vault") },
      });

    it("R4 record: trigger and session_uuid written when given, both keys absent when not", () => {
      const trigger = { asked: 1, injected: 0, seat_skip: 0, path_match: 0, error_match: 0 };
      const r = go.recordGreetingOutcome({ projectDir: proj, transcriptPath: transcript(), sessionStart: T0, ended: false, sessionUuid: U1, trigger });
      expect("written" in r).toBe(true);
      expect(last()).toMatchObject({ kind: "outcome", session_uuid: U1, trigger });
      go.recordGreetingOutcome({ projectDir: proj, transcriptPath: transcript(), sessionStart: T0, ended: false });
      const bare = last();
      expect(bare.kind).toBe("outcome");
      expect("trigger" in bare).toBe(false);
      expect("session_uuid" in bare).toBe(false);
    });

    it("W3 SessionEnd counts THIS session's trigger_fires only", () => {
      const db = openV2Database(kdb);
      const ins = db.prepare("INSERT INTO trigger_fires (session_uuid, command, query, state, injected_ids, created_at) VALUES (?, ?, ?, ?, ?, ?)");
      ins.run(U1, "gh pr view 1", "gh pr view match:1", "silent", "[]", at(10));
      ins.run(U1, "git push", "git push match:1 seat-skip:2", "injected", "[1]", at(11));
      ins.run(U1, "ls", "", "not-asked", "[]", at(12));
      ins.run(U2, "git push", "git push match:3", "injected", "[3]", at(13));
      db.close();
      const r = hook();
      expect(r.status, r.stdout + r.stderr).toBe(0);
      expect(r.stdout).toContain("[session-end] greeting outcome: written");
      expect(last()).toMatchObject({
        kind: "outcome",
        session_uuid: U1,
        trigger: { asked: 2, injected: 1, seat_skip: 1, path_match: 0, error_match: 0 },
      });
    });

    it("W4 no knowledge DB: the outcome row has session_uuid and NO trigger key (not read is not zero)", () => {
      const r = hook();
      expect(r.status, r.stdout + r.stderr).toBe(0);
      expect(r.stdout).toContain("[session-end] greeting outcome: written");
      const row = last();
      expect(row).toMatchObject({ kind: "outcome", session_uuid: U1 });
      expect("trigger" in row).toBe(false);
    });
  });
});
