import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { handleStart, handleEnd, handleSync, handleScore, computeScore, handleSetSession, handleState } from "../src/server.js";
import { applyStateOps } from "../src/shared/state-writer.js";
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
import Database from "better-sqlite3";
import { initSchemaV2, indexKnowledge } from "../src/db-v2.js";
import { byPidDir, processStartTime, writeProcessSession } from "../src/shared/process-session.js";

/**
 * T-003: the server writes only under the session it can PROVE, so a test that
 * needs an attributed write gives it a real proof: for this worker's real parent
 * process, with that process's real start time. Removed after every test, so
 * no row inherits another's session.
 */
let ppidStart: string | null | undefined;
function proveOwn(id: string): void {
  if (ppidStart === undefined) ppidStart = processStartTime(process.ppid);
  writeProcessSession(byPidDir(process.env.OPEN_BRAIN_ACTIVE_SESSION!), {
    session_id: id, claude_pid: process.ppid, proc_start: ppidStart!, ide: "claude", written_at: new Date().toISOString(),
  });
}
afterEach(() => rmSync(byPidDir(process.env.OPEN_BRAIN_ACTIVE_SESSION!), { recursive: true, force: true }));

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
      expect(text).toMatch(/Session #1( \(local — from this checkout's session logs; no valid state\.json\))?\nLog: .*Session_1\.md\nSession ID: /);

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
      // R2 (Loop 3): decisions are append-ordered; latest is the last element, not the newest date.
      expect(text).toContain("Decisions: 6 recorded; latest D-006 (2026-08-31) Lifecycle evaluation stays out of the session-end sweep");
      // The fixture's single v1 handoff migrated to seat "developer". handleStart
      // resolves the reader's seat from the checkout rather than assuming one, and
      // this temp project declares none — so the render says the seat is
      // unresolved and names the handoff instead of showing it as "yours".
      expect(text).toContain("READER'S SEAT UNRESOLVED");
      expect(text).toContain("developer [legacy] (session 54)");
      // Another seat's watch-out items are NOT rendered — only its pick-up line
      // and its close-out commit. Pinned as an absence: printing every seat's
      // full handoff to every reader is the noise that made one shared slot look
      // tolerable for as long as it did.
      expect(text).not.toContain("    - Run vitest from open-brain/, never the repo root (entry 462).");
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
    it("leaves v0.28.0 prose output untouched when state.json is absent, and marks the session number local (T-164 SC-3)", async () => {
      proseProject(tmp);
      const text = getText(await handleStart({ project_root: tmp }));
      expect(text).not.toContain("## State (");
      expect(text).toContain("Session #1 (local — from this checkout's session logs; no valid state.json)");
      expect(text).toContain("## SUMMARY.md\n# Summary\nPROSE-SUMMARY-MARKER alpha beta");
      expect(text).toContain("## next-session.md\n# Handoff\nPROSE-NEXT-MARKER");
    });

    /** Loop 3 V7: ob_state round trip — write through the handler, views land on disk, ob_start renders the new revision. */
    it("ob_state applies a batch, renders the views, and ob_start reads the result back", async () => {
      proseProject(tmp);
      cpSync(stateFixture, join(tmp, ".agents", "state.json"));
      // Loop 8 R3: state-version drift is gone with the field. package.json is
      // bumped here only so the views re-render, which is what this asserts.
      writeFileSync(join(tmp, "package.json"), JSON.stringify({ version: "0.30.0" }));

      // T-163: the writing session is the server's REGISTERED session, never an op
      // argument, so the round trip registers one first.
      proveOwn("round-trip-uuid");
      await handleSetSession({ session_id: "round-trip-uuid", project_dir: tmp });
      const refused = await handleState({ project_root: tmp, session: 55, expected_revision: 3, ops: [{ op: "set_objective", text: "x" }] });
      expect(refused.isError).toBe(true);
      expect(getText(refused)).toContain("ob_state refused: revision mismatch: expected_revision 3 but .agents/state.json is at revision 7");
      expect(getText(refused)).toContain("Nothing written.");

      const res = await handleState({
        project_root: tmp, session: 55, expected_revision: 7,
        ops: [
          { op: "close_task", id: "T-005", append_note: "shipped in Loop 2" },
          { op: "open_task", title: "Loop 3 writer", priority: "P0" },
          { op: "add_verified", claim: "ob_state round-trips", evidence: [{ type: "test", path: "open-brain/tests/server.test.ts", observation: "this test" }] },
          { op: "add_decision", title: "Views are generated", date: "2026-09-15", note: "" },
          { op: "set_handoff", seat: "developer", pick_up: "Loop 4 migration", watch_out: ["reconnect the server"], open_questions: [] },
        ],
      });
      expect(res.isError).toBeUndefined();
      const out = getText(res);
      expect(out).toContain("ob_state applied\nRevision: 7 → 8");
      // set_handoff reports the SEAT as its id, so which seat wrote a handoff is
      // visible in the applied list rather than only inside the file.
      expect(out).toContain("  close_task T-005\n  open_task T-028\n  add_verified V-009\n  add_decision D-007\n  set_handoff developer");
      // R179-1: done tasks age by sessions written since their close; the fixture's were closed
      // before v3 (closed_rev null) and this is the first keyed session, so none goes yet.
      expect(out).toContain("Dropped done tasks (retention 3 sessions): none");
      expect(out).toContain("Rendered (4): .agents/TASKS/INBOX.md, .agents/TASKS/task.md, .agents/SESSIONS/next-session.md, .agents/SYSTEM/SUMMARY.md");

      // Views on disk, generated.
      const header = "<!-- generated from .agents/state.json rev 8 by open-brain v0.30.0 — do not edit; change state via ob_state -->";
      expect(readFileSync(join(tmp, ".agents", "TASKS", "INBOX.md"), "utf-8").startsWith(header)).toBe(true);
      expect(readFileSync(join(tmp, ".agents", "TASKS", "task.md"), "utf-8")).toContain("**T-028** [P0] Loop 3 writer");
      // The last-session line now carries the seat that closed it, between the
      // date and the uuid: which seat ended a session was previously knowable
      // only by reading the handoff it happened to write.
      // T-163: the session record is written by the write itself, stamped today,
      // with the seat it handed off as and this checkout.
      const next = readFileSync(join(tmp, ".agents", "SESSIONS", "next-session.md"), "utf-8");
      expect(next).toMatch(/Session 55 — \d{4}-\d{2}-\d{2} — developer /);
      expect(next).toContain(`developer [${basename(tmp)}] — \`round-trip-uuid\``);
      const summary = readFileSync(join(tmp, ".agents", "SYSTEM", "SUMMARY.md"), "utf-8");
      expect(summary).toContain("PROSE-SUMMARY-MARKER alpha beta"); // outside the region, preserved
      expect(summary).toContain("<!-- state:begin -->");
      expect(summary).toContain("> **Status:** v0.30.0 — Replace the four prose state files");

      // ob_start reads the new revision back.
      const start = getText(await handleStart({ project_root: tmp }));
      expect(start).toContain("## State (state.json rev 8)");
      expect(start).toContain("[open] T-028 Loop 3 writer");
      expect(start).not.toContain("[in_progress] T-005");
      expect(start).toContain("Decisions: 7 recorded; latest D-007 (2026-09-15) Views are generated");
      // This temp project declares no seat, so the read-back names the handoff
      // rather than presenting it as the reader's own.
      expect(start).toContain(`developer [${basename(tmp)}] (session 55)`);
      expect(start).toContain("Loop 4 migration");
      expect(start).toMatch(/Last session: #55 \d{4}-\d{2}-\d{2} \(round-trip-uuid\)/);
      // R3: state.json still says 0.29.0 while package.json says 0.30.0 → reported, not fixed.
      expect(start).not.toContain("state-version:");
    });

    /** T-171: the printed result carries every note change, in the dry run as in the write. */
    it("ob_state prints each note change on its own line, dry run included", async () => {
      proseProject(tmp);
      cpSync(stateFixture, join(tmp, ".agents", "state.json"));
      await handleSetSession({ session_id: "t171-uuid", project_dir: tmp });
      const ops = [{ op: "update_task", id: "T-005", append_note: "and more" }];
      const dry = getText(await handleState({ project_root: tmp, session: 55, expected_revision: 7, ops, dry_run: true }));
      expect(dry).toContain("ob_state dry run — nothing written");
      expect(dry).toContain(`NOTE CHANGE: T-005 note APPENDED: +${" — and more".length} chars`);
      const real = getText(await handleState({ project_root: tmp, session: 55, expected_revision: 7, ops }));
      expect(real).toContain(`NOTE CHANGE: T-005 note APPENDED: +${" — and more".length} chars`);
    });

    /** T171-D3: the dry run of a replace is the door the agent reads. QA 144's dry-run-hides-replace drops this line. */
    it("ob_state dry run of replace_note prints the REPLACED line", async () => {
      proseProject(tmp);
      cpSync(stateFixture, join(tmp, ".agents", "state.json"));
      await handleSetSession({ session_id: "t171-uuid", project_dir: tmp });
      const ops = [{ op: "update_task", id: "T-008", replace_note: "first words" }];
      const dry = getText(await handleState({ project_root: tmp, session: 55, expected_revision: 7, ops, dry_run: true }));
      expect(dry).toContain("ob_state dry run — nothing written");
      expect(dry).toContain("NOTE CHANGE: T-008 note REPLACED:");
      expect(readFileSync(join(tmp, ".agents", "state.json"), "utf-8")).toBe(readFileSync(stateFixture, "utf-8"));
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
      proveOwn(id);
      const reg = await handleSetSession({ session_id: id, project_dir: tmp });
      expect(reg.isError).toBeUndefined();
      expect(getText(reg)).toContain(`Session registered: ${id}`);
      expect(getText(reg)).toContain(`[via process proof: parent ${process.ppid}]`);

      const first = getText(await handleStart({ project_root: tmp }));
      expect(first).toMatch(new RegExp(`Session #1( \\(local — from this checkout's session logs; no valid state\\.json\\))?\\nLog: .*Session_1\\.md\\nSession ID: ${id}`));
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

      // Create a scratch DB at a temp path. Loop 10 C2 (E29): this used the v1
      // `createDb`, which production does not use; repointed at `db-v2`.
      const dbPath = join(tmp, "knowledge.db");
      const db = new Database(dbPath);
      initSchemaV2(db);
      indexKnowledge(db, {
        vaultPath: join(tmp, "auth-test.md"),
        key: "auth-test",
        content: "test entry about auth",
        tags: "auth",
        source: "manual",
      });
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

      proveOwn("efcaeb75-current");
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

describe("F2 / F3 — a refusal must name the condition it is actually about", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "ob-refuse-"));
    mkdirSync(join(tmp, ".agents"), { recursive: true });
  });

  afterEach(() => {
    try { rmSync(tmp, { recursive: true }); } catch { /* Windows race */ }
  });

  const writeState = (o: Record<string, unknown>) =>
    writeFileSync(join(tmp, ".agents", "state.json"), JSON.stringify(o, null, 2) + "\n");

  const writeProse = (marker: string) => {
    mkdirSync(join(tmp, ".agents", "SYSTEM"), { recursive: true });
    writeFileSync(join(tmp, ".agents", "SYSTEM", "SUMMARY.md"), "# " + marker + "\n\nthe account\n");
  };

  it("F2: the reconnect/rebuild advice appears ONLY on a schema_version mismatch", async () => {
    // The old condition was /schema|expected .* received|invalid/i, which matches
    // almost every refusal ob_state can produce. QA saw it on seven refusals in a
    // row, all against a schema-VALID record — including a plain bad argument.
    cpSync(stateFixture, join(tmp, ".agents", "state.json"));
    const badOp = await handleState({
      project_root: tmp,
      session: 55,
      expected_revision: 7,
      ops: [{ op: "open_task", title: "x", priority: "P9" }],
    });
    const text = getText(badOp);
    expect(text).toMatch(/invalid at priority/);
    expect(text).not.toMatch(/reconnect/i);
    expect(text).not.toMatch(/Rebuild the checkout/i);
  });

  it("F2: and it DOES appear on a schema_version mismatch, saying rebuild rather than reconnect", async () => {
    // The other half, and the wording matters: a reconnect restarts the server
    // from the SAME BUILD, so when the schema change is in a build this one does
    // not have, reconnecting changes nothing. That is what actually happened.
    writeState({ schema_version: 99, revision: 0 });
    const r = await handleState({
      project_root: tmp,
      session: 1,
      expected_revision: 0,
      ops: [{ op: "set_objective", text: "x" }],
    });
    const text = getText(r);
    expect(text).toMatch(/schema_version/);
    expect(text).toMatch(/RECONNECT ALONE MAY NOT FIX IT/);
    expect(text).toMatch(/Rebuild the checkout this server runs from/);
  });

  it("F3: ob_start REFUSES an unknown schema_version and does NOT fall back to prose", async () => {
    // ob_state refused a record it could not parse; ob_start did not. It printed
    // one notice line and then returned 59k characters of prose, so a session
    // started from a stale build against a migrated record got a greeting that
    // looked like the pre-state.json regime. The merge choreography counts on
    // that failure being loud, and it was loud on the WRITE side only.
    writeState({ schema_version: 99, revision: 0 });
    writeProse("PROSE-SENTINEL");

    const res = await handleStart({ project_root: tmp });
    const text = getText(res);
    expect(res.isError).toBe(true);
    expect(text).toMatch(/STATE RECORD REFUSED/);
    expect(text).toMatch(/NOT falling back to the prose files/);
    // The prose must not be in the return at all. The point is that it is a
    // different and older account, not that it carries a warning.
    expect(text).not.toMatch(/PROSE-SENTINEL/);
  });

  it("F3: an ABSENT state.json still keeps the prose regime", async () => {
    // Narrow on purpose, and ruled: absence is the pre-state.json case, which is
    // supported. Only a PRESENT file whose version this build does not know
    // refuses. Turning a fix into an outage for every project without a record
    // would be the larger bug.
    writeProse("PROSE-SENTINEL");

    const res = await handleStart({ project_root: tmp });
    const text = getText(res);
    expect(res.isError).toBeUndefined();
    expect(text).toMatch(/PROSE-SENTINEL/);
    expect(text).not.toMatch(/STATE RECORD REFUSED/);
  });

  it("F3: a MALFORMED but known-version record still falls back, rather than refusing", async () => {
    // The distinction the errorPath branch exists for: "this build cannot read
    // this VERSION" is not "this file is broken". For the second, the prose is
    // the best available answer.
    writeState({ schema_version: 3, revision: -1 });
    writeProse("PROSE-SENTINEL");

    const res = await handleStart({ project_root: tmp });
    const text = getText(res);
    expect(res.isError).toBeUndefined();
    expect(text).toMatch(/invalid at revision/);
    expect(text).toMatch(/falling back to files/);
    expect(text).toMatch(/PROSE-SENTINEL/);
  });
});

