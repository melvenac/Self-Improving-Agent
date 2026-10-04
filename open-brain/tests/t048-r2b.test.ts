/**
 * T-048 round 2b (record 176). QA 157's findings on 5b9a403, outside server.ts.
 *
 * D1, D2, D4, and D5 fail here. D3's three rows pass here and fail on the
 * mutants that survived QA 157 (hook-old-lines, s6-corrupt-earns-recency,
 * s14-skip-over-match).
 */
import { describe, it, expect, afterEach } from "vitest";
import Database from "better-sqlite3";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { initSchemaV2 } from "../src/db-v2.js";
import { formatSessionEndLines, sessionEndV2 } from "../src/pipelines/session-end/index-v2.js";
import { readLastInvocationTs } from "../src/pipelines/session-end/invocation-logger.js";
import { scorePipelineHealth } from "../src/pipelines/sync/scorer.js";

const dirs: string[] = [];
function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), "t048-r2b-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

function memoryDb(): Database.Database {
  const db = new Database(":memory:");
  initSchemaV2(db);
  return db;
}

function writeSessionDb(dir: string, name: string, setup: (db: Database.Database) => void): void {
  const db = new Database(join(dir, name));
  setup(db);
  db.close();
}

const META = `
  CREATE TABLE session_events (id INTEGER PRIMARY KEY, type TEXT, data TEXT, created_at TEXT);
  CREATE TABLE session_meta (session_id TEXT, project_dir TEXT, started_at TEXT, last_event_at TEXT, event_count INTEGER);
`;

function linesFor(sessionsDir: string, sessionId: string): string {
  const result = sessionEndV2({
    db: memoryDb(),
    vaultDir: scratch(),
    agentsDir: scratch(),
    sessionId,
    sessionSummary: "",
    project: "test-project",
    recalledEntryIds: [],
    dryRun: true,
    sessionsDir,
  });
  return formatSessionEndLines(result).join("\n");
}

