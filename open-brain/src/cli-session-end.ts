#!/usr/bin/env node

/**
 * SessionEnd hook entry point — thin CLI wrapper.
 * Runs the 5-stage session-end pipeline: session summary, auto-feedback,
 * invocation logging, shadow recall, topics. They are numbered 1-4 and 7 in
 * index-v2.ts, because stages 5 and 6 were cut in Loop 10 along with the
 * reflection queue and the skill scan.
 *
 * Replaces open-brain/scripts/session-end-v2.mjs with compiled TypeScript.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { openV2Database } from "./db-v2.js";
import { sessionEndV2 } from "./pipelines/session-end/index-v2.js";
import { resolveRecalledIds, formatRecalledResolution } from "./pipelines/session-end/recalled-ids.js";
import { obsidianVaultDir } from "./shared/paths.js";
import { resolveHookProjectDir } from "./shared/repo-root.js";
import { resolveSessionId } from "./shared/active-session.js";

const V2_DB = process.env.KNOWLEDGE_V2_DB || join(homedir(), ".claude", "open-brain", "knowledge-v2.db");
const V2_VAULT = obsidianVaultDir();

// The session uuid, from the hook payload on stdin — the same authoritative
// source cli-bootstrap.ts reads, and for the same reason.
//
// This previously read `process.env.CLAUDE_SESSION_ID`, which Claude Code does
// not set. The variable that exists is CLAUDE_CODE_SESSION_ID. So sessionId was
// the empty string on every session end this hook has ever run, and the effect
// was not a missing label but a silent no-op: resolveRecalledIds got a null
// session, could not match recall_log, and (since Loop 5 removed the
// .recalled-entries.json write) resolved nothing, so Stage 2's loop body never
// executed. The heuristic rating arm has therefore produced zero rows in the
// entire life of the rating_method column — see
// ~/Obsidian Vault v2/Research/loop-7-c1-reconciliation-2026-09-15.md §2.
//
// Reading stdin rather than the corrected env name is deliberate: it is the
// documented contract, it matches the hook that works, and it is IDE-agnostic
// (Cursor sets no CLAUDE_* variable at all but does send a payload).
// CLAUDE_CODE_SESSION_ID stays as a fallback for a host that sends no stdin.
let hookPayload: Record<string, unknown> = {};
try {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString().trim();
  if (raw) hookPayload = JSON.parse(raw);
} catch { /* stdin unavailable — fall back to the environment below */ }

try {
  if (!existsSync(V2_DB)) {
    console.log("[session-end] v2 DB not found, skipping.");
    process.exit(0);
  }
  if (!existsSync(V2_VAULT)) {
    console.log("[session-end] v2 vault not found, skipping.");
    process.exit(0);
  }

  // Loop 4 R5: resolve the real project root (shared/repo-root.ts) so a hook
  // fired with a drifted cwd cannot write a stray `.agents/` into a subpackage.
  const projectDir = resolveHookProjectDir(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const sessionId =
    resolveSessionId(hookPayload)?.uuid || process.env.CLAUDE_CODE_SESSION_ID || "";
  const agentsDir = join(projectDir, ".agents");

  const project = projectDir.split(/[/\\]/).filter(Boolean).pop() || "General";

  const db = openV2Database(V2_DB);
  try {
    // recall_log for this session wins; the file is consulted only when it
    // names this same session. See resolveRecalledIds — the copy on disk had
    // been two sessions stale and was being rated as if it were current.
    const resolved = resolveRecalledIds({
      db,
      sessionId: sessionId || null,
      filePaths: [
        join(projectDir, ".recalled-entries.json"),
        join(homedir(), ".claude", "context-mode", ".recalled-entries.json"),
      ],
      readFile: (p) => { try { return readFileSync(p, "utf-8"); } catch { return null; } },
    });
    const recalledIds = resolved.ids;
    // Loop 5 R3: this hook runs unattended, so it was the worst place for a
    // silent no-rating. It previously spoke only when a file was refused; a
    // session with no id and no file said nothing at all and rated nothing.
    for (const line of formatRecalledResolution(resolved, "")) console.log(`[session-end] ${line}`);
    const result = sessionEndV2({
      db,
      vaultDir: V2_VAULT,
      agentsDir,
      sessionId,
      sessionSummary: "", // self-generates from session .db when empty
      project,
      recalledEntryIds: recalledIds,
      recalledOrigin: resolved.origin === "none" ? undefined : resolved.origin,
      dryRun: false,
    });

    const genLabel = result.summary.selfGenerated ? " (self-generated)" : "";
    console.log(`[session-end] Summary: ${result.summary.written ? "written" : "skipped"}${genLabel}`);
    console.log(`[session-end] Feedback: ${result.feedback.processed} entries`);
    console.log(`[session-end] Invocations: ${result.invocations.logged} logged`);
  } finally {
    db.close();
  }
} catch (err) {
  console.error("[session-end] Error:", err instanceof Error ? err.message : err);
  process.exit(0); // Don't fail the hook
}
