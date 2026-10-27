import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { openV2Database } from "../src/db-v2.js";

/**
 * T-326: Claude Code gives SessionEnd hooks a 1.5 s budget unless the settings raise it
 * (code.claude.com/docs/en/hooks, `timeout`), and cli-session-end.ts's T-163 git checks take tens of seconds on a
 * long session. The fast work that needs nothing from those checks (the T-324 greeting outcome, the T-159
 * trigger-fires reconcile and the trigger-keys refresh) therefore runs right after the session proof and BEFORE the
 * handoff and work-after-end checks, so a hook killed during the checks has already written it.
 * Every block is synchronous, so the order of the hook's stdout lines is the order the blocks ran.
 */
const hookEntry = join(import.meta.dirname, "../src/cli-session-end.ts");
const tsxCli = join(import.meta.dirname, "../node_modules/tsx/dist/cli.mjs");
const TIMEOUT = 120_000;
const U1 = "cccccccc-0000-4000-8000-000000000001";
const T0 = "2026-10-27T12:00:00.000Z";
const GREET_TS = "2026-10-27T12:00:05.000Z";
const at = (s: number): string => new Date(Date.parse(T0) + s * 1000).toISOString();
const jsonl = (lines: unknown[]): string => lines.map((l) => JSON.stringify(l)).join("\n") + "\n";

const PROOF = /\[session-end\] session proof /;
const OUTCOME = /\[session-end\] greeting outcome: /;
const FIRES = /\[session-end\] trigger fires: /;
const KEYS = /\[session-end\] trigger keys: /;
const HANDOFF = /\[session-end\] (handoff check|HANDOFF MISSING)/;
const WORK = /\[session-end\] (work-after-end check|WORK AFTER)/;

describe("T-326: SessionEnd runs its fast work before the slow git checks", { timeout: TIMEOUT }, () => {
  let home: string;
  let proj: string;
  let kdb: string;
  let metricsPath: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "t326-home-"));
    proj = mkdtempSync(join(tmpdir(), "t326-proj-"));
    mkdirSync(join(proj, ".agents"), { recursive: true });
    mkdirSync(join(home, "kv2"), { recursive: true });
    kdb = join(home, "kv2", "knowledge-v2.db");
    metricsPath = join(home, "kv2", "greeting-metrics.jsonl");
    openV2Database(kdb).close();
    spawnSync("git", ["init", "-q"], { cwd: proj });
    spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "init"], { cwd: proj });
    writeFileSync(
      metricsPath,
      jsonl([{ schema: 1, id: `g-${GREET_TS}`, ts: GREET_TS, caller: "mcp", checkout: basename(proj), session: 7, pick_up_ids: ["T-326"] }]),
    );
  });
  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
    rmSync(proj, { recursive: true, force: true });
  });

  const hook = () => {
    const tp = join(home, `${U1}.jsonl`);
    writeFileSync(
      tp,
      jsonl([
        { type: "user", timestamp: at(0), message: { content: "/start" } },
        { type: "assistant", timestamp: at(9), message: { content: [{ type: "tool_use", name: "Bash", input: { command: "echo T-326" } }] } },
      ]),
    );
    const r = spawnSync(process.execPath, [tsxCli, hookEntry], {
      cwd: proj,
      input: JSON.stringify({ session_id: U1, transcript_path: tp, hook_event_name: "SessionEnd" }),
      encoding: "utf8",
      timeout: 90_000,
      // A missing vault stops the hook at its "v2 vault not found" exit instead of running the pipeline on the temp store.
      env: { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_PROJECT_DIR: proj, KNOWLEDGE_V2_DB: kdb, OPEN_BRAIN_VAULT_DIR: join(home, "no-vault") },
    });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    return r.stdout.split(/\r?\n/);
  };
  const first = (lines: string[], re: RegExp): number => lines.findIndex((l) => re.test(l));
  const count = (lines: string[], re: RegExp): number => lines.filter((l) => re.test(l)).length;

  it("O1 the greeting outcome line comes after the session proof and before the handoff and work-after-end checks", () => {
    const lines = hook();
    const [proof, outcome, handoff, work] = [first(lines, PROOF), first(lines, OUTCOME), first(lines, HANDOFF), first(lines, WORK)];
    expect([proof, outcome, handoff, work].every((i) => i >= 0), lines.join("\n")).toBe(true);
    expect(proof).toBeLessThan(outcome);
    expect(outcome).toBeLessThan(handoff);
    expect(outcome).toBeLessThan(work);
  });

  it("O2 the trigger-fires reconcile and the trigger-keys refresh come before the handoff and work-after-end checks", () => {
    const lines = hook();
    const [fires, keys, handoff, work] = [first(lines, FIRES), first(lines, KEYS), first(lines, HANDOFF), first(lines, WORK)];
    expect([fires, keys, handoff, work].every((i) => i >= 0), lines.join("\n")).toBe(true);
    expect(fires).toBeLessThan(handoff);
    expect(keys).toBeLessThan(handoff);
    expect(fires).toBeLessThan(work);
  });

  it("O3 moved, not copied: each moved step runs once and appends one outcome row", () => {
    const lines = hook();
    expect(count(lines, OUTCOME)).toBe(1);
    expect(count(lines, FIRES)).toBe(1);
    expect(count(lines, KEYS)).toBe(1);
    const rows = readFileSync(metricsPath, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
    expect(rows.filter((r) => r.kind === "outcome")).toHaveLength(1);
  });
});
