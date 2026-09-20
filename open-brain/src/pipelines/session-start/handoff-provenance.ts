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
  bound: number = DEFAULT_BOUND
): HandoffProvenance {
  const base: HandoffProvenance = { seat, commit: null, date: null, searched: 0, bound, note: null };

  const head = handoffAt(projectRoot, "HEAD", seat);
  if (head === null) {
    return { ...base, note: `no committed handoff for "${seat}" at HEAD — nothing to trace` };
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
    const entry = handoffAt(projectRoot, commits[i].sha, seat);
    if (entry !== null && stable(entry) === target) {
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

/** That seat's handoff as committed at `ref`, or null when absent/unreadable there. */
function handoffAt(projectRoot: string, ref: string, seat: Seat): Handoff | null {
  const text = gitOut(projectRoot, ["show", `${ref}:${STATE_REL}`]);
  if (text === null) return null;
  const parsed = parseState(text);
  if (parsed.ok) return parsed.data.handoffs.find((h) => h.seat === seat) ?? null;
  return v1HandoffAt(text);
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
