import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";

/**
 * QA 151 (T-048 round 1, candidate 7913c5f). The developer's rows throw EACCES only. On Windows the kernel says
 * EPERM for an ACL deny, EBUSY for a file held with share None, and EISDIR for a directory where a tracked file
 * was; a throw can also carry no code at all. A check that recorded only EACCES would pass every one of the
 * developer's rows and drop every real Windows denial (QA mutants Q4 and Q5 did exactly that, and survived).
 * These rows pin "any throw is unreadable" with the codes the kernel actually uses. PLATFORM LIMIT: none (mock).
 */
const { denied } = vi.hoisted(() => ({ denied: new Map<string, { ops: Set<string>; code: string | undefined }>() }));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const { resolve: res } = await import("node:path");
  const guard = <F extends (...a: any[]) => any>(op: string, fn: F): F =>
    ((p: unknown, ...rest: unknown[]) => {
      const d = typeof p === "string" ? denied.get(res(p)) : undefined;
      if (d?.ops.has(op)) {
        const err = new Error(`${d.code ?? "no code"}: refused, '${p}'`);
        throw d.code === undefined ? err : Object.assign(err, { code: d.code });
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
const deny = (rel: string, ops: string[], code: string | undefined): void => {
  denied.set(resolve(root, rel), { ops: new Set(ops), code });
};
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
function retirementsTree(files: Record<string, string> = {}): void {
  root = mkdtempSync(join(tmpdir(), "qa151-codes-ret-"));
  write(".agents/retirements.json", JSON.stringify(RECORD));
  write("README.md", "nothing retired here\n");
  for (const [f, body] of Object.entries(files)) write(f, body);
}
function boundaryTree(): void {
  root = mkdtempSync(join(tmpdir(), "qa151-codes-mb-"));
  write("open-brain/src/db-v2.ts", 'import Database from "better-sqlite3";\nexport const V = 1;\n');
  write("open-brain/src/cli.ts", "export const x = 1;\n");
  write("open-brain/src/core/ok.ts", "export const z = 1;\n");
}
function templateTree(): void {
  root = mkdtempSync(join(tmpdir(), "qa151-codes-tpl-"));
  write("project-template/README.md", "Greet the user.\n");
  write("project-template/.claude/commands/start.md", "Greet the user again.\n");
}

// The codes a Windows kernel returned on DESKTOP-0GV3HAD for this round's mechanisms, plus a throw with no code.
const CODES: Array<[string, string | undefined, string]> = [
  ["EPERM (icacls deny)", "EPERM", "(EPERM)"],
  ["EBUSY (share None hold)", "EBUSY", "(EBUSY)"],
  ["EISDIR (a directory where a tracked file was)", "EISDIR", "(EISDIR)"],
  ["no code at all", undefined, "(error)"],
];

describe("QA 151: any read error is unreadable, whatever its code", () => {
  it.each(CODES)("SILENT 1 retirements read: %s", (_label, code, shown) => {
    retirementsTree({ "docs/b.md": "run `widgetizer`\n" });
    deny("docs/b.md", ["readFileSync"], code);
    const r = checkRetirements(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain(`unreadable: docs/b.md ${shown}`);
  });

  it.each(CODES)("SILENT 26 walk readdir: %s", (_label, code, shown) => {
    retirementsTree({ "docs/b.md": "x\n" });
    deny("docs", ["readdirSync"], code);
    const r = checkRetirements(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain(`docs/ ${shown}`);
    expect(r.message).toContain("PARTIAL");
  });

  it.each(CODES)("SILENT 2 module-boundary file read: %s", (_label, code, shown) => {
    boundaryTree();
    deny("open-brain/src/cli.ts", ["readFileSync"], code);
    const r = checkModuleBoundary(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain(`cli.ts ${shown}`);
  });

  it.each(CODES)("SILENT 2 module-boundary readdir: %s", (_label, code, shown) => {
    boundaryTree();
    deny("open-brain/src/core", ["readdirSync"], code);
    const r = checkModuleBoundary(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain(`core/ ${shown}`);
  });

  it.each(CODES)("SILENT 3 template file read: %s", (_label, code, shown) => {
    templateTree();
    deny("project-template/.claude/commands/start.md", ["readFileSync"], code);
    const r = checkTemplatePersonalNames(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain(`project-template/.claude/commands/start.md ${shown}`);
  });

  it.each(CODES)("SILENT 3 template readdir: %s", (_label, code, shown) => {
    templateTree();
    deny("project-template/.claude", ["readdirSync"], code);
    const r = checkTemplatePersonalNames(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain(`project-template/.claude/ ${shown}`);
  });
});
