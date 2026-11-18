/**
 * T-353 (D-166, docs/loops/t353-brief.md): a NEW project gets `.agents/SYSTEM/greeting.json` from `bootstrap scaffold`,
 * with the eight default greeting options on; the template gitignore tracks it; and `/sync` (`greeting-flags`) warns, never
 * fails, where a bootstrapped project has no such file or git ignores it.
 *
 * Every repository here is a real one in a temp folder, and the ignore answers are git's own. Its own file because
 * the rows share one git helper, and t251-role-stubs.test.ts (the other scaffold file) mocks node:fs.
 */
import { describe, it, expect, afterEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scaffold, SCAFFOLD_FILES, templateText } from "../../src/pipelines/bootstrap/index.js";
import { runDraft, runCommit } from "../../src/pipelines/state-import/index.js";
import { checkGreetingFlags, gitCheckIgnore, syncPrdVersion, GREETING_FLAGS_MISSING, GREETING_FLAGS_IGNORED, type IgnoreAnswer } from "../../src/pipelines/sync/checks.js";
import { runSync } from "../../src/pipelines/sync/index.js";
import { readGreetingFlags, GREETING_FLAGS_REL } from "../../src/pipelines/session-start/greeting-flags.js";
import { readRepoRecord } from "../helpers/repo-record.js";

const templateDir = join(import.meta.dirname, "../../../project-template");
const REL = ".agents/SYSTEM/greeting.json";
const TODAY = "2026-11-18";

/** The ruling's default: eight keys, sorted, all true. */
const KEYS = [
  "briefing_budget",
  "greeting_metrics",
  "maybe_shipped",
  "merged_citations",
  "missing_handoff",
  "reads_owed_own",
  "role_docs_by_sha",
  "state_compact",
];
/** 2-space JSON with a trailing newline, written out so a change to the file is a change to this literal. */
const DEFAULT_BYTES =
  '{\n' +
  '  "briefing_budget": true,\n' +
  '  "greeting_metrics": true,\n' +
  '  "maybe_shipped": true,\n' +
  '  "merged_citations": true,\n' +
  '  "missing_handoff": true,\n' +
  '  "reads_owed_own": true,\n' +
  '  "role_docs_by_sha": true,\n' +
  '  "state_compact": true\n' +
  '}\n';

/** The template's SYSTEM block as it was before T-353: no exception for greeting.json. */
const OLD_BLOCK = "/.agents/*\n!/.agents/state.json\n!/.agents/SYSTEM/\n/.agents/SYSTEM/*\n!/.agents/SYSTEM/SUMMARY.md\n";
/** Left out of the default on purpose (the brief says why for each), so their absence is asserted. */
const LEFT_OUT = ["briefing_focus", "briefing_problem", "handoff_by_checkout", "handoff_caps"];
const EXCEPTION = "!/.agents/SYSTEM/greeting.json";

const WARN_MISSING =
  ".agents/SYSTEM/greeting.json is absent, so every greeting option is off: /start prints the legacy briefing and writes no greeting-metrics row. " +
  "To turn the default set on, create .agents/SYSTEM/greeting.json as a copy of the eight-key default in project-template/.agents/SYSTEM/greeting.json of the SIA install, and commit it";
const WARN_IGNORED =
  ".agents/SYSTEM/greeting.json exists but git ignores it, so it reaches this checkout only: " +
  "add the line !/.agents/SYSTEM/greeting.json to .gitignore, after /.agents/SYSTEM/*, and commit both";

const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  tmps.push(d);
  return d;
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** git's own answer: 0 ignored, 1 not ignored. */
function ignoreStatus(cwd: string, rel: string, noIndex = false): number | null {
  return spawnSync("git", ["check-ignore", "-q", ...(noIndex ? ["--no-index"] : []), "--", rel], { cwd }).status;
}

function initRepo(dir: string): void {
  git(dir, "init", "-q", "-b", "master");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "T");
}

function commitAll(dir: string, message: string): void {
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", message);
}

/** A project with one commit and no SIA files, as scaffold requires. */
function freshProject(): string {
  const dir = tmp("t353-fresh-");
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "scratch-proj", version: "0.1.0" }) + "\n");
  initRepo(dir);
  commitAll(dir, "the project before SIA");
  return dir;
}

