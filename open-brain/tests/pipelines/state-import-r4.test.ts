/**
 * Importer fixes, round 4 (docs/loops/importer-fixes-round-4-brief.md, rows
 * IF-21 to IF-24). QA 111 found each of these against 063662b.
 *
 * Written before the fixes and run red against 063662b (on
 * loop/importer-fixes-r4-redcheck), so it uses only what that build exports
 * and fails on an assertion, not a type error. Every fixture is bytes, so the
 * file runs the same on Linux (tcm) as on Windows.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnAsync } from "../spawn-async.js";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, lstatSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { runDraft, runCommit, STATE_REL } from "../../src/pipelines/state-import/index.js";

const cliEntry = join(import.meta.dirname, "../../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const TODAY = "2026-09-25";
const NEXT = ".agents/SESSIONS/next-session.md";
const INBOX = ".agents/TASKS/INBOX.md";
const TASK = ".agents/TASKS/task.md";
const SUMMARY = ".agents/SYSTEM/SUMMARY.md";

/** Both channels, and the real exit status: a helper that hardcodes stderr on success asserts nothing about it. */
// Awaited, not spawnSync (G-042): this file's CLI spawns were one stretch of 30-31 s with no macrotask under load.
async function cli(args: string[], cwd: string): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const r = await spawnAsync(process.execPath, [tsxCli, cliEntry, ...args], { cwd, env: process.env });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** Every entry under `dir`: a file is sha256, size, mtime and the read-only bit; a directory is listed; a link is a link. */
function tree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      const rel = relative(dir, p).replace(/\\/g, "/");
      const l = lstatSync(p);
      if (l.isSymbolicLink()) { out[rel] = "link"; continue; }
      if (l.isDirectory()) { out[rel + "/"] = "dir"; walk(p); continue; }
      out[rel] = `${createHash("sha256").update(readFileSync(p)).digest("hex")} ${l.size} m${l.mtimeMs}${l.mode & 0o200 ? "" : " RO"}`;
    }
  };
  walk(dir);
  return out;
}

const hex = (s: string) => Buffer.from(s.replace(/\s+/g, ""), "hex");

/**
 * QA 111's known positive, byte for byte: evidence/ps51-append-bytes.out on
 * origin/qa/importer-fixes-r3-report, written on the QA PC by Windows
 * PowerShell 5.1.19041.6456's `>>` onto an INBOX.md that declares Session 6.
 * `>>` appends UTF-16LE with no BOM, so a readable head gets a NUL-laden tail.
 */
const PS51_APPEND: Array<[string, Buffer, { size: number; firstNul: number }]> = [
  ["Windows-1252 then PS 5.1 >> (cp-redirappend.md)", hex(`
    23 20 49 6e 62 6f 78 20 97 20 70 72 69 6f 72 69 74 69 65 73 0d 0a 0d 0a 3e 20 2a 2a 4c 61 73 74
    20 55 70 64 61 74 65 64 3a 2a 2a 20 53 65 73 73 69 6f 6e 20 36 0d 0a 2d 00 20 00 5b 00 20 00 5d
    00 20 00 61 00 70 00 70 00 65 00 6e 00 64 00 65 00 64 00 20 00 14 20 20 00 62 00 79 00 20 00 3e
    00 3e 00 0d 00 0a 00`), { size: 103, firstNul: 56 }],
  ["UTF-8 then PS 5.1 >> (u8-redirappend.md)", hex(`
    23 20 49 6e 62 6f 78 20 e2 80 94 20 70 72 69 6f 72 69 74 69 65 73 0d 0a 0d 0a 3e 20 2a 2a 4c 61
    73 74 20 55 70 64 61 74 65 64 3a 2a 2a 20 53 65 73 73 69 6f 6e 20 36 0d 0a 2d 00 20 00 5b 00 20
    00 5d 00 20 00 61 00 70 00 70 00 65 00 6e 00 64 00 65 00 64 00 20 00 14 20 20 00 62 00 79 00 20
    00 3e 00 3e 00 0d 00 0a 00`), { size: 105, firstNul: 58 }],
  ["UTF-8 with a BOM then PS 5.1 >> (u8bom-redirappend.md)", hex(`
    ef bb bf 23 20 49 6e 62 6f 78 20 e2 80 94 20 70 72 69 6f 72 69 74 69 65 73 0d 0a 0d 0a 3e 20 2a
    2a 4c 61 73 74 20 55 70 64 61 74 65 64 3a 2a 2a 20 53 65 73 73 69 6f 6e 20 36 0d 0a 2d 00 20 00
    5b 00 20 00 5d 00 20 00 61 00 70 00 70 00 65 00 6e 00 64 00 65 00 64 00 20 00 14 20 20 00 62 00
    79 00 20 00 3e 00 3e 00 0d 00 0a 00`), { size: 108, firstNul: 61 }],
];

