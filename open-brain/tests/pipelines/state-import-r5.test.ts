/**
 * Importer leftovers round 5 (docs/loops/importer-leftovers-rulings-qa138.md,
 * record 147): R5-1, R5-2 and O-e. R5-3 is in state-import-ebusy.test.ts,
 * because it mocks node:fs for the whole file.
 *
 * Written before the fixes and run red against d500730, so it uses only what
 * that build exports and fails on an assertion, not a type error. Every
 * fixture is bytes, so the file runs the same on Linux (tcm) as on Windows.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runDraft, runCommit, STATE_REL } from "../../src/pipelines/state-import/index.js";

const TODAY = "2026-09-26";
const INBOX = ".agents/TASKS/INBOX.md";
const TASK = ".agents/TASKS/task.md";
const NEXT = ".agents/SESSIONS/next-session.md";
const DECISIONS = ".agents/SYSTEM/DECISIONS.md";
const LOG = ".agents/SESSIONS/Session_7.md";

const inboxText = (n: number) => `# Inbox — priorities\r\n\r\n> **Last Updated:** Session ${n}\r\n\r\n## P0 — Critical\r\n\r\n- [ ] **A task** — do it\r\n`;
const taskText = (n: number) => `# Current Focus — work\r\n\r\n> **Focus:** Session ${n}\r\n\r\n## Current Objective\r\n\r\nShip the thing.\r\n`;
const nextText = (n: number) => `# Next Session Handoff — notes\r\n\r\n> Updated at end of Session ${n}.\r\n\r\n## Pick up here\r\n\r\nCarry on.\r\n`;
/** /end A7's three parts as `##` sections, no `# ` title: the shape QA 138's D2 names. */
const nextSectionsOnly = (n: number) => `## Pick up here (Session ${n})\r\n\r\nCarry on.\r\n\r\n## Watch out for\r\n\r\n- the hold\r\n`;
/** FE FF then UTF-8 bytes, padded to an ODD length: a BE mark that lies, as .NET writes it. */
const oddBe = (s: string) => { const b = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(s, "utf8")]); return b.length % 2 ? b : Buffer.concat([b, Buffer.from("x")]); };

function writeProject(root: string, files: Partial<Record<string, string | Buffer>> = {}): void {
  for (const d of ["SESSIONS", "TASKS", "SYSTEM"]) mkdirSync(join(root, ".agents", d), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "r5-fixture", version: "1.0.0" }));
  writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "# Summary\n\n> status\n\n## About\n\nKept.\n");
  const all = { [LOG]: "# Session 7 — 2026-09-20\n", [INBOX]: inboxText(7), [TASK]: taskText(7), [NEXT]: nextText(7), ...files } as Record<string, string | Buffer>;
  for (const [rel, body] of Object.entries(all)) writeFileSync(join(root, rel), body);
}
interface Judged { input: string; verdict: string; evidence: string; declared_session: number | null; could_not_tell?: string }
const judged = (root: string, input: string): Judged =>
  (runDraft(root, TODAY).draft.report.staleness.inputs as Judged[]).find((i) => i.input === input)!;
const verdictOf = (j: Judged) => `${j.verdict}${j.could_not_tell ? `/${j.could_not_tell}` : ""}`;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "ob-import-r5-")); });
afterEach(() => { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });

