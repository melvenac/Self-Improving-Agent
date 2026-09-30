/**
 * A12 rows. R90–R92 are red on bbf9d07 plus master. R93 adopts the three
 * shapes QA 130's mutants kill, which already hold on that tree.
 * chmod 0600 and a directory symlink are Linux; tcm is the read.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import {
  appendFileSync, chmodSync, lstatSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync,
} from "node:fs";
import { symlinkSyncOrSkip } from "./symlink-or-skip.js";
import { join } from "node:path";
import { MachineConfigWatch, resolveGitDirs } from "../../src/harness/configwatch.js";
import { runLoop, type LoopConfig, type LoopResult } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const isWin = process.platform === "win32";

const errnoCode = (fn: () => void): string => {
  try {
    fn();
    return "none";
  } catch (e) {
    return (e as NodeJS.ErrnoException).code ?? (e as Error).message;
  }
};

describe("A12 R90 a contained lstat failure invents nothing", { timeout: 60_000 }, () => {
  let repo: RepoFixture;
  beforeAll(() => requireGit());
  beforeEach(() => { repo = makeRepo("r90-"); });
  afterEach(async () => {
    try { chmodSync(join(repo.root, ".git"), 0o755); } catch { /* already */ }
    try { chmodSync(join(repo.root, ".git", "hooks"), 0o755); } catch { /* already */ }
    await repo.cleanup();
  });

  const hooksOf = () => join(repo.root, ".git", "hooks");

  const run = async (act: () => void): Promise<LoopResult | null> => {
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
            return d;
          },
        },
        qa: new StubQa(),
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    try {
      return await runLoop(loop);
    } finally {
      try { chmodSync(join(repo.root, ".git"), 0o755); } catch { /* already */ }
      try { chmodSync(hooksOf(), 0o755); } catch { /* already */ }
    }
  };

  it.skipIf(isWin)("R90-STATEHASH: a present hook whose lstat fails prints the code and no facts", async () => {
    const hooks = hooksOf();
    const keep = join(hooks, "r90-keep");
    writeFileSync(keep, "#!/bin/sh\necho r90\n");
    chmodSync(keep, 0o755);
    let lstatCode = "";
    const r = await run(() => {
      chmodSync(hooks, 0o600);
      lstatCode = errnoCode(() => lstatSync(keep));
    });
    const change = r?.configVerdicts.flatMap((v) => v.changes).find((c) => c.path === keep) ?? null;
    expect(lstatCode, "lstat of the listed hook fails").toBe("EACCES");
    expect(change, "the failed lstat is recorded against the hook").not.toBeNull();
    expect(change!.after, "stateHash names the failure and that lstat produced no facts").toBe(
      "unreadable (EACCES); no facts: lstat failed",
    );
    expect(change!.after, "no invented type").not.toContain("type file");
    expect(change!.after, "no zeroed dev").not.toContain("dev null");
    expect(change!.after, "no zeroed size").not.toContain("size 0");
  });

  it.skipIf(isWin)("R90-ABSENT-UNOBSERVABLE: a path absent at open that cannot be lstat'd is not created", async () => {
    const git = join(repo.root, ".git");
    const worktree = join(resolveGitDirs(repo.root).gitDir, "config.worktree");
    let lstatCode = "";
    const r = await run(() => {
      chmodSync(git, 0o600);
      lstatCode = errnoCode(() => lstatSync(worktree));
    });
    const verdicts = r?.configVerdicts ?? [];
    const change = verdicts.flatMap((v) => v.changes).find((c) => c.path === worktree) ?? null;
    const message = verdicts.map((v) => v.message).join("\n");
    const unrestored = verdicts.flatMap((v) => v.unrestored);
    expect(lstatCode, "lstat through an unsearchable .git fails").toBe("EACCES");
    expect(change, "the path is recorded").not.toBeNull();
    expect(change!.kind, "an unobserved path is never created").not.toBe("created");
    expect(change!.before, "it was absent at the open").toBe("absent");
    expect(message, "the record is absent to unobservable").toContain("absent → unobservable (EACCES)");
    expect(message, "the message does not say the worktree file was created").not.toContain("config.worktree created");
    expect(unrestored.join("\n"), "the note does not invent a created other").not.toContain("a other was created");
  });
});

