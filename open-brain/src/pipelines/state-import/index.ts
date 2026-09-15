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
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, cpSync, renameSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  StateSchema,
  parseState,
  serializeState,
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
  project: { name: string; version: string };
  current_session: number;
  migration_date: string;
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
    retention_eligible_on_first_write: number;
  };
  objective: { found: boolean; preview: string };
  decisions: {
    imported: number;
    date_from_line: number;
    date_partial: Array<{ id: string; original: string }>;
    date_unknown: number;
    skipped: Array<{ line: number; heading: string; reason: string }>;
  };
  handoff: { pick_up_lines: number; watch_out: number; open_questions: number; sections_not_imported: string[] };
  last_session: { n: number; date: string; uuid: string | null; file: string };
  verified_seeded: number;
  gaps_seeded: number;
  summary_removal: { title_line: number; blockquote_lines: number; current_state_lines: number; total_lines_removed: number; kept_headings: string[] } | null;
}

export interface ImportDraft { state: State; report: ImportReport }

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

const SECTION_RE = /^## (P[0-3])\b/;
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

function emptyStatusCounts(): Record<Status, number> {
  return { open: 0, in_progress: 0, blocked: 0, done: 0 };
}

export function importTasks(text: string, current: number, report: ImportReport["inbox"]): Task[] {
  const items = parseInboxItems(text, report.unparsed);
  const tasks: Task[] = [];
  const edge = current - DONE_RETENTION_SESSIONS;
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
    if (status === "done" && closed !== null && closed <= edge) report.retention_eligible_on_first_write++;
    if (it.fromCompleted) report.completed_section_items++;
    tasks.push({ id, title, priority: it.priority!, status, opened_session: opened, closed_session: closed, supersedes: null, note });
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

export function importHandoff(text: string | null, current: number, report: ImportReport["handoff"]): State["handoff"] {
  const handoff: State["handoff"] = { pick_up: "", watch_out: [], open_questions: [], session: current };
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

export function findLastSession(sessionsDir: string, today: string): ImportReport["last_session"] {
  if (!existsSync(sessionsDir)) return { n: 0, date: today, uuid: null, file: "(no SESSIONS/ directory)" };
  let best: { n: number; file: string } | null = null;
  for (const f of readdirSync(sessionsDir)) {
    const m = f.match(/^Session_(\d+)\.md$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!best || n > best.n) best = { n, file: f };
    }
  }
  if (!best) return { n: 0, date: today, uuid: null, file: "(no Session_N.md)" };
  const text = readFileSync(join(sessionsDir, best.file), "utf-8");
  const date = text.match(/^# Session \d+\s+[—–-]+\s+(\d{4}-\d{2}-\d{2})/m)?.[1] ?? today;
  const uuid = text.match(/Session ID:\*{0,2}\s*`?([0-9a-fA-F-]{36})`?/)?.[1] ?? null;
  return { n: best.n, date, uuid, file: `.agents/SESSIONS/${best.file}` };
}

// ---------------------------------------------------------------------------
// Seeds (the brief's V-001..V-005 and the carried gaps), since_session 54
// ---------------------------------------------------------------------------

export function seedVerified(): Verified[] {
  const mk = (id: string, claim: string, testPath: string, testObs: string, tag: string, tagObs: string): Verified => ({
    id, claim, since_session: 54, status: "verified",
    evidence: [{ type: "test", path: testPath, observation: testObs }, { type: "tag", path: tag, observation: tagObs }],
  });
  return [
    mk("V-001", "ob_start is the single startup implementation and returns state, drift, session and sizes", "open-brain/tests/server.test.ts", "handleStart shape pinned", "v0.28.0", "accepted Loop 1"),
    mk("V-002", "state.json read side: strict schema, three-way reader, ob_start render, state-schema sync check", "open-brain/tests/shared/state-schema.test.ts", "strict schema + fixture round trip", "v0.29.0", "accepted Loop 2"),
    mk("V-003", "state writer: revision check, atomic batch, retention, four views, ob_state", "open-brain/tests/shared/state-writer.test.ts", "refusals, atomicity, retention, views", "v0.30.0", "accepted Loop 3"),
    mk("V-004", "/sync resolves the project root or refuses; identical from root and open-brain/", "open-brain/tests/pipelines/sync/repo-root.test.ts", "root from subdirectory; refusal names the cwd", "v0.30.0", "accepted Loop 3 (R4)"),
    mk("V-005", "relocate existence check is case-insensitive; CI green on ubuntu", "open-brain/src/relocate.ts", "projectDirExists resolves the canonical path case-insensitively; CI run 34890412313 green on master 86ea010", "v0.29.1", "hotfix merged via PR #4"),
  ];
}

export function seedGaps(): Gap[] {
  const mk = (id: string, what: string, evidence: string, recommended_update: string): Gap => ({ id, what, evidence, recommended_update, opened_session: 54 });
  return [
    mk("G-001", "Cursor start.md/end.md copies are not on ob_start/ob_state", "Loop 1 and Loop 3 Developer reports (gaps[]); Loop 4 C2 freezes the Cursor copies", "Move the Cursor copies in a dedicated loop once ob_state is exercised from a Cursor seat"),
    mk("G-002", "The repo's .claude/ is gitignored; mirror policy for slash commands is undecided", "Loop 1 Developer report (gaps[]); next-session.md carried items at Session 54", "Aaron decides: track .claude/commands/ or keep the template as the only tracked copy"),
    mk("G-003", "SESSION_TEMPLATE.md pre-session checklist still says to read SUMMARY/INBOX by hand", "Loop 1 Developer report (gaps[]); template wording predates ob_start", "Reword the checklist to name ob_start / the /start greeting"),
    mk("G-004", "vault-index-parity warns on one unindexed Checkpoints note", "/sync output at Sessions 53–55 (Loop 2 report, carried)", "Index the note through ob_store or remove it; then the check passes"),
    mk("G-005", "DECISIONS.md is both the prose ADR log and the decisions[] index", "Loop 3 Developer report (gaps[]); importer reads ADR headings, add_decision writes state only", "Decide which is canonical after the first ob_state add_decision; render DECISIONS.md from state or stop importing"),
    mk("G-006", "No CLI door for ob_state (only the MCP tool)", "Loop 3 Developer report (gaps[]); planned as Loop 7", "Add `open-brain state apply` once the tool contract has settled"),
  ];
}

// ---------------------------------------------------------------------------
// The draft
// ---------------------------------------------------------------------------

function readOptional(p: string): string | null {
  return existsSync(p) ? readFileSync(p, "utf-8") : null;
}

function lineCount(text: string | null): number {
  return text ? text.split(/\r?\n/).length : 0;
}

export function buildImportDraft(projectRoot: string, today: string): ImportDraft {
  const root = resolve(projectRoot);
  const pkg = readJson<{ name?: string; version?: string }>(join(root, "package.json"));
  const paths = {
    inbox: join(root, ".agents/TASKS/INBOX.md"),
    task: join(root, ".agents/TASKS/task.md"),
    next: join(root, ".agents/SESSIONS/next-session.md"),
    summary: join(root, ".agents/SYSTEM/SUMMARY.md"),
    decisions: join(root, ".agents/SYSTEM/DECISIONS.md"),
  };
  const texts = { inbox: readOptional(paths.inbox), task: readOptional(paths.task), next: readOptional(paths.next), summary: readOptional(paths.summary), decisions: readOptional(paths.decisions) };

  const last = findLastSession(join(root, ".agents/SESSIONS"), today);
  const current = last.n;

  const report: ImportReport = {
    project: { name: pkg?.name ?? "unknown", version: pkg?.version ?? "0.0.0" },
    current_session: current,
    migration_date: today,
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
      retention_eligible_on_first_write: 0,
    },
    objective: { found: false, preview: "" },
    decisions: { imported: 0, date_from_line: 0, date_partial: [], date_unknown: 0, skipped: [] },
    handoff: { pick_up_lines: 0, watch_out: 0, open_questions: 0, sections_not_imported: [] },
    last_session: last,
    verified_seeded: 0,
    gaps_seeded: 0,
    summary_removal: null,
  };

  const tasks = texts.inbox ? importTasks(texts.inbox, current, report.inbox) : [];
  const { objective, preview } = importObjective(texts.task, current);
  report.objective = { found: objective !== null, preview };
  const decisions = texts.decisions ? importDecisions(texts.decisions, today, report.decisions) : [];
  const handoff = importHandoff(texts.next, current, report.handoff);
  const verified = seedVerified();
  const gaps = seedGaps();
  report.verified_seeded = verified.length;
  report.gaps_seeded = gaps.length;
  if (texts.summary) report.summary_removal = planSummaryRemoval(texts.summary).report;

  const state: State = {
    schema_version: 1,
    revision: 0,
    project: { name: report.project.name },
    objective,
    tasks,
    verified,
    gaps,
    decisions,
    handoff,
    last_session: { n: last.n, date: last.date, uuid: last.uuid },
  };
  return { state, report };
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

export function renderImportReport(r: ImportReport, mode: "draft" | "commit"): string {
  const L: string[] = [];
  L.push(`# state.json import report — ${mode} (${r.migration_date})`, "");
  L.push(`Project: ${r.project.name} v${r.project.version} · current session ${r.current_session} (from ${r.last_session.file}) · retention edge: done items closed ≤ session ${r.current_session - DONE_RETENTION_SESSIONS} are dropped on the first ob_state write`, "");
  L.push("## Sources", "");
  for (const [k, s] of Object.entries(r.sources)) L.push(`- ${k}: \`${s.path}\` — ${s.present ? `${s.lines} lines` : "ABSENT"}`);
  L.push("", "## Tasks (INBOX.md)", "");
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
  L.push("", `Sessions: ${r.inbox.sessions.parsed} items had a \`(Session N)\` marker (opened = min, closed = max for done); ${r.inbox.sessions.inferred_open_as_current} open items had none → opened_session = ${r.current_session}; ${r.inbox.sessions.inferred_done_as_retention_edge} done items had none → closed_session = ${r.current_session - DONE_RETENTION_SESSIONS}.`);
  L.push(`Retention-eligible on the first write: ${r.inbox.retention_eligible_on_first_write} done items (they stay in the snapshot and in git).`, "");
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
  L.push("", "## Handoff (next-session.md)", "");
  L.push(`pick_up: ${r.handoff.pick_up_lines} lines · watch_out: ${r.handoff.watch_out} bullets · open_questions: ${r.handoff.open_questions} bullets`);
  if (r.handoff.sections_not_imported.length) { L.push("", "Sections NOT imported (they stay in the snapshot):"); for (const s of r.handoff.sections_not_imported) L.push(`- ${s}`); }
  L.push("", "## Seeds", "", `verified[]: ${r.verified_seeded} (V-001..V-00${r.verified_seeded}, since_session 54) · gaps[]: ${r.gaps_seeded} (G-001..G-00${r.gaps_seeded}, opened_session 54)`);
  L.push("", "## Last session", "", `Session ${r.last_session.n} — ${r.last_session.date} — uuid ${r.last_session.uuid ?? "none"} (${r.last_session.file})`);
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

export interface DraftResult { draftPath: string; reportPath: string; draft: ImportDraft; validation: { ok: true } | { ok: false; error: string } }

export function runDraft(projectRoot: string, today: string): DraftResult {
  const root = resolve(projectRoot);
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

/** Copies `.agents/` (minus `archive/`) into `.agents/archive/pre-state-migration-<date>/`. Refuses if it exists unless `force`. */
export function takeSnapshot(projectRoot: string, today: string, force: boolean): SnapshotResult {
  const root = resolve(projectRoot);
  const agents = join(root, ".agents");
  if (!existsSync(agents)) throw new Error(".agents/ does not exist — nothing to migrate");
  const dir = join(agents, "archive", `${SNAPSHOT_PREFIX}${today}`);
  if (existsSync(dir) && !force) throw new Error(`snapshot ${relative(root, dir).replace(/\\/g, "/")} already exists — pass --force-snapshot to overwrite it`);
  mkdirSync(dir, { recursive: true });
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
}

export function runCommit(projectRoot: string, today: string, opts: { forceSnapshot?: boolean; version?: string } = {}): CommitResult {
  const root = resolve(projectRoot);
  const statePath = join(root, STATE_REL);
  if (existsSync(statePath)) throw new Error(`${STATE_REL} already exists — the importer runs once; nothing written`);
  const draftPath = join(root, DRAFT_REL);
  if (!existsSync(draftPath)) throw new Error(`${DRAFT_REL} not found — run \`open-brain state import --draft\` first and have the draft reviewed`);
  const parsed = parseState(readFileSync(draftPath, "utf-8"));
  if (!parsed.ok) throw new Error(`${DRAFT_REL} does not validate at ${parsed.error} — nothing written`);
  if (parsed.data.revision !== 0) throw new Error(`${DRAFT_REL} revision must be 0 (is ${parsed.data.revision}) — nothing written`);

  // 1. Snapshot before anything under .agents/ changes.
  const snapshot = takeSnapshot(root, today, opts.forceSnapshot === true);

  // 2. state.json at revision 0, canonical bytes.
  writeFileSync(statePath, serializeState(parsed.data), "utf-8");

  // 3. SUMMARY.md surgery (the removed text is in the snapshot).
  const summaryPath = join(root, ".agents/SYSTEM/SUMMARY.md");
  let summary: CommitResult["summary"] = null;
  if (existsSync(summaryPath)) {
    const plan = planSummaryRemoval(readFileSync(summaryPath, "utf-8"));
    writeFileSync(summaryPath, plan.text, "utf-8");
    summary = plan.report;
  }

  // 4. Render the four views through the Loop 3 renderers (empty batch = no revision bump).
  const r = applyStateOps(root, { session: parsed.data.last_session.n, expected_revision: 0, ops: [], render: true, version: opts.version });
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
  return { statePath, snapshot, summary, rendered: r.rendered, moved };
}
