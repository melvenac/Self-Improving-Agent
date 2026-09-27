/**
 * R5-3 (docs/loops/importer-leftovers-rulings-qa138.md, O-b): the importer's
 * own read refused with EBUSY names the cause and the remedy after Node's
 * message. A real hold cannot be made on tcm (Linux), and on Windows it
 * depends on the reader's SeBackupPrivilege (QA 138, O-a), so readFileSync is
 * made to refuse for one path, as Windows does for a FileShare.None hold.
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

const { runDraft } = await import("../../src/pipelines/state-import/index.js");

const TODAY = "2026-09-26";
let root: string;
beforeEach(() => {
  root = realFs.mkdtempSync(join(tmpdir(), "ob-import-ebusy-"));
  for (const d of ["SESSIONS", "TASKS", "SYSTEM"]) realFs.mkdirSync(join(root, ".agents", d), { recursive: true });
  realFs.writeFileSync(join(root, "package.json"), JSON.stringify({ name: "ebusy-fixture", version: "1.0.0" }));
  realFs.writeFileSync(join(root, ".agents/SESSIONS/Session_7.md"), "# Session 7 — 2026-09-20\n");
  realFs.writeFileSync(join(root, ".agents/TASKS/INBOX.md"), "# Inbox\n\n> **Last Updated:** Session 7\n");
  realFs.writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "# Summary\n\n> status\n");
});
afterEach(() => { held.clear(); realFs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });

describe("R5-3: an EBUSY read names the cause and the remedy", () => {
  for (const rel of [".agents/TASKS/INBOX.md", ".agents/SESSIONS/Session_7.md"]) {
    it(`${rel} held open: Node's message, then who holds it and what to do`, () => {
      const p = join(root, rel);
      held.add(p);
      let msg = "";
      try { runDraft(root, TODAY); } catch (e) { msg = (e as Error).message; }
      expect(msg).toContain(`EBUSY: resource busy or locked, open '${p}'`);
      expect(msg).toMatch(/another program holds this file open; close it and re-run/);
    });
  }

  it("guard: with nothing held, the mocked read is the real one and the draft completes", () => {
    realFs.writeFileSync(join(root, ".agents/TASKS/task.md"), "# Focus\n");
    expect(() => runDraft(root, TODAY)).not.toThrow();
  });
});