describe("R5-1: the title rule is 'no ATX heading at any level'", () => {
  it("a `##`-only next-session.md is judged by its heading: stale when it names an older session", () => {
    writeProject(root, { [NEXT]: nextSectionsOnly(6) });
    const j = judged(root, NEXT);
    expect(verdictOf(j)).toBe("stale");
    expect(j.declared_session).toBe(6);
  });

  it("a `##`-only next-session.md naming the latest session is current, and a bare --commit imports its pick_up", () => {
    writeProject(root, { [NEXT]: nextSectionsOnly(7) });
    expect(verdictOf(judged(root, NEXT))).toBe("current");
    runCommit(root, TODAY);
    const state = JSON.parse(readFileSync(join(root, STATE_REL), "utf8")) as { handoffs: Array<{ pick_up: string }> };
    expect(state.handoffs.map((h) => h.pick_up)).toEqual(["Carry on."]);
  });

  // A heading-only file declares its session in a heading: the status
  // blockquote is read only under a `# ` title (declaredSession, unchanged).
  const HEADINGS: Array<[string, string, string]> = [
    ["`###### ` (level 6)", "###### Inbox (Session 6)", "stale"],
    ["`## ` (level 2)", "## Inbox (Session 6)", "stale"],
    ["a bare `#` line (end of line)", "#", "could_not_tell/no_declared_session"],
    ["a bare `###` line", "###", "could_not_tell/no_declared_session"],
  ];
  for (const [label, line, want] of HEADINGS) {
    it(`an INBOX.md whose only heading is ${label} is judged (${want}), not unreadable`, () => {
      writeProject(root, { [INBOX]: `${line}\r\n\r\n> **Last Updated:** Session 6\r\n\r\n- [ ] **A task** — do it\r\n` });
      expect(verdictOf(judged(root, INBOX))).toBe(want);
    });
  }

  const NOT_HEADINGS: Array<[string, string]> = [
    ["`####### ` (seven)", "####### Inbox"],
    ["`#Inbox` (no space)", "#Inbox"],
    ["`#<TAB>Inbox`", "#\tInbox"],
    ["an indented `  # Inbox`", "  # Inbox"],
  ];
  for (const [label, line] of NOT_HEADINGS) {
    it(`guard: an INBOX.md whose only candidate is ${label} has no heading line`, () => {
      writeProject(root, { [INBOX]: `${line}\r\n\r\n> **Last Updated:** Session 6\r\n\r\n- [ ] **A task** — do it\r\n` });
      const j = judged(root, INBOX);
      expect(verdictOf(j)).toBe("could_not_tell/unreadable");
      expect(j.evidence).toMatch(/has no heading line/);
    });
  }

  it("the wording on a valid UTF-8 file says it has no heading line, and makes no claim about its encoding", () => {
    writeProject(root, { [INBOX]: "Inbox\r\n\r\n> **Last Updated:** Session 6\r\n" });
    const j = judged(root, INBOX);
    expect(verdictOf(j)).toBe("could_not_tell/unreadable");
    expect(j.evidence).toMatch(/has no heading line/);
    expect(j.evidence).not.toMatch(/encoding|UTF-7|UTF-16|byte-order/i);
    expect(() => runCommit(root, TODAY)).toThrow(new RegExp(`${esc(INBOX)} has no heading line`));
  });

  it("the wording on a UTF-8-BOM file makes no claim about its encoding either", () => {
    writeProject(root, { [INBOX]: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("Inbox\r\n\r\n> Session 6\r\n", "utf8")]) });
    const j = judged(root, INBOX);
    expect(j.evidence).toMatch(/has no heading line/);
    expect(j.evidence).not.toMatch(/encoding|UTF-7|UTF-16|byte-order/i);
  });

  it("UTF-7 stays blocked on every judged input, worded without an encoding claim (UTF-7 is valid UTF-8 bytes)", () => {
    for (const rel of [INBOX, TASK, NEXT]) {
      rmSync(root, { recursive: true, force: true });
      mkdirSync(root);
      writeProject(root, { [rel]: Buffer.from("+ACM- Title\r\n\r\n+AD4- Session 6\r\n", "ascii") });
      const j = judged(root, rel);
      expect(verdictOf(j)).toBe("could_not_tell/unreadable");
      expect(j.evidence).not.toMatch(/encoding/i);
      expect(() => runCommit(root, TODAY)).toThrow(new RegExp(`${esc(rel)} has no heading line`));
    }
  });

  it("zero bytes stay blocked and are said to be empty", () => {
    writeProject(root, { [INBOX]: Buffer.alloc(0) });
    const j = judged(root, INBOX);
    expect(verdictOf(j)).toBe("could_not_tell/unreadable");
    expect(j.evidence).toMatch(/has no heading line \(it is empty\)/);
  });

  it("a UTF-16LE mark over UTF-8 bytes stays blocked, and the evidence names the mark its decode followed", () => {
    writeProject(root, { [INBOX]: Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(inboxText(6), "utf8")]) });
    const j = judged(root, INBOX);
    expect(verdictOf(j)).toBe("could_not_tell/unreadable");
    expect(j.evidence).toMatch(/has no heading line/);
    expect(j.evidence).toMatch(/UTF-16LE byte-order mark/);
  });

  it("a Windows-1252 read with no heading line keeps the encoding sentence: that decode was a guess", () => {
    writeProject(root, { [INBOX]: Buffer.from([...Buffer.from("Inbox \x93quoted\x94\r\n\r\n> Session 6\r\n", "latin1")]) });
    const j = judged(root, INBOX);
    expect(verdictOf(j)).toBe("could_not_tell/unreadable");
    expect(j.evidence).toMatch(/has no heading line/);
    expect(j.evidence).toMatch(/encoding/);
    expect(j.evidence).toMatch(/read as Windows-1252/);
  });
});

