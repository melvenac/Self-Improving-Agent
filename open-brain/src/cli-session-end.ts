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

const V2_DB = process.env.KNOWLEDGE_V2_DB || join(homedir(), ".claude", "open-brain", "knowledge-v2.db");
const V2_VAULT = join(homedir(), "Obsidian Vault v2");

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

  // Read recalled entries — check project root first, then legacy path
  let recalledIds: number[] = [];
  const recalledCandidates = [
    join(projectDir, ".recalled-entries.json"),
    join(homedir(), ".claude", "context-mode", ".recalled-entries.json"),
  ];
  for (const recalledPath of recalledCandidates) {
    if (existsSync(recalledPath)) {
      try {
        const data = JSON.parse(readFileSync(recalledPath, "utf-8"));
        recalledIds = (data.entries || []).map((e: { id?: number }) => e.id).filter(Boolean);
        break;
      } catch { /* skip */ }
    }
  }

  const project = projectDir.split(/[/\\]/).filter(Boolean).pop() || "General";

  const db = openV2Database(V2_DB);
  try {
    const result = sessionEndV2({
      db,
      vaultDir: V2_VAULT,
      agentsDir,
      sessionId,
      sessionSummary: "", // self-generates from session .db when empty
      project,
      recalledEntryIds: recalledIds,
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
