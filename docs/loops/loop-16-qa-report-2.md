# Loop 16 — QA report 2: candidate `f7930d0`

**By:** Probe (QA seat; session uuid `6eab2c5c`) · **Date:** 2026-09-21 ·
**Candidate:** `f7930d0` (rev 13, tip of `loop/16-recall-trigger`), frozen and handed over by the
planner · **Base:** `origin/master` `4550ee5` · **Candidate 1:** `45ee2ab`, still an ancestor ·
**Criteria:** `docs/loops/loop-16-qa-criteria.md` at **`75f05eb`** (nine commits, none amending an
earlier one, all before the candidate they scored) ·
**Report 1:** `a13f3c5` + `ef79340` on this branch ·
**Brief:** `8457600` with twelve amendments, re-derived from the branch at the time of writing:
`1453e5f c43a31f 1051cae 5ab0ac4 6da5fa9 f28ed11 3db1365 29766dc 0c70b52 084cf18 e0c1dd2 87cbb9d`
(13 commits in `4550ee5..docs/loop-16-brief`).

---

## VERDICT — NOT ACCEPTED

**On one observable: A8's `R7`.** Injected entries must bump `recall_count` and
`last_recalled_at`; they do not. It is not implemented, it is not tested, and nothing in the
candidate would have gone red for it. **F3**, below.

**Everything else runs and passes, including the row the whole loop exists for.** F1 — the finding
that rejected candidate 1 — is fixed and proven where a call would actually live. **And the trigger
fired in a real session and injected entry 299 beside a live tool result**, which is the first time
in this project's record that the memory half has reached an agent at the moment of the act without
being asked.

This is the second narrow rejection in a row, and the shape is the same both times: **a ruling the
brief made, with no `§4` row to make its absence red.** The planner records that share as its own
(`87cbb9d`).

---

## 1. Conditions

| | |
| --- | --- |
| Identity | `git cat-file -t f7930d0` → `commit`; tip of the branch; **13 commits** from base; first commit still `90e314f`; `git merge-base --is-ancestor 45ee2ab f7930d0` → true, so nothing was squashed, rebased or reordered (`R9`). |
| Tree | `~/Worktrees/sia-qa` detached to `f7930d0`. `git status --porcelain` empty and `git rev-parse HEAD` equal **before the first observation and again after the last**; `build-info.json` commit `f7930d0` at both ends. **Not void.** |
| Prepared | No lockfile change, so no `npm ci`. `npm run build` 0, stamped `f7930d0`. `tsc --noEmit` 0. `analyze` 0 first try. `sync --check` 0 — **27 passed, 0 issues, 0 skipped**, `module-boundary [pass]` 69 files / 48 core. |
| Exit codes | Every one below written to a file and read back from the file. |

## 2. The diff decided the work (`§11`)

`45ee2ab..f7930d0` is **three paths**: `docs/loops/loop-16-developer-handoff.md` (M),
`open-brain/tests/trigger/no-network.test.ts` (A), `open-brain/tests/trigger/query.test.ts` (M).

**Nothing under `open-brain/src/` changed** — `git diff --name-only -- open-brain/src/` is empty.
So no FTS column weight was introduced (`R26`'s fence, checked separately: the src diff has zero
matches for `bm25|weight|column`), and every row that passed at `45ee2ab` is **re-run, not
re-reasoned**.

**A9 re-checked against BASE, not against candidate 1:** all six files under `tests/trigger/` are
status `A` from `4550ee5`. `query.test.ts` is modified only relative to candidate 1, and the branch
added it, so no pre-existing recall assertion is touched.

## 3. F1 is fixed — and I did not take the ten surfaces on anyone's word

`no-network.test.ts`: 3 tests, exit 0. Its **known positive** fires all ten surfaces — `fetch`,
`http.request`/`get`, `https.request`/`get`, `net.connect`, `net.Socket#connect`, `tls.connect`,
`dns.lookup`, `dns.promises.lookup` — asserts each throws, and asserts the wire recorded exactly
ten attempts. Fired, not counted.

**My own check went further**, because the candidate's third test simulates the mutant with a
wrapper *beside* the trigger rather than *inside* it: **I planted a real `fetch()` inside
`deriveQuery`, in the trigger's own source**, `tsc --noEmit` clean, and **the claim row went red** —
`expected [ …(7) ] to deeply equal []`. The tripwire catches a network call where one would
actually live.

## 4. A7 — it fired. And the evidence source the row names does not exist.

Two commands in this session, in the QA tree, with the hook registered:
`echo "A7 probe: the G-039 shape against a harmless target" 2>&1 | tail -8; echo $?`, then
`git status --porcelain`.

