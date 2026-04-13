#!/usr/bin/env node
import { openV2Database } from '../build/db-v2.js';
import { sessionEndV2 } from '../build/pipelines/session-end/index-v2.js';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, readFileSync } from 'fs';

const V2_DB = join(homedir(), '.claude', 'open-brain', 'knowledge-v2.db');
const V2_VAULT = join(homedir(), 'Obsidian Vault v2');

try {
  // Check prerequisites
  if (!existsSync(V2_DB)) {
    console.log('[session-end-v2] v2 DB not found, skipping.');
    process.exit(0);
  }
  if (!existsSync(V2_VAULT)) {
    console.log('[session-end-v2] v2 vault not found, skipping.');
    process.exit(0);
  }

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const sessionId = process.env.CLAUDE_SESSION_ID || '';
  const agentsDir = join(projectDir, '.agents');

  // Read recalled entries
  let recalledIds = [];
  const recalledPath = join(homedir(), '.claude', 'context-mode', '.recalled-entries.json');
  if (existsSync(recalledPath)) {
    try {
      const data = JSON.parse(readFileSync(recalledPath, 'utf-8'));
      recalledIds = (data.entries || []).map(e => e.id).filter(Boolean);
    } catch {}
  }

  // Infer project name from path
  const project = projectDir.split(/[/\\]/).filter(Boolean).pop() || 'General';

  const db = openV2Database(V2_DB);
  try {
    const result = sessionEndV2({
      db,
      vaultDir: V2_VAULT,
      agentsDir,
      sessionId,
      sessionSummary: '', // Hook doesn't have access to session summary
      project,
      recalledEntryIds: recalledIds,
      dryRun: false,
    });

    console.log(`[session-end-v2] Summary: ${result.summary.written ? 'written' : 'skipped'}`);
    console.log(`[session-end-v2] Feedback: ${result.feedback.processed} entries`);
    console.log(`[session-end-v2] Reflection: ${result.reflection.flagged} clusters flagged`);
  } finally {
    db.close();
  }
} catch (err) {
  console.error('[session-end-v2] Error:', err.message || err);
  process.exit(0); // Don't fail the hook
}
