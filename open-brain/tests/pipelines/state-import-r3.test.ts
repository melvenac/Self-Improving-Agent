/**
 * Importer fixes, round 3 (docs/loops/importer-fixes-round-3-brief.md, rows
 * IF-16 to IF-19). QA 106 found each of these against aba35de.
 *
 * Written before the fixes and run red against aba35de (on
 * loop/importer-fixes-r3-redcheck), so it uses only what that build exports
 * and fails on an assertion, not a type error. Failures are injected through
 * `node:fs`, as in state-import-atomic.test.ts, so the importer carries no seam.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as realFs from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";

/** A path fragment: the next write, rename, copy or remove whose path contains it throws. */
const inject = {
  writeOn: null as string | null,
  copyTo: null as string | null,
  rmOn: null as string | null,
  /** Called before every write, with its path: lets a test look at the tree mid-commit. */
  onWrite: null as ((p: string) => void) | null,
};
vi.mock("node:fs", async (importOriginal) => {
  const a = await importOriginal<typeof import("node:fs")>();
  const norm = (p: unknown) => String(p).replace(/\\/g, "/");
  const writeFileSync = ((p: realFs.PathOrFileDescriptor, ...rest: unknown[]) => {
    inject.onWrite?.(norm(p));
    if (inject.writeOn && norm(p).includes(inject.writeOn)) throw new Error(`induced failure writing ${norm(p)}`);
    return (a.writeFileSync as (...x: unknown[]) => void)(p, ...rest);
  }) as typeof a.writeFileSync;
  const cpSync = ((from: string, to: string, opts?: realFs.CopySyncOptions) => {
    if (inject.copyTo && norm(to).includes(inject.copyTo)) throw new Error(`induced failure copying to ${norm(to)}`);
    return a.cpSync(from, to, opts);
  }) as typeof a.cpSync;
  const rmSync = ((p: realFs.PathLike, opts?: realFs.RmOptions) => {
    if (inject.rmOn && norm(p).endsWith(inject.rmOn)) throw new Error(`induced EBUSY removing ${norm(p)}`);
    return a.rmSync(p, opts);
  }) as typeof a.rmSync;
  return { ...a, default: { ...a, writeFileSync, cpSync, rmSync }, writeFileSync, cpSync, rmSync };
});

const { runDraft, runCommit, STATE_REL } = await import("../../src/pipelines/state-import/index.js");
const TODAY = "2026-09-25";
const SNAP = `.agents/archive/pre-state-migration-${TODAY}`;
const NEXT = ".agents/SESSIONS/next-session.md";
const INBOX = ".agents/TASKS/INBOX.md";
const TASK = ".agents/TASKS/task.md";
const LOG7 = "# Session 7 — 2026-09-20\n";

/** Every file under `dir`, relative path → bytes (hex). Empty directories are listed as `<dir>/`. */
function tree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    const names = realFs.readdirSync(d);
    if (names.length === 0 && d !== dir) out[relative(dir, d).replace(/\\/g, "/") + "/"] = "";
    for (const n of names) {
      const p = join(d, n);
      if (realFs.statSync(p).isDirectory()) walk(p);
      else out[relative(dir, p).replace(/\\/g, "/")] = realFs.readFileSync(p).toString("hex");
    }
  };
  walk(dir);
  return out;
}

/** Where under `root` a file with exactly these bytes exists. */
function copiesOf(root: string, bytes: string): string[] {
  const hex = Buffer.from(bytes).toString("hex");
  return Object.entries(tree(root)).filter(([, h]) => h === hex).map(([p]) => p);
}

/** The inputs declare `declared`; the latest log is Session_7.md. `encode` shapes each input's bytes; each carries an em dash, so a non-UTF-8 shape reaches every one. */
function writeProject(root: string, declared: number, encode: (s: string) => string | Buffer = (s) => s): void {
  for (const d of ["SESSIONS", "TASKS", "SYSTEM"]) realFs.mkdirSync(join(root, ".agents", d), { recursive: true });
  realFs.writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture-project", version: "1.0.0" }));
  realFs.writeFileSync(join(root, ".agents/SESSIONS/Session_7.md"), LOG7);
  realFs.writeFileSync(join(root, NEXT), encode(`# Next Session Handoff — for the next seat\n\n> Updated at end of Session ${declared}.\n\n## Pick up here\n\nCarry on.\n`));
  realFs.writeFileSync(join(root, INBOX), encode(`# Inbox — priorities\n\n> **Last Updated:** Session ${declared}\n\n## P0 — Critical\n\n- [ ] **A task** — do it\n`));
  realFs.writeFileSync(join(root, TASK), encode(`# Current Focus — this week\n\n> **Focus:** Session ${declared}\n\n## Current Objective\n\nShip the thing.\n`));
  realFs.writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "# Summary\n\n> status\n\n## About\n\nKept.\n");
}