**Entry 299's `ACTION` arrived beside the first tool result, unasked. Nothing arrived beside the
second.**

**But the transcript A7 names is not on disk for this session.**
`~/.claude/projects/C--Users-melve-Worktrees-sia-qa/` holds three `.jsonl` files and none is this
session's uuid; none contains the probe string. A recursive search under `~/.claude` found the
string in exactly one file — `open-brain/knowledge-v2.db-wal`, the trigger's own fire row. So the
clause *"read from the transcript, never from the seat's own account"* **cannot be satisfied**, and
my account of what I saw is **not evidence**. I do not score A7 on it.

**What I score it on is stronger than narration and weaker than the transcript, and I say which:**
the trigger's own fire rows, on disk, written by the candidate, keyed to my live session uuid.

| fire | time | session | command | derived query | state | ids |
| --- | --- | --- | --- | --- | --- | --- |
| #2 | 04:08:29.325Z | `6eab2c5c` | `echo "A7 probe: …" 2>&1 \| tail -8; echo $?` | `"tail" "exit" "code"` | **injected** | `[299]` |
| #3 | 04:08:34.959Z | `6eab2c5c` | `git … status --porcelain; …` | *(none derived)* | **not-asked** | `[]` |

**A7: PASS on firing and on the two states; the transcript clause UNTESTED**, and the finding is
about the instrument rather than the candidate — which is what the row's own blind spot said it
would be. Where this session's transcript actually lives is a close-out question (`87cbb9d`).

**A natural experiment nobody wrote:** fire #6 is `tail -20 "…"` from another session — a
single-stage `tail`, no pipeline — recorded **not-asked**, query none derived. `R18`'s rule firing
on a real command in production.

## 5. The registration was machine-wide, and other seats fired it

Fires #1 and #6 carry session uuids that are not mine, and #1's command text names the planner's
scratchpad; the planner confirms #1 and #6 were its own and the developer's.
**`~/.claude/settings.json` arms the hook for every Claude Code session on this machine, in every
project — not only the QA tree.** The brief's wording, *"register it against the QA tree's build
for the duration of the probe"*, describes the **build** correctly and the **blast radius** not at
all.

Not a candidate defect — `G-030` owns the absolute-path registration — but the probe reached other
seats' sessions for four minutes, and anyone registering it for longer should know that first.

## 6. The registration act, and the restore that was not one

**Authority: Aaron's word, typed directly into the QA session** (not relayed), for this act, at
`f7930d0`.

- **Registered** `2026-09-21T04:08:16Z`; **restored** `04:12:22Z`; window **4m 06s**.
- JSON added, exactly:
  `{"matcher":"Bash","hooks":[{"type":"command","command":"node \"C:/Users/melve/Worktrees/sia-qa/open-brain/build/cli-recall-trigger.js\"","timeout":10}]}`
- `PostToolUse` was `[]` before — **read, not assumed** — and is `[]` after, read back and
  re-parsed. Other hook events (`PreToolUse`, `SessionEnd`, `SessionStart`, `Stop`) intact
  throughout.
- **settings.json sha256 `e28494d7b4965391` before and after, 7224 bytes both — byte-identical.**

**And the first restore was not.** My register/remove script wrote `json.dumps(indent=2)` without
`ensure_ascii=False`, so it escaped every em-dash in Aaron's file to `\u2014`; 7224 bytes became
7245, and it was that way for the whole window. Semantically identical, byte-different. **Caught
only because I hashed against a backup instead of trusting "`PostToolUse` is `[]` again"**, then
restored the backup verbatim and re-verified. *"Restored" and "parses the same" are different
claims, and the weaker one reads like the stronger.* A semantic restore of someone else's config is
not a restore.

## 7. A8 — passes, except `R7`

From the **candidate's** build. (`ob_stats` through MCP runs the **main tree's** build, which has
no trigger code and cannot show fire counts at all — a property of where the server runs, not of
the candidate. Worth stating because a green `ob_stats` there would have meant nothing.)

- **`recall_log` census carries `hook 1`**, distinct from `explicit 415` / `start 275` /
  `checkpoint 116` / `unspecified 11`. `R6` holds, and the candidate asserts it **by name** rather
  than as *not explicit*, which would pass on `unspecified`.
- **`trigger_fires`: injected 1, not-asked 5, silent 10.** Three states, counted separately.
- **Zeros are printed always:** `server.ts:1178` seeds `{not-asked: 0, silent: 0, injected: 0}`
  before filling from the query. Verified from source.
- **`R8`, resolved by calling `getSessionRecalledIds` directly and NOT by running my own `/end`:**
  `[299, 349, 423, 589, 593]`. 299 present; the other four are from my explicit `ob_recall` earlier
  in this session, which is correct — both reached the agent.
