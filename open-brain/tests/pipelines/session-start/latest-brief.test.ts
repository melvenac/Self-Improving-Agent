import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleStart } from "../../../src/server.js";
import { describeLatestBrief } from "../../../src/pipelines/session-start/latest-brief.js";

/**
 * T-210. /start used to say "the largest loop number in docs/loops", which no longer fits task-named
 * briefs (t201-brief.md, qa-233-*): session 153 picked loop-16-qa-report-4.md from 2026-09-20. ob_start
 * names the newest brief itself, by GIT commit date. These fixtures are real repositories whose commit
 * dates are set explicitly, so the date, not the order of creation, decides.
 */

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

function git(root: string, args: string[], date?: string): void {
  const env = { ...process.env, ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}) };
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: root, env, stdio: "ignore" });
}

function repo(): string {
  const root = mkdtempSync(join(tmpdir(), "latest-brief-"));
  made.push(root);
  git(root, ["init", "-q"]);
  mkdirSync(join(root, "docs", "loops"), { recursive: true });
  return root;
}

function commit(root: string, file: string, date: string, body = "x"): void {
  writeFileSync(join(root, "docs", "loops", file), `${body}\n${date}\n`);
  git(root, ["add", "-A"]);
  git(root, ["commit", "-q", "-m", `add ${file}`], date);
}

describe("describeLatestBrief — T-210", () => {
  it("T210-1: the higher loop number is OLDER, so the newer commit date wins", () => {
    const root = repo();
    commit(root, "loop-9-brief.md", "2026-09-30T12:00:00+00:00");
    commit(root, "loop-10-brief.md", "2026-09-01T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBe("Latest brief: docs/loops/loop-9-brief.md (2026-09-30)");
  });

  it("T210-1b: a task-named brief counts, and a report that is not a brief does not", () => {
    const root = repo();
    commit(root, "loop-16-brief.md", "2026-09-10T12:00:00+00:00");
    commit(root, "t201-brief.md", "2026-09-20T12:00:00+00:00");
    commit(root, "loop-16-qa-report-4.md", "2026-09-29T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBe("Latest brief: docs/loops/t201-brief.md (2026-09-20)");
  });

  it("T210-2: with no brief the line is omitted (null), not left blank", () => {
    const root = repo();
    commit(root, "loop-16-qa-report-4.md", "2026-09-29T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBeNull();
  });

  it("T210-2b: no docs/loops at all is also omitted", () => {
    const root = mkdtempSync(join(tmpdir(), "latest-brief-"));
    made.push(root);
    git(root, ["init", "-q"]);
    writeFileSync(join(root, "a.txt"), "a");
    git(root, ["add", "-A"]);
    git(root, ["commit", "-q", "-m", "a"]);
    expect(describeLatestBrief(root)).toBeNull();
  });

  it("T210-3: the date is git's, not the file's mtime — a touched OLD brief does not win", () => {
    const root = repo();
    commit(root, "old-brief.md", "2026-08-01T12:00:00+00:00");
    commit(root, "new-brief.md", "2026-09-15T12:00:00+00:00");
    const future = new Date("2027-01-01T00:00:00Z");
    utimesSync(join(root, "docs", "loops", "old-brief.md"), future, future);
    writeFileSync(join(root, "docs", "loops", "old-brief.md"), "edited but uncommitted\n");
    expect(describeLatestBrief(root)).toBe("Latest brief: docs/loops/new-brief.md (2026-09-15)");
  });

  it("T210-4: a brief re-committed later takes its LATEST commit date", () => {
    const root = repo();
    commit(root, "a-brief.md", "2026-09-01T12:00:00+00:00");
    commit(root, "b-brief.md", "2026-09-10T12:00:00+00:00");
    commit(root, "a-brief.md", "2026-09-25T12:00:00+00:00", "amended");
    expect(describeLatestBrief(root)).toBe("Latest brief: docs/loops/a-brief.md (2026-09-25)");
  });

  it("T210-5: a brief deleted from HEAD is not offered", () => {
    const root = repo();
    commit(root, "kept-brief.md", "2026-09-01T12:00:00+00:00");
    commit(root, "gone-brief.md", "2026-09-20T12:00:00+00:00");
    git(root, ["rm", "-q", "docs/loops/gone-brief.md"]);
    git(root, ["commit", "-q", "-m", "rm"], "2026-09-21T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBe("Latest brief: docs/loops/kept-brief.md (2026-09-01)");
  });

  it("T210-6: a directory that is not a git repository says so, rather than claiming there is no brief", () => {
    const root = mkdtempSync(join(tmpdir(), "latest-brief-"));
    made.push(root);
    mkdirSync(join(root, "docs", "loops"), { recursive: true });
    writeFileSync(join(root, "docs", "loops", "x-brief.md"), "x");
    const out = describeLatestBrief(root);
    expect(out).toMatch(/^Latest brief: not determined \(/);
  });

  it("T210-2c: no docs/loops directory is omitted even outside a git repository", () => {
    const root = mkdtempSync(join(tmpdir(), "latest-brief-"));
    made.push(root);
    expect(describeLatestBrief(root)).toBeNull();
  });

  it("T210-7: ob_start prints the line after the drift line, and omits it when there is no brief", async () => {
    const NL = "\n";
    const project = (withBrief: boolean): string => {
      const root = repo();
      writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
      for (const d of ["SYSTEM", "TASKS", "SESSIONS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
      writeFileSync(join(root, ".agents", "SYSTEM", "SUMMARY.md"), `# Summary${NL}`);
      writeFileSync(join(root, ".agents", "TASKS", "INBOX.md"), `# Inbox${NL}`);
      writeFileSync(join(root, ".agents", "TASKS", "task.md"), `# Task${NL}`);
      writeFileSync(join(root, ".agents", "SESSIONS", "next-session.md"), `# Handoff${NL}`);
      if (withBrief) commit(root, "loop-3-brief.md", "2026-09-02T12:00:00+00:00");
      else commit(root, "loop-3-qa-report.md", "2026-09-02T12:00:00+00:00");
      return root;
    };
    const withBrief = (await handleStart({ project_root: project(true) })).content[0]!.text.split(NL);
    const i = withBrief.indexOf("Latest brief: docs/loops/loop-3-brief.md (2026-09-02)");
    expect(i).toBeGreaterThan(withBrief.findIndex((l) => l.startsWith("Drift")));
    expect(withBrief.filter((l) => l.startsWith("Latest brief:"))).toHaveLength(1);
    const without = (await handleStart({ project_root: project(false) })).content[0]!.text;
    expect(without).not.toContain("Latest brief");
  });
});
