/**
 * T-318 S2: ob_end leaves one end-metrics row per call (same opt-in as the greeting row), and `metrics review` lists the
 * ends a planner reads by hand: record_ok, record not checked, refused and never closed. Temp repos, the scratch
 * KNOWLEDGE_V2_DB from setup-env; the real ~/.claude is never read.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { handleEnd } from "../src/server.js";
import { applyStateOps } from "../src/shared/state-writer.js";
import type { State } from "../src/shared/state-schema.js";
import { buildEndMetricsRow, endMetricsPath, END_TEXT_MAX_CHARS } from "../src/shared/end-metrics.js";
import { endReviewReason, renderEndReview, reviewEndMetrics } from "../src/pipelines/session-start/metrics-review.js";
import { cleanupProof, commitAt, DURING, initNewLayoutRepo, initScratchDb, proveSessionWithTranscript, SESSION_UUID, text, writeTranscript } from "./end-fix.harness.js";

const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});
const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), "t318-s2-"));
  tmps.push(d);
  return d;
};
const endRow = (over: Record<string, unknown>): string =>
  JSON.stringify({ schema: 1, ts: "2026-10-22T01:00:00.000Z", checkout: "sia-planner", session_uuid: "u-1", session: 175, seat: "planner", outcome: "closed", detail: "set_handoff for session u-1", record_ok: null, ...over });

describe("T-318 S2: buildEndMetricsRow", () => {
  it("E1: the row takes session, seat and last_work_rev from sessions[], handoff_rev from the handoff's written_rev, and clips text", () => {
    const state = {
      revision: 40,
      sessions: [{ n: 7, date: "2026-10-22", uuid: "u-7", seat: "planner", checkout: "sia-planner", first_rev: 30, last_work_rev: 38 }],
      handoffs: [{ seat: "planner", session_uuid: "u-7", checkout: "sia-planner", first_rev: 30, written_rev: 39 }],
    } as unknown as State;
    const row = buildEndMetricsRow(
      {
        projectRoot: join(tmpdir(), "sia-planner"),
        sessionUuid: "u-7",
        outcome: "record_ok",
        work: { status: "ok", since: null, branches: [], commits: 3, commitShas: [], tags: [], versionBump: false, unattributed: 1 },
        record: { updated: false, layout: "new", detail: "x".repeat(300) },
        recordOk: "docs only",
        notChecked: null,
      },
      state,
      new Date("2026-10-22T01:02:03.000Z"),
    );
    expect(row).toMatchObject({
      schema: 1,
      ts: "2026-10-22T01:02:03.000Z",
      checkout: "sia-planner",
      session_uuid: "u-7",
      session: 7,
      seat: "planner",
      outcome: "record_ok",
      work: "ok",
      commits: 3,
      unattributed: 1,
      record_rev: 40,
      last_work_rev: 38,
      handoff_rev: 39,
      record_ok: "docs only",
    });
    expect(row.detail).toHaveLength(END_TEXT_MAX_CHARS);
    const none = buildEndMetricsRow({ projectRoot: "/x/y", sessionUuid: null, outcome: "not_checked", work: null, record: null, recordOk: null, notChecked: "no session proof (no proof)" }, null, new Date());
    expect(none).toMatchObject({ session: null, seat: null, work: null, commits: null, record_rev: null, handoff_rev: null, detail: "no session proof (no proof)" });
  });
});

describe("T-318 S2: the end review", () => {
  it("E2: record_ok, not_checked and an unfixed refusal flag; a refusal closed later and a clean close do not", () => {
    expect(endReviewReason({ outcome: "record_ok", record_ok: "docs only" }, false)).toBe("closed with record_ok: docs only");
    expect(endReviewReason({ outcome: "not_checked", detail: "no session proof (no proof)" }, false)).toBe("record not checked: no session proof (no proof)");
    expect(endReviewReason({ outcome: "refused", detail: "no set_handoff for session u-1" }, false)).toBe("ob_end refused, never closed: no set_handoff for session u-1");
    expect(endReviewReason({ outcome: "refused", detail: "no set_handoff" }, true)).toBeNull();
    expect(endReviewReason({ outcome: "closed", detail: "set_handoff for session u-1" }, false)).toBeNull();
  });

  it("E3: reads the rotated file first, pairs a refusal with a later close of the same session, and renders the queue", () => {
    const d = tmp();
    const main = join(d, "end-metrics.jsonl");
    writeFileSync(`${main}.1`, `${endRow({ ts: "2026-10-15T10:00:00.000Z", session_uuid: "u-0", outcome: "record_ok", record_ok: "old" })}\n`);
    writeFileSync(
      main,
      [
        endRow({ ts: "2026-10-22T01:00:00.000Z", outcome: "refused", detail: "no set_handoff for session u-1" }),
        endRow({ ts: "2026-10-22T01:05:00.000Z", outcome: "closed" }),
        "{ not json",
        endRow({ ts: "2026-10-22T02:00:00.000Z", session_uuid: "u-2", checkout: "makerspace-planner", seat: "planner", session: 72, outcome: "refused", detail: "HANDOFF STALE: written at rev 3" }),
        endRow({ ts: "2026-10-22T03:00:00.000Z", session_uuid: null, checkout: "sia-forge", seat: null, session: null, outcome: "not_checked", detail: "no session proof (no proof)" }),
        "",
      ].join("\n"),
    );
    const all = reviewEndMetrics([`${main}.1`, main], null);
    expect(all.files).toEqual([`${main}.1`, main]);
    expect(all.scanned).toBe(5);
    expect(all.skipped).toBe(1);
    const since = reviewEndMetrics([`${main}.1`, main], "2026-10-16");
    expect(renderEndReview(since, "2026-10-16", main)).toEqual([
      "END QUEUE: 2 of 4 ob_end call(s) since 2026-10-16 need a look (record_ok, record not checked, refused and never closed)",
      "- 2026-10-22T02:00Z makerspace-planner planner s72: ob_end refused, never closed: HANDOFF STALE: written at rev 3",
      "- 2026-10-22T03:00Z sia-forge ? s?: record not checked: no session proof (no proof)",
      "(1 unreadable line(s) skipped)",
    ]);
    expect(renderEndReview(reviewEndMetrics([join(d, "absent.jsonl")], null), null, join(d, "absent.jsonl"))[0]).toMatch(/^END QUEUE: not checked \(no .*absent\.jsonl; /);
  });
});

describe("T-318 S2: ob_end writes the row", () => {
  let dir: string;
  const rev = (): number => JSON.parse(readFileSync(join(dir, ".agents", "state.json"), "utf8")).revision as number;
  const write = (op: Record<string, unknown>): void => {
    const r = applyStateOps(dir, { session: 99, expected_revision: rev(), session_uuid: SESSION_UUID, checkout: "sia-test", ops: [op] });
    expect(r.ok, JSON.stringify(r)).toBe(true);
  };
  const optIn = (): void => {
    mkdirSync(join(dir, ".agents", "SYSTEM"), { recursive: true });
    writeFileSync(join(dir, ".agents", "SYSTEM", "greeting.json"), JSON.stringify({ greeting_metrics: true }));
  };
  const rows = (): Record<string, unknown>[] =>
    existsSync(endMetricsPath()) ? readFileSync(endMetricsPath(), "utf8").split("\n").filter((l) => l !== "").map((l) => JSON.parse(l) as Record<string, unknown>) : [];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "t318-s2-end-"));
    initNewLayoutRepo(dir);
    proveSessionWithTranscript(dir, writeTranscript(dir));
    commitAt(dir, DURING, "src/a.ts", "on master");
    initScratchDb();
    rmSync(endMetricsPath(), { force: true });
    rmSync(`${endMetricsPath()}.1`, { force: true });
  });
  afterEach(() => {
    cleanupProof();
    rmSync(endMetricsPath(), { force: true });
    rmSync(dir, { recursive: true, force: true });
  });

  it("E4: opted in, a refusal then a close leave two rows beside KNOWLEDGE_V2_DB, and the review flags neither", async () => {
    optIn();
    expect(dirname(endMetricsPath())).toBe(dirname(process.env.KNOWLEDGE_V2_DB!));
    write({ op: "add_decision", title: "a decision", date: "2026-10-22", note: "n" });
    const workRev = rev();
    const refused = await handleEnd({ project_root: dir, session_id: SESSION_UUID });
    expect(refused.isError).toBe(true);
    expect(text(refused)).toMatch(/^RECORD NOT UPDATED:/);
    write({ op: "set_handoff", seat: "developer", pick_up: "pick up", watch_out: [], open_questions: [] });
    const handoffRev = rev();
    const closed = await handleEnd({ project_root: dir, session_id: SESSION_UUID });
    expect(closed.isError, text(closed)).not.toBe(true);
    const r = rows();
    expect(r.map((x) => x.outcome)).toEqual(["refused", "closed"]);
    expect(r[0]).toMatchObject({ session_uuid: SESSION_UUID, session: 99, work: "ok", commits: 1, last_work_rev: workRev, handoff_rev: null });
    expect(String(r[0]!.detail)).toContain("no set_handoff for session");
    expect(r[1]).toMatchObject({ session_uuid: SESSION_UUID, session: 99, seat: "developer", last_work_rev: workRev, handoff_rev: handoffRev, record_rev: handoffRev });
    const review = reviewEndMetrics([endMetricsPath()], null);
    expect(review.scanned).toBe(2);
    expect(review.flagged).toEqual([]);
  }, 180_000);

  it("E5: not opted in, or a dry run, writes no row", async () => {
    write({ op: "set_handoff", seat: "developer", pick_up: "pick up", watch_out: [], open_questions: [] });
    const off = await handleEnd({ project_root: dir, session_id: SESSION_UUID });
    expect(off.isError, text(off)).not.toBe(true);
    expect(rows()).toEqual([]);
    optIn();
    const dry = await handleEnd({ project_root: dir, session_id: SESSION_UUID, dry_run: true });
    expect(dry.isError, text(dry)).not.toBe(true);
    expect(rows()).toEqual([]);
  }, 180_000);
});
