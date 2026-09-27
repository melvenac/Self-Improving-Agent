/**
 * QA 153 on R5-3 (importer leftovers round 5, e2f202b). QA evidence, not for merge.
 * The same mock as the candidate's state-import-ebusy.test.ts: readFileSync refuses one path with EBUSY, as Windows
 * does for a FileShare.None hold read by a process without SeBackupPrivilege.
 *
 * RED on e2f202b by design (D3 in docs/loops/importer-leftovers-r5-qa-report.md): --commit reads the draft with a bare
 * readFileSync (index.ts:977), so a held state.draft.json refuses with Node's message alone.
 * GREEN on e2f202b: the three inputs the candidate's rows do not hold (task.md, next-session.md, DECISIONS.md) and
 * SUMMARY.md, read by --draft and again by --commit.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as realFs from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const held = new Set<string>();
vi.mock("node:fs", async (orig) => {
  const fs = await orig<typeof import("node:fs")>();
  return {
    ...fs,
    readFileSync: ((p: realFs.PathOrFileDescriptor, ...rest: unknown[]) => {
      if (typeof p === "string" && held.has(p)) {
        const e = new Error(`EBUSY: resource busy or locked, open '${p}'`) as NodeJS.ErrnoException;
        e.code = "EBUSY"; e.errno = -4082; e.syscall = "open"; e.path = p;
        throw e;
      }
      return (fs.readFileSync as (...a: unknown[]) => unknown)(p, ...rest);
    }) as typeof fs.readFileSync,
  };
});

const { runDraft, runCommit } = await import("../../src/pipelines/state-import/index.js");

const TODAY = "2026-09-26";
const REMEDY = /another program holds this file open; close it and re-run/;
let root: string;
beforeEach(() => {
  root = realFs.mkdtempSync(join(tmpdir(), "ob-import-qa153-ebusy-"));
  for (const d of ["SESSIONS", "TASKS", "SYSTEM"]) realFs.mkdirSync(join(root, ".agents", d), { recursive: true });
  realFs.writeFileSync(join(root, "package.json"), JSON.stringify({ name: "qa153-ebusy", version: "1.0.0" }));
  realFs.writeFileSync(join(root, ".agents/SESSIONS/Session_7.md"), "# Session 7 — 2026-09-20\n");
  realFs.writeFileSync(join(root, ".agents/TASKS/INBOX.md"), "# Inbox\n\n> **Last Updated:** Session 7\n");
  realFs.writeFileSync(join(root, ".agents/TASKS/task.md"), "# Focus\n\n> **Focus:** Session 7\n");
  realFs.writeFileSync(join(root, ".agents/SESSIONS/next-session.md"), "# Next\n\n> Updated at end of Session 7.\n");
  realFs.writeFileSync(join(root, ".agents/SYSTEM/DECISIONS.md"), "# Decisions\n\n### ADR-1: one\n\n- **Date:** 2026-01-01\n");
  realFs.writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "# Summary\n\n> status\n");
});
afterEach(() => { held.clear(); realFs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });

const message = (f: () => unknown) => { try { f(); return ""; } catch (e) { return (e as Error).message; } };

describe("QA 153 R5-3 coverage (GREEN): every input the importer reads names the cause and the remedy", () => {
  for (const rel of [".agents/TASKS/task.md", ".agents/SESSIONS/next-session.md", ".agents/SYSTEM/DECISIONS.md", ".agents/SYSTEM/SUMMARY.md"]) {
    it(`${rel} held: --draft and --commit both say who holds it and what to do`, () => {
      runDraft(root, TODAY);
      const p = join(root, rel);
      held.add(p);
      const d = message(() => runDraft(root, TODAY));
      const c = message(() => runCommit(root, TODAY));
      expect(d).toContain(`EBUSY: resource busy or locked, open '${p}'`);
      expect(d).toMatch(REMEDY);
      expect(c).toContain(`EBUSY: resource busy or locked, open '${p}'`);
      expect(c).toMatch(REMEDY);
    });
  }
});

describe("QA 153 D3 (RED): --commit's own read of the draft", () => {
  it("state.draft.json held at --commit: Node's message, then the cause and the remedy", () => {
    runDraft(root, TODAY);
    const p = join(root, ".agents/state.draft.json");
    held.add(p);
    const c = message(() => runCommit(root, TODAY));
    expect(c).toContain(`EBUSY: resource busy or locked, open '${p}'`);
    expect(c).toMatch(REMEDY);
  });
});
