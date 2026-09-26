import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { z } from "zod";
import { StateSchema, serializeState, SeatName, SCHEMA_VERSION, type State, type Seat } from "../../shared/state-schema.js";

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

/*
 * ## v2 → v3 (T-163)
 *
 * v2 keyed handoffs by seat ROLE and kept ONE `last_session`, so a close-out by
 * a second session of the same role erased the first's handoff and uuid (Step 0,
 * record session 118, measured on a scratch copy of this repository's record).
 * v3 keys handoffs by the writing session and replaces `last_session` with
 * `sessions[]`.
 *
 * The migration is LOSSLESS and INVENTS NOTHING: every v2 handoff is kept word
 * for word with `session_uuid` and `checkout` null — v2 never recorded which
 * session or checkout wrote it, and guessing would attribute words to a session
 * that may not have written them. `last_session` becomes the one entry of
 * `sessions[]`, uuid included. Every uuid in the record before is in it after;
 * the tests count them.
 *
 * A null-checkout entry is its own seat instance to retention, so no new write
 * supersedes a migrated entry: the legacy entries leave the record only by a
 * deliberate act, never as a side effect of the next close-out.
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

/**
 * A v2 record, FROZEN here: `StateSchema` is v3 now, so v2's shape must be
 * spelled out to be recognised. Strict on the two fields that change; the rest
 * passes through and is re-validated by v3's schema after the move.
 */
const V2HandoffSchema = z.strictObject({
  seat: SeatName,
  pick_up: z.string(),
  watch_out: z.array(z.string()),
  open_questions: z.array(z.string()),
  session: z.number().int().min(0),
  loop_state: z.unknown(),
});

const V2StateSchema = z
  .object({
    schema_version: z.literal(2),
    revision: z.number().int().min(0),
    handoffs: z.array(V2HandoffSchema),
    last_session: z.strictObject({
      n: z.number().int().min(0),
      date: z.string(),
      uuid: z.string().nullable(),
      seat: SeatName.nullable(),
    }),
  })
  .passthrough();

/** uuid-shaped substrings in a text, counted per distinct value. The migration must not lose one. */
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
export function uuidsIn(text: string): Set<string> {
  return new Set((text.match(UUID_RE) ?? []).map((u) => u.toLowerCase()));
}

export interface MigrateOptions {
  /**
   * Which seat a v1 record's single handoff belongs to. Required for a v1
   * input and never inferred; not read for v2, whose handoffs carry a seat.
   */
  seat?: Seat;
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
  /** Distinct uuids in the file before and after; the migration refuses if any is lost. */
  uuidsBefore: number | null;
  uuidsAfter: number | null;
  /** Human-readable account of exactly what changed. */
  changes: string[];
  error?: string;
}

export function migrateStateFile(path: string, options: MigrateOptions): MigrateResult {
  if (!existsSync(path)) return { ...emptyResult(path), error: `${path} does not exist` };
  const r = migrateStateText(readFileSync(path, "utf8"), options, path);
  if (r.ok && r.output !== null && !options.dryRun) atomicWrite(path, r.output);
  const { output: _output, ...result } = r;
  return result;
}

function emptyResult(path: string): MigrateResult {
  return { ok: false, path, from: null, to: null, revisionBefore: null, revisionAfter: null, uuidsBefore: null, uuidsAfter: null, changes: [] };
}

/**
 * The migration as a PURE function of the text: returns the bytes it would
 * write (`output`, null when there is nothing to write) and writes nothing.
 *
 * Exported so a test can render THIS repository's record as it will be after
 * migration without touching the live file, which on a branch that moves the
 * schema is still at the old version until the migration is run after merge.
 */
