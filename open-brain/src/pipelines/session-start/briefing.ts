import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { TaskPriority, isOpenGap, newestHandoffForSeat } from "../../shared/state-schema.js";
import type { State, Seat } from "../../shared/state-schema.js";
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
}

const NEXT_SHOWN = 3;
const GAPS_BRIEFED = 5;

export function renderBriefing(i: BriefingInput): string[] {
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

  const own = i.seat ? newestHandoffForSeat(s.handoffs, i.seat) : null;
  out.push("", "PICK UP HERE");
  if (own) out.push(own.pick_up.trim() === "" ? "(nothing recorded)" : own.pick_up.trim());
  else if (i.seat === null) out.push("none: this reader's seat is unresolved, so no handoff is named as yours");
  else out.push(`none recorded for this seat (${i.seat})`);

  if (own && own.watch_out.length > 0) {
    out.push("", "WATCH OUT");
    for (const w of own.watch_out) out.push(`- ${w}`);
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
    return `Usage: ${five} (weekly ${weekly}%) · ${WEEKLY_STOP_CONSEQUENCE}${fivePct !== null ? ` · 5h ${fivePct}%` : ""}`;
  }
  let weeklyConsequence: string | null = null;
  if (weekly !== null && weekly >= 95) {
    weeklyConsequence = override !== null ? `no new QA, tasks or dispatches except ${override} (Aaron's lift)` : "no new QA, tasks or dispatches";
  }
  // Below 95 adds nothing: no weekly segment. Not checked is named, never dropped.
  const weeklyPart = weekly === null ? " + weekly not checked" : weeklyConsequence !== null ? ` + WEEKLY ${weekly}%` : "";
  return `Usage: ${head}${weeklyPart} → ${[consequence, weeklyConsequence].filter((c): c is string => c !== null).join("; ")}`;
}