describe("R5-2: an odd-length input with a UTF-16BE mark is filed unreadable, never thrown", () => {
  const named = /has a UTF-16BE byte-order mark \(FE FF\)[^\n]*odd number of bytes \((\d+)\)/;

  for (const [rel, text] of [[INBOX, inboxText(6)], [TASK, taskText(6)]] as const) {
    it(`a judged ${rel} is unreadable, its evidence names FE FF and the odd byte count, and a bare --commit refuses naming it`, () => {
      const bytes = oddBe(text);
      writeProject(root, { [rel]: bytes });
      const j = judged(root, rel);
      expect(verdictOf(j)).toBe("could_not_tell/unreadable");
      expect(j.evidence).toMatch(named);
      expect(j.evidence.match(named)![1]).toBe(String(bytes.length));
      expect(() => runCommit(root, TODAY)).toThrow(new RegExp(`${esc(rel)} has a UTF-16BE byte-order mark`));
    });
  }

  it("a not-judged DECISIONS.md is named in not_judged and does not block (R4-5)", () => {
    const bytes = oddBe("# Decisions\r\n\r\n### ADR-1: one\r\n\r\n- **Date:** 2026-09-01\r\n");
    writeProject(root, { [DECISIONS]: bytes });
    const r = runDraft(root, TODAY).draft.report.staleness;
    const nj = r.not_judged.find((n: { input: string }) => n.input === DECISIONS) as { reason: string };
    expect(nj.reason).toMatch(named);
    expect(() => runCommit(root, TODAY)).not.toThrow();
  });

  it("the latest session log of that shape does not stop the draft or the commit", () => {
    writeProject(root, { [LOG]: oddBe("# Session 7 — 2026-09-20\n") });
    const d = runDraft(root, TODAY);
    expect(d.draft.report.last_session.n).toBe(7);
    expect(() => runCommit(root, TODAY)).not.toThrow();
  });

  it("guard: an EVEN-length BE mark over UTF-16BE text is read as before", () => {
    writeProject(root, { [INBOX]: Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(inboxText(6), "utf16le").swap16()]) });
    expect(verdictOf(judged(root, INBOX))).toBe("stale");
  });
});

describe("O-e: two or more markers do not speak of one snapshot", () => {
  it("the refusal says every snapshot, not the snapshot", () => {
    writeProject(root);
    runDraft(root, TODAY);
    for (const day of ["2026-09-24", "2026-09-23"]) {
      const snap = `.agents/archive/pre-state-migration-${day}`;
      mkdirSync(join(root, snap), { recursive: true });
      writeFileSync(join(root, `${snap}.import-incomplete`), "died\n");
    }
    expect(() => runCommit(root, TODAY)).toThrow(/Keep a copy of every snapshot until the re-run completes/);
    expect(() => runCommit(root, TODAY)).not.toThrow(/Keep a copy of the snapshot until/);
  });
});
