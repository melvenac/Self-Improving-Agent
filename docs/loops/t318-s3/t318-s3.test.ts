import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import * as review from "../../src/pipelines/session-start/metrics-review.js";

/**
 * T-318 S3: `metrics review` lists sessions that greeted through ob_start and left no ob_end row, counted from the first
 * end row on (ob_end wrote none before S2), leaving out each checkout's newest session (it may still be running).
 */
type Fn = (g: string[], e: string[], since: string | null) => { scanned: number; flagged: Array<{ checkout: string; session: number | null }>; from: string | null };
// Looked up by name so the rows also run (and go red) against the product before S3 adds the functions.
const reviewNoEnd = (review as unknown as Record<string, Fn>).reviewNoEnd;
const renderNoEnd = (review as unknown as Record<string, (r: unknown, p: string) => string[]>).renderNoEnd;

const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const cliEntry = join(import.meta.dirname, "../../src/cli.ts");

const greet = (ts: string, session: number | null, caller = "mcp", checkout = "fleet") =>
  JSON.stringify({ schema: 1, id: `g-${ts}`, ts: `2026-10-23T${ts}:00.000Z`, caller, checkout, agent: "Clark", session });
const end = (ts: string, session: number, checkout = "fleet") =>
  JSON.stringify({ schema: 1, id: `e-${ts}`, ts: `2026-10-23T${ts}:00.000Z`, checkout, seat: "planner", session, outcome: "closed" });

let dir: string;
let gPath: string;
let ePath: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "t318s3-"));
  gPath = join(dir, "greeting-metrics.jsonl");
  ePath = join(dir, "end-metrics.jsonl");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const write = (greetings: string[], ends: string[]) => {
  writeFileSync(gPath, greetings.join("\n") + "\n");
  writeFileSync(ePath, ends.join("\n") + (ends.length ? "\n" : ""));
};
const run = () => reviewNoEnd([`${gPath}.1`, gPath], [`${ePath}.1`, ePath], null);

describe("T-318 S3: greeted, no ob_end", () => {
  it("N1: an earlier session with no end row is listed; the checkout's newest session is not counted", () => {
    write([greet("11:00", 11), greet("12:00", 12)], [end("10:00", 10)]);
    const r = run();
    expect(r.flagged.map((f) => f.session)).toEqual([11]);
    expect(r.scanned).toBe(1);
    expect(renderNoEnd(r, ePath)[0]).toBe(
      "NO END: 1 of 1 earlier session(s) since 2026-10-23T10:00Z greeted and left no ob_end row (each checkout's newest session may still be running, so it is not counted)",
    );
  });

  it("N2: a session with an end row is not listed", () => {
    write([greet("11:00", 11), greet("12:00", 12)], [end("10:00", 10), end("11:30", 11)]);
    const r = run();
    expect(r.flagged).toEqual([]);
    expect(r.scanned).toBe(1);
  });

  it("N3: a greeting before the first end row is not counted (ob_end wrote no rows then)", () => {
    write([greet("09:00", 9), greet("12:00", 12)], [end("10:00", 10)]);
    const r = run();
    expect(r.flagged).toEqual([]);
    expect(r.scanned).toBe(0);
  });

  it("N4: a CLI start (caller cli) and a greeting with no session number are not counted", () => {
    write([greet("11:00", 11, "cli"), greet("11:30", null), greet("12:00", 12)], [end("10:00", 10)]);
    const r = run();
    expect(r.flagged).toEqual([]);
    expect(r.scanned).toBe(0);
  });

  it("N5: two greetings of one session count once (guard)", () => {
    write([greet("11:00", 11), greet("11:05", 11), greet("12:00", 12)], [end("10:00", 10)]);
    const r = run();
    expect(r.scanned).toBe(1);
    expect(r.flagged).toHaveLength(1);
  });

  it("N6: with no end row at all the queue says not checked, not none", () => {
    write([greet("11:00", 11), greet("12:00", 12)], []);
    expect(renderNoEnd(run(), ePath)[0]).toMatch(/^NO END: not checked \(no ob_end row yet in .*end-metrics\.jsonl\)$/);
  });

  it("N7: `open-brain metrics review` prints the NO END queue after the END QUEUE", () => {
    write([greet("11:00", 11), greet("12:00", 12)], [end("10:00", 10)]);
    const r = spawnSync(process.execPath, [tsxCli, cliEntry, "metrics", "review"], {
      encoding: "utf8",
      env: { ...process.env, KNOWLEDGE_V2_DB: join(dir, "knowledge-v2.db") },
    });
    expect(r.status, r.stderr).toBe(0);
    const lines = r.stdout.split(/\r?\n/);
    const at = lines.findIndex((l) => l.startsWith("NO END: 1 of 1 earlier session(s)"));
    expect(at, r.stdout).toBeGreaterThan(lines.findIndex((l) => l.startsWith("END QUEUE:")));
    expect(lines[at + 1]).toBe("- 2026-10-23T11:00Z fleet Clark s11: greeted, no ob_end row");
  }, 60_000);
});
