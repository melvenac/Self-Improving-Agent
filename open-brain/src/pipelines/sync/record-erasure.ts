/**
 * T163-2: no write removes an entry another session added.
 *
 * Reads the COMMITTED history of `.agents/state.json` — every commit on HEAD
 * whose blob differs from a parent's — and, for each step, finds the
 * per-session records (session records and handoffs) present before and absent
 * after. A removal is an ERASURE unless the retention rule the writer applies
 * explains it (`isSuperseded`, recomputed here from the state after the step).
 *
 * The check was the developer seat's own proposal at session 77 (T-163's note).
 * The writer now refuses the erasure structurally (schema v3), so what this
 * catches from here on is everything that bypasses the writer: a hand edit, and
 * above all a MERGE RESOLUTION that keeps one branch's record and drops the
 * other's (G-027 — the revision counter serialises writes within one lineage,
 * not across branches).
 *
 * ## Merges
 *
 * A merge is compared three-way. A record present in a parent and absent from
 * the merge is the merge's erasure when it is present in EVERY parent (the
 * resolution dropped it) or absent from the merge base (one line added it after
 * the fork and the resolution dropped it). A record in the base that one parent
 * no longer has was removed on that parent's line, and is reported there — not
 * twice.
 *
 * ## Legacy history
 *
 * Before schema v3 a close-out REPLACED the last session and the seat's handoff
 * by design, so v2 history is full of erasures, rev 61 and rev 62 among them.
 * Those are counted and listed (`open-brain state erasures`), and fail nothing:
 * they cannot be repaired, and a check permanently red on history is a detector
 * that fires into a block nobody acts on. Only a step whose result is schema v3
 * or later can fail the check.
 *
 * ## Limits, stated in its output
 *
 * A shallow clone has no history to read, and the check SKIPS saying so rather
 * than passing on the one commit it can see. Records are identified by session
 * uuid, or for legacy entries by seat and session number; two legacy entries
 * that share both are one record to this check.
 */
import { execFileSync } from "node:child_process";
import type { CheckResult } from "./types.js";
import { isSuperseded, type InstanceEntry } from "../../shared/state-writer.js";

const STATE_REL = ".agents/state.json";

export interface RecordRef {
  kind: "session" | "handoff";
  key: string;
  session: number;
  uuid: string | null;
  seat: string | null;
  checkout: string | null;
}

export interface Erasure {
  commit: string;
  parent: string;
  merge: boolean;
  revBefore: number | null;
  revAfter: number | null;
  /** True when the state after the step is schema v3 or later — the step the check fails on. */
  enforced: boolean;
  removed: RecordRef;
  /** Records of the same kind the same step added: the session that did the removing. */
  addedBySameStep: RecordRef[];
}

export interface ErasureScan {
  ok: true;
  commits: number;
  steps: number;
  enforcedSteps: number;
  erasures: Erasure[];
}

export type ScanResult = ErasureScan | { ok: false; skip: string };

type Raw = Record<string, unknown>;

/** The per-session records of a state.json of ANY schema version, read loosely. */
export function recordsOf(raw: Raw | null): RecordRef[] {
  if (!raw) return [];
  const out: RecordRef[] = [];
  const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);
  const num = (v: unknown) => (typeof v === "number" ? v : -1);

  if (Array.isArray(raw.sessions)) {
    for (const x of raw.sessions as Raw[]) {
      const uuid = str(x.uuid);
      out.push({ kind: "session", key: uuid ? `s:${uuid}` : `s#${num(x.n)}`, session: num(x.n), uuid, seat: str(x.seat), checkout: str(x.checkout) });
    }
  } else if (raw.last_session && typeof raw.last_session === "object") {
    const x = raw.last_session as Raw;
    const uuid = str(x.uuid);
    out.push({ kind: "session", key: uuid ? `s:${uuid}` : `s#${num(x.n)}`, session: num(x.n), uuid, seat: str(x.seat), checkout: null });
  }

  if (Array.isArray(raw.handoffs)) {
    for (const x of raw.handoffs as Raw[]) {
      const uuid = str(x.session_uuid);
      const seat = str(x.seat);
      out.push({ kind: "handoff", key: uuid ? `h:${uuid}` : `h:${seat}@${num(x.session)}`, session: num(x.session), uuid, seat, checkout: str(x.checkout) });
    }
  } else if (raw.handoff && typeof raw.handoff === "object") {
    const x = raw.handoff as Raw;
    out.push({ kind: "handoff", key: `h:?@${num(x.session)}`, session: num(x.session), uuid: null, seat: null, checkout: null });
  }
  return out;
}

