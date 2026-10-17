// T-302: commits the reader's OWN handoff cites that the upstream branch already contains.
//
// Maker's S68 greeting (2026-10-17) said four PRs waited on Aaron's merge word three minutes after all four had merged; the
// seat's own fetch already held the merges. This reads only the local repository (no network): a cited SHA that is an
// ancestor of the upstream ref at the last fetch is named. A squash or rebase merge leaves the cited head outside the branch,
// so it is not caught: the line is a lower bound, never a claim that the rest are unmerged.
import type { Handoff } from "../../shared/state-schema.js";
import { questionResolvedBy, questionText, watchText } from "../../shared/state-schema.js";
import { gitLine } from "./git-read.js";

const SHA_RE = /\b[0-9a-f]{7,40}\b/g;
/** Tokens checked at most (one local git call each), so a handoff full of hex cannot slow the start. */
export const MERGED_SCAN_MAX = 24;
/** Short SHAs shown before "(+N)". */
export const MERGED_SHOWN = 4;

/** Distinct 7-40 char hex tokens in the own handoff's pick-up, watch-outs, UNRESOLVED questions and open PRs; all-digit tokens are dates or numbers, not SHAs. */
export function citedShas(h: Handoff): string[] {
  const texts = [
    h.pick_up,
    ...h.watch_out.map(watchText),
    ...h.open_questions.filter((q) => questionResolvedBy(q) === null).map(questionText),
    ...(h.loop_state?.open_prs ?? []).flatMap((p) => [p.ref, p.note]),
  ];
  const out: string[] = [];
  for (const t of texts) {
    for (const m of t.matchAll(SHA_RE)) {
      const s = m[0];
      if (/^\d+$/.test(s) || out.includes(s)) continue;
      out.push(s);
    }
  }
  return out.slice(0, MERGED_SCAN_MAX);
}

/** One line naming the cited SHAs `upstreamRef` contains, or null when there is no handoff, none is cited or none is contained. */
export function describeMergedCitations(projectRoot: string, own: Handoff | null, upstreamRef: string): string | null {
  if (own === null) return null;
  const merged = citedShas(own).filter((s) => gitLine(projectRoot, ["merge-base", "--is-ancestor", s, upstreamRef]) !== null);
  if (merged.length === 0) return null;
  const shown = merged.slice(0, MERGED_SHOWN).map((s) => s.slice(0, 8)).join(", ");
  const more = merged.length > MERGED_SHOWN ? ` (+${merged.length - MERGED_SHOWN})` : "";
  return `Already in ${upstreamRef} (last fetch): ${shown}${more}`;
}
