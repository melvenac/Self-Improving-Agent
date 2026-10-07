import { describe, it, expect, afterEach } from "vitest";
import { handleStart } from "../../src/server.js";
import { OLD_START_COMMAND_WARNING } from "../../src/pipelines/bootstrap/index.js";
import { cli, cleanupTmps, preStateProject, importCommit, commitWorkingTree } from "./import-cmds-harness.js";

describe("I7: ob_start OLD /start warning", () => {
  afterEach(() => cleanupTmps());

  it("briefing warns before install and omits the line after install", async () => {
    const dir = preStateProject();
    importCommit(dir);
    const before = (await handleStart({ project_root: dir })).content.map((c) => c.text).join("\n");
    expect(before).toContain(OLD_START_COMMAND_WARNING);
    commitWorkingTree(dir, "session log from ob_start");
    expect(cli(["bootstrap", "install-commands", dir], dir).status).toBe(0);
    const after = (await handleStart({ project_root: dir })).content.map((c) => c.text).join("\n");
    expect(after).not.toContain(OLD_START_COMMAND_WARNING);
  });
});
