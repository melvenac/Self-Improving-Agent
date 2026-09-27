/**
 * `open-brain state import` (Loop 4, C1): the one-shot migration of a
 * project's prose `.agents/` files into `.agents/state.json`.
 *
 * Two doors, one direction:
 *   --draft   parse the prose, write `.agents/state.draft.json` and
 *             `.agents/state.import-report.md`, change nothing else. The report
 *             is for a human reviewer: every parsing decision the rules could
 *             not make deterministically is listed with its line number.
 *   --commit  validate the reviewed draft, snapshot `.agents/` byte-complete,
 *             write `state.json` at revision 0, cut the status blockquote and
 *             `## Current State` out of SUMMARY.md, render the four views, and
 *             move the draft + report into the snapshot. Refuses if state.json
 *             already exists — this runs once per project.
 *
 * Parsing rules are the brief's, applied literally. Where a rule cannot
 * decide, the item is reported, never guessed silently.
 */
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, cpSync, renameSync, statSync, rmSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { defaultTemplateDir } from "../bootstrap/index.js";
import {
  StateSchema,
  parseState,
  serializeState,
  lastSession,
  type State,
  type Task,
  type Verified,
  type Gap,
  type Decision,
} from "../../shared/state-schema.js";
import { applyStateOps, DONE_RETENTION_SESSIONS } from "../../shared/state-writer.js";
import { readJson } from "../../shared/fs-utils.js";

export const DRAFT_REL = ".agents/state.draft.json";
export const REPORT_REL = ".agents/state.import-report.md";
export const STATE_REL = ".agents/state.json";
export const SNAPSHOT_PREFIX = "pre-state-migration-";

type Status = Task["status"];
type Priority = Task["priority"];

const BOX_STATUS: Record<string, Status> = { " ": "open", "~": "in_progress", "!": "blocked", "x": "done", "X": "done" };
const PRIORITIES: Priority[] = ["P0", "P1", "P2", "P3"];
const STATUSES: Status[] = ["open", "in_progress", "blocked", "done"];

export interface UnparsedLine { line: number; text: string; reason: string }
export interface SupersededLink { from: string; from_line: number; to: string; to_line: number }

export interface ImportReport {
  /** `name_from: "folder"` when there is no package.json name (R-BF-9): the draft says so. */
  project: { name: string; version: string; name_from: "package.json" | "folder" };
  current_session: number;
  migration_date: string;
  staleness: StalenessReport;
  sources: Record<string, { path: string; present: boolean; lines: number }>;
  inbox: {
    items: number;
    box_counts: Record<Status, number>;
    by_priority: Record<Priority, Record<Status, number>>;
    by_status: Record<Status, number>;
    completed_section_items: number;
    unparsed: UnparsedLine[];
    superseded_links: SupersededLink[];
    sessions: { parsed: number; inferred_open_as_current: number; inferred_done_as_retention_edge: number };
    title_fallbacks: Array<{ line: number; title: string }>;
    retention_eligible_done: number;
    /** R-BF-10: INBOX.md is the template's own, line ends aside — its tasks are placeholders. */
    template_copy: boolean;
  };
  objective: { found: boolean; preview: string };
  decisions: {
    imported: number;
    date_from_line: number;
    date_partial: Array<{ id: string; original: string }>;
    date_unknown: number;
    skipped: Array<{ line: number; heading: string; reason: string }>;
  };
  /** DECISIONS.md holds bytes that cannot be read; it is not judged, so this names it rather than blocks (R4-5). */
  decisions_unreadable: DecisionsUnreadable | null;
  handoff: { pick_up_lines: number; watch_out: number; open_questions: number; sections_not_imported: string[] };
  last_session: { n: number; date: string; uuid: string | null; file: string; unreadable: string | null; date_why: string };
  /**
   * Always 0. Prose files carry no verified claims or gaps in a form the
   * importer reads, and it invents none: it used to seed SIA's own
   * V-001..V-005 and G-001..G-006 into every project (T-175). The counts stay
   * in the report so that it says 0 rather than going quiet.
   */
  verified_imported: number;
  gaps_imported: number;
  summary_removal: { title_line: number; blockquote_lines: number; current_state_lines: number; total_lines_removed: number; kept_headings: string[] } | null;
}

export interface ImportDraft { state: State; report: ImportReport }

// ---------------------------------------------------------------------------
// Reading: every text the importer judges or imports is decoded here, once.
// ---------------------------------------------------------------------------

/**
 * How a file's bytes were turned into text. The byte-order mark is a property
 * of the file, not of its first line: left in the text, U+FEFF hid a `# ` title
 * from every `startsWith` in this module, and a stale input read as unmarked
 * (QA 102, D2). UTF-16 is what Windows PowerShell 5.1's `>` and `Out-File`
 * write, BOM first. Line endings need nothing here: every split is `\r?\n`.
 */
export type TextEncoding = "utf8" | "utf8-bom" | "utf16le-bom" | "utf16be-bom" | "utf32le-bom" | "windows-1252";
export interface DecodedText {
  text: string;
  encoding: TextEncoding;
  /** Why the text cannot be trusted as read, or null. Such an input is never judged. */
  undecodable: string | null;
}

/** Said in the evidence of an input read as Windows-1252, so the guess is visible. */
export const READ_AS_1252 = "read as Windows-1252: not valid UTF-8, and no byte-order mark";

// Windows-1252's 0x80–0x9F; every other byte is its own code point. Written
// out rather than asked of TextDecoder, whose "windows-1252" has decoded this
// range as Latin-1 on some Node builds.
const CP1252_HIGH = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ";
function decode1252(buf: Buffer): string {
  let s = "";
  for (const b of buf) s += b >= 0x80 && b <= 0x9f ? CP1252_HIGH[b - 0x80] : String.fromCharCode(b);
  return s;
}

export function decodeText(buf: Buffer): DecodedText {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return withCheck(buf.subarray(3), "utf8-bom");
  // UTF-32LE's mark begins with UTF-16LE's, so it is tested first (QA 122, D11).
  // UTF-32BE's (00 00 FE FF) needs no test: it is NUL bytes to the UTF-8 path.
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xfe && buf[2] === 0 && buf[3] === 0) {
    return { text: buf.toString("utf-8"), encoding: "utf32le-bom", undecodable: "starts with a UTF-32LE byte-order mark (FF FE 00 00): the importer reads UTF-8, UTF-16 and Windows-1252, not UTF-32, so its words cannot be read" };
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return withBomCheck(buf.subarray(2).toString("utf16le"), "utf16le-bom");
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    // swap16 throws on an odd length (QA 138, D1), so that shape is filed here:
    // UTF-16 is two bytes a character, and the mark cannot be right about them.
    if (buf.length % 2 === 1) {
      return { text: Buffer.from(buf.subarray(2, buf.length - 1)).swap16().toString("utf16le"), encoding: "utf16be-bom", undecodable: `has a UTF-16BE byte-order mark (FE FF), but an odd number of bytes (${buf.length}): UTF-16 is two bytes a character, so the mark does not match the bytes, and its words cannot be read` };
    }
    return withBomCheck(Buffer.from(buf.subarray(2)).swap16().toString("utf16le"), "utf16be-bom");
  }
  return withCheck(buf, "utf8");
}

/**
 * A UTF-16 mark says how to read the bytes, and a NUL in the text it gives
 * says the mark was wrong about them, as UTF-8's NUL check does for no mark
 * (QA 122, D11). Counted in the file: two bytes of mark, two per character.
 */
function withBomCheck(text: string, encoding: "utf16le-bom" | "utf16be-bom"): DecodedText {
  const first = text.indexOf("\u0000");
  if (first === -1) return { text, encoding, undecodable: null };
  const count = text.split("\u0000").length - 1;
  const mark = encoding === "utf16le-bom" ? "UTF-16LE" : "UTF-16BE";
  return { text, encoding, undecodable: `has a ${mark} byte-order mark, but the text it gives holds ${count} NUL character(s), the first at byte ${2 + first * 2}: the mark does not match the bytes, so its words cannot be read` };
}

