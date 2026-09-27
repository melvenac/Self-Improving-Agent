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
 *     moves, it does not append).
 *
 *   PER SESSION — one entry per writing session, updated only by that session
 *     (T-163, schema v3): handoffs, sessions. Retention supersedes an entry
 *     only with a newer one from the same seat instance.
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
  /**
   * The sessions (uuids) whose text is in `note` now (T-171). `[]` for an empty
   * note; `null` when any of it has no recorded author — a note written before
   * v3, imported from prose, or added by an unregistered write. A replace that
   * would remove text by any session other than the writer's, or by an
   * unrecorded one, is refused unless the op names it (`replace_other_sessions`).
   */
  note_by: z.array(z.string().min(1)).nullable(),
  /**
   * The record revision the closing write produced (R179-1 as extended to done
   * tasks, record 128). Done-task retention counts the sessions that first
   * wrote AFTER it and never compares `closed_session`, which is the caller's
   * number: a write numbered 1124 used to drop every uncited done task. Null on
   * an open task, and on a task closed before schema v3 (never recorded; orders
   * before every keyed session, like a legacy handoff).
   */
  closed_rev: nonNegInt.nullable(),
}).refine((t) => (t.status === "done") === (t.closed_session !== null), {
  message: 'closed_session must be set when status is "done" and null otherwise',
  path: ["closed_session"],
}).refine((t) => t.status === "done" || t.closed_rev === null, {
  message: "closed_rev must be null unless status is \"done\"",
  path: ["closed_rev"],
}).refine((t) => t.note === t.note || t.note_by === null, {
  // T-171: an empty note has no authors, and text always has authors or an
  // unknown one — so no note can be replaced as though nobody had written it.
  message: "note_by must be [] exactly when note is empty",
  path: ["note_by"],
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
 * One SESSION's handoff (schema v3, T-163).
 *
 * v2 keyed this by `seat`, which fixed G-046 between roles and left it open
 * within one: `SeatName` is a ROLE, and three developer checkouts shared the one
 * `developer` slot, so a developer's close-out still replaced another
 * developer's. Step 0 of T-163 measured it on a scratch copy of this record.
 *
 * v3 keys it by `session_uuid`, the WRITING session, stamped by the writer from
 * the registered session and never taken from an op. A session can therefore
 * only add or update its own entry. `seat` stays for rendering; `checkout` (the
 * project-root basename at write time) identifies the seat INSTANCE, which is
 * what retention supersedes by — see `supersededBy` in the writer.
 *
 * `session_uuid` and `checkout` are null only on entries migrated from v2, which
 * never recorded either.
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
  session_uuid: z.string().min(1).nullable(),
  checkout: z.string().min(1).nullable(),
  /** The writing session's first-write revision (see `SessionRecordSchema.first_rev`). */
  first_rev: nonNegInt.nullable(),
}).refine((h) => h.seat !== "planner" || h.loop_state !== null, {
  message: "a planner handoff must carry loop_state (its fields may be empty, but not absent)",
  path: ["loop_state"],
});

/**
 * One session that wrote the record (schema v3; replaces v2's single
 * `last_session` slot, which every close-out overwrote — T-163's rev 61/62).
 *
 * Written by EVERY state write that carries a session uuid, not by a close-out
 * step, so it no longer depends on `/end` being run. "The last session" is
 * derived: `lastSession()`.
 */
export const SessionRecordSchema = z.strictObject({
  n: sessionNumber,
  date: z.string().regex(ISO_DATE, "expected YYYY-MM-DD"),
  /** Null only on the entry migrated from a v2 `last_session` that had none. */
  uuid: z.string().min(1).nullable(),
  /** Null when the writing session never named its seat (no set_handoff yet) or for legacy entries. */
  seat: SeatName.nullable(),
  checkout: z.string().min(1).nullable(),
  /**
   * The record revision this session's FIRST write produced (R179-1 as amended,
   * QA 125's D1). This, not `n`, is what orders sessions: retention, "newest"
   * and "last" all compare it, and `n` is a label that is rendered and never
   * compared. `n` is the caller's number for a session the record has not seen,
   * so one wrong number (1124 for 124, or T-164's local greeting number) used
   * to decide which OTHER sessions' entries retention dropped.
   *
   * Null on legacy entries (migrated from v2, or imported from prose), which
   * never recorded it. Null orders BEFORE every non-null value: a guessed
   * revision would be a number nothing checked, which is the defect this field
   * removes.
   */
  first_rev: nonNegInt.nullable(),
});

