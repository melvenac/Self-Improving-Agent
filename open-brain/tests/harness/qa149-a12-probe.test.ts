/**
 * QA PROBE, NOT FOR MERGE. Loop 15 slice three, QA record session 149, candidate A12 7200e1c.
 *
 * Check 1 (the planner's suspected defect): R90's branch in closeAndRestore pushes `absent → unobservable (<code>)` and
 * `continue`s, so it neither removes the path nor adds it to `unrestored`. When that is the only change:
 *   - does the message claim "Every file was put back by bytes …" while the planted file is still in the tree?
 *   - does the runtime's R77 stop ("anything still unrestored … ends the stage before git") still hold?
 * Shapes: QA 130's Q130-R85-REPO-UNREADABLE-ZEROED (hooks emptied, a hook planted, hooks made 0600), QA 130's
 * Q130-R83-SUBDIR-NOSEARCH-PLANT (a plant in a hooks subdirectory made 0600), and QA 130's Q130-R83-DOTGIT-NOSEARCH
 * (the created-then-unlstatable config.worktree, where other paths ARE unrestored) as the contrast.
 * Check 2: the stored kind of that record, as it lands in FAILED.md's findings JSON.
 *
 * Every row prints one `Q149-<NAME> {json}` line with what it observed (the whole message and reason), then asserts
 * what R90 and R77 say. The acts are QA 130's, copied from qa/loop-15-slice-3-a11-probe 5564ef6.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";

const spy = vi.hoisted(() => ({ armed: false, calls: [] as string[] }));
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

import { appendFileSync, chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runLoop, type LoopConfig, type LoopResult } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";

const isWin = process.platform === "win32";
const say = (tag: string, o: unknown) =>
  console.log(`${tag} ${JSON.stringify(o, (_k, v) => (typeof v === "bigint" ? String(v) : v))}`);
const code = (f: () => unknown): string => {
  try { f(); return "none"; } catch (e) { return (e as NodeJS.ErrnoException).code ?? (e as Error).message; }
};
const PLANT = "[core]\n\tfsmonitor = /nonexistent/q130-monitor\n";
const CLAIM = "Every file was put back by bytes before any git call read the repository.";

type Run = { r: LoopResult | null; thrown: string; gitAfterRole: string[]; roleRan: boolean };

async function loopWith(repo: RepoFixture, act: () => void): Promise<Run> {
  let roleRan = false;
  const loop: LoopConfig = {
    repoRoot: repo.root, loop: "t001",
    roles: {
      planner: new StubPlanner(),
      developer: { role: "developer", run: async (ctx) => {
        roleRan = true;
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
  try { r = await runLoop(loop); } catch (e) { thrown = (e as Error).message; } finally { spy.armed = false; }
  const gitAfterRole = spy.calls.filter((c) => /(^|[\\/ ])git(\.exe)?( |$)/i.test(c) || /^git /.test(c));
  return { r, thrown, gitAfterRole, roleRan };
}

/** The config_verdicts change for `path` as FAILED.md's findings JSON stores it (check 2). */
const storedChange = (repo: RepoFixture, path: string): unknown => {
  const f = join(repo.root, "artifacts", "iterations", "t001", "FAILED.md");
  if (!existsSync(f)) return "(no FAILED.md)";
  const text = readFileSync(f, "utf-8");
  const m = /## Findings \(recorded, not failures\)\n\n```json\n([\s\S]*?)```/.exec(text);
  if (!m) return "(no findings block)";
  const j = JSON.parse(m[1]!) as { config_verdicts: { stage: string; changes: { path: string }[] }[] };
  return j.config_verdicts.flatMap((v) => v.changes.map((c) => ({ stage: v.stage, ...c }))).filter((c) => c.path === path);
};

const observe = (x: Run, repo: RepoFixture, path: string, plantStill: boolean) => {
  const dev = x.r?.configVerdicts.find((v) => v.stage === "developer") ?? null;
  return {
    thrown: x.thrown,
    roleRan: x.roleRan,
    status: x.r?.status,
    failureCode: x.r?.failure?.code ?? null,
    failureReason: x.r?.failure?.reason ?? null,
    verdictOk: dev?.ok ?? null,
    changes: dev?.changes.filter((c) => !c.path.endsWith(".sample")) ?? null,
    unrestored: dev?.unrestored ?? null,
    unlisted: dev?.unlisted ?? null,
    message: dev?.message ?? null,
    claimsRestore: (dev?.message ?? "").includes(CLAIM),
    plantStill,
    gitAfterRoleCount: x.gitAfterRole.length,
    gitAfterRole: x.gitAfterRole,
    stored: storedChange(repo, path),
  };
};