/** INBOX.md as the three evidence files begin, as text: it declares Session 6, one behind the latest log. */
const INBOX6 = "# Inbox — priorities\r\n\r\n> **Last Updated:** Session 6\r\n";
const utf16be = (s: string) => Buffer.from(s, "utf16le").swap16();

const SHAPES: Array<[string, Buffer]> = [
  ...PS51_APPEND.map(([name, bytes]) => [name, bytes] as [string, Buffer]),
  ["UTF-8 with one stray NUL at the end", Buffer.concat([Buffer.from(INBOX6), Buffer.from([0])])],
  ["UTF-16LE with no BOM", Buffer.from(INBOX6, "utf16le")],
  ["UTF-16BE with no BOM", utf16be(INBOX6)],
];

/** next-session.md and task.md declare Session 7 (current), so only `inbox` can block. */
function writeProject(root: string, inbox: string | Buffer, opts: { log?: boolean } = {}): void {
  for (const d of ["SESSIONS", "TASKS", "SYSTEM"]) mkdirSync(join(root, ".agents", d), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture-project", version: "1.0.0" }));
  if (opts.log !== false) writeFileSync(join(root, ".agents/SESSIONS/Session_7.md"), "# Session 7 — 2026-09-20\n");
  writeFileSync(join(root, NEXT), "# Next Session Handoff — for the next seat\n\n> Updated at end of Session 7.\n\n## Pick up here\n\nCarry on.\n");
  writeFileSync(join(root, TASK), "# Current Focus — this week\n\n> **Focus:** Session 7\n\n## Current Objective\n\nShip the thing.\n");
  writeFileSync(join(root, INBOX), inbox);
  writeFileSync(join(root, SUMMARY), "# Summary\n\n> status\n\n## About\n\nKept.\n");
}

interface Judged { input: string; verdict: string; declared_session: number | null; evidence: string; could_not_tell?: string }
const judged = (report: unknown): Judged[] => (report as { staleness: { inputs: Judged[] } }).staleness.inputs;
const inboxOf = (report: unknown): Judged => judged(report).find((i) => i.input === INBOX)!;

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "ob-import-r4-")); });
afterEach(() => { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });

