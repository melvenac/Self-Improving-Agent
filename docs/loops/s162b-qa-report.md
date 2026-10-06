# QA 281 report: session-162 batch b (prefix `s162b`): #445 r4, and retro-checks of #457 and #458 (Plumb, Linux)

**Seat:** QA, headless Claude Code on Opus, record session 162. Machine: Plumb (Linux). 2026-10-05.
Dispatch: `docs/loops/qa-281-s162b-dispatch.md`.

**Worktree:** `git -C ~/qa-scratch/qa281-wt log -1 --format=%H` = `ef2b71a57fa614d9a796b1a24f990e2095883b46` (the
DISPATCH_SHA). It was created fresh by `git worktree add --detach`. `origin/master` at fetch = `ef2b71a5`.

## Verdicts

| PR | Task | Pinned head | Result | Deciding rows |
|---|---|---|---|---|
| #445 | T-156 r4 | `1e21deaea32e20591e65a5cf39eb40a0517542d6` | **ACCEPT** | Rows 1–6 pass. In row 3, each of (a)–(d), applied where that text lives, turns R-BF-21 **red** with a real code line planted, and every comment near-miss stays green. One Medium finding (F1, below) does not block. |
| #457 | HUBROOM-TURN-END (merged `2f8e6489`) | — | **FINDINGS** | Rows 7 and 8 hold. **Row 9: the guard misses 3 of 3 rewordings** in `hub-room.mdc` and all of them in `start.md`. One of my four phrasings (R4) is caught, and only in `hub-room.mdc`. |
| #458 | WAKER-IGNORE (merged `1671d005`) | — | **HOLDS** | Rows 10 and 11 pass. One Low observation (G3): the guard checks text, not behaviour. |

**Overall: REJECT.** The dispatch requires #445 ACCEPT **and** #457 and #458 both HOLD. #457 has a row-9 finding. #445 is
accepted on its own pinned head. Under the P2 rule the planner can merge it by a path check (row 1: tests and docs only).
#457's finding calls for a follow-up PR, not a revert.

## Method and environment

- Node v22.22.1, Linux. Every npm, tsc and vitest run went through `~/qa-tmp/qa281/run.mjs` or a node driver
  (`mut445.mjs`, `mutgen.mjs`, `mut457.mjs`, `seed458.mjs`, `sweep.mjs`, all in `~/qa-tmp/qa281/`). Each driver sets
  `TMPDIR=~/qa-tmp` and `npm_config_cache=~/qa-tmp/npm-cache`.
- **Install and trees.**
  - `npm ci` ran once, in `qa281-pr445/open-brain`. npm's install-scripts gate skipped postinstall scripts, and none of
    the test files used here needed them. Every other tree has `node_modules` symlinked to that install.
  - Trees: `qa281-pr445` (r4 head), `qa281-prev445` (r3 `260d6835`, set up but not needed: QA 280 already holds the r3
    controls), `qa281-pr457` (`2f8e6489`) and `qa281-pr458` (`1671d005`).
  - No batch merge was dispatched, so `qa281-merge` was not created.
  - `git fetch origin pull/445/head` returns exactly the pinned SHA, so there is **no head drift**.
- **LIGHT.** One test file per vitest invocation, and no full suite. Mutants went only on touched files: #445's test
  files and the `src` files they scan, #457's three Cursor copies plus its JSON table, and #458's two gitignores.
  - Each `src` mutant was checked with `tsc --noEmit`; each test mutant with `tsc -p tsconfig.tests.json`.
  - Each mutant was restored with `git checkout --`, and the driver confirmed after every mutant that the tree was clean.
- **Process deviation (honest note).**
  - The first #445 mutant batch (`mut445.mjs`, 15 mutants) passed the tool's 600 s foreground limit, and the harness
    moved it to the background. That broke THE RULE, though not by my choice.
  - While it ran I did not touch `qa281-pr445`. I worked only in the #457 and #458 trees, then read its complete output
    after it exited 0. The driver confirmed the tree was clean after every mutant.
  - All later batches were split to finish inside the limit.
