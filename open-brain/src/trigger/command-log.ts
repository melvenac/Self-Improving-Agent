import { createHash } from "node:crypto";
import { basename } from "node:path";

const PROGRAM_RE = /^[A-Za-z0-9._-]{1,40}$/;
const SUBCOMMAND_RE = /^[a-z][a-z0-9-]{0,30}$/;

function hash12(full: string): string {
  return createHash("sha256").update(full, "utf8").digest("hex").slice(0, 12);
}

function firstTokens(command: string): string[] {
  return command.trim().split(/\s+/).filter(Boolean);
}

/**
 * Census-safe `trigger_fires.command` — program, optional subcommand, and a stable
 * hash. No secret-bearing text from the original command is stored.
 */
export function formatCommandFireLog(command: string): string {
  const full = command.trim();
  const tokens = firstTokens(full);
  const programRaw = tokens[0] ? basename(tokens[0].replace(/\\/g, "/")) : "";
  const program = PROGRAM_RE.test(programRaw) ? programRaw : "?";
  const sub = tokens.length >= 2 && SUBCOMMAND_RE.test(tokens[1]) ? ` ${tokens[1]}` : "";
  return `${program}${sub} #${hash12(full)}`;
}