describe("QA 149 probe (not for merge): A12", { timeout: 120_000 }, () => {
  let repo: RepoFixture;
  const undo: string[] = [];
  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("q149-");
    undo.length = 0;
  });
  afterEach(async () => {
    for (const p of [...undo].reverse()) { try { chmodSync(p, 0o755); } catch { /* gone */ } }
    try { chmodSync(join(repo.root, ".git"), 0o755); } catch { /* already */ }
    try { chmodSync(join(repo.root, ".git", "hooks"), 0o755); } catch { /* already */ }
    await repo.cleanup();
  });

  const gitDir = () => join(repo.root, ".git");
  const cfgPath = () => join(repo.root, ".git", "config");
  const hooksPath = () => join(repo.root, ".git", "hooks");
  const emptyHooks = () => { for (const n of readdirSync(hooksPath())) rmSync(join(hooksPath(), n), { recursive: true, force: true }); };

  // Q130-R85-REPO-UNREADABLE-ZEROED's act, byte for byte.
  it.skipIf(isWin)("Q149-C1-HOOKS-ONLY: a hook planted in an emptied hooks dir made 0600 (the only change): no restore claimed while the plant is still there, and no git call after the role", async () => {
    const hooks = hooksPath();
    emptyHooks();
    const plant = join(hooks, "post-checkout");
    undo.push(hooks);
    let lstatCode = "";
    const x = await loopWith(repo, () => {
      writeFileSync(plant, "#!/bin/sh\necho planted\n");
      chmodSync(plant, 0o755);
      chmodSync(hooks, 0o600);
      lstatCode = code(() => lstatSync(plant));
    });
    chmodSync(hooks, 0o755);
    const plantStill = existsSync(plant);
    const o = observe(x, repo, plant, plantStill);
    say("Q149-C1-HOOKS-ONLY", { lstatCode, ...o });
    expect(lstatCode).toBe("EACCES");
    expect(o.changes?.find((c) => c.path === plant)?.after ?? "", "R90's record").toContain("unobservable (EACCES)");
    expect(o.claimsRestore && plantStill, "R90: never prints invented facts — no restore is claimed while the plant is still in the tree").toBe(false);
    expect(x.gitAfterRole, "R77: a path left in place ends the stage before git (QA 130: 0 git calls at A11)").toEqual([]);
  });

  // Q130-R83-SUBDIR-NOSEARCH-PLANT's act, byte for byte.
  it.skipIf(isWin)("Q149-C1-SUBDIR-ONLY: a file planted in a hooks subdirectory made 0600 (the only change): no restore claimed while the plant is still there, and no git call after the role", async () => {
    const sub = join(hooksPath(), "q130-sub");
    mkdirSync(sub);
    undo.push(sub);
    const plant = join(sub, "planted");
    let lstatCode = "";
    const x = await loopWith(repo, () => {
      writeFileSync(plant, "#!/bin/sh\necho planted\n");
      chmodSync(sub, 0o600);
      lstatCode = code(() => lstatSync(plant));
    });
    chmodSync(sub, 0o755);
    const plantStill = existsSync(plant);
    const o = observe(x, repo, plant, plantStill);
    say("Q149-C1-SUBDIR-ONLY", { lstatCode, ...o });
    expect(lstatCode).toBe("EACCES");
    expect(o.claimsRestore && plantStill, "R90: no restore is claimed while the plant is still in the tree").toBe(false);
    expect(x.gitAfterRole, "R77").toEqual([]);
  });

  // Q130-R83-DOTGIT-NOSEARCH's act, byte for byte: config.worktree is created-then-unlstatable, and other paths fail too.
  it.skipIf(isWin)("Q149-C1-DOTGIT-CONTRAST: config planted, .git made 0600: config.worktree is absent → unobservable, and the other paths are unrestored, so no restore is claimed", async () => {
    undo.push(gitDir());
    let lstatCode = "";
    const x = await loopWith(repo, () => {
      appendFileSync(cfgPath(), PLANT);
      chmodSync(gitDir(), 0o600);
      lstatCode = code(() => lstatSync(cfgPath()));
    });
    chmodSync(gitDir(), 0o755);
    const wt = join(gitDir(), "config.worktree");
    const o = observe(x, repo, wt, existsSync(wt));
    say("Q149-C1-DOTGIT-CONTRAST", { lstatCode, ...o });
    expect(lstatCode).toBe("EACCES");
    expect(o.claimsRestore, "other paths are unrestored, so the claim is not made").toBe(false);
    expect(x.gitAfterRole, "R77").toEqual([]);
  });
});
