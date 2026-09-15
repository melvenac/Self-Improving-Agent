import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkCommandParity } from "../../../src/pipelines/sync/checks.js";

/**
 * Loop 8 R4. The two assertions the brief made acceptance conditions are the
 * divergence case and the CRLF case — the second because the user-scope copy of
 * sync.md is CRLF against an LF repo copy with identical content, and a check
 * that called that drift would fail on Windows for no reason.
 */
describe("checkCommandParity", () => {
  let root: string;
  let home: string;

  const repoDir = () => join(root, ".claude", "commands");
  const templateDir = () => join(root, "project-template", ".claude", "commands");
  const userDir = () => join(home, ".claude", "commands");

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "cmd-parity-root-"));
    home = mkdtempSync(join(tmpdir(), "cmd-parity-home-"));
    mkdirSync(repoDir(), { recursive: true });
    mkdirSync(templateDir(), { recursive: true });
    writeFileSync(join(repoDir(), "start.md"), "# /start\n\nline one\n");
    writeFileSync(join(templateDir(), "start.md"), "# /start\n\nline one\n");
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  });

  it("passes when the repo and template copies agree", () => {
    const r = checkCommandParity(root, home);
    expect(r.severity).toBe("pass");
  });

  it("goes red when a repo copy and its template counterpart diverge in content", () => {
    writeFileSync(join(templateDir(), "start.md"), "# /start\n\nline one CHANGED\n");
    const r = checkCommandParity(root, home);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("start.md differs");
  });

  it("does NOT trip on CRLF-vs-LF alone", () => {
    writeFileSync(join(templateDir(), "start.md"), "# /start\r\n\r\nline one\r\n");
    const r = checkCommandParity(root, home);
    expect(r.severity).toBe("pass");
  });

  it("flags a command present only in the template", () => {
    writeFileSync(join(templateDir(), "orphan.md"), "# /orphan\n");
    const r = checkCommandParity(root, home);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("orphan.md is in the template");
  });

  it("allows bootstrap.md as template-only — it has never existed in repo scope", () => {
    writeFileSync(join(templateDir(), "bootstrap.md"), "# /bootstrap\n");
    const r = checkCommandParity(root, home);
    expect(r.severity).toBe("pass");
  });

  it("allows a command present only in the repo", () => {
    writeFileSync(join(repoDir(), "harness-audit.md"), "# /harness-audit\n");
    const r = checkCommandParity(root, home);
    expect(r.severity).toBe("pass");
  });

  it("skips user scope entirely when ~/.claude/commands is absent", () => {
    const r = checkCommandParity(root, home);
    expect(r.severity).toBe("pass");
    expect(r.message).toContain("user scope absent");
  });

  it("warns — never fails — when a user-scope copy drifts", () => {
    mkdirSync(userDir(), { recursive: true });
    writeFileSync(join(userDir(), "start.md"), "# /start\n\nSOMETHING ELSE\n");
    const r = checkCommandParity(root, home);
    expect(r.severity).toBe("warn");
    expect(r.message).toContain("start.md");
  });

  it("ignores user-only commands", () => {
    mkdirSync(userDir(), { recursive: true });
    writeFileSync(join(userDir(), "start.md"), "# /start\n\nline one\n");
    writeFileSync(join(userDir(), "personal.md"), "# /personal\n");
    const r = checkCommandParity(root, home);
    expect(r.severity).toBe("pass");
  });
});