/**
 * Is `r` still in `recs`? By key; a v1 handoff (no seat) matches any handoff of
 * the same session, so the v1 → v2 migration is not read as a removal.
 */
function presentIn(recs: RecordRef[], r: RecordRef): boolean {
  if (recs.some((x) => x.key === r.key)) return true;
  if (r.kind === "handoff" && r.uuid === null && r.seat === null) {
    return recs.some((x) => x.kind === "handoff" && x.uuid === null && x.session === r.session);
  }
  return false;
}

function schemaOf(raw: Raw | null): number {
  return raw && typeof raw.schema_version === "number" ? raw.schema_version : 0;
}

function revisionOf(raw: Raw | null): number | null {
  return raw && typeof raw.revision === "number" ? raw.revision : null;
}

/** Retention, recomputed exactly as the writer applies it, from the state AFTER the step. */
function explainedByRetention(r: RecordRef, after: Raw | null): boolean {
  if (schemaOf(after) < 3) return false;
  const recs = recordsOf(after).filter((x) => x.kind === r.kind);
  const newest = recordsOf(after).filter((x) => x.kind === "session").reduce((m, x) => Math.max(m, x.session), -1);
  const entry: InstanceEntry = { seat: r.seat, checkout: r.checkout, session: r.session };
  const all: InstanceEntry[] = [...recs.map((x) => ({ seat: x.seat, checkout: x.checkout, session: x.session })), entry];
  return isSuperseded(entry, all, newest);
}

/** Pure: the erasures between one parent state and the state after, for a NON-merge step. */
export function erasuresInStep(before: Raw | null, after: Raw | null): { removed: RecordRef; added: RecordRef[] }[] {
  const b = recordsOf(before);
  const a = recordsOf(after);
  const out: { removed: RecordRef; added: RecordRef[] }[] = [];
  for (const r of b) {
    if (presentIn(a, r) || explainedByRetention(r, after)) continue;
    out.push({ removed: r, added: a.filter((x) => x.kind === r.kind && !presentIn(b, x)) });
  }
  return out;
}

/** Pure: the erasures a MERGE resolution made (see the module comment). */
export function erasuresInMerge(parents: Array<Raw | null>, base: Raw | null, after: Raw | null): { removed: RecordRef; added: RecordRef[] }[] {
  const a = recordsOf(after);
  const baseRecs = recordsOf(base);
  const parentRecs = parents.map(recordsOf);
  const seen = new Set<string>();
  const out: { removed: RecordRef; added: RecordRef[] }[] = [];
  for (const recs of parentRecs) {
    for (const r of recs) {
      if (seen.has(r.key) || presentIn(a, r) || explainedByRetention(r, after)) continue;
      const inEveryParent = parentRecs.every((p) => presentIn(p, r));
      const inBase = presentIn(baseRecs, r);
      if (!inEveryParent && inBase) continue; // removed on another line; reported there
      seen.add(r.key);
      out.push({ removed: r, added: a.filter((x) => x.kind === r.kind && !parentRecs.some((p) => presentIn(p, x))) });
    }
  }
  return out;
}

function git(cwd: string, args: string[], input?: string): Buffer {
  return execFileSync("git", args, { cwd, input, stdio: ["pipe", "pipe", "ignore"], maxBuffer: 1024 * 1024 * 1024 });
}

