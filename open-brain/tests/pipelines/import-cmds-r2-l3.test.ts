/**
 * QA 290 L3: CRLF on disk after commit still reads SIA; no C4 line.
 */
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { handleStart } from "../../src/server.js";
import { OLD_START_COMMAND_WARNING, SESSION_COMMAND_NAMES } from "../../src/pipelines/bootstrap/index.js";
import { cli, cleanupTmps, preStateProject, importCommit, commitWorkingTree, templateBytes } from "./import-cmds-harness.js";

describe("QA290 L3: CRLF-normalised SIA detection", () => {
  afterEach(() => cleanupTmps());

  it("committed commands re-checked out as CRLF still read SIA with no OLD /start warning", async () => {
    const dir = preStateProject({ crlf: true });
    importCommit(dir);
    expect(cli(["bootstrap", "install-commands", dir], dir).status).toBe(0);
    commitWorkingTree(dir, "session commands");
    for (const n of SESSION_COMMAND_NAMES) {
      const rel = `.claude/commands/${n}.md`;
      const lf = templateBytes(rel);
      writeFileSync(join(dir, rel), lf.replace(/\n/g, "\r\n"));
    }
    const check = cli(["bootstrap", "check", dir], dir);
    expect(check.out).toMatch(/start\.md SIA/);
    expect(check.out).toMatch(/end\.md SIA/);
    const briefing = (await handleStart({ project_root: dir })).content.map((c) => c.text).join("\n");
    expect(briefing).not.toContain(OLD_START_COMMAND_WARNING);
  });
});
