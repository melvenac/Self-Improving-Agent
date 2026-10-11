# Recall-trigger effect measurement: design (D-148)

Source: grok-audit, RESEARCH job 71 at b142886f, room k575fscd (atlas/grok-audit), 2026-10-11, verbatim below the planner notes.

## Planner notes (Atlas, s167, first-hand)

- **D-148 governs scope:** "a Grok bot reads trigger_fires against transcripts; no new code unless the data says so",
  and the loop **starts after T-245 Option A lands** (PR #576, not merged at writing). So this is an uncommitted
  analysis run against the live DB and transcripts, not a product feature, and it waits for #576.
- **Caveats C1, C2 and C5 are resolved by the transcript itself.** In a Claude Code transcript every PostToolUse hook
  writes an `attachment` record (`type: hook_success`, `hookName: "PostToolUse:Bash"`, `toolUseID: <the triggering
  tool_use id>`, `timestamp`), and its `stdout` carries the hook JSON whose `hookSpecificOutput.additionalContext` is
  the injected text verbatim, e.g. `[stored knowledge 299 — pipe-to-tail-masks-exit-code] …` (checked in the
  planner's own transcript 6646f34e, line 197). So:
  - **Anchor (1.4):** the attachment's `toolUseID` is the exact triggering call. No time-and-basename matching.
  - **Injected text (2.1):** read from the attachment, not reconstructed from today's store.
  - **Timestamps:** every record has `timestamp`.
  - A trigger_fires row joins to its attachment by session_uuid + the injected id in the text + nearest timestamp.
  - Silent fires inject nothing, so they write no additionalContext: Arm B still needs the fire table plus
    the `toolUseID` of the nearest preceding Bash call.
- **Still open:** C3 (Arm B scores today's store), C4 (Cursor fires have no CC transcript), C7 (heuristic outcome
  rules; expect many UNDETERMINED). The minimum-sample gate in Part 4 stands.

## grok-audit's spec (verbatim)

RESEARCH 71 b142886 - recall-trigger effect measurement spec (1/3). Read-only, nothing executed. HEAD verified = b142886f8753.
DATA FACTS (cited):
F1 Fire row = trigger_fires(id, session_uuid, command, query, state, injected_ids JSON, created_at) db-v2.ts:84-92. created_at = new Date().toISOString() at record time fires.ts:77 (UTC ms).
F2 Hook is PostToolUse: fires AFTER the triggering Bash (CC) / Shell (Cursor) call completes, cli-recall-trigger.ts:51-56,62-71; session_uuid = payload.session_id :123. Fire runs per call, so the triggering tool_use is the one just before created_at.
F3 command stored is ONLY the lowercase program basename or "?" (command-log.ts:150-186), applied at write fires.ts:78 and retro-applied by scrub-trigger-fires.ts:72-86,131-137. Full command text is NOT in the DB.
F4 query = derived FTS expression, "" iff not-asked (fires.ts:73, run.ts:80-91). It does carry command-derived terms (e.g. "tail" "exit" "code", loop-16-closeout.md:24).
F5 Injected text = "[stored knowledge <id> - <key>] " + actionOf(content), run.ts:120-122; actionOf run.ts:55-69. The injected string itself is NOT stored; only ids. Re-derivable from knowledge_index.content (db-v2.ts:119-123) but content may have been edited since the fire (no snapshot) - caveat C2.
F6 silent = store asked, 0 hits above relevance_floor run.ts:100-108; floor/max_injected from policy.ts:49,54; ranking -bm25 query.ts:52,151-156.
SPEC PART 1 - UNIT AND ACT LOCATION
1.1 Unit = one trigger_fires row. Open DB with better-sqlite3 {readonly:true, fileMustExist:true}; SELECT * FROM trigger_fires ORDER BY id.
1.2 Transcript = glob ~/.claude/projects/*/<session_uuid>.jsonl; 0 files -> status NO_TRANSCRIPT; >1 -> take largest, flag MULTI. Cursor-session fires (no CC jsonl) land in NO_TRANSCRIPT.
1.3 Parse each line as JSON; skip unparsable lines (count them). Collect assistant content blocks type=tool_use with (timestamp, id, name, input).
1.4 Anchor = last tool_use with name in {Bash,Shell} and timestamp <= created_at + 2s whose basename(first token of input.command), via the repo's formatCommandFireLog, equals row.command. None within 120s before created_at -> NO_ANCHOR. Ties -> latest.
1.5 Anchor check: if the tool_result for anchor id has a timestamp, require it <= created_at+2s, else flag ANCHOR_WEAK.
1.6 Next act = first tool_use (any name) after the anchor in file order. None -> NO_NEXT_ACT (session ended). Record gap_s = next.timestamp - created_at.
1.7 Also record next_text_before = whether an assistant text block precedes the next act (the agent may verbalise the entry).

RESEARCH 71 b142886 - spec (2/3). Facts F1-F6 in turn 1 (trigger_fires db-v2.ts:84-92; PostToolUse cli-recall-trigger.ts:51-71; injected text run.ts:120-122).
PART 2 - OUTCOME PER INJECTED FIRE
2.1 action = actionOf(knowledge_index.content) for each injected id (run.ts:55-69); import that function, do not reimplement. Missing id -> ENTRY_GONE.
2.2 Deterministic pass, in order:
 a REFERENCED: next act input or preceding text contains "stored knowledge <id>" or the entry key -> FOLLOW (det).
 b Extract action tokens: backticked spans and lowercase program-like words in action matching ^[a-z][a-z0-9._-]{1,24}$ that are also program basenames of shell commands; also flags (^--?[a-z]). If action contains a negation cue (never|don't|do not|avoid|instead of) before a token, that token is a FORBID token, else REQUIRE.
 c Next act is shell: any REQUIRE token present in its command and no FORBID token present -> FOLLOW (det). Any FORBID token present -> CONTRADICT (det).
 d Next act re-runs the anchor command identically (string equal) and action had REQUIRE tokens not present -> IGNORE (det).
 e Otherwise -> UNDETERMINED, go to 2.3.
2.3 JUDGE step (labelled outcome_source=judge): an LLM gets only: action text (<=300 chars), anchor command excerpt (120), next act excerpt (120). Prompt asks for exactly one of FOLLOW|CONTRADICT|IGNORE|UNRELATED. Fixed model and temperature 0, logged in the report header. Judge is optional via flag --judge; without it UNDETERMINED stays in the report. Judge rows never mix into det totals; report both.
2.4 Multiple ids (max_injected may be >1, policy.ts:54): outcome per id; fire outcome = FOLLOW if any FOLLOW, else CONTRADICT if any, else IGNORE, else UNDETERMINED.
PART 3 - COMPARISON ARM
3.1 Arm B = silent fires (store asked, nothing cleared floor, run.ts:100-108). For each, compute the top-1 entry with no floor via the same FTS query (read-only, queryStore with floor=-Infinity, limit 1) against the current store -> "would-have-been" action. Apply 2.2 rules to its next act. FOLLOW rate here = base rate of doing the action unprompted.
3.2 Fairness: same hook, same moment, same command family, store asked in both; only difference is the floor. Not-asked fires are NOT used as control (no query, no entry to compare). Match: stratify by row.command (program basename) and report per-stratum plus pooled; restrict B to basenames that occur in A.
3.3 Caveat: B entries scored below floor, so they are less relevant by construction; effect = FOLLOW_A - FOLLOW_B is an upper bound on the injection effect, plus a relevance confound. State it in the report.
3.4 Not-asked fires: count only (denominator), no outcome.

REVIEW 3/3 b142886
SPEC READY WITH CAVEATS
PART 4 - MINIMUM SAMPLE
4.1 Fire counts are NOT derivable from the repo at this SHA (they live only in the user's live knowledge-v2.db). Closeout cites only a handful of probe fires (loop-16-closeout.md:24). Script's first output = census: rows by state, by command, and how many injected fires reach a scored next act.
4.2 Gate: report effect only if A has >=30 det-scored injected fires and B >=30 det-scored silent fires in shared strata; else print INSUFFICIENT with counts. 30/30 detects a ~30-point FOLLOW-rate gap at ~80% power; smaller gaps need ~100/arm. Print a Wilson 95% CI per rate.
PART 5 - REPORT COLUMNS (one CSV row per fire, tab-free)
fire_id, session_uuid, created_at, state, command, query, injected_ids, entry_ids_scored, anchor_status (OK|NO_TRANSCRIPT|MULTI|NO_ANCHOR|ANCHOR_WEAK), anchor_tool_use_id, next_act_tool, next_act_excerpt (<=120 chars), gap_s, next_text_before, rule_hit (a|b|c|d|none), outcome (FOLLOW|CONTRADICT|IGNORE|UNDETERMINED|UNRELATED|NA), outcome_source (det|judge|none), arm (A|B|census).
Summary file: per arm x stratum: n, follow, contradict, ignore, undetermined, follow_rate, wilson_lo, wilson_hi; plus effect A-B; plus header with db mtime, script sha, judge model or "off".
PART 6 - PRIVACY
6.1 Only stdout text from transcripts: next_act_excerpt and judge inputs, each truncated to 120 chars (action <=300 is store text, not transcript). No assistant prose ever printed; next_text_before is boolean.
6.2 Writes only under <repo>/.agents/scratch/recall-effect/ - ignored by .gitignore:21 "/.agents/*" (git check-ignore confirmed .agents/scratch/x). Script refuses any other output dir and opens DB and jsonl read-only. No network unless --judge.
CAVEATS / WHY IT MAY NOT FULLY ANSWER
C1 Full command not stored (command-log.ts:182-186; scrub rewrites old rows scrub-trigger-fires.ts:131-137): anchor match is time + basename only; frequent same-basename calls make anchors ambiguous.
C2 Injected text not stored, only ids (fires.ts:85); entry content may have changed since, so action is reconstructed, not proven.
C3 Silent-arm "would-have-matched" uses today's store, not fire-time store.
C4 Cursor fires have no ~/.claude jsonl -> excluded.
C5 Transcript timestamp field and whether CC logs additionalContext in jsonl were NOT verified (no transcript read, per scope); if timestamps are absent, fall back to file-order nearest Bash with matching basename and flag.
C6 D-148 not found in repo at this SHA (latest seen D-144 in .agents/state.json:5232); D-125..127 referenced only as seat rules in docs/loops.
C7 Rule 2.2b is heuristic token-matching; expect many UNDETERMINED.

