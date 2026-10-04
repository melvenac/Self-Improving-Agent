import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { TaskPriority, isOpenGap, newestHandoffPerInstance, ownHandoff, questionOwner, questionResolvedBy, questionText, watchExpires, watchText } from "../../shared/state-schema.js";
import type { State, Seat, WatchOut } from "../../shared/state-schema.js";
import { HANDOFF_CAPS } from "../../shared/handoff-caps.js";
import type { DriftResult } from "./types.js";
import { COUNT_ONLY_PRIORITIES, GAP_CLIP, TITLE_CLIP, clip, newestGapFirst, splitQuestions } from "./state-render.js";

/**
 * T-233 B (item 1): the whole /start briefing, rendered in code.
 *
 * /start used to ASSEMBLE the briefing from skill text, so the same record produced a different briefing in every
 * session, and a fix that lived in that text had to be carried by hand at every roll (the paragraph of the brief that
 * names this). `renderBriefing` is the one function every runtime calls; /start prints its output verbatim and adds only
 * FLAGS. It is pure: every input is collected by a function below or by the caller, so a test hands it a record and
 * reads the text, and Relay's /start gets the same bytes from the same function.
 */
export const BRIEFING_START = "## Briefing (print everything down to the End Briefing line verbatim, then FLAGS)";
export const BRIEFING_END = "## End Briefing";

export interface BriefingInput {
  /** describeServingBuild()'s line. The FIRST line of the block: a stale serving build is the one thing the reader must not miss. */
  serving: string;
  state: State;
  version: string;
  /** The reading seat's role, so its OWN handoff is the pick-up. Null: unresolved, and the briefing says so. */
  seat: Seat | null;
  /** `Session #N`'s number, or null when no log was created (the briefing then says why instead of inventing one). */
  sessionNumber: number | null;
  sessionNote: string | null;
  date: string;
  drift: DriftResult[];
  usage: string;
  latestBrief: string | null;
  workingTree: string;
  skills: string;
  /**
   * T-236 slice 2, OPT-IN per repo (greeting.json `briefing_budget`), default OFF. On: the budgeted layout (`renderBudgeted`).
   * Off or absent: the original layout below, untouched, which is what A2A's /start prints byte for byte.
   */
  budget?: boolean;
  /**
   * T-236 (c), OPT-IN (greeting.json `briefing_focus`), and only inside the budgeted layout. Precomputed by the caller
   * (focus.ts) from the record and the roster ob_start already fetched. Absent: the budgeted layout of slice 2, unchanged.
   */
  focus?: { focus: string | null; seats: string | null };
  /**
   * T-199, OPT-IN per repo (greeting.json `missing_handoff`), default OFF. The one-line notice that this checkout's last session
   * wrote the record and left no handoff, or that the check could not run. Null or absent prints nothing, so every other render is
   * byte-identical. The legacy layout prints it as its own line after the pick-up; the budgeted layout has no spare line (it is
   * exactly at its cap), so it is APPENDED to the pick-up line, which is never cut after the append.
   */
  missingHandoff?: string | null;
  /**
   * T-239, OPT-IN per repo (greeting.json `handoff_by_checkout`, via `handoffCheckout`), default OFF. Set: the reader's
   * checkout, and only that checkout's handoff is the pick-up. Absent: the role's newest handoff, as before.
   */
  ownCheckout?: string;
}

/** PICK UP HERE when the reader's seat resolved and no handoff is its own. */
function noneRecorded(seat: Seat, ownCheckout: string | undefined): string {
  return ownCheckout === undefined ? `none recorded for this seat (${seat})` : `none recorded for this checkout (${seat}, ${ownCheckout})`;
}

const NEXT_SHOWN = 3;
const GAPS_BRIEFED = 5;

