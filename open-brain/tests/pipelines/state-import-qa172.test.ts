/**
 * QA 172 (record session 172) on importer leftovers round 6, candidate c2ee52d.
 * QA evidence, not for merge. Each row kills a QA 172 mutant (see mutants-qa172.cjs).
 * Byte fixtures, so the file runs the same on tcm (Linux) as on Windows.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runDraft, runCommit, renderImportReport, describeLastSession, STATE_REL } from "../../src/pipelines/state-import/index.js";

const cliEntry = join(import.meta.dirname, "../../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const now = new Date();
const TODAY = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const LOG_DATE = "2026-09-23";
const INBOX = ".agents/TASKS/INBOX.md";
const TASK = ".agents/TASKS/task.md";
const NEXT = ".agents/SESSIONS/next-session.md";
const DECISIONS = ".agents/SYSTEM/DECISIONS.md";
const LOG = ".agents/SESSIONS/Session_7.md";

const inboxText = (n: number) => `# Inbox — priorities\r\n\r\n> **Last Updated:** Session ${n}\r\n\r\n## P0 — Critical\r\n\r\n- [ ] **A task** — do it\r\n`;
const taskText = (n: number) => `# Current Focus — work\r\n\r\n> **Focus:** Session ${n}\r\n\r\n## Current Objective\r\n\r\nShip the thing.\r\n`;
const nextText = (n: number) => `# Next Session Handoff — notes\r\n\r\n> Updated at end of Session ${n}.\r\n\r\n## Pick up here\r\n\r\nCarry on.\r\n`;
const adr = "# Decisions\r\n\r\n### ADR-1: one\r\n\r\n- **Date:** 2026-09-01\r\n";
const oddBeLie = (s: string) => {
  const b = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(s, "utf8")]);
  return b.length % 2 ? b : Buffer.concat([b, Buffer.from("x")]);
};

function writeProject(root: string, files: Record<string, string | Buffer> = {}): void {
  for (const d of ["SESSIONS", "TASKS", "SYSTEM"]) mkdirSync(join(root, ".agents", d), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "qa172-fixture", version: "1.0.0" }));
  writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "# Summary\n\n> status\n\n## About\n\nKept.\n");
  const all: Record<string, string | Buffer> = {
    [LOG]: `# Session 7 — ${LOG_DATE}\n`,
    [INBOX]: inboxText(7),
    [TASK]: taskText(7),
    [NEXT]: nextText(7),
    ...files,
  };
  for (const [rel, body] of Object.entries(all)) writeFileSync(join(root, rel), body);
}

function cli(args: string[], cwd: string): { status: number | null; stdout: string } {
  const r = spawnSync(process.execPath, [tsxCli, cliEntry, ...args], { cwd, encoding: "utf8", env: process.env });
  return { status: r.status, stdout: r.stdout ?? "" };
}

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "ob-import-qa172-")); });
afterEach(() => { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });

describe("QA 172 M1/M5: describeLastSession is wired into report and CLI", () => {
  it("the unreadable log line appears in renderImportReport (M5)", () => {
    writeProject(root, { [LOG]: oddBeLie(`# Session 7 — ${LOG_DATE}\n`) });
    const last = runDraft(root, TODAY).draft.report.last_session;
    const line = describeLastSession(last);
    expect(line).toMatch(/Session_7\.md/);
    expect(line).toMatch(/Date used:/);
    const report = renderImportReport(runDraft(root, TODAY).draft.report, "draft");
    expect(report).toContain(line!);
  });

  it("--draft stdout carries the line (M4 would drop it from cli.ts)", () => {
    writeProject(root, { [LOG]: oddBeLie(`# Session 7 — ${LOG_DATE}\n`) });
    const d = cli(["state", "import", "--draft"], root);
    expect(d.status).toBe(0);
    expect(d.stdout).toMatch(/Date used:.*because the log's date line could not be read/);
  });
});

describe("QA 172 M2: the date why-string is explicit, not a silent substitution", () => {
  it("the lie uses the migration date with a stated reason", () => {
    writeProject(root, { [LOG]: oddBeLie(`# Session 7 — ${LOG_DATE}\n`) });
    const last = runDraft(root, TODAY).draft.report.last_session;
    expect(last.date).toBe(TODAY);
    expect(last.date_why).toBe("the migration date, because the log's date line could not be read");
    expect(describeLastSession(last)).toMatch(/the migration date, because the log's date line could not be read/);
  });
});

describe("QA 172 M3: odd-length DECISIONS.md does not say none found", () => {
  it("adrNotImported returns could not be read for the odd-length lie", () => {
    writeProject(root, { [DECISIONS]: oddBeLie(adr) });
    const report = renderImportReport(runDraft(root, TODAY).draft.report, "draft");
    expect(report).toMatch(/ADRs NOT imported[^\n]*could not be read/);
    expect(report).not.toMatch(/ADRs NOT imported[^\n]*none found/);
    runCommit(root, TODAY);
    const state = JSON.parse(readFileSync(join(root, STATE_REL), "utf8")) as { decisions: unknown[] };
    expect(state.decisions).toEqual([]);
  });
});
