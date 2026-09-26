# T-179 + T-163 merge round: developer handoff (Forge, record 124)

**By:** Forge (developer), record session **124**, 2026-09-26, in `~/Worktrees/sia-builder` (greeting's local number: 6,
per T-164). **To:** Atlas (planner). **Brief:** `docs/loops/t179-merge-round-brief.md` (on
`origin/docs/session-100-qa99-dispatch`). **Model and effort, from this session's transcript:** `claude-opus-5-5`
(1M context), effort **`medium`** on all 157 transcript entries that carry the field.

**Candidate for QA 125:** `loop/t179-merge` @ **`3c0bfdc`** (the handoff commit sits on top and changes only
`docs/loops/`). **Merged master SHA: `aae0dce`**, the tip of `origin/master` when I fetched (`d2685fd` + #164). Merge
commit **`d07920b`**, parents `828a9d3` (T-179's handoff on `66b2173`) and `aae0dce`. No rebase, no force.

## 1. Conflicts and their resolutions

`git merge origin/master` reported exactly the three files the brief named.

| File | Hunk | Resolution |
|---|---|---|
| `open-brain/src/cli.ts` | `state` usage guard and its error line | **Both.** T-179's `erasures` subcommand and optional `--seat` (v1 records only), plus master's `--commit [--accept-stale]`. |
| `open-brain/src/cli.ts` | top-level usage lines for `state import / erasures / migrate` | **Both**, the same way. |
| `open-brain/src/pipelines/state-import/index.ts` | T-179's render call vs master's `const migrate = () => {` | **Master's structure** (R2-3: every step after the snapshot runs inside `migrate`, so a failure rolls back). T-179's one change, the render's session number, moved **into** the closure: `lastSession(parsed.data)?.n ?? 0` in place of `parsed.data.last_session.n`, which a v3 record does not have. |
| `open-brain/tests/pipelines/state-import.test.ts` | the verified/gaps/session assertions | **Master's T-175 lines** (`verified` and `gaps` are `[]`) with **T-179's `sessions[]`** in place of `last_session`. |

**The draft body merged cleanly from T-179's side** (`schema_version: 3`, `sessions[]`, the handoff's `session_uuid` and
`checkout`), because master's rounds 1–4 did not touch those lines. So the importer already wrote v3 on the merged tree;
what could break was everything master added around it.

**One semantic conflict git could not see** (the test suite is not type-checked, T-152):
`state-import-r2.test.ts:149`, a master-side test, read `r.state.last_session.date` off a v3 draft. On the merged tree
it went **red as a `TypeError`** (`Cannot read properties of undefined (reading 'date')`), the only red of the 87
importer tests. Now `lastSession(r.state)?.date`. I grepped every file master changed under `open-brain/` for
`last_session` and `schema_version: 2`; that line was the only hit outside the import *report*, whose `last_session`
field is the report's own and is correct.

## 2. The importer's v3 rule

**Nothing the importer writes is stamped with the importing run's session.** Everything it writes came from prose an
**earlier** session wrote, so stamping it with the importer's uuid would attribute another session's words to this
one, which is the exact misattribution T-163 exists to prevent. Concretely:

- **The imported handoff is a legacy entry:** `session_uuid: null`, `checkout: null`, `seat: "developer"` (the
  existing documented assumption), exactly as a v2 handoff is after `state migrate`.
- **`sessions[0]` is the prose log's last session:** its own `n`, `date` and `uuid` (null when the log names none),
  `seat: null` and `checkout: null`, because the log never recorded either.
- **The importing run adds no `sessions[]` entry.** `state import` is a CLI with no registered session. The first
  `ob_state` write by a real session adds that session's own `sessions[]` entry and, on `set_handoff`, its own keyed
  handoff **beside** the legacy one. Retention treats the legacy entry as its own instance (checkout null), so a later
  handoff does not erase it.

**I argued against the brief's first option ("stamped from the registered session") rather than comply with it**,
because for an import the registered session is the wrong author. If you want the import to record *that an import
happened* under the operator's session, that is a new `sessions[]` entry, not a stamp on the imported content. I did
not build it.

## 3. The new test: `open-brain/tests/pipelines/state-import-v3.test.ts` (4 rows)

1. `--commit` writes schema v3 with `sessions[]` and no `last_session`, and `StateSchema` accepts it.
2. The stamping rule of section 2, plus T-175 on the v3 record.
3. **`ob_state`'s writer accepts it:** `applyStateOps` with a registered `session_uuid` takes an `open_task` and a
   `set_handoff`, reaches revision 1, and the legacy handoff survives beside the new keyed one.
4. **v3 in, v3 out:** `migrateStateText` reports `from 3 to 3`, revision 0 → 0, `output: null`, and
   `migrateStateFile` leaves the bytes on disk identical.

**Red first.** On the merged tree it needed no fix, so its red was taken on the real prior condition: the same file in a
scratch worktree at **`origin/master` `aae0dce`**, whose importer wrote v2. **4 of 4 red:** rows 1–3 on assertions
(`expected 2 to be 3`; the handoff lacking `session_uuid`; `[ undefined ]` for the handoffs' uuids), row 4 as a
`TypeError` because master has no `migrateStateText`. That fourth red is weaker, so the importer was also mutated
directly (section 5).

## 4. The runs

| Where | What | Result |
|---|---|---|
| local, `sia-builder` | `tsc --noEmit -p open-brain` at `d07920b` and at `3c0bfdc` | exit 0 both |
| local | `vitest run tests/pipelines/state-import` (8 files) at the merge, before the r2 fix | **1 failed / 87**: the r2:149 `TypeError` |
| local | the same, after the fix | **87 / 87 passed**, 8 files |
| scratch worktree at `aae0dce` | `state-import-v3.test.ts` alone | **4 / 4 red** (section 3) |
| **tcm, run `36224382093`** | `loop/t179-merge` @ `3c0bfdc`, runner `tcm-1` | **GREEN: 1285 passed, 2 skipped (1287); 84 of 84 files** |

**Per file, from run `36224382093`'s log.** Importer, **87 tests, all passed:** `state-import` 9, `-r2` 18, `-r3` 16,
`-r4` 22, `-staleness` 8, `-atomic` 8, `-seeds` 2, `-v3` 4. T-179's files, **all passed:** `closeout-erasure` 10,
`handoff-guard` 11, `record-erasure` 13 (1 skipped: the real-history row, shallow checkout, as in T-179's own run),
`state-writer` 40, `state-schema` 17, `state-migrate` 15, `handoff-provenance` 11, `state-render` 32, `state-views` 14,
`greeting-size` 8, `cli-args` 56, `template-seed` 3. The other skip is `paths.test.ts`'s, as before.

**`/sync --check` on the merged tree:** 21 passed, 4 warnings, 3 issues. The issues are `state-schema` (the live record
is still v2: expected until the post-merge migration, which this round does not run), and `mirror-parity` and
`retirements` (`end.md` against the installed copies; `ENTITIES.md` naming `dream`), both named in T-179's handoff
§8–9 as outside this candidate. Nothing new.

## 5. The mutants

**T-179's seven, re-applied to `3c0bfdc`.** Master touched none of the five source files they edit, so each diff
(`git diff <mutant>^ <mutant>` from `loop/t179-mut-*`) applied **unchanged, with no re-anchoring**; each landed
non-empty, `tsc --noEmit` exited 0, and each push was read back with `ls-remote`.

**All 7 red on tcm, each on the rows T-179 recorded** (full suite, 1287; every failure a test assertion, not infra).

| Mutant | Branch head | Run | Red / 1287 | vs T-179 (§ mutants) |
|---|---|---|---|---|
| `key-role` | `cd9bfe7` | 36224507252 | **9** | 8 then; **+1 is the new v3 row** "a registered session's set_handoff lands beside the legacy entry, which survives" |
| `no-session-refusal` | `6a6166d` | 36224508669 | **1** | same row |
| `op-uuid` | `08ce80f` | 36224510149 | **1** | same row |
| `retention-checkout` | `2eab38c` | 36224511799 | **2** | same two rows |
| `erasure-blind` | `7df310c` | 36224513695 | **6** | same six |
| `guard-window` | `d65f715` | 36224515193 | **1** | same row |
| `guard-blocks` | `7528159` | 36224517131 | **1** | same row (the real hook "...and exits 0") |

**QA 122's R4-1 mutants, byte-exact** (`docs/loops/dev-scripts-importer-r4/mutants-r4.cjs`, the developer's driver
that QA 122 ran byte-exact, run from `open-brain/` at `d07920b`). **Both anchors matched exactly once; no re-anchoring.**
- **`R41-block`: red 9/87** (QA 122: 9/83).
- **`R41-refusal`: red 8/87** (QA 122: 8/83).
The same rows as QA 122's; the +4 in the total is the new v3 file. Output: `evidence/r41-d07920b/`.

**The new test's own mutants** (`docs/loops/dev-scripts-t179-merge/mutants-v3.cjs`, the same driver with a new list,
at `d07920b`; output `evidence/v3-d07920b/`):
- **`v3-stamp`** (the importer stamps a uuid on the imported handoff): **red 3/87**, two v3 rows and `state-import`'s
  next-session row.
- **`v3-session-seat`** (`sessions[0]` gets a seat the log never named): **red 2/87**.
- **`v3-shape`** (`--commit` writes the record at schema v2, what master's importer did): **red 41/87**, all four v3
  rows among them. Its first run was **void, not counted**: my heredoc turned `\n` into a literal newline and `tsc`
  failed. Fixed and rerun.
- **`merge-render-session`** (the render after commit stamped with session 0 in place of the imported one):
  **SURVIVES, and is equivalent.** On an empty batch the writer skips ops, retention and the write, and no renderer
  reads `session` (`viewOpts.session` has no reader in `state-views`). The line was just as unobservable on master.
  Kept in the run so the survivor is shown, not omitted.

## 6. Greeting figures

**Instrument: §8's, re-run** (`docs/loops/dev-scripts-t179-merge/greeting.sh`): `handleStart({project_root})` from
each build's own `build/server.js`, one process per seat, in a scratch `git clone --shared` at that build's SHA, with
an `AGENT.local.md` per seat. **Two deliberate differences:** every store the server can touch (`KNOWLEDGE_V2_DB`,
`OPEN_BRAIN_ACTIVE_SESSION`, `_SCORE_HISTORY`, `_SHADOW_LOG`, `_VAULT_DIR`) pointed at scratch, and the three clone
directories have equal-length names, so §8's −1 path artefact is gone. **The three builds ran in one pass, on the
same record** (byte-identical `state.json` at all three SHAs; `retirements.json` differs by master's one line).

| Seat | master `aae0dce`, v2 rev 131 | T-179 `66b2173`, v3 rev 132 | **merged `3c0bfdc`, v3 rev 132** | merged − T-179 | merged − master |
|---|---|---|---|---|---|
| planner | 55,111 / 8,698 | 55,198 / 8,712 | **55,198 / 8,712** | **0 / 0** | +87 / +14 |
| developer | 47,644 / 7,585 | 47,731 / 7,599 | **47,731 / 7,599** | **0 / 0** | +87 / +14 |
| qa | 50,585 / 8,109 | 50,672 / 8,123 | **50,672 / 8,123** | **0 / 0** | +87 / +14 |

(characters / words)

- **Merged vs T-179: identical.** A text diff of each seat's greeting differs on one line only, the scratch clones'
  ahead count (`213` vs `250`, same width).
- **Merged vs master: +87 per seat**, all on the label lines §8 named (`[legacy]` ×3, the "newest per seat and
  checkout" heading, "— 1 writing session(s) in the record"). This is §8's "true label cost +87", now measured
  without the artefact.
- **Against the brief's bar** ("no larger than §8's AFTER plus any difference master itself brought"): this run's
  absolute numbers are 5–8 characters below §8's (55,203 / 47,736 / 50,680) because the scratch path differs, which is
  why the three builds were measured in one pass rather than compared with §8's figures. **Within the pass, the merge
  adds nothing to T-179's AFTER, and master brought no greeting change of its own.** Source check: from `820dacd`
  to `aae0dce` master changed only `cli.ts` and the importer under `open-brain/src`, neither on `ob_start`'s path, and
  from §8's BEFORE (`be7ddfb`) to `aae0dce` nothing under `open-brain/` or `.agents/`.
- **Addition 1 remains not met, as in §8** (+87 over master). Unchanged by this round, and no change was made to
  reduce it.

## 7. Found on the way, for the planner

- **Master's CI has not run since `820dacd`.** Every push run on master (`820dacd`, `be7ddfb`, `d2685fd`, `aae0dce`;
  the last is `36223536483`) is "failure" in 2 seconds, with the annotation **"The job was not started because recent
  account payments have failed or your spending limit needs to be increased."** Master pushes run on GitHub-hosted
  `ubuntu-latest` (ci.yml:23); dispatches and PRs run on tcm and are unaffected. `sync`'s `ci-status` reports it as
  `master aae0dce conclusion: failure`, which reads as a test failure and is not one. **This is Aaron's (billing).**
- **`ci-status` cannot tell a job that never started from one that failed.** Same family as the instruments in
  `shared.md`: a "failure" whose job ran 0 steps.

## 8. Not done

- No `/end` (T-163 standing). The live `.agents/state.json` was not written; it is still v2 rev 131 in this checkout.
- No full local suite (brief). The full suite ran once, on tcm.
- No CHANGELOG entry: T-179 carried none and the release is Aaron's (D-019). The `[0.44.3] - Unreleased` section on
  master describes the importer fixes only; T-179's lines go there at release.

## 9. Branches pushed (all read back)

`loop/t179-merge` (`3c0bfdc`, then this handoff), and `loop/t179-merge-mut-{key-role, no-session-refusal, op-uuid,
retention-checkout, erasure-blind, guard-window, guard-blocks}`.
