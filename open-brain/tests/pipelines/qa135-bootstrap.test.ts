/**
 * QA 135 (record session 135): the /bootstrap fix at 6543e8e, probed as a stranger would meet it.
 * Each `it` states what a stranger following bootstrap.md needs to be true. Those marked DEFECT are
 * expected RED on the candidate; they are evidence for the QA report
 * (docs/loops/bootstrap-fix-qa-report.md), not a proposed fix. The CONTROL rows must be green.
 */
import { describe, it, expect, afterEach } from "vitest";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const cliEntry = join(import.meta.dirname, "../../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const T = 120_000;

function cli(args: string[], cwd: string) {
  const r = spawnSync(process.execPath, [tsxCli, cliEntry, ...args], { cwd, encoding: "utf8", env: process.env });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}
function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
const tmps: string[] = [];
afterEach(() => { for (const t of tmps.splice(0)) rmSync(t, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });
function tmp(): string { const d = mkdtempSync(join(tmpdir(), "qa135-")); tmps.push(d); return d; }
function repo(dir: string, files: Record<string, string>): void {
  for (const [p, c] of Object.entries(files)) { mkdirSync(join(dir, p, ".."), { recursive: true }); writeFileSync(join(dir, p), c); }
  git(dir, "init", "-q", "-b", "master");
  git(dir, "config", "user.email", "qa@example.invalid");
  git(dir, "config", "user.name", "QA135");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "--allow-empty", "-m", "the project before SIA");
}

describe("QA 135: a project with no package.json", { timeout: T }, () => {
  it("CONTROL: with a package.json, scaffold then state import --draft drafts THIS project", () => {
    const dir = tmp();
    repo(dir, { "package.json": '{"name":"q","version":"1.0.0"}\n', "main.py": "print(1)\n" });
    expect(cli(["bootstrap", "scaffold", dir], dir).status).toBe(0);
    const d = cli(["state", "import", "--draft"], dir);
    expect(d.status).toBe(0);
    expect(d.out).toContain(`Root: ${dir}`);
  });

  it("DEFECT D1: a scaffolded project with no package.json (Python, Go, an empty folder) can draft its record", () => {
    const dir = tmp();
    repo(dir, { "main.py": "print(1)\n" });
    expect(cli(["bootstrap", "scaffold", dir], dir).status).toBe(0);
    const d = cli(["state", "import", "--draft"], dir);
    expect(d.out).not.toMatch(/no project root found/);
    expect(d.status).toBe(0);
  });

  it("DEFECT D2: step 6 run in a scaffolded child with no package.json never drafts a PARENT project", () => {
    const parent = tmp();
    mkdirSync(join(parent, ".agents", "SYSTEM"), { recursive: true });
    mkdirSync(join(parent, ".agents", "TASKS"), { recursive: true });
    writeFileSync(join(parent, "package.json"), '{"name":"parent","version":"9.9.9"}\n');
    writeFileSync(join(parent, ".agents", "TASKS", "INBOX.md"), "# Inbox\n\n## P1\n\n- [ ] PARENT TASK\n");
    const child = join(parent, "child");
    mkdirSync(child);
    repo(child, { "main.py": "print(1)\n" });
    expect(cli(["bootstrap", "scaffold", child], child).status).toBe(0);
    cli(["state", "import", "--draft"], child);
    expect(readdirSync(join(parent, ".agents")).sort()).toEqual(["SYSTEM", "TASKS"]);
  });
});

describe("QA 135: check's classification", { timeout: T }, () => {
  it("DEFECT D3: check right after scaffold does not say this is 'not a fresh install' (step 1's table would skip steps 4 and 5)", () => {
    const dir = tmp();
    repo(dir, { "package.json": '{"name":"q","version":"1.0.0"}\n' });
    expect(cli(["bootstrap", "scaffold", dir], dir).status).toBe(0);
    const c = cli(["bootstrap", "check", dir], dir);
    expect(c.status).toBe(0);
    expect(c.out).not.toMatch(/not a fresh install/);
    expect(c.out).not.toMatch(/PRE-STATE/);
  });

  it("DEFECT D4: a zero-byte state.json is not reported BOOTSTRAPPED (a record that cannot be read is not a record)", () => {
    const dir = tmp();
    repo(dir, { "package.json": '{"name":"q","version":"1.0.0"}\n' });
    mkdirSync(join(dir, ".agents"));
    writeFileSync(join(dir, ".agents", "state.json"), "");
    const c = cli(["bootstrap", "check", dir], dir);
    expect(c.out).not.toMatch(/BOOTSTRAPPED/);
  });

  it("CONTROL: a valid record alone is BOOTSTRAPPED (the brief's rule)", () => {
    const dir = tmp();
    repo(dir, { "package.json": '{"name":"q","version":"1.0.0"}\n' });
    mkdirSync(join(dir, ".agents"));
    writeFileSync(join(dir, ".agents", "state.json"), JSON.stringify({ schema_version: 3, revision: 0, project: { name: "q" }, objective: null, tasks: [], verified: [], gaps: [], decisions: [], handoffs: [], sessions: [] }));
    expect(cli(["bootstrap", "check", dir], dir).out).toMatch(/BOOTSTRAPPED/);
  });
});

describe("QA 135: move-residue a second time on the same day", { timeout: T }, () => {
  it("DEFECT D5: a move-residue that exits non-zero has moved nothing (or it exits 0 and nests nothing)", () => {
    const dir = tmp();
    repo(dir, { "package.json": '{"name":"q","version":"1.0.0"}\n' });
    mkdirSync(join(dir, ".agents"));
    writeFileSync(join(dir, ".agents", "a.json"), "one\n");
    expect(cli(["bootstrap", "move-residue", dir], dir).status).toBe(0);
    writeFileSync(join(dir, ".agents", "b.json"), "two\n");
    const m = cli(["bootstrap", "move-residue", dir], dir);
    if (m.status !== 0) expect(existsSync(join(dir, ".agents", "b.json"))).toBe(true);
    else expect(readdirSync(join(dir, ".agents", "archive")).every((n) => !existsSync(join(dir, ".agents", "archive", n, "archive")))).toBe(true);
  });
});
