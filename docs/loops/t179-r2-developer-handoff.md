# T-179 + T-163 round 2: developer handoff (Forge, record 128)

**By:** Forge (developer), record session **128**, 2026-09-26, in `~/Worktrees/sia-infra` (this checkout's local
greeting number: 9, per T-164). Claude session `439dd67f-2e6d-4ebb-8726-75a293538ecd`. **To:** Atlas (planner).
**Brief:** "Round 2 rulings" and "Round 2 brief (record 128)" in `docs/loops/t179-rulings-qa125.md` on
`origin/docs/session-100-qa99-dispatch`, **as amended by Atlas's three A2A rulings this session** (section 1).
**Model and effort, from this session's transcript:** `claude-opus-5-5`, effort **`medium`** on every assistant entry
that carries the field: **505 of 505**, counted from `~/.claude/projects/C--Users-melve-Worktrees-sia-infra/439dd67f-….jsonl` immediately before the handoff commit.

**Candidate for QA:** `loop/t179-r2` @ **`1646567`** (the handoff commit on top changes only `docs/loops/`).
Branched from `origin/loop/t179-merge` `f618b73` (= `3c0bfdc` + docs). No rebase, no force.

## 1. What was ruled, and where the build departs from the file

The rulings file is not the whole ruling. Three changes came by A2A from Atlas during the build, each quoted here
because A2A has no memory:

1. **R179-1 re-ruled.** The file's rule ("refuse an unseen session more than 5 above the record's newest n") would
   have refused **every** write to SIA's live record: after migration its newest n is **76** (no session has written
   `last_session` since 76, T-163), and every real session is 128+. The highest session number anywhere in the record
   is 109, so no reference point rescues it. I raised it; Atlas replied: *"RE-RULED, R179-1 as amended: retention and
   'newest' NEVER use the caller's session number. [...] Every handoffs[] and sessions[] entry records the record
   REVISION at which its session first wrote. [...] The session number becomes a LABEL only: rendered, never
   compared."* No jump confirmation, no bound.
2. **Done-task retention is in round 2.** I reported it as D1's sibling (a write numbered 1124 dropped every uncited
   done task). Atlas: *"Done-task retention IS IN ROUND 2. [...] a done task is dropped [...] when at least 3
   DISTINCT sessions[] entries have a first_rev after the revision at which the task was closed. Record the closing
   revision on close. For tasks closed before v3, order them before every keyed session."* Plus a 1124 row and a
   mutant restoring the number comparison.
3. **R179-2's coverage is narrower than the file says, accepted.** QA's A7 and A8 are both SAME-checkout
   (`c1-attack.mjs` uses one root), so a different-checkout refusal catches neither as QA wrote them. Atlas: *"The
   different-checkout refusal stays. A7 and A8 in the same checkout, and A9, are T-003's, recorded-not-fixed [...] Do
   NOT build the slot-adoption check."*

Atlas also accepted, by A2A: first_rev assigned by the writer; legacy entries ordered before every keyed entry with no
inferred revision; a legacy SESSION record never superseded.

**One departure I made without a ruling, for you to overrule:** R179-2 asks `end.md` to say "until T-003, the
registration can be wrong", and R179-6 says no SIA ids in the template copy. `mirror-parity` REQUIRES the repo and
template copies of `end.md` to be identical (repo↔template is the `required: true` pair), so one text serves both.
`end.md` states the dependency in plain words and carries **no** SIA id; **T-003 is named here** instead.

## 2. What was built

| Commit | What |
|---|---|
| `2d17a34` | **Red first**, tests only (= `loop/t179-r2-redcheck` `6c8f581`, same test tree). |
| `a3ab1a3` | R179-1 as amended, done tasks, R179-3, T163-2's rule, R179-2; existing rows moved to the ruled rule. |
| `df49d75` | R179-5: `setup.mjs` registers SessionEnd (`scripts/setup-hooks.mjs`, `tests/setup-hooks.test.ts`, README). |
| `79dba3c` | R179-6: `end.md` (and both template copies). 59 lines. |
| `b1153e3` | record-erasure: a redundant count removed (section 2.4). |
| `2c99df1` | the legacy-session row carries a seat (section 4); the mutant driver and its local evidence. |
| `1646567` | the retirements allowlist follows the `knowledge-mcp` cleanup into `setup-hooks.mjs` (section 7). |

