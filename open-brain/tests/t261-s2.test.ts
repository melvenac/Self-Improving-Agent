import { describe, it, expect } from "vitest";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkModuleBoundary, MEMORY_SIDE } from "../src/pipelines/sync/checks.js";
import { spawnAsync } from "./spawn-async.js";

/**
 * T-261 S2: relocate, scrub-trigger-fires, trigger-keys and topics live in cli-memory.ts (memory side). cli.ts
 * forwards the same four names through one dynamic import, so DYNAMIC_MEMORY_LOADS shrinks from 8 to 4.
 */
const OPEN_BRAIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(OPEN_BRAIN_ROOT, "..");
const TSX_CLI = join(OPEN_BRAIN_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const CLI = join(OPEN_BRAIN_ROOT, "src", "cli.ts");
const SPAWN_TIMEOUT = 120_000;

describe("T-261 S2: the memory subcommands leave the core CLI", () => {
  it("R1: this repository passes the boundary check with exactly 4 allowed dynamic loads", () => {
    const r = checkModuleBoundary(REPO_ROOT);
    expect(r.severity, r.message).toBe("pass");
    expect(r.message).toContain("4 dynamic memory load(s) allowed by DYNAMIC_MEMORY_LOADS");
  });

  it("R2: cli-memory.ts is on the memory side", () => {
    expect(MEMORY_SIDE).toContain("cli-memory.ts");
  });

  it("R3: cli.ts no longer holds the four bodies", () => {
    const src = readFileSync(CLI, "utf8");
    for (const gone of ['"./scrub-trigger-fires.js"', '"./trigger/keys-writer.js"', '"./pipelines/topics/index.js"', '"./relocate.js"']) {
      expect(src, gone).not.toContain(gone);
    }
    expect(src).toContain('import("./cli-memory.js")');
  });

  it("R4 (guard): the old name still runs through the forward, with the same refusal and exit code", async () => {
    const dir = mkdtempSync(join(tmpdir(), "t261-s2-"));
    try {
      const r = await spawnAsync(process.execPath, [TSX_CLI, CLI, "topics", "--aply"], { env: { ...process.env }, cwd: dir });
      expect(r.status).toBe(2);
      expect(r.stderr).toContain("topics refused");
      expect(r.stderr).toContain("Nothing was run");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, SPAWN_TIMEOUT);
});
