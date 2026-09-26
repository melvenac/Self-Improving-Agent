/**
 * The `.agents/state.json` writer (Loop 3). One entry point, `applyStateOps`,
 * takes a batch of typed operations and either applies ALL of them or NONE.
 *
 * Rules, each load-bearing:
 * - The file must already exist and validate. This module never creates it —
 *   creation is the migration's job (Loop 4) — and never repairs it.
 * - `expected_revision` must equal the file's `revision` (optimistic
 *   concurrency, read-modify-write). Mismatch refuses, naming both values.
 * - Every op validates its own arguments and refuses an unknown id. One
 *   failing op fails the batch; nothing is written.
 * - The result must pass `StateSchema` before it is written.
 * - Retention: done tasks older than DONE_RETENTION_SESSIONS are dropped on
 *   every write (git is the history). Verified / gaps / decisions are not
 *   pruned here.
 * - The write is atomic (temp file + rename) and canonical (serializeState).
 * - After the state is written the views are rendered (unless render:false).
 *   The only files this module ever touches are state.json, the three
 *   generated views, and the marked region of SUMMARY.md.
 */
import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, join, resolve } from "node:path";
import { z } from "zod";
import {
  StateSchema,
  TaskPriority,
  EvidenceSchema,
  SeatName,
  LoopStateSchema,
  parseState,
  serializeState,
  type Seat,
  type State,
  type Task,
} from "./state-schema.js";
import { readJson } from "./fs-utils.js";
import {
  renderInbox,
  renderTaskFile,
  renderNextSession,
  renderSummaryRegion,
  applySummaryRegion,
  isDroppedByRetention,
  DONE_RETENTION_SESSIONS,
} from "../pipelines/state-views/index.js";

// Defined in state-views (the INBOX view needs it to hide what this drops) and
// re-exported here so existing import sites are unchanged. T-144.
export { DONE_RETENTION_SESSIONS };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ActiveStatus = z.enum(["open", "in_progress", "blocked"]);

export const OpSchema = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("open_task"), id: z.string().optional(), title: z.string().min(1), priority: TaskPriority, note: z.string().optional(), supersedes: z.string().nullable().optional() }),
  z.strictObject({ op: z.literal("update_task"), id: z.string(), title: z.string().min(1).optional(), priority: TaskPriority.optional(), status: ActiveStatus.optional(), note: z.string().optional() }),
  z.strictObject({ op: z.literal("close_task"), id: z.string(), note: z.string().optional() }),
  z.strictObject({ op: z.literal("reopen_task"), id: z.string(), note: z.string().min(1) }),
  z.strictObject({ op: z.literal("add_verified"), id: z.string().optional(), claim: z.string().min(1), evidence: z.array(EvidenceSchema).min(1) }),
  z.strictObject({ op: z.literal("reopen_verified"), id: z.string(), evidence: EvidenceSchema }),
  z.strictObject({ op: z.literal("add_gap"), id: z.string().optional(), what: z.string().min(1), evidence: z.string(), recommended_update: z.string() }),
  z.strictObject({ op: z.literal("update_gap"), id: z.string(), what: z.string().min(1).optional(), evidence: z.string().optional(), recommended_update: z.string().optional() }),
  z.strictObject({ op: z.literal("close_gap"), id: z.string() }),
  z.strictObject({ op: z.literal("add_decision"), id: z.string().optional(), title: z.string().min(1), date: z.string().regex(ISO_DATE, "expected YYYY-MM-DD"), note: z.string() }),
  z.strictObject({ op: z.literal("set_objective"), text: z.string().min(1).nullable() }),
  // `seat` is REQUIRED and is an enum so an unknown seat refuses rather than
  // creating a fourth seat nobody reads. The WRITING SESSION is deliberately not
  // an argument: it comes from ApplyStateOptions.session_uuid, so a batch cannot
  // write under another session's uuid (T-163). The op is strict, so a batch
  // that tries is refused rather than having the key ignored.
  z.strictObject({ op: z.literal("set_handoff"), seat: SeatName, pick_up: z.string(), watch_out: z.array(z.string()), open_questions: z.array(z.string()), loop_state: LoopStateSchema.nullable().optional() }),
]);
export type StateOp = z.infer<typeof OpSchema>;

/**
 * Retired ops, refused by name before the schema sees them so the refusal says
 * WHY rather than "invalid discriminator".
 */
