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
import path from 'node:path';

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
