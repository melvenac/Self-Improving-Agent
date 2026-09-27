/**
 * T-048 round 1b (record 165). Red on 7913c5f.
 *
 * D1: an unreadable path is named beside the real finding, not instead of it.
 * D2: FALLBACK and PARTIAL stay in the message when there is also a finding.
 * D3: each of these checks prints a complete scope statement (report: true).
 * PLATFORM LIMIT: none. The denial is a mock, same shape as QA 151's rows.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";

const { denied } = vi.hoisted(() => ({ denied: new Map<string, Set<string>>() }));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const { resolve: res } = await import("node:path");
  const guard = <F extends (...a: unknown[]) => unknown>(op: string, fn: F): F =>
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

describe("T-048 r1b D1: an unreadable path does not hide a real finding", () => {
  it("D1-TEMPLATE: an unreadable file beside a personal name; both are named", () => {
    root = mkdtempSync(join(tmpdir(), "r1b-d1-tpl-"));
    write("project-template/a.md", "Greet the user.\n");
    write("project-template/b.md", "Ask Clark before shipping.\n");
    deny("project-template/a.md", ["readFileSync"]);
    const r = checkTemplatePersonalNames(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("project-template/a.md");
    expect(r.message).toContain('project-template/b.md ("Clark")');
  });

  it("D1-BOUNDARY: an unreadable .ts file beside a real crossing; both are named", () => {
    root = mkdtempSync(join(tmpdir(), "r1b-d1-mb-"));
    write("open-brain/src/db-v2.ts", 'import Database from "better-sqlite3";\nexport const V = 1;\n');
    write("open-brain/src/cli.ts", "export const x = 1;\n");
    write("open-brain/src/core/leak.ts", 'import { V } from "../db-v2.js";\nexport const y = V;\n');
    deny("open-brain/src/cli.ts", ["readFileSync"]);
    const r = checkModuleBoundary(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("cli.ts");
    expect(r.message).toContain("core/leak.ts -> db-v2.ts");
  });

  it("D1-RETIREMENTS: six unreadable files and one retired name; the name is shown", () => {
    root = mkdtempSync(join(tmpdir(), "r1b-d1-ret-"));
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

describe("T-048 r1b D2: FALLBACK and PARTIAL stay beside a finding", () => {
  it("D2-PARTIAL: a fallback walk with one unlistable directory and one retired name", () => {
    root = mkdtempSync(join(tmpdir(), "r1b-d2-"));
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

describe("T-048 r1b D3: the scope statement is printed for every check", () => {
  it("D3-TEMPLATE-PASS: the pass names how many files were read, and is reported", () => {
    root = mkdtempSync(join(tmpdir(), "r1b-d3-tpl-"));
    write("project-template/README.md", "Greet the user.\n");
    const r = checkTemplatePersonalNames(root);
    expect(r.severity).toBe("pass");
    expect(r.report).toBe(true);
    expect(r.message).toContain("1 file(s) read");
  });

  it("D3-TEMPLATE-ISSUE: a personal name still carries the file count", () => {
    root = mkdtempSync(join(tmpdir(), "r1b-d3-hit-"));
    write("project-template/a.md", "Ask Clark before shipping.\n");
    const r = checkTemplatePersonalNames(root);
    expect(r.severity).toBe("issue");
    expect(r.report).toBe(true);
    expect(r.message).toContain('project-template/a.md ("Clark")');
    expect(r.message).toContain("file(s) read");
  });

  it("D3-BOUNDARY: an unreadable file still states the file count", () => {
    root = mkdtempSync(join(tmpdir(), "r1b-d3-mb-"));
    write("open-brain/src/cli.ts", "export const x = 1;\n");
    deny("open-brain/src/cli.ts", ["readFileSync"]);
    const r = checkModuleBoundary(root);
    expect(r.severity).toBe("issue");
    expect(r.report).toBe(true);
    expect(r.message).toContain("cli.ts");
    expect(r.message).toContain("file(s)");
  });

  it("D3-RETIREMENTS: a finding still carries the listing label, and is reported", () => {
    root = mkdtempSync(join(tmpdir(), "r1b-d3-ret-"));
    write(".agents/retirements.json", JSON.stringify(RECORD));
    write("docs/b.md", "run `widgetizer`\n");
    const r = checkRetirements(root);
    expect(r.severity).toBe("issue");
    expect(r.report).toBe(true);
    expect(r.message).toContain("docs/b.md names widgetizer");
    expect(r.message).toContain("FALLBACK");
  });
});
