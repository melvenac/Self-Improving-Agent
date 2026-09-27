/**
 * A13 rows, developer record 159. Red on product 7200e1c.
 *
 * R97: each R77 shape asserts the summary sentence and that git does not run
 * after the role. R96: that record's stored kind is "unobservable".
 * chmod 0600 is Linux (tcm). The mock row wraps lstat so the same absent-at-open
 * branch is reached on every platform.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";

const gitSpy = vi.hoisted(() => ({ armed: false, calls: [] as string[] }));
const lstatGate = vi.hoisted(() => ({ on: false, suffixes: [] as string[], hits: 0 }));

vi.mock("node:child_process", async (importOriginal) => {
  const m = await importOriginal<typeof import("node:child_process")>();
  const spawnSync = ((...a: unknown[]) => {
    if (gitSpy.armed) {
      const args = Array.isArray(a[1]) ? (a[1] as string[]) : [];
      const sub = args.filter((x, i) => !x.startsWith("-") && args[i - 1] !== "-c");
      gitSpy.calls.push(`${String(a[0])} ${sub.slice(0, 3).join(" ")}`);
    }
    return (m.spawnSync as (...x: unknown[]) => unknown)(...a);
  }) as typeof m.spawnSync;
  return { ...m, default: { ...m, spawnSync }, spawnSync };
});

vi.mock("node:fs", async (importOriginal) => {
  const m = await importOriginal<typeof import("node:fs")>();
  const lstatSync = ((p: unknown, ...rest: unknown[]) => {
    const n = String(p).replace(/\\/g, "/").toLowerCase();
    if (lstatGate.on && lstatGate.suffixes.some((s) => n.endsWith(s))) {
      lstatGate.hits += 1;
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

import {
  appendFileSync, chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { runLoop, type LoopConfig, type LoopResult } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";

const isWin = process.platform === "win32";
const CLAIM = "Every file was put back by bytes before any git call read the repository.";
const NOTE = "absent at the open; cannot be lstat'd at close (EACCES); not removed";
const CONFIG_LINE = "[core]\n\tfsmonitor = /nonexistent/a13-monitor\n";

type Run = { r: LoopResult | null; thrown: string; gitAfterRole: string[] };

const errnoCode = (fn: () => void): string => {
  try {
    fn();
    return "none";
  } catch (e) {
    return (e as NodeJS.ErrnoException).code ?? (e as Error).message;
  }
};

async function loopWith(repo: RepoFixture, act: () => void): Promise<Run> {
  const loop: LoopConfig = {
    repoRoot: repo.root,
    loop: "t001",
    roles: {
      planner: new StubPlanner(),
      developer: {
        role: "developer",
        run: async (ctx) => {
          const d = await new StubDeveloper().run(ctx);
          act();
          gitSpy.calls = [];
          gitSpy.armed = true;
          return d;
        },
      },
      qa: new StubQa(),
    },
    checks: exitingChecks(0, 0),
    log: () => {},
  };
  let r: LoopResult | null = null;
  let thrown = "";
  try {
    r = await runLoop(loop);
  } catch (e) {
    thrown = (e as Error).message;
  } finally {
    gitSpy.armed = false;
  }
  const gitAfterRole = gitSpy.calls.filter((c) => /(^|[\\/ ])git(\.exe)?( |$)/i.test(c) || /^git /.test(c));
  return { r, thrown, gitAfterRole };
}

function shot(x: Run, plant: string) {
  const dev = x.r?.configVerdicts.find((v) => v.stage === "developer") ?? null;
  const message = dev?.message ?? "";
  const change = dev?.changes.find((c) => c.path === plant) ?? null;
  return {
    thrown: x.thrown,
    kind: change?.kind ?? null,
    claimsRestore: message.includes(CLAIM),
    namesUnrestored: message.includes("FILE(S) COULD NOT BE PUT BACK") && message.includes(NOTE),
    gitAfterRole: x.gitAfterRole,
    plantStill: existsSync(plant),
    unrestored: dev?.unrestored ?? [],
  };
}

const stopped = {
  kind: "unobservable",
  claimsRestore: false,
  namesUnrestored: true,
  gitAfterRole: [] as string[],
  plantStill: true,
};

describe("A13 R95-R97 an R90-only path is unrestored and stops before git", { timeout: 120_000 }, () => {
  let repo: RepoFixture;
  const undo: string[] = [];

  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("a13-");
    undo.length = 0;
    lstatGate.on = false;
    lstatGate.hits = 0;
    lstatGate.suffixes = [];
    gitSpy.armed = false;
    gitSpy.calls = [];
  });
  afterEach(async () => {
    lstatGate.on = false;
    for (const p of [...undo].reverse()) {
      try { chmodSync(p, 0o755); } catch { /* gone */ }
    }
    try { chmodSync(join(repo.root, ".git"), 0o755); } catch { /* already */ }
    try { chmodSync(join(repo.root, ".git", "hooks"), 0o755); } catch { /* already */ }
    await repo.cleanup();
  });

  const hooksPath = () => join(repo.root, ".git", "hooks");
  const emptyHooks = () => {
    for (const n of readdirSync(hooksPath())) rmSync(join(hooksPath(), n), { recursive: true, force: true });
  };

  function expectStopped(tag: string, x: Run, plant: string, extra: Record<string, unknown> = {}) {
    const seen = { ...shot(x, plant), ...extra };
    console.log(`${tag} ${JSON.stringify(seen)}`);
    expect({
      kind: seen.kind,
      claimsRestore: seen.claimsRestore,
      namesUnrestored: seen.namesUnrestored,
      gitAfterRole: seen.gitAfterRole,
      plantStill: seen.plantStill,
    }).toEqual(stopped);
  }

  it.skipIf(isWin)("R97-Q149-C1-HOOKS-ONLY: a hook planted in an emptied hooks dir made 0600 is the only change", async () => {
    const hooks = hooksPath();
    emptyHooks();
    const plant = join(hooks, "post-checkout");
    undo.push(hooks);
    let lstatCode = "";
    const x = await loopWith(repo, () => {
      writeFileSync(plant, "#!/bin/sh\necho planted\n");
      chmodSync(plant, 0o755);
      chmodSync(hooks, 0o600);
      lstatCode = errnoCode(() => lstatSync(plant));
    });
    chmodSync(hooks, 0o755);
    expect(lstatCode, "lstat of the plant fails while the directory is 0600").toBe("EACCES");
    expectStopped("R97-Q149-C1-HOOKS-ONLY", x, plant, { lstatCode });
  });

  it.skipIf(isWin)("R97-Q149-SUBDIR-ONLY: a file planted in a hooks subdirectory made 0600 is the only change", async () => {
    const sub = join(hooksPath(), "a13-sub");
    mkdirSync(sub);
    undo.push(sub);
    const plant = join(sub, "planted");
    let lstatCode = "";
    const x = await loopWith(repo, () => {
      writeFileSync(plant, "#!/bin/sh\necho planted\n");
      chmodSync(sub, 0o600);
      lstatCode = errnoCode(() => lstatSync(plant));
    });
    chmodSync(sub, 0o755);
    expect(lstatCode).toBe("EACCES");
    expectStopped("R97-Q149-SUBDIR-ONLY", x, plant, { lstatCode });
  });

  it.skipIf(isWin)("R97-Q130-R83-SUBDIR-NOSEARCH-PLANT: the same subdirectory plant, scored under QA 130's row name", async () => {
    const sub = join(hooksPath(), "q130-sub");
    mkdirSync(sub);
    undo.push(sub);
    const plant = join(sub, "planted");
    let lstatCode = "";
    const x = await loopWith(repo, () => {
      writeFileSync(plant, "#!/bin/sh\necho planted\n");
      chmodSync(sub, 0o600);
      lstatCode = errnoCode(() => lstatSync(plant));
    });
    chmodSync(sub, 0o755);
    expect(lstatCode).toBe("EACCES");
    expectStopped("R97-Q130-R83-SUBDIR-NOSEARCH-PLANT", x, plant, { lstatCode });
  });

  it("R97-Q149-MOCK-PLUS-CONFIG: lstat of a planted hook fails, and .git/config is edited and put back", async () => {
    emptyHooks();
    const plant = join(hooksPath(), "post-checkout");
    const cfg = join(repo.root, ".git", "config");
    const cfgBefore = readFileSync(cfg, "utf8");
    const x = await loopWith(repo, () => {
      appendFileSync(cfg, CONFIG_LINE);
      writeFileSync(plant, "#!/bin/sh\necho planted\n");
      lstatGate.suffixes = ["/.git/hooks/post-checkout"];
      lstatGate.on = true;
    });
    const cfgRestored = readFileSync(cfg, "utf8") === cfgBefore;
    expect(lstatGate.hits, "close reached the wrapped lstat").toBeGreaterThan(0);
    expect(cfgRestored, "the config edit is put back by bytes").toBe(true);
    expectStopped("R97-Q149-MOCK-PLUS-CONFIG", x, plant, { cfgRestored, lstatHits: lstatGate.hits });
  });
});
