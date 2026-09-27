# QA 154: T-003 round 2 (a server knows its own session), candidate `d781b59`

**Seat:** QA, record session 154, headless, dispatched by `docs/loops/t003-r2-dispatch-qa.md` through
`docs/loops/qa-154/drive.ps1`. **Model / effort:** `claude-opus-5-5`, effort `high` (the driver's flags).
**Machine:** `DESKTOP-0GV3HAD`, Windows 10 Pro 10.0.19045, node v22.23.2, Claude Code 2.1.283. `claude.exe` is in npm's
global folder (`.local\bin` has none). This is the same host QA 142 ran on. **This machine has no `~/.claude/open-brain/`**,
checked at the start and again after the full suite, so no real knowledge DB and no real by-pid directory exist here to
touch. The tool shell carries `CLAUDE_PID=10312`. `TEMP` is `C:\qa-tmp` (the driver's setting). The one full-suite control
used the default `TEMP`.
**Date:** 2026-09-27 (UTC).
**Candidate:** `origin/loop/t003-r2` at `d781b59`. The commits after it (`443b898`, `84e6029`, `508fa08`) touch only
`docs/loops/t003-r2-developer-handoff.md`. It is stacked on T-003 round 1 `706c029`, which is on T-179 round 2 `1646567`.
**Only what round 2 adds is scored.**
**Scratch:** `C:\qa-scratch\t003r2\`, with these worktrees:
- `cand` `d781b59`, `base` `706c029`, `t179` `1646567`;
- `merged` `fa3ac8a`, a **local** merge of `origin/master` `36a33bc` and `d781b59`, never pushed;
- `mut`, `qat`, `qmut`, `report`.

Every probe points `KNOWLEDGE_V2_DB`, `OPEN_BRAIN_ACTIVE_SESSION`, `OPEN_BRAIN_VAULT_DIR`, `OPEN_BRAIN_SCORE_HISTORY`,
`OPEN_BRAIN_SHADOW_LOG`, `HOME` and `USERPROFILE` at scratch. The suite's own `tests/setup-env.ts` does the same for the
stores. No live `state.json` was written: every record written is a scratch clone's.
**Scripts and outputs:**
- this seat's probes: `docs/loops/qa-scripts-t003-r2/`;
- their outputs, and the re-runs of QA 142's and QA 134's scripts: `…/evidence/`, verbatim.

## Verdict

**PASS. Every required fix and every ride-along holds, with no regression. There is one low test gap (QA154-1). The
departure from the ruling (the registration check was not restored) lost no protection for the record. It lost an early
message only, and the planner rules on it (Open 1).**

- **D1 holds.** With no proof, `ob_start` prints `Session ID: none — <reason>`, never discovers, and never reuses
  another session's log. This holds in QA 142's P7/P7b shapes and in a stronger one: the other session proved itself and
  ran `/start` first, so its log carries its id and discovery, asked directly, returns that id. It also holds in the
  skipped-log branch and when the proof is JSON `null`. All of these are BROKEN on `706c029`.
- **D3 holds.** `ob_end` called as `end.md` calls it (`entry_ratings` only) rates what `ob_recalled` lists. The rating
  reaches `feedback_log` under the proven id with origin `recall-log`, through a real server process. After `/clear`
  the same server rates the new session's recalls only. With no proof it writes no row and does not error.
- **R2-D1 holds in the writer.** With a REAL proof naming the victim's uuid (QA 134's P1–P4 carry none, so under
  T-003 they pass vacuously), `applyStateOps` refuses every shape:
  - all four registration shapes (P1 this root, P2 a subdirectory, P3 the victim's own checkout, P4 no `project_dir`);
  - a write with no handoff, a two-step (a decision, then a handoff), a dry run, and the writer called directly;
  - a caller-supplied `checkout` on `ob_state`, as an argument or inside an op.

  This checkout's own session and a legacy (`checkout` null) record still write. **Both halves of the departure are
  verified:** the registration check was already gone at `706c029` (its comment: "superseded, not lost"), and on
  `706c029` every one of those shapes writes through. The writer alone refuses every shape the old check refused. See
  item 3 for what was lost.
- **`end.md`:** the two Claude copies are byte-identical. The Cursor copy differs only by its four-line preamble.
  Lines 7–11 now say what the code does: a null checkout is not refused, and an unattributed write records nothing and
  says so (`NOTE: no registered session: …`).
- **Ride-alongs hold:**
  - D2: a JSON `null` proof is named "is not a session record" in `ob_recall`, `ob_feedback` and `ob_start`, with no
    "FTS search error". `ob_stats` answers: its proof line is `NONE — <reason>` (by reading `server.ts:1266`; the
    probe showed its first two lines);
  - D4: `ob_feedback` prints `NOT LOGGED: <reason>`;
  - D5: the real hook binary writes no Claude proof for `--ide cursor` (or `Cursor`) with an inherited `CLAUDE_PID`;
  - R2-D5: the legacy-session removal is flagged.
- **Regressions: none.**
  - QA 142's c1–c4, re-run byte-exact, differ from QA 142's evidence only in the five defect rows, which now hold.
  - QA 134's D1 checks (`c1-attack`, `c1r2-attack`, `c1r2b-scan`) give the same verdicts on `d781b59`, on the merged
    tree and on `706c029`. They differ from QA 134's evidence on `1646567` only where T-003 round 1 already changed them.
- **Mutants:** 7 of this seat's own (2 for D1, 2 for D3, 3 for R2-D1). The table is in the Mutants section.
  **QA154-1:** one mutant, "the writer refuses only batches that carry `set_handoff`", **survives the developer's whole
  suite on tcm**. This seat's rows kill it: run `36296175366`, where only they fail. Under it, a session recorded under
  another checkout moves its record's checkout with any non-handoff write, and then replaces its handoff in place.
- **CI:**
  - all nine of the developer's runs were verified per test, and each mutant kills exactly its named rows;
  - this seat used 2 of its 6 tcm runs. `qa/t003-r2-tests`: 1341 passed, 2 skipped. The M6 mutant: 2 failed (this
    seat's rows).

## 1. D1: `ob_start` with no proof (QA 142's P7/P7b, and stronger)

| Row | `706c029` | `d781b59` |
|---|---|---|
| QA 142 c1 **P7** (no proof; the newest transcript is another session's) | BROKEN | **HOLDS**: `Session ID: none — no session proof for this server's parent process … (…absent…)`. The log contains no other id |
| QA 142 c3 **P7b** (a second session's `ob_start`, no proof) | BROKEN | **HOLDS**: a new `Session_2.md`, `Session ID: none — …` |
| QA 142 c3 P7c (with a proof, the transcript is ignored) | HOLDS | HOLDS |
| q154-d **A1**: the OTHER session proved and ran `ob_start` first, so `Session_1.md` carries `0be70be7…`, and discovery asked directly returns `0be70be7…`. Then this server, with no proof | BROKEN: `Session #1 (existing log for this session id — reused, nothing created)`, `Session ID: 0be70be7…` | **HOLDS**: `Session #2`, `Session ID: none — <reason>`. `Session_2.md` has no Session ID line, and `Session_1.md` keeps its own |
| q154-d **A2**: the proof is JSON `null` | BROKEN | **HOLDS**: `Session ID: none — the session proof …\by-pid\<pid>.json is not a session record` |
| q154-d **A3**: no `.agents/SESSIONS/` (the skipped-log branch) | BROKEN (`Session ID: 0be70be7…`) | **HOLDS**: `Session log: no .agents/SESSIONS/ dir — log not created` / `Session ID: none — …` |
| q154-d A4 control: with a proof | HOLDS | HOLDS: the proven id |

**By reading:** `sessionStart` now discovers only for `undefined`. `findExistingSessionLog` returns null for a null id,
so a no-proof start can never match an existing log. The one other caller of `sessionStart` is the CLI's
`open-brain start` (`cli.ts:190`). It passes no id, so it still discovers. That is not `ob_start`, and it has no proof
to use. See O-4.

## 2. D3: `ob_end` as `end.md` calls it (QA 142's S4, and stronger)

`end.md` step 3 calls `ob_end` once, with `entry_ratings` only. That means no `session_id` and no
`recalled_entry_ids`.

| Row | `706c029` | `d781b59` |
|---|---|---|
| QA 142 c2 **S4** (explicit `recalled_entry_ids`, no `session_id`, proof names B) | `feedback_log` 2 → 2 | **2 → 3**: a new row `{s: B, o: explicit, m: supplied}` |
| q154-d **B1**, a real server over stdio: prove A, `ob_recall`, `ob_recalled` lists `qa154-d3-one`, then `ob_end({entry_ratings: {1: helpful}})` | BROKEN (`Recalled ids: 0 from none`) | **HOLDS**: `Recalled ids: 1 from recall-log` / `Feedback: 1 entries rated`. `feedback_log` `[{s: A, k: 1, r: helpful, o: recall-log, m: supplied}]` |
| q154-d **B2**, `/clear` in the same server process (A removed, B proved): B recalls id 2, then rates id 1 and id 2 | BROKEN | **HOLDS**: exactly one new row, `{s: B, k: 2, o: recall-log}`. Id 1 (A's recall) is not rated |
| q154-d B3 control: the proven id named explicitly | same resolution | same resolution |
| q154-d **B4**: no proof, `end.md`'s call | HOLDS | **HOLDS**: `Recalled ids: 0 from none`, no row, no error |

Both halves use the proven id: `resolveRecalledIds({sessionId: endedId})` and `sessionEndV2({sessionId: endedId ?? ""})`.
My mutants M3 and M4 break one half each, and each is killed (Mutants).

## 3. R2-D1 in the WRITER, and the departure from the ruling

**Why QA 134's own rows could not score this.** QA 134's `c1r2-attack.mjs` P1–P4, re-run byte-exact, show P2/P3/P4 HOLDS
and P1 BROKEN on `d781b59`, **and exactly the same on `706c029`**. That is vacuous. The script registers with a
`session_id` claim and has no proof, so T-003 refuses every registration, and every write is unattributed (P1's detail:
`ob_set_session refused: this server cannot prove its session`). Under T-003 the only way a server writes under the
victim's uuid is to **prove** it: the same claude session writing from another checkout. So `q154-r2d1.mjs` gives the
server a real proof of the victim's uuid `00000800…`, recorded under checkout `sia-builder` in this checkout's record
(`c1r2-proj`, SIA's rev 132 migrated to v3, sha256 `f486846e…`). It then uses QA 134's registration shapes.

| Row | `706c029` | `d781b59` |
|---|---|---|
| **P1w** `project_dir` = this root (the OLD check's own refusal shape) | registration accepted; the handoff is **replaced**, and the record moves to `c1r2-proj` | registration accepted; **`ob_state refused: session 00000800… is recorded under checkout sia-builder, and this write is checkout c1r2-proj`**; revision unchanged |
| **P2w** `project_dir` = a subdirectory | replaced | **refused** |
| **P3w** `project_dir` = the victim's own checkout (basename `sia-builder`) | replaced | **refused** |
| **P4w** no `project_dir`, cwd a subdirectory | replaced | **refused** |
| **N1** `add_decision` only (no handoff) | applied; the session record's checkout moves | **refused**; the record keeps `sia-builder` |
| **N2** `dry_run: true` | "dry run — nothing written" | **refused** |
| **N3** two steps: a decision, then a handoff | both applied; the handoff is replaced | **both refused** |
| **W1** `applyStateOps` directly, `checkout` defaulted | applied | **refused** |
| **R1g-p** `ob_state` with extra `checkout: "sia-builder"` and `session_uuid` arguments (`q154-r1g.mjs`) | n/a | **refused**: the handler forwards neither |
| R1g-p2 `checkout` inside an op | n/a | **refused** (the strict op schema, then the writer) |
| **K1** a session recorded under THIS checkout | writes | **writes** |
| **K2** the legacy record `22631f4e…` (n 76, checkout null) | writes | **writes**; the record then says checkout `c1r2-proj`, seat `qa` (QA 134's P5, unchanged) |
| W2 (INFO) the same uuid writing AS `sia-builder` | applied | applied: the rule compares checkouts, as ruled |
| E1 (INFO) the victim's handoff with NO session record | replaced | **replaced**. See O-1 |

**Half 1: the registration check was gone at `706c029`.**
- At `1646567`, `handleSetSession` held the R179-2 block. It read the record at `project_dir` (or the cwd) and refused a
  uuid recorded there under a different non-null checkout. QA 134's P1 shows that refusal on the `t179` build.
- At `706c029` the block is gone. The doc comment in its place says: "R179-2's different-checkout refusal stood here.
  It is superseded, not lost: … no id but this server's own can register now". `d781b59` does not touch
  `handleSetSession`.
- On `706c029`, P1w registers and the write replaces the handoff.

**Half 2: does the writer alone refuse everything the old check refused?** Yes, for everything the old check protected.
- Under T-003 the old check could only ever concern the **proven** id, because a claim that differs from the proof is
  refused first. It refused when that id was recorded, in the record at `project_dir`, under another non-null checkout.
- In that shape, a write to the same record is refused by the writer (P1w). A write to another record is refused
  whenever that record holds the id under another checkout (P2w–P4w). That is the only way a write can reach another
  checkout's session's entries.
- The case the writer lets through: the id is absent from the written record, or recorded there under this checkout.
  There the write touches no other checkout's entry. The old check blocked the registration in that case, which under
  T-003 blocks no write anyway: `handleState` takes `attributedSession(null)`, the proof, and never reads the registration
  (K1 writes without registering).

**What was lost:**
1. The early message at `ob_set_session` (the first sign now comes at the first write).
2. The old check also kept that registration's row out of the knowledge DB's `sessions` table. Now it is recorded. That
   row is not the project record.

Nothing that reaches `state.json` was lost. **The planner rules (Open 1).**

## 4. `end.md`, all three copies

- `.claude/commands/end.md` and `project-template/.claude/commands/end.md` are **byte-identical**: sha256 `fe525480…`,
  3333 bytes, LF only.
- `project-template/.cursor/commands/end.md` (3565 bytes, `426990f9…`) differs **only** in its first line and three
  inserted preamble lines (`diff`: `1c1,4`). Everything after the preamble is identical to the Claude copy.

Lines 6–12, against the code:

| Sentence | Code | Holds? |
|---|---|---|
| "A write that carries a session records that session in `sessions[]`." | upsert by uuid (`state-writer.ts` 263–275), unless refused | yes |
| "A write with no session records nothing there, and says so." | `NOTE: no registered session: this write is not attributed and sessions[] is unchanged (set_handoff would refuse)`; `sessions[]` 1 → 1 (`q154-says-cand.out`) | yes |
| "A write is refused when its session is already recorded under a different checkout (`checkout` set, and not this write's)." | the R2-D1 guard; section 3, every shape | yes |
| "A legacy session record (`checkout` null) is not refused on that comparison." | `mine.checkout != null` in the guard; K2 | yes. **Note:** after that first write the record carries the writer's checkout, so a later write from another checkout IS refused. The sentence is exact about a null record, and silent about what the write does to it |
| old "Every write records its session in `sessions[]`" (R2-D6) | removed from all three copies | yes |
| old "Only a different checkout's recorded session is refused" (line 11) | removed from all three copies | yes |

The same paragraph also dropped the "registration can be wrong" caveat (A7/A8/A9). That is right after T-003: writes
read the proof. **Not in round 2's lines:** step 3 says "Without a proof `ob_recalled` … lists nothing, and the ratings
are zero". That is not true when a `.recalled-entries.json` naming no session exists (O-3).

## 5. The ride-alongs

| Item | Evidence | Result |
|---|---|---|
| **D2** a JSON `null` proof | QA 142 c2 S5/S5b (BROKEN on `706c029`); c1 P3c null; q154-d A2, B6, B7 | **Holds.** `ob_recall` returns its results with `_(NOT LOGGED: … is not a session record)_`, no "FTS search error"; `ob_stats` answers; `ob_feedback` and `ob_start` name it. On `706c029`: `FTS search error — index may be empty.` and `ob_state error: Cannot read properties of null` |
| **D4** `ob_feedback` with no proof | QA 142 c2 S1b; q154-d B5 | **Holds**: `NOT LOGGED: this server cannot prove its session — <reason>`, and no row |
| **D5** `--ide cursor`, inherited `CLAUDE_PID`, no `cursor_version` (the real `build/cli-bootstrap.js`) | q154-d C1–C6 | **Holds.** C1 `--ide cursor` and C2 `--ide Cursor`: `Session proof NOT written: this host is not Claude Code…`, no file. C3/C4: a `cursor_version` in the payload wins, even over `--ide claude`. C6 control (no flag): the proof is written. On `706c029`, C1/C2 wrote `<pid>.json`, which is QA 142's `c6-ide-flag.out` reproduced. **C5 (INFO), a behaviour change:** with no flag and `OPEN_BRAIN_IDE=cursor`, the proof is no longer written (on `706c029` it was). That is consistent with ruling Q2 |
| **R2-D5** the legacy-session removal | QA 134 `c3r2-legacy-session.mjs` byte-exact on `d781b59`; the developer's row | **Flagged**: `[v3+] rev 134→135 (…): removed session 22631f4e-… (session 76, planner)`, the same as QA 134's `cand` line. The developer's `r2d5` mutant (`isSuperseded(..., true)`) fails exactly that row on tcm |

## 6. Regressions

**QA 142, re-run byte-exact** from `origin/qa/t003-report`'s `docs/loops/qa-scripts-t003/` on `d781b59` and `706c029`,
and compared with QA 142's recorded evidence (on `706c029`):

| Script | `d781b59` | Differences from QA 142's evidence |
|---|---|---|
| `c1-t003.mjs` (A7, A7b, A8, A8b, A9, A9b, P1–P7) | 22 HOLDS, 0 BROKEN, 1 LIMIT (P2, the stated Limit 1) | only **P7** (BROKEN → HOLDS) |
| `c2-stdio.mjs` (real server process: S1–S5) | 9 HOLDS, 0 BROKEN | only **S1b, S5, S5b** (BROKEN → HOLDS). S4 now logs a row |
| `c3-start.mjs` (P7b, P7c, P5c) | 2 HOLDS | only **P7b** (BROKEN → HOLDS) |
| `c4-hooks.mjs` (the real hooks: H1–H5, O1, O2) | 6 HOLDS, 1 LIMIT (O2) | **none** |

So A7, A8, A9 and every attack in QA 142's check 2 still hold: P1 forged under another pid, P1b, P3 reused pid, P3b,
P3c bodies, P4 nested, P5 claims (incl. case), P5 `ob_end` / `ob_store_chunk`, P6/P6b two servers, S1–S3 across
`/clear`.

**QA 134's D1 checks on the merged tree.**
- **The merged tree:** `origin/master` (`36a33bc` at the time) merges with `d781b59` without conflict. Its `open-brain/src`
  is byte-identical to `d781b59`'s. It differs only in tests and `vitest.config.ts`.
- **During this run `origin/master` moved to `c4d3388`** (PR #169, the queue guard). That move touches only
  `docs/loops/`, and the candidate still merges cleanly into it.

`c1-attack.mjs`, `c1r2-attack.mjs` and `c1r2b-scan.mjs` were each re-run byte-exact on `t179` (`1646567`), `base`, `cand`
and `merged`:

| Script | `1646567` vs QA 134's evidence | `706c029`, `d781b59`, merged: vs QA 134's evidence |
|---|---|---|
| `c1-attack.mjs` (QA 125's A1–A12) | identical | identical except **A8 BROKEN → HOLDS** (T-003's fix). A7/A9 read BROKEN because the script's setup writes through a server with no proof, so the victim is never written ("victim entry now: undefined"): vacuous |
| `c1r2-attack.mjs` (R1a–R1g, R2a–e, R3a–e, P1–P5, L1–L2) | identical | identical in **every D1 row** (R1a–f, R2a–e, R3a–e) and in L1–L2. R1g and P1–P5 differ, for the no-proof reason in section 3. R1g is re-scored with a proof (R1g-p, holds) |
| `c1r2b-scan.mjs` (T163-2) | identical, full text, with commit SHAs normalised | identical, full text: the legacy removal is explained, the control is flagged, and the `first_rev` hand edit is unseen (R2-D2, already a task) |

`706c029`, `d781b59` and the merged tree give identical verdicts in all three scripts. So round 2 changed nothing that
QA 134's D1 checks see.

## 7. Mutants (this seat's own; none is the developer's)

`mutants-qa154.mjs`:
- Each mutant is applied to `C:\qa-scratch\t003r2\mut` at `d781b59`, and each site must occur exactly once.
- Each is built with `npm run build` (tsc), then run against the **full vitest suite** and four probes: `q154-d`,
  `q154-r2d1`, QA 142's `c1-t003` and `c3-start`.
- The tree is restored after each (`git diff --stat` empty at the end), and it is rebuilt.
- Output: `evidence/mutants-qa154.out`.

**Baseline (unmutated, the same run):**
- The build is ok.
- vitest: 1336 passed, 2 failed. Both failures are `tree-currency.test.ts` 5 s timeouts.
- Every probe: 0 BROKEN.

**Every run, the baseline included**, also logs vitest's two unhandled `[vitest-worker]: Timeout calling "onTaskUpdate"`
errors. That is load, and it does not count against a mutant. Only assertion failures are counted as kills below.

| Mutant | Fix | Edit | Suite rows failing (of 1338) | This seat's and QA 142's probe rows newly BROKEN | Verdict |
|---|---|---|---|---|---|
| **M1** `d1-callsite` | D1 | `handleStart`: `sessionId: proven.id ?? undefined` (discovery restored at the call site; `sessionStart` untouched) | **1**: QA 142's adopted "D1 ob_start with NO proof does not stamp another session's id" | q154-d A1 (the log is **reused**); QA 142 c1 P7 | **KILLED** (thin: one suite row) |
| **M2** `d1-greeting` | D1 | the greeting prints `Session ID: ${result.session.sessionId ?? "discovery failed"}` | **1**: the developer's "D1 … prints Session ID: none" | q154-d A1, A2, A3 | **KILLED** (one suite row) |
| **M3** `d3-sessionEnd-half` | D3 | `sessionEndV2({sessionId: args.session_id \|\| ""})`; the resolver keeps the proven id | **1**: the developer's D3 row (its `feedback_log` count) | q154-d B1, B2 | **KILLED** |
| **M4** `d3-resolve-half` | D3 | `resolveRecalledIds({sessionId: args.session_id \|\| null})`; `sessionEndV2` keeps the proven id | **1**: the developer's D3 row (`Recalled ids: 1 from recall-log`) | q154-d B1, B2 | **KILLED** |
| **M5** `r2d1-explicit-checkout-only` | R2-D1 | the guard fires only when the caller passed `checkout`, which the server never does | **3**: the developer's P2, P3, P4 | q154-r2d1 P1w, P2w, P3w, P4w, N1, N2, N3, W1 | **KILLED** |
| **M6** `r2d1-handoff-batches-only` | R2-D1 | the guard fires only for batches that carry `set_handoff` | **0: all 1338 pass**. Confirmed on tcm (`36296175366`): the developer's 9 rows pass, and only this seat's 2 non-handoff rows fail | q154-r2d1 **N1, N3** | **SURVIVES the developer's suite; killed by this seat's rows (QA154-1)** |
| **M7** `r2d1-null-refused` | R2-D1 | `if (mine && mine.checkout !== checkout)`: a legacy (null) record is refused too | **1**: the developer's "a session recorded under THIS checkout still writes, and a null checkout is not refused". Also 1 timeout in `role-files.test.ts` (load; not counted) | q154-r2d1 K2 | **KILLED** |

**Summary:**
- 7 of 7 are valid: each built, and each site occurred once.
- With this seat's rows, all 7 are killed. The developer's suite alone kills 6 of 7.
- Every kill by the suite rests on **one** row, except M5's three. M1's only suite row is QA 142's, and the
  developer's own `Session ID: none` row stays green under it. The developer's handoff says the same of their d1
  mutant.
- QA 142's `c3-start` P7b does not see M1. Under M1 the log is reused, but the row checks only the printed id. q154-d
  A1 checks the reuse.

The developer's own 7 mutants were not re-run locally. Their tcm runs were read per test (CI).

## CI (tcm only; `windows=false`; no laptop runs)

**The developer's runs, verified read-only** (`gh run view --log`, per test; runner `tcm-1`):

| Run | Head | Result |
|---|---|---|
| `36287132237` red | `573ac65` (tests only, plus `handleFeedback` extracted with its body unchanged) | **11 failed**, 1325 passed, 2 skipped (1338). All 11 are **assertion** failures: QA 142 D1 and D2; D1 `Session ID: none`; the null-id `sessionStart` row; D3; D4; D5; P2; P3; P4; `end.md` |
| `36287331316` green | `d781b59` | 89 files, **1336 passed, 2 skipped** (1338) |
| `36287373437` d1 `245064b` | `?? discover` restored in `sessionStart` | 2 failed: QA 142 D1 and the null-id row |
| `36287383074` d2 `9435a1d` | null guard removed | 1 failed: QA 142 D2 |
| `36287393691` d3 `1c5265b` | `endedId = args.session_id \|\| null` | 1 failed: D3 |
| `36287405024` d4 `41879cf` | NOT LOGGED line removed | 1 failed: D4 |
| `36287418795` d5 `0903ffc` | the old proof-block test | 1 failed: D5 |
| `36287470332` r2d1 `540e1d3` | the guard removed | 3 failed: P2, P3, P4 |
| `36287503550` r2d5 `5f3b048` | `isSuperseded(..., true)` | 1 failed: the legacy-session row |

Each mutant branch's parent is `d781b59`, and it changes one file. The test file was edited after the red run
(`573ac65` → `d781b59`). The `end.md` row now flattens whitespace before matching, which is a line-wrap fix and asks
for the same sentences. The candidate matches the handoff's claims.

**This seat's runs (2 of the 6 allowed):**

| Run | Branch @ SHA | Result |
|---|---|---|
| `36296112160` | `qa/t003-r2-tests` @ `1f3b6ef` = `d781b59` + `open-brain/tests/qa154-t003-r2.test.ts` | **success**, `tcm-1`: 90 files, **1341 passed, 2 skipped** (1343). `qa154-t003-r2.test.ts (5 tests)` ✓, `t003-r2.test.ts (9)` ✓, `qa142-t003.test.ts (6)` ✓ |
| `36296175366` | `qa/t003-r2-mut-m6` @ `4a2861b` = the above + M6 | **failure**, `tcm-2`: **2 failed**, 1339 passed, 2 skipped (1343). The 2 are this seat's R2-D1 rows "a write with no handoff…" and "two steps…". **All 9 developer rows pass under M6** |

This seat's 5 rows were also run locally: all 5 **fail on `706c029`** (on assertions) and pass on `d781b59`.

**Full suite, the one control run** (candidate build, default `TEMP` so Defender scans):
- **1336 passed, 2 failed** (1338; 0 skipped on Windows), 168 s.
- The 2 are `tests/pipelines/detach.test.ts` ("REFUSES when HEAD carries commits…", "--force proceeds…"), both
  `Test timed out in 5000ms`.
- `detach` is untouched since `1646567`. Alone, with the same `TEMP`, the file passed **14/14 twice**.
- The run overlapped an `npm ci` this seat started in another worktree (Error entry 5). **Read as load, not the
  candidate.** The mutant baseline had the same kind of failure: two 5 s timeouts in `tree-currency.test.ts`.

## What could not be verified

- **Linux behaviour of this seat's probes:** they ran on Windows only. The vitest rows cover the same shapes on tcm.
- **The live path across a real `/clear`** was not re-run in a nested `claude -p`. Round 2 does not touch the proof's
  keying or the hooks' order. D5's change is in the hook, and it is covered by the real binary (C1–C6) and by QA 142's
  c4, re-run.
- **macOS, and Cursor itself:** not available here.
- **GitNexus `impact` / `detect_changes`:** not run. This worktree has no `.gitnexus/` index, and this seat edited no
  source that is meant to merge: the mutants live in scratch, and M6 on a `qa/` branch.
- **`/sync` before the report commit:** not run. The commit adds only files under `docs/loops/` on a `qa/` branch, and
  this seat has no build in the report worktree.
- **Row #348:** not in scope, and there is no DB on this machine.

## Defects

| # | Severity | Defect | Evidence | Suggested fix |
|---|---|---|---|---|
| **QA154-1** | low (test gap) | **The developer's rows pin R2-D1 only for batches that carry `set_handoff`.** A writer check that fires only on such batches (M6) passes the developer's whole suite. Under it, a session recorded under another checkout first moves its session record's checkout with any other op (`Object.assign(mine, entry)`), then replaces its handoff in place, because by then `mine.checkout` equals the write's. That is QA 134's P2 harm, in two writes. The candidate's code is right. Only the pin is missing | tcm `36296175366`: 2 failed, both this seat's rows; `t003-r2.test.ts` 9/9 pass. Locally M6 is killed only by q154-r2d1 N1/N3 | Adopt `open-brain/tests/qa154-t003-r2.test.ts` from `qa/t003-r2-tests` (`1f3b6ef`), or at least its first two rows |

**Observations (not defects of round 2):**
- **O-1 (low): an orphaned handoff.** The R2-D1 guard reads `sessions[]` only, as the old registration check did. A
  handoff whose session record is gone has no `mine`, so the same uuid writing from another checkout replaces it and
  moves it (E1). Retention drops handoffs and session records separately (`applyInstanceRetention`), so this shape can
  arise without a hand edit: a newer same-seat session in the same checkout that set no handoff, then more than 10
  sessions. Under T-003 only the SAME claude session can prove that uuid, so what it replaces is its own. Comparing
  `handoff.checkout` as well would close it. A task at most.
- **O-2: a legacy record binds to its first writer's checkout.** The legacy session record (`checkout` null) takes the
  first writer's checkout and seat (K2: `c1r2-proj`, `qa`). After that, a write from any other checkout is refused.
  This is QA 134's P5, unchanged. `end.md` is exact about a null record, and silent about this.
- **O-3 (low, pre-existing): step 3's "the ratings are zero" does not always hold.** `end.md` step 3 says "Without a
  proof `ob_recalled` … lists nothing, and the ratings are zero". But with no proof, `resolveRecalledIds` still accepts a
  `.recalled-entries.json` that names no session. `ob_end` then rated it: `Recalled ids: 1 from file`, the helpful
  counter 0 → 1, and 0 `feedback_log` rows (`q154-file-fallback-cand.out`). Nothing in `open-brain/src` writes that
  file any more. The resolver and that sentence both predate round 2.
- **O-4 (pre-existing): the CLI still discovers.** `open-brain start` (the CLI, `cli.ts:190`) calls `sessionStart`
  without an id, so it still discovers the newest transcript. It is not `ob_start`, and it has no proof to use.

## Disagreements with the handoff

1. **"The registration check is unchanged (T-003 had already stopped comparing checkouts there…)":** accurate. **But
   the ruling said the check "stays as the early refusal"**, and the handoff does not flag this as a departure from
   the ruling. The planner's dispatch did. The substance is in section 3, and the ruling is Open 1.
2. **"P3 registers against the victim checkout, where that uuid is local, so the writer is the door that refuses
   it":** true of every shape now, not only P3. Under T-003 registration affects no write.
3. The handoff lists "the same-checkout / null-checkout row" among rows that "already held". That is correct: they are
   over-refusal guards, and they kill M7.

## Error entries

1. **A harness fault in `q154-r2d1.mjs`:** my row N2 ("a dry run is refused") first ran without `dry_run: true`, so it
   measured an ordinary write. It was caught reading the output, fixed, and re-run on both builds. Only the re-run is in
   evidence.
2. **A crash in `q154-d.mjs`:** A2 wrote the null proof after A1 had removed the by-pid directory (`ENOENT`). Fixed
   (`mkdirSync` first) and re-run on both builds.
3. **My first commit failed:** this machine has no git identity (`Author identity unknown`). I committed with
   `-c user.name/-c user.email` for the repository owner.
4. **Tools:**
   - I tried `python` for one edit, and it is not installed. I used the editor instead.
   - A foreground `sleep 60` to wait for the control suite was **blocked by the harness** ("use run_in_background or
     Monitor"). That is a tool policy, not a permission denial. I did not work around it: I waited for the completion
     notification.
   - `gh run view` from a directory outside the repository failed ("not a git repository"). It was re-run from a
     worktree.
5. **The control full-suite run overlapped an `npm ci`** that I started in the `qat` worktree. That is the likely cause
   of its two 5 s `detach` timeouts. It was not re-run as a whole (the dispatch-era rule is ONE control run). The
   affected file was re-run alone, twice, with the same `TEMP`.
6. **A vacuous comparison, caught:** my first comparison of `c1r2b-scan` output against QA 134's evidence used the
   HOLDS/BROKEN filter I had used for the other scripts. That script prints neither word, so both sides were empty and
   "no difference" meant nothing. It was redone on the full text, with commit SHAs normalised: identical on all four
   builds.
7. The mutant harness labels QA 142's `c3-start.mjs` "NO SUMMARY", because that script prints no `N BROKEN` line. Its
   BROKEN lines are still counted. This is a label, not a failure.

## Open for the planner

None of these blocks the report. Each has my recommendation.

1. **The departure: the registration-time check was not restored.**
   - **Recommendation: accept.** Under T-003 a registration refusal changes no write, because every attributed write
     reads the proof. So restoring the check as a *refusal* would protect nothing.
   - If the early signal is wanted, add a **warning line** to `ob_set_session`'s answer when the proven id is recorded
     under another checkout in `project_dir`'s record. It is a few lines, and it could ride with QA154-1's rows.
2. **QA154-1:** take this seat's rows (`qa/t003-r2-tests` `1f3b6ef`, 5 rows, green on tcm, red on `706c029`) into
   `loop/t003-r2` before merge. **Recommend: yes, at least the two non-handoff rows.** Without them nothing in the suite
   stops a later edit from narrowing the guard to handoff batches.
3. **O-1 (the orphaned handoff)** and **O-3 (the sessionless-file fallback, `end.md` step 3)**: recommend each as a
   task, not this round.
4. **Branches this seat pushed**, through `push-qa.mjs` only:
   - `qa/t003-r2-tests` (`1f3b6ef`);
   - `qa/t003-r2-mut-m6` (`4a2861b`, a mutant: **never merge**);
   - `qa/t003-r2-report`.

   The local merge `fa3ac8a` was not pushed.

QA-154: REPORT COMPLETE
