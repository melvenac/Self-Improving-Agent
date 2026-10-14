import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const repoRoot = join(import.meta.dirname, "..", "..");

describe("T-289 the heavy suite's outputs are ignored by git", () => {
  it.each(["open-brain/suite-run-meta.json", "open-brain/suite-vitest.json"])("%s is ignored", (rel) => {
    const r = spawnSync("git", ["check-ignore", "-q", "--no-index", rel], { cwd: repoRoot });
    expect(r.status).toBe(0);
  });

  it("a source file beside them is not", () => {
    const r = spawnSync("git", ["check-ignore", "-q", "--no-index", "open-brain/package.json"], { cwd: repoRoot });
    expect(r.status).toBe(1);
  });
});
