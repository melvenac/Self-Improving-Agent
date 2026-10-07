import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cli, cleanupTmps, preStateProject, commandArchiveDirs } from "./import-cmds-harness.js";

describe("I2: install-commands before import", () => {
  afterEach(() => cleanupTmps());

  it("refuses without a record and writes nothing", () => {
    const dir = preStateProject();
    const before = readFileSync(join(dir, ".claude", "commands", "start.md"), "utf8");
    const r = cli(["bootstrap", "install-commands", dir], dir);
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/refused/);
    expect(r.out).toMatch(/state import --commit|not a bootstrapped record|no state\.json/i);
    expect(readFileSync(join(dir, ".claude", "commands", "start.md"), "utf8")).toBe(before);
    expect(commandArchiveDirs(dir)).toEqual([]);
  });
});
