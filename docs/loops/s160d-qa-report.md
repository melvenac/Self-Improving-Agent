# QA 269 report: session-160 batch d (#397 r2 narrow, #401, #402, #404)

**By:** QA 269 (headless Claude Code, Opus), record session 160, 2026-10-03 (UTC 2026-10-04).
**Dispatch:** `docs/loops/qa-269-s160d-dispatch.md`. **Dispatch tree:** `git -C ~/qa-scratch/qa269-wt log -1 --format=%H` =
`617d0f80a8ba37005f58281ecd3ec5996a031cd6`.
**Job class:** LIGHT. One test file per vitest run, no full suite, no live Jev call, `gh` used read-only.

## Verdicts

| PR | Pinned head | Verdict |
|---|---|---|
| #397 (T-237 r2, narrow) | `9ea9f54a6e81ad3f465f56bf92243f3f129ceeba` | **ACCEPT** (F1 fixed, the class row is red on the old bound and green at the head) |
| #401 (T-236 c, FOCUS + SEATS) | `c3ee949b8e6e6a45a2758af61c7d6bafd8ca8ce0` | **ACCEPT** |
| #402 (T-199 A, missing-handoff notice) | `3212ed69a87bf3bbfad5f933691bc457b3435a13` | **ACCEPT** (gap G1: one not-checked reason is correct at the head but no committed row pins it) |
| #404 (T-204 machine lease, port) | `5add91379641ef211f98b2f79d1551c0090821eb` | **INCOMPLETE**: rows 1, 4 and 13 met; rows 14 and 15 (the PowerShell harness and its mutants) **not run**, because this QA host is Linux with no PowerShell, and the helper is Windows-only |
| Batch | ef57c10c + #397 + #404 + #402 + #401 = `9cf6abc8` (local only) | **INCOMPLETE** (because of #404). The merge itself resolves as ruled and is green on every TypeScript row |

