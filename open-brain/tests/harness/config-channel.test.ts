/**
 * Candidate A — the config/hooks channel and the preflight refusals around it.
 *
 * The finding this file exists for: a role can plant a git hook or a
 * program-valued config key and get CODE EXECUTION inside the runtime's own
 * next git call (design §2.3, measured; reproduced by QA). Every row here that
 * asserts a planted program did NOT run sits beside a control showing the same
 * program DOES run through the same git call without the runtime — an absence
 * that has never been shown capable of reporting presence is not a result.
 *
 * The roles are in-process objects wrapping the stubs (the runtime's behaviour
 * after a stage does not depend on how the stage wrote); `process-role.test.ts`
 * covers the rows that need a real process.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  closeSync,
  existsSync,
  ftruncateSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { join } from "node:path";
import { runLoop, LoopRefused, LOOP_LIMITS, type LoopConfig } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa, type RoleContext, type RoleSession } from "../../src/harness/roles.js";
import { pinFor, resolveRef, SAFE_MACHINE_KEYS } from "../../src/harness/git.js";
import { resolveGitDirs, unsafeLocalKeys, watchedLocations, ConfigWatch } from "../../src/harness/configwatch.js";
import { exitingChecks, makeRepo, rawGit, requireGit, type RepoFixture } from "./fixture.js";
import { gitWithEnv, markerLines, scratch, shPath, withEnv, writeMarkerScript } from "./candidate-a-fixture.js";

/** Rewrite an existing file in place — the way a role gets past a hidden attribute. */
function overwriteInPlace(path: string, content: string): void {
  const fd = openSync(path, "r+");
  try {
    ftruncateSync(fd, 0);
    writeSync(fd, content, 0, "utf-8");
  } finally {
    closeSync(fd);
  }
}

const sha = (p: string): string => createHash("sha256").update(readFileSync(p)).digest("hex");

/** Every file under a dir with its hash, so a restore is judged on the SET and the bytes. */
function fileSet(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string, rel: string): void => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      const r = rel === "" ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) walk(p, r);
      else out[r] = sha(p);
    }
  };
  walk(dir, "");
  return out;
}

/** A role that does the stub's work, then acts on the repository. */
const sabotage = (inner: RoleSession, act: (ctx: RoleContext) => void): RoleSession => ({
  role: inner.role,
  run: async (ctx: RoleContext) => {
    const deliverable = await inner.run(ctx);
    act(ctx);
    return deliverable;
  },
});

