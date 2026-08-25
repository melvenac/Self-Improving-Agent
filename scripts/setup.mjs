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
 *   node scripts/setup.mjs --uninstall               # remove hooks, MCP entries, commands, identity; keep data
 *   node scripts/setup.mjs --uninstall --dry-run     # show what --uninstall would do
 *   node scripts/setup.mjs --uninstall --purge       # also delete ~/.claude/open-brain/ (the knowledge DB)
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

// Every path setup writes, so --uninstall reverses exactly this list and
// nothing else. A location added to install without being added here is a
// leak, which is why both halves read from the same constants.
const CLAUDE_SETTINGS = path.join(CLAUDE_DIR, 'settings.json');
const CLAUDE_MCP_JSON = path.join(CLAUDE_DIR, '.mcp.json');
const CLAUDE_COMMANDS_DIR = path.join(CLAUDE_DIR, 'commands');
const CLAUDE_STATE_DIR = path.join(CLAUDE_DIR, 'open-brain');
const CURSOR_MCP_JSON = path.join(CURSOR_DIR, 'mcp.json');
const CURSOR_HOOKS_JSON = path.join(CURSOR_DIR, 'hooks.json');
const CURSOR_COMMANDS_DIR = path.join(CURSOR_DIR, 'commands');
const TEMPLATE_CLAUDE_COMMANDS = path.join(REPO_ROOT, 'project-template', '.claude', 'commands');
const TEMPLATE_CURSOR_COMMANDS = path.join(REPO_ROOT, 'project-template', '.cursor', 'commands');
const MCP_SERVER_KEY = 'open-brain';
// Hook commands are recognised by the script they run, not the exact string,
// so an entry written by an older install (different path spelling, no --ide
// flag) is still ours.
const HOOK_SCRIPT_MARKERS = ['cli-bootstrap.js', 'cli-session-end.js'];

// Status indicators
const OK = '\u2713';
const SKIP = '\u00b7';
const FAIL = '\u2717';

let hadFailure = false;