function withCheck(buf: Buffer, encoding: "utf8" | "utf8-bom"): DecodedText {
  let text: string;
  try {
    // ignoreBOM: TextDecoder drops a UTF-8 BOM by default, which made the strip
    // in decodeText a second, unobservable protection. One, and it is that one.
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buf);
  } catch {
    // Not UTF-8 and no BOM: Windows PowerShell 5.1's Set-Content/Add-Content
    // write the ANSI code page. Every ASCII byte means the same in it, and the
    // session marker is ASCII, so the verdict holds (QA 106, D5). Only NUL
    // bytes — UTF-16 without its BOM — leave the words unreadable.
    if (!buf.includes(0)) return { text: decode1252(buf), encoding: "windows-1252", undecodable: null };
    text = buf.toString("utf-8");
  }
  if (text.includes("\u0000")) return { text, encoding, undecodable: nulReason(buf, encoding === "utf8-bom" ? 3 : 0) };
  return { text, encoding, undecodable: null };
}

/**
 * Where the NUL bytes are, counted in the file. UTF-16 without a BOM is one
 * source; Windows PowerShell 5.1's `>>` is another: it appends UTF-16LE with no
 * BOM onto a UTF-8 or Windows-1252 file, so a readable head gets an unreadable
 * tail (QA 111, D8).
 */
function nulReason(buf: Buffer, bomLength: number): string {
  let count = 0;
  for (const b of buf) if (b === 0) count++;
  return `contains ${count} NUL byte(s), the first at byte ${buf.indexOf(0) + bomLength}, as UTF-16 without a byte-order mark would, or a line appended by Windows PowerShell 5.1's \`>>\`: its encoding is unknown, so its words cannot be read`;
}

/**
 * SUMMARY.md goes back as plain UTF-8, whatever it was read as. The renderer
 * that inserts its marked region straight after, and every ob_state write after
 * that, reads it as UTF-8 and looks for its `# ` title with `startsWith` — so a
 * BOM kept here would put the region above the title. The original bytes are in
 * the snapshot.
 */
function summaryBytes(text: string): Buffer {
  return Buffer.from(text, "utf-8");
}

export function readText(p: string): DecodedText | null {
  return existsSync(p) ? decodeText(readBytes(p)) : null;
}

