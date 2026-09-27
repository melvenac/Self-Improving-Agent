# T-179 + T-163 round 2, candidate `1646567`: QA report (QA seat, record session 134)

**By:** the QA seat, record session **134**, headless, launched by `docs/loops/qa-134/drive.ps1` (Claude session
`d90b4fb8-333f-4423-af90-e9d4337901c9`). 2026-09-26/27 (UTC). **Machine:** `DESKTOP-O4EGB1E` (`$env:COMPUTERNAME`).
**Defender exclusions** (`Get-MpPreference`, and `drive.meta`): `C:\qa-scratch`, `C:\qa-tmp`. Probes and mutants ran
with `TEMP=TMP=C:\qa-tmp`; the one full-suite control ran with the default `TEMP` (`QA_DEFAULT_TEMP`,
`C:\Users\AARONM~1\AppData\Local\Temp`, not excluded). **Model and effort:** `claude-opus-5-5` on every assistant
message of this run's stream (`%USERPROFILE%\sia-qa134\run-0.jsonl`); effort **`high`**, read from this process's
command line (`claude.exe -p … --model claude-opus-5-5 --effort high`, pid 7348).
**Dispatch:** `docs/loops/t179-r2-dispatch-qa.md`. **Candidate:** `1646567` on `origin/loop/t179-r2` (handoff tip
`d0335d7`, `docs/loops/` only after `1646567`). **Scored against:** QA 125's report (`7df2ed0`) and
`docs/loops/t179-rulings-qa125.md` with amendments 1, 2 and 3 (read in full from `origin/master`).

## Verdict

**ACCEPT `1646567`. D1 is closed by construction, and nothing the dispatch named is broken. One medium defect (R2-D1)
should be fixed before or with T-003, and the checklist needs three lines before Aaron walks it.**