- **Subagents:** none. Every row is my own run.
- **Tree state at the end:**
  - `qa281-wt` holds only this report.
  - `qa281-pr445` is clean.
  - `qa281-prev445`, `qa281-pr457` and `qa281-pr458` show only `?? open-brain/node_modules`, the symlink.
  - The QA clone (`~/work/qa-242`) is on `master` with a clean status. It shows "behind 635" only because Setup step
    2's fetch moved its remote refs.
- **Real profile, G-051** (presence and mtime only, no content read):
  - `~/.claude/settings.json`: present, mtime 2026-10-01.
  - `~/.claude.json`: mtime 2026-10-06T03:39Z, which is around this job's launch; it was not written by QA.
  - Absent: `~/.claude/settings.local.json` and `~/.claude/open-brain/knowledge-v2.db`.
- **Nothing live was touched.** No `.agents/state.json`, real DB, Jev call or hub call. `gh` was used read-only:
  `run list`, `run view` and `pr view`.

## #445 r4 (rows 1–6): ACCEPT

### Row 1: Confined: PASS

`git diff 260d6835 1e21deae` touches 3 files, +58 −7:
- `docs/loops/t156-scan-list.md`
- `open-brain/tests/harness/shadow-merge.test.ts`
- `open-brain/tests/pipelines/bootstrap-fix-r4.test.ts`

Nothing else changed. `git merge-tree` against `origin/master` `ef2b71a5` is clean (tree `03a7a991`).

### Row 2: CI: PASS

CI run **37406327038** on `1e21deae`: `test` **success**, `changed` success, `test-windows` skipped. Overall: success.

At the head, `tsc --noEmit` exits 0 and `npm run typecheck:tests` exits 0. `bootstrap-fix-r4.test.ts` passes 11/11 and
`shadow-merge.test.ts` 43/43.

### Row 3: R-BF-21 controls the real scan: PASS

**What r4 added** (`bootstrap-fix-r4.test.ts:158-212`):
- a planted grep row that must give exactly one code hit;
- a temp-repo `renameHookGrep` positive (status 0, one hit);
- a known-present control, `grep "export function formatMoveResidueFailure"` on `OPEN_BRAIN_SRC` (status 0, one row);
- on the real grep, asserts that `g.error` is undefined and `status ∈ {0,1}`.

**The mutants.** All of them, except the near-miss rows, ran with a real code line appended to tracked `src/cli.ts`:
`export const qa281Plant = process.env.OPEN_BRAIN_BOOTSTRAP_RENAME_HOOK;`. `tsc` and `typecheck:tests` exited 0 on every
mutant. Only R-BF-21 ran (`-t R-BF-21`).

| Mutant | Result | Fails at |
|---|---|---|
| plant only (control) | **red** | L211 `expected [ Array(1) ] to deeply equal []` |
| **(a)** typo'd needle in the constant (`RENAME_HOOK_VAR = "…_HOOK_TYPO"`) | **red** | L182 (literal pair) |
| **(a)** typo'd needle in the grep helper (`grepInRepo(cwd, RENAME_HOOK_VAR + "_TYPO", …)`, QA 280's mutant where the needle now lives) | **red** | L196 temp-repo status 1 ≠ 0 |
| **(b)** pathspec typo `open-brain/srcX` in the one literal (`OPEN_BRAIN_SRC`) | **red** | L205 control status 1 ≠ 0 |
| **(c)** `sourceLineFromGitGrep` returns `""` for every row | **red** | L187 planted row has length 0 |
| **(d)** `git grep` with a bad flag (`--qa281-no-such-flag`, in the helper) | **red** | L196 status 129 |
| **(d)** `git grep` errors at the real call only (needle replaced by a bad flag) | **red** | L210 status ∉ {0,1} |
| **(d)** spawn ENOENT (`git-qa281-missing`) | **red** | L195 `g.error` defined |
| near-miss: `// export const … OPEN_BRAIN_BOOTSTRAP_RENAME_HOOK;` in `src/cli.ts` | **green** | — |
| near-miss: `/* … OPEN_BRAIN_BOOTSTRAP_RENAME_HOOK … */` | **green** | — |
| near-miss: a JSDoc ` * OPEN_BRAIN_BOOTSTRAP_RENAME_HOOK …` line | **green** | — |

