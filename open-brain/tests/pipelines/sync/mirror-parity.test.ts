import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkMirrorParity, MIRROR_EXCEPTIONS } from "../../../src/pipelines/sync/checks.js";

describe("checkMirrorParity", () => {
  let root: string;
  let home: string;

  const repoCmds = () => join(root, ".claude", "commands");
  const tmplCmds = () => join(root, "project-template", ".claude", "commands");

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ob-mirror-root-"));
    // Isolated fake home so the check never reads the developer's real ~/.claude.
    home = mkdtempSync(join(tmpdir(), "ob-mirror-home-"));
    mkdirSync(repoCmds(), { recursive: true });
    mkdirSync(tmplCmds(), { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    rmSync(home, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  function write(dir: string, file: string, body: string) {
    writeFileSync(join(dir, file), body, "utf-8");
  }

  it("passes when repo and template copies are byte-identical", () => {
    write(repoCmds(), "start.md", "# /start\nsame\n");
    write(tmplCmds(), "start.md", "# /start\nsame\n");

    const result = checkMirrorParity(root, home);
    expect(result.severity).toBe("pass");
    expect(result.message).toContain("1 file comparison");
  });

  it("flags a file whose contents drifted", () => {
    write(repoCmds(), "sync.md", "# /sync\nrepo version\n");
    write(tmplCmds(), "sync.md", "# /sync\ntemplate version\n");

    const result = checkMirrorParity(root, home);
    expect(result.severity).toBe("issue");
    expect(result.message).toContain("sync.md differs");
  });

  it("flags a file present in the repo but missing from the template", () => {
    write(repoCmds(), "end.md", "# /end\n");

    const result = checkMirrorParity(root, home);
    expect(result.severity).toBe("issue");
    expect(result.message).toContain("end.md missing");
  });

  it("ignores documented exceptions in both directions", () => {
    // repo-root only, and template only — both allowed by MIRROR_EXCEPTIONS
    write(repoCmds(), "harness-audit.md", "# /harness-audit\n");
    write(tmplCmds(), "bootstrap.md", "# /bootstrap\n");

    const result = checkMirrorParity(root, home);
    expect(result.severity).toBe("pass");
  });

  it("does not fail when the live user directories are absent", () => {
    // `home` is an empty temp dir — no ~/.claude/commands, no ~/.cursor/commands.
    write(repoCmds(), "start.md", "x\n");
    write(tmplCmds(), "start.md", "x\n");

    expect(checkMirrorParity(root, home).severity).toBe("pass");
  });

  it("compares live user commands against the template when they exist", () => {
    write(repoCmds(), "start.md", "x\n");
    write(tmplCmds(), "start.md", "x\n");

    const liveClaude = join(home, ".claude", "commands");
    mkdirSync(liveClaude, { recursive: true });
    write(liveClaude, "start.md", "DRIFTED\n");

    const result = checkMirrorParity(root, home);
    expect(result.severity).toBe("issue");
    expect(result.message).toContain("live↔template");
  });

  it("documents a reason for every exception", () => {
    for (const [file, reason] of Object.entries(MIRROR_EXCEPTIONS)) {
      expect(file.endsWith(".md")).toBe(true);
      expect(reason.length).toBeGreaterThan(10);
    }
  });
});
