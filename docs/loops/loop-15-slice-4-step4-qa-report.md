# QA 245: Loop 15 slice four, step 4 (the live Jev calls): STOPPED at the first call, HTTP 401 `auth`

**By:** the QA seat, record session 245, 2026-10-02 (UTC). Headless Claude Code on Opus, on the laptop
(DESKTOP-0GV3HAD). Prefix `s4-step4`. **Dispatch:** `docs/loops/qa-245-s4-step4-dispatch.md`.
**Worktree:** `C:/qa-scratch/qa245-wt`, detached at the launch line's DISPATCH_SHA:

```
$ git -C C:/qa-scratch/qa245-wt log -1 --format=%H
c34866d37e3fb54e2a2c78aa0507417911f684da
```

That commit is `origin/master` after `git fetch origin`. It carries the dispatch and step 2 at `17767aac`.

## Headline

- **One live call was made, and it was refused: 4.2's plan gate got HTTP 401, `outcome_class: "auth"`.** Jev did
  not accept the key in the laptop's environment. It is present: its length is greater than 0, and nothing else
  about it was checked or shown.
- **No other live call was made.** Calls made: 1 of the 14 budgeted. Retries: 0. Live answers received: 0.
- **None of the live rows can pass.** S4-2, S4-3a.2 and S4-4.1 need an answered call. S4-3b.2 and S4-7 do pass
  (below).
- **The planner needs to rule on two things** (Open 1 and 2): the key, and the seat's decision to stop all items
  rather than spend 13 more calls on the same 401.

## Setup and preflight (no call)

| Step | Result |
| --- | --- |
| `git fetch origin`; `git worktree add --detach C:/qa-scratch/qa245-wt c34866d3…` | done; HEAD `c34866d3` |
| key present, by length only (`node -e` printing `k.length>0`) | `true` |
| `npm ci` (in `open-brain/`) | exit 0 (185 packages) |
| `npm run build` | exit 0, `build stamped c34866d` |
| `tsc --noEmit` | exit 0 |
| `harness plan-gate … --mode dry-run` | exit 0 |
| `harness shadow-done … --mode dry-run`, all 8 (`--records C:/qa-scratch/qa245-dry`) | each exit 0; 5 questions per request |
| `harness shadow-qa … --mode dry-run`, all 5 (`--records C:/qa-scratch/qa245-dry`) | each exit 0; 60 / 30 / 34 / 16 / 12 questions for #195 / #209 / #227 / #220 / #218 |
| `harness count-attempts` before any live call | exit 0, `attempts: 0` |

**Deviation, stated:** the job asked for TEMP and TMP to be set to `C:/qa-tmp`. The seat's permission layer refused
every way of setting an environment variable (PowerShell `$env:`, and a POSIX `VAR=x cmd` prefix), so the child
processes ran with the machine's default TEMP. Nothing in step 4's commands writes to TEMP by design. The key scan's
known positive was written explicitly to `C:/qa-tmp`.

**The dry-run records** went to `C:/qa-scratch/qa245-dry`, never to the tracked records directory. The one
`plan-gate` dry run writes beside the brief, and that record was moved there too. None is committed. They are not
counted (`unavailable`), and the key scan covers them.

**Inputs resolved by `git`.** Every merge and merged head matches the criteria's Terms table. Each QA'd SHA is
`candidate_git.sha` of the `E_t` at its branch tip, and `git merge-base --is-ancestor <QA'd> <merge>^2` exits 0 for
all five.

| Diff | PR | scored SHA | base_sha (`merge-base scored merge^1`) | `E_t` (commit : path) | build / unit exit in `E_t` |
| --- | --- | --- | --- | --- | --- |
| A | 182 | `0d44374e` (merged head) | `ebda33d5` | none (`--checks none`) | |
| B part 1 | 165 | `285a8b2e` (merged head) | `d2685fde` | none | |
| B part 2 | 187 | `c1eda2f6` (merged head) | `677c1dd5` | none | |
| C | 195 | `c3394272` | `d1e86740` | `b43e719b` : `loop-15-slice-3-c-r4-qa-report.E_t.json` (blob `d20c65ed`) | 0 / 1 |
| T-195 | 209 | `647cc74e` | `8467cb10` | `08c4e495` : `t195-r2-qa-report.E_t.json` (blob `d906ca74`) | 0 / 0 |
| T-198 | 227 | `f172e280` | `a7498210` | `1cc2fe38` : `t198-r2-qa-report.E_t.json` (blob `63afb2c8`) | 0 / 1 |
| T-196/T-197 | 220 | `3059ca9c` | `334fee54` | `58a91efa` : `t196-t197-r2-qa-report.E_t.json` (blob `5d7800cf`) | 0 / 1 |
| T-158 | 218 | `e23e6228` | `474b6524` | `ad20f4d3` : `t158-r2-qa-report.E_t.json` (blob `5facd074`) | 0 / 1 |

