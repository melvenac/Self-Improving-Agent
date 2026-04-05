#!/usr/bin/env node

/**
 * SessionStart hook — lightweight bootstrap for every session.
 * Outputs additional context as text that gets injected into the session.
 *
 * What it does:
 * - Checks for .agents/ in cwd to detect project context
 * - Reads next-session.md handoff if it exists
 * - Checks nightly Obsidian backup freshness
 * - Reminds Clark to greet Aaron and run /start if in a project
 *
 * This does NOT replace /start — it provides a nudge and baseline context
 * so Clark isn't starting completely cold.
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const cwd = process.cwd();
const home = process.env.HOME || process.env.USERPROFILE;
const lines = [];

// Detect project context
const hasAgents = existsSync(join(cwd, '.agents'));
const hasMeta = hasAgents && existsSync(join(cwd, '.agents', 'META'));

if (hasAgents) {
  lines.push(`Project detected: ${cwd} (.agents/ found${hasMeta ? ', META mode' : ''})`);

  lines.push('');
  lines.push('Run /start for full project startup, or jump straight into work.');
} else {
  lines.push('No .agents/ detected — general session.');
  lines.push('Run /start for knowledge recall, or jump straight into work.');
}

// Check nightly Obsidian backup freshness
const vaultPath = join(home, 'Obsidian Vault');
if (existsSync(join(vaultPath, '.git'))) {
  try {
    const lastCommit = execSync('git -C "' + vaultPath + '" log -1 --format=%ct 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (lastCommit) {
      const lastCommitDate = new Date(parseInt(lastCommit) * 1000);
      const hoursAgo = (Date.now() - lastCommitDate.getTime()) / (1000 * 60 * 60);
      if (hoursAgo > 36) {
        lines.push('');
        lines.push(`WARNING: Obsidian Vault last backed up ${Math.round(hoursAgo)}h ago (expected nightly at 2am). Check backup task.`);
      }
    }
  } catch (e) { /* git not available or not a repo */ }
}

// Vault-writer health check — verify recent sessions are being captured
const sessionsDbDir = join(home, '.claude', 'context-mode', 'sessions');
const vaultSessionsDir = join(vaultPath, 'Sessions');
if (existsSync(sessionsDbDir) && existsSync(vaultSessionsDir)) {
  try {
    // Find most recent .db file
    const { readdirSync } = await import('fs');
    const dbFiles = readdirSync(sessionsDbDir).filter(f => f.endsWith('.db'));
    let newestDb = null;
    let newestMtime = 0;
    for (const f of dbFiles) {
      const s = statSync(join(sessionsDbDir, f));
      if (s.mtimeMs > newestMtime) { newestMtime = s.mtimeMs; newestDb = f; }
    }

    if (newestDb) {
      // Check if this .db has a corresponding Obsidian session (search source_db in frontmatter)
      const vaultFiles = readdirSync(vaultSessionsDir).filter(f => f.endsWith('.md'));
      let found = false;
      for (const vf of vaultFiles) {
        try {
          const content = readFileSync(join(vaultSessionsDir, vf), 'utf-8').slice(0, 500);
          if (content.includes(newestDb)) { found = true; break; }
        } catch { /* skip */ }
      }

      if (!found) {
        const hoursStale = (Date.now() - newestMtime) / (1000 * 60 * 60);
        // Only warn if the .db is old enough that session-end should have processed it
        // (skip if it's the current session's .db which hasn't ended yet)
        if (hoursStale > 1) {
          lines.push('');
          lines.push(`WARNING: session-end may be failing — session ${newestDb} (${Math.round(hoursStale)}h old) has no Obsidian capture.`);
          lines.push('Check ~/Obsidian Vault/Logs/session-end.log or run: node ~/.claude/knowledge-mcp/scripts/session-end.mjs --backfill-sessions');
        }
      }
    }
  } catch (e) { /* don't block startup on health check failures */ }
}

// Check for pending skill proposals
const pendingPath = join(home, 'Obsidian Vault', '.skill-proposals-pending.json');
if (existsSync(pendingPath)) {
  try {
    const pending = JSON.parse(readFileSync(pendingPath, 'utf-8'));
    if (pending && pending.length > 0) {
      lines.push('');
      lines.push(`Skill proposals pending: ${pending.length} cluster(s) ready for review.`);
    }
  } catch (e) { /* ignore parse errors */ }
}

if (lines.length > 0) {
  console.log(lines.join('\n'));
}
