import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleStart, handleEnd, handleSync, handleScore, computeScore } from "../src/server.js";
import { createDb } from "../src/db.js";

function getText(response: { content: { type: string; text: string }[] }): string {
  return response.content[0].text;
}

describe("server handlers", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "ob-server-"));
  });

  afterEach(() => {
    try { rmSync(tmp, { recursive: true }); } catch { /* Windows race */ }
  });

  describe("handleStart", () => {
    it("returns lightweight mode for bare directory", async () => {
      writeFileSync(join(tmp, "package.json"), JSON.stringify({ version: "1.0.0" }));
      const res = await handleStart({ project_root: tmp });

      expect(res.isError).toBeUndefined();
      const text = getText(res);
      expect(text).toContain("Session Start — lightweight mode");
      expect(text).toContain("v1.0.0");
      // Absent files are spelled out, in the size block and under their header.
      expect(text).toContain("SUMMARY.md (.agents/SYSTEM/SUMMARY.md): absent");
      expect(text).toContain("## SUMMARY.md\nabsent");
      expect(text).toContain("## INBOX.md\nabsent");
      expect(text).toContain("## task.md\nabsent");
      expect(text).toContain("## next-session.md\nabsent");
    });

    it("returns project mode when .agents/ exists", async () => {
      writeFileSync(join(tmp, "package.json"), JSON.stringify({ version: "2.0.0" }));
      const agentsDir = join(tmp, ".agents", "SYSTEM");
      mkdirSync(agentsDir, { recursive: true });
      writeFileSync(join(agentsDir, "SUMMARY.md"), "# Summary\nAll good");
      // Create SESSIONS dir for session log
      mkdirSync(join(tmp, ".agents", "SESSIONS"), { recursive: true });
      writeFileSync(join(tmp, ".agents", "SESSIONS", "SESSION_TEMPLATE.md"), "template");

      const res = await handleStart({ project_root: tmp });
      const text = getText(res);
      expect(text).toContain("Session Start — project mode");
      expect(text).toContain("v2.0.0");
    });

    /**
     * Loop 1 (ADR-023): ob_start used to compute the state and then report
     * "SUMMARY loaded" — the content never left the pipeline. This pins the
     * shape that replaced it: full file text under per-file headers, drift as
     * a result, the session block, and the size instrumentation.
     */
    it("returns the full state, drift, session block and size block (untruncated default)", async () => {
      writeFileSync(join(tmp, "package.json"), JSON.stringify({ version: "2.0.0" }));
      mkdirSync(join(tmp, ".agents", "SYSTEM"), { recursive: true });
      mkdirSync(join(tmp, ".agents", "TASKS"), { recursive: true });
      mkdirSync(join(tmp, ".agents", "SESSIONS"), { recursive: true });
      // 60 lines: past the old hardcoded 50-line cut, so the default is proven untruncated.
      const summaryLines = ["# Summary", "**Version:** 1.9.0", ...Array.from({ length: 58 }, (_, i) => `line ${i + 3} alpha beta`)];
      writeFileSync(join(tmp, ".agents", "SYSTEM", "SUMMARY.md"), summaryLines.join("\n"));
      writeFileSync(join(tmp, ".agents", "TASKS", "INBOX.md"), "# Inbox\n- [ ] first task");
      writeFileSync(join(tmp, ".agents", "TASKS", "task.md"), "# Task\ncurrent focus");
      writeFileSync(join(tmp, ".agents", "SESSIONS", "SESSION_TEMPLATE.md"), "# Session N — [Date]\n> **Status:** In Progress\n");

      const res = await handleStart({ project_root: tmp });
      expect(res.isError).toBeUndefined();
      const text = getText(res);

      // Content, whole, under headers.
      expect(text).toContain("## SUMMARY.md\n# Summary\n**Version:** 1.9.0");
      expect(text).toContain("line 60 alpha beta");
      expect(text).not.toContain("...(truncated)");
      expect(text).toContain("## INBOX.md\n# Inbox\n- [ ] first task");
      expect(text).toContain("## task.md\n# Task\ncurrent focus");
      expect(text).toContain("## next-session.md\nabsent");

      // Drift is relayed as a result (SUMMARY says 1.9.0, package.json says 2.0.0).
      expect(text).toContain("Drift detected (1):");
      expect(text).toContain("summary-version: expected 2.0.0, got 1.9.0 (not fixed)");

      // Session block.
      expect(text).toMatch(/Session #1\nLog: .*Session_1\.md\nSession ID: /);

      // Size block: one line per file, absent spelled out, truncated: no.
      expect(text).toContain("## Sizes (tokens estimated as chars/4)");
      const summaryText = summaryLines.join("\n");
      const summaryWords = summaryText.trim().split(/\s+/).length;
      expect(text).toContain(
        `SUMMARY.md (.agents/SYSTEM/SUMMARY.md): 60 lines, ${summaryWords} words, ~${Math.ceil(summaryText.length / 4)} tokens, truncated: no`
      );
      expect(text).toContain("INBOX.md (.agents/TASKS/INBOX.md): 2 lines, 7 words, ~6 tokens, truncated: no");
      expect(text).toContain("task.md (.agents/TASKS/task.md): 2 lines, 4 words, ~5 tokens, truncated: no");
      expect(text).toContain("next-session.md (.agents/SESSIONS/next-session.md): absent");

      // Total is of the text above it and matches an independent count.
      const m = text.match(/\n\nTotal returned words: (\d+) \(~(\d+) tokens\)$/);
      expect(m).not.toBeNull();
      const body = text.slice(0, m!.index);
      expect(Number(m![1])).toBe(body.trim().split(/\s+/).length);
      expect(Number(m![2])).toBe(Math.ceil(body.length / 4));
    });

    it("truncates only under an explicit budget, and says so per file", async () => {
      writeFileSync(join(tmp, "package.json"), JSON.stringify({ version: "2.0.0" }));
      mkdirSync(join(tmp, ".agents", "SYSTEM"), { recursive: true });
      mkdirSync(join(tmp, ".agents", "TASKS"), { recursive: true });
      // sessionStart() writes the log unconditionally once .agents/ exists, so
      // SESSIONS/ must be there (see the Loop 1 gaps list — not fixed here).
      mkdirSync(join(tmp, ".agents", "SESSIONS"), { recursive: true });
      const summary = Array.from({ length: 10 }, (_, i) => `summary line ${i + 1}`).join("\n");
      writeFileSync(join(tmp, ".agents", "SYSTEM", "SUMMARY.md"), summary);
      writeFileSync(join(tmp, ".agents", "TASKS", "task.md"), "one line only");

      const res = await handleStart({ project_root: tmp, state_budget_lines: 3 });
      const text = getText(res);

      // The long file is cut at the budget and flagged with the source size.
      expect(text).toContain("## SUMMARY.md\nsummary line 1\nsummary line 2\nsummary line 3\n...(truncated)");
      expect(text).not.toContain("summary line 4");
      expect(text).toMatch(/SUMMARY\.md \(.*\): 4 lines, \d+ words, ~\d+ tokens, truncated: yes \(4 of 10 source lines\)/);
      // The short file under budget is untouched; absent stays absent.
      expect(text).toContain("task.md (.agents/TASKS/task.md): 1 lines, 3 words, ~4 tokens, truncated: no");
      expect(text).toContain("## task.md\none line only");
      expect(text).toContain("## INBOX.md\nabsent");
    });

    it("returns error response on failure", async () => {
      // Non-existent deep path that will fail
      const res = await handleStart({ project_root: join(tmp, "nonexistent", "deep", "path") });
      // Should not crash — returns gracefully even for missing dirs
      expect(res.content[0].text).toBeTruthy();
    });
  });

  describe("handleEnd", () => {
    it("runs session-end with in-memory DB (dry run)", async () => {
      // Create a minimal project structure
      writeFileSync(join(tmp, "package.json"), JSON.stringify({ version: "1.0.0" }));

      // Create an in-memory DB at a temp path
      const dbPath = join(tmp, "knowledge.db");
      const db = createDb(dbPath);
      db.insertKnowledge("test entry about auth", { key: "auth-test", tags: ["auth"] });
      db.close();

      // handleEnd opens its own DB at $KNOWLEDGE_V2_DB, which setup-env.ts points
      // at a temp dir — so this exercises the dry-run path against a scratch DB,
      // not the one created above and not the real ~/.claude one.
      const res = await handleEnd({
        project_root: tmp,
        dry_run: true,
        recalled_entry_ids: [],
        session_summary: "worked on auth",
      });

      const text = getText(res);
      expect(text).toContain("Session End:");
      expect(text).toContain("Summary:");
      expect(text).toContain("Feedback: 0 entries rated");
      // Always names the source, including the boring one — see originLine.
      expect(text).toContain("Recalled ids: 0 from");
    });

    it("names the source of the recalled ids", async () => {
      writeFileSync(join(tmp, "package.json"), JSON.stringify({ version: "1.0.0" }));

      const res = await handleEnd({
        project_root: tmp,
        dry_run: true,
        recalled_entry_ids: [1, 2],
        session_summary: "explicit ids supplied",
      });

      expect(getText(res)).toContain("Recalled ids: 2 from explicit");
    });

    it("says which file it refused and why", async () => {
      writeFileSync(join(tmp, "package.json"), JSON.stringify({ version: "1.0.0" }));
      // A file left behind by an earlier session — the live 2026-08-11 case.
      writeFileSync(
        join(tmp, ".recalled-entries.json"),
        JSON.stringify({ session_id: "2fb67133-stale", entries: [{ id: 138 }, { id: 184 }] })
      );

      const res = await handleEnd({
        project_root: tmp,
        dry_run: true,
        session_id: "efcaeb75-current",
        session_summary: "different session entirely",
      });

      const text = getText(res);
      expect(text).toContain("Recalled ids: 0 from none");
      expect(text).toContain("Ignored");
      expect(text).toContain("2fb67133-stale");
      // The stale entries must not have been rated.
      expect(text).toContain("Feedback: 0 entries rated");
    });

    it("reports errors gracefully", async () => {
      // With recalled IDs but no DB, it should error gracefully
      const res = await handleEnd({
        project_root: tmp,
        recalled_entry_ids: [999],
        session_summary: "test",
      });

      // Should either succeed (creating DB) or return error response
      expect(res.content[0].text).toBeTruthy();
    });
  });

  describe("handleSync", () => {
    it("runs sync on project root", async () => {
      writeFileSync(join(tmp, "package.json"), JSON.stringify({ version: "1.0.0" }));

      const res = await handleSync({ project_root: tmp, check_only: true });

      expect(res.isError).toBeUndefined();
      const text = getText(res);
      expect(text).toContain("Sync — v1.0.0");
      expect(text).toContain("Summary:");
    });

    it("includes score when requested", async () => {
      writeFileSync(join(tmp, "package.json"), JSON.stringify({ version: "1.0.0" }));

      const res = await handleSync({ project_root: tmp, check_only: true, score: true });
      const text = getText(res);
      expect(text).toContain("Health Score:");
      expect(text).toContain("/100");
    });
  });

  describe("handleScore", () => {
    it("returns score history or empty message", async () => {
      writeFileSync(join(tmp, "package.json"), JSON.stringify({ version: "1.0.0" }));

      const res = await handleScore({ project_root: tmp, history_only: true });
      const text = getText(res);
      // Reads the redirected history from setup-env.ts — empty unless an earlier
      // test in this worker appended, so both outcomes are valid.
      expect(text).toMatch(/Score History|No score history found/);
    });
  });

  describe("computeScore", () => {
    it("returns valid score with all categories", () => {
      writeFileSync(join(tmp, "package.json"), JSON.stringify({ version: "1.0.0" }));

      const checks = [
        { name: "test-check", severity: "pass" as const, message: "ok" },
      ];

      const result = computeScore(tmp, checks);
      // Scores against the empty temp DB from setup-env.ts, so the total is
      // bounded — it used to read production stats and could exceed 100.
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeLessThanOrEqual(100);
      expect(result.categories).toHaveLength(5);
      expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Verify all category names
      const names = result.categories.map((c) => c.name);
      expect(names).toContain("Config & Structure");
      expect(names).toContain("Knowledge Quality");
      expect(names).toContain("Staleness");
      expect(names).toContain("Coverage");
      expect(names).toContain("Pipeline Health");

      // Each category score must be within [0, max]
      for (const cat of result.categories) {
        expect(cat.score).toBeGreaterThanOrEqual(0);
        expect(cat.score).toBeLessThanOrEqual(cat.max);
      }
    });

    it("falls back to zeros when the DB has no knowledge entries", () => {
      writeFileSync(join(tmp, "package.json"), JSON.stringify({ version: "1.0.0" }));

      // setup-env.ts points $KNOWLEDGE_V2_DB at an empty temp DB, so this is the
      // no-entries path: Knowledge Quality must degrade to a score, not throw.
      const checks = [
        { name: "test", severity: "pass" as const, message: "ok" },
      ];

      const result = computeScore(tmp, checks);
      // Should not crash — falls back to zeros if no DB
      expect(result.categories.find((c) => c.name === "Knowledge Quality")!.score).toBeGreaterThanOrEqual(0);
    });
  });
});
