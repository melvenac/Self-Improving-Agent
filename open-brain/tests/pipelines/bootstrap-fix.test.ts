/**
 * `/bootstrap` produces a working SIA project (docs/loops/bootstrap-fix-brief.md,
 * rows BF-1 to BF-8; the acceptance list is frogger's pilot report,
 * docs/loops/t181-frogger-pilot-report.md, F1-F15).
 *
 * Written before the fixes and run red against the T-179 merge candidate
 * (3c0bfdc) on loop/bootstrap-fix-redcheck. It uses only what that build
 * exports: the new `bootstrap` subcommand is reached through the CLI, so its
 * absence is an assertion failure (exit status, output), not an import error
 * that would take the whole file down. Every fixture is bytes or a real git
 * repository, so it runs the same on tcm (Linux) as on Windows.
 */
import { describe, it, expect, afterEach } from "vitest";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runDraft, STATE_REL } from "../../src/pipelines/state-import/index.js";
import { describeRoleFiles } from "../../src/pipelines/session-start/role-files.js";
import { handleStart } from "../../src/server.js";

const cliEntry = join(import.meta.dirname, "../../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const templateDir = join(import.meta.dirname, "../../../project-template");
const TODAY = "2026-09-26";
const E2E_TIMEOUT = 120_000;

/** Both channels and the real exit status. */
function cli(args: string[], cwd: string): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [tsxCli, cliEntry, ...args], { cwd, encoding: "utf8", env: process.env });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** A throwaway project as the brief's acceptance describes it: package.json, an existing CLAUDE.md, git with one commit. */
function scratchProject(tmps: string[], opts: { git?: boolean; residue?: boolean } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "bf-scratch-"));
  tmps.push(dir);
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "scratch-proj", version: "0.1.0" }, null, 2) + "\n");
  writeFileSync(join(dir, "CLAUDE.md"), "# Scratch\n\nThe owner's own instructions.\n");
  writeFileSync(join(dir, "index.js"), "console.log('hi');\n");
  if (opts.residue) {
    mkdirSync(join(dir, ".agents"));
    writeFileSync(join(dir, ".agents", "reflection-queue.json"), '{"queue":[1,2,3]}\n');
  }
  if (opts.git !== false) {
    git(dir, "init", "-q", "-b", "master");
    git(dir, "config", "user.email", "t@example.com");
    git(dir, "config", "user.name", "T");
    // The frogger condition (F10): Windows' default, set explicitly so tcm (Linux) sees it too.
    git(dir, "config", "core.autocrlf", "true");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "the project before SIA");
  }
  return dir;
}

/** What the CLI needs to find a project root: package.json beside .agents/SYSTEM/. */
function cliFixture(dir: string): void {
  git(dir, "init", "-q");
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "fixture", version: "0.0.1" }) + "\n");
  mkdirSync(join(dir, ".agents", "TASKS"), { recursive: true });
  mkdirSync(join(dir, ".agents", "SYSTEM"), { recursive: true });
}

function getText(response: { content: { type: string; text: string }[] }): string {
  return response.content.map((c) => c.text).join("\n");
}

