#!/usr/bin/env node
// Context efficiency per seat (T-357): one row per seat per CLOSED ISO week, appended to a jsonl, read from
// Claude Code transcripts. It streams local files and writes two files; it starts nothing and sends nothing.
//
//   node scripts/ctx-metrics.mjs --config <file.json> [--now <ISO time>] [--dry-run]
//   node scripts/ctx-metrics.mjs --seat <transcript folder>=<seat name> [--seat ...] [--root <dir>] [--out <file>]
//   node scripts/ctx-metrics.mjs --note "<what changed>" [--date YYYY-MM-DD] [--changes <file>] [--config <file.json>]
//
// Config: { "root": "<dir>", "out": "<file>", "changes": "<file>", "seats": { "<transcript folder>": "<seat name>" } }.
// A flag wins over the config. Defaults: root = ~/.claude/projects, out = ~/.claude/open-brain/context-metrics.jsonl,
// changes = context-changes.md beside the out file. There is NO default seat map: a transcript folder's name carries
// the user's home path, so the map lives in the config file, outside the repository.
//
// What a row measures (main thread only; a subagent's calls are counted separately as sidechain calls):
//   calls                       model calls, one per message id (a streamed reply is several records with one id;
//                               ids are deduplicated across every file of the seat)
//   active_days                 distinct UTC dates with a call
//   user_turns                  typed turns only (see isTypedTurn): not tool results, peer messages or notifications
//   sessions_started            transcript files whose first call is in the week
//   first_call_ctx_median       context of a session's first call: the system prompt, tool schemas and greeting
//   growth_median / _p90        context added from one call to the next inside a window (a drop is not a sample)
//   tool_result_chars_median / _p90   characters of tool results sent with a call (0 when it carried none)
//   compactions, pre_tokens_median / _max, post_tokens_median   from each compact_boundary record's compactMetadata.
//                               pre_tokens is the size at which the window was compacted: a model or window-size
//                               change shows here and in `models`, before any change in how a seat works.
//   win_calls_median / win_turns_median / win_hours_median   per window ENDED BY A COMPACTION in the week. A window
//                               runs from the session start, or the previous compaction, to the next compaction.
//   windows_open_end            windows that ended with their file, not with a compaction (counted, not in the medians)
//   sidechain_calls / sidechain_share   subagent calls, and their share of all calls
//   models, cc_versions         calls per model id and per Claude Code version
// context = input_tokens + cache_read_input_tokens + cache_creation_input_tokens of a call's usage.
// A week is Monday 00:00 UTC to the next Monday. A week is closed when the next Monday has passed; an open week
// never gets a row. A row is written once: a rerun skips a seat+week that is already in the out file, so rows
// survive the transcripts' own cleanup.
import { appendFileSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

export const SCHEMA = 1;
const DAY_MS = 86400000;
const CHANGES_HEADER =
  "# Context-metrics change log\n" +
  "# One line per change that could move the numbers in context-metrics.jsonl: \"- YYYY-MM-DD what changed\".\n" +
  "# Add a line with: node scripts/ctx-metrics.mjs --note \"<what changed>\" [--date YYYY-MM-DD]\n";

const iso = (t) => {
  if (t === undefined || t === null) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** Monday (UTC) of the week holding `ts`, as YYYY-MM-DD; null for an unreadable time. */
export function weekStart(ts) {
  const t = iso(ts);
  if (t === null) return null;
  const d = new Date(t);
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - sinceMonday)).toISOString().slice(0, 10);
}

/** True when the week that starts on `week` has ended at `now`. */
export function weekClosed(week, now) {
  return Date.parse(`${week}T00:00:00Z`) + 7 * DAY_MS <= new Date(now).getTime();
}

/** Median; the mean of the two middle values for an even count; null for none. */
export function median(xs) {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** 90th percentile by nearest rank; null for none. */
export function p90(xs) {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.ceil(0.9 * s.length) - 1];
}

