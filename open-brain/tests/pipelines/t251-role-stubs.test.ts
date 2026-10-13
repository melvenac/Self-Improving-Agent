/**
 * T-251 (docs/loops/t251-role-stubs-brief.md): an adopted project gets four
 * role-file STUBS from project-template (never SIA's own role files), git
 * tracks them, `state import --commit` installs the missing ones without
 * overwriting the owner's, and the imported handoff is seated by the role the
 * project declares. Plus T-184's follow-up: FUTURE_LOCAL names the draft's
 * input record.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import * as realFs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as cp from "node:child_process";

/** A path fragment: the next write whose path contains it throws. */
const inject = { writeOn: null as string | null };
vi.mock("node:fs", async (importOriginal) => {
  const a = await importOriginal<typeof import("node:fs")>();
  const norm = (p: unknown) => String(p).replace(/\\/g, "/");
  const writeFileSync = ((p: realFs.PathOrFileDescriptor, ...rest: unknown[]) => {
    if (inject.writeOn && norm(p).includes(inject.writeOn)) throw new Error(`induced failure writing ${norm(p)}`);
    return (a.writeFileSync as (...x: unknown[]) => void)(p, ...rest);
  }) as typeof a.writeFileSync;
  return { ...a, default: { ...a, writeFileSync }, writeFileSync };
});

const si = await import("../../src/pipelines/state-import/index.js");
const bs = await import("../../src/pipelines/bootstrap/index.js");
const schema = await import("../../src/shared/state-schema.js");

const repoRoot = path.join(import.meta.dirname, "../../..");
const templateDir = path.join(repoRoot, "project-template");
const fixture = path.join(import.meta.dirname, "../fixtures-import");
const TODAY = "2026-09-14";
const NAMES = ["shared", "planner", "developer", "qa"] as const;
const STUBS = NAMES.map((n) => `.agents/roles/${n}.md`);
const PERSONAL_NAMES = /\b(Aaron|Clark|melve)\b/i;

const tmps: string[] = [];
afterEach(() => {
  inject.writeOn = null;
  for (const d of tmps.splice(0)) realFs.rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

function tmp(prefix: string): string {
  const d = realFs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmps.push(d);
  return d;
}

function git(cwd: string, ...args: string[]): string {
  return cp.execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** A project with one commit and no SIA files; `gitignore` is the owner's own, when given. */
function gitProject(gitignore?: string): string {
  const dir = tmp("t251-scratch-");
  realFs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "scratch-proj", version: "0.1.0" }) + "\n");
  if (gitignore !== undefined) realFs.writeFileSync(path.join(dir, ".gitignore"), gitignore);
  git(dir, "init", "-q", "-b", "master");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "T");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "the project before SIA");
  return dir;
}

/** The import fixture, optionally with an AGENT.md / AGENT.local.md declaring a role. */
function importProject(agent?: string | null, local?: string): string {
  const root = tmp("t251-import-");
  realFs.cpSync(fixture, root, { recursive: true });
  if (agent !== undefined && agent !== null) realFs.writeFileSync(path.join(root, ".agents/AGENT.md"), agent);
  if (local !== undefined) realFs.writeFileSync(path.join(root, ".agents/AGENT.local.md"), local);
  return root;
}

const declare = (role: string) => `---\nname: Someone\nrole: ${role}\npartner: none\n---\n\n# Seat\n`;

function tree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    const names = realFs.readdirSync(d);
    if (names.length === 0 && d !== dir) out[path.relative(dir, d).replace(/\\/g, "/") + "/"] = "";
    for (const n of names) {
      const p = path.join(d, n);
      if (realFs.statSync(p).isDirectory()) walk(p);
      else out[path.relative(dir, p).replace(/\\/g, "/")] = realFs.readFileSync(p).toString("hex");
    }
  };
  walk(dir);
  return out;
}

