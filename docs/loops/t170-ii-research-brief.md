# T-170 part (ii) research: path and error keys, plus the trigger's hook latency (report only)

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC one-off, NOT the desktop. No hub key. RESEARCH: no code PR, no push, no merge. Ends at the reply file.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t170ii-research-reply.md. A reply
path in the launcher's line wins. Resolve and print that absolute path FIRST.
INPUT: `t170ii-keys.json`, which clark copies from the desktop into the same %TEMP% before launch. It holds the 49
live lessons whose `MATCH:` line is a path (29) or error (20) key: `{id, key, title, match}`. **This repository is
PUBLIC. The keys name client domains, hosts and private paths. Never copy key text into any file inside the clone,
any commit, or any hub post. In the reply, cite a key by its entry id; quote a key's text only in the reply file.**

**By:** Atlas (planner), 2026-10-15, session 172. **Task:** T-170 (P1), part (ii) and follow-up (4). **Tag:**
`T-170-II`. **Size:** MEDIUM (research). **Base:** the dispatch SHA clark names (a master that contains this brief;
a346e5b1 or later).

## Why

D-155 (Aaron): each lesson carries an optional match key — a command shape, a path or an error string — and "the
trigger also matches on those keys". The T-170 loop (`docs/loops/t170-match-keys-brief.md`, merged 624d5758)
built command keys only, because the trigger is a PostToolUse/Bash hook and sees commands. 49 path and error keys
are stored and nothing reads them. Before a build brief can be written, the planner needs four facts this run
measures. Follow-up (4), the hook's latency on key-matching commands, is still unmeasured.

## Checkout

The fresh clone the launcher made, at the dispatch SHA. `cd open-brain && npm ci && npm run build`, then prove the
native binding loads: `node -e "require('better-sqlite3')"` (on "Could not locate the bindings file", run
`npm rebuild better-sqlite3` and say so). Do NOT run `test:heavy` or the full suite: this run needs no tests.

**Never touch the QA PC's real store or settings.** Every hook invocation in part B runs with `USERPROFILE` and
`HOME` pointed at a scratch directory under %TEMP%\t170ii\ and `KNOWLEDGE_V2_DB` at a scratch db there. Do not read,
copy or print `~/.claude.json`, `settings.json`, `.mcp.json`, any `.env` or any key file (G-051). Reading
`~/.claude/projects/**/*.jsonl` transcripts in part A3 is allowed; print only aggregates and tool names from them,
never message text.

## Part A — what a path or error key would have to match (read the code and the docs, then measure)

A1. **Events and fields.** For Claude Code, name the hook event(s) and payload field(s) that carry (a) a file path
the agent acted on — `Read`, `Edit`, `Write`, `NotebookEdit`, `Glob`, `Grep` — and (b) an error string: the
PostToolUse `tool_response` of a Bash call (which fields hold stdout/stderr/exit status) and whether a separate
failure event exists (`PostToolUseFailure` or similar). Cite the Claude Code hooks documentation you read, by URL and
section, and say which claims you observed in a live payload versus read in docs. Observe at least one live payload
per event: in the scratch HOME, register a tiny logging hook (a node script that appends stdin to a file) in a
scratch project's `.claude/settings.json`, run `claude -p` there with one Read, one Edit and one failing Bash
command, and report the field names you saw (not their values beyond the scratch files). For Cursor, report what
`open-brain/src/cli-recall-trigger.ts` and `docs/` already record (T-235 P2-5 measured `Shell` only) and mark
everything else UNMEASURED; do not run cursor-agent.

A2. **Key shapes.** Classify the 49 keys in `t170ii-keys.json`: path keys as exact repo-relative path, glob
(`*`), home-relative (`~/`), absolute, or path plus commentary (e.g. "(and any rule on …)"); error keys as a quoted
literal, a literal with variable parts (ports, ids, timestamps, hashes), or prose. Give counts per class and the ids
in each. Name every key that no mechanical rule could match without a human rewrite.

A3. **Over-fire.** Using the QA PC's own Claude Code transcripts (the newest 60 `.jsonl` under
`~/.claude/projects/`), extract every file path from Read/Edit/Write/NotebookEdit tool inputs and every Bash
tool_result text, and report for each candidate rule below what fraction of tool calls it would fire on, overall and
for the top 5 keys: (r1) path keys as a suffix match on the normalised path (backslashes to `/`, case-folded on
win32, `~` expanded) with `*` as a single-segment wildcard; (r2) error keys as the existing command-key rule
(`commandMatchesKey`: fragments in order, `<…>` and `...` as wildcards) applied to the tool_result text. State the
limit plainly: these are QA PC sessions, not the desktop seats that wrote most of the keys, so a zero hit rate means
"not seen on this machine", not "never fires".

A4. **Recommendation.** One paragraph per key type: which event, which field, which rule, whether the once-per-session
cap from the T-170 loop still fits, and what the sidecar (`recall-trigger-keys.json`, written by
`src/trigger/keys-writer.ts`) would need to carry. Flag any case where a key type needs a PreToolUse event (to warn
BEFORE the act) instead of PostToolUse. Do not write code.

## Part B — hook latency (T-170 follow-up 4)

Time `node <clone>/open-brain/build/cli-recall-trigger.js` end to end (spawn to exit, wall clock) with a synthetic
PostToolUse/Bash payload on stdin, 30 runs per class after 3 discarded warm-ups, in the scratch HOME with a scratch
store seeded by the clone's own code (an `ob_store`-equivalent call through the build, or a fixture the tests use —
say which) holding at least one lesson with a `MATCH: command:` key, and the sidecar refreshed through the build's
own writer:

- (b1) a command that asks nothing (the T-159 not-asked fast path);
- (b2) a command that matches the seeded command key (first match in the session);
- (b3) the same command again in the same session (the once-per-session cap);
- (b4) a command that hits the element path (pick one from `src/trigger/policies/`, name it).

The session check runs first: say how you made the fire attributable (the session-proof mechanism the code reads)
and, for each class, which path the run actually took, proven from the scratch store's `trigger_fires` rows or the
hook's log, not assumed. Report p50, p95 and max in ms per class, the node version, and the machine. If a class
cannot be produced, say exactly why and stop that class; do not substitute another.

## Reply contract (first lines, then the body)

```
T-170-II RESEARCH — <DONE | PARTIAL: what is missing>
MODEL: <the model this run used>
BASE: <sha40 the clone was at>
A1: <one line> · A2: <counts> · A3: r1 <x%>, r2 <y%> · B: b1/b2/b3/b4 p50 <ms>
```

Then each part under its own heading, with every claim labelled OBSERVED (with the command you ran) or READ (with
file:line or URL). Leave nothing to choose for the planner: where you could not decide, say what evidence would
decide it.