export function migrateStateText(
  text: string,
  options: Omit<MigrateOptions, "dryRun">,
  path = "<text>",
): MigrateResult & { output: string | null } {
  const base = { ...emptyResult(path), output: null as string | null };

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { ...base, error: `${path} is not valid JSON — ${(err as Error).message}` };
  }

  // Already migrated: report it and change nothing. Re-running a migration must
  // be safe and must not bump the revision a second time.
  const already = StateSchema.safeParse(raw);
  if (already.success) {
    const n = uuidsIn(text).size;
    return {
      ...base,
      ok: true,
      from: SCHEMA_VERSION,
      to: SCHEMA_VERSION,
      revisionBefore: already.data.revision,
      revisionAfter: already.data.revision,
      uuidsBefore: n,
      uuidsAfter: n,
      changes: [`already at schema v${SCHEMA_VERSION} (revision ${already.data.revision}) — nothing to do`],
    };
  }

  const changes: string[] = [];
  let v2: Record<string, unknown> & z.infer<typeof V2StateSchema>;
  let from: number;

  const asV2 = V2StateSchema.safeParse(raw);
  if (asV2.success) {
    from = 2;
    v2 = asV2.data as typeof v2;
  } else {
    const v1 = V1StateSchema.safeParse(raw);
    if (!v1.success) {
      return { ...base, error: `${path} is not a valid v${SCHEMA_VERSION}, v2 or v1 record (v2 check failed at ${where(asV2.error)}; v1 check failed at ${where(v1.error)})` };
    }
    // A v1 handoff does not say whose it is. Guessing would attribute one seat's
    // words to another and leave no trace of the guess, which is precisely the
    // confusion G-046 already caused once. The caller must say.
    const seat = SeatName.safeParse(options.seat);
    if (!seat.success) {
      return { ...base, from: 1, error: `this is a v1 record: --seat must be one of ${SeatName.options.join(" / ")} — a v1 handoff does not say whose it is, and it is not inferred from the file` };
    }
    from = 1;
    const old = v1.data as unknown as Record<string, unknown> & z.infer<typeof V1StateSchema>;
    const moved: Record<string, unknown> = {
      ...old,
      schema_version: 2,
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
      last_session: { ...old.last_session, seat: options.lastSessionSeat ?? null },
    };
    delete moved.handoff;
    changes.push(`schema_version 1 → 2`);
    changes.push(`handoff (session ${old.handoff.session}) → handoffs[0] with seat "${seat.data}"`);
    changes.push(`handoffs[0].loop_state = null (not reconstructable from v1; the planner's next write must supply it)`);
    changes.push(`last_session.seat = ${options.lastSessionSeat ?? "null"}`);
    v2 = moved as typeof v2;
  }

  const revisionBefore = v2.revision;
  const nextRevision = options.keepRevision ? revisionBefore : revisionBefore + 1;
  const migrated: Record<string, unknown> = {
    ...v2,
    schema_version: SCHEMA_VERSION,
    revision: nextRevision,
    handoffs: v2.handoffs.map((h) => ({ ...h, session_uuid: null, checkout: null })),
    sessions: [{ ...v2.last_session, checkout: null }],
  };
  delete migrated.last_session;

  changes.push(`schema_version 2 → ${SCHEMA_VERSION}`);
  changes.push(
    options.keepRevision
      ? `revision ${revisionBefore} unchanged (--keep-revision: not a live record)`
      : `revision ${revisionBefore} → ${nextRevision}`
  );
  changes.push(
    `handoffs: ${v2.handoffs.length} kept word for word (${v2.handoffs.map((h) => `${h.seat}@${h.session}`).join(", ") || "none"}), ` +
      `session_uuid and checkout null — v2 never recorded either`
  );
  changes.push(
    `last_session → sessions[0]: n ${v2.last_session.n}, ${v2.last_session.date}, uuid ${v2.last_session.uuid ?? "null"}, seat ${v2.last_session.seat ?? "null"}, checkout null`
  );

  const check = StateSchema.safeParse(migrated);
  if (!check.success) {
    return { ...base, from, to: null, revisionBefore, error: `migrated result does not validate at ${where(check.error)} — nothing written` };
  }

  // Every uuid in the record before is in it after (the planner's ruling on
  // T-163: they are the evidence T-163 exists to protect). Counted on the bytes
  // that would be written, so a serializer that dropped a field would refuse.
  const out = serializeState(check.data as State);
  const before = uuidsIn(text);
  const after = uuidsIn(out);
  const lost = [...before].filter((u) => !after.has(u));
  if (lost.length > 0) {
    return { ...base, from, to: null, revisionBefore, uuidsBefore: before.size, uuidsAfter: after.size, error: `the migration would lose ${lost.length} uuid(s): ${lost.join(", ")} — nothing written` };
  }
  changes.push(`uuids: ${before.size} distinct before, ${after.size} after, none lost`);

  return {
    ok: true,
    path,
    from,
    to: SCHEMA_VERSION,
    revisionBefore,
    revisionAfter: check.data.revision,
    uuidsBefore: before.size,
    uuidsAfter: after.size,
    changes,
    output: out,
  };
}

function where(err: z.ZodError): string {
  const issue = err.issues[0];
  return `${issue.path.length ? issue.path.map(String).join(".") : "$"}: ${issue.message}`;
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
