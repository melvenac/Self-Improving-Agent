import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { gitLine, gitShow } from "../session-start/git-read.js";
import { parseState, SeatName, type Seat } from "../../shared/state-schema.js";

/**
 * T-201: the planner's dispatch is durable in the tracked tree, not in a message.
 *
 * A message cannot reach a session that does not exist yet, and native A2A does not cross
 * machines: a developer seat that ran `/start` on the QA PC printed a backlog and went idle,
 * with its assignment in a hub turn nobody had read. `.agents/assignments.json` is what
 * `ob_start` reads for a developer or QA seat, from origin/master when the tree is behind.
 *
 * ## Why a sidecar and not a field in state.json (planner ruling, T-201, Option C)
 *
 * Every level of StateSchema is a strictObject. An OPTIONAL field is still an unknown key to
 * every build that lacks it, so the first assignment written to master would have blinded each
 * checkout that had not rebuilt, exactly as a schema_version bump does. The sidecar leaves
 * StateSchema untouched.
 *
 * **THE COST, NAMED: a write here is not atomic with the record.** It has its own revision
 * counter, and the task it names is validated against the record at WRITE time only. A task
 * closed afterwards leaves a live assignment pointing at a done task.
 *
 * One live assignment per seat. Replacing or clearing one KEEPS the old entry with its
 * status changed, the way a superseded handoff stays in the record.
 */
export const ASSIGNABLE_SEATS = ["developer", "qa"] as const;
export const ASSIGNMENTS_REL = ".agents/assignments.json";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const nonNegInt = z.number().int().min(0);

export const AssignmentEntrySchema = z.strictObject({
  seat: SeatName,
  task_id: z.string().min(1),
  /** The brief path or turn, plus the QA number and PR for a QA assignment. */
  brief: z.string().min(1),
  /** What is owed, in the planner's words. */
  owed: z.string().min(1),
  date: z.string().regex(ISO_DATE, "expected YYYY-MM-DD"),
  status: z.enum(["live", "superseded", "cleared"]),
  /** The sidecar revision that wrote this entry, and the one that ended it (null while live). */
  set_rev: nonNegInt,
  ended_rev: nonNegInt.nullable(),
  session: nonNegInt,
});
export type AssignmentEntry = z.infer<typeof AssignmentEntrySchema>;

export const AssignmentsFileSchema = z
  .strictObject({
    schema_version: z.literal(1),
    revision: nonNegInt,
    assignments: z.array(AssignmentEntrySchema),
  })
  .refine(
    (f) => {
      const live = f.assignments.filter((a) => a.status === "live").map((a) => a.seat);
      return new Set(live).size === live.length;
    },
    { message: "at most one live assignment per seat", path: ["assignments"] },
  );
export type AssignmentsFile = z.infer<typeof AssignmentsFileSchema>;

