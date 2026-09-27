# T-179 + T-163: developer handoff (Forge, record session 118)

**By:** Forge (developer), record session **118**, in `sia-builder`. The work ran in two Claude sessions: `59d7d51a`
(2026-09-26 03:55Z to about 04:49Z, interrupted by a desktop restart) and `e48dde30` (resumed at 05:29Z). **Model and
effort, read from both transcripts' own fields:** `claude-opus-5-5`, `effort: high`. **Brief:**
`docs/loops/t179-t163-end-brief.md` on `origin/docs/session-100-qa99-dispatch`. **Branch:** `loop/t179-end`, from
origin/master `820dacd`. **FROZEN SHA: `66b2173`** (code). The commit after it adds only this file. `/end` was not run. The live `.agents/state.json` was not written
in any tree: every state write below went to a scratch copy under the OS temp dir.

**Atlas's rulings, as the resumed session was told them** (relayed by Aaron at the resume; the interrupted session asked
the retention question by SendMessage at 04:02Z): retention is per **checkout**; the greeting renders only the
**newest handoff per seat and checkout**; the migration **keeps every uuid**. All three are built in `d31769d`.

## 1. Step 0: what `end.md`'s steps write (measured before cutting)

**Instrument:** a scratch git copy of origin/master's tree (`git archive` of `820dacd`, rev 131). The script ran
`end.md` A7b's `ob_state` batch through the **built writer** twice in sequence, as two developer sessions `aaaaaaaa…118`
and `bbbbbbbb…119`. Each batch held `set_handoff`, `add_decision`, `add_verified`, `open_task`, `close_task`,
`update_task` (a note on T-022) and `end_session`. Both writes returned ok (rev 131→132→133) and re-rendered the four
views.

**(a) Does the second close-out remove or replace anything the first wrote? YES, three things.**

| Written by A | After B |
|---|---|
| decision, verified claim, opened task, T-003 closed | **survive** |
| handoff (`developer`, session 118) | **GONE**: replaced by B's (one `developer` slot) |
| `last_session` uuid `aaaaaaaa…` | **GONE**: 0 occurrences in any file after B; B's uuid in `state.json` and `next-session.md` |
| T-022's note | **GONE**: B's `update_task` replaced it |

The first two are T-163's path, **still live after Loop 14**: `handoffs[]` was per *seat*, and `SeatName` is a role,
so every developer checkout shared one slot. **The third is not T-163's.** It is T-171 (`update_task` REPLACES a note),
and **this candidate does not fix it**. A session that updates a task another session annotated still overwrites the
note. It is named here so it is not read as covered.

**(b) Which of `end.md`'s steps write state?** A1 (the session log, a local untracked file); A2, A5, A6, A7 (prose
views, only in the no-state fallback); A3 and A4 (DECISIONS.md, ENTITIES.md prose); and **A7b**, the only record write:
one `ob_state` batch of `close_task`, `open_task`, `update_task`, `reopen_task`, `add_verified`, `add_gap`, `close_gap`,
`add_decision`, `set_objective`, `set_handoff`, and `end_session` last. A8 to A14 write no project state (validation,
doc drift, research, lessons, the vault summary, ratings through `ob_end`).

**(c) Which are already done as work happens?** Read from origin/master's first-parent history of `state.json`
(83 commits, 82 revision steps, script `history.mjs`): the handoff changed in **37** steps, **16** of them in a step
that did not also move `last_session` (not a close-out); decisions were added in **33** steps, **23** of them outside a
close-out; tasks changed in 43. So `set_handoff` and `add_decision` are already routinely written mid-session. Only
`end_session` existed solely in `/end`, and under schema v3 every write records its session itself. **Nothing
`/end` wrote needs a new home.** Where each step went is the last section of the new `end.md`.

## 2. What was built

