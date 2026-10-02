// QA 253, own T-210 fixtures. Copied into open-brain/tests/pipelines/session-start/ of the tree under test.
// Fixture repos live under ~/qa-scratch/qa253-fix, never the system tmp.
import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { handleStart } from "../../../src/server.js";
import { describeLatestBrief } from "../../../src/pipelines/session-start/latest-brief.js";

const FIX = join(homedir(), "qa-scratch", "qa253-fix");
mkdirSync(FIX, { recursive: true });
const made: string[] = [];
afterAll(() => { for (const d of made) rmSync(d, { recursive: true, force: true }); });

function git(root: string, args: string[], date?: string): void {
  // Only the COMMITTER date is set: the code reads %cI, and the author date is left at "now"
  // so a mutant reading %aI would be visible too.
  const env = { ...process.env, ...(date ? { GIT_COMMITTER_DATE: date } : {}) };
  execFileSync("git", ["-c", "user.name=q", "-c", "user.email=q@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: root, env, stdio: "ignore" });
}
function repo(): string {
  const root = mkdtempSync(join(FIX, "r-"));
  made.push(root);
  git(root, ["init", "-q"]);
  mkdirSync(join(root, "docs", "loops"), { recursive: true });
  return root;
}
function commit(root: string, file: string, date: string): void {
  writeFileSync(join(root, "docs", "loops", file), `${file} ${date}\n`);
  git(root, ["add", "-A"]);
  git(root, ["commit", "-q", "-m", `add ${file}`], date);
}

describe("QA253 T-210", () => {
  it("Q253-5a: loop-16-brief.md earlier, t201-brief.md later -> t201 wins", () => {
    const root = repo();
    commit(root, "loop-16-brief.md", "2026-09-10T12:00:00+00:00");
    commit(root, "t201-brief.md", "2026-09-20T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBe("Latest brief: docs/loops/t201-brief.md (2026-09-20)");
  });

  it("Q253-5a2: path order disagrees with date order (z-brief older than a-brief)", () => {
    const root = repo();
    commit(root, "z-brief.md", "2026-08-01T12:00:00+00:00");
    commit(root, "a-brief.md", "2026-09-01T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBe("Latest brief: docs/loops/a-brief.md (2026-09-01)");
  });

  it("Q253-5a3: commit order disagrees with date order (newer date committed first)", () => {
    const root = repo();
    commit(root, "b-brief.md", "2026-09-25T12:00:00+00:00");
    commit(root, "c-brief.md", "2026-09-05T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBe("Latest brief: docs/loops/b-brief.md (2026-09-25)");
  });

  it("Q253-5b: an old brief touched to now does not win", () => {
    const root = repo();
    commit(root, "old-brief.md", "2026-07-01T12:00:00+00:00");
    commit(root, "mid-brief.md", "2026-09-01T12:00:00+00:00");
    const now = new Date();
    utimesSync(join(root, "docs", "loops", "old-brief.md"), now, now);
    expect(describeLatestBrief(root)).toBe("Latest brief: docs/loops/mid-brief.md (2026-09-01)");
  });

  it("Q253-5c: no *brief*.md under docs/loops -> null, and ob_start has no Latest brief line", async () => {
    const root = repo();
    commit(root, "loop-1-qa-report.md", "2026-09-01T12:00:00+00:00");
    writeFileSync(join(root, "notes-brief.txt"), "not under docs/loops\n");
    expect(describeLatestBrief(root)).toBeNull();
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
    for (const d of ["SYSTEM", "TASKS", "SESSIONS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
    const text = (await handleStart({ project_root: root })).content[0]!.text;
    expect(text).not.toMatch(/Latest brief/);
    expect(text).not.toMatch(/brief: *(none)?\s*$/m);
  });

  it("Q253-5d: a brief deleted at HEAD is not named", () => {
    const root = repo();
    commit(root, "kept-brief.md", "2026-09-01T12:00:00+00:00");
    commit(root, "deleted-brief.md", "2026-09-28T12:00:00+00:00");
    git(root, ["rm", "-q", "docs/loops/deleted-brief.md"]);
    git(root, ["commit", "-q", "-m", "rm"], "2026-09-29T12:00:00+00:00");
    const out = describeLatestBrief(root);
    expect(out).toBe("Latest brief: docs/loops/kept-brief.md (2026-09-01)");
  });

  it("Q253-5e: briefing-notes.md and debrief.md ARE taken by the *brief* match (observation)", () => {
    const root = repo();
    commit(root, "real-brief.md", "2026-09-01T12:00:00+00:00");
    commit(root, "debrief.md", "2026-09-10T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBe("Latest brief: docs/loops/debrief.md (2026-09-10)");
    commit(root, "briefing-notes.md", "2026-09-20T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBe("Latest brief: docs/loops/briefing-notes.md (2026-09-20)");
  });

  it("Q253-5f1: not a git repo -> not determined (git: ...)", () => {
    const root = mkdtempSync(join(FIX, "nogit-"));
    made.push(root);
    mkdirSync(join(root, "docs", "loops"), { recursive: true });
    writeFileSync(join(root, "docs", "loops", "x-brief.md"), "x");
    // GIT_CEILING_DIRECTORIES keeps git from finding an enclosing repo above the fixture.
    const saved = process.env.GIT_CEILING_DIRECTORIES;
    process.env.GIT_CEILING_DIRECTORIES = FIX;
    try {
      const out = describeLatestBrief(root);
      expect(out).toMatch(/^Latest brief: not determined \(git: .+\)$/);
      console.log(`Q253-5f1: ${out}`);
    } finally {
      if (saved === undefined) delete process.env.GIT_CEILING_DIRECTORIES; else process.env.GIT_CEILING_DIRECTORIES = saved;
    }
  });

  it("Q253-5f2: git missing from PATH -> not determined (git: ...)", () => {
    const root = repo();
    commit(root, "a-brief.md", "2026-09-01T12:00:00+00:00");
    const saved = process.env.PATH;
    process.env.PATH = join(FIX, "empty-path");
    try {
      const out = describeLatestBrief(root);
      expect(out).toMatch(/^Latest brief: not determined \(git: .+\)$/);
      console.log(`Q253-5f2: ${out}`);
    } finally {
      process.env.PATH = saved;
    }
  });
});