export function renderBriefing(i: BriefingInput): string[] {
  if (i.budget === true) return renderBudgeted(i);
  const s = i.state;
  const out: string[] = [BRIEFING_START];

  out.push(i.serving);
  out.push(i.usage);
  const session = i.sessionNumber !== null ? `Session ${i.sessionNumber}` : `Session (${i.sessionNote ?? "no log created"})`;
  out.push(`${session} — ${i.date} · ${s.project.name} v${i.version} · state rev ${s.revision}`);
  out.push(
    i.drift.length === 0
      ? "Drift: none"
      : `Drift detected (${i.drift.length}): ${i.drift.map((d) => `${d.field}: expected ${d.expected}, got ${d.actual}${d.fixed ? " (fixed)" : " (not fixed)"}`).join("; ")}`,
  );

  out.push("", "OBJECTIVE");
  out.push(s.objective ? `${s.objective.text} (since session ${s.objective.since_session})` : "none");

  const active = s.tasks.filter((t) => t.status !== "done");
  const done = s.tasks.length - active.length;
  const byPriority = TaskPriority.options.map((p) => [p, active.filter((t) => t.priority === p)] as const);
  out.push("", "NEXT");
  // NEXT is chosen from the priorities the State block names (P0, P1); P2 and P3 are counts there, so they are counts here.
  const ranked = byPriority.filter(([p]) => !COUNT_ONLY_PRIORITIES.has(p)).flatMap(([, group]) => group).slice(0, NEXT_SHOWN);
  for (const t of ranked) out.push(`- [${t.priority}] ${t.id} ${t.title.length > TITLE_CLIP ? `${t.title.slice(0, TITLE_CLIP).trimEnd()}…` : t.title}`);
  if (ranked.length === 0) out.push("- (no active P0 or P1 task)");
  out.push(`${active.length} active (${byPriority.map(([p, g]) => `${g.length} ${p}`).join(", ")}); ${done} done. Backlog order, not a decision: the pick-up below rules what starts.`);

  const own = ownHandoff(s.handoffs, i.seat, i.ownCheckout);
  out.push("", "PICK UP HERE");
  if (own) out.push(own.pick_up.trim() === "" ? "(nothing recorded)" : own.pick_up.trim());
  else if (i.seat === null) out.push("none: this reader's seat is unresolved, so no handoff is named as yours");
  else out.push(noneRecorded(i.seat, i.ownCheckout));
  if (i.missingHandoff) out.push(i.missingHandoff);

  if (own && own.watch_out.length > 0) {
    out.push("", "WATCH OUT");
    for (const w of own.watch_out) out.push(`- ${watchText(w)}`);
  }

  if (own) {
    const { open, resolved } = splitQuestions(own.open_questions);
    if (open.length > 0 || resolved > 0) {
      out.push("", "OPEN QUESTIONS");
      for (const q of open) out.push(`- ${q}`);
      if (resolved > 0) out.push(`(${resolved} resolved, not shown)`);
    }
  }

  const gaps = s.gaps.filter(isOpenGap).sort(newestGapFirst);
  const blocked = s.tasks.filter((t) => t.status === "blocked");
  if (gaps.length > 0 || blocked.length > 0) {
    out.push("", `BROKEN (${gaps.length} gaps open${gaps[0] ? `; newest ${gaps[0].id}` : ""})`);
    for (const g of gaps.slice(0, GAPS_BRIEFED)) out.push(`- ${g.id} — ${clip(g.what, GAP_CLIP, `gaps[${g.id}]`)}`);
    // A blocked P0/P1 is named; a blocked P2/P3 is counted, as everywhere else the greeting treats those priorities.
    for (const t of blocked.filter((t) => !COUNT_ONLY_PRIORITIES.has(t.priority))) out.push(`- blocked: ${t.id} ${t.title}`);
    const hiddenBlocked = blocked.filter((t) => COUNT_ONLY_PRIORITIES.has(t.priority)).length;
    if (hiddenBlocked > 0) out.push(`- blocked: ${hiddenBlocked} P2/P3 task(s): INBOX.md`);
  }

  out.push("", i.workingTree);
  if (i.latestBrief) out.push(i.latestBrief);
  out.push(i.skills);
  out.push(BRIEFING_END);
  return out;
}

