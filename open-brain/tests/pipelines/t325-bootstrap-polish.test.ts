import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, cpSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { spawnAsync } from "../spawn-async.js";
import { resolveRecordSource } from "../../src/pipelines/session-start/record-source.js";

// T-325: bootstrap polish from the T-241 frogger re-run (docs/loops/t241-frogger-rerun-report.md).
const fixture = join(import.meta.dirname, "../fixtures-import");
const cliEntry = join(import.meta.dirname, "../../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const TIMEOUT = 180_000;

async function draft(root: string): Promise<{ status: number | null; stdout: string }> {
  const r = await spawnAsync(process.execPath, [tsxCli, cliEntry, "state", "import", "--draft", root], { cwd: root, env: process.env });
  if (r.error) throw r.error;
  return { status: r.status, stdout: r.stdout };
}

describe("T-325 draft summary says where the name came from and what its counts mean", { timeout: TIMEOUT }, () => {
  let withLog: string;
  let noLog: string;
  let a: { status: number | null; stdout: string };
  let b: { status: number | null; stdout: string };
  beforeAll(async () => {
    withLog = mkdtempSync(join(tmpdir(), "t325-a-"));
    cpSync(fixture, withLog, { recursive: true });
    noLog = mkdtempSync(join(tmpdir(), "t325-b-"));
    cpSync(fixture, noLog, { recursive: true });
    rmSync(join(noLog, ".agents", "SESSIONS", "Session_54.md"));
    a = await draft(withLog);
    b = await draft(noLog);
  }, TIMEOUT);
  afterAll(() => {
    for (const d of [withLog, noLog]) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("P1 (F11): a package.json name says so on the Project line", () => {
    expect(a.status).toBe(0);
    expect(a.stdout.split(/\r?\n/).find((l) => l.startsWith("Project:"))).toBe("Project: self-improving-agent (from package.json)");
  });

  it("P2 (N3): unparsed INBOX lines get a one-line explanation", () => {
    expect(a.stdout).toMatch(/unparsed lines [1-9]/);
    expect(a.stdout).toContain("Unparsed lines are INBOX text that is not a task (a legend, a heading note, how-to text); the report lists each one.");
  });

  it("P3 (N3): with no Session_N.md, 'could not tell' is called expected; with a log it is not", () => {
    expect(b.status).toBe(0);
    expect(b.stdout).toMatch(/[1-9] could not tell/);
    expect(b.stdout).toContain('"could not tell" is expected here: there is no SESSIONS/Session_N.md to compare the inputs against.');
    expect(a.stdout).not.toContain('"could not tell" is expected here');
  });
});

describe("T-325 record source with no upstream ref (N5)", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "t325-rs-"));
    const git = (...args: string[]) => execFileSync("git", ["-c", "user.email=t325@example.invalid", "-c", "user.name=T325", ...args], { cwd: dir, stdio: "pipe" });
    git("init", "-q", "-b", "master");
    writeFileSync(join(dir, "a.txt"), "a\n");
    git("add", "a.txt");
    git("commit", "-q", "-m", "a");
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

  it("P4: a missing ref is reported as not existing, not as unreadable", () => {
    const rs = resolveRecordSource(dir);
    expect(rs.kind).toBe("local");
    expect(rs.line).toContain("does not exist in this checkout (no remote, or nothing fetched)");
    expect(rs.line).not.toContain("unreadable");
  });
});
