/**
 * Guards the bytes Windows PowerShell 5.1 writes for UTF-32 and UTF-7.
 * UTF-32LE and UTF-7 are judged and a bare --commit does not import a stale
 * INBOX. UTF-32BE holds NUL bytes, so it is unreadable and blocks. The bytes
 * are what PS 5.1.19041.6456 wrote. Kept because those exact buffers are the
 * fixture, and the file runs on tcm.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, lstatSync, readFileSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { runDraft, runCommit } from "../../src/pipelines/state-import/index.js";

const TODAY = "2026-09-25";
const INBOX = ".agents/TASKS/INBOX.md";

function tree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      const rel = relative(dir, p).replace(/\\/g, "/");
      const l = lstatSync(p);
      if (l.isDirectory()) { out[rel + "/"] = "dir"; walk(p); continue; }
      out[rel] = `${createHash("sha256").update(readFileSync(p)).digest("hex")} ${l.size} m${l.mtimeMs}${l.mode & 0o200 ? "" : " RO"}`;
    }
  };
  walk(dir);
  return out;
}

/** INBOX.md as text: it declares Session 6, one behind the latest log, and holds one task. */
const INBOX6 = "# Inbox — priorities\r\n\r\n> **Last Updated:** Session 6\r\n\r\n## P0 — Critical\r\n\r\n- [ ] **A task** — do it\r\n";

/** Set-Content -Encoding UTF32: UTF-32LE with the BOM FF FE 00 00. Every character here is in the BMP. */
function utf32le(s: string): Buffer {
  const b = Buffer.alloc(4 + s.length * 4);
  b.writeUInt32LE(0xfeff, 0);
  for (let i = 0; i < s.length; i++) b.writeUInt32LE(s.charCodeAt(i), 4 + i * 4);
  return b;
}
function utf32be(s: string): Buffer {
  const b = Buffer.alloc(4 + s.length * 4);
  b.writeUInt32BE(0xfeff, 0);
  for (let i = 0; i < s.length; i++) b.writeUInt32BE(s.charCodeAt(i), 4 + i * 4);
  return b;
}
/** Set-Content -Encoding UTF7, INBOX6 exactly as PS 5.1 wrote it: `>`, `*`, `#`, `[` and `]` are encoded. */
const UTF7 = Buffer.from(
  "+ACM- Inbox +IBQ- priorities\r\n\r\n+AD4- +ACoAKg-Last Updated:+ACoAKg- Session 6\r\n\r\n+ACMAIw- P0 +IBQ- Critical\r\n\r\n- +AFs- +AF0- +ACoAKg-A task+ACoAKg- +IBQ- do it\r\n",
  "ascii",
);

function writeProject(root: string, inbox: Buffer): void {
  for (const d of ["SESSIONS", "TASKS", "SYSTEM"]) mkdirSync(join(root, ".agents", d), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "qa122", version: "1.0.0" }));
  writeFileSync(join(root, ".agents/SESSIONS/Session_7.md"), "# Session 7 — 2026-09-20\n");
  writeFileSync(join(root, ".agents/SESSIONS/next-session.md"), "# Next Session Handoff — notes\n\n> Updated at end of Session 7.\n\n## Pick up here\n\nCarry on.\n");
  writeFileSync(join(root, ".agents/TASKS/task.md"), "# Current Focus — work\n\n> **Focus:** Session 7\n\n## Current Objective\n\nShip the thing.\n");
  writeFileSync(join(root, INBOX), inbox);
  writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "# Summary\n\n> status\n\n## About\n\nKept.\n");
}

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "ob-import-qa122-")); });
afterEach(() => { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });

describe("QA 122 D11: an INBOX.md the importer reads wrongly, without NUL detection, does not block", () => {
  it("the fixture is what PS 5.1 wrote: UTF-32LE begins FF FE 00 00, and UTF-7 decodes to no status blockquote", () => {
    expect(utf32le(INBOX6).subarray(0, 8).toString("hex")).toBe("fffe000023000000");
    expect(UTF7.includes(Buffer.from("> **Last Updated:**"))).toBe(false);
  });

  for (const [shape, bytes] of [["UTF-32LE with a BOM (Set-Content -Encoding UTF32)", utf32le(INBOX6)], ["UTF-7 (Set-Content -Encoding UTF7)", UTF7]] as Array<[string, Buffer]>) {
    it(`${shape}, declaring Session 6 against a latest of 7: a bare --commit refuses, and the tree is identical`, () => {
      writeProject(root, bytes);
      runDraft(root, TODAY);
      const before = tree(root);
      expect(() => runCommit(root, TODAY)).toThrow();
      expect(tree(root)).toEqual(before);
    });
  }

  it("guard: UTF-32BE with a BOM (00 00 FE FF) holds NUL bytes after a UTF-8 decode, so it is unreadable and blocks", () => {
    writeProject(root, utf32be(INBOX6));
    runDraft(root, TODAY);
    expect(() => runCommit(root, TODAY)).toThrow(/cannot be read/);
  });
});