export function parseAssignments(text: string): { ok: true; data: AssignmentsFile } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `not valid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  const r = AssignmentsFileSchema.safeParse(raw);
  if (r.success) return { ok: true, data: r.data };
  const i = r.error.issues[0];
  return { ok: false, error: `${i.path.join(".") || "$"}: ${i.message}` };
}

const KEY_ORDER = ["seat", "task_id", "brief", "owed", "date", "status", "set_rev", "ended_rev", "session"] as const;

export function serializeAssignments(f: AssignmentsFile): string {
  const ordered = {
    schema_version: f.schema_version,
    revision: f.revision,
    assignments: f.assignments.map((a) => Object.fromEntries(KEY_ORDER.map((k) => [k, a[k]]))),
  };
  return JSON.stringify(ordered, null, 2) + "\n";
}

/* ------------------------------------------------------------------ read */

export type AssignmentsRead =
  | { kind: "absent"; where: string }
  | { kind: "ok"; where: string; data: AssignmentsFile }
  | { kind: "unreadable"; where: string; cause: string };

/**
 * Read the sidecar from the working tree, or from `ref` (T-200: a tree behind master briefs
 * from master). An ABSENT file is a normal answer, `no assignment`, never an error; an
 * unreadable one is NOT the same thing and must not render as absence.
 */
export function readAssignments(projectRoot: string, ref: string | null = null): AssignmentsRead {
  if (ref === null) {
    const path = join(projectRoot, ASSIGNMENTS_REL);
    if (!existsSync(path)) return { kind: "absent", where: "this tree" };
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch (e) {
      return { kind: "unreadable", where: "this tree", cause: e instanceof Error ? e.message : String(e) };
    }
    const p = parseAssignments(text);
    return p.ok ? { kind: "ok", where: "this tree", data: p.data } : { kind: "unreadable", where: "this tree", cause: p.error };
  }
  const where = ref;
  // ls-tree tells ABSENT ("") from a failed read (null); git show's stderr text would not.
  const listed = gitLine(projectRoot, ["ls-tree", ref, "--", ASSIGNMENTS_REL]);
  if (listed === null) return { kind: "unreadable", where, cause: `git could not list ${ref}` };
  if (listed === "") return { kind: "unreadable", where, cause: "absent" };
  const shown = gitShow(projectRoot, ref, ASSIGNMENTS_REL);
  if (!shown.ok) return { kind: "unreadable", where, cause: shown.cause };
  const p = parseAssignments(shown.text);
  return p.ok ? { kind: "ok", where, data: p.data } : { kind: "unreadable", where, cause: p.error };
}

/* ---------------------------------------------------------------- render */

/**
 * The block `ob_start` prints. Developer and QA seats get it, always: an assignment or the
 * literal `no assignment`. Any other seat gets one line saying the block is not shown, so an
 * omitted section is never mistaken for an empty one.
 */
export function renderAssignment(seat: string | null, read: AssignmentsRead): string[] {
  if (seat !== "developer" && seat !== "qa") {
    return [`\nAssignment: not shown for ${seat ? `the ${seat} seat` : "an unresolved seat"} (developer and qa seats only)`];
  }
  const lines = [`\n## Assignment (${seat}; from ${read.where})`];
  if (read.kind === "unreadable") {
    lines.push(`UNREADABLE — ${read.cause}. This is NOT "no assignment": ask the planner what this seat is assigned.`);
    return lines;
  }
  const live = read.kind === "ok" ? read.data.assignments.find((a) => a.seat === seat && a.status === "live") : undefined;
  if (!live) {
    lines.push("no assignment");
    return lines;
  }
  lines.push(
    `${live.task_id} — assigned ${live.date} (sidecar rev ${live.set_rev}, session ${live.session})`,
    `Brief: ${live.brief}`,
    `Owed: ${live.owed}`,
    `This is the session's work. The NEXT list below is a ranked backlog, not a plan.`,
  );
  return lines;
}

/* ----------------------------------------------------------------- write */

const SetOp = z.strictObject({
  op: z.literal("set_assignment"),
  seat: z.string(),
  task_id: z.string().optional(),
  brief: z.string().optional(),
  owed: z.string().optional(),
  date: z.string().optional(),
});
const ClearOp = z.strictObject({ op: z.literal("clear_assignment"), seat: z.string() });
const AnyOp = z.union([SetOp, ClearOp]);

export const ASSIGNMENT_OPS = ["set_assignment", "clear_assignment"] as const;

/** "assignment" when every op is one, "other" when none is; a mixed batch is refused by the caller. */
export function classifyOps(ops: unknown[]): "assignment" | "other" | "mixed" {
  const is = (o: unknown) =>
    typeof o === "object" && o !== null && (ASSIGNMENT_OPS as readonly string[]).includes((o as { op?: unknown }).op as string);
  const n = ops.filter(is).length;
  return n === 0 ? "other" : n === ops.length ? "assignment" : "mixed";
}

export interface AssignmentWriteArgs {
  session: number;
  expected_revision: number;
  ops: unknown[];
  dry_run?: boolean;
}
export type AssignmentWriteResult =
  | { ok: true; dry_run: boolean; revision_before: number; revision_after: number; applied: string[]; superseded: string[] }
  | { ok: false; error: string; revision_before: number };

