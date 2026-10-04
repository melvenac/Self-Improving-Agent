#!/usr/bin/env node

/**
 * Self-Improving Agent — Setup Script
 * Builds open-brain MCP server, registers hooks, copies slash commands, and scaffolds the Obsidian vault.
 *
 * Usage:
 *   node scripts/setup.mjs          # normal install
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { withSessionHooks, withCursorMcp, withCursorSessionHook, repoRootFrom, copyCursorSlashCommands } from './setup-hooks.mjs';

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, '.claude');
const CURSOR_DIR = path.join(HOME, '.cursor');
const REPO_ROOT = repoRootFrom(import.meta.url);
const OPEN_BRAIN_DIR = path.join(REPO_ROOT, 'open-brain');
const OPEN_BRAIN_SERVER = path.join(OPEN_BRAIN_DIR, 'build', 'server.js');
const OPEN_BRAIN_BOOTSTRAP = path.join(OPEN_BRAIN_DIR, 'build', 'cli-bootstrap.js');

// Status indicators
const OK = '\u2713';
const SKIP = '\u00b7';
const FAIL = '\u2717';

let hadFailure = false;

function log(icon, msg) {
  console.log(`${icon} ${msg}`);
}

function checkPrerequisites() {
  const major = parseInt(process.version.slice(1).split('.')[0], 10);
  if (major < 22) {
    log(FAIL, `Node v22+ required, found ${process.version}`);
    process.exit(1);
  }

  try {
    execSync('npm --version', { stdio: 'pipe' });
  } catch {
    log(FAIL, 'npm not found on PATH');
    process.exit(1);
  }

  if (!fs.existsSync(OPEN_BRAIN_DIR)) {
    log(FAIL, `Cannot find open-brain/ — run this from the repo root`);
    process.exit(1);
  }

  log(OK, `Prerequisites OK (Node ${process.version})`);
}

function fileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function filesIdentical(a, b) {
  if (!fs.existsSync(a) || !fs.existsSync(b)) return false;
  return fileHash(a) === fileHash(b);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFileIfChanged(src, dest) {
  if (filesIdentical(src, dest)) return false;
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  return true;
}

function buildOpenBrain() {
  const serverJs = path.join(OPEN_BRAIN_DIR, 'build', 'server.js');

  try {
    // Install dependencies if node_modules is missing
    if (!fs.existsSync(path.join(OPEN_BRAIN_DIR, 'node_modules'))) {
      execSync('npm install', { cwd: OPEN_BRAIN_DIR, stdio: 'pipe' });
    }
    execSync('npm run build', { cwd: OPEN_BRAIN_DIR, stdio: 'pipe' });
  } catch (e) {
    log(FAIL, `open-brain build failed: ${e.message}`);
    hadFailure = true;
    return;
  }

  if (fs.existsSync(serverJs)) {
    log(OK, `open-brain built \u2192 ${OPEN_BRAIN_DIR}/build/`);
  } else {
    log(FAIL, 'open-brain build completed but server.js not found');
    hadFailure = true;
  }
}

function registerMcpServer() {
  const mcpJsonPath = path.join(CLAUDE_DIR, '.mcp.json');
  let config = {};

  if (fs.existsSync(mcpJsonPath)) {
    config = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'));
  }

  if (!config.mcpServers) config.mcpServers = {};

  const serverPath = path.join(OPEN_BRAIN_DIR, 'build', 'server.js');

  // Remove stale knowledge-mcp entry if present
  if (config.mcpServers['open-brain-knowledge']) {
    delete config.mcpServers['open-brain-knowledge'];
    log(OK, 'Removed stale open-brain-knowledge MCP entry');
  }

  if (config.mcpServers['open-brain']) {
    // Check if path is current
    const existing = config.mcpServers['open-brain'];
    if (existing.args?.[0] === serverPath) {
      log(SKIP, 'MCP server already registered in .mcp.json \u2014 skipped');
      return;
    }
  }

  config.mcpServers['open-brain'] = {
    command: 'node',
    args: [serverPath]
  };

  fs.writeFileSync(mcpJsonPath, JSON.stringify(config, null, 2) + '\n');
  log(OK, 'MCP server registered in .mcp.json');
}

function registerHooks() {
  const settingsPath = path.join(CLAUDE_DIR, 'settings.json');
  let settings = {};

  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  }

  // SessionStart and SessionEnd, each checked on its own (R179-5).
  const r = withSessionHooks(settings, OPEN_BRAIN_DIR);
  for (const n of r.notes) log(n.includes('already registered') ? SKIP : OK, n);
  if (!r.changed) return;
  fs.writeFileSync(settingsPath, JSON.stringify(r.settings, null, 2) + '\n');
  log(OK, `Hooks written to ${settingsPath}`);
}

function copySlashCommands() {
  const destDir = path.join(CLAUDE_DIR, 'commands');
  ensureDir(destDir);

  const repoCommandsDir = path.join(REPO_ROOT, 'project-template', '.claude', 'commands');

  if (!fs.existsSync(repoCommandsDir)) {
    log(SKIP, 'No .claude/commands/ in repo \u2014 skipped');
    return;
  }

  let copied = 0;
  for (const file of fs.readdirSync(repoCommandsDir)) {
    if (!file.endsWith('.md')) continue;
    const src = path.join(repoCommandsDir, file);
    const dest = path.join(destDir, file);
    if (copyFileIfChanged(src, dest)) copied++;
  }

  if (copied > 0) {
    log(OK, `${copied} Claude slash command(s) copied \u2192 ${destDir}`);
  } else {
    log(SKIP, 'Claude slash commands already up to date \u2014 skipped');
  }
}

function registerCursorMcp() {
  const mcpJsonPath = path.join(CURSOR_DIR, 'mcp.json');
  let config = {};

  if (fs.existsSync(mcpJsonPath)) {
    config = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'));
  }

  // T-235 P2-1: command is the ABSOLUTE path of the Node running this script, so
  // cursor-agent cannot resolve a bare `node` to a different Node (ABI mismatch).
  // OPEN_BRAIN_IDE (added by withCursorMcp) keeps Cursor's slot apart from Claude Code's.
  const r = withCursorMcp(config, OPEN_BRAIN_SERVER, process.execPath);
  if (!r.changed) {
    log(SKIP, 'Cursor open-brain MCP already registered — skipped');
    return;
  }

  ensureDir(CURSOR_DIR);
  fs.writeFileSync(mcpJsonPath, JSON.stringify(r.config, null, 2) + '\n');
  log(OK, r.notes[0]);
}

function registerCursorHooks() {
  const hooksPath = path.join(CURSOR_DIR, 'hooks.json');

  let config = { version: 1, hooks: {} };
  if (fs.existsSync(hooksPath)) {
    config = JSON.parse(fs.readFileSync(hooksPath, 'utf-8'));
  }

  const r = withCursorSessionHook(config, OPEN_BRAIN_BOOTSTRAP, process.execPath);
  for (const n of r.notes) log(n.includes('already') ? SKIP : OK, n);
  if (!r.changed) return;

  ensureDir(CURSOR_DIR);
  fs.writeFileSync(hooksPath, JSON.stringify(r.config, null, 2) + '\n');
}

function installCursorSlashCommands() {
  const r = copyCursorSlashCommands(REPO_ROOT, CURSOR_DIR);
  const destDir = path.join(CURSOR_DIR, 'commands');
  if (r.missingTemplate) {
    log(SKIP, 'No project-template/.cursor/commands/ in repo \u2014 skipped');
    return;
  }
  if (r.copied > 0) {
    log(OK, `${r.copied} Cursor slash command(s) copied \u2192 ${destDir}`);
  } else {
    log(SKIP, 'Cursor slash commands already up to date \u2014 skipped');
  }
}

function setupObsidianVault() {
  // Mirrors obsidianVaultDir() in open-brain/src/shared/paths.ts. This was
  // hardcoded to the abandoned v1 vault, so a v2 install never got a seeded
  // SKILL-INDEX.md — and skill-scan silently treats a missing index as
  // "no skills exist yet", re-proposing every distilled skill forever.
  const vaultRoot = process.env.OPEN_BRAIN_VAULT_DIR || path.join(HOME, 'Obsidian Vault v2');
  const dirs = ['Archive', 'Checkpoints', 'Experiences', 'Skill-Candidates', 'Skills', 'Summaries'];
  const templateFiles = {
    // The Domain column is the contract: parseExistingSkills() reads it to
    // decide which candidate clusters have already graduated into a skill.
    [path.join(vaultRoot, 'Skill-Candidates', 'SKILL-INDEX.md')]:
      '# Skill Index\n\n> Approved, reusable skills distilled from experience patterns.\n\n'
      + '## Skills\n\n'
      + '| Name | File | Domain | Problem Class | Source Project | Version |\n'
      + '|---|---|---|---|---|---|\n\n'
      + '## Pending Proposals\n\n'
      + '| Proposed Skill | Related Experiences | Domain | Status |\n'
      + '|---|---|---|---|\n',
    [path.join(vaultRoot, 'Skill-Candidates', 'SKILL-CANDIDATES.md')]:
      '# Skill Candidates\n\n> Experience clusters that may be worth distilling into skills.\n\n(none yet)\n'
  };

  let created = 0;

  for (const dir of dirs) {
    const fullPath = path.join(vaultRoot, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      created++;
    }
  }

  for (const [filePath, content] of Object.entries(templateFiles)) {
    if (!fs.existsSync(filePath)) {
      ensureDir(path.dirname(filePath));
      fs.writeFileSync(filePath, content);
      created++;
    }
  }

  if (created > 0) {
    log(OK, `Obsidian vault scaffolded (${created} items) \u2192 ${vaultRoot}`);
  } else {
    log(SKIP, 'Obsidian vault already exists \u2014 skipped');
  }
}

function main() {
  console.log('\nSelf-Improving Agent Setup\n');

  checkPrerequisites();
  buildOpenBrain();
  registerMcpServer();
  registerHooks();
  copySlashCommands();
  registerCursorMcp();
  registerCursorHooks();
  installCursorSlashCommands();
  setupObsidianVault();

  console.log('');
  if (hadFailure) {
    console.log('Setup completed with errors. Review the output above.');
    process.exit(1);
  } else {
    console.log('Setup complete! Restart Claude Code and Cursor to activate MCP + hooks.');
  }
}

main();