- **D1 (QA 125's blocking defect): closed.** No session number orders or drops anything any more. QA 125's A6, A6b
  and A6c erase nothing. A caller of `ob_state` cannot supply `first_rev` or `closed_rev`: extra options, op keys and
  server arguments are ignored or refused, and both values come from the file's revision. One write numbered 1124
  drops no done task, and neither does one session writing three times under three numbers. A2 at 11 and A5 at 500
  pass. The real boundary is exact: 10 sessions written since keeps an entry, 11 drops it, with those sessions
  numbered BELOW it. `lastSession` and "newest" follow write order. The number comparisons left in the source are
  labels, legacy-entry identity (equality, not order) and the importer's prose-staleness judgement. My mutants
  restoring the number in `lastSession` and in done-task retention, and taking `first_rev` from the caller, are each
  killed on tcm.
- **R2-D1 (Medium, D2's class): the R179-2 refusal is checked at the wrong door.** It reads the record at
  `ob_set_session`'s `project_dir`, but the server holds one registration for every `ob_state` `project_root`. So
  registering with a subdirectory, with the victim's own checkout, or from a subdirectory cwd passes. The next
  `set_handoff` in this checkout then replaces the other checkout's session's handoff in place, and T163-2 cannot see
  it. `end.md`'s "Only a different checkout's recorded session is refused" says more than the code does. Fix: one
  comparison in the writer ("Open for the planner" 1). This is a deliberate or confused registration, the same class
  as A7, so it does not block in my verdict.
- **Holds:**
  - R179-2's refusal as tested, with A7/A8/A9 stated as not fixed (T-003);
  - R179-3 (legacy handoffs leave on their seat's first keyed handoff, explained by T163-2; the legacy session record
    stays);
  - the migration of SIA's rev 132 and 133 and A2A-Hub's rev 71 and 66: every uuid kept by two instruments,
    idempotent to the byte, and a write after it works;
  - the checklist, all seven steps, in order;
  - R179-5 (`setup.mjs` registers SessionEnd, idempotently);
  - R179-6 on every ruled point;
  - R179-7 (the fixture kills `erasure-blind-rev60` on tcm);
  - the full suite, 1309/1309 with Defender on;
  - the importer probes, identical to master;
  - the developer's CI runs, read per test.
- **Low:**
  - R2-D2: T163-2 does not see a hand edit of `first_rev`;
  - R2-D3 and R2-D4: checklist steps 6 and 7;
  - R2-D5: `erasure-legacy-session` survives tcm, a real test gap;
  - R2-D6: one `end.md` sentence.
- **Incident, not the candidate's:** during this run a second QA queue (`queue=144 checkout=46efa7e`, 01:12:12Z)
  moved this QA tree from `2667c6b` to `46efa7e` under the running seat. Its guard did not see this run's driver. The
  files I use from the tree (the dispatch and `qa-134/`) are byte-identical at both commits. I never wrote the tree's
  `state.json`: the checkout changed it, and `git status` shows it unmodified. See "Open for the planner" 6.

## The dispatch's checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | **D1 closed by construction**: QA 125's A6/A6b/A6c; caller influence on `first_rev`/`closed_rev`; session-number comparisons; 1124 on a done task; A2 at 11 and A5 at 500 | **Holds.** No erasure in A6/A6b/A6c; neither field can be supplied through `ob_state`; no ordering comparison on a session number is left; one write numbered 1124 drops no done task; A2 keeps the first entry, A5 drops nothing keyed; the real boundary is 10 kept / 11 dropped with the sessions numbered below the entry. One residual: a HAND EDIT of `first_rev` is invisible to T163-2 (R2-D2). | `c1.out`, `c1r2.out`, `c1r2b.out` |
| 2 | **D2 / R179-2** as narrowed | **The refusal works as tested, and A7/A8/A9 are stated as not fixed** in the handoff and `end.md` (not scored). **But the refusal is checked against `ob_set_session`'s `project_dir`, not the record `ob_state` writes, and is bypassed three ways (R2-D1, Medium).** | `c1r2.out` P1–P5 |
| 3 | **R179-3** | **Holds**: legacy handoff leaves at its seat's first keyed handoff, explained by `record-erasure`; the legacy session record is never superseded | `c1r2.out` L1–L2, `c1r2b.out` |
| 4 | **R179-4** checklist, all seven steps; migration of SIA rev 132 (and 133) and A2A-Hub (rev 71 and 66), two instruments, idempotence | **Migration verified on all four copies**: every uuid kept by both instruments, **idempotent to the byte**, a write after it works. **The checklist works in order**, with two gaps: step 6's command assumes a build in the seat and ignores a seat branch that wrote the record (R2-D3); step 7 leaves other projects' views stale (R2-D4). | `c2.out`, `c7.out` |
| 5 | **R179-5** `setup.mjs` registers SessionEnd (scratch only) | **Holds**: registered beside existing hooks, idempotent, on seven machine states | `c7.out`, `c5r2-hooks.out` |
| 6 | **R179-6 / R179-7** | **R179-6 met on every ruled point**, with one sentence (line 11) overclaiming because of R2-D1 and one minor (R2-D6). **R179-7 holds**: the fixture kills `erasure-blind-rev60` on tcm | `end.md`; run `36231231511` |
| 7 | **My mutants** (the dispatch's three kinds as four mutants, plus two of mine) | **5 of 6 killed on tcm, all on assertions**; `erasure-legacy-session` **survives**, not equivalent (R2-D5) | Mutants |
| 8 | **Full suite** (Defender-on control) and **importer probes** byte-exact | **1309/1309**, 0 skipped; probes **16/0 and 17/4, identical to master** | Suite |

## Check 1: D1 is closed by construction

**Instruments.** (a) QA 125's `c1-attack.mjs`, re-run unchanged except the checkout SHA and the committer name
(`evidence/c1.out`; the script's first line says what changed). (b) My `c1r2-attack.mjs`, which attacks the new rule
(`evidence/c1r2.out`). (c) My `c1r2b-scan.mjs`: steps committed in a clone with the full history, then scanned by the
candidate's own `state erasures` (`evidence/c1r2b.out`). All three run the candidate's build on a scratch clone whose
record is SIA's rev 132 (`live-rev132.json`, sha256 `f486846e…`) migrated to v3 by the candidate. Writer-level rows call
`applyStateOps`; door-level rows call the server's `handleSetSession`/`handleState`, with every store in scratch.

**QA 125's attacks, re-run on `1646567`** (the script prints its old expectations, so I read each line against the
amended rulings):

| # | Script says | Read against the rulings |
|---|---|---|
| A1 | HOLDS ×5 | holds: `session_uuid`/`uuid`/`checkout`/`session`/`sessionUuid` in an op refused |
| A2 (5, 10, 11 apart) | BROKEN ×3 | **passes as ruled.** The script expected "dropped at 11" and "legacy developer@74 kept". Now the first entry is **kept at 11** (a number gap ages nothing, amendment 1) and developer@74 leaves at the seat's first keyed handoff (R179-3). |
| A3 | HOLDS ×2 | holds |
| A4 | HOLDS ×7 | holds |
| A5 (jump to 500) | BROKEN | **passes as ruled.** Nothing keyed is dropped: infra@110, builder@111 and builder@115 all stay; only legacy qa@75 leaves (R179-3). |
| **A6** (1124 for 124) | **HOLDS** | **no erasure**: Forge 118's and QA 120's handoffs and session records all stay. |
| **A6b** (correct the number) | BROKEN | **no erasure; the label stays wrong.** G-047 keeps `1124` and no op can correct it, but the number now decides nothing (R3d below). A wrong label is rendered for as long as the entry lives. Ruled a label; not scored. |
| **A6c** (local number 6) | **HOLDS** | **no erasure**: its own handoff is kept. |
| A7, A8, A9 (same checkout) | BROKEN ×3 | **not scored** (dispatch: T-003's, recorded as not fixed). See check 2 for the statement. |
| A10 | HOLDS | holds (was a limit in QA 125) |
| A11 | INFO | unchanged: `update_task`/`close_task` notes replaced (T-171), `update_gap`/`close_gap` by design |
| A12 | INFO | legacy qa@75 now **leaves** at qa's first keyed handoff (R179-3; QA 125's D5 answered) |

**The new rule, attacked** (`c1r2.out`, 0 BROKEN in these rows):

| Row | Attack | Result |
|---|---|---|
| R1a | extra writer options `first_rev`, `firstRev`, `closed_rev`, `rev` | ignored: `first_rev` = the file's revision + 1 (133 → 134) on the session and the handoff |
| R1b | `first_rev` on `set_handoff`; `closed_rev` on `close_task`, `open_task`, `reopen_task` | each refused, `Unrecognized key` |
| R1c | a recorded session writes again later under number 9999 | keeps its `first_rev` (134) and its number (300) |
| R1d | an `expected_revision` other than the file's | refused (revision mismatch), so it cannot feed `first_rev` |
| R1e | a dry run first, then the real write | `first_rev` = the real write's revision |
| R1f | close, reopen, re-close (the re-close numbered 5) | `closed_rev` 135 → null → 137: set by the writer, cleared by reopen, and it can only move **later** (toward keeping) |
| R1g | `ob_state` (server handler) with extra `first_rev`, `closed_rev`, `session_uuid`, `checkout` arguments | writer-assigned `first_rev`, the registered uuid, `checkout` = the root's basename; the extra uuid appears nowhere |

**A caller of `ob_state` cannot influence `first_rev` or `closed_rev`.** Both come from the file's revision at the
write. The one lever left is a **hand edit** of `state.json` (not a caller of `ob_state`): see c1r2b below and R2-D2.

**Does any comparison still use the session number?** A search of `open-brain/src` for every read of `session`, `n`,
`closed_session`, `opened_session` and `since_session` (the command is in Reproduction), then each hit read:
- **Ordering:** none left. `lastSession`, `newestHandoffPerInstance`, `newestHandoffForSeat`, handoff provenance's
  "newest at HEAD", `isSuperseded`, `applyInstanceRetention`, `isDroppedByRetention` and the INBOX Done sort all use
  `compareFirstRev`. `newestSessionNumber` is gone.
- **Equality, not order:** `record-erasure.ts` `presentIn` (a v1 handoff with no seat matches any handoff of the same
  session number, so the v1 → v2 migration is not read as a removal) and `handoff-provenance.ts` `sameEntry` (a
  legacy entry's identity is `seat@session`, because it has no uuid). Neither orders or drops anything.
- **Labels:** the renders (`session N`, `Last session: #N`, `(since session N)`), the G-047 note, and
  `ViewOptions.session`, which is still passed but no view reads it for ordering.
- **The importer's prose staleness** (`state-import/index.ts` 434–555) compares `Session N` declared in prose with the
  newest `SESSIONS/Session_N.md` log. That is QA 111/122's R3/R4 domain, pre-existing, and it decides what an import
  says, not what the writer drops.
- The slash commands and role files order nothing by session number.

**A wrong number on a done task (1124), R179-8:**

| Row | Result |
|---|---|
| R2a | two tasks closed in session 400, then ONE write numbered **1124** by a new session: **no done task dropped** (the live record's two legacy done tasks, T-157 and T-189, stay too) |
| R2b | an unattributed write numbered 99999: drops nothing (amendment 3's accepted consequence) |
| R2c | a second distinct session, numbered 2: drops nothing (2 < 3) |
| R2d | the third distinct session: T-9201 and T-9202 dropped; the two legacy done tasks T-157 and T-189 were eligible too and are **kept, as cited in the tracked tree** (T-157's rule) |
| R2e | ONE session writing three times, numbered 1124, 5000, 1: the task is not dropped (one session, however numbered) |

**A2's gap of 11 and A5's jump to 500 now pass** (R3a, R3b), and **the real boundary holds** (R3c): E is kept when 10
distinct sessions first wrote after it and dropped at 11, with those sessions **numbered below E** (50 down to 41), so
the count cannot be a number comparison. **Newest and last are by write order** (R3d): after writes numbered 118,
1124, 125, `lastSession`, the newest per (seat, checkout) and the newest for the seat are all 125's; a later session
numbered 6 (T-164) is the newest and the last (R3e).

**Check 1b: what T163-2 sees** (`c1r2b.out`; `state erasures` walked 854 commits, 242 changes, 19 at v3+):
- R179-3's removal of qa@75 by qa's first keyed handoff: **explained, not flagged**.
- **Control:** a hand edit removing legacy developer@74 at v3: **flagged** (`[v3+] rev 134→135 … removed handoff
  developer@74`). The only v3+ erasure listed.
- **A hand edit that only rewrites a victim's `first_rev`** (S170's handoff and session record, 148 → 0; nothing
  removed) is **not flagged**, and the next **ordinary** `ob_state` write by a new session then drops S170's handoff
  and session record as "retention", **also not flagged**. The record had 12 filler sessions after S170 in the rewrite's
  eyes, and a newer entry of the same instance (S171), so the recomputation agrees with the writer. **R2-D2.** Before
  round 2 the same was possible by rewriting `session`; what is new is that `first_rev` is now the one ordering key,
  and it is writer-assigned and never legitimately changes once set, so a check could refuse any change to it.

## Check 2: D2 (R179-2), as narrowed

**The refusal as built** (`c1r2.out` P1): `ob_set_session(<a uuid recorded under checkout "sia-builder">, project_dir =
this root)` in checkout `c1r2-proj` is **refused**, names both checkouts, registers nothing, and the previous
registration stays (the next write is stamped with it). **Holds.**

**A7, A8 and A9 in the same checkout are stated as not fixed**, as the dispatch requires, and I do not score them:
- **Handoff §2.5:** "Not caught, stated in the code, `end.md` and here: a second session in the same checkout
  registering as the first; a reconnected server adopting the other session's uuid from the per-checkout slot (A8); a
  server surviving `/clear` (A9, still unobserved). All three are **T-003**." Present.
- **`end.md` lines 8–11:** "That rests on the REGISTERED session, and the registration can be wrong: a second session in
  the same checkout, a reconnected server re-reading the checkout's hook slot, or a server that outlives a context clear
  can hold another session's id. Only a different checkout's recorded session is refused." Present, in plain words, with
  no SIA id (amendment 3, departure 1). The same text is in both template copies.
- The re-run shows all three still replace the victim's handoff in place (`c1.out`), as stated.

**But the different-checkout refusal is checked at the wrong door (R2-D1).** It reads the record at
`ob_set_session`'s `project_dir` (or the server's cwd), while every write goes to `ob_state`'s own `project_root`, and
the server holds ONE registration for every root. Three ways past it, each followed by `ob_state` on the victim's
record (`c1r2.out`):

| Row | Registration | Result |
|---|---|---|
| P2 | `project_dir` = a subdirectory of this checkout (no record there) | registered; the other checkout's session's handoff **replaced in place** ("P2: replaced from c1r2-proj"), and its session record now says checkout `c1r2-proj` |
| P3 | `project_dir` = **the victim's own checkout** (basename `sia-builder`, its record holds the victim): the check passes because there the uuid IS local | registered; the write to THIS checkout's record **replaced the victim's handoff in place** |
| P4 | no `project_dir`, server cwd a subdirectory | registered; **replaced in place** |

T163-2 cannot see any of them: the key is still present. The code comment states the P2/P4 limit ("A project_dir that
is not the project root (no `.agents/state.json` there) is not checked"); P3 is not stated anywhere; the handoff and
`end.md` state neither. `end.md`'s "Only a different checkout's recorded session is refused" therefore claims more than
the code does (R179-6). These are deliberate or confused registrations, the same class as A7, which is why I rate it
Medium rather than blocking. **A one-comparison fix closes all three and T-003's slot path from another checkout:** in
`applyStateOps`, where `mine` (the registered uuid's recorded session) is found, refuse when `mine.checkout` is non-null
and differs from this write's `checkout`. The mutant `checkout-refusal-off` below shows what the tests pin today.

**P5 (information):** the migrated LEGACY session record (planner, n 76, checkout null) is registrable from any
checkout (null is not checked, as stated), and one write under it rewrites that record's seat to `qa`, its checkout to
the writer's and gives it a `first_rev`. Nothing is removed and the uuid stays, so the migration's promise holds; the
record's seat label does not.

## Check 3: R179-3, legacy entries

| Row | Result |
|---|---|
| L1 (`c1r2.out`) | a write with no `set_handoff` removes no legacy handoff; **qa's first keyed handoff removes qa@75 only** (reported as `handoff qa@75 (qa, legacy, session 75)`); developer@74 and planner@109 stay |
| L2 (`c1r2.out`) | after 13+ keyed sessions (12 planner sessions in 12 checkouts), the **legacy SESSION record** (planner, n 76, uuid `22631f4e…`) **is still there**: never superseded |
| 1b (`c1r2b.out`) | `record-erasure` **explains** qa@75's removal (not flagged) and **flags** a hand removal of legacy developer@74 (control) |
| migrations (check 4) | on SIA's rev 132 and 133 copies and A2A-Hub's rev 71 and 66, the first keyed qa handoff superseded that record's legacy qa handoff, reported in the `ob_state` output |

**R179-3 holds as ruled** (amendment 2).

## Check 4: R179-4, the checklist, all seven steps, and the migration

### 4a. The migration on copies of real records (`c2r2-migrate.sh`, `evidence/c2.out`)

Four copies, each in a scratch clone: **SIA rev 132** (`origin/docs/session-100-qa99-dispatch`, sha256 `f486846e…`,
byte-identical to this tree's live file; the branch is deleted on the remote, so the copy is QA 125's, checked by
sha256 against the local tracking ref); **SIA rev 133** (origin/master today, `10fa61ea…`); and **A2A-Hub**, read-only
from `github.com/melvenac/A2A-Hub`, which is **v2 rev 71** today (`a63d9de`, `079e5a12…`) and **rev 66** at
`4c713b3` (`03279fa9…`), the revision the handoff read from Aaron's disk. `~/Projects` does not exist on this PC.

| | SIA rev 132 | SIA rev 133 | A2A-Hub rev 71 | A2A-Hub rev 66 |
|---|---|---|---|---|
| dry run | lists the changes; file byte-unchanged | same | same | same |
| run 1 | v2→v3, 132→133 | 133→134 | 71→72 | 66→67 |
| files changed by the migration | `state.json` only | same | same | same |
| **Instrument A** (the migration's own count) | 2 distinct before, 2 after, none lost | same | same | same |
| **Instrument B** (`grep -o` of every uuid-shaped string; a JSON walk printing each with its path) | before 2/2 at `$.gaps.12.evidence`, `$.last_session.uuid`; after 2/2 at `$.gaps.12.evidence`, **`$.sessions.0.uuid`**; sets equal | same | before `$.decisions.26.note`, `$.last_session.uuid`; after `$.decisions.26.note`, `$.sessions.0.uuid`; sets equal | same |
| field by field | every field but schema_version, revision, handoffs, last_session, sessions, tasks identical; tasks word for word + `closed_rev: null` (70, 2 done); handoffs word for word + three null keys; `sessions[0]` = `last_session` + `checkout`/`first_rev` null | same (3 done) | same (67 tasks, 9 done) | same (8 done) |
| **run 2 (idempotence)** | "already at schema v3 — nothing to do"; sha256 equal (`5f61eb58…`) | equal (`6deeebd5…`) | equal (`5144f690…`) | equal (`9fa863b8…`) |
| plain `sync`, then commit | re-rendered 4 views; exactly 5 files changed | same | same | same |
| `sync --check` after | `state-schema`, `summary-version`, `record-erasure` pass; issues: `retirements` (ENTITIES.md) and `greeting-size` 47,018, both pre-existing | same, 46,004 | `mirror-parity` (A2A's own layout, pre-existing) | same |
| an `ob_state` write after (server handler, registered session) | 133→134, applied, 4 views; legacy qa@75 superseded (R179-3); sessions = [76 legacy, 134 new]; 3 distinct uuids | the same | 72→73; qa@16 superseded; 3 distinct | the same |

**The handoff's changed claim is true:** `tasks` gains one key per task, and that is the only change outside the five
v2 fields. **Idempotent to the byte on all four.** SIA's live `.agents/state.json` in this tree was never written by me.
It was sha256 `f486846e…` (rev 132, `2667c6b`'s committed copy) at the start. At 01:12:14Z another queue's checkout
of `46efa7e` replaced it with that commit's committed copy (`10fa61ea…`, rev 133). `git status` shows it unmodified
against HEAD before and after (the incident in the Verdict; "Open for the planner" 6).

### 4b. The checklist walked as a stranger (`c7r2-walk.sh`, `evidence/c7.out`)

A scratch "GitHub" repo O (master = origin/master `36a33bc`, plus `loop/t179-r2` `d0335d7`); the MAIN checkout a clone
of O; three seat worktrees of it made before the merge (detached; a docs-only working branch; a working branch whose
seat wrote the record with the OLD server); A2A-Hub (rev 71) and frogger's shape (master's `project-template`, v2 rev 0;
the frogger repository is not reachable) as other projects; `HOME`/`USERPROFILE` and every store in scratch, checked by
a guard that stops unless `os.homedir()` is the scratch home. OLD server = master `aae0dce`'s build (no source change
between `aae0dce` and `36a33bc`). The merge into O's master is clean.

| Step | What a stranger sees |
|---|---|
| before | OLD greeting fine (rev 133) |
| **1** rebuild (`git pull`, `npm ci`, `npm run build`) | exit 0, stamped `a4b4bdb`. A session still on the OLD server works on v2. **A NEW session is refused** (`STATE RECORD REFUSED: schema_version … expected 3`), as the checklist warns. |
| **2** migrate, plain `sync`, commit on a `docs/*` branch, merge | dry run as in 4a (133→134, 3 done tasks); exactly **5 paths** changed and committed together, nothing left over. After: `summary-version`, `state-schema`, `record-erasure` pass; issues `build-freshness` (build `a4b4bdb` ≠ HEAD `9f41223`, which step 4's rebuild clears, as the checklist says), `retirements`, `greeting-size` 45,786 (both pre-existing) |
| **3** reconnect | NEW greeting shows `state.json rev 134`; an OLD session is refused and told to rebuild. Correct. |
| **4 + 5** `node scripts/setup.mjs` in the main checkout | on a settings file with SessionStart already registered and another tool's SessionEnd hook: `· SessionStart hook already registered`, **`✓ SessionEnd hook registered (cli-session-end.js)`**; the other tool's hook and an unrelated key kept; **re-run: both "already registered", settings byte-unchanged**. `~/.claude/commands/end.md` = the repo's; `~/.cursor/commands/end.md` = the template's. The registered SessionEnd command runs and exits 0. After: **`build-freshness` passes**; 2 issues left, both pre-existing. |
| **6** seats | **As written, `node open-brain/build/cli.js detach` fails in the detached seat** (`Cannot find module …\seat-detached\open-brain\build\cli.js`): a worktree has no build of its own unless its seat made one. The MAIN checkout's `cli.js detach`, run in the seat, fetches and detaches at `9f41223`; the record is v3 rev 134 and the NEW greeting works. A docs-only working branch merges `origin/master` cleanly. **A seat whose branch wrote the record before the merge conflicts** in `.agents/state.json` and `.agents/TASKS/INBOX.md`, and the checklist says nothing about it; its only rule ("never migrate its own branch copy") rules out the obvious way out. **R2-D3.** |
| **7** other projects | A2A-Hub and frogger's shape: NEW refused before, migrate exit 0, NEW greeting fine after. **A2A-Hub's `sync --check` then fails `summary-version` and `state-views`** (views at rev 71, record 72): step 7 has no re-render and no commit, which step 2 has. **R2-D4.** (frogger's stand-in has no `package.json`, so `sync` refuses there; not the checklist's fault.) |

The seven steps otherwise work in the order written. Steps 3 and 5 are simulated at the handler level (a greeting
from each build); no live Claude session reconnected.

## Check 5: R179-5, `setup.mjs` registers SessionEnd

Run only against scratch: `setup.mjs` itself in check 4b's walk (a guarded scratch `HOME`/`USERPROFILE`), and
`setup-hooks.mjs`'s `withSessionHooks` directly on seven machine states (`c5r2-hooks.mjs`, `evidence/c5r2-hooks.out`).
This PC's real `~/.claude/settings.json` was not read or written by any of it.

| Machine state | Result | Re-run |
|---|---|---|
| fresh (`{}`), and no settings at all | SessionStart AND SessionEnd registered | unchanged |
| SessionStart only (a machine set up before R179-5, like this PC per QA 125) | SessionStart "already registered", **SessionEnd registered** (the old early return is gone) | unchanged |
| both registered with forward slashes (an earlier install) | both "already registered", nothing written | unchanged |
| SessionEnd registered from ANOTHER checkout (a seat) | replaced by this checkout's, reported ("Replaced 1 … differing by path") | unchanged |
| a stale `knowledge-mcp` SessionEnd and another tool's SessionEnd | the stale one removed and reported; the other tool's kept | unchanged |
| `hooks.SessionEnd` malformed (an object) | replaced by an array with ours, silently | unchanged |

In the walk, `setup.mjs` printed `✓ SessionEnd hook registered (cli-session-end.js)` as the checklist says to look for,
and the registered command runs (exit 0). **R179-5 holds.** The stated limit (a seat's registration is replaced by
the checkout `setup.mjs` runs from) is real and is why the checklist says "MAIN checkout only". The malformed case
discards what was there without saying so; a hand-made settings file is unlikely to look like that, so I note it only.

## Check 6: R179-6 and R179-7

**R179-6, `end.md` against the code** (59 lines; `.claude/commands/end.md` and `project-template/.claude/commands/end.md`
byte-identical, sha256 `f2de8833…`; the Cursor copy differs only by its Cursor preamble):

| Ruled | Present? |
|---|---|
| no "nothing it can erase" | **yes**: gone; it says the guarantee "rests on the REGISTERED session, and the registration can be wrong" |
| no present-tense "injects only on a deterministic match" | **yes**: "Nothing reads `MATCH:` yet" (confirmed: the only `MATCH` in `open-brain/src` is FTS5 SQL) |
| step 3 needs a registered session | **yes**: "Needs a registered session … report that, not 'none'" and the report line has `"no registered session"` |
| no SIA ids in the template copy | **yes**: no `T-`/`G-`/`D-` ids, no `sia-` paths, no names; the MATCH example path is generic (`src/db/migrate.ts`). (The Cursor copy's title says "(Cursor + SIA)", the product's name, pre-existing.) |
| the SessionEnd claim is conditional and names `setup.mjs` | **yes**, and true (check 5) |

Two sentences still claim more than the code does:
- **"Only a different checkout's recorded session is refused"** (line 11): only when the registration names that
  checkout's root as `project_dir` (R2-D1, check 2).
- **"Every write records its session in `sessions[]`"** (line 7): a write with no registered session records nothing
  and says so (A3, R2b). Minor; the next sentence's dependency covers the spirit, not the letter.

**R179-7:** the fixture row (`record-erasure.test.ts` "T-163's known positives as a fixture") builds revs 59–62 with the
real uuids and shapes and asserts the four legacy erasures at 60→61 and 61→62 and none at 59→60. **On CI it kills
`erasure-blind-rev60`:** run `36231231511` (`loop/t179-r2-qa-erasure-blind-rev60` @ `ea49b15`), read per test by me:
1 failed, that row only, `AssertionError: expected [] to deeply equal [ 'handoff:qa@72', …(1) ]`. **R179-7 holds.**

## Mutants

Driver `mutants-qa134.mjs`. Each mutant is an anchored substitution set; every anchor matched **exactly once**, the
diff was non-empty, `tsc --noEmit -p .` exited 0, and the sources were restored and hash-checked after each local run
(`restored: true`). Locally: 12 named files (183 tests). Then one commit per mutant on `qa/t179-r2-mut-<name>` from
`1646567`, pushed with `push-qa.mjs` and read back, and one `workflow_dispatch` each on tcm, read per test with
`ci-read.mjs`. The dispatch's three are the first four rows (the number comparison restored twice: `lastSession` and
done-task retention).

| Mutant | What it breaks | Branch head | Local (of 183) | tcm run | tcm red (of 1309) |
|---|---|---|---|---|---|
| **`firstrev-caller`** (dispatch) | `first_rev` = the caller's session number for a new session | `75aa2b6` | 9 | `36284960415` tcm-1 | **9**: session-order ×4 (A6b, A6c, the sessions-since boundary, the done-task boundary), state-writer ×3, closeout-erasure ×1, state-import-v3 ×1 |
| **`last-by-n`** (dispatch) | `lastSession()` by `n` again | `bdf4a9e` | 2 | `36284961834` tcm-2 | **2**: session-order A6b; state-schema "lastSession is DERIVED by WRITE ORDER" |
| **`done-by-n`** (dispatch) | done-task retention by number again: `closed_session <= newest n − 3` (two files) | `d968626` | 7 | `36284963271` tcm-1 | **7**: session-order "one write numbered 1124 drops NO done task"; state-writer; state-views T-144 ×3; server handleStart; state-import `--commit` |
| **`checkout-refusal-off`** (dispatch) | R179-2's refusal never fires (the lookup only finds this checkout's record) | `3203594` | 1 | `36284964650` tcm-2 | **1**: server "A7 across checkouts: … is refused" |
| `closed-rev-firstrev` | `close_task` records the closing session's FIRST-write revision instead of the closing write's | `8342f0a` | 1 | `36284965962` tcm-2 | **1**: state-writer "drops done tasks once 3 DISTINCT sessions …" |
| `erasure-legacy-session` | `record-erasure` lets a legacy SESSION record yield like a legacy handoff | `4baae38` | **0** | `36284967199` tcm-1 | **0: SURVIVES** (1307 passed, 2 skipped). **Not equivalent:** built, it passes a hand removal of the migrated legacy session record that the candidate flags (`c3r2-legacy-session.out`). **R2-D5.** |

Every red on tcm is an `AssertionError` (each printed twice in the log, plus the step's exit line); no timeouts, no
`TypeError`, no infrastructure failure; every run collected 86 files and 1309 tests. **`checkout-refusal-off` is
killed, but by the one row that registers with `project_dir` = the written root;** no row tries P2–P4, which is why
R2-D1 is invisible to the suite. The developer's 16 mutants and QA 125's 7 re-run on the new tip were not re-run by
me; I read three of their runs (above).

## The full suite and CI

- **The one full local suite** (the Defender-on control): the candidate `1646567` built in `cand/`, a full checkout
  (`--is-shallow-repository` false), `TEMP=TMP=C:\Users\AARONM~1\AppData\Local\Temp` (the default, from
  `QA_DEFAULT_TEMP`; not excluded from Defender), started 2026-09-27T01:15:27Z: **86 of 86 files, 1309 of 1309 tests
  passed, 0 skipped**, 171 s, exit 0 (`evidence/fullsuite-1646567.summary`). Both rows that skip on CI ran here:
  the real-history `record-erasure` row (8.3 s) and `paths.test.ts`. Nothing else ran locally at the time; my six
  mutant runs were on tcm.
- **The developer's CI, read per test by me** (`gh run view --log`):
  - `36231392345`, `loop/t179-r2` @ `1646567`, tcm-1, success: **86/86 files, 1307 passed, 2 skipped (1309)**. Matches
    the handoff.
  - `36230084527`, redcheck `6c8f581`, tcm-1, failure: **10 failed, 1291 passed, 2 skipped (1303), 3 of 85 files**;
    20 `AssertionError` lines (each failure printed twice), no other error kind. The ten rows are the ones the handoff
    lists (A6, A6b, A6c, A2, A5, the sessions-since boundary, the 1124 done-task row, R179-3's legacy handoff, R179-2's
    cross-checkout refusal, `record-erasure`'s number-retention positive).
  - `36231231511`, `erasure-blind-rev60` on the new tip @ `ea49b15`: 1 failed (the R179-7 fixture), an assertion.
- **My CI:** six runs on tcm (budget 8), all `workflow_dispatch` on `qa/t179-r2-mut-*`, no Windows or hosted job. No
  run for the candidate itself: the developer's green run is its record.
- **The importer probes, byte-exact** (QA 122's `probes-r4.mjs` sha256 `6863dd15…` from
  `qa/importer-fixes-r4-report`; QA 111's `probes-r3.mjs` `3832568d…` from `qa/importer-fixes-r3-report`; both equal
  QA 125's copies), run on `1646567` and on master `aae0dce`:

  | Script | `1646567` | `aae0dce` | diff of the outputs |
  |---|---|---|---|
  | `probes-r4.mjs` | **16 passed, 0 failed** | 16 / 0 | only the header line (the tree's path and SHA) once temp-file pids and scratch paths are normalised |
  | `probes-r3.mjs` | **17 passed, 4 failed** | 17 / 4 | the header line, and where one line is clipped at 200 characters (a temp-file pid of a different length earlier in that line) |

  The four FAILs are the rows QA 122 and QA 125 recorded, each ruled (R4-1: R3-2's NUL case, block, do not judge):
  the three `R3-2 class: … then PS 5.1 >>` rows and `UTF-8 with one stray NUL at the end`. **No change from master.**

## What could not be verified

- **Steps 3–5 on a live machine.** No Claude session was reconnected (`/mcp reconnect`) and no real settings file was
  touched: the greeting from each build stood in for a reconnect, and `setup.mjs` ran under a guarded scratch home.
  How a host shows the SessionEnd hook's output is not observed.
- **The real seat worktrees** (`sia-builder`, `sia-infra`, `sia-forge`, …) are not on this PC, so whether each has a
  build of its own (R2-D3) and whether any branch carries record writes today is unknown.
- **The real `~/Projects/A2A-Hub`** is not on this PC; its GitHub copy (rev 71, and rev 66 from history) stood in.
  Its `a2a-*` worktrees and **frogger** (repository not reachable) were not seen; frogger's shape was master's v2
  template.
- **A9's premise** (the server surviving `/clear`) is still unobserved; not scored (T-003).
- `gitnexus` and this session's open-brain MCP were not available (the dispatch says so). No impact analysis was run;
  this seat changed no product code except its own mutant branches.
- Cursor: nothing ran under Cursor; its `end.md` copy was compared byte for byte only.

## Defects

New in this round (QA 125's D1–D8 are scored in the checks: D1, D3, D5, D6, D7 addressed as ruled; D2 narrowed as
ruled; D4 and D8 out of round 2 by ruling and not re-scored).

| Id | Severity | Defect | Where |
|---|---|---|---|
| **R2-D1** | **Medium** (D2's class; not blocking in my verdict) | R179-2's different-checkout refusal reads the record at `ob_set_session`'s `project_dir` (or the server's cwd), but writes go to `ob_state`'s `project_root`, under one registration for every root. Registering with `project_dir` = a subdirectory (P2), the victim's own checkout (P3), or no `project_dir` from a subdirectory (P4) passes, and the next `set_handoff` replaces the other checkout's session's handoff in place and rewrites its session record's checkout, invisibly to T163-2. P2/P4 are stated in a code comment only; P3 nowhere. `end.md` line 11 overclaims. | `server.ts` `handleSetSession` (the R179-2 block); `state-writer.ts` `applyStateOps` (where `mine` is found); `end.md` line 11 |
| **R2-D2** | Low-medium | T163-2 does not see a hand edit that rewrites `first_rev`, and explains the removal an ordinary write then makes. `first_rev` is now the only ordering key, writer-assigned and never legitimately changed once set (a legacy entry's null becomes a number at its first write, nothing else), so `record-erasure` could flag any other change to it. The same was possible with `session` before round 2. | `record-erasure.ts`; `c1r2b.out` (c) |
| **R2-D3** | Low | Checklist step 6: `node open-brain/build/cli.js detach` in a seat assumes the seat has its own build (a worktree does not, unless its seat built one): `MODULE_NOT_FOUND`. The main checkout's CLI works. And a seat whose working branch has written the record since its base **conflicts** in `state.json` and `INBOX.md` when it merges `origin/master`; the checklist gives no resolution and forbids the obvious one (migrating its own copy). | handoff §6 step 6; `c7.out` |
| **R2-D4** | Low | Checklist step 7 migrates other projects but neither re-renders their views nor commits: A2A-Hub's `sync --check` then fails `summary-version` and `state-views`. Step 2's "migrate, plain `sync`, commit together" applies there too. | handoff §6 step 7; `c7.out`, `sync-a2a-hub.out` |
| **R2-D5** | Low (test gap) | No test pins `record-erasure`'s "a legacy SESSION record never yields": the mutant `erasure-legacy-session` survives the named files locally and (see Mutants) on tcm; built, it lets a hand removal of the migrated legacy session record (`22631f4e…`, the uuid the migration promises to keep) pass unflagged, where the candidate flags it (`c3r2-legacy-session.out`). The writer side is pinned (the developer's `legacy-session-yields`). | `record-erasure.test.ts` |
| R2-D6 | Low | `end.md` line 7: "Every write records its session in `sessions[]`": an unattributed write records nothing (and says so). | `end.md` |

## Disagreements

- **With handoff §2.5 and `end.md`** ("Only a different checkout's recorded session is refused"): only when the
  registration's `project_dir` is the written checkout's root (R2-D1).
- **With handoff §6 step 6** ("`node open-brain/build/cli.js detach` in a detached seat"): needs a build the seat
  usually does not have, and says nothing about a seat branch that wrote the record (R2-D3).
- **With the dispatch's framing of A2-at-11:** the dispatch asks that "A2's gap of 11 … now pass". It passes in the
  amended sense (a number gap ages nothing, so the first entry is KEPT); QA 125's script, run unchanged, prints BROKEN
  because it expected the old drop. I scored the amended meaning.
- **None with the rulings.** Amendments 1–3 are built as ruled, and the three accepted departures are as described.

## Error entries (mine)

1. **Migration check, first run hung:** the server-handler probe (`node --input-type=module -e …` importing
   `server.js`) inherited an open stdin from the backgrounded shell and never exited. Killed; re-run with
   `< /dev/null`. The first copy's migration half had completed and matched the re-run.
2. **My kill of that run matched my own shell:** a PowerShell `CommandLine -match 'c2r2-migrate|--input-type=module'`
   also matched the PowerShell process running it and its parent bash (6 processes, exit 255). Nothing else was hit
   (no `claude`, no driver). Later kills filtered by `name='node.exe'` first.
3. **Checklist walk, first run VOID** (`c7-void1.out`): `git init` left `master` as the unborn checked-out branch, so
   fetching into `refs/heads/master` was refused and every later step failed on a missing tree. Fixed with
   `git init -b scratch-unborn` and a guard that stops when the main checkout has no record.
4. **Mutant driver, first run VOID** (`mutants-local-void.out`): I parsed vitest's coloured summary with a plain
   regex, so `Tests 9 failed` (with escape codes) read as "SURVIVED". Stopped after the first mutant, the tree
   restored (`git checkout -- .`, verified clean), re-run with `NO_COLOR=1 FORCE_COLOR=0`, and a missing summary now
   reads VOID instead of SURVIVED.
5. **Mutant `checkout-refusal-off`, first anchor VOID:** `if (false && rec …)` left `rec` possibly undefined in the
   body (tsc exit 2). Re-anchored on the lookup (`… && x.checkout === here`); tsc 0; killed (1 red).
6. **Heredoc under the Bash tool lost a backslash** in `c5r2-hooks.mjs` (`/\\/g` became `/\/g`, a syntax error);
   rewritten with the Write tool. Two later in-place edits through `node -e` lost backslashes the same way and were
   redone with the editor. None of these reached a result.

## Reproduction

Scripts in `docs/loops/qa-scripts-t179-r2/`, outputs in `…/evidence/`. Scratch root `C:/qa-scratch/qa134`: `cand/`
(worktree at `1646567`, `npm ci && npm run build`, stamped `1646567`), `base/` (`aae0dce`, the OLD server), `mut/`
(mutants; its `build/` was last built WITH `erasure-legacy-session` applied, for `c3r2-legacy-session.mjs`), `a2a/`
(a read-only clone of `github.com/melvenac/A2A-Hub`). QA 125's scripts are used from `qa/t179-report` `7df2ed0`
unchanged except `c1-attack.mjs`'s checkout SHA and committer name. Record copies: `live-rev132.json` (QA 125's copy,
sha256 `f486846e…`, equal to `git show origin/docs/session-100-qa99-dispatch:.agents/state.json` and to this tree's
live file) and `live-master133.json` (`git show origin/master:.agents/state.json`, with `MSYS_NO_PATHCONV=1`).

```
node c1-attack.mjs     C:/qa-scratch/qa134/cand C:/qa-scratch/qa134        # makes c1-proj (1646567 + migrated rev 132)
node c1r2-attack.mjs   C:/qa-scratch/qa134/cand C:/qa-scratch/qa134
node c1r2b-scan.mjs    C:/qa-scratch/qa134/cand C:/qa-scratch/qa134
grep -rnE "closed_session|opened_session|since_session|\.session\b|\bsession\s*[<>]=?|[<>]=?\s*session\b|\.n\b" --include=*.ts open-brain/src
bash c2r2-migrate.sh   C:/qa-scratch/qa134/cand C:/qa-scratch/qa134 "rev132|<cand>|1646567|<live-rev132.json>" \
  "master133|<cand>|1646567|<live-master133.json>" "a2a-rev71|<a2a>|a63d9de|" "a2a-rev66|<a2a>|4c713b3|"
bash c7r2-walk.sh      C:/qa-scratch/qa134 "<the sia-qa repository>"
node c5r2-hooks.mjs    C:/qa-scratch/qa134/cand
node mutants-qa134.mjs C:/qa-scratch/qa134/mut [--only <name> | --commit <name>]
node c3r2-legacy-session.mjs <cand|mut> C:/qa-scratch/qa134 <label>
node probes-r4.mjs <cand|base> <scratch> ; node probes-r3.mjs <cand|base> <scratch>
(cd cand/open-brain && TEMP=$QA_DEFAULT_TEMP TMP=$QA_DEFAULT_TEMP NO_COLOR=1 npx vitest run)
node docs/loops/qa-134/push-qa.mjs qa/t179-r2-mut-<name> ; gh workflow run ci.yml --ref qa/t179-r2-mut-<name>
```

## Open for the planner

None of these blocks the merge in my verdict; each is a recommendation.

1. **R2-D1: fix now or in T-003?** My recommendation: move the different-checkout check into the WRITER (in
   `applyStateOps`, refuse when the registered uuid's recorded `checkout` is non-null and differs from this write's).
   It is one comparison, it covers P2–P4 and T-003's slot path from another checkout, and the registration-time check
   can stay as the early, friendlier refusal. If it waits for T-003 (scheduled next), add P2–P4 to `end.md`'s and the
   handoff's list of what is not caught, because line 11 is otherwise the overclaim R179-6 forbids.
2. **R2-D2:** have `record-erasure` flag any change to a recorded entry's `first_rev` (other than null → number at a
   legacy entry's first write)? A task, if not round 3.
3. **Checklist (R2-D3, R2-D4) before Aaron walks it:** step 6 should read `node <main>/open-brain/build/cli.js detach`
   (as step 7 already names the main checkout's path), and say what a seat with record writes on its branch does:
   land those writes on master before step 2, or resolve the conflict by taking master's v3 record and re-applying the
   seat's ops through `ob_state`. Step 7 should add "then `sync` (re-render) and commit, as in step 2".
4. **R2-D5:** a `record-erasure` row: a hand removal of the migrated legacy session record, after that seat has
   written a keyed session, is flagged. It kills `erasure-legacy-session`.
5. **A6b's wrong label is permanent** (G-047 keeps `1124` for that session). Ruled a label, so nothing is erased; but
   the greeting will say "session 1124" for as long as the entry lives. If that matters, T-164 (local numbers) is
   where it would be handled.
6. **The queue moved a running seat's tree (infra, not the candidate).** `~\sia-qa-queue\queue.log`: at
   2026-09-27T01:12:12Z `start=queue=144 checkout=46efa7e…`, then `head=46efa7e…` at 01:12:14Z. The QA tree's reflog
   shows `checkout: moving from 2667c6b… to 46efa7e…` at the same second, after a `git fetch -q origin`. This run's
   driver (`qa-134\drive.ps1`, pid 1748, started 00:38:56Z) was running throughout, so `qa-queue.ps1`'s
   `Get-OtherDrivers` guard should have waited. My guess at the cause: from the session that launched queue 144, the
   driver's `CommandLine` was not readable (WMI returns it null for another logon session's process unless elevated),
   so `-match` saw nothing. When I looked at 01:21Z, no queue-144 process was running and its log had no line after
   `head=`. Effect here: none on the results. The files this run uses from the tree are identical at both commits, and
   everything else ran in `C:\qa-scratch\qa134`. But a seat that reads tracked files from its tree mid-run could be
   hurt. Recommendation: have the guard treat an unreadable `CommandLine` of any `powershell.exe` as "maybe a driver"
   (or use a lock file the driver holds), and log when it waits.

QA-134: REPORT COMPLETE
