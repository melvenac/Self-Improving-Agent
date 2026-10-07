import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cli, cleanupTmps, preStateProject, importCommit, commandArchiveDirs } from "./import-cmds-harness.js";

describe("I5: dirty tree", () => {
  afterEach(() => cleanupTmps());

  it("refuses install-commands and writes nothing", () => {
    const dir = preStateProject();
    importCommit(dir);
    const startBefore = readFileSync(join(dir, ".claude", "commands", "start.md"), "utf8");
    writeFileSync(join(dir, "dirty-marker.txt"), "x\n");
    const r = cli(["bootstrap", "install-commands", dir], dir);
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/refused/);
    expect(r.out).toMatch(/uncommitted change/);
    expect(readFileSync(join(dir, ".claude", "commands", "start.md"), "utf8")).toBe(startBefore);
    expect(commandArchiveDirs(dir)).toEqual([]);
  });
});