function unique(values: Array<string | null>): boolean {
  const real = values.filter((v): v is string => v !== null);
  return new Set(real).size === real.length;
}

export const StateSchema = z.strictObject({
  /**
   * 3 as of T-163: handoffs keyed by the writing session, and `last_session`
   * replaced by `sessions`. 2 was Loop 14's handoffs-by-seat.
   *
   * A `z.literal`, so an older file fails to parse OUTRIGHT rather than being
   * tolerated and read back as absence. `open-brain state migrate` is the
   * program that moves a record forward; every copy — the live record, the
   * shipped template and the test fixture — must move, and a loud refusal is
   * what guarantees none was missed.
   */
  schema_version: z.literal(3),
  revision: nonNegInt,
  project: ProjectSchema,
  objective: ObjectiveSchema.nullable(),
  tasks: z.array(TaskSchema),
  verified: z.array(VerifiedSchema),
  gaps: z.array(GapSchema),
  decisions: z.array(DecisionSchema),
  /** One per writing session; order is write order and not significant. */
  handoffs: z.array(HandoffSchema),
  /** One per writing session. */
  sessions: z.array(SessionRecordSchema),
}).refine((s) => unique(s.handoffs.map((h) => h.session_uuid)), {
  message: "handoffs must hold at most one entry per session_uuid",
  path: ["handoffs"],
}).refine(
  (s) => unique(s.handoffs.filter((h) => h.session_uuid === null).map((h) => h.seat)),
  { message: "handoffs may hold at most one legacy (null session_uuid) entry per seat", path: ["handoffs"] }
).refine((s) => unique(s.sessions.map((x) => x.uuid)), {
  message: "sessions must hold at most one entry per uuid",
  path: ["sessions"],
});

export type State = z.infer<typeof StateSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Verified = z.infer<typeof VerifiedSchema>;
export type Gap = z.infer<typeof GapSchema>;
export type Decision = z.infer<typeof DecisionSchema>;
export type Handoff = z.infer<typeof HandoffSchema>;
export type LoopState = z.infer<typeof LoopStateSchema>;
export type OpenPr = z.infer<typeof OpenPrSchema>;
export type SessionRecord = z.infer<typeof SessionRecordSchema>;

export const SCHEMA_VERSION = 3 as const;

/**
 * What to do about a record this build cannot read BECAUSE OF ITS VERSION, or
 * null when the version is not the problem. The two directions have different
 * remedies and a refusal that names the wrong one sends the reader the wrong
 * way: an OLDER record is migrated (T-163's v3 lands in code before the live
 * record is migrated after merge); a NEWER one needs a newer build.
 */
export function schemaVersionAdvice(text: string): string | null {
  let v: unknown;
  try {
    v = (JSON.parse(text) as { schema_version?: unknown }).schema_version;
  } catch {
    return null;
  }
  if (typeof v !== "number" || v === SCHEMA_VERSION) return null;
  if (v < SCHEMA_VERSION) {
    return `the record is schema v${v}, OLDER than this build's v${SCHEMA_VERSION}: migrate it with \`node open-brain/build/cli.js state migrate --dry-run .agents/state.json\`, read the changes, then run it without --dry-run`;
  }
  return `the record is schema v${v}, NEWER than this build's v${SCHEMA_VERSION}: rebuild this checkout from a commit that carries v${v}`;
}