**Row 3 as worded passes.** QA 280's blocking hole is closed: the typo'd needle, its row 9(b), is now red.

**Survivors (F1, Medium, non-blocking).** These mutants change the real call's own arguments, which no control shares.
All are **green** with the real line planted:

| Mutant | Result |
|---|---|
| `renameHookGrep`'s default pathspec changed to `"open-brain/srcX"` (the default is used only by the real call; the temp repo passes `"src"` and the control passes `OPEN_BRAIN_SRC` directly) | green |
| call site `renameHookGrep(repoRoot, "open-brain/srcX")` | green |
| call site `grepInRepo(repoRoot, RENAME_HOOK_VAR + "_TYPO", OPEN_BRAIN_SRC)` | green |
| call site `gitGrepRenameHookCodeHits("")` in place of `g.stdout` | green |

- The default-parameter mutant changes one token, inside the helper rather than at the call site. It survives because
  neither positive runs the exact (needle, pathspec) pair the real scan runs:
  - the temp repo uses pathspec `src`;
  - the known-present control uses a different needle.
- **Fix (cheap):** plant the temp-repo file at `open-brain/src/planted.ts` and call `renameHookGrep(tmp)` with **no**
  pathspec argument. The temp repo then runs the exact args of the real call, and only `cwd` differs, which the
  `formatMoveResidueFailure` control already covers.
- The three call-site rewrites are not typos. They are the residual limit of any absence scan.

### Row 4: QA 280's lows: PASS

- **`t195-plan-gate.test.ts:153` is listed** under "Out of scope: not a source-text includes scan", with a reason
  (policy JSON on disk). The line is still exactly L153.
- **CC-19's raw `cli` checks are paired.** Both `expect(cli).toContain(…)` are replaced by
  `codeHas(cli, …)`, each with a planted positive and a `//` near-miss: `runtimeNeverMerges` at L365-368 and
  `shadowSub` at L371-374. Row 5 shows both are live.
- **Ranges.**
  - CC-19 is cited `356-375`. At the head it runs from `it("CC-19…` at L356 to its `});` at L375, so it matches exactly.
  - git.test is cited `61-72`, and L61-72 is the detector comment, the positive and negative pair (L63-64) and the
    deny-list near-miss (L72), so it matches.
  - Info: the entry now says "before the tree walk", so the real scan at L74-99 is deliberately outside the cited
    range. That is an honest citation, not drift.

### Row 5: QA 280 rows 7, 8, 10 and 11 still hold: PASS

**Row 7 (CC-19).** I ran it with `-t CC-19`. `tsc` exited 0 on every mutant.