const INJECTED = /^(<|Another Claude session|\[Request interrupted|This session is being continued)/;

/**
 * A turn the user typed. Two shapes carry one: a `user` record, and a `queued_command` attachment (typed while the
 * model was working). Where the record has an `origin`, only kind "human" counts. An older record has none: then
 * any text that does not open with an injected marker counts.
 */
export function isTypedTurn(j) {
  if (j.type === "attachment") return j.attachment?.type === "queued_command" && j.attachment.origin?.kind === "human";
  if (j.type !== "user" || j.isMeta || j.isCompactSummary) return false;
  const c = j.message?.content;
  if (Array.isArray(c) && c.some((x) => x?.type === "tool_result")) return false;
  if (j.origin) return j.origin.kind === "human";
  const text = typeof c === "string" ? c : Array.isArray(c) ? c.filter((x) => x?.type === "text").map((x) => x.text).join(" ") : "";
  const t = text.trimStart();
  return t !== "" && !INJECTED.test(t);
}

export function newSeat() {
  return { ids: new Set(), sideIds: new Set(), uuids: new Set(), weeks: new Map() };
}

export function newFile() {
  return { prev: null, pending: 0, lastTs: null, first: true, win: null };
}

function weekOf(seat, week) {
  let a = seat.weeks.get(week);
  if (!a) {
    a = { calls: 0, days: new Set(), turns: 0, firstCtx: [], growth: [], tr: [], compactions: 0, pre: [], post: [],
      winCalls: [], winTurns: [], winHours: [], openEnd: 0, side: 0, models: {}, versions: {} };
    seat.weeks.set(week, a);
  }
  return a;
}

const realCall = (j) => j.type === "assistant" && j.message?.usage && j.message.id && j.message.model !== "<synthetic>";
const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };

/** Feed one transcript record, in file order. `sidechainFile` is true for a file under `<session>/subagents/`. */
export function feed(seat, f, j, sidechainFile = false) {
  const ts = iso(j.timestamp) ?? iso(j.attachment?.timestamp) ?? f.lastTs;
  if (ts === null) return;
  f.lastTs = ts;
  const week = weekStart(ts);
  if (sidechainFile || j.isSidechain === true) {
    if (realCall(j) && !seat.sideIds.has(j.message.id)) { seat.sideIds.add(j.message.id); weekOf(seat, week).side++; }
    return;
  }
  if (j.type === "system" && j.subtype === "compact_boundary") {
    if (j.uuid) { if (seat.uuids.has(j.uuid)) return; seat.uuids.add(j.uuid); }
    const a = weekOf(seat, week);
    const m = j.compactMetadata ?? {};
    a.compactions++;
    const pre = Number.isFinite(m.preTokens) ? m.preTokens : f.prev;
    if (pre !== null) a.pre.push(pre);
    if (Number.isFinite(m.postTokens)) a.post.push(m.postTokens);
    if (f.win && f.win.calls > 0) {
      a.winCalls.push(f.win.calls);
      a.winTurns.push(f.win.turns);
      a.winHours.push((Date.parse(ts) - Date.parse(f.win.start)) / 3600000);
    }
    f.win = null; f.prev = null; f.pending = 0;
    return;
  }
  if (isTypedTurn(j)) {
    const key = j.uuid ?? j.attachment?.delivery_id;
    if (key) { if (seat.uuids.has(key)) return; seat.uuids.add(key); }
    weekOf(seat, week).turns++;
    f.win ??= { start: ts, end: ts, calls: 0, turns: 0 };
    f.win.turns++; f.win.end = ts;
    return;
  }
  if (j.type === "user" && Array.isArray(j.message?.content)) {
    for (const c of j.message.content) {
      if (c?.type === "tool_result") f.pending += typeof c.content === "string" ? c.content.length : JSON.stringify(c.content ?? "").length;
    }
    return;
  }
  if (!realCall(j)) return;
  if (seat.ids.has(j.message.id)) return;
  seat.ids.add(j.message.id);
  const u = j.message.usage;
  const ctx = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
  const a = weekOf(seat, week);
  a.calls++;
  a.days.add(ts.slice(0, 10));
  bump(a.models, j.message.model ?? "unknown");
  bump(a.versions, j.version ?? "unknown");
  if (f.first) { a.firstCtx.push(ctx); f.first = false; }
  if (f.prev !== null && ctx >= f.prev) a.growth.push(ctx - f.prev);
  f.prev = ctx;
  a.tr.push(f.pending);
  f.pending = 0;
  f.win ??= { start: ts, end: ts, calls: 0, turns: 0 };
  f.win.calls++; f.win.end = ts;
}

