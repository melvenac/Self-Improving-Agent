import { basename } from "node:path";

/** Stored `trigger_fires.command` values are exactly this or `"?"`. */
export const CANONICAL_COMMAND_FIRE_RE = /^(?:\?|[a-z][a-z0-9._-]{0,24})$/;

const PROGRAM_RE = /^[a-z][a-z0-9._-]{0,24}$/;

function firstTokens(command: string): string[] {
  return command.trim().split(/[\s\u00a0]+/).filter(Boolean);
}

export function isCanonicalCommandFireLog(stored: string): boolean {
  return CANONICAL_COMMAND_FIRE_RE.test(stored);
}

/** SQLite may return NULL or a Buffer for a TEXT column; never throw on read. */
export function commandCellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return String(value);
}

/**
 * Census-safe `trigger_fires.command` — lowercase program basename only.
 * No subcommand, hash, or other text from the original command is stored.
 *
 * ACCEPTED LIMIT: a secret that is already a valid program token (lowercase,
 * length 1–25, `[a-z0-9._-]` only) is stored verbatim if it is token0's
 * basename — there is no way to distinguish it from a real binary name.
 */
export function formatCommandFireLog(command: string): string {
  const tokens = firstTokens(command);
  const programRaw = tokens[0] ? basename(tokens[0].replace(/\\/g, "/")) : "";
  return PROGRAM_RE.test(programRaw) ? programRaw : "?";
}
