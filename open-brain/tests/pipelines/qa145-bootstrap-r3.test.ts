/**
 * QA 145 (record session 145): the /bootstrap fix round 3 at 7f4ca74, probed from outside the developer's rows.
 * Evidence for docs/loops/bootstrap-fix-r3-qa-report.md, not a proposed fix. Every row is a requirement the
 * dispatch (docs/loops/bootstrap-fix-r3-dispatch-qa.md) names; each is expected GREEN on the candidate.
 *   H: R-BF-14, the session-end hook run for real (through tsx here; the report also runs the BUILT hook).
 *   W: R-BF-14, the root walker's known negatives and SIA's own root.
 *   F: R-BF-15, archive/ is never residue, and a TRACKED archive/ change is still a change.
 *   G: R-BF-16, move-residue never moves a parseable record; a tracked zero-byte one shows as deleted.
 *   N: QA's own install: a child inside the parent's repository that is not its own repository.
 *   S: R-BF-10, the SCAFFOLDED state (for QA's mutant that removes it).
 */
import { describe, it, expect, afterEach } from "vitest";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { resolveRepoRoot, resolveHookProjectDir, isProjectRoot } from "../../src/shared/repo-root.js";

const cliEntry = join(import.meta.dirname, "../../src/cli.ts");
const hookEntry = join(import.meta.dirname, "../../src/cli-session-end.ts");
const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const SIA = resolve(import.meta.dirname, "../../..");
const T = 180_000;

function cli(args: string[], cwd: string) {
  const r = spawnSync(process.execPath, [tsxCli, cliEntry, ...args], { cwd, encoding: "utf8", env: process.env });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}
