/**
 * T-267: the transcript folder name follows Claude Code's own rule, and git
 * runs without a shell.
 *
 * B: Claude Code names `~/.claude/projects/<folder>` with
 * `path.replace(/[^a-zA-Z0-9]/g, "-")`. The old rule replaced only `:\`, `:/`
 * and slashes, so a home with a space (`C:\Users\Aaron Melven`) matched no
 * folder and `skills-audit` threw for every seat on that machine. Expected
 * folder names below are LITERALS, never computed with `deriveProjectKey`.
 *
 * A: the vault backup check interpolated the vault path into a shell string;
 * cmd expanded `%VAR%` in it and a trailing backslash escaped the closing quote.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as cp from "node:child_process";
import * as discovery from "../src/pipelines/session-start/session-discovery.js";
import * as skillsAudit from "../src/pipelines/skills-audit/index.js";
import * as health from "../src/pipelines/session-start/health-checks.js";

const UUID = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";
const QA_PROJECT = "C:\\Users\\Aaron Melven\\Worktrees\\sia-qa";
const QA_FOLDER = "C--Users-Aaron-Melven-Worktrees-sia-qa";

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t267-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("B1 deriveProjectKey follows Claude Code's rule", () => {
  it.each([
    ["C:\\Users\\Aaron Melven\\Worktrees\\sia-qa", "C--Users-Aaron-Melven-Worktrees-sia-qa"],
    ["C:\\Users\\melve\\.claude", "C--Users-melve--claude"],
    ["C:\\p\\my.app_v2", "C--p-my-app-v2"],
    ["c:\\Users\\melve\\Worktrees\\sia--qa", "c--Users-melve-Worktrees-sia--qa"],
    ["/home/aaron/my project", "-home-aaron-my-project"],
  ])("%s -> %s", (input, expected) => {
    expect(discovery.deriveProjectKey(input)).toBe(expected);
  });
});

function qaHome(): string {
  const home = path.join(tmp, "home");
  const folder = path.join(home, ".claude", "projects", QA_FOLDER);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, `${UUID}.jsonl`), "");
  return home;
}

describe("B2/B3 a home with a space finds its transcript folder", () => {
  it("B2 discoverSessionUuid finds the literal folder", () => {
    const home = qaHome();
    expect(discovery.discoverSessionUuid(QA_PROJECT, home)).toBe(UUID);
  });

  it("B3 auditSkills does not throw and reads that session", () => {
    const home = qaHome();
    let report: ReturnType<typeof skillsAudit.auditSkills> | undefined;
    expect(() => {
      report = skillsAudit.auditSkills({ projectDir: QA_PROJECT, home, seat: "qa" });
    }).not.toThrow();
    expect(report?.session).toBe(UUID);
  });
});

/** A git repo at `dir` whose only commit is dated `date` (ISO) or now. */
function makeVault(dir: string, date?: string): void {
  fs.mkdirSync(dir, { recursive: true });
  const env = { ...process.env };
  if (date) {
    env.GIT_COMMITTER_DATE = date;
    env.GIT_AUTHOR_DATE = date;
  }
  const git = (args: string[]) =>
    cp.execFileSync("git", ["-C", dir, ...args], { env, stdio: ["ignore", "pipe", "pipe"] });
  git(["init", "-q"]);
  fs.writeFileSync(path.join(dir, "note.md"), "x\n");
  git(["add", "note.md"]);
  git([
    "-c", "commit.gpgsign=false",
    "-c", "user.name=T267",
    "-c", "user.email=t267@example.invalid",
    "commit", "-q", "-m", "seed",
  ]);
}

const OLD = "2001-01-01T00:00:00Z";
const BACKUP = /last backed up \d+h ago/;

function backupWarnings(vaultPath: string): string[] {
  const prior = process.env.OPEN_BRAIN_VAULT_DIR;
  process.env.OPEN_BRAIN_VAULT_DIR = vaultPath;
  try {
    const home = path.join(tmp, "home");
    fs.mkdirSync(home, { recursive: true });
    return health
      .runHealthChecks(home)
      .warnings.filter((w) => w.category === "backup")
      .map((w) => w.message);
  } finally {
    process.env.OPEN_BRAIN_VAULT_DIR = prior;
  }
}

describe("H the vault backup check reaches git without a shell", () => {
  const priorObT = process.env.OB_T;
  afterEach(() => {
    process.env.OB_T = priorObT;
    if (priorObT === undefined) Reflect.deleteProperty(process.env, "OB_T");
  });

  it("H1 (control) a 2001 commit warns; a fresh commit does not", () => {
    const oldVault = path.join(tmp, "vault-old");
    makeVault(oldVault, OLD);
    const old = backupWarnings(oldVault);
    expect(old).toHaveLength(1);
    expect(old[0]).toMatch(BACKUP);

    const freshVault = path.join(tmp, "vault-fresh");
    makeVault(freshVault);
    expect(backupWarnings(freshVault)).toEqual([]);
  });

  it("H2 a vault path holding %VAR% and $VAR reaches git literally", () => {
    process.env.OB_T = "decoy";
    const vault = path.join(tmp, "vault %OB_T% $OB_T");
    makeVault(vault, OLD);
    const w = backupWarnings(vault);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(BACKUP);
  });

  it("H3 a trailing backslash (Windows) or a double quote (POSIX) reaches git literally", () => {
    let vault: string;
    if (process.platform === "win32") {
      const dir = path.join(tmp, "vault-trailing");
      makeVault(dir, OLD);
      vault = dir + "\\";
    } else {
      vault = path.join(tmp, 'vault "q" x');
      makeVault(vault, OLD);
    }
    const w = backupWarnings(vault);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(BACKUP);
  });
});

describe("H4 no source file imports execSync", () => {
  const stripComments = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
  const IMPORTS_EXEC_SYNC =
    /import\s*\{[^}]*\bexecSync\b[^}]*\}\s*from\s*["'](?:node:)?child_process["']|require\(\s*["'](?:node:)?child_process["']\s*\)\.execSync\b|\{[^}]*\bexecSync\b[^}]*\}\s*=\s*require\(\s*["'](?:node:)?child_process["']\s*\)/;

  it("validates the pattern against planted positives and negatives", () => {
    expect(IMPORTS_EXEC_SYNC.test(stripComments('import { execSync } from "child_process";'))).toBe(true);
    expect(IMPORTS_EXEC_SYNC.test(stripComments('import { execSync, execFileSync } from "node:child_process";'))).toBe(true);
    expect(IMPORTS_EXEC_SYNC.test(stripComments('const { execSync } = require("child_process");'))).toBe(true);
    expect(IMPORTS_EXEC_SYNC.test(stripComments('import { execFileSync } from "node:child_process";'))).toBe(false);
    expect(IMPORTS_EXEC_SYNC.test(stripComments('// import { execSync } from "child_process";\n'))).toBe(false);
  });

  it("finds no .ts file under src importing execSync", () => {
    const root = path.resolve(__dirname, "../src");
    const walk = (d: string, out: string[] = []): string[] => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) walk(path.join(d, e.name), out);
        else if (e.name.endsWith(".ts")) out.push(path.join(d, e.name));
      }
      return out;
    };
    const offenders = walk(root)
      .filter((f) => IMPORTS_EXEC_SYNC.test(stripComments(fs.readFileSync(f, "utf8"))))
      .map((f) => path.relative(root, f).replace(/\\/g, "/"));
    expect(offenders).toEqual([]);
  });
});