/** Call once after a main-thread file's last record: its last window ended with the file. */
export function endFile(seat, f) {
  if (f.win && f.win.calls > 0) weekOf(seat, weekStart(f.win.end)).openEnd++;
  f.win = null;
}

const int = (x) => (x === null ? null : Math.round(x));
const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));

/** The rows for every closed week in which the seat made a call, oldest first. */
export function rowsFor(seatName, seat, now) {
  const generated = new Date(now).toISOString();
  const rows = [];
  for (const week of [...seat.weeks.keys()].sort()) {
    const a = seat.weeks.get(week);
    if (a.calls === 0 || !weekClosed(week, now)) continue;
    const hours = median(a.winHours);
    rows.push({
      schema: SCHEMA, seat: seatName, week,
      calls: a.calls, active_days: a.days.size, user_turns: a.turns,
      sessions_started: a.firstCtx.length, first_call_ctx_median: int(median(a.firstCtx)),
      growth_median: int(median(a.growth)), growth_p90: int(p90(a.growth)),
      tool_result_chars_median: int(median(a.tr)), tool_result_chars_p90: int(p90(a.tr)),
      compactions: a.compactions, pre_tokens_median: int(median(a.pre)),
      pre_tokens_max: a.pre.length ? Math.max(...a.pre) : null, post_tokens_median: int(median(a.post)),
      win_calls_median: median(a.winCalls), win_turns_median: median(a.winTurns),
      win_hours_median: hours === null ? null : Math.round(hours * 100) / 100,
      windows_open_end: a.openEnd,
      sidechain_calls: a.side, sidechain_share: Math.round((a.side / (a.calls + a.side)) * 1000) / 1000,
      models: sorted(a.models), cc_versions: sorted(a.versions),
      generated_at: generated,
    });
  }
  return rows;
}

/** Append the rows whose seat+week is not in the file yet. Returns how many were written and how many were skipped. */
export function appendRows(outPath, rows) {
  const have = new Set();
  if (existsSync(outPath)) {
    for (const line of readFileSync(outPath, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try { const r = JSON.parse(line); have.add(`${r.seat}|${r.week}`); } catch { /* an unreadable line is left as it is */ }
    }
  }
  const fresh = [];
  for (const r of rows) {
    const key = `${r.seat}|${r.week}`;
    if (have.has(key)) continue;
    have.add(key);
    fresh.push(r);
  }
  if (fresh.length > 0) {
    mkdirSync(dirname(outPath), { recursive: true });
    appendFileSync(outPath, fresh.map((r) => JSON.stringify(r) + "\n").join(""));
  }
  return { written: fresh.length, skipped: rows.length - fresh.length };
}

/** Add one dated line to the change log, creating the file with its header. Returns false when the line is there. */
export function addNote(changesPath, date, text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Error(`--date must be a real YYYY-MM-DD date, got "${date}"`);
  }
  const t = String(text).trim();
  if (t === "" || /[\r\n]/.test(t)) throw new Error("--note needs one line of text");
  const line = `- ${date} ${t}`;
  const old = existsSync(changesPath) ? readFileSync(changesPath, "utf8") : null;
  if (old !== null && old.split(/\r?\n/).includes(line)) return false;
  mkdirSync(dirname(changesPath), { recursive: true });
  if (old === null) writeFileSync(changesPath, `${CHANGES_HEADER}${line}\n`);
  else appendFileSync(changesPath, `${old === "" || old.endsWith("\n") ? "" : "\n"}${line}\n`);
  return true;
}

const WANTED = ['"usage"', '"type":"user"', "compact_boundary", "queued_command"];

async function feedFile(seat, path, sidechainFile) {
  const f = newFile();
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!WANTED.some((w) => line.includes(w))) continue;
    let j;
    try { j = JSON.parse(line); } catch { continue; }
    feed(seat, f, j, sidechainFile);
  }
  if (!sidechainFile) endFile(seat, f);
}

const jsonlIn = (dir) => readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith(".jsonl")).map((e) => e.name).sort();

