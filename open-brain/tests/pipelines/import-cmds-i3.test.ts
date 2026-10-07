import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { cli, cleanupTmps, preStateProject, importCommit, templateBytes, commandArchiveDirs } from "./import-cmds-harness.js";
import { SESSION_COMMAND_NAMES } from "../../src/pipelines/bootstrap/index.js";

describe("I3: install after import", () => {
  afterEach(() => cleanupTmps());

  it("installs four commands, archives two OLD files, matches template bytes", () => {
    const dir = preStateProject();
    importCommit(dir);
    const r = cli(["bootstrap", "install-commands", dir], dir);
    expect(r.status).toBe(0);
    for (const n of SESSION_COMMAND_NAMES) {
      const rel = `.claude/commands/${n}.md`;
      expect(readFileSync(join(dir, rel), "utf8").replace(/\r\n/g, "\n")).toBe(templateBytes(rel).replace(/\r\n/g, "\n"));
    }
    const archives = commandArchiveDirs(dir);
    expect(archives).toHaveLength(1);
    const arch = join(dir, ".agents", "archive", archives[0]);
    expect(readFileSync(join(arch, "start.md"), "utf8")).toMatch(/Old \/start/);
    expect(readFileSync(join(arch, "end.md"), "utf8")).toMatch(/Old \/end/);
    expect(existsSync(join(arch, "task.md"))).toBe(false);
  });
});
