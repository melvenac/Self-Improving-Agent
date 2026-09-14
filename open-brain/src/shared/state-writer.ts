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
import { join } from "node:path";
import { z } from "zod";
import {
  StateSchema,
  TaskPriority,
  EvidenceSchema,
  parseState,
  serializeState,
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
} from "../pipelines/state-views/index.js";

export const DONE_RETENTION_SESSIONS = 3;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ActiveStatus = z.enum(["open", "in_progress", "blocked"]);

export const OpSchema = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("open_task"), id: z.string().optional(), title: z.string().min(1), priority: TaskPriority, note: z.string().optional(), supersedes: z.string().nullable().optional() }),
  z.strictObject({ op: z.literal("update_task"), id: z.string(), title: z.string().min(1).optional(), priority: TaskPriority.optional(), status: ActiveStatus.optional(), note: z.string().optional() }),
  z.strictObject({ op: z.literal("close_task"), id: z.string(), note: z.string().optional() }),
  z.strictObject({ op: z.literal("add_verified"), id: z.string().optional(), claim: z.string().min(1), evidence: z.array(EvidenceSchema).min(1) }),
  z.strictObject({ op: z.literal("reopen_verified"), id: z.string(), evidence: EvidenceSchema }),
  z.strictObject({ op: z.literal("add_gap"), id: z.string().optional(), what: z.string().min(1), evidence: z.string(), recommended_update: z.string() }),
  z.strictObject({ op: z.literal("close_gap"), id: z.string() }),
  z.strictObject({ op: z.literal("add_decision"), id: z.string().optional(), title: z.string().min(1), date: z.string().regex(ISO_DATE, "expected YYYY-MM-DD"), note: z.string() }),
  z.strictObject({ op: z.literal("set_objective"), text: z.string().min(1).nullable() }),
  z.strictObject({ op: z.literal("set_handoff"), pick_up: z.string(), watch_out: z.array(z.string()), open_questions: z.array(z.string()) }),
  z.strictObject({ op: z.literal("end_session"), n: z.number().int().min(0), date: z.string().regex(ISO_DATE, "expected YYYY-MM-DD"), uuid: z.string().nullable() }),
]);
export type StateOp = z.infer<typeof OpSchema>;

export interface ApplyStateOptions {
  session: number;
  expected_revision: number;
  ops: unknown[];
  dry_run?: boolean;
  render?: boolean;
  /** Version stamped into the generated views; defaults to the root package.json, then state.project.version. */
  version?: string;
}

export interface WriteResult {
  ok: boolean;
  revision_before: number;
  revision_after: number;
  applied: Array<{ op: string; id: string | null }>;
  dropped_task_ids: string[];
  removed_gap_ids: string[];
  rendered: string[];
  dry_run: boolean;
  error?: string;
}

const STATE_REL = ".agents/state.json";
const VIEW_REL = {
  inbox: ".agents/TASKS/INBOX.md",
  task: ".agents/TASKS/task.md",
  next: ".agents/SESSIONS/next-session.md",
  summary: ".agents/SYSTEM/SUMMARY.md",
} as const;

export function applyStateOps(projectRoot: string, options: ApplyStateOptions): WriteResult {
  const dryRun = options.dry_run === true;
  const refuse = (before: number, error: string): WriteResult => ({
    ok: false, revision_before: before, revision_after: before, applied: [], dropped_task_ids: [], removed_gap_ids: [], rendered: [], dry_run: dryRun, error,
  });

  const statePath = join(projectRoot, STATE_REL);
  if (!existsSync(statePath)) {
    return refuse(-1, `${STATE_REL} is absent — this writer never creates it; run the migration first`);
  }
  const parsed = parseState(readFileSync(statePath, "utf-8"));
  if (!parsed.ok) return refuse(-1, `${STATE_REL} invalid at ${parsed.error} — refusing to write over a file that does not validate`);

  const before = parsed.data.revision;
  if (options.expected_revision !== before) {
    return refuse(before, `revision mismatch: expected_revision ${options.expected_revision} but ${STATE_REL} is at revision ${before} — re-read and retry`);
  }

  // Deep copy so a refused batch leaves the parsed state untouched.
  const next: State = JSON.parse(JSON.stringify(parsed.data));
  const applied: WriteResult["applied"] = [];
  const removedGaps: string[] = [];

  for (let i = 0; i < options.ops.length; i++) {
    const v = OpSchema.safeParse(options.ops[i]);
    if (!v.success) {
      const issue = v.error.issues[0];
      const path = issue.path.length ? issue.path.map(String).join(".") : "$";
      return refuse(before, `ops[${i}] invalid at ${path}: ${issue.message}`);
    }
    const r = applyOne(next, v.data, options.session, removedGaps);
    if (!r.ok) return refuse(before, `ops[${i}] (${v.data.op}): ${r.error}`);
    applied.push({ op: v.data.op, id: r.id });
  }

  const dropped = applyRetention(next, options.session);
  next.revision = before + 1;

  const check = validateResultState(next);
  if (!check.ok) return refuse(before, check.error);
  const finalState = check.data;

  const version = options.version ?? readJson<{ version: string }>(join(projectRoot, "package.json"))?.version ?? finalState.project.version;
  const views: Array<{ rel: string; text: string }> = [];
  if (options.render !== false) {
    views.push({ rel: VIEW_REL.inbox, text: renderInbox(finalState, { version }) });
    views.push({ rel: VIEW_REL.task, text: renderTaskFile(finalState, { version }) });
    views.push({ rel: VIEW_REL.next, text: renderNextSession(finalState, { version }) });
    const summaryPath = join(projectRoot, VIEW_REL.summary);
    const existing = existsSync(summaryPath) ? readFileSync(summaryPath, "utf-8") : "";
    views.push({ rel: VIEW_REL.summary, text: applySummaryRegion(existing, renderSummaryRegion(finalState, { version })) });
  }

  if (!dryRun) {
    atomicWrite(statePath, serializeState(finalState));
    for (const v of views) atomicWrite(join(projectRoot, v.rel), v.text);
  }

  return {
    ok: true,
    revision_before: before,
    revision_after: finalState.revision,
    applied,
    dropped_task_ids: dropped,
    removed_gap_ids: removedGaps,
    rendered: views.map((v) => v.rel),
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

function applyOne(s: State, op: StateOp, session: number, removedGaps: string[]): OpResult {
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
      s.handoff = { pick_up: op.pick_up, watch_out: op.watch_out, open_questions: op.open_questions, session };
      return { ok: true, id: null };
    }
    case "end_session": {
      s.last_session = { n: op.n, date: op.date, uuid: op.uuid };
      return { ok: true, id: null };
    }
  }
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
export function applyRetention(s: State, session: number): string[] {
  const cutoff = session - DONE_RETENTION_SESSIONS;
  const dropped: string[] = [];
  s.tasks = s.tasks.filter((t) => {
    const old = t.status === "done" && t.closed_session !== null && t.closed_session <= cutoff;
    if (old) dropped.push(t.id);
    return !old;
  });
  return dropped;
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
