/**
 * R2-3 (row IF-11 of docs/loops/importer-fixes-round-2-brief.md): an import
 * never leaves a project half-migrated. It completes, or it changes nothing.
 *
 * QA 102's PROBE-2 found one instance, a missing SESSIONS/ directory. The
 * protection is the invariant, so this file induces a failure at EACH write
 * `--commit` makes after the snapshot, and asserts the tree afterwards is
 * byte-identical to the tree before and that a second run behaves as for a
 * fresh project. The failure is injected through `node:fs`, so nothing in the
 * importer carries a test seam.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as realFs from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";

/** A path fragment: the next write or rename whose path contains it throws. */
const inject = { writeOn: null as string | null, renameOn: null as string | null };
vi.mock("node:fs", async (importOriginal) => {
  const a = await importOriginal<typeof import("node:fs")>();
  const norm = (p: unknown) => String(p).replace(/\\/g, "/");
  const writeFileSync = ((p: realFs.PathOrFileDescriptor, ...rest: unknown[]) => {
    if (inject.writeOn && norm(p).includes(inject.writeOn)) throw new Error(`induced failure writing ${norm(p)}`);
    return (a.writeFileSync as (...x: unknown[]) => void)(p, ...rest);
  }) as typeof a.writeFileSync;
  const renameSync = ((from: realFs.PathLike, to: realFs.PathLike) => {
    if (inject.renameOn && norm(from).includes(inject.renameOn)) throw new Error(`induced failure renaming ${norm(from)}`);
    return a.renameSync(from, to);
  }) as typeof a.renameSync;
  return { ...a, default: { ...a, writeFileSync, renameSync }, writeFileSync, renameSync };
});

const { runDraft, runCommit, STATE_REL, DRAFT_REL } = await import("../../src/pipelines/state-import/index.js");
const TODAY = "2026-09-25";

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

function writeProject(root: string): void {
  for (const d of ["SESSIONS", "TASKS", "SYSTEM"]) realFs.mkdirSync(join(root, ".agents", d), { recursive: true });
  realFs.writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture-project", version: "1.0.0" }));
  realFs.writeFileSync(join(root, ".agents/SESSIONS/Session_7.md"), "# Session 7 — 2026-09-20\n");
  realFs.writeFileSync(join(root, ".agents/SESSIONS/next-session.md"), "# Next\n\n> Session 7\n\n## Pick up here\n\nCarry on.\n");
  realFs.writeFileSync(join(root, ".agents/TASKS/INBOX.md"), "# Inbox\n\n> Session 7\n\n## P0 — Critical\n\n- [ ] **A task** — do it\n");
  realFs.writeFileSync(join(root, ".agents/TASKS/task.md"), "# Focus\n\n> Session 7\n\n## Current Objective\n\nShip it.\n");
  realFs.writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "# Summary\n\n> status\n\n## About\n\nKept.\n");
}

describe("R2-3 (IF-11): a failure at any write after the snapshot leaves the project byte-identical to before", () => {
  let root: string;
  beforeEach(() => {
    inject.writeOn = null;
    inject.renameOn = null;
    root = realFs.mkdtempSync(join(tmpdir(), "ob-import-atomic-"));
    writeProject(root);
    runDraft(root, TODAY);
  });
  afterEach(() => { inject.writeOn = null; inject.renameOn = null; realFs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });

  const points: Array<[string, () => void]> = [
    ["writing state.json", () => { inject.writeOn = STATE_REL; }],
    ["writing SUMMARY.md", () => { inject.writeOn = ".agents/SYSTEM/SUMMARY.md"; }],
    ["rendering task.md", () => { inject.writeOn = ".agents/TASKS/task.md"; }],
    ["rendering next-session.md", () => { inject.writeOn = ".agents/SESSIONS/next-session.md"; }],
    ["moving the draft into the snapshot", () => { inject.renameOn = DRAFT_REL; }],
  ];

  for (const [where, arm] of points) {
    it(`failing while ${where}: the error names the failure, the tree is unchanged, and a second run completes`, () => {
      const before = tree(root);
      arm();
      expect(() => runCommit(root, TODAY)).toThrow(/induced failure/);
      inject.writeOn = null;
      inject.renameOn = null;
      expect(tree(root)).toEqual(before);
      const ok = runCommit(root, TODAY);
      expect(realFs.existsSync(ok.statePath)).toBe(true);
    });
  }

  it("with --force-snapshot, a failure puts back the earlier snapshot it was replacing, byte for byte", () => {
    const earlier = join(root, `.agents/archive/pre-state-migration-${TODAY}`);
    realFs.mkdirSync(earlier, { recursive: true });
    realFs.writeFileSync(join(earlier, "from-an-earlier-run.md"), "keep me\n");
    const before = tree(root);
    inject.writeOn = ".agents/TASKS/task.md";
    expect(() => runCommit(root, TODAY, { forceSnapshot: true })).toThrow(/induced failure/);
    inject.writeOn = null;
    expect(tree(root)).toEqual(before);
    // And on success the replaced snapshot is gone, not merged into the new one.
    runCommit(root, TODAY, { forceSnapshot: true });
    expect(realFs.existsSync(join(earlier, "from-an-earlier-run.md"))).toBe(false);
    expect(realFs.readdirSync(join(root, ".agents/archive"))).toEqual([`pre-state-migration-${TODAY}`]);
  });

  it("the rollback says what it did in the error", () => {
    inject.writeOn = ".agents/TASKS/task.md";
    expect(() => runCommit(root, TODAY)).toThrow(/rolled back|restored|nothing (was )?changed/i);
  });
});