const tmps: string[] = [];
afterEach(() => { for (const t of tmps.splice(0)) rmSync(t, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });

// ---------------------------------------------------------------------------
// BF-1 (F1): the INBOX bootstrap ships is one the importer reads, and 0 tasks is loud
// ---------------------------------------------------------------------------

describe("BF-1: the scaffolded INBOX imports, and an INBOX that yields 0 tasks says so", { timeout: E2E_TIMEOUT }, () => {
  it("the template's own INBOX.md imports every item in it (its headings carry an emoji before P0..P3)", () => {
    const dir = mkdtempSync(join(tmpdir(), "bf1-"));
    tmps.push(dir);
    mkdirSync(join(dir, ".agents", "TASKS"), { recursive: true });
    const inbox = readFileSync(join(templateDir, ".agents", "TASKS", "INBOX.md"), "utf8");
    writeFileSync(join(dir, ".agents", "TASKS", "INBOX.md"), inbox);
    const expected = inbox.split(/\r?\n/).filter((l) => /^- \[( |~|!|x|X)\] /.test(l)).length;
    expect(expected).toBeGreaterThan(0); // the fixture has items to find — a known positive

    const r = runDraft(dir, TODAY);
    expect(r.validation.ok).toBe(true);
    expect(r.draft.report.inbox.items).toBe(expected);
    // No ITEM was dropped for want of a priority. (A heading like "How to Use This Document",
    // which holds no items, is reported as unparsed and loses nothing.)
    expect(r.draft.report.inbox.unparsed.filter((u) => /^item under/.test(u.reason))).toEqual([]);
  });

  it("an INBOX with items but no P-section: the draft summary and the report both carry a WARNING naming 0 tasks", () => {
    const dir = mkdtempSync(join(tmpdir(), "bf1w-"));
    tmps.push(dir);
    cliFixture(dir);
    // Byte for byte the heading shape frogger's literal bootstrap wrote (bootstrap.md:74-78 at be7ddfb).
    writeFileSync(join(dir, ".agents", "TASKS", "INBOX.md"), "# Scratch — Task Inbox\n\n## Priority\n- [ ] First task\n\n## Backlog\n- [ ] Second task\n- [ ] Third task\n");
    const r = cli(["state", "import", "--draft", dir], dir);
    const summary = r.stdout.split(/\r?\n/).find((l) => l.startsWith("Tasks:")) ?? "";
    expect(summary).toMatch(/WARNING/);
    expect(r.stdout).toMatch(/WARNING: .*INBOX\.md.* 0 tasks/);
    const report = readFileSync(join(dir, ".agents", "state.import-report.md"), "utf8");
    expect(report).toMatch(/WARNING: .*INBOX\.md.* 0 tasks/);
  });

  it("negative: an INBOX that parses prints no WARNING", () => {
    const dir = mkdtempSync(join(tmpdir(), "bf1n-"));
    tmps.push(dir);
    cliFixture(dir);
    writeFileSync(join(dir, ".agents", "TASKS", "INBOX.md"), "# Inbox\n\n## P1 — High\n- [ ] First task\n");
    const r = cli(["state", "import", "--draft", dir], dir);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^Tasks: 1 /m);
    expect(r.stdout).not.toMatch(/WARNING/);
  });
});

// ---------------------------------------------------------------------------
// BF-8 (F9): the retention edge at session 0
// ---------------------------------------------------------------------------

describe("BF-8 (F9): a fresh project at session 0 has no negative session anywhere", { timeout: E2E_TIMEOUT }, () => {
  it("a done item with no (Session N) marker validates, and nothing prints session -3", () => {
    const dir = mkdtempSync(join(tmpdir(), "bf8r-"));
    tmps.push(dir);
    mkdirSync(join(dir, ".agents", "TASKS"), { recursive: true });
    writeFileSync(join(dir, ".agents", "TASKS", "INBOX.md"), "# Inbox\n\n## P1\n- [x] Already done\n- [ ] Still open\n");
    const r = runDraft(dir, TODAY);
    expect(r.validation).toEqual({ ok: true });
    for (const t of r.draft.state.tasks) {
      expect(t.opened_session).toBeGreaterThanOrEqual(0);
      if (t.closed_session !== null) expect(t.closed_session).toBeGreaterThanOrEqual(0);
    }
    const report = readFileSync(r.reportPath, "utf8");
    expect(report).not.toMatch(/session -\d/);
    expect(report).not.toMatch(/= -\d/);
  });
});

// ---------------------------------------------------------------------------
// BF-5 (F8): a fresh install is NOT a seat, and says so without a problem line
// ---------------------------------------------------------------------------