/* ------------------------------------------------------------------------- *
 * T-236 slice 2: the budgeted layout. OPT-IN; `renderBriefing` above is the default and does not call any of this.
 * ------------------------------------------------------------------------- */

/** What the budgeted briefing must fit in: ~4 KB and ~30 lines (T-236 (f)). A test renders the worst case against both. */
export const BRIEFING_BUDGET = { lines: 30, chars: 4096 } as const;

/** Per-section caps. Each section ends with `+N more: <pointer>` when it cuts, never silently. */
const CAPS = { objective: 400, next: 2, watch: HANDOFF_CAPS.watchOuts, watchChars: HANDOFF_CAPS.watchOutChars, waiting: 2, open: 2, question: 160, drift: 160, blocked: 3 } as const;
const MORE_WATCH = "state.json handoffs[].watch_out";
const MORE_QUESTIONS = "state.json handoffs[].open_questions";
const MORE_TASKS = "state.json tasks[]";

/** One line: whitespace flattened, cut at `limit` with the full length named. A clip is never silent. */
function cut(text: string, limit: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= limit ? flat : `${flat.slice(0, limit).trimEnd()}… (${flat.length} chars)`;
}

/**
 * Has this watch-out expired? A number is the LAST SESSION it prints in; an ISO date is the last DAY. With no session number
 * (no log was created) a numeric expiry cannot be judged, so the item is kept: fail toward showing, never toward dropping.
 */
function isExpired(w: WatchOut, sessionNumber: number | null, date: string): boolean {
  const e = watchExpires(w);
  if (e === null) return false;
  if (typeof e === "number") return sessionNumber !== null && sessionNumber > e;
  return date > e;
}

