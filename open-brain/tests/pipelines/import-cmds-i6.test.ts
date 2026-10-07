import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cli, cleanupTmps, preStateProject, importCommit, commitWorkingTree } from "./import-cmds-harness.js";

describe("I6: other .claude files untouched", () => {
  afterEach(() => cleanupTmps());

  it("leaves other.md and settings.local.json unchanged", () => {
    const dir = preStateProject();
    importCommit(dir);
    const cmds = join(dir, ".claude", "commands");
    writeFileSync(join(cmds, "other.md"), "# other\n");
    writeFileSync(join(dir, ".claude", "settings.local.json"), '{"x":1}\n');
    const otherBefore = readFileSync(join(cmds, "other.md"), "utf8");
    const settingsBefore = readFileSync(join(dir, ".claude", "settings.local.json"), "utf8");
    commitWorkingTree(dir, "extra claude files");
    expect(cli(["bootstrap", "install-commands", dir], dir).status).toBe(0);
    expect(readFileSync(join(cmds, "other.md"), "utf8")).toBe(otherBefore);
    expect(readFileSync(join(dir, ".claude", "settings.local.json"), "utf8")).toBe(settingsBefore);
  });
});