describe("BF-5: role: none with no roles/ directory reports NOT A SEAT and raises no problem", { timeout: E2E_TIMEOUT }, () => {
  it("no ROLE FILE MISSING for shared.md when the checkout declares it is not a seat", () => {
    const dir = mkdtempSync(join(tmpdir(), "bf5-"));
    tmps.push(dir);
    git(dir, "init", "-q");
    const r = describeRoleFiles(dir, { name: "scratch-proj", role: "none", partner: null });
    expect(r.lines.join("\n")).toContain("NOT A SEAT");
    expect(r.problems).toEqual([]);
  });

  it("negative: a real seat with no shared.md still reports ROLE FILE MISSING", () => {
    const dir = mkdtempSync(join(tmpdir(), "bf5n-"));
    tmps.push(dir);
    git(dir, "init", "-q");
    const r = describeRoleFiles(dir, { name: "Seat", role: "developer", partner: null });
    expect(r.problems.join("\n")).toMatch(/ROLE FILE MISSING: \.agents\/roles\/shared\.md/);
  });
});

// ---------------------------------------------------------------------------
// BF-3 (F5): residue is detected, moved aside and named, never deleted
// ---------------------------------------------------------------------------

describe("BF-3: `open-brain bootstrap check` / `move-residue`", { timeout: E2E_TIMEOUT }, () => {
  it("an .agents/ with no state.json and no TASKS/ is RESIDUE, and names what is in it", () => {
    const dir = scratchProject(tmps, { residue: true });
    const r = cli(["bootstrap", "check", "--json", dir], dir);
    expect(r.status).toBe(0);
    const j = JSON.parse(r.stdout);
    expect(j.agents.kind).toBe("residue");
    expect(j.agents.entries).toEqual(["reflection-queue.json"]);
    expect(j.claudeMd).toBe("present");
    expect(j.git.kind).toBe("root");
  });

  it("move-residue moves it under .agents/archive/, byte for byte, and deletes nothing", () => {
    const dir = scratchProject(tmps, { residue: true });
    const before = readFileSync(join(dir, ".agents", "reflection-queue.json"));
    const r = cli(["bootstrap", "move-residue", dir], dir);
    expect(r.status).toBe(0);
    const moved = join(dir, ".agents", "archive", `pre-bootstrap-residue-${localToday()}`, "reflection-queue.json");
    expect(existsSync(moved)).toBe(true);
    expect(readFileSync(moved).equals(before)).toBe(true);
    expect(existsSync(join(dir, ".agents", "reflection-queue.json"))).toBe(false);
    expect(r.stdout).toContain("reflection-queue.json");
    // After the move the project reads as not bootstrapped, so scaffolding can proceed.
    const after = JSON.parse(cli(["bootstrap", "check", "--json", dir], dir).stdout);
    expect(after.agents.kind).toBe("empty");
  });

  it("a record (state.json) is BOOTSTRAPPED and prose TASKS/ is PRE-STATE; move-residue refuses both and moves nothing", () => {
    const a = scratchProject(tmps);
    mkdirSync(join(a, ".agents"));
    writeFileSync(join(a, STATE_REL), "{}\n");
    expect(JSON.parse(cli(["bootstrap", "check", "--json", a], a).stdout).agents.kind).toBe("bootstrapped");
    const ra = cli(["bootstrap", "move-residue", a], a);
    expect(ra.status).toBe(1);
    expect(existsSync(join(a, STATE_REL))).toBe(true);

    const b = scratchProject(tmps);
    mkdirSync(join(b, ".agents", "TASKS"), { recursive: true });
    writeFileSync(join(b, ".agents", "TASKS", "INBOX.md"), "# Inbox\n");
    expect(JSON.parse(cli(["bootstrap", "check", "--json", b], b).stdout).agents.kind).toBe("pre-state");
    const rb = cli(["bootstrap", "move-residue", b], b);
    expect(rb.status).toBe(1);
    expect(existsSync(join(b, ".agents", "TASKS", "INBOX.md"))).toBe(true);
  });

  it("CLAUDE.md: absent, present, and present with the SIA section are three answers", () => {
    const dir = scratchProject(tmps, { git: false });
    expect(JSON.parse(cli(["bootstrap", "check", "--json", dir], dir).stdout).claudeMd).toBe("present");
    writeFileSync(join(dir, "CLAUDE.md"), "# Scratch\n\n## Self-Improving Agent (SIA)\n\nx\n");
    expect(JSON.parse(cli(["bootstrap", "check", "--json", dir], dir).stdout).claudeMd).toBe("has-sia-section");
    rmSync(join(dir, "CLAUDE.md"));
    const j = JSON.parse(cli(["bootstrap", "check", "--json", dir], dir).stdout);
    expect(j.claudeMd).toBe("absent");
    expect(j.git.kind).toBe("none");
  });
});

