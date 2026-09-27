// Event-loop-delay instrument for candidate B, Step 0 (G-042). Opt-in: vitest.config.ts loads this file only when
// OPEN_BRAIN_ELD_DIR is set, so an ordinary run is unchanged.
//
// It tells the design's two hypotheses apart (design §1). vitest's worker arms a 60 s timer in ITS OWN event loop
// when it calls onTaskUpdate, so:
//   - H-worker predicts that, at the failure, some worker's loop was blocked for 60 s or more;
//   - H-main predicts no worker stretch near 60 s: the main process was the one that could not answer.
//
// Per test file it records monitorEventLoopDelay's max and p99, the wall time, and, from a plain interval timer, the
// longest gap between ticks with the time that gap ENDED, so a stall can be placed against the error's timestamp in
// the log. One JSON line per file, appended to eld-<pid>.jsonl in OPEN_BRAIN_ELD_DIR (one file per worker process,
// so concurrent workers never share a file).

import { afterAll, beforeAll } from "vitest";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { threadId } from "node:worker_threads";

const dir = process.env.OPEN_BRAIN_ELD_DIR;
const TICK_MS = 100;

if (dir) {
  mkdirSync(dir, { recursive: true });
  const histogram = monitorEventLoopDelay({ resolution: 10 });
  let startedAt = 0;
  let lastTick = 0;
  let gapMaxMs = 0;
  let gapMaxEndedAt = 0;
  let ticker: ReturnType<typeof setInterval> | undefined;

  beforeAll(async () => {
    histogram.reset();
    histogram.enable();
    // The histogram records nothing until its timer has ticked once: a 1.5 s block started right after enable()
    // read as 44 ms, the same block started after one tick read as 1500 ms (measured, node 22). Arm it first.
    await new Promise((r) => setTimeout(r, 3 * 10));
    startedAt = Date.now();
    lastTick = startedAt;
    ticker = setInterval(() => {
      const now = Date.now();
      if (now - lastTick > gapMaxMs) {
        gapMaxMs = now - lastTick;
        gapMaxEndedAt = now;
      }
      lastTick = now;
    }, TICK_MS);
    ticker.unref();
  });

  afterAll(async (suite) => {
    const endedAt = Date.now();
    // The histogram samples on its own timer, so a block that ends just before this hook has not been recorded yet
    // (measured: a 1.5 s probe read eldMaxMs 0 without this). One macrotask later it has.
    await new Promise((r) => setTimeout(r, 2 * 10));
    // The stretch still open when the file finishes counts too; the interval has not had a chance to see it.
    if (endedAt - lastTick > gapMaxMs) {
      gapMaxMs = endedAt - lastTick;
      gapMaxEndedAt = endedAt;
    }
    clearInterval(ticker);
    histogram.disable();
    const ms = (ns: number) => Math.round(ns / 1e6);
    const row = {
      file: (suite as { filepath?: string }).filepath ?? suite.name,
      pid: process.pid,
      threadId,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      wallMs: endedAt - startedAt,
      eldMaxMs: ms(histogram.max),
      eldP99Ms: ms(histogram.percentile(99)),
      gapMaxMs,
      gapMaxEndedAt: gapMaxEndedAt ? new Date(gapMaxEndedAt).toISOString() : null,
    };
    appendFileSync(join(dir, `eld-${process.pid}.jsonl`), JSON.stringify(row) + "\n");
  });
}