/** A folder with a valid record (this repository's own, at the current schema) and nothing else of SIA's. */
function recordProject(opts: { git?: boolean; gitignore?: string } = {}): string {
  const dir = tmp("t353-record-");
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "scratch-proj", version: "0.1.0" }) + "\n");
  mkdirSync(join(dir, ".agents", "SYSTEM"), { recursive: true });
  writeFileSync(join(dir, ".agents", "state.json"), JSON.stringify(readRepoRecord().state, null, 2) + "\n");
  if (opts.gitignore !== undefined) writeFileSync(join(dir, ".gitignore"), opts.gitignore);
  if (opts.git !== false) initRepo(dir);
  return dir;
}

function writeFlags(dir: string, text: string): void {
  mkdirSync(join(dir, ".agents", "SYSTEM"), { recursive: true });
  writeFileSync(join(dir, REL), text);
}

const neverAsked = (): IgnoreAnswer => {
  throw new Error("git was asked, and this case must not ask it");
};

describe("T-353: bootstrap scaffold writes greeting.json for a new project", { timeout: 120_000 }, () => {
  it("T353-1: the template ships the eight default flags, all true, sorted, 2-space JSON with a trailing newline, and none of the four left out", () => {
    expect(GREETING_FLAGS_REL).toBe(REL);
    const text = templateText(join(templateDir, REL));
    expect(text).toBe(DEFAULT_BYTES);
    const data = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(data)).toEqual(KEYS);
    expect(Object.values(data)).toEqual(KEYS.map(() => true));
    for (const k of LEFT_OUT) expect(Object.keys(data), k).not.toContain(k);
    expect(SCAFFOLD_FILES.filter((f) => f.path === REL).map((f) => ({ path: f.path, from: f.from, tracked: f.tracked }))).toEqual([
      { path: REL, from: REL, tracked: true },
    ]);
  });

  it("T353-2: absent, it is written with exactly those bytes, reported as copied and tracked, and git's check agrees", () => {
    const dir = freshProject();
    expect(existsSync(join(dir, REL))).toBe(false);
    const r = scaffold(dir, templateDir);
    expect(readFileSync(join(dir, REL), "utf8")).toBe(DEFAULT_BYTES);
    expect(r.written.filter((w) => w.path === REL).map((w) => ({ path: w.path, tracked: w.tracked, action: w.action, from: w.from }))).toEqual([
      { path: REL, tracked: true, action: "copied", from: "project-template/.agents/SYSTEM/greeting.json" },
    ]);
    expect(r.skipped.map((s) => s.path)).not.toContain(REL);
    expect(r.verify).toEqual({ ok: true, problems: [] });
    expect(readGreetingFlags(dir)).toEqual(Object.fromEntries(KEYS.map((k) => [k, true])));
  });

  it("T353-3: in the scaffolded repository git does not ignore greeting.json, still ignores the rest of SYSTEM/, and commits it", () => {
    const dir = freshProject();
    scaffold(dir, templateDir);
    expect(readFileSync(join(dir, ".gitignore"), "utf8").split("\n")).toContain(EXCEPTION);
    expect(ignoreStatus(dir, REL)).toBe(1);
    expect(ignoreStatus(dir, REL, true)).toBe(1);
    expect(ignoreStatus(dir, ".agents/SYSTEM/SUMMARY.md", true)).toBe(1);
    // The exception is for the one file: the rest of SYSTEM/ stays local.
    expect(ignoreStatus(dir, ".agents/SYSTEM/PRD.md", true)).toBe(0);
    expect(ignoreStatus(dir, ".agents/SYSTEM/hub-partner-seats.json", true)).toBe(0);
    commitAll(dir, "SIA scaffold");
    expect(git(dir, "ls-files", "--", REL)).toBe(REL);
    expect(git(dir, "status", "--porcelain")).toBe("");
  });

  // A greeting.json in a project with no record makes `.agents/` RESIDUE, so scaffold refuses before it writes anything:
  // that refusal is how "never overwritten" holds for this file. Rows 4 and 5 pin the bytes across it.
  for (const [id, label, before] of [
    ["T353-4", "other content", '{\n  "briefing_budget": false,\n  "brief_dir": "docs/briefs"\n}\n'],
    ["T353-5a", "invalid JSON", "{ not json\n"],
    ["T353-5b", "an empty file", ""],
  ] as const) {
    it(`${id}: present with ${label}, it is byte-unchanged and scaffold writes nothing`, () => {
      const dir = freshProject();
      writeFlags(dir, before);
      commitAll(dir, "the owner's own greeting.json");
      expect(() => scaffold(dir, templateDir)).toThrow(/holds residue \(SYSTEM\/\).*Nothing written/);
      expect(readFileSync(join(dir, REL), "utf8")).toBe(before);
      expect(existsSync(join(dir, ".gitignore"))).toBe(false);
      expect(existsSync(join(dir, ".agents", "AGENT.md"))).toBe(false);
    });
  }

  it("T353-6: a project that is already bootstrapped: scaffold refuses, writes no greeting.json and leaves its .gitignore byte for byte", () => {
    const dir = recordProject({ gitignore: OLD_BLOCK });
    commitAll(dir, "bootstrapped before T-353");
    expect(() => scaffold(dir, templateDir)).toThrow(/already bootstrapped: \.agents\/state\.json exists\. Nothing written/);
    expect(existsSync(join(dir, REL))).toBe(false);
    expect(readFileSync(join(dir, ".gitignore"), "utf8")).toBe(OLD_BLOCK);
    expect(git(dir, "status", "--porcelain")).toBe("");
    // What tells that project: /sync's warning (a).
    expect(checkGreetingFlags(dir).message).toBe(WARN_MISSING);
  });
});

