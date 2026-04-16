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

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, '.claude');
const REPO_ROOT = path.resolve(path.join(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1'), '..'));
const OPEN_BRAIN_DIR = path.join(REPO_ROOT, 'open-brain');

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

  if (!settings.hooks) settings.hooks = {};

  const bootstrapPath = path.join(REPO_ROOT, 'scripts', 'session-bootstrap.mjs');
  const command = `node "${bootstrapPath}"`;

  // SessionStart hook for bootstrap
  if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];

  const alreadyExists = settings.hooks.SessionStart.some(entry =>
    entry.hooks?.some(h => h.command === command)
  );

  if (alreadyExists) {
    log(SKIP, 'Hooks already configured \u2014 skipped');
    return;
  }

  settings.hooks.SessionStart.push({
    matcher: '',
    hooks: [{
      type: 'command',
      command
    }]
  });

  // Remove stale knowledge-mcp SessionEnd hooks if present
  if (settings.hooks.SessionEnd) {
    const before = settings.hooks.SessionEnd.length;
    settings.hooks.SessionEnd = settings.hooks.SessionEnd.filter(entry => {
      const cmds = entry.hooks?.map(h => h.command) || [];
      return !cmds.some(c => c.includes('knowledge-mcp'));
    });
    const removed = before - settings.hooks.SessionEnd.length;
    if (removed > 0) {
      log(OK, `Removed ${removed} stale knowledge-mcp SessionEnd hook(s)`);
    }
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  log(OK, 'SessionStart hook registered in settings.json');
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
    log(OK, `${copied} slash command(s) copied \u2192 ${destDir}`);
  } else {
    log(SKIP, 'Slash commands already up to date \u2014 skipped');
  }
}

function setupObsidianVault() {
  const vaultRoot = path.join(HOME, 'Obsidian Vault');
  const dirs = ['Experiences', 'Skill-Candidates', 'Sessions', 'Topics'];
  const templateFiles = {
    [path.join(vaultRoot, 'Skill-Candidates', 'SKILL-INDEX.md')]:
      '# Skill Index\n\n> Approved, reusable skills distilled from experience patterns.\n\n(none yet)\n',
    [path.join(vaultRoot, 'Skill-Candidates', 'SKILL-CANDIDATES.md')]:
      '# Skill Candidates\n\n> Experience clusters that may be worth distilling into skills.\n\n(none yet)\n'
  };

  // Migration: rename Guidelines/ → Skill-Candidates/ if the old name exists
  const oldDir = path.join(vaultRoot, 'Guidelines');
  const newDir = path.join(vaultRoot, 'Skill-Candidates');
  if (fs.existsSync(oldDir) && !fs.existsSync(newDir)) {
    fs.renameSync(oldDir, newDir);
    log(OK, 'Migrated Guidelines/ → Skill-Candidates/');
  }

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
  setupObsidianVault();

  console.log('');
  if (hadFailure) {
    console.log('Setup completed with errors. Review the output above.');
    process.exit(1);
  } else {
    console.log('Setup complete! Restart Claude Code to activate the MCP server.');
  }
}

main();
