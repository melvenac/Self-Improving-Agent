#!/usr/bin/env node

/**
 * Self-Improving Agent — Setup Script
 * Installs Knowledge MCP server, hooks, slash commands, and Obsidian vault.
 *
 * Usage:
 *   node scripts/setup.mjs          # normal install (copies files)
 *   node scripts/setup.mjs --dev    # dev install (symlinks src/ and scripts/)
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const DEV_MODE = process.argv.includes('--dev');
const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, '.claude');
const INSTALL_DIR = path.join(CLAUDE_DIR, 'knowledge-mcp');
const REPO_ROOT = path.resolve(path.join(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1'), '..'));
const REPO_KMC = path.join(REPO_ROOT, 'knowledge-mcp');

// Status indicators
const OK = '\u2713';
const SKIP = '\u00b7';
const FAIL = '\u2717';

let hadFailure = false;

function log(icon, msg) {
  console.log(`${icon} ${msg}`);
}

function checkPrerequisites() {
  // Node version
  const major = parseInt(process.version.slice(1).split('.')[0], 10);
  if (major < 22) {
    log(FAIL, `Node v22+ required, found ${process.version}`);
    process.exit(1);
  }

  // npm available
  try {
    execSync('npm --version', { stdio: 'pipe' });
  } catch {
    log(FAIL, 'npm not found on PATH');
    process.exit(1);
  }

  // Running from repo root
  if (!fs.existsSync(REPO_KMC)) {
    log(FAIL, `Cannot find knowledge-mcp/ — run this from the repo root`);
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

function copyDirRecursive(src, dest) {
  let changed = false;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (copyDirRecursive(srcPath, destPath)) changed = true;
    } else {
      if (copyFileIfChanged(srcPath, destPath)) changed = true;
    }
  }
  return changed;
}

function isSymlinkTo(linkPath, targetPath) {
  try {
    const stat = fs.lstatSync(linkPath);
    if (!stat.isSymbolicLink()) return false;
    const resolved = fs.realpathSync(linkPath);
    return path.resolve(resolved) === path.resolve(targetPath);
  } catch {
    return false;
  }
}

function createSymlinkOrJunction(target, linkPath) {
  // Remove existing (file, dir, or stale symlink)
  try {
    const stat = fs.lstatSync(linkPath);
    if (stat) fs.rmSync(linkPath, { recursive: true, force: true });
  } catch {
    // doesn't exist — fine
  }
  const type = process.platform === 'win32' ? 'junction' : 'dir';
  fs.symlinkSync(target, linkPath, type);
}

function installKnowledgeMcp() {
  ensureDir(INSTALL_DIR);

  const srcDir = path.join(REPO_KMC, 'src');
  const scriptsDir = path.join(REPO_KMC, 'scripts');
  const destSrc = path.join(INSTALL_DIR, 'src');
  const destScripts = path.join(INSTALL_DIR, 'scripts');

  let changed = false;

  if (DEV_MODE) {
    if (!isSymlinkTo(destSrc, srcDir)) {
      createSymlinkOrJunction(srcDir, destSrc);
      changed = true;
    }
    if (!isSymlinkTo(destScripts, scriptsDir)) {
      createSymlinkOrJunction(scriptsDir, destScripts);
      changed = true;
    }
    if (copyFileIfChanged(path.join(REPO_KMC, 'package.json'), path.join(INSTALL_DIR, 'package.json'))) changed = true;
    if (copyFileIfChanged(path.join(REPO_KMC, 'tsconfig.json'), path.join(INSTALL_DIR, 'tsconfig.json'))) changed = true;
  } else {
    if (copyDirRecursive(srcDir, destSrc)) changed = true;
    if (copyDirRecursive(scriptsDir, destScripts)) changed = true;
    if (copyFileIfChanged(path.join(REPO_KMC, 'package.json'), path.join(INSTALL_DIR, 'package.json'))) changed = true;
    if (copyFileIfChanged(path.join(REPO_KMC, 'tsconfig.json'), path.join(INSTALL_DIR, 'tsconfig.json'))) changed = true;
  }

  // npm install + build
  try {
    execSync('npm install', { cwd: INSTALL_DIR, stdio: 'pipe' });
    execSync('npm run build', { cwd: INSTALL_DIR, stdio: 'pipe' });
  } catch (e) {
    log(FAIL, `Knowledge MCP build failed: ${e.message}`);
    hadFailure = true;
    return;
  }

  if (changed) {
    const mode = DEV_MODE ? '(dev \u2014 symlinked)' : '(copied)';
    log(OK, `Knowledge MCP installed ${mode} \u2192 ${INSTALL_DIR}`);
  } else {
    log(SKIP, `Knowledge MCP already up to date \u2014 skipped`);
  }
}

function registerMcpServer() {
  const mcpJsonPath = path.join(CLAUDE_DIR, '.mcp.json');
  let config = {};

  if (fs.existsSync(mcpJsonPath)) {
    config = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'));
  }

  if (!config.mcpServers) config.mcpServers = {};

  if (config.mcpServers['open-brain-knowledge']) {
    log(SKIP, 'MCP server already registered in .mcp.json \u2014 skipped');
    return;
  }

  const serverPath = path.join(INSTALL_DIR, 'build', 'server.js');
  config.mcpServers['open-brain-knowledge'] = {
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

  const scriptsBase = path.join(INSTALL_DIR, 'scripts');

  const hooksToRegister = {
    SessionStart: [
      path.join(scriptsBase, 'session-bootstrap.mjs')
    ],
    SessionEnd: [
      path.join(scriptsBase, 'auto-index.mjs'),
      path.join(scriptsBase, 'vault-writer.mjs'),
      path.join(scriptsBase, 'skill-scan.mjs')
    ]
  };

  let added = 0;

  for (const [event, scriptPaths] of Object.entries(hooksToRegister)) {
    if (!settings.hooks[event]) settings.hooks[event] = [];

    for (const scriptPath of scriptPaths) {
      const command = `node "${scriptPath}"`;

      const alreadyExists = settings.hooks[event].some(entry =>
        entry.hooks?.some(h => h.command === command)
      );

      if (alreadyExists) continue;

      settings.hooks[event].push({
        matcher: '',
        hooks: [{
          type: 'command',
          command
        }]
      });
      added++;
    }
  }

  if (added > 0) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    log(OK, `${added} hook(s) registered in settings.json`);
  } else {
    log(SKIP, 'Hooks already configured \u2014 skipped');
  }
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
  const dirs = ['Experiences', 'Guidelines', 'Sessions', 'Topics'];
  const templateFiles = {
    [path.join(vaultRoot, 'Guidelines', 'SKILL-INDEX.md')]:
      '# Skill Index\n\n> Approved, reusable skills distilled from experience patterns.\n\n(none yet)\n',
    [path.join(vaultRoot, 'Guidelines', 'SKILL-CANDIDATES.md')]:
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
  console.log(`\nSelf-Improving Agent Setup${DEV_MODE ? ' (dev mode)' : ''}\n`);

  checkPrerequisites();
  installKnowledgeMcp();
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
