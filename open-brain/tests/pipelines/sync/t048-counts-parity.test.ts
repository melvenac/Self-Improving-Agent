import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  checkMirrorParity,
  checkCommandParity,
  checkCommandToolNames,
  checkCommandNames,
  checkModuleBoundary,
  checkRetirements,
} from "../../../src/pipelines/sync/checks.js";

/**
 * T-048 (sync checks, part 2): the exception lists and the dropped imports. Every row names the
 * count it expects; before the change each of these printed a pass that said nothing about what
 * it had left out.
 */
describe("T-048 sync counts: parity checks and the boundary graph", () => {
  let root: string;
  let home: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "t048-par-root-"));
    home = mkdtempSync(join(tmpdir(), "t048-par-home-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    rmSync(home, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  function write(dir: string, file: string, body = "x\n"): void {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, file), body, "utf-8");
  }
  const repoCmds = () => join(root, ".claude", "commands");
  const tmplCmds = () => join(root, "project-template", ".claude", "commands");

  describe("mirror-parity", () => {
    it("states how many files it excepted (by name), how many non-.md it ignored, and which optional pair it skipped", () => {
      write(repoCmds(), "start.md");
      write(tmplCmds(), "start.md");
      write(repoCmds(), "harness-audit.md"); // a documented MIRROR_EXCEPTION (repo-only)
      write(tmplCmds(), "bootstrap.md"); // a documented MIRROR_EXCEPTION (template-only)
      write(repoCmds(), "notes.txt"); // not a command
      const r = checkMirrorParity(root, home); // home has no .claude/commands: the optional live pair is skipped
      expect(r.severity, r.message).toBe("pass");
      expect(r.message).toContain("1 file comparison(s)");
      expect(r.message).toContain("2 excepted [");
      expect(r.message).toContain("harness-audit.md");
      expect(r.message).toContain("bootstrap.md");
      expect(r.message).toContain("1 non-.md file(s) ignored");
      expect(r.message).toMatch(/2 optional pair\(s\) skipped \[live↔template \(\.claude\) \(.*does not exist\)/);
    });

    it("nothing compared and no Cursor set asserted is 'not checked', not a pass", () => {
      write(repoCmds(), "harness-audit.md");
      write(tmplCmds(), "bootstrap.md");
      const r = checkMirrorParity(root, home);
      expect(r.severity).toBe("skip");
      expect(r.message).toContain("not checked: no file was compared");
    });
  });

  describe("command-parity", () => {
    beforeEach(() => {
      write(repoCmds(), "start.md", "# s\n");
      write(tmplCmds(), "start.md", "# s\n");
    });

    it("states the template-only exception, the user-only commands and the non-.md files it did not compare", () => {
      write(tmplCmds(), "bootstrap.md", "# b\n"); // TEMPLATE_ONLY_ALLOWED
      write(tmplCmds(), "README.txt", "not a command\n");
      write(join(home, ".claude", "commands"), "start.md", "# s\n");
      write(join(home, ".claude", "commands"), "mine.md", "# only mine\n");
      write(join(home, ".claude", "commands"), "scratch.txt", "x\n");
      const r = checkCommandParity(root, home);
      expect(r.severity, r.message).toBe("pass");
      expect(r.message).toContain("1 user-only command(s) not compared");
      expect(r.message).toContain("excepted 1 template-only [bootstrap.md]");
      expect(r.message).toContain("2 non-.md file(s) ignored");
    });

    it("the user-scope-absent pass also states what it excepted", () => {
      write(tmplCmds(), "bootstrap.md", "# b\n");
      const r = checkCommandParity(root, home);
      expect(r.severity).toBe("pass");
      expect(r.message).toContain("user scope absent");
      expect(r.message).toContain("excepted 1 template-only [bootstrap.md]");
    });
  });

  describe("command-tool-names and command-names", () => {
    it("name the command directories that were absent, out of how many there are", () => {
      // The tool registry is read from server.ts's registration sites (the tool name alone on its line).
      write(join(root, "open-brain", "src"), "server.ts", 'server.tool(\n  "ob_start",\n  "desc",\n);');
      write(repoCmds(), "start.md", "# /start\nCall ob_start.\n");
      const a = checkCommandToolNames(root, home);
      expect(a.severity, a.message).toBe("pass");
      expect(a.message).toContain("1 of 5 command directories scanned; absent:");
      expect(a.message).toContain("project-template/.claude/commands");
      const b = checkCommandNames(root, home);
      expect(b.severity, b.message).toBe("pass");
      expect(b.message).toContain("1 of 5 command directories scanned; absent:");
    });
  });

  describe("module-boundary", () => {
    it("counts the type-only and package imports it does not treat as edges", () => {
      const src = join(root, "open-brain", "src");
      write(src, "db-v2.ts", 'import Database from "better-sqlite3";\nexport const v = 1;\n');
      write(join(src, "shared"), "paths.ts", "export const p = 1;\nexport type T = number;\n");
      write(src, "cli.ts", 'import { p } from "./shared/paths.js";\nimport type { T } from "./shared/paths.js";\nimport { join } from "node:path";\nimport { z } from "zod";\nexport const x: T = p;\nvoid join; void z;\n');
      const r = checkModuleBoundary(root);
      expect(r.severity, r.message).toBe("pass");
      expect(r.message).toContain("1 type-only and 3 package import(s) are not edges");
    });
  });

  describe("retirements", () => {
    it("states how many (file, retirement) pairs it did not scan because the file is a declared referrer", () => {
      write(join(root, ".agents"), "retirements.json", JSON.stringify({
        historical: [".agents/retirements.json"],
        retirements: [
          { id: "R-1", name: "widgetizer", pattern: "\\bwidgetizer\\b", event: "cut", ruled: "2026-09-15", classes: ["cli-subcommand"], allowed_referrers: [{ path: "README.md", class: "prose", why: "obituary" }] },
        ],
      }));
      write(root, "README.md", "`widgetizer` was cut in Loop 10\n");
      write(root, "other.md", "nothing here\n");
      const r = checkRetirements(root);
      expect(r.severity, r.message).toBe("pass");
      expect(r.message).toContain("with 1 (file, retirement) pair(s) not scanned because the file is a declared referrer");
    });
  });
});
