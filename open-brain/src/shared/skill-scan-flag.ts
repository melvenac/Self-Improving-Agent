/**
 * Loop 9 R1 — the skill scan is OFF.
 *
 * Aaron's ruling. Loop 8's C1 established that the proposal generator clusters
 * on a single frontmatter tag and cannot carry action-pattern signal: 7.4 tags
 * per note across 529 notes puts 295 tags past the threshold of 3, and the note
 * body never reaches the clustering at all. He never reads the queue, which is
 * why 39 proposals accumulated, and a coherence filter turning 39 unread
 * clusters into 25 unread clusters changes nothing.
 *
 * His own deterministic-first rule applies: **remove the trigger rather than
 * patch around it.** A proposal list built from a signal we have measured as
 * noise is worse than no list, because its existence implies someone vetted the
 * premise that tag-sharing means skill-worthiness.
 *
 * NOTHING IS DELETED. The vault's experience notes accumulate exactly as
 * before — the scan is derived, not a store — so flipping this constant back to
 * `true` restores the previous behaviour completely and the next scan rebuilds
 * `.skill-proposals-pending.json` from the corpus as it then stands.
 *
 * BOTH ENDS READ THIS ONE CONSTANT, and that is the point of putting it here
 * rather than inlining a `false` at each site. The generator writing the pending
 * file and the session-start check reporting "N pending" must go quiet together:
 * a count still announced from a stale file after the generator stops is Rule 4
 * exactly — an absence reported as a healthy number — and it is the failure this
 * loop is least entitled to ship.
 */
export const SKILL_SCAN_ENABLED = false;
