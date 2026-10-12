import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { auditSkills, renderAudit } from "../src/pipelines/skills-audit/index.js";
import { deriveProjectKey } from "../src/pipelines/session-start/session-discovery.js";
import { takeSkillsAuditNotices } from "../src/shared/end-record-guard.js";

/**
 * T-262 part 2: Cursor transcripts, --seat / --transcript, the SessionEnd
 * unaudited-session flag, and /end step 1b.
 */

const cliEntry = join(import.meta.dirname, "../src/cli.ts");
const hookEntry = join(import.meta.dirname, "../src/cli-session-end.ts");
const tsxCli = join(import.meta.dirname, "../node_modules/tsx/dist/cli.mjs");
const repoRoot = join(import.meta.dirname, "../..");
const TIMEOUT = 120_000;
const U = (n: number): string => `aaaaaaaa-0000-4000-8000-00000000000${n}`;
const cursorKey = (dir: string): string => dir.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const sh = (cmd: string, name = "Bash") => ({
  type: "assistant",
  message: { content: [{ type: "tool_use", name, input: { command: cmd } }] },
});
const cur = (cmd: string) => ({
  role: "assistant",
  message: { content: [{ type: "tool_use", name: "Shell", input: { command: cmd } }] },
});
const times = <T>(n: number, mk: () => T): T[] => Array.from({ length: n }, mk);
const mtime = (n: number): number => 1_700_000_000 + n * 100;
const jsonl = (lines: unknown[]): string => lines.map((l) => (typeof l === "string" ? l : JSON.stringify(l))).join("\n") + "\n";

