/**
 * T-272 (docs/loops/t272-bootstrap-seat-checkout-brief.md): bootstrap run in a SEAT checkout, a linked worktree
 * whose folder is not the repository's name and which holds .agents/AGENT.local.md, keeps the seat file where it
 * is. It names the tracked AGENT.md, and the import draft's folder-name fallback, after the REPOSITORY (T-249's
 * projectIdentityName), not after the checkout folder. Prism, 10-13: move-residue archived AGENT.local.md, and
 * scaffold wrote `name: dashboard-planner` into the tracked AGENT.md.
 */
import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as cp from "node:child_process";
import * as bs from "../../src/pipelines/bootstrap/index.js";
import * as si from "../../src/pipelines/state-import/index.js";

const repoRoot = path.join(import.meta.dirname, "../../..");
const templateDir = path.join(repoRoot, "project-template");
const TODAY = "2026-10-13";
const SEAT = "---\nname: Prism\nrole: planner\npartner: Forge\n---\n\n# Prism, local to this checkout\n";

const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) fs.rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

function git(cwd: string, ...args: string[]): string {
  return cp.execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** A fresh temp base; realpath.native because some hosts hand out an 8.3 short temp path (as t249 does). */
function tmpBase(): string {
  const base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "t272-")));
  tmps.push(base);
  return base;
}

/** A repository folder `name` under `base`, one commit, no package.json; `gitignore` is the owner's own, when given. */
function repo(base: string, name: string, gitignore?: string): string {
  const dir = path.join(base, name);
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "README.md"), `# ${name}\n`);
  if (gitignore !== undefined) fs.writeFileSync(path.join(dir, ".gitignore"), gitignore);
  git(dir, "init", "-q", "-b", "master");
  git(dir, "config", "user.email", "t272@example.invalid");
  git(dir, "config", "user.name", "t272");
  git(dir, "config", "commit.gpgsign", "false");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "the project before SIA");
  return dir;
}

/** Repository `agent-dashboard` and its linked worktree `dashboard-planner`, which holds the seat file. */
function seatCheckout(gitignore?: string): { main: string; wt: string } {
  const base = tmpBase();
  const main = repo(base, "agent-dashboard", gitignore);
  const wt = path.join(base, "dashboard-planner");
  git(main, "worktree", "add", "-q", "--detach", wt);
  fs.mkdirSync(path.join(wt, ".agents"));
  fs.writeFileSync(path.join(wt, ".agents", "AGENT.local.md"), SEAT);
  return { main, wt };
}

