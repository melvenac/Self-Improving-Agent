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

// T-277: a repository with NO docs/loops directory, and a commit helper that takes a repo-relative path.
function bareRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "latest-brief-"));
  made.push(root);
  git(root, ["init", "-q"]);
  return root;
}

function commitAt(root: string, rel: string, date: string, body = "x"): void {
  const parts = rel.split("/");
  mkdirSync(join(root, ...parts.slice(0, -1)), { recursive: true });
  writeFileSync(join(root, ...parts), `${body}\n${date}\n`);
  git(root, ["add", "-A"]);
  git(root, ["commit", "-q", "-m", `add ${rel}`], date);
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

  // T-233 C: the name must END in brief / rebrief, or an -amendment-N of either.
  it.each([
    "loop-9-brief.md",
    "loop-15-slice-3-grok-brief.md",
    "t201-spec-brief.md",
    "loop-16-rebrief-amendment-2.md",
    "loop-16-brief-amendment-3.md",
    "brief.md",
  ])("T233-C kept: %s is a brief", (name) => {
    const root = repo();
    commit(root, "loop-1-brief.md", "2026-09-01T12:00:00+00:00");
    commit(root, name, "2026-09-20T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBe(`Latest brief: docs/loops/${name} (2026-09-20)`);
  });

  it.each([
    "loop-15-slice-4-brief-draft.md",
    "research-brief-jev-mcp.md",
    "t201-brief-response-developer-handoff.md",
    "loop-9-brief-2.md",
    "loop-9-brief.json",
    "loop-9-brief-amendment-x.md",
    "followups-briefs.md",
    "notabrief.md",
    "loop-9-brief.md.orig", // QA 263 F5: the name must END at .md; an unanchored end would take a backup copy
  ])("T233-C excluded: %s is not a brief, even when newer than one", (name) => {
    const root = repo();
    commit(root, "loop-1-brief.md", "2026-09-01T12:00:00+00:00");
    commit(root, name, "2026-09-20T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBe("Latest brief: docs/loops/loop-1-brief.md (2026-09-01)");
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

describe("describeLatestBrief — T-277 briefs at the docs root (docs/loop-*-brief.md)", () => {
  it("T277-1: a project with briefs only at the docs root gets a line", () => {
    const root = bareRepo();
    commitAt(root, "docs/loop-2-brief.md", "2026-10-01T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBe("Latest brief: docs/loop-2-brief.md (2026-10-01)");
  });

  it("T277-2a: both places, the docs-root brief is newer, and it wins", () => {
    const root = bareRepo();
    commitAt(root, "docs/loops/t1-brief.md", "2026-09-01T12:00:00+00:00");
    commitAt(root, "docs/loop-2-brief.md", "2026-10-01T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBe("Latest brief: docs/loop-2-brief.md (2026-10-01)");
  });

  it("T277-2b: both places, the docs/loops brief is newer, and it wins", () => {
    const root = bareRepo();
    commitAt(root, "docs/loop-2-brief.md", "2026-09-01T12:00:00+00:00");
    commitAt(root, "docs/loops/t9-brief.md", "2026-10-05T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBe("Latest brief: docs/loops/t9-brief.md (2026-10-05)");
  });

  it.each([
    "loop-3-brief.md",
    "loop-3-rebrief.md",
    "loop-14-brief-amendment-3.md",
    "loop-16-rebrief-amendment-2.md",
    "loop-17a-brief.md",
  ])("T277-3 kept: docs/%s is a brief", (name) => {
    const root = bareRepo();
    commitAt(root, "docs/loop-1-brief.md", "2026-09-01T12:00:00+00:00");
    commitAt(root, `docs/${name}`, "2026-09-20T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBe(`Latest brief: docs/${name} (2026-09-20)`);
  });

  it.each([
    "loop-12-brief-part-b.md",
    "loop-1-amendment-1.md",
    "loop-9-addendum-2.md",
    "design-brief.md", // only the loop- prefix counts at the docs root
    "brief.md",
    "loop-9-brief.md.orig",
    "sub/loop-3-brief.md", // a subdirectory of docs/ other than docs/loops is not the docs root
  ])("T277-4 excluded: docs/%s is not a brief, even when newer than one", (name) => {
    const root = bareRepo();
    commitAt(root, "docs/loop-1-brief.md", "2026-09-01T12:00:00+00:00");
    commitAt(root, `docs/${name}`, "2026-09-20T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBe("Latest brief: docs/loop-1-brief.md (2026-09-01)");
  });

  it("T277-5a: a docs folder with no brief in either place is omitted", () => {
    const root = bareRepo();
    commitAt(root, "docs/README.md", "2026-09-01T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBeNull();
  });

  it("T277-5b: a docs folder with no brief is omitted even outside a git repository", () => {
    const root = mkdtempSync(join(tmpdir(), "latest-brief-"));
    made.push(root);
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(join(root, "docs", "README.md"), "x");
    expect(describeLatestBrief(root)).toBeNull();
  });

  it("T277-5c: a docs-root brief outside a git repository says not determined, as docs/loops does (T210-6)", () => {
    const root = mkdtempSync(join(tmpdir(), "latest-brief-"));
    made.push(root);
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(join(root, "docs", "loop-1-brief.md"), "x");
    expect(describeLatestBrief(root)).toMatch(/^Latest brief: not determined \(/);
  });

  it("T277-6: ob_start prints the docs-root brief", async () => {
    const NL = "\n";
    const root = bareRepo();
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
    for (const d of ["SYSTEM", "TASKS", "SESSIONS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
    writeFileSync(join(root, ".agents", "SYSTEM", "SUMMARY.md"), `# Summary${NL}`);
    writeFileSync(join(root, ".agents", "TASKS", "INBOX.md"), `# Inbox${NL}`);
    writeFileSync(join(root, ".agents", "TASKS", "task.md"), `# Task${NL}`);
    writeFileSync(join(root, ".agents", "SESSIONS", "next-session.md"), `# Handoff${NL}`);
    commitAt(root, "docs/loop-3-brief.md", "2026-09-02T12:00:00+00:00");
    const lines = (await handleStart({ project_root: root })).content[0]!.text.split(NL);
    expect(lines.filter((l) => l.startsWith("Latest brief:"))).toEqual(["Latest brief: docs/loop-3-brief.md (2026-09-02)"]);
  });
});
