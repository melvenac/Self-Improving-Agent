/**
 * Importer leftovers round 6 (record 166): QA 153 D1 and the DECISIONS.md
 * "none found" line. Written against e2f202b, so it fails on an assertion.
 * Fixtures are bytes, so Linux (tcm) and Windows run the same file.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runDraft, runCommit, renderImportReport, STATE_REL } from "../../src/pipelines/state-import/index.js";

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
/** FE FF then UTF-8, padded to an odd length: the mark lies. */
const oddBeLie = (s: string) => {
  const b = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(s, "utf8")]);
  return b.length % 2 ? b : Buffer.concat([b, Buffer.from("x")]);
};
/** Genuine UTF-16BE plus one stray byte, so the length is odd. */
const oddBeGenuine = (s: string) => {
  const body = Buffer.from(s, "utf16le").swap16();
  const b = Buffer.concat([Buffer.from([0xfe, 0xff]), body, Buffer.from([0x41])]);
  if (b.length % 2 === 0) throw new Error("fixture length must be odd");
  return b;
};

function writeProject(root: string, files: Record<string, string | Buffer>): void {
  for (const d of ["SESSIONS", "TASKS", "SYSTEM"]) mkdirSync(join(root, ".agents", d), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "r6-fixture", version: "1.0.0" }));
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

function cli(args: string[], cwd: string): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [tsxCli, cliEntry, ...args], { cwd, encoding: "utf8", env: process.env });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

const named = /Session_7\.md[\s\S]{0,400}FE FF[\s\S]{0,200}odd number of bytes/;

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "ob-import-r6-")); });
afterEach(() => { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });

describe("QA 153 D1: an odd-length FE FF latest session log is named, and its date is not a silent migration date", () => {
  it("the lie is named in the report, --draft and --commit, and the migration date is said to be the migration date", () => {
    writeProject(root, { [LOG]: oddBeLie(`# Session 7 — ${LOG_DATE}\n`) });
    const draft = runDraft(root, TODAY);
    const report = renderImportReport(draft.draft.report, "draft");
    expect(report).toMatch(named);
    expect(report).toMatch(new RegExp(`Date used: ${TODAY}, the migration date, because the log's date line could not be read`));
    expect(draft.draft.report.last_session.date).toBe(TODAY);
    expect(draft.draft.report.last_session.date).not.toBe(LOG_DATE);

    const d = cli(["state", "import", "--draft"], root);
    expect(d.status).toBe(0);
    expect(d.stdout).toMatch(named);
    expect(d.stdout).toMatch(new RegExp(`Date used: ${TODAY}, the migration date, because the log's date line could not be read`));

    const c = cli(["state", "import", "--commit"], root);
    expect(c.status).toBe(0);
    expect(c.stdout).toMatch(named);
    expect(c.stdout).toMatch(new RegExp(`Date used: ${TODAY}, the migration date, because the log's date line could not be read`));
    const state = JSON.parse(readFileSync(join(root, STATE_REL), "utf8")) as { sessions: Array<{ date: string }> };
    expect(state.sessions[0].date).toBe(TODAY);
  });

  it("the genuine odd-length file is named too, and the date read from the even part is not replaced", () => {
    writeProject(root, { [LOG]: oddBeGenuine(`# Session 7 — ${LOG_DATE}\n`) });
    const draft = runDraft(root, TODAY);
    const report = renderImportReport(draft.draft.report, "draft");
    expect(report).toMatch(named);
    expect(draft.draft.report.last_session.date).toBe(LOG_DATE);
    expect(report).toMatch(/Date used: 2026-09-23, read from the log heading/);
    const d = cli(["state", "import", "--draft"], root);
    const c = cli(["state", "import", "--commit"], root);
    expect(d.stdout).toMatch(named);
    expect(c.stdout).toMatch(named);
    expect(c.stdout).toMatch(/Date used: 2026-09-23, read from the log heading/);
  });
});

describe("QA 153 D2: an unreadable DECISIONS.md does not say no ADRs were found", () => {
  it("the odd-length lie says the headings could not be read, in the report and both stdouts", () => {
    writeProject(root, { [DECISIONS]: oddBeLie(adr) });
    const report = renderImportReport(runDraft(root, TODAY).draft.report, "draft");
    expect(report).not.toMatch(/ADRs NOT imported[^\n]*none found/);
    expect(report).toMatch(/could not be read/);
    const d = cli(["state", "import", "--draft"], root);
    const c = cli(["state", "import", "--commit"], root);
    for (const out of [d.stdout, c.stdout]) {
      expect(out).not.toMatch(/ADRs NOT imported[^\n]*none found/);
      expect(out).toMatch(/could not be read/);
    }
    expect(c.status).toBe(0);
    const state = JSON.parse(readFileSync(join(root, STATE_REL), "utf8")) as { decisions: Array<{ id: string }> };
    expect(state.decisions).toEqual([]);
  });
});
