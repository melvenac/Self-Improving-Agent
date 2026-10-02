# QA 248: Loop 15 slice four, step 4 RE-RUN (the live Jev calls): 13 of 13 answered, close-out regenerated

**By:** the QA seat, QA 248, 2026-10-02 (UTC). Headless Claude Code on Opus, on the laptop (DESKTOP-0GV3HAD). Prefix
`s4-rerun`. **Session id: `a35fcfeb-44f5-4cf7-82b7-2674c0869310`.** **Dispatch:**
`docs/loops/qa-248-s4-step4-rerun-dispatch.md`, on top of `docs/loops/qa-245-s4-step4-dispatch.md`, with D-092
(`docs/loops/qa-245-rulings.md`). **Worktree:** `C:/qa-scratch/qa248-wt`, detached at the launch line's DISPATCH_SHA.
That commit is `origin/master` after `git fetch origin`: the #266 T-220 merge.

```
$ git -C C:/qa-scratch/qa248-wt log -1 --format='%H %cI %s'
460c9a492fe15b88c8cebf845bd99cc322eb519b 2026-10-01T23:27:43-05:00 Merge pull request #266 from melvenac/loop/t220-closeout-labels
```

This was the relaunch. The 04:28Z start was stopped by the launcher before this session began, and this session
neither saw nor used its tree. The ledger shows that start made no call: before this run's first call it held
QA 245's two lines only.

## Headline

- **The new key works.** All 13 primary calls were answered (HTTP 200), each by `jev-1.13.0`. 0 transport failures,
  0 transport retries, 0 `auth`.
- **4.2:** `reject`, on `scope_size 1.98 at confidence 0.96 is at or above the rejecting score 1.5 at or above
  confidence 0.7`. Quoted as the observation, and not re-asked. Under D-076 it does not pause step 4.
- **4.3:** 8 of 8 `G_done` written, all `reject`. Every reject stands on Jev's scores alone, because all eight are below
  `diff_matches_plan_min` and above `touches_out_of_scope_max`.
- **4.4:** 5 of 5 `G_qa` written. `proceed` for #209 and #218, `reject` for #195, #220 and #227. Every fail and every
  untested is on a row that the `E_t` itself marks `unmet`, `partial` or `not_evaluated`.
- **`count-attempts`: 15 attempts (≤ 17), 14 answered.** It exits 1 on one VIOLATION, the new 4.2 record "retrying"
  QA 245's `auth` record. The harness wrote that `retry_of` itself. D-092 ruling 3 decides the case (F5).
- **Key scan: PASS**, 0 matches in all four categories. The transcript category names this session's own `.jsonl` by
  absolute path (K1).
- **Close-out regenerated in place**; `closeout-tables --check` exits 0, and the output has the T-220 line.
- **S4-8 clause 4 stays unmet:** no CI run id was read, because that needs a network call the dispatch does not allow.

## Setup and preflight (no call)

