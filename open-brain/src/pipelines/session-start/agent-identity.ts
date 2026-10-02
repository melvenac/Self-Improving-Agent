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

/* ------------------------------------------------------------------------- *
 * T-211 — the standing status cron lives in seat data
 *
 * A cadence held only in handoff text is lost at the first roll that does not
 * copy it. The three optional keys below sit in the seat's own frontmatter, so
 * `ob_start` can print them every start:
 *
 *   status_cron: a 5-field cron, local time
 *   status_to:   the agent name to report to
 *   status_rule: a repo-relative path to the rule text
 *
 * `.agents/AGENT.local.md` is read first. A file that carries ANY of the three
 * keys is the whole answer: its values are used and the other file is not
 * consulted, so a local override never mixes with a tracked default. A file
 * that carries some but not all, or a cron that is not a cron, is reported as
 * INVALID, never dropped.
 * ------------------------------------------------------------------------- */

const CRON_FIELDS: readonly { name: string; min: number; max: number; names?: readonly string[] }[] = [
  { name: "minute", min: 0, max: 59 },
  { name: "hour", min: 0, max: 23 },
  { name: "day-of-month", min: 1, max: 31 },
  { name: "month", min: 1, max: 12, names: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] },
  { name: "day-of-week", min: 0, max: 7, names: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] },
];

/** Why a cron expression is not one, or null when it is valid. */
export function cronProblem(cron: string): string | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return `status_cron has ${cron.trim() === "" ? 0 : parts.length} fields, expected 5`;
  for (const [i, field] of parts.entries()) {
    const spec = CRON_FIELDS[i]!;
    for (const item of field.split(",")) {
      const m = item.match(/^(\*|([A-Za-z0-9]+)(?:-([A-Za-z0-9]+))?)(?:\/(\d+))?$/);
      if (m === null) return `status_cron ${spec.name} field "${field}" is not a valid cron expression`;
      if (m[4] !== undefined && Number(m[4]) < 1) return `status_cron ${spec.name} field "${field}" has a step of 0`;
      for (const bound of [m[2], m[3]]) {
        if (bound === undefined) continue;
        const named = spec.names?.indexOf(bound.toUpperCase()) ?? -1;
        const value = named >= 0 ? named + (spec.name === "month" ? 1 : 0) : /^\d+$/.test(bound) ? Number(bound) : Number.NaN;
        if (Number.isNaN(value)) return `status_cron ${spec.name} field "${field}" is not a valid cron expression`;
        if (value < spec.min || value > spec.max) {
          return `status_cron ${spec.name} field "${field}" is out of range ${spec.min}-${spec.max}`;
        }
      }
    }
  }
  return null;
}

type StatusKeys = { status_cron?: string; status_to?: string; status_rule?: string };

/**
 * T-224: a value with an unfilled `<placeholder>` in it (the template's `<agent-name>`, or the `<role>` inside
 * `.agents/roles/<role>.md`). It counts as UNSET, as before, but the reader is told which placeholder it was
 * instead of "missing".
 */
const PLACEHOLDER = /<[^<>\s]+>/;

type Keys = StatusKeys;
type Placeholders = Partial<Record<keyof StatusKeys, string>>;

function readStatusKeys(path: string): { keys: Keys; placeholders: Placeholders } | null {
  if (!existsSync(path)) return null;
  const match = readFileSync(path, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const out: StatusKeys = {};
  const placeholders: Placeholders = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const m = line.match(/^(status_cron|status_to|status_rule)\s*:\s*(.*)$/);
    if (!m) continue;
    let value = m[2]!.trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1).trim();
    }
    if (value === "") continue;
    const ph = PLACEHOLDER.exec(value);
    if (ph) { placeholders[m[1] as keyof StatusKeys] = ph[0]; continue; }
    out[m[1] as keyof StatusKeys] = value;
  }
  return Object.keys(out).length === 0 ? null : { keys: out, placeholders };
}

/**
 * The one `Standing cron:` line for the seat block. Read-only, deterministic, and never silent:
 * a present, an absent and a malformed answer each have their own line.
 */
export function readStandingCron(cwd: string): string {
  for (const file of ["AGENT.local.md", "AGENT.md"]) {
    const read = readStatusKeys(join(cwd, ".agents", file));
    if (read === null) continue;
    const { keys, placeholders } = read;
    const where = `.agents/${file}`;
    for (const key of ["status_cron", "status_to", "status_rule"] as const) {
      if (keys[key] === undefined) {
        const ph = placeholders[key];
        return `Standing cron: INVALID in ${where}: ${key} is ${ph ? `an unfilled placeholder (${ph})` : "missing"}`;
      }
    }
    const problem = cronProblem(keys.status_cron!);
    if (problem !== null) return `Standing cron: INVALID in ${where}: ${problem}`;
    return `Standing cron: ${keys.status_cron} → status to ${keys.status_to} (rule: ${keys.status_rule}). Create it with CronCreate before the briefing ends.`;
  }
  return "Standing cron: none in seat data.";
}
