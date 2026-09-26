/**
 * Importer leftovers (docs/loops/importer-r4-leftovers-brief.md): R4-4, R4-5
 * and O7 from the planner's rulings on QA 122
 * (docs/loops/importer-fixes-r4-rulings-qa122.md). O14 is held by the compiler,
 * not here: InputStaleness requires the could-not-tell reason by type.
 *
 * Written before the fixes and run red against f618b73 (the T-179 merge this
 * branch is stacked on), so it uses only what that build exports and fails on
 * an assertion, not a type error. Every fixture is bytes, so the file runs the
 * same on Linux (tcm) as on Windows.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, lstatSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { runDraft, runCommit, STATE_REL, REPORT_REL } from "../../src/pipelines/state-import/index.js";

const cliEntry = join(import.meta.dirname, "../../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const TODAY = "2026-09-25";
const INBOX = ".agents/TASKS/INBOX.md";
const DECISIONS = ".agents/SYSTEM/DECISIONS.md";

function cli(args: string[], cwd: string): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [tsxCli, cliEntry, ...args], { cwd, encoding: "utf8", env: process.env });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** Every entry under `dir`: a file is sha256, size, mtime and the read-only bit; a directory is listed. */
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

/** INBOX.md declaring Session `n`, holding one task. The latest log is Session 7. */
const inboxText = (n: number) => `# Inbox — priorities\r\n\r\n> **Last Updated:** Session ${n}\r\n\r\n## P0 — Critical\r\n\r\n- [ ] **A task** — do it\r\n`;
const INBOX6 = inboxText(6);

function utf32(s: string, be: boolean): Buffer {
  const b = Buffer.alloc(4 + s.length * 4);
  const w = (v: number, at: number) => (be ? b.writeUInt32BE(v, at) : b.writeUInt32LE(v, at));
  w(0xfeff, 0);
  for (let i = 0; i < s.length; i++) w(s.charCodeAt(i), 4 + i * 4);
  return b;
}
const utf16le = (s: string) => Buffer.from(s, "utf16le");
const utf16be = (s: string) => Buffer.from(s, "utf16le").swap16();
const BOM_LE = Buffer.from([0xff, 0xfe]);
const BOM_BE = Buffer.from([0xfe, 0xff]);
/** QA 122's known positive (qa/importer-fixes-r4-d11, aff7135): INBOX6 as PS 5.1's Set-Content -Encoding UTF7 wrote it. */
const UTF7 = Buffer.from(
  "+ACM- Inbox +IBQ- priorities\r\n\r\n+AD4- +ACoAKg-Last Updated:+ACoAKg- Session 6\r\n\r\n+ACMAIw- P0 +IBQ- Critical\r\n\r\n- +AFs- +AF0- +ACoAKg-A task+ACoAKg- +IBQ- do it\r\n",
  "ascii",
);

function writeProject(root: string, inbox: string | Buffer, decisions?: Buffer): void {
  for (const d of ["SESSIONS", "TASKS", "SYSTEM"]) mkdirSync(join(root, ".agents", d), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture-project", version: "1.0.0" }));
  writeFileSync(join(root, ".agents/SESSIONS/Session_7.md"), "# Session 7 — 2026-09-20\n");
  writeFileSync(join(root, ".agents/SESSIONS/next-session.md"), "# Next Session Handoff — notes\n\n> Updated at end of Session 7.\n\n## Pick up here\n\nCarry on.\n");
  writeFileSync(join(root, ".agents/TASKS/task.md"), "# Current Focus — work\n\n> **Focus:** Session 7\n\n## Current Objective\n\nShip the thing.\n");
  writeFileSync(join(root, INBOX), inbox);
  writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "# Summary\n\n> status\n\n## About\n\nKept.\n");
  if (decisions) writeFileSync(join(root, DECISIONS), decisions);
}

interface Judged { input: string; verdict: string; evidence: string; could_not_tell?: string }
const inboxOf = (report: unknown): Judged => (report as { staleness: { inputs: Judged[] } }).staleness.inputs.find((i) => i.input === INBOX)!;
const verdictOf = (j: Judged) => `${j.verdict}${j.could_not_tell ? `/${j.could_not_tell}` : ""}`;

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "ob-import-leftovers-")); });
afterEach(() => { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });

