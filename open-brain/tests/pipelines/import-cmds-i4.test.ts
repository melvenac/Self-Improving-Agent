import { describe, it, expect, afterEach } from "vitest";
import { cli, cleanupTmps, preStateProject, importCommit } from "./import-cmds-harness.js";

describe("I4: re-run install-commands", () => {
  afterEach(() => cleanupTmps());

  it("is a no-op with exit 0 when all commands are SIA, even on the dirty import tree", () => {
    const dir = preStateProject();
    importCommit(dir);
    expect(cli(["bootstrap", "install-commands", dir], dir).status).toBe(0);
    const again = cli(["bootstrap", "install-commands", dir], dir);
    expect(again.status).toBe(0);
    expect(again.out).toMatch(/SIA \(unchanged\)/);
  });
});
