/**
 * The Claude Code hook registrations setup.mjs writes into ~/.claude/settings.json.
 *
 * Pure: takes the parsed settings and returns new ones, so a test can run it
 * without a home directory. setup.mjs reads and writes the file.
 *
 * R179-5 (QA 125's D3): SessionEnd is registered here, beside SessionStart.
 * Before, only the README's manual block registered it, so T179-2's handoff
 * guard and end.md's "the SessionEnd hook writes the session summary" rested on
 * a step a machine set up the documented way never ran. And the old function
 * RETURNED as soon as SessionStart was already present, so a second hook added
 * after that check would never have reached any machine set up before it — each
 * event is now checked on its own.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const SESSION_HOOKS = [
  ['SessionStart', 'cli-bootstrap.js'],
  ['SessionEnd', 'cli-session-end.js'],
];

// Compare normalised, not literal. path.join yields backslashes on Windows
// while an earlier install may have written forward slashes; exact-string
// matching then misses the existing entry and appends a SECOND registration,
// so the hook fires twice. (This is exactly what a re-run of setup.mjs did on
// 2026-07-28 for SessionStart.)
const norm = (s) => String(s || '').replace(/\\/g, '/').toLowerCase();

/**
 * @returns {{ settings: object, changed: boolean, notes: string[] }}
 *
 * LIMIT, stated because it is the existing behaviour for SessionStart and now
 * holds for SessionEnd too: a registration of the same script from ANOTHER
 * checkout of this repository counts as a path-spelling duplicate and is
 * replaced by this checkout's. Run setup.mjs from the checkout the hooks should
 * serve (the main tree), not from a seat worktree.
 */
export function withSessionHooks(settings, openBrainDir) {
  const before = JSON.stringify(settings ?? {});
  const s = JSON.parse(before);
  if (!s.hooks) s.hooks = {};
  const notes = [];

  for (const [event, file] of SESSION_HOOKS) {
    const command = `node "${path.join(openBrainDir, 'build', file)}"`;
    if (!Array.isArray(s.hooks[event])) s.hooks[event] = [];
    if (s.hooks[event].some((e) => e.hooks?.some((h) => norm(h.command) === norm(command)))) {
      notes.push(`${event} hook already registered (${file})`);
      continue;
    }
    let replaced = 0;
    s.hooks[event] = s.hooks[event].filter((e) => {
      const ours = (e.hooks || []).some((h) => norm(h.command).includes(file));
      if (ours) replaced++;
      return !ours;
    });
    if (replaced > 0) notes.push(`Replaced ${replaced} ${file} ${event} registration(s) differing by path`);
    s.hooks[event].push({ matcher: '', hooks: [{ type: 'command', command }] });
    notes.push(`${event} hook registered (${file})`);
  }

  // Stale registrations from retired pipelines.
  const drop = (event, needle, label) => {
    if (!Array.isArray(s.hooks[event])) return;
    const n = s.hooks[event].length;
    s.hooks[event] = s.hooks[event].filter((e) => !(e.hooks?.map((h) => h.command) || []).some((c) => String(c).includes(needle)));
    if (n > s.hooks[event].length) notes.push(`Removed ${n - s.hooks[event].length} stale ${label} hook(s)`);
  };
  drop('SessionStart', 'session-bootstrap.mjs', 'session-bootstrap.mjs');
  drop('SessionEnd', 'knowledge-mcp', 'knowledge-mcp SessionEnd');

  return { settings: s, changed: JSON.stringify(s) !== before, notes };
}

const fwd = (s) => String(s).replace(/\\/g, '/');

/**
 * T-235 P2-1: Cursor's open-brain MCP entry, with the ABSOLUTE path of the Node that
 * ran setup as `command`. A bare `node` is resolved by whatever launches the server,
 * and under cursor-agent that was a different Node (better-sqlite3 NODE_MODULE_VERSION
 * 127 vs 137), so ob_* failed. An existing bare-`node` entry is upgraded.
 *
 * @returns {{ config: object, changed: boolean, notes: string[] }}
 */
export function withCursorMcp(config, serverPath, nodePath) {
  const before = JSON.stringify(config ?? {});
  const c = JSON.parse(before);
  if (!c.mcpServers) c.mcpServers = {};
  const existing = c.mcpServers['open-brain'];
  // OPEN_BRAIN_IDE scopes this session's slot in active-session.json (see setup.mjs).
  c.mcpServers['open-brain'] = {
    ...(existing || {}),
    command: nodePath,
    args: [serverPath],
    env: { ...(existing?.env || {}), OPEN_BRAIN_IDE: 'cursor' },
  };
  const changed = JSON.stringify(c) !== before;
  const notes = [changed
    ? (existing?.command === nodePath ? 'open-brain registered in ~/.cursor/mcp.json' : `open-brain registered in ~/.cursor/mcp.json (command ${nodePath})`)
    : 'Cursor open-brain MCP already registered'];
  return { config: c, changed, notes };
}

/**
 * T-235 P2-1: the Cursor sessionStart hook command, with the absolute Node path.
 * An earlier entry running the same bootstrap (untagged, or still on a bare `node`)
 * is REPLACED, not left alongside: two entries would fire the hook twice.
 *
 * @returns {{ config: object, changed: boolean, notes: string[] }}
 */
