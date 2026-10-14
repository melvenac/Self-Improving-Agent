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

  it("default: the line comes right after the serving line", () => {
    const lines = b.renderBriefing(input({ transcript: LINE }));
    const at = lines.indexOf(SERVING);
    expect(at).toBeGreaterThan(-1);
    expect(lines[at + 1]).toBe(LINE);
    expect(lines.filter((l) => l === LINE)).toHaveLength(1);
  });

  it("default: with oldStartCommand set too, the line comes right after it", () => {
    const lines = b.renderBriefing(input({ oldStartCommand: OLD, transcript: LINE }));
    const at = lines.indexOf(SERVING);
    expect(lines.slice(at, at + 3)).toEqual([SERVING, OLD, LINE]);
  });

  it("budgeted (T-281): no line of its own; the session line ends with TRANSCRIPT_BUDGET_NOTE, and the line count is unchanged", () => {
    const without = b.renderBriefing(input({ budget: true }));
    const lines = b.renderBriefing(input({ budget: true, transcript: LINE }));
    expect(b.TRANSCRIPT_BUDGET_NOTE).toBe("NO TRANSCRIPT (T-161): /end cannot see this session");
    expect(lines).toHaveLength(without.length);
    expect(lines.some((l) => l.includes("NO TRANSCRIPT: session"))).toBe(false);
    const at = without.findIndex((l) => l.startsWith("Session 161 — "));
    expect(at).toBeGreaterThan(-1);
    expect(lines[at]).toBe(`${without[at]} · ${b.TRANSCRIPT_BUDGET_NOTE}`);
    expect(lines.filter((l) => l.includes("NO TRANSCRIPT"))).toHaveLength(1);
  });

  it("budgeted (T-281): with oldStartCommand set too, the lines above the session line are unchanged and the note still rides it", () => {
    const lines = b.renderBriefing(input({ budget: true, oldStartCommand: OLD, transcript: LINE }));
    const at = lines.indexOf(SERVING);
    expect(lines.slice(at, at + 3)).toEqual([SERVING, OLD, "Usage: GREEN → dispatches open"]);
    expect(lines[at + 3]!.startsWith("Session 161 — ")).toBe(true);
    expect(lines[at + 3]!.endsWith(` · ${b.TRANSCRIPT_BUDGET_NOTE}`)).toBe(true);
  });

  for (const budget of [false, true]) {
    const layout = budget ? "budgeted" : "default";

    it(`${layout}: transcript absent or null renders exactly as without the field`, () => {
      const without = b.renderBriefing(input({ budget }));
      expect(b.renderBriefing(input({ budget, transcript: null }))).toEqual(without);
      expect(b.renderBriefing(input({ budget, transcript: undefined }))).toEqual(without);
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
    });
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
    });
    split(r.text);
    expect(r.text).not.toContain("NO TRANSCRIPT");
  });

  it("T-281: the log-skipped branch (no .agents/SESSIONS/) prints NO TRANSCRIPT right after Session ID, and in the Briefing", async () => {
    const dir = fixture();
    rmSync(join(dir, ".agents", "SESSIONS"), { recursive: true, force: true });
    const missing = join(tmp("t161-tx-"), "gone.jsonl");
    const r = await sr.renderStartReport({
      projectRoot: dir,
      proven: { id: SELF, pid: 4242, transcriptPath: missing },
      callerLabel: "T161",
    });
    const { header, briefing } = split(r.text);
    expect(header).toContain("Session log: no .agents/SESSIONS/ dir — log not created");
    const at = header.findIndex((l) => l.startsWith("Session ID:"));
    expect(at).toBeGreaterThan(-1);
    expect(header[at + 1]).toBe(ruled(SELF, missing));
    expect(briefing).toContain(ruled(SELF, missing));
  });
});

describe("T-281 C: an ide:cursor proof's transcript_path is withheld until a live Cursor /start proves the file", () => {
  const CURSOR_TX = "C:/t/agent-transcripts/x/x.jsonl";
  const HOST_CMD = String.raw`C:\AppData\Local\cursor-agent\versions\2026.10.01-e373342\node.exe C:\AppData\Local\cursor-agent\versions\2026.10.01-e373342\index.js`;

  it("C1: the direct-parent read gives exactly { id, pid } for an ide:cursor proof, with or without cursorWalk", () => {
    const d = tmp();
    writeFileSync(join(d, "4242.json"), JSON.stringify({ session_id: SELF, claude_pid: 4242, proc_start: "s", ide: "cursor", transcript_path: CURSOR_TX }));
    expect(ps.proveSession(d, 4242, "s")).toStrictEqual({ id: SELF, pid: 4242 });
    expect(ps.proveSession(d, 4242, "s", { cursorWalk: true, readParent: () => null })).toStrictEqual({ id: SELF, pid: 4242 });
  });

  it("C2: the cursor-agent host walk gives exactly { id, pid } for an ide:cursor proof that carries transcript_path", () => {
    const host = process.ppid;
    const wrapper = process.pid;
    const hostStart = ps.processStartTime(host);
    expect(hostStart).not.toBeNull();
    const chain: Record<number, ps.ProcessParentInfo> = {
      [wrapper]: { pid: wrapper, ppid: host, commandLine: "powershell.exe wrapper" },
      [host]: { pid: host, ppid: 1, commandLine: HOST_CMD },
    };
    const d = tmp();
    ps.writeProcessSession(d, { session_id: SELF, claude_pid: host, proc_start: hostStart!, ide: "cursor", written_at: "", transcript_path: CURSOR_TX });
    expect(ps.proveSession(d, wrapper, ps.processStartTime(wrapper), { cursorWalk: true, readParent: (p) => chain[p] ?? null })).toStrictEqual({ id: SELF, pid: host });
  });

  it("C3: an ide:claude proof still carries its transcript_path", () => {
    const d = tmp();
    writeFileSync(join(d, "4242.json"), JSON.stringify({ session_id: SELF, claude_pid: 4242, proc_start: "s", ide: "claude", transcript_path: "C:/t/x.jsonl" }));
    expect(ps.proveSession(d, 4242, "s")).toStrictEqual({ id: SELF, pid: 4242, transcriptPath: "C:/t/x.jsonl" });
  });
});