// ---- CLI flags ----------------------------------------------------------
function parseArgs(argv) {
  const args = { user: null, agent: null, reconfigure: false, yes: false, dev: false,
                 uninstall: false, dryRun: false, force: false, purge: false };
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
    else if (a === '--uninstall') args.uninstall = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else if (a === '--purge') args.purge = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/setup.mjs [--user NAME] [--agent NAME] [--reconfigure] [--yes]');
      console.log('       node scripts/setup.mjs --uninstall [--dry-run] [--force] [--purge]');
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
  const mcpJsonPath = CLAUDE_MCP_JSON;
  let config = {};

  if (fs.existsSync(mcpJsonPath)) {
    config = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'));
  }

  if (!config.mcpServers) config.mcpServers = {};

  const serverPath = OPEN_BRAIN_SERVER;

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

// ---- Claude Code user-scope MCP registration ---------------------------
//
// ~/.claude/.mcp.json is NOT read by Claude Code. User-scope servers live in
// ~/.claude.json and are managed by `claude mcp add --scope user`; the
// `.mcp.json` convention is per-project. An install that only wrote
// .mcp.json produced a session where /start ran but every ob_* call failed
// with "tool not found" — found live on 2026-08-25. The CLI owns the format
// of ~/.claude.json (it is a large file with unrelated state), so this shells
// out to it rather than editing the JSON, and falls back to printing the
// command when the CLI is not on PATH.

function claudeCli(args) {
  return execSync(`claude ${args}`, { stdio: 'pipe', timeout: 60000 }).toString();
}

function hasClaudeCli() {
  try { claudeCli('--version'); return true; } catch { return false; }
}

function registeredClaudeMcpCommand() {
  // `claude mcp get` exits non-zero when the server is unknown.
  try {
    return claudeCli(`mcp get ${MCP_SERVER_KEY}`);
  } catch {
    return null;
  }
}

function registerClaudeUserMcp() {
  const manual = `claude mcp add --scope user ${MCP_SERVER_KEY} -- node "${OPEN_BRAIN_SERVER}"`;
  if (!hasClaudeCli()) {
    log(SKIP, `claude CLI not on PATH \u2014 register the server yourself:\n    ${manual}`);
    return;
  }

  const existing = registeredClaudeMcpCommand();
  const norm = (t) => String(t || '').replace(/\\/g, '/').toLowerCase();
  if (existing && norm(existing).includes(norm(OPEN_BRAIN_SERVER))) {
    log(SKIP, 'Claude Code user-scope MCP already registered \u2014 skipped');
    return;
  }

  try {
    // A stale registration (different path) is replaced, not duplicated.
    if (existing) claudeCli(`mcp remove --scope user ${MCP_SERVER_KEY}`);
    claudeCli(`mcp add --scope user ${MCP_SERVER_KEY} -- node "${OPEN_BRAIN_SERVER}"`);
    log(OK, `Claude Code user-scope MCP registered (claude mcp add) \u2192 ~/.claude.json`);
  } catch (e) {
    log(FAIL, `claude mcp add failed: ${e.message.split('\n')[0]}\n    run it yourself: ${manual}`);
    hadFailure = true;
  }
}

function registerHooks() {
  const settingsPath = CLAUDE_SETTINGS;
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
  const destDir = CLAUDE_COMMANDS_DIR;
  ensureDir(destDir);

  const repoCommandsDir = TEMPLATE_CLAUDE_COMMANDS;

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
  const mcpJsonPath = CURSOR_MCP_JSON;
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
  const hooksPath = CURSOR_HOOKS_JSON;
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
  const destDir = CURSOR_COMMANDS_DIR;
  const repoCommandsDir = TEMPLATE_CURSOR_COMMANDS;

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

// The scaffold is defined once so that --uninstall --purge can recognise an
// untouched vault by the same definition setup created it from.
function vaultScaffold(vaultRoot) {
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
  return { dirs, templateFiles };
}

function setupObsidianVault() {
  // Mirrors obsidianVaultDir() in open-brain/src/shared/paths.ts. This was
  // hardcoded to the abandoned v1 vault, so a v2 install never got a seeded
  // SKILL-INDEX.md — and skill-scan silently treats a missing index as
  // "no skills exist yet", re-proposing every distilled skill forever.
  const vaultRoot = process.env.OPEN_BRAIN_VAULT_DIR || path.join(HOME, 'Obsidian Vault v2');
  const { dirs, templateFiles } = vaultScaffold(vaultRoot);

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

// ---- Uninstall -----------------------------------------------------------

function readJsonOrNull(p) {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (e) {
    log(FAIL, `${p} is not valid JSON \u2014 left untouched (${e.message})`);
    hadFailure = true;
    return undefined;
  }
}

function isEmptyObject(o) {
  return o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === 0;
}

/**
 * Write `obj` back to `p`, or delete `p` when nothing but our own scaffolding
 * remains. A file setup created from scratch (`{ mcpServers: {} }`,
 * `{ version: 1, hooks: {} }`) has no reason to outlive the install; a file the
 * user already had keeps every key we did not write.
 */
function writeBackOrRemove(p, obj, isHusk, dryRun) {
  if (isHusk(obj)) {
    if (!dryRun) fs.rmSync(p);
    log(OK, `${dryRun ? 'Would remove' : 'Removed'} ${p} (nothing left but the scaffold setup created)`);
  } else {
    if (!dryRun) fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
    log(OK, `${dryRun ? 'Would update' : 'Updated'} ${p}`);
  }
}

function hookIsOurs(cmd) {
  const c = String(cmd || '').replace(/\\/g, '/').toLowerCase();
  return HOOK_SCRIPT_MARKERS.some((m) => c.includes(m));
}

function uninstallClaudeHooks(dryRun) {
  const settings = readJsonOrNull(CLAUDE_SETTINGS);
  if (!settings) { log(SKIP, `${CLAUDE_SETTINGS} \u2014 nothing to remove`); return; }
  if (!settings.hooks) { log(SKIP, 'Claude Code hooks \u2014 none registered'); return; }

  let removed = 0;
  for (const event of Object.keys(settings.hooks)) {
    const entries = settings.hooks[event];
    if (!Array.isArray(entries)) continue;
    const kept = entries.filter((entry) => !(entry.hooks || []).some((h) => hookIsOurs(h.command)));
    removed += entries.length - kept.length;
    if (kept.length === 0) delete settings.hooks[event];
    else settings.hooks[event] = kept;
  }
  if (isEmptyObject(settings.hooks)) delete settings.hooks;

  if (removed === 0) { log(SKIP, 'Claude Code hooks \u2014 none of ours found'); return; }
  if (!dryRun) fs.writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2) + '\n');
  log(OK, `${dryRun ? 'Would remove' : 'Removed'} ${removed} hook entr${removed === 1 ? 'y' : 'ies'} from ${CLAUDE_SETTINGS}`);
}

function uninstallMcpEntry(p, label, dryRun) {
  const config = readJsonOrNull(p);
  if (!config) { log(SKIP, `${label} MCP \u2014 ${p} absent`); return; }
  if (!config.mcpServers?.[MCP_SERVER_KEY]) { log(SKIP, `${label} MCP \u2014 no ${MCP_SERVER_KEY} entry`); return; }

  delete config.mcpServers[MCP_SERVER_KEY];
  // Only a file that holds nothing but an empty mcpServers map is a husk;
  // any other key means the user had this file before us.
  const husk = (o) => Object.keys(o).length === 1 && isEmptyObject(o.mcpServers);
  writeBackOrRemove(p, config, husk, dryRun);
}

function uninstallClaudeUserMcp(dryRun) {
  if (!hasClaudeCli()) { log(SKIP, 'Claude Code user-scope MCP \u2014 claude CLI not on PATH; if registered, run: claude mcp remove --scope user open-brain'); return; }
  const existing = registeredClaudeMcpCommand();
  if (!existing) { log(SKIP, 'Claude Code user-scope MCP \u2014 not registered'); return; }
  // Only remove a registration that points at THIS checkout. A user who
  // registered open-brain from a different clone did not do it through us.
  const norm = (t) => String(t || '').replace(/\\/g, '/').toLowerCase();
  if (!norm(existing).includes(norm(OPEN_BRAIN_SERVER))) {
    log(SKIP, `Claude Code user-scope MCP \u2014 registered from a different path, left alone:\n    ${existing.trim().split('\n').find((l) => l.includes('node')) || ''}`);
    return;
  }
  if (!dryRun) {
    try { claudeCli(`mcp remove --scope user ${MCP_SERVER_KEY}`); }
    catch (e) { log(FAIL, `claude mcp remove failed: ${e.message.split('\n')[0]}`); hadFailure = true; return; }
  }
  log(OK, `${dryRun ? 'Would remove' : 'Removed'} Claude Code user-scope MCP registration (claude mcp remove)`);
}

function uninstallCursorHooks(dryRun) {
  const config = readJsonOrNull(CURSOR_HOOKS_JSON);
  if (!config) { log(SKIP, `Cursor hooks \u2014 ${CURSOR_HOOKS_JSON} absent`); return; }

  let removed = 0;
  for (const event of Object.keys(config.hooks || {})) {
    const entries = config.hooks[event];
    if (!Array.isArray(entries)) continue;
    const kept = entries.filter((entry) => !hookIsOurs(entry.command));
    removed += entries.length - kept.length;
    if (kept.length === 0) delete config.hooks[event];
    else config.hooks[event] = kept;
  }
  if (removed === 0) { log(SKIP, 'Cursor hooks \u2014 none of ours found'); return; }

  // setup wrote exactly { version: 1, hooks: {} } when creating this file.
  const husk = (o) => isEmptyObject(o.hooks) && Object.keys(o).every((k) => k === 'version' || k === 'hooks');
  writeBackOrRemove(CURSOR_HOOKS_JSON, config, husk, dryRun);
}

/**
 * Remove the slash commands setup installed. A file is removed when it is
 * byte-identical to what setup would render today (template + stored
 * identity); one the user has edited since is kept and named, unless --force.
 * Without a build the rendered form cannot be reconstructed, so every file is
 * treated as edited \u2014 build first, or pass --force.
 */
async function uninstallCommands(templateDir, destDir, label, identity, dryRun) {
  if (!fs.existsSync(destDir)) { log(SKIP, `${label} commands \u2014 ${destDir} absent`); return; }
  if (!fs.existsSync(templateDir)) { log(SKIP, `${label} commands \u2014 template dir missing, cannot tell which files are ours`); return; }

  const lib = await loadIdentityLib();
  if (!lib && !ARGS.force) {
    log(FAIL, `${label} commands \u2014 open-brain not built, cannot verify files are unmodified; run \`npm --prefix open-brain run build\` or pass --force`);
    hadFailure = true;
    return;
  }

  let removed = 0;
  const kept = [];
  for (const file of fs.readdirSync(templateDir)) {
    if (!file.endsWith('.md')) continue;
    const dest = path.join(destDir, file);
    if (!fs.existsSync(dest)) continue;

    let ours = ARGS.force;
    if (!ours && lib) {
      const raw = fs.readFileSync(path.join(templateDir, file), 'utf-8');
      const expected = identity ? lib.renderIdentity(raw, identity) : raw;
      const actual = fs.readFileSync(dest, 'utf-8');
      // Same tolerance as the /sync parity check: CRLF and trailing whitespace are not edits.
      const norm = (t) => t.replace(/\r\n/g, '\n').replace(/\s+$/, '');
      ours = norm(actual) === norm(expected) || norm(actual) === norm(raw);
    }

    if (ours) {
      if (!dryRun) fs.rmSync(dest);
      removed++;
    } else {
      kept.push(file);
    }
  }

  if (removed > 0) log(OK, `${dryRun ? 'Would remove' : 'Removed'} ${removed} ${label} slash command(s) from ${destDir}`);
  else log(SKIP, `${label} commands \u2014 none of ours found`);
  if (kept.length > 0) log(SKIP, `Kept ${kept.length} edited ${label} command(s) (pass --force to remove): ${kept.join(', ')}`);

  if (!dryRun && fs.existsSync(destDir) && fs.readdirSync(destDir).length === 0) {
    fs.rmdirSync(destDir);
    log(OK, `Removed empty ${destDir}`);
  }
}

function uninstallIdentity(dryRun) {
  const p = process.env.OPEN_BRAIN_IDENTITY || path.join(CLAUDE_STATE_DIR, 'identity.json');
  if (!fs.existsSync(p)) { log(SKIP, 'Identity \u2014 not configured'); return; }
  if (!dryRun) fs.rmSync(p);
  log(OK, `${dryRun ? 'Would remove' : 'Removed'} ${p}`);
  // The state dir is created for identity.json; if that was all it ever held,
  // do not leave an empty folder behind. A dir with a DB in it is data, kept.
  if (!dryRun && fs.existsSync(CLAUDE_STATE_DIR) && fs.readdirSync(CLAUDE_STATE_DIR).length === 0) {
    fs.rmdirSync(CLAUDE_STATE_DIR);
  }
}

/**
 * Data is opt-in to delete. The knowledge DB and the vault are the whole point
 * of the tool; an uninstall that silently took them with it would be the one
 * irreversible step in an otherwise reversible script.
 */
function uninstallData(dryRun) {
  const vaultRoot = process.env.OPEN_BRAIN_VAULT_DIR || path.join(HOME, 'Obsidian Vault v2');

  if (!ARGS.purge) {
    const left = [CLAUDE_STATE_DIR, vaultRoot].filter((p) => fs.existsSync(p));
    if (left.length > 0) log(SKIP, `Kept your data (pass --purge to delete the state dir): ${left.join(', ')}`);
    return;
  }

  if (fs.existsSync(CLAUDE_STATE_DIR)) {
    if (!dryRun) fs.rmSync(CLAUDE_STATE_DIR, { recursive: true, force: true });
    log(OK, `${dryRun ? 'Would remove' : 'Removed'} ${CLAUDE_STATE_DIR} (knowledge DB, logs, identity)`);
  }

  // The vault is removed only while it is still exactly the scaffold setup
  // created: the six folders empty and the two seed files unchanged. One note
  // written by the user or by a session, and it stays.
  if (fs.existsSync(vaultRoot)) {
    if (vaultIsPristineScaffold(vaultRoot)) {
      if (!dryRun) fs.rmSync(vaultRoot, { recursive: true, force: true });
      log(OK, `${dryRun ? 'Would remove' : 'Removed'} ${vaultRoot} (still the empty scaffold)`);
    } else {
      log(SKIP, `Kept ${vaultRoot} \u2014 it holds notes; delete it by hand if you want them gone`);
    }
  }
}

function vaultIsPristineScaffold(vaultRoot) {
  const { dirs, templateFiles } = vaultScaffold(vaultRoot);
  const expectedFiles = new Set(Object.keys(templateFiles));
  const walk = (dir) => {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.name === '.DS_Store') continue;
      if (entry.isDirectory()) out.push({ full, dir: true }, ...walk(full));
      else out.push({ full, dir: false });
    }
    return out;
  };
  for (const { full, dir } of walk(vaultRoot)) {
    if (dir) {
      if (!dirs.includes(path.basename(full)) || path.dirname(full) !== vaultRoot) return false;
    } else {
      if (!expectedFiles.has(full)) return false;
      if (fs.readFileSync(full, 'utf-8') !== templateFiles[full]) return false;
    }
  }
  return true;
}

