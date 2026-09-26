import { execFileSync } from "node:child_process";
import { parseState } from "../../shared/state-schema.js";
import type { Handoff, Seat } from "../../shared/state-schema.js";

/**
 * Which commit last changed a given seat's handoff.
 *
 * ## Why this is DERIVED and not stored
 *
 * The greeting must name the other seats' handoffs by their close-out SHA, and
 * that SHA cannot be written into the record when the handoff is: **the close-out
 * commit does not exist yet at the moment of the write it will contain.** A
 * `recorded_at` field would therefore hold the commit BEFORE the close-out and be
 * quietly wrong for exactly the purpose it was added for.
 *
 * Rule 14 — do not assert what you could derive or check. So this walks the
 * history of `.agents/state.json` and finds the commit where that seat's entry
 * last changed. It is a few `git show` calls at session start, bounded.
 *
 * ## It fails closed, and says which way
 *
 * Three answers, kept apart because they are different facts:
 *
 * - a commit, with its date;
 * - **not found within the bound** — the entry was identical through every
 *   commit examined, so it is OLDER than the window. The bound is printed. This
 *   is not "no commit"; it is "I stopped looking, here is where".
 * - **nothing to look for** — that seat has no handoff at all.
 *
 * A blank is never returned in place of any of these. The failure this replaces
 * is a greeting that names a SHA it guessed.
 */

export interface HandoffProvenance {
  seat: Seat;
  /** The commit where this seat's handoff last changed. Null when not determined. */
  commit: string | null;
  /** Committer date of `commit`, ISO. Null when commit is null. */
  date: string | null;
  /** How many commits were actually examined. */
  searched: number;
  /** The cap on the walk. */
  bound: number;
  /** Why there is no commit. Null exactly when `commit` is non-null. */
  note: string | null;
}

const STATE_REL = ".agents/state.json";
export const DEFAULT_BOUND = 50;

export function findHandoffCommit(
  projectRoot: string,
  seat: Seat,
  bound: number = DEFAULT_BOUND,
  current?: Handoff
): HandoffProvenance {
  const base: HandoffProvenance = { seat, commit: null, date: null, searched: 0, bound, note: null };

  // Schema v3 (T-163) holds one entry per SESSION, so a seat can have several.
  // The entry traced is the one the caller is rendering, found at HEAD by its
  // identity; with no caller entry, the seat's newest.
  const atHead = handoffsAt(projectRoot, "HEAD", seat);
  const head = current
    ? atHead.find((h) => sameEntry(h, current)) ?? null
    : atHead.reduce<Handoff | null>((best, h) => (best === null || h.session >= best.session ? h : best), null);
  if (head === null) {
    return { ...base, note: `no committed handoff for "${seat}" at HEAD — nothing to trace` };
  }

  // F1 — THE SHA IS DERIVED FROM HEAD AND THE WORDS ARE RENDERED FROM DISK, so
  // when they disagree the greeting prints a commit that does not contain the
  // line beneath it. Observed by QA: after `set_handoff` with new words and no
  // commit yet, the greeting showed `close-out 7e1c041` above the NEW first
  // line, and nothing said they were from different places.
  //
  // THE WINDOW IS EVERY `/end`: the record is written before it is committed, so
  // between those two moments every seat's greeting is in this state.
  //
  // A NEW uncommitted entry was already honest — it has no HEAD entry, so it
  // took the branch above. A MODIFIED one was not. The two uncommitted cases now
  // read alike, and this one fails closed: no SHA is offered at all, because a
  // wrong SHA is worse than none. A reader follows a SHA.
  if (current && stable(current) !== stable(head)) {
    return {
      ...base,
      note:
        `uncommitted — the working copy of this seat's handoff differs from HEAD, so no commit contains these words. ` +
        `Commit the record, or read HEAD's version for the committed one.`,
    };
  }

  const log = gitOut(projectRoot, ["log", `--max-count=${bound}`, "--format=%H%x00%cI", "--", STATE_REL]);
  if (log === null || log.trim() === "") {
    return { ...base, note: `git could not list commits touching ${STATE_REL}` };
  }
  const commits = log
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const [sha, date] = line.split("\0");
      return { sha, date };
    })
    .filter((c) => c.sha);

  // Walk newest first. While the entry at commit[i] still equals HEAD's, that
  // commit did not change it; the moment one differs, the PREVIOUS commit is
  // where the current value first appeared.
  const target = stable(head);
  let lastEqual = -1;
  let searched = 0;
  for (let i = 0; i < commits.length; i++) {
    searched++;
    const entries = handoffsAt(projectRoot, commits[i].sha, seat);
    if (entries.some((e) => stable(e) === target)) {
      lastEqual = i;
      continue;
    }
    break;
  }

  if (lastEqual === -1) {
    // HEAD's own blob does not match HEAD's commit — the working tree is ahead
    // of what is committed, or the file changed outside a commit.
    return { ...base, searched, note: `the current handoff for "${seat}" does not match any examined commit` };
  }
  if (lastEqual === commits.length - 1 && commits.length >= bound) {
    return {
      ...base,
      searched,
      note: `unchanged through all ${bound} commits examined — the close-out is older than this window, so no SHA is claimed`,
    };
  }
  return { ...base, commit: commits[lastEqual].sha, date: commits[lastEqual].date ?? null, searched, note: null };
}

