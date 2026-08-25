import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkMirrorParity, MIRROR_EXCEPTIONS, CURSOR_COMMAND_SET } from "../../../src/pipelines/sync/checks.js";
import { saveIdentity } from "../../../src/shared/identity.js";

describe("checkMirrorParity", () => {
  let root: string;
  let home: string;

  const repoCmds = () => join(root, ".claude", "commands");
  const tmplCmds = () => join(root, "project-template", ".claude", "commands");
  const cursorCmds = () => join(root, "project-template", ".cursor", "commands");

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ob-mirror-root-"));
    // Isolated fake home so the check never reads the developer's real ~/.claude.
    home = mkdtempSync(join(tmpdir(), "ob-mirror-home-"));
    mkdirSync(repoCmds(), { recursive: true });
    mkdirSync(tmplCmds(), { recursive: true });
    // .cursor is NOT created here: the Cursor set is only asserted when the
    // template actually ships a .cursor dir, so consumers without one are fine.
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    rmSync(home, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  function write(dir: string, file: string, body: string) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, file), body, "utf-8");
  }

  it("passes when repo and template copies are byte-identical", () => {
    write(repoCmds(), "start.md", "# /start\nsame\n");
    write(tmplCmds(), "start.md", "# /start\nsame\n");

    const result = checkMirrorParity(root, home);
    expect(result.severity).toBe("pass");
    expect(result.message).toContain("1 file comparison");
  });

  it("flags a Cursor command dropped from the template", () => {
    // Pairwise comparison cannot catch this: if the file is absent from both
    // the template and the live dir, there is nothing to compare.
    write(cursorCmds(), "start.md", "# /start\n");
    write(cursorCmds(), "end.md", "# /end\n");
    write(cursorCmds(), "sync.md", "# /sync\n");
    // checkpoint.md deliberately omitted

    const result = checkMirrorParity(root, home);
    expect(result.severity).toBe("issue");
    expect(result.message).toContain("checkpoint.md missing");
  });

  it("flags an unexpected Cursor command so the set stays deliberate", () => {
    for (const f of CURSOR_COMMAND_SET) write(cursorCmds(), f, `# ${f}\n`);
    write(cursorCmds(), "skill-scan.md", "# /skill-scan\n");

    const result = checkMirrorParity(root, home);
    expect(result.severity).toBe("issue");
    expect(result.message).toContain("skill-scan.md unexpected");
  });

  it("passes when the template carries exactly the declared Cursor set", () => {
    for (const f of CURSOR_COMMAND_SET) write(cursorCmds(), f, `# ${f}\n`);
    expect(checkMirrorParity(root, home).severity).toBe("pass");
  });

  it("tolerates CRLF vs LF — a copy made on Windows is not drift", () => {
    write(repoCmds(), "sync.md", "# /sync\nsame content\n");
    write(tmplCmds(), "sync.md", "# /sync\r\nsame content\r\n");

    const result = checkMirrorParity(root, home);
    expect(result.severity).toBe("pass");
  });

  it("tolerates a differing trailing newline", () => {
    write(repoCmds(), "sync.md", "# /sync\nsame content\n\n");
    write(tmplCmds(), "sync.md", "# /sync\nsame content");

    expect(checkMirrorParity(root, home).severity).toBe("pass");
  });

  it("still flags a real difference that is not whitespace", () => {
    write(repoCmds(), "sync.md", "# /sync\r\nrepo version\r\n");
    write(tmplCmds(), "sync.md", "# /sync\ntemplate version\n");

    expect(checkMirrorParity(root, home).severity).toBe("issue");
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

  describe("identity rendering", () => {
    const liveCmds = () => join(home, ".claude", "commands");
    const template = "Greet {{USER_NAME}} by name. You are {{AGENT_NAME}}.\n";
    let savedEnv: string | undefined;

    beforeEach(() => {
      // Point the identity file into the fake home for these cases only.
      savedEnv = process.env.OPEN_BRAIN_IDENTITY;
      delete process.env.OPEN_BRAIN_IDENTITY;
      write(repoCmds(), "start.md", template);
      write(tmplCmds(), "start.md", template);
    });

    afterEach(() => {
      if (savedEnv !== undefined) process.env.OPEN_BRAIN_IDENTITY = savedEnv;
    });

    it("passes when the live copy is the template rendered with the stored identity", () => {
      saveIdentity({ user_name: "Jack", agent_name: "Clark" }, home);
      write(liveCmds(), "start.md", "Greet Jack by name. You are Clark.\n");
      const result = checkMirrorParity(root, home);
      expect(result.severity).toBe("pass");
      expect(result.message).toContain("2 file comparison");
    });

    it("flags a live copy rendered with a different identity than the one stored", () => {
      saveIdentity({ user_name: "Jack", agent_name: "Clark" }, home);
      write(liveCmds(), "start.md", "Greet Aaron by name. You are Clark.\n");
      const result = checkMirrorParity(root, home);
      expect(result.severity).toBe("issue");
      expect(result.message).toContain("start.md differs");
    });

    it("names an unrendered placeholder in a live copy — installed without onboarding", () => {
      saveIdentity({ user_name: "Jack", agent_name: "Clark" }, home);
      write(liveCmds(), "start.md", template);
      const result = checkMirrorParity(root, home);
      expect(result.severity).toBe("issue");
      expect(result.message).toContain("unrendered {{USER_NAME}}, {{AGENT_NAME}}");
      expect(result.message).toContain("setup.mjs");
    });

    it("compares raw when no identity is stored, so a placeholder-for-placeholder copy passes only if flagged", () => {
      // No identity file: the template cannot be rendered, and a live copy that
      // still carries placeholders is the unrendered case above, not a pass.
      write(liveCmds(), "start.md", template);
      const result = checkMirrorParity(root, home);
      expect(result.severity).toBe("issue");
      expect(result.message).toContain("unrendered");
    });

    it("never renders the repo↔template pair — both sides are source", () => {
      saveIdentity({ user_name: "Jack", agent_name: "Clark" }, home);
      write(repoCmds(), "start.md", "Greet Jack by name. You are Clark.\n");
      const result = checkMirrorParity(root, home);
      expect(result.severity).toBe("issue");
      expect(result.message).toContain("repo↔template (.claude): start.md differs");
    });
  });
});
