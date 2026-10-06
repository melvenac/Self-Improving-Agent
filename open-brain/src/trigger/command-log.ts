import { basename } from "node:path";

/** Stored `trigger_fires.command` values are exactly this or `"?"`. */
export const CANONICAL_COMMAND_FIRE_RE = /^(?:\?|[a-z][a-z0-9._-]{0,24})$/;

/** r4 census shape — rewritten to program-only on open. */
const R4_COMMAND_FIRE_RE =
  /^(?:\?|[A-Za-z0-9._-]{1,40})(?: [a-z][a-z0-9-]{0,30})? #[0-9a-f]{12}$/;

const PROGRAM_RE = /^[a-z][a-z0-9._-]{0,24}$/;

function firstTokens(command: string): string[] {
  return command.trim().split(/[\s\u00a0]+/).filter(Boolean);
}

export function isCanonicalCommandFireLog(stored: string): boolean {
  return CANONICAL_COMMAND_FIRE_RE.test(stored);
}

/**
 * Census-safe `trigger_fires.command` — lowercase program basename only.
 * No subcommand, hash, or other text from the original command is stored.
 */
export function formatCommandFireLog(command: string): string {
  const tokens = firstTokens(command);
  const programRaw = tokens[0] ? basename(tokens[0].replace(/\\/g, "/")) : "";
  return PROGRAM_RE.test(programRaw) ? programRaw : "?";
}

/**
 * One-shot rewrite for legacy raw or r4 hash rows. Idempotent once canonical.
 */
export function migrateStoredCommandFireLog(stored: string): string {
  if (isCanonicalCommandFireLog(stored)) return stored;
  if (R4_COMMAND_FIRE_RE.test(stored)) {
    const programToken = stored.split(/[\s\u00a0]+/)[0] ?? "";
    return formatCommandFireLog(programToken);
  }
  return formatCommandFireLog(stored);
}
