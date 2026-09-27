# QA 142: T-003 (a server knows its OWN session), candidate `706c029`

**Seat:** QA, record session 142, headless, dispatched by `docs/loops/t003-dispatch-qa.md` through
`docs/loops/qa-142/drive.ps1`. **Model / effort:** `claude-opus-5-5`, effort `high` (the driver's flags).
**Machine:** `DESKTOP-0GV3HAD`, Windows 10 Pro 10.0.19045, node v22.23.2, Claude Code 2.1.283, `claude.exe` from npm's
global folder. By drive.ps1's own note, that is **Aaron's desktop, not the QA PC**. **This machine has no
`~/.claude/open-brain/`**: no real knowledge DB and no real by-pid directory, so nothing real could have been touched.
**Date:** 2026-09-27 (UTC).
**Candidate:** `origin/loop/t003` at `706c029` (handoff `9f4fc1e`), stacked on T-179 round 2 `d0335d7`. The base for
red-first comparisons is `d0335d7`, built in its own scratch worktree.
**Scratch:** `C:\qa-scratch\t003\` (worktrees `cand`, `base`, `mut`, `qat`, `report`) and temp in `C:\qa-tmp`. Every
probe points `KNOWLEDGE_V2_DB`, `OPEN_BRAIN_ACTIVE_SESSION`, `OPEN_BRAIN_VAULT_DIR`, `OPEN_BRAIN_SCORE_HISTORY` and
`OPEN_BRAIN_SHADOW_LOG` at scratch, and where a home is read (`ob_start`'s transcript discovery, setup.mjs), it sets
`HOME`/`USERPROFILE` to a scratch home as well. No live `state.json` was written.
**Scripts and outputs:** `docs/loops/qa-scripts-t003/` (the probes) and `…/evidence/` (their outputs, verbatim).

## Verdict

**PASS on what T-003 set out to fix, with five defects: fix D1 and D3 in this round.**

- **QA 125's A7, A8 and A9 are closed in one checkout.** Each is red on `d0335d7` and holds on `706c029`, and so
  do their no-proof and failed-SessionStart variants (check 1).
- **The proof holds against every attack in the dispatch** (check 2): a proof forged under another pid, a reused
  pid, the nested launch (`CLAUDE_PID` naming another claude), a mismatched `ob_set_session` claim, foreign ids on
  `ob_end` and `ob_store_chunk`, and two servers under one claude. The one stale adoption is the stated Limit 1: both
  hooks fail across one `/clear`, or an install without SessionEnd hits a failed SessionStart (checks 2 and 3).
- **Live and nested, across `/clear`:** a real `claude -p` (inner claude 15392, launched from this seat's claude
  1304) wrote its proof keyed on its own pid. Its server proved `fdb58d7f…`, then `9cc492fd…` after `/clear`, with
  no re-registration, and the proof was removed at exit (check 4).
- **Mutants:** all five of this seat's mutants are killed by Forge's rows and by this seat's probes (check 6). That
  includes the four the dispatch named: the proof cached, `CLAUDE_PID` used, the start-time check skipped, and slot
  adoption restored.
- **Is there any path where a write lands under an id the server cannot prove? Yes, one: `ob_start` (D1).** With
  no proof it falls back to the newest transcript in the project, which is another session's in a shared
  checkout. It reuses that session's log and prints its id. The behaviour predates T-003 (the base does the same),
  but it is the one place where T-003's "no proof → refuse" is not true.
- **D3:** `ob_end`, called as `end.md` calls it (no `session_id`), ignores the proof. `/end`'s ratings are
  dropped or left unattributed. This also predates T-003, but the new `end.md` text now says `/end` depends on
  the proof.
- **D2, D4, D5 (low):** a proof file holding JSON `null` breaks `ob_recall` (with a misleading "FTS search error") and
  `ob_stats`. `ob_feedback` without a proof is silent, although the handoff says it reports "NOT LOGGED". A hook
  registered `--ide cursor` still writes a Claude proof when the payload lacks `cursor_version` and `CLAUDE_PID` is
  inherited.
- **Row #348 (check 5):** not checkable here, because there is no DB on this machine. The reasoning has one gap:
  the proposed pre-UPDATE confirmation does not establish that #348 was Session 53's rating.

## Check 1: QA 125's A7, A8 and A9 in one checkout (`c1-t003.mjs`, QA 125's `c1-attack.mjs` shapes)

This is QA 125's scratch clone construction (rev 132 migrated to v3, committed, reset between rows), run against
`706c029`'s build. **The proof is real.** It is written for the probe's actual parent process (the server
module's `process.ppid`) with that process's actual start time, and each "reconnect" is a fresh module instance.

| Row | `d0335d7` (base) | `706c029` |
|---|---|---|
| **A7** a second session registers as the victim's uuid, then `set_handoff` | BROKEN: the victim's handoff is replaced | **HOLDS.** `ob_set_session refused: …700 is not this server's session: this server's parent process 9956 is session …701`. The write lands under 701, and the victim is untouched |
| A7b same, with no proof at all | BROKEN | **HOLDS.** Both calls refuse, naming the absent proof file |
| **A8** reconnect (fresh module), slot holds B, A's proof is A | BROKEN: A's write lands on B's entry | **HOLDS.** It lands under A, and B is intact |
| A8b reconnect, no proof, fresh slot naming B | BROKEN: the slot is adopted | **HOLDS.** `set_handoff` refuses, and the slot is never read |
| **A9** `/clear`: SessionEnd(901) removes, SessionStart writes 902, the same server writes | BROKEN: 901's handoff is replaced | **HOLDS.** The write is under 902, and 901's handoff is intact |
| A9b `/clear` with a failed SessionStart | BROKEN | **HOLDS.** It refuses rather than writing under 902 |

`evidence/c1-cand.out`, `evidence/c1-base.out`. On the base, P1b, P3, P3b and P3c "hold" **vacuously**: with no
registration, `set_handoff` refuses whatever the proof says. Those rows discriminate only on the candidate.

## Check 2: attacking the proof

In-process (`c1-t003.mjs`), as a real server process (`c2-stdio.mjs`: the probe spawns `build/server.js` over stdio,
so the server's ppid is the probe, and it drives the tools through the MCP client), and with the real hook binaries
(`c4-hooks.mjs`).

| Attack | Result on `706c029` |
|---|---|
| **P1** a proof forged under ANOTHER live pid (a spawned node), naming an attacker | HOLDS: never read. The server reads only `by-pid/<ppid>.json` |
| P1b our own pid's file, but carrying the other process's `claude_pid`/`proc_start` | HOLDS: refused ("names pid …, not this server's parent") |
| **P2 / stale file:** a SessionStart that failed | HOLDS when SessionEnd ran (A9b, H4: `NONE`). **When BOTH hooks fail** across `/clear`, the next session writes under the previous id: **stale adoption, the handoff's stated Limit 1**, reproduced (P2) |
| **P3 PID reuse:** the same pid, a start time one tick off | HOLDS: `…a reused pid`. No `proc_start` at all: refused |
| P3c non-record proof bodies: `[]`, `"x"`, a numeric `session_id`, `claude_pid` as a string | HOLDS: each refused |
| P3c proof body **`null`** | **No write, but by a thrown `TypeError`** (`Cannot read properties of null (reading 'session_id')`), not a named refusal. See **D2** |
| **P4 nested:** `CLAUDE_PID` in the server's env names another live process with a valid ATTACKER proof | HOLDS: the server proves its own parent, and `ob_set_session` reports `via process proof: parent <ppid>` |
| **P5** `ob_set_session(id ≠ proof)` | HOLDS: refused, naming both. A claim that differs only in letter case is refused too (P5c: ids compare exactly). `"none"` or no argument registers the proven id |
| P5 `ob_end` / `ob_store_chunk` with a foreign `session_id` | HOLDS: both refuse before writing. An unnamed chunk links the proven id |
| **P6 two servers under one claude** (two module instances, one parent) | HOLDS: both prove the same, correct session. After `/clear` both move to the new one with no re-registration |
| S1–S3 real process: recall and feedback with a proof, then across `/clear` in the SAME server process | HOLDS: `recall_log`/`feedback_log` rows under A, then under B. `ob_recalled` reports B's 1 recall, not A's. `ob_stats`: `Session proof (this server instance): <id>, via parent process <probe pid>` |
| S1 no proof: `ob_recall` | HOLDS: `NOT LOGGED: this server cannot prove its session — <reason>`. No rows |
| S1b no proof: **`ob_feedback`** | **Silent.** It prints `Feedback recorded …` and writes no row, with no "not logged". See **D4** |

**"Is there ANY path where a write lands under an id the server cannot prove?"** Through the attributed write paths
(`ob_state`, `ob_recall`, `ob_feedback`, `ob_recalled`, `ob_end`, `ob_store_chunk`, `ob_set_session`): **no**, except
the stated limit (both hooks fail across one `/clear`, or SessionStart fails on an install without SessionEnd).
**But `ob_start` is such a path (D1):** with no proof, it stamps the session log with the **newest transcript's
id**, which in a shared checkout is the other session's. It **reuses that session's existing log**
(`Session #1 (existing log for this session id — reused, nothing created)`) and prints that id as `Session ID:`.
That behaviour predates T-003 (the base is identical: `evidence/c1-base.out` P7), but T-003's contract, "no proof →
attributed writes refuse", does not hold for it. There is also **deliberate same-user forgery**, which is not a
defect of this change: anything that can run the hook with a chosen stdin payload and `CLAUDE_PID` (a model's Bash
tool has its own claude's `CLAUDE_PID`) rewrites that claude's proof. H1 in `c4-hooks.mjs` shows the hook believing
exactly that. T-003 closes the confused and accidental paths (A7–A9) through the MCP surface. It does not defend
against a same-user process that forges on purpose, and nothing file-based could.

## Check 3: the hooks as registered (`setup.mjs` against a scratch home)

- **An old install (SessionStart only, plus an unrelated `model` key)**, then `node scripts/setup.mjs` with
  `HOME`/`USERPROFILE` set to scratch: `· SessionStart hook already registered`, `✓ SessionEnd hook registered`.
  The result has **both**, and `model` survives (`evidence/c3-settings-before.json`, `c3-settings-after.json`,
  `c3-setup.out`). The same run also wrote a scratch `.mcp.json`, Cursor files and a vault, all under the scratch
  home.
- **With the real hook binaries and a real server process** (`c4-hooks.mjs`; the probe is the stand-in claude, so
  the hooks get `CLAUDE_PID` = it and the server's ppid = it):

| Row | Result |
|---|---|
| H1 SessionStart(A) | the server proves A |
| H2 `/clear`: SessionEnd(A) `removed`, SessionStart(B) | the same server proves B |
| H3 reversed order: SessionStart(C) before SessionEnd(B) | `kept: holds another session`, so C |
| H4 SessionEnd(C), then SessionStart FAILS | `NONE — … absent` |
| H5 a subagent's SessionStart (`agent_id`) | no proof written |
| **O1 old install (no SessionEnd), `/clear` with SessionStart working** | B. SessionStart alone suffices when it runs |
| **O2 old install, `/clear` with SessionStart FAILING** | **the server still proves B, the PREVIOUS session: stale adoption** |
| exit with no SessionEnd | the proof file is left behind (`5260.json`) |

**Answer: if only SessionStart is registered**, attribution is correct as long as SessionStart runs on every
`/clear`. A failed or timed-out SessionStart then files the new session's writes under the previous session, with
no signal. That is Limit 1 with one of its two conditions already met. Proof files also accumulate, one per claude
process that exits without SessionEnd (and on a crash, even with it). The start-time check keeps a leftover from
being believed by a later process that reuses the pid. `setup.mjs` repairs an old install. **Nothing detects one that
needs repair.** I read `/sync`'s two hook checks in `pipelines/sync/checks.ts`: `hook-registration` counts
duplicates, and `hook-configs` checks that the referenced files exist. Neither reports a missing SessionEnd.
The greeting was not checked for this (see Open).

## Check 4: live, a real headless `claude -p` (`c5-live.mjs`)

Claude Code 2.1.283, `--model claude-haiku-4-5-20251001 --setting-sources local --settings live-settings.json
--strict-mcp-config --mcp-config live-mcp.json`, stream-json in and out, with the candidate's build as both hooks and
the server. The store override variables were set on claude itself, so its hooks and its server wrote scratch only.
`--setting-sources local` kept this machine's own hooks out. **Nested:** it was launched from this seat's tool shell,
whose claude is **1304**. The driver sends each message only after the previous `result` (a first attempt queued all
three at once, and the prompt after `/clear` was dropped; `evidence/live-run1.jsonl`).

| Step | Observed (`evidence/live-run2.jsonl`) |
|---|---|
| startup | `SessionStart:startup` → `Session proof written: session fdb58d7f… for claude process 15392` (the INNER claude, not 1304) |
| `ob_stats`, `ob_set_session()` | `Session proof (this server instance): fdb58d7f…, via parent process 15392` · `Session registered: fdb58d7f… [via process proof: parent 15392]` |
| `/clear` | `SessionStart:clear` → `Session proof written: session 9cc492fd… for claude process 15392`; by-pid: `15392.json=9cc492fd…` |
| `ob_stats`, `ob_set_session()` after `/clear` | `Session proof … 9cc492fd…, via parent process 15392` · `Session registered: 9cc492fd…`. **The new id, with no re-registration** |
| exit | by-pid is empty (SessionEnd removed it) |

In an earlier run, `evidence/live-run1.jsonl` shows the same behaviour for claude 13352. So the nested case is shown live twice:
the hook's `CLAUDE_PID` is the inner claude, and the server keys on its ppid. **Not shown:** that the server PROCESS
was the same one across `/clear` (its pid was not recorded; the parent and the proof were), and interactive
timing.

## Check 5: row #348's proposed repair (handoff §6)

**Could not be checked against data: this machine has no `~/.claude/open-brain/knowledge-v2.db`**, and a search of
the user profile found only test-suite leftovers in TEMP. `.agents/SESSIONS/Session_53.md` is not in this checkout
either. So nothing was read, and the UPDATE was not run (it never would have been).

What could be checked is the reasoning, from the handoff and the record (`state.json` T-003 note, rev at `9f4fc1e`):

- **The guard is right.** `WHERE id = 348 AND session_uuid = '2e5f340b-…'` can change only that row, only while it
  is still wrong. It is idempotent, and `changes = 1` is the right expectation. Backing up first is right.
- **The identification of Session 53's real id is sound as far as it goes.** Exactly 33 `recall_log` rows matches
  the note's "33 `recall_log` rows under this session's real id", and 1f1d05c2 is the only session in the window
  that recalled entry 372. `1f1d05c2` also appears in the record as a real session (the Loop-12 contamination census
  in `sia-mailbox-decisions.md` lists it as a source of 4 entries).
- **The gap: the proposed confirmation does not confirm the repair.** Checking Session_53.md's "Session ID" confirms
  **who Session 53 was**, not that **#348 was Session 53's rating**. There is an alternative the cited facts do not
  exclude. Under v0.21.0, a server with no registration self-registered from the slot, and the slot held the
  later-started session's id, **2e5f340b's own**. So if 2e5f340b itself rated 372 by a direct `ob_feedback`, its row
  would sit under 2e5f340b **correctly**. It being "absent from `sessions`, with no `recall_log` row" fits a
  session that never ran `/start` and never recalled. `ob_feedback` needs no prior recall (#348 is `direct/direct`).
  "Only 1f1d05c2 recalled 372" makes the handoff's reading likely, not certain. **Recommendation:** before running
  the UPDATE, confirm from 1f1d05c2's transcript (`~/.claude/projects/<slug>/1f1d05c2-….jsonl`) that it called
  `ob_feedback` on 372 with `helpful` at about 2026-09-01T08:28:52Z. If a transcript exists for 2e5f340b, confirm
  that it did not.

## Check 6: mutants (`mutants-qa142.mjs`)

Each mutant is applied to a scratch worktree at `706c029`, where its site must occur exactly once and the edit must
land. It is then built with `npm run build` (tsc), and run against Forge's rows (`t003-session-proof`, `server`,
`active-session`: 89 tests) and QA 142's three probes. The tree is restored in `finally`. A probe row counts only if
it is BROKEN under the mutant and was not BROKEN on the unmutated baseline (c1: 1, P7; c2: 3, S1b/S5/S5b; c4: 0).

Baseline (unmutated, the same run): build ok, Forge's 89 of 89 pass, c1 1 BROKEN, c2 3, c4 0. After the run:
restored, and `git diff --stat` is empty. Output: `evidence/mutants-qa142.out`.

| Mutant | Edit | Forge's rows (of 89) | QA 142 probe rows newly BROKEN | Verdict |
|---|---|---|---|---|
| **Q1** proof cached at first use | `return (_cachedProof ??= proveSession(…))` | **8 fail**, incl. T-003 "A9 /clear … writes under the NEW session" and "/clear with a FAILED SessionStart …" | 15: c1 A7, A7b, A9, A9b, P1b, P6b; c2 S2, S2b, S3, S3b; c4 H2–H5, O1 | **KILLED** |
| **Q2** `CLAUDE_PID` instead of ppid | `const parent = Number(process.env.CLAUDE_PID) \|\| process.ppid` | **15 fail** (locally this shell inherits `CLAUDE_PID=1304`, so most rows lose their proof; on a runner without it, Forge's nested row is the one that bites, per the handoff's M1) | 15: c1 A7, A7b, A8, A9, A9b, P1, **P4 nested**, P5 …; c2 S2–S3b. c4 0 (its hooks and server share one parent, so it cannot tell) | **KILLED** |
| **Q3** start-time check skipped | `if (false && proof.proc_start !== parentStart)` | **2 fail**: "a reused pid … is refused", and proveSession's named-refusal row | 2: c1 P3 (reused pid), P3b (no `proc_start`) | **KILLED** |
| **Q4** slot adoption restored | with no proof, return the per-project slot's uuid | **1 fails**: "no proof: a fresh slot is NOT adopted …" | 4: c1 A8b, A9b; c4 H4, H5 | **KILLED** |
| **Q5** named claims unchecked (`ob_end`, `ob_store_chunk`) | `… && claim === "qa142-never-a-session-id"` (never true) | **2 fail**: the `ob_end` and `ob_store_chunk` refusal rows | 2: c1 P5 ob_end, P5 ob_store_chunk | **KILLED** |

**5 of 5 killed, none invalid** (after the Q5 rewrite in Error entries). Each is killed by Forge's rows alone and
independently by QA 142's probes. Q3 and Q4 are the thinnest: one or two rows each, on both sides. Not mutated
here, because Forge's M8–M12 cover it: the hook side (keying, removal, payload-id rule). The ordering "the proof is
written FIRST" is still unmeasured by any row (the handoff says so too).

## CI

- **Forge's run `36281313992`**, verified read-only (`gh run view`): head `706c029`, workflow_dispatch, success. tcm
  `test`: **Tests 1320 passed | 2 skipped (1322)**, `t003-session-proof.test.ts (18 tests)` ✓. Laptop
  `test-windows`: **1321 passed | 1 skipped (1322)**, the T-003 rows ✓. This matches the handoff.
- **QA 142's tcm run `36285274987`** (1 of the 6 allowed; tcm only, `windows=false`, no laptop), on
  **`qa/t003-tests` @ `189f184`** = `706c029` + `open-brain/tests/qa142-t003.test.ts`. Runner `tcm-1`, node 22.23.3.
  **Tests: 2 failed | 1324 passed | 2 skipped (1328)**. The 2 failures are **D1 and D2, red by design** (they pin the
  defects). **G1–G4 pass on Linux** (`/proc` start times): a proof under another live pid is never read, a
  case-only claim is refused, non-record bodies are refused, and a reused pid is refused. `t003-session-proof.test.ts
  (18 tests)` ✓. The 1324 are Forge's 1320 plus G1–G4. Locally on Windows, the same file gave 2 failed and 4 passed.
- **No full local suite.** CI ran the full suite on the candidate on both platforms, and the dispatch did not ask
  for a local one.

## What could not be verified

- **Row #348 against data**: there is no DB on this machine (check 5).
- **Interactive timing** of SessionStart against the first tool call. The live run is headless, as Step 0b's was.
- **That one server process survived the live `/clear`**: its parent (15392) and the proof were observed, not its
  pid.
- **macOS** (`ps -o lstart=`): no mac. **Cursor**: not run (ruling Q2 says it refuses; Forge's row 17 covers the
  hook side).
- **The main tree's live install**: this machine is not it. The by-pid proof as the MAIN tree's server reads it
  shows only after merge and T-172's update (handoff §7).
- **A transient `processStartTime` failure in a server** (a PowerShell spawn that times out at 15 s under load):
  not forced. By reading the code, `_parentStart` caches a `null` start for the server's life, so one slow spawn
  makes every attributed write refuse until a reconnect. It fails closed, not wrong (O-1 below).

## Defects

| # | Severity | Defect | Evidence | Regression? | Suggested fix |
|---|---|---|---|---|---|
| **D1** | **medium** | **`ob_start` with no proof stamps an unproven id.** `handleStart` passes `writeSessionId().id`, which is `null` without a proof. `sessionStart` then does `options.sessionId ?? discoverSessionUuid(…)`, the newest `.jsonl` in `~/.claude/projects/<key>/`, which is the per-project race T-003 is about (Step 0 itself disqualified that source). In a shared checkout it **reuses the other session's log** and prints its id as `Session ID:`. The later attributed calls still refuse, so the damage stays in the gitignored session log and the greeting. | `c1` P7, `c3` P7b (`Session #1 (existing log for this session id — reused …)`, `Session ID: 0be70be7…`), P7c (with a proof it is right). tcm row D1 red | No: the base is identical (`c1-base.out` P7). But T-003's contract does not hold here | With no proof, pass an explicit "no discovery" to `sessionStart` and print `Session ID: none — <reason>` |
| **D2** | low | **A proof file holding JSON `null` throws.** `proveSession` does `JSON.parse` and then reads `proof.session_id` on `null`, which is a `TypeError`. `ob_recall` catches it as `FTS search error — index may be empty.` and **returns no results**. `ob_stats` fails with `Cannot read properties of null`. `ob_state` reports `ob_state error: …`. Nothing is written under a wrong id. `[]`, `"x"`, a numeric id and a string pid are all refused by name. | `c2` S5/S5b, `c1` P3c null (caught by the handler, not refused), tcm row D2 red | New code | `if (!proof \|\| typeof proof !== "object" \|\| Array.isArray(proof))` → a named refusal |
| **D3** | **medium** | **`ob_end` without `session_id` ignores the proof.** `handleEnd` checks a NAMED id (`attributedSession`) but then passes `args.session_id \|\| null` to `resolveRecalledIds`, so `recall_log` is not consulted, and `args.session_id \|\| ""` to `sessionEndV2`, so no `feedback_log` row is written. `end.md` calls `ob_end` with `entry_ratings` and no `session_id`. So an entry `ob_recalled` lists (from the proven id's `recall_log`) resolves to `Recalled ids: 0 from none` and its rating is **dropped**. With explicit `recalled_entry_ids`, the counter is bumped and **no `feedback_log` row** is written. `ob_store_chunk` already defaults to the proven id; `ob_end` does not. | `c2` S4: `feedback_log` 2 → 2, `Recalled ids: 1 from explicit` | No: the base passes `args.session_id` too. But the new `end.md` says `/end` "needs a session the server can PROVE" | Use `endSession.id` (the proven id) when none is named |
| **D4** | low | **`ob_feedback` with no proof is silent.** It bumps the counter and prints `Feedback recorded …`, with no "NOT LOGGED". The handoff §2 says recall *and feedback* say "NOT LOGGED" with the reason. | `c2` S1b | No: the base has the same `if (id)` with no else. The claim is new | Add the `NOT LOGGED: … <reason>` line, as `ob_recall` has |
| **D5** | low | **The proof ignores the hook's own `--ide cursor` registration.** The proof block tests `detectIde(payload, "claude")`, which looks only at the payload's `cursor_version`. The rest of the hook uses `ide = detectIde(payload, registeredAs)`, which honours `--ide`. A hook registered for Cursor (`cli-bootstrap.js --ide cursor`, as setup.mjs writes it), given a payload without `cursor_version` and an env that carries `CLAUDE_PID` (e.g. a Cursor launched from a Claude tool shell), **writes a Claude proof naming the Cursor session for that claude process**. That claude's server would then attribute its writes to the Cursor session. The real binary did exactly that: `Session proof written: session c0c0c0c0… for claude process 6480`. With `cursor_version` present it refuses. | `evidence/c6-ide-flag.out` | New code | Test `ide !== "claude"` (the payload-then-flag result) in the proof block |

**Observations (not defects):**
- **O-1:** `_parentStart` caches a `null` start time for the server's life (`if (!_parentStart || _parentStart.pid !== parent)`),
  so one timed-out PowerShell spawn (15 s) disables attribution until a reconnect. It fails closed. Consider not caching
  `null`.
- **O-2:** proof files accumulate for claude processes that exit without SessionEnd (a crash, or an old install).
  They are harmless (the start-time check), but nothing prunes them.
- **O-3:** deliberate same-user forgery (running the hook by hand with a chosen payload) is outside what a file-based proof can
  stop. This is stated for completeness, not as a defect.

## Disagreements with the handoff

1. §2 says "`ob_recall` / `ob_feedback` / `ob_recalled`: log under the proven id, or say 'NOT LOGGED' with the
   reason". **`ob_feedback` says nothing** (D4, S1b).
2. §2 says "`ob_start`: stamps the proven id (after `/clear`, the new session's log)". True with a proof. **With
   none, it stamps an unproven one** (D1), and the handoff's "No proof: attributed writes refuse" does not cover it.
3. `end.md`'s new text ("Needs a session the server can PROVE is its own") implies `/end`'s ratings use the proof.
   **`ob_end`, called as `end.md` calls it (no `session_id`), does not** (D3).
4. §6's pre-UPDATE check (Session_53.md's Session ID) does not establish the repair (check 5).

## Error entries

- My first `c2-stdio.mjs` runs queried `feedback_log.method`/`origin`. The columns are `rating_origin`/
  `rating_method`, and the probe crashed before its ob_end row. Fixed and re-run. Only the last run's output is in
  evidence.
- My first S5 verdict matched the query header (`## lighthouse ledger`) and read HOLDS. The entry key was never in
  the output, which was `FTS search error — index may be empty.` The verdict was corrected to require the entry key.
- My P5 case-sensitivity row first used an all-digit uuid, whose upper case is itself, so "accepted" meant nothing.
  It was re-run with a hex uuid (P5c in `c3-start.mjs`), which was refused.
- The first live run queued `/clear` and the next prompt back to back. The prompt after `/clear` was not processed.
  The driver now waits for each `result`.
- **A harness fault in my first mutant pass:** `c1-t003.mjs` kept its scratch store between runs, so its second
  run hit `UNIQUE constraint failed: knowledge_index.key` at P5's chunk. Rows P5-chunk, P6 and P7 never ran under
  the mutants, and each run showed `no summary (rc 1)`. It was caught from that line. The probe now starts from a
  fresh store, and **all five mutants were re-run** with the fixed probe. Only the re-run is reported and in
  evidence.
- **My Q5 mutant, as first written** (`if (false && claim && …)`), did not compile: TS narrowing, `Property 'pid'
  does not exist`. It was invalid, not killed. It was rewritten to `claim === "qa142-never-a-session-id"`, which
  compiles and never matches.
- **Denied command:** the `Monitor` tool, which I tried to use to wait for the mutant runner, was denied (dontAsk
  mode). I did not pursue it. I waited with a plain background `until grep` on the runner's own output file
  instead.
- In `c1-t003.mjs`, the P5 "upper-case spelling" INFO line is vacuous (all-digit uuid). P5c in `c3-start.mjs` is the
  real row.

## Open for the planner

None of these blocks the report. Each has my recommendation.

1. **D1 and D3: fix in this round, or file them as follow-ups?** Both predate T-003, but they are the two places where
   T-003's own contract ("no proof → refuse"; `/end` uses the proof) is not true, and each is about a one-line
   change (`handleStart` must not fall back to discovery; `handleEnd` defaults to the proven id). **Recommend: this
   round**, with QA 142's D1 row (on `qa/t003-tests`) adopted as its red-first row. D2, D4 and D5 are each a
   line or two and can ride along.
2. **Row #348:** the repair should wait for a confirmation that #348 was **Session 53's** rating: its transcript
   (`1f1d05c2-….jsonl`) shows `ob_feedback(372, helpful)` at about 08:28:52Z. The Session ID in Session_53.md is not
   enough (check 5). This needs Aaron's machine, where the DB and the transcripts are.
3. **An install without SessionEnd** silently adopts the previous session's proof when a SessionStart fails (O2).
   `setup.mjs` repairs an install, but nothing detects one that needs repair. **Recommend** a `/sync` or greeting
   check that both hooks are registered. This could be a follow-up task.
4. **This run was on `DESKTOP-0GV3HAD`**, whose `claude.exe` is in npm's global folder. That is Aaron's desktop by
   drive.ps1's own comment, not the QA PC. It has no `~/.claude/open-brain/`. Flagged in case the queue meant the
   QA PC. Nothing here depended on it except check 5.
5. **`qa/t003-tests`** (`189f184`) holds D1/D2 (red) and G1–G4 (green) as vitest rows, for Forge to take or
   drop.

QA-142: REPORT COMPLETE
