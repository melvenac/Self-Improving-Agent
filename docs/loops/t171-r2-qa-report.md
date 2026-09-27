# T-171 round 2 (note authorship), candidate `a78a883`: QA report (QA seat, record session 158)

**By:** the QA seat, record session **158**, headless, launched by `docs/loops/qa-158/drive.ps1` (Claude session
`b54689fd-34ed-4e4d-9bec-22f86af61585`). 2026-09-27 (UTC; the drive started 04:41:55Z). **Machine:** `DESKTOP-O4EGB1E`
(`hostname` and `$COMPUTERNAME`). **Defender exclusions** (`drive.meta`): `C:\qa-scratch`, `C:\qa-tmp`. Probes and
mutants ran with `TEMP=TMP=C:\qa-tmp`; the one full-suite control ran with the default `TEMP` (`QA_DEFAULT_TEMP`,
`C:\Users\AARONM~1\AppData\Local\Temp`, not excluded), alone. **Model and effort:** `claude-opus-5-5` on every model
field of this run's stream (the init line and 163 of 163 assistant entries, counted just before the commit; no other model)
(`%USERPROFILE%\sia-qa158\run-0.jsonl`); effort **`high`**, read from this process's command line (`claude.exe -p …
--model claude-opus-5-5 --effort high`, pid 10088).
**Dispatch:** `docs/loops/t171-r2-dispatch-qa.md` (tree at `261a9f5`). **Candidate:** `a78a883` on
`origin/loop/t171-r2` (handoff tip `5a3763a`, `docs/loops/` only after `a78a883`), stacked on T-171 `b371176`.
**Scored:** only what round 2 adds. `git diff b371176 a78a883 -- open-brain/` is `state-writer.ts` (6+/3-, all in
`replaceNote`), `server.test.ts` (+12) and `state-writer-notes.test.ts` (+62). **Rulings used:** the QA 144 section of
`docs/loops/t171-bootstrap-rulings-qa144-qa145.md`.

## Verdict

**ACCEPT `a78a883`.** The two items the ruling made merge-blocking hold:
- **T171-D1** holds on QA 144's C2h shape and on seven variants.
- **T171-D3** holds: QA 144's three mutants, re-applied to `a78a883`, are each killed on tcm by the row the handoff
  names.

Nothing regressed. QA 144's checks 1–4 and the T-169 shape hold on the new tip, and the full suite passes: 1333 of 1333
locally with Defender on, and 1331 passed with 2 skipped on the developer's tcm run.

**T171-D2 is only half fixed.** It holds as the dispatch words it but not as the ruling words it:
- **Multi-line notes: it holds.** The REPLACED line now quotes the first old line the new text does not contain. The
  dispatch's three edits pass on multi-line notes.
- **SIA's real notes: nothing changed.** Every one of the 70 notes in the record is a single line, because appends join
  with `" — "`, not a newline. On a one-line note the new expression is byte-identical to r1's.
- **QA 144's own D2 row (C4b) still fails, with the same output.** It is the real T-169 note, kept for its first 200
  characters. The line still quotes 120 characters of text that is still in the note.

That, a fallback that also quotes kept text, and five new surviving mutants are Low. None loses text without a report.

- **Holds:**
  - **D1.** A replace that removes nothing keeps the previous authors and adds the writer. This holds through
    `update_task`, `close_task` and the `ob_state` door, and for prepended, surrounded, identical, own and mixed
    supersets.
    - An unrecorded (`null`) note stays `null`, and so does an unregistered writer's superset.
    - **B's next unflagged replace is refused naming A.** That is QA 144's C2h, now inverted. With the flag it goes
      through and says `text by other session(s) removed: A`.
  - **D3.** Each of QA 144's three mutants is killed on tcm:
    - `dry-run-hides-replace`: 1 red, `36295576856`;
    - `removes-by-length`: 1 red, `36295578461`;
    - `superset-foreign-unflagged`: 1 red, `36295580131`.

    All three reds are `AssertionError`s. Before round 2 these three survived the full suite (QA 144's runs
    `36286217950`, `36286220756`, `36286223642`).
  - **Regressions.** QA 144's `c-attack` passes, re-run whole on `a78a883` against master rev 133 migrated to v3: 32
    rows HOLD, including C2h, which was BROKEN on `b371176`. The one BROKEN row is C4b, the D2 row above. The T-169
    shape holds.
- **Defects (all Low):**
  - **T171R2-D1:** D2 is line-granular, and SIA's notes are one line. On the record's real shape the REPLACED line still
    names kept text as removed (C4b, D2d).
  - **T171R2-D2:** when every old line still appears somewhere in the new text, the expression falls back to the old
    first line, which is kept. Two shapes trigger it: a removed duplicate line, and a removed line that is a substring
    of a kept one (D2c).
  - **T171R2-D3 (test gaps):** five of my seven mutants survive, three of them on tcm, and none is equivalent. Two are
    D1 regressions, one is a D2 regression, and two are in the dry-run and removal-detection neighbourhood of QA 144's
    D3.

## The dispatch's items

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | **T171-D1** | **Holds.** C2h shape: A writes `"A wrote this."`; B's flagged superset → `REPLACED: 13 chars -> 27 chars; no text removed`, `note_by [A, B]`; B's unflagged replace → **refused**, `T-009's note holds text written by session uuid-A`; with the flag → accepted, `…; text by other session(s) removed: uuid-A`, `note_by [B]`. Null stays null (and the next unflagged replace is refused as `unrecorded session`). The same on SIA's migrated 776-char T-003 (QA 144's own C2h legacy row): flagged superset accepted, the unflagged replace refused as unrecorded. `close_task` and the door (dry run and write print the same line; the dry run leaves `note_by` alone) agree. | D1a–D1e in `d-r2-a78a883.out`; C2h in `c-attack-r2.out` |
| 2 | **T171-D3** | **Holds.** QA 144's three mutants, cherry-picked onto `a78a883` (each diff checked equal to the driver's edit), each killed locally (1 of 154 in the 8 note files) and on tcm (1 of 1333) by the row the handoff names. | Mutants; `ci-qa158.out` |
| 3 | **T171-D2** | **Holds on multi-line notes only.** Prefix-keeping `kept line\ngone forever` → `"gone forever"`; middle deletion `one\ntwo\nthree` → `"two"`; one word changed, every line kept → `"gamma delta"`; CRLF → `"gone"`. **On SIA's shape (one line), unchanged from r1:** C4b on the real T-169 (3,256 chars, one line, first 200 kept) prints `removed text begins: "Session 78, planner, on Aaron's word ('the agent started work and asked what the project was for halfway through the loo"`, all of it still in the new note, identical to QA 144's C4b output. The same three edits on an 881-char one-line note (the record's median length) all quote the kept first 120 characters. Under 120 chars the whole old line is quoted, which as a string is gone but begins with kept text. **Fallback:** a removed duplicate line (`retry\nok\nretry` → `retry\nok`) quotes `"retry"`; a removed line that is a substring of a kept one (`one\nt\nthree` → `one\nthree`) quotes `"one"`. Both quotes are kept text. | D2a–D2d in `d-r2-a78a883.out`; C4b in `c-attack-r2.out` |
| 4 | **Regressions** | **Hold.** QA 144's checks 1–4, by re-running `c-attack` unchanged but for the build it clones (`a78a883`): C0 (70 of 70 notes null after migrate), C1a–C1i, C2a–C2i, C3a–C3c, C4 all HOLD. **The T-169 shape:** bare `note` refused, the unflagged replace of the migrated note refused, `append_note` keeps it (`+59 chars (3256 -> 3315)` in both runs), the session's own replace reported with sizes in the dry run and the write. | `c-attack-r2.out` |
| 5 | **My mutants** | **7 run; 2 killed, 5 survive,** none equivalent. See Mutants. | `mutants-local*.txt`, `survivors-r2.out`, `ci-qa158.out`, `fullsuite-local-mutants.out` |

## Check detail

**Scratch.** `C:\qa-scratch\qa158\cand` is a full clone of `a78a883` (`--is-shallow-repository` false), with
`npm ci` and `npm run build` (`build stamped a78a883`). `c-attack-r2.mjs` is QA 144's `c-attack.mjs` with only the
checkout sha and one commit message changed. It clones the candidate into scratch, writes `origin/master`'s
`state.json` (`36a33bc`, rev 133, sha256 `10fa61ea…`, the same file as QA 144) and migrates it with the candidate's own
CLI. `d-r2.mjs` and `survivors-r2.mjs` use the build's own test fixture in a temp dir. Every store is in scratch.
Nothing touched a live `state.json`.

**Why D2 cannot help SIA's notes.** On a one-line note `old.split(/\r?\n/)` is `[old]`. The quote is only printed when
`removes` is true, i.e. `!text.includes(old)`. So `find` returns `old`, and the quote is `old.slice(0, 120)`, which is
r1's `firstLine` exactly. In master rev 133, all 70 non-empty notes are one line, 69 of them are longer than 120
characters, and the median is 881. `NOTE_JOIN` is `" — "`, so `append_note` never adds a newline either. The
developer's D2 row and the file's `LONG` fixture both use multi-line notes, which is why the row passes.

**D1f and D1f', the ruling's boundary (reported, not scored).** A flagged replace that removes *any* text still resets
`note_by` to the writer alone, even when it keeps another author's text:
- **Named authors.** On `"A's finding. — B's first draft."` (`[A, B]`), B's flagged edit of its own half is reported
  `…; text by other session(s) removed: uuid-A` and leaves `note_by [B]`. B's next **unflagged** replace then removes
  A's finding, and the line names no other session.
- **An unrecorded note.** The same happens on a `null` note edited by one word, which is the T-171 workaround shape
  ("pass it back whole with the edit inside it"). The ruling scopes D1 to "a replace that removes nothing", so this is
  outside it. See Open 2.

## Mutants

The driver is `mutants-qa158.cjs`, QA 144's machinery with a new mutant list:
- each anchor must match exactly once and land;
- `tsc --noEmit -p .` must exit 0, or the mutant is VOID (none was);
- the 8 note-related test files run through vitest's JSON reporter;
- the sources are restored and hash-checked after each mutant (`restored: true`).

Then one commit per mutant on `qa/t171-r2-mut-<id>` from `a78a883`, pushed with `push-qa.mjs` and read back. Six ran on
tcm (the budget), and two ran the full suite locally instead.

| Mutant | What it breaks | Branch head | Local (of 154) | Full suite | Result |
|---|---|---|---|---|---|
| **`dry-run-hides-replace`** (QA 144) | `ob_state`'s dry run drops every REPLACED line | `6e5a749` | 1 | tcm `36295576856` tcm-2: **1 failed** of 1333 (`server.test.ts` "ob_state dry run of replace_note prints the REPLACED line") | **KILLED** |
| **`removes-by-length`** (QA 144) | removal only when the new note is shorter | `bf3f56c` | 1 | tcm `36295578461` tcm-1: **1 failed** ("T171-D3: a longer replacement that drops the old text …") | **KILLED** |
| **`superset-foreign-unflagged`** (QA 144) | a superset of another session's note needs no flag | `f3968e8` | 1 | tcm `36295580131` tcm-2: **1 failed** ("T171-D3: a superset replace of another session's note is refused without the flag") | **KILLED** |
| `d1-superset-prefix-only` (D1) | "removes nothing" judged by `startsWith(old)`: a **prepended** superset resets `note_by` to the writer | `f0cef83` | **0** | tcm `36295581720` tcm-2: 1331 passed, 2 skipped | **SURVIVES** |
| `d1-unregistered-superset-keeps` (D1) | an unregistered writer's superset leaves `note_by` as it was | (local only) | 2 | not run | killed, **but only through the empty-note path** (schema: `[]` with a non-empty note), not by a superset row |
| `d1-unregistered-superset-keeps-nonempty` (D1) | the same, for a non-empty old note | `b94d4e4` | **0** | local full suite (`C:\qa-tmp`): 1333 of 1333 passed | **SURVIVES** |
| `d2-kept-by-prefix` (D2) | a line counts as kept only if the new note **starts** with it | `28ceab2` | **0** | tcm `36295583540` tcm-1: 1331 passed, 2 skipped | **SURVIVES** |
| `d2-last-missing-line` (D2) | quotes the **last** missing line | (local only) | 2 | not run | KILLED (the 1,869-char `LONG` rows) |
| `dry-run-hides-foreign-replace` (D3 class) | the dry run drops a REPLACED line only when it removes **another session's** text | `cbcb909` | **0** | tcm `36295585003` tcm-1: 1331 passed, 2 skipped | **SURVIVES** |
| `removes-by-head` (D3 class) | removal judged by the old note's **first 120 chars** | `52742c1` | **0** | local full suite (`C:\qa-tmp`): 1333 of 1333 passed | **SURVIVES** |

Every tcm red is an `AssertionError`: two error lines per run plus the step's exit line, and no `TypeError`, timeout or
infrastructure failure. Every run collected 87 files and 1333 tests, and `test-windows` was **skipped** on all six.

**The five survivors are not equivalent.** In `survivors-r2.out`, each mutant's build differs from the candidate's on its
own row and on no other:

| Mutant | Candidate `a78a883` | Mutant build |
|---|---|---|
| `d1-superset-prefix-only` | B's flagged prepend to A's note: `no text removed`, `note_by [A, B]`; B's unflagged replace **refused** | the prepend is reported `removed text begins: "A's finding."; text by other session(s) removed: uuid-A` (false), `note_by [B]`, and B's next unflagged replace **erases A's text** naming no one. This is D1 back, for prepends. |
| `d1-unregistered-superset-keeps-nonempty` | an unregistered superset of A's note → `note_by null`; A's unflagged replace refused | `note_by [A]`: A then replaces unflagged and erases the unknown writer's text |
| `d2-kept-by-prefix` | `intro / kept second line / gone third line` → first two lines: quotes `"gone third line"` | quotes `"kept second line"`, which is kept (the D2 defect, for any kept line after the first) |
| `dry-run-hides-foreign-replace` | the dry run of B's flagged replace of A's note prints the REPLACED line with `text by other session(s) removed: uuid-A` | the dry run prints **no NOTE CHANGE line**, only for the destructive case (the T-169 finding again); the write still prints it |
| `removes-by-head` | the session's own 881-char note truncated to 300 chars: `removed text begins: …` | `881 chars -> 300 chars; no text removed` while 581 chars went, and `note_by` goes through `appendedBy` |

## The full suite and CI

- **The one full local suite, the Defender-on control:**
  - `a78a883` in `C:\qa-scratch\qa158\cand`, a full clone, with
    `TEMP=TMP=C:\Users\AARONM~1\AppData\Local\Temp` (the default, from `QA_DEFAULT_TEMP`; not excluded);
  - ran 04:53:21Z–04:56:33Z, alone, with no probe running;
  - **87 of 87 files, 1333 of 1333 tests passed, 0 skipped**, exit 0 (`fullsuite-a78a883.summary`). The two rows that
    skip on tcm ran here.
- **The developer's CI, read per test by me** (`ci-dev.out`, same `ci-read.mjs` as QA 144, sha256 `1a735e5e…`). Both
  runs match the handoff:
  - `36292359527`, `loop/t171-r2-red` @ `1086335`, tcm-1, failure: **3 failed, 1328 passed, 2 skipped (1333)**, 1 of 87
    files. The three are the two D1 rows and the D2 row, all `AssertionError`. The two D3 rows passed at red, as they
    should: they pin behaviour `b371176` already had.
  - `36292477609`, `loop/t171-r2-green` @ `a78a883`, tcm-2, success: **87/87 files, 1331 passed, 2 skipped (1333)**,
    no error lines.
- **My CI:** six runs on tcm, the full budget. All were `workflow_dispatch` on `qa/t171-r2-mut-*` with `hosted=false`
  and `windows=false`, so `test-windows` was skipped and no laptop or hosted job ran. No run was made for the
  candidate itself: the developer's green run is its record, and my local full suite agrees with it.

## What could not be verified

- **GitNexus `impact` / `detect_changes`** and the MCP server are not available to this seat. I re-derived the callers
  with `git grep` at `a78a883`:
  - `replaceNote` is called only from `editNote`, which serves `update_task` and `close_task`;
  - `appendedBy` is called from `appendNote` and `replaceNote`.
- **A real MCP reconnect** with the new build was not run. I exercised the door by calling the exported `handleSetSession`
  and `handleState`.
- **The developer's two local mutants** ("the old sole-author line" and "the old first line") were not re-run by me.
  Their red run `36292359527` is the same evidence: its `src/` is `b371176`'s, which is exactly those two lines
  reverted.
- **Two of my survivors ran the full suite locally only:** `d1-unregistered-superset-keeps-nonempty` and
  `removes-by-head`. The tcm budget was spent on QA 144's three and one survivor per defect. The local and tcm counts
  agreed on all six mutants that ran in both places.
- **My proposed fix for T171R2-D1** (below) is a suggestion only. I did not build or test it.

## Defects

| Id | Severity | Defect | Where | Fix |
|---|---|---|---|---|
| **T171R2-D1** | Low (report wording) | T171-D2 is line-granular. On a one-line note, which is every note in SIA's record (70 of 70; appends join with `" — "`), the REPLACED line still quotes the old note's first 120 characters. When the edit falls after character 120 (69 of 70 notes are longer), that is all kept text: QA 144's C4b, unchanged, and D2d. The ruling's criterion ("quotes text that was actually removed, or it says 'old text began:'") is not met on the record's real shape. Sizes are always right, and nothing is lost unreported. | `state-writer.ts` `replaceNote`, the `quoted` line | Quote from the first differing character, or reword. E.g. `let p = 0; while (p < old.length && old[p] === text[p]) p++;` and quote `old.slice(p, p + 120)`. Or print `old text began: "<first line>"` whenever the quote is still in the new note, which the ruling already allows. Pin it with C4b on a **one-line** note. |
| **T171R2-D2** | Low (report wording) | The fallback: when every old line still appears somewhere in the new text but `removes` is true, the quote falls back to the old first line, which is kept. Two shapes: a removed duplicate line, and a removed line that is a substring of a kept line. | the same `?? old.split(/\r?\n/, 1)[0]` | The same fix covers it. |
| **T171R2-D3** | Low (test gap) | Five of my mutants survive the full suite, three on tcm (`36295581720`, `36295583540`, `36295585003`) and two locally. None is equivalent. Two let a D1 regression through (a prepended superset; an unregistered superset). One lets D2 regress for any kept line after the first. Two sit in the dry-run and removal-detection neighbourhood of QA 144's D3: the dry run hiding only the destructive foreign replace, and removal judged by the first 120 chars. | `state-writer-notes.test.ts`, `server.test.ts` | Five rows: a flagged **prepend** superset keeps `[A, B]`; an unregistered superset of `[A]` gives `null`; a kept **second** line is not quoted; the door's dry run of a **flagged foreign** replace prints the line with its `text by other session(s)` clause; a long own note truncated after character 120 reports `removed text begins`. |

## Disagreements

- **With the handoff's D2 paragraph,** "A kept first line is no longer named as removed." That is true only when the note
  has more than one line. SIA's notes do not, and the handoff's row and the file's `LONG` fixture are both multi-line.
  See T171R2-D1.
- **With the handoff's mutant table,** where each protection has one mutant: my `d1-superset-prefix-only` and
  `dry-run-hides-foreign-replace` show that two protections each have a one-token neighbour that CI does not see.
- None with the ruling's D1 or D3. On D2 I score against the ruling's wording, because the dispatch's wording ("the first
  old line the new text does not contain") is met while QA 144's own row still fails. I report the two wordings
  separately rather than pick one.

## Error entries

- **My mutant driver's first two versions did not parse.** I generated them by string rewriting QA 144's script: the
  first put literal newlines inside two anchors, and the second cut the mutant list at a `];` inside a string.
  `node --check` caught both before any mutant ran. I then fixed the file by hand, and every run in this report is on
  the parsing version.
- **One of my `d-r2.mjs` rewrites** inserted the 881-char fixture into the wrong block (the first `const rows = [`). I
  noticed because the long rows were missing from the output, fixed it, and re-ran the whole script. The evidence file
  is from the re-run.
- **D1f' first targeted the fixture's T-003, which is `done`,** so the op was refused for its status and not its author.
  I rewrote the row on T-009 with a `null` note before the evidence run.
- **`ci-read.mjs` first ran outside a git repository,** and `gh` failed to find the repo. I re-ran it from the mutant
  worktree.
- **A misleading `tsc=0` line.** In the `mut` worktree, which has no `node_modules`, my per-branch `tsc` call failed to
  load, and the `echo` printed `tsc=0` from the pipe's `head`. That line is not evidence. The real `tsc --noEmit` check
  for every mutant is the driver's, in `cand` (no VOID).
- **Identity.** The shared `sia-qa` repository config says `QA 144 (Claude)`. I committed this report with
  `git -c user.name="QA 158 (Claude)"`, so the shared config is unchanged, and I set `QA 158 (Claude)` in my scratch
  clone for the mutant commits. I amended the three re-applied QA 144 mutant commits to my identity and a message naming
  the original sha, so a branch is not read as QA 144's.

## Open for the planner

1. **T171R2-D1/D2 (D2 on SIA's real shape): fix in a round 3, or accept?** In my verdict it does not block. It is
   wording only, and the sizes are always right. My recommendation: take it only if another round happens for another
   reason. Either the one-expression "first differing character" quote, or the ruling's own fallback wording, pinned
   with C4b on a one-line note. Otherwise record in the close-out that "removed text begins" quotes the note's start on
   a one-line note.
2. **D1's boundary (D1f and D1f'):** a flagged replace that removes *anything* makes the writer the sole author, even
   when it keeps most of another session's text. After that, the writer's next unflagged replace erases that text.
   This is exactly the T-171 workaround ("pass it back whole with the edit inside it"), and after migration every SIA
   note needs the flag for it (QA 144's Open 2 and 3). The ruling scoped D1 to "removes nothing", so I did not score it.
   Two options:
   - accept it as the meaning of the flag ("I take responsibility for this note");
   - keep the prior authors on any flagged replace that is not to `""`. That is safe, but notes then keep authors
     forever.

   My recommendation: accept it, and say so in the close-out next to QA 144's Open 2, because the workaround text now
   both needs the flag and transfers ownership.
3. **T171R2-D3's five rows:** these fit with the merge or right after it. The two I would not leave out are the flagged
   prepend superset (D1 made flagless by one token) and the door's dry run of a flagged foreign replace (the T-169
   finding, for its most destructive case).

## Reproduce

Scripts are in `docs/loops/qa-scripts-t171-r2/` and outputs in `…/evidence/`. The scratch root is `C:/qa-scratch/qa158`:
- `cand/` is the candidate: a full clone, built, with `open-brain/qa-builds/<id>/build` holding each survivor's build;
- `mut/` is a worktree of `cand` holding the mutant branches;
- `live-master.json` is `origin/master:.agents/state.json` at `36a33bc`, sha256
  `10fa61eafbe8ae0f8a75f4692091591a248056fe8c61c65abd92867a2d2f6234`.

```
node c-attack-r2.mjs   C:/qa-scratch/qa158/cand C:/qa-scratch/qa158 C:/qa-scratch/qa158/live-master.json
node d-r2.mjs          <open-brain root of a build> <scratch dir>
node survivors-r2.mjs  <dir holding build/> <open-brain root for tests/fixtures> <scratch dir>
cd <clone>/open-brain && node mutants-qa158.cjs <outdir> [id ...]      # local; --apply <id> for a branch
node ci-read.mjs       <run-id> ...                                    # from inside a git checkout
```

## Branches pushed

All were pushed through `push-qa.mjs` only, and each was read back:
- `qa/t171-r2-mut-dry-run-hides-replace` `6e5a749`;
- `qa/t171-r2-mut-removes-by-length` `bf3f56c`;
- `qa/t171-r2-mut-superset-foreign-unflagged` `f3968e8`;
- `qa/t171-r2-mut-d1-superset-prefix-only` `f0cef83`;
- `qa/t171-r2-mut-d2-kept-by-prefix` `28ceab2`;
- `qa/t171-r2-mut-dry-run-hides-foreign-replace` `cbcb909`;
- `qa/t171-r2-mut-removes-by-head` `52742c1`;
- `qa/t171-r2-mut-d1-unregistered-superset-keeps-nonempty` `b94d4e4`;
- `qa/t171-r2-report` (this report).

No PR, no `/end`, and no live `state.json` was written.

QA-158: REPORT COMPLETE
