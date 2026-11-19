/**
 * T-357: scripts/ctx-metrics.mjs, context efficiency per seat. One row per seat per CLOSED ISO week, read from
 * Claude Code transcripts. Every transcript here is written by the test into a temp folder; nothing reads ~/.claude.
 * CM-1 to CM-14 are round one's rows, some widened; CM-15 to CM-20 and the widenings answer the review of PR #1160.
 */
import { afterAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error — a plain .mjs module outside the TypeScript project
import { addNote, appendRows, checkConfig, feedFile, isTypedTurn, main, median, newSeat, noteLine, p90, readSeat, rowsFor, weekClosed, weekStart } from "../../scripts/ctx-metrics.mjs";

type Rec = Record<string, unknown>;
const temps: string[] = [];
const temp = (): string => { const d = mkdtempSync(join(tmpdir(), "t357-")); temps.push(d); return d; };
afterAll(() => { for (const d of temps) rmSync(d, { recursive: true, force: true }); });

const call = (id: string, ts: string, ctx: number, extra: Rec = {}): Rec => ({
  type: "assistant", timestamp: ts, version: "2.1.300",
  message: { id, model: "model-a", usage: { input_tokens: 10, cache_read_input_tokens: ctx - 110, cache_creation_input_tokens: 100, output_tokens: 5 } },
  ...extra,
});
const typed = (uuid: string, ts: string, text = "go on"): Rec => ({ type: "user", uuid, timestamp: ts, origin: { kind: "human" }, message: { role: "user", content: text } });
const toolResult = (ts: string, ...chars: number[]): Rec => ({
  type: "user", timestamp: ts, toolUseResult: {},
  message: { role: "user", content: chars.map((n) => ({ type: "tool_result", tool_use_id: "t", content: "x".repeat(n) })) },
});
const boundary = (uuid: string, ts: string, meta: Rec): Rec => ({ type: "system", subtype: "compact_boundary", uuid, timestamp: ts, compactMetadata: { trigger: "auto", ...meta } });
const write = (path: string, recs: Rec[]): void => { writeFileSync(path, recs.map((r) => JSON.stringify(r)).join("\n") + "\n"); };

const NOW = "2026-11-19T12:00:00Z"; // a Thursday: the weeks of 11-02 and 11-09 are closed, the week of 11-16 is open

/** One seat: three session files and one subagent file. Returns the transcript root and the seat's folder name. */
function fixture(): { root: string; folder: string } {
  const root = temp();
  const folder = "seat-one";
  const dir = join(root, folder);
  mkdirSync(join(dir, "a", "subagents"), { recursive: true });
  write(join(dir, "a.jsonl"), [
    { type: "custom-title", title: "no timestamp, not a wanted record" },
    typed("u1", "2026-11-09T10:00:00Z"),
    call("a1", "2026-11-09T10:01:00Z", 20000),
    call("a1", "2026-11-09T10:01:01Z", 20000), // the same reply's second streamed record
    toolResult("2026-11-09T10:02:00Z", 500),
    call("a2", "2026-11-09T10:03:00Z", 21000),
    toolResult("2026-11-09T10:04:00Z", 1000, 500),
    call("a3", "2026-11-09T10:05:00Z", 24000),
    { type: "user", uuid: "p1", timestamp: "2026-11-09T11:00:00Z", origin: { kind: "peer" }, isMeta: true, message: { role: "user", content: "Another Claude session sent a message" } },
    { type: "attachment", timestamp: "2026-11-09T11:30:00Z", attachment: { type: "queued_command", delivery_id: "n1", origin: { kind: "task-notification" }, prompt: "<task-notification>" } },
    toolResult("2026-11-10T08:59:00Z", 100),
    call("a4", "2026-11-10T09:00:00Z", 23000), // a drop without a compaction: no growth sample
    { type: "attachment", attachment: { type: "queued_command", delivery_id: "q1", origin: { kind: "human" }, prompt: "typed while working", timestamp: Date.parse("2026-11-10T09:30:00Z") } },
    { type: "assistant", timestamp: "2026-11-10T09:31:00Z", message: { id: "syn1", model: "<synthetic>", usage: { input_tokens: 0, output_tokens: 0 } } },
    { type: "assistant", timestamp: "2026-11-10T09:32:00Z", isSidechain: true, message: { id: "s3", model: "model-a", usage: { input_tokens: 5, output_tokens: 5 } } },
    boundary("b1", "2026-11-10T12:00:00Z", { preTokens: 200000, postTokens: 20000 }),
    call("a5", "2026-11-10T12:01:00Z", 20500, { version: "2.1.301", message: { id: "a5", model: "model-b", usage: { input_tokens: 20500, output_tokens: 5 } } }),
    toolResult("2026-11-10T12:04:00Z", 700),
    call("a6", "2026-11-10T12:05:00Z", 20900),
    boundary("b2", "2026-11-11T12:01:00Z", { preTokens: 400000, postTokens: 30000 }),
    toolResult("2026-11-11T12:59:00Z", 900),
    call("a7", "2026-11-11T13:00:00Z", 30500),
  ]);
  write(join(dir, "b.jsonl"), [
    call("c1", "2026-11-12T08:00:00Z", 18000),
    call("a2", "2026-11-12T08:01:00Z", 21000), // a resumed session repeating an id from a.jsonl
    typed("u1", "2026-11-12T08:02:00Z"), // and repeating a typed turn's uuid
    call("c2", "2026-11-17T08:00:00Z", 19000), // the open week
  ]);
  write(join(dir, "c.jsonl"), [call("z1", "2026-11-05T15:00:00Z", 5000)]);
  write(join(dir, "a", "subagents", "agent-1.jsonl"), [
    { type: "assistant", timestamp: "2026-11-10T10:00:00Z", agentId: "g", message: { id: "s1", model: "model-a", usage: { input_tokens: 5, output_tokens: 5 } } },
    { type: "assistant", timestamp: "2026-11-10T10:00:01Z", agentId: "g", message: { id: "s1", model: "model-a", usage: { input_tokens: 5, output_tokens: 5 } } },
    { type: "assistant", timestamp: "2026-11-10T10:01:00Z", agentId: "g", isSidechain: true, message: { id: "s2", model: "model-a", usage: { input_tokens: 5, output_tokens: 5 } } },
    { type: "user", timestamp: "2026-11-10T10:02:00Z", agentId: "g", origin: { kind: "human" }, message: { role: "user", content: "a subagent's prompt is not a typed turn" } },
  ]);
  return { root, folder };
}

const WEEK_1109 = {
  schema: 1, seat: "s1", week: "2026-11-09",
  calls: 8, active_days: 4, user_turns: 2,
  sessions_started: 2, first_call_ctx_median: 19000,
  growth_median: 1000, growth_p90: 3000,
  tool_result_chars_median: 300, tool_result_chars_p90: 1500,
  compactions: 2, pre_tokens_median: 300000, pre_tokens_max: 400000, post_tokens_median: 25000,
  win_calls_median: 3, win_turns_median: 1, win_hours_median: 25,
  windows_open_end: 1,
  sidechain_calls: 3, sidechain_share: 0.273,
  models: { "model-a": 7, "model-b": 1 }, cc_versions: { "2.1.300": 7, "2.1.301": 1 },
  generated_at: "2026-11-19T12:00:00.000Z",
};
const WEEK_1102 = {
  schema: 1, seat: "s1", week: "2026-11-02",
  calls: 1, active_days: 1, user_turns: 0,
  sessions_started: 1, first_call_ctx_median: 5000,
  growth_median: null, growth_p90: null,
  tool_result_chars_median: 0, tool_result_chars_p90: 0,
  compactions: 0, pre_tokens_median: null, pre_tokens_max: null, post_tokens_median: null,
  win_calls_median: null, win_turns_median: null, win_hours_median: null,
  windows_open_end: 1,
  sidechain_calls: 0, sidechain_share: 0,
  models: { "model-a": 1 }, cc_versions: { "2.1.300": 1 },
  generated_at: "2026-11-19T12:00:00.000Z",
};

describe("ctx-metrics (T-357)", () => {
  it("CM-1 weekStart is the Monday (UTC) of the week, across a year boundary, and null for an unreadable time", () => {
    expect(weekStart("2026-11-09T00:00:00Z")).toBe("2026-11-09");
    expect(weekStart("2026-11-15T23:59:59Z")).toBe("2026-11-09");
    expect(weekStart("2026-11-16T00:00:00Z")).toBe("2026-11-16");
    expect(weekStart("2027-01-01T12:00:00Z")).toBe("2026-12-28");
    expect(weekStart(Date.parse("2026-11-10T09:30:00Z"))).toBe("2026-11-09");
    expect(weekStart("not a time")).toBeNull();
    expect(weekStart(undefined)).toBeNull();
  });

  it("CM-2 a week is closed from the next Monday 00:00 UTC, not a second before", () => {
    expect(weekClosed("2026-11-09", "2026-11-15T23:59:59Z")).toBe(false);
    expect(weekClosed("2026-11-09", "2026-11-16T00:00:00Z")).toBe(true);
    expect(weekClosed("2026-11-16", NOW)).toBe(false);
    // The instant decides, whatever zone `now` is written in.
    expect(weekClosed("2026-11-09", "2026-11-16T00:00:00.000+01:00")).toBe(false); // Sunday 23:00 UTC
    expect(weekClosed("2026-11-09", "2026-11-15T19:00:00-05:00")).toBe(true); // Monday 00:00 UTC
  });

  it("CM-3 median and p90", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(p90([])).toBeNull();
    expect(p90([5])).toBe(5);
    expect(p90([10, 9, 8, 7, 6, 5, 4, 3, 2, 1])).toBe(9);
    expect(p90([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).toBe(10);
  });

  it("CM-4 a typed turn: the user's own text only, by origin where there is one, by its opening where there is none", () => {
    const user = (content: unknown, extra: Rec = {}): Rec => ({ type: "user", message: { role: "user", content }, ...extra });
    expect(isTypedTurn(user("merge it", { origin: { kind: "human" } }))).toBe(true);
    expect(isTypedTurn(user("<command-message>start</command-message>", { origin: { kind: "human" } }))).toBe(true);
    expect(isTypedTurn(user("a peer wrote this", { origin: { kind: "peer" } }))).toBe(false);
    expect(isTypedTurn(user("<task-notification>", { origin: { kind: "task-notification" } }))).toBe(false);
    expect(isTypedTurn(user("an older record with no origin"))).toBe(true);
    expect(isTypedTurn(user([{ type: "text", text: "an older record, as blocks" }]))).toBe(true);
    expect(isTypedTurn(user("  <task-notification> older"))).toBe(false);
    expect(isTypedTurn(user("Another Claude session sent a message:"))).toBe(false);
    expect(isTypedTurn(user("[Request interrupted by user]"))).toBe(false);
    expect(isTypedTurn(user("This session is being continued from a previous conversation"))).toBe(false);
    expect(isTypedTurn(user(""))).toBe(false);
    expect(isTypedTurn(user("meta text", { isMeta: true, origin: { kind: "human" } }))).toBe(false);
    expect(isTypedTurn(user("a summary", { isCompactSummary: true }))).toBe(false);
    expect(isTypedTurn(user([{ type: "tool_result", content: "out" }, { type: "text", text: "plain words beside a result" }]))).toBe(false);
    expect(isTypedTurn({ type: "attachment", attachment: { type: "queued_command", origin: { kind: "human" } } })).toBe(true);
    expect(isTypedTurn({ type: "attachment", attachment: { type: "queued_command", origin: { kind: "peer" } } })).toBe(false);
    expect(isTypedTurn({ type: "attachment", attachment: { type: "hook_success" } })).toBe(false);
    expect(isTypedTurn({ type: "assistant", message: { content: "text" } })).toBe(false);
  });

  it("CM-5 one seat, three session files and a subagent file: the two closed weeks' rows, value for value", async () => {
    const { root, folder } = fixture();
    const r = await readSeat(join(root, folder));
    expect(r.files).toBe(3);
    expect(r.subagentFiles).toBe(1);
    const rows = rowsFor("s1", r.seat, NOW);
    expect(rows.map((x: Rec) => x.week)).toEqual(["2026-11-02", "2026-11-09"]);
    expect(rows[1]).toEqual(WEEK_1109);
    expect(rows[0]).toEqual(WEEK_1102);
  });

  it("CM-6 the open week has no row until its Monday passes; then it has one", async () => {
    const { root, folder } = fixture();
    const { seat } = await readSeat(join(root, folder));
    expect(rowsFor("s1", seat, "2026-11-22T23:59:59Z").map((x: Rec) => x.week)).toEqual(["2026-11-02", "2026-11-09"]);
    const later = rowsFor("s1", seat, "2026-11-23T00:00:00Z");
    expect(later.map((x: Rec) => x.week)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
    expect(later[2].calls).toBe(1);
    expect(later[2].sessions_started).toBe(0);
    expect(later[2].windows_open_end).toBe(1);
  });

  it("CM-7 a call id that two files of one seat both carry is one call", async () => {
    const root = temp();
    mkdirSync(join(root, "s"));
    write(join(root, "s", "one.jsonl"), [call("k1", "2026-11-03T10:00:00Z", 1000), call("k2", "2026-11-03T10:01:00Z", 1200)]);
    write(join(root, "s", "two.jsonl"), [call("k1", "2026-11-03T10:00:00Z", 1000), call("k2", "2026-11-03T10:01:00Z", 1200), call("k3", "2026-11-03T10:02:00Z", 1500)]);
    const { seat } = await readSeat(join(root, "s"));
    const [row] = rowsFor("s", seat, NOW);
    expect(row.calls).toBe(3);
    expect(row.sessions_started).toBe(2); // one.jsonl starts at k1, two.jsonl at its first call not seen before, k3
  });

  it("CM-8 a compaction with no preTokens takes the last call's context; a window with no call is not a sample", async () => {
    const root = temp();
    mkdirSync(join(root, "s"));
    write(join(root, "s", "one.jsonl"), [
      boundary("e0", "2026-11-03T09:00:00Z", { preTokens: 111000 }), // before any call
      call("k1", "2026-11-03T10:00:00Z", 50000),
      { type: "system", subtype: "compact_boundary", uuid: "e1", timestamp: "2026-11-03T11:00:00Z" },
      boundary("e1", "2026-11-03T11:00:01Z", { preTokens: 999000 }), // the same boundary record again
    ]);
    const { seat } = await readSeat(join(root, "s"));
    const [row] = rowsFor("s", seat, NOW);
    expect(row.compactions).toBe(2);
    expect(row.pre_tokens_median).toBe(80500);
    expect(row.pre_tokens_max).toBe(111000);
    expect(row.post_tokens_median).toBeNull();
    expect(row.win_calls_median).toBe(1);
    expect(row.win_hours_median).toBe(1);
    expect(row.windows_open_end).toBe(0);
  });

  it("CM-9 appendRows writes a seat+week once, keeps an unreadable line, and appends a later week", () => {
    const out = join(temp(), "nested", "context-metrics.jsonl");
    expect(appendRows(out, [WEEK_1102, WEEK_1109])).toEqual({ written: 2, skipped: 0 });
    const first = readFileSync(out, "utf8");
    expect(first).toBe(JSON.stringify(WEEK_1102) + "\n" + JSON.stringify(WEEK_1109) + "\n");
    expect(appendRows(out, [WEEK_1102, WEEK_1109])).toEqual({ written: 0, skipped: 2 });
    expect(readFileSync(out, "utf8")).toBe(first);
    writeFileSync(out, first + "not json\n");
    const other = { ...WEEK_1109, seat: "s2" };
    expect(appendRows(out, [WEEK_1109, other, other])).toEqual({ written: 1, skipped: 2 });
    expect(readFileSync(out, "utf8")).toBe(first + "not json\n" + JSON.stringify(other) + "\n");

    // Review F1: a last line with no newline. The new row starts its own line; nothing is glued, lost or rewritten.
    const WEEK_1116 = { ...WEEK_1109, week: "2026-11-16" };
    const all = [WEEK_1102, WEEK_1109, WEEK_1116];
    const [l02, l09, l16] = all.map((r) => JSON.stringify(r));
    const whole = join(temp(), "whole-last-row.jsonl");
    writeFileSync(whole, l02 + "\n" + l09); // a complete last row, no newline after it
    expect(appendRows(whole, all)).toEqual({ written: 1, skipped: 2 });
    expect(readFileSync(whole, "utf8")).toBe(l02 + "\n" + l09 + "\n" + l16 + "\n");
    expect(appendRows(whole, all)).toEqual({ written: 0, skipped: 3 });
    expect(readFileSync(whole, "utf8")).toBe(l02 + "\n" + l09 + "\n" + l16 + "\n");

    const half = join(temp(), "half-last-row.jsonl");
    const cut = l09.slice(0, 44); // a crash in the middle of an append
    writeFileSync(half, l02 + "\n" + cut);
    expect(appendRows(half, all)).toEqual({ written: 2, skipped: 1 });
    expect(readFileSync(half, "utf8")).toBe(l02 + "\n" + cut + "\n" + l09 + "\n" + l16 + "\n");
    expect(appendRows(half, all)).toEqual({ written: 0, skipped: 3 });
    expect(readFileSync(half, "utf8").split("\n").filter((l) => { try { JSON.parse(l); return true; } catch { return false; } })).toEqual([l02, l09, l16]);

    const empty = join(temp(), "empty.jsonl");
    writeFileSync(empty, "");
    expect(appendRows(empty, [WEEK_1102])).toEqual({ written: 1, skipped: 0 });
    expect(readFileSync(empty, "utf8")).toBe(l02 + "\n");
  });

  it("CM-10 addNote creates the change log with its header, adds a dated line once, and refuses a bad date or two lines", () => {
    const file = join(temp(), "context-changes.md");
    expect(addNote(file, "2026-11-19", "code mode A/B, not adopted")).toBe(true);
    const text = readFileSync(file, "utf8");
    expect(text.startsWith("# Context-metrics change log\n")).toBe(true);
    expect(text.endsWith("\n- 2026-11-19 code mode A/B, not adopted\n")).toBe(true);
    expect(addNote(file, "2026-11-19", "  code mode A/B, not adopted  ")).toBe(false);
    expect(readFileSync(file, "utf8")).toBe(text);
    writeFileSync(file, text.slice(0, -1)); // no final newline
    expect(addNote(file, "2026-11-20", "second")).toBe(true);
    expect(readFileSync(file, "utf8")).toBe(text + "- 2026-11-20 second\n");
    expect(() => addNote(file, "2026-02-30", "x")).toThrow("real YYYY-MM-DD");
    expect(() => addNote(file, "11-19", "x")).toThrow("real YYYY-MM-DD");
    expect(() => addNote(file, "2026-11-19", "two\nlines")).toThrow("one line");
    expect(() => addNote(file, "2026-11-19", "   ")).toThrow("one line");
    expect(() => addNote(file, "2026-13-01", "x")).toThrow("real YYYY-MM-DD"); // no such month
    expect(readFileSync(file, "utf8")).toBe(text + "- 2026-11-20 second\n");

    // A dry run says whether the line would be added and writes nothing, not even the folder.
    expect(noteLine("2026-11-21", "  third  ")).toBe("- 2026-11-21 third");
    expect(addNote(file, "2026-11-21", "third", true)).toBe(true);
    expect(addNote(file, "2026-11-20", "second", true)).toBe(false);
    expect(readFileSync(file, "utf8")).toBe(text + "- 2026-11-20 second\n");
    const nowhere = join(temp(), "not-made");
    expect(addNote(join(nowhere, "context-changes.md"), "2026-11-21", "third", true)).toBe(true);
    expect(existsSync(nowhere)).toBe(false);
  });

  it("CM-11 the command line: a config run writes the rows, a rerun writes none, a dry run writes nothing", async () => {
    const { root, folder } = fixture();
    const home = temp();
    const out = join(home, "context-metrics.jsonl");
    const config = join(home, "config.json");
    writeFileSync(config, JSON.stringify({ root, out, seats: { [folder]: "s1" } }));
    const run = async (args: string[]): Promise<{ code: number; logs: string[]; errs: string[] }> => {
      const logs: string[] = [];
      const errs: string[] = [];
      const code = await main(args, (s: string) => logs.push(s), (s: string) => errs.push(s));
      return { code, logs, errs };
    };

    const dry = await run(["--config", config, "--now", NOW, "--dry-run", "--out", join(home, "not-made", "o.jsonl")]);
    expect(dry.code).toBe(0);
    expect(existsSync(out)).toBe(false);
    expect(existsSync(join(home, "not-made"))).toBe(false);
    expect(dry.logs).toEqual([JSON.stringify(WEEK_1102), JSON.stringify(WEEK_1109), "seat s1: 3 file(s), 1 subagent file(s), 2 closed week(s); dry run, nothing written"]);

    const one = await run(["--config", config, "--now", NOW]);
    expect(one).toEqual({ code: 0, errs: [], logs: ["seat s1: 3 file(s), 1 subagent file(s), 2 closed week(s), 2 row(s) written, 0 already recorded", `WROTE 2 row(s) to ${out}`] });
    const bytes = readFileSync(out, "utf8");
    expect(bytes).toBe(JSON.stringify(WEEK_1102) + "\n" + JSON.stringify(WEEK_1109) + "\n");

    const two = await run(["--config", config, "--now", NOW]);
    expect(two.logs).toEqual(["seat s1: 3 file(s), 1 subagent file(s), 2 closed week(s), 0 row(s) written, 2 already recorded", `WROTE 0 row(s) to ${out}`]);
    expect(readFileSync(out, "utf8")).toBe(bytes);

    // A later run, after the open week closed: only the new week is appended, and the old rows keep their bytes.
    const three = await run(["--config", config, "--now", "2026-11-23T00:00:00Z"]);
    expect(three.logs[0]).toBe("seat s1: 3 file(s), 1 subagent file(s), 3 closed week(s), 1 row(s) written, 2 already recorded");
    const lines = readFileSync(out, "utf8").split("\n");
    expect(lines).toHaveLength(4);
    expect(readFileSync(out, "utf8").startsWith(bytes)).toBe(true);
    expect(JSON.parse(lines[2]).week).toBe("2026-11-16");
  });

  it("CM-12 the command line: flags beat the config, a missing folder is exit 1 and named, and bad input is exit 2", async () => {
    const { root, folder } = fixture();
    const home = temp();
    const config = join(home, "config.json");
    writeFileSync(config, JSON.stringify({ root, out: join(home, "from-config.jsonl"), seats: { [folder]: "s1", "no-such-folder": "ghost" } }));
    const logs: string[] = [];
    const errs: string[] = [];
    const log = (s: string): void => { logs.push(s); };
    const err = (s: string): void => { errs.push(s); };
    const out = join(home, "from-flag.jsonl");

    expect(await main(["--config", config, "--out", out, "--now", NOW], log, err)).toBe(1);
    expect(errs).toEqual([`ctx-metrics: seat ghost: no transcript folder ${join(root, "no-such-folder")}`]);
    expect(logs[logs.length - 1]).toBe(`WROTE 2 row(s) to ${out}`);
    expect(existsSync(join(home, "from-config.jsonl"))).toBe(false);

    const out2 = join(home, "by-seat-flag.jsonl");
    expect(await main(["--root", root, "--seat", `${folder}=named`, "--out", out2, "--now", NOW], log, err)).toBe(0);
    expect(JSON.parse(readFileSync(out2, "utf8").split("\n")[0]).seat).toBe("named");

    errs.length = 0;
    expect(await main(["--root", root, "--out", out2], log, err)).toBe(2);
    expect(errs[0]).toContain("no seats");
    expect(await main(["--frobnicate", "x"], log, err)).toBe(2);
    expect(await main(["--seat", "nameonly"], log, err)).toBe(2);
    expect(await main(["--config", join(home, "absent.json")], log, err)).toBe(2);
    expect(await main(["--seat", `${folder}=s1`, "--root", root, "--out", out2, "--now", "soon"], log, err)).toBe(2);

    // A time with no zone would be read in the host's zone: refused.
    errs.length = 0;
    expect(await main(["--seat", `${folder}=s1`, "--root", root, "--out", join(home, "no-zone.jsonl"), "--now", "2026-11-19T12:00:00"], log, err)).toBe(2);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain("zone");
    expect(existsSync(join(home, "no-zone.jsonl"))).toBe(false);

    // A folder name may hold "=": the seat name is what follows the LAST one.
    mkdirSync(join(root, "a=b"));
    write(join(root, "a=b", "x.jsonl"), [call("e1", "2026-11-03T10:00:00Z", 1000)]);
    const out3 = join(home, "eq.jsonl");
    expect(await main(["--root", root, "--seat", "a=b=eqseat", "--out", out3, "--now", NOW], log, err)).toBe(0);
    expect(JSON.parse(readFileSync(out3, "utf8").split("\n")[0]).seat).toBe("eqseat");

    // Review F2: a config of the wrong shape is bad input: exit 2, one line, no stack.
    const badConfigs = ["null", "[]", "\"text\"", "7", "not json", JSON.stringify({ seats: "abc" }), JSON.stringify({ seats: [folder] }),
      JSON.stringify({ seats: { [folder]: 1 } }), JSON.stringify({ seats: { [folder]: " " } }), JSON.stringify({ root: 5, seats: { [folder]: "s1" } }),
      JSON.stringify({ root, out: {}, seats: { [folder]: "s1" } })];
    for (const text of badConfigs) {
      const bad = join(home, "bad.json");
      writeFileSync(bad, text);
      errs.length = 0;
      expect(await main(["--config", bad, "--root", root, "--out", join(home, "bad.jsonl"), "--now", NOW], log, err)).toBe(2);
      expect(errs).toHaveLength(1);
      expect(errs[0].startsWith(`ctx-metrics: config ${bad}: `)).toBe(true);
      expect(errs[0].includes("\n")).toBe(false);
    }
    expect(existsSync(join(home, "bad.jsonl"))).toBe(false);
    expect(checkConfig({ seats: { [folder]: "s1" } })).toBe(undefined);
    expect(() => checkConfig(null)).toThrow("JSON object");
  });

  it("CM-13 the command line: --note writes the change log beside the out file, dated by --date or by --now", async () => {
    const home = temp();
    const out = join(home, "context-metrics.jsonl");
    const logs: string[] = [];
    const errs: string[] = [];
    const log = (s: string): void => { logs.push(s); };
    const err = (s: string): void => { errs.push(s); };
    const changes = join(home, "context-changes.md");
    expect(await main(["--out", out, "--note", "first change", "--date", "2026-11-19"], log, err)).toBe(0);
    expect(await main(["--out", out, "--note", "second change", "--now", "2026-11-25T03:00:00Z"], log, err)).toBe(0);
    expect(await main(["--out", out, "--note", "first change", "--date", "2026-11-19"], log, err)).toBe(0);
    expect(logs).toEqual([`NOTED 2026-11-19 in ${changes}`, `NOTED 2026-11-25 in ${changes}`, `ALREADY NOTED 2026-11-19 in ${changes}`]);
    expect(readFileSync(changes, "utf8").split("\n").filter((l) => l.startsWith("- "))).toEqual(["- 2026-11-19 first change", "- 2026-11-25 second change"]);
    expect(existsSync(out)).toBe(false);
    expect(await main(["--out", out, "--note", "x", "--date", "19 Nov"], log, err)).toBe(2);
    expect(errs[errs.length - 1]).toContain("real YYYY-MM-DD");
    expect(await main(["--out", out, "--note", "x", "--date", "2026-13-01"], log, err)).toBe(2);
    expect(errs[errs.length - 1]).toContain("real YYYY-MM-DD");

    // --dry-run with --note writes nothing and prints the line it would add.
    const before = readFileSync(changes, "utf8");
    logs.length = 0;
    expect(await main(["--out", out, "--note", "a dry one", "--date", "2026-11-19", "--dry-run"], log, err)).toBe(0);
    expect(await main(["--dry-run", "--out", out, "--note", "first change", "--date", "2026-11-19"], log, err)).toBe(0);
    expect(logs).toEqual([`WOULD NOTE in ${changes}: - 2026-11-19 a dry one; dry run, nothing written`, `ALREADY NOTED 2026-11-19 in ${changes}`]);
    expect(readFileSync(changes, "utf8")).toBe(before);
    const fresh = join(temp(), "not-made");
    expect(await main(["--out", join(fresh, "o.jsonl"), "--note", "x", "--date", "2026-11-19", "--dry-run"], log, err)).toBe(0);
    expect(existsSync(fresh)).toBe(false);
  });

  it("CM-15 compaction edges: no size to record, a tool result compacted away, a window with a turn and no call", async () => {
    const root = temp();
    mkdirSync(join(root, "s"));
    write(join(root, "s", "one.jsonl"), [
      { type: "system", subtype: "compact_boundary", uuid: "e0", timestamp: "2026-11-03T09:00:00Z" }, // no metadata, no call before it
      call("k1", "2026-11-03T10:00:00Z", 50000),
      toolResult("2026-11-03T10:30:00Z", 800), // sent, then compacted away before the next call
      boundary("e1", "2026-11-03T11:00:00Z", { preTokens: 60000, postTokens: 9000 }),
      typed("t1", "2026-11-03T11:30:00Z"),
      boundary("e2", "2026-11-03T12:00:00Z", { preTokens: 70000, postTokens: 9000 }), // a turn and no call: not a window sample
      call("k2", "2026-11-03T12:30:00Z", 9500),
    ]);
    const { seat } = await readSeat(join(root, "s"));
    const [row] = rowsFor("s", seat, NOW);
    expect(row.compactions).toBe(3);
    expect(row.pre_tokens_median).toBe(65000); // two sizes, not three
    expect(row.pre_tokens_max).toBe(70000);
    expect(row.tool_result_chars_p90).toBe(0);
    expect(row.win_calls_median).toBe(1);
    expect(row.win_turns_median).toBe(0);
    expect(row.user_turns).toBe(1);
    expect(row.windows_open_end).toBe(1);
  });

  it("CM-16 a window that ends with its file is booked to the week of its last turn or call; a file with no call has none", async () => {
    const root = temp();
    mkdirSync(join(root, "s"));
    write(join(root, "s", "one.jsonl"), [call("k1", "2026-11-08T10:00:00Z", 1000), typed("t1", "2026-11-09T09:00:00Z")]); // a Sunday call, a Monday turn
    write(join(root, "s", "two.jsonl"), [call("k2", "2026-11-10T10:00:00Z", 1000)]);
    write(join(root, "s", "three.jsonl"), [typed("t2", "2026-11-10T11:00:00Z")]);
    const { seat } = await readSeat(join(root, "s"));
    const rows = rowsFor("s", seat, NOW);
    expect(rows.map((x: Rec) => [x.week, x.calls, x.user_turns, x.windows_open_end])).toEqual([["2026-11-02", 1, 0, 0], ["2026-11-09", 1, 2, 2]]);
  });

  it("CM-17 a turn typed while the model works is one turn per delivery id, across the seat's files", async () => {
    const root = temp();
    mkdirSync(join(root, "s"));
    const queued = (id: string, ts: string): Rec => ({ type: "attachment", timestamp: ts, attachment: { type: "queued_command", delivery_id: id, origin: { kind: "human" } } });
    write(join(root, "s", "one.jsonl"), [call("k1", "2026-11-03T10:00:00Z", 1000), queued("d1", "2026-11-03T10:01:00Z")]);
    write(join(root, "s", "two.jsonl"), [call("k2", "2026-11-03T11:00:00Z", 1000), queued("d1", "2026-11-03T10:01:00Z"), queued("d2", "2026-11-03T11:01:00Z")]);
    const { seat } = await readSeat(join(root, "s"));
    expect(rowsFor("s", seat, NOW)[0].user_turns).toBe(2);
  });

  it("CM-18 two folders with one seat name are one seat: one set of rows, ids deduplicated across both", async () => {
    const root = temp();
    for (const f of ["f1", "f2", "f3"]) mkdirSync(join(root, f));
    write(join(root, "f1", "a.jsonl"), [call("k1", "2026-11-03T10:00:00Z", 1000), call("k2", "2026-11-03T10:01:00Z", 1200)]);
    write(join(root, "f2", "b.jsonl"), [call("k1", "2026-11-03T10:00:00Z", 1000), call("k3", "2026-11-04T10:00:00Z", 1500), call("k4", "2026-11-10T10:00:00Z", 1600)]);
    write(join(root, "f3", "c.jsonl"), [call("o1", "2026-11-03T10:00:00Z", 1000)]);
    const home = temp();
    const out = join(home, "o.jsonl");
    const config = join(home, "config.json");
    writeFileSync(config, JSON.stringify({ root, out, seats: { f1: "both", f3: "other", f2: "both" } }));
    const logs: string[] = [];
    const errs: string[] = [];
    expect(await main(["--config", config, "--now", NOW], (s: string) => logs.push(s), (s: string) => errs.push(s))).toBe(0);
    expect(errs).toEqual([]);
    expect(logs).toEqual([
      "seat both: 2 file(s), 0 subagent file(s), 2 closed week(s), 2 row(s) written, 0 already recorded",
      "seat other: 1 file(s), 0 subagent file(s), 1 closed week(s), 1 row(s) written, 0 already recorded",
      `WROTE 3 row(s) to ${out}`,
    ]);
    const rows = readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(rows.map((r: Rec) => [r.seat, r.week, r.calls, r.sessions_started])).toEqual([["both", "2026-11-02", 3, 2], ["both", "2026-11-09", 1, 0], ["other", "2026-11-02", 1, 1]]);
  });

  it("CM-19 a seat that cannot be read whole writes no row, is named in one line, and the other seats are written", async () => {
    const root = temp();
    for (const f of ["good", "part"]) mkdirSync(join(root, f));
    write(join(root, "good", "a.jsonl"), [call("g1", "2026-11-03T10:00:00Z", 1000)]);
    write(join(root, "part", "a.jsonl"), [call("h1", "2026-11-03T10:00:00Z", 1000)]);
    writeFileSync(join(root, "afile"), "a file where a folder should be\n");
    const home = temp();
    const out = join(home, "o.jsonl");
    const config = join(home, "config.json");
    writeFileSync(config, JSON.stringify({ root, out, seats: { afile: "broken", good: "fine", part: "mixed", gone: "mixed" } }));
    const logs: string[] = [];
    const errs: string[] = [];
    expect(await main(["--config", config, "--now", NOW], (s: string) => logs.push(s), (s: string) => errs.push(s))).toBe(1);
    expect(errs).toEqual([
      `ctx-metrics: seat broken: cannot read ${join(root, "afile")}: not a folder`,
      `ctx-metrics: seat mixed: no transcript folder ${join(root, "gone")}`,
    ]);
    expect(logs).toEqual(["seat fine: 1 file(s), 0 subagent file(s), 1 closed week(s), 1 row(s) written, 0 already recorded", `WROTE 1 row(s) to ${out}`]);
    expect(readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l).seat)).toEqual(["fine"]);

    // A transcript that vanishes during the read is an error the caller sees, not a silent short count.
    let thrown: unknown = null;
    try { await feedFile(newSeat(), join(root, "good", "vanished.jsonl"), false); } catch (e) { thrown = e; }
    expect(thrown === null).toBe(false);
  });

  it("CM-20 weeks are UTC weeks whatever the host's zone", () => {
    const url = new URL("../../scripts/ctx-metrics.mjs", import.meta.url).href;
    const code = "const m = await import(process.argv[1]); console.log(JSON.stringify([" +
      "m.weekClosed('2026-11-09', '2026-11-15T23:59:59Z'), m.weekClosed('2026-11-09', '2026-11-16T00:00:00Z'), " +
      "m.weekStart('2026-11-15T23:30:00Z'), m.weekStart('2026-11-16T00:30:00Z')]));";
    for (const TZ of ["Asia/Tokyo", "America/Los_Angeles", "UTC"]) {
      const r = spawnSync(process.execPath, ["--input-type=module", "-e", code, url], { env: { ...process.env, TZ }, encoding: "utf8" });
      expect(r.status).toBe(0);
      expect(JSON.parse(r.stdout)).toEqual([false, true, "2026-11-09", "2026-11-16"]);
    }
  });

  it("CM-14 the script names no machine: no home path, no user name, no e-mail address, no seat map", () => {
    const src = readFileSync(fileURLToPath(new URL("../../scripts/ctx-metrics.mjs", import.meta.url)), "utf8");
    expect(src).not.toMatch(new RegExp(["Users" + "[\\\\/]", "/ho" + "me/", "@[a-z0-9-]+\\.(com|org|net)", "C-" + "-Users"].join("|"), "i"));
  });
});