describe("T-048 round 2b", () => {
  it("D1: sync --score names the invocation-log state on the Pipeline Health line", async () => {
    let format: ((cat: { name: string; score: number; max: number; details: Record<string, string | number> }) => string) | undefined;
    try {
      const mod = await import("../src/pipelines/sync/score-line.js") as {
        formatScoreCategoryLine?: typeof format;
      };
      format = mod.formatScoreCategoryLine;
    } catch {
      format = undefined;
    }
    expect(format, "the score printer names the invocation-log state").toBeTypeOf("function");
    const line = format!({
      name: "Pipeline Health",
      score: 0,
      max: 10,
      details: { invocationLog: "corrupt" },
    });
    expect(line).toContain("Pipeline Health: 0/10 (invocation log: corrupt)");
    expect(format!({
      name: "Pipeline Health",
      score: 0,
      max: 10,
      details: { invocationLog: "unreadable" },
    })).toContain("(invocation log: unreadable)");
    expect(format!({
      name: "Pipeline Health",
      score: 0,
      max: 10,
      details: { invocationLog: "missing" },
    })).toContain("(invocation log: missing)");
    expect(format!({
      name: "Pipeline Health",
      score: 4,
      max: 10,
      details: { invocationLog: "ran" },
    })).not.toContain("invocation log:");
    const cli = readFileSync(join(import.meta.dirname, "../src/cli.ts"), "utf8");
    const namesPrinter = (src: string) => src.split("\n").some((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && trimmed.includes("formatScoreCategoryLine");
    });
    expect(namesPrinter("formatScoreCategoryLine(row);")).toBe(true);
    expect(namesPrinter("// formatScoreCategoryLine is not called")).toBe(false);
    expect(namesPrinter(cli), "sync --score uses that printer").toBe(true);
  });

  it("D2: a readable db with no session_meta holds no session", () => {
    const dir = scratch();
    writeSessionDb(dir, "foreign.db", (db) => {
      db.exec("CREATE TABLE other (id INTEGER)");
    });
    writeFileSync(join(dir, "empty.db"), "");
    const text = linesFor(dir, "wanted-session");
    expect(text).toContain("holds no session");
    expect(text).not.toContain("unreadable while finding session db");
  });

  it("D3 hook-old-lines: the hook's stdout names the skip", () => {
    const home = scratch();
    const vault = join(home, "vault");
    const project = join(home, "project");
    const dbPath = join(home, "knowledge-v2.db");
    mkdirSync(vault);
    mkdirSync(project);
    const db = new Database(dbPath);
    initSchemaV2(db);
    db.close();
    const tsx = join(import.meta.dirname, "../node_modules/tsx/dist/cli.mjs");
    const hook = join(import.meta.dirname, "../src/cli-session-end.ts");
    const run = spawnSync(process.execPath, [tsx, hook], {
      cwd: project,
      encoding: "utf8",
      timeout: 60_000,
      input: "",
      env: {
        ...process.env,
        HOME: home,
        USERPROFILE: home,
        KNOWLEDGE_V2_DB: dbPath,
        OPEN_BRAIN_VAULT_DIR: vault,
        CLAUDE_PROJECT_DIR: project,
        CLAUDE_CODE_SESSION_ID: "wanted-session",
      },
    });
    const out = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
    expect(run.status, out).toBe(0);
    expect(out, "a skip without a reason is the pre-T-048 line").toMatch(
      /\[session-end\] Summary: skipped — \S/,
    );
  }, 60_000);

  it("D3 s6-corrupt-earns-recency: a named log state scores like a missing log", () => {
    const missing = scorePipelineHealth({ lastHookRun: null, scoreTrend: "unknown" });
    const corrupt = scorePipelineHealth({ lastHookRun: "corrupt", scoreTrend: "unknown" });
    const unreadable = scorePipelineHealth({ lastHookRun: "unreadable: EBUSY", scoreTrend: "unknown" });
    expect(corrupt.score).toBe(missing.score);
    expect(unreadable.score).toBe(missing.score);
    expect(corrupt.details.invocationLog).toBe("corrupt");
    expect(unreadable.details.invocationLog).toBe("unreadable");
  });

  it("D3 s14-skip-over-match: an unreadable db does not hide the db that holds the session", () => {
    const dir = scratch();
    const vault = scratch();
    writeFileSync(join(dir, "aaa-bad.db"), "not a sqlite database");
    writeSessionDb(dir, "zzz-real.db", (db) => {
      db.exec(META);
      db.prepare(
        "INSERT INTO session_meta (session_id, project_dir, started_at, last_event_at, event_count) VALUES (?, ?, ?, ?, ?)",
      ).run("wanted-session", "/tmp/proj", "t", "t", 1);
      db.prepare("INSERT INTO session_events (type, data, created_at) VALUES (?, ?, ?)").run(
        "user_prompt",
        "Worked on the session summary.",
        "t",
      );
    });
    const result = sessionEndV2({
      db: memoryDb(),
      vaultDir: vault,
      agentsDir: scratch(),
      sessionId: "wanted-session",
      sessionSummary: "",
      project: "test-project",
      recalledEntryIds: [],
      dryRun: false,
      sessionsDir: dir,
    });
    const text = formatSessionEndLines(result).join("\n");
    expect(text).toContain("Summary: written");
    expect(text).not.toContain("unreadable while finding session db");
  });

  it("D4: unusableLog is a string, and the timestamp doc is not the helper's", () => {
    const src = readFileSync(
      join(import.meta.dirname, "../src/pipelines/session-end/invocation-logger.ts"),
      "utf8",
    );
    const helper = src.slice(src.indexOf("function unusableLog"), src.indexOf("export function readLastInvocationTs"));
    expect(helper).not.toContain("string | null");
    expect(helper).not.toContain("One mutant");
    const docStart = src.lastIndexOf("/**", src.indexOf("export function readLastInvocationTs"));
    const doc = src.slice(docStart, src.indexOf("export function readLastInvocationTs"));
    expect(doc).toContain("null");
    expect(doc).not.toContain("or unreadable");
  });

  it("D5: a zero-byte log is not corrupt, and the other two labels stay in their cases", () => {
    const dir = scratch();
    const empty = join(dir, "empty.jsonl");
    writeFileSync(empty, "");
    const read = readLastInvocationTs(empty);
    expect(read).not.toBeNull();
    expect(String(read)).not.toContain("corrupt");
    expect(String(read)).toBe("empty");
    const scored = scorePipelineHealth({ lastHookRun: read, scoreTrend: "unknown" });
    const missing = scorePipelineHealth({ lastHookRun: null, scoreTrend: "unknown" });
    expect(scored.score).toBe(missing.score);
    expect(scored.details.invocationLog).toBe("empty");
    expect(scored.details.invocationLog).not.toBe("ran");

    const events = scratch();
    writeSessionDb(events, "s.db", (db) => {
      db.exec(META);
      db.prepare(
        "INSERT INTO session_meta (session_id, project_dir, started_at, last_event_at, event_count) VALUES (?, ?, ?, ?, ?)",
      ).run("s", "/tmp/proj", "t", "t", 1);
      db.prepare("INSERT INTO session_events (type, data, created_at) VALUES (?, ?, ?)").run(
        "tool_call",
        "not a summary event",
        "t",
      );
    });
    const onlyOther = linesFor(events, "");
    expect(onlyOther).not.toContain("Summary: skipped — no events");
    expect(onlyOther).toContain("no summary events");

    const absent = linesFor(join(scratch(), "missing-sessions"), "wanted-session");
    expect(absent).not.toContain("no db holds this session");
    expect(absent).toContain("Summary: skipped — no session db");
  });
});
