import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { handleStart } from "../../src/server.js";
import { OLD_START_COMMAND_WARNING } from "../../src/pipelines/bootstrap/index.js";
import {
  cli,
  cleanupTmps,
  preStateProject,
  importCommit,
  templateBytes,
} from "./import-cmds-harness.js";
import { SESSION_COMMAND_NAMES } from "../../src/pipelines/bootstrap/index.js";

describe("I8: Windows CRLF and path with a space", () => {
  afterEach(() => cleanupTmps());

  it("I1/I3/I7 behaviors pass with CRLF old files under a spaced path", async () => {
    const dir = preStateProject({ crlf: true, spacedPath: true });
    const check = cli(["bootstrap", "check", dir], dir);
    expect(check.out).toMatch(/start\.md OLD/);
    expect(check.out).toMatch(/install-commands/);
    importCommit(dir);
    expect(cli(["bootstrap", "install-commands", dir], dir).status).toBe(0);
    for (const n of SESSION_COMMAND_NAMES) {
      const rel = `.claude/commands/${n}.md`;
      expect(readFileSync(join(dir, rel), "utf8").replace(/\r\n/g, "\n")).toBe(templateBytes(rel).replace(/\r\n/g, "\n"));
    }
    const briefing = (await handleStart({ project_root: dir })).content.map((c) => c.text).join("\n");
    expect(briefing).not.toContain(OLD_START_COMMAND_WARNING);
  });
});