describe("R4-4 (D11): a judged input the importer reads wrongly is unreadable, and blocks a stale project", () => {
  it("the fixtures are the shapes named: UTF-32LE begins FF FE 00 00, UTF-32BE 00 00 FE FF, and UTF-7 holds no NUL and no `# `", () => {
    expect(utf32(INBOX6, false).subarray(0, 8).toString("hex")).toBe("fffe000023000000");
    expect(utf32(INBOX6, true).subarray(0, 8).toString("hex")).toBe("0000feff00000023");
    expect(UTF7.includes(0)).toBe(false);
    expect(UTF7.toString("latin1").split(/\r?\n/).some((l) => l.startsWith("# "))).toBe(false);
  });

  const UNREADABLE: Array<[string, Buffer, RegExp]> = [
    ["UTF-32LE with a BOM (Set-Content -Encoding UTF32)", utf32(INBOX6, false), /UTF-32/],
    ["UTF-32BE with a BOM (Set-Content -Encoding BigEndianUTF32)", utf32(INBOX6, true), /NUL byte/],
    ["UTF-7 (Set-Content -Encoding UTF7)", UTF7, /no readable `# ` title/],
    ["zero bytes (New-Item)", Buffer.alloc(0), /no readable `# ` title/],
    ["a UTF-8 BOM, then UTF-16LE (a BOM-only file, then >>)", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), utf16le(INBOX6)]), /NUL byte/],
    ["a UTF-16LE BOM whose text holds a NUL (a stray [char]0 added)", Buffer.concat([BOM_LE, utf16le(INBOX6 + "\u0000")]), /UTF-16LE byte-order mark.*NUL/],
    ["a UTF-16BE BOM whose text holds a NUL", Buffer.concat([BOM_BE, utf16be(INBOX6 + "\u0000")]), /UTF-16BE byte-order mark.*NUL/],
    ["a UTF-16LE BOM over UTF-8 bytes (a BOM that lies, with no NUL)", Buffer.concat([BOM_LE, Buffer.from(INBOX6, "utf8")]), /no readable `# ` title/],
  ];
  for (const [shape, bytes, why] of UNREADABLE) {
    it(`${shape}: could not tell (unreadable), a bare --commit refuses with the tree identical, and --accept-stale completes`, () => {
      writeProject(root, bytes);
      const j = inboxOf(runDraft(root, TODAY).draft.report);
      expect(verdictOf(j)).toBe("could_not_tell/unreadable");
      expect(j.evidence).toMatch(why);
      const before = tree(root);
      expect(() => runCommit(root, TODAY)).toThrow(/cannot be read/);
      expect(tree(root)).toEqual(before);
      const r = runCommit(root, TODAY, { acceptStale: true });
      expect(r.accepted_unreadable).toEqual([INBOX]);
      expect(existsSync(join(root, STATE_REL))).toBe(true);
    });
  }

  it("the refusal names the file and why, for a shape with no NUL at all (UTF-7)", () => {
    writeProject(root, UTF7);
    runDraft(root, TODAY);
    expect(() => runCommit(root, TODAY)).toThrow(new RegExp(`${INBOX.replace(/\./g, "\\.")} has no readable \`# \` title`));
  });

  // The guards: what the importer reads correctly is still judged as it reads.
  const READABLE: Array<[string, Buffer | string, number, string]> = [
    ["UTF-16LE with a BOM, stale", Buffer.concat([BOM_LE, utf16le(INBOX6)]), 6, "stale"],
    ["UTF-16BE with a BOM, stale", Buffer.concat([BOM_BE, utf16be(INBOX6)]), 6, "stale"],
    ["Windows-1252, stale", Buffer.from(INBOX6.replace(/—/g, "\x97"), "latin1"), 6, "stale"],
    ["UTF-8 with a BOM, current", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(inboxText(7))]), 7, "current"],
  ];
  for (const [shape, bytes, , want] of READABLE) {
    it(`guard: ${shape} is judged ${want}, not unreadable`, () => {
      writeProject(root, bytes);
      expect(verdictOf(inboxOf(runDraft(root, TODAY).draft.report))).toBe(want);
    });
  }

  // IF-10: a readable title, and a could-not-tell reason that does not block, still commit.
  const COMMITS: Array<[string, string, string]> = [
    ["+13: declares Session 20", inboxText(20), "could_not_tell/ahead_of_latest"],
    ["+1: declares Session 8", inboxText(8), "could_not_tell/ahead_of_latest"],
    ["a title and no Session N", "# Inbox — priorities\r\n\r\n## P0 — Critical\r\n\r\n- [ ] **A task** — do it\r\n", "could_not_tell/no_declared_session"],
  ];
  for (const [label, text, want] of COMMITS) {
    it(`guard (IF-10): ${label} is ${want} and a bare --commit completes`, () => {
      writeProject(root, text);
      expect(verdictOf(inboxOf(runDraft(root, TODAY).draft.report))).toBe(want);
      const r = runCommit(root, TODAY);
      expect(r.accepted_unreadable).toEqual([]);
      expect(existsSync(join(root, STATE_REL))).toBe(true);
    });
  }
});

