import { describe, it, expect, afterEach } from "vitest";
import { cli, cleanupTmps, preStateProject } from "./import-cmds-harness.js";

describe("I1: pre-state with old start/end", () => {
  afterEach(() => cleanupTmps());

  it("check lists OLD/absent commands and Next names install-commands after import", () => {
    const dir = preStateProject();
    const c = cli(["bootstrap", "check", dir], dir);
    expect(c.status).toBe(0);
    expect(c.out).toMatch(/start\.md OLD/);
    expect(c.out).toMatch(/end\.md OLD/);
    expect(c.out).toMatch(/task\.md absent/);
    expect(c.out).toMatch(/sync\.md absent/);
    expect(c.out).toMatch(/PRE-STATE/);
    expect(c.out).toMatch(/install-commands/);
    expect(c.out).toMatch(/state import --commit/);
  });
});