### 2.1 R179-1: the session number orders nothing

- **`first_rev`** on every `handoffs[]` and `sessions[]` entry: the revision the session's first write produced
  (`before + 1`), assigned by the writer. A recorded session keeps its own; a legacy session record that writes again
  takes one at that write. The caller supplies only `session`, which is now a label (G-047 still keeps a recorded
  session's number; it just decides nothing).
- **Retention:** a keyed entry is superseded only when a newer entry (by `first_rev`) of its (seat, checkout) exists
  AND **more than 10 sessions[] entries have a later `first_rev`**. A session counts once, however it is numbered.
- **`lastSession()`, `newestHandoffPerInstance`, `newestHandoffForSeat`** and handoff provenance's "newest at HEAD"
  all order by `first_rev`; ties fall back to array order (possible only across a merge, G-027).
- **Legacy entries:** `first_rev` null, ordered BEFORE every keyed entry. I did not infer a revision from the record
  rev: that would be a guessed number nothing checks, which is D1's class.
- QA's rows, with QA's numbers and uuid shape (`tests/shared/session-order.test.ts`): **A6, A6b, A6c show no erasure
  at all**; A2 (11 apart, nothing between) keeps the first; A5 (jump to 500) drops nothing. What A2 and A5 now mean
  differs from what QA expected: a number gap ages nothing, so "dropped at 11" becomes "kept"; the real drop case
  (11 distinct sessions since) is its own row, with the boundary at 10 kept and 11 dropped.

### 2.2 Done tasks

`closed_rev` on each task (null unless done; the schema refuses otherwise). `close_task` sets it, `reopen_task`
clears it. A done task leaves once **3 distinct sessions have a `first_rev` after its `closed_rev`**; T-157's
keep-if-cited is unchanged. Tasks closed before v3 are null and age out once 3 keyed sessions have written. **An
unattributed write (no registered session) is not a session and ages nothing** — so `ob_state` with no session
never drops a done task, where it used to.
- The importer's report said imported done items "are dropped on the first ob_state write"; it now says they go once
  3 sessions have written, and the field is renamed `retention_eligible_done` (nothing else read it).
- The migration sets `closed_rev: null` on every task and says so in its change list. **This changes the migration's
  earlier claim that every field but handoffs/sessions is byte-identical: `tasks` now gains one key per task.**

### 2.3 R179-3

A legacy HANDOFF is superseded by its seat's **first** keyed handoff, with no age condition; another seat's keyed
handoff does not touch it. A legacy SESSION record is never superseded (it holds the uuid the migration kept, and it
renders nowhere). The writer reports the exit (`handoff developer@54 (developer, legacy, session 54)`) and
`record-erasure` recomputes the same rule, so it explains it. On SIA's migrated record, qa@75, developer@74 and
planner@109 each leave when that seat first hands off under v3.

### 2.4 T163-2

`record-erasure` recomputes retention by `first_rev`, so a removal explained only by a session number is FLAGGED
(`KNOWN POSITIVE: the 1124 write as a NUMBER-trusting writer made it`). It counts the after-state's sessions only.
My first version also counted session records dropped in the same step; that is provably redundant (a dropped
session later than the entry had more than 10 kept successors, all later than the entry), so a mutant removing it
could only be equivalent. `b1153e3` removes it rather than carry an untestable clause.

**On this repository's real history, under the new rule: 44 legacy erasures**, the same count as QA 125's check 3.

### 2.5 R179-2

`ob_set_session` refuses a uuid that `sessions[]` records under a **different** checkout, names both checkouts, and
keeps the previous registration. **Not caught, stated in the code, `end.md` and here: a second session in the same
checkout registering as the first; a reconnected server adopting the other session's uuid from the per-checkout slot
(A8); a server surviving `/clear` (A9, still unobserved).** All three are **T-003**. A row pins the same-checkout
limit so it is not read as covered. A9 becomes a T-003 row (R179-2); that row is not written here.

### 2.6 R179-5, R179-6

- `setup.mjs` now registers SessionStart AND SessionEnd, each checked on its own. The old function **returned** as
  soon as SessionStart was present, so a second hook added after that check would never have reached a machine set
  up before it; QA's PC is that machine. Stated limit (pre-existing for SessionStart): a registration of the same
  script from ANOTHER checkout is replaced by this one's, so run `setup.mjs` from the main tree only.
- `end.md`: no "nothing it can erase"; no present-tense "injects only on a deterministic match" (it says nothing reads
  `MATCH:` yet); the registered-session dependency; step 3 needs a registered session and says what to report without
  one; the SessionEnd claim is conditional and names `setup.mjs`; no SIA ids or paths. 59 lines.

## 3. Red first

**The red commit is tests only, on the candidate's code** (`loop/t179-r2-redcheck` `6c8f581` = `f618b73` + the new
rows; the same test tree is `2d17a34` on this branch). It carries only NEW rows; the rewrites of old rows to the ruled
rule are in `a3ab1a3`, so the red is not mixed with them.