describe("candidate A — the config/hooks channel", { timeout: 120_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };
  let marker: string;

  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("harness-cfg-");
    tmp = scratch("harness-cfg-out-");
    marker = join(tmp.dir, "marker.txt");
  });
  afterEach(async () => {
    await repo.cleanup();
    await tmp.cleanup();
  });

  const config = (over: Partial<LoopConfig> = {}): LoopConfig => ({
    repoRoot: repo.root,
    loop: "t001",
    roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa: new StubQa() },
    checks: exitingChecks(0, 0),
    log: () => {},
    ...over,
  });

  const withDeveloper = (act: (ctx: RoleContext) => void): LoopConfig =>
    config({ roles: { planner: new StubPlanner(), developer: sabotage(new StubDeveloper(), act), qa: new StubQa() } });

  /* --------------------------------------------------------------------- *
   * CA-4a — each planted program, one per run, with its control
   * --------------------------------------------------------------------- */

  describe("CA-4a — a planted hook or monitor is refused, never runs, and is restored by set and bytes", () => {
    const plants: Array<{ name: string; plant: (root: string, script: string) => void; control: (root: string) => void }> = [
      {
        name: "post-commit",
        plant: (root, script) => {
          writeFileSync(join(root, ".git/hooks/post-commit"), readFileSync(script));
          chmodSync(join(root, ".git/hooks/post-commit"), 0o755);
        },
        control: (root) => {
          writeFileSync(join(root, "c.txt"), "c\n");
          rawGit(root, ["add", "c.txt"]);
          rawGit(root, ["commit", "--no-verify", "--no-gpg-sign", "-m", "control"]);
        },
      },
      {
        name: "reference-transaction",
        plant: (root, script) => {
          writeFileSync(join(root, ".git/hooks/reference-transaction"), readFileSync(script));
          chmodSync(join(root, ".git/hooks/reference-transaction"), 0o755);
        },
        control: (root) => rawGit(root, ["tag", "control-tag", "HEAD"]),
      },
      {
        name: "core.fsmonitor",
        plant: (root, script) => appendFileSync(join(root, ".git/config"), `[core]\n\tfsmonitor = ${shPath(script)}\n`),
        control: (root) => {
          writeFileSync(join(root, "d.txt"), "d\n");
          rawGit(root, ["status", "--porcelain"]);
        },
      },
    ];

    for (const p of plants) {
      it(`${p.name}: stage-changed-config, marker absent, files restored — and the control writes the marker`, async () => {
        const script = writeMarkerScript(join(tmp.dir, `${p.name}.sh`), marker, p.name);
        const hooksBefore = fileSet(join(repo.root, ".git/hooks"));
        const configBefore = sha(join(repo.root, ".git/config"));

        const r = await runLoop(withDeveloper((ctx) => p.plant(ctx.repoRoot, script)));

        expect(r.status).toBe("failed");
        expect(r.failure?.code).toBe("stage-changed-config");
        expect(r.failure?.stage).toBe("developer");
        expect(markerLines(marker), "the planted program ran inside a runtime git call").toEqual([]);
        expect(fileSet(join(repo.root, ".git/hooks")), "the hooks file set was not restored").toEqual(hooksBefore);
        expect(sha(join(repo.root, ".git/config")), ".git/config was not restored by bytes").toBe(configBefore);
        expect(existsSync(join(repo.root, "artifacts/iterations/t001/FAILED.md"))).toBe(true);

        // CONTROL: the same program, planted again, run through the same kind of
        // git call without the runtime, writes its marker.
        p.plant(repo.root, script);
        p.control(repo.root);
        expect(markerLines(marker).length, "the control did not fire — the absence above means nothing").toBeGreaterThan(0);
      });
    }

    it("garbage .git/config and repositoryformatversion=99 end in stage-changed-config with a record", async () => {
      for (const garbage of ["[[[ this is not config\n", "[core]\n\trepositoryformatversion = 99\n"]) {
        const local = makeRepo("harness-cfg-garbage-");
        try {
          const before = sha(join(local.root, ".git/config"));
          const r = await runLoop({
            ...config(),
            repoRoot: local.root,
            roles: {
              planner: new StubPlanner(),
              developer: sabotage(new StubDeveloper(), (ctx) => writeFileSync(join(ctx.repoRoot, ".git/config"), garbage)),
              qa: new StubQa(),
            },
          });
          expect(r.failure?.code, garbage).toBe("stage-changed-config");
          expect(existsSync(join(local.root, "artifacts/iterations/t001/FAILED.md"))).toBe(true);
          expect(sha(join(local.root, ".git/config"))).toBe(before);
          // CONTROL: the same bytes make git itself fail.
          writeFileSync(join(local.root, ".git/config"), garbage);
          expect(() => rawGit(local.root, ["status"])).toThrow();
        } finally {
          await local.cleanup();
        }
      }
    });
  });

  /* --------------------------------------------------------------------- *
   * CA-4c / CA-4e / CA-4g — layer 0: the machine's config is not read
   * --------------------------------------------------------------------- */

  describe("CA-4c/4e/4g — a program in machine config does not run inside the runtime; it does outside it", () => {
    /** Base: a tracked a.txt under `*.txt filter=p`; the developer modifies a.txt. */
    const prepareFilterTarget = (): void => {
      repo.write(".gitattributes", "*.txt filter=p\n");
      repo.write("a.txt", "a\n");
      repo.commitAll("filter target");
    };
    const touchA = (ctx: RoleContext): void => writeFileSync(join(ctx.repoRoot, "a.txt"), "a changed\n");

    it("CA-4c: a GLOBAL filter.p.clean + work-tree attribute — no run with layer 0, runs without it", async () => {
      prepareFilterTarget();
      const filter = writeMarkerScript(join(tmp.dir, "filter.sh"), marker, "global", true);
      const home = join(tmp.dir, "home-4c");
      const xdg = join(tmp.dir, "xdg-4c-empty");
      mkdirSync(home);
      mkdirSync(xdg);
      const globalFile = join(home, ".gitconfig");
      writeFileSync(globalFile, `[filter "p"]\n\tclean = ${shPath(filter)}\n[core]\n\tsshCommand = ${shPath(filter)}\n`);
      const restore = withEnv({ HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: xdg, GIT_CONFIG_GLOBAL: undefined });
      try {
        const r = await runLoop({ ...withDeveloper(touchA), developerAllowlist: ["a.txt", "artifacts/iterations/t001/"] });
        expect(r.failure, r.failure?.reason).toBeNull();
        expect(markerLines(marker), "the global filter ran inside a runtime git call").toEqual([]);

        // The runtime's commits still carry its identity (layer 0 did not break committing).
        expect(rawGit(repo.root, ["log", "-1", "--format=%an%n%ae", r.candidateSha!])).toBe(
          "HoH harness runtime\nharness-runtime@sia.invalid",
        );

        // CONTROL: the same git call, same environment, WITHOUT the runtime.
        writeFileSync(join(repo.root, "a.txt"), "control\n");
        rawGit(repo.root, ["add", "a.txt"]);
        expect(markerLines(marker).some((l) => l.startsWith("global:"))).toBe(true);
      } finally {
        restore();
      }
    });

    it("CA-4c R19: the generated file carries ONLY allowlisted non-program keys, never the planted ones", async () => {
      const globalFile = join(tmp.dir, "global.gitconfig");
      writeFileSync(
        globalFile,
        `[core]\n\tautocrlf = input\n\tsshCommand = /bin/evil\n\tfsmonitor = /bin/evil\n[filter "x"]\n\tclean = /bin/evil\n`,
      );
      const restore = withEnv({ GIT_CONFIG_GLOBAL: globalFile });
      let generated: string | null = null;
      try {
        await runLoop(
          withDeveloper((ctx) => {
            const pin = pinFor(ctx.repoRoot);
            generated = pin?.globalConfigPath ? readFileSync(pin.globalConfigPath, "utf-8") : null;
          }),
        );
      } finally {
        restore();
      }
      expect(generated, "no generated global config was in force during the stage").not.toBeNull();
      // A PARSER over the generated file, not a pattern: git's own config reader.
      const f = join(tmp.dir, "generated.gitconfig");
      writeFileSync(f, generated!);
      const keys = gitWithEnv(tmp.dir, ["config", "--file", f, "--list", "--name-only"], process.env)
        .split("\n")
        .filter((k) => k !== "");
      expect(keys).toContain("core.autocrlf");
      expect(gitWithEnv(tmp.dir, ["config", "--file", f, "--get", "core.autocrlf"], process.env)).toBe("input");
      let systemAutocrlf = "";
      try {
        systemAutocrlf = gitWithEnv(tmp.dir, ["config", "--system", "--get", "core.autocrlf"], process.env);
      } catch {
        systemAutocrlf = "";
      }
      expect(systemAutocrlf).not.toBe("input");
      for (const k of keys) expect(SAFE_MACHINE_KEYS, `unlisted key carried: ${k}`).toContain(k);
      expect(keys).not.toContain("core.sshcommand");
      expect(keys).not.toContain("core.fsmonitor");
      expect(keys).not.toContain("filter.x.clean");
    });

    it("CA-4e: an XDG filter does not run with layer 0 and does run without it", async () => {
      prepareFilterTarget();
      const home = join(tmp.dir, "home");
      const xdg = join(tmp.dir, "xdg");
      mkdirSync(home, { recursive: true });
      mkdirSync(join(xdg, "git"), { recursive: true });
      const filter = writeMarkerScript(join(tmp.dir, "xdg-filter.sh"), marker, "xdg", true);
      writeFileSync(join(xdg, "git", "config"), `[filter "p"]\n\tclean = ${shPath(filter)}\n`);
      const restore = withEnv({ HOME: home, XDG_CONFIG_HOME: xdg, GIT_CONFIG_GLOBAL: undefined });
      try {
        const r = await runLoop({ ...withDeveloper(touchA), developerAllowlist: ["a.txt", "artifacts/iterations/t001/"] });
        expect(r.failure, r.failure?.reason).toBeNull();
        expect(markerLines(marker), "the XDG filter ran inside a runtime git call").toEqual([]);

        writeFileSync(join(repo.root, "a.txt"), "control\n");
        rawGit(repo.root, ["add", "a.txt"]);
        expect(markerLines(marker).some((l) => l.startsWith("xdg:")), "the XDG control did not fire").toBe(true);
      } finally {
        restore();
      }
    });

    it("CA-4g: repo-local program half — layer 2 refuses it, it does not run; control: it runs without the runtime", async () => {
      prepareFilterTarget();
      const filter = writeMarkerScript(join(tmp.dir, "local-filter.sh"), marker, "local", true);
      const r = await runLoop({
        ...withDeveloper((ctx) => {
          touchA(ctx);
          appendFileSync(join(ctx.repoRoot, ".git/config"), `[filter "p"]\n\tclean = ${shPath(filter)}\n`);
        }),
        developerAllowlist: ["a.txt", "artifacts/iterations/t001/"],
      });
      expect(r.failure?.code).toBe("stage-changed-config");
      expect(markerLines(marker)).toEqual([]);

      appendFileSync(join(repo.root, ".git/config"), `[filter "p"]\n\tclean = ${shPath(filter)}\n`);
      writeFileSync(join(repo.root, "a.txt"), "control\n");
      rawGit(repo.root, ["add", "a.txt"]);
      expect(markerLines(marker).some((l) => l.startsWith("local:"))).toBe(true);
    });

    it("R59: a config-only refusal does not say paths were reverted when none were", async () => {
      const r = await runLoop({
        ...withDeveloper((ctx) => {
          appendFileSync(join(ctx.repoRoot, ".git/config"), "\n# r59-config-only\n");
        }),
      });
      expect(r.failure?.code).toBe("stage-changed-config");
      expect(r.failure?.reason ?? "", r.failure?.reason).not.toContain("The offending paths were reverted.");
    });

    it("R63: a revert that ran says the offending paths were reverted", async () => {
      const r = await runLoop({
        ...withDeveloper((ctx) => {
          writeFileSync(join(ctx.repoRoot, "sneaky.txt"), "nope\n");
        }),
      });
      expect(r.failure?.reason ?? "", r.failure?.reason).toContain("The offending paths were reverted.");
      expect(existsSync(join(repo.root, "sneaky.txt")), "the revert removed the plant").toBe(false);
    });
  });

  /* --------------------------------------------------------------------- *
   * CA-4f — R8: machine-wide config is hashed and REPORTED, never restored
   * --------------------------------------------------------------------- */

  describe("CA-4f — the report-only window over machine-wide config", () => {
    it("reports each write with its path and both hashes, restores nothing, fails nothing", async () => {
      const home = join(tmp.dir, "home");
      const xdg = join(tmp.dir, "xdg");
      const system = join(tmp.dir, "system.gitconfig");
      mkdirSync(home, { recursive: true });
      mkdirSync(join(xdg, "git"), { recursive: true });
      writeFileSync(system, "[core]\n\tautocrlf = false\n");
      const env = { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: xdg, GIT_CONFIG_SYSTEM: system };
      const targets = [join(home, ".gitconfig"), join(xdg, "git", "config"), system];

      const r = await runLoop({
        ...withDeveloper(() => {
          for (const t of targets) appendFileSync(t, "[user]\n\tname = role wrote this\n");
        }),
        env,
      });

      expect(r.failure, r.failure?.reason).toBeNull();
      expect(r.status).toBe("completed");
      const reported = r.machineConfigFindings.map((f) => f.path);
      for (const t of targets) {
        expect(reported, `no finding for ${t}`).toContain(t);
        expect(readFileSync(t, "utf-8"), `${t} was restored — R8 forbids it`).toContain("role wrote this");
      }
      const writes = r.machineConfigFindings.filter((f) => f.before !== f.after);
      expect(writes).toHaveLength(3);
      for (const f of writes) {
        expect(f.before).not.toBe(f.after);
        expect(f.stage).toBe("developer");
        expect(targets).toContain(f.path);
      }
      const recorded = JSON.parse(rawGit(repo.root, ["show", `${r.evidenceSha}:artifacts/iterations/t001/findings.json`]));
      const recordedWrites = recorded.machine_config_findings.filter((f: { before: string; after: string }) => f.before !== f.after);
      expect(recordedWrites).toHaveLength(3);
    });

    it("CONTROL: a role that writes nothing produces no machine-config finding", async () => {
      const home = join(tmp.dir, "home");
      mkdirSync(home, { recursive: true });
      const r = await runLoop({ ...config(), env: { ...process.env, HOME: home, USERPROFILE: home } });
      expect(r.failure, r.failure?.reason).toBeNull();
      expect(r.machineConfigFindings.length, "R65: every watched path is in the record").toBeGreaterThan(0);
      expect(r.machineConfigFindings.every((f) => f.before === f.after)).toBe(true);
    });
  });

  /* --------------------------------------------------------------------- *
   * CA-4h — linked worktrees, and R18's pin against a rewritten .git file
   * --------------------------------------------------------------------- */

  describe("CA-4h — linked worktree: common dir and config.worktree are watched; the .git pointer cannot redirect", () => {
    let wt: string;
    beforeEach(() => {
      rawGit(repo.root, ["config", "extensions.worktreeConfig", "true"]);
      wt = join(tmp.dir, "wt");
      rawGit(repo.root, ["worktree", "add", "-b", "wt", wt]);
    });

    const wtConfig = (over: Partial<LoopConfig> = {}): LoopConfig => ({ ...config(), repoRoot: wt, ...over });
    const dev = (act: (ctx: RoleContext) => void): Partial<LoopConfig> => ({
      roles: { planner: new StubPlanner(), developer: sabotage(new StubDeveloper(), act), qa: new StubQa() },
    });

    it("resolves the common dir and the worktree's git dir", () => {
      const dirs = resolveGitDirs(wt);
      expect(dirs.gitFile).not.toBeNull();
      expect(dirs.commonDir).not.toBe(dirs.gitDir);
      const w = watchedLocations(dirs);
      expect(w.files).toContain(join(dirs.commonDir, "config"));
      expect(w.files).toContain(join(dirs.gitDir, "config.worktree"));
      expect(w.trees).toContain(join(dirs.commonDir, "hooks"));
    });

    for (const where of ["common hook", "config.worktree", "common config"] as const) {
      it(`${where}: detected, restored, never run`, async () => {
        const script = writeMarkerScript(join(tmp.dir, "p.sh"), marker, where);
        const dirs = resolveGitDirs(wt);
        const target =
          where === "common hook"
            ? join(dirs.commonDir, "hooks", "post-commit")
            : where === "config.worktree"
              ? join(dirs.gitDir, "config.worktree")
              : join(dirs.commonDir, "config");
        const before = existsSync(target) ? sha(target) : null;
        const r = await runLoop(
          wtConfig(
            dev(() => {
              if (where === "common hook") {
                writeFileSync(target, readFileSync(script));
                chmodSync(target, 0o755);
              } else appendFileSync(target, `[core]\n\tfsmonitor = ${shPath(script)}\n`);
            }),
          ),
        );
        expect(r.failure?.code).toBe("stage-changed-config");
        expect(markerLines(marker)).toEqual([]);
        expect(existsSync(target) ? sha(target) : null).toBe(before);
      });
    }

    it("R18: a rewritten .git pointer does not redirect the runtime, and is reported", async () => {
      const other = makeRepo("harness-cfg-other-");
      try {
        const otherRefsBefore = rawGit(other.root, ["show-ref"]);
        const pointerBefore = readFileSync(join(wt, ".git"), "utf-8");
        const r = await runLoop(
          // Written IN PLACE (r+): Git for Windows marks the pointer hidden, and a
          // hidden file refuses create-and-truncate. A real role can do this.
          wtConfig(dev((ctx) => overwriteInPlace(join(ctx.repoRoot, ".git"), `gitdir: ${join(other.root, ".git")}\n`))),
        );
        expect(r.failure?.code).toBe("stage-changed-config");
        expect(r.failure?.reason).toContain(".git");
        expect(readFileSync(join(wt, ".git"), "utf-8")).toBe(pointerBefore);
        // The runtime's refs landed in the ORIGINAL repository, and the other is untouched.
        expect(resolveRef(repo.root, "loop-001-base")).not.toBeNull();
        expect(rawGit(other.root, ["show-ref"])).toBe(otherRefsBefore);
      } finally {
        await other.cleanup();
      }
    });
  });

  /* --------------------------------------------------------------------- *
   * CA-4d — the snapshot's scope, each claimed file shown by one planted change
   * --------------------------------------------------------------------- */

  describe("CA-4d — what layer 2 snapshots", () => {
    it("names its files and trees, and detects a change to each claimed kind", () => {
      const dirs = resolveGitDirs(repo.root);
      const w = watchedLocations(dirs);
      expect(w.files).toEqual(
        [join(dirs.commonDir, "config"), join(dirs.commonDir, "config.worktree")].sort(),
      );
      expect(w.trees).toEqual([join(dirs.commonDir, "hooks"), join(dirs.commonDir, "info")].sort());

      const changes: Array<[string, () => void]> = [
        ["config.worktree", () => writeFileSync(join(dirs.commonDir, "config.worktree"), "[core]\n\tx = 1\n")],
        ["info/attributes", () => writeFileSync(join(dirs.commonDir, "info", "attributes"), "*.txt filter=p\n")],
        ["include.path outside", () => appendFileSync(join(dirs.commonDir, "config"), `[include]\n\tpath = ${shPath(join(tmp.dir, "x"))}\n`)],
      ];
      for (const [name, change] of changes) {
        const watch = new ConfigWatch(dirs);
        watch.begin(name);
        change();
        const v = watch.closeAndRestore();
        expect(v.ok, `${name} was not detected`).toBe(false);
        expect(v.unrestored).toEqual([]);
      }
    });
  });

  /* --------------------------------------------------------------------- *
   * CA-4i — R20: the generated global config cannot be edited under the runtime
   * --------------------------------------------------------------------- */

  describe("CA-4i — the generated global config is byte-compared before every git call", () => {
    const tamper = (mutate: (text: string) => string) => (ctx: RoleContext): void => {
      const pin = pinFor(ctx.repoRoot)!;
      writeFileSync(pin.globalConfigPath!, mutate(readFileSync(pin.globalConfigPath!, "utf-8")));
    };

    it("an appended filter → a record naming the file, and the filter never runs", async () => {
      repo.write(".gitattributes", "*.txt filter=p\n");
      repo.write("a.txt", "a\n");
      repo.commitAll("filter target");
      const filter = writeMarkerScript(join(tmp.dir, "f.sh"), marker, "tamper", true);
      let path = "";
      const r = await runLoop({
        ...withDeveloper((ctx) => {
          path = pinFor(ctx.repoRoot)!.globalConfigPath!;
          writeFileSync(join(ctx.repoRoot, "a.txt"), "changed\n");
          tamper((t) => `${t}[filter "p"]\n\tclean = ${shPath(filter)}\n`)(ctx);
        }),
        developerAllowlist: ["a.txt", "artifacts/iterations/t001/"],
      });
      expect(r.failure?.code).toBe("runtime-git-refused");
      expect(r.failure?.reason).toContain(path);
      expect(existsSync(join(repo.root, "artifacts/iterations/t001/FAILED.md"))).toBe(true);
      expect(markerLines(marker)).toEqual([]);
    });

    it("a SAME-LENGTH edit is caught, so a size check could not pass this row", async () => {
      let before = "";
      let after = "";
      const r = await runLoop(
        withDeveloper((ctx) => {
          tamper((t) => {
            before = t;
            // One character changed, same length: the comment's first letter.
            after = t.replace("# Generated", "# generated");
            return after;
          })(ctx);
        }),
      );
      expect(after.length).toBe(before.length);
      expect(after).not.toBe(before);
      expect(r.failure?.code).toBe("runtime-git-refused");
    });

    it("CONTROL: the unedited file lets the loop complete", async () => {
      const r = await runLoop(config());
      expect(r.failure, r.failure?.reason).toBeNull();
      expect(r.status).toBe("completed");
    });
  });

  /* --------------------------------------------------------------------- *
   * CA-5 — the known-negative: a clean loop leaves every window unchanged
   * --------------------------------------------------------------------- */

  describe("CA-5 — a clean stub loop leaves every stage's config window unchanged", () => {
    it(`on this git (${rawGit(process.cwd(), ["--version"])}), and the runtime's own writes never touch .git/config`, async () => {
      const before = sha(join(repo.root, ".git/config"));
      const hooksBefore = fileSet(join(repo.root, ".git/hooks"));
      const r = await runLoop(config());
      expect(r.failure, r.failure?.reason).toBeNull();
      expect(r.configVerdicts.map((v) => [v.stage, v.ok])).toEqual([
        ["planner", true],
        ["developer", true],
        ["qa", true],
      ]);
      for (const v of r.configVerdicts) expect(v.examined).toBeGreaterThan(0);
      // Measured, and reported: the runtime's between-stage writes (tags,
      // commits) do not change .git/config or the hooks on this git. So the
      // per-stage snapshot choice is UNTESTED by this runtime, not verified.
      expect(sha(join(repo.root, ".git/config"))).toBe(before);
      expect(fileSet(join(repo.root, ".git/hooks"))).toEqual(hooksBefore);
    });

    it("R19: on a target cloned under the machine's own config, with no .gitattributes, nothing reads as changed", async () => {
      // Built with the MACHINE's config (no local line-ending overrides), which
      // is what makeRepo's core.autocrlf=false made every older test blind to.
      const src = scratch("harness-cfg-src-");
      const dst = join(tmp.dir, "clone");
      try {
        rawGit(src.dir, ["init", "--initial-branch=main"]);
        writeFileSync(join(src.dir, "lf.txt"), "one\ntwo\n");
        rawGit(src.dir, ["add", "lf.txt"]);
        rawGit(src.dir, ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "--no-verify", "--no-gpg-sign", "-m", "base"]);
        rawGit(tmp.dir, ["clone", "--quiet", src.dir, dst]);
        rawGit(dst, ["remote", "remove", "origin"]);

        const r = await runLoop({ ...config(), repoRoot: dst });
        expect(r.failure, r.failure?.reason).toBeNull();
        expect(r.status).toBe("completed");
        const dirty = rawGit(dst, ["status", "--porcelain"]);
        expect(dirty, `spurious changes: ${dirty}`).toBe("");
      } finally {
        await src.cleanup();
      }
    });
  });

  /* --------------------------------------------------------------------- *
   * CA-8 — G-045 and the config channel compose
   * --------------------------------------------------------------------- */

  it("CA-8: deleting the checked-out branch AND planting a hook → one record carrying both", async () => {
    const script = writeMarkerScript(join(tmp.dir, "hook.sh"), marker, "compose");
    let mainAtWindow = "";
    const r = await runLoop(
      withDeveloper((ctx) => {
        mainAtWindow = rawGit(ctx.repoRoot, ["rev-parse", "refs/heads/main"]);
        writeFileSync(join(ctx.repoRoot, ".git/hooks/post-commit"), readFileSync(script));
        chmodSync(join(ctx.repoRoot, ".git/hooks/post-commit"), 0o755);
        rawGit(ctx.repoRoot, ["update-ref", "-d", "refs/heads/main"]);
      }),
    );
    expect(r.status).toBe("failed");
    expect(existsSync(join(repo.root, "artifacts/iterations/t001/FAILED.md"))).toBe(true);
    expect(r.failure?.reason).toContain("post-commit");
    expect(r.failure?.reason).toContain("refs/heads/main was DELETED");
    expect(rawGit(repo.root, ["rev-parse", "HEAD"])).toMatch(/^[0-9a-f]{40}$/);
    expect(resolveRef(repo.root, "refs/heads/main")).toBe(mainAtWindow);
    expect(markerLines(marker)).toEqual([]);
  });

  /* --------------------------------------------------------------------- *
   * CA-14 — R14: a git failure after a role has run ends in a RECORD
   * --------------------------------------------------------------------- */

  describe("CA-14 — the backstop records, and does not claim a repair", () => {
    for (const [name, file, bytes, call] of [
      ["garbage .git/HEAD", ".git/HEAD", "this is not a ref\n", "git"],
      ["garbage .git/index", ".git/index", "DIRC garbage garbage garbage", "git status"],
    ] as const) {
      it(`${name} → a LoopResult and FAILED.md naming the failing call`, async () => {
        const r = await runLoop(withDeveloper((ctx) => writeFileSync(join(ctx.repoRoot, file), bytes)));
        expect(r.status).toBe("failed");
        expect(r.failure?.code).toBe("runtime-git-failed");
        expect(r.failure?.reason).toContain(call);
        const failed = readFileSync(join(repo.root, "artifacts/iterations/t001/FAILED.md"), "utf-8");
        expect(failed).toContain("runtime-git-failed");
        expect(failed).toMatch(/a RECORD, not a repair/);
        // It does not claim a restoration that did not happen.
        expect(r.failure?.reason).not.toMatch(/was put back|rolled back|reset to|restored/i);
        // CONTROL: the same bytes make git fail on its own.
        expect(() => rawGit(repo.root, ["status"])).toThrow();
      });
    }
  });

  /* --------------------------------------------------------------------- *
   * CA-3 (c)/(d) — R13 includes and R21 default-deny, at preflight
   * --------------------------------------------------------------------- */

  describe("CA-3c/3d — the target's own config at base", () => {
    const expectRefusedCleanly = (thrown: unknown, code: string, named: string): void => {
      expect(thrown).toBeInstanceOf(LoopRefused);
      expect((thrown as LoopRefused).code).toBe(code);
      expect((thrown as LoopRefused).message).toContain(named);
      expect(rawGit(repo.root, ["tag", "--list", "loop-*"])).toBe("");
      expect(existsSync(join(repo.root, "artifacts"))).toBe(false);
    };
    const refusal = (cfg: LoopConfig): unknown => {
      try {
        void runLoop(cfg);
      } catch (err) {
        return err;
      }
      return null;
    };

    for (const [key, value] of [
      ["include.path", shPath(join(tmp?.dir ?? "", "x"))],
      ["includeIf.gitdir:/tmp/.path", "/tmp/x"],
    ] as const) {
      it(`R13: ${key} at base is refused by name; removed, the loop proceeds`, async () => {
        const head = repo.sha();
        rawGit(repo.root, ["config", key, value]);
        expectRefusedCleanly(refusal(config()), "include-at-base", key.toLowerCase().split(".")[0]!);
        expect(repo.sha()).toBe(head);
        rawGit(repo.root, ["config", "--unset", key]);
        const r = await runLoop(config());
        expect(r.failure, r.failure?.reason).toBeNull();
      });
    }

    for (const [key, value] of [
      ["filter.x.clean", "/bin/evil"],
      ["core.sshCommand", "/bin/evil"],
    ] as const) {
      it(`R21: ${key} at base is refused, named; removed, the loop proceeds`, async () => {
        rawGit(repo.root, ["config", key, value]);
        expectRefusedCleanly(refusal(config()), "unsafe-config-at-base", key.toLowerCase());
        rawGit(repo.root, ["config", "--unset", key]);
        const r = await runLoop(config());
        expect(r.failure, r.failure?.reason).toBeNull();
      });
    }

    it(`R21: every key git init, git clone and git worktree add write passes, on ${rawGit(process.cwd(), ["--version"])}`, () => {
      const src = join(tmp.dir, "src");
      const clone = join(tmp.dir, "clone");
      rawGit(tmp.dir, ["init", "--quiet", "--initial-branch=main", src]);
      writeFileSync(join(src, "f"), "f\n");
      rawGit(src, ["add", "f"]);
      rawGit(src, ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "--quiet", "--no-verify", "--no-gpg-sign", "-m", "c"]);
      rawGit(tmp.dir, ["clone", "--quiet", src, clone]);
      rawGit(src, ["worktree", "add", "--quiet", join(tmp.dir, "wt2")]);
      for (const root of [src, clone, join(tmp.dir, "wt2")]) {
        const u = unsafeLocalKeys(root, resolveGitDirs(root));
        expect(u.error).toBeNull();
        expect(u.keys, `${root}: ${u.keys.join("; ")}`).toEqual([]);
      }
      // The instrument can say "unsafe": a planted key in the same clone.
      rawGit(clone, ["config", "core.sshCommand", "x"]);
      expect(unsafeLocalKeys(clone, resolveGitDirs(clone)).keys.join(" ")).toContain("core.sshcommand");
    });

    it("R21: commit.gpgsign=true is allowed because no runtime commit is signed — every one has no gpgsig header", async () => {
      rawGit(repo.root, ["config", "commit.gpgsign", "true"]);
      const r = await runLoop(config());
      expect(r.failure, r.failure?.reason).toBeNull();
      const runtimeCommits = rawGit(repo.root, ["rev-list", `${r.baseSha}..${r.evidenceSha}`]).split("\n").filter((c) => c !== "");
      expect(runtimeCommits.length).toBe(3);
      for (const c of runtimeCommits) {
        expect(rawGit(repo.root, ["cat-file", "commit", c]), `${c} carries a signature`).not.toMatch(/^gpgsig /m);
      }
      // CONTROL: the instrument sees a gpgsig header in a commit object that has one.
      const tree = rawGit(repo.root, ["rev-parse", `${r.evidenceSha}^{tree}`]);
      const signedText =
        `tree ${tree}\nauthor a <a@a> 0 +0000\ncommitter a <a@a> 0 +0000\n` +
        `gpgsig -----BEGIN PGP SIGNATURE-----\n \n -----END PGP SIGNATURE-----\n\nsigned\n`;
      const objFile = join(tmp.dir, "signed.txt");
      writeFileSync(objFile, signedText);
      const signed = rawGit(repo.root, ["hash-object", "-t", "commit", "-w", objFile]);
      expect(rawGit(repo.root, ["cat-file", "commit", signed])).toMatch(/^gpgsig /m);
    });

    it("R19: a target whose tracked path needs a required filter is refused by name; without the attribute it is not", async () => {
      const globalFile = join(tmp.dir, "global.gitconfig");
      writeFileSync(globalFile, `[filter "lfs"]\n\trequired = true\n\tclean = git-lfs clean -- %f\n`);
      const restore = withEnv({ GIT_CONFIG_GLOBAL: globalFile });
      try {
        // CONTROL first: the same machine config, no attribute naming the filter.
        const ok = await runLoop(config());
        expect(ok.failure, ok.failure?.reason).toBeNull();

        const lfs = makeRepo("harness-cfg-lfs-");
        try {
          lfs.write(".gitattributes", "*.bin filter=lfs\n");
          lfs.write("a.bin", "binary\n");
          // Committed WITHOUT the machine config, so git-lfs is never asked for.
          gitWithEnv(lfs.root, ["add", "-A"], { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" });
          gitWithEnv(lfs.root, ["commit", "--quiet", "--no-verify", "--no-gpg-sign", "-m", "lfs"], {
            ...process.env,
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_NOSYSTEM: "1",
          });
          let thrown: unknown = null;
          try {
            void runLoop({ ...config(), repoRoot: lfs.root });
          } catch (err) {
            thrown = err;
          }
          expect(thrown).toBeInstanceOf(LoopRefused);
          expect((thrown as LoopRefused).code).toBe("required-filter");
          expect((thrown as LoopRefused).message).toContain("filter.lfs.required");
        } finally {
          await lfs.cleanup();
        }
      } finally {
        restore();
      }
    });
  });

  it("CA-11: the loop's own output carries F11's sentence and the channel table", async () => {
    const lines: string[] = [];
    await runLoop(config({ log: (l) => lines.push(l) }));
    const text = lines.join("\n");
    expect(text).toContain(LOOP_LIMITS);
    expect(text).toContain("clean ON THE PROBED CHANNELS ONLY");
    expect(text).toContain("hashed and reported, not restored");
    expect(text).toMatch(/index — unprobed/);
    expect(text).toMatch(/normal-exit tree-kill/);
  });
});
