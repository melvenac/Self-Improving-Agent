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

/** That seat's handoff as committed at `ref`, or null when absent/unparseable there. */
function handoffAt(projectRoot: string, ref: string, seat: Seat): Handoff | null {
  const text = gitOut(projectRoot, ["show", `${ref}:${STATE_REL}`]);
  if (text === null) return null;
  const parsed = parseState(text);
  if (!parsed.ok) {
    // An OLDER revision may predate schema v2 entirely — it carried a single
    // `handoff` with no seat. That is not an error to report; it is the boundary
    // of what can be compared, and the walk simply stops there.
    return null;
  }
  return parsed.data.handoffs.find((h) => h.seat === seat) ?? null;
}

/**
 * A stable string for comparison. Key order comes from the file, which
 * `serializeState` writes canonically — but a hand-edited or differently-ordered
 * copy must not read as a different handoff, so the keys are sorted here rather
 * than trusted.
 */
function stable(h: Handoff): string {
  return JSON.stringify(h, Object.keys(h).sort());
}

/** execFileSync with an args array: no shell, so `ref:path` reaches git verbatim. */
function gitOut(cwd: string, args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 16 * 1024 * 1024 });
  } catch {
    return null;
  }
}