function renderBudgeted(i: BriefingInput): string[] {
  const s = i.state;
  const out: string[] = [BRIEFING_START, i.serving, i.usage];
  const session = i.sessionNumber !== null ? `Session ${i.sessionNumber}` : `Session (${i.sessionNote ?? "no log created"})`;
  const drift =
    i.drift.length === 0
      ? "Drift: none"
      : cut(`Drift detected (${i.drift.length}): ${i.drift.map((d) => `${d.field}: expected ${d.expected}, got ${d.actual}${d.fixed ? " (fixed)" : " (not fixed)"}`).join("; ")}`, CAPS.drift);
  out.push(`${session} — ${i.date} · ${s.project.name} v${i.version} · state rev ${s.revision} · ${drift}`);

  out.push("OBJECTIVE", s.objective ? `${cut(s.objective.text, CAPS.objective)} (since session ${s.objective.since_session})` : "none");

  // (d) NEXT only when the objective NAMES task ids, and then exactly those. The backlog's order is not a plan.
  const ids = [...new Set(s.objective?.text.match(/\bT-\d+\b/g) ?? [])];
  if (ids.length > 0) {
    out.push("NEXT");
    for (const id of ids.slice(0, CAPS.next)) {
      const t = s.tasks.find((x) => x.id === id);
      out.push(t ? `- [${t.status === "done" ? "done" : t.priority}] ${t.id} ${cut(t.title, 100)}` : `- ${id} (not in the record)`);
    }
    if (ids.length > CAPS.next) out.push(`+${ids.length - CAPS.next} more: ${MORE_TASKS}`);
  }

  // T-236 (c): SEATS, then FOCUS on the PICK UP header line. The budget had no line to spare (30/30 at 6f145faf), so
  // SEATS is paid for by brief and skills sharing one line below, and FOCUS by sharing the header: net 0 lines.
  const seats = i.focus?.seats ?? null;
  if (seats !== null) out.push(seats);
  const own = ownHandoff(s.handoffs, i.seat, i.ownCheckout);
  out.push(i.focus?.focus ? `PICK UP HERE · ${i.focus.focus}` : "PICK UP HERE");
  const pickUp = own
    ? own.pick_up.trim() === "" ? "(nothing recorded)" : cut(own.pick_up, HANDOFF_CAPS.pickUpChars)
    : i.seat === null ? "none: this reader's seat is unresolved, so no handoff is named as yours" : noneRecorded(i.seat, i.ownCheckout);
  out.push(i.missingHandoff ? `${pickUp} · ${i.missingHandoff}` : pickUp);

  if (own) {
    const live = own.watch_out.filter((w) => !isExpired(w, i.sessionNumber, i.date));
    const expired = own.watch_out.length - live.length;
    if (live.length > 0 || expired > 0) {
      out.push("WATCH OUT");
      for (const w of live.slice(0, CAPS.watch)) out.push(`- ${cut(watchText(w), CAPS.watchChars)}`);
      const notes = [live.length > CAPS.watch ? `+${live.length - CAPS.watch} more: ${MORE_WATCH}` : null, expired > 0 ? `${expired} expired, not shown` : null].filter((n): n is string => n !== null);
      if (notes.length > 0) out.push(notes.join(" · "));
    }
  }

  // (e) WAITING ON AARON: every seat's CURRENT handoff (the newest per seat and checkout), unresolved questions owned by aaron.
  const waiting = newestHandoffPerInstance(s.handoffs).flatMap((h) =>
    h.open_questions.filter((q) => questionResolvedBy(q) === null && questionOwner(q)?.toLowerCase() === "aaron").map((q) => `${cut(questionText(q), CAPS.question)} (${h.seat})`),
  );
  if (waiting.length > 0) {
    out.push("WAITING ON AARON:");
    for (const w of waiting.slice(0, CAPS.waiting)) out.push(`- ${w}`);
    if (waiting.length > CAPS.waiting) out.push(`+${waiting.length - CAPS.waiting} more: ${MORE_QUESTIONS}`);
  }

  if (own) {
    let resolved = 0;
    const open: string[] = [];
    for (const q of own.open_questions) {
      if (questionResolvedBy(q) !== null) resolved++;
      else if (questionOwner(q)?.toLowerCase() !== "aaron") open.push(cut(questionText(q), CAPS.question)); // aaron's are WAITING ON AARON, once
    }
    if (open.length > 0 || resolved > 0) {
      out.push("OPEN QUESTIONS");
      for (const q of open.slice(0, CAPS.open)) out.push(`- ${q}`);
      const notes = [open.length > CAPS.open ? `+${open.length - CAPS.open} more: ${MORE_QUESTIONS}` : null, resolved > 0 ? `(${resolved} resolved, not shown)` : null].filter((n): n is string => n !== null);
      if (notes.length > 0) out.push(notes.join(" · "));
    }
  }

  // Gaps are a count, with the newest id; a blocked P0/P1 task is named (capped), a blocked P2/P3 is counted.
  const gaps = s.gaps.filter(isOpenGap).sort(newestGapFirst);
  const blocked = s.tasks.filter((t) => t.status === "blocked");
  const blockedNamed = blocked.filter((t) => !COUNT_ONLY_PRIORITIES.has(t.priority));
  const blockedHidden = blocked.length - blockedNamed.length;
  if (gaps.length > 0 || blocked.length > 0) {
    const parts = [`Gaps: ${gaps.length} open${gaps[0] ? ` (newest ${gaps[0].id})` : ""}`];
    if (blockedNamed.length > 0) {
      const more = blockedNamed.length > CAPS.blocked ? `, +${blockedNamed.length - CAPS.blocked} more: ${MORE_TASKS}` : "";
      parts.push(`blocked: ${blockedNamed.slice(0, CAPS.blocked).map((t) => t.id).join(", ")}${more}`);
    }
    if (blockedHidden > 0) parts.push(`+${blockedHidden} blocked P2/P3`);
    out.push(parts.join(" · "));
  }

  out.push(i.workingTree);
  if (seats !== null && i.latestBrief) out.push(`${i.latestBrief} · ${i.skills}`);
  else {
    if (i.latestBrief) out.push(i.latestBrief);
    out.push(i.skills);
  }
  out.push(BRIEFING_END);
  return out;
}

/* ------------------------------------------------------------------------- *
 * Collectors. Each answers one question and says so when it cannot.
 * ------------------------------------------------------------------------- */

