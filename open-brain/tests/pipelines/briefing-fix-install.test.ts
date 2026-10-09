/**
 * BRIEFING-FIX BF-P rows: installCommands P1/P2 (#498).
 */
import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { installCommands, defaultTemplateDir } from "../../src/pipelines/bootstrap/index.js";
import { cleanupTmps, importCommit, preStateProject, TODAY } from "./import-cmds-harness.js";

function git(cwd: string, ...args: string[]): void {
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

describe("BF-P: installCommands permissions and rollback", () => {
  afterEach(() => cleanupTmps());

  it("BF-P1a: preflight refusal wins over dirty-tree commit message", () => {
    const dir = preStateProject();
    importCommit(dir, { commitRecord: true });
    writeFileSync(join(dir, "dirty-outside.txt"), "x\n");
    git(dir, "add", "dirty-outside.txt");
    let message = "";
    try {
      installCommands(dir, TODAY, defaultTemplateDir(), {
        preflightWrite: () => {
          throw new Error("`.claude/commands/` is not writable — fix permissions and try again. Nothing written");
        },
      });
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    expect(message).toMatch(/not writable/);
    expect(message).not.toMatch(/commit or stash/);
  });

  it("BF-P1b: unreadable dirty path names permissions, not stash", () => {
    const dir = preStateProject();
    importCommit(dir, { commitRecord: true });
    const blocked = "blocked-secret.txt";
    writeFileSync(join(dir, blocked), "secret\n");
    git(dir, "add", blocked);
    expect(() =>
      installCommands(dir, TODAY, defaultTemplateDir(), {
        readable: () => false,
      }),
    ).toThrow(
      new RegExp(`\`${blocked}\` is not readable \\(permissions\\), so git reports it as changed — fix permissions and try again\\. Nothing written`),
    );
  });

  it("BF-P2: created absent copy is removed when a later rename fails", () => {
    const dir = preStateProject();
    importCommit(dir, { commitRecord: true });
    const cmds = join(dir, ".claude", "commands");
    const startDest = join(cmds, "start.md");
    rmSync(startDest);
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "remove start for P2");
    let renames = 0;
    expect(() =>
      installCommands(dir, TODAY, defaultTemplateDir(), {
        rename: (from, to) => {
          renameSync(from, to);
          renames += 1;
          if (renames >= 1) throw new Error("simulated failure after first OLD rename");
        },
      }),
    ).toThrow(/simulated failure/);
    expect(existsSync(startDest)).toBe(false);
  });
});