describe("R4-1 (IF-21): an input the importer cannot read blocks a bare --commit like STALE, unless --accept-stale", () => {
  it("the known positive is the evidence file, byte for byte: its size and its first NUL are QA 111's", () => {
    for (const [, bytes, want] of PS51_APPEND) expect({ size: bytes.length, firstNul: bytes.indexOf(0) }).toEqual(want);
    // The bytes before the first NUL are the readable head: INBOX6, in the base's own encoding.
    expect(PS51_APPEND[1][1].subarray(0, 58).toString("utf8")).toBe(INBOX6 + "-");
  });

  for (const [shape, bytes] of SHAPES) {
    it(`${shape}: could not tell; bare --commit exits 1 with the tree identical, and names the NUL bytes; --accept-stale completes`, async () => {
      writeProject(root, bytes);
      // R3-2's verdict stands: the words cannot be read. What changes is its consequence.
      expect(inboxOf(runDraft(root, TODAY).draft.report).verdict).toBe("could_not_tell");

      // D8 first, so that at 063662b this row is red on D8 itself (the bare --commit goes through).
      const before = tree(root);
      const bare = await cli(["state", "import", "--commit", root], root);
      expect(bare.status).toBe(1);
      expect(tree(root)).toEqual(before);
      let nuls = 0;
      for (const b of bytes) if (b === 0) nuls++;
      expect(bare.stderr).toContain(`${INBOX} contains ${nuls} NUL byte(s), the first at byte ${bytes.indexOf(0)}`);
      expect(bare.stderr).toContain("--accept-stale");
      expect(bare.stderr).toContain("Nothing written");

      const accepted = await cli(["state", "import", "--commit", "--accept-stale", root], root);
      expect(accepted.stderr).toBe("");
      expect(accepted.status).toBe(0);
      expect(accepted.stdout).toContain(`Imported UNREADABLE under --accept-stale: ${INBOX}`);
      expect(existsSync(join(root, STATE_REL))).toBe(true);
    }, 60_000);
  }

  it("in process: runCommit refuses the unreadable input and names it, and --accept-stale reports it as accepted", () => {
    writeProject(root, SHAPES[3][1]); // the stray NUL: one NUL byte
    runDraft(root, TODAY);
    const before = tree(root);
    expect(() => runCommit(root, TODAY)).toThrow(new RegExp(`cannot be read.*${INBOX.replace(/\./g, "\\.")} contains 1 NUL byte`));
    expect(tree(root)).toEqual(before);
    const r = runCommit(root, TODAY, { acceptStale: true }) as { accepted_stale: string[]; accepted_unreadable?: string[] };
    expect(r.accepted_stale).toEqual([]);
    expect(r.accepted_unreadable).toEqual([INBOX]);
  });

  it("the draft's report says --commit refuses while an input cannot be read, and the CLI's draft summary says so too", async () => {
    writeProject(root, SHAPES[5][1]);
    const d = await cli(["state", "import", "--draft", root], root);
    expect(d.status).toBe(0);
    expect(d.stdout).toContain(`--commit will REFUSE while ${INBOX} cannot be read`);
    const report = readFileSync(join(root, ".agents/state.import-report.md"), "utf8");
    expect(report).toContain("**`--commit` refuses while an input above cannot be read**");
    expect(report).not.toContain("1 input(s) could not be judged. That does not block");
  }, 60_000);
});

