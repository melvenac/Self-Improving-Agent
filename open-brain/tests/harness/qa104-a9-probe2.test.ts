/**
 * QA PROBE, NOT FOR MERGE. Loop 15 slice three, QA record session 104, candidate A9 6bd97f2. Second file, written after
 * CI run 36105737530 showed R73-PARENT-EACCES failing with an exception thrown out of MachineConfigWatch.compare()
 * (`identify()` rethrows every lstat error except ENOENT and ENOTDIR). Kept apart from qa104-a9-probe.test.ts so the
 * local mutant batch, which copies that file for every mutant, runs one unchanged probe set throughout.
 *
 * R73: "Where `lstat` itself fails, the record says that, with the error code. It is never an empty side."
 * R72: "A placeholder (`unreadable`, `absent`) never stands alone for a side that has facts."
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { chmodSync, lstatSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runLoop, type LoopConfig } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { MachineConfigWatch } from "../../src/harness/configwatch.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const isWin = process.platform === "win32";
const say = (tag: string, o: unknown) => console.log(`${tag} ${JSON.stringify(o, (_k, v) => (typeof v === "bigint" ? String(v) : v))}`);
const facts = (p: string) => {
  const s = lstatSync(p, { bigint: true });
  return { dev: String(s.dev), ino: String(s.ino), nlink: String(s.nlink), size: String(s.size), mtimeNs: String(s.mtimeNs) };
};
type Row = { stage: string; path: string; before: string; after: string; changed?: boolean };

describe("QA 104 probe 2 (not for merge): lstat failures at A9", { timeout: 120_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };
  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("qa104-probe2-");
    tmp = scratch("qa104-probe2-out-");
  });
  afterEach(async () => {
    await repo.cleanup();
    await tmp.cleanup();
  });

  const home = (name: string) => {
    const h = join(tmp.dir, name);
    mkdirSync(h);
    return { h, cfg: join(h, ".gitconfig") };
  };

  it.skipIf(isWin)("R73-LSTAT-EACCES-UNIT: HOME made mode 000 in the stage: compare() records the lstat failure with its code", () => {
    const { h, cfg } = home("le-home");
    writeFileSync(cfg, "[user]\n\tname = le-base\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "qa104" }]);
    watch.captureBase();
    watch.begin("developer");
    chmodSync(h, 0o000);
    let code = "";
    let thrown = "";
    let rows: Row[] = [];
    try {
      try { lstatSync(cfg); } catch (e) { code = (e as NodeJS.ErrnoException).code ?? ""; }
      try { rows = watch.compare() as Row[]; } catch (e) { thrown = (e as Error).message; }
    } finally {
      chmodSync(h, 0o755);
    }
    const d = rows.find((x) => x.path === cfg);
    say("QA104-R73-LSTAT-EACCES-UNIT", { code, thrown, d });
    expect(code, "plant: lstat fails with EACCES").toBe("EACCES");
    expect(thrown, "R73: the record says lstat failed; compare() does not throw").toBe("");
    expect(d?.after, "R73: with the error code").toContain("EACCES");
    expect(d?.changed, "a change (read at stage start, not resolvable at its end)").toBe(true);
  });

  it.skipIf(isWin)("R73-LSTAT-EACCES-LOOP: runLoop; the developer makes HOME mode 000: a developer-stage record with EACCES", async () => {
    const { h, cfg } = home("lel-home");
    writeFileSync(cfg, "[user]\n\tname = lel-base\n");
    const xdg = join(tmp.dir, "lel-xdg");
    mkdirSync(xdg);
    const system = join(tmp.dir, "lel-system.gitconfig");
    writeFileSync(system, "");
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: h, USERPROFILE: h, XDG_CONFIG_HOME: xdg, GIT_CONFIG_SYSTEM: system };
    delete env.GIT_CONFIG_GLOBAL;
    let code = "";
    const cfgLoop: LoopConfig = {
      repoRoot: repo.root, loop: "t001", env,
      roles: {
        planner: new StubPlanner(),
        developer: { role: "developer", run: async (ctx) => {
          const d = await new StubDeveloper().run(ctx);
          chmodSync(h, 0o000);
          try { lstatSync(cfg); } catch (e) { code = (e as NodeJS.ErrnoException).code ?? ""; }
          return d;
        } },
        qa: new StubQa(),
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    const r = await runLoop(cfgLoop).finally(() => chmodSync(h, 0o755));
    const mine = r.machineConfigFindings.filter((x) => x.path === cfg);
    const lines = r.findings.filter((l) => l.includes(cfg));
    say("QA104-R73-LSTAT-EACCES-LOOP", {
      status: r.status, failure: r.failure ? { stage: r.failure.stage, code: r.failure.code, reason: r.failure.reason.slice(0, 400) } : null,
      code, mine, lines, refVerdicts: (r as { refVerdicts?: unknown[] }).refVerdicts?.length ?? null,
    });
    expect(code, "plant: EACCES").toBe("EACCES");
    expect(mine.some((f) => f.stage === "developer"), "R73: the developer stage has a record for the path").toBe(true);
    expect(JSON.stringify(mine), "R73: the record carries the error code").toContain("EACCES");
  });

  it("R72-BEFORE-ABSENT-DANGLING: a dangling symlink at base and at qa's start; qa creates its target: 'before' is not a bare 'absent'", () => {
    const { cfg } = home("bad-home");
    const target = join(tmp.dir, "bad-target");
    symlinkSync(target, cfg);
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "qa104" }]);
    watch.captureBase();
    watch.begin("developer");
    watch.compare();
    const start = facts(cfg);
    watch.begin("qa");
    writeFileSync(target, "[user]\n\tname = bad-target\n");
    const q = (watch.compare() as Row[]).find((x) => x.path === cfg)!;
    say("QA104-R72-BEFORE-ABSENT-DANGLING", { start, q });
    expect(lstatSync(cfg).isSymbolicLink(), "plant: the link is there").toBe(true);
    expect(q.changed, "a change").toBe(true);
    expect(q.before, "R72: 'absent' does not stand alone for a side with lstat facts (a link existed)").not.toBe("absent");
    expect(q.before, "R73: the link's lstat facts").toContain(start.ino);
  });
});
