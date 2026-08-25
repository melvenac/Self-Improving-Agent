#!/usr/bin/env node

/**
 * Self-Improving Agent — Setup Script
 * Builds open-brain MCP server, registers hooks, copies slash commands, and scaffolds the Obsidian vault.
 *
 * Usage:
 *   node scripts/setup.mjs                          # normal install (prompts for names on first run)
 *   node scripts/setup.mjs --user Jack --agent Clark # set names without prompting
 *   node scripts/setup.mjs --reconfigure             # re-prompt for names and re-render commands
 *   node scripts/setup.mjs --yes                     # never prompt; use stored names or defaults
 *
 * Identity: the slash commands address you by name and give the agent a
 * persona. Onboarding stores both in ~/.claude/open-brain/identity.json and
 * renders the {{USER_NAME}} / {{AGENT_NAME}} placeholders as the commands are
 * installed. Re-run setup at any time to change them.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { pathToFileURL } from 'node:url';

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, '.claude');
const CURSOR_DIR = path.join(HOME, '.cursor');
const REPO_ROOT = path.resolve(path.join(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1'), '..'));
const OPEN_BRAIN_DIR = path.join(REPO_ROOT, 'open-brain');
const OPEN_BRAIN_SERVER = path.join(OPEN_BRAIN_DIR, 'build', 'server.js');
const OPEN_BRAIN_BOOTSTRAP = path.join(OPEN_BRAIN_DIR, 'build', 'cli-bootstrap.js');

// Status indicators
const OK = '\u2713';
const SKIP = '\u00b7';
const FAIL = '\u2717';

let hadFailure = false;

// ---- CLI flags ----------------------------------------------------------
function parseArgs(argv) {
  const args = { user: null, agent: null, reconfigure: false, yes: false, dev: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) {
        console.error(`${a} needs a value`);
        process.exit(1);
      }
      return v;
    };
    if (a === '--user') args.user = next();
    else if (a.startsWith('--user=')) args.user = a.slice('--user='.length);
    else if (a === '--agent') args.agent = next();
    else if (a.startsWith('--agent=')) args.agent = a.slice('--agent='.length);
    else if (a === '--reconfigure') args.reconfigure = true;
    else if (a === '--yes' || a === '-y') args.yes = true;
    else if (a === '--dev') args.dev = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/setup.mjs [--user NAME] [--agent NAME] [--reconfigure] [--yes]');
      process.exit(0);
    } else {
      console.error(`Unknown option: ${a}`);
      process.exit(1);
    }
  }
  return args;
}
const ARGS = parseArgs(process.argv.slice(2));

// The identity helpers are compiled TypeScript in open-brain/build/. They are
// loaded after buildOpenBrain() so there is exactly one implementation of the
// placeholder rendering — the same one the /sync parity check uses.
let identityLib = null;
async function loadIdentityLib() {
  if (identityLib) return identityLib;
  const modPath = path.join(OPEN_BRAIN_DIR, 'build', 'shared', 'identity.js');
  if (!fs.existsSync(modPath)) return null;
  identityLib = await import(pathToFileURL(modPath).href);
  return identityLib;
}

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

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
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

  const bootstrapPath = path.join(OPEN_BRAIN_DIR, 'build', 'cli-bootstrap.js');
  const command = `node "${bootstrapPath}"`;

  // SessionStart hook for bootstrap
  if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];

  // Compare normalised, not literal. path.join yields backslashes on Windows
  // while an earlier install may have written forward slashes; exact-string
  // matching then misses the existing entry and appends a SECOND registration,
  // so the SessionStart hook fires twice and SESSION_UUID is emitted twice.
  // (This is exactly what a re-run of setup.mjs did on 2026-07-28.)
  const norm = (s) => String(s || '').replace(/\\/g, '/').toLowerCase();
  const target = norm(command);

  const alreadyExists = settings.hooks.SessionStart.some(entry =>
    entry.hooks?.some(h => norm(h.command) === target)
  );

  if (alreadyExists) {
    log(SKIP, 'Hooks already configured \u2014 skipped');
    return;
  }

  // Drop any prior cli-bootstrap registration that differs only by path
  // spelling, so a re-run repairs a duplicate rather than adding to it.
  let removedDupes = 0;
  settings.hooks.SessionStart = settings.hooks.SessionStart.filter(entry => {
    const cmds = (entry.hooks || []).map(h => norm(h.command));
    const isBootstrap = cmds.some(c => c.includes('cli-bootstrap.js'));
    if (isBootstrap) removedDupes++;
    return !isBootstrap;
  });
  if (removedDupes > 0) {
    log(OK, `Replaced ${removedDupes} cli-bootstrap SessionStart registration(s) differing by path spelling`);
  }

  settings.hooks.SessionStart.push({
    matcher: '',
    hooks: [{
      type: 'command',
      command
    }]
  });

  // Remove stale session-bootstrap.mjs and knowledge-mcp hooks
  if (settings.hooks.SessionStart) {
    const beforeStart = settings.hooks.SessionStart.length;
    settings.hooks.SessionStart = settings.hooks.SessionStart.filter(entry => {
      const cmds = entry.hooks?.map(h => h.command) || [];
      return !cmds.some(c => c.includes('session-bootstrap.mjs'));
    });
    const removedStart = beforeStart - settings.hooks.SessionStart.length;
    if (removedStart > 0) {
      log(OK, `Removed ${removedStart} stale session-bootstrap.mjs hook(s)`);
    }
  }

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

// ---- Identity (onboarding) ---------------------------------------------

function gitUserName() {
  try {
    return execSync('git config --get user.name', { stdio: 'pipe' }).toString().trim() || null;
  } catch {
    return null;
  }
}

async function promptIdentity(seed) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log('');
    console.log('  The slash commands greet you by name and give the agent a persona.');
    console.log('  Press Enter to accept a default. Re-run with --reconfigure to change later.');
    console.log('');
    const ask = async (label, fallback) => {
      const answer = (await rl.question(`  ${label} [${fallback}]: `)).trim();
      return answer || fallback;
    };
    const user_name = await ask('Your name', seed.user_name);
    const agent_name = await ask('Agent name', seed.agent_name);
    console.log('');
    return { user_name, agent_name };
  } catch (e) {
    // Ctrl+D / closed stdin mid-prompt. Fall back to the seed rather than
    // dying with a stack trace: the answer to "who are you" can be corrected
    // later with --reconfigure, but a half-finished install cannot.
    if (e?.name === 'AbortError' || e?.code === 'ERR_USE_AFTER_CLOSE') {
      console.log('');
      log(SKIP, 'Prompt closed \u2014 keeping the defaults shown (re-run with --reconfigure to change)');
      return { ...seed };
    }
    throw e;
  } finally {
    rl.close();
  }
}

/**
 * Resolve the identity for this install, in precedence order:
 *   --user/--agent flags  >  stored identity (unless --reconfigure)
 *   >  interactive prompt (TTY, not --yes)  >  derived default.
 * Whatever is resolved is persisted, so the /sync parity check and a later
 * re-run see the same names this install rendered with.
 */