describe("R4-1's list (IF-22): every could-not-tell reason, and which of them block", () => {
  // The four places detectStaleness files "could not tell". Only the first blocks. The three that
  // do not are green at 063662b by design: regression guards, each reddened by R41-scope.
  const REASONS: Array<[string, (r: string) => void, string, boolean]> = [
    ["unreadable (NUL bytes)", (r) => writeProject(r, SHAPES[3][1]), "unreadable", true],
    ["no SESSIONS/Session_N.md to compare against", (r) => writeProject(r, INBOX6, { log: false }), "no_session_log", false],
    ["names no Session N", (r) => writeProject(r, "# Inbox — priorities\n\n## P0 — Critical\n\n- [ ] **A task** — do it\n"), "no_declared_session", false],
    ["declares Session 20, ahead of the latest log (Session 7)", (r) => writeProject(r, "# Inbox — priorities\n\n> **Last Updated:** Session 20\n"), "ahead_of_latest", false],
  ];

  for (const [what, make, , blocks] of REASONS) {
    it(`${what}: ${blocks ? "blocks" : "does not block"}`, () => {
      make(root);
      expect(inboxOf(runDraft(root, TODAY).draft.report).verdict).toBe("could_not_tell");
      if (blocks) expect(() => runCommit(root, TODAY)).toThrow(/cannot be read/);
      else expect(existsSync(runCommit(root, TODAY).statePath)).toBe(true);
    });
  }

  it("each could-not-tell input carries its reason, so the report and the refusal read the same list", () => {
    for (const [, make, reason] of REASONS) {
      const r = mkdtempSync(join(tmpdir(), "ob-import-r4-reason-"));
      try {
        make(r);
        expect(inboxOf(runDraft(r, TODAY).draft.report).could_not_tell).toBe(reason);
      } finally {
        rmSync(r, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
      }
    }
  });

  // IF-10's rows, re-checked rather than re-ruled: +13 and +1 still commit, both numbers named.
  for (const ahead of [20, 8]) {
    it(`IF-10: declares Session ${ahead} against a latest of 7: could not tell, both numbers named, and --commit completes`, () => {
      writeProject(root, `# Inbox — priorities\n\n> **Last Updated:** Session ${ahead}\n`);
      const inbox = inboxOf(runDraft(root, TODAY).draft.report);
      expect(inbox).toMatchObject({ verdict: "could_not_tell", declared_session: ahead });
      expect(inbox.evidence).toContain(`declares Session ${ahead}`);
      expect(inbox.evidence).toContain("the latest session log is Session 7");
      expect(existsSync(runCommit(root, TODAY).statePath)).toBe(true);
    });
  }
});

describe("R4-2 (IF-23): a SUMMARY.md with NUL bytes refuses --commit (index.ts:833)", () => {
  it("UTF-16LE with no BOM: --commit refuses, names the NUL bytes, and the tree is identical afterwards", () => {
    writeProject(root, "# Inbox — priorities\n\n> **Last Updated:** Session 7\n");
    writeFileSync(join(root, SUMMARY), Buffer.from("# Summary\r\n\r\n> **Status:** Session 7\r\n\r\n## Architecture\r\n\r\nWords.\r\n", "utf16le"));
    runDraft(root, TODAY);
    const before = tree(root);
    expect(() => runCommit(root, TODAY)).toThrow(/SUMMARY\.md .*NUL byte.*rewrites it in place/);
    expect(tree(root)).toEqual(before);
  });

  it("O8: the refusal reads 'SUMMARY.md contains', not 'SUMMARY.md is contains'", () => {
    writeProject(root, "# Inbox — priorities\n\n> **Last Updated:** Session 7\n");
    writeFileSync(join(root, SUMMARY), Buffer.from("# Summary\r\n", "utf16le"));
    runDraft(root, TODAY);
    expect(() => runCommit(root, TODAY)).toThrow(/SUMMARY\.md contains \d+ NUL byte/);
  });
});

describe("R4-3 (IF-24): the half-restored refusal", () => {
  const current = "# Inbox — priorities\n\n> **Last Updated:** Session 7\n";

  it("Q1: a marker with another day's date refuses both doors, and the tree is identical", () => {
    writeProject(root, current);
    runDraft(root, TODAY);
    const earlier = ".agents/archive/pre-state-migration-2026-09-24";
    mkdirSync(join(root, earlier), { recursive: true });
    writeFileSync(join(root, earlier, "note.md"), "yesterday's originals\n");
    writeFileSync(join(root, `${earlier}.import-incomplete`), "the rollback failed yesterday evening\n");
    const before = tree(root);
    for (const run of [() => runDraft(root, TODAY), () => runCommit(root, TODAY), () => runCommit(root, TODAY, { forceSnapshot: true })]) {
      expect(run).toThrow(/half-restored/);
      expect(run).toThrow(/pre-state-migration-2026-09-24\//);
      expect(tree(root)).toEqual(before);
    }
  });

  it("Q17: a marker plus a state.json: --draft gives the half-restored refusal, not 'already exists'", () => {
    writeProject(root, current);
    const snap = `.agents/archive/pre-state-migration-${TODAY}`;
    mkdirSync(join(root, snap), { recursive: true });
    writeFileSync(join(root, `${snap}.import-incomplete`), "died\n");
    writeFileSync(join(root, STATE_REL), "{}\n");
    const before = tree(root);
    expect(() => runDraft(root, TODAY)).toThrow(/half-restored/);
    expect(tree(root)).toEqual(before);
  });

  it("O10: the refusal says to keep a copy of the snapshot until the re-run completes", () => {
    writeProject(root, current);
    const snap = `.agents/archive/pre-state-migration-${TODAY}`;
    mkdirSync(join(root, snap), { recursive: true });
    writeFileSync(join(root, `${snap}.import-incomplete`), "died\n");
    expect(() => runDraft(root, TODAY)).toThrow(/Keep a copy of the snapshot until the re-run completes/);
  });

  it("the way out stays machine-readable: 'then delete <marker>. Nothing written', the shape QA 111's probes-r3.mjs parses to follow it", () => {
    writeProject(root, current);
    const snap = `.agents/archive/pre-state-migration-${TODAY}`;
    mkdirSync(join(root, snap), { recursive: true });
    writeFileSync(join(root, `${snap}.import-incomplete`), "died\n");
    expect(() => runDraft(root, TODAY)).toThrow(/Restore \.agents\/ by hand from (\S+?)\/?, which holds every original, then delete (\S+?)\. Nothing written/);
  });
});