describe("A12 R91 and R92 machine-side texts", () => {
  let tmp: { dir: string; cleanup: () => Promise<void> };
  beforeAll(() => requireGit());
  beforeEach(() => { tmp = scratch("a12-"); });
  afterEach(async () => { await tmp.cleanup(); });

  it.skipIf(isWin)("R91-VIA-FACTS: unobservable under a directory link carries the file stat and the link lstat", () => {
    const xdg = join(tmp.dir, "r91-xdg");
    const target = join(tmp.dir, "r91-target");
    mkdirSync(target);
    const file = join(target, "config");
    writeFileSync(file, "[user]\n\tname = r91\n");
    mkdirSync(xdg);
    const link = join(xdg, "git");
    symlinkSyncOrSkip(target, link, "dir");
    const cfg = join(link, "config");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "r91" }]);
    watch.captureBase();
    watch.begin("developer");
    appendFileSync(file, "[core]\n\tx = 1\n");
    chmodSync(file, 0o000);
    const fileIno = String(statSync(file, { bigint: true }).ino);
    const linkIno = String(lstatSync(link, { bigint: true }).ino);
    let row: ReturnType<MachineConfigWatch["compare"]>[number] | undefined;
    try {
      row = watch.compare().find((f) => f.path === cfg);
    } finally {
      chmodSync(file, 0o644);
    }
    expect(row?.unobservableCode, "the close names EACCES").toBe("EACCES");
    expect(row?.after ?? "", "the link's lstat").toContain(`ino ${linkIno}`);
    expect(row?.after ?? "", "the link is labelled").toContain("link: type symlink");
    expect(row?.after ?? "", "observe's stat of the file is printed").toContain(`ino ${fileIno}`);
  });

  it.skipIf(isWin)("R92-ABSENT-ANCESTOR: an ancestor link planted where the base was absent prints that link's lstat", () => {
    const xdg = join(tmp.dir, "r92-xdg");
    mkdirSync(xdg);
    const cfg = join(xdg, "git", "config");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "r92" }]);
    watch.captureBase();
    watch.begin("developer");
    const other = join(tmp.dir, "r92-other");
    mkdirSync(other);
    writeFileSync(join(other, "config"), "[user]\n\tname = r92\n");
    const link = join(xdg, "git");
    symlinkSyncOrSkip(other, link, "dir");
    const linkIno = String(lstatSync(link, { bigint: true }).ino);
    const row = watch.compare().find((f) => f.path === cfg);
    expect(row?.changed, "the planted ancestor is a change").toBe(true);
    expect(row?.after ?? "", "the absent branch").toContain("absent →");
    expect(row?.after ?? "", "the link is labelled").toContain("link: type symlink");
    expect(row?.after ?? "", "the link's lstat ino").toContain(`ino ${linkIno}`);
  });
});

describe("A12 R93 adopted rows", { timeout: 60_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };
  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("r93-");
    tmp = scratch("r93-");
  });
  afterEach(async () => {
    try { chmodSync(join(repo.root, ".git", "hooks"), 0o755); } catch { /* already */ }
    await repo.cleanup();
    await tmp.cleanup();
  });

  it.skipIf(isWin)("R93-STAT-FACTS: unobservable carries the file's facts when stat succeeded", () => {
    const home = join(tmp.dir, "r93-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = r93\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "r93" }]);
    watch.captureBase();
    watch.begin("developer");
    chmodSync(cfg, 0o000);
    const ino = String(lstatSync(cfg, { bigint: true }).ino);
    let row: ReturnType<MachineConfigWatch["compare"]>[number] | undefined;
    try {
      row = watch.compare().find((f) => f.path === cfg);
    } finally {
      chmodSync(cfg, 0o644);
    }
    expect(row?.unobservableCode).toBe("EACCES");
    expect(row?.after ?? "", "A10-4: facts when stat succeeded").toContain(`ino ${ino}`);
    expect(row?.after ?? "", "facts are not dropped").not.toContain("no facts: realpath failed");
  });

  it.skipIf(isWin)("R93-LSTAT-AT-OPEN: an lstat failure at the open refuses the stage", async () => {
    const hooks = join(repo.root, ".git", "hooks");
    for (const name of readdirSync(hooks)) rmSync(join(hooks, name), { recursive: true, force: true });
    const hook = join(hooks, "pre-commit");
    writeFileSync(hook, "#!/bin/sh\necho r93\n");
    chmodSync(hooks, 0o600);
    let ran = false;
    const loop: LoopConfig = {
      repoRoot: repo.root,
      loop: "t001",
      roles: {
        planner: new StubPlanner(),
        developer: {
          role: "developer",
          run: async (ctx) => {
            ran = true;
            return new StubDeveloper().run(ctx);
          },
        },
        qa: new StubQa(),
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    let result: LoopResult | null = null;
    try {
      result = await runLoop(loop);
    } finally {
      chmodSync(hooks, 0o755);
    }
    expect(result!.failure?.code, "an lstat failure at open refuses the stage").toBe("config-watch-unestablished");
    expect(ran, "the role does not run").toBe(false);
    expect(result!.failure?.reason ?? "", "the reason names the hook").toContain(hook);
    expect(result!.failure?.reason ?? "", "the reason names EACCES").toContain("EACCES");
  });

  it.skipIf(isWin)("R93-PARENT-LINK: a parent link's lstat is the unobservable side when the target cannot be read", () => {
    const xdg = join(tmp.dir, "r93-xdg");
    const target = join(tmp.dir, "r93-target");
    mkdirSync(target);
    writeFileSync(join(target, "config"), "[user]\n\tname = r93p\n");
    mkdirSync(xdg);
    const link = join(xdg, "git");
    symlinkSyncOrSkip(target, link, "dir");
    const cfg = join(link, "config");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "r93p" }]);
    watch.captureBase();
    watch.begin("developer");
    chmodSync(target, 0o000);
    const linkIno = String(lstatSync(link, { bigint: true }).ino);
    let row: ReturnType<MachineConfigWatch["compare"]>[number] | undefined;
    try {
      row = watch.compare().find((f) => f.path === cfg);
    } finally {
      chmodSync(target, 0o755);
    }
    expect(row?.unobservableCode).toBe("EACCES");
    expect(row?.after ?? "", "R85b parent-link branch prints the link lstat").toContain(`ino ${linkIno}`);
    expect(row?.after ?? "", "the link is labelled").toContain("link: type symlink");
  });
});
