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
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1'));
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

// Temporary main — will be expanded in Task 7
checkPrerequisites();