const RETIRED_OPS: Record<string, string> = {
  end_session:
    "retired in schema v3 (T-163) — every state write now records its session in sessions[], so there is no close-out slot to set; the last session is derived",
};

/**
 * Retention for the per-session arrays (handoffs, sessions): an entry is
 * dropped only when a NEWER entry of the same seat instance exists and the
 * entry is more than this many record sessions older than the newest session in
 * the record. The planner's ruling on T-163 (record session 109).
 */
export const RECORD_RETENTION_SESSIONS = 10;

export interface ApplyStateOptions {
  session: number;
  expected_revision: number;
  ops: unknown[];
  dry_run?: boolean;
  render?: boolean;
  /** Version stamped into the generated views; defaults to the root package.json. */
  version?: string;
  /**
   * The WRITING session's uuid — `ob_state` passes the server's registered
   * session. Every write that carries one records that session in `sessions[]`;
   * `set_handoff` refuses without one. Never taken from an op.
   */
  session_uuid?: string | null;
  /**
   * The seat instance's checkout: the basename of the project root unless given.
   * With `seat` it identifies the instance retention supersedes by.
   *
   * LIMIT, stated because it bounds the rule: two machines whose checkouts share
   * a basename are one instance to this writer.
   */
  checkout?: string;
  /** The writing checkout's seat, when the caller resolved one. A set_handoff in the batch overrides it. */
  seat?: Seat | null;
  /** YYYY-MM-DD stamped on the session record; defaults to today (local). */
  today?: string;
}

export interface WriteResult {
  ok: boolean;
  revision_before: number;
  revision_after: number;
  applied: Array<{ op: string; id: string | null }>;
  dropped_task_ids: string[];
  /**
   * Done tasks retention WOULD have dropped and did not, because their id is
   * cited somewhere in the tracked tree (T-157 / G-024). Separate from
   * `dropped_task_ids` so a caller can say which is which.
   */
  kept_cited_task_ids: string[];
  /** Per-session entries retention superseded (T-163), as `handoff <uuid|seat@n>` / `session <uuid|n>`. */
  superseded: string[];
  removed_gap_ids: string[];
  rendered: string[];
  /**
   * Things the writer did differently from what was asked. An op that silently
   * normalises its input is an op whose result cannot be trusted to mean what it
   * says, so every normalisation lands here and the caller prints it.
   */
  notes: string[];
  dry_run: boolean;
  error?: string;
  /**
   * When the refusal came from parsing `state.json`, the zod path of the first
   * issue. Callers branch on THIS, never on the wording of `error`.
   */
  error_path?: string;
}

export const STATE_REL = ".agents/state.json";
const VIEW_REL = {
  inbox: ".agents/TASKS/INBOX.md",
  task: ".agents/TASKS/task.md",
  next: ".agents/SESSIONS/next-session.md",
  summary: ".agents/SYSTEM/SUMMARY.md",
} as const;

/**
 * Read and validate `.agents/state.json` without writing anything.
 *
 * G-006: `ob_state` was the only door to the record, so with the MCP server
 * down there was no way for a human or a script to read it except by opening
 * the JSON by hand — which is exactly the habit the single-writer rule exists
 * to prevent. Reading needs a door of its own; it does not need the writer.
 *
 * Same absent/invalid refusals as `applyStateOps`, so both doors describe a
 * broken file the same way.
 */
export function readState(projectRoot: string): { ok: true; data: State; path: string } | { ok: false; error: string } {
  const statePath = join(projectRoot, STATE_REL);
  if (!existsSync(statePath)) {
    return { ok: false, error: `${STATE_REL} is absent — run the migration first` };
  }
  const parsed = parseState(readFileSync(statePath, "utf-8"));
  if (!parsed.ok) return { ok: false, error: `${STATE_REL} invalid at ${parsed.error}` };
  return { ok: true, data: parsed.data, path: statePath };
}