/** Every state.json step on HEAD's history, and the erasures in each. */
export function scanErasures(projectRoot: string): ScanResult {
  try {
    if (git(projectRoot, ["rev-parse", "--is-shallow-repository"]).toString().trim() === "true") {
      return { ok: false, skip: "shallow clone — the history this check reads is not here; fetch full history to run it" };
    }
  } catch {
    return { ok: false, skip: "not a git repository with a HEAD — there is no committed history to read" };
  }

  const lines = git(projectRoot, ["rev-list", "--parents", "HEAD"]).toString().trim().split(/\r?\n/).filter(Boolean);
  const parentsOf = new Map<string, string[]>();
  for (const l of lines) {
    const [c, ...ps] = l.split(" ");
    parentsOf.set(c, ps);
  }
  const shas = [...parentsOf.keys()];

  // One process for every commit's blob id.
  const check = git(projectRoot, ["cat-file", "--batch-check"], shas.map((s) => `${s}:${STATE_REL}`).join("\n") + "\n").toString().split("\n");
  const blobOf = new Map<string, string | null>();
  shas.forEach((s, i) => {
    const m = /^([0-9a-f]{40,64}) blob /.exec(check[i] ?? "");
    blobOf.set(s, m ? m[1] : null);
  });
  if (![...blobOf.values()].some((b) => b !== null)) {
    return { ok: false, skip: `${STATE_REL} is not in HEAD's history — nothing to read` };
  }

  const cache = new Map<string, Raw | null>();
  const load = (blob: string | null): Raw | null => {
    if (blob === null) return null;
    if (!cache.has(blob)) {
      let v: Raw | null = null;
      try {
        v = JSON.parse(git(projectRoot, ["cat-file", "-p", blob]).toString("utf8")) as Raw;
      } catch {
        v = null;
      }
      cache.set(blob, v);
    }
    return cache.get(blob)!;
  };

  const erasures: Erasure[] = [];
  let steps = 0;
  let enforcedSteps = 0;
  for (const c of shas) {
    const bc = blobOf.get(c) ?? null;
    if (bc === null) continue;
    const ps = parentsOf.get(c) ?? [];
    const pbs = ps.map((p) => blobOf.get(p) ?? null);
    if (ps.length === 0 || pbs.every((pb) => pb === bc)) continue;
    const after = load(bc);
    steps++;
    if (steps === 1) continue;
    const enforced = schemaOf(after) >= 3;
    if (enforced) enforcedSteps++;

    if (ps.length === 1) {
      if (pbs[0] === null) continue; // the file was created here
      const before = load(pbs[0]);
      for (const e of erasuresInStep(before, after)) {
        erasures.push({ commit: c, parent: ps[0], merge: false, revBefore: revisionOf(before), revAfter: revisionOf(after), enforced, removed: e.removed, addedBySameStep: e.added });
      }
    } else {
      let base: Raw | null = null;
      try {
        const mb = git(projectRoot, ["merge-base", ...ps]).toString().trim();
        base = load(blobOf.get(mb) ?? null);
      } catch {
        base = null;
      }
      const parents = pbs.map(load);
      for (const e of erasuresInMerge(parents, base, after)) {
        erasures.push({ commit: c, parent: ps.join("+"), merge: true, revBefore: Math.max(...parents.map((p) => revisionOf(p) ?? -1)), revAfter: revisionOf(after), enforced, removed: e.removed, addedBySameStep: e.added });
      }
    }
  }
  return { ok: true, commits: shas.length, steps, enforcedSteps, erasures };
}

export function describeRecord(r: RecordRef): string {
  return `${r.kind} ${r.uuid ?? (r.kind === "handoff" ? `${r.seat ?? "?"}@${r.session}` : `#${r.session}`)} (session ${r.session}${r.seat ? `, ${r.seat}` : ""}${r.checkout ? ` [${r.checkout}]` : ""})`;
}

export function describeErasure(e: Erasure): string {
  const by = e.addedBySameStep.length ? e.addedBySameStep.map(describeRecord).join(", ") : "no record of the same kind added";
  return `rev ${e.revBefore ?? "?"}→${e.revAfter ?? "?"} (${e.commit.slice(0, 7)}${e.merge ? ", merge" : ""}): removed ${describeRecord(e.removed)}; added by the same step: ${by}`;
}

/** The /sync check. Fails only on an erasure in a step whose result is schema v3 or later. */
export function checkRecordErasure(projectRoot: string, scan: (root: string) => ScanResult = scanErasures): CheckResult {
  const name = "record-erasure";
  let r: ScanResult;
  try {
    r = scan(projectRoot);
  } catch (err) {
    return { name, report: true, severity: "skip", message: `skipped — git failed (${(err instanceof Error ? err.message : String(err)).split("\n")[0]}); erasures: unknown` };
  }
  if (!r.ok) return { name, report: true, severity: "skip", message: `skipped — ${r.skip}` };
  const enforced = r.erasures.filter((e) => e.enforced);
  const legacy = r.erasures.length - enforced.length;
  const walked = `walked ${r.commits} commits, ${r.steps} ${STATE_REL} changes (${r.enforcedSteps} at schema v3+)`;
  const legacyNote =
    `${legacy} erasure(s) in schema <3 history, which allowed them and cannot be repaired — listed by \`open-brain state erasures\`, failing nothing`;
  if (enforced.length > 0) {
    const shown = enforced.slice(0, 5).map(describeErasure).join(" | ");
    return { name, report: true, severity: "issue", message: `${enforced.length} record(s) another session added were REMOVED since schema v3: ${shown}${enforced.length > 5 ? ` | +${enforced.length - 5} more` : ""}. ${walked}; ${legacyNote}` };
  }
  return { name, report: true, severity: "pass", message: `0 erasures since schema v3; ${walked}; ${legacyNote}. LIMIT: reads HEAD's committed history only — an uncommitted edit is not seen` };
}
