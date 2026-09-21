# Loop 16 brief — amendment 12: it fired; candidate 2 not accepted on a ruling nobody built

**From:** Atlas (planner) · **Date:** 2026-09-21 · **On:** candidate 2, `f7930d0`, with A7/A8/A10-live run under
Aaron's word (typed directly into the QA session, for this act, at this SHA; registered 04:08:16Z, restored
04:12:22Z, `settings.json` byte-identical before and after). **Amends:** §4 rows A7 and A8; R25/R26's
candidate sequence.

## 1. The thing the loop exists for happened, on disk

In a real Claude Code session with the hook registered, the QA seat ran the G-039 shape and then
`git status --porcelain`. The candidate's own fire rows, keyed to the live session uuid:
`04:08:29Z … | tail -8; echo $?` → query `"tail" "exit" "code"`, state **injected**, ids `[299]`;
`04:08:34Z git status --porcelain` → no query derived, state **not-asked**. A natural experiment
nobody planned: a `tail -20 file` from another session — single-stage, no pipeline — recorded
**not-asked**, R18 firing on a real command. The census shows `hook 1` by name beside explicit /
start / checkpoint / unspecified (R6); `trigger_fires` injected 1, not-asked 5, silent 10, zeros
printed always; the rated set resolved directly contains 299 and every non-injected fire has empty
ids (R5, by construction). A10 reproduced by QA with its own method agrees in shape: the common case
pays about a quarter-second to ask the store nothing; interpreter startup is 27% of it.

**A7's evidence clause could not be met as written:** the transcript `.jsonl` the row names does
not exist for the QA session's uuid under its project directory — three transcripts are there, none
is this session's, and the probe string appears nowhere under `~/.claude` except the candidate's
fire row. **Ruled: A7 passes on the fire rows** — the hook ran in a real session and took both
paths with the right states — **and the transcript clause is recorded as untested, an instrument
gap of the brief's, not the candidate's.** The seat's account of seeing the reminder is not
evidence and was not scored; where a session's transcript actually lives is a question for the
close-out.

## 2. F3 — R7 was ruled, never built, never tested; the verdict on `f7930d0` is NOT ACCEPTED

Amendment 1 R7: *injected entries bump `recall_count` and `last_recalled_at`; looked-at entries do
not.* Live: entry 299 was injected at 04:08:29Z and its row reads `recall_count 11`,
`last_recalled_at 2026-09-20 23:52:51` — six hours earlier, from an explicit recall. In code:
neither column name appears anywhere in `src/trigger/`, `cli-recall-trigger.ts`, `tests/trigger/`
or the whole `4550ee5..f7930d0` diff (greps validated on known positives and a known negative). The
only writers are `ob_recall`'s handler and `db-v2`. **A ruling that exists in a document and fires
nowhere — G-035's shape — inside the loop about rules that are loaded and not applied.** It matters
because `recall_count` is what `ob_list` shows and what maturity promotion counts: without it, the
entries the trigger surfaces are invisible to the lifecycle, and the loop's question — does the
memory half get used — is answered for fires and not for entries.

The criteria carry R7 as an observable of A8 (QA's second commit, `46feb51`). **A8 fails on it.**
The second time this candidate has been complete except for a guard nobody wrote; the first was F1.
Planner's share: R7 was ruled without a row in §4 that would have made its absence red — an
instruction with no check, the defect this repository names in its own rules. Recorded against the
brief; not numbered, since the ruling was correct and nothing false was claimed.

## 3. Ruling R27 — candidate 3, and what is re-run

**Candidate 3 = one commit on top of `f7930d0`, unsquashed: the injection path bumps
`recall_count` and `last_recalled_at` for injected ids only, with a test in both directions —
injected bumps (count and timestamp), silent and not-asked do not — and a mutant (the bump removed)
red. Plus the handoff section.** Nothing else.

**Re-evaluation is decided by the diff.** If `45ee2ab..candidate3`'s change under `src/` is
confined to the injection path's writes to those two columns, QA re-runs the targeted set, A5, A8's
unit-level rows and the new test, and **the live evidence from `f7930d0` stands** — the registration
is not repeated. If the diff touches anything else, A7/A8-live re-run on a new word from Aaron.

## 4. Recorded, by family

- **The registration is machine-wide.** Fires #1 and #6 carry the planner's and the developer's
  session uuids; #1 names the planner's scratchpad. `~/.claude/settings.json` arms the hook for
  every session on the machine in every project. The brief's *"against the QA tree's build for the
  duration of the probe"* described the build and not the blast radius. Four minutes across three
  seats tonight; before anyone registers it for longer, this is the sentence to read. `G-030` owns
  the mechanism.
- **A restore that parsed the same and was not the same.** QA's register/remove script wrote
  `json.dumps(indent=2)` without `ensure_ascii=False`, escaping every em-dash in Aaron's file —
  7224 bytes became 7245 for the whole window. Caught by hashing against a backup rather than
  trusting *"PostToolUse is [] again"*; the backup restored verbatim; byte-identity re-verified.
  *"Restored" and "parses the same" are different claims, and the weaker reads like the stronger.*
  Self-caught; by family.
- `ob_stats` through MCP runs the main tree's build and cannot show fire counts until the main
  tree is rebuilt at merge — G-033's shape, expected, not a finding.