describe("t262 part 2", { timeout: TIMEOUT }, () => {
  let home: string;
  let proj: string;
  const claudeDir = (): string => join(home, ".claude", "projects", deriveProjectKey(proj));
  const cursorDir = (): string => join(home, ".cursor", "projects", cursorKey(proj), "agent-transcripts");

  function writeClaude(uuid: string, sec: number, lines: unknown[]): string {
    mkdirSync(claudeDir(), { recursive: true });
    const p = join(claudeDir(), `${uuid}.jsonl`);
    writeFileSync(p, jsonl(lines));
    utimesSync(p, sec, sec);
    return p;
  }
  function writeCursor(uuid: string, sec: number, lines: unknown[]): string {
    const d = join(cursorDir(), uuid);
    mkdirSync(d, { recursive: true });
    const p = join(d, `${uuid}.jsonl`);
    writeFileSync(p, jsonl(lines));
    utimesSync(p, sec, sec);
    return p;
  }

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "t262p2-home-"));
    proj = mkdtempSync(join(tmpdir(), "t262p2-proj-"));
    mkdirSync(join(proj, ".agents"), { recursive: true });
    writeFileSync(join(proj, ".agents", "AGENT.local.md"), "---\nname: Testseat\nrole: planner\n---\n");
  });
  afterEach(() => {
    for (const d of [home, proj]) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  describe("auditSkills", () => {
    it("P2-1 reads a Cursor session and ignores Claude-shaped lines in it", () => {
      writeCursor(U(1), mtime(1), [...times(3, () => cur("git fetch")), ...times(3, () => sh("git log"))]);
      const r = auditSkills({ projectDir: proj, home, runtime: "cursor" });
      expect(r.rows).toEqual([{ key: "git fetch", thisSession: 3, sessions: 1, windowTotal: 3, status: "by-hand" }]);
      expect(r.runtime).toBe("cursor");
    });

    it("P2-2 a session is a uuid directory; the newest is first; stray files are not read", () => {
      writeCursor(U(1), mtime(1), times(3, () => cur("git fetch")));
      writeCursor(U(2), mtime(2), times(3, () => cur("git fetch")));
      writeFileSync(join(cursorDir(), "x.jsonl"), jsonl(times(3, () => cur("git push"))));
      const r = auditSkills({ projectDir: proj, home, runtime: "cursor" });
      expect(r.window).toEqual([U(2), U(1)]);
      expect(r.rows.find((x) => x.key === "git push")).toBeUndefined();
    });

    it("P2-3 the default runtime does not read Cursor-shaped lines", () => {
      writeClaude(U(1), mtime(1), times(3, () => cur("git fetch")));
      const r = auditSkills({ projectDir: proj, home });
      expect(r.rows).toEqual([]);
      expect(r.shellCalls).toBe(0);
      expect(r.runtime).toBe("claude");
    });

    it("P2-4 --seat replaces the identity lookup", () => {
      rmSync(join(proj, ".agents", "AGENT.local.md"));
      mkdirSync(join(home, ".claude", "skills", "clark-ops", "scripts"), { recursive: true });
      writeFileSync(join(home, ".claude", "skills", "clark-ops", "scripts", "stamp.sh"), "echo");
      writeClaude(U(1), mtime(1), times(3, () => sh("bash C:/x/stamp.sh a")));
      const without = auditSkills({ projectDir: proj, home });
      expect(without.seat).toBeNull();
      expect(without.rows[0].status).toBe("by-hand");
      const withSeat = auditSkills({ projectDir: proj, home, seat: "Clark" });
      expect(withSeat.seat).toBe("clark");
      expect(withSeat.rows[0].status).toBe("script");
      expect(withSeat.scriptsCalled).toEqual([{ script: "stamp.sh", count: 3 }]);
    });

    it("P2-5 --transcript names this session and ignores session", () => {
      const p1 = writeClaude(U(1), mtime(1), times(3, () => sh("git fetch")));
      writeClaude(U(2), mtime(2), times(3, () => sh("git log")));
      const r = auditSkills({ projectDir: proj, home, transcript: p1 });
      expect(r.session).toBe(U(1));
      expect(r.window).toEqual([U(1)]);
    });

    it("P2-6 the render names the runtime when it is cursor", () => {
      writeCursor(U(1), mtime(1), times(3, () => cur("git fetch")));
      const r = auditSkills({ projectDir: proj, home, runtime: "cursor" });
      expect(renderAudit(r).split("\n")[0]).toMatch(/ · cursor$/);
    });
  });

  describe("CLI", () => {
    const run = (args: string[]) =>
      spawnSync(process.execPath, [tsxCli, cliEntry, ...args], {
        cwd: proj,
        encoding: "utf8",
        env: { ...process.env, HOME: home, USERPROFILE: home },
        timeout: 90_000,
      });

    it("P2-7 --runtime and --seat are parsed and validated", () => {
      writeCursor(U(1), mtime(1), times(3, () => cur("git fetch")));
      const ok = run(["skills-audit", "--runtime", "cursor", proj]);
      expect(ok.status).toBe(0);
      expect(ok.stdout.split("\n")[0]).toContain("· cursor");
      const bad = run(["skills-audit", "--runtime", "vim", proj]);
      expect(bad.status).toBe(1);
      expect(bad.stderr).toContain("Invalid --runtime");
      const badSeat = run(["skills-audit", "--seat", "a b", proj]);
      expect(badSeat.status).toBe(1);
      expect(badSeat.stderr).toContain("Invalid --seat");
    });
  });

  describe("SessionEnd flag", () => {
    let kdb: string;
    let prevKdb: string | undefined;
    const git = (...a: string[]) => spawnSync("git", a, { cwd: proj, encoding: "utf8" });
    const hook = (payload: Record<string, unknown>) =>
      spawnSync(process.execPath, [tsxCli, hookEntry], {
        cwd: proj,
        input: JSON.stringify(payload),
        encoding: "utf8",
        timeout: 90_000,
        env: { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_PROJECT_DIR: proj, KNOWLEDGE_V2_DB: kdb },
      });
    const payloadFor = (t: string) => ({ session_id: U(1), transcript_path: t, hook_event_name: "SessionEnd" });
    const transcript = (extra: unknown[] = [], fetches = 3): string => {
      const p = join(home, `${U(1)}.jsonl`);
      writeFileSync(p, jsonl([...times(fetches, () => sh("git fetch")), sh("git log"), ...extra]));
      return p;
    };

    beforeEach(() => {
      kdb = join(home, "kv2", "knowledge-v2.db");
      mkdirSync(join(home, "kv2"), { recursive: true });
      prevKdb = process.env.KNOWLEDGE_V2_DB;
      process.env.KNOWLEDGE_V2_DB = kdb;
      git("init", "-q");
      git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "init");
    });
    afterEach(() => {
      if (prevKdb === undefined) delete process.env.KNOWLEDGE_V2_DB;
      else process.env.KNOWLEDGE_V2_DB = prevKdb;
    });

    it("H-1 an unaudited session with by-hand hits is named, once", () => {
      const r = hook(payloadFor(transcript()));
      expect(r.status).toBe(0);
      expect(r.stdout).toContain("SKILLS AUDIT NOT RUN: session aaaaaaaa");
      expect(r.stdout).toContain("git fetch ×3");
      const notices = takeSkillsAuditNotices(proj);
      expect(notices).toHaveLength(1);
      expect(notices[0]).toContain("SKILLS AUDIT NOT RUN: session aaaaaaaa");
      expect(takeSkillsAuditNotices(proj)).toEqual([]);
    });

    it("H-2 a session that ran the audit is not named", () => {
      const r = hook(payloadFor(transcript([sh("node C:/b/cli.js skills-audit .")])));
      expect(r.stdout).toContain("skills-audit check: audited in session");
      expect(takeSkillsAuditNotices(proj)).toEqual([]);
    });

    it("H-3 below the threshold is not named", () => {
      const r = hook(payloadFor(transcript([], 2)));
      expect(r.stdout).toContain("not audited, 0 by-hand hits");
      expect(takeSkillsAuditNotices(proj)).toEqual([]);
    });

    it("H-4 a doubled hook writes one notice", () => {
      const t = transcript();
      hook(payloadFor(t));
      hook(payloadFor(t));
      expect(takeSkillsAuditNotices(proj)).toHaveLength(1);
    });

    it("H-5 no .agents, no check", () => {
      rmSync(join(proj, ".agents"), { recursive: true, force: true });
      const r = hook(payloadFor(transcript()));
      expect(r.stdout).not.toContain("skills-audit check");
      expect(r.stdout).not.toContain("SKILLS AUDIT");
    });

    it("H-6 a missing transcript prints nothing and exits 0", () => {
      const r = hook(payloadFor(join(home, "missing.jsonl")));
      expect(r.status).toBe(0);
      expect(r.stdout).not.toContain("SKILLS AUDIT");
    });
  });

  describe("docs", () => {
    const read = (rel: string): string => readFileSync(join(repoRoot, rel), "utf8");
    it("D-1 step 1b is in all three end.md files", () => {
      const a = read(".claude/commands/end.md");
      const b = read("project-template/.claude/commands/end.md");
      const c = read("project-template/.cursor/commands/end.md");
      for (const t of [a, b, c]) {
        expect(t).toContain("## 1b. Audit the commands you repeated (D-152)");
        expect(t).toContain("Skills audit: {n} hits");
      }
      expect(a).toBe(b);
      expect(c).toContain("skills-audit --runtime cursor [--seat <name>]");
      expect(a).not.toContain("--runtime");
      expect(b).not.toContain("--runtime");
      expect(existsSync(join(repoRoot, ".claude/commands/end.md"))).toBe(true);
    });
  });
});