/**
 * R179-2 (QA 125's D2, A7): ob_set_session refuses a uuid the record already
 * holds under a DIFFERENT checkout. Registering as it would stamp this
 * session's writes with that session's uuid, and set_handoff would replace that
 * session's handoff in place — invisibly to record-erasure, because the key is
 * still present. Same-checkout registration and slot adoption (A7/A8 in one
 * checkout, A9) are T-003's and are NOT covered: the last row pins that limit so
 * it is not read as covered.
 */
/**
 * R179-2 is superseded by T-003 (not lost): R179-2 refused registering as ANOTHER
 * checkout's recorded session and pinned same-checkout impersonation as a LIMIT.
 * Now only the PROVEN id registers, in any checkout, so both are refused and the
 * LIMIT row below is flipped: what it pinned as open is closed.
 */
describe("R179-2 → T-003: ob_set_session and another session's uuid", () => {
  let tmp: string;
  const VICTIM = "00000700-0000-4000-8000-000000000700";
  const OWN = "00000701-0000-4000-8000-000000000701";
  const recordAs = (uuid: string, checkout: string, pick_up: string) => {
    const s = JSON.parse(readFileSync(join(tmp, ".agents", "state.json"), "utf-8")) as { revision: number };
    const r = applyStateOps(tmp, {
      session: 700, expected_revision: s.revision, session_uuid: uuid, checkout, render: false,
      ops: [{ op: "set_handoff", seat: "developer", pick_up, watch_out: [], open_questions: [] }],
    });
    if (!r.ok) throw new Error(r.error);
  };

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "ob-r1792-"));
    proseProject(tmp);
    cpSync(stateFixture, join(tmp, ".agents", "state.json"));
    proveOwn(OWN);
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

  it("A7 across checkouts: registering as a session recorded in ANOTHER checkout is refused, and the victim's handoff cannot be reached", async () => {
    recordAs(VICTIM, "sia-builder", "victim session 700's handoff");
    const res = await handleSetSession({ session_id: VICTIM, project_dir: tmp });
    expect(res.isError).toBe(true);
    expect(getText(res)).toContain(`ob_set_session refused: ${VICTIM} is not this server's session`);
    expect(getText(res)).toContain(`attributed writes use ${OWN}`);
    const s = JSON.parse(readFileSync(join(tmp, ".agents", "state.json"), "utf-8")) as { revision: number };
    const w = await handleState({ project_root: tmp, session: 701, expected_revision: s.revision, ops: [{ op: "set_handoff", seat: "developer", pick_up: "attacker overwrote it", watch_out: [], open_questions: [] }] });
    expect(w.isError).toBeUndefined();
    const after = JSON.parse(readFileSync(join(tmp, ".agents", "state.json"), "utf-8")) as { handoffs: Array<{ session_uuid: string | null; pick_up: string }> };
    expect(after.handoffs.find((h) => h.session_uuid === VICTIM)?.pick_up).toBe("victim session 700's handoff");
    expect(after.handoffs.find((h) => h.session_uuid === OWN)?.pick_up).toBe("attacker overwrote it");
  });

  it("a uuid the record has not seen is refused unless it is the proven one: an unseen id is a claim, not proof", async () => {
    const unseen = await handleSetSession({ session_id: "00000702-0000-4000-8000-000000000702", project_dir: tmp });
    expect(unseen.isError).toBe(true);
    const own = await handleSetSession({ session_id: OWN, project_dir: tmp });
    expect(own.isError).toBeUndefined();
    expect(getText(own)).toContain(`Session registered: ${OWN}`);
  });

  it("FLIPPED LIMIT: a uuid recorded under THIS checkout is refused too — same-checkout impersonation was T-003's, and is closed", async () => {
    recordAs(VICTIM, basename(tmp), "same-checkout victim");
    const res = await handleSetSession({ session_id: VICTIM, project_dir: tmp });
    expect(res.isError).toBe(true);
    expect(getText(res)).toContain(`${VICTIM} is not this server's session`);
  });
});