async function configureIdentity() {
  const lib = await loadIdentityLib();
  if (!lib) {
    log(FAIL, 'open-brain build missing \u2014 cannot configure identity');
    hadFailure = true;
    return null;
  }

  const stored = lib.loadIdentity(HOME);
  const derived = lib.defaultIdentity({ gitUserName: gitUserName() });
  const seed = stored || derived;
  const flagged = ARGS.user !== null || ARGS.agent !== null;

  let identity;
  let how;
  if (flagged) {
    identity = { user_name: ARGS.user ?? seed.user_name, agent_name: ARGS.agent ?? seed.agent_name };
    how = 'from flags';
  } else if (stored && !ARGS.reconfigure) {
    identity = stored;
    how = 'stored';
  } else if (process.stdin.isTTY && !ARGS.yes) {
    identity = await promptIdentity(seed);
    how = 'from prompt';
  } else {
    identity = seed;
    how = stored ? 'stored' : 'derived \u2014 pass --user/--agent or re-run in a terminal to change';
  }

  if (!identity.user_name.trim() || !identity.agent_name.trim()) {
    log(FAIL, 'Identity names cannot be empty');
    hadFailure = true;
    return null;
  }

  const changed = !stored || stored.user_name !== identity.user_name || stored.agent_name !== identity.agent_name;
  const savedTo = lib.saveIdentity(identity, HOME);
  log(changed ? OK : SKIP, `Identity: you are "${identity.user_name}", the agent is "${identity.agent_name}" (${how}) \u2192 ${savedTo}`);
  return identity;
}

/**
 * Copy every *.md in srcDir to destDir with the identity placeholders filled.
 * Compares rendered content, not source hashes: the installed file is meant to
 * differ from the template by exactly the substitutions, and a re-run after
 * --reconfigure must rewrite files whose source did not change.
 */
async function renderCommands(srcDir, destDir, identity) {
  const lib = await loadIdentityLib();
  let written = 0;
  for (const file of fs.readdirSync(srcDir)) {
    if (!file.endsWith('.md')) continue;
    const raw = fs.readFileSync(path.join(srcDir, file), 'utf-8');
    const rendered = identity && lib ? lib.renderIdentity(raw, identity) : raw;
    const dest = path.join(destDir, file);
    if (fs.existsSync(dest) && fs.readFileSync(dest, 'utf-8') === rendered) continue;
    ensureDir(destDir);
    fs.writeFileSync(dest, rendered);
    written++;
  }
  return written;
}

