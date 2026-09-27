/**
 * `/bootstrap` round 4 (record 156): R-BF-17..20, pinned before the fixes.
 *
 * QA 145's seven non-record shapes, the zero-byte stray that must not win the
 * root walk (QA's Q6), install N's nested STOP naming both remedies, and
 * P-UNDO through the CLI. Written against the round-3 tree, so each row is red
 * until the fix.
 */
import { describe, it, expect, afterEach } from "vitest";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { isProjectRoot, resolveRepoRoot } from "../../src/shared/repo-root.js";

const cliEntry = join(import.meta.dirname, "../../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const bootstrapMd = join(import.meta.dirname, "../../../project-template/.claude/commands/bootstrap.md");
const T = 120_000;

function cli(args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): { status: number | null; out: string } {
  const r = spawnSync(process.execPath, [tsxCli, cliEntry, ...args], { cwd, encoding: "utf8", env });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}
function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
const tmps: string[] = [];
afterEach(() => { for (const t of tmps.splice(0)) rmSync(t, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });
function tmp(prefix = "bf-r4-"): string { const d = mkdtempSync(join(tmpdir(), prefix)); tmps.push(d); return d; }

const SHAPES: ReadonlyArray<readonly [string, string]> = [
  ["{}", "a JSON object with no schema_version"],
  ['{"project":{}}', "a JSON object with no schema_version"],
  ["[]", "JSON array"],
  ["null", "JSON null"],
  ["42", "JSON number"],
  ['"text"', "JSON string"],
  ["true", "JSON boolean"],
];

describe("R-BF-17: a state.json is a record only when it is a JSON object carrying schema_version", { timeout: T }, () => {
  for (const [bytes, why] of SHAPES) {
    it(`${bytes}: NOT A RECORD — ${why}, and move-residue sets it aside`, () => {
      const dir = tmp();
      mkdirSync(join(dir, ".agents"));
      writeFileSync(join(dir, ".agents", "state.json"), bytes);
      const c = cli(["bootstrap", "check", dir], dir);
      expect(c.out).not.toMatch(/BOOTSTRAPPED/);
      expect(c.out).toMatch(new RegExp(`NOT A RECORD — state\\.json is ${why.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
      const m = cli(["bootstrap", "move-residue", dir], dir);
      expect(m.status).toBe(0);
      expect(m.out).not.toMatch(/refused/);
      expect(existsSync(join(dir, ".agents", "state.json"))).toBe(false);
      const [folder] = readdirSync(join(dir, ".agents", "archive"));
      expect(readFileSync(join(dir, ".agents", "archive", folder, "state.json"), "utf8")).toBe(bytes);
    });
  }
});

describe("R-BF-18: .agents/state.json is a root marker only when it is a record", () => {
  it("a zero-byte state.json between a record and the cwd does not win the walk (kills Q6)", () => {
    const real = tmp("bf-r4-real-");
    mkdirSync(join(real, ".agents"), { recursive: true });
    writeFileSync(join(real, ".agents", "state.json"), JSON.stringify({ schema_version: 3, revision: 1, project: { name: "real" } }));
    const mid = join(real, "packages", "x");
    mkdirSync(join(mid, ".agents"), { recursive: true });
    writeFileSync(join(mid, ".agents", "state.json"), "");
    const cwd = join(mid, "src");
    mkdirSync(cwd, { recursive: true });
    expect(isProjectRoot(mid)).toBe(false);
    expect(isProjectRoot(real)).toBe(true);
    expect(resolveRepoRoot(cwd)).toBe(resolve(real));
  });
});

describe("R-BF-19: the nested STOP names both remedies", { timeout: T }, () => {
  it("install N: Next names git init here and moving the folder out, and bootstrap.md step 1 says the same", () => {
    const parent = tmp("bf-r4-parent-");
    const child = join(parent, "tools", "csvtool");
    writeFileSync(join(parent, "package.json"), '{"name":"node-parent","version":"3.1.4"}\n');
    mkdirSync(join(parent, ".agents", "SYSTEM"), { recursive: true });
    mkdirSync(join(child), { recursive: true });
    writeFileSync(join(child, "pyproject.toml"), '[project]\nname = "csvtool"\n');
    git(parent, "init", "-q", "-b", "master");
    git(parent, "config", "user.email", "r4@example.invalid");
    git(parent, "config", "user.name", "R4");
    git(parent, "add", "-A", "--", ".", ":(exclude)tools");
    git(parent, "commit", "-q", "-m", "parent");
    const c = cli(["bootstrap", "check", child], child);
    expect(c.out).toMatch(/STOP: this folder is inside another repository \(.+\)\. `git init` here makes this folder its own project, or move the folder out of the enclosing repository\./);
    const step1 = readFileSync(bootstrapMd, "utf8").slice(
      readFileSync(bootstrapMd, "utf8").indexOf("## Step 1"),
      readFileSync(bootstrapMd, "utf8").indexOf("## Step 2"),
    );
    expect(step1).toMatch(/`git init` here makes this folder its own project/);
    expect(step1).toMatch(/move the folder out of the enclosing repository/);
    git(child, "init", "-q", "-b", "master");
    const after = cli(["bootstrap", "check", child], child);
    expect(after.out).not.toMatch(/inside another repository/);
  });
});

describe("R-BF-20: a failed undo is never printed as refused", { timeout: T }, () => {
  it("P-UNDO through the CLI: names what moved, where, and what stayed, and does not say refused", () => {
    const dir = tmp("bf-r4-undo-");
    mkdirSync(join(dir, ".agents", "aaa"), { recursive: true });
    writeFileSync(join(dir, ".agents", "aaa", "one.txt"), "1\n");
    writeFileSync(join(dir, ".agents", "bbb.json"), "{}\n");
    const hook = join(dir, "rename-hook.mjs");
    writeFileSync(hook, `
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
let calls = 0;
export function rename(from, to) {
  calls += 1;
  if (calls === 1) return renameSync(from, to);
  const agents = dirname(from);
  mkdirSync(join(agents, "aaa"), { recursive: true });
  writeFileSync(join(agents, "aaa", "blocker.txt"), "x\\n");
  throw new Error("EBUSY: simulated");
}
`);
    const m = cli(["bootstrap", "move-residue", dir], dir, { ...process.env, OPEN_BRAIN_BOOTSTRAP_RENAME_HOOK: hook });
    expect(m.status).toBe(1);
    expect(m.out).not.toMatch(/refused/i);
    expect(m.out).toMatch(/aaa/);
    expect(m.out).toMatch(/pre-bootstrap-residue-/);
    expect(m.out).toMatch(/bbb\.json/);
    expect(m.out).toMatch(/stayed in \.agents/);
    const [folder] = readdirSync(join(dir, ".agents", "archive"));
    expect(existsSync(join(dir, ".agents", "archive", folder, "aaa", "one.txt"))).toBe(true);
    expect(existsSync(join(dir, ".agents", "bbb.json"))).toBe(true);
  });
});