| Where | Result |
|---|---|
| local, scratch worktree at `f618b73` | **10 of 54 red, every one an `AssertionError`**; the other 44 (every pre-existing row of the three files, and the R179-7 fixture) pass |
| **tcm, run `36230084527`**, runner `tcm-1` | **10 failed, 1291 passed, 2 skipped (1303); 3 of 85 files red**: the same 10 rows, all 10 `AssertionError` (each printed twice in the log). The 2 skips are the real-history row and `paths.test.ts`'s |

The 10: A6, A6b, A6c, A2 and A5 as QA wrote them, the sessions-since boundary, the 1124 done-task row, R179-3's legacy
handoff, R179-2's cross-checkout refusal, and `record-erasure`'s number-retention positive.

- **One of my first reds was VOID:** that positive died on `git commit` (nothing to commit), not on an assertion. On
  the candidate the writer had already dropped 118/120 itself, so my hand edit changed nothing. The step now also
  bumps the revision, as the file's other hand-edit rows do, and the red became `expected 'pass' to be 'issue'`.
- **The R179-7 fixture is green on the candidate by design** (its scan is correct). Its red is QA's
  `erasure-blind-rev60` (`f37ef8d`): the fixture fails there on its assertion (`expected [] to deeply equal
  [ 'handoff:qa@72', … ]`) locally, and on tcm on the new tip (section 4).
- Two rows are green on the candidate and red only under mutation, and are counted there, not here: the done-task
  "3 sessions, not 2" row (the candidate happened to agree at those numbers) and the legacy-session row.

## 4. Mutants

**Mine: 16, one per protection** (`docs/loops/dev-scripts-t179-r2/mutants-r2.cjs`). Each anchor matched exactly its
stated count and landed, `tsc --noEmit -p .` exited 0, 12 named files ran (203 tests), and every source was restored
and hash-checked after each (`restored: true`). Output: `evidence/mutants-local.txt` and `-summary.json`.
**All 16 KILLED locally.** The three Atlas named also ran on tcm, on branches from `2c99df1`:

| Mutant | Protection | Local (of 203) | tcm |
|---|---|---|---|
| `ret-by-number` | per-session retention restored to 3c0bfdc's NUMBER rule in the writer (Atlas) | 12 | `36231235127` **12 red**, among them `record-erasure`'s A6 negative: with a number-trusting writer, **T163-2 flags QA's A6**, as ruled |
| `retention-infinite` | the retention threshold raised to infinity (the brief's "bound to infinity": the amended rule has no number bound, so this is its one threshold) | 3 | `36231237629` **3 red** |
| `done-by-number` | done-task retention restored to `closed_session <= newest n − 3` (Atlas) | 4 | `36231236391` **5 red** (+ `state-import`'s `--commit` row, a file not in my local set) |
| `firstrev-from-caller` | `first_rev` from the caller's number | 10 | local only |
| `firstrev-restamp` | a recorded session's `first_rev` moved forward by a later write | 1 | local only |
| `last-by-number` | `lastSession()` by `n` | 2 | local only |
| `newest-by-number` | rendered newest per (seat, checkout) by session number | 2 | local only |
| `done-infinite` | the 3-session done threshold raised to infinity | 6 | local only |
| `closed-rev-unset` | `close_task` does not record `closed_rev` | 3 | local only |
| `legacy-never-yields` | R179-3 off | 3 | local only |
| `legacy-yields-any-seat` | a legacy handoff yields to ANY seat's keyed handoff | 3 | local only |
| `legacy-session-yields` | a legacy SESSION record superseded | 1 | local only |
| `erasure-by-number` | `record-erasure` explains removals by the NUMBER rule (Atlas) | 6 | local only |
| `r1792-off` | R179-2's refusal off | 1 | local only |
| `hooks-no-sessionend` | `setup-hooks` without SessionEnd | 4 | local only |
| `hooks-early-return` | the old early return when SessionStart is present | 1 | local only |

`legacy-session-yields` would have SURVIVED the row as I first wrote it: the fixture's legacy session has `seat:
null`, which can never match a keyed session, so "never superseded" passed whatever the code did. I found it while
choosing mutants, before running any. The row now gives the legacy session a seat, as SIA's migrated record has
(`planner`@76). **That one was caught by reading, not by a mutant; the mutant then confirmed it.**

**QA 125's seven, on the new tip** (`2c99df1`), each applied by exact substitution with QA's own before/after text
and read on tcm:

| QA mutant | Branch head | tcm run | Red / 1309 | Note |
|---|---|---|---|---|
| `ret-seat` | `eb68743` | `36231226220` | **1** | **re-anchored:** R179-1 rewrote its line. Same meaning, the checkout clause dropped from the new comparison. QA saw 2 red on 3c0bfdc; record-erasure's "another checkout's entry" row no longer kills it, because a drop now also needs >10 sessions written since and that row has 1 |
| `render-seat` | `5d45fd0` | `36231227538` | **3** | same rows as QA's |
| `uuid-skip-delete` | `9b61ce2` | `36231229081` | **11** | QA: 4 |
| `session-by-checkout` | `9881323` | `36231230309` | **15** | QA: 7 |
| `erasure-blind-rev60` | `ea49b15` | `36231231511` | **1: the R179-7 fixture** | **SURVIVED tcm in QA 125 (0 red); now killed on CI** |
| `erasure-blind-merge` | `0e9d3b0` | `36231232729` | **1** | same row |
| `guard-repeat` | `7b6ed99` | `36231233920` | **1** | same row |

Every tcm red in the 10 mutant runs is an `AssertionError`; no timeouts, no `TypeError`, no failed commands
(`evidence/ci-runs.txt`, which lists every failing row per run).

## 5. The runs

All on **tcm** (D-040), read per test from the run logs.

| Run | Branch @ SHA | Runner | Result |
|---|---|---|---|
| `36230084527` | `loop/t179-r2-redcheck` @ `6c8f581` (tests only, candidate's code) | tcm-1 | **RED as intended:** 10 failed, 1291 passed, 2 skipped (1303); 3 of 85 files |
| `36230365052` | `loop/t179-r2` @ `79dba3c` | tcm-2 | green: 1307 passed, 2 skipped (1309); 86 files |
| `36231224891` | `loop/t179-r2` @ `2c99df1` | tcm-1 | green: 1307 passed, 2 skipped (1309) |
| **`36231392345`** | **`loop/t179-r2` @ `1646567` (frozen)** | tcm-1 | **GREEN: 1307 passed, 2 skipped (1309); 86 of 86 files** |
| 10 mutant runs | section 4 | tcm-1/-2 | all red, on assertions |

The 2 skips on every green run: `record-erasure`'s real-history row (the depth-1 checkout) and `paths.test.ts`'s.
**The known positives it guards now also run on CI, as the R179-7 fixture.**

Local, per file (no full local suite, per the brief): the 28 files this change touches, **370 passed of 371**, the one
being a 5 s timeout fixed with an explicit timeout (section 7); then 16/16 and 4/4 on the files changed after that.
`tsc --noEmit -p .` exit 0 before every push. `/sync --check` in this tree: the same 3 issues as rounds 1 and merge
(`state-schema`, the live record is v2 until step 2; `mirror-parity` against the installed copies; `retirements`,
ENTITIES.md). `build-freshness` passes after a rebuild.

## 6. After merge: the checklist (R179-4)

Aaron runs these in order. **Until step 2 lands, any session whose server has been rebuilt is refused its greeting**
("STATE RECORD REFUSED"); that is the fail-closed design, and it is why nothing reconnects before step 3.

1. **Rebuild the main checkout.** In `~/Projects/Self-Improving-Agent`: `git pull`, then
   `cd open-brain && npm ci && npm run build`. Do NOT reconnect yet.
2. **Migrate the live record, and re-render its views, in ONE commit.** From the main checkout:
   - `node open-brain/build/cli.js state migrate --dry-run .agents/state.json`, and read it;
   - the same without `--dry-run`;
   - `node open-brain/build/cli.js sync` (**without** `--check`): this re-renders the four views, so `summary-version`
     passes. `state migrate` alone leaves them at the old revision (QA 125, check 7);
   - commit `.agents/state.json` and the four views together, on a `docs/*` branch, merged under D-032 (every path is
     on its allowlist).
3. **Reconnect** (`/mcp reconnect open-brain`) in each open session. Confirm by a greeting that shows the v3 record,
   never by the reconnect message.
4. **Install the new `end.md`** and 5. **register the SessionEnd hook**: both are `node scripts/setup.mjs`, run in
   the MAIN checkout only (it replaces a registration of the same script from another checkout). It also rebuilds, now
   after the migration commit, so `build-freshness` passes. Look for `SessionEnd hook registered (cli-session-end.js)`
   or `already registered`.
6. **Seat worktrees.** Before a seat's next session, bring master's migration commit into its checkout:
   `node open-brain/build/cli.js detach` in a detached seat; a seat on a working branch merges `origin/master`. A seat
   must never migrate its own branch copy, because that makes a second, independent migration commit (G-027's shape).
7. **Other projects on this machine with a v2 record.** Each one is refused its greeting until migrated:
   `node ~/Projects/Self-Improving-Agent/open-brain/build/cli.js state migrate --dry-run <project>/.agents/state.json`,
   read it, then run it. **Read on 2026-09-26 from this PC's disk, and it differs from the rulings file:**
   - `~/Projects/A2A-Hub` (v2, rev 66) **is on SIA**, and so are its worktrees (`~/Worktrees/a2a-*`, v2);
   - `~/Projects/frogger` is **v2, rev 0**, not v3;
   - the SIA seat worktrees (`sia-builder`, `sia-forge`, `sia-planner`, `sia-qa`, `sia-research`, `sia-infra`, all
     v2) are step 6's; the `sia-a5-*` and `qa3-*` worktrees are old scratch checkouts (v2).

**Walked, not only written.** Steps 1 and 2 were run on a scratch checkout of this branch whose record is
origin/master's (v2 rev 131; `git diff` clean against `origin/master:.agents/state.json`):
- dry run: `schema_version 2 → 3`, `revision 131 → 132`, 3 handoffs kept word for word, `sessions[0]` = n 76
  `22631f4e…` planner, **69 tasks each with `closed_rev` null, 2 of them done**, `uuids: 2 distinct before, 2 after,
  none lost`;
- the run exits 0 and changes only `state.json`; the plain `sync` exits 0 and changes exactly the four views
  (`summary-version: re-rendered 4 views at rev 132`);
- `sync --check` afterwards: **24 passed, 3 issues**: `retirements` (ENTITIES.md, pre-existing, section 7),
  `mirror-parity` (the INSTALLED copies, which step 4 fixes), and `greeting-size` (**46,888** characters against the
  40,000 limit; QA 125 measured master at 46,572, so it is an issue before this candidate too). `state-schema`,
  `summary-version` and `record-erasure` (44 legacy, 0 at v3) pass.
- Steps 3 to 7 were not run: they act on this machine's live sessions, home directory and other projects.
  `setup-hooks.mjs` is covered by its unit rows, not by a run of `setup.mjs` against a real home directory.

## 7. Found on the way

- **The retirements allowlist had to follow the code** (`1646567`). R179-5 moved the `knowledge-mcp` hook cleanup
  out of `setup.mjs`, which R-006 allowlists, into `setup-hooks.mjs` and its test, which it did not. **My `/sync`
  before committing R179-5 did not show it: the check reads TRACKED files, and both were still untracked when it
  ran.** The checklist walk found it on a clean checkout. `/sync` before a commit does not see the commit's own new
  files; run it after staging, or on the pushed tip.
- **I near-missed a wrong claim in that commit's message.** It first gave the reason as "the live record is v2".
  Before pushing I read the line I had truncated at 120 characters, and the cause was the untracked files. I amended
  the message while the commit was unpushed (the remote was at `2c99df1`, read with `ls-remote`).
- **`git show <ref>:<path>` under the Bash tool wrote an EMPTY record** (sha `e3b0c442…`) during the checklist walk:
  the watch-out in this seat's own last handoff. The migration refused it ("not valid JSON"), the fail-closed
  direction. Redone from the checkout's own copy, checked against origin/master with `MSYS_NO_PATHCONV=1`.
- **My QA-mutant script collapsed `\\u0000` to `\u0000`** (a NUL character), so render-seat's anchor matched 0 times.
  It was VOID: not counted, not pushed. Fixed and re-applied (1 line, `tsc` 0).
- **`tree-currency.test.ts` timed out (5 s) twice** in one local run of 28 files; alone it passed, and it is green on
  tcm (G-042's family). `record-erasure`'s rewritten retention row does 12 real writes and commits (3.9 s alone), so it
  carries an explicit 60 s timeout.
- **The rulings' "other projects" line is wrong for this machine** (section 6, step 7): A2A-Hub is on SIA.
- **`ENTITIES.md` still names `dream` and `reflection queue`** (the `retirements` issue in every tree): outside this
  candidate, as in round 1 and the merge round.

## 8. Not done

- No `/end` (T-163 standing; retired by this candidate only after merge). SIA's live `.agents/state.json` was not
  written in any tree: every write went to a temp copy or a scratch repository.
- No full local suite (brief). The full suite ran on tcm.
- D4 (T-171) and D8 are not in round 2, per the rulings.
- No CHANGELOG entry: the release is Aaron's (D-019).

## 9. Branches pushed (all read back with `ls-remote`)

`loop/t179-r2` (`1646567`, then this handoff); `loop/t179-r2-redcheck` (`6c8f581`); `loop/t179-r2-qa-{ret-seat,
render-seat, uuid-skip-delete, session-by-checkout, erasure-blind-rev60, erasure-blind-merge, guard-repeat}`;
`loop/t179-r2-mut-{ret-by-number, done-by-number, retention-infinite}`. The effort line at the top is recounted
from the transcript before this commit.
