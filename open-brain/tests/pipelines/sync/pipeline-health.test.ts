import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scorePipelineHealth } from "../../../src/pipelines/sync/scorer.js";
import { readLastInvocationTs } from "../../../src/pipelines/session-end/invocation-logger.js";

const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("scorePipelineHealth", () => {
  it("awards full marks for a hook run within 24h and an improving trend", () => {
    const r = scorePipelineHealth({ lastHookRun: iso(2 * HOUR), scoreTrend: "improving" });
    expect(r.score).toBe(10);
    expect(r.max).toBe(10);
  });

  it("is reachable — the category can actually hit its maximum", () => {
    // Regression guard: a dead shadow-recall component used to make 10/10
    // impossible, silently capping this category at 7.
    const best = scorePipelineHealth({ lastHookRun: iso(1 * HOUR), scoreTrend: "improving" });
    expect(best.score).toBe(best.max);
  });

  it("scores a hook run inside 7 days below a same-day run", () => {
    const fresh = scorePipelineHealth({ lastHookRun: iso(2 * HOUR), scoreTrend: "stable" });
    const week = scorePipelineHealth({ lastHookRun: iso(3 * DAY), scoreTrend: "stable" });
    expect(fresh.score).toBeGreaterThan(week.score);
  });

  it("gives no hook credit once the last run is older than 7 days", () => {
    const r = scorePipelineHealth({ lastHookRun: iso(30 * DAY), scoreTrend: "stable" });
    expect(r.details).toMatchObject({ hookRecency: 0 });
  });

  it("treats a null hook run as zero rather than throwing", () => {
    const r = scorePipelineHealth({ lastHookRun: null, scoreTrend: "unknown" });
    expect(r.score).toBe(0);
  });

  it("ranks trends improving > stable > declining > unknown", () => {
    const at = (t: "improving" | "stable" | "declining" | "unknown") =>
      scorePipelineHealth({ lastHookRun: null, scoreTrend: t }).score;
    expect(at("improving")).toBeGreaterThan(at("stable"));
    expect(at("stable")).toBeGreaterThan(at("declining"));
    expect(at("declining")).toBeGreaterThan(at("unknown"));
  });
});

describe("readLastInvocationTs", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "ob-invlog-")); });
  afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

  const logAt = (name: string, lines: string[]) => {
    const p = join(dir, name);
    writeFileSync(p, lines.join("\n") + "\n", "utf-8");
    return p;
  };

  it("returns null when the log does not exist", () => {
    expect(readLastInvocationTs(join(dir, "missing.jsonl"))).toBeNull();
  });

  it("returns the newest timestamp, not merely the last line", () => {
    // Backfill can append older sessions after newer ones.
    const p = logAt("log.jsonl", [
      JSON.stringify({ ts: "2026-07-20 10:00:00", type: "skill", name: "a" }),
      JSON.stringify({ ts: "2026-07-27 09:00:00", type: "skill", name: "b" }),
      JSON.stringify({ ts: "2026-07-01 08:00:00", type: "skill", name: "c" }),
    ]);
    expect(readLastInvocationTs(p)).toBe("2026-07-27 09:00:00");
  });

  it("skips malformed lines instead of failing the whole score", () => {
    const p = logAt("log.jsonl", [
      "{not json",
      JSON.stringify({ ts: "2026-07-27 09:00:00", type: "skill", name: "b" }),
      JSON.stringify({ noTs: true }),
    ]);
    expect(readLastInvocationTs(p)).toBe("2026-07-27 09:00:00");
  });

  it("returns null when no line carries a usable timestamp", () => {
    const p = logAt("log.jsonl", [JSON.stringify({ noTs: true }), "garbage"]);
    expect(readLastInvocationTs(p)).toBeNull();
  });
});
