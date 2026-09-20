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

/**
 * Loop 8 R3 / ADR-027: `version` removed. It was a cache of package.json's
 * version with seven consumers and no authority — `state-writer.ts` already
 * preferred package.json, and two sync checks plus a drift branch existed only
 * to police the copy against its source. The record does not store what the
 * manifest already states.
 *
 * This is a strictObject, so a state.json still carrying `project.version`
 * fails to parse outright rather than being tolerated. That is deliberate and
 * pinned by test: there is no migration runner for this file, so every copy —
 * the live record, the test fixture and the shipped template — had to move in
 * the same commit, and a hard failure is what guarantees none was missed.
 */
export const ProjectSchema = z.strictObject({
  name: z.string(),
});

export const ObjectiveSchema = z.strictObject({
  text: z.string(),
  since_session: sessionNumber,
});

/**
 * Loop 4 R2: `closed_session` is the session a task was closed in, so it is
 * non-null exactly when `status` is "done". A done task with no closed
 * session would be invisible to retention forever; an open task with one
 * would claim a close that never happened. Both directions refuse.
 */
export const TaskSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  priority: TaskPriority,
  status: TaskStatus,
  opened_session: sessionNumber,
  closed_session: sessionNumber.nullable(),
  supersedes: z.string().nullable(),
  note: z.string(),
}).refine((t) => (t.status === "done") === (t.closed_session !== null), {
  message: 'closed_session must be set when status is "done" and null otherwise',
  path: ["closed_session"],
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

/**
 * The closed set of seats. Matches the harness's `RoleName`
 * (`harness/roles.ts`) — a handoff belongs to a seat that can actually run a
 * stage, and a typo must refuse rather than create a fourth seat nobody reads.
 */
export const SeatName = z.enum(["planner", "developer", "qa"]);
export type Seat = z.infer<typeof SeatName>;

export const QaStatus = z.enum(["not_started", "in_progress", "accepted", "rejected", "not_required"]);

export const OpenPrSchema = z.strictObject({
  ref: z.string().min(1),
  qa_status: QaStatus,
  note: z.string(),
});

/**
 * The rows C3 names: what the planner loses at every roll and the runtime does
 * not carry. `D_t`, `E_t` and `G_*` say what a loop decided, built, judged and
 * gated; none of them is an iteration's output, so all four travelled by A2A and
 * by the planner remembering.
 *
 * **Required, and may be empty.** `[]` and `null` are legitimate answers —
 * "no open PRs" is a real state of the world. ABSENCE is not: a field the seat
 * must answer is run rather than remembered, while an optional one is
 * remembered, which is the failure C3 describes. Empty and absent must not look
 * alike.
 */
export const LoopStateSchema = z.strictObject({
  open_prs: z.array(OpenPrSchema),
  frozen_sha: z.string().nullable(),
  questions_for_aaron: z.array(z.string()),
  rulings: z.array(z.string()),
});

/**
 * One seat's handoff.
 *
 * `seat` exists because a single project-wide slot is a structural defect under
 * the roll rule (`G-046`): when two seats close out in sequence, the second
 * overwrites the first, and a fresh session's greeting reads only the last
 * seat's pick-up. That has already sent a seat to a file that no longer held
 * what it was said to hold.
 *
 * `loop_state` is required for the planner and optional for everyone else — the
 * rows are the planner's to answer, and a developer or QA seat that happens to
 * know the frozen SHA may still record it.
 */
export const HandoffSchema = z.strictObject({
  seat: SeatName,
  pick_up: z.string(),
  watch_out: z.array(z.string()),
  open_questions: z.array(z.string()),
  session: sessionNumber,
  loop_state: LoopStateSchema.nullable(),
}).refine((h) => h.seat !== "planner" || h.loop_state !== null, {
  message: "a planner handoff must carry loop_state (its fields may be empty, but not absent)",
  path: ["loop_state"],
});

export const LastSessionSchema = z.strictObject({
  n: sessionNumber,
  date: z.string().regex(ISO_DATE, "expected YYYY-MM-DD"),
  uuid: z.string().nullable(),
  /** Which seat closed it. Null only for records written before seats existed. */
  seat: SeatName.nullable(),
});

export const StateSchema = z.strictObject({
  /**
   * 2 as of Loop 14: `handoff` became `handoffs`, an array keyed by seat.
   *
   * A `z.literal`, so a v1 file fails to parse OUTRIGHT rather than being
   * tolerated and read back as absence. There is no migration runner for this
   * file, which is exactly why a hard failure is the right behaviour: every copy
   * — the live record, the shipped template and the test fixture — must move in
   * the same commit, and a loud refusal is what guarantees none was missed. The
   * same argument ADR-027 used when `project.version` was removed.
   */
  schema_version: z.literal(2),
  revision: nonNegInt,
  project: ProjectSchema,
  objective: ObjectiveSchema.nullable(),
  tasks: z.array(TaskSchema),
  verified: z.array(VerifiedSchema),
  gaps: z.array(GapSchema),
  decisions: z.array(DecisionSchema),
  /** At most one per seat; see SeatName. Order is not significant. */
  handoffs: z.array(HandoffSchema),
  last_session: LastSessionSchema,
}).refine(
  (s) => {
    const seats = s.handoffs.map((h) => h.seat);
    return new Set(seats).size === seats.length;
  },
  { message: "handoffs must hold at most one entry per seat", path: ["handoffs"] }
);

export type State = z.infer<typeof StateSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Verified = z.infer<typeof VerifiedSchema>;
export type Gap = z.infer<typeof GapSchema>;
export type Decision = z.infer<typeof DecisionSchema>;
export type Handoff = z.infer<typeof HandoffSchema>;
export type LoopState = z.infer<typeof LoopStateSchema>;
export type OpenPr = z.infer<typeof OpenPrSchema>;

export const SCHEMA_VERSION = 2 as const;

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
  $: ["schema_version", "revision", "project", "objective", "tasks", "verified", "gaps", "decisions", "handoffs", "last_session"],
  project: ["name"],
  objective: ["text", "since_session"],
  tasks: ["id", "title", "priority", "status", "opened_session", "closed_session", "supersedes", "note"],
  verified: ["id", "claim", "evidence", "since_session", "status"],
  evidence: ["type", "path", "observation"],
  gaps: ["id", "what", "evidence", "recommended_update", "opened_session"],
  decisions: ["id", "title", "date", "note"],
  handoffs: ["seat", "pick_up", "watch_out", "open_questions", "session", "loop_state"],
  loop_state: ["open_prs", "frozen_sha", "questions_for_aaron", "rulings"],
  open_prs: ["ref", "qa_status", "note"],
  last_session: ["n", "date", "uuid", "seat"],
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
