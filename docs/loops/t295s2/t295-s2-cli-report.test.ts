import { describe, it, expect, afterAll } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { openV2Database } from "../src/db-v2.js";
import { spawnAsync } from "./spawn-async.js";

/**
 * T-295 S2 (Aaron, 2026-10-26: "Cut 14 to 10"): `ob_list` and `ob_stats` leave the MCP server and become the CLI's
 * `open-brain list [--limit <n>] [--project <dir>]` and `open-brain stats`, printing what the tools printed. Every row
 * runs the real CLI against a temp store named by KNOWLEDGE_V2_DB, never the real one.
 */
const OB = resolve(import.meta.dirname, "..");
const TSX_CLI = join(OB, "node_modules", "tsx", "dist", "cli.mjs");
const CLI = join(OB, "src", "cli.ts");
const SPAWN_TIMEOUT = 120_000;

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

/** A temp dir with a store at `<dir>/k.db`; `entries` live rows, created one second apart, k1 oldest. */
function store(entries: number): { dir: string; db: string } {
  const dir = mkdtempSync(join(tmpdir(), "t295-s2-"));
  made.push(dir);
  const db = join(dir, "k.db");
  if (entries > 0) {
    const h = openV2Database(db);
    const ins = h.prepare("INSERT INTO knowledge_index (vault_path, key, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)");
    for (let i = 1; i <= entries; i++) {
      const ts = `2026-10-26T00:00:0${i}.000Z`;
      ins.run(`t295/k${i}.md`, `t295-k${i}`, `entry ${i}`, ts, ts);
    }
    h.close();
  }
  return { dir, db };
}

const cli = (dir: string, db: string, ...args: string[]) =>
  spawnAsync(process.execPath, [TSX_CLI, CLI, ...args], { env: { ...process.env, KNOWLEDGE_V2_DB: db }, cwd: dir });

describe("T-295 S2: list and stats are CLI commands", () => {
  it("C1 list --limit 2 prints the two newest entries, newest first", async () => {
    const { dir, db } = store(3);
    const r = await cli(dir, db, "list", "--limit", "2");
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("## Stored Knowledge");
    expect(r.stdout).toContain("`t295-k3`");
    expect(r.stdout).toContain("`t295-k2`");
    expect(r.stdout).not.toContain("`t295-k1`");
    expect(r.stdout.indexOf("`t295-k3`")).toBeLessThan(r.stdout.indexOf("`t295-k2`"));
  }, SPAWN_TIMEOUT);

  it("C2 list on an empty store says so and exits 0", async () => {
    const { dir, db } = store(0);
    const r = await cli(dir, db, "list");
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("No stored knowledge entries yet.");
  }, SPAWN_TIMEOUT);

  it("C3 stats prints the counts, the store's path and the schema line", async () => {
    const { dir, db } = store(3);
    const r = await cli(dir, db, "stats");
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("## Knowledge Stats");
    expect(r.stdout).toContain("Total entries: 3");
    expect(r.stdout).toContain(`Database: ${db} (`);
    expect(r.stdout).toMatch(/^Schema: code v\d+, database v\d+$/m);
  }, SPAWN_TIMEOUT);

  it("C4 list --limit 0 is refused with exit 2 before the store is opened", async () => {
    const { dir, db } = store(0);
    const r = await cli(dir, db, "list", "--limit", "0");
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("list refused");
    expect(existsSync(db)).toBe(false);
  }, SPAWN_TIMEOUT);
});
