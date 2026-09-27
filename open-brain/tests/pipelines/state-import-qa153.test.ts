/**
 * QA 153 (record session 153) on importer leftovers round 5, candidate e2f202b.
 * QA evidence, not for merge. Byte fixtures, so the file runs the same on tcm (Linux) as on Windows.
 *
 * RED on e2f202b by design (the defects in docs/loops/importer-leftovers-r5-qa-report.md):
 *   - D1: an odd-length FE FF latest session log is not named anywhere (R5-2 says a session log of that shape is
 *     named, as R4-5 names DECISIONS.md), and its date silently becomes the migration date.
 *   - D2: an odd-length FE FF DECISIONS.md over UTF-8 text says "ADRs NOT imported: none found" while ADR-1 is in
 *     its bytes and was not imported.
 * GREEN on e2f202b, and each kills a QA 153 mutant that survived the candidate's own tests (see the report).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runDraft, runCommit, STATE_REL } from "../../src/pipelines/state-import/index.js";

const TODAY = "2026-09-26";
const INBOX = ".agents/TASKS/INBOX.md";
const DECISIONS = ".agents/SYSTEM/DECISIONS.md";
const LOG = ".agents/SESSIONS/Session_7.md";

const inboxText = (n: number) => `# Inbox — priorities\r\n\r\n> **Last Updated:** Session ${n}\r\n\r\n## P0 — Critical\r\n\r\n- [ ] **A task** — do it\r\n`;
const oddBe = (s: string) => { const b = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(s, "utf8")]); return b.length % 2 ? b : Buffer.concat([b, Buffer.from(" ")]); };
/** A genuine UTF-16BE file (Set-Content -Encoding BigEndianUnicode), then one byte appended. */
const bePlusByte = (s: string) => Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(s, "utf16le").swap16(), Buffer.from([0x0a])]);
const ADR = "# Decisions\r\n\r\n### ADR-1: one\r\n\r\n- **Date:** 2026-01-01\r\n\r\nWe chose one.\r\n";

function writeProject(root: string, files: Partial<Record<string, string | Buffer>> = {}): void {
  for (const d of ["SESSIONS", "TASKS", "SYSTEM"]) mkdirSync(join(root, ".agents", d), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "qa153-fixture", version: "1.0.0" }));
  writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "# Summary\n\n> status\n\n## About\n\nKept.\n");
  const all = { [LOG]: "# Session 7 — 2026-09-20\n", [INBOX]: inboxText(7), ...files } as Record<string, string | Buffer>;
  for (const [rel, body] of Object.entries(all)) writeFileSync(join(root, rel), body);
}

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "ob-import-qa153-")); });
afterEach(() => { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });

describe("QA 153 D1 (RED): an odd-length FE FF session log is named (R5-2, as R4-5 names DECISIONS.md)", () => {
  it("the draft's report names Session_7.md and the FE FF mark", () => {
    writeProject(root, { [LOG]: oddBe("# Session 7 — 2026-09-20\n") });
    const d = runDraft(root, TODAY);
    const report = readFileSync(d.reportPath, "utf8");
    expect(report).toMatch(/Session_7\.md[^\n]*UTF-16BE byte-order mark \(FE FF\)/);
  });
});

describe("QA 153 D2 (RED): an odd-length FE FF DECISIONS.md names the ADRs it did not import", () => {
  it("ADR-1 is in the file's bytes and not imported, so it is listed as NOT imported", () => {
    writeProject(root, { [DECISIONS]: oddBe(ADR) });
    const u = runDraft(root, TODAY).draft.report.decisions_unreadable as { imported: string[]; not_imported: string[] } | null;
    expect(u).not.toBeNull();
    expect(u!.imported).toEqual([]);
    expect(u!.not_imported).toContain("ADR-1");
  });
});

describe("QA 153 coverage (GREEN): what the candidate's own tests left open", () => {
  // B3: the odd file's text is read two bytes a character from the mark, so a genuine UTF-16BE DECISIONS.md with
  // one stray byte is imported as far as it reads (R4-5), not lost.
  it("a genuine UTF-16BE DECISIONS.md with one byte appended imports ADR-1, and does not block", () => {
    writeProject(root, { [DECISIONS]: bePlusByte(ADR) });
    const u = runDraft(root, TODAY).draft.report.decisions_unreadable as { imported: string[] } | null;
    expect(u!.imported).toEqual(["ADR-1"]);
    runCommit(root, TODAY);
    const state = JSON.parse(readFileSync(join(root, STATE_REL), "utf8")) as { decisions: Array<{ id: string }> };
    expect(state.decisions.map((x) => x.id)).toEqual(["ADR-1"]);
  });

  // A10: the refusal at --commit words a BOM path as the draft does: it names the mark its decode followed.
  it("a UTF-16LE mark over UTF-8 bytes: the bare --commit refusal names the mark, as the draft's evidence does", () => {
    writeProject(root, { [INBOX]: Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(inboxText(6), "utf8")]) });
    runDraft(root, TODAY);
    expect(() => runCommit(root, TODAY)).toThrow(/INBOX\.md has no heading line as its UTF-16LE byte-order mark reads it/);
  });

  // E2: with two or more markers the re-run's --force-snapshot deletes today's snapshot, not "it".
  it("two markers: the refusal says --force-snapshot deletes today's, and one marker says it", () => {
    writeProject(root);
    runDraft(root, TODAY);
    const mark = (day: string) => {
      const snap = `.agents/archive/pre-state-migration-${day}`;
      mkdirSync(join(root, snap), { recursive: true });
      writeFileSync(join(root, `${snap}.import-incomplete`), "died\n");
    };
    mark("2026-09-24");
    expect(() => runCommit(root, TODAY)).toThrow(/Keep a copy of the snapshot until the re-run completes: that re-run needs --force-snapshot, which deletes it on success$/);
    mark("2026-09-23");
    expect(() => runCommit(root, TODAY)).toThrow(/Keep a copy of every snapshot until the re-run completes: that re-run needs --force-snapshot, which deletes today's on success$/);
  });
});
