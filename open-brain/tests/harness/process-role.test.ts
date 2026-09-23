/**
 * Candidate A — a role that is a REAL PROCESS.
 *
 * Every role here is spawned by the runtime through `ProcessRole`: a Node
 * script launched with no shell, fed its prompt on stdin, bounded in time, and
 * read back from a deliverable file outside the repository. The rows are the
 * ones only a process can exercise: windows that close after EXIT (CA-1), a
 * constructed environment and argv byte-for-byte (CA-2), the launcher refusals
 * (CA-2.5, CA-3), the tree kill (CA-6) and the report (CA-7).
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runLoop, LoopRefused, type LoopConfig } from "../../src/harness/runtime.js";
import {
  CLAUDE_ADAPTER_FLAGS,
  claudeAdapter,
  commandAdapter,
  ProcessRole,
  StubPlanner,
  StubQa,
  type RoleContext,
} from "../../src/harness/roles.js";
import { findOnPath, resolveLauncher, TREE_KILL_STATEMENT, WIN32_NORMAL_EXIT_NOTE } from "../../src/harness/process.js";
import { pinFor } from "../../src/harness/git.js";
import { exitingCheck, exitingChecks, makeRepo, rawGit, requireGit, type RepoFixture } from "./fixture.js";
import {
  heartbeatCode,
  markerLines,
  pidAlive,
  scratch,
  sizeOf,
  sleep,
  writeMarkerScript,
  writeRoleProcess,
  type RoleProcessConfig,
} from "./candidate-a-fixture.js";

const isWin = process.platform === "win32";

describe("candidate A — a role that is a real process", { timeout: 180_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };
  const stray: number[] = [];

  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("harness-proc-");
    tmp = scratch("harness-proc-out-");
  });
  afterEach(async () => {
    // A test that leaves a grandchild alive on purpose (the win32 limit) must
    // not leave it running past the test.
    for (const pid of stray.splice(0)) {
      try {
        process.kill(pid);
      } catch {
        // already gone
      }
    }
    await repo.cleanup();
    await tmp.cleanup();
  });

  const WRITE = { path: "artifacts/iterations/t001/dev.md", content: "written by a process\n" };

  const roleFor = (cfg: RoleProcessConfig, extra: { timeoutMs?: number; parentEnv?: NodeJS.ProcessEnv; envAllow?: string[]; args?: string[] } = {}) => {
    const { script, config } = writeRoleProcess(tmp.dir, cfg, `role-${Math.random().toString(36).slice(2, 8)}`);
    return new ProcessRole("developer", {
      adapter: commandAdapter(script, [config, ...(extra.args ?? [])], extra.envAllow ?? []),
      timeoutMs: extra.timeoutMs ?? 60_000,
      parentEnv: extra.parentEnv,
    });
  };

  const loopWith = (developer: ProcessRole, over: Partial<LoopConfig> = {}): LoopConfig => ({
    repoRoot: repo.root,
    loop: "t001",
    roles: { planner: new StubPlanner(), developer, qa: new StubQa() },
    checks: exitingChecks(0, 0),
    log: () => {},
    ...over,
  });

  /* --------------------------------------------------------------------- *
   * CA-1 — every window closes after the process EXITS
   * --------------------------------------------------------------------- */

  describe("CA-1 — delayed writes are seen, and attributed to the stage that wrote them", () => {
    it("a role that sleeps, then writes a ref and plants a hook, fails ITS stage on both", async () => {
      const marker = join(tmp.dir, "marker.txt");
      const hook = writeMarkerScript(join(tmp.dir, "hook.sh"), marker, "delayed");
      const r = await runLoop(
        loopWith(
          roleFor({
            writes: [WRITE],
            sleepBeforeMs: 2000,
            git: [["update-ref", "refs/tags/delayed", "HEAD"]],
            plant: [{ path: ".git/hooks/post-commit", content: readFileSync(hook, "utf-8"), mode: 0o755 }],
          }),
        ),
      );
      expect(r.failure?.stage).toBe("developer");
      expect(r.failure?.code).toBe("stage-changed-config");
      expect(r.failure?.reason).toContain("post-commit");
      expect(r.failure?.reason).toContain("refs/tags/delayed");
      expect(r.configVerdicts.find((v) => v.stage === "developer")?.ok).toBe(false);
      expect(r.developerRun?.outcome.durationMs).toBeGreaterThanOrEqual(2000);
      expect(markerLines(marker)).toEqual([]);
    });

    it("CONTROL: the same role writing nothing reaches a clean developer window", async () => {
      const r = await runLoop(loopWith(roleFor({ sleepBeforeMs: 2000, changes: [] })));
      expect(r.failure?.code).toBe("developer-no-change");
      expect(r.configVerdicts.find((v) => v.stage === "developer")?.ok).toBe(true);
    });
  });

  /* --------------------------------------------------------------------- *
   * CA-2 — the constructed environment, argv byte-for-byte, the prompt on stdin
   * --------------------------------------------------------------------- */

  describe("CA-2 — a constructed environment and no shell", () => {
    const SENTINEL_KEY = `sentinel-key-${Date.now()}`;
    const SENTINEL_ALLOWED = `sentinel-allowed-${Date.now()}`;

    const envOf = (r: Awaited<ReturnType<typeof runLoop>>): Record<string, string> => {
      const claim = r.developerReport?.claims.find((c) => c.startsWith("ENV "));
      expect(claim, "the role printed no environment").toBeDefined();
      return JSON.parse(claim!.slice(4)) as Record<string, string>;
    };

    it("2.1–2.3: the key and a non-allowlisted name are absent; the allowlisted name, the transition, is present", async () => {
      const r = await runLoop(
        loopWith(
          roleFor(
            { writes: [WRITE], echoEnv: true },
            {
              envAllow: ["HOH_TEST_ALLOWED"],
              parentEnv: {
                ...process.env,
                TYPESAFE_API_KEY: SENTINEL_KEY,
                HOH_TEST_ALLOWED: SENTINEL_ALLOWED,
                HOH_TEST_NOT_ALLOWED: SENTINEL_ALLOWED,
                CLAUDE_CODE_CHILD_SESSION: "1",
              },
            },
          ),
        ),
      );
      expect(r.failure, r.failure?.reason).toBeNull();
      const env = envOf(r);
      const flat = JSON.stringify(env);
      // The control first: the same kind of value, under an allowlisted name, arrives.
      expect(env.HOH_TEST_ALLOWED).toBe(SENTINEL_ALLOWED);
      expect(Object.keys(env).map((k) => k.toUpperCase())).not.toContain("TYPESAFE_API_KEY");
      expect(flat).not.toContain(SENTINEL_KEY);
      expect(env.HOH_TEST_NOT_ALLOWED).toBeUndefined();
      expect(env.CLAUDE_CODE_CHILD_SESSION).toBeUndefined();
      expect(env.CLAUDE_CODE_FORCE_SESSION_PERSISTENCE).toBe("1");
      // The runtime's record carries names only, and the same absence.
      expect(r.developerRun?.childEnvNames).toContain("HOH_TEST_ALLOWED");
      expect(r.developerRun?.childEnvNames.map((n) => n.toUpperCase())).not.toContain("TYPESAFE_API_KEY");
    });

    it("refuses at construction to ALLOW a denied name", () => {
      const { script, config } = writeRoleProcess(tmp.dir, {});
      expect(
        () => new ProcessRole("developer", { adapter: commandAdapter(script, [config], ["TYPESAFE_API_KEY"]) }),
      ).toThrow(/denied/);
    });

    it("refuses any role but the developer (rulings-1 R1)", () => {
      const { script, config } = writeRoleProcess(tmp.dir, {});
      expect(() => new ProcessRole("qa", { adapter: commandAdapter(script, [config]) })).toThrow(/only be the developer/);
    });

    const PROBE = ["^caret", "$HOME", "back\\slash", "a space", 'dq"uote', "new\nline", "trailing\\"];

    it("2.4: argv arrives byte-for-byte through a PLANTED JS-entry shim, resolved to node + entry, no shell", async () => {
      const { script, config } = writeRoleProcess(tmp.dir, { writes: [WRITE], echoArgv: true, echoStdin: true }, "entry");
      let shim: string;
      if (isWin) {
        shim = join(tmp.dir, "fake.cmd");
        writeFileSync(
          shim,
          [
            "@ECHO off",
            "GOTO start",
            ":find_dp0",
            "SET dp0=%~dp0",
            "EXIT /b",
            ":start",
            "SETLOCAL",
            "CALL :find_dp0",
            `"%dp0%\\node.exe"  "%dp0%\\entry.cjs" %*`,
            "",
          ].join("\r\n"),
        );
      } else {
        shim = join(tmp.dir, "fake-shim");
        symlinkSync(script, shim);
      }
      const role = new ProcessRole("developer", { adapter: commandAdapter(shim, [config, ...PROBE]) });
      const r = await runLoop(loopWith(role));
      expect(r.failure, r.failure?.reason).toBeNull();
      expect(r.developerRun?.form).toBe("node-entry");
      expect(r.developerRun?.argvHead).toEqual([process.execPath, script]);
      const argvClaim = r.developerReport!.claims.find((c) => c.startsWith("ARGV "))!;
      expect(JSON.parse(argvClaim.slice(5))).toEqual(PROBE);
      // The prompt travelled on stdin, so no command-line limit applies to it and
      // argv carries no prompt text to truncate.
      const stdinClaim = r.developerReport!.claims.find((c) => c.startsWith("STDIN "))!;
      expect(JSON.parse(stdinClaim.slice(6))).toContain("You are the developer seat");
      expect(argvClaim).not.toContain("You are the developer seat");
    });

    it.skipIf(!isWin)("2.5 (win32): an unresolvable .cmd is refused before any tag, naming it, and never run", () => {
      for (const body of [
        (marker: string) => `@echo off\r\necho ran> "${marker}"\r\n`,
        (marker: string) => `@echo off\r\necho ran> "${marker}"\r\n"%dp0%\\missing-program.exe" %*\r\n`,
      ]) {
        const marker = join(tmp.dir, `cmd-marker-${Math.random().toString(36).slice(2, 6)}.txt`);
        const shim = join(tmp.dir, `bad-${Math.random().toString(36).slice(2, 6)}.cmd`);
        writeFileSync(shim, body(marker));
        const head = repo.sha();
        let thrown: unknown = null;
        try {
          void runLoop(loopWith(new ProcessRole("developer", { adapter: commandAdapter(shim) })));
        } catch (err) {
          thrown = err;
        }
        expect(thrown).toBeInstanceOf(LoopRefused);
        expect((thrown as LoopRefused).code).toBe("role-unresolvable");
        expect((thrown as LoopRefused).message).toContain(shim);
        expect(existsSync(marker), "the batch file ran").toBe(false);
        expect(rawGit(repo.root, ["tag", "--list", "loop-*"])).toBe("");
        expect(repo.sha()).toBe(head);
        expect(existsSync(join(repo.root, "artifacts"))).toBe(false);
      }
    });

    it("2.5 CONTROL: the real `claude` launcher resolves without running it — native on this machine", () => {
      const launcher = findOnPath("claude", process.env);
      if (launcher === null) {
        // Not installed here (CI). Stated, not passed.
        expect(launcher).toBeNull();
        return;
      }
      const r = resolveLauncher(launcher);
      expect(r.ok, r.ok ? "" : r.reason).toBe(true);
      if (r.ok && isWin) {
        expect(r.form).toBe("native");
        expect(r.executable.toLowerCase()).toMatch(/claude\.exe$/);
        expect(r.executable.toLowerCase()).not.toContain("cmd.exe");
      }
    });

    it.skipIf(findOnPath("claude", process.env) === null)(
      "CA-9: every flag the claude adapter passes exists in the installed `claude --help` (skipped where claude is absent)",
      () => {
        const res = claudeAdapter().resolve(process.env);
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        const help = spawnSync(res.executable, [...res.preArgs, "--help"], { encoding: "utf-8", shell: false, timeout: 60_000 });
        expect(help.status).toBe(0);
        for (const f of CLAUDE_ADAPTER_FLAGS) expect(help.stdout, `flag ${f} is gone`).toContain(f);
      },
    );
  });

  /* --------------------------------------------------------------------- *
   * CA-2.6 — R15/R17: the checks run role-authored code in a constructed env
   * --------------------------------------------------------------------- */

  it("CA-2.6: a role-authored script run by a check gets no key, the allowlisted name, and layers 0/1 as env", async () => {
    const dump = join(tmp.dir, "check-env.json");
    const script = `require("fs").writeFileSync(${JSON.stringify(dump)}, JSON.stringify(process.env));`;
    const saved = { key: process.env.TYPESAFE_API_KEY, ci: process.env.CI };
    process.env.TYPESAFE_API_KEY = "check-sentinel-key";
    process.env.CI = "check-sentinel-ci";
    let generated: string | null = null;
    try {
      const role = roleFor({ writes: [{ path: "artifacts/iterations/t001/envdump.cjs", content: script }] });
      const r = await runLoop(
        loopWith(role, {
          checks: {
            build: {
              command: process.execPath,
              args: ["-e", `require(require("path").resolve("artifacts/iterations/t001/envdump.cjs"))`],
              timeoutMs: 30_000,
            },
            unit: exitingCheck(0),
          },
          log: (l) => {
            if (generated === null) generated = pinFor(repo.root)?.globalConfigPath ?? null;
            void l;
          },
        }),
      );
      expect(r.failure, r.failure?.reason).toBeNull();
    } finally {
      if (saved.key === undefined) delete process.env.TYPESAFE_API_KEY;
      else process.env.TYPESAFE_API_KEY = saved.key;
      if (saved.ci === undefined) delete process.env.CI;
      else process.env.CI = saved.ci;
    }
    const env = JSON.parse(readFileSync(dump, "utf-8")) as Record<string, string>;
    expect(env.CI).toBe("check-sentinel-ci");
    expect(JSON.stringify(env)).not.toContain("check-sentinel-key");
    expect(env.GIT_CONFIG_NOSYSTEM).toBe("1");
    expect(env.GIT_CONFIG_GLOBAL).toBe(generated);
    expect(env.GIT_CONFIG_COUNT).toBe("2");
    expect([env.GIT_CONFIG_KEY_0, env.GIT_CONFIG_KEY_1]).toEqual(["core.hooksPath", "core.fsmonitor"]);
    expect(env.GIT_DIR).toBeUndefined();
  });

  /* --------------------------------------------------------------------- *
   * CA-3 (a)/(b) — preflight refusals for a process role
   * --------------------------------------------------------------------- */

  describe("CA-3a/3b — refused before any tag, commit or artefact", () => {
    const refusedCleanly = (cfg: LoopConfig, code: string): LoopRefused => {
      const head = repo.sha();
      let thrown: unknown = null;
      try {
        void runLoop(cfg);
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeInstanceOf(LoopRefused);
      expect((thrown as LoopRefused).code).toBe(code);
      expect(rawGit(repo.root, ["tag", "--list", "loop-*"])).toBe("");
      expect(repo.sha()).toBe(head);
      expect(existsSync(join(repo.root, "artifacts"))).toBe(false);
      return thrown as LoopRefused;
    };

    it("(a) a process role with the ref-watch off; CONTROL: stub roles with the watch off proceed", async () => {
      refusedCleanly(loopWith(roleFor({ writes: [WRITE] }), { refWatch: false }), "process-role-unwatched");
      const { StubDeveloper } = await import("../../src/harness/roles.js");
      const r = await runLoop({ ...loopWith(roleFor({})), roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa: new StubQa() }, refWatch: false });
      expect(r.failure, r.failure?.reason).toBeNull();
    });

    it("(b) a remote while a process role is present, with the limit stated; CONTROL: removed, the loop runs", async () => {
      rawGit(repo.root, ["remote", "add", "origin", "https://example.invalid/repo.git"]);
      const e = refusedCleanly(loopWith(roleFor({ writes: [WRITE] })), "remote-configured");
      expect(e.message).toContain("can still push to an explicit URL");
      rawGit(repo.root, ["remote", "remove", "origin"]);
      const r = await runLoop(loopWith(roleFor({ writes: [WRITE] })));
      expect(r.failure, r.failure?.reason).toBeNull();
      expect(r.status).toBe("completed");
    });
  });

  /* --------------------------------------------------------------------- *
   * CA-6 — the bound, and the tree kill (R22 as narrowed by ruling (b))
   * --------------------------------------------------------------------- */

  describe("CA-6 — role-timeout, and the tree kill on every exit path", () => {
    /** Dead by BOTH instruments: the PID, and a heartbeat that stops growing. */
    const expectDead = async (pidFile: string, heartbeat: string): Promise<void> => {
      const pid = Number(readFileSync(pidFile, "utf-8"));
      await sleep(400);
      const a = sizeOf(heartbeat);
      await sleep(1200);
      const b = sizeOf(heartbeat);
      expect(b, "the heartbeat kept growing — the grandchild is alive").toBe(a);
      expect(pidAlive(pid), `grandchild ${pid} is still alive`).toBe(false);
    };

    it("a role past its bound is killed with its tree; the windows still close and restore", async () => {
      const pidFile = join(tmp.dir, "gc.pid");
      const heartbeat = join(tmp.dir, "heartbeat");
      const marker = join(tmp.dir, "marker.txt");
      const hook = writeMarkerScript(join(tmp.dir, "hook.sh"), marker, "timeout");
      const hooksBefore = readdirSync(join(repo.root, ".git/hooks")).sort();
      const r = await runLoop(
        loopWith(
          roleFor(
            {
              writes: [WRITE],
              grandchild: { code: heartbeatCode(heartbeat), pidFile },
              plant: [{ path: ".git/hooks/post-commit", content: readFileSync(hook, "utf-8"), mode: 0o755 }],
              hangMs: 120_000,
            },
            { timeoutMs: 4000 },
          ),
        ),
      );
      expect(r.failure?.code).toBe("role-timeout");
      expect(r.failure?.reason).toContain("The kill that ran:");
      expect(r.failure?.reason).toContain("double-fork");
      expect(r.failure?.reason).not.toContain("killed with its process tree");
      expect(r.failure?.reason).not.toContain("Every window was still closed");
      expect(r.failure?.reason).toContain("post-commit");
      expect(readdirSync(join(repo.root, ".git/hooks")).sort()).toEqual(hooksBefore);
      await expectDead(pidFile, heartbeat);
      expect(markerLines(marker)).toEqual([]);
    });

    it("a single child past its bound records only the kill that ran", async () => {
      const r = await runLoop(loopWith(roleFor({ writes: [WRITE], hangMs: 120_000 }, { timeoutMs: 3000 })));
      expect(r.failure?.code).toBe("role-timeout");
      expect(r.failure?.reason).toContain("The kill that ran:");
      expect(r.failure?.reason).toContain("double-fork");
      expect(r.failure?.reason).not.toContain("killed with its process tree");
      expect(r.failure?.reason).not.toContain("Every window was still closed");
    });

    it("CONTROL: under a bound it does not exceed, the role completes and its grandchild runs to completion", async () => {
      const done = join(tmp.dir, "done");
      const r = await runLoop(
        loopWith(
          roleFor(
            {
              writes: [WRITE],
              grandchild: { code: `setTimeout(()=>require("fs").writeFileSync(${JSON.stringify(done)},"done"),500)`, sync: true },
            },
            { timeoutMs: 30_000 },
          ),
        ),
      );
      expect(r.failure, r.failure?.reason).toBeNull();
      expect(readFileSync(done, "utf-8")).toBe("done");
    });

    /**
     * A ProcessRole that tells its grandchild where the generated global config
     * is — the one path only the runtime knows. A subclass is foreign by
     * construction, which the ref-watch (on) permits.
     */
    class PathTellingRole extends ProcessRole {
      constructor(private readonly pathFile: string, opts: ConstructorParameters<typeof ProcessRole>[1]) {
        super("developer", opts);
      }
      override execute(ctx: RoleContext) {
        writeFileSync(this.pathFile, pinFor(ctx.repoRoot)?.globalConfigPath ?? "");
        return super.execute(ctx);
      }
    }

    for (const exitCode of [0, 3]) {
      it.skipIf(isWin)(
        `POSIX: a role that exits ${exitCode === 0 ? "normally" : "with an error"} leaves no descendant alive, before the next runtime git call`,
        async () => {
          const pidFile = join(tmp.dir, "gc.pid");
          const heartbeat = join(tmp.dir, "heartbeat");
          const pathFile = join(tmp.dir, "config-path");
          // The grandchild waits for the role to exit, then 300ms later tries to
          // edit the generated global config. Alive, it would turn the next
          // runtime git call into runtime-git-refused.
          const code =
            `const fs=require("fs");const p=fs.readFileSync(${JSON.stringify(pathFile)},"utf8");` +
            `setInterval(()=>fs.appendFileSync(${JSON.stringify(heartbeat)},"b"),200);` +
            `const w=setInterval(()=>{try{process.kill(process.ppid,0)}catch(e){clearInterval(w);` +
            `setTimeout(()=>{try{fs.appendFileSync(p,"[core]\\n\\tfsmonitor = /bin/sh\\n")}catch(e){}},300)}},50);`;
          const { script, config } = writeRoleProcess(tmp.dir, { writes: [WRITE], grandchild: { code, pidFile }, exitCode });
          const role = new PathTellingRole(pathFile, { adapter: commandAdapter(script, [config]) });
          const r = await runLoop(loopWith(role));
          expect(r.failure?.code, r.failure?.reason).not.toBe("runtime-git-refused");
          expect(r.developerRun?.outcome.killNote).toMatch(/process group \d+ (swept|was already empty)/);
          await expectDead(pidFile, heartbeat);
        },
      );
    }

    it.skipIf(!isWin)("win32: a normal exit states the limit in the record and claims no kill", async () => {
      const pidFile = join(tmp.dir, "gc.pid");
      const heartbeat = join(tmp.dir, "heartbeat");
      const lines: string[] = [];
      const r = await runLoop(
        loopWith(roleFor({ writes: [WRITE], grandchild: { code: heartbeatCode(heartbeat), pidFile } }), {
          log: (l) => lines.push(l),
        }),
      );
      stray.push(Number(readFileSync(pidFile, "utf-8")));
      expect(r.failure, r.failure?.reason).toBeNull();
      expect(TREE_KILL_STATEMENT).toBe(
        "normal-exit tree-kill: unavailable on win32 (no job object); timeout path killed via taskkill /T while the root is alive",
      );
      expect(lines).toContain(TREE_KILL_STATEMENT);
      const findings = JSON.parse(rawGit(repo.root, ["show", `${r.evidenceSha}:artifacts/iterations/t001/findings.json`]));
      expect(findings.tree_kill).toBe(TREE_KILL_STATEMENT);
      // EQUALITY, not a pattern: /swept|killed/ matched this very sentence's
      // negation ("NOT swept") — a scan matching the sentence that forbids the
      // thing, G-040, found by this row going red.
      expect(r.developerRun?.outcome.killNote).toBe(WIN32_NORMAL_EXIT_NOTE);
    });
  });

  /* --------------------------------------------------------------------- *
   * CA-7 — R_t: schema, retry, disagreement
   * --------------------------------------------------------------------- */

  describe("CA-7 — R_t is validated, compared, and never trusted", () => {
    for (const bad of ["missing", "garbage", "invalid"] as const) {
      it(`a ${bad} R_t goes through the capped retry and ends in FAILED.md with a non-zero exit`, async () => {
        const r = await runLoop(
          loopWith(roleFor(bad === "invalid" ? { writes: [WRITE], invalid: true } : { writes: [WRITE], report: bad }), { maxAttempts: 2 }),
        );
        expect(r.failure?.code).toBe("schema-cap-exhausted");
        expect(r.failure?.attempts).toBe(2);
        expect(r.exitCode).not.toBe(0);
        expect(existsSync(join(repo.root, "artifacts/iterations/t001/FAILED.md"))).toBe(true);
      });
    }

    it("claims a path the diff does not contain, omits one it does → findings; the done-gate reads the MEASUREMENT", async () => {
      const r = await runLoop(
        loopWith(roleFor({ writes: [WRITE], changes: [{ path: "somewhere/else.md", what: "never written" }], exitCode: 3 }), {
          gateMode: "dry-run",
        }),
      );
      expect(r.failure, r.failure?.reason).toBeNull();
      expect(r.findings).toContain("R_t claims a change to somewhere/else.md, which the measured diff does not contain.");
      expect(r.findings).toContain(`the measured diff changes ${WRITE.path}, which R_t does not report.`);
      expect(r.findings.some((f) => f.startsWith("the developer process exited 3"))).toBe(true);
      const done = r.gatePayloads.find((p) => p.gate === "developer-done")!;
      const ctx = done.context as { diffstat: string[]; developer_claims: { role_exit_code: number | null } };
      expect(ctx.diffstat).toEqual([WRITE.path]);
      expect(ctx.developer_claims.role_exit_code).toBe(3);
    });

    it("CONTROL: an R_t that matches the diff records no disagreement", async () => {
      const r = await runLoop(loopWith(roleFor({ writes: [WRITE] })));
      expect(r.failure, r.failure?.reason).toBeNull();
      expect(r.findings.filter((f) => f.startsWith("R_t claims") || f.startsWith("the measured diff"))).toEqual([]);
    });
  });
});

