import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { checkRetirements, checkModuleBoundary, checkTemplatePersonalNames } from "../../../src/pipelines/sync/checks.js";

/**
 * QA 151 (T-048 round 1, candidate 7913c5f). The developer's 14 rows mock `node:fs` with a synthetic EACCES.
 * These rows use the REAL filesystem, with no mock:
 *
 * - "real kernel denial" rows chmod a file or directory to 000 and let the kernel refuse it. PLATFORM LIMIT:
 *   Linux (or any POSIX) as a NON-ROOT user only. root reads through mode 000, and chmod does not deny a read
 *   on Windows, so there they SKIP, visibly, in the run's skipped count. The Windows side was run by hand on
 *   DESKTOP-0GV3HAD with icacls denies and share-None holds (docs/loops/t048-r1-qa-report.md, check 1).
 * - the widened-extension and git-listing rows need git and run everywhere.
 */
const REAL_DENIAL = process.platform !== "win32" && typeof process.getuid === "function" && process.getuid() !== 0;

let root: string;
const locked: string[] = [];
const write = (rel: string, body: string): void => {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
};
/** chmod 000, and prove the kernel now refuses it before the row relies on that. */
const lock = (rel: string): void => {
  const abs = join(root, rel);
  chmodSync(abs, 0o000);
  locked.push(abs);
  let refused = "read succeeded";
  try { if (rel.endsWith("/")) readdirSync(abs); else readFileSync(abs); } catch (e) {
    refused = (e as NodeJS.ErrnoException).code ?? "no code";
  }
  expect(refused, `precondition: ${rel} must be unreadable after chmod 000`).toBe("EACCES");
};
const git = (...a: string[]): void => { execFileSync("git", a, { cwd: root, stdio: "ignore" }); };

afterEach(() => {
  for (const p of locked.splice(0)) { try { chmodSync(p, 0o755); } catch { /* already gone */ } }
  delete process.env.GIT_DIR;
  rmSync(root, { recursive: true, force: true });
});

const RECORD = {
  historical: [".agents/retirements.json"],
  retirements: [
    { id: "R-1", name: "widgetizer", pattern: "\\bwidgetizer\\b", event: "cut", ruled: "2026-09-15", classes: ["cli-subcommand"], allowed_referrers: [] },
  ],
};
function retirementsTree(files: Record<string, string> = {}): void {
  root = mkdtempSync(join(tmpdir(), "qa151-ret-"));
  write(".agents/retirements.json", JSON.stringify(RECORD));
  write("README.md", "nothing retired here\n");
  for (const [f, body] of Object.entries(files)) write(f, body);
}
function boundaryTree(): void {
  root = mkdtempSync(join(tmpdir(), "qa151-mb-"));
  write("open-brain/src/db-v2.ts", 'import Database from "better-sqlite3";\nexport const V = 1;\n');
  write("open-brain/src/cli.ts", "export const x = 1;\n");
  write("open-brain/src/core/leak.ts", 'import { V } from "../db-v2.js";\nexport const y = V;\n');
}
function templateTree(): void {
  root = mkdtempSync(join(tmpdir(), "qa151-tpl-"));
  write("project-template/README.md", "Greet the user.\n");
  write("project-template/.claude/commands/start.md", "Greet the user again.\n");
}

describe.skipIf(!REAL_DENIAL)("QA 151: a real kernel denial (chmod 000, non-root POSIX) in each of the five checks", () => {
  it("SILENT 1: a tracked file the kernel refuses is an issue naming it (git path)", () => {
    retirementsTree({ "docs/b.md": "run `widgetizer`\n" });
    git("init", "-q"); git("add", "-A");
    lock("docs/b.md");
    const r = checkRetirements(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("unreadable: docs/b.md (EACCES)");
    expect(r.message).toContain("incomplete (listed by git ls-files)");
  });

  it("SILENT 26: a directory the kernel refuses makes the fallback walk PARTIAL, and an issue", () => {
    retirementsTree({ "docs/b.md": "run `widgetizer`\n" });
    lock("docs/");
    const r = checkRetirements(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("FALLBACK");
    expect(r.message).toContain("PARTIAL: 1 path(s) unreadable");
    expect(r.message).toContain("docs/ (EACCES)");
  });

  it("SILENT 2: an unlistable src subdirectory is an issue naming it", () => {
    boundaryTree();
    lock("open-brain/src/core/");
    const r = checkModuleBoundary(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("core/ (EACCES)");
  });

  it("SILENT 2: an unreadable .ts file is an issue naming it, not a throw", () => {
    boundaryTree();
    lock("open-brain/src/cli.ts");
    const r = checkModuleBoundary(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("cli.ts (EACCES)");
  });

  it("SILENT 3: an unreadable template file is an issue naming it", () => {
    templateTree();
    lock("project-template/.claude/commands/start.md");
    const r = checkTemplatePersonalNames(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("project-template/.claude/commands/start.md (EACCES)");
  });

  it("SILENT 3: an unlistable template directory is an issue naming it", () => {
    templateTree();
    lock("project-template/.claude/");
    const r = checkTemplatePersonalNames(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("project-template/.claude/ (EACCES)");
  });
});

describe("QA 151: SILENT 20, every widened extension is scanned through git ls-files (real fs)", () => {
  it.each([".sh", ".ps1", ".yml", ".yaml", ".toml", ".mts", ".cts"])("a retired name in a tracked %s file is a finding", (ext) => {
    retirementsTree({ [`scripts/deploy${ext}`]: "widgetizer --all\n" });
    git("init", "-q"); git("add", "-A");
    const r = checkRetirements(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain(`scripts/deploy${ext} names widgetizer`);
  });

  it("an extension outside the list is not scanned, and is counted by extension in the pass", () => {
    retirementsTree({ "scripts/a.bat": "widgetizer\n", "scripts/b.bat": "widgetizer\n", "notes.txt": "x\n" });
    git("init", "-q"); git("add", "-A");
    const r = checkRetirements(root);
    expect(r.severity).toBe("pass");
    expect(r.message).toContain("listed by git ls-files");
    expect(r.message).toMatch(/excluded by extension[^;]*\.bat 2/);
    expect(r.message).toMatch(/excluded by extension[^;]*\.txt 1/);
  });
});

describe("QA 151: SILENT 26 and addition (d), when git cannot give the listing (real fs, real git)", () => {
  it("a repository whose index lists nothing falls back to the walk, says why, and still finds the name", () => {
    retirementsTree({ "docs/b.md": "run `widgetizer`\n" });
    git("init", "-q"); // nothing added: `git ls-files` succeeds and lists nothing
    const r = checkRetirements(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("docs/b.md names widgetizer");
  });

  it("the empty-listing fallback's pass says FALLBACK and the reason", () => {
    retirementsTree();
    git("init", "-q");
    const r = checkRetirements(root);
    expect(r.severity).toBe("pass");
    expect(r.message).toContain("FALLBACK, git ls-files listed nothing");
  });

  it("a git that fails (GIT_DIR points nowhere) falls back, and the pass says so", () => {
    retirementsTree();
    git("init", "-q"); git("add", "-A");
    process.env.GIT_DIR = join(root, "no-such-git-dir");
    const r = checkRetirements(root);
    expect(r.severity).toBe("pass");
    expect(r.message).toContain("FALLBACK, git ls-files failed");
  });
});