| Mutant | Result |
|---|---|
| `// prepareShadowVerdict …` appended to `src/harness/runtime.ts` | **green** |
| `/* prepareShadowVerdict … */` appended to the same file | **green** |
| a real `prepareShadowVerdict();` call in `runtime.ts` | **red** (CC-0 and CC-19) |
| `if (sub === "shadow-verdict")` commented out in `src/harness/cli.ts` (QA 280's F3 case, green at r3) | **red** (CC-19) |
| the "runtime never merges" usage line turned into a `//` line | **red** (CC-19) |

**Row 8 (doc readers).** All eleven entries under "Out of scope: reads docs" are unchanged from r3. They include the
five readers and the two borderline ones.

**Row 10 (ranges), spot-checked at the head:**

| Cited range | Result |
|---|---|
| R-BF-21 `137-212` | exact: the constant through the `it` close; L213 is the `describe` close |
| CC-0 `313-354` | exact |
| D4 `194-217` | exact |
| bootstrap-fix-r4 `93-98` | exact |
| s4-g2-key `236-241` | exact |
| checks `141-160` | within one: the `it` closes at L161 |
| hub-talk-exit-codes `10-40` | within one: the loop closes at L41 |

Info: #445 is based before #457. After merge, hub-talk-exit-codes runs one line longer (#457 added a `REQUIRED` entry),
so that entry drifts to 10-41 or 10-42.

**Row 11 (QA 279 row 18).** Every mutant is **red**. `typecheck:tests` exited 0 on each.

| Helper | Mutant |
|---|---|
| `codeHas` | widen: drop the `/*` exclusion |
| `codeHas` | widen: drop the `//` exclusion |
| `codeHas` | narrow: require `import` |
| `skipCall` | widen: drop `/*` |
| `skipCall` | narrow: drop `skipIf` |
| `badReturn` | widen: drop every comment exclusion |
| `badReturn` | narrow: require `): string \| null;` |
| `renameHookInSourceLine` | widen: drop `/*` |
| `renameHookInSourceLine` | narrow: refuse lines containing `=` |
| real-scan filter | widened to keep comment rows |

### Row 6: My own sweep: PASS (two Info items)

**Method.**
- I scripted a sweep of all `open-brain/tests/**/*.test.*` (`sweep.mjs`) for a read of `src`, a `git grep` or
  `ls-files`, and text asserts.
- I then grepped every `readFileSync(…src…|….ts)` and every `git grep` or `ls-files` spawn, and read each hit.

**Results.**
- **Every live `src/` source-text scan is paired or listed.** That covers every `readFileSync` of a `src/*.ts` file in a
  test: floor, worktree-layout, probe-markers, t048-r3, t048-r2b, s4-g5-qa (Q5, Q6, Q8), policies, shadow-merge (CC-0,
  CC-19) and git.test.
- The only test-side `git grep` is R-BF-21.
- The `ls-files` uses either hash fixture repos (s4-g3-done, s4-g5-qa) or are already listed (s4-guards), or read a
  fixture repo (bootstrap-fix:439).

**Info (unlisted, same class as t195:153).**
- `harness/schema.test.ts:205-214` and `harness/b2-et.test.ts:326-332` assert `toContain` on the parsed `description`
  field of `src/harness/schemas/*.json`.
- These are presence checks on a JSON prose field, not line scans of code. They belong beside t195:153 under "not a
  source-text includes scan" for completeness.
- `t216-loop-id:88-95` and `s4-g4-reconstruct:79` parse the same schemas structurally (equality and key lists). They are
  not scans.

### #445 findings

1. **F1, Medium, non-blocking.** No positive control runs R-BF-21's exact real-scan arguments. Changing
   `renameHookGrep`'s default pathspec, or the real call's arguments, survives with a real hit planted. Fix: run the
   temp-repo positive as `renameHookGrep(tmp)` with the file at `open-brain/src/planted.ts`.
2. **F2, Info.** `schema.test.ts:205-214` and `b2-et.test.ts:326-332` are not listed; they are JSON-description
   presence checks.
3. **F3, Info.** After #457 merges, the hub-talk-exit-codes cited range will be one line short.

## #457 retro (rows 7–9): FINDINGS

### Row 7: The rule says one thing everywhere: PASS

- At `2f8e6489`, `.cursor/rules/hub-room.mdc` and `project-template/.cursor/rules/hub-room.mdc` are **byte-identical**:
  both are LF, 2423 bytes, with the same sha256 after CRLF normalisation (prefix `c61134c878a1a301`).
- The Hub-room section of `project-template/.cursor/commands/start.md` (L105-111) and the five `cursor_only` strings in
  `docs/loops/cursor-start-differences.json` agree. **All five JSON strings are verbatim lines of `start.md`.**
- All copies say the same thing:
  - a seat whose row has `runtime: "cursor"` runs the talk line with `--inbox`;
  - it does the work, posts with `--say`, then ends the turn ("never block on hub-talk waiting for the next atlas turn
    in this run");
  - "Exit 2 comes only from --wait, which a seat with a waker does not run; if you see it, end the turn."
- There is no root `.cursor/commands/start.md` at this SHA, so only the template copy exists.
- `hub-talk-exit-codes.test.ts` is 10/10 at the merge.

### Row 8: No live instruction tells a Cursor seat to wait inside its turn: PASS

I ran `git grep -i -E -e '--wait|wait again|foreground|in this same turn'` over `.cursor/`, `project-template/`,
`.agents/roles/`, `.agents/SYSTEM/` and `scripts/`.

| Hit | Class |
|---|---|
| `.cursor/rules/hub-room.mdc:16`, `project-template/.cursor/rules/hub-room.mdc:16` ("Exit 2 comes only from --wait …", and "act on it (… in this same turn for `--inbox`)") | **exit-code text**. "In this same turn" means act on the inbox turn now, not wait. |
| `project-template/.cursor/commands/start.md:109` | **exit-code text** |
| `hub-room.mdc:20` (both copies), `start.md:111` ("only a seat with no waker waits in the foreground") | **no-waker / listener** scope, explicitly excluding waker seats |
| `.agents/SYSTEM/RUNBOOK.md:81` ("run `gitnexus analyze` in the foreground") | unrelated (gitnexus operator note) |
| `.agents/SYSTEM/hub-partner-seats.json:6`, top-level key `wait` = `--wait --wait-timeout 3500` | **listener config**, not prose. See G2. |

**No hit is an instruction to a waker seat.** `.agents/roles/` and `scripts/` have no hits.

**G2, Low.**
- The rule tells a Cursor seat to open `hub-partner-seats.json` and use its `talk` line. That file also carries an
  unscoped top-level `wait` suffix.
- Its `description` does not mention the key, and nothing in `open-brain/src` or `scripts/` reads it (`git grep`).
- A seat composing its own invocation from that file could append it. Scope or document the key, for example as
  `wait_no_waker_only`, or note in the description that waker seats never use it.

**Info.** The rule cites "`.agents/roles/shared.md` § Hub transport: how a seat waits" at "A2A-Hub master b6a8de79".
SIA's own `.agents/roles/shared.md` has no such section. A seat in an SIA worktree that opens the relative path finds
the wrong file. Write the cite as `A2A-Hub:.agents/roles/shared.md`.

### Row 9: Can the guard fail? FINDING

The guards are:
- `not.toContain("wait again")` on all three copies;
- `not.toMatch(/--wait --wait-timeout/)` and `not.toMatch(/run the \`talk\` line with \`--wait\`/i)`, on the two
  `hub-room.mdc` copies **only**.

**The method.** Each rewording was planted consistently:
- in `hub-room.mdc`, after "Post when the work is done, not a bare acknowledgement.", in both copies, so the identity
  test is not the reason for red;
- in `start.md`, at the end of the L107 Hub-room line, **and** in its `cursor_only` JSON twin, so the parity test is not
  the reason for red.

I ran `hub-talk-exit-codes.test.ts` (`mut457.mjs`):

| Rewording (a seat would obey each) | in `hub-room.mdc` | in `start.md` |
|---|---|---|
| R1 "After posting, run hub-talk --wait for the next atlas turn." | **green: not caught** | **green: not caught** |
| R2 "When the post succeeds, run the `talk` line again with `--wait` and handle the next atlas turn in this run." | **green: not caught** | **green: not caught** |
| R3 "Then keep listening: append the seat file's `wait` suffix to the talk line and act on what it prints before you end the turn." | **green: not caught** | **green: not caught** |
| R4 (control) "After posting, run the talk line with --wait --wait-timeout 3500." | red: caught | **green: not caught**, because `start.md` has no `--wait` guard |

**Finding G1, Medium.** The guard is a two-phrase deny list. Ordinary rewordings pass it, and `start.md`, a copy the seat
reads at `/start`, is not covered by the `--wait` guard at all.

**Proposed parse-shaped check.** Apply it to all three copies:

1. **Split** each copy into sentences on `.`, `;` or a newline, outside backticks.
2. **`--wait` occurrences.** Every sentence containing `--wait` must equal one allowlisted exit-2 sentence: "Exit 2 comes
   only from --wait, which a seat with a waker does not run; if you see it, end the turn."
   - Assert that the count of `/--wait\b/` per copy equals the count of that sentence.
3. **Seat-file `wait` key.** No sentence mentions it: forbid `/`wait`\s+(suffix|key|line)/i` and `wait_timeout`.
4. **Verb-level ban.** Any sentence that names a hub invocation (`hub-talk`, "talk line", or `` `talk` ``) and also
   contains any of `wait`, `listen`, `block` or `poll` must be either:
   - in the allowlist (the exit-2 sentence, the exit-3 `wait \`retry-after\` seconds` sentence, and the
     "never block on hub-talk waiting" sentence); or
   - negated, with `never` or `does not` as its main verb.
5. **Plant R1–R3 as positives** in the test, as strings, so the check is shown to fire.

## #458 retro (rows 10–11): HOLDS

### Row 10: Exactly the waker files: PASS

**Root `.gitignore`.** `git check-ignore -v --no-index` at `1671d005`:

| Path | Result |
|---|---|
| `.cursor/wake.lock` | **ignored** (`.gitignore:73`) |
| `.cursor/waker.pid` | **ignored** (`.gitignore:74`) |
| `.cursor/wake-prompt-7.txt` | **ignored** (`.gitignore:75`) |
| `.cursor/hub-reply-abc.txt` | **ignored** (`.gitignore:76`) |
| `.cursor/rules/hub-room.mdc` | **not ignored** |
| `.cursor/commands/start.md` | **not ignored** |
| `.cursor/rules/x.mdc` | **not ignored** |

**Seeded from `project-template/gitignore`** (fresh scratch repo with that file as `.gitignore`, `seed458.mjs`): the
same four are ignored (`.gitignore:36-39`) and the same three are not ignored (exit 1).

`template-seed.test.ts` is 4/4 at the merge.

### Row 11: The guard can fail: PASS

| Mutant | Result |
|---|---|
| each of the 4 patterns removed in turn from the root `.gitignore` | **red ×4** (`root and template gitignore ignore A2A-Hub waker runtime files only under .cursor/`) |
| each of the 4 patterns removed in turn from `project-template/gitignore` | **red ×4** |
| a root `/.cursor/*` line added (the one breadth case the test names) | **red** |

**G3, Low (observation, not a row failure).** The guard checks text, not behaviour. These mutants all stay **green**:
- root `wake.lock` commented out (`# /.cursor/wake.lock`), because `toContain` still matches the substring;
- template `waker.pid` negated (`!/.cursor/waker.pid`);
- root `/.cursor/` added: by gitignore semantics that ignores every new `.cursor/rules/*.mdc`;
- template `/.cursor/*` added: the breadth assert reads only the root file.

**Proposed fix.** Replace the substring asserts with the row-10 behaviour check. In a temp repo seeded from each file,
`git check-ignore --no-index` must ignore exactly the four waker paths, and must not ignore `.cursor/rules/x.mdc` or
`.cursor/commands/start.md`.

## Findings summary

| # | PR | Severity | Finding |
|---|---|---|---|
| F1 | #445 | Medium (non-blocking) | No positive control runs R-BF-21's exact real-scan args. A default-pathspec mutant survives. |
| F2 | #445 | Info | Two JSON-description presence checks are unlisted (`schema.test.ts:205-214`, `b2-et.test.ts:326-332`). |
| F3 | #445 | Info | The hub-talk-exit-codes cited range will drift by one after #457. |
| G1 | #457 | **Medium** | The "no --wait" guard is a two-phrase deny list. Three of three natural rewordings pass in `hub-room.mdc`, and four of four in `start.md` (unguarded for `--wait`). |
| G2 | #457 | Low | `hub-partner-seats.json` has an unscoped top-level `wait` suffix in the file the waker-seat rule says to read, and nothing in src reads it. |
| G-info | #457 | Info | The `shared.md` § Hub transport cite resolves to A2A-Hub's file, not SIA's. |
| G3 | #458 | Low | The template-seed guard checks substrings. A commented, negated or over-broad pattern stays green. |

**#445 r4 `1e21deaea32e20591e65a5cf39eb40a0517542d6`: ACCEPT. #457: FINDINGS (G1). #458: HOLDS. Overall: REJECT.**

QA-281: REPORT COMPLETE
