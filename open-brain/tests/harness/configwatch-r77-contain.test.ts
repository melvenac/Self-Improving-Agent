/**
 * R77 red tests on A9 6bd97f2. Each names the unguarded call it covers.
 * EACCES on a directory is Linux; these rows skip on win32. tcm is the read.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { chmodSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ConfigWatch,
  MachineConfigWatch,
  identify,
  repositoryLinksAtBase,
  resolveGitDirs,
} from "../../src/harness/configwatch.js";
import { makeRepo, requireGit, type RepoFixture } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const isWin = process.platform === "win32";

describe("R77 containment at A9", { timeout: 60_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };
  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("r77-");
    tmp = scratch("r77-out-");
  });
  afterEach(async () => {
    try { chmodSync(join(repo.root, ".git/hooks"), 0o755); } catch { /* already */ }
    try { chmodSync(join(repo.root, ".git/config"), 0o644); } catch { /* already */ }
    await repo.cleanup();
    await tmp.cleanup();
  });

  it.skipIf(isWin)("R77-IDENTIFY: lstat EACCES is recorded, not rethrown (identify :115, catch :121)", () => {
    const hooks = join(repo.root, ".git/hooks");
    chmodSync(hooks, 0o000);
    const p = join(hooks, "nowhere");
    let thrown = "";
    let code = "";
    try {
      const id = identify(p) as { kind: string; code?: string };
      code = id.code ?? "";
    } catch (e) {
      thrown = (e as NodeJS.ErrnoException).code ?? (e as Error).message;
    }
    expect(thrown, "identify contains the lstat failure").toBe("");
    expect(code, "the record carries the error code").toBe("EACCES");
  });

  it.skipIf(isWin)("R77-LISTTREE: an unreadable tree is unlisted, not thrown (listTree readdir :171 via repositoryLinksAtBase :201)", () => {
    const hooks = join(repo.root, ".git/hooks");
    chmodSync(hooks, 0o000);
    let thrown = "";
    try {
      repositoryLinksAtBase(repo.root, resolveGitDirs(repo.root));
    } catch (e) {
      thrown = (e as NodeJS.ErrnoException).code ?? (e as Error).message;
    }
    expect(thrown, "listTree contains readdir").toBe("");
  });

  it.skipIf(isWin)("R77-BEGIN-TREE: begin contains listTree (currentFiles :592, begin :620)", () => {
    const hooks = join(repo.root, ".git/hooks");
    chmodSync(hooks, 0o000);
    const watch = new ConfigWatch(resolveGitDirs(repo.root), repo.root);
    let thrown = "";
    try {
      watch.begin("developer");
    } catch (e) {
      thrown = (e as NodeJS.ErrnoException).code ?? (e as Error).message;
    }
    expect(thrown, "begin contains the unreadable tree").toBe("");
  });

  it.skipIf(isWin)("R77-CLOSE-TREE: closeAndRestore lists after the role and still restores (currentFiles :727)", () => {
    const cfg = join(repo.root, ".git/config");
    const hooks = join(repo.root, ".git/hooks");
    const watch = new ConfigWatch(resolveGitDirs(repo.root), repo.root);
    watch.captureBase();
    watch.begin("developer");
    const before = readFileSync(cfg);
    writeFileSync(cfg, Buffer.concat([before, Buffer.from("\n[core]\n\tfsmonitor = /tmp/r77-mon\n")]));
    chmodSync(hooks, 0o000);
    let thrown = "";
    try {
      watch.closeAndRestore();
    } catch (e) {
      thrown = (e as Error).message;
    } finally {
      chmodSync(hooks, 0o755);
    }
    expect(thrown, "closeAndRestore does not throw out of the window").toBe("");
    expect(readFileSync(cfg).includes("fsmonitor"), "the planted line is restored").toBe(false);
  });

  it.skipIf(isWin)("R77-OBSERVE-BEGIN: begin's observe contains lstat (observe identify :931, begin :1092)", () => {
    const h = join(tmp.dir, "home");
    mkdirSync(h);
    const cfg = join(h, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = r77\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "r77" }]);
    watch.captureBase();
    chmodSync(h, 0o000);
    let thrown = "";
    try {
      watch.begin("developer");
    } catch (e) {
      thrown = (e as NodeJS.ErrnoException).code ?? (e as Error).message;
    } finally {
      chmodSync(h, 0o755);
    }
    expect(thrown, "begin contains observe's lstat").toBe("");
  });

  it.skipIf(isWin)("R77-OBSERVE-COMPARE: compare contains lstat and records the code (observe :931, compare :1127)", () => {
    const h = join(tmp.dir, "home2");
    mkdirSync(h);
    const cfg = join(h, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = r77\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "r77" }]);
    watch.captureBase();
    watch.begin("developer");
    chmodSync(h, 0o000);
    let thrown = "";
    let after = "";
    try {
      const rows = watch.compare();
      after = rows.find((r) => r.path === cfg)?.after ?? "";
    } catch (e) {
      thrown = (e as NodeJS.ErrnoException).code ?? (e as Error).message;
    } finally {
      chmodSync(h, 0o755);
    }
    expect(thrown, "compare contains observe's lstat").toBe("");
    expect(after, "the finding names EACCES").toContain("EACCES");
  });

  it.skipIf(isWin)("R77-READ-GUARDED: a mode-000 file is recorded, not thrown (readFileSync :438 is already inside readState's try)", () => {
    const cfg = join(repo.root, ".git/config");
    chmodSync(cfg, 0o000);
    const watch = new ConfigWatch(resolveGitDirs(repo.root), repo.root);
    let thrown = "";
    try {
      watch.begin("developer");
    } catch (e) {
      thrown = (e as Error).message;
    }
    expect(thrown, "readFileSync EACCES is already contained").toBe("");
  });

  it.skipIf(isWin)("R77-READ-OTHER-CODE: .git/config replaced by a directory is recorded, not thrown (readState :438 rethrows EISDIR)", () => {
    const cfg = join(repo.root, ".git/config");
    unlinkSync(cfg);
    mkdirSync(cfg);
    const watch = new ConfigWatch(resolveGitDirs(repo.root), repo.root);
    let thrown = "";
    try {
      watch.begin("developer");
    } catch (e) {
      thrown = (e as NodeJS.ErrnoException).code ?? (e as Error).message;
    }
    expect(thrown, "any read code, including EISDIR, stays inside the window").toBe("");
  });
});
