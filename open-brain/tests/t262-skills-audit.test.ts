import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { GENERIC_PROGRAMS, commandKeys, auditSkills, renderAudit } from "../src/pipelines/skills-audit/index.js";
import { deriveProjectKey } from "../src/pipelines/session-start/session-discovery.js";

/**
 * T-262 part 1: `open-brain skills-audit`, a read-only extractor of the shell
 * commands a session repeated.
 */

const cliEntry = join(import.meta.dirname, "../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../node_modules/tsx/dist/cli.mjs");
const denyPath = join(import.meta.dirname, "fixtures/deny-sqlite.mjs");
const TIMEOUT = 120_000;

describe("commandKeys", { timeout: TIMEOUT }, () => {
  it("K1 splits on && and keeps program plus subcommand", () => {
    expect(commandKeys("cd C:/x && git fetch origin -q && git log --oneline -3")).toEqual(["git fetch", "git log"]);
  });
  it("K2 resolves a script run through bash after an assignment", () => {
    expect(commandKeys('S=C:/a/scripts; bash $S/records-pr.sh docs/x "C:/m.txt"')).toEqual(["bash records-pr.sh"]);
  });
  it("K3 node -e", () => {
    expect(commandKeys('node -e "const a=1; for(const x of y){}"')).toEqual(["node -e"]);
  });
  it("K4 gh takes two words, jq is generic", () => {
    expect(commandKeys("gh pr view 602 --json state | jq .state")).toEqual(["gh pr view"]);
  });
  it("K5 heredoc bodies are data", () => {
    expect(commandKeys("cat > f <<'EOF'\ngit push\nEOF")).toEqual([]);
  });
  it("K6 generic tools only", () => {
    expect(commandKeys("grep -n x f | head")).toEqual([]);
  });
  it("K7 a windows path and an env assignment", () => {
    expect(commandKeys(String.raw`HUB_URL=http://h:4000 node C:\tools\hub-talk.mjs --as atlas`)).toEqual(["node hub-talk.mjs"]);
  });
  it("K8 deduplicates within one command", () => {
    expect(commandKeys("git add a && git add b")).toEqual(["git add"]);
  });
  it("K9 npx", () => {
    expect(commandKeys("npx vitest run tests/a.test.ts")).toEqual(["npx vitest"]);
  });
  it("K10 powershell generics", () => {
    expect(commandKeys("Get-Content f | Select-Object -First 3")).toEqual([]);
  });
  it("K11 quoted separators do not split", () => {
    expect(commandKeys('git commit -q -m "a; git push\nmore && gh pr merge"')).toEqual(["git commit"]);
  });
  it("K12 a loop body is not counted (stated limit)", () => {
    expect(commandKeys("for i in 1 2; do gh pr checks 602; sleep 5; done")).toEqual([]);
  });
  it("K13 GENERIC_PROGRAMS has 50 entries", () => {
    expect(GENERIC_PROGRAMS.size).toBe(50);
  });
});

