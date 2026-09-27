/**
 * `/bootstrap` fix round 3 (docs/loops/bootstrap-fix-rulings-qa135.md, R-BF-9..13; record 141).
 *
 * QA 135's own rows (qa135-bootstrap.test.ts) are the D1-D5 acceptance and are
 * kept byte for byte. These rows pin what the rulings add beyond them: the
 * importer's folder-name fallback and its refusal to walk, the root walker's
 * sibling of D2 (sync and the session-end hook), the scaffolded state and the
 * template-INBOX warning, the record that does not parse, the residue move that
 * never nests and never says "refused" after moving (M13), and the empty
 * project's first commit.
 *
 * Written red against 6543e8e first. Reached through the CLI where the round
 * adds behaviour, so a missing feature is an assertion failure, not an import
 * error that takes the file down.
 */
import { describe, it, expect, afterEach } from "vitest";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync, renameSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { moveResidue } from "../../src/pipelines/bootstrap/index.js";
import { isProjectRoot, resolveRepoRoot, resolveHookProjectDir } from "../../src/shared/repo-root.js";

const cliEntry = join(import.meta.dirname, "../../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const templateDir = join(import.meta.dirname, "../../../project-template");
const T = 120_000;

function cli(args: string[], cwd: string): { status: number | null; out: string } {
  const r = spawnSync(process.execPath, [tsxCli, cliEntry, ...args], { cwd, encoding: "utf8", env: process.env });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}
function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
const tmps: string[] = [];
afterEach(() => { for (const t of tmps.splice(0)) rmSync(t, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });
function tmp(prefix = "bf-r3-"): string { const d = mkdtempSync(join(tmpdir(), prefix)); tmps.push(d); return d; }
function repo(dir: string, files: Record<string, string>, opts: { commit?: boolean } = {}): void {
  for (const [p, c] of Object.entries(files)) { mkdirSync(join(dir, p, ".."), { recursive: true }); writeFileSync(join(dir, p), c); }
  git(dir, "init", "-q", "-b", "master");
  git(dir, "config", "user.email", "r3@example.invalid");
  git(dir, "config", "user.name", "R3");
  if (opts.commit === false) return;
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "--allow-empty", "-m", "the project before SIA");
}
/** Every file under a directory, relative, sorted: what "the parent gained nothing" is measured with. */
function tree(dir: string, rel = ""): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${n.name}` : n.name;
    if (n.isDirectory()) out.push(`${r}/`, ...tree(dir, r)); else out.push(r);
  }
  return out.sort();
}
/** A Node parent that IS on the protocol layout, with a child project inside it. */
function nodeParentWithChild(childFiles: Record<string, string>): { parent: string; child: string; before: string[] } {
  const parent = tmp("bf-r3-parent-");
  writeFileSync(join(parent, "package.json"), '{"name":"parent","version":"9.9.9"}\n');
  mkdirSync(join(parent, ".agents", "SYSTEM"), { recursive: true });
  mkdirSync(join(parent, ".agents", "TASKS"), { recursive: true });
  writeFileSync(join(parent, ".agents", "TASKS", "INBOX.md"), "# Inbox\n\n## P1\n\n- [ ] PARENT TASK\n");
  const child = join(parent, "child");
  mkdirSync(child);
  repo(child, childFiles);
  return { parent, child, before: tree(join(parent, ".agents")) };
}
function editInbox(dir: string): void {
  writeFileSync(join(dir, ".agents", "TASKS", "INBOX.md"), "# Inbox\n\n## 🔴 P0 — Critical\n\n- [ ] Parse the CSV header\n\n## 🟡 P1 — High\n\n## 🔵 P2 — Medium\n\n## 🟢 P3 — Low\n");
}

// ---------------------------------------------------------------------------
// R-BF-9: state import never walks into a parent
// ---------------------------------------------------------------------------

describe("R-BF-9: state import takes the directory literally", { timeout: T }, () => {
  it("no package.json: the project name is the folder's, and the draft says so", () => {
    const dir = tmp();
    repo(dir, { "pyproject.toml": "[project]\nname = \"csvtool\"\n" });
    expect(cli(["bootstrap", "scaffold", dir], dir).status).toBe(0);
    editInbox(dir);
    const d = cli(["state", "import", "--draft"], dir);
    expect(d.status).toBe(0);
    expect(d.out).toContain(`Root: ${dir}`);
    expect(d.out).toMatch(/no package\.json/i);
    const draft = JSON.parse(readFileSync(join(dir, ".agents", "state.draft.json"), "utf8"));
    expect(draft.project.name).toBe(basename(dir));
    expect(readFileSync(join(dir, ".agents", "state.import-report.md"), "utf8")).toMatch(/no package\.json/i);
  });

  it("negative: with a package.json the name is package.json's and there is no folder-name note", () => {
    const dir = tmp();
    repo(dir, { "package.json": '{"name":"from-pkg","version":"1.2.3"}\n' });
    expect(cli(["bootstrap", "scaffold", dir], dir).status).toBe(0);
    editInbox(dir);
    const d = cli(["state", "import", "--draft"], dir);
    expect(d.status).toBe(0);
    expect(d.out).not.toMatch(/no package\.json/i);
    expect(JSON.parse(readFileSync(join(dir, ".agents", "state.draft.json"), "utf8")).project.name).toBe("from-pkg");
  });

  it("a Node parent with .agents/: --draft AND --commit in the child write only the child, and the parent's .agents/ gains nothing", () => {
    const { parent, child, before } = nodeParentWithChild({ "pyproject.toml": "[project]\n" });
    expect(cli(["bootstrap", "scaffold", child], child).status).toBe(0);
    editInbox(child);
    const d = cli(["state", "import", "--draft"], child);
    expect(d.status).toBe(0);
    expect(d.out).toContain(`Root: ${child}`);
    const c = cli(["state", "import", "--commit"], child);
    expect(c.status).toBe(0);
    expect(existsSync(join(child, ".agents", "state.json"))).toBe(true);
    expect(tree(join(parent, ".agents"))).toEqual(before);
    expect(existsSync(join(parent, ".agents", "state.json"))).toBe(false);
  });

  it("from a subdirectory with no .agents/ it refuses and names why, and writes nothing here or above", () => {
    const { parent, child, before } = nodeParentWithChild({ "pyproject.toml": "[project]\n" });
    const sub = join(child, "src");
    mkdirSync(sub);
    for (const args of [["state", "import", "--draft"], ["state", "import", "--commit"]]) {
      const r = cli(args, sub);
      expect(r.status).toBe(1);
      expect(r.out).toMatch(/no \.agents\//);
      expect(r.out).toMatch(/never walks up/);
      expect(r.out).toContain("Nothing written");
    }
    expect(readdirSync(sub)).toEqual([]);
    expect(existsSync(join(child, ".agents"))).toBe(false);
    expect(tree(join(parent, ".agents"))).toEqual(before);
  });

  it("negative: the same refusal does not fire where .agents/ exists (a pre-record project imports as before)", () => {
    const dir = tmp();
    repo(dir, { "package.json": '{"name":"legacy","version":"0.1.0"}\n', ".agents/TASKS/INBOX.md": "# Inbox\n\n## P1\n\n- [ ] Legacy task\n" });
    const d = cli(["state", "import", "--draft"], dir);
    expect(d.status).toBe(0);
    expect(d.out).toMatch(/Tasks: 1 /);
  });
});

// ---------------------------------------------------------------------------
// D2's sibling: the root walker used by sync and the session-end hook
// ---------------------------------------------------------------------------

describe("the root walker: a bootstrapped non-Node child is its own root", { timeout: T }, () => {
  it("resolveRepoRoot and resolveHookProjectDir stop at a child with .agents/SYSTEM/ and no package.json", () => {
    const { parent, child } = nodeParentWithChild({ "main.py": "print(1)\n" });
    expect(cli(["bootstrap", "scaffold", child], child).status).toBe(0);
    expect(isProjectRoot(child)).toBe(true);
    expect(resolveRepoRoot(child)).toBe(child);
    expect(resolveRepoRoot(join(child, ".agents", "TASKS"))).toBe(child);
    expect(resolveHookProjectDir(child)).toBe(child);
    // Negative: the parent is still a root in its own right.
    expect(resolveRepoRoot(parent)).toBe(parent);
  });

  it("known negative: the stray open-brain/.agents/ (a bare .agents/ with no protocol layout) still does not stop the walk", () => {
    const root = tmp();
    writeFileSync(join(root, "package.json"), '{"name":"r","version":"1.0.0"}\n');
    mkdirSync(join(root, ".agents", "SYSTEM"), { recursive: true });
    const sub = join(root, "open-brain");
    mkdirSync(join(sub, ".agents"), { recursive: true });
    writeFileSync(join(sub, "package.json"), '{"name":"open-brain","version":"0.1.0"}\n');
    writeFileSync(join(sub, ".agents", "reflection-queue.json"), "[]");
    expect(isProjectRoot(sub)).toBe(false);
    expect(resolveRepoRoot(sub)).toBe(root);
  });
});

// ---------------------------------------------------------------------------
// R-BF-10: scaffolded, not imported; and the template INBOX warning
// ---------------------------------------------------------------------------

describe("R-BF-10: check knows a scaffold that has not been imported", { timeout: T }, () => {
  it("after scaffold: SCAFFOLDED, continue at step 4, and it says INBOX is still the template's", () => {
    const dir = tmp();
    repo(dir, { "package.json": '{"name":"q","version":"1.0.0"}\n' });
    expect(cli(["bootstrap", "scaffold", dir], dir).status).toBe(0);
    const c = cli(["bootstrap", "check", dir], dir);
    expect(c.status).toBe(0);
    expect(c.out).toMatch(/SCAFFOLDED/);
    expect(c.out).toMatch(/step 4/);
    expect(c.out).toMatch(/template's example tasks/);
    // A re-run of scaffold refuses rather than half-scaffolding again.
    const s = cli(["bootstrap", "scaffold", dir], dir);
    expect(s.status).toBe(1);
    expect(s.out).toMatch(/already scaffolded/);
  });

  it("negative: once INBOX is edited, check no longer says it is the template's", () => {
    const dir = tmp();
    repo(dir, { "package.json": '{"name":"q","version":"1.0.0"}\n' });
    expect(cli(["bootstrap", "scaffold", dir], dir).status).toBe(0);
    editInbox(dir);
    const c = cli(["bootstrap", "check", dir], dir);
    expect(c.out).toMatch(/SCAFFOLDED/);
    expect(c.out).not.toMatch(/template's example tasks/);
  });

  it("negative: a pre-record project (TASKS/ with no scaffold AGENT.md) is still PRE-STATE, the import path", () => {
    const dir = tmp();
    repo(dir, { "package.json": '{"name":"q","version":"1.0.0"}\n', ".agents/TASKS/INBOX.md": "# Inbox\n\n## P1\n\n- [ ] x\n" });
    const c = cli(["bootstrap", "check", dir], dir);
    expect(c.out).toMatch(/PRE-STATE/);
    expect(c.out).not.toMatch(/SCAFFOLDED/);
  });

  it("the importer WARNS when INBOX.md is the template's, byte for byte (CRLF too), and not once it is edited", () => {
    const dir = tmp();
    repo(dir, { "package.json": '{"name":"q","version":"1.0.0"}\n' });
    expect(cli(["bootstrap", "scaffold", dir], dir).status).toBe(0);
    const d = cli(["state", "import", "--draft"], dir);
    expect(d.status).toBe(0);
    expect(d.out).toMatch(/WARNING: .*INBOX\.md is the template's/);
    expect(readFileSync(join(dir, ".agents", "state.import-report.md"), "utf8")).toMatch(/INBOX\.md is the template's/);
    // The same bytes with CRLF line ends (what autocrlf makes of a checkout) are still the template's.
    const inbox = join(dir, ".agents", "TASKS", "INBOX.md");
    writeFileSync(inbox, readFileSync(inbox, "utf8").replace(/\r?\n/g, "\r\n"));
    expect(cli(["state", "import", "--draft"], dir).out).toMatch(/INBOX\.md is the template's/);
    editInbox(dir);
    const e = cli(["state", "import", "--draft"], dir);
    expect(e.out).not.toMatch(/template's/);
    expect(e.out).not.toMatch(/WARNING/);
  });
});

// ---------------------------------------------------------------------------
// R-BF-11: BOOTSTRAPPED only for a record that parses and is not the seed
// ---------------------------------------------------------------------------

const SEED = JSON.stringify({ schema_version: 3, revision: 0, project: { name: "{{PROJECT}}" }, objective: null, tasks: [], verified: [], gaps: [], decisions: [], handoffs: [], sessions: [] }, null, 2) + "\n";

describe("R-BF-11: a state.json that is not a record is not BOOTSTRAPPED", { timeout: T }, () => {
  for (const [label, bytes] of [["zero bytes", ""], ["not JSON", "{ \"schema_version\": 3,"], ["the {{PROJECT}} seed", SEED]] as const) {
    it(`${label}: NOT A RECORD, named, and move-residue sets it aside`, () => {
      const dir = tmp();
      repo(dir, { "package.json": '{"name":"q","version":"1.0.0"}\n' });
      mkdirSync(join(dir, ".agents"));
      writeFileSync(join(dir, ".agents", "state.json"), bytes);
      const c = cli(["bootstrap", "check", dir], dir);
      expect(c.out).not.toMatch(/BOOTSTRAPPED/);
      expect(c.out).toMatch(/NOT A RECORD/);
      expect(c.out).toMatch(/move-residue/);
      const s = cli(["bootstrap", "scaffold", dir], dir);
      expect(s.status).toBe(1);
      const m = cli(["bootstrap", "move-residue", dir], dir);
      expect(m.status).toBe(0);
      expect(existsSync(join(dir, ".agents", "state.json"))).toBe(false);
      const [folder] = readdirSync(join(dir, ".agents", "archive"));
      expect(readFileSync(join(dir, ".agents", "archive", folder, "state.json"), "utf8")).toBe(bytes);
      expect(cli(["bootstrap", "check", dir], dir).out).toMatch(/\.agents\/:\s+empty/);
    });
  }

  it("negative: an older schema that parses (v2) is still BOOTSTRAPPED — migrating it is not bootstrap's job", () => {
    const dir = tmp();
    repo(dir, { "package.json": '{"name":"q","version":"1.0.0"}\n' });
    mkdirSync(join(dir, ".agents"));
    writeFileSync(join(dir, ".agents", "state.json"), JSON.stringify({ schema_version: 2, revision: 4, project: { name: "q" } }));
    expect(cli(["bootstrap", "check", dir], dir).out).toMatch(/BOOTSTRAPPED/);
  });
});

// ---------------------------------------------------------------------------
// R-BF-12: residue moves never nest, and never say "refused" after moving
// ---------------------------------------------------------------------------

describe("R-BF-12: move-residue twice on one day", { timeout: T }, () => {
  it("the second move goes to a suffixed folder beside the first; neither nests; both hold their own bytes", () => {
    const dir = tmp();
    repo(dir, { "package.json": '{"name":"q","version":"1.0.0"}\n' });
    mkdirSync(join(dir, ".agents"));
    writeFileSync(join(dir, ".agents", "a.json"), "one\n");
    const m1 = cli(["bootstrap", "move-residue", dir], dir);
    expect(m1.status).toBe(0);
    writeFileSync(join(dir, ".agents", "b.json"), "two\n");
    const m2 = cli(["bootstrap", "move-residue", dir], dir);
    expect(m2.status).toBe(0);
    expect(m2.out).not.toMatch(/refused/);
    const folders = readdirSync(join(dir, ".agents", "archive")).sort();
    expect(folders).toHaveLength(2);
    expect(folders[1]).toBe(`${folders[0]}-2`);
    expect(readdirSync(join(dir, ".agents", "archive", folders[0]))).toEqual(["a.json"]);
    expect(readdirSync(join(dir, ".agents", "archive", folders[1]))).toEqual(["b.json"]);
    expect(readdirSync(join(dir, ".agents"))).toEqual(["archive"]);
  });

  it("M13: a rename that silently leaves an entry behind is caught by the read-back, named, and reported as MOVED, not refused", () => {
    const dir = tmp();
    mkdirSync(join(dir, ".agents"));
    writeFileSync(join(dir, ".agents", "a.json"), "one\n");
    writeFileSync(join(dir, ".agents", "b.json"), "two\n");
    // Moves everything except b.json and reports success: the partial rename no fixture produces by itself.
    const leaky = (from: string, to: string) => { if (basename(from) !== "b.json") renameSync(from, to); };
    let err: Error | null = null;
    try { moveResidue(dir, "2026-09-26", { rename: leaky }); } catch (e) { err = e as Error; }
    expect(err).not.toBeNull();
    expect(err!.message).toMatch(/b\.json/);
    expect(err!.message).toMatch(/moved/i);
    expect(err!.message).not.toMatch(/refused|nothing moved/i);
  });

  it("negative for M13: the real rename passes the read-back", () => {
    const dir = tmp();
    mkdirSync(join(dir, ".agents"));
    writeFileSync(join(dir, ".agents", "a.json"), "one\n");
    const r = moveResidue(dir, "2026-09-26");
    expect(r.entries).toEqual(["a.json"]);
  });
});

// ---------------------------------------------------------------------------
// R-BF-13: an empty project's first commit
// ---------------------------------------------------------------------------

describe("R-BF-13: an empty project can make its before-SIA commit", { timeout: T }, () => {
  it("an empty folder with no git: Next names --allow-empty", () => {
    const dir = tmp();
    const c = cli(["bootstrap", "check", dir], dir);
    expect(c.out).toMatch(/git init/);
    expect(c.out).toMatch(/--allow-empty/);
  });

  it("git init'd with nothing to commit: Next names --allow-empty, and following it reaches scaffold", () => {
    const dir = tmp();
    repo(dir, {}, { commit: false });
    const c = cli(["bootstrap", "check", dir], dir);
    expect(c.out).toMatch(/nothing to commit/);
    expect(c.out).toMatch(/git commit --allow-empty -m "The project before SIA"/);
    git(dir, "commit", "-q", "--allow-empty", "-m", "The project before SIA");
    expect(cli(["bootstrap", "check", dir], dir).out).toMatch(/Next:\s+Scaffold/);
  });

  it("negative: a folder with a file does not get --allow-empty", () => {
    const dir = tmp();
    writeFileSync(join(dir, "main.py"), "print(1)\n");
    expect(cli(["bootstrap", "check", dir], dir).out).not.toMatch(/--allow-empty/);
    repo(dir, {}, { commit: false });
    expect(cli(["bootstrap", "check", dir], dir).out).not.toMatch(/--allow-empty/);
  });

  it("bootstrap.md step 2.2 names the empty commit", () => {
    const md = readFileSync(join(templateDir, ".claude", "commands", "bootstrap.md"), "utf8");
    const step2 = md.slice(md.indexOf("## Step 2"), md.indexOf("## Step 3"));
    expect(step2).toContain('git commit --allow-empty -m "The project before SIA"');
  });
});

