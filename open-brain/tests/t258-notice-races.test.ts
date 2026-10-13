import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as guard from "../src/shared/end-record-guard.js";
import type { SessionWorkScan } from "../src/shared/end-record-guard.js";
import { endRecordProjectDir } from "../src/shared/end-record-store.js";
import { logInvocations } from "../src/pipelines/session-end/invocation-logger.js";

const work: SessionWorkScan = {
  status: "ok",
  since: null,
  branches: [],
  commits: 1,
  commitShas: [],
  tags: [],
  versionBump: false,
  unattributed: 0,
};

let tmp: string;
let proj: string;
let oldDb: string | undefined;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "t258-"));
  proj = join(tmp, "proj");
  mkdirSync(proj, { recursive: true });
  oldDb = process.env.KNOWLEDGE_V2_DB;
  process.env.KNOWLEDGE_V2_DB = join(tmp, "knowledge-v2.db");
});

afterEach(() => {
  if (oldDb === undefined) delete process.env.KNOWLEDGE_V2_DB;
  else process.env.KNOWLEDGE_V2_DB = oldDb;
  rmSync(tmp, { recursive: true, force: true });
});

function marker(name: string): string {
  const dir = endRecordProjectDir(proj);
  mkdirSync(dir, { recursive: true });
  return join(dir, name);
}

function nonBlankLines(path: string): string[] {
  return readFileSync(path, "utf8").split(/\r?\n/).filter((l) => l.trim());
}

const claim = (p: string): string | null =>
  (guard as unknown as { claimMarker: (p: string) => string | null }).claimMarker(p);

describe("T-258 F1: work-after-end writes once per session and message", () => {
  it("R1: the same session and message twice is one line", () => {
    guard.recordWorkAfterEnd(proj, "s1", "m", work);
    guard.recordWorkAfterEnd(proj, "s1", "m", work);
    expect(nonBlankLines(marker(".work-after-end.jsonl"))).toHaveLength(1);
  });

  it("R2: the same session with a new message is recorded", () => {
    guard.recordWorkAfterEnd(proj, "s1", "m1", work);
    guard.recordWorkAfterEnd(proj, "s1", "m2", work);
    expect(nonBlankLines(marker(".work-after-end.jsonl"))).toHaveLength(2);
  });
});

describe("T-258 F5: notice takes claim atomically", () => {
  it("R3: claimMarker succeeds once", () => {
    const path = marker(".work-after-end.jsonl");
    writeFileSync(path, JSON.stringify({ session: "s1", message: "m" }) + "\n");
    const claimed = claim(path);
    expect(typeof claimed).toBe("string");
    expect(existsSync(path)).toBe(false);
    expect(claim(path)).toBeNull();
  });

  it("R4: each take returns the notice once and leaves no claim file", () => {
    const names = [".record-ok.jsonl", ".skills-audit-unaudited.jsonl", ".work-after-end.jsonl"];
    for (const n of names) writeFileSync(marker(n), JSON.stringify({ session: "s1", message: `msg ${n}` }) + "\n");
    const takes = [guard.takeRecordOkNotices, guard.takeSkillsAuditNotices, guard.takeWorkAfterEndNotices];
    for (const take of takes) {
      expect(take(proj)).toHaveLength(1);
      expect(take(proj)).toEqual([]);
    }
    const left = readdirSync(endRecordProjectDir(proj)).filter((f) => f.includes(".claim-"));
    expect(left).toEqual([]);
  });
});

describe("T-258 F6: the invocation log is locked", () => {
  function setup(): { dir: string; log: string; lock: string } {
    const dir = mkdtempSync(join(tmp, "sessions-"));
    const log = join(tmp, "inv.jsonl");
    return { dir, log, lock: `${log}.lock` };
  }

  it("R5: a fresh lock locks the caller out and survives", () => {
    const { dir, log, lock } = setup();
    writeFileSync(lock, "");
    expect(logInvocations(dir, log).lockedOut).toBe(true);
    expect(existsSync(lock)).toBe(true);
  });

  it("R6: a stale lock is taken over and removed", () => {
    const { dir, log, lock } = setup();
    writeFileSync(lock, "");
    const old = new Date(Date.now() - 11 * 60_000);
    utimesSync(lock, old, old);
    expect(logInvocations(dir, log).lockedOut).toBeUndefined();
    expect(existsSync(lock)).toBe(false);
  });

  it("R7: no lock leaves none behind", () => {
    const { dir, log, lock } = setup();
    expect(logInvocations(dir, log).lockedOut).toBeUndefined();
    expect(existsSync(lock)).toBe(false);
  });
});
