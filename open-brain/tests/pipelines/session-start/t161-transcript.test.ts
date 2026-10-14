import { describe, it, expect, afterAll, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseState, type State } from "../../../src/shared/state-schema.js";
import * as ps from "../../../src/shared/process-session.js";
import * as b from "../../../src/pipelines/session-start/briefing.js";
import * as sr from "../../../src/pipelines/session-start/start-report.js";

vi.mock("../../../src/pipelines/session-start/hub-presence.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/pipelines/session-start/hub-presence.js")>();
  return { ...actual, describeHubPresence: async () => ({ lines: [], sourceRel: null, charCount: 0 }) };
});

/**
 * T-161: /start says out loud when the session's own transcript does not exist, and is silent when it does.
 * Namespace imports, so a missing export fails its rows rather than the file; transcript-check.ts is loaded per row, so its
 * absence fails P2's rows, not the file.
 */
const transcriptCheck = () => import("../../../src/pipelines/session-start/transcript-check.js");
const STATE_FIXTURE = resolve(import.meta.dirname, "../../fixtures-state/state.json");
const SELF = "00000161-0000-4000-8000-000000000001";
const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

function tmp(prefix = "t161-"): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  made.push(d);
  return d;
}

const ruled = (id: string, path: string): string =>
  `NO TRANSCRIPT: session ${id} has no transcript at ${path}, so /end's transcript checks, the handoff guard and the recall census cannot see it (T-161). Relaunching is the first thing to try; the cause is unknown.`;

describe("P1: proveSession carries the proof's transcript_path", () => {
  const proof = (dir: string, extra: Record<string, unknown>): void =>
    writeFileSync(join(dir, "4242.json"), JSON.stringify({ session_id: SELF, claude_pid: 4242, proc_start: "s", ...extra }));

  it("a proof with transcript_path gives { id, pid, transcriptPath }", () => {
    const d = tmp();
    proof(d, { transcript_path: "C:/t/x.jsonl" });
    expect(ps.proveSession(d, 4242, "s")).toStrictEqual({ id: SELF, pid: 4242, transcriptPath: "C:/t/x.jsonl" });
  });

  it("a proof without one gives exactly { id, pid }", () => {
    const d = tmp();
    proof(d, {});
    expect(ps.proveSession(d, 4242, "s")).toStrictEqual({ id: SELF, pid: 4242 });
  });

  it("an empty transcript_path gives no transcriptPath key", () => {
    const d = tmp();
    proof(d, { transcript_path: "" });
    const r = ps.proveSession(d, 4242, "s");
    expect(r).toStrictEqual({ id: SELF, pid: 4242 });
    expect(Object.keys(r)).not.toContain("transcriptPath");
  });
});

describe("P2: describeTranscript", () => {
  const never = (): boolean => { throw new Error("exists must not be called"); };

  it("an unproven session gives null", async () => {
    const tc = await transcriptCheck();
    expect(tc.describeTranscript({ id: null, reason: "no proof" }, never)).toBeNull();
  });

  it("a proven session with no transcript path gives null", async () => {
    const tc = await transcriptCheck();
    expect(tc.describeTranscript({ id: SELF, pid: 1 }, never)).toBeNull();
  });

  it("a transcript that exists gives null", async () => {
    const tc = await transcriptCheck();
    expect(tc.describeTranscript({ id: SELF, pid: 1, transcriptPath: "C:/t/here.jsonl" }, () => true)).toBeNull();
  });

  it("a missing transcript gives the ruled line, naming the id and the path", async () => {
    const tc = await transcriptCheck();
    const seen: string[] = [];
    const line = tc.describeTranscript({ id: SELF, pid: 1, transcriptPath: "C:/t/gone.jsonl" }, (p) => { seen.push(p); return false; });
    expect(seen).toEqual(["C:/t/gone.jsonl"]);
    expect(line).toBe(ruled(SELF, "C:/t/gone.jsonl"));
    expect(line).toContain(SELF);
    expect(line).toContain("C:/t/gone.jsonl");
  });
});