const why = (err: unknown): string => {
  const e = err as { stderr?: string; message?: string };
  return (e.stderr?.trim().split("\n")[0] || e.message || String(err)).split("\n")[0]!;
};

/** `Working tree: clean`, or `N uncommitted: path, path, ...`. Never silent: a git failure is `not checked`. */
export function describeWorkingTree(projectRoot: string): string {
  try {
    const out = execFileSync("git", ["status", "--porcelain"], { cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const paths = out.split("\n").filter((l) => l.trim() !== "").map((l) => l.slice(3));
    if (paths.length === 0) return "Working tree: clean";
    const shown = paths.slice(0, 8).join(", ");
    return `Working tree: ${paths.length} uncommitted: ${shown}${paths.length > 8 ? `, +${paths.length - 8} more` : ""}`;
  } catch (err) {
    return `Working tree: not checked (git: ${why(err)})`;
  }
}

/** The registered skills, from the INDEX.md table rows. "none" and "no index" are different facts. */
export function describeSkills(projectRoot: string): string {
  const path = join(projectRoot, ".agents", "skills", "INDEX.md");
  if (!existsSync(path)) return "Skills: none (no .agents/skills/INDEX.md)";
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (err) {
    return `Skills: not checked (${why(err)})`;
  }
  const names: string[] = [];
  let inTable = false;
  for (const line of text.split(/\r?\n/)) {
    const cells = line.trim().startsWith("|") ? line.trim().split("|").slice(1, -1).map((c) => c.trim()) : null;
    if (cells === null) {
      inTable = false;
      continue;
    }
    if (cells[0] === "Skill") {
      inTable = true;
      continue;
    }
    if (!inTable || cells[0]!.startsWith("---") || cells[0] === "") continue;
    names.push(cells[0]!);
  }
  return names.length === 0 ? "Skills: none" : `Skills: ${names.join(", ")}`;
}

/**
 * T-233 B item 4: `Usage: <level> → <consequence>` from the usage file's `usageLevel`. The path is DATA, not code: the
 * seat's `usage_file:` frontmatter key (`.agents/AGENT.local.md`, then `.agents/AGENT.md`), else the `SIA_USAGE_FILE`
 * environment variable. The consequences are Aaron's usage rules, stated once here. A level this table does not know is
 * `not checked`, never a guess; an absent, unreadable or malformed file is `not checked (<why>)` (D-104/D-106).
 */
export const USAGE_CONSEQUENCES: Readonly<Record<string, string>> = {
  GREEN: "dispatches open",
  AMBER: "small LIGHT tasks only, QA cap 2",
  RED: "devs finish the current step then park; planners rule and merge only",
  STOP: "everyone parks until the 5-hour reset",
};

/** The weekly percentage at which every seat winds down; below it, from 95, the weekly window only holds new work. */
const WEEKLY_STOP = 98;
const WEEKLY_STOP_CONSEQUENCE = "park, push WIP";

function frontmatterValue(file: string, key: string): string | null {
  if (!existsSync(file)) return null;
  const match = readFileSync(file, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  for (const line of match[1]!.split(/\r?\n/)) {
    const at = line.indexOf(":");
    if (at < 0 || line.slice(0, at).trim() !== key) continue;
    let value = line.slice(at + 1).trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) value = value.slice(1, -1).trim();
    return value === "" ? null : value;
  }
  return null;
}

export function describeUsage(projectRoot: string, env: NodeJS.ProcessEnv = process.env): string {
  const notChecked = (cause: string): string => `Usage: not checked (${cause})`;
  let path: string | null = null;
  let source = "";
  try {
    for (const f of ["AGENT.local.md", "AGENT.md"]) {
      const v = frontmatterValue(join(projectRoot, ".agents", f), "usage_file");
      if (v !== null) {
        path = v;
        source = `usage_file in .agents/${f}`;
        break;
      }
    }
  } catch (err) {
    return notChecked(`the seat data could not be read: ${why(err)}`);
  }
  if (path === null && env.SIA_USAGE_FILE) {
    path = env.SIA_USAGE_FILE;
    source = "SIA_USAGE_FILE";
  }
  if (path === null) return notChecked("no usage_file in seat data and no SIA_USAGE_FILE");
  if (/<[^<>\s]+>/.test(path)) return notChecked(`${source} is an unfilled placeholder (${path})`);
  if (!isAbsolute(path)) return notChecked(`${source} is not an absolute path (${path})`);
  if (!existsSync(path)) return notChecked(`${path} does not exist`);
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, ""));
  } catch (err) {
    return notChecked(`${path} is not readable JSON: ${why(err)}`);
  }
  const raw = data && typeof data === "object" && !Array.isArray(data) ? (data as { usageLevel?: unknown }).usageLevel : undefined;
  // The real file's usageLevel is an OBJECT ({level, fiveHourPct, sevenDayPct, fiveHourResetsAt, ...}); the bare string form
  // stays accepted. T-233 B ruling.
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  const levelText = typeof raw === "string" ? raw : obj !== null && typeof obj.level === "string" ? obj.level : null;
  if (levelText === null) return notChecked(`${path} has no usageLevel string or usageLevel.level string`);
  // `level` is free text today ("GREEN (5h 4%); weekly 97%: ...") and one word soon: the 5-hour level is the LEADING WORD.
  const five = /^[A-Za-z]+/.exec(levelText.trim())?.[0].toUpperCase() ?? "";
  const consequence = USAGE_CONSEQUENCES[five];
  if (consequence === undefined) return notChecked(`${path} usageLevel ${JSON.stringify(levelText)} does not start with one of ${Object.keys(USAGE_CONSEQUENCES).join(", ")}`);

  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const fivePct = obj ? num(obj.fiveHourPct) : null;
  let resets: string | null = null;
  if (obj && typeof obj.fiveHourResetsAt === "string") {
    const t = new Date(obj.fiveHourResetsAt);
    if (!Number.isNaN(t.getTime())) resets = `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}Z`;
  }
  const bits = [fivePct !== null ? `5h ${fivePct}%` : null, resets !== null ? `resets ${resets}` : null].filter((b): b is string => b !== null);
  const head = `${five}${bits.length > 0 ? ` (${bits.join(", ")})` : ""}`;

  // WEEKLY comes ONLY from the numeric sevenDayPct. Percentages are never parsed out of the free-text `level`; an absent
  // number is `weekly not checked`. `weeklyOverride` (string, optional) names the loop Aaron lifted the hold for.
  const weekly: number | null = obj ? num(obj.sevenDayPct) : null;
  const override = obj && typeof obj.weeklyOverride === "string" && obj.weeklyOverride.trim() !== "" ? obj.weeklyOverride.trim() : null;
  // T-234 A: at weekly >= 98 the WEEKLY window caused the stop, and the 5-hour reset does not lift it, so the weekly window
  // comes first and the line never names the 5-hour reset. Aaron's one-time reset is his act, not a consequence the line can state.
  if (weekly !== null && weekly >= WEEKLY_STOP) {
    // The band word is STOP whatever the file's leading word says: a GREEN file with weekly 98 must never print GREEN.
    return `Usage: STOP (weekly ${weekly}%) · ${WEEKLY_STOP_CONSEQUENCE}${fivePct !== null ? ` · 5h ${fivePct}%` : ""}`;
  }
  let weeklyConsequence: string | null = null;
  if (weekly !== null && weekly >= 95) {
    weeklyConsequence = override !== null ? `no new QA, tasks or dispatches except ${override} (Aaron's lift)` : "no new QA, tasks or dispatches";
  }
  // Below 95 adds nothing: no weekly segment. Not checked is named, never dropped.
  const weeklyPart = weekly === null ? " + weekly not checked" : weeklyConsequence !== null ? ` + WEEKLY ${weekly}%` : "";
  return `Usage: ${head}${weeklyPart} → ${[consequence, weeklyConsequence].filter((c): c is string => c !== null).join("; ")}`;
}