/**
 * Write order of two per-session entries by `first_rev`: negative when `a` came
 * first. Null (legacy) sorts before every revision; two nulls, or two equal
 * revisions (possible only across a merge, G-027), compare equal and callers
 * fall back to array order. The session NUMBER is never consulted (R179-1).
 */
export function compareFirstRev(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a - b;
}

/**
 * The most recent session in the record: the latest `first_rev`, the later
 * entry on a tie. Derived, not stored — storing it is the single slot T-163
 * removed. Null for a record no session has written yet.
 */
export function lastSession(state: Pick<State, "sessions">): SessionRecord | null {
  let best: SessionRecord | null = null;
  for (const s of state.sessions) if (best === null || compareFirstRev(s.first_rev, best.first_rev) >= 0) best = s;
  return best;
}

/**
 * The handoffs a reader is shown: the newest per (seat, checkout), which is one
 * per seat INSTANCE, newest by `first_rev`. Older entries stay in the record and
 * are not rendered, so the greeting does not grow with the array (the planner's
 * ruling on T-163, after T-183 cut the greeting). Input order is preserved among
 * survivors.
 */
export function newestHandoffPerInstance(handoffs: readonly Handoff[]): Handoff[] {
  const newest = new Map<string, Handoff>();
  for (const h of handoffs) {
    const key = `${h.seat}\u0000${h.checkout ?? ""}`;
    const cur = newest.get(key);
    if (!cur || compareFirstRev(h.first_rev, cur.first_rev) >= 0) newest.set(key, h);
  }
  const keep = new Set(newest.values());
  return handoffs.filter((h) => keep.has(h));
}

/** The newest handoff (by `first_rev`) of one seat role across its instances, or null. */
export function newestHandoffForSeat(handoffs: readonly Handoff[], seat: Seat): Handoff | null {
  let best: Handoff | null = null;
  for (const h of handoffs) if (h.seat === seat && (best === null || compareFirstRev(h.first_rev, best.first_rev) >= 0)) best = h;
  return best;
}

/**
 * `path` is the zod path of the FIRST issue, dot-joined, or `$` for the root —
 * the same value the `error` string leads with, exposed as data.
 *
 * It exists because callers were pattern-matching the message. `ob_state`
 * appended "the server may be holding an old schema, ask Aaron to reconnect" on
 * `/schema|expected .* received|invalid/i`, which matches almost every refusal
 * it can produce — including `ops[0] invalid at priority`, an ordinary bad
 * argument with nothing to do with the schema. A scan that broad is the
 * prohibition-vs-instance family (G-040) pointed at error text: it fired on the
 * word, not on the condition.
 */
export type ParseResult = { ok: true; data: State } | { ok: false; error: string; path: string };

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
    return { ok: false, error: `$: not valid JSON — ${err instanceof Error ? err.message : String(err)}`, path: "$" };
  }
  const result = StateSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  const issue = result.error.issues[0];
  const path = issue.path.length === 0 ? "$" : issue.path.map(String).join(".");
  return { ok: false, error: `${path}: ${issue.message}`, path };
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
  $: ["schema_version", "revision", "project", "objective", "tasks", "verified", "gaps", "decisions", "handoffs", "sessions"],
  project: ["name"],
  objective: ["text", "since_session"],
  tasks: ["id", "title", "priority", "status", "opened_session", "closed_session", "supersedes", "note", "note_by", "closed_rev"],
  verified: ["id", "claim", "evidence", "since_session", "status"],
  evidence: ["type", "path", "observation"],
  gaps: ["id", "what", "evidence", "recommended_update", "opened_session"],
  decisions: ["id", "title", "date", "note"],
  handoffs: ["seat", "pick_up", "watch_out", "open_questions", "session", "loop_state", "session_uuid", "checkout", "first_rev"],
  loop_state: ["open_prs", "frozen_sha", "questions_for_aaron", "rulings"],
  open_prs: ["ref", "qa_status", "note"],
  sessions: ["n", "date", "uuid", "seat", "checkout", "first_rev"],
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
