import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { z } from "zod";
import { StateSchema, serializeState, SeatName, type State, type Seat } from "../../shared/state-schema.js";

/**
 * `.agents/state.json` schema v1 → v2: the single `handoff` becomes `handoffs`,
 * an array keyed by seat.
 *
 * ## Why a program and not a hand-edit
 *
 * `applyStateOps` cannot do this. It refuses a file that does not validate
 * against the CURRENT schema, so the moment the schema moves to v2 the writer
 * can no longer read the v1 record it is supposed to migrate — the door locks
 * from the inside. The alternative is editing the record by hand, which is the
 * one thing this project's single-writer rule exists to prevent, and which
 * would leave the change unverifiable and unrepeatable across the three copies
 * that must all move in the same commit.
 *
 * So: a migration is a program, it is tested, it refuses more than it accepts,
 * and it runs identically on the live record, the shipped template and the test
 * fixture.
 *
 * ## The seat is REQUIRED, not guessed
 *
 * A v1 handoff does not say whose it is. The live record's most recent handoff
 * at the time of writing was the QA seat's; the template's is nobody's. Guessing
 * would attribute one seat's words to another and leave no trace of the guess,
 * which is precisely the confusion G-046 already caused once. The caller must
 * say, and a caller that does not is refused.
 *
 * ## It bumps the revision of a RECORD, and only of a record
 *
 * A migration of the live record is a write. Leaving the revision alone would
 * make the v2 file indistinguishable from the v1 file it replaced to anyone
 * holding a revision number, and optimistic concurrency would then accept a
 * write derived from the pre-migration read.
 *
 * A shipped template and a test fixture are not records and have no concurrent
 * writer to protect, so `--keep-revision` leaves their number where it is. Their
 * revision is a parameter chosen to make a starting state readable, not a count
 * of writes. See `MigrateOptions.keepRevision`.
 */

/** A v1 record, validated strictly so a malformed input refuses rather than half-migrating. */
const V1HandoffSchema = z.strictObject({
  pick_up: z.string(),
  watch_out: z.array(z.string()),
  open_questions: z.array(z.string()),
  session: z.number().int().min(0),
});

const V1StateSchema = z
  .object({
    schema_version: z.literal(1),
    revision: z.number().int().min(0),
    handoff: V1HandoffSchema,
    last_session: z.object({
      n: z.number().int().min(0),
      date: z.string(),
      uuid: z.string().nullable(),
    }),
  })
  .passthrough();

export interface MigrateOptions {
  /** Which seat the existing single handoff belongs to. Required; never inferred. */
  seat: Seat;
  /** The seat recorded against `last_session`. Null when genuinely unknown. */
  lastSessionSeat?: Seat | null;
  /** Report only; write nothing. */
  dryRun?: boolean;
  /**
   * Leave `revision` alone.
   *
   * For the LIVE record the revision must move: it is the optimistic-concurrency
   * counter, and a migrated file at the old revision would accept a write derived
   * from the pre-migration read.
   *
   * A shipped TEMPLATE and a test FIXTURE have no concurrency to protect. Their
   * revision is a parameter chosen to make a starting state readable, not a count
   * of writes — a fresh project beginning at revision 1 with no history behind it
   * is a small lie, and a fixture's number is pinned by the tests that read it.
   */
  keepRevision?: boolean;
}

export interface MigrateResult {
  ok: boolean;
  path: string;
  from: number | null;
  to: number | null;
  revisionBefore: number | null;
  revisionAfter: number | null;
  /** Human-readable account of exactly what changed. */
  changes: string[];
  error?: string;
}

export function migrateStateFile(path: string, options: MigrateOptions): MigrateResult {
  const base: MigrateResult = {
    ok: false,
    path,
    from: null,
    to: null,
    revisionBefore: null,
    revisionAfter: null,
    changes: [],
  };

  if (!existsSync(path)) return { ...base, error: `${path} does not exist` };

  const seat = SeatName.safeParse(options.seat);
  if (!seat.success) {
    return { ...base, error: `seat must be one of ${SeatName.options.join(" / ")} — it is not inferred from the file` };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    return { ...base, error: `${path} is not valid JSON — ${(err as Error).message}` };
  }

  // Already migrated: report it and change nothing. Re-running a migration must
  // be safe and must not bump the revision a second time.
  const already = StateSchema.safeParse(raw);
  if (already.success) {
    return {
      ...base,
      ok: true,
      from: 2,
      to: 2,
      revisionBefore: already.data.revision,
      revisionAfter: already.data.revision,
      changes: [`already at schema v2 (revision ${already.data.revision}) — nothing to do`],
    };
  }

  const v1 = V1StateSchema.safeParse(raw);
  if (!v1.success) {
    const issue = v1.error.issues[0];
    const where = issue.path.length ? issue.path.map(String).join(".") : "$";
    return { ...base, error: `${path} is neither a valid v2 record nor a valid v1 record (v1 check failed at ${where}: ${issue.message})` };
  }

  const old = v1.data as unknown as Record<string, unknown> & z.infer<typeof V1StateSchema>;
  const changes: string[] = [];

  const nextRevision = options.keepRevision ? old.revision : old.revision + 1;
  const migrated = {
    ...old,
    schema_version: 2 as const,
    revision: nextRevision,
    handoffs: [
      {
        seat: seat.data,
        pick_up: old.handoff.pick_up,
        watch_out: old.handoff.watch_out,
        open_questions: old.handoff.open_questions,
        session: old.handoff.session,
        // The planner's C3 rows cannot be reconstructed from a v1 record — they
        // were never stored. An empty object would ASSERT "no open PRs, no
        // pending questions", which is a claim this migration has no basis for.
        // Null says the record does not know, and the schema then requires the
        // planner's next write to supply them.
        loop_state: null,
      },
    ],
    last_session: {
      ...old.last_session,
      seat: options.lastSessionSeat ?? null,
    },
  } as Record<string, unknown>;
  delete migrated.handoff;

  changes.push(`schema_version 1 → 2`);
  changes.push(
    options.keepRevision
      ? `revision ${old.revision} unchanged (--keep-revision: not a live record)`
      : `revision ${old.revision} → ${nextRevision}`
  );
  changes.push(`handoff (session ${old.handoff.session}) → handoffs[0] with seat "${seat.data}"`);
  changes.push(`handoffs[0].loop_state = null (not reconstructable from v1; the planner's next write must supply it)`);
  changes.push(`last_session.seat = ${options.lastSessionSeat ?? "null"}`);

  const check = StateSchema.safeParse(migrated);
  if (!check.success) {
    const issue = check.error.issues[0];
    const where = issue.path.length ? issue.path.map(String).join(".") : "$";
    return { ...base, from: 1, to: null, revisionBefore: old.revision, error: `migrated result does not validate at ${where}: ${issue.message} — nothing written` };
  }

  const result: MigrateResult = {
    ok: true,
    path,
    from: 1,
    to: 2,
    revisionBefore: old.revision,
    revisionAfter: check.data.revision,
    changes,
  };

  if (options.dryRun) return result;

  atomicWrite(path, serializeState(check.data as State));
  return result;
}

/** Temp file beside the target, then rename: a reader never sees a half-written record. */
function atomicWrite(path: string, text: string): void {
  const tmp = `${path}.tmp-${process.pid}`;
  try {
    writeFileSync(tmp, text, "utf-8");
    renameSync(tmp, path);
  } catch (err) {
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      /* best effort */
    }
    throw err;
  }
}