export function withCursorSessionHook(config, bootstrapPath, nodePath) {
  const before = JSON.stringify(config ?? { version: 1, hooks: {} });
  const c = JSON.parse(before);
  if (!c.hooks) c.hooks = {};
  if (!Array.isArray(c.hooks.sessionStart)) c.hooks.sessionStart = [];
  const command = `"${fwd(nodePath)}" "${fwd(bootstrapPath)}" --ide cursor`;
  const notes = [];

  const stale = c.hooks.sessionStart.filter((e) => e.command?.includes('cli-bootstrap.js') && e.command !== command);
  if (stale.length > 0) {
    c.hooks.sessionStart = c.hooks.sessionStart.filter((e) => !stale.includes(e));
    notes.push(`Upgraded ${stale.length} stale Cursor sessionStart hook entry(ies)`);
  }
  if (!c.hooks.sessionStart.some((e) => e.command === command)) {
    c.hooks.sessionStart.push({ command });
    notes.push('Cursor sessionStart hook registered in ~/.cursor/hooks.json');
  } else {
    notes.push('Cursor sessionStart hook already configured');
  }
  return { config: c, changed: JSON.stringify(c) !== before, notes };
}

/**
 * T-235 P2-4: the Cursor sessionEnd hook, with the absolute Node path (same shape as sessionStart).
 * A bare-node or path-spelling duplicate of cli-session-end.js is REPLACED, not left beside the new one.
 *
 * @returns {{ config: object, changed: boolean, notes: string[] }}
 */
export function withCursorSessionEndHook(config, sessionEndPath, nodePath) {
  const before = JSON.stringify(config ?? { version: 1, hooks: {} });
  const c = JSON.parse(before);
  if (!c.hooks) c.hooks = {};
  if (!Array.isArray(c.hooks.sessionEnd)) c.hooks.sessionEnd = [];
  const command = `"${fwd(nodePath)}" "${fwd(sessionEndPath)}"`;
  const notes = [];

  const stale = c.hooks.sessionEnd.filter((e) => e.command?.includes('cli-session-end.js') && e.command !== command);
  if (stale.length > 0) {
    c.hooks.sessionEnd = c.hooks.sessionEnd.filter((e) => !stale.includes(e));
    notes.push(`Upgraded ${stale.length} stale Cursor sessionEnd hook entry(ies)`);
  }
  if (!c.hooks.sessionEnd.some((e) => e.command === command)) {
    c.hooks.sessionEnd.push({ command });
    notes.push('Cursor sessionEnd hook registered in ~/.cursor/hooks.json');
  } else {
    notes.push('Cursor sessionEnd hook already configured');
  }
  return { config: c, changed: JSON.stringify(c) !== before, notes };
}

/**
 * T-235 P2-5: register cli-recall-trigger on Cursor postToolUse (absolute Node path).
 *
 * @returns {{ config: object, changed: boolean, notes: string[] }}
 */
export function withCursorRecallHook(config, triggerPath, nodePath) {
  const before = JSON.stringify(config ?? { version: 1, hooks: {} });
  const c = JSON.parse(before);
  if (!c.hooks) c.hooks = {};
  if (!Array.isArray(c.hooks.postToolUse)) c.hooks.postToolUse = [];
  const command = `"${fwd(nodePath)}" "${fwd(triggerPath)}"`;
  const notes = [];

  const stale = c.hooks.postToolUse.filter((e) => e.command?.includes("cli-recall-trigger") && e.command !== command);
  if (stale.length > 0) {
    c.hooks.postToolUse = c.hooks.postToolUse.filter((e) => !stale.includes(e));
    notes.push(`Upgraded ${stale.length} stale Cursor postToolUse recall hook entry(ies)`);
  }
  if (!c.hooks.postToolUse.some((e) => e.command === command)) {
    c.hooks.postToolUse.push({ command });
    notes.push("Cursor postToolUse recall hook registered in ~/.cursor/hooks.json");
  } else {
    notes.push("Cursor postToolUse recall hook already configured");
  }
  return { config: c, changed: JSON.stringify(c) !== before, notes };
}

/**
 * The repo root for a script at `<root>/scripts/<file>`, from its import.meta.url.
 * T-235 Phase 0: a URL's pathname keeps percent-encoding, so a home directory with a
 * space (the QA PC's "Aaron Melven") became "Aaron%20Melven", open-brain/ was "not
 * found", and setup.mjs refused to run.
 */
export function repoRootFrom(metaUrl) {
  return path.resolve(path.dirname(fileURLToPath(metaUrl)), '..');
}

function fileHash(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function filesIdentical(a, b) {
  if (!fs.existsSync(a) || !fs.existsSync(b)) return false;
  return fileHash(a) === fileHash(b);
}

/**
 * Copy every `.md` from `project-template/.cursor/commands/` into `~/.cursor/commands/`.
 * A destination that already exists and differs from the template is moved aside first
 * (`<name>.md.user-<UTC timestamp>`), never silently overwritten. Identical files are a no-op.
 */
export function copyCursorSlashCommands(repoRoot, cursorDir) {
  const repoCommandsDir = path.join(repoRoot, 'project-template', '.cursor', 'commands');
  const destDir = path.join(cursorDir, 'commands');
  if (!fs.existsSync(repoCommandsDir)) {
    return { copied: 0, missingTemplate: true, movedAside: [] };
  }
  fs.mkdirSync(destDir, { recursive: true });
  let copied = 0;
  const movedAside = [];
  const utcStamp = () => new Date().toISOString().replace(/:/g, '');
  for (const file of fs.readdirSync(repoCommandsDir)) {
    if (!file.endsWith('.md')) continue;
    const src = path.join(repoCommandsDir, file);
    const dest = path.join(destDir, file);
    if (filesIdentical(src, dest)) continue;
    if (fs.existsSync(dest)) {
      const aside = path.join(destDir, `${file}.user-${utcStamp()}`);
      fs.renameSync(dest, aside);
      movedAside.push({ from: dest, to: aside });
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    copied += 1;
  }
  return { copied, missingTemplate: false, movedAside };
}