/** Read every transcript of one seat: `<dir>/*.jsonl` (main thread) and `<dir>/<session>/subagents/*.jsonl`. */
export async function readSeat(dir) {
  const seat = newSeat();
  let files = 0;
  let subagentFiles = 0;
  for (const name of jsonlIn(dir)) { await feedFile(seat, join(dir, name), false); files++; }
  for (const e of readdirSync(dir, { withFileTypes: true }).filter((x) => x.isDirectory()).map((x) => x.name).sort()) {
    const sub = join(dir, e, "subagents");
    if (!existsSync(sub)) continue;
    for (const name of jsonlIn(sub)) { await feedFile(seat, join(sub, name), true); subagentFiles++; }
  }
  return { seat, files, subagentFiles };
}

function parseArgs(argv) {
  const o = { seats: {}, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") { o.dryRun = true; continue; }
    const key = { "--config": "config", "--root": "root", "--out": "out", "--changes": "changes", "--now": "now", "--note": "note", "--date": "date" }[a];
    const v = argv[++i];
    if (a === "--seat") {
      const eq = v === undefined ? -1 : v.lastIndexOf("=");
      if (eq <= 0 || eq === v.length - 1) throw new Error("--seat needs <transcript folder>=<seat name>");
      o.seats[v.slice(0, eq)] = v.slice(eq + 1);
      continue;
    }
    if (!key) throw new Error(`unknown argument ${a}`);
    if (v === undefined) throw new Error(`${a} needs a value`);
    o[key] = v;
  }
  return o;
}

/** Run the command line. Returns the exit code; prints through `log` and `err`. */
export async function main(argv, log = console.log, err = console.error) {
  let o;
  let cfg = {};
  try {
    o = parseArgs(argv);
    if (o.config) cfg = JSON.parse(readFileSync(o.config, "utf8"));
  } catch (e) {
    err(`ctx-metrics: ${e.message}`);
    err("usage: ctx-metrics.mjs --config <file.json> [--now <ISO>] [--dry-run] | --seat <folder>=<name> ... | --note \"<text>\" [--date YYYY-MM-DD]");
    return 2;
  }
  const root = resolve(o.root ?? cfg.root ?? join(homedir(), ".claude", "projects"));
  const out = resolve(o.out ?? cfg.out ?? join(homedir(), ".claude", "open-brain", "context-metrics.jsonl"));
  const changes = resolve(o.changes ?? cfg.changes ?? join(dirname(out), "context-changes.md"));
  const now = o.now ?? new Date().toISOString();
  if (iso(now) === null) { err(`ctx-metrics: --now is not a time: ${now}`); return 2; }

  if (o.note !== undefined) {
    try {
      const date = o.date ?? iso(now).slice(0, 10);
      const added = addNote(changes, date, o.note);
      log(added ? `NOTED ${date} in ${changes}` : `ALREADY NOTED ${date} in ${changes}`);
      return 0;
    } catch (e) { err(`ctx-metrics: ${e.message}`); return 2; }
  }

  const seats = { ...(cfg.seats ?? {}), ...o.seats };
  if (Object.keys(seats).length === 0) { err("ctx-metrics: no seats: pass --config with a \"seats\" map, or --seat <transcript folder>=<seat name>"); return 2; }
  let missing = 0;
  let written = 0;
  for (const [folder, name] of Object.entries(seats)) {
    const dir = join(root, folder);
    if (!existsSync(dir)) { err(`ctx-metrics: seat ${name}: no transcript folder ${dir}`); missing++; continue; }
    const { seat, files, subagentFiles } = await readSeat(dir);
    const rows = rowsFor(name, seat, now);
    if (o.dryRun) {
      for (const r of rows) log(JSON.stringify(r));
      log(`seat ${name}: ${files} file(s), ${subagentFiles} subagent file(s), ${rows.length} closed week(s); dry run, nothing written`);
      continue;
    }
    const r = appendRows(out, rows);
    written += r.written;
    log(`seat ${name}: ${files} file(s), ${subagentFiles} subagent file(s), ${rows.length} closed week(s), ${r.written} row(s) written, ${r.skipped} already recorded`);
  }
  if (!o.dryRun) log(`WROTE ${written} row(s) to ${out}`);
  return missing > 0 ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
