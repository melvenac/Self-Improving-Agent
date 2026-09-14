/**
 * `.agents/state.json` — the project's state as a record, not a log.
 *
 * Loop 2 of the extraction evaluation (read side only). Aaron's Q4 decision:
 * FILES, JSON. The core must run on a fresh machine with Node and git; git is
 * the history, so this file must not accrete; the repo's rule is files are
 * truth and SQLite is a projection.
 *
 * Every object level is STRICT — an unknown key is an error. A typo in a
 * future writer must fail loudly here, not pass silently and be read back as
 * absence forever.
 *
 * Which fields are STATE and which are EVENT-shaped (ADR-017):
 *
 *   STATE  — replaced in place by a writer; the previous value is not kept:
 *     project, objective, tasks (a task row is updated in place; `status`
 *     moves, it does not append), handoff, last_session.
 *
 *   EVENT  — appended; an entry is never deleted, its `status` changes:
 *     verified (a claim is added when proven and flipped to "reopened" on
 *     regression, never removed), gaps (opened, later closed by a writer that
 *     Loop 3 defines), decisions (dated, immutable once written).
 *
 * `revision` is the optimistic-concurrency counter for future writers:
 * read-modify-write, refuse on mismatch. Nothing writes it in this loop.
 *
 * `serializeState` is a pure function, not a file writer. It produces one
 * canonical byte sequence for a given value — schema key order, 2-space
 * indent, trailing newline — so that two writers agreeing on the data agree
 * on the bytes, and so tests can compare output with `toBe`.
 */
import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const nonNegInt = z.number().int().min(0);
const sessionNumber = nonNegInt;

export const TaskPriority = z.enum(["P0", "P1", "P2", "P3"]);
export const TaskStatus = z.enum(["open", "in_progress", "blocked", "done"]);
export const VerifiedStatus = z.enum(["verified", "reopened"]);

export const ProjectSchema = z.strictObject({
  name: z.string(),
  version: z.string(),
});

export const ObjectiveSchema = z.strictObject({
  text: z.string(),
  since_session: sessionNumber,
});

export const TaskSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  priority: TaskPriority,
  status: TaskStatus,
  opened_session: sessionNumber,
  closed_session: sessionNumber.nullable(),
  supersedes: z.string().nullable(),
  note: z.string(),
});

export const EvidenceSchema = z.strictObject({
  type: z.string(),
  path: z.string(),
  observation: z.string(),
});

export const VerifiedSchema = z.strictObject({
  id: z.string(),
  claim: z.string(),
  evidence: z.array(EvidenceSchema),
  since_session: sessionNumber,
  status: VerifiedStatus,
});

export const GapSchema = z.strictObject({
  id: z.string(),
  what: z.string(),
  evidence: z.string(),
  recommended_update: z.string(),
  opened_session: sessionNumber,
});

export const DecisionSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  date: z.string().regex(ISO_DATE, "expected YYYY-MM-DD"),
  note: z.string(),
});

export const HandoffSchema = z.strictObject({
  pick_up: z.string(),
  watch_out: z.array(z.string()),
  open_questions: z.array(z.string()),
  session: sessionNumber,
});

export const LastSessionSchema = z.strictObject({
  n: sessionNumber,
  date: z.string().regex(ISO_DATE, "expected YYYY-MM-DD"),
  uuid: z.string().nullable(),
});

export const StateSchema = z.strictObject({
  schema_version: z.literal(1),
  revision: nonNegInt,
  project: ProjectSchema,
  objective: ObjectiveSchema.nullable(),
  tasks: z.array(TaskSchema),
  verified: z.array(VerifiedSchema),
  gaps: z.array(GapSchema),
  decisions: z.array(DecisionSchema),
  handoff: HandoffSchema,
  last_session: LastSessionSchema,
});

export type State = z.infer<typeof StateSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Verified = z.infer<typeof VerifiedSchema>;
export type Gap = z.infer<typeof GapSchema>;
export type Decision = z.infer<typeof DecisionSchema>;

export const SCHEMA_VERSION = 1 as const;

export type ParseResult = { ok: true; data: State } | { ok: false; error: string };

/**
 * Parses JSON text into a validated State. The error string names the zod
 * path (dot-joined, `$` for the root) and the message, first issue only, so a
 * reader can say exactly where the file is wrong.
 */
export function parseState(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: `$: not valid JSON — ${err instanceof Error ? err.message : String(err)}` };
  }
  const result = StateSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  const issue = result.error.issues[0];
  const path = issue.path.length === 0 ? "$" : issue.path.map(String).join(".");
  return { ok: false, error: `${path}: ${issue.message}` };
}

/**
 * Canonical serialization: keys in schema order at every level (input key
 * order is irrelevant), 2-space indent, trailing newline. Pure — returns the
 * string, writes nothing.
 */
export function serializeState(data: State): string {
  return JSON.stringify(canonicalize(data), null, 2) + "\n";
}

const KEY_ORDER: Record<string, string[]> = {
  $: ["schema_version", "revision", "project", "objective", "tasks", "verified", "gaps", "decisions", "handoff", "last_session"],
  project: ["name", "version"],
  objective: ["text", "since_session"],
  tasks: ["id", "title", "priority", "status", "opened_session", "closed_session", "supersedes", "note"],
  verified: ["id", "claim", "evidence", "since_session", "status"],
  evidence: ["type", "path", "observation"],
  gaps: ["id", "what", "evidence", "recommended_update", "opened_session"],
  decisions: ["id", "title", "date", "note"],
  handoff: ["pick_up", "watch_out", "open_questions", "session"],
  last_session: ["n", "date", "uuid"],
};

function canonicalize(value: unknown, slot = "$"): unknown {
  if (Array.isArray(value)) return value.map((v) => canonicalize(v, slot));
  if (value === null || typeof value !== "object") return value;
  const order = KEY_ORDER[slot];
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const keys = order ? order.filter((k) => k in obj) : Object.keys(obj).sort();
  for (const k of keys) out[k] = canonicalize(obj[k], k);
  return out;
}
