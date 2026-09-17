import { existsSync, readFileSync } from "fs";
import { join } from "path";

export interface AgentIdentity {
  name: string;
  role: string;
  partner: string | null;
}

/**
 * Seat identity, resolved per CHECKOUT rather than per repository.
 *
 * `.agents/AGENT.md` is tracked, so every worktree of a repo shares one
 * declaration. On 2026-09-17 that meant three worktrees and a single
 * `name: Forge`, and `/start` greeted whoever started in any of them as Forge —
 * including the Planner seat, which is Atlas. **A tracked file cannot say who is
 * sitting in a particular checkout, because the checkout is not the thing git
 * versions.**
 *
 * `.agents/AGENT.local.md` is gitignored by the existing `/.agents/*` rule and is
 * therefore per-worktree. When it yields a usable identity it wins outright;
 * otherwise the tracked file answers exactly as before, so a repo with one seat
 * needs no local file and behaves identically.
 *
 * The override is a FILE rather than an environment variable so that the answer
 * is visible by looking at the checkout, instead of by reconstructing how a
 * process was launched.
 *
 * Its limit, stated rather than discovered: this resolves who a seat SAYS it is.
 * Nothing verifies the claim, and two checkouts may name themselves identically.
 */
export function readAgentIdentity(cwd: string): AgentIdentity | null {
  return (
    parseDeclaration(join(cwd, ".agents", "AGENT.local.md")) ??
    parseDeclaration(join(cwd, ".agents", "AGENT.md"))
  );
}

function parseDeclaration(path: string): AgentIdentity | null {
  if (!existsSync(path)) return null;

  const raw = readFileSync(path, "utf8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const value = m[2].trim();
    if (!value || value.startsWith("<")) continue;
    fields[m[1]] = value;
  }

  if (!fields.name || !fields.role) return null;

  return {
    name: fields.name,
    role: fields.role,
    partner: fields.partner || null,
  };
}
