/**
 * G-062 (a): READS OWED does not list a file whose newest commit carries this seat's own Claude-Session id (this session,
 * or the newest other session of this checkout). Opt-in per repo: greeting.json `reads_owed_own`. Temp repos and temp
 * transcripts; the real ~/.claude is never read.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { State } from "../../../src/shared/state-schema.js";
import { sessionTrailerIds } from "../../../src/shared/handoff-guard.js";
import { describeReadsOwed, ownTrailerIds } from "../../../src/pipelines/session-start/reads-owed.js";
import * as sr from "../../../src/pipelines/session-start/start-report.js";

vi.mock("../../../src/pipelines/session-start/hub-presence.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/pipelines/session-start/hub-presence.js")>();
  return { ...actual, describeHubPresence: async () => ({ lines: [], sourceRel: null, charCount: 0 }) };
});

const STATE_FIXTURE = resolve(import.meta.dirname, "../../fixtures-state/state.json");
const FIXTURE = JSON.parse(readFileSync(STATE_FIXTURE, "utf8")) as State;
const SELF = "00000062-0000-4000-8000-000000000001";
const PREV = "00000062-0000-4000-8000-000000000002";
const OLD = "00000062-0000-4000-8000-000000000003";
const OTHER = "00000062-0000-4000-8000-000000000004";

const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});
const tmp = (prefix: string): string => {
  const d = mkdtempSync(join(tmpdir(), prefix));
  tmps.push(d);
  return d;
};
const git = (cwd: string, ...args: string[]): void => {
  execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=T", ...args], { cwd, stdio: "ignore" });
};
const commit = (cwd: string, rel: string, body: string, trailer: string | null): void => {
  mkdirSync(join(cwd, rel, ".."), { recursive: true });
  writeFileSync(join(cwd, rel), body);
  git(cwd, "add", "-A");
  git(cwd, "commit", "-q", "-m", `write ${rel}`, ...(trailer === null ? [] : ["-m", `Claude-Session: ${trailer}`]));
};
const transcript = (dir: string, name: string, bridge: string | null, padBefore = 0): string => {
  const p = join(dir, name);
  const pad = padBefore > 0 ? `${JSON.stringify({ type: "pad", text: "x".repeat(padBefore) })}\n` : "";
  writeFileSync(p, `{"timestamp":"2026-10-22T00:00:00.000Z"}\n${pad}${bridge === null ? "" : `{"type":"bridge-session","bridgeSessionId":"cse_${bridge}"}\n`}`);
  return p;
};
const bare = (sessions: State["sessions"]): State => ({ ...FIXTURE, sessions, handoffs: [] });

describe("G-062 (a): describeReadsOwed leaves out a file this seat wrote", () => {
  function repo(): string {
    const root = tmp("g062-r-");
    git(root, "init", "-q", "-b", "main");
    commit(root, "docs/loops/x-brief.md", "# brief\n", "https://claude.ai/code/session_MINE1");
    commit(root, ".agents/AGENT.md", "# agent\n", "https://claude.ai/code/session_THEIRS");
    return root;
  }

  it("O1: the brief whose newest commit carries an own id is left out; another seat's file stays; no ids leaves the line as before", () => {
    const root = repo();
    const state = bare([]);
    const line = describeReadsOwed(root, state, 5, "planner", "sia-planner", ["MINE1"]);
    expect(line).toBe("READS FIRST (1): .agents/AGENT.md");
    expect(describeReadsOwed(root, state, 5, "planner", "sia-planner")).toBe("READS FIRST (2): docs/loops/x-brief.md · .agents/AGENT.md");
    expect(describeReadsOwed(root, state, 5, "planner", "sia-planner", [])).toBe("READS FIRST (2): docs/loops/x-brief.md · .agents/AGENT.md");
  });

  it("O2: every listed file own is `none` with the count; a later commit by another seat makes the brief owed again", () => {
    const root = repo();
    const state = bare([]);
    expect(describeReadsOwed(root, state, 5, "planner", "sia-planner", ["MINE1", "THEIRS"])).toBe("READS OWED: none (2 written by this seat)");
    commit(root, "docs/loops/x-brief.md", "# brief, amended\n", "https://claude.ai/code/session_THEIRS");
    expect(describeReadsOwed(root, state, 5, "planner", "sia-planner", ["MINE1"])).toBe("READS FIRST (2): docs/loops/x-brief.md · .agents/AGENT.md");
  });
});

describe("G-062 (a): ownTrailerIds", () => {
  it("O3: this session's ids plus the NEWEST other session of this checkout; other checkouts and older sessions do not count", () => {
    const dir = tmp("g062-tx-");
    const cur = transcript(dir, `${SELF}.jsonl`, "CUR");
    transcript(dir, `${PREV}.jsonl`, "PREV");
    transcript(dir, `${OLD}.jsonl`, "OLD");
    transcript(dir, `${OTHER}.jsonl`, "OTHER");
    const state = bare([
      { n: 1, date: "2026-10-01", uuid: OLD, seat: "planner", checkout: "sia-planner", first_rev: 1 },
      { n: 2, date: "2026-10-10", uuid: PREV, seat: "planner", checkout: "sia-planner", first_rev: 5 },
      { n: 3, date: "2026-10-11", uuid: OTHER, seat: "developer", checkout: "sia-forge", first_rev: 9 },
      { n: 4, date: "2026-10-22", uuid: SELF, seat: "planner", checkout: "sia-planner", first_rev: 12 },
    ]);
    expect(ownTrailerIds(state, SELF, cur, "sia-planner")).toEqual(["CUR", "PREV"]);
    expect(ownTrailerIds(state, null, cur, "sia-planner")).toEqual([]);
    expect(ownTrailerIds(state, SELF, undefined, "sia-planner")).toEqual([]);
  });

  it("O4: the earlier session's transcript is read head-only: a bridge id past the head is missed there, found by a full read", () => {
    const dir = tmp("g062-head-");
    const cur = transcript(dir, `${SELF}.jsonl`, "CUR");
    const prev = transcript(dir, `${PREV}.jsonl`, "LATE", 300 * 1024);
    const state = bare([{ n: 2, date: "2026-10-10", uuid: PREV, seat: "planner", checkout: "sia-planner", first_rev: 5 }]);
    expect(ownTrailerIds(state, SELF, cur, "sia-planner")).toEqual(["CUR"]);
    expect(sessionTrailerIds(prev, PREV).ids).toEqual(["LATE"]);
    expect(sessionTrailerIds(prev, PREV, { headOnly: true }).ids).toEqual([]);
  });
});

describe("G-062 (a): renderStartReport", { timeout: 120_000 }, () => {
  function fixture(optIn: boolean): string {
    const dir = tmp("g062-proj-");
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "g062-fixture", version: "0.1.0" }));
    mkdirSync(join(dir, ".agents", "SYSTEM"), { recursive: true });
    mkdirSync(join(dir, ".agents", "SESSIONS"), { recursive: true });
    copyFileSync(STATE_FIXTURE, join(dir, ".agents", "state.json"));
    if (optIn) writeFileSync(join(dir, ".agents", "SYSTEM", "greeting.json"), JSON.stringify({ reads_owed_own: true }));
    git(dir, "init", "-q");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "fixture");
    commit(dir, "docs/loops/g062-brief.md", "# brief\n", "https://claude.ai/code/session_SELFBRIDGE");
    return dir;
  }
  const readsOwedLine = (text: string): string | undefined => text.split("\n").find((l) => /^READS (OWED|FIRST)/.test(l));

  it("O5: opted in, the brief this session committed is not owed; not opted in, it is listed as before", async () => {
    const cur = transcript(tmp("g062-cur-"), `${SELF}.jsonl`, "SELFBRIDGE");
    const on = await sr.renderStartReport({ projectRoot: fixture(true), proven: { id: SELF, pid: 4242, transcriptPath: cur }, callerLabel: "G062" });
    const onLine = readsOwedLine(on.text);
    expect(onLine, on.text).toBeDefined();
    expect(onLine).not.toContain("docs/loops/g062-brief.md");
    expect(onLine).toContain("written by this seat");
    const off = await sr.renderStartReport({ projectRoot: fixture(false), proven: { id: SELF, pid: 4242, transcriptPath: cur }, callerLabel: "G062" });
    expect(readsOwedLine(off.text), off.text).toContain("docs/loops/g062-brief.md");
  });
});
