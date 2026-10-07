import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { oldStartCommandWarning } from "../../src/pipelines/bootstrap/index.js";

describe("QA290 L5: oldStartCommandWarning without a record", () => {
  const tmps: string[] = [];
  afterEach(() => {
    for (const t of tmps.splice(0)) rmSync(t, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("returns null on a fresh project with no state.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "import-cmds-l5-"));
    tmps.push(dir);
    mkdirSync(join(dir, ".agents", "TASKS"), { recursive: true });
    expect(oldStartCommandWarning(dir)).toBeNull();
  });
});
