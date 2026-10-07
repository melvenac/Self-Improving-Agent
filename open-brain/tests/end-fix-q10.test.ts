/** Q10 — SessionEnd with git missing / bad inputs exits 0 and says did not run */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/**
 * E6 findings (read-only, not built):
 * (a) Foreign `.recalled-entries.json` ids are never rated — `resolveRecalledIds` refuses a file whose
 *     `session_id` does not match (see `open-brain/tests/pipelines/session-end/recalled-ids.test.ts` T-050).
 *     Context-mode writes `~/.claude/context-mode/.recalled-entries.json` (startup subagent; Loop 5 stopped
 *     project-root writes).
 * (b) `ob_end` / `sessionEndV2` writes vault summaries via `writeSummary` only — it does not append to
 *     `.agents/SESSIONS/Session_N.md` created by `ob_start`.
 */
const tsxCli = join(import.meta.dirname, "../node_modules/tsx/dist/cli.mjs");
const hookEntry = join(import.meta.dirname, "../src/cli-session-end.ts");

describe("end-fix Q10", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "endfix-q10-"));
    mkdirSync(join(dir, ".agents"), { recursive: true });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("SessionEnd exits 0 outside git and says handoff / work-after checks did not run", () => {
    const transcript = join(dir, "t.jsonl");
    writeFileSync(transcript, `{"timestamp":"2026-09-25T12:00:00.000Z"}\n`);
    const r = spawnSync(process.execPath, [tsxCli, hookEntry], {
      cwd: dir,
      input: JSON.stringify({ session_id: "u", transcript_path: transcript }),
      encoding: "utf8",
      timeout: 90_000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir, KNOWLEDGE_V2_DB: join(dir, "no.db") },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/handoff check NOT RUN/);
    expect(r.stdout).toMatch(/work-after-end/);
  });
});