export function applyAssignmentOps(projectRoot: string, args: AssignmentWriteArgs): AssignmentWriteResult {
  const path = join(projectRoot, ASSIGNMENTS_REL);
  let file: AssignmentsFile = { schema_version: 1, revision: 0, assignments: [] };
  if (existsSync(path)) {
    const p = parseAssignments(readFileSync(path, "utf8"));
    if (!p.ok) return { ok: false, error: `${ASSIGNMENTS_REL} does not parse: ${p.error}`, revision_before: -1 };
    file = p.data;
  }
  const before = file.revision;
  const refuse = (error: string): AssignmentWriteResult => ({ ok: false, error, revision_before: before });
  if (args.expected_revision !== before) {
    return refuse(
      `expected_revision ${args.expected_revision} does not match the assignments revision ${before} (this file has its OWN counter, 0 when absent; it is not the record's revision)`,
    );
  }
  if (!Number.isInteger(args.session) || args.session < 0) return refuse("session must be a non-negative integer");
  if (args.ops.length === 0) return refuse("no ops");

  let tasks: Map<string, string> | null = null;
  const taskStatuses = (): Map<string, string> | string => {
    if (tasks) return tasks;
    const sp = join(projectRoot, ".agents", "state.json");
    if (!existsSync(sp)) return "no .agents/state.json here to check the task against";
    const parsed = parseState(readFileSync(sp, "utf8"));
    if (!parsed.ok) return `.agents/state.json does not parse (${parsed.error}), so the task cannot be checked`;
    tasks = new Map(parsed.data.tasks.map((t) => [t.id, t.status]));
    return tasks;
  };

  const rev = before + 1;
  const applied: string[] = [];
  const superseded: string[] = [];
  const next: AssignmentEntry[] = file.assignments.map((a) => ({ ...a }));

  for (const [i, raw] of args.ops.entries()) {
    const at = `ops[${i}]`;
    const parsed = AnyOp.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return refuse(`${at} invalid: ${issue.path.join(".") || "$"}: ${issue.message}`);
    }
    const op = parsed.data;
    const seat = SeatName.safeParse(op.seat);
    if (!seat.success) return refuse(`${at} unknown seat "${op.seat}" (one of planner, developer, qa)`);
    if (!(ASSIGNABLE_SEATS as readonly string[]).includes(seat.data)) {
      return refuse(`${at} the ${seat.data} seat cannot be assigned: only developer and qa seats take a dispatch`);
    }
    const s: Seat = seat.data;
    const live = next.find((a) => a.seat === s && a.status === "live");

    if (op.op === "clear_assignment") {
      if (!live) return refuse(`${at} ${s} has no live assignment to clear`);
      live.status = "cleared";
      live.ended_rev = rev;
      applied.push(`clear_assignment ${s} ${live.task_id}`);
      continue;
    }

    if (!op.task_id || op.task_id.trim() === "") {
      return refuse(`${at} task_id is required: a job the record cannot name is the problem this file exists to fix`);
    }
    if (!op.brief || op.brief.trim() === "") return refuse(`${at} brief is required (a path or a turn; for QA also the QA number and PR)`);
    if (!op.owed || op.owed.trim() === "") return refuse(`${at} owed is required`);
    if (!op.date || !ISO_DATE.test(op.date)) return refuse(`${at} date must be YYYY-MM-DD`);
    const known = taskStatuses();
    if (typeof known === "string") return refuse(`${at} ${known}`);
    const status = known.get(op.task_id);
    if (status === undefined) return refuse(`${at} task ${op.task_id} is not in the record`);
    if (status === "done") return refuse(`${at} task ${op.task_id} is done, not active`);
    if (live) {
      live.status = "superseded";
      live.ended_rev = rev;
      superseded.push(`${s} ${live.task_id}`);
    }
    next.push({
      seat: s,
      task_id: op.task_id,
      brief: op.brief,
      owed: op.owed,
      date: op.date,
      status: "live",
      set_rev: rev,
      ended_rev: null,
      session: args.session,
    });
    applied.push(`set_assignment ${s} ${op.task_id}`);
  }

  const out: AssignmentsFile = { schema_version: 1, revision: rev, assignments: next };
  const check = AssignmentsFileSchema.safeParse(out);
  if (!check.success) return refuse(`the result would not validate: ${check.error.issues[0].message}`);
  if (!args.dry_run) {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, serializeAssignments(out), "utf8");
    renameSync(tmp, path);
  }
  return { ok: true, dry_run: !!args.dry_run, revision_before: before, revision_after: rev, applied, superseded };
}
