import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkModuleBoundary, MEMORY_SIDE } from "../../../src/pipelines/sync/checks.js";

/**
 * T-261 S1: the module-boundary check sees a literal dynamic `import()` too. Core may load memory lazily only
 * where DYNAMIC_MEMORY_LOADS lists the crossing. Fixtures are written with `fs` alone, as in module-boundary.test.ts.
 */
describe("T-261 S1: checkModuleBoundary sees dynamic imports", () => {
  let dir: string;
  let src: string;

  const write = (rel: string, body: string): void => {
    const full = join(src, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body);
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "t261-s1-"));
    src = join(dir, "open-brain", "src");
    mkdirSync(src, { recursive: true });
    write("db-v2.ts", 'import Database from "better-sqlite3";\nexport const SCHEMA_VERSION = 1;\n');
    write("shared/paths.ts", "export const p = 1;\n");
    write("cli.ts", 'import { p } from "./shared/paths.js";\nexport const x = p;\n');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("R1: a core file that dynamically imports a memory module, unlisted, is an issue", () => {
    write("pipelines/session-start/lazy.ts", 'export async function f() {\n  return (await import("../../db-v2.js")).SCHEMA_VERSION;\n}\n');
    const r = checkModuleBoundary(dir);
    expect(r.severity, r.message).toBe("issue");
    expect(r.message).toContain("pipelines/session-start/lazy.ts -> db-v2.ts (dynamic import, not in DYNAMIC_MEMORY_LOADS)");
  });

  it("R2: a core file that dynamically imports the native build, unlisted, is an issue", () => {
    write("shared/paths.ts", 'export const p = 1;\nexport async function open() {\n  return (await import("better-sqlite3")).default;\n}\n');
    const r = checkModuleBoundary(dir);
    expect(r.severity, r.message).toBe("issue");
    expect(r.message).toContain("shared/paths.ts -> better-sqlite3 (dynamic import, not in DYNAMIC_MEMORY_LOADS)");
  });

  it("R3: a listed dynamic load passes, and the pass counts it", () => {
    write("cli.ts", 'import { p } from "./shared/paths.js";\nexport const x = p;\nexport async function score() {\n  return (await import("./db-v2.js")).SCHEMA_VERSION;\n}\n');
    const r = checkModuleBoundary(dir);
    expect(r.severity, r.message).toBe("pass");
    expect(r.message).toContain("1 dynamic memory load(s) allowed by DYNAMIC_MEMORY_LOADS");
  });

  it("R4: an unresolved dynamic relative import refuses, as an unresolved static one does", () => {
    write("cli.ts", 'export async function g() {\n  return import("./gone.js");\n}\n');
    const r = checkModuleBoundary(dir);
    expect(r.severity, r.message).toBe("issue");
    expect(r.message).toContain("did not resolve");
  });

  it("R5: this repository's own source passes with exactly the 8 listed loads", () => {
    const repoRoot = join(import.meta.dirname, "..", "..", "..", "..");
    const r = checkModuleBoundary(repoRoot);
    expect(r.severity, r.message).toBe("pass");
    expect(r.message).toContain("8 dynamic memory load(s) allowed by DYNAMIC_MEMORY_LOADS");
  });

  it("R6: the five memory-only files are on the memory side", () => {
    for (const f of ["lifecycle.ts", "shared/fts.ts", "shared/vault-path-segment.ts", "shared/yaml-frontmatter.ts", "shared/content-guard.ts"]) {
      expect(MEMORY_SIDE, f).toContain(f);
    }
  });

  it("R7 (guard): a memory file may load memory dynamically", () => {
    write("pipelines/store/lazy.ts", 'export async function h() {\n  return (await import("../../db-v2.js")).SCHEMA_VERSION;\n}\n');
    const r = checkModuleBoundary(dir);
    expect(r.severity, r.message).toBe("pass");
  });
});