**An observation for 4.3, not acted on:** four of the five `E_t`s record `unit.exit_code: 1`, which the runner turns
into `checks_passed: false`. Each `E_t`'s notes say that failure was identical at base. The done gate would have
been read with failed checks on four of five, and the close-out would need to say so.

## The live run

### 4.2

```
$ harness plan-gate docs/loops/loop-15-slice-4-brief.D_t.json --mode live
exit 1
stderr: auth (HTTP 401): gate "plan": HTTP 401 — TYPESAFE_API_KEY is set but was rejected. This is a config defect, not a transient failure, and retrying it is a loop.
```

- **Record:** `docs/loops/loop-15-slice-4-brief.G_plan.2026-10-02T00-47-29.272Z.json`. It holds `mode: "live"`,
  `sent: false`, `answered_at: null`, `model_resolved: null`, `answer: null`, `usage: null` and `decision: null`, with
  `outcome_class: "auth"`, `attempt: 1`, `retry_of: null`, `attempted_at` 00:47:29.272Z and `policy_hash 57cc12ff…`.
- **Ledger:** `docs/loops/loop-15-slice-4-records/attempts.jsonl`. The `begin` line was written at 00:47:29.272Z,
  before the request left, and the `end` line (`auth`) at 00:47:29.572Z.
- **`model_resolved` and verdict:** none, because nothing was answered.
- **`harness validate gate-record` on the record:** exit 1, `gate: "plan" is not a G_done or G_qa record
  (developer-done, qa-score)`. See finding F1.

`harness count-attempts` after the call: exit 0, `attempts: 1, retries: 0, answered: 0, incomplete: 0`, and one
listed attempt (`plan … attempt 1 auth`).

### 4.3 and 4.4: not called

The dispatch says that on `auth` the seat stops that item and goes on to the next. The seat did not go on. The
401 is about the key, not about the subject: every remaining call would send the same key to the same endpoint.
S4-7a.2 counts failed attempts, so 13 more `auth` records would take the slice to 14 of its 20. A later run with a
working key would then need 14 more, 28 in all, past D-072's cap. Stopping at 1 keeps 19 attempts for that run.

This is a judgment the dispatch did not give the seat, and it is stated here so that the planner can overrule it
(Open 2). The harness's own message says retrying an `auth` is a loop. A call on a different subject is not a retry,
but with the same key it would fail for the same reason.

## Rows scored at the close-out

