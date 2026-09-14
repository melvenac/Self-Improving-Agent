import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleStart, handleEnd, handleSync, handleScore, computeScore, handleSetSession } from "../src/server.js";
import { readFileSync, cpSync } from "node:fs";

const stateFixture = join(import.meta.dirname, "fixtures-state/state.json");

/** A project with the four prose files, for the state.json rendering tests. */
function proseProject(tmp: string): void {
  writeFileSync(join(tmp, "package.json"), JSON.stringify({ version: "0.29.0" }));
  mkdirSync(join(tmp, ".agents", "SYSTEM"), { recursive: true });
  mkdirSync(join(tmp, ".agents", "TASKS"), { recursive: true });
  mkdirSync(join(tmp, ".agents", "SESSIONS"), { recursive: true });
  writeFileSync(join(tmp, ".agents", "SYSTEM", "SUMMARY.md"), "# Summary\nPROSE-SUMMARY-MARKER alpha beta");
  writeFileSync(join(tmp, ".agents", "TASKS", "INBOX.md"), "# Inbox\n- [ ] PROSE-INBOX-MARKER");
  writeFileSync(join(tmp, ".agents", "TASKS", "task.md"), "# Task\nPROSE-TASK-MARKER");
  writeFileSync(join(tmp, ".agents", "SESSIONS", "next-session.md"), "# Handoff\nPROSE-NEXT-MARKER");
  writeFileSync(join(tmp, ".agents", "SESSIONS", "SESSION_TEMPLATE.md"), "# Session N — [Date]\n> **Status:** In Progress\n");
}
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

    /** Loop 2 V3(a): a valid state.json is rendered instead of the four prose files. */
    it("renders the State section from a valid state.json and withholds the prose files", async () => {
      proseProject(tmp);
      cpSync(stateFixture, join(tmp, ".agents", "state.json"));

      const res = await handleStart({ project_root: tmp });
      expect(res.isError).toBeUndefined();
      const text = getText(res);

      expect(text).toContain("## State (state.json rev 7)");
      expect(text).toContain("Project: Self-Improving-Agent v0.29.0");
      expect(text).toContain("Objective: Replace the four prose state files with a record");
      // Active tasks only, grouped by priority; done is a count.
      expect(text).toContain("Tasks (16 active; done: 11):");
      expect(text).toContain("  P0:\n    [in_progress] T-005 state.json strict schema module");
      expect(text).toContain("[blocked] T-012 /end writes state.json");
      expect(text).toContain("[blocked] T-024 Choose an apoptosis threshold with a defensible gate (supersedes T-023)");
      expect(text).not.toContain("T-001 ob_start returns state");   // done — count only
      expect(text).not.toMatch(/\[done\]/);
      // Verified: one line each with an evidence count; reopened is flagged.
      expect(text).toContain("Verified (8):");
      expect(text).toContain("  V-002 — readOptional does not truncate by default; a budget cut is flagged per file (2 evidence)");
      expect(text).toContain("(1 evidence) [REOPENED]");
      expect(text).toContain("Gaps (5):\n  G-001 — Cursor start.md copies");
      expect(text).toContain("Decisions: 6 recorded; latest D-001 (2026-09-14)");
      expect(text).toContain("Handoff (session 54):\n  pick up: Loop 2: run V1–V9");
      expect(text).toContain("    - Run vitest from open-brain/, never the repo root (entry 462).");
      expect(text).toContain("Last session: #54 2026-09-14 (f7a1b3d9-ef6d-482f-aba1-ddaa296f722b)");

      // The four prose files are NOT returned…
      for (const marker of ["PROSE-SUMMARY-MARKER", "PROSE-INBOX-MARKER", "PROSE-TASK-MARKER", "PROSE-NEXT-MARKER"]) {
        expect(text).not.toContain(marker);
      }
      expect(text).not.toContain("## SUMMARY.md");
      // …but they stay in the size block, and state.json joins it.
      expect(text).toMatch(/SUMMARY\.md \(\.agents\/SYSTEM\/SUMMARY\.md\): 2 lines, \d+ words/);
      expect(text).toMatch(/INBOX\.md \(\.agents\/TASKS\/INBOX\.md\): 2 lines/);
      expect(text).toMatch(/task\.md \(\.agents\/TASKS\/task\.md\): 2 lines/);
      expect(text).toMatch(/next-session\.md \(\.agents\/SESSIONS\/next-session\.md\): 2 lines/);
      expect(text).toMatch(/state\.json \(\.agents\/state\.json\): \d+ lines, \d+ words, ~\d+ tokens, truncated: no/);
      expect(text).toMatch(/\n\nTotal returned words: \d+ \(~\d+ tokens\)$/);
    });

    /** Loop 2 V3(b): an invalid state.json says so and falls back to v0.28.0 output. */
    it("reports an invalid state.json with its path and falls back to the prose files", async () => {
      proseProject(tmp);
      const broken = JSON.parse(readFileSync(stateFixture, "utf-8"));
      broken.tasks[2].priority = "P9";
      writeFileSync(join(tmp, ".agents", "state.json"), JSON.stringify(broken));

      const text = getText(await handleStart({ project_root: tmp }));
      expect(text).toContain("state.json invalid at tasks.2.priority: ");
      expect(text).toContain(" — falling back to files");
      expect(text).not.toContain("## State (");
      expect(text).toContain("## SUMMARY.md\n# Summary\nPROSE-SUMMARY-MARKER alpha beta");
      expect(text).toContain("## INBOX.md\n# Inbox\n- [ ] PROSE-INBOX-MARKER");
      expect(text).toContain("## task.md\n# Task\nPROSE-TASK-MARKER");
      expect(text).toContain("## next-session.md\n# Handoff\nPROSE-NEXT-MARKER");
      // Size block still present, with the (invalid) file in it.
      expect(text).toMatch(/state\.json \(\.agents\/state\.json\): \d+ lines/);
    });

    /** Loop 2 V3(c) / P1: no state.json → no State section, no fallback line, no fifth size entry. */
    it("leaves v0.28.0 output untouched when state.json is absent", async () => {
      proseProject(tmp);
      const text = getText(await handleStart({ project_root: tmp }));
      expect(text).not.toContain("state.json");
      expect(text).not.toContain("## State (");
      expect(text).toContain("## SUMMARY.md\n# Summary\nPROSE-SUMMARY-MARKER alpha beta");
      expect(text).toContain("## next-session.md\n# Handoff\nPROSE-NEXT-MARKER");
    });

    /** Loop 2 R1: .agents/ without SESSIONS/ no longer errors; the block says why there is no log. */
    it("says why no session log was created when SESSIONS/ is missing", async () => {
      writeFileSync(join(tmp, "package.json"), JSON.stringify({ version: "2.0.0" }));
      mkdirSync(join(tmp, ".agents", "SYSTEM"), { recursive: true });
      writeFileSync(join(tmp, ".agents", "SYSTEM", "SUMMARY.md"), "# Summary");
      const res = await handleStart({ project_root: tmp });
      expect(res.isError).toBeUndefined();
      const text = getText(res);
      expect(text).toContain("Session Start — project mode");
      expect(text).toContain("Session log: no .agents/SESSIONS/ dir — log not created");
      expect(text).not.toContain("Session #");
    });

    /**
     * Loop 2 R3 / Loop 1 P7, now exercised: the id registered through the
     * (extracted) ob_set_session handler is the id ob_start stamps into the
     * log — and a second ob_start reuses that log instead of minting another.
     */
    it("stamps the registered session id into the log and reuses it on a second call", async () => {
      proseProject(tmp);
      const id = "11111111-2222-4333-8444-555555555555";
      const reg = await handleSetSession({ session_id: id, project_dir: tmp });
      expect(reg.isError).toBeUndefined();
      expect(getText(reg)).toContain(`Session registered: ${id}`);
      expect(getText(reg)).toContain("[via argument]");

      const first = getText(await handleStart({ project_root: tmp }));
      expect(first).toMatch(new RegExp(`Session #1\\nLog: .*Session_1\\.md\\nSession ID: ${id}`));
      const log = readFileSync(join(tmp, ".agents", "SESSIONS", "Session_1.md"), "utf-8");
      expect(log).toContain(`> **Session ID:** ${id}`);

      const second = getText(await handleStart({ project_root: tmp }));
      expect(second).toContain("Session #1 (existing log for this session id — reused, nothing created)");
      expect(second).toContain(`Session ID: ${id}`);
      const logs = readdirSync(join(tmp, ".agents", "SESSIONS")).filter((f) => /^Session_\d+\.md$/.test(f));
      expect(logs).toEqual(["Session_1.md"]);
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