function localToday(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// BF-2, BF-4, BF-6, BF-7, BF-8 (F12): the fresh install, end to end
// ---------------------------------------------------------------------------

describe("BF-2/4/6/7/8: scaffold, import, commit, /start — on a real git project", { timeout: E2E_TIMEOUT }, () => {
  it("BF-2: the template ships no state.json (the importer is its only producer)", () => {
    expect(existsSync(join(templateDir, ".agents", "state.json"))).toBe(false);
  });

  it("BF-6: scaffold refuses before git init — the project must be its own commit first", () => {
    const dir = scratchProject(tmps, { git: false });
    const r = cli(["bootstrap", "scaffold", dir], dir);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/git/);
    expect(existsSync(join(dir, ".agents"))).toBe(false);
  });

  it("the whole path: scaffold -> draft -> commit -> ob_start, with tracked/local exactly as scaffold said", async () => {
    const dir = scratchProject(tmps);
    const s = cli(["bootstrap", "scaffold", "--json", dir], dir);
    expect(s.stderr).toBe("");
    expect(s.status).toBe(0);
    const sj = JSON.parse(s.stdout) as { written: { path: string; tracked: boolean }[]; verify: { ok: boolean; problems: string[] } };
    expect(sj.verify).toEqual({ ok: true, problems: [] });
    const paths = sj.written.map((w) => w.path);
    // BF-6: from the template, and the four session commands among them.
    for (const p of [".agents/TASKS/INBOX.md", ".agents/TASKS/task.md", ".agents/SYSTEM/SUMMARY.md", ".agents/AGENT.md",
      ".claude/commands/start.md", ".claude/commands/end.md", ".claude/commands/task.md", ".claude/commands/sync.md",
      ".gitignore", ".gitattributes"]) expect(paths).toContain(p);
    expect(paths).not.toContain(".agents/state.json");
    expect(readFileSync(join(dir, ".agents", "TASKS", "INBOX.md"), "utf8")).toBe(readFileSync(join(templateDir, ".agents", "TASKS", "INBOX.md"), "utf8"));
    // The owner's CLAUDE.md is untouched by scaffold.
    expect(readFileSync(join(dir, "CLAUDE.md"), "utf8")).toBe("# Scratch\n\nThe owner's own instructions.\n");

    // BF-4, asserted by git rather than by the scaffold's own word.
    for (const w of sj.written) {
      const ignored = spawnSync("git", ["check-ignore", "-q", w.path], { cwd: dir }).status === 0;
      expect({ path: w.path, ignored }).toEqual({ path: w.path, ignored: !w.tracked });
    }

    // BF-1 (a): the draft imports the scaffolded tasks.
    const d = cli(["state", "import", "--draft", dir], dir);
    expect(d.status).toBe(0);
    expect(d.stdout).toMatch(/^Validates: yes/m);
    expect(d.stdout).not.toMatch(/WARNING/);
    expect(d.stdout).not.toMatch(/^Tasks: 0 /m);

    // (b): --commit gives a schema v3 record with no SIA history (T-175).
    const c = cli(["state", "import", "--commit", dir], dir);
    expect(c.status).toBe(0);
    const record = readFileSync(join(dir, STATE_REL), "utf8");
    const st = JSON.parse(record);
    expect(st.schema_version).toBe(3);
    expect(st.project.name).toBe("scratch-proj");
    expect(record).not.toMatch(/V-00[1-5]|G-00[1-6]/);

    // (c) and BF-8 (F12): ob_start returns the project's own State, and its header names it.
    const text = getText(await handleStart({ project_root: dir }));
    expect(text).toContain("## State (state.json rev 0)");
    expect(text.split("\n").find((l) => l.startsWith("Project:"))).toBe("Project: scratch-proj v0.1.0");
    // BF-5: the fresh install says it is not a seat, and nothing about missing role files.
    expect(text).toContain("NOT A SEAT");
    expect(text).not.toContain("NO SEAT IDENTITY RESOLVED");
    expect(text).not.toContain("ROLE FILE MISSING");

    // (d): after the initial commit, nothing scaffold called tracked is left out, and nothing is left over.
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "SIA bootstrap");
    expect(git(dir, "status", "--porcelain")).toBe("");
    const committed = git(dir, "diff", "--name-only", "HEAD~1", "HEAD").split("\n").sort();
    const expectTracked = [...sj.written.filter((w) => w.tracked).map((w) => w.path),
      ".agents/state.json", ".agents/SESSIONS/next-session.md"].sort();
    expect(committed).toEqual([...new Set(expectTracked)].sort());

    // BF-7 (F10): a fresh clone under core.autocrlf=true still has LF record bytes.
    const clone = mkdtempSync(join(tmpdir(), "bf-clone-"));
    tmps.push(clone);
    execFileSync("git", ["-c", "core.autocrlf=true", "clone", "-q", dir, clone], { stdio: "ignore" });
    for (const f of [".agents/state.json", ".agents/TASKS/INBOX.md", ".agents/SYSTEM/SUMMARY.md"]) {
      expect({ f, crlf: readFileSync(join(clone, f), "utf8").includes("\r\n") }).toEqual({ f, crlf: false });
    }
  }, E2E_TIMEOUT);

  it("scaffold never overwrites: an existing .claude/commands/start.md is kept and reported as skipped", () => {
    const dir = scratchProject(tmps);
    mkdirSync(join(dir, ".claude", "commands"), { recursive: true });
    writeFileSync(join(dir, ".claude", "commands", "start.md"), "# mine\n");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "the owner's own /start");
    const s = cli(["bootstrap", "scaffold", "--json", dir], dir);
    expect(s.status).toBe(0);
    const sj = JSON.parse(s.stdout) as { skipped: { path: string; reason: string }[] };
    expect(sj.skipped.map((x) => x.path)).toContain(".claude/commands/start.md");
    expect(readFileSync(join(dir, ".claude", "commands", "start.md"), "utf8")).toBe("# mine\n");
  }, E2E_TIMEOUT);

  it("the tracking check fires (known positive): an owner's `.agents/` rule shadows the template's, and scaffold exits 1 naming it", () => {
    const dir = scratchProject(tmps);
    writeFileSync(join(dir, ".gitignore"), "node_modules/\n.agents/\n");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "owner ignores .agents/");
    const s = cli(["bootstrap", "scaffold", "--json", dir], dir);
    expect(s.status).toBe(1);
    const sj = JSON.parse(s.stdout) as { verify: { ok: boolean; problems: string[] } };
    expect(sj.verify.ok).toBe(false);
    expect(sj.verify.problems.join("\n")).toMatch(/\.agents\/state\.json: the import writes it and it must be tracked, but git ignores it/);
    // The owner's rule is kept: scaffold appends, it never rewrites.
    expect(readFileSync(join(dir, ".gitignore"), "utf8").startsWith("node_modules/\n.agents/\n")).toBe(true);
  }, E2E_TIMEOUT);

  it("the eol check fires (known positive): an owner's later CRLF rule overrides the template's, and scaffold says so", () => {
    const dir = scratchProject(tmps);
    writeFileSync(join(dir, ".gitattributes"), "/.agents/** text eol=lf\n/.agents/** eol=crlf\n");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "owner forces CRLF");
    const s = cli(["bootstrap", "scaffold", "--json", dir], dir);
    expect(s.status).toBe(1);
    const sj = JSON.parse(s.stdout) as { verify: { problems: string[] } };
    expect(sj.verify.problems.join("\n")).toMatch(/expected eol=lf/);
  }, E2E_TIMEOUT);

  it("scaffold refuses over residue and moves nothing", () => {
    const dir = scratchProject(tmps, { residue: true });
    const r = cli(["bootstrap", "scaffold", dir], dir);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/residue/i);
    expect(readdirSync(join(dir, ".agents"))).toEqual(["reflection-queue.json"]);
  });
});