describe("auditSkills", { timeout: TIMEOUT }, () => {
  let home: string;
  let proj: string;
  const U = (n: number): string => `aaaaaaaa-0000-4000-8000-00000000000${n}`;
  const tdir = (): string => join(home, ".claude", "projects", deriveProjectKey(proj));

  const sh = (cmd: string, name = "Bash") => ({
    type: "assistant",
    message: { content: [{ type: "tool_use", name, input: { command: cmd } }] },
  });
  const times = (n: number, cmd: string, name = "Bash") => Array.from({ length: n }, () => sh(cmd, name));

  function writeSession(uuid: string, mtimeSec: number, lines: unknown[]): void {
    mkdirSync(tdir(), { recursive: true });
    const p = join(tdir(), `${uuid}.jsonl`);
    writeFileSync(p, lines.map((l) => (typeof l === "string" ? l : JSON.stringify(l))).join("\n") + "\n");
    utimesSync(p, mtimeSec, mtimeSec);
  }
  const mtime = (n: number): number => 1_700_000_000 + n * 100;
  const opsDir = (): string => join(home, ".claude", "skills", "testseat-ops");
  function makeOps(): void {
    mkdirSync(join(opsDir(), "scripts"), { recursive: true });
    writeFileSync(join(opsDir(), "scripts", "foo.sh"), "echo");
  }
  const fixtureSa3 = (): void => {
    makeOps();
    writeSession(U(1), mtime(1), [...times(3, "bash C:/s/foo.sh a"), sh('node -e "x"')]);
  };

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "t262-home-"));
    proj = mkdtempSync(join(tmpdir(), "t262-proj-"));
    mkdirSync(join(proj, ".agents"), { recursive: true });
    writeFileSync(join(proj, ".agents", "AGENT.local.md"), "---\nname: Testseat\nrole: planner\n---\n");
  });
  afterEach(() => {
    for (const d of [home, proj]) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("SA-1 counts hits at 3 or more", () => {
    writeSession(U(1), mtime(1), [...times(3, "git fetch"), ...times(2, "git log")]);
    const r = auditSkills({ projectDir: proj, home });
    expect(r.rows).toEqual([{ key: "git fetch", thisSession: 3, sessions: 1, windowTotal: 3, status: "by-hand" }]);
  });

  it("SA-2 the newest session is this one, the window runs newest first", () => {
    writeSession(U(1), mtime(1), times(1, "git fetch"));
    writeSession(U(2), mtime(2), times(3, "git fetch"));
    const r = auditSkills({ projectDir: proj, home });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ thisSession: 3, sessions: 2, windowTotal: 4 });
    expect(r.window).toEqual([U(2), U(1)]);
  });

  it("SA-3 a key naming a script in the ops directory is status script", () => {
    fixtureSa3();
    const r = auditSkills({ projectDir: proj, home });
    expect(r.rows.find((x) => x.key === "bash foo.sh")?.status).toBe("script");
    expect(r.scriptsCalled).toEqual([{ script: "foo.sh", count: 3 }]);
  });

  it("SA-4 audit-ignore.txt keys are counted, not listed", () => {
    makeOps();
    writeFileSync(join(opsDir(), "audit-ignore.txt"), "# comment\n\ngh pr view # read-only lookups\n");
    writeSession(U(1), mtime(1), times(3, "gh pr view 1"));
    const r = auditSkills({ projectDir: proj, home });
    expect(r.rows).toEqual([]);
    expect(r.ignoredHits).toBe(1);
  });

  it("SA-5 sidechains, user lines and non-shell tools are not shell calls", () => {
    writeSession(U(1), mtime(1), [
      ...times(3, "git push").map((l) => ({ ...l, isSidechain: true })),
      ...times(3, "git push").map((l) => ({ ...l, type: "user" })),
      ...times(3, "git push", "Read"),
    ]);
    const r = auditSkills({ projectDir: proj, home });
    expect(r.rows).toEqual([]);
    expect(r.shellCalls).toBe(0);
  });

  it("SA-6 an unparseable line is counted", () => {
    writeSession(U(1), mtime(1), [...times(3, "git push"), "not json"]);
    const r = auditSkills({ projectDir: proj, home });
    expect(r.unparsed).toBe(1);
    expect(r.shellCalls).toBe(3);
  });

  it("SA-7 the window is 5 files by default, and ends at --session", () => {
    for (let n = 1; n <= 6; n++) writeSession(U(n), mtime(n), times(3, "git fetch"));
    const r = auditSkills({ projectDir: proj, home });
    expect(r.window).toHaveLength(5);
    expect(r.rows[0]).toMatchObject({ sessions: 5, windowTotal: 15 });
    const r3 = auditSkills({ projectDir: proj, home, session: U(3) });
    expect(r3.window).toEqual([U(3), U(2), U(1)]);
  });

  it("SA-8 a seat with no ops directory has only by-hand keys", () => {
    writeSession(U(1), mtime(1), times(3, "bash foo.sh"));
    const r = auditSkills({ projectDir: proj, home });
    expect(r.opsDir).toBeNull();
    expect(r.rows[0].status).toBe("by-hand");
    expect(r.scriptsCalled).toEqual([]);
  });

  it("SA-9 subagent transcripts in subdirectories are never read", () => {
    mkdirSync(join(tdir(), U(1), "subagents"), { recursive: true });
    writeFileSync(join(tdir(), U(1), "subagents", "x.jsonl"), times(3, "git push").map((l) => JSON.stringify(l)).join("\n") + "\n");
    writeSession(U(1), mtime(1), times(3, "git log"));
    const r = auditSkills({ projectDir: proj, home });
    expect(r.rows.map((x) => x.key)).toEqual(["git log"]);
  });

  it("SA-10 PowerShell calls count", () => {
    writeSession(U(1), mtime(1), times(3, "git status", "PowerShell"));
    const r = auditSkills({ projectDir: proj, home });
    expect(r.rows[0]).toMatchObject({ key: "git status", thisSession: 3 });
  });

  it("SA-11 writes nothing", () => {
    fixtureSa3();
    const snap = (): string[] => {
      const out: string[] = [];
      const walk = (d: string): void => {
        for (const e of readdirSync(d, { withFileTypes: true })) {
          const p = join(d, e.name);
          const s = statSync(p);
          out.push(`${p}|${s.size}|${s.mtimeMs}`);
          if (e.isDirectory()) walk(p);
        }
      };
      walk(home);
      walk(proj);
      return out.sort();
    };
    const before = snap();
    renderAudit(auditSkills({ projectDir: proj, home }));
    expect(snap()).toEqual(before);
  });

  it("SA-12 renders the report exactly", () => {
    fixtureSa3();
    const r = auditSkills({ projectDir: proj, home });
    expect(renderAudit(r)).toBe(
      `skills-audit: seat testseat · ops ${r.opsDir} · session aaaaaaaa · window 1 sessions · 4 shell calls · 0 unparsed lines\n` +
        "this  sess  window  status   key\n" +
        "   3     1       3  script   bash foo.sh\n" +
        "hits: 0 by-hand, 1 script, 0 ignored\n" +
        "scripts called: foo.sh×3",
    );
  });

  describe("CLI", () => {
    const run = (args: string[], extraEnv: Record<string, string> = {}) =>
      spawnSync(process.execPath, [tsxCli, cliEntry, ...args], {
        cwd: proj,
        encoding: "utf8",
        env: { ...process.env, HOME: home, USERPROFILE: home, ...extraEnv },
        timeout: 90_000,
      });
    const deny = (): Record<string, string> => ({ NODE_OPTIONS: `--import=${pathToFileURL(denyPath).href}` });

    it("SC-1 runs with no sqlite available", () => {
      fixtureSa3();
      const r = run(["skills-audit", proj], deny());
      expect(r.status).toBe(0);
      expect(r.stdout.split("\n")[0]).toMatch(/^skills-audit: seat testseat/);
      expect(r.stderr).not.toContain("T-154 deny");
    });

    it("SC-2 --json", () => {
      fixtureSa3();
      const r = run(["skills-audit", "--json", proj]);
      expect(r.status).toBe(0);
      expect(JSON.parse(r.stdout).rows[0].key).toBe("bash foo.sh");
    });

    it("SC-3 no transcripts", () => {
      const r = run(["skills-audit", proj]);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("skills-audit: no transcripts for");
    });

    it("SC-4 --last=0 is refused", () => {
      fixtureSa3();
      const r = run(["skills-audit", "--last=0", proj]);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("Invalid --last");
    });

    it("SC-5 an unknown --session", () => {
      fixtureSa3();
      const r = run(["skills-audit", "--session", "aaaaaaaa-0000-4000-8000-000000000009", proj]);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("skills-audit: no transcript");
    });
  });
});
