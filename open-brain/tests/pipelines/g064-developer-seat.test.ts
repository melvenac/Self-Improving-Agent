/**
 * G-064: a project bootstrapped with one agent was scaffolded `role: none`, so its checkout could never be shown its own
 * handoff: set_handoff takes only planner/developer/qa, and ob_start names no handoff as "yours" while the reader's seat
 * is unresolved (mail-server, 10-20). The scaffold now declares the one seat `developer`, the seat the import already
 * assumes for the handoff (T-251).
 */
import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as cp from "node:child_process";
import * as bs from "../../src/pipelines/bootstrap/index.js";
import { readAgentIdentity } from "../../src/pipelines/session-start/agent-identity.js";
import { describeRoleFiles } from "../../src/pipelines/session-start/role-files.js";
import { ownHandoff, parseState } from "../../src/shared/state-schema.js";

const repoRoot = path.join(import.meta.dirname, "../../..");
const templateDir = path.join(repoRoot, "project-template");
const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) fs.rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});
const git = (cwd: string, ...args: string[]): string =>
  cp.execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=T", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/** A committed one-file project in a folder named `solo-proj`; realpath.native because some hosts hand out an 8.3 temp path. */
function soloProject(): string {
  const base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "g064-")));
  tmps.push(base);
  const dir = path.join(base, "solo-proj");
  fs.mkdirSync(dir);
  git(dir, "init", "-q", "-b", "master");
  fs.writeFileSync(path.join(dir, "README.md"), "# solo\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "before SIA");
  return dir;
}

describe("G-064: the scaffold declares the one seat developer", { timeout: 60_000 }, () => {
  it("G1: scaffold writes AGENT.md as the developer seat, and the identity resolves to it", () => {
    const dir = soloProject();
    bs.scaffold(dir, templateDir);
    const agentMd = fs.readFileSync(path.join(dir, ".agents", "AGENT.md"), "utf8");
    expect(agentMd.startsWith("---\nname: solo-proj\nrole: developer\n")).toBe(true);
    expect(agentMd).toContain("# solo-proj — the developer seat");
    expect(agentMd).toContain(bs.SCAFFOLD_SIGNATURE);
    expect(readAgentIdentity(dir)?.role).toBe("developer");
  });

  it("G2: that identity finds a developer handoff as its own, where role: none found none", () => {
    const dir = soloProject();
    bs.scaffold(dir, templateDir);
    const raw = JSON.parse(fs.readFileSync(path.join(repoRoot, "open-brain", "tests", "fixtures-state", "state.json"), "utf8"));
    raw.handoffs = [{ ...raw.handoffs[0], seat: "developer", pick_up: "G064 PICK UP" }];
    const parsed = parseState(JSON.stringify(raw));
    if (!parsed.ok) throw new Error(parsed.error);
    const role = readAgentIdentity(dir)!.role as "developer";
    expect(ownHandoff(parsed.data.handoffs, role)?.pick_up).toBe("G064 PICK UP");
  });

  it("G3: the scaffolded seat's role files are found (no MISSING, no NOT A SEAT)", () => {
    const dir = soloProject();
    bs.scaffold(dir, templateDir);
    const r = describeRoleFiles(dir, readAgentIdentity(dir));
    const text = [...r.lines, ...r.problems].join("\n");
    expect(text).not.toContain("NOT A SEAT");
    expect(text).not.toContain("ROLE FILE MISSING");
    expect(r.files.map((f) => f.rel)).toEqual([".agents/roles/developer.md", ".agents/roles/shared.md"]);
  });

  it("G4: a checkout that still declares role: none is told how to become the developer seat", () => {
    const dir = soloProject();
    fs.mkdirSync(path.join(dir, ".agents"));
    fs.writeFileSync(path.join(dir, ".agents", "AGENT.local.md"), "---\nname: solo\nrole: none\npartner:\n---\n");
    const text = describeRoleFiles(dir, readAgentIdentity(dir)).lines.join("\n");
    expect(text).toContain("NOT A SEAT");
    expect(text).toContain("If an agent works here, declare role: developer in .agents/AGENT.md.");
  });
});