All four heads were unmoved at the start and again at the end (`gh pr view`: `headRefOid` equals the pin, all OPEN; #401
and #402 are now based on `master`). Master is `617d0f80`. Since `ef57c10c` it differs only in `.agents/` views, the state
record and `docs/loops/qa-269*`: **no `open-brain/` or `CHANGELOG.md` change.** So `ef57c10c` is the right base for the red
runs and the batch.

**Nothing here is a REJECT.** The overall verdict is INCOMPLETE only because #404's harness needs a Windows host. #397,
#401 and #402 can be judged on their own.

## Trees

| Tree | Commit | Use |
|---|---|---|
| `qa269-wt` | `617d0f80` | dispatch, report |
| `qa269-pr397` / `pr401` / `pr402` / `pr404` | the four pins | green runs, mutants |
| `qa269-base397` | `3e95016c` (#397 r1, the bound QA 268 rejected) | row 5 red run |
| `qa269-base401`, `qa269-base402`, `qa269-base404` | `ef57c10c` (master's source) | red runs, O1 master dump |
| `qa269-merge` | `ef57c10c` → `d7683b47` (#397) → `54f36b31` (#404) → `3e79a134` (#402) → `9cf6abc8` (#401, hand-resolved) | row 16 |

**npm:** `npm ci` was run in each TypeScript tree. Symlinking one `node_modules` needed approval, so I didn't. `npm`
reported that the install scripts of better-sqlite3 and the two esbuild packages were not run under `allowScripts`;
vitest and tsc ran regardless, as in QA 267 and 268.

**TMPDIR:** not set. Under this permission layer every command with a variable expansion or environment prefix needs
approval (QA 267 and 268 hit the same thing). The tests made their fixtures with `mkdtemp` under the OS tmpdir and removed
them in their own `afterEach`/`afterAll`. My one build went to `~/qa-tmp/qa269-build`, and the O1 dumps to `~/qa-tmp`.
Nothing was written outside the scratch trees, `~/qa-tmp` and the OS tmpdir. No live state.json, knowledge DB (vitest's
`setup-env.ts` points `KNOWLEDGE_V2_DB` at a temp dir) or settings file was touched.

## Row 1: confined (all four PRs)

`git diff --stat origin/master...<pin>`:

- **#397**, 4 files: `CHANGELOG.md`, `session-start/hub-presence.ts`, `tests/.../hub-presence.test.ts` and
  `tests/pipelines/sync/greeting-size.test.ts`. **`greeting-size.test.ts` is the one file beyond the original three**, as
  the planner ruled. Commits beyond master: `d4507be6`, `3e95016c` (r1), `e14593ba` (merge of master `bbc2acbf`),
  `783cdc14` (test), `9ea9f54a` (fix). `git show --remerge-diff e14593ba` is empty: the merge has no hand edits.
- **#401**, 14 files, all in T-236 (c): `greeting.json` (+`briefing_focus: true`, sorted), `CHANGELOG.md`, `briefing.ts`,
  the new `focus.ts`, `hub-presence.ts` (+`statusByHubName`), `sync/index.ts`, the new `sync/task-assignees.ts`,
  `server.ts`, `state-schema.ts` (+`assignee`, +KEY_ORDER), `state-writer.ts` and four test files. Nothing outside the task.
- **#402**, 9 files, all in T-199 (A): `greeting.json` (+`missing_handoff: true`, sorted), `CHANGELOG.md`,
  `docs/loops/t199-port-developer-handoff.md`, `briefing.ts`, `greeting-flags.ts` (a doc comment only), `state-render.ts`,
  `server.ts`, `briefing-budget.test.ts` (+1 row) and the new `missing-handoff.test.ts`. Nothing outside the task.
- **#404**, 6 files, all under `docs/loops/`: `machine-lease.ps1` and `machine-lease-harness.ps1` (new), `qa-queue.ps1`,
  `qa-launch.md` (+8/−5), `t204-developer-handoff.md` and `t204-plan.md`. No TypeScript. Its merge-base is `169956b8`,
  older than the other three's `bbc2acbf`; that is fine, since master since then touches none of these files (row 13).

## Row 4: CI, read only (all four)

`gh pr checks <n>`:

| PR | `test` | Run | Matches dispatch |
|---|---|---|---|
| #397 | pass (2m4s) | 37166239875 | yes |
| #401 | pass (3m5s) | 37166318026 | yes |
| #402 | pass (2m58s) | 37166132797 | yes |
| #404 | **skipping** (`changed` pass) | 37164481585 | yes. The diff is docs-only, so the `changed` filter skips `test`. CI therefore says nothing about #404's PowerShell |

`test-windows` reads `skipping` on all four.

## #397 r2 (narrow): rows 1, 4 and 5

The dispatch's header names "rows 1, 4 and 9" for #397, but row 9 is #401's budget row, and #397's own section is row 5.
I took the 9 as a typo for 5, ran 1, 4 and 5, and quote #397's greeting-size counts (its only budget-like row) below.

### Row 5: F1 fixed: PASS

`presenceBlockUpperBound` now takes, per partner, the longest `formatPartnerLine` over six room shapes: aged 99 days, a
negative age, `null`, absent, polling, and no room. The new class row,
`no presence line form is longer than the bound's line for that partner`, builds its own forms independently: three
`absent` forms, then pollingNow × unread {0, 999} × eight ages {undefined, null, −1, 0, 59 s, 3,599 s, 86,399 s, 99 d}.

- **Red on the old bound.** I put the head's `greeting-size.test.ts` in `qa269-base397` (`3e95016c`'s
  `hub-presence.ts`): **2 failed | 10 passed (12)**.
  - The class row fails with `bound "  grok: listener not polling, 999 unread since 99d" vs longest form "  grok:
    listener not polling, 999 unread, no listener poll recorded": expected 50 to be greater than or equal to 67`.
  - The updated row at line 227 also fails.
- **Green at the head:** greeting-size **12/12**, hub-presence **40/40**. `tsc --noEmit` 0, `npm run typecheck:tests` 0.
- **QA mutant** (`qa-269/mutants/pr397-qa-m1-bound-drops-nopoll-shapes.diff`): delete the `null` and absent shapes from
  the bound. It landed (1 file, −2), and tsc gives 0. Result: **2 failed** (the class row and the line-227 row). Restored
  clean.
- `formatPartnerLine` reads one room per partner (`rooms.find(sessionId)`), so single-room shapes cover every line it can
  print. **See G4:** the bound still assumes `unread ≤ 999`. That assumption predates T-237.

## #401 (T-236 c)

### Row 2: red then green

I put the four test files in `qa269-base401` (master `ef57c10c`):

| File | Master | Head |
|---|---|---|
| `focus.test.ts` | **module missing**: `Cannot find module .../focus.js`, no tests | 10/10 |
| `task-assignees.test.ts` | **module missing**: `.../task-assignees.js`, no tests | 4/4 |
| `state-writer.test.ts` | **1 failed** \| 47 passed (48): W1 set/clear/open (the strict schema refuses `assignee`) | 48/48 |
| `focus-off.test.ts` | 6/6, **passes by design** (OFF must equal today's render) | 6/6 |

`focus.test.ts` (F1–F5, S1–S3, B1) and `task-assignees.test.ts` (C1) fail only on a missing module. **Those rows are
pinned by the mutants below** (row 3). At the head, `tsc --noEmit` and `npm run typecheck:tests` both give 0.

### Row 3: mutants: PASS

Each mutant landed (`git diff --stat` 1 file), `tsc --noEmit` gave 0, and the source was restored clean.

| Mutant | Kind | Result |
|---|---|---|
| M8b: `KEY_ORDER.tasks` drops `assignee` | dev | state-writer **1 failed** (W1). My ob_state probe also fails: `ob_state applied, Revision 7 → 8`, then the re-read gives `assignee=undefined`, the silent drop of T-238's class |
| M2: "none assigned" falls back to the first non-done task | dev | focus **2 failed** (F2, F5) |
| QA-M1: `ob_start` fetches the roster a second time for SEATS | QA | focus **1 failed**: S2 through `ob_start`, `expected [ …(2) ] to have a length of 1 but got 2` |
| QA-M2: priority order reversed in `assigned()` | QA | focus **2 failed** (F4, S1) |

### Row 6: flag OFF is byte-identical to master: PASS

`focus-off.test.ts` compares absent with false at one tree, not with master. So I wrote a probe
(`qa-269/qa269-probe401.test.ts`) that dumps the **whole** `ob_start` text, temp root masked, for five configs on SIA's
fixture and on `a2a-state-1c200b41.json`. The configs are: no file, `{briefing_focus:false}`, `{briefing_budget:true}`,
`{briefing_budget:true, briefing_focus:false}` and `{briefing_budget:false, briefing_focus:true}`. I ran the probe at the
head and at master and diffed the dumps.

- Raw, every config differs in exactly four lines:
  1. the tree path in the `Serving build` line, which appears twice;
  2. the test process pid and session-proof temp dir;
  3. the temp key dir;
  4. the token estimate, which follows from the path length (`~1705` vs `~1704`).
- Masking those four: **10 of 10 configs are identical, whole output.** None contains `FOCUS:` or `SEATS:`.

### Row 7: one hub fetch, no NEXT fallback: PASS

- The S2 row runs `ob_start` (budget + focus on, in a `sia-planner` checkout with a lying `AGENT.local.md` naming
  Builder). It asserts `calls.filter(u => u.startsWith(HUB))` has length **1**, plus FOCUS on the header and SEATS with
  presence words. QA-M1 (a second fetch) turns it red.
- `focusLine` returns `FOCUS: none assigned in the record` with no task id (F2). The NEXT-fallback mutant turns F2 and F5
  red.
- In `server.ts`, `seats` reads `presence.statusByHubName` from the one `describeHubPresence` call at line 328. There is no
  other fetch.

### Row 8: the assignee survives a write: PASS

Probe `QA 269 row 8`, scratch record (the fixture copied into a temp `sia-infra` checkout), through **`handleState`**, which
is `ob_state`:

```
QA269-W SET ob_state applied | Revision: 7 → 8
QA269-W REREAD T-005 assignee="infra" rev=8 withKey=1
QA269-W CLEAR ob_state applied | Revision: 8 → 9      (then 0 tasks carry the key)
```

On master the same op is refused: `ops[0] invalid at $: Unrecognized key: "assignee"`. With **`assignee` deleted from
KEY_ORDER** (M8b), W1 goes red and the probe shows the write "applied" but the field gone on re-read.

### Row 9: budget: PASS

B1 at the head prints **`B1-MEASURE 30 lines 3704 chars`**, within 30 and 4,096. That matches the PR body. (For every flag
together, see row 16.)

## #402 (T-199 A)

### Row 2: red then green

I put both test files in `qa269-base402` (master):

| File | Master | Head |
|---|---|---|
| `missing-handoff.test.ts` | **26 failed \| 3 passed (29)** | 29/29 |
| `briefing-budget.test.ts` | **1 failed** \| 31 passed (32): the new WORST CASE row with the notice | 32/32 |
| `a2a-byte-identical.test.ts` (unchanged) | — | 3/3 |

Of master's 26 failures, 20 are `(0, missingHandoffLine) is not a function`. **Those are pinned by the mutants.** The
other 6 are behavioural:

- 2 × e2e `to contain 'Handoff MISSING: last'`;
- the prose-fallback not-checked line;
- two placement rows;
- the line-order row.

The 3 that pass on master are controls: OFF prints nothing, the budget holds, and flag OFF end to end.

At the head, `tsc --noEmit` and `npm run typecheck:tests` both give 0. These match the PR body's figures.

### Row 3: mutants: PASS (one QA mutant survives; see G1)

| Mutant | Kind | Result |
|---|---|---|
| Label prefers the reader's identity over the map | dev | missing-handoff **4 failed** (the HO-5 rows, as the PR says). My probe also fails 2 |
| A handoff from the same checkout satisfies the check (not only a matching `session_uuid`) | QA | **3 failed** (HO-1 newest, first_rev order, different session) |
| The prose fallback is silent when there is no `state.json` (`&& sj.present`) | QA | **SURVIVES**: missing-handoff 29/29. Only my probe kills it (1 failed). **G1** |

### Row 10: flag gating: PASS

- **Absent:** `a2a-byte-identical` 3/3 at the head and on the batch, with the golden untouched. The end-to-end row
  `A2A's record (a2a-state-1c200b41): flag absent prints no Handoff line; flag on equals the pure check` passes, and so
  does `flag OFF or absent` for `null`, `{}` and `{missing_handoff:false}`.
- **On** (probe `qa-269/qa269-probe402.test.ts`): the checkout is **named `sia-infra`** and carries the real seat map. Its
  `AGENT.local.md` **lies** (`name: Builder`, role developer). Its newest `sessions[]` entry (#9001, seat null) has no
  handoff. The result is `Handoff MISSING: last infra session #9001 (11111111-…, rev 123456) wrote the record, left no
  handoff; fix: ob_state set_handoff`.
  - The label comes from the T-203 map (`infra`), never the identity (`Builder`/`developer`).
  - The dev mutant (identity first) turns this probe red.

### Row 11: fail closed: PASS (G1 on the rows)

Every reason prints:

- `no project root, so the checkout is unknown` (HO-6 row);
- `N session(s) of checkout X carry no uuid` (HO-6 row);
- `state.json invalid, so there is no record to read` (e2e row);
- `no .agents/state.json, so there is no record to read`: **at the head, my probe only**. No committed row asserts it,
  and the silencing mutant survives (G1).

**Silence only after a check that ran:** `missingHandoffLine` returns null only for `kind: "clear"`. Clear is returned
when this checkout has no session, or its newest attributable session has a handoff.

An unknown `schema_version` (F3) returns the whole `ob_start` as a refusal (`isError`) with no Briefing. The notice is
absent there, but nothing renders as if checked.

### Row 12: placement: PASS

- **Budgeted** (probe, `briefing_budget` on): the header line is exactly `PICK UP HERE`. The next line is
  `<pick-up, cut to its cap> · Handoff MISSING: …`, and the notice is **153 chars** (≤ 160). There is **no new line** and
  the notice appears once. The HO-4 rows pin the same, and a 7-char-seat notice fits `MISSING_HANDOFF_MAX_CHARS`.
- **Legacy:** its own line, directly after the pick-up body (probe, and the HO-4 legacy row).

## #404 (T-204)

### Row 13: port fidelity: PASS

```
git range-diff 066ed8ca..d5b3623f origin/master..5add9137
1:  081a5e74 ! 1:  3f8c7471 T-204: machine lease helper, queue takes it, queue logs the driver's complete= verdict
    @@ docs/loops/qa-launch.md ##
    -@@ docs/loops/qa-launch.md: classifier, so Aaron runs it by typing these lines, ...
    +@@ docs/loops/qa-launch.md: prompt copied out with `git show <sha>:<prompt> > C:\qa-tmp\<prompt>`.
2:  d5b3623f = 2:  5add9137 T-204: developer handoff (evidence, mutants, what is not covered)
```

The only difference is the hunk-header context line in `qa-launch.md`, because master grew that file. The `+`/`-` content
is the same. `git diff 081a5e74 3f8c7471 -- machine-lease.ps1 machine-lease-harness.ps1 qa-queue.ps1 t204-plan.md` and
`git diff d5b3623f 5add9137 -- t204-developer-handoff.md` are **both empty**. `git diff 066ed8ca origin/master --
docs/loops/qa-queue.ps1` is **empty**, so the `-OldQueue` baseline the harness uses is unchanged since the source branch.

### Rows 2, 3, 14 and 15: NOT RUN

This QA host is Linux with no `pwsh` or `powershell` (none on `PATH`, `/opt` or `/usr/local/bin`). The artifact is
Windows-specific in any case:

- `$env:USERPROFILE\machine-lease`;
- a `Global\sia-machine-lease-reclaim` named mutex;
- `qa-queue.ps1` shells out to `powershell -NoProfile -File`.

So neither the 24-row harness nor its red run against master's queue (R8, R8b, R8c, R9, R9b, R9c, R9d) nor the
`nonatomic` mutant could run. **Nothing about #404's behaviour is verified by this QA.**

What I read statically, which is no substitute:

- `take` builds the lease in a temp file and moves it onto `lease.json`.
- Stale reclaim is serialised under the named mutex and re-reads the lease under it.
- An unreadable or malformed lease counts as held (exit 11).
- The queue refuses with no helper copy, and aborts on anything other than "taken".

That all matches the plan. **#404 needs a Windows QA host (the QA PC) for rows 14 and 15.**

## Row 16: batch merge: PASS on every TypeScript row

`qa269-merge`, from `ef57c10c`, `--no-ff` in the ruled order:

- #397 → `d7683b47`, #404 → `54f36b31`, #402 → `3e79a134`: all clean.
- #401 → `9cf6abc8`, **3 conflicts**:
  - `CHANGELOG.md`: both entries kept, T-199 first.
  - `briefing.ts`: the interface keeps both fields with their own doc comments. **In `renderBudgeted`, FOCUS goes on the
    header** (`PICK UP HERE · <FOCUS>`, from #401). **The notice goes after the pick-up body** (#402's
    `pickUp · notice`). SEATS goes before the header, untouched.
  - `server.ts`: both `missingHandoff:` and the `...focus` spread kept.
- `greeting.json` **auto-merged with sorted keys**: `briefing_budget, briefing_focus, handoff_caps, missing_handoff,
  role_docs_by_sha`. No hand edit was needed.
- The hand resolution is recorded in `qa-269/merge-9cf6abc8-remerge.diff` (`git show --remerge-diff`). It deletes markers
  and adds one `/**`; nothing else.

On `9cf6abc8`:

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 |
| `npm run typecheck:tests` | 0 |
| `briefing.test.ts` | 48/48 |
| `briefing-budget.test.ts` | 32/32 |
| `focus.test.ts` | 10/10 (B1 30 lines, 3,704 chars) |
| `missing-handoff.test.ts` | 29/29 |
| `server.test.ts` | 35/35 |
| `hub-presence.test.ts` | 40/40 |
| `greeting-size.test.ts` | 12/12 |
| `a2a-byte-identical.test.ts` | 3/3 |
| `tsc --outDir ~/qa-tmp/qa269-build`, then `node --check server.js` | 0, 0 |
| Duplicate-import scan (TS parser; QA 268's scanner, `qa-269/qa269-dup-imports.mjs`) | `src`: 104 files, 1,150 bindings, **0 duplicates**. `tests`: 189 files, 3,220 bindings, 0 |

**The worst case with every flag on** (`qa-269/qa269-allflags.test.ts`): #401's B1 input (every section past its cap,
400-char titles, every seat assigned, FOCUS + SEATS) **plus** #402's notice.

| Notice | Lines | Chars |
|---|---|---|
| Realistic longest: seat `research`, 4-digit session, 36-char uuid, 6-digit rev (156 chars) | **30** | **3,863** |
| Padded to `MISSING_HANDOFF_MAX_CHARS` (160) | **30** | **3,867** |

Both are within 30 lines and 4,096 chars. In both, the header starts `PICK UP HERE · FOCUS:`, the line before it is
`SEATS:`, and the pick-up body ends with ` · <notice>`.

## Gaps (none blocks #397, #401 or #402)

- **G1 (#402):** no committed row pins `Handoff check: not checked (no .agents/state.json, …)`. A mutant that silences
  exactly that branch passes `missing-handoff` 29/29. The head behaves correctly, and my probe proves it. Suggested: one
  e2e row beside `flag ON and the record unreadable`, with no state.json written.
- **G2 (#402):** `MISSING_HANDOFF_MAX_CHARS` (160) is a test constant, not enforced. The label can fall back to the
  checkout basename for an unlisted checkout. The `not-checked` uuid reason also embeds the checkout name. So a long
  checkout name makes the appended notice longer than 160. The 30-line cap is unaffected; the 4,096-char row assumes a
  realistic label.
- **G3 (#401):** `greeting-flags.ts`'s doc comment, which lists the keys, does not name `briefing_focus`. After the batch it
  names `missing_handoff` only. Doc nit.
- **G4 (#397, pre-existing):** the bound and the class row both fix `unread` at 999. A 4-digit unread count prints a
  longer line than the bound. This predates T-237 and is outside F1.
- **G5 (#404):** rows 14 and 15 need a Windows host. CI's `test` is skipped for this docs-only diff, so no automated run
  has exercised the harness on this head either.
- **G6 (observation, pre-existing #393 behaviour):** in my probe's `sia-infra` checkout, the budgeted PICK UP **body**
  showed the `developer` seat's newest handoff (from `AGENT.local.md`'s role). The **notice** and FOCUS on the same screen
  name `infra` (from the map). The two keys differ by design today, but the line now carries both.

## Artifacts on `qa/s160d-report`

- `docs/loops/qa-269/mutants/*.diff`: 8 mutants (3 dev, 5 QA). `pr402-qa-m2-norecord-silent-SURVIVES.diff` is the G1
  survivor.
- `docs/loops/qa-269/qa269-probe401.test.ts`: O1 dump and row 8. `qa269-probe402.test.ts`: rows 10–12 end to end.
  `qa269-allflags.test.ts`: row 16 worst case. `qa269-dup-imports.mjs`.
- `docs/loops/qa-269/merge-9cf6abc8-remerge.diff`.

QA-269: REPORT COMPLETE
