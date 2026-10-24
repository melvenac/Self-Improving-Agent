import { existsSync, readFileSync } from "node:fs";

/**
 * T-318 S1: review by exception. Every greeting already leaves one row in greeting-metrics.jsonl (T-299); this reads
 * those rows and lists only the ones that tripped a threshold, so a planner reviews the flagged sessions by hand and
 * not the rest. The thresholds are the failure classes the 10-16..10-21 rows showed (T-318 step 0): a handoff written
 * long before the record moved on, a server running an older build than the one on disk, and an alarm the reader saw
 * again the next time without acting on it. Read-only; never writes the file.
 */
export const REVIEW_LAG_REVS = 5;
export const REVIEW_STREAK = 2;

type MetricsRow = { ts?: unknown; checkout?: unknown; agent?: unknown; session?: unknown; handoff_lag_revs?: unknown; stale_process?: unknown; alarm_streaks?: unknown };

export interface ReviewRow {
  ts: string;
  checkout: string;
  agent: string | null;
  session: number | null;
  reasons: string[];
}

export interface ReviewResult {
  /** The files that existed and were read, oldest first. */
  files: string[];
  /** Rows at or after `since` (every parseable row when since is null). */
  scanned: number;
  /** Lines that were not a JSON object with a string ts. */
  skipped: number;
  flagged: ReviewRow[];
}

/** Why one row needs a hand review; empty when it does not. */
export function reviewReasons(row: MetricsRow): string[] {
  const reasons: string[] = [];
  if (typeof row.handoff_lag_revs === "number" && row.handoff_lag_revs > REVIEW_LAG_REVS) reasons.push(`handoff ${row.handoff_lag_revs} revs behind the record`);
  if (row.stale_process === true) reasons.push("STALE PROCESS");
  const streaks = row.alarm_streaks;
  if (streaks !== null && typeof streaks === "object" && !Array.isArray(streaks)) {
    for (const [id, n] of Object.entries(streaks as Record<string, unknown>)) {
      if (typeof n === "number" && n >= REVIEW_STREAK) reasons.push(`${id} ${n} greetings running`);
    }
  }
  return reasons;
}

/** Reads `paths` in order (pass the rotated `.1` first), keeps rows with ts >= since, and flags the ones with a reason. */
export function reviewGreetingMetrics(paths: readonly string[], since: string | null): ReviewResult {
  const result: ReviewResult = { files: [], scanned: 0, skipped: 0, flagged: [] };
  for (const path of paths) {
    if (!existsSync(path)) continue;
    result.files.push(path);
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (line.trim() === "") continue;
      let row: MetricsRow;
      try {
        row = JSON.parse(line) as MetricsRow;
      } catch {
        result.skipped++;
        continue;
      }
      if (row === null || typeof row !== "object" || typeof row.ts !== "string") {
        result.skipped++;
        continue;
      }
      if (since !== null && row.ts < since) continue;
      result.scanned++;
      const reasons = reviewReasons(row);
      if (reasons.length === 0) continue;
      result.flagged.push({
        ts: row.ts,
        checkout: typeof row.checkout === "string" ? row.checkout : "?",
        agent: typeof row.agent === "string" ? row.agent : null,
        session: typeof row.session === "number" ? row.session : null,
        reasons,
      });
    }
  }
  return result;
}

type EndRow = { ts?: unknown; checkout?: unknown; seat?: unknown; session?: unknown; session_uuid?: unknown; outcome?: unknown; detail?: unknown; record_ok?: unknown };

const shortText = (v: unknown): string => (typeof v === "string" && v !== "" ? (v.length > 80 ? `${v.slice(0, 80)}…` : v) : "?");

/**
 * T-318 S2: why one end-metrics row needs a hand review; null when it does not. `closedLater` says a later row of the
 * same session closed (any outcome but refused), so a refusal the session then fixed is not flagged.
 */
export function endReviewReason(row: EndRow, closedLater: boolean): string | null {
  if (row.outcome === "record_ok") return `closed with record_ok: ${shortText(row.record_ok)}`;
  if (row.outcome === "not_checked") return `record not checked: ${shortText(row.detail)}`;
  if (row.outcome === "refused" && !closedLater) return `ob_end refused, never closed: ${shortText(row.detail)}`;
  return null;
}

/** Reads `paths` in order (pass the rotated `.1` first), keeps rows with ts >= since, and flags the ones with a reason. */
export function reviewEndMetrics(paths: readonly string[], since: string | null): ReviewResult {
  const result: ReviewResult = { files: [], scanned: 0, skipped: 0, flagged: [] };
  const rows: EndRow[] = [];
  for (const path of paths) {
    if (!existsSync(path)) continue;
    result.files.push(path);
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (line.trim() === "") continue;
      let row: EndRow;
      try {
        row = JSON.parse(line) as EndRow;
      } catch {
        result.skipped++;
        continue;
      }
      if (row === null || typeof row !== "object" || typeof row.ts !== "string") {
        result.skipped++;
        continue;
      }
      rows.push(row);
    }
  }
  rows.forEach((row, i) => {
    if (since !== null && (row.ts as string) < since) return;
    result.scanned++;
    const closedLater =
      typeof row.session_uuid === "string" &&
      rows.slice(i + 1).some((r) => r.session_uuid === row.session_uuid && typeof r.outcome === "string" && r.outcome !== "refused");
    const reason = endReviewReason(row, closedLater);
    if (reason === null) return;
    result.flagged.push({
      ts: row.ts as string,
      checkout: typeof row.checkout === "string" ? row.checkout : "?",
      agent: typeof row.seat === "string" ? row.seat : null,
      session: typeof row.session === "number" ? row.session : null,
      reasons: [reason],
    });
  });
  return result;
}