async function uninstall() {
  const dryRun = ARGS.dryRun;
  console.log(`\nSelf-Improving Agent Uninstall${dryRun ? ' (dry run \u2014 nothing will be changed)' : ''}\n`);

  // Identity is read before it is removed: the command comparison needs it.
  const lib = await loadIdentityLib();
  const identity = lib ? lib.loadIdentity(HOME) : null;

  uninstallClaudeHooks(dryRun);
  uninstallMcpEntry(CLAUDE_MCP_JSON, 'Claude Code', dryRun);
  uninstallClaudeUserMcp(dryRun);
  await uninstallCommands(TEMPLATE_CLAUDE_COMMANDS, CLAUDE_COMMANDS_DIR, 'Claude Code', identity, dryRun);
  uninstallMcpEntry(CURSOR_MCP_JSON, 'Cursor', dryRun);
  uninstallCursorHooks(dryRun);
  await uninstallCommands(TEMPLATE_CURSOR_COMMANDS, CURSOR_COMMANDS_DIR, 'Cursor', identity, dryRun);
  uninstallIdentity(dryRun);
  uninstallData(dryRun);

  console.log('');
  if (hadFailure) {
    console.log('Uninstall completed with errors. Review the output above.');
    process.exit(1);
  }
  console.log(dryRun
    ? 'Dry run complete. Re-run without --dry-run to apply.'
    : 'Uninstall complete. Restart Claude Code and Cursor. The repo itself was not touched.');
}

async function main() {
  if (ARGS.uninstall) return uninstall();
  console.log('\nSelf-Improving Agent Setup\n');

  checkPrerequisites();
  buildOpenBrain();
  const identity = await configureIdentity();
  registerMcpServer();
  registerClaudeUserMcp();
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
