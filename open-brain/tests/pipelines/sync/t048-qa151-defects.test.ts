import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";

/**
 * QA 151 (T-048 round 1, candidate 7913c5f): DEFECT rows. Each is RED on 7913c5f on purpose; it states what a
 * reader of the check's output needs and does not get. Branch qa/t048-r1-tests-red only, NOT FOR MERGE as-is:
 * the planner rules whether each is a defect.
 *
 * D1: an unreadable path hides a REAL finding. module-boundary and template-personal-names return on the first
 *     unreadable path, before the finding is computed or named; retirements lists unreadable paths first and
 *     cuts at six, so a real finding falls into "+N more".
 * D2: when a fallback walk is PARTIAL and there is also a finding, the message drops the listing label, so it
 *     says neither FALLBACK nor PARTIAL.
 * PLATFORM LIMIT: none (mock, EACCES as the developer's rows use).
 */
const { denied } = vi.hoisted(() => ({ denied: new Map<string, Set<string>>() }));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const { resolve: res } = await import("node:path");
  const guard = <F extends (...a: any[]) => any>(op: string, fn: F): F =>
    ((p: unknown, ...rest: unknown[]) => {
      if (typeof p === "string" && denied.get(res(p))?.has(op)) {
        throw Object.assign(new Error(`EACCES: permission denied, '${p}'`), { code: "EACCES" });
      }
      return fn(p, ...rest);
    }) as F;
  return {
    ...actual,
    readFileSync: guard("readFileSync", actual.readFileSync),
    readdirSync: guard("readdirSync", actual.readdirSync),
    statSync: guard("statSync", actual.statSync),
  };
});

const { checkRetirements, checkModuleBoundary, checkTemplatePersonalNames } = await import(
  "../../../src/pipelines/sync/checks.js"
);

let root: string;
const deny = (rel: string, ops: string[]): void => { denied.set(resolve(root, rel), new Set(ops)); };
const write = (rel: string, body: string): void => {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
};
afterEach(() => {
  denied.clear();
  rmSync(root, { recursive: true, force: true });
});

const RECORD = {
  historical: [".agents/retirements.json"],
  retirements: [
    { id: "R-1", name: "widgetizer", pattern: "\\bwidgetizer\\b", event: "cut", ruled: "2026-09-15", classes: ["cli-subcommand"], allowed_referrers: [] },
  ],
};

describe("QA 151 D1: an unreadable path must not hide a real finding", () => {
  it("template-personal-names: one unreadable file, and a readable file that ships a personal name", () => {
    root = mkdtempSync(join(tmpdir(), "qa151-d1-tpl-"));
    write("project-template/a.md", "Greet the user.\n");
    write("project-template/b.md", "Ask Clark before shipping.\n");
    deny("project-template/a.md", ["readFileSync"]);
    const r = checkTemplatePersonalNames(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("project-template/a.md");
    expect(r.message).toContain('project-template/b.md ("Clark")');
  });

  it("module-boundary: one unreadable .ts file, and a readable core file that imports memory", () => {
    root = mkdtempSync(join(tmpdir(), "qa151-d1-mb-"));
    write("open-brain/src/db-v2.ts", 'import Database from "better-sqlite3";\nexport const V = 1;\n');
    write("open-brain/src/cli.ts", "export const x = 1;\n");
    write("open-brain/src/core/leak.ts", 'import { V } from "../db-v2.js";\nexport const y = V;\n');
    deny("open-brain/src/cli.ts", ["readFileSync"]);
    const r = checkModuleBoundary(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("cli.ts");
    expect(r.message).toContain("core/leak.ts -> db-v2.ts");
  });

  it("retirements: six unreadable files and one real finding; the finding is shown, not cut into '+N more'", () => {
    root = mkdtempSync(join(tmpdir(), "qa151-d1-ret-"));
    write(".agents/retirements.json", JSON.stringify(RECORD));
    write("docs/z-finding.md", "run `widgetizer`\n");
    for (let i = 1; i <= 6; i++) {
      write(`docs/u${i}.md`, "x\n");
      deny(`docs/u${i}.md`, ["readFileSync"]);
    }
    const r = checkRetirements(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("docs/z-finding.md names widgetizer");
  });
});

describe("QA 151 D2: a PARTIAL fallback walk says so even when there is also a finding", () => {
  it("fallback walk, one unlistable directory, one real finding", () => {
    root = mkdtempSync(join(tmpdir(), "qa151-d2-"));
    write(".agents/retirements.json", JSON.stringify(RECORD));
    write("docs/b.md", "run `widgetizer`\n");
    write("hidden/c.md", "x\n");
    deny("hidden", ["readdirSync"]);
    const r = checkRetirements(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("docs/b.md names widgetizer");
    expect(r.message).toContain("hidden/");
    expect(r.message).toContain("FALLBACK");
    expect(r.message).toContain("PARTIAL");
  });
});