describe("T-353: /sync greeting-flags warns, never fails", { timeout: 120_000 }, () => {
  it("T353-7: (a) a valid record and no greeting.json is ONE warning, in a repository and outside one, and git is not asked", () => {
    expect(GREETING_FLAGS_MISSING).toBe(WARN_MISSING);
    const inRepo = recordProject();
    expect(checkGreetingFlags(inRepo)).toEqual({ name: "greeting-flags", severity: "warn", message: WARN_MISSING, report: true });
    const noRepo = recordProject({ git: false });
    expect(checkGreetingFlags(noRepo, neverAsked)).toEqual({ name: "greeting-flags", severity: "warn", message: WARN_MISSING, report: true });
  });

  it("T353-8: (b) the file exists and git ignores it is ONE warning naming the missing line; adding that line clears it", () => {
    expect(GREETING_FLAGS_IGNORED).toBe(WARN_IGNORED);
    const dir = recordProject({ gitignore: OLD_BLOCK });
    writeFlags(dir, DEFAULT_BYTES);
    expect(ignoreStatus(dir, REL)).toBe(0);
    expect(checkGreetingFlags(dir)).toEqual({ name: "greeting-flags", severity: "warn", message: WARN_IGNORED, report: true });
    writeFileSync(join(dir, ".gitignore"), `${OLD_BLOCK}${EXCEPTION}\n`);
    expect(ignoreStatus(dir, REL)).toBe(1);
    expect(checkGreetingFlags(dir)).toEqual({
      name: "greeting-flags",
      severity: "pass",
      message: ".agents/SYSTEM/greeting.json present and not ignored by git (8 flag(s) on)",
      report: true,
    });
  });

  it("T353-9: no warning for a file that is untracked and not ignored, or tracked (even under a pattern that would ignore it), or committed", () => {
    const pass = (on: number) => ({ name: "greeting-flags", severity: "pass", message: `.agents/SYSTEM/greeting.json present and not ignored by git (${on} flag(s) on)`, report: true });
    // (i) untracked, no ignore rule at all; the count is of flags that are true.
    const plain = recordProject();
    writeFlags(plain, '{\n  "briefing_budget": true,\n  "greeting_metrics": true,\n  "handoff_caps": false,\n  "brief_dir": "docs/briefs"\n}\n');
    expect(checkGreetingFlags(plain)).toEqual(pass(2));
    // (ii) tracked by `git add -f` while the old block still matches it: git does not ignore a tracked file.
    const forced = recordProject({ gitignore: OLD_BLOCK });
    writeFlags(forced, DEFAULT_BYTES);
    git(forced, "add", "-f", "--", REL);
    expect(ignoreStatus(forced, REL)).toBe(1);
    expect(ignoreStatus(forced, REL, true)).toBe(0);
    expect(checkGreetingFlags(forced)).toEqual(pass(8));
    // (iii) committed.
    git(forced, "add", "-A");
    git(forced, "commit", "-q", "-m", "greeting.json tracked");
    expect(checkGreetingFlags(forced)).toEqual(pass(8));
  });

  it("T353-10: no record, or one that does not validate, is a skip with the reason and judges nothing", () => {
    const none = tmp("t353-norecord-");
    writeFlags(none, DEFAULT_BYTES);
    expect(checkGreetingFlags(none, neverAsked)).toEqual({
      name: "greeting-flags",
      severity: "skip",
      message: "skipped: no .agents/state.json, so this project has no greeting to configure",
      report: true,
    });
    const invalid = tmp("t353-badrecord-");
    mkdirSync(join(invalid, ".agents"), { recursive: true });
    writeFileSync(join(invalid, ".agents", "state.json"), "{}\n");
    expect(checkGreetingFlags(invalid, neverAsked)).toEqual({
      name: "greeting-flags",
      severity: "skip",
      message: "skipped: .agents/state.json is not a valid record (see state-schema)",
      report: true,
    });
  });

  it("T353-11: outside a git repository the ignore question is a skip with git's reason, never a pass and never a warning", () => {
    const dir = recordProject({ git: false });
    writeFlags(dir, DEFAULT_BYTES);
    const fake = checkGreetingFlags(dir, () => ({ kind: "unknown", why: "fatal: not a git repository" }));
    expect(fake).toEqual({
      name: "greeting-flags",
      severity: "skip",
      message: "skipped: .agents/SYSTEM/greeting.json present (8 flag(s) on); whether git ignores it: unknown (git check-ignore failed: fatal: not a git repository)",
      report: true,
    });
    // And with git itself.
    const answer = gitCheckIgnore(dir, REL);
    expect(answer.kind).toBe("unknown");
    expect(answer.kind === "unknown" ? answer.why : "").toMatch(/not a git repository/);
    const real = checkGreetingFlags(dir);
    expect(real.severity).toBe("skip");
    expect(real.message).toMatch(/^skipped: \.agents\/SYSTEM\/greeting\.json present \(8 flag\(s\) on\); whether git ignores it: unknown \(git check-ignore failed: .*not a git repository/);
  });

  it("T353-12: runSync runs greeting-flags once, after task-assignees, and its warning is among the warnings, not the issues", () => {
    // Not a repository, as greeting-size.test.ts runs runSync: the warning needs no git, and no check here waits on one.
    const dir = recordProject({ git: false });
    const result = runSync({ projectRoot: dir, checkOnly: true, score: false, scoreJson: false, history: false });
    const names = result.checks.map((c) => c.name);
    expect(names.filter((n) => n === "greeting-flags")).toHaveLength(1);
    expect(names.indexOf("greeting-flags")).toBe(names.indexOf("task-assignees") + 1);
    expect(result.warnings.filter((c) => c.name === "greeting-flags").map((c) => c.message)).toEqual([WARN_MISSING]);
    expect(result.issues.map((c) => c.name)).not.toContain("greeting-flags");
  });

  it("T353-13: a project scaffolded and imported end to end passes, before and after its first SIA commit", () => {
    const dir = freshProject();
    scaffold(dir, templateDir);
    runDraft(dir, TODAY);
    runCommit(dir, TODAY);
    const pass = { name: "greeting-flags", severity: "pass", message: ".agents/SYSTEM/greeting.json present and not ignored by git (8 flag(s) on)", report: true };
    expect(checkGreetingFlags(dir)).toEqual(pass);
    commitAll(dir, "SIA bootstrap");
    expect(git(dir, "ls-files", "--", REL)).toBe(REL);
    expect(checkGreetingFlags(dir)).toEqual(pass);
  });
});

describe("T-353: the default set gives a fresh install no new /sync issue", { timeout: 120_000 }, () => {
  it("T353-14: a scaffolded project has no PRD and prd-version is still the warning; briefing_problem in the file would make it an issue", () => {
    const dir = freshProject();
    scaffold(dir, templateDir);
    expect(existsSync(join(dir, ".agents", "SYSTEM", "PRD.md"))).toBe(false);
    expect(readGreetingFlags(dir).briefing_problem).toBeUndefined();
    expect(syncPrdVersion("0.1.0", dir, true)).toEqual({ name: "prd-version", severity: "warn", message: "PRD.md not found" });
    // Known positive: the same project with the flag on is the issue the default avoids.
    writeFileSync(join(dir, REL), DEFAULT_BYTES.replace('  "greeting_metrics": true,\n', '  "briefing_problem": true,\n  "greeting_metrics": true,\n'));
    expect(readGreetingFlags(dir).briefing_problem).toBe(true);
    expect(syncPrdVersion("0.1.0", dir, true).severity).toBe("issue");
  });
});
