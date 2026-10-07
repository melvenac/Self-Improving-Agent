/**
 * I9: named invariants for red-first mutants (install record gate, OLD vs SIA, C4 warning).
 */
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { handleStart } from "../../src/server.js";
import {
  classifySessionCommand,
  OLD_START_COMMAND_WARNING,
} from "../../src/pipelines/bootstrap/index.js";
import { cli, cleanupTmps, preStateProject, importCommit, templateDir } from "./import-cmds-harness.js";

describe("I9: mutant targets", () => {
  afterEach(() => cleanupTmps());

  it("M1: install-commands refuses on pre-state (no record)", () => {
    const dir = preStateProject();
    const r = cli(["bootstrap", "install-commands", dir], dir);
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/refused/);
  });

  it("M2: a deliberately different start.md is OLD, not SIA", () => {
    const dir = preStateProject();
    expect(classifySessionCommand(dir, "start", templateDir)).toBe("OLD");
    const tmpl = readFileSync(join(templateDir, ".claude/commands/start.md"), "utf8");
    expect(readFileSync(join(dir, ".claude/commands/start.md"), "utf8")).not.toBe(tmpl);
  });

  it("M3: ob_start briefing includes the C4 OLD /start line when start is OLD", async () => {
    const dir = preStateProject();
    importCommit(dir);
    const text = (await handleStart({ project_root: dir })).content.map((c) => c.text).join("\n");
    expect(text).toContain(OLD_START_COMMAND_WARNING);
  });
});
