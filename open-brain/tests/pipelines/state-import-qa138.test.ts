/**
 * Guards the importer's unreadable-input rows that QA 138 first wrote, kept
 * because they still name the behavior: an odd-length UTF-16BE mark is filed
 * unreadable and does not throw; a judged file with no title line is not
 * blamed on its encoding; task.md and next-session.md follow the same
 * no-title rule as INBOX.md; a NUL is named by its byte; zero bytes are
 * said to be empty. Byte fixtures, so the file runs on tcm and on Windows.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runDraft, runCommit } from "../../src/pipelines/state-import/index.js";

const TODAY = "2026-09-26";
const INBOX = ".agents/TASKS/INBOX.md";
const TASK = ".agents/TASKS/task.md";
const NEXT = ".agents/SESSIONS/next-session.md";
const DECISIONS = ".agents/SYSTEM/DECISIONS.md";

const inboxText = (n: number) => `# Inbox — priorities\r\n\r\n> **Last Updated:** Session ${n}\r\n\r\n## P0 — Critical\r\n\r\n- [ ] **A task** — do it\r\n`;
const taskText = (n: number) => `# Current Focus — work\r\n\r\n> **Focus:** Session ${n}\r\n\r\n## Current Objective\r\n\r\nShip the thing.\r\n`;
const nextText = (n: number) => `# Next Session Handoff — notes\r\n\r\n> Updated at end of Session ${n}.\r\n\r\n## Pick up here\r\n\r\nCarry on.\r\n`;
/** QA 122's known positive (aff7135): Set-Content -Encoding UTF7 of a title line and a status line. */
const utf7 = (words: string, n: number) => Buffer.from(`+ACM- ${words}\r\n\r\n+AD4- Session ${n}\r\n`, "ascii");
const oddBe = (s: string) => { const b = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(s, "utf8")]); return b.length % 2 ? b : Buffer.concat([b, Buffer.from("x")]); };

function writeProject(root: string, files: Partial<Record<string, string | Buffer>> = {}): void {
  for (const d of ["SESSIONS", "TASKS", "SYSTEM"]) mkdirSync(join(root, ".agents", d), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "qa138-fixture", version: "1.0.0" }));
  writeFileSync(join(root, ".agents/SESSIONS/Session_7.md"), "# Session 7 — 2026-09-20\n");
  writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "# Summary\n\n> status\n\n## About\n\nKept.\n");
  const all: Record<string, string | Buffer> = { [INBOX]: inboxText(7), [TASK]: taskText(7), [NEXT]: nextText(7), ...files } as Record<string, string | Buffer>;
  for (const [rel, body] of Object.entries(all)) writeFileSync(join(root, rel), body);
}
interface Judged { input: string; verdict: string; evidence: string; could_not_tell?: string }
const judged = (root: string, input: string): Judged =>
  (runDraft(root, TODAY).draft.report.staleness.inputs as Judged[]).find((i) => i.input === input)!;
const verdictOf = (j: Judged) => `${j.verdict}${j.could_not_tell ? `/${j.could_not_tell}` : ""}`;

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "ob-import-qa138-")); });
afterEach(() => { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });

describe("an odd-length UTF-16BE mark is unreadable and does not throw", () => {
  it("the fixture is odd: FE FF, then UTF-8 bytes", () => {
    const b = oddBe(inboxText(6));
    expect(b.subarray(0, 2).toString("hex")).toBe("feff");
    expect(b.length % 2).toBe(1);
  });

  it("a judged INBOX.md is filed unreadable, not thrown", () => {
    writeProject(root, { [INBOX]: oddBe(inboxText(6)) });
    const j = judged(root, INBOX);
    expect(verdictOf(j)).toBe("could_not_tell/unreadable");
  });

  it("a NOT-judged DECISIONS.md does not stop the draft (R4-5: not judged, so it does not block)", () => {
    writeProject(root, { [DECISIONS]: oddBe("# Decisions\r\n\r\n### ADR-1: one\r\n\r\n- **Date:** 2026-09-01\r\n") });
    expect(() => runDraft(root, TODAY)).not.toThrow();
  });
});

describe("a file the importer read, with no title line, is not blamed on its encoding", () => {
  it("a valid UTF-8 next-session.md with `##` sections and no `# ` line is not said to be in an unread encoding", () => {
    writeProject(root, { [NEXT]: "## Pick up here (Session 7)\r\n\r\nCarry on.\r\n\r\n## Watch out for\r\n\r\n- the hold\r\n" });
    const j = judged(root, NEXT);
    expect(j.evidence).not.toMatch(/encoding is not one the importer reads/);
  });
});

describe("task.md and next-session.md follow the no-title rule, and a NUL or an empty file says which", () => {
  // Q4: the rule applied to INBOX.md only survived every candidate test.
  const OTHERS: Array<[string, string, Buffer]> = [
    ["task.md in UTF-7", TASK, utf7("Current Focus", 6)],
    ["task.md with zero bytes", TASK, Buffer.alloc(0)],
    ["next-session.md in UTF-7", NEXT, utf7("Next Session Handoff", 6)],
    ["next-session.md with zero bytes", NEXT, Buffer.alloc(0)],
  ];
  for (const [label, rel, bytes] of OTHERS) {
    it(`${label}: unreadable, and a bare --commit refuses naming it`, () => {
      writeProject(root, { [rel]: bytes });
      expect(verdictOf(judged(root, rel))).toBe("could_not_tell/unreadable");
      expect(() => runCommit(root, TODAY)).toThrow(new RegExp(`${rel.replace(/\./g, "\\.")} has no heading line`));
    });
  }

  // Q5: the first NUL on a BOM path is a byte in the file: 2 of mark, then 2 per character.
  it("a UTF-16LE mark whose text holds a NUL names the NUL's byte in the file", () => {
    const text = inboxText(6);
    const at = text.length; // the NUL is appended after the text
    writeProject(root, { [INBOX]: Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text + "\u0000", "utf16le")]) });
    expect(judged(root, INBOX).evidence).toContain(`1 NUL character(s), the first at byte ${2 + at * 2}`);
  });

  // Q6: zero bytes are said to be empty, not blamed on an encoding.
  it("zero bytes: the evidence says it is empty", () => {
    writeProject(root, { [INBOX]: Buffer.alloc(0) });
    expect(judged(root, INBOX).evidence).toContain("it is empty");
  });
});
