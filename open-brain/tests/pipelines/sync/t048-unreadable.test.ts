import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

/**
 * T-048 round 1 (record 148): five `/sync` checks must read everything they
 * claim to have read, or not pass. Audit rows SILENT 1, 2, 3, 20 and 26 in
 * docs/loops/research/t048-silent-drops.md.
 *
 * **How unreadability is made.** `node:fs` is mocked for this file only: every
 * call passes through to the real module except `readFileSync`, `readdirSync`
 * and `statSync` on a path in `denied`, which throw an `EACCES`-shaped error.
 * chmod does not make a file unreadable on Windows, and a directory in place of
 * a file is not unreadable to a walk that recurses into it, so a real denial is
 * not portable. PLATFORM LIMIT: none — these rows go red and green on Windows
 * and Linux alike. What they do NOT prove is the real kernel error: the error
 * object is synthetic, and the checks are asserted to treat ANY throw as
 * unreadable, which is the property that matters.
 */
const { denied } = vi.hoisted(() => ({ denied: new Set<string>() }));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const { resolve: res } = await import("node:path");
  const guard = <F extends (...a: any[]) => any>(fn: F): F =>
    ((p: unknown, ...rest: unknown[]) => {
      if (typeof p === "string" && denied.has(res(p))) {
        throw Object.assign(new Error(`EACCES: permission denied, '${p}'`), { code: "EACCES" });
      }
      return fn(p, ...rest);
    }) as F;
  return {
    ...actual,
    readFileSync: guard(actual.readFileSync),
    readdirSync: guard(actual.readdirSync),
    statSync: guard(actual.statSync),
  };
});

const { checkRetirements, checkModuleBoundary, checkTemplatePersonalNames } = await import(
  "../../../src/pipelines/sync/checks.js"
);

let root: string;
const deny = (rel: string): void => { denied.add(resolve(root, rel)); };
const write = (rel: string, body: string): void => {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
};

afterEach(() => {
  denied.clear();
  rmSync(root, { recursive: true, force: true });
});

const WIDGETIZER = {
  historical: [".agents/retirements.json"],
  retirements: [
    { id: "R-1", name: "widgetizer", pattern: "\\bwidgetizer\\b", event: "cut", ruled: "2026-09-15", classes: ["cli-subcommand"], allowed_referrers: [] },
  ],
};

function retirementsTree(files: Record<string, string> = {}): string {
  root = mkdtempSync(join(tmpdir(), "t048-ret-"));
  write(".agents/retirements.json", JSON.stringify(WIDGETIZER));
  write("README.md", "nothing retired here\n");
  for (const [f, body] of Object.entries(files)) write(f, body);
  return root;
}

