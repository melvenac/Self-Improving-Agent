/**
 * T-318 S1: review by exception over greeting-metrics.jsonl. Thresholds from step 0 (the 26 rows of 10-16..10-21):
 * handoff lag > 5 revs, STALE PROCESS, any alarm 2+ greetings running. Temp files and a spawned CLI; the real
 * ~/.claude is never read.
 */
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { reviewReasons, reviewGreetingMetrics, renderReview, REVIEW_LAG_REVS, REVIEW_STREAK } from "../../src/pipelines/session-start/metrics-review.js";

const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});
const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), "t318-s1-"));
  tmps.push(d);
  return d;
};
const row = (over: Record<string, unknown>): string =>
  JSON.stringify({ schema: 1, ts: "2026-10-20T00:50:00.000Z", checkout: "sia-planner", agent: "Atlas", session: 174, handoff_lag_revs: 0, stale_process: false, alarm_streaks: {}, ...over });

describe("T-318 S1: reviewReasons", () => {
  it("R1: lag above the threshold flags, at the threshold does not", () => {
    expect(REVIEW_LAG_REVS).toBe(5);
    expect(reviewReasons({ handoff_lag_revs: 13 })).toEqual(["handoff 13 revs behind the record"]);
    expect(reviewReasons({ handoff_lag_revs: 5 })).toEqual([]);
    expect(reviewReasons({ handoff_lag_revs: null })).toEqual([]);
  });

  it("R2: STALE PROCESS flags; a first alarm does not, the same alarm a second greeting running does", () => {
    expect(REVIEW_STREAK).toBe(2);
    expect(reviewReasons({ stale_process: true })).toEqual(["STALE PROCESS"]);
    expect(reviewReasons({ alarm_streaks: { tree_stale: 1, tree_diverged: 3 } })).toEqual(["tree_diverged 3 greetings running"]);
    expect(reviewReasons({ handoff_lag_revs: 12, stale_process: true, alarm_streaks: { old_start_command: 2 } })).toEqual([
      "handoff 12 revs behind the record",
      "STALE PROCESS",
      "old_start_command 2 greetings running",
    ]);
  });
});

describe("T-318 S1: reviewGreetingMetrics and renderReview", () => {
  it("R3: reads the rotated file first, counts the window, skips bad lines, flags only rows with a reason", () => {
    const d = tmp();
    const main = join(d, "greeting-metrics.jsonl");
    writeFileSync(`${main}.1`, `${row({ ts: "2026-10-15T10:00:00.000Z", stale_process: true })}\n`);
    writeFileSync(main, [row({ handoff_lag_revs: 13 }), "{ not json", row({ ts: "2026-10-21T09:31:00.000Z", checkout: "tarrantmailer-planner", agent: "Courier", session: 7 }), ""].join("\n"));
    const all = reviewGreetingMetrics([`${main}.1`, main], null);
    expect(all.files).toEqual([`${main}.1`, main]);
    expect(all.scanned).toBe(3);
    expect(all.skipped).toBe(1);
    expect(all.flagged.map((f) => f.ts.slice(0, 10))).toEqual(["2026-10-15", "2026-10-20"]);
    const since = reviewGreetingMetrics([`${main}.1`, main], "2026-10-16");
    expect(since.scanned).toBe(2);
    expect(renderReview(since, "2026-10-16", main)).toEqual([
      "REVIEW QUEUE: 1 of 2 greeting(s) since 2026-10-16 tripped a threshold (handoff lag > 5 revs, STALE PROCESS, an alarm 2+ greetings running)",
      "- 2026-10-20T00:50Z sia-planner Atlas s174: handoff 13 revs behind the record",
      "(1 unreadable line(s) skipped)",
    ]);
  });

  it("R4: no file is 'not checked', not 'none flagged'", () => {
    const main = join(tmp(), "greeting-metrics.jsonl");
    const r = reviewGreetingMetrics([`${main}.1`, main], null);
    expect(r.files).toEqual([]);
    expect(renderReview(r, null, main)[0]).toMatch(/^REVIEW QUEUE: not checked \(no .*greeting-metrics\.jsonl; /);
  });
});

describe("T-318 S1: the CLI", () => {
  const cliEntry = join(import.meta.dirname, "../../src/cli.ts");
  const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
  const run = (home: string, ...args: string[]) => {
    const env = { ...process.env, HOME: home, USERPROFILE: home, KNOWLEDGE_V2_DB: join(home, "knowledge-v2.db") };
    const r = spawnSync(process.execPath, [tsxCli, cliEntry, ...args], { encoding: "utf8", env, cwd: home, timeout: 120_000 });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  };

  it("R5: `metrics review --since` prints the queue from the file beside KNOWLEDGE_V2_DB, and refuses a bad date", () => {
    const home = tmp();
    writeFileSync(join(home, "greeting-metrics.jsonl"), `${row({ handoff_lag_revs: 13 })}\n${row({ ts: "2026-10-21T00:00:00.000Z" })}\n`);
    const ok = run(home, "metrics", "review", "--since", "2026-10-16");
    expect(ok.status, ok.out).toBe(0);
    expect(ok.out).toContain("REVIEW QUEUE: 1 of 2 greeting(s) since 2026-10-16");
    expect(ok.out).toContain("- 2026-10-20T00:50Z sia-planner Atlas s174: handoff 13 revs behind the record");
    const bad = run(home, "metrics", "review", "--since", "yesterday");
    expect(bad.status).toBe(1);
    expect(bad.out).toContain('Invalid --since: expected a date (YYYY-MM-DD), got "yesterday".');
  }, 180_000);
});