- **`R5` holds by construction:** every non-injected fire has `injected_ids` `"[]"` — all ten of
  mine — so no looked-at entry can enter the rated set, by construction rather than by a filter.
- **`trigger_fires`' CHECK constraint** (re-confirmed at this candidate): three legal states
  insert; `'asked'`, `''`, `'INJECTED'` and `'not_asked'` are all refused by the database; the row
  count afterwards proves the refusals wrote nothing.

## 8. F3 — `R7` is not implemented, and no test would have caught it

**Required (`R7`, amendment 1 `1453e5f`):** *"injected entries bump `recall_count` and
`last_recalled_at`; looked-at entries do not. Injected reached the agent; that is what the counter
means. `ob_list` will show it, and that is correct."*

**Live evidence.** Entry 299 was injected at `04:08:29.325Z` — the `recall_log` row with
`recall_trigger = 'hook'` proves it. Its `knowledge_index` row reads
**`recall_count 11, last_recalled_at "2026-09-20 23:52:51"`** — six hours *before* the injection,
and consistent with my own explicit `ob_recall` earlier in the session. **The injection did not
bump it.**

**Code evidence.** `recall_count` and `last_recalled_at` appear **zero** times in
`open-brain/src/trigger/`, **zero** times in `cli-recall-trigger.ts`, **zero** times in
`open-brain/tests/trigger/`, and **zero** times in the whole `4550ee5..f7930d0` diff. The only
writers are `server.ts:866` (`ob_recall`'s handler) and `db-v2.ts:491`.

**Instruments validated before the zeros were believed:** the same greps over the same paths return
**21** for `export` in `src/trigger/`, **139** for `expect` in `tests/trigger/`, and **0** for a
nonsense token.

**So: a ruling made at amendment 1, never built, never tested, never noticed — because nothing
asserts it.** It is `G-035`'s shape exactly: an instruction that exists in a document and fires
nowhere.

**Why it matters rather than being bookkeeping.** `recall_count` is what `ob_list` shows and what
maturity promotion counts. If hook-injected recalls never bump it, **the entries the trigger
surfaces are invisible to the maturity lifecycle** — and making *does the memory half get used*
answerable is the loop's whole purpose. The fires table answers it for **fires**; `recall_count` is
the part that would have answered it for **entries**.

## 9. A10 — reproduced with my own method

60 samples per arm after a discarded warm-up, 599-document scratch store, nothing else running,
hook **not** registered (A10 measures the hook process, which does not need it).

| arm | p50 | p95 | max |
| --- | --- | --- | --- |
| interpreter floor (`node -e ""`) | 60.2ms | **70.0ms** | 73.9ms |
| not-asked (`git status --porcelain`) | 209.4ms | **251.8ms** | 317.8ms |
| injected (the G-039 command) | 211.3ms | **255.0ms** | 275.4ms |

Interpreter floor as a share of the injected p95: **27%** (the developer measured 21%).
**Sanity, so the timing is not measuring nothing:** the injected arm exits 0 and emits
`additionalContext`; the not-asked arm exits 0 with empty stdout.

Mine run slightly faster than the developer's and say the same thing: **the common case pays about
a quarter-second on every `Bash` call to ask the store nothing**, and interpreter startup is a
minority of it. `R22` ruled the disposition; not scored.

## 10. A1 under `R26`, and the rest re-run

**A1(a)** and **A1(b)** pass; `query.test.ts` is 5 tests, exit 0. **The rank is actually printed**,
which was the one failure mode of a report-not-assert row — verbatim from the output:
*"A1(b) entry 299 ranks 4 of 11 against ten same-topic competitors (top: migration-exit-code)."*
Matches `e0c1dd2`.

**The guard is not weakened:** it names all ten decoys and asserts the live set is exactly those
plus 299. **I dropped one decoy and required it red — it goes red**, with a mutation script that
asserted the edit landed (10 → 9) before running anything.

**The fixture is not stacked either**, the check `e0c1dd2` added: entry 299 is **566** characters;
the ten decoys are **426–545**. **One residual, reported not scored:** all ten are still somewhat
shorter than 299 (75–96% of its length), a one-directional advantage much smaller than the stacked
version's 42–61%, and probably not removable — genuine same-topic prose longer than 566 characters
is a different kind of document.

**Targeted set**, my enlarged version: **15 files, 207 tests, exit 0**.
**Full suite alone:** **71 files, 1027 tests, all passed, exit 0**, no unhandled error, 110.97s.
**No victims, so no `R12`(i)/(ii)/(iii) case arises.**

## 11. `G-042` — a seventh sighting, and it is clean

| run | tree | code state | tests | exit |
| --- | --- | --- | --- | --- |
| mine ×2 | QA | base `4550ee5` | 974 (1 failed, a different victim each) | 1 |
| developer | developer | rev 2 `ee74fd1` | 986 | 0 |
| developer | developer | rev 3 `12b5aeb` | 997, 0 failed | 1 |
| developer | developer | rev 4 `405a5e3` | 1008, 0 failed | 1 |
| developer | developer | rev 5 `1afb04c` | 1021 | 0 |
| mine | QA | candidate 1 `45ee2ab` | 1021, 70 files | 0 |
| **mine** | **QA** | **candidate 2 `f7930d0`** | **1027, 71 files** | **0** |

Developer rows relayed from `5ab0ac4` §3, `6da5fa9` §3, `3db1365` §2; the last two are mine.

## 12. What could not be verified

- **A7's transcript clause** — no transcript on disk for this session.
- **That a seat *applies* what the trigger surfaces.** Unchanged, and the loop's own premise was
  demonstrated against it while the candidate was being built (`29766dc` §1).
- **That the floor or the ranking is right on any store but this one, on any day but today**
  (`R19`, and `R26`'s gap).
- **The main-tree-only condition** — Aaron's untracked `PRD.md` — **unrun**.
- **`G-042` on any machine but this one.** Seven sightings, one machine.

## 13. What the checks cannot see

Unchanged from report 1 §9, plus: **the reminder's arrival in the model's context is now observable
to nobody but the model.** The fires table proves the hook emitted; the transcript would have
proved the host delivered; it does not exist here. Those are different claims and only the first is
evidenced.

## 14. Probe shapes (after the verdict)

Report 1 §10's seven shapes still apply. New for this candidate:

8. **A real network call inside the trigger:** plant `globalThis.fetch(...)` at the top of
   `deriveQuery` on a scratch worktree, `tsc --noEmit` clean, run `no-network.test.ts`, require the
   **claim** row red — not the simulation row.
9. **Fixture-drop guard:** remove one entry from `FIELD_DECOYS` with a script that **asserts the
   edit landed (10 → 9) and refuses to write otherwise**, then require the by-name guard red.
10. **Decoy length distribution:** parse `FIELD_DECOYS` and `ENTRY_299` out of the test source and
    report the character range against 299's 566.
11. **Live fire evidence:** open the live store read-only and read `trigger_fires` and
    `recall_log WHERE recall_trigger = 'hook'` by session uuid.
12. **A10:** 60 samples per arm around `spawnSync` of the built entry point, plus a sanity call per
    arm proving the injected arm emits and the not-asked arm does not.
13. **Registration:** back up first, hash before and after, refuse if `PostToolUse` is non-empty,
    write, **read back and re-parse**, and on restore **compare bytes to the backup, not JSON to
    JSON**.

## 15. Errors of mine in this round

1. **A restore that was semantic and not byte-exact** (§6). Self-caught by hashing against a
   backup.
2. **A type-invalid mutant.** My first planted `fetch` cast `globalThis` to an object with a
   `fetch` property and then called *the object*; `tsc` gave `TS2349`, and at run time it threw
   into my own `catch` and never reached the wire — so **the test passed and the mutant proved
   nothing**. Caught by running `tsc` on the mutant, which is the rule that has now earned its
   place twice in one session.
3. **A heredoc'd mutation script whose backslashes were eaten**, so its regex never compiled, the
   fixture was never modified, and the test then passed against an unmodified fixture. Read as exit
   codes alone that is *"the guard does not detect nine decoys"* — **a false finding against a
   guard that works**. Fourth instance of one class this session and the first pointing at a false
   accusation rather than a false pass. The fix went into the script, not my intentions: it now
   asserts the edit landed and refuses to write otherwise.
4. **Two listeners running at once**, against Clark's one-listener rule: I armed a new wait while
   the previous one was still running. Both fired and **both delivered the same turn**, so nothing
   was missed — the exposure was double-acting on one instruction, not data loss. Recorded because
   the outcome was luck rather than design.

## 16. Candidate 3 (`R27`)

One commit on top of `f7930d0` implementing `R7` — the injection path writing `recall_count` and
`last_recalled_at` — with a **two-direction test** (injected bumps; looked-at does not) and a **red
mutant**.

**Re-run by the diff.** If the `src/` change is confined to the injection path's writes to those
two columns: re-run the targeted set, A5, A8's unit rows and the new test, and **the live evidence
from `f7930d0` stands with no second registration**. If the diff touches anything else, A7 and
A8-live re-run on a new word from Aaron.