describe("SILENT 1 — checkRetirements: an unreadable file is an issue, not a counted pass", () => {
  it("names the file it could not read, and does not pass", () => {
    retirementsTree({ "docs/b.md": "run `widgetizer`\n" });
    deny("docs/b.md");
    const r = checkRetirements(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("unreadable");
    expect(r.message).toContain("docs/b.md");
  });

  it("still fires on a readable file (the path QA saw on ENTITIES.md)", () => {
    retirementsTree({ ".agents/SYSTEM/ENTITIES.md": "the `widgetizer` entity\n" });
    const r = checkRetirements(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain(".agents/SYSTEM/ENTITIES.md names widgetizer");
  });
});

describe("SILENT 20 — listScannableFiles: excluded extensions are counted, and scripts are scanned", () => {
  it("scans a tracked shell script for a retired name", () => {
    retirementsTree({ "scripts/deploy.sh": "#!/bin/sh\nwidgetizer --all\n" });
    const r = checkRetirements(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("scripts/deploy.sh names widgetizer");
  });

  it("states what it excluded, by extension, in the pass", () => {
    retirementsTree({ "evidence/a.diff": "widgetizer\n", "evidence/b.diff": "x\n", "run.out": "x\n" });
    const r = checkRetirements(root);
    expect(r.severity).toBe("pass");
    expect(r.message).toMatch(/excluded by extension[^;]*\.diff 2/);
    expect(r.message).toMatch(/excluded by extension[^;]*\.out 1/);
  });

  // The primary path. git is asserted to work: no try/catch, so a machine
  // without git fails this row rather than skipping it green (G-029).
  it("says it listed through git ls-files and counts the exclusions there too", () => {
    retirementsTree({ "evidence/a.diff": "x\n" });
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["add", "-A"], { cwd: root });
    const r = checkRetirements(root);
    expect(r.severity).toBe("pass");
    expect(r.message).toContain("listed by git ls-files");
    expect(r.message).toMatch(/excluded by extension[^;]*\.diff 1/);
  });
});

describe("SILENT 26 — walkTracked fallback: says it is the fallback, and a partial walk does not pass", () => {
  it("names itself the fallback when there is no git repo to ask", () => {
    retirementsTree();
    const r = checkRetirements(root);
    expect(r.severity).toBe("pass");
    expect(r.message).toContain("FALLBACK");
  });

  it("an unreadable directory makes the walk partial, and the issue names it", () => {
    retirementsTree({ "docs/b.md": "run `widgetizer`\n" });
    deny("docs");
    const r = checkRetirements(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("partial");
    expect(r.message).toContain("docs/");
  });

  it("an unstatable path is named, not skipped", () => {
    retirementsTree({ "docs/b.md": "run `widgetizer`\n" });
    deny("docs/b.md"); // statSync and readFileSync both refuse it
    const r = checkRetirements(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("docs/b.md");
  });
});

describe("SILENT 2 — checkModuleBoundary: an unreadable subdirectory is not a directory with no core files", () => {
  function boundaryTree(): string {
    root = mkdtempSync(join(tmpdir(), "t048-mb-"));
    write("open-brain/src/db-v2.ts", 'import Database from "better-sqlite3";\nexport const V = 1;\n');
    write("open-brain/src/cli.ts", "export const x = 1;\n");
    // A crossing the check exists to catch, hidden behind the unreadable directory.
    write("open-brain/src/core/leak.ts", 'import { V } from "../db-v2.js";\nexport const y = V;\n');
    return root;
  }

  it("names the directory it could not list, and does not pass", () => {
    boundaryTree();
    deny("open-brain/src/core");
    const r = checkModuleBoundary(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("unreadable");
    expect(r.message).toContain("core");
  });

  it("names a .ts file it could not read, as an issue rather than a throw", () => {
    boundaryTree();
    deny("open-brain/src/cli.ts");
    const r = checkModuleBoundary(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("cli.ts");
  });

  it("states what it excluded in the pass", () => {
    boundaryTree();
    rmSync(join(root, "open-brain/src/core"), { recursive: true });
    write("open-brain/src/notes.md", "not a module\n");
    const r = checkModuleBoundary(root);
    expect(r.severity).toBe("pass");
    expect(r.message).toMatch(/excluded 1 non-\.ts file/);
  });
});

describe("SILENT 3 — checkTemplatePersonalNames: an unreadable file is not 'no personal names'", () => {
  function templateTree(): string {
    root = mkdtempSync(join(tmpdir(), "t048-tpl-"));
    write("project-template/README.md", "Greet the user.\n");
    write("project-template/.claude/commands/start.md", "You are Clark.\n");
    return root;
  }

  it("names an unreadable prose file, and does not pass", () => {
    templateTree();
    deny("project-template/.claude/commands/start.md");
    const r = checkTemplatePersonalNames(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("unreadable");
    expect(r.message).toContain("project-template/.claude/commands/start.md");
  });

  it("names an unreadable directory, and does not pass", () => {
    templateTree();
    deny("project-template/.claude");
    const r = checkTemplatePersonalNames(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("project-template/.claude");
  });

  it("states how many files it read and what it skipped in the pass", () => {
    templateTree();
    rmSync(join(root, "project-template/.claude"), { recursive: true });
    write("project-template/node_modules/x/index.js", "Aaron\n");
    const r = checkTemplatePersonalNames(root);
    expect(r.severity).toBe("pass");
    expect(r.message).toContain("1 file(s) read");
    expect(r.message).toContain("node_modules");
  });
});