export function applyStateOps(projectRoot: string, options: ApplyStateOptions): WriteResult {
  const dryRun = options.dry_run === true;
  const refuse = (before: number, error: string, errorPath?: string): WriteResult => ({
    ok: false, revision_before: before, revision_after: before, applied: [], dropped_task_ids: [], kept_cited_task_ids: [], superseded: [], removed_gap_ids: [], rendered: [], notes: [], dry_run: dryRun, error, error_path: errorPath,
  });

  const statePath = join(projectRoot, STATE_REL);
  if (!existsSync(statePath)) {
    return refuse(-1, `${STATE_REL} is absent — this writer never creates it; run the migration first`);
  }
  const parsed = parseState(readFileSync(statePath, "utf-8"));
  if (!parsed.ok) return refuse(-1, `${STATE_REL} invalid at ${parsed.error} — refusing to write over a file that does not validate`, parsed.path);

  const before = parsed.data.revision;
  if (options.expected_revision !== before) {
    return refuse(before, `revision mismatch: expected_revision ${options.expected_revision} but ${STATE_REL} is at revision ${before} — re-read and retry`);
  }

  // Deep copy so a refused batch leaves the parsed state untouched.
  const next: State = JSON.parse(JSON.stringify(parsed.data));

  // THE EFFECTIVE SESSION NUMBER, resolved BEFORE any op is applied.
  //
  // G-047: the number counts SESSIONS, not writes. A session already in
  // sessions[] keeps its number for every op in the batch, whatever the caller
  // passed — a batch stamped with one number while the record says another left
  // the record internally inconsistent once (a handoff "in session 72" when 72
  // did not exist), so the whole batch takes the recorded number.
  const uuid = options.session_uuid ?? null;
  const checkout = options.checkout ?? basename(resolve(projectRoot));
  const today = options.today ?? localIsoDate();
  const mine = uuid === null ? undefined : next.sessions.find((s) => s.uuid === uuid);
  const effectiveSession = mine ? mine.n : options.session;
  const applied: WriteResult["applied"] = [];
  const removedGaps: string[] = [];
  const notes: string[] = [];
  if (mine && mine.n !== options.session) {
    notes.push(`session ${uuid} is already recorded as session ${mine.n}; kept ${mine.n} rather than taking ${options.session}, and EVERY op in this batch was stamped ${mine.n} (G-047 - the number counts sessions, not writes)`);
  }
  const ctx: OpContext = { session: effectiveSession, uuid, checkout, removedGaps, notes };

  for (let i = 0; i < options.ops.length; i++) {
    const opName = (options.ops[i] as { op?: unknown } | null)?.op;
    if (typeof opName === "string" && opName in RETIRED_OPS) {
      return refuse(before, `ops[${i}] (${opName}): ${RETIRED_OPS[opName]}`);
    }
    const v = OpSchema.safeParse(options.ops[i]);
    if (!v.success) {
      const issue = v.error.issues[0];
      const path = issue.path.length ? issue.path.map(String).join(".") : "$";
      return refuse(before, `ops[${i}] invalid at ${path}: ${issue.message}`);
    }
    const r = applyOne(next, v.data, ctx);
    if (!r.ok) return refuse(before, `ops[${i}] (${v.data.op}): ${r.error}`);
    applied.push({ op: v.data.op, id: r.id });
  }

  // Loop 4 R3: an empty batch is a re-render, not a write. The revision does
  // not move, retention does not run and state.json is not touched — only
  // the views are regenerated (with the current package.json version). This
  // is what /sync uses to refresh stale view headers without inventing a
  // state change.
  const renderOnly = options.ops.length === 0;

  // T-163: every write records the session that made it, so the record holds
  // every writing session's uuid rather than the last closer's. Upserted by
  // uuid: a session can only add or update its OWN entry.
  if (!renderOnly) {
    if (uuid === null) {
      notes.push("no registered session: this write is not attributed and sessions[] is unchanged (set_handoff would refuse)");
    } else {
      const handedOffAs = [...options.ops].reverse().find(
        (o): o is { op: "set_handoff"; seat: Seat } => (o as { op?: unknown }).op === "set_handoff",
      )?.seat;
      const seat = handedOffAs ?? mine?.seat ?? options.seat ?? null;
      const entry = { n: effectiveSession, date: today, uuid, seat, checkout };
      if (mine) Object.assign(mine, entry);
      else next.sessions.push(entry);
    }
  }
  const superseded = renderOnly ? [] : applyInstanceRetention(next);
  // T-157: a done task whose id is cited anywhere in the tracked tree is kept.
  // Retention has twice evicted a task that other tracked documents referred to
  // by id, reporting it as one line among several. Hand-preservation does not
  // scale: it depends on a seat noticing that line and then grepping the tree.
  const cited = renderOnly ? new Map<string, string[]>() : citedTaskIds(projectRoot);
  const retention = renderOnly
    ? { dropped: [] as string[], kept: [] as string[] }
    : applyRetention(next, effectiveSession, cited);
  const dropped = retention.dropped;
  for (const id of retention.kept) {
    const where = cited.get(id) ?? [];
    const shown = where.slice(0, 3).join(", ");
    const more = where.length > 3 ? ` +${where.length - 3} more` : "";
    notes.push(
      `retention KEPT done task ${id}: cited in ${where.length} tracked file(s) — ${shown}${more}. ` +
        `Dropping it would leave a dangling reference (T-157). Matches the id PATTERN, so a mention in a test fixture counts.`
    );
  }
  next.revision = renderOnly ? before : before + 1;

  const check = validateResultState(next);
  if (!check.ok) return refuse(before, check.error);
  const finalState = check.data;

  // Loop 8 R3: the state.project.version fallback is gone with the field. This
  // line already preferred package.json, which is what made the cached copy
  // redundant and is the argument ADR-027 rests on.
  const version = options.version ?? readJson<{ version: string }>(join(projectRoot, "package.json"))?.version ?? "0.0.0";
  const views: Array<{ rel: string; text: string }> = [];
  if (options.render !== false) {
    const viewOpts = { version, session: effectiveSession };
    views.push({ rel: VIEW_REL.inbox, text: renderInbox(finalState, viewOpts) });
    views.push({ rel: VIEW_REL.task, text: renderTaskFile(finalState, viewOpts) });
    views.push({ rel: VIEW_REL.next, text: renderNextSession(finalState, viewOpts) });
    const summaryPath = join(projectRoot, VIEW_REL.summary);
    const existing = existsSync(summaryPath) ? readFileSync(summaryPath, "utf-8") : "";
    views.push({ rel: VIEW_REL.summary, text: applySummaryRegion(existing, renderSummaryRegion(finalState, viewOpts)) });
  }

  if (!dryRun) {
    if (!renderOnly) atomicWrite(statePath, serializeState(finalState));
    for (const v of views) atomicWrite(join(projectRoot, v.rel), v.text);
  }

  return {
    ok: true,
    revision_before: before,
    revision_after: finalState.revision,
    applied,
    dropped_task_ids: dropped,
    kept_cited_task_ids: retention.kept,
    superseded,
    removed_gap_ids: removedGaps,
    rendered: views.map((v) => v.rel),
    notes,
    dry_run: dryRun,
  };
}