describe("T-251: role-file stubs, the handoff seat, and the inputs record", () => {
  it("N1: four stubs ship in the template, none is SIA's own, each is short and impersonal; shared.md has Hub transport", () => {
    for (const n of NAMES) {
      const stub = path.join(templateDir, ".agents/roles", `${n}.md`);
      expect(realFs.existsSync(stub), `${n}.md in project-template`).toBe(true);
      const text = realFs.readFileSync(stub, "utf8");
      expect(text).not.toBe(realFs.readFileSync(path.join(repoRoot, ".agents/roles", `${n}.md`), "utf8"));
      expect(text.replace(/\n$/, "").split(/\r?\n/).length).toBeLessThanOrEqual(25);
      expect(text).not.toMatch(PERSONAL_NAMES);
      expect(text.startsWith("Starting stub: replace with this project's own rules.")).toBe(true);
    }
    expect(realFs.readFileSync(path.join(templateDir, ".agents/roles/shared.md"), "utf8")).toMatch(/^## Hub transport$/m);
  });

  it("N2: scaffold writes the four stubs as tracked, and git does not ignore them", () => {
    const dir = gitProject();
    const r = bs.scaffold(dir, templateDir);
    for (const p of STUBS) {
      expect(r.written.find((w) => w.path === p), p).toMatchObject({ path: p, tracked: true });
      expect(cp.spawnSync("git", ["check-ignore", "-q", "--no-index", p], { cwd: dir }).status, p).toBe(1);
    }
    expect(r.verify).toEqual({ ok: true, problems: [] });
  });

  it("N3: --commit installs the missing stubs and keeps the owner's own role file byte for byte", () => {
    const root = importProject();
    realFs.mkdirSync(path.join(root, ".agents/roles"), { recursive: true });
    realFs.writeFileSync(path.join(root, ".agents/roles/planner.md"), "# mine\n");
    si.runDraft(root, TODAY);
    const r = si.runCommit(root, TODAY);
    expect(realFs.readFileSync(path.join(root, ".agents/roles/planner.md"), "utf8")).toBe("# mine\n");
    for (const n of ["shared", "developer", "qa"]) {
      expect(realFs.readFileSync(path.join(root, ".agents/roles", `${n}.md`)).equals(realFs.readFileSync(path.join(templateDir, ".agents/roles", `${n}.md`))), n).toBe(true);
    }
    expect((r as unknown as { role_stubs: unknown }).role_stubs).toEqual({
      installed: [".agents/roles/shared.md", ".agents/roles/developer.md", ".agents/roles/qa.md"],
      kept: [".agents/roles/planner.md"],
      missing: [],
    });
  });

  it("N4: a failure writing a stub rolls the whole commit back", () => {
    const root = importProject();
    si.runDraft(root, TODAY);
    const before = tree(root);
    inject.writeOn = ".agents/roles/";
    expect(() => si.runCommit(root, TODAY)).toThrow(/Rolled back/);
    inject.writeOn = null;
    expect(tree(root)).toEqual(before);
  });

  describe("N5: the handoff is seated by the declared role", () => {
    const seatOf = (root: string) => {
      const d = si.runDraft(root, TODAY);
      expect(d.validation.ok).toBe(true);
      return { h: d.draft.state.handoffs[0], rep: (d.draft.report as unknown as { handoff_seat: unknown }).handoff_seat };
    };
    it("role: planner → planner, with an empty loop_state, and the draft validates", () => {
      const { h, rep } = seatOf(importProject(declare("planner")));
      expect(h.seat).toBe("planner");
      expect(h.loop_state).toEqual({ open_prs: [], frozen_sha: null, questions_for_aaron: [], rulings: [] });
      expect(h.checkout).toBeNull();
      expect(h.session_uuid).toBeNull();
      expect(h.first_rev).toBeNull();
      expect(rep).toEqual({ seat: "planner", declared_role: "planner", assumed: false });
    });
    it("role: qa → qa", () => {
      const { h, rep } = seatOf(importProject(declare("qa")));
      expect(h.seat).toBe("qa");
      expect(h.loop_state).toBeNull();
      expect(rep).toEqual({ seat: "qa", declared_role: "qa", assumed: false });
    });
    for (const [label, agent, declared] of [
      ["role: none", declare("none"), "none"],
      ["role: builder", declare("builder"), "builder"],
      ["role: Planner (capital)", declare("Planner"), "Planner"],
      ["a <?> placeholder", declare("<role>"), null],
      ["no AGENT.md", null, null],
    ] as const) {
      it(`${label} → developer, assumed`, () => {
        const { h, rep } = seatOf(importProject(agent));
        expect(h.seat).toBe("developer");
        expect(h.loop_state).toBeNull();
        expect(rep).toEqual({ seat: "developer", declared_role: declared, assumed: true });
      });
    }
    it("AGENT.local.md saying qa wins over AGENT.md saying planner", () => {
      const { h } = seatOf(importProject(declare("planner"), declare("qa")));
      expect(h.seat).toBe("qa");
    });
  });

  it("N6: after --commit a planner reads its own handoff, and the developer lookup finds none", () => {
    const root = importProject(declare("planner"));
    const text = realFs.readFileSync(path.join(root, ".agents/SESSIONS/next-session.md"), "utf8");
    const expected = si.importHandoff(text, 0, { pick_up_lines: 0, watch_out: 0, open_questions: 0, sections_not_imported: [], not_imported: [] }).pick_up;
    expect(expected.length).toBeGreaterThan(0);
    si.runDraft(root, TODAY);
    si.runCommit(root, TODAY);
    const parsed = schema.parseState(realFs.readFileSync(path.join(root, si.STATE_REL), "utf8"));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(schema.ownHandoff(parsed.data.handoffs, "planner")?.pick_up).toBe(expected);
    expect(schema.ownHandoff(parsed.data.handoffs, "developer")).toBeNull();
  });

  it("N7: an owner rule that tracks the draft's input record fails scaffold's verify", () => {
    const dir = gitProject("/.agents/*\n!/.agents/state.draft.inputs.json\n");
    const r = bs.scaffold(dir, templateDir);
    expect(r.verify.ok).toBe(false); // the CLI exits `r.verify.ok ? 0 : 1`
    expect(r.verify.problems).toEqual([".agents/state.draft.inputs.json: must stay local, but git would track it"]);
  });
});
