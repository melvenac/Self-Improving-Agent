import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkModuleBoundary, MEMORY_SIDE } from "../../../src/pipelines/sync/checks.js";

/**
 * Loop 13 C3. These fixtures are written with `fs` and nothing else.
 *
 * G-029 is the reason: the regression test shipped with the `retirements` check
 * shelled out to `git` inside a try/catch with stdio ignored and a bare
 * `return` on failure, so on any machine where git misbehaved it reported green
 * without having tested anything — the "cannot distinguish nothing-there from
 * I-did-not-look" family, inside the test for a check about exactly that. There
 * is no subprocess here and no swallowed failure: every path ends in an assert.
 */
describe("checkModuleBoundary", () => {
  let dir: string;
  let src: string;

  const write = (rel: string, body: string): void => {
    const full = join(src, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body);
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "boundary-"));
    src = join(dir, "open-brain", "src");
    mkdirSync(src, { recursive: true });
    // A minimal but honest two-sided tree: one memory root, one core file.
    write("db-v2.ts", 'import Database from "better-sqlite3";\nexport const SCHEMA_VERSION = 1;\n');
    write("shared/paths.ts", 'export const p = 1;\n');
    write("cli.ts", 'import { p } from "./shared/paths.js";\nexport const x = p;\n');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("passes when core does not import memory, and states its limit in the message", () => {
    const r = checkModuleBoundary(dir);
    expect(r.severity).toBe("pass");
    expect(r.message).toContain("LIMIT:");
    // The limit is load-bearing: C4's acceptance test covers what this cannot.
    expect(r.message).toContain("load-time native resolution");
    expect(r.report).toBe(true);
  });

  it("fails when a core file imports a memory module", () => {
    write("cli.ts", 'import { SCHEMA_VERSION } from "./db-v2.js";\nexport const x = SCHEMA_VERSION;\n');
    const r = checkModuleBoundary(dir);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("cli.ts -> db-v2.ts");
    expect(r.message).toContain("module boundary has re-closed");
  });

  it("fails when a core file imports the native build directly", () => {
    write("shared/paths.ts", 'import Database from "better-sqlite3";\nexport const p = 1;\n');
    const r = checkModuleBoundary(dir);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("better-sqlite3 (native build, direct)");
  });

  it("follows the chain transitively, not just direct edges", () => {
    write("pipelines/sync/checks-memory.ts", 'import D from "better-sqlite3";\nexport const q = 1;\n');
    write("shared/paths.ts", 'import { q } from "../pipelines/sync/checks-memory.js";\nexport const p = q;\n');
    const r = checkModuleBoundary(dir);
    expect(r.severity).toBe("issue");
    // cli.ts -> shared/paths.ts -> checks-memory.ts -> better-sqlite3
    expect(r.message).toContain("cli.ts -> shared/paths.ts");
  });

  it("does NOT count an `import type` as a runtime edge", () => {
    write("cli.ts", 'import type Database from "better-sqlite3";\nexport const x = 1;\n');
    const r = checkModuleBoundary(dir);
    // Erased by tsc. Counting these overstated the boundary 2x in C1.
    expect(r.severity).toBe("pass");
  });

  it("allows memory importing core — the permitted direction", () => {
    write("db-v2.ts", 'import { p } from "./shared/paths.js";\nimport D from "better-sqlite3";\nexport const SCHEMA_VERSION = p;\n');
    const r = checkModuleBoundary(dir);
    expect(r.severity).toBe("pass");
  });

  it("refuses on an unresolved import rather than reporting a clean graph", () => {
    write("cli.ts", 'import { gone } from "./does-not-exist.js";\nexport const x = gone;\n');
    const r = checkModuleBoundary(dir);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("did not resolve");
    expect(r.message).toContain("incomplete");
  });

  it("skips with a reason when open-brain/src is absent, and never passes vacuously", () => {
    const empty = mkdtempSync(join(tmpdir(), "boundary-empty-"));
    try {
      const r = checkModuleBoundary(empty);
      expect(r.severity).toBe("skip");
      expect(r.message).toContain("not present");
      expect(r.severity).not.toBe("pass");
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("treats an unlisted new file as CORE, so the boundary cannot widen by accident", () => {
    write("pipelines/session-start/new-thing.ts", 'import D from "better-sqlite3";\nexport const n = 1;\n');
    const r = checkModuleBoundary(dir);
    expect(r.severity).toBe("issue");
    expect(MEMORY_SIDE).not.toContain("pipelines/session-start/new-thing.ts");
  });

  it("passes on this repository's own source", () => {
    const repoRoot = join(import.meta.dirname, "..", "..", "..", "..");
    const r = checkModuleBoundary(repoRoot);
    // Guard against the fixture-only green: if the path were wrong this would
    // skip, and a skip must not be read as the boundary holding.
    expect(r.severity).not.toBe("skip");
    expect(r.severity).toBe("pass");
  });
});
