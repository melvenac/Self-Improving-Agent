import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { checkCommandToolNames } from "../src/pipelines/sync/checks.js";

/**
 * T-295 S1 (Aaron, 2026-10-26: "Cut 14 to 10"): the MCP server stops registering `ob_score` (a duplicate of `ob_sync`
 * with `score: true`; the trend is `cli.js sync --history`) and `ob_feedback` (`ob_end`'s `entry_ratings` records the same
 * per-entry ratings). The handlers stay exported for their direct callers. The command files in the repo name neither,
 * so /sync's command-tool-names check stays clean. S2 moves `ob_stats` and `ob_list` to the CLI.
 */
const OB = resolve(import.meta.dirname, "..");
const REPO = resolve(OB, "..");
// T-295 S2 moved ob_list and ob_stats to the CLI (`open-brain list`, `open-brain stats`).
const AFTER_S1 = [
  "ob_end", "ob_forget", "ob_recall", "ob_recalled", "ob_set_session", "ob_start", "ob_state",
  "ob_store", "ob_store_chunk", "ob_sync",
];

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

describe("T-295 S1: ob_score and ob_feedback are not MCP tools", () => {
  it("R1 the server's tools/list is exactly the ten", async () => {
    const transport = new StdioClientTransport({
      command: join(OB, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx"),
      args: [join(OB, "src", "server.ts")],
      cwd: OB,
      env: { ...(process.env as Record<string, string>) },
      stderr: "ignore",
    });
    const client = new Client({ name: "t295-probe", version: "0.0.0" });
    await client.connect(transport);
    try {
      const names = (await client.listTools()).tools.map((t) => t.name).sort();
      expect(names).toEqual(AFTER_S1);
    } finally {
      await client.close();
    }
  }, 120_000);

  it("R2 no command file in the repo names a tool the server does not register", () => {
    const home = mkdtempSync(join(tmpdir(), "t295-home-"));
    made.push(home);
    const r = checkCommandToolNames(REPO, home);
    expect(r.severity).not.toBe("issue");
    expect(r.message).not.toMatch(/ob_score|ob_feedback/);
  });
});