/**
 * The last gate before bytes hit disk. Every op validates its own arguments,
 * so a validated batch cannot normally produce an invalid state — this exists
 * for the day one can (a schema tightened after an op was written, say), and
 * it is unit-tested directly because it is unreachable through the ops.
 */
export function validateResultState(candidate: unknown): { ok: true; data: State } | { ok: false; error: string } {
  const check = StateSchema.safeParse(candidate);
  if (check.success) return { ok: true, data: check.data };
  const issue = check.error.issues[0];
  const path = issue.path.length ? issue.path.map(String).join(".") : "$";
  return { ok: false, error: `result would not validate at ${path}: ${issue.message} — nothing written` };
}

type OpResult = { ok: true; id: string | null } | { ok: false; error: string };

interface OpContext {
  session: number;
  uuid: string | null;
  checkout: string;
  removedGaps: string[];
  notes: string[];
}

function applyOne(s: State, op: StateOp, ctx: OpContext): OpResult {
  const { session, removedGaps } = ctx;
  switch (op.op) {
    case "open_task": {
      const id = op.id ?? nextId("T", s.tasks.map((t) => t.id));
      if (s.tasks.some((t) => t.id === id)) return { ok: false, error: `task ${id} already exists` };
      if (op.supersedes && !s.tasks.some((t) => t.id === op.supersedes)) return { ok: false, error: `supersedes unknown task ${op.supersedes}` };
      s.tasks.push({ id, title: op.title, priority: op.priority, status: "open", opened_session: session, closed_session: null, supersedes: op.supersedes ?? null, note: op.note ?? "" });
      return { ok: true, id };
    }
    case "update_task": {
      const t = findTask(s, op.id);
      if (!t) return { ok: false, error: `unknown task ${op.id}` };
      if (t.status === "done") return { ok: false, error: `task ${op.id} is done; reopen by opening a new task that supersedes it` };
      if (op.title !== undefined) t.title = op.title;
      if (op.priority !== undefined) t.priority = op.priority;
      if (op.status !== undefined) t.status = op.status;
      if (op.note !== undefined) t.note = op.note;
      return { ok: true, id: t.id };
    }
    case "close_task": {
      const t = findTask(s, op.id);
      if (!t) return { ok: false, error: `unknown task ${op.id}` };
      if (t.status === "done") return { ok: false, error: `task ${op.id} is already done (closed session ${t.closed_session})` };
      t.status = "done";
      t.closed_session = session;
      if (op.note !== undefined) t.note = op.note;
      return { ok: true, id: t.id };
    }
    case "reopen_task": {
      // Loop 4 R1: a regression reopens the same task rather than opening a
      // superseding one; the note says why, appended so the close-out survives.
      const t = findTask(s, op.id);
      if (!t) return { ok: false, error: `unknown task ${op.id}` };
      if (t.status !== "done") return { ok: false, error: `task ${op.id} is not done (status ${t.status}); nothing to reopen` };
      t.status = "open";
      t.closed_session = null;
      t.note = t.note ? `${t.note} — ${op.note}` : op.note;
      return { ok: true, id: t.id };
    }
    case "add_verified": {
      const id = op.id ?? nextId("V", s.verified.map((v) => v.id));
      if (s.verified.some((v) => v.id === id)) return { ok: false, error: `verified ${id} already exists` };
      s.verified.push({ id, claim: op.claim, evidence: op.evidence, since_session: session, status: "verified" });
      return { ok: true, id };
    }
    case "reopen_verified": {
      const v = s.verified.find((x) => x.id === op.id);
      if (!v) return { ok: false, error: `unknown verified ${op.id}` };
      v.status = "reopened";
      v.evidence.push(op.evidence);
      return { ok: true, id: v.id };
    }
    case "add_gap": {
      const id = op.id ?? nextId("G", s.gaps.map((g) => g.id));
      if (s.gaps.some((g) => g.id === id)) return { ok: false, error: `gap ${id} already exists` };
      s.gaps.push({ id, what: op.what, evidence: op.evidence, recommended_update: op.recommended_update, opened_session: session });
      return { ok: true, id };
    }
    case "update_gap": {
      // Gaps are amendable by design (ADR-021). A gap describes something we are
      // still learning about, so its own text is provisional — the record that
      // most needs correcting was the one that could not be corrected, and the
      // workaround was to close and re-add, which silently changed the id and
      // the opened_session stamp.
      const g = s.gaps.find((x) => x.id === op.id);
      if (!g) return { ok: false, error: `unknown gap ${op.id}` };
      if (op.what === undefined && op.evidence === undefined && op.recommended_update === undefined) {
        return { ok: false, error: `update_gap ${op.id}: nothing to change` };
      }
      if (op.what !== undefined) g.what = op.what;
      if (op.evidence !== undefined) g.evidence = op.evidence;
      if (op.recommended_update !== undefined) g.recommended_update = op.recommended_update;
      return { ok: true, id: g.id };
    }
    case "close_gap": {
      const idx = s.gaps.findIndex((g) => g.id === op.id);
      if (idx === -1) return { ok: false, error: `unknown gap ${op.id}` };
      s.gaps.splice(idx, 1);
      removedGaps.push(op.id);
      return { ok: true, id: op.id };
    }
    case "add_decision": {
      const id = op.id ?? nextId("D", s.decisions.map((d) => d.id));
      if (s.decisions.some((d) => d.id === id)) return { ok: false, error: `decision ${id} already exists` };
      s.decisions.push({ id, title: op.title, date: op.date, note: op.note });
      return { ok: true, id };
    }
    case "set_objective": {
      s.objective = op.text === null ? null : { text: op.text, since_session: session };
      return { ok: true, id: null };
    }
    case "set_handoff": {
      // The planner's rows are enforced by the schema too, but that refusal names
      // a zod path. This one names the op and what to do about it, and it runs
      // BEFORE the entry is stored so a refused batch changes nothing.
      if (op.seat === "planner" && (op.loop_state === null || op.loop_state === undefined)) {
        return { ok: false, error: "a planner handoff must carry loop_state - open_prs, frozen_sha, questions_for_aaron and rulings may be EMPTY but not absent (C3)" };
      }
      // T-163: keyed by the WRITING SESSION, not the seat. v2 keyed by seat, and
      // SeatName is a role: three developer checkouts shared one slot, so a
      // developer's close-out erased another developer's (Step 0, record 118).
      // A session adds its own entry or updates it; it cannot reach another's.
      if (ctx.uuid === null) {
        return { ok: false, error: "set_handoff needs the writing session, and there is no registered session (call ob_set_session) — a handoff nobody can attribute is one the next close-out could not be kept from erasing" };
      }
      const entry = {
        seat: op.seat,
        pick_up: op.pick_up,
        watch_out: op.watch_out,
        open_questions: op.open_questions,
        session,
        loop_state: op.loop_state ?? null,
        session_uuid: ctx.uuid,
        checkout: ctx.checkout,
      };
      const idx = s.handoffs.findIndex((h) => h.seat === op.seat);
      if (idx === -1) s.handoffs.push(entry);
      else s.handoffs[idx] = entry;
      return { ok: true, id: op.seat };
    }
  }
}