/** Same entry across revisions: its session uuid, or for a legacy entry its seat and session. */
function sameEntry(a: Handoff, b: Handoff): boolean {
  // `?? null`: a caller built from a pre-v3 shape has no session_uuid at all.
  const bu = b.session_uuid ?? null;
  const au = a.session_uuid ?? null;
  if (bu !== null) return au === bu;
  return au === null && a.seat === b.seat && a.session === b.session;
}

/**
 * The handoffs committed at `ref` that may be `seat`'s, whatever the schema
 * version there; [] when absent or unreadable. A v1 record's single handoff
 * names no seat, so it is returned for ANY seat and matched on its words alone.
 *
 * Read LOOSELY, not through the current schema. The walk crosses migrations:
 * a v2 revision fails v3's parse, and treating that as "no handoff" would stop
 * the walk at the v3 migration commit and name it as every seat's close-out —
 * the exact defect the v1 → v2 migration caused once (see `stable`).
 */
function handoffsAt(projectRoot: string, ref: string, seat: Seat): Handoff[] {
  const text = gitOut(projectRoot, ["show", `${ref}:${STATE_REL}`]);
  if (text === null) return [];
  const parsed = parseState(text);
  if (parsed.ok) return parsed.data.handoffs.filter((h) => h.seat === seat);
  try {
    const raw = JSON.parse(text) as { handoffs?: unknown };
    if (Array.isArray(raw.handoffs)) {
      return raw.handoffs.flatMap((x) => {
        const h = x as Record<string, unknown>;
        if (h.seat !== seat || typeof h.pick_up !== "string" || !Array.isArray(h.watch_out) || !Array.isArray(h.open_questions)) return [];
        return [{
          seat: h.seat as Seat,
          pick_up: h.pick_up,
          watch_out: h.watch_out as string[],
          open_questions: h.open_questions as string[],
          session: typeof h.session === "number" ? h.session : 0,
          loop_state: null,
          session_uuid: typeof h.session_uuid === "string" ? h.session_uuid : null,
          checkout: typeof h.checkout === "string" ? h.checkout : null,
        }];
      });
    }
  } catch {
    return [];
  }
  const v1 = v1HandoffAt(text);
  return v1 ? [v1] : [];
}

/**
 * A pre-v2 revision carried ONE `handoff` and did not say whose it was.
 *
 * Reading it matters because the history this walk searches crosses the
 * migration. Stopping at that boundary would make the migration commit the
 * answer for every seat — which is exactly the wrong answer, since the real
 * close-out is older than it.
 *
 * The single v1 handoff is returned WITHOUT a seat claim, and `stable()`
 * compares content only, so it matches when it is literally the same handoff and
 * not otherwise. A v1 record cannot tell us whose it was; what it can tell us is
 * whether these are the same words, which is the question being asked.
 *
 * Deliberately hand-parsed rather than validated: this is archaeology on a
 * retired shape, and demanding that an old revision satisfy any current schema
 * would defeat the point.
 */
function v1HandoffAt(text: string): Handoff | null {
  try {
    const raw = JSON.parse(text) as { handoff?: unknown };
    const h = raw.handoff as Record<string, unknown> | undefined;
    if (!h || typeof h.pick_up !== "string" || !Array.isArray(h.watch_out) || !Array.isArray(h.open_questions)) {
      return null;
    }
    return {
      seat: "developer",
      pick_up: h.pick_up,
      watch_out: h.watch_out as string[],
      open_questions: h.open_questions as string[],
      session: typeof h.session === "number" ? h.session : 0,
      loop_state: null,
      session_uuid: null,
      checkout: null,
    };
  } catch {
    return null;
  }
}

/**
 * A stable string for comparison, over the handoff's CONTENT only.
 *
 * `seat` is excluded because it is the search key and constant by construction.
 * `loop_state` is excluded because it is metadata about the loop rather than the
 * handoff a reader is being pointed at.
 *
 * ## Why content and not the whole entry, found by running it
 *
 * The v1 → v2 migration added `seat` and `loop_state` to every entry. Comparing
 * whole entries therefore made the MIGRATION COMMIT the "close-out" for every
 * seat — the greeting named `de4674d`, a developer commit, as the QA seat's
 * close-out. That is accurate to "where this entry last changed" and wrong for
 * the question actually being asked, which is "where did this seat write this".
 *
 * Any future schema change would do the same. Comparing the fields that carry
 * the seat's words means a migration that reshapes the container does not
 * reattribute the contents.
 */
function stable(h: Handoff): string {
  return JSON.stringify({
    pick_up: h.pick_up,
    watch_out: h.watch_out,
    open_questions: h.open_questions,
    session: h.session,
  });
}

/** execFileSync with an args array: no shell, so `ref:path` reaches git verbatim. */
function gitOut(cwd: string, args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 16 * 1024 * 1024 });
  } catch {
    return null;
  }
}
