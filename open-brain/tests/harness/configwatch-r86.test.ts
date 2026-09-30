/**
 * R86. An ancestor link's type-change text carries that link's lstat facts,
 * labelled as a link at the path. A directory symlink is Linux; this row
 * skips on win32. tcm is the read.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { lstatSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { symlinkSyncOrSkip } from "./symlink-or-skip.js";
import { join } from "node:path";
import { MachineConfigWatch } from "../../src/harness/configwatch.js";
import { requireGit } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const isWin = process.platform === "win32";

describe("R86 ancestor type change carries the link facts", () => {
  let tmp: { dir: string; cleanup: () => Promise<void> };
  beforeAll(() => requireGit());
  beforeEach(() => { tmp = scratch("r86-"); });
  afterEach(async () => { await tmp.cleanup(); });

  it.skipIf(isWin)("R86-ANCESTOR-LINK-FACTS: the type-change text names the link's lstat, labelled as a link", () => {
    const xdg = join(tmp.dir, "r86-xdg");
    mkdirSync(join(xdg, "git"), { recursive: true });
    const cfg = join(xdg, "git", "config");
    writeFileSync(cfg, "[user]\n\tname = r86\n");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "r86" }]);
    watch.captureBase();
    watch.begin("developer");
    const other = join(tmp.dir, "r86-other");
    mkdirSync(other);
    writeFileSync(join(other, "config"), "[user]\n\tname = r86-other\n");
    renameSync(join(xdg, "git"), join(xdg, "git-old"));
    const link = join(xdg, "git");
    symlinkSyncOrSkip(other, link, "dir");
    const linkIno = String(lstatSync(link, { bigint: true }).ino);
    const row = watch.compare().find((f) => f.path === cfg);
    expect(row, "the ancestor replacement is recorded against the config path").toBeTruthy();
    expect(row!.after, "the type-change text labels the ancestor as a link").toContain("link: type symlink");
    expect(row!.after, "the type-change text carries the link's lstat ino").toContain(`ino ${linkIno}`);
  });
});
