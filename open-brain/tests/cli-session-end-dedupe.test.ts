import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { spawnAsync } from "./spawn-async.js";

describe("cli-session-end T-235 P2-7 cursor dedupe", { timeout: 30_000 }, () => {
  const script = resolve(__dirname, "../src/cli-session-end.ts");
  const TSX_CLI = createRequire(import.meta.url).resolve("tsx/cli");
  let home: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "ob-end-p27-home-"));
    mkdirSync(join(home, ".claude", "open-brain"), { recursive: true });
  });

  afterEach(() => {
    rmSync(home, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  async function runEnd(sessionId: string): Promise<string> {
    const payload = { session_id: sessionId, cursor_version: "1.0" };
    const r = await spawnAsync(process.execPath, [TSX_CLI, script], {
      input: JSON.stringify(payload),
      env: { ...process.env, HOME: home, USERPROFILE: home },
    });
    return r.stdout ?? "";
  }

  it("second cursor SessionEnd with the same session_id is skipped before the pipeline", async () => {
    const id = "end-dup-cursor-1";
    const first = await runEnd(id);
    const second = await runEnd(id);
    expect(first).not.toMatch(/SESSION_END_SKIPPED/);
    expect(second).toMatch(/SESSION_END_SKIPPED/);
  });
});