| Step | Result |
| --- | --- |
| `git fetch origin`; `git worktree add --detach C:/qa-scratch/qa248-wt 460c9a49…` | done; HEAD `460c9a49` = `origin/master` |
| key present, by length only (`node -e` printing `k.length>0`) | `key present: true` |
| `npm ci` (in `open-brain/`) | exit 0 (185 packages) |
| `npm run build` | exit 0, `build stamped 460c9a4` |
| `tsc --noEmit` (`npm run typecheck`) | exit 0 |
| `harness count-attempts` before any call | exit 0: `attempts: 1, retries: 0, answered: 0, incomplete: 0` (QA 245's `auth`) |
| `harness plan-gate … --mode dry-run` | exit 0; its record, written beside the brief, was moved to `C:/qa-scratch/qa248-dry` |
| `harness shadow-done … --mode dry-run`, all 8, `--records C:/qa-scratch/qa248-dry` | each exit 0 |
| `harness shadow-qa … --mode dry-run`, all 5, `--records C:/qa-scratch/qa248-dry` | each exit 0 |
| touched harness tests: `t220-closeout-labels.test.ts`, `s4-g6-closeout.test.ts` | exit 0, 2 files, 16 tests passed |

- **One misfire, stated:** the first `count-attempts` went to `open-brain/build/cli.js` instead of
  `build/harness/cli.js`. It printed the top-level usage, exited 1 and touched nothing. The first touched-test run
  also went wrong: `npx vitest` resolved the main checkout as its root, found no test files and exited 1, so no test
  ran. Both logs are kept (`pre-count.*`, `vitest-touched.*`). Each was re-run correctly.
- **Not run:** `t195-plan-gate.test.ts` and `s4-g2-key.test.ts`, which cover `brief-plan-gate.ts`, a file T-220 also
  changed. Neither test file was touched. On a machine holding a live key, a test that inherits the environment could
  make an unledgered call, and the dispatch allows no network call except the gate's. This is LIGHT job class, so no
  full suite was run either.
- **TEMP and TMP:** the launcher set them. The seat did not touch them (amendment 7).
- **Dry-run records** stayed in `C:/qa-scratch/qa248-dry` and are not committed. They are `unavailable`, are not
  counted, and the key scan covers them.

**Inputs resolved by `git`** (`C:/qa-scratch/qa248-tools/resolve.mjs`). Every merge, merged head and QA'd SHA matches
the criteria's Terms table and QA 245's table. Each QA'd SHA is `candidate_git.sha` of the one `E_t` at its branch
tip, and `git merge-base --is-ancestor <QA'd> <merge>^2` holds for all five. Each `E_t` was copied byte-exact to
`C:/qa-scratch/qa248-et/pr-<N>.E_t.json` for `--checks-e-t`. Each copy's blob equals the committed blob: `d20c65ed`,
`d906ca74`, `63afb2c8`, `5d7800cf`, `5facd074`.

## The live run

**Every live call went through `C:/qa-scratch/qa248-tools/gated.mjs`.** Before each call it ran
`harness count-attempts`, refused if the total + 1 would exceed 17, and refused if any `auth` had come back in this
run (ruling 2). Then it made the one call. The stdout, stderr and command line of every command are in
`C:/qa-scratch/qa248-logs/`. The key never appears on a command line: each child inherits the environment.

| # | Item | Command (abridged) | exit | Record | Verdict |
| --- | --- | --- | --- | --- | --- |
| 2 | 4.2 | `plan-gate docs/loops/loop-15-slice-4-brief.D_t.json --mode live` | 1 (reject) | `loop-15-slice-4-brief.G_plan.2026-10-02T04-34-15.660Z.json` | reject |
| 3 | 4.3 #182 | `shadow-done --pr 182 --merge-commit 677c1dd5… --scored-sha 0d44374e… --checks none` | 0 | `pr-182.G_done.2026-10-02T04-34-50.770Z.json` | reject |
| 4 | 4.3 #165 | `… --scored-sha 285a8b2e… --checks none` | 0 | `pr-165.G_done.2026-10-02T04-34-55.855Z.json` | reject |
| 5 | 4.3 #187 | `… --scored-sha c1eda2f6… --checks none` | 0 | `pr-187.G_done.2026-10-02T04-35-00.118Z.json` | reject |
| 6 | 4.3 #195 | `… --scored-sha c3394272… --checks-e-t …/pr-195.E_t.json` | 0 | `pr-195.G_done.2026-10-02T04-35-05.382Z.json` | reject |
| 7 | 4.3 #209 | `… --scored-sha 647cc74e… --checks-e-t …/pr-209.E_t.json` | 0 | `pr-209.G_done.2026-10-02T04-35-09.575Z.json` | reject |
| 8 | 4.3 #227 | `… --scored-sha f172e280… --checks-e-t …/pr-227.E_t.json` | 0 | `pr-227.G_done.2026-10-02T04-35-14.769Z.json` | reject |
| 9 | 4.3 #220 | `… --scored-sha 3059ca9c… --checks-e-t …/pr-220.E_t.json` | 0 | `pr-220.G_done.2026-10-02T04-35-18.999Z.json` | reject |
| 10 | 4.3 #218 | `… --scored-sha e23e6228… --checks-e-t …/pr-218.E_t.json` | 0 | `pr-218.G_done.2026-10-02T04-35-23.862Z.json` | reject |
| 11 | 4.4 #195 | `shadow-qa --pr 195 --branch qa/c-r4-report --commit b43e719b… --path docs/loops/loop-15-slice-3-c-r4-qa-report.E_t.json` | 0 | `pr-195.G_qa.2026-10-02T04-35-29.887Z.json` | reject |
| 12 | 4.4 #209 | `… --branch qa/t195-r2-report --commit 08c4e495… --path docs/loops/t195-r2-qa-report.E_t.json` | 0 | `pr-209.G_qa.2026-10-02T04-35-34.366Z.json` | proceed |
| 13 | 4.4 #227 | `… --branch qa/t198-r2-report --commit 1cc2fe38… --path docs/loops/t198-r2-qa-report.E_t.json` | 0 | `pr-227.G_qa.2026-10-02T04-35-39.376Z.json` | reject |
| 14 | 4.4 #220 | `… --branch qa/t196-r2-report --commit 58a91efa… --path docs/loops/t196-t197-r2-qa-report.E_t.json` | 0 | `pr-220.G_qa.2026-10-02T04-35-43.393Z.json` | reject |
| 15 | 4.4 #218 | `… --branch qa/t158-r2-report --commit ad20f4d3… --path docs/loops/t158-r2-qa-report.E_t.json` | 0 | `pr-218.G_qa.2026-10-02T04-35-47.747Z.json` | proceed |

"#" is the attempt's position in `count-attempts`; number 1 is QA 245's `auth`. Every `--merge-commit` and
`--scored-sha` was passed as the full 40-character SHA. `--base-sha` was left to the runner
(`git merge-base <scored> <merge>^1`), and each record's `base_sha` equals that value recomputed.

### 4.2

- **Record:** `docs/loops/loop-15-slice-4-brief.G_plan.2026-10-02T04-34-15.660Z.json`. `mode: "live"`, `sent: true`,
  `answered_at` 04:34:16.131Z, `model_resolved: "jev-1.13.0"`, `usage` 4,620 in / 129 out, `outcome_class: "answered"`.
- **Verdict, quoted:** `reject`, `scope_size 1.98 at confidence 0.96 is at or above the rejecting score 1.5 at or above
  confidence 0.7`. The other answers are `plan_mode` `mixed` (0.97), `preserves_validated` 0.78,
  `addresses_top_failures` 0.67 and `has_observable_acceptance` 0.77.
- **`attempt: 2`, `retry_of: "docs/loops/loop-15-slice-4-brief.G_plan.2026-10-02T00-47-29.272Z.json"`.** The harness
  set both. See F5.
- Under amendment 4, `validate gate-record` was not run on it. QA 245's record was not opened for writing, edited or
  moved.
- The `brief`, `dt` and `sources` fields are now repo-relative (T-220's F4 clause): `"brief":
  "docs/loops/loop-15-slice-4-brief.md"`.

### 4.3 and 4.4

All 13 records: `mode: "live"`, `sent: true`, `outcome_class: "answered"`, `attempt: 1`, `retry_of: null`,
`model_resolved: "jev-1.13.0"`, `source: "seat"`, `plan_provenance: "reconstructed-after"` and `runtime_action:
"shadow: recorded only; no outcome was changed"`. `harness validate gate-record` exits 0 on each of the 13; the
logs are `validate-*.cmd`. Verdicts, reasons and the three groupings are in the close-out.

## Rows scored at the close-out

| Row | Result | Evidence |
| --- | --- | --- |
| S4-2.1 one live plan record beside the brief | **met, read with ruling 3** | One **answered** live `G_plan`. QA 245's unanswered `auth` record also sits beside the brief, so two live `G_plan` files exist. Ruling 3 counts the new one as a fresh attempt, not a re-roll. The row's literal "exactly one" is the planner's to read |
| S4-2.2 `sent: true`, answer with five ids, usage, `model_resolved` ≥ `jev-1.13.0` | **met** | `sent: true`, `answered_at` set. Answer ids equal `PLAN_GATE_QUESTIONS` (`addresses_top_failures`, `has_observable_acceptance`, `plan_mode`, `preserves_validated`, `scope_size`). `usage` 4620/129. `jevModelAtLeast("jev-1.13.0")` = true |
| S4-2.3 under `docs/**`, not ignored; `policy_hash` = sha256 of `plan-gate.json` at base | **met** | `git check-ignore` exit 1, empty. sha256 of `ec7138bb:…/plan-gate.json` = `57cc12ff…a176279` = the record's |
| S4-2.4 the first answer is the observation | **met** | the reject is quoted above; no second call on the plan subject |
| S4-3a.2 authenticated 200; every `model_resolved` passes | **met** | 14 answered records, all `jev-1.13.0`. Comparator on the build: `jev-1.13.0` true; `jev-1.12.9`, `jev-1.9.0`, `jev-latest` and `null` false. No two models differ |
| S4-3b.2 key scan | **met** | see "The key scan" below |
| S4-4.1 eight live `G_done`, no duplicate | **met** | 8, one per Terms-table row; `count-attempts` lists one per subject |
| S4-4.3 `pr`, `merge_commit`, `scored_sha`, `base_sha`; `D_t` by path and blob | **met** | each present. `base_sha` = `git merge-base scored merge^1` recomputed, 8 of 8. `dt.blob` = the blob of `dt.path` in the tree, 8 of 8 |
| S4-4.4 diffstat from base..scored; `checks_source`; `checksPassed: false` when none | **met** | `checks_source` is `"none"` for #182, #165 and #187, with `checks_passed: false`, and `E_t:<path>@<blob>` for the five. Jev is not asked about tests. The reason text is inaccurate for `none` (F6) |
| S4-4.5 `runtime_action` changes nothing | **met** | `"shadow: recorded only; no outcome was changed"` on all 13 |
| S4-4a.3 validator over every record, exit codes quoted | **met** | 13 × exit 0 |
| S4-4a.6 `seat` / `reconstructed-after` on all live records | **met** | 13 of 13 |
| S4-5a tables generated; N, SHAs, spread; label computed | **met** | `closeout-tables` exit 0; `--check docs/loops/loop-15-slice-4-closeout.md` exit 0. Labels `PROVISIONAL (N=8 seat-built, 0 runtime)` and `PROVISIONAL (N=5 seat-built, 0 runtime)`. Every threshold row has N, per-diff values, min, max and each side. `E_t source: the criteria Terms table (8 rows).` is present. The diffs table now says `scored` for the five with an `E_t`, which is T-220's fix of F2. On the 4.4 SHA column, see F8 |
| S4-5b forbidden word | **met, with ruling 6** | Close-out 0, ledger 0, all 13 `G_done`/`G_qa`/`E_t` copies 0. The new `G_plan` has 4 whole-word lines, all inside `request` (the quoted brief and `D_t`) and 0 outside it, the same as QA 245's (F3). Ruling 6 holds the copy covered by the path exclusion |
| S4-5c.1 and .3 threshold files unchanged | **met (guard)** | `git diff --exit-code ec7138bb 460c9a49` over the three policy files exits 0. `merge.json` has `require_plan_gate: false` and `require_done_gate: false` |
| S4-5c.2 `policy_hash` on every record | **met** | every `G_done` carries sha256 of `developer-done.json` at `ec7138bb` (`91ca0b03…`). Every `G_qa` carries sha256 of `qa-score.json` (`56d11a94…`) |
| S4-6b.1 to .3 per-requirement shape, untested by code, one call each | **met** | Each `G_qa` holds `results[]` (pass, fail or untested, with `decided_by`), a severity on each fail, and `regression_of_validated` and `artifact_complete_enough_to_stop`. 5 rows are `untested` with `decided_by: "code"`, each on a `not_evaluated` `E_t` row. `missing` is empty. One request per diff (5 calls for 5 diffs) |
| S4-6b.4 no call for A, B part 1, B part 2 | **met** | no `G_qa` and no 4.4 ledger line for #182, #165 or #187. The generated table says `not scored: no E_t` for exactly those three |
| S4-6c.1 `G_qa` beside an `E_t` copy, with `e_t_ref` | **met** | `pr-<N>.E_t.json` beside each `G_qa`. Copy blob = `e_t_ref.blob` = the blob at the `qa/*` commit, 5 of 5 |
| S4-6c.3 the `E_t` and its report unchanged | **met** | the originals live on `qa/*` branches, which this run did not write. Each blob at its commit equals `e_t_ref.blob` |
| S4-7a count from the records, ≤ 20, write-ahead | **met** | 15 attempts, 0 incomplete. The ledger has 30 lines, and every `begin` precedes its `end` and its record's `answered_at` (15 of 15) |
| S4-7b no re-roll; retries ≤ 3 | **met, read with ruling 3** | ≤ 1 answered record per subject. 0 transport retries. The counter's `retries: 1` and its one VIOLATION are the 4.2 record linked by the harness to QA 245's `auth` (F5) |
| S4-8.2 the run postdates F11, by ancestry | **met (guard)** | `git merge-base --is-ancestor 3b192871 460c9a49` exit 0. The `LOOP_LIMITS` declaration is byte-identical at `ec7138bb` and `460c9a49` (1,896 chars, compared by script) |
| S4-8.4 the close-out quotes the first green run id, `head_sha`, `created_at` | **unmet** | no run id was read: that needs a network call outside the gate. The F11 commit is named |

## The key scan (S4-3b.2)

The script is `docs/loops/qa-248/key-scan.mjs`, committed on this branch. It is QA 245's scan, changed for K1. It
reads `TYPESAFE_API_KEY` from its own environment and prints only counts and **absolute** paths. First it writes the
key to a temp file in `C:/qa-tmp`, requires exactly 1 hit, and deletes the file.

**How the transcript is found (K1).** QA 245's scan picked "the newest `.jsonl` that names the worktree". This one
does not guess:

- it takes `--session a35fcfeb-44f5-4cf7-82b7-2674c0869310` and a marker string that this session printed once,
  from a random nonce generated in this session;
- it walks every `.jsonl` under `C:/Users/Aaron/.claude/projects`;
- it requires exactly one file to hold the marker, and that file must be
  `C:/Users/Aaron/.claude/projects/C--Users-Aaron-Worktrees-sia-qa/a35fcfeb-44f5-4cf7-82b7-2674c0869310.jsonl`.

Any other result leaves the transcript category empty, and the scan then fails. The slug is the main checkout's
because this session's working directory is `C:\Users\Aaron\Worktrees\sia-qa`. The run itself worked in
`C:/qa-scratch/qa248-wt` through absolute paths. That is the mismatch K1 found in QA 245's search.

The four categories:

1. every live gate record, `E_t` copy and the ledger, plus the dry-run records;
2. every file in `C:/qa-scratch/qa248-logs`: the stdout, stderr and command line of every harness command, `npm ci`,
   the build, `tsc` and the touched tests;
3. the close-out, this report and its `.E_t.json`;
4. this session's transcript.

```
$ node docs/loops/qa-248/key-scan.mjs --session a35fcfeb-44f5-4cf7-82b7-2674c0869310 --marker <this session's nonce>   (exit 0)
known positive: 1 hit(s) on a temp file (expected 1); temp file deleted: true
transcript: session a35fcfeb-44f5-4cf7-82b7-2674c0869310; expected C:/Users/Aaron/.claude/projects/C--Users-Aaron-Worktrees-sia-qa/a35fcfeb-44f5-4cf7-82b7-2674c0869310.jsonl; exists true
transcript: .jsonl files under C:/Users/Aaron/.claude/projects holding the marker: 1 (C:/Users/Aaron/.claude/projects/C--Users-Aaron-Worktrees-sia-qa/a35fcfeb-44f5-4cf7-82b7-2674c0869310.jsonl)
transcript: the one marked file is the session's own: true
gate records, E_t copies and the attempts ledger (live), and the dry-run records: files scanned 40, matches 0
  [40 absolute paths: the ledger, 13 live G_done/G_qa, 5 E_t copies, 2 live G_plan, 19 dry-run files]
the run's captured stdout and stderr (every harness command, npm ci, build, tsc): files scanned 209, matches 0
  [209 absolute paths under C:/qa-scratch/qa248-logs/]
the close-out and this report: files scanned 3, matches 0
  C:/qa-scratch/qa248-wt/docs/loops/loop-15-slice-4-closeout.md
  C:/qa-scratch/qa248-wt/docs/loops/loop-15-slice-4-step4-rerun-qa-report.md
  C:/qa-scratch/qa248-wt/docs/loops/loop-15-slice-4-step4-rerun-qa-report.E_t.json
this session's transcript (.jsonl): files scanned 1, matches 0
  C:/Users/Aaron/.claude/projects/C--Users-Aaron-Worktrees-sia-qa/a35fcfeb-44f5-4cf7-82b7-2674c0869310.jsonl
key-scan: total matches 0; every category scanned at least one file: true; PASS
```

The two bracketed lines stand for path lists that are left out here; the committed `.out` holds every path.
**S4-3b.2: met.** There are 0 matches, and every category scanned at least one file. The transcript category
scanned exactly
`C:/Users/Aaron/.claude/projects/C--Users-Aaron-Worktrees-sia-qa/a35fcfeb-44f5-4cf7-82b7-2674c0869310.jsonl`,
which is this session's own file (session `a35fcfeb-44f5-4cf7-82b7-2674c0869310`).

The output quoted above is the run made while this report was a draft. The same script was run again after this
report, its `E_t` and the close-out were final. That last run's full output, with every path scanned, is committed
as `docs/loops/qa-248/key-scan.out`. The transcript keeps growing after any scan, so its last lines (the commit, the
push and this session's final message) come after the last scan.

## Findings for the planner

- **F5. `plan-gate` links a new attempt to an earlier `auth` record, and `count-attempts` then flags it.** The new
  4.2 record carries `attempt: 2` and `retry_of` = QA 245's `auth` record. The seat passed no flag for this: the
  runner found the earlier record for the same subject and chained it. S4-7b.3 says `auth` is not retryable, so
  `count-attempts` reports `VIOLATION: … retries … whose outcome is auth` and exits 1 on every run after the call.
  The dispatch expected the opposite form ("a second record … with no `retry_of`"). Ruling 3 decides the case either
  way: QA 245's record has no answer, so this is not a re-roll, and nothing was edited. As a consequence,
  `count-attempts` cannot exit 0 on the slice's records as they stand, and its `retries: 1` counts an attempt that
  is not a transport retry. A later diff could record a fresh attempt after a non-retryable outcome without
  `retry_of`, or teach the counter ruling 3.
- **F6. The done-gate's reason text says checks "failed (read from process exit codes)" when none exist.** For #182,
  #165 and #187 (`checks_source: "none"`), `decision.reasons` includes `the deterministic checks failed (read from
  process exit codes, not from the gate)`. No exit code was read. The fields `checks_source: "none"` and
  `checks_passed: false` are right, and S4-4.4's "labelled as such" is met by them. Only the sentence is wrong. It
  changes no verdict here.
- **F7. `checks_source` still holds a machine path.** T-220 made the `G_plan` paths repo-relative. The `G_done`
  `checks_source` is still `E_t:C:/qa-scratch/qa248-et/pr-195.E_t.json@d20c65ed…`, because `--checks-e-t` takes a
  local file and the CLI resolves it. The blob identifies the `E_t`, so this is harmless, but the record names a
  scratch path that exists on one laptop only.
- **F8. The 4.4 table's "scored SHA" column holds the `qa/*` commit that carries the `E_t`** (`b43e719b`, `08c4e495`
  and so on), not the QA'd candidate (`candidate_git.sha`: `c3394272`, `647cc74e`, …). Both identify the subject:
  `e_t_ref` names the commit, path and blob. S4-5a asks for "the scored SHAs", and a reader comparing 4.3 and 4.4 rows
  for one diff sees two different SHAs. A naming question for the planner, not a defect in what was scored.
- **F9 (cosmetic).** Pointed at any directory other than the slice's records directory, `closeout-tables` prints
  `E_t source: none (the criteria Terms table was not readable…)` and an empty diffs table. This showed up only for
  the per-group scratch runs, which the close-out quotes for their 4.3 sections alone.
- **F3, again:** the new `G_plan` copies the forbidden word inside `request`, as QA 245 found. Ruling 6 covers it.

## What this run did not do

- No call beyond the 13. No retry. No CI run, issue, PR or comment.
- No full `vitest run` (LIGHT job class). `t195-plan-gate` and `s4-g2-key` were not run (see Setup).
- No network call except `git fetch`, `git ls-remote` on `qa/s4-rerun-*` (it listed nothing), the 13 gate calls and
  the push.
- No policy file and no verdict was changed. QA 245's record, report and ledger lines were not edited. The live
  `.agents/state.json`, the knowledge DB and the settings files were not written. `plan-gate` reads the tracked
  `.agents/state.json`.

## Open for the planner

1. **F5:** rule whether `count-attempts`' exit 1 on the 4.2 link is accepted under ruling 3 as it stands, or whether
   a diff should make the counter, or the runner's `retry_of`, express that ruling.
2. **S4-2.1's "exactly one live record":** two live `G_plan` files sit beside the brief, one unanswered (`auth`) and
   one answered. Read with ruling 3 above. Confirm.
3. **S4-8.4:** the CI run id, `head_sha` and `created_at` still need someone allowed to read them.
4. **F6 to F9:** small; for a later diff if wanted.

## Committed on `qa/s4-rerun-report`

- `docs/loops/loop-15-slice-4-brief.G_plan.2026-10-02T04-34-15.660Z.json` (4.2)
- `docs/loops/loop-15-slice-4-records/pr-<N>.G_done.*.json` × 8, `pr-<N>.G_qa.*.json` × 5 and `pr-<N>.E_t.json` × 5
- `docs/loops/loop-15-slice-4-records/attempts.jsonl` (QA 245's 2 lines, unchanged, plus 28 new)
- `docs/loops/loop-15-slice-4-closeout.md` (regenerated in place)
- `docs/loops/qa-248/key-scan.mjs` and `docs/loops/qa-248/key-scan.out`
- `docs/loops/loop-15-slice-4-step4-rerun-qa-report.md` and `.E_t.json`

QA-248: REPORT COMPLETE
