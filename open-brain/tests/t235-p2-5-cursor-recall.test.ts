import { describe, it, expect, beforeAll } from "vitest";
import { createRequire } from "node:module";
import { join } from "node:path";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { spawnAsync } from "./spawn-async.js";
import { initSchemaV2, indexKnowledge } from "../src/db-v2.js";
import {
  CURSOR_MEASURED_SHELL_TOOL_NAMES,
  shellCommandFromHookPayload,
} from "../src/cli-recall-trigger.js";

const TSX_CLI = createRequire(import.meta.url).resolve("tsx/cli");
const HOOK = join(import.meta.dirname, "../src/cli-recall-trigger.ts");
const SESSION = "2564043c-7e01-461b-b0dc-f365996968b0";
const ENTRY_299 = [
  "[EXPERIENCE] Piping to tail/head masks the real exit code",
  "TRIGGER: any time output is trimmed with tail or head AND the exit status of that command matters.",
  "ACTION: Read PIPESTATUS instead of the exit code the pipeline reports, because tail exit code is not the command exit code.",
  "CONTEXT: I read a zero from a pipe and reported a false success.",
].join("\n");
const G039_COMMAND = "npx vitest run 2>&1 | tail -8; echo $?";

let dir: string;
let dbPath: string;
let logPath: string;

async function runHook(payload: unknown, env: Record<string, string> = {}) {
  const r = await spawnAsync(process.execPath, [TSX_CLI, HOOK], {
    input: JSON.stringify(payload),
    env: { ...process.env, KNOWLEDGE_V2_DB: dbPath, RECALL_TRIGGER_LOG: logPath, ...env },
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

const cursorPostToolUse = (command: string) => ({
  session_id: SESSION,
  hook_event_name: "postToolUse",
  tool_name: "Shell",
  tool_input: { command, cwd: dir, timeout: 30000 },
});

const bashPostToolUse = (command: string) => ({
  session_id: SESSION,
  hook_event_name: "PostToolUse",
  tool_name: "Bash",
  tool_input: { command },
});

describe("T-235 P2-5 Cursor Shell postToolUse recall", () => {
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "t235-p25-"));
    dbPath = join(dir, "knowledge-v2.db");
    logPath = join(dir, "recall-trigger.log");
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    initSchemaV2(db);
    const add = (key: string, content: string) =>
      indexKnowledge(db, { vaultPath: `${key}.md`, key, content, tags: "", source: "test" });
    const filler = "Session provenance and vault indexing filler sentence.";
    db.transaction(() => {
      for (let i = 0; i < 598; i++) add(`filler-${i}`, `${filler} Document ${i}.`);
      add("pipe-to-tail-masks-exit-code", ENTRY_299);
    })();
    db.close();
  }, 60_000);

  it("allowlists only measured Cursor tool_name Shell", () => {
    expect([...CURSOR_MEASURED_SHELL_TOOL_NAMES]).toEqual(["Shell"]);
    expect(shellCommandFromHookPayload({ tool_name: "ShellTool", tool_input: { command: "x" } })).toBeNull();
  });

  it("Cursor Shell payload runs the trigger (same injection shape as Bash)", async () => {
    const result = await runHook(cursorPostToolUse(G039_COMMAND));
    expect(result.status).toBe(0);
    const emitted = JSON.parse(result.stdout) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    expect(emitted.hookSpecificOutput.hookEventName).toBe("PostToolUse");
    expect(emitted.hookSpecificOutput.additionalContext).toContain("PIPESTATUS");
  });

  it("Bash payload byte-identical path still injects", async () => {
    const result = await runHook(bashPostToolUse(G039_COMMAND));
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).hookSpecificOutput.additionalContext).toContain("PIPESTATUS");
  });

  it("mutant: unmeasured tool_name ShellTool is ignored", () => {
    expect(shellCommandFromHookPayload({ tool_name: "ShellTool", tool_input: { command: "echo x" }, session_id: SESSION })).toBeNull();
  });

  it("no session_id: silent exit 0", async () => {
    const p = cursorPostToolUse("echo x");
    delete (p as { session_id?: string }).session_id;
    const result = await runHook(p);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("");
    expect(existsSync(logPath)).toBe(true);
    expect(readFileSync(logPath, "utf-8")).toContain("no session_id");
  });
});
