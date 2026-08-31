#!/usr/bin/env node

/**
 * SessionEnd hook entry point — thin CLI wrapper.
 * Runs the 5-stage session-end pipeline (summary, feedback, reflection,
 * invocation logging, skill-scan).
 *
 * Replaces open-brain/scripts/session-end-v2.mjs with compiled TypeScript.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { openV2Database } from "./db-v2.js";
import { sessionEndV2 } from "./pipelines/session-end/index-v2.js";
import { resolveRecalledIds } from "./pipelines/session-end/recalled-ids.js";
import { obsidianVaultDir } from "./shared/paths.js";

const V2_DB = process.env.KNOWLEDGE_V2_DB || join(homedir(), ".claude", "open-brain", "knowledge-v2.db");
const V2_VAULT = obsidianVaultDir();

try {
  if (!existsSync(V2_DB)) {
    console.log("[session-end] v2 DB not found, skipping.");
    process.exit(0);
  }
  if (!existsSync(V2_VAULT)) {
    console.log("[session-end] v2 vault not found, skipping.");
    process.exit(0);
  }

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const sessionId = process.env.CLAUDE_SESSION_ID || "";
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
    if (resolved.rejected) {
      console.log(`[session-end] Ignored ${resolved.rejected.path}: ${resolved.rejected.reason}`);
    }
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
    console.log(`[session-end] Reflection: ${result.reflection.flagged} clusters flagged`);
    console.log(`[session-end] Invocations: ${result.invocations.logged} logged`);
    console.log(`[session-end] Skill scan: ${result.skillScan.clusters} clusters`);
  } finally {
    db.close();
  }
} catch (err) {
  console.error("[session-end] Error:", err instanceof Error ? err.message : err);
  process.exit(0); // Don't fail the hook
}