/** Today as YYYY-MM-DD in local time — the date a human at this machine would write. */
function localIsoDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** An entry of one of the per-session arrays, reduced to what retention reads. */
export interface InstanceEntry {
  seat: string | null;
  checkout: string | null;
  session: number;
}

/**
 * Is `entry` superseded, given every entry of its array and the record's newest
 * session number? True only when a NEWER entry of the same seat instance —
 * same seat AND same checkout, null matching only null — exists, and the entry
 * is more than RECORD_RETENTION_SESSIONS older than `newest`.
 *
 * The newest entry of an instance is therefore never superseded, so a seat
 * that is still working keeps its last word however long it goes quiet, and a
 * legacy entry (null checkout, migrated from v2) is its own instance and is
 * never superseded by a new write. Exported because the record-erasure check
 * recomputes exactly this rule: a removal it explains is retention, and any
 * other removal of another session's entry is an erasure.
 */
export function isSuperseded(entry: InstanceEntry, all: readonly InstanceEntry[], newest: number): boolean {
  if (!(entry.session < newest - RECORD_RETENTION_SESSIONS)) return false;
  return all.some((o) => o !== entry && o.seat === entry.seat && o.checkout === entry.checkout && o.session > entry.session);
}

/** The record's newest session number: the highest `n` in sessions[], or -1 when there is none. */
export function newestSessionNumber(s: Pick<State, "sessions">): number {
  return s.sessions.reduce((m, x) => Math.max(m, x.n), -1);
}