describe("P3: renderBriefing places the line in both layouts", () => {
  const parsed = parseState(readFileSync(STATE_FIXTURE, "utf8"));
  if (!parsed.ok) throw new Error(parsed.error);
  const state: State = parsed.data;
  const SERVING = "Build abc1234 · current";
  const OLD = "OLD START COMMAND: .claude/commands/start.md is not SIA's copy";
  const LINE = ruled(SELF, "C:/t/gone.jsonl");
  const input = (over: Partial<b.BriefingInput> = {}): b.BriefingInput => ({
    state,
    version: "9.9.9",
    seat: "developer",
    sessionNumber: 161,
    sessionNote: null,
    date: "2026-10-13",
    drift: [],
    serving: SERVING,
    usage: "Usage: GREEN → dispatches open",
    latestBrief: null,
    workingTree: "Working tree: clean",
    skills: "Skills: none",
    ...over,
  } as b.BriefingInput);

  for (const budget of [false, true]) {
    const layout = budget ? "budgeted" : "default";

    it(`${layout}: the line comes right after the serving line`, () => {
      const lines = b.renderBriefing(input({ budget, transcript: LINE } as Partial<b.BriefingInput>));
      const at = lines.indexOf(SERVING);
      expect(at).toBeGreaterThan(-1);
      expect(lines[at + 1]).toBe(LINE);
      expect(lines.filter((l) => l === LINE)).toHaveLength(1);
    });

    it(`${layout}: with oldStartCommand set too, the line comes right after it`, () => {
      const lines = b.renderBriefing(input({ budget, oldStartCommand: OLD, transcript: LINE } as Partial<b.BriefingInput>));
      const at = lines.indexOf(SERVING);
      expect(lines.slice(at, at + 3)).toEqual([SERVING, OLD, LINE]);
    });

    it(`${layout}: transcript absent or null renders exactly as without the field`, () => {
      const without = b.renderBriefing(input({ budget }));
      expect(b.renderBriefing(input({ budget, transcript: null } as Partial<b.BriefingInput>))).toEqual(without);
      expect(b.renderBriefing(input({ budget, transcript: undefined } as Partial<b.BriefingInput>))).toEqual(without);
      expect(without.some((l) => l.startsWith("NO TRANSCRIPT"))).toBe(false);
    });
  }
});

describe("P4: renderStartReport names a missing transcript in the header and the Briefing", { timeout: 120_000 }, () => {
  function fixture(): string {
    const dir = tmp("t161-proj-");
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "t161-fixture", version: "0.1.0" }));
    mkdirSync(join(dir, ".agents", "SYSTEM"), { recursive: true });
    mkdirSync(join(dir, ".agents", "SESSIONS"), { recursive: true });
    copyFileSync(STATE_FIXTURE, join(dir, ".agents", "state.json"));
    const git = (...a: string[]) => execFileSync("git", a, { cwd: dir, stdio: "ignore" });
    git("init", "-q");
    git("add", "-A");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "fixture");
    return dir;
  }

  function split(text: string): { header: string[]; briefing: string[] } {
    const lines = text.split("\n");
    const start = lines.indexOf(b.BRIEFING_START);
    const end = lines.indexOf(b.BRIEFING_END);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return { header: lines.slice(0, start), briefing: lines.slice(start, end + 1) };
  }

  it("a missing transcript: NO TRANSCRIPT right after Session ID, and inside the Briefing block", async () => {
    const dir = fixture();
    const missing = join(tmp("t161-tx-"), "gone.jsonl");
    const r = await sr.renderStartReport({
      projectRoot: dir,
      proven: { id: SELF, pid: 4242, transcriptPath: missing },
      callerLabel: "T161",
    } as Parameters<typeof sr.renderStartReport>[0]);
    const { header, briefing } = split(r.text);
    const at = header.findIndex((l) => l.startsWith("Session ID:"));
    expect(at).toBeGreaterThan(-1);
    expect(header[at + 1]).toBe(ruled(SELF, missing));
    expect(briefing).toContain(ruled(SELF, missing));
  });

  it("an existing transcript: NO TRANSCRIPT appears nowhere", async () => {
    const dir = fixture();
    const present = join(tmp("t161-tx-"), "here.jsonl");
    writeFileSync(present, "{}\n");
    const r = await sr.renderStartReport({
      projectRoot: dir,
      proven: { id: SELF, pid: 4242, transcriptPath: present },
      callerLabel: "T161",
    } as Parameters<typeof sr.renderStartReport>[0]);
    split(r.text);
    expect(r.text).not.toContain("NO TRANSCRIPT");
  });
});