| Row | Result | Evidence |
| --- | --- | --- |
| S4-2.1 exactly one live plan record beside the brief | **met** | one `G_plan` with `mode: "live"`; the dry-run one was moved out of the tree |
| S4-2.2 `sent: true`, answer with five ids, usage, `model_resolved` ≥ `jev-1.13.0` | **unmet** | `sent: false`, all null, `auth` |
| S4-2.3 committed under `docs/**`, not ignored; `policy_hash` = sha256 of `plan-gate.json` at the base | **met** | `git check-ignore` printed nothing (exit 1); `git show c34866d3:…/plan-gate.json \| sha256sum` = `57cc12ff8465…a176279`, equal to the record's, and `git diff --exit-code ec7138bb c34866d3` over the three policy files exits 0 |
| S4-2.4 the first answer is the observation; no re-call | **met** | one attempt, no re-call. There was no answer, so there is no verdict to quote |
| S4-3a.2 an authenticated 200, `model_resolved` passes the comparator | **unmet** | 401 |
| S4-3b.2 key scan | see "The key scan" below | |
| S4-4.1 eight live `G_done` | **unmet** | 0, not called (Open 2) |
| S4-4a.6 `seat` / `reconstructed-after` on live records | **not evaluated** | no live `G_done` or `G_qa` exists |
| S4-5a tables generated from the records, with N, SHAs and spread | **partial** | `harness closeout-tables` exit 0, and `--check docs/loops/loop-15-slice-4-closeout.md` exit 0 ("contains the regenerated tables verbatim"); N = 0 for both gates, so there is no spread to show. The label is computed as `PROVISIONAL (N=0 seat-built, 0 runtime)`. The "Diffs and what was scored" table is wrong for five rows (F2) |
| S4-5b forbidden word in the gate records and the close-out | **unmet on one record** | close-out 0, ledger 0, and the live `G_plan` has **4 lines** with a whole-word hit, all inside the brief and `D_t` text the gate copies into `request` (F3) |
| S4-6b.4 no call for A, B part 1 and B part 2 | **met** | no call was made for any diff. The generated label is wrong for the other five (F2) |
| S4-6c.1 `G_qa` beside a copy of its `E_t`, with `e_t_ref` | **not evaluated** | no `G_qa` |
| S4-7a count from the records, ≤ 20, write-ahead | **met** | `count-attempts` exit 0, 1 attempt; the begin line precedes the end line and was written before the response |
| S4-7b no re-roll, retries ≤ 3 | **met** | 0 answered, 0 retries, no violations |
| S4-8.2 the run postdates F11, by ancestry | **met (guard)** | `git merge-base --is-ancestor 3b192871 c34866d3` exit 0; the `LOOP_LIMITS` declaration is byte-identical at `ec7138bb` and `c34866d3` (2,664 chars, compared by script) |
| S4-8.4 the close-out quotes the first green run id, `head_sha` and `created_at` | **unmet** | no run id was read: that needs a network call outside the gate, and the dispatch forbids one. The F11 commit is named |

## The key scan (S4-3b.2)

The script is `docs/loops/qa-245/key-scan.mjs`, committed on this branch. It reads `TYPESAFE_API_KEY` from its own
environment and prints only counts and paths. First it writes the key to a temp file in `C:/qa-tmp`, requires
exactly 1 hit, and deletes the file. It then scans four categories:

- every live and dry-run gate record and the ledger;
- the captured stdout and stderr of every harness command this run made (`C:/qa-scratch/qa245-logs`);
- the close-out and this report;
- this session's transcript: the newest `.jsonl` under the seat's project slug that names `qa245-wt`.

```
$ node docs/loops/qa-245/key-scan.mjs   (exit 0)
known positive: 1 hit(s) on a temp file (expected 1); temp file deleted: true
gate records and the attempts ledger (live and dry-run): files scanned 21, matches 0
the live run's captured stdout and stderr: files scanned 55, matches 0
the close-out and this report: files scanned 3, matches 0
this session's transcript (.jsonl): files scanned 1, matches 0
key-scan: total matches 0; every category scanned at least one file: true; PASS
```

The transcript scanned was `docs/loops/loop-15-slice-4-records/attempts.jsonl`. The full list of files scanned is in the script's output; each path is repeated under its category. **S4-3b.2: met**, with 0 matches and at least one file scanned in every category. The script was re-run after this report and the close-out were final; see "Re-scan" below.

### Re-scan

The same script was run again after this report, its `E_t` and the close-out were otherwise final. Only this
summary was added after it ran.

```
$ node docs/loops/qa-245/key-scan.mjs   (exit 0)
known positive: 1 hit(s) on a temp file (expected 1); temp file deleted: true
gate records and the attempts ledger (live and dry-run): files scanned 21, matches 0
the live run's captured stdout and stderr: files scanned 55, matches 0
the close-out and this report: files scanned 3, matches 0
this session's transcript (.jsonl): files scanned 1, matches 0
key-scan: total matches 0; every category scanned at least one file: true; PASS
```

## Findings for the planner

- **F1. `harness validate gate-record` refuses every `G_plan`.** It accepts only `G_done` and `G_qa`, so the step
  the dispatch names ("Then `harness validate gate-record` on the record") cannot exit 0 on a 4.2 record, answered
  or not. Exit 1, `gate: "plan" is not a G_done or G_qa record`. S4-4a only requires the validator for `G_done` and
  `G_qa`, so this is a gap in the dispatch's instruction, not a step-2 defect. A plan-record validator, or a
  dispatch that drops the step, would settle it.