describe("T-272: bootstrap in a seat checkout", { timeout: 60_000 }, () => {
  it("S1: the seat file is neither residue nor an uncommitted change, so check says Scaffold", () => {
    const { wt } = seatCheckout();
    const ins = bs.inspectProject(wt, templateDir);
    expect(ins.agents).toEqual({ kind: "empty" });
    expect(ins.git).toEqual({ kind: "root", commits: true, dirty: [], empty: false });
    expect(ins.next).toBe("Scaffold (`bootstrap scaffold`).");
  });

  it("S2: scaffold keeps AGENT.local.md byte for byte, git ignores it, and AGENT.md names the repository", () => {
    const { wt } = seatCheckout();
    const r = bs.scaffold(wt, templateDir);
    expect(r.verify).toEqual({ ok: true, problems: [] });
    expect(fs.readFileSync(path.join(wt, ".agents", "AGENT.local.md"), "utf8")).toBe(SEAT);
    expect(cp.spawnSync("git", ["check-ignore", "-q", ".agents/AGENT.local.md"], { cwd: wt }).status).toBe(0);
    const agentMd = fs.readFileSync(path.join(wt, ".agents", "AGENT.md"), "utf8");
    expect(agentMd.startsWith("---\nname: agent-dashboard\nrole: developer\n")).toBe(true);
    expect(agentMd).toContain("# agent-dashboard — the developer seat");
    expect(agentMd).not.toContain("dashboard-planner");
  });

  it("S3: residue beside the seat file moves alone, and the seat file stays in .agents/", () => {
    const { wt } = seatCheckout();
    fs.writeFileSync(path.join(wt, ".agents", "PRISM-START.md"), "# notes\n");
    expect(bs.inspectProject(wt, templateDir).agents).toEqual({ kind: "residue", entries: ["PRISM-START.md"] });
    // T-272 M6: only the seat file is dropped from the dirty list; any other untracked .agents/ file still counts.
    expect(bs.inspectProject(wt, templateDir).git).toEqual({ kind: "root", commits: true, dirty: ["?? .agents/PRISM-START.md"], empty: false });
    const m = bs.moveResidue(wt, TODAY);
    expect(m).toEqual({ to: `.agents/archive/${bs.RESIDUE_PREFIX}${TODAY}`, entries: ["PRISM-START.md"] });
    expect(fs.readFileSync(path.join(wt, ".agents", "AGENT.local.md"), "utf8")).toBe(SEAT);
    expect(fs.existsSync(path.join(wt, m.to, "AGENT.local.md"))).toBe(false);
  });

  it("S4: the import draft's folder-name fallback is the repository's name", () => {
    const { wt } = seatCheckout();
    bs.scaffold(wt, templateDir);
    const d = si.buildImportDraft(wt, TODAY, templateDir);
    expect(d.report.project).toEqual({ name: "agent-dashboard", version: "0.0.0", name_from: "folder" });
    expect(d.state.project.name).toBe("agent-dashboard");
  });

  it("S5: a plain repository (not a worktree) still names AGENT.md after its own folder", () => {
    const dir = repo(tmpBase(), "plain-proj");
    bs.scaffold(dir, templateDir);
    expect(fs.readFileSync(path.join(dir, ".agents", "AGENT.md"), "utf8").startsWith("---\nname: plain-proj\nrole: developer\n")).toBe(true);
  });

  it("S6: an owner rule that tracks AGENT.local.md fails scaffold's verify", () => {
    const { wt } = seatCheckout("/.agents/*\n!/.agents/AGENT.local.md\n");
    const r = bs.scaffold(wt, templateDir);
    expect(r.verify.ok).toBe(false);
    expect(r.verify.problems).toEqual([".agents/AGENT.local.md: must stay local, but git would track it"]);
  });

  it("S7: a TRACKED seat file with an edit is still an uncommitted change (only an untracked one is dropped)", () => {
    const { wt } = seatCheckout();
    git(wt, "add", "-f", ".agents/AGENT.local.md");
    git(wt, "commit", "-q", "-m", "track the seat file");
    fs.appendFileSync(path.join(wt, ".agents", "AGENT.local.md"), "edited\n");
    expect(bs.inspectProject(wt, templateDir).git).toEqual({ kind: "root", commits: true, dirty: [" M .agents/AGENT.local.md"], empty: false });
  });

  it("S8: a DIRECTORY named AGENT.local.md is residue, and its file is an uncommitted change", () => {
    const { wt } = seatCheckout();
    fs.rmSync(path.join(wt, ".agents", "AGENT.local.md"));
    fs.mkdirSync(path.join(wt, ".agents", "AGENT.local.md"));
    fs.writeFileSync(path.join(wt, ".agents", "AGENT.local.md", "x"), "x\n");
    const ins = bs.inspectProject(wt, templateDir);
    expect(ins.agents).toEqual({ kind: "residue", entries: ["AGENT.local.md/"] });
    expect(ins.git).toEqual({ kind: "root", commits: true, dirty: ["?? .agents/AGENT.local.md/x"], empty: false });
  });

  it("S9: an untracked AGENT.local.md outside .agents/ is still an uncommitted change", () => {
    const { wt } = seatCheckout();
    fs.mkdirSync(path.join(wt, "notes"));
    fs.writeFileSync(path.join(wt, "notes", "AGENT.local.md"), "x\n");
    expect(bs.inspectProject(wt, templateDir).git).toEqual({ kind: "root", commits: true, dirty: ["?? notes/AGENT.local.md"], empty: false });
  });
});
