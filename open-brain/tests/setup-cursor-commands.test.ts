/**
 * T-235 P2-6: setup.mjs copies the tracked Cursor command set; /sync's mirror-parity
 * asserts the template carries exactly CURSOR_COMMAND_SET.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
// @ts-expect-error — plain .mjs outside the TypeScript project
import { copyCursorSlashCommands } from "../../scripts/setup-hooks.mjs";
import { CURSOR_COMMAND_SET, checkMirrorParity } from "../src/pipelines/sync/checks.js";

describe("Cursor slash commands (T-235 P2-6)", () => {
  let repoRoot: string;
  let cursorHome: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "t235-repo-"));
    cursorHome = mkdtempSync(join(tmpdir(), "t235-cursor-"));
    const tmpl = join(repoRoot, "project-template", ".cursor", "commands");
    mkdirSync(tmpl, { recursive: true });
    for (const f of CURSOR_COMMAND_SET) {
      writeFileSync(join(tmpl, f), `# ${f}\nbody ${f}\n`, "utf-8");
    }
    mkdirSync(join(repoRoot, ".claude", "commands"), { recursive: true });
    mkdirSync(join(repoRoot, "project-template", ".claude", "commands"), { recursive: true });
    writeFileSync(join(repoRoot, ".claude", "commands", "start.md"), "# s\n", "utf-8");
    writeFileSync(join(repoRoot, "project-template", ".claude", "commands", "start.md"), "# s\n", "utf-8");
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    rmSync(cursorHome, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("copyCursorSlashCommands installs every command on first run", () => {
    const r = copyCursorSlashCommands(repoRoot, cursorHome);
    expect(r.missingTemplate).toBe(false);
    expect(r.copied).toBe(CURSOR_COMMAND_SET.length);
    for (const f of CURSOR_COMMAND_SET) {
      const dest = join(cursorHome, "commands", f);
      expect(existsSync(dest)).toBe(true);
      expect(readFileSync(dest, "utf-8")).toContain(f);
    }
  });

  it("copyCursorSlashCommands is idempotent — a second run copies nothing", () => {
    copyCursorSlashCommands(repoRoot, cursorHome);
    const r2 = copyCursorSlashCommands(repoRoot, cursorHome);
    expect(r2.copied).toBe(0);
  });

  it("checkMirrorParity passes when the template carries exactly CURSOR_COMMAND_SET", () => {
    const home = mkdtempSync(join(tmpdir(), "t235-mirror-home-"));
    try {
      const r = checkMirrorParity(repoRoot, home);
      expect(r.severity, r.message).toBe("pass");
      expect(r.message).toContain("template (.cursor)");
    } finally {
      rmSync(home, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  });

  it("mutant: dropping a command from the template fails mirror-parity", () => {
    rmSync(join(repoRoot, "project-template", ".cursor", "commands", "task.md"));
    const home = mkdtempSync(join(tmpdir(), "t235-mirror-mut-"));
    try {
      const r = checkMirrorParity(repoRoot, home);
      expect(r.severity).toBe("issue");
      expect(r.message).toContain("task.md missing");
    } finally {
      rmSync(home, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  });
});