async function copySlashCommands(identity) {
  const destDir = path.join(CLAUDE_DIR, 'commands');
  ensureDir(destDir);

  const repoCommandsDir = path.join(REPO_ROOT, 'project-template', '.claude', 'commands');

  if (!fs.existsSync(repoCommandsDir)) {
    log(SKIP, 'No .claude/commands/ in repo \u2014 skipped');
    return;
  }

  const copied = await renderCommands(repoCommandsDir, destDir, identity);

  if (copied > 0) {
    log(OK, `${copied} Claude slash command(s) rendered \u2192 ${destDir}`);
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

  if (!config.mcpServers) config.mcpServers = {};

  const serverPath = OPEN_BRAIN_SERVER.replace(/\\/g, '/');
  const existing = config.mcpServers['open-brain'];

  // OPEN_BRAIN_IDE scopes this session's slot in active-session.json. Without
  // it, Claude Code and Cursor on the same repo share one slot and whichever
  // started last wins \u2014 the other silently adopts its session UUID and files
  // recalls under it. The skip check requires the tag, so existing installs
  // get upgraded rather than skipped.
  const tagged = existing?.env?.OPEN_BRAIN_IDE === 'cursor';

  if (existing?.command === 'node' && existing.args?.[0]?.replace(/\\/g, '/') === serverPath && tagged) {
    log(SKIP, 'Cursor open-brain MCP already registered \u2014 skipped');
    return;
  }

  config.mcpServers['open-brain'] = {
    command: 'node',
    args: [OPEN_BRAIN_SERVER],
    env: { ...(existing?.env || {}), OPEN_BRAIN_IDE: 'cursor' }
  };

  ensureDir(CURSOR_DIR);
  fs.writeFileSync(mcpJsonPath, JSON.stringify(config, null, 2) + '\n');
  log(OK, 'open-brain registered in ~/.cursor/mcp.json');
}

function registerCursorHooks() {
  const hooksPath = path.join(CURSOR_DIR, 'hooks.json');
  // `--ide cursor` keys this session's slot separately from Claude Code's.
  const bootstrapCmd = `node "${OPEN_BRAIN_BOOTSTRAP.replace(/\\/g, '/')}" --ide cursor`;

  let config = { version: 1, hooks: {} };
  if (fs.existsSync(hooksPath)) {
    config = JSON.parse(fs.readFileSync(hooksPath, 'utf-8'));
    if (!config.hooks) config.hooks = {};
  }

  if (!config.hooks.sessionStart) config.hooks.sessionStart = [];

  // An untagged entry from an earlier install is REPLACED, not left alongside \u2014
  // two sessionStart entries would fire the hook twice.
  const stale = config.hooks.sessionStart.filter(entry =>
    entry.command?.includes('cli-bootstrap.js') && !entry.command.includes('--ide')
  );
  if (stale.length > 0) {
    config.hooks.sessionStart = config.hooks.sessionStart.filter(e => !stale.includes(e));
    log(OK, `Upgraded ${stale.length} untagged Cursor sessionStart hook entry(ies)`);
  }

  if (config.hooks.sessionStart.some(entry => entry.command === bootstrapCmd)) {
    log(SKIP, 'Cursor sessionStart hook already configured \u2014 skipped');
    return;
  }

  config.hooks.sessionStart.push({ command: bootstrapCmd });

  ensureDir(CURSOR_DIR);
  fs.writeFileSync(hooksPath, JSON.stringify(config, null, 2) + '\n');
  log(OK, 'Cursor sessionStart hook registered in ~/.cursor/hooks.json');
}

async function copyCursorSlashCommands(identity) {
  const destDir = path.join(CURSOR_DIR, 'commands');
  const repoCommandsDir = path.join(REPO_ROOT, 'project-template', '.cursor', 'commands');

  if (!fs.existsSync(repoCommandsDir)) {
    log(SKIP, 'No project-template/.cursor/commands/ in repo \u2014 skipped');
    return;
  }

  ensureDir(destDir);
  const copied = await renderCommands(repoCommandsDir, destDir, identity);

  if (copied > 0) {
    log(OK, `${copied} Cursor slash command(s) rendered \u2192 ${destDir}`);
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

async function main() {
  console.log('\nSelf-Improving Agent Setup\n');

  checkPrerequisites();
  buildOpenBrain();
  const identity = await configureIdentity();
  registerMcpServer();
  registerHooks();
  if (identity) {
    await copySlashCommands(identity);
  } else {
    log(FAIL, 'Slash commands not installed \u2014 identity unresolved, refusing to ship unrendered placeholders');
  }
  registerCursorMcp();
  registerCursorHooks();
  if (identity) await copyCursorSlashCommands(identity);
  setupObsidianVault();

  console.log('');
  if (hadFailure) {
    console.log('Setup completed with errors. Review the output above.');
    process.exit(1);
  } else {
    console.log('Setup complete! Restart Claude Code and Cursor to activate MCP + hooks.');
  }
}

main().catch((e) => {
  log(FAIL, e?.stack || String(e));
  process.exit(1);
});