let root: string;
beforeEach(() => { root = realFs.mkdtempSync(join(tmpdir(), "ob-import-r3-")); });
afterEach(() => {
  inject.writeOn = null; inject.copyTo = null; inject.rmOn = null; inject.onWrite = null;
  realFs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

describe("R3-2 (IF-18): Windows-1252 input is read and judged, and the evidence names the encoding", () => {
  // QA 106's three shapes (evidence/ps51-bytes.out): an em dash is byte 0x97.
  // Set-Content writes CRLF line ends; Add-Content appends them line by line.
  const cp1252 = (s: string) => Buffer.from(s.replace(/—/g, "\x97"), "latin1");
  const shapes: Array<[string, (s: string) => Buffer]> = [
    ["Windows-1252 with em dashes", cp1252],
    ["PS 5.1 Set-Content (Windows-1252, CRLF)", (s) => cp1252(s.replace(/\n/g, "\r\n"))],
    ["PS 5.1 Add-Content (Windows-1252, CRLF, appended line by line)", (s) => Buffer.concat(s.split("\n").slice(0, -1).map((l) => cp1252(l + "\r\n")))],
  ];
  for (const [shape, enc] of shapes) {
    it(`${shape}: STALE inputs are STALE, --commit refuses without --accept-stale and writes nothing, and --accept-stale commits`, () => {
      writeProject(root, 6, enc);
      const report = runDraft(root, TODAY).draft.report as { staleness: { inputs: Array<{ input: string; verdict: string; evidence: string }> } };
      expect(Object.fromEntries(report.staleness.inputs.map((i) => [i.input, i.verdict]))).toEqual({ [NEXT]: "stale", [INBOX]: "stale", [TASK]: "stale" });
      for (const i of report.staleness.inputs) expect(i.evidence).toMatch(/Windows-1252/);
      const before = tree(root);
      expect(() => runCommit(root, TODAY)).toThrow(/predate the latest session/);
      expect(tree(root)).toEqual(before);
      expect(realFs.existsSync(runCommit(root, TODAY, { acceptStale: true }).statePath)).toBe(true);
    });
  }

  it("the text is decoded as Windows-1252, not as UTF-8 with replacement characters", () => {
    writeProject(root, 7, cp1252);
    const r = runDraft(root, TODAY).draft;
    // "**A task** — do it": the title and note split only on a real em dash.
    expect(r.state.tasks.map((t) => [t.title, t.note])).toEqual([["A task", "do it"]]);
    expect(JSON.stringify(r.state)).not.toContain("�");
  });

  it("UTF-16 with no BOM is still 'could not tell' (NUL bytes), whether or not it is also invalid UTF-8", () => {
    writeProject(root, 6);
    realFs.writeFileSync(join(root, NEXT), Buffer.from("# Next\n\n> Session 6\n", "utf16le"));
    realFs.writeFileSync(join(root, INBOX), Buffer.from("# Inbox é\n\n> Session 6\n", "utf16le")); // é → e9 00: not UTF-8 either
    const report = runDraft(root, TODAY).draft.report as { staleness: { inputs: Array<{ input: string; verdict: string; evidence: string }> } };
    for (const k of [NEXT, INBOX]) {
      const i = report.staleness.inputs.find((x) => x.input === k)!;
      expect(i.verdict).toBe("could_not_tell");
      expect(i.evidence).toMatch(/NUL/);
    }
  });

  it("a Windows-1252 SUMMARY.md still refuses --commit: a guessed encoding is not written back", () => {
    writeProject(root, 7);
    realFs.writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), Buffer.from("# Summary\n\n> st\xe9tus\n", "latin1"));
    runDraft(root, TODAY);
    const before = tree(root);
    expect(() => runCommit(root, TODAY)).toThrow(/SUMMARY\.md is not valid UTF-8/);
    expect(tree(root)).toEqual(before);
  });
});
