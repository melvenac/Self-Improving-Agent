/**
 * QA 290 L2: preflight refusal and rollback on mid-install failure.
 */
import { describe, it, expect, afterEach } from "vitest";
import { chmodSync, existsSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { installCommands, defaultTemplateDir } from "../../src/pipelines/bootstrap/index.js";
import { cli, cleanupTmps, preStateProject, importCommit, commandArchiveDirs, TODAY, templateDir } from "./import-cmds-harness.js";

describe("QA290 L2: install-commands preflight and rollback", () => {
  afterEach(() => cleanupTmps());

  it("preflight write refusal names the fix and writes nothing", () => {
    const dir = preStateProject();
    importCommit(dir, { commitRecord: true });
    const cmds = join(dir, ".claude", "commands");
    const startBefore = readFileSync(join(cmds, "start.md"), "utf8");
    expect(() =>
      installCommands(dir, TODAY, templateDir, {
        preflightWrite: () => {
          throw new Error("`.claude/commands/` is not writable — fix permissions and try again. Nothing written");
        },
      }),
    ).toThrow(/not writable/);
    expect(readFileSync(join(cmds, "start.md"), "utf8")).toBe(startBefore);
    expect(commandArchiveDirs(dir)).toEqual([]);
  });

  it.skipIf(process.platform === "win32")("read-only commands dir via chmod 0555", () => {
    const dir = preStateProject();
    importCommit(dir, { commitRecord: true });
    const cmds = join(dir, ".claude", "commands");
    const startBefore = readFileSync(join(cmds, "start.md"), "utf8");
    chmodSync(cmds, 0o555);
    try {
      const r = cli(["bootstrap", "install-commands", dir], dir);
      expect(r.status).toBe(1);
      expect(r.out).toMatch(/refused/);
      expect(r.out).toMatch(/not writable/i);
      expect(r.out).not.toMatch(/EACCES/);
      expect(readFileSync(join(cmds, "start.md"), "utf8")).toBe(startBefore);
      expect(commandArchiveDirs(dir)).toEqual([]);
      expect(existsSync(join(dir, ".agents", "archive"))).toBe(false);
    } finally {
      chmodSync(cmds, 0o755);
    }
  });

  it("rolls back a rename when a later step fails", () => {
    const dir = preStateProject();
    importCommit(dir, { commitRecord: true });
    const cmds = join(dir, ".claude", "commands");
    const startBefore = readFileSync(join(cmds, "start.md"), "utf8");
    let renames = 0;
    expect(() =>
      installCommands(dir, TODAY, defaultTemplateDir(), {
        rename: (from, to) => {
          renameSync(from, to);
          renames += 1;
          if (renames >= 2) throw new Error("simulated failure after second rename");
        },
      }),
    ).toThrow(/simulated failure/);
    expect(readFileSync(join(cmds, "start.md"), "utf8")).toBe(startBefore);
    expect(commandArchiveDirs(dir)).toEqual([]);
  });
});