/** Node's EBUSY names the file, but not why, nor what to do (QA 138, O-b). */
function readBytes(p: string): Buffer {
  try {
    return readFileSync(p);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EBUSY") throw new Error(`${(err as Error).message}: another program holds this file open; close it and re-run`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// INBOX.md → tasks[]
// ---------------------------------------------------------------------------

interface RawItem {
  line: number;
  box: string;
  body: string;
  priority: Priority | null;
  section: string;
  fromCompleted: boolean;
}

// A symbol run may precede the priority: the template's own INBOX heads its
// sections `## 🔴 P0 — Critical`, and every project scaffolded from it (or
// copied by README's `cp -r`) carries that shape. Letters may not: `## Priority`
// and `## Backlog P2` are not priority sections (bootstrap-fix BF-1).
const SECTION_RE = /^## (?:[^\w\s]+\s*)?(P[0-3])\b/;
const ITEM_RE = /^- \[( |~|!|x|X)\] (.*)$/;
const SESSION_RE = /\(Sessions?\s+(\d+(?:\s*(?:,|–|-|and)\s*\d+)*)/g;

function parseInboxItems(text: string, unparsed: UnparsedLine[]): RawItem[] {
  const lines = text.split(/\r?\n/);
  const items: RawItem[] = [];
  let priority: Priority | null = null;
  let section = "(before any section)";
  let fromCompleted = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const n = i + 1;
    if (raw.startsWith("## ")) {
      const m = raw.match(SECTION_RE);
      section = raw.slice(3).trim();
      if (m) { priority = m[1] as Priority; fromCompleted = false; }
      else if (/^## Completed/i.test(raw)) { priority = "P3"; fromCompleted = true; }
      else { priority = null; fromCompleted = false; unparsed.push({ line: n, text: raw, reason: "section heading with no priority — items under it have no priority and are skipped" }); }
      continue;
    }
    if (raw.startsWith("# ") || raw.trim() === "") continue;
    const m = raw.match(ITEM_RE);
    if (m) {
      if (priority === null) {
        unparsed.push({ line: n, text: raw.slice(0, 120), reason: `item under "${section}" — no priority section` });
        continue;
      }
      items.push({ line: n, box: m[1], body: m[2].trim(), priority, section, fromCompleted });
      continue;
    }
    if (/^\s+\S/.test(raw) && items.length > 0) {
      // Indented continuation of the previous item — part of its verbatim note.
      items[items.length - 1].body += " " + raw.trim();
      continue;
    }
    unparsed.push({ line: n, text: raw.slice(0, 120), reason: "not an item, heading or blank line — ignored (kept in the snapshot)" });
  }
  return items;
}

function sessionsIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(SESSION_RE)) {
    const parts = m[1].split(/\s*(?:,|–|-|and)\s*/).map((p) => parseInt(p, 10)).filter((x) => Number.isFinite(x));
    if (parts.length === 2 && /[–-]/.test(m[1])) {
      const [a, b] = parts[0] <= parts[1] ? parts : [parts[1], parts[0]];
      for (let s = a; s <= b; s++) out.push(s);
    } else {
      out.push(...parts);
    }
  }
  return out;
}

function splitTitle(body: string): { title: string; note: string; fallback: boolean } {
  const bold = body.match(/^\*\*(.+?)\*\*/);
  if (bold) {
    const content = bold[1];
    const dash = content.indexOf(" — ");
    const title = (dash === -1 ? content : content.slice(0, dash)).trim();
    const rest = dash === -1 ? "" : content.slice(dash + 3).trim();
    // The dash that joined title and note is punctuation, not note text.
    const after = body.slice(bold[0].length).trim().replace(/^[—–-]\s+/, "");
    const note = [rest ? `**${rest}**` : "", after].filter(Boolean).join(" ").trim();
    return { title, note, fallback: false };
  }
  const sentence = body.split(/(?<=[.!?])\s/)[0] ?? body;
  const title = sentence.length > 120 ? sentence.slice(0, 117).trimEnd() + "…" : sentence;
  const note = body.slice(sentence.length).trim();
  return { title, note, fallback: true };
}

/**
 * The session a done item with no `(Session N)` marker is stamped closed in.
 * Floored at 0: session numbers are non-negative in the schema, so at a fresh
 * project's session 0 the unfloored edge (-3) made the draft fail validation
 * (bootstrap-fix BF-8, frogger F9). The stamp is a label only: since T-179
 * round 2, whether a done item is dropped is judged by closed_rev and the
 * sessions written since, never by this number.
 */
export function retentionEdge(current: number): number {
  return Math.max(0, current - DONE_RETENTION_SESSIONS);
}

/**
 * BF-1 (frogger F1): an INBOX that exists and yields no task is almost always a
 * heading the importer cannot read, and "Validates: yes" alone hid it. Null when
 * there is no INBOX, or when at least one task parsed.
 */
export function inboxWarning(r: ImportReport): string | null {
  if (r.inbox.template_copy) {
    return `WARNING: ${r.sources.inbox?.path ?? "INBOX.md"} is the template's, unchanged: its ${r.inbox.items} task(s) are placeholders ("Write the PRD" and the rest), not this project's. ` +
      "Replace them with this project's tasks (bootstrap.md step 5), then re-run --draft.";
  }
  const src = r.sources.inbox;
  if (!src?.present || r.inbox.items > 0) return null;
  const skipped = r.inbox.unparsed.length;
  return `WARNING: ${src.path} exists but 0 tasks were parsed (${skipped} unparsed line${skipped === 1 ? "" : "s"}). ` +
    "Tasks are read only under `## P0`..`## P3` (a leading emoji is fine) or `## Completed`. The draft validates, but it holds no tasks — fix the headings and re-run --draft.";
}

function emptyStatusCounts(): Record<Status, number> {
  return { open: 0, in_progress: 0, blocked: 0, done: 0 };
}

export function importTasks(text: string, current: number, report: ImportReport["inbox"]): Task[] {
  const items = parseInboxItems(text, report.unparsed);
  const tasks: Task[] = [];
  const edge = retentionEdge(current);
  items.forEach((it, idx) => {
    const id = `T-${String(idx + 1).padStart(3, "0")}`;
    const boxStatus = BOX_STATUS[it.box];
    report.box_counts[boxStatus]++;
    const { title, note, fallback } = splitTitle(it.body);
    if (fallback) report.title_fallbacks.push({ line: it.line, title });
    const superseded = /^\[superseded\b/i.test(title);
    const status: Status = superseded ? "done" : boxStatus;
    const sessions = sessionsIn(it.body);
    let opened: number;
    let closed: number | null;
    if (sessions.length > 0) {
      report.sessions.parsed++;
      opened = Math.min(...sessions);
      closed = status === "done" ? Math.max(...sessions) : null;
    } else if (status === "done") {
      report.sessions.inferred_done_as_retention_edge++;
      opened = edge;
      closed = edge;
    } else {
      report.sessions.inferred_open_as_current++;
      opened = current;
      closed = null;
    }
    if (status === "done") report.retention_eligible_done++;
    if (it.fromCompleted) report.completed_section_items++;
    tasks.push({ id, title, priority: it.priority!, status, opened_session: opened, closed_session: closed, supersedes: null, note, note_by: note === "" ? [] : null, closed_rev: null });
    if (superseded) {
      const prev = tasks[idx - 1];
      if (prev) {
        prev.supersedes = id;
        report.superseded_links.push({ from: prev.id, from_line: items[idx - 1].line, to: id, to_line: it.line });
      } else {
        report.unparsed.push({ line: it.line, text: it.body.slice(0, 120), reason: "[superseded] item with no preceding item to link from" });
      }
    }
  });
  report.items = tasks.length;
  for (const t of tasks) {
    report.by_status[t.status]++;
    report.by_priority[t.priority][t.status]++;
  }
  return tasks;
}

// ---------------------------------------------------------------------------
// DECISIONS.md → decisions[]
// ---------------------------------------------------------------------------

const ADR_RE = /^### (ADR-\d+):\s*(.+?)\s*$/;
const ADR_UNNUMBERED_RE = /^### ADR\b/;
const DATE_LINE_RE = /^\s*(?:- )?\*{0,2}Date:?\*{0,2}\s*:?\s*(\S+)/;
const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function importDecisions(text: string, migrationDate: string, report: ImportReport["decisions"]): Decision[] {
  const lines = text.split(/\r?\n/);
  const out: Decision[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("### ")) continue;
    const m = line.match(ADR_RE);
    if (!m) {
      if (ADR_UNNUMBERED_RE.test(line)) report.skipped.push({ line: i + 1, heading: line, reason: "ADR heading without a number — no id can be assigned" });
      continue;
    }
    const [, id, title] = m;
    if (seen.has(id)) { report.skipped.push({ line: i + 1, heading: line, reason: `duplicate id ${id}` }); continue; }
    seen.add(id);
    // A Date line inside this ADR's block (until the next ### heading).
    let original: string | null = null;
    for (let j = i + 1; j < lines.length && !lines[j].startsWith("### "); j++) {
      const d = lines[j].match(DATE_LINE_RE);
      if (d) { original = d[1].replace(/\*+$/, ""); break; }
    }
    let date = migrationDate;
    let note = "";
    if (original && FULL_DATE.test(original)) {
      date = original;
      report.date_from_line++;
    } else if (original) {
      note = `imported; original date partial: ${original}`;
      report.date_partial.push({ id, original });
    } else {
      note = "imported; original date unknown";
      report.date_unknown++;
    }
    out.push({ id, title, date, note });
  }
  report.imported = out.length;
  return out;
}

export interface DecisionsUnreadable { evidence: string; imported: string[]; not_imported: string[] }

/**
 * DECISIONS.md is imported as far as it reads (R4-5 keeps it from blocking).
 * What it lost is found by reading it again with the NUL bytes removed, which
 * recovers the ASCII of a UTF-16 tail such as PS 5.1's `>>` writes: an ADR
 * heading seen there and not imported was dropped. The unreadable bytes may
 * hold more than that, and the sentence the report prints says so.
 */
export function decisionsUnreadable(text: string, evidence: string, imported: string[]): DecisionsUnreadable {
  const scratch: ImportReport["decisions"] = { imported: 0, date_from_line: 0, date_partial: [], date_unknown: 0, skipped: [] };
  const seen = importDecisions(text.replace(/\u0000/g, ""), "0000-00-00", scratch).map((d) => d.id);
  return { evidence, imported, not_imported: seen.filter((id) => !imported.includes(id)) };
}

/** The lines the report and the CLI both print for it, so they cannot say different things. */
export function describeDecisionsUnreadable(u: DecisionsUnreadable): string[] {
  return [
    `.agents/SYSTEM/DECISIONS.md ${u.evidence}. It is not judged, so it does not block --commit: it is imported as far as it reads.`,
    `ADRs imported: ${u.imported.length ? u.imported.join(", ") : "none"}`,
    `ADRs NOT imported (headings found once the NUL bytes are removed; the unreadable bytes may hold more): ${adrNotImported(u)}`,
  ];
}

// ---------------------------------------------------------------------------
// task.md → objective, next-session.md → handoff, SESSIONS/ → last_session
// ---------------------------------------------------------------------------

export function importObjective(text: string | null, current: number): { objective: State["objective"]; preview: string } {
  if (!text) return { objective: null, preview: "(task.md absent)" };
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^## Current Objective\b/.test(l));
  if (start === -1) return { objective: null, preview: "(no ## Current Objective heading)" };
  const para: string[] = [];
  let i = start + 1;
  while (i < lines.length && lines[i].trim() === "") i++;
  while (i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("#")) { para.push(lines[i].trim()); i++; }
  const objText = para.join(" ").trim();
  if (!objText) return { objective: null, preview: "(empty paragraph under ## Current Objective)" };
  return { objective: { text: objText, since_session: current }, preview: objText.slice(0, 160) };
}

function sectionBody(lines: string[], startIdx: number): string[] {
  const out: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^#{1,6} /.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out;
}

function bullets(body: string[]): string[] {
  return body.filter((l) => /^\s*[-*] /.test(l)).map((l) => l.replace(/^\s*[-*] /, "").trim());
}

/**
 * The prose `next-session.md` carries ONE handoff and does not say whose.
 *
 * It is attributed to the DEVELOPER seat, and that is a documented assumption
 * rather than a discovered fact: the single slot was written by `/end`, and
 * `/end` was the developer's command — the re-brief states it as `handoff` is
 * "one slot, written only by the developer". An import that guessed silently
 * would put an unattributed handoff under a seat and leave no trace of the
 * guess, so the assumption is recorded in the report instead.
 */
export function importHandoff(text: string | null, current: number, report: ImportReport["handoff"]): State["handoffs"][number] {
  const handoff: State["handoffs"][number] = { seat: "developer", pick_up: "", watch_out: [], open_questions: [], session: current, loop_state: null, session_uuid: null, checkout: null, first_rev: null };
  if (!text) return handoff;
  const lines = text.split(/\r?\n/);
  const headings = lines.map((l, i) => ({ l, i })).filter(({ l }) => /^#{2,6} /.test(l));
  for (const { l, i } of headings) {
    const title = l.replace(/^#+ /, "");
    if (/^Pick up here\b/i.test(title)) {
      const body = sectionBody(lines, i).map((x) => x.trim()).filter(Boolean);
      handoff.pick_up = body.join("\n");
      report.pick_up_lines = body.length;
    } else if (/^Watch out\b/i.test(title)) {
      handoff.watch_out = bullets(sectionBody(lines, i));
      report.watch_out = handoff.watch_out.length;
    } else if (/^Open questions\b/i.test(title)) {
      handoff.open_questions = bullets(sectionBody(lines, i));
      report.open_questions = handoff.open_questions.length;
    } else {
      report.sections_not_imported.push(title);
    }
  }
  return handoff;
}

function adrNotImported(u: DecisionsUnreadable): string {
  if (u.not_imported.length) return u.not_imported.join(", ");
  // An odd-length FE FF file is not the NUL-stripping case. "none found" would
  // claim the bytes were searched and held no ADR, which is how QA 153's lie
  // hid `### ADR-1` written as UTF-8 under the mark.
  if (/odd number of bytes/.test(u.evidence)) return "could not be read";
  return "none found";
}

/** The line the report and both CLI modes print, so a latest log cannot be named in only one of them. */
export function describeLastSession(last: ImportReport["last_session"]): string | null {
  if (!last.unreadable) return null;
  return `${last.file} ${last.unreadable}. Date used: ${last.date}, ${last.date_why}.`;
}

export function findLastSession(sessionsDir: string, today: string): ImportReport["last_session"] {
  const row = (n: number, file: string, date: string, uuid: string | null, date_why: string, unreadable: string | null): ImportReport["last_session"] =>
    ({ n, date, uuid, file, unreadable, date_why });
  if (!existsSync(sessionsDir)) return row(0, "(no SESSIONS/ directory)", today, null, "the migration date, because there is no session log", null);
  let best: { n: number; file: string } | null = null;
  for (const f of readdirSync(sessionsDir)) {
    const m = f.match(/^Session_(\d+)\.md$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!best || n > best.n) best = { n, file: f };
    }
  }
  if (!best) return row(0, "(no Session_N.md)", today, null, "the migration date, because there is no session log", null);
  const decoded = decodeText(readBytes(join(sessionsDir, best.file)));
  const fromLog = decoded.text.match(/^# Session \d+\s+[—–-]+\s+(\d{4}-\d{2}-\d{2})/m)?.[1] ?? null;
  const uuid = decoded.text.match(/Session ID:\*{0,2}\s*`?([0-9a-fA-F-]{36})`?/)?.[1] ?? null;
  const file = `.agents/SESSIONS/${best.file}`;
  if (decoded.undecodable) {
    if (fromLog) return row(best.n, file, fromLog, uuid, "read from the log heading", decoded.undecodable);
    return row(best.n, file, today, uuid, "the migration date, because the log's date line could not be read", decoded.undecodable);
  }
  if (fromLog) return row(best.n, file, fromLog, uuid, "read from the log heading", null);
  return row(best.n, file, today, uuid, "the migration date, because the log heading has no date", null);
}

// ---------------------------------------------------------------------------
// Staleness (T-180): an input that predates the latest session is named, not
// imported as though it were current.
// ---------------------------------------------------------------------------

export type StalenessVerdict = "current" | "stale" | "could_not_tell";

/**
 * Every reason detectStaleness gives for "could not tell", and whether it
 * blocks a bare --commit as STALE does (R4-1). The verdict is the same for all
 * four; the consequence is not. An input whose words cannot be read might be
 * stale, and nothing else in the importer can say, so it blocks until
 * --accept-stale. The other three were read, and say what they say.
 */
export const COULD_NOT_TELL = {
  unreadable: { blocks: true, what: "the input's words cannot be read: NUL bytes, UTF-32, an odd-length UTF-16BE file, or no heading line (empty, or read in an encoding that is not its own)" },
  no_session_log: { blocks: false, what: "there is no SESSIONS/Session_N.md to compare against" },
  no_declared_session: { blocks: false, what: "the input names no `Session N` in its status blockquote or its headings" },
  ahead_of_latest: { blocks: false, what: "the input declares a session ahead of the latest log" },
} as const;
export type CouldNotTell = keyof typeof COULD_NOT_TELL;

interface JudgedInput { input: string; declared_session: number | null; evidence: string }
/**
 * A could-not-tell verdict carries its reason by type (QA 122, O14): with the
 * reason optional, a producer that left it out made blocksCommit fail open, and
 * only a test could notice. Now the compiler refuses the producer.
 */
export type InputStaleness =
  | (JudgedInput & { verdict: "current" | "stale" })
  | (JudgedInput & { verdict: "could_not_tell"; could_not_tell: CouldNotTell });

/** Whether a judged input stops a bare --commit: STALE, or could not tell because it cannot be read. */
export function blocksCommit(i: InputStaleness): boolean {
  if (i.verdict === "stale") return true;
  return i.verdict === "could_not_tell" && COULD_NOT_TELL[i.could_not_tell].blocks;
}
export interface StalenessReport {
  signal: string;
  latest: { n: number; file: string } | null;
  inputs: InputStaleness[];
  not_judged: Array<{ input: string; reason: string }>;
}

/**
 * One signal, the file's own words. Not git: `.agents/` is untracked in some
 * projects, and a tree snapshotted in one commit gives every file the same
 * date. Not mtime: a checkout or a copy resets it.
 */
export const STALENESS_SIGNAL =
  "the highest `Session N` an input names in its status blockquote (the `>` lines directly under its title) or in a heading, compared with the highest `SESSIONS/Session_N.md`";

const DECLARED_RE = /\bSessions?\s+(\d+)(?:\s*[–-]\s*(\d+))?/g;

/** The highest session an input declares, and the line that declares it. */
export function declaredSession(text: string): { n: number; line: number; text: string } | null {
  const lines = text.split(/\r?\n/);
  const candidates: number[] = [];
  const titleIdx = lines.findIndex((l) => l.startsWith("# "));
  if (titleIdx !== -1) {
    for (let i = titleIdx + 1; i < lines.length && (lines[i].trim() === "" || lines[i].startsWith(">")); i++) {
      if (lines[i].startsWith(">")) candidates.push(i);
    }
  }
  lines.forEach((l, i) => { if (/^#{1,6} /.test(l)) candidates.push(i); });
  let best: { n: number; line: number; text: string } | null = null;
  for (const i of candidates) {
    for (const m of lines[i].matchAll(DECLARED_RE)) {
      const n = Math.max(parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) : 0);
      if (!best || n > best.n) best = { n, line: i + 1, text: lines[i].trim() };
    }
  }
  return best;
}

type InputKey = "inbox" | "task" | "next" | "summary" | "decisions";
const INPUT_REL: Record<InputKey, string> = {
  inbox: ".agents/TASKS/INBOX.md",
  task: ".agents/TASKS/task.md",
  next: ".agents/SESSIONS/next-session.md",
  summary: ".agents/SYSTEM/SUMMARY.md",
  decisions: ".agents/SYSTEM/DECISIONS.md",
};
/** The inputs imported AS CURRENT STATE: tasks, objective, handoff. */
const JUDGED: InputKey[] = ["next", "inbox", "task"];
const NOT_JUDGED_REASON: Partial<Record<InputKey, string>> = {
  summary: "not imported as state: --commit only cuts its status blockquote and `## Current State`",
  decisions: "imported as a dated log of past decisions, not as current state",
};

/** `#` to `######`, then a space or the end of the line (R5-1). */
const ATX_HEADING = /^#{1,6}( |$)/;

function noHeading(text: string, encoding: TextEncoding | undefined): string {
  if (text.length === 0) return "has no heading line (it is empty), so its words cannot be read";
  const rule = "no line is `#` to `######` followed by a space";
  if (encoding === "utf16le-bom" || encoding === "utf16be-bom") {
    return `has no heading line as its ${encoding === "utf16le-bom" ? "UTF-16LE" : "UTF-16BE"} byte-order mark reads it (${rule}): the mark may not match the bytes, as when UTF-8 text follows it, so its words cannot be read`;
  }
  if (encoding === "windows-1252") return `has no heading line (${rule}): its encoding may be one the importer does not read, so its words cannot be read`;
  return `has no heading line (${rule}), so it cannot be judged: give it a title, or pass ${ACCEPT_STALE_FLAG}`;
}

export function detectStaleness(texts: Record<InputKey, string | null>, last: ImportReport["last_session"], undecodable: Partial<Record<InputKey, string>> = {}, readAs: Partial<Record<InputKey, string>> = {}, encodings: Partial<Record<InputKey, TextEncoding>> = {}): StalenessReport {
  const latest = last.n > 0 ? { n: last.n, file: last.file } : null;
  const inputs: InputStaleness[] = [];
  const not_judged: StalenessReport["not_judged"] = [];
  for (const key of Object.keys(INPUT_REL) as InputKey[]) {
    const input = INPUT_REL[key];
    const text = texts[key];
    if (text === null) { not_judged.push({ input, reason: "absent: nothing is imported from it" }); continue; }
    if (!JUDGED.includes(key)) {
      // Not judged, so it does not block; but what could not be read is said (R4-5).
      not_judged.push({ input, reason: NOT_JUDGED_REASON[key]! + (undecodable[key] ? `. It ${undecodable[key]}` : "") });
      continue;
    }
    if (undecodable[key]) {
      inputs.push({ input, verdict: "could_not_tell", declared_session: null, evidence: undecodable[key]!, could_not_tell: "unreadable" });
      continue;
    }
    // No ATX heading at any level means the text is empty or was decoded
    // wrongly: UTF-7 writes `#` as `+ACM-`, and a UTF-16 mark over UTF-8 gives
    // CJK. Its words were not read either (R4-4; O12's zero bytes). The evidence
    // blames an encoding only where the decode path justifies it (R5-1).
    if (!text.split(/\r?\n/).some((l) => ATX_HEADING.test(l))) {
      inputs.push({ input, verdict: "could_not_tell", declared_session: null, evidence: noHeading(text, encodings[key]), could_not_tell: "unreadable" });
      continue;
    }
    if (!latest) {
      inputs.push({ input, verdict: "could_not_tell", declared_session: declaredSession(text)?.n ?? null, evidence: `no SESSIONS/Session_N.md to compare against (${last.file})`, could_not_tell: "no_session_log" });
      continue;
    }
    const d = declaredSession(text);
    if (!d) {
      inputs.push({ input, verdict: "could_not_tell", declared_session: null, evidence: "names no `Session N` in its status blockquote or its headings", could_not_tell: "no_declared_session" });
      continue;
    }
    const where = `line ${d.line} declares Session ${d.n} (\`${d.text.length > 160 ? d.text.slice(0, 157) + "…" : d.text}\`); the latest session log is Session ${latest.n} (${latest.file})`;
    if (d.n > latest.n) {
      // A session no log records: renumbering, a per-worktree counter (T-164) or
      // a missing log. The comparison cannot say which, so it does not say current.
      inputs.push({ input, verdict: "could_not_tell", declared_session: d.n, evidence: `${where}. It declares a session AHEAD of the latest log, so the numbers disagree and cannot say whether it is current`, could_not_tell: "ahead_of_latest" });
      continue;
    }
    inputs.push({ input, verdict: d.n < latest.n ? "stale" : "current", declared_session: d.n, evidence: where });
  }
  for (const i of inputs) {
    const key = (Object.keys(INPUT_REL) as InputKey[]).find((k) => INPUT_REL[k] === i.input)!;
    if (readAs[key]) i.evidence += ` (${readAs[key]})`;
  }
  return { signal: STALENESS_SIGNAL, latest, inputs, not_judged };
}

function readInputs(root: string): { paths: Record<InputKey, string>; texts: Record<InputKey, string | null>; undecodable: Partial<Record<InputKey, string>>; readAs: Partial<Record<InputKey, string>>; encodings: Partial<Record<InputKey, TextEncoding>> } {
  const paths = Object.fromEntries((Object.keys(INPUT_REL) as InputKey[]).map((k) => [k, join(root, INPUT_REL[k])])) as Record<InputKey, string>;
  const texts = {} as Record<InputKey, string | null>;
  const undecodable: Partial<Record<InputKey, string>> = {};
  const readAs: Partial<Record<InputKey, string>> = {};
  const encodings: Partial<Record<InputKey, TextEncoding>> = {};
  for (const k of Object.keys(paths) as InputKey[]) {
    const d = readText(paths[k]);
    texts[k] = d?.text ?? null;
    if (d?.undecodable) undecodable[k] = d.undecodable;
    if (d?.encoding === "windows-1252") readAs[k] = READ_AS_1252;
    if (d) encodings[k] = d.encoding;
  }
  return { paths, texts, undecodable, readAs, encodings };
}

// ---------------------------------------------------------------------------
// The draft
// ---------------------------------------------------------------------------

function lineCount(text: string | null): number {
  return text ? text.split(/\r?\n/).length : 0;
}

export function buildImportDraft(projectRoot: string, today: string, templateDir = defaultTemplateDir()): ImportDraft {
  const root = resolve(projectRoot);
  const pkg = readJson<{ name?: string; version?: string }>(join(root, "package.json"));
  const { paths, texts, undecodable, readAs, encodings } = readInputs(root);

  const last = findLastSession(join(root, ".agents/SESSIONS"), today);
  const current = last.n;

  const report: ImportReport = {
    project: pkg?.name
      ? { name: pkg.name, version: pkg.version ?? "0.0.0", name_from: "package.json" }
      : { name: basename(root), version: pkg?.version ?? "0.0.0", name_from: "folder" },
    current_session: current,
    migration_date: today,
    staleness: detectStaleness(texts, last, undecodable, readAs, encodings),
    sources: Object.fromEntries(Object.entries(paths).map(([k, p]) => [k, { path: relative(root, p).replace(/\\/g, "/"), present: existsSync(p), lines: lineCount(texts[k as keyof typeof texts]) }])),
    inbox: {
      items: 0,
      box_counts: emptyStatusCounts(),
      by_priority: { P0: emptyStatusCounts(), P1: emptyStatusCounts(), P2: emptyStatusCounts(), P3: emptyStatusCounts() },
      by_status: emptyStatusCounts(),
      completed_section_items: 0,
      unparsed: [],
      superseded_links: [],
      sessions: { parsed: 0, inferred_open_as_current: 0, inferred_done_as_retention_edge: 0 },
      title_fallbacks: [],
      retention_eligible_done: 0,
      template_copy: isTemplateInbox(texts.inbox, templateDir),
    },
    objective: { found: false, preview: "" },
    decisions: { imported: 0, date_from_line: 0, date_partial: [], date_unknown: 0, skipped: [] },
    decisions_unreadable: null,
    handoff: { pick_up_lines: 0, watch_out: 0, open_questions: 0, sections_not_imported: [] },
    last_session: last,
    verified_imported: 0,
    gaps_imported: 0,
    summary_removal: null,
  };

  const tasks = texts.inbox ? importTasks(texts.inbox, current, report.inbox) : [];
  const { objective, preview } = importObjective(texts.task, current);
  report.objective = { found: objective !== null, preview };
  const decisions = texts.decisions ? importDecisions(texts.decisions, today, report.decisions) : [];
  if (texts.decisions && undecodable.decisions) report.decisions_unreadable = decisionsUnreadable(texts.decisions, undecodable.decisions, decisions.map((d) => d.id));
  const handoff = importHandoff(texts.next, current, report.handoff);
  const verified: Verified[] = [];
  const gaps: Gap[] = [];
  report.verified_imported = verified.length;
  report.gaps_imported = gaps.length;
  if (texts.summary) report.summary_removal = planSummaryRemoval(texts.summary).report;

  const state: State = {
    schema_version: 3,
    revision: 0,
    project: { name: report.project.name },
    objective,
    tasks,
    verified,
    gaps,
    decisions,
    handoffs: [handoff],
    // Schema v3 (T-163): the prose session log's last session becomes the first
    // entry of sessions[]; its seat and checkout were never recorded.
    sessions: [{ n: last.n, date: last.date, uuid: last.uuid, seat: null, checkout: null, first_rev: null }],
  };
  return { state, report };
}

/** Line ends aside: autocrlf may have rewritten a checkout of the same bytes. */
function isTemplateInbox(text: string | null, templateDir: string): boolean {
  if (text === null) return false;
  const tmpl = readText(join(templateDir, INPUT_REL.inbox));
  return tmpl !== null && tmpl.text.replace(/\r\n/g, "\n") === text.replace(/\r\n/g, "\n");
}

// ---------------------------------------------------------------------------
// SUMMARY.md surgery: the status blockquote after the title and the
// `## Current State` section. Everything else survives byte for byte.
// ---------------------------------------------------------------------------

export function planSummaryRemoval(text: string): { text: string; report: NonNullable<ImportReport["summary_removal"]> } {
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(nl);
  const titleIdx = lines.findIndex((l) => l.startsWith("# "));
  const remove = new Set<number>();
  let blockquote = 0;
  if (titleIdx !== -1) {
    // From the title: blank lines and `>` lines are the status block; stop at the first other line.
    let i = titleIdx + 1;
    while (i < lines.length && (lines[i].trim() === "" || lines[i].startsWith(">"))) {
      if (lines[i].startsWith(">")) blockquote++;
      remove.add(i);
      i++;
    }
    // Don't eat the blank line that separates the title from the next heading when there was no blockquote.
    if (blockquote === 0) remove.clear();
  }
  let currentState = 0;
  const csIdx = lines.findIndex((l) => /^## Current State\b/.test(l));
  if (csIdx !== -1) {
    let i = csIdx;
    while (i < lines.length && (i === csIdx || !lines[i].startsWith("## "))) { remove.add(i); currentState++; i++; }
  }
  const kept = lines.filter((_, i) => !remove.has(i));
  const keptHeadings = kept.filter((l) => l.startsWith("## ")).map((l) => l.slice(3).trim());
  return {
    text: kept.join(nl),
    report: { title_line: titleIdx + 1, blockquote_lines: blockquote, current_state_lines: currentState, total_lines_removed: remove.size, kept_headings: keptHeadings },
  };
}

// ---------------------------------------------------------------------------
// The report (markdown)
// ---------------------------------------------------------------------------

export const ACCEPT_STALE_FLAG = "--accept-stale";

/** The report's first section: staleness goes where a reviewer reads first. */
export function renderStaleness(s: StalenessReport): string[] {
  const L: string[] = ["## Staleness — read this first", ""];
  L.push(`Signal: ${s.signal}.`);
  L.push(s.latest ? `Latest session: Session ${s.latest.n} (\`${s.latest.file}\`).` : "Latest session: none found, so no input can be judged.", "");
  const order: StalenessVerdict[] = ["stale", "could_not_tell", "current"];
  const label: Record<StalenessVerdict, string> = { stale: "**STALE**", could_not_tell: "could not tell", current: "current" };
  for (const v of order) for (const i of s.inputs.filter((x) => x.verdict === v)) L.push(`- ${label[v]} \`${i.input}\`: ${i.evidence}`);
  for (const n of s.not_judged) L.push(`- not judged \`${n.input}\`: ${n.reason}`);
  L.push("");
  const stale = s.inputs.filter((i) => i.verdict === "stale").length;
  const unreadable = s.inputs.filter((i) => i.verdict === "could_not_tell" && blocksCommit(i)).length;
  const unknown = s.inputs.filter((i) => i.verdict === "could_not_tell" && !blocksCommit(i)).length;
  if (stale > 0) L.push(`**\`--commit\` refuses while an input above is STALE.** Update it and re-run \`--draft\`, or pass \`${ACCEPT_STALE_FLAG}\` to import it as it stands.`);
  else L.push("No input is stale.");
  if (unreadable > 0) L.push(`**\`--commit\` refuses while an input above cannot be read**, because it might be stale. Save it as UTF-8 and re-run \`--draft\`, or pass \`${ACCEPT_STALE_FLAG}\` to import it as it stands.`);
  if (unknown > 0) L.push(`${unknown} input(s) could not be judged. That does not block \`--commit\`, and it is not a finding that they are up to date.`);
  return L;
}

export function renderImportReport(r: ImportReport, mode: "draft" | "commit"): string {
  const L: string[] = [];
  L.push(`# state.json import report — ${mode} (${r.migration_date})`, "");
  L.push(...renderStaleness(r.staleness), "");
  if (r.project.name_from === "folder") L.push(`Project name: \`${r.project.name}\` is the folder's name: there is no package.json name. It can be changed later; nothing else depends on package.json.`, "");
  L.push(`Project: ${r.project.name} v${r.project.version} · current session ${r.current_session} (from ${r.last_session.file}) · retention: every imported done item (closed before the record existed, closed_rev null) is dropped once ${DONE_RETENTION_SESSIONS} sessions have written to the record, unless its id is cited in the tracked tree`, "");
  L.push("## Sources", "");
  for (const [k, s] of Object.entries(r.sources)) L.push(`- ${k}: \`${s.path}\` — ${s.present ? `${s.lines} lines` : "ABSENT"}`);
  L.push("", "## Tasks (INBOX.md)", "");
  const warning = inboxWarning(r);
  if (warning) L.push(`**${warning}**`, "");
  L.push(`Items parsed: ${r.inbox.items} (of which ${r.inbox.completed_section_items} under \`## Completed\`, imported as P3).`, "");
  L.push("Box counts as written (before the `[superseded]` rule):", "");
  for (const s of STATUSES) L.push(`- ${s}: ${r.inbox.box_counts[s]}`);
  L.push("", "Imported status by priority (after the `[superseded]` rule — superseded items are done):", "");
  L.push("| priority | open | in_progress | blocked | done | total |", "|---|---|---|---|---|---|");
  for (const p of PRIORITIES) {
    const row = r.inbox.by_priority[p];
    L.push(`| ${p} | ${row.open} | ${row.in_progress} | ${row.blocked} | ${row.done} | ${STATUSES.reduce((a, s) => a + row[s], 0)} |`);
  }
  L.push(`| **all** | ${r.inbox.by_status.open} | ${r.inbox.by_status.in_progress} | ${r.inbox.by_status.blocked} | ${r.inbox.by_status.done} | ${r.inbox.items} |`);
  L.push("", `Sessions: ${r.inbox.sessions.parsed} items had a \`(Session N)\` marker (opened = min, closed = max for done); ${r.inbox.sessions.inferred_open_as_current} open items had none → opened_session = ${r.current_session}; ${r.inbox.sessions.inferred_done_as_retention_edge} done items had none → closed_session = ${retentionEdge(r.current_session)}.`);
  L.push(`Retention-eligible once ${DONE_RETENTION_SESSIONS} sessions have written: ${r.inbox.retention_eligible_done} done items (they stay in the snapshot and in git).`, "");
  L.push(`### Superseded links (${r.inbox.superseded_links.length})`, "");
  if (r.inbox.superseded_links.length === 0) L.push("_None._");
  for (const s of r.inbox.superseded_links) L.push(`- ${s.from} (line ${s.from_line}) supersedes ${s.to} (line ${s.to_line})`);
  L.push("", `### Title fallbacks — no bold lead, first sentence used (${r.inbox.title_fallbacks.length})`, "");
  if (r.inbox.title_fallbacks.length === 0) L.push("_None._");
  for (const t of r.inbox.title_fallbacks) L.push(`- line ${t.line}: ${t.title}`);
  L.push("", `### Could not be parsed as items (${r.inbox.unparsed.length})`, "");
  if (r.inbox.unparsed.length === 0) L.push("_None._");
  for (const u of r.inbox.unparsed) L.push(`- line ${u.line}: ${u.reason} — \`${u.text}\``);
  L.push("", "## Objective (task.md)", "", r.objective.found ? `Found: ${r.objective.preview}${r.objective.preview.length >= 160 ? "…" : ""}` : `NOT imported: ${r.objective.preview}`);
  L.push("", "## Decisions (DECISIONS.md)", "");
  L.push(`Imported ${r.decisions.imported} ADRs: ${r.decisions.date_from_line} with a full \`Date:\` line, ${r.decisions.date_partial.length} with a partial date (kept in the note), ${r.decisions.date_unknown} with none (date = migration date, note "imported; original date unknown").`);
  for (const d of r.decisions.date_partial) L.push(`- ${d.id}: original date \`${d.original}\``);
  if (r.decisions.skipped.length) { L.push("", "Skipped:"); for (const s of r.decisions.skipped) L.push(`- line ${s.line}: ${s.reason} — \`${s.heading}\``); }
  if (r.decisions_unreadable) { L.push("", "**Not read in full:**"); for (const l of describeDecisionsUnreadable(r.decisions_unreadable)) L.push(`- ${l}`); }
  L.push("", "## Handoff (next-session.md)", "");
  L.push(`pick_up: ${r.handoff.pick_up_lines} lines · watch_out: ${r.handoff.watch_out} bullets · open_questions: ${r.handoff.open_questions} bullets`);
  if (r.handoff.sections_not_imported.length) { L.push("", "Sections NOT imported (they stay in the snapshot):"); for (const s of r.handoff.sections_not_imported) L.push(`- ${s}`); }
  L.push("", "## Verified and gaps", "", `verified[]: ${r.verified_imported} · gaps[]: ${r.gaps_imported}. The prose files carry none in a form the importer reads, and it invents none. Record them with ob_state after the commit.`);
  L.push("", "## Last session", "", `Session ${r.last_session.n} — ${r.last_session.date} — uuid ${r.last_session.uuid ?? "none"} (${r.last_session.file})`);
  const lastLine = describeLastSession(r.last_session);
  if (lastLine) L.push(lastLine);
  L.push("", "## SUMMARY.md lines `--commit` will remove", "");
  if (!r.summary_removal) L.push("_SUMMARY.md absent — nothing to remove._");
  else {
    const s = r.summary_removal;
    L.push(`- status blockquote after the title (line ${s.title_line}): ${s.blockquote_lines} \`>\` lines`);
    L.push(`- \`## Current State\` through the next \`## \` heading: ${s.current_state_lines} lines`);
    L.push(`- total lines removed (blockquote + surrounding blanks + section): ${s.total_lines_removed}`);
    L.push(`- headings kept byte for byte: ${s.kept_headings.map((h) => `\`${h}\``).join(", ")}`);
  }
  L.push("");
  return L.join("\n");
}

// ---------------------------------------------------------------------------
// Doors
// ---------------------------------------------------------------------------

/**
 * Written beside the snapshot before --commit changes anything, and removed
 * when the import completes or rolls back. Left behind, it means a rollback
 * did not finish (or the process died part-way), and .agents/ cannot be
 * trusted: drafting from it, then committing over it, is how QA 106's D7 lost
 * Session_7.md. The check that reads it is the refusal, first in both doors.
 */
const INCOMPLETE_SUFFIX = ".import-incomplete";

function incompleteNote(snapshotRel: string): string {
  return "A state import --commit started here and did not finish, and its rollback did not complete.\n\n" +
    `.agents/ may be part-migrated. ${snapshotRel}/ holds every original: restore .agents/ from it by hand, then delete this file.\n` +
    "Until then, `open-brain state import --draft` and `--commit` refuse.\n";
}

/**
 * The markers in a directory listing, oldest first. The names end in the date,
 * so name order is date order, whatever order the directory lists them in. A
 * function of its own because neither filesystem it was tried on listed them
 * out of order (NTFS, and tcm's), so a test through the directory could not
 * tell a missing sort; only a direct test can hold it.
 */
export function markersOldestFirst(names: string[]): string[] {
  return names.filter((n) => n.startsWith(SNAPSHOT_PREFIX) && n.endsWith(INCOMPLETE_SUFFIX)).sort();
}

function refuseHalfRestored(root: string): void {
  const archive = join(root, ".agents", "archive");
  if (!existsSync(archive)) return;
  const left = markersOldestFirst(readdirSync(archive));
  if (left.length === 0) return;
  const snapshots = left.map((n) => `.agents/archive/${n.slice(0, -INCOMPLETE_SUFFIX.length)}/`);
  const markers = left.map((n) => `.agents/archive/${n}`).join(" and ");
  // Every door refuses while any marker exists, so a second one means the first
  // was deleted without a restore, or put back by hand. The oldest snapshot then
  // holds the originals; a newer one holds what a later run found (QA 122, O7).
  const from = snapshots.length === 1
    ? `${snapshots[0]}, which holds every original`
    : `${snapshots[0]} (the oldest; it holds the originals from before the first failed --commit); ${snapshots.slice(1).join(" and ")} ${snapshots.length === 2 ? "holds" : "hold"} the tree as a later run found it`;
  throw new Error(`.agents/ is half-restored: an earlier --commit failed and its rollback did not finish. Restore .agents/ by hand from ${from}, then delete ${markers}. Nothing written. Keep a copy of ${left.length === 1 ? "the snapshot" : "every snapshot"} until the re-run completes: that re-run needs --force-snapshot, which deletes ${left.length === 1 ? "it" : "today's"} on success`);
}

export interface DraftResult { draftPath: string; reportPath: string; draft: ImportDraft; validation: { ok: true } | { ok: false; error: string } }

export function runDraft(projectRoot: string, today: string): DraftResult {
  const root = resolve(projectRoot);
  refuseHalfRestored(root);
  if (existsSync(join(root, STATE_REL))) throw new Error(`${STATE_REL} already exists — the importer runs once; nothing written`);
  const draft = buildImportDraft(root, today);
  const validation = StateSchema.safeParse(draft.state);
  const v = validation.success ? { ok: true as const } : { ok: false as const, error: `${validation.error.issues[0].path.join(".") || "$"}: ${validation.error.issues[0].message}` };
  const draftPath = join(root, DRAFT_REL);
  const reportPath = join(root, REPORT_REL);
  mkdirSync(join(root, ".agents"), { recursive: true });
  writeFileSync(draftPath, serializeState(draft.state), "utf-8");
  writeFileSync(reportPath, renderImportReport(draft.report, "draft") + (v.ok ? "\nDraft validates against StateSchema.\n" : `\nDRAFT DOES NOT VALIDATE: ${v.error}\n`), "utf-8");
  return { draftPath, reportPath, draft, validation: v };
}

export interface SnapshotResult { dir: string; files: number }

/**
 * Copies `.agents/` (minus `archive/`) into `.agents/archive/pre-state-migration-<date>/`. Refuses if it exists unless `force`.
 * `made.created` is set to the first directory this call created (the snapshot, or `archive/` above it), so a
 * caller cleaning up after a failure removes exactly that, and never a snapshot it found there (QA 106, D6).
 */
export function takeSnapshot(projectRoot: string, today: string, force: boolean, made: { created: string | null } = { created: null }): SnapshotResult {
  const root = resolve(projectRoot);
  const agents = join(root, ".agents");
  if (!existsSync(agents)) throw new Error(".agents/ does not exist — nothing to migrate");
  const dir = join(agents, "archive", `${SNAPSHOT_PREFIX}${today}`);
  if (existsSync(dir) && !force) throw new Error(`snapshot ${relative(root, dir).replace(/\\/g, "/")} already exists — pass --force-snapshot to overwrite it`);
  made.created = mkdirSync(dir, { recursive: true }) ?? null;
  // Entry by entry: cpSync refuses to copy a directory into its own
  // subtree, and the snapshot lives under .agents/archive/.
  let files = 0;
  for (const name of readdirSync(agents)) {
    if (name === "archive") continue;
    const src = join(agents, name);
    cpSync(src, join(dir, name), {
      recursive: true,
      force: true,
      filter: (p) => { if (statSync(p).isFile()) files++; return true; },
    });
  }
  return { dir, files };
}

export interface CommitResult {
  statePath: string;
  snapshot: SnapshotResult;
  summary: NonNullable<ImportReport["summary_removal"]> | null;
  rendered: string[];
  moved: string[];
  /** Judged again at commit, from the inputs on disk. */
  staleness: StalenessReport;
  /** The stale inputs imported anyway under --accept-stale; empty otherwise. */
  accepted_stale: string[];
  /** The inputs that could not be read, imported anyway under --accept-stale (R4-1); empty otherwise. */
  accepted_unreadable: string[];
  /** DECISIONS.md on disk holds bytes that cannot be read; null when it reads (R4-5). */
  decisions_unreadable: DecisionsUnreadable | null;
  /** The latest session log, including when its bytes could not be read (QA 153 D1). */
  last_session: ImportReport["last_session"];
}

export function runCommit(projectRoot: string, today: string, opts: { forceSnapshot?: boolean; version?: string; acceptStale?: boolean } = {}): CommitResult {
  const root = resolve(projectRoot);
  refuseHalfRestored(root);
  const statePath = join(root, STATE_REL);
  if (existsSync(statePath)) throw new Error(`${STATE_REL} already exists — the importer runs once; nothing written`);
  const draftPath = join(root, DRAFT_REL);
  if (!existsSync(draftPath)) throw new Error(`${DRAFT_REL} not found — run \`open-brain state import --draft\` first and have the draft reviewed`);
  const parsed = parseState(readFileSync(draftPath, "utf-8"));
  if (!parsed.ok) throw new Error(`${DRAFT_REL} does not validate at ${parsed.error} — nothing written`);
  if (parsed.data.revision !== 0) throw new Error(`${DRAFT_REL} revision must be 0 (is ${parsed.data.revision}) — nothing written`);

  // 0. T-180: a stale input refuses before anything is written, including the snapshot.
  const onDisk = readInputs(root);
  const last_session = findLastSession(join(root, ".agents/SESSIONS"), today);
  const staleness = detectStaleness(onDisk.texts, last_session, onDisk.undecodable, onDisk.readAs, onDisk.encodings);
  const stale = staleness.inputs.filter((i) => i.verdict === "stale");
  // R4-1: an input that cannot be read blocks like STALE; could-not-tell for any other reason does not.
  const unreadable = staleness.inputs.filter((i) => i.verdict === "could_not_tell" && blocksCommit(i));
  if (stale.length + unreadable.length > 0 && opts.acceptStale !== true) {
    const why: string[] = [];
    if (stale.length > 0) why.push(`${stale.length} input(s) predate the latest session (Session ${staleness.latest!.n}): ${stale.map((i) => `${i.input} declares Session ${i.declared_session}`).join("; ")}`);
    if (unreadable.length > 0) why.push(`${unreadable.length} input(s) cannot be read, so whether they are current cannot be told: ${unreadable.map((i) => `${i.input} ${i.evidence}`).join("; ")}`);
    throw new Error(`${why.join(". ")}. Nothing written. Update them and re-run --draft, or pass ${ACCEPT_STALE_FLAG} to import them as they stand`);
  }
  // SUMMARY.md is the one input --commit rewrites in place rather than regenerates.
  const summaryPath = join(root, ".agents/SYSTEM/SUMMARY.md");
  const summaryRead = readText(summaryPath);
  if (summaryRead?.undecodable) throw new Error(`.agents/SYSTEM/SUMMARY.md ${summaryRead.undecodable}, and --commit rewrites it in place. Nothing written. Save it as UTF-8 and re-run --draft`);
  // Windows-1252 is a guess. It is safe for a verdict, which reads only ASCII,
  // but not for a file written back: a wrong guess would rewrite its other text.
  if (summaryRead?.encoding === "windows-1252") throw new Error(`.agents/SYSTEM/SUMMARY.md is not valid UTF-8 and has no byte-order mark, so its encoding can only be guessed, and --commit rewrites it in place. Nothing written. Save it as UTF-8 and re-run --draft`);

  // 1. Snapshot before anything under .agents/ changes. From here on the
  // import completes or changes nothing (R2-3): every later step runs inside
  // `migrate`, and a failure in any of them puts .agents/ back from the snapshot.
  const agents = join(root, ".agents");
  const archive = join(agents, "archive");
  const snapshotDir = join(archive, `${SNAPSHOT_PREFIX}${today}`);
  // --force-snapshot replaces an earlier snapshot; keep it aside until the import completes.
  const aside = opts.forceSnapshot === true && existsSync(snapshotDir) ? `${snapshotDir}.replaced-${process.pid}` : null;
  if (aside) renameSync(snapshotDir, aside);
  let snapshot: SnapshotResult;
  const made: { created: string | null } = { created: null };
  const marker = `${snapshotDir}${INCOMPLETE_SUFFIX}`;
  try {
    snapshot = takeSnapshot(root, today, opts.forceSnapshot === true, made);
    writeFileSync(marker, incompleteNote(relative(root, snapshotDir).replace(/\\/g, "/")), "utf-8");
  } catch (err) {
    // .agents/ outside archive/ is untouched. Only what this run created goes:
    // the snapshot's "already exists" refusal is thrown in here, and that
    // snapshot is the operator's, not this run's (QA 106, D6).
    if (made.created) rmSync(made.created, { recursive: true, force: true });
    if (aside) renameSync(aside, snapshotDir);
    throw err;
  }

  const migrate = () => {
    // 2. state.json at revision 0, canonical bytes.
    writeFileSync(statePath, serializeState(parsed.data), "utf-8");

    // 3. SUMMARY.md surgery (the removed text is in the snapshot).
    let summary: CommitResult["summary"] = null;
    if (summaryRead) {
      const plan = planSummaryRemoval(summaryRead.text);
      writeFileSync(summaryPath, summaryBytes(plan.text));
      summary = plan.report;
    }

    // 4. Render the four views through the Loop 3 renderers (empty batch = no revision bump).
    // A project may lack a directory a view lives in (QA 102's PROBE-2: no SESSIONS/).
    for (const d of ["SESSIONS", "TASKS", "SYSTEM"]) mkdirSync(join(agents, d), { recursive: true });
    const r = applyStateOps(root, { session: lastSession(parsed.data)?.n ?? 0, expected_revision: 0, ops: [], render: true, version: opts.version });
    if (!r.ok) throw new Error(`render after commit refused: ${r.error}`);

    // 5. Move the draft and the report into the snapshot.
    const moved: string[] = [];
    for (const rel of [DRAFT_REL, REPORT_REL]) {
      const from = join(root, rel);
      if (!existsSync(from)) continue;
      const to = join(snapshot.dir, rel.replace(/^\.agents\//, ""));
      renameSync(from, to);
      moved.push(relative(root, to).replace(/\\/g, "/"));
    }
    return { summary, rendered: r.rendered, moved };
  };

  let done: ReturnType<typeof migrate>;
  try {
    done = migrate();
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    throw new Error(`${why}. ${rollBack(agents, snapshot.dir, made.created, aside, marker)}`);
  }
  rmSync(marker, { force: true });
  if (aside) rmSync(aside, { recursive: true, force: true });
  const decisionsText = onDisk.texts.decisions;
  const decisions_unreadable = decisionsText !== null && onDisk.undecodable.decisions ? decisionsUnreadable(decisionsText, onDisk.undecodable.decisions, parsed.data.decisions.map((d) => d.id)) : null;
  return { statePath, snapshot, summary: done.summary, rendered: done.rendered, moved: done.moved, staleness, accepted_stale: stale.map((i) => i.input), accepted_unreadable: unreadable.map((i) => i.input), decisions_unreadable, last_session };
}

/**
 * Puts `.agents/` back as the snapshot recorded it, then removes the snapshot.
 * The snapshot is deleted only after the restore finished, so a restore that
 * fails part-way leaves the one copy that can repair it, and says where.
 */
function rollBack(agents: string, snapshotDir: string, created: string | null, aside: string | null, marker: string): string {
  try {
    for (const name of readdirSync(agents)) if (name !== "archive") rmSync(join(agents, name), { recursive: true, force: true });
    for (const name of readdirSync(snapshotDir)) cpSync(join(snapshotDir, name), join(agents, name), { recursive: true });
  } catch (err) {
    // The marker stays, so every later --draft and --commit refuses until it goes (D7).
    return `ROLLBACK FAILED (${err instanceof Error ? err.message : String(err)}): .agents/ is part-migrated. Restore it by hand from ${snapshotDir}, which was kept. --draft and --commit refuse until ${marker} is deleted`;
  }
  if (created) rmSync(created, { recursive: true, force: true });
  rmSync(marker, { force: true });
  if (aside) renameSync(aside, snapshotDir);
  return "Rolled back: .agents/ was restored from the snapshot, and the snapshot removed, so nothing changed";
}
