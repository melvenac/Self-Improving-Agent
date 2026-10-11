/** Env names a host harness (Claude Code, Cursor) sets that src reads. CI has none of them. */
export const HOST_ENV_PATTERN = /^(CLAUDE_|CLAUDECODE$|CURSOR_)/;

/** Delete every host-harness variable from `env` in place; return the names removed, sorted. */
export function scrubHostEnv(env: NodeJS.ProcessEnv): string[] {
  const removed = Object.keys(env).filter((k) => HOST_ENV_PATTERN.test(k)).sort();
  for (const k of removed) delete env[k];
  return removed;
}