describe("R4-5 (D12): a not-judged DECISIONS.md with NUL bytes does not block, but it is NAMED", () => {
  /** QA 122's probes-r4 shape: ADR-1 in UTF-8, then ADR-2 appended by PS 5.1's `>>` (UTF-16LE, no BOM). */
  const head = "# Decisions\r\n\r\n### ADR-1: Use the first thing\r\n\r\n- **Date:** 2026-09-01\r\n\r\nBecause.\r\n";
  const tail = "\r\n### ADR-2: Appended by hand — the second\r\n\r\n- **Date:** 2026-09-20\r\n\r\nBecause, again.\r\n";
  const bytes = Buffer.concat([Buffer.from(head, "utf8"), utf16le(tail)]);
  let nuls = 0;
  for (const b of bytes) if (b === 0) nuls++;
  const named = `${DECISIONS.replace(/\./g, "\\.")}[^\\n]*contains ${nuls} NUL byte\\(s\\), the first at byte ${bytes.indexOf(0)}`;

  it("the report names its NUL bytes, the ADRs imported, and the ADRs not imported", () => {
    writeProject(root, inboxText(7), bytes);
    runDraft(root, TODAY);
    const report = readFileSync(join(root, REPORT_REL), "utf8");
    expect(report).toMatch(new RegExp(named));
    expect(report).toMatch(/ADRs imported: ADR-1\b/);
    expect(report).toMatch(/ADRs NOT imported[^\n]*: ADR-2\b/);
  });

  it("a bare --commit completes, and its output names the NUL bytes, the ADRs imported and the ADRs not imported", () => {
    writeProject(root, inboxText(7), bytes);
    expect(cli(["state", "import", "--draft", root], root).status).toBe(0);
    const c = cli(["state", "import", "--commit", root], root);
    expect(c.status).toBe(0);
    expect(c.stdout).toMatch(new RegExp(named));
    expect(c.stdout).toMatch(/ADRs imported: ADR-1\b/);
    expect(c.stdout).toMatch(/ADRs NOT imported[^\n]*: ADR-2\b/);
    const state = JSON.parse(readFileSync(join(root, STATE_REL), "utf8")) as { decisions: Array<{ id: string }> };
    expect(state.decisions.map((d) => d.id)).toEqual(["ADR-1"]);
  });

  it("guard: a readable DECISIONS.md says nothing about NUL bytes", () => {
    writeProject(root, inboxText(7), Buffer.from(head + tail.replace(/—/g, "-"), "utf8"));
    runDraft(root, TODAY);
    const c = cli(["state", "import", "--commit", root], root);
    expect(c.status).toBe(0);
    expect(c.stdout).not.toMatch(/NUL byte/);
    expect(c.stdout).not.toMatch(/ADRs NOT imported/);
  });
});

describe("O7: two markers name the OLDEST snapshot, and say what the newer one holds", () => {
  it("the refusal restores from the oldest snapshot and names the newer as a later run's", () => {
    writeProject(root, inboxText(7));
    runDraft(root, TODAY);
    for (const day of ["2026-09-24", "2026-09-23"]) {
      const snap = `.agents/archive/pre-state-migration-${day}`;
      mkdirSync(join(root, snap), { recursive: true });
      writeFileSync(join(root, `${snap}.import-incomplete`), "died\n");
    }
    const before = tree(root);
    for (const run of [() => runDraft(root, TODAY), () => runCommit(root, TODAY)]) {
      expect(run).toThrow(/Restore \.agents\/ by hand from \.agents\/archive\/pre-state-migration-2026-09-23\/ \(the oldest; it holds the originals from before the first failed --commit\)/);
      expect(run).toThrow(/\.agents\/archive\/pre-state-migration-2026-09-24\/ holds the tree as a later run found it/);
      expect(run).toThrow(/then delete \.agents\/archive\/pre-state-migration-2026-09-23\.import-incomplete and \.agents\/archive\/pre-state-migration-2026-09-24\.import-incomplete\. Nothing written/);
      expect(tree(root)).toEqual(before);
    }
  });
});
