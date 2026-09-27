/**
 * QA PROBE, NOT FOR MERGE. QA record session 149, candidate A12 7200e1c. Check 1 on EVERY platform.
 *
 * The QA PC runs elevated with SeBackupPrivilege enabled, so an ACL cannot make lstat fail there. This file makes
 * `lstat` of ONE planted path throw EACCES (node:fs's lstatSync is wrapped, and only that path, only after the role's
 * act), so R90's branch in closeAndRestore is reached with the planted file still on disk. The real shapes are in
 * qa149-a12-probe.test.ts (POSIX, tcm). Rows print `Q149-<NAME> {json}`.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";

const spy = vi.hoisted(() => ({ armed: false, calls: [] as string[] }));
const fsm = vi.hoisted(() => ({ on: false, suffixes: [] as string[], hits: 0 }));
vi.mock("node:child_process", async (importOriginal) => {
  const m = await importOriginal<typeof import("node:child_process")>();
  const spawnSync = ((...a: unknown[]) => {
    if (spy.armed) {
      const args = Array.isArray(a[1]) ? (a[1] as string[]) : [];
      const sub = args.filter((x, i) => !x.startsWith("-") && args[i - 1] !== "-c");
      spy.calls.push(`${String(a[0])} ${sub.slice(0, 3).join(" ")}`);
    }
    return (m.spawnSync as (...x: unknown[]) => unknown)(...a);
  }) as typeof m.spawnSync;
  return { ...m, default: { ...m, spawnSync }, spawnSync };
});
vi.mock("node:fs", async (importOriginal) => {
  const m = await importOriginal<typeof import("node:fs")>();
  const lstatSync = ((p: unknown, ...rest: unknown[]) => {
    const n = String(p).replace(/\\/g, "/").toLowerCase();
    if (fsm.on && fsm.suffixes.some((s) => n.endsWith(s))) {
      fsm.hits += 1;
      const e = new Error(`EACCES: permission denied, lstat '${String(p)}'`) as NodeJS.ErrnoException;
      e.code = "EACCES";
      e.errno = -13;
      e.syscall = "lstat";
      throw e;
    }
    return (m.lstatSync as (...x: unknown[]) => unknown)(p, ...rest);
  }) as typeof m.lstatSync;
  return { ...m, default: { ...m, lstatSync }, lstatSync };
});

import { appendFileSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runLoop, type LoopConfig, type LoopResult } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";

const say = (tag: string, o: unknown) =>
  console.log(`${tag} ${JSON.stringify(o, (_k, v) => (typeof v === "bigint" ? String(v) : v))}`);
const CLAIM = "Every file was put back by bytes before any git call read the repository.";
const PLANT = "[core]\n\tfsmonitor = /nonexistent/q149-monitor\n";

type Run = { r: LoopResult | null; thrown: string; gitAfterRole: string[] };

async function loopWith(repo: RepoFixture, act: () => void): Promise<Run> {
  const loop: LoopConfig = {
    repoRoot: repo.root, loop: "t001",
    roles: {
      planner: new StubPlanner(),
      developer: { role: "developer", run: async (ctx) => {
        const d = await new StubDeveloper().run(ctx);
        act();
        spy.calls = [];
        spy.armed = true;
        return d;
      } },
      qa: new StubQa(),
    },
    checks: exitingChecks(0, 0),
    log: () => {},
  };
  let r: LoopResult | null = null;
  let thrown = "";
  try { r = await runLoop(loop); } catch (e) { thrown = (e as Error).message; } finally { spy.armed = false; fsm.on = false; }
  const gitAfterRole = spy.calls.filter((c) => /(^|[\\/ ])git(\.exe)?( |$)/i.test(c) || /^git /.test(c));
  return { r, thrown, gitAfterRole };
}

const storedChange = (repo: RepoFixture, path: string): unknown => {
  const f = join(repo.root, "artifacts", "iterations", "t001", "FAILED.md");
  if (!existsSync(f)) return "(no FAILED.md)";
  const m = /## Findings \(recorded, not failures\)\n\n```json\n([\s\S]*?)```/.exec(readFileSync(f, "utf-8"));
  if (!m) return "(no findings block)";
  const j = JSON.parse(m[1]!) as { config_verdicts: { stage: string; changes: { path: string }[] }[] };
  return j.config_verdicts.flatMap((v) => v.changes.map((c) => ({ stage: v.stage, ...c }))).filter((c) => c.path === path);
};

const observe = (x: Run, repo: RepoFixture, path: string) => {
  const dev = x.r?.configVerdicts.find((v) => v.stage === "developer") ?? null;
  const plantStill = existsSync(path);
  return {
    thrown: x.thrown,
    status: x.r?.status,
    failureCode: x.r?.failure?.code ?? null,
    failureReason: x.r?.failure?.reason ?? null,
    changes: dev?.changes.filter((c) => !c.path.endsWith(".sample")) ?? null,
    unrestored: dev?.unrestored ?? null,
    message: dev?.message ?? null,
    claimsRestore: (dev?.message ?? "").includes(CLAIM),
    plantStill,
    plantBytes: plantStill ? readFileSync(path, "utf-8") : null,
    lstatHits: fsm.hits,
    gitAfterRoleCount: x.gitAfterRole.length,
    gitAfterRole: x.gitAfterRole,
    stored: storedChange(repo, path),
  };
};

describe("QA 149 mocked-lstat probe (not for merge): A12 R90 branch, every platform", { timeout: 120_000 }, () => {
  let repo: RepoFixture;
  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("q149m-");
    fsm.on = false;
    fsm.hits = 0;
    fsm.suffixes = [];
  });
  afterEach(async () => {
    fsm.on = false;
    await repo.cleanup();
  });

  const hooksPath = () => join(repo.root, ".git", "hooks");
  const emptyHooks = () => { for (const n of readdirSync(hooksPath())) rmSync(join(hooksPath(), n), { recursive: true, force: true }); };

  it("Q149-MOCK-HOOKS-ONLY: a hook planted in an emptied hooks dir, whose lstat fails at close (the only change)", async () => {
    emptyHooks();
    const plant = join(hooksPath(), "post-checkout");
    const x = await loopWith(repo, () => {
      writeFileSync(plant, "#!/bin/sh\necho planted\n");
      fsm.suffixes = ["/.git/hooks/post-checkout"];
      fsm.on = true;
    });
    const o = observe(x, repo, plant);
    say("Q149-MOCK-HOOKS-ONLY", o);
    expect(o.lstatHits, "the wrapped lstat was reached").toBeGreaterThan(0);
    expect(o.changes?.find((c) => c.path === plant)?.after ?? "", "R90's record").toContain("unobservable (EACCES)");
    expect(o.claimsRestore && o.plantStill, "R90: no restore is claimed while the plant is still in the tree").toBe(false);
    expect(x.gitAfterRole, "R77: a path left in place ends the stage before git").toEqual([]);
  });

  it("Q149-MOCK-PLUS-CONFIG: the same plant, and .git/config edited (restored by bytes): the claim covers the plant too", async () => {
    emptyHooks();
    const plant = join(hooksPath(), "post-checkout");
    const cfg = join(repo.root, ".git", "config");
    const cfgBefore = readFileSync(cfg, "utf-8");
    const x = await loopWith(repo, () => {
      appendFileSync(cfg, PLANT);
      writeFileSync(plant, "#!/bin/sh\necho planted\n");
      fsm.suffixes = ["/.git/hooks/post-checkout"];
      fsm.on = true;
    });
    const o = observe(x, repo, plant);
    const cfgRestored = readFileSync(cfg, "utf-8") === cfgBefore;
    say("Q149-MOCK-PLUS-CONFIG", { cfgRestored, ...o });
    expect(cfgRestored, "the config is put back").toBe(true);
    expect(o.claimsRestore && o.plantStill, "R90: no restore is claimed while the plant is still in the tree").toBe(false);
    expect(x.gitAfterRole, "R77").toEqual([]);
  });

  it("Q149-MOCK-PRESENT-CONTROL: a hook present at the open whose lstat fails at close (R90 bullet 1; not the absent branch)", async () => {
    const keep = join(hooksPath(), "pre-commit");
    writeFileSync(keep, "#!/bin/sh\necho keep\n");
    const x = await loopWith(repo, () => {
      fsm.suffixes = ["/.git/hooks/pre-commit"];
      fsm.on = true;
    });
    const o = observe(x, repo, keep);
    say("Q149-MOCK-PRESENT-CONTROL", o);
    expect(o.changes?.find((c) => c.path === keep)?.after ?? "").toBe("unreadable (EACCES); no facts: lstat failed");
    expect(o.claimsRestore, "a present path that cannot be restored is unrestored").toBe(false);
    expect(x.gitAfterRole, "R77").toEqual([]);
  });
});