function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "user.email=qa145@example.invalid", "-c", "user.name=QA145", ...args],
    { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function gitRaw(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
const tmps: string[] = [];
afterEach(() => { for (const t of tmps.splice(0)) rmSync(t, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });
function tmp(): string { const d = mkdtempSync(join(tmpdir(), "qa145-")); tmps.push(d); return d; }
function write(p: string, text: string): void { mkdirSync(join(p, ".."), { recursive: true }); writeFileSync(p, text); }
function line(out: string, label: string): string { return (out.match(new RegExp(`^${label}\\s+(.*)$`, "m")) ?? [, ""])[1]; }

/** Every file under dir with its hash, skipping any path that starts with one of `skip` (relative, with /). */
function hashTree(dir: string, skip: string[] = [], rel = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const n of readdirSync(join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${n.name}` : n.name;
    if (skip.some((s) => r === s || r.startsWith(`${s}/`))) continue;
    if (n.isDirectory()) Object.assign(out, hashTree(dir, skip, r));
    else out[r] = createHash("sha256").update(readFileSync(join(dir, r))).digest("hex");
  }
  return out;
}

/**
 * Install (iii): a Node parent with .agents/ and, inside it, tools/csvtool/ (pyproject.toml, no package.json),
 * bootstrapped through the CLI to the SIA commit. `parentIsRepo`: (iii-b) the parent is a repository and the
 * child its own repository inside it; otherwise (iii-a) only the child becomes one (step 2.2).
 */
function installIII(parentIsRepo: boolean) {
  const parent = tmp();
  const child = join(parent, "tools", "csvtool");
  write(join(parent, "package.json"), '{"name":"node-parent","version":"3.1.4"}\n');
  write(join(parent, ".agents/SYSTEM/SUMMARY.md"), "# node-parent\n");
  write(join(parent, ".agents/TASKS/INBOX.md"), "# Inbox\n\n## P1\n\n- [ ] PARENT TASK\n");
  write(join(parent, ".agents/TASKS/task.md"), "# Task\n\n## Current Objective\n\n**The parent's objective**\n");
  write(join(child, "pyproject.toml"), '[project]\nname = "csvtool"\nversion = "0.3.0"\n');
  write(join(child, "csvtool/__main__.py"), "print('csv')\n");
  if (parentIsRepo) {
    git(parent, "init", "-q", "-b", "master");
    git(parent, "add", "-A", "--", ".", ":(exclude)tools");
    git(parent, "commit", "-q", "-m", "parent");
  }
  git(child, "init", "-q", "-b", "master");
  git(child, "add", "-A");
  git(child, "commit", "-q", "-m", "The project before SIA");
  const s = cli(["bootstrap", "scaffold"], child);
  expect(s.status, s.out).toBe(0);
  git(child, "add", "-A");
  git(child, "commit", "-q", "-m", "Bootstrap SIA");
  return { parent, child };
}

/** A commit on a new loop/* branch, the tree left on master: work the handoff guard counts. */
function loopWork(dir: string, branch: string): void {
  git(dir, "checkout", "-q", "-b", branch);
  write(join(dir, `${branch.replace(/\//g, "-")}.txt`), "work\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", `work on ${branch}`);
  git(dir, "checkout", "-q", "master");
}

/** The session-end hook, run for real, with every home-side path in scratch. */
function runHook(cwd: string, projectDir: string | null, since: Date, scratch: string) {
  const transcript = join(scratch, "transcript.jsonl");
  writeFileSync(transcript, JSON.stringify({ type: "user", timestamp: since.toISOString() }) + "\n");
  const home = join(scratch, "home");
  mkdirSync(home, { recursive: true });
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home,
    KNOWLEDGE_V2_DB: join(home, "no-db-here.db"), OPEN_BRAIN_VAULT_DIR: join(home, "vault") };
  delete env.CLAUDE_PROJECT_DIR;
  delete env.CLAUDE_CODE_SESSION_ID;
  if (projectDir) env.CLAUDE_PROJECT_DIR = projectDir;
  const r = spawnSync(process.execPath, [tsxCli, hookEntry], { cwd, encoding: "utf8", env,
    input: JSON.stringify({ session_id: "qa145-hook", transcript_path: transcript, hook_event_name: "SessionEnd" }) });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}
const MARKER = ".agents/SESSIONS/.missing-handoff.jsonl";

describe("QA 145 H: the session-end hook in install (iii) writes to the CHILD, never the parent (R-BF-14)", { timeout: T }, () => {
  for (const parentIsRepo of [true, false]) {
    for (const drifted of [false, true]) {
      const name = `${parentIsRepo ? "(iii-b) parent is a repository" : "(iii-a) parent is not a repository"}, ` +
        `${drifted ? "no CLAUDE_PROJECT_DIR, cwd in child/csvtool/" : "CLAUDE_PROJECT_DIR = the child"}`;
      it(`H: ${name}: the missing-handoff marker lands in the child and the parent gains nothing`, () => {
        const since = new Date(Date.now() - 5_000);
        const { parent, child } = installIII(parentIsRepo);
        loopWork(child, "loop/child-work");
        if (parentIsRepo) loopWork(parent, "loop/parent-work");
        const before = hashTree(parent, ["tools", ".git"]);
        const statusBefore = parentIsRepo ? gitRaw(parent, "status", "--porcelain", "--untracked-files=all") : "";
        const h = runHook(drifted ? join(child, "csvtool") : parent, drifted ? null : child, since, tmp());
        expect(h.out).toMatch(/HANDOFF MISSING/);
        expect(existsSync(join(child, MARKER)), h.out).toBe(true);
        expect(readFileSync(join(child, MARKER), "utf8")).toMatch(/loop\/child-work/);
        expect(existsSync(join(parent, MARKER))).toBe(false);
        expect(hashTree(parent, ["tools", ".git"])).toEqual(before);
        if (parentIsRepo) expect(gitRaw(parent, "status", "--porcelain", "--untracked-files=all")).toBe(statusBefore);
      });
    }
  }
});

describe("QA 145 W: the root walker's known negatives and SIA's own root (R-BF-14)", () => {
  it("W1: a home directory whose .agents/ holds only mailbox/ and reflection-queue.json is NOT a root", () => {
    const home = tmp();
    mkdirSync(join(home, ".agents", "mailbox"), { recursive: true });
    writeFileSync(join(home, ".agents", "reflection-queue.json"), "[]\n");
    const deep = join(home, "code", "loose", "src");
    mkdirSync(deep, { recursive: true });
    expect(isProjectRoot(home)).toBe(false);
    expect(resolveRepoRoot(deep)).toBeNull();
    expect(resolveHookProjectDir(deep)).toBe(resolve(deep));
    // Control: a start directory with its own package.json and nothing above it is accepted as-is.
    writeFileSync(join(home, "code", "loose", "package.json"), "{}\n");
    expect(resolveRepoRoot(join(home, "code", "loose"))).toBe(join(home, "code", "loose"));
  });

  it("W2: SIA's own root resolves unchanged from its root, open-brain/, open-brain/src/ and docs/", () => {
    for (const d of [SIA, join(SIA, "open-brain"), join(SIA, "open-brain", "src"), join(SIA, "docs")]) {
      expect(resolveRepoRoot(d)).toBe(SIA);
      expect(resolveHookProjectDir(d)).toBe(SIA);
    }
  });

  it("W3: the stray open-brain/.agents/ shape (a bare reflection-queue.json beside a package.json) is not a root", () => {
    const root = tmp();
    writeFileSync(join(root, "package.json"), "{}\n");
    mkdirSync(join(root, ".agents", "SYSTEM"), { recursive: true });
    const sub = join(root, "open-brain");
    mkdirSync(join(sub, ".agents"), { recursive: true });
    writeFileSync(join(sub, "package.json"), "{}\n");
    writeFileSync(join(sub, ".agents", "reflection-queue.json"), "[]\n");
    mkdirSync(join(sub, "src"), { recursive: true });
    expect(isProjectRoot(sub)).toBe(false);
    expect(resolveRepoRoot(join(sub, "src"))).toBe(root);
    expect(resolveHookProjectDir(join(sub, "src"))).toBe(root);
  });
});

describe("QA 145 F: archive/ is never residue, and a tracked archive/ change is still a change (R-BF-15)", { timeout: T }, () => {
  it("F1: an archive/ that exists before move-residue is untouched, and the new residue folder holds only the residue", () => {
    const dir = tmp();
    write(join(dir, "main.py"), "print(1)\n");
    write(join(dir, ".agents/archive/old-notes/n.md"), "old\n");
    write(join(dir, ".agents/archive/pre-bootstrap-residue-1999-01-01/a.json"), "{}\n");
    write(join(dir, ".agents/reflection-queue.json"), '{"q":1}\n');
    const archiveBefore = hashTree(join(dir, ".agents/archive"));
    const c = cli(["bootstrap", "check"], dir);
    expect(line(c.out, "\\.agents/:")).toBe("RESIDUE — reflection-queue.json (no state.json, no TASKS/)");
    const m = cli(["bootstrap", "move-residue"], dir);
    expect(m.status, m.out).toBe(0);
    const made = readdirSync(join(dir, ".agents/archive")).filter((n) => !(n in { "old-notes": 1, "pre-bootstrap-residue-1999-01-01": 1 }));
    expect(made).toHaveLength(1);
    expect(readdirSync(join(dir, ".agents/archive", made[0]))).toEqual(["reflection-queue.json"]);
    const after = hashTree(join(dir, ".agents/archive"));
    for (const [k, v] of Object.entries(archiveBefore)) expect(after[k]).toBe(v);
    expect(Object.keys(after)).toHaveLength(Object.keys(archiveBefore).length + 1);
    expect(readdirSync(join(dir, ".agents"))).toEqual(["archive"]);
  });

  it("F2: a same-day folder already there gets a suffix; nothing nests inside either", () => {
    const dir = tmp();
    write(join(dir, "main.py"), "print(1)\n");
    write(join(dir, ".agents/one.json"), "1\n");
    expect(cli(["bootstrap", "move-residue"], dir).status).toBe(0);
    write(join(dir, ".agents/two.json"), "2\n");
    const m = cli(["bootstrap", "move-residue"], dir);
    expect(m.status, m.out).toBe(0);
    const folders = readdirSync(join(dir, ".agents/archive")).sort();
    expect(folders).toHaveLength(2);
    expect(folders[1]).toBe(`${folders[0]}-2`);
    expect(readdirSync(join(dir, ".agents/archive", folders[0]))).toEqual(["one.json"]);
    expect(readdirSync(join(dir, ".agents/archive", folders[1]))).toEqual(["two.json"]);
  });

  it("F3: a TRACKED file under .agents/archive/ that is modified is still an uncommitted change; an untracked one is not", () => {
    const dir = tmp();
    write(join(dir, "main.py"), "print(1)\n");
    write(join(dir, ".agents/archive/notes.txt"), "v1\n");
    git(dir, "init", "-q", "-b", "master");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "with a tracked archive file");
    writeFileSync(join(dir, ".agents/archive/notes.txt"), "v2\n");
    write(join(dir, ".agents/archive/untracked.txt"), "x\n");
    const c = cli(["bootstrap", "check"], dir);
    expect(line(c.out, "git:")).toBe("repository root; has commits; 1 uncommitted change(s)");
    expect(line(c.out, "Next:")).toMatch(/^Commit the 1 uncommitted change\(s\) first/);
    const s = cli(["bootstrap", "scaffold"], dir);
    expect(s.status).toBe(1);
    expect(s.out).toMatch(/1 uncommitted change\(s\) \( M \.agents\/archive\/notes\.txt\)/);
  });
});

describe("QA 145 G: move-residue and state.json (R-BF-16)", { timeout: T }, () => {
  it("G1: a parseable state.json is never moved, even beside residue, and check calls it BOOTSTRAPPED", () => {
    const dir = tmp();
    const rec = '{"schema_version":3,"revision":0,"project":{"name":"real"}}\n';
    write(join(dir, ".agents/state.json"), rec);
    write(join(dir, ".agents/reflection-queue.json"), "[]\n");
    expect(line(cli(["bootstrap", "check"], dir).out, "\\.agents/:")).toBe("BOOTSTRAPPED — state.json is a record");
    const m = cli(["bootstrap", "move-residue"], dir);
    expect(m.status).toBe(1);
    expect(m.out).toMatch(/refused: \.agents\/ is bootstrapped, not residue — nothing moved/);
    expect(readFileSync(join(dir, ".agents/state.json"), "utf8")).toBe(rec);
    expect(existsSync(join(dir, ".agents/archive"))).toBe(false);
  });

  it("G2: a TRACKED zero-byte state.json: Next names restore-from-git; once moved, git status shows it deleted", () => {
    const dir = tmp();
    write(join(dir, "main.py"), "print(1)\n");
    write(join(dir, ".agents/state.json"), "");
    git(dir, "init", "-q", "-b", "master");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "a tracked zero-byte state.json");
    const c = cli(["bootstrap", "check"], dir);
    expect(line(c.out, "\\.agents/:")).toBe("NOT A RECORD — state.json is zero bytes");
    expect(line(c.out, "Next:")).toMatch(/restore it from git instead \(`git checkout -- \.agents\/state\.json`\)/);
    const m = cli(["bootstrap", "move-residue"], dir);
    expect(m.status, m.out).toBe(0);
    expect(m.out).toMatch(/Entries: state\.json/);
    expect(gitRaw(dir, "status", "--porcelain")).toMatch(/^ D \.agents\/state\.json$/m);
    const folder = readdirSync(join(dir, ".agents/archive"))[0];
    expect(statSync(join(dir, ".agents/archive", folder, "state.json")).size).toBe(0);
    expect(line(cli(["bootstrap", "check"], dir).out, "Next:")).toMatch(/^The residue was tracked by git: commit its removal/);
  });
});

describe("QA 145 N: a child inside the parent's repository that is NOT its own repository", { timeout: T }, () => {
  for (const tracked of [false, true]) {
    it(`N: ${tracked ? "the child's files tracked by the parent" : "the child untracked"}: check STOPs and names the enclosing repository; scaffold and import refuse; the parent gains nothing`, () => {
      const parent = tmp();
      const child = join(parent, "tools", "csvtool");
      write(join(parent, "package.json"), '{"name":"node-parent","version":"3.1.4"}\n');
      write(join(parent, ".agents/SYSTEM/SUMMARY.md"), "# node-parent\n");
      write(join(parent, ".agents/TASKS/INBOX.md"), "# Inbox\n\n## P1\n\n- [ ] PARENT TASK\n");
      write(join(child, "pyproject.toml"), '[project]\nname = "csvtool"\n');
      git(parent, "init", "-q", "-b", "master");
      git(parent, "add", "-A", ...(tracked ? [] : ["--", ".", ":(exclude)tools"]));
      git(parent, "commit", "-q", "-m", "parent");
      const before = hashTree(parent, [".git"]);
      const statusBefore = gitRaw(parent, "status", "--porcelain", "--untracked-files=all");
      const c = cli(["bootstrap", "check"], child);
      expect(line(c.out, "git:")).toMatch(/^inside another repository at /);
      expect(line(c.out, "Next:")).toMatch(/^STOP: this folder is inside another repository \(.+\)\. Bootstrap a project at its own repository root\.$/);
      const s = cli(["bootstrap", "scaffold"], child);
      expect(s.status).toBe(1);
      expect(s.out).toMatch(/inside another git repository/);
      const d = cli(["state", "import", "--draft"], child);
      expect(d.status).toBe(1);
      expect(d.out).toMatch(/has no \.agents\/ directory/);
      const m = cli(["bootstrap", "move-residue"], child);
      expect(m.status).toBe(1);
      expect(hashTree(parent, [".git"])).toEqual(before);
      expect(gitRaw(parent, "status", "--porcelain", "--untracked-files=all")).toBe(statusBefore);
    });
  }
});

describe("QA 145 S: SCAFFOLDED (R-BF-10)", { timeout: T }, () => {
  it("S1: right after scaffold, check says SCAFFOLDED and continues at step 4; scaffold's re-run refuses before the git checks", () => {
    const dir = tmp();
    write(join(dir, "main.py"), "print(1)\n");
    git(dir, "init", "-q", "-b", "master");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "before SIA");
    expect(cli(["bootstrap", "scaffold"], dir).status).toBe(0);
    const c = cli(["bootstrap", "check"], dir);
    expect(line(c.out, "\\.agents/:")).toBe("SCAFFOLDED — not yet imported; INBOX.md is still the template's");
    expect(line(c.out, "Next:")).toMatch(/^Scaffolded, not yet imported: continue at step 4/);
    const again = cli(["bootstrap", "scaffold"], dir);
    expect(again.status).toBe(1);
    expect(again.out).toMatch(/already scaffolded/);
  });
});