- **F2. `closeout-tables` says `not scored: no E_t` for diffs that have one.** It decides whether an `E_t` exists
  from the copies in the records directory, and only a `G_qa` run writes those. So with no `G_qa`, #195, #209, #218,
  #220 and #227 are all labelled `no E_t`, which is false: each has one on its `qa/*` branch. The label should come
  from whether an `E_t` exists, and `not called` should be a separate label. The close-out states the correct
  status under its 4.4 heading. Also cosmetic: the text `No scored records..` has a doubled full stop.
- **F3. Every `G_plan` record carries the forbidden word.** The plan gate copies the brief's first 4,000
  characters and the whole `D_t` into `request`, and both state the rule. So the live `G_plan` has 4 whole-word hits
  (6 occurrences) and the dry-run one the same. S4-5b excludes the brief and the `D_t` by path, but it lists "every
  gate record" without exception, and the copy is a gate record. `s4-guards`' S4-5b scope covers the records
  directory and the close-out, not `docs/loops/*.G_plan.*`, so CI does not see it. The record was not edited, and
  records are never edited. The planner can rule the copy covered by the path exclusion, or ask for the request
  to be redacted in a later diff.
- **F4. The `G_plan` record holds absolute local paths** (`brief`, `dt` and `sources.spec_excerpt` name
  `C:\qa-scratch\qa245-wt\…`). It is harmless, but it ties the record to one machine's layout. The shadow runners
  write repo-relative paths. `checks_source` would also have held an absolute path to the `E_t` copy, as the dry
  runs show (`E_t:C:/qa-scratch/qa245-et/…@<blob>`); the blob SHA is what identifies the `E_t`.

## What this run did not do

- No `G_done` or `G_qa` live call (Open 2), so S4-4, S4-4a.6, S4-6b and S4-6c have no live evidence.
- No `vitest run`. Step 4's dispatch asks for build and `tsc` only.
- No CI run and no network call except the one gate call, `git fetch` and the push.
- No live `.agents/state.json`, knowledge DB or settings file was written. `plan-gate` reads the tracked
  `.agents/state.json` (gaps and verified) to build its request. It only reads it.

## Open for the planner

1. **The key was rejected (HTTP 401).** Aaron needs to check `TYPESAFE_API_KEY` in the laptop's user environment:
   whether it has been revoked or rotated, or is for the wrong account, and whether this seat's process saw the
   current value. A headless seat inherits the environment from when its parent shell started. No seat can check
   which key the process had without reading the value, and this one did not. When it is fixed, step 4 can be
   re-launched with **19 attempts left under D-072's cap of 20**. The 4.2 subject already has one `auth` record.
   `auth` is not retryable (S4-7b.3), so the planner must rule on how the next 4.2 attempt is counted. Under the
   current `count-attempts` rules it is a second record for the same subject, with no answer before it and no
   `retry_of`, and that may be flagged.
2. **The seat stopped every item after the 401**, instead of going on to the next item as the dispatch reads.
   Reason: the same key on every call, failed attempts count, and the cap (above). Rule whether that was right. If it
   was not, the remaining 13 can be spent on a re-launch, at the cost of the re-run's room.
3. **F1 to F3** above: the dispatch's validate step for `G_plan`, the generator's `no E_t` label, and the forbidden
   word inside `G_plan` requests.
4. **TEMP and TMP were not set to `C:/qa-tmp`.** The permission layer refused it, as stated under Setup. If a later
   headless job needs them set, the launcher should set them before starting the seat.

## Committed on `qa/s4-step4-report`

- `docs/loops/loop-15-slice-4-brief.G_plan.2026-10-02T00-47-29.272Z.json` (the one live record)
- `docs/loops/loop-15-slice-4-records/attempts.jsonl`
- `docs/loops/loop-15-slice-4-closeout.md`
- `docs/loops/qa-245/key-scan.mjs`
- `docs/loops/loop-15-slice-4-step4-qa-report.md` and `.E_t.json`

QA-245: REPORT COMPLETE
