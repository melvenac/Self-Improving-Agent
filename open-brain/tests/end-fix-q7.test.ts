/** Q7 — loop seat: loop/* commits + docs/loops handoff → ok (T179-2 / T-212) */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkSessionHandoff } from "../src/shared/handoff-guard.js";
import { commitAt, DURING, git, initOldLayoutRepo, ME, START } from "./end-fix.harness.js";

describe("end-fix Q7", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "endfix-q7-"));
    initOldLayoutRepo(dir);
    git(dir, "checkout", "-q", "-b", "loop/end-fix");
    commitAt(dir, DURING, "src/a.ts", "loop work");
    commitAt(dir, DURING, "docs/loops/end-fix-developer-handoff.md", "handoff");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("handoff check is ok when loop handoff is committed", () => {
    const c = checkSessionHandoff(dir, START, [ME]);
    expect(c.status).toBe("ok");
    expect(c.handoffs).toEqual(["docs/loops/end-fix-developer-handoff.md"]);
  });
});