**T163-1 (`d31769d`): schema v3. A close-out can only add its own record.**
- `handoffs[]` is keyed by the **writing session's uuid**, stamped by the writer from `ApplyStateOptions.session_uuid`
  (`ob_state` passes the server's registered session). It is never an op argument: the op schema is strict, so an op
  naming a `session_uuid` is refused. `set_handoff` with no registered session **refuses**. A session adds its entry or
  updates its own; no op can address another's.
- **The planner's handoff was NOT kept singular.** It is keyed like every other seat's. The planner is one seat but
  runs as many sessions, and a singular slot is exactly the shape that erased planner@73 at rev 62 (section 4).
  Rendering shows only the newest per (seat, checkout), so the reader still sees one planner handoff.
- **`last_session` → `sessions[]`, written by EVERY state write**, upserted by uuid. `lastSession()` is derived from it.
  Chosen over "derive from the session logs" because the logs are local and untracked: no seat's checkout holds
  another's, so a derived value would differ per tree. `end_session` is retired and refuses by name.
- **Retention (Atlas's ruling):** an entry leaves only when a newer entry of the **same seat AND checkout** exists and
  it is more than 10 sessions older than the record's newest session. A legacy entry (checkout null) is its own instance
  and is never superseded. A still-open seat's newest entry therefore never leaves.
- **Greeting and `next-session.md`:** the newest handoff per (seat, checkout); older entries are counted, not rendered.
- **Migration:** `state migrate` v2→v3 (and v1→v3 by chaining), lossless, **refuses if any uuid would be lost**.

**T163-2 (`d31769d`, `7ba177f`): the `record-erasure` `/sync` check and `open-brain state erasures`.** Walks HEAD's
committed history of `state.json`. For each step, a record present before and absent after, not explained by retention
recomputed on the after-state, is an erasure. Merges are three-way: a removal made on one branch is reported once, at
that branch's commit. **Fails only on steps whose after-state is schema v3+**; older history is listed and fails
nothing, since it allowed erasure and cannot be repaired. A shallow clone **skips, saying why**.

**T179-1 (`57a2025`): `/end` is a lessons step.** `.claude/commands/end.md` goes from 408 lines to **58**: store each
lesson with `ob_store` (`kind: "event"`) and a `MATCH:` line naming the command, path or error that would have caught
it (T-170), or an explicit `none`; then `ob_end` with ratings only for what was injected or recalled. **No `ob_state`
call remains in `/end`.** The same file is in `project-template/.claude/commands/` (byte-identical) and
`project-template/.cursor/commands/` (with its MCP header). Also updated: the README command row, the template's
bootstrap tree, the Cursor `sync.md` line "during `/end` (step A9)", and the template rule "Always update SUMMARY.md at
session end".

**After this merges, the "no `/end` (T-163)" line in future briefs is retired.** The planner retires it.

**T179-2 (`81ec4ca`): a session that ends with committed loop work and no handoff says so.** In the SessionEnd hook
(which `/clear` fires), **before anything that can exit early**: if this session committed on a local `loop/*` branch
(commits not on origin/master), and none of those commits added or modified a `docs/loops/*-handoff.md`, it prints
`HANDOFF MISSING` on stdout and stderr, naming the branches and the count. It also appends the warning to
`.agents/SESSIONS/.missing-handoff.jsonl` (gitignored). The next SessionStart greeting in that checkout prints it
**once** and moves it aside. **It warns and never blocks:** every path is caught, and the hook exits 0.
- **How "this session's" commits are found:** by TIME. The session's start is the first `timestamp` in its own
  transcript (`transcript_path` in the hook payload), and a commit counts when its committer date is at or after that
  start. Commits carry no session uuid, so a trailer could not be relied on.
- **What it misses:** another session committing to a `loop/*` branch of the same checkout in the same window is
  counted as this one's; a commit amended or rebased from older work, keeping an older committer date, is not counted;
  a handoff named other than `*-handoff.md` or outside `docs/loops/` is not recognised (pinned by a test); an
  uncommitted handoff does not count. With no transcript there is no start time, and the check prints `NOT RUN`, never
  a pass. **The rule is per session, not per branch**, so red-check and mutant branches are covered by the one handoff.

### Commits (each row is that commit's own `git show --stat`)

| Commit | What | Stat |
|---|---|---|
| `4a6119b` | red first: two sessions of one seat, the first's record survives (also `loop/t179-redcheck`) | 1 file, +160 |
| `d31769d` | T163-1 schema v3, migration, retention, render; T163-2 `record-erasure` and `state erasures` | 31 files, +1661 −356 |
| `bce0210` | the two tcm-red rows on `d31769d` (cli-args, greeting-size helper) | 2 files, +10 −4 |
| `57a2025` | T179-1: `end.md` cut, template copies, README, bootstrap, Cursor sync, template rule | 7 files, +129 −894 |
| `81ec4ca` | T179-2: handoff guard, SessionEnd and SessionStart wiring, tests | 4 files, +381 |
| `7ba177f` | T163-2 known positives read from this repository's real history | 1 file, +24 |
| `66b2173` | `end.md`: where A8, A11, A12, A14 went | 3 files, +9 −6 |

## 3. The migration, run on this repository's record (scratch copy)

Run at `7ba177f`'s build on a copy of this tree's `.agents/state.json` (rev 131, the same rev as origin/master), under
the OS temp dir. `git status` showed the live file unchanged afterwards.

```
schema_version 2 → 3
revision 131 → 132
handoffs: 3 kept word for word (qa@75, developer@74, planner@109), session_uuid and checkout null — v2 never recorded either
last_session → sessions[0]: n 76, 2026-09-21, uuid 22631f4e-433a-4f29-8669-47ee2f543bec, seat planner, checkout null
uuids: 2 distinct before, 2 after, none lost
```

**Second instrument, not the migration's own counter:** a raw uuid regex over each file found **2 occurrences and the
same 2 distinct uuids** (`22631f4e…`, `d7e514f8…`) before and after. A field-by-field comparison found the handoff
text identical, and **every field other than** `schema_version`, `revision`, `handoffs`, `last_session` and `sessions`
**byte-identical**.

**What the migration cannot do:** the record holds ONE session uuid (planner 76), because the others were erased
before v3 (section 4). It keeps every uuid that is there and restores none. The first v3 write by each seat adds its
own. Also migrated, with `--keep-revision` because neither is a live record: `project-template/.agents/state.json` and
the test fixture.

## 4. T163-2 against this repository's history

`node open-brain/build/cli.js state erasures .` at `7ba177f`:

```
Walked 789 commits on HEAD; 222 changes to .agents/state.json (0 at schema v3+).
Erasures: 44 (0 at schema v3+, which /sync fails on)
```

**44 legacy erasures: 25 handoffs and 19 session uuids.** All are listed, and none fails `/sync`, because schema v2
allowed them. **Both known positives are flagged:**

```
[legacy] rev 60→61 (0ad9c29): removed session 46758737-… (session 74, developer); added by the same step: session 6eab2c5c-… (session 75, qa)
[legacy] rev 60→61 (0ad9c29): removed handoff qa@72 (session 72, qa); added by the same step: handoff qa@75 (session 75, qa)
[legacy] rev 61→62 (024dfa4): removed session 6eab2c5c-… (session 75, qa); added by the same step: session 22631f4e-… (session 76, planner)
[legacy] rev 61→62 (024dfa4): removed handoff planner@73 (session 73, planner); added by the same step: handoff planner@76 (session 76, planner)
```

The same result is pinned by a test that reads this repository's real history (`7ba177f`). It is green here in 11.7s
and **skips on CI**, where the checkout is shallow (section 9). The fixture rows reproduce the rev 61/62 shape in a real
git repository, and those do run on tcm.

## 5. `/sync` checks

**Added:** `record-erasure` (T163-2). **Changed:** `state-schema`'s refusal now says which direction a version mismatch
runs: an older record is migrated (and the message names the migrate command); a newer one needs a rebuild. The
`ob_start` refusal says the same.

**No `/sync` check read `end.md`'s old steps.** Four checks touch `end.md`, and none needed a change: `mirror-parity`
(existence in `CURSOR_COMMAND_SET` and parity), `command-parity`, `command-tool-names` and `command-names`. The last two
pass on the new file: 78 tool references across 31 command files, 62 command references across 35 files.

**`sync --check` in this tree reports three issues, and none is a defect of the candidate:**
- `mirror-parity` and `command-parity`: `end.md` (and Cursor `sync.md`) differ from the **installed** copies in
  `~/.claude/commands` and `~/.cursor/commands`. Those serve every session on this machine and change only after merge.
  **Installing them is a post-merge step, together with the migration below.** CI has no home copies and passes.
- `state-schema`: the live record is v2 and this build reads v3. The message names the migrate command. See section 7.
- `retirements`: `ENTITIES.md` still names `dream` and `reflection queue`. This candidate does not touch that file; it
  is on origin/master as well. Reported, not fixed: that is someone's ruling, not a side effect to fold in.

## 6. Runs

All on **tcm** (D-040), read per test from the run logs.

| Run | Branch @ SHA | Result |
|---|---|---|
| 36216905605 | `loop/t179-redcheck` @ `4a6119b` (tests only, on master's code) | **RED as intended:** `closeout-erasure` 8 of 10 rows red on assertions, the other 74 files pass. The 2 green rows are explained in `4a6119b`'s message: the op schema already refused a `session_uuid` argument, and the same-checkout drop passed on master only because the one slot was replaced. |
| 36218174861 | `loop/t179-end` @ `d31769d` | **RED, my defect:** `cli-args` did not know the new `state erasures` command (2 rows), and `greeting-size`'s scratch-root helper copied only the untracked `AGENT.local.md`, so on tcm the greeting had no seat. It was green only in this checkout. Fixed in `bce0210` and reproduced locally with `AGENT.local.md` moved aside. |
| 36221202019 | `loop/t179-end` @ `81ec4ca` | **GREEN** |
| 36221763866 | `loop/t179-end` @ frozen head | **GREEN:** 1207 passed, 2 skipped (1209); 77 of 77 files. One skip is the real-history row (shallow checkout). |

**Mutants:** one per protection, each on its own branch from `7ba177f`. Each substitution matched exactly once, the
diff was checked non-empty, and `tsc --noEmit` passed before the push, which was read back with `ls-remote`. **All 7
went red, each on the row written for it.**

| Mutant | SHA | Run | Killed by (tests red / 1209) |
|---|---|---|---|
| `key-role`: handoff keyed by seat again | `3034ff7` | 36221349474 | 8: same-seat handoff survives; retention rows; the writer's own-entry row; record-erasure known positive and negative |
| `no-session-refusal`: `set_handoff` without a session accepted | `76166f7` | 36221358655 | 1: "set_handoff REFUSES when no session is registered" |
| `op-uuid`: an op may name the uuid it writes | `c77c291` | 36221368720 | 1: "the session uuid is NOT an op argument" |
| `retention-checkout`: supersede across checkouts | `b08147e` | 36221377983 | 2: "retention NEVER drops another checkout's newest entry"; record-erasure "another checkout's entry" |
| `erasure-blind`: the walk skips the newest change | `dc000b9` | 36221387435 | 6: the record-erasure rows, known positive included |
| `guard-window`: commits before the session counted | `427f56e` | 36221395734 | 1: "a commit BEFORE the session started is not this session's" |
| `guard-blocks`: hook exits 2 on a missing handoff | `c9cee3f` | 36221405292 | 1: the real-hook row "…and exits 0" |

**Local, one file at a time (no full local suite):** `handoff-guard` 11/11; `cli-args` + `greeting-size` 64/64 with
`AGENT.local.md` moved aside; the real-history erasure row green in 11.7s. **Both green-first files were mutated:**
the guard file by two mutants, and the real-history row covered by `erasure-blind`'s fixture kills. **That row skips
on tcm, so no tcm run exercises it.**

## 7. After merge (Aaron's act, then the planner's)

1. Merge (Aaron, D-019). Rebuild the main tree; `/mcp reconnect open-brain` in open sessions. **A stale server
   cannot read a v3 record:** it refuses with the version message rather than falling back.
2. `node open-brain/build/cli.js state migrate --dry-run .agents/state.json`, read it (every uuid kept), then without
   `--dry-run`. One commit, the migration alone.
3. Install the new `end.md` into `~/.claude/commands/` (and the Cursor copies), so the parity checks pass.
4. Retire "no `/end` (T-163)" from future briefs.

## 8. Greeting size before and after: Addition 1 is NOT met (+86 characters per seat)

**Atlas's ruling (Addition 1):** "greeting-size must stay under its current figure on this repo's migrated record: show
before and after in the handoff." **Measured after the freeze, on atlas's request. `66b2173` is unchanged.**

**Instrument:** the live `ob_start` text. `handleStart({project_root})` was imported from each build's own
`build/server.js`, one process per seat, so this is not `greeting-size`'s composition. Each build ran in a scratch
`git clone --shared` of this repository at its own SHA, and each clone was its own project root, so its git history is
real. The seat came from an `AGENT.local.md` written into the clone per run. Both builds are stamped with their SHA in
`build-info.json`.
- **BEFORE:** master `be7ddfb`'s build on rev 131 (v2). The record is byte-identical at `be7ddfb` and `66b2173`.
- **AFTER:** `66b2173`'s build on the same record, migrated to v3 (rev 132) by that build and committed in the clone.

| Seat | BEFORE chars / words | AFTER chars / words | Δ chars / words |
|---|---|---|---|
| planner | 55,117 / 8,698 | 55,203 / 8,712 | **+86 / +14** |
| developer | 47,650 / 7,585 | 47,736 / 7,599 | **+86 / +14** |
| qa | 50,594 / 8,109 | 50,680 / 8,123 | **+86 / +14** |

**AFTER is larger for every seat, by the same 86 characters.** A per-line diff of the developer greeting (517 lines
both sides; every handoff body identical) puts all of it on five label lines:

| Δ | Line |
|---|---|
| +37 | `Last session: … — 1 writing session(s) in the record` |
| +23 | `Other seats' handoffs (named…` → `Other handoffs (newest per seat and checkout; named…` |
| +9 ×3 | `[legacy]` on the own handoff and on the two others (their checkout is null after migration) |
| −1 | the session-log path: the scratch directory `gs-after` is one character shorter than `gs-before` (an artefact of the measurement) |

**Why:** T163-1's render adds a checkout tag and a heading that names the rule, and the last-session line now counts
the writing sessions. The rendered content does not grow. The newest-per-(seat, checkout) rule shows the same three
handoffs as before on this record, because v2 held only one per seat, so the rule has nothing to hide here yet. The
**true label cost is +87**, measured as +86 because of the path artefact. The `[legacy]` tags disappear for a seat once
it writes its first v3 handoff.

**Scratch artefacts, same length on both sides:** the tree-currency line (the clones' `origin` is this checkout, so the
ahead counts read 233 and 213 against a local `master`), and the size line's numbers for `state.json`.

Stopped here per atlas's instruction. **No change was made to reduce it.**

## 9. Open

- **T-171 is still live** (section 1a): an `update_task` from one session replaces another session's note.
- **The real-history row skips on CI** (depth-1 checkout). The known positives are proven in seat checkouts only.
  `fetch-depth: 0` in `ci.yml` would make CI run it; that file is T-178's, so I did not change it.
- **T179-2's marker is per checkout.** A missing handoff in `sia-infra` is shown to the next session in `sia-infra`, not
  to the planner. The warning reaches the next seat in that checkout and nobody else.