type GreetRow = { ts?: unknown; caller?: unknown; checkout?: unknown; agent?: unknown; session?: unknown };

/** The rows of `paths` in order that are JSON objects with a string ts; the rest are counted as skipped. */
function readRows<T extends { ts?: unknown }>(paths: readonly string[]): { files: string[]; rows: T[]; skipped: number } {
  const out = { files: [] as string[], rows: [] as T[], skipped: 0 };
  for (const path of paths) {
    if (!existsSync(path)) continue;
    out.files.push(path);
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (line.trim() === "") continue;
      try {
        const row = JSON.parse(line) as T;
        if (row !== null && typeof row === "object" && typeof row.ts === "string") out.rows.push(row);
        else out.skipped++;
      } catch {
        out.skipped++;
      }
    }
  }
  return out;
}

export type NoEndResult = ReviewResult & { from: string | null };

/**
 * T-318 S3: sessions that greeted through ob_start (caller mcp, with a session number) and left no ob_end row for the
 * same checkout and session. Counted only from the first end row on, since ob_end wrote none before T-318 S2; each
 * checkout's newest greeting is left out, because that session may still be running.
 */
export function reviewNoEnd(greetingPaths: readonly string[], endPaths: readonly string[], since: string | null): NoEndResult {
  const greet = readRows<GreetRow>(greetingPaths);
  const ends = readRows<EndRow>(endPaths);
  const result: NoEndResult = { files: [...greet.files, ...ends.files], scanned: 0, skipped: greet.skipped + ends.skipped, flagged: [], from: null };
  const firstEnd = ends.rows.map((r) => r.ts as string).sort()[0];
  if (firstEnd === undefined) return result;
  const from = since !== null && since > firstEnd ? since : firstEnd;
  result.from = from;
  const key = (checkout: unknown, session: unknown): string => `${String(checkout)}#${String(session)}`;
  const ended = new Set(ends.rows.map((r) => key(r.checkout, r.session)));
  const opened = greet.rows.filter((r) => r.caller === "mcp" && typeof r.session === "number" && typeof r.checkout === "string");
  const newest = new Map<string, string>();
  for (const r of opened) newest.set(r.checkout as string, key(r.checkout, r.session));
  const seen = new Set<string>();
  for (const r of opened) {
    if ((r.ts as string) < from) continue;
    const k = key(r.checkout, r.session);
    if (seen.has(k) || newest.get(r.checkout as string) === k) continue;
    seen.add(k);
    result.scanned++;
    if (ended.has(k)) continue;
    result.flagged.push({ ts: r.ts as string, checkout: r.checkout as string, agent: typeof r.agent === "string" ? r.agent : null, session: r.session as number, reasons: ["greeted, no ob_end row"] });
  }
  return result;
}

/** The NO END lines `open-brain metrics review` prints last. "Not checked" and "none" are different lines. */
export function renderNoEnd(r: NoEndResult, endPath: string): string[] {
  if (r.from === null) return [`NO END: not checked (no ob_end row yet in ${endPath})`];
  const out = [`NO END: ${r.flagged.length} of ${r.scanned} earlier session(s) since ${r.from.slice(0, 16)}Z greeted and left no ob_end row (each checkout's newest session may still be running, so it is not counted)`];
  for (const f of r.flagged) out.push(`- ${f.ts.slice(0, 16)}Z ${f.checkout} ${f.agent ?? "?"} s${f.session ?? "?"}: ${f.reasons.join("; ")}`);
  if (r.skipped > 0) out.push(`(${r.skipped} unreadable line(s) skipped)`);
  return out;
}

/** The END QUEUE lines `open-brain metrics review` prints after the greeting queue. */
export function renderEndReview(r: ReviewResult, since: string | null, mainPath: string): string[] {
  if (r.files.length === 0) return [`END QUEUE: not checked (no ${mainPath}; ob_end writes rows when the repo's .agents/SYSTEM/greeting.json sets greeting_metrics)`];
  const window = since !== null ? ` since ${since}` : "";
  const out = [`END QUEUE: ${r.flagged.length} of ${r.scanned} ob_end call(s)${window} need a look (record_ok, record not checked, refused and never closed)`];
  for (const f of r.flagged) out.push(`- ${f.ts.slice(0, 16)}Z ${f.checkout} ${f.agent ?? "?"} s${f.session ?? "?"}: ${f.reasons.join("; ")}`);
  if (r.skipped > 0) out.push(`(${r.skipped} unreadable line(s) skipped)`);
  return out;
}

/** The report `open-brain metrics review` prints. "None flagged" and "nothing read" are different lines. */
export function renderReview(r: ReviewResult, since: string | null, mainPath: string): string[] {
  if (r.files.length === 0) return [`REVIEW QUEUE: not checked (no ${mainPath}; a repo writes rows when its .agents/SYSTEM/greeting.json sets greeting_metrics)`];
  const window = since !== null ? ` since ${since}` : "";
  const rule = `handoff lag > ${REVIEW_LAG_REVS} revs, STALE PROCESS, an alarm ${REVIEW_STREAK}+ greetings running`;
  const out = [`REVIEW QUEUE: ${r.flagged.length} of ${r.scanned} greeting(s)${window} tripped a threshold (${rule})`];
  for (const f of r.flagged) out.push(`- ${f.ts.slice(0, 16)}Z ${f.checkout} ${f.agent ?? "?"} s${f.session ?? "?"}: ${f.reasons.join("; ")}`);
  if (r.skipped > 0) out.push(`(${r.skipped} unreadable line(s) skipped)`);
  return out;
}