/**
 * Drops superseded handoffs and session records (see `isSuperseded`). Returns a
 * label per dropped entry so the caller prints it — retention that is not
 * reported is the G-024 shape.
 */
export function applyInstanceRetention(s: State): string[] {
  const newest = newestSessionNumber(s);
  const out: string[] = [];
  const hAll = s.handoffs.map((h) => ({ seat: h.seat, checkout: h.checkout, session: h.session, ref: h }));
  const hDrop = new Set(hAll.filter((e) => isSuperseded(e, hAll, newest)).map((e) => e.ref));
  s.handoffs = s.handoffs.filter((h) => {
    if (!hDrop.has(h)) return true;
    out.push(`handoff ${h.session_uuid ?? `${h.seat}@${h.session}`} (${h.seat}, ${h.checkout ?? "legacy"}, session ${h.session})`);
    return false;
  });
  const sAll = s.sessions.map((x) => ({ seat: x.seat, checkout: x.checkout, session: x.n, ref: x }));
  const sDrop = new Set(sAll.filter((e) => isSuperseded(e, sAll, newest)).map((e) => e.ref));
  s.sessions = s.sessions.filter((x) => {
    if (!sDrop.has(x)) return true;
    out.push(`session ${x.uuid ?? `#${x.n}`} (${x.seat ?? "no seat"}, ${x.checkout ?? "legacy"}, session ${x.n})`);
    return false;
  });
  return out;
}

function findTask(s: State, id: string): Task | undefined {
  return s.tasks.find((t) => t.id === id);
}

/** `T-007` style: max existing numeric suffix + 1, zero-padded to 3. */
export function nextId(prefix: "T" | "V" | "G" | "D", existing: string[]): string {
  let max = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  for (const id of existing) {
    const m = id.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

/**
 * Drops done tasks outside the retention window. "Last 3 sessions" means the
 * current one and the two before it, so a task closed at `session - 3` is
 * the first to go. Returns the dropped ids so the caller can say so.
 */
export function applyRetention(
  s: State,
  session: number,
  cited: ReadonlyMap<string, string[]> = new Map()
): { dropped: string[]; kept: string[] } {
  const dropped: string[] = [];
  const kept: string[] = [];
  s.tasks = s.tasks.filter((t) => {
    // Same predicate the INBOX view filters on, so the record and the rendered
    // Done list cannot disagree about what still exists (T-144).
    const old = isDroppedByRetention(t, session);
    if (!old) return true;
    // T-157 / G-024: an id the tracked tree refers to must not leave the record.
    // Rev 48 evicted T-151, which G-031 exists to correct; rev 49 evicted T-153,
    // which three tracked documents cite by id. Both were preserved by hand, and
    // both were noticed only because a dry run printed "Dropped done tasks" in
    // passing. A write made without a dry run destroys the entry silently.
    if (cited.has(t.id)) {
      kept.push(t.id);
      return true;
    }
    dropped.push(t.id);
    return false;
  });
  return { dropped, kept };
}

/**
 * Task ids named anywhere in the tracked tree, mapped to the files that name
 * them, EXCLUDING the record itself and its own rendered views.
 *
 * The exclusion is the whole subtlety. `state.json` contains every task's id by
 * construction, and so do INBOX.md, task.md, next-session.md and SUMMARY.md,
 * which are generated FROM it. Counting those would make every task cite itself,
 * retention would never drop anything, and the protection would be a check that
 * cannot fail — which is worse than no protection, because it would look like
 * one.
 *
 * Tracked files only: untracked files do not ship, and a reference in one is not
 * a reference the project holds.
 *
 * Returns an EMPTY map when git cannot answer, which leaves retention behaving
 * exactly as it did before. This protects; it does not gate. A git failure must
 * not silently start retaining every done task forever — that failure would be
 * invisible, whereas the eviction it guards against is at least recorded.
 *
 * ## Its precision, stated because the caller reports it
 *
 * This matches the ID PATTERN, not a reference. A task id appearing in a test
 * fixture, a code example or a sentence about something else counts as a
 * citation — measured on this repo, `T-999` is "cited" because
 * `state-writer.test.ts` uses it as a deliberately-unknown id.
 *
 * That is the SAFE direction: the failure mode is retaining a task nobody refers
 * to, which is visible in the record, rather than destroying one three documents
 * name, which is not. But it is a real limit, so the citing FILES travel with
 * the id and the writer's note prints them — a reader can then see at a glance
 * whether a retention was earned or was a test fixture.
 */
export function citedTaskIds(projectRoot: string): Map<string, string[]> {
  const out = gitOut(projectRoot, [
    "grep",
    "--no-color",
    "-oI",
    "-E",
    "T-[0-9]+",
    "--",
    ".",
    ":(exclude).agents/state.json",
    ":(exclude).agents/TASKS/INBOX.md",
    ":(exclude).agents/TASKS/task.md",
    ":(exclude).agents/SESSIONS/next-session.md",
    ":(exclude).agents/SYSTEM/SUMMARY.md",
  ]);
  if (out === null) return new Map();
  const cited = new Map<string, string[]>();
  for (const line of out.split(/\r?\n/)) {
    // `path:match`, and a Windows path can contain a drive-letter colon, so the
    // split is on the LAST colon rather than the first.
    const cut = line.lastIndexOf(":");
    if (cut <= 0) continue;
    const file = line.slice(0, cut).trim();
    const id = line.slice(cut + 1).trim();
    if (!file || !id) continue;
    const files = cited.get(id);
    if (files) {
      if (!files.includes(file)) files.push(file);
    } else {
      cited.set(id, [file]);
    }
  }
  return cited;
}

/**
 * execFileSync with an args array: no shell, so the `:(exclude)` pathspecs reach
 * git verbatim rather than being read as globs or comments by cmd.exe.
 *
 * `git grep` exits 1 on NO MATCHES, which is indistinguishable here from a real
 * failure, and both land in the catch. Both mean the same thing for the caller —
 * no protection this write — which is the safe direction.
 */
function gitOut(cwd: string, args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

/** Temp file beside the target, then rename: readers never see a half-written file. */
function atomicWrite(path: string, text: string): void {
  const tmp = `${path}.tmp-${process.pid}`;
  try {
    writeFileSync(tmp, text, "utf-8");
    renameSync(tmp, path);
  } catch (err) {
    try { if (existsSync(tmp)) unlinkSync(tmp); } catch { /* best effort */ }
    throw err;
  }
}
