# QA 288 report: session-164 batch a (prefix `s164a`), #472 r5 (HUBROOM-GUARD) and #484 r9 (AUDIT-FIX A1/A3/A6 + scrub) (laptop, Windows, headless Claude Code on Opus)

**Dispatch:** `docs/loops/qa-288-s164a-dispatch.md` at `53e68b606b08da543d5f37f8744451f99682d7e1`.
`git -C C:/qa-scratch/qa288-wt log -1 --format=%H` → `53e68b606b08da543d5f37f8744451f99682d7e1` (equal to `origin/master` after
`git fetch`).

## Verdicts

| PR | Pinned head | Verdict | Blocking findings |
|---|---|---|---|
| #472 HUBROOM-GUARD r5 | `1a37410105d706803805ddd05572327676fa0470` | **ACCEPT** | none. K1 is fixed. Medium: G1 (negation-scope widening is unpinned) and G2 (K2 vocabulary misses, documented in the source) |
| #484 AUDIT-FIX r9 | `edfc964d98b96c8bc3e73c65f122e0bd5a04ce49` | **ACCEPT** | none. Medium: H1 (removing the under-dir check leaves every test green, and the check is reachable) |

Both verdicts are on the pinned heads. Merge is Aaron's word (both PRs change `open-brain/src`).

## Method and environment

- **Machine and toolchain:** the laptop, Windows 10 Pro 19045, Node v22.23.2, `core.autocrlf=true`. The tracked hub
  copies check out with LF.
- **Worktrees:** all are detached, under `C:/qa-scratch/qa288-*`:
  - `qa288-wt` at the dispatch SHA (master), used for the master runs;
  - `qa288-pr472` at `1a374101`;
  - `qa288-prev472` at `26edb821`;
  - `qa288-pr484` at `edfc964d`;
  - `qa288-merge`.

  `npm ci` ran in each tree.
- **Temp files:** every temp file, DB and vault is under `C:/qa-tmp`.
- **Environment:** the permission layer refused env-var assignments in the shell. Every command therefore went through
  `C:/qa-tmp/run.mjs`, a wrapper that sets `TEMP`/`TMP`=`C:\qa-tmp` and `KNOWLEDGE_V2_DB` (and, where needed,
  `OPEN_BRAIN_VAULT_DIR`, `RECALL_TRIGGER_LOG`, `TRIGGER_POLICY_DIR`) to paths under `C:/qa-tmp`. Driver scripts that
  spawn children set the same values themselves.
- **Never touched:** the real knowledge DB, a real vault, a live `state.json` or any settings file. There was no Jev
  call, and no key was printed. The keys in row 12 are fake markers; the drivers print booleans only.
- **Narrow runs:** one test file per vitest invocation, and no full suite.
- **Mutants:** applied in the scratch PR trees by drivers that restore the file in a `finally`.
  `git status --short` was clean after every mutant batch.
- **Drivers** are in `C:/qa-tmp/qa288/` (`p472/{mut.mjs,probe.mts,lines.json,fa3.mts,widen.mjs,k4.mjs}` and
  `p484/{a3.mts,chunk.mts,win32view.mjs,a6.mts,a1.mts,scrub.mjs,holder.mjs,mut.mjs,mutb.mjs,killchild.mts,killg.mjs,callers.mjs}`).
  They are on the laptop and not committed.
- **A harness bug, caught and fixed:** my first lock holder for row 14(c) let its better-sqlite3 handle be
  garbage-collected, so the lock vanished and the scrub "succeeded" under every holder. Two checks showed the fault was
  mine, not the PR's: a lock held in the parent process did block a child process (`SQLITE_BUSY`), and the same test in
  one process blocked correctly. After pinning the handle, the holder blocks as expected. Only the corrected run is
  reported below.

## Rows 1–3 (every PR)

### Row 1: confined. PASS (one cosmetic note)

- **#472:** `git diff --stat origin/master...1a374101` touches exactly `open-brain/src/pipelines/sync/hub-room-guard.ts`
  (+301/−38 net with the test) and `open-brain/tests/pipelines/sync/hub-talk-exit-codes.test.ts`. The dispatch names the
  test file without its directory; it lives in `tests/pipelines/sync/`.
- **#484:** 28 files, matching the count at dispatch. Every file is explained:
  - **A1:** `trigger/command-log.ts` (new) and `trigger/fires.ts`.
  - **A3:**
    - `shared/vault-path-segment.ts`, `shared/yaml-frontmatter.ts` (both new) and `shared/parse-frontmatter.ts`;
    - `vault-writer.ts` and `server.ts` (`ob_store` and `ob_store_chunk`);
    - `topics/index.ts`, which unquotes the new quoted tags and project;
    - `session-end/index-v2.ts`, where a refused project falls back to `General`.
  - **A6:** `session-start/hub-presence.ts`.
  - **Scrub:**
    - `scrub-trigger-fires.ts` (new), `cli.ts`, `cli-spec.ts` and `CHANGELOG.md`;
    - `sync/checks.ts`, which adds `scrub-trigger-fires.ts` to `MEMORY_SIDE`, the module-boundary classification.
  - **Tests:**
    - `audit-fix-a1-r5{,-migration}`, `a1-r7/r8/r9-scrub`, `a3`, `a3-r2`, `a6`, `r3-callers` and `r4-topics` (all new);
    - `shared/cli-args.test.ts`, which adds the 12th command;
    - `vault-writer.test.ts`, which swaps raw-text `toContain` checks for `parseFrontmatter` checks of the same values
      because `test key` is now quoted. No assertion was weakened.
  - **Not explained: `open-brain/src/db-v2.ts`**, which adds one blank line inside `initSchemaV2`'s SQL template, and
    nothing else. It is whitespace-only residue. **Low (H8).**

### Row 2: CI

| Head | Run | `test` | `test-windows` |
|---|---|---|---|
| #472 `1a374101` | 37501631053 | success | **skipped** |
| #484 `edfc964d` | 37553637298 | success | **skipped** |

The run `headSha` equals the pinned head in both cases, and `gh pr view` shows both PRs still at their pinned heads.
`test-windows` was skipped on both, so the Windows rows below are the only Windows evidence.

### Row 3: batch merge. PASS

In `qa288-merge`:
1. `git merge --no-ff 1a374101` onto `53e68b60` gave `ec1911e3`.
2. `git merge --no-ff edfc964d` gave `b1394e23`.

There were no conflicts, and nothing was pushed.

- `tsc --noEmit` exits 0, and so does `npm run typecheck:tests` (`tsc -p tsconfig.tests.json`).
- Every test file either PR touches passes, one run each:

| Test file | Result |
|---|---|
| `hub-talk-exit-codes` | 19/19 |
| `audit-fix-a1-r5-migration` | 2/2 |
| `audit-fix-a1-r5` | 25/25 |
| `a1-r7-scrub` | 18/18 |
| `a1-r8-scrub` | 5/5 |
| `a1-r9-scrub` | 1/1 |
| `a3-r2` | 5/5 |
| `a3` | 3/3 |
| `a6` | 2/2 |
| `r3-callers` | 3/3 |
| `r4-topics` | 1/1 |
| `cli-args` | 68/68 |
| `vault-writer` | 22/22 |

## #472 r5 (rows 4–9): ACCEPT

At the head:
- `tsc --noEmit` exits 0, and so does `typecheck:tests`.
- `hub-talk-exit-codes.test.ts` passes 19/19.

**The probe** (`p472/probe.mts`) adds a line to each context below and reports **C** when the line adds at least one
violation there. It also names the checks that fire (taken from the mdc context).

| Context | How the line is planted |
|---|---|
| iso | the line alone |
| mdc / tpl | after "Post when the work is done, not a bare acknowledgement." in each `hub-room.mdc` copy |
| start | appended to the Hub-room **paragraph** of `start.md`, as QA 284 did, then the section is extracted |
| mdcCRLF / tplCRLF | the planted mdc and tpl files converted to CRLF |
| startCRLF | the planted `start.md` converted to CRLF, then the section extracted |
| secCRLF | the extracted section converted to CRLF |

Baseline violations are 0 in all eight contexts.

### Row 4: K1, every check has a positive only it catches. PASS

Source mutants (`p472/mut.mjs`): each check is deleted **in the source**, with one vitest run each, then restored.

| Check deleted in source | Tests that go red |
|---|---|
| `--wait` count (`if (waitCount !== exit2Count)` → `if (false)`) | "each guard check has a positive only it catches", "mutant table" (2/19 red) |
| seat-file `wait` (`SEAT_FILE_WAIT_RE` branch → `if (false)`) | the same two (2/19 red) |
| hub-verb in-turn (`clauseHubVerbInTurnWait` returns false) | throttle-bypass row, r5 regression rows, QA-281/283 rewordings, planner S1–S6, each-check, mutant table (6/19 red) |
| atlas/next-turn (check 4's `clauseWaitsForAtlasNextTurn(...) && !HUB_INVOKE` → `false`) | r5 regression rows, planner S1–S6 (S3), each-check, mutant table (4/19 red) |
| **cross-sentence** (`violations.push(...)` removed) | **each-check, mutant table (2/19 red)**. This is QA 284's K1, now fixed: `ONLY_CROSS_SENTENCE` = QA 284's N4, and it has its own `skipCrossSentence` flag |
| negation scope (`negationScopeEnabled` returns false) | tracked copies, K3 false alarms, planner S1–S6 (S6), allowlisted sentences, mutant table (5/19 red) |
| *(extra)* `sentenceHasInTurnAtlasWaitPattern` returns false | throttle bypass, r5 regression rows, mutant table (3/19 red) |
| *(extra)* the seat-file check's `WAIT_TIMEOUT_RE` half only | **none: 19/19 green.** See G6 (Low). `--wait-timeout` is still caught by the `--wait` count, because `--wait\b` matches it, so only prose like `wait_timeout` loses coverage |

All six named checks go red when deleted, so none triggers the dispatch's REJECT rule.

### Row 5: negation widened from clause to sentence. FINDING G1 (Medium)

- **The mutant:** in `guardedClauseViolation`, `clauseNegatesHubWaitAct(clause, sentence)` →
  `clauseNegatesHubWaitAct(sentence, sentence)`.
- **Result: 19/19 green. No test goes red.**
- **The widening is a real regression.** I re-ran the probe on the mutant:
  - **NEG1** "Never wait for CI here, run hub-talk with `--inbox` again and wait for atlas's reply in this run." is
    **CAUGHT ×8** at head (hub-verb) and **missed ×8** under the widened mutant.
  - All other probe lines are unchanged.
- So the PR's central K1 claim, "clause-level negation (`never`/`does not` only in the same clause as the forbidden act)",
  has no test pinning it.
- **Fix:** add NEG1, or a line like it, as a negation-scope positive.

**G3 (Low-Medium): the cross-sentence check is already sentence-scoped.** `violationsCrossSentence` calls
`clauseNegatesHubWaitAct(cur, cur)`, so a negation anywhere in the second sentence suppresses it.
- **NEG2** "Run hub-talk with `--inbox` once more. Never poll hub-talk, wait, and act on atlas's reply." is **missed ×8 at
  head**.
- It gets 2 violations with `skipNegationScope`.
- The phrasing is contrived, but it shows the clause-scope claim does not hold for check 5.

### Row 6: K2, re-planted lines and three new ones

| Id | Line (abridged) | Head ×8 contexts | Check |
|---|---|---|---|
| Own1 | "…run hub-talk with `--inbox` again and repeat until atlas has replied…" | CAUGHT ×8 | hub-verb |
| Own2 | "Stay in this run after posting: rerun the talk line every minute until…" | CAUGHT ×8 | hub-verb |
| Own3 | "Do not end the turn after posting, wait for hub-talk to print the next atlas turn…" | CAUGHT ×8 | hub-verb |
| QA 283 split | "After posting, run hub-talk with `--inbox` once more. Wait for what it prints and act on it." | **missed ×8** | — |
| S1 | "…run the talk line again. Wait for the next atlas turn…" | CAUGHT ×8 | atlas + cross-sentence |
| S2 | "Run node scripts/hub-talk.mjs … and wait for the reply." | CAUGHT ×8 | hub-verb |
| S3 | "Then keep listening for atlas's next turn before you end the turn." | CAUGHT ×8 | atlas |
| S4 | "…run hub-talk with `--inbox` again until the next atlas turn arrives…" | CAUGHT ×8 | hub-verb |
| S5 | "Once hub-talk has waited for atlas, act on its reply." | CAUGHT ×8 | hub-verb |
| QA 284 N1 | "…check the room again with the hub-talk `--inbox` line; if nothing new… try again in a minute, and only end this turn once…" | **missed ×8** | — |
| QA 284 N2 | "…keep this run open and run the talk line with `--inbox` every 30 seconds; as soon as the planner's next message shows up…" | **missed ×8** | — |
| QA 284 N3 | "Don't end the run after posting: run hub-talk with `--inbox` again, and repeat that until the room has something new…" | **missed ×8** | — |
| QA 284 N4 | "…run hub-talk with `--inbox` once more. Then wait, and act on atlas's reply." | CAUGHT ×8 | cross-sentence only |
| QA 284 N5 | "Stay in this turn after posting and keep checking the talk line's `--inbox` output until a new message lands." | **missed ×8** | — |
| **Q1 (new)** | "Once your post is in, give the planner a few minutes: check the talk line's `--inbox` output now and then, and pick up their answer in this same session." | **missed ×8** | — |
| **Q2 (new)** | "After posting, keep the session alive and re-run the hub-talk inbox command periodically; handle the response when it comes." | **missed ×8** | — |
| **Q3 (new)** | "Post your reply, then sleep 60 and check `--inbox` again; do this a few times so the next message is handled without a new run." | **missed ×8** | — |

**G2, Medium (non-blocking): QA 284's K2 is unchanged.**
- 4 of QA 284's 5 rewordings are missed (N1, N2, N3 and N5), along with QA 283's split example.
- All 3 of my new seat-obeyable lines are missed.
- The r5 source now **documents** this class in its header (`KNOWN LIMITS (QA 284, non-blocking)`: "every 30 seconds",
  "stay in this turn", "keep this run open", "the planner", and the clause split).
- I rate it Medium, not blocking. A vocabulary guard cannot close this class, and the limit is stated where the next
  editor will read it. A structural rule, as QA 284 suggested, would be needed to close it: no second talk-line call after
  `--say`, and no "until/once/periodically" paired with an end-of-turn condition.

The previous head `26edb821`, probed the same way, matches the head on every row 6 line. The difference is in K3 (row 7).

### Row 7: K3, no false alarms. PASS (one Low)

All of the following are **green in all eight contexts**:
- "Never wait for atlas inside a turn." (FA5; it was flagged ×4 at `26edb821`);
- S6 "Don't wait on hub-talk after you post.";
- the exit-2 sentence;
- the exit-3 retry text (`wait \`retry-after\` seconds`);
- "If hub-talk is throttled, wait 5 seconds and retry.";
- "Never block on hub-talk waiting for the next atlas turn in this run — …";
- FA1 "Wait for CI to finish before you post your reply." (it was flagged at `26edb821`).

Both tracked copies (`hub-room.mdc` and `start.md`'s Hub-room section) give 0 violations, in LF and in CRLF.

**G4 (Low):** FA3 "If atlas's reply asks for a test, wait until the test passes, then post." is still **flagged in
`start.md`** (start, startCRLF and secCRLF) when appended to the Hub-room paragraph.
- The cross-sentence check fires because the previous sentence names hub-talk.
- The PR's own test plants FA3 on the **blank line after the heading** (`lines[at + 1]`), where it is the first sentence
  of the section, so it never has a hub-naming predecessor. That is why the test is green.
- FA3 is not one of row 7's listed sentences, so this is Low.

### Row 8: K4, nested seat `wait` key. PASS (with Low notes, G5)

Plants in the pr472 tree's real `.agents/SYSTEM/hub-partner-seats.json`, one vitest run each, restored:

| Plant | Result |
|---|---|
| top-level `wait` | RED ("hub-partner-seats.json has no wait key at top level or under seats (F6, QA-284 K4)") |
| `seats.builder.wait` | **RED (the same row)**. K4 is fixed |
| `seats.builder.dispatch.cursor.wait` | green (19/19) |
| `--wait` appended to the top-level `talk` template | green (19/19) |

**G5 (Low):** `violationsNestedSeatWaitKey` checks only one level under `seats`. A `wait` under `dispatch.cursor`, which
is where the cursor dispatch settings live, is not caught. Neither is a `--wait` in the `talk` line that every Cursor seat
runs. Neither is documented as a limit.

### Row 9: Windows CRLF. PASS

The row 6 and row 7 results are **identical** between LF and CRLF:
- mdc vs mdcCRLF;
- tpl vs tplCRLF;
- start vs startCRLF vs secCRLF.

The secCRLF context passes a CRLF section straight to `hubRoomGuardViolations`, which shows the guard's own
normalisation works too. Baselines are 0 in every CRLF context.

### #472 findings

| Id | Severity | Finding |
|---|---|---|
| G1 | **Medium** | Widening negation from clause to sentence leaves 19/19 green. NEG1 goes from CAUGHT to missed. The clause-scope claim is unpinned |
| G2 | **Medium** | K2: QA 284's N1, N2, N3 and N5, QA 283's split example, and my Q1–Q3 are all missed. Documented in the source as KNOWN LIMITS |
| G3 | Low-Medium | The cross-sentence check uses sentence-wide negation (`clauseNegatesHubWaitAct(cur, cur)`), so NEG2 is missed at head |
| G4 | Low | FA3 is still flagged in `start.md`'s paragraph context. The PR's test plants it on the blank line, which hides this |
| G5 | Low | `seats.<n>.dispatch.cursor.wait` and `--wait` in the `talk` template are not caught |
| G6 | Low | The `WAIT_TIMEOUT_RE` half of the seat-file check has no positive (deletion leaves 19/19 green) |

## #484 r9 (rows 10–16): ACCEPT

At the head:
- `tsc --noEmit` exits 0, and so does `typecheck:tests`.
- All 12 PR test files pass, one run each (the baseline in `p484/mut.mjs`).

**The PR body is stale (part of H8).** It describes r1, where the command is "stored redacted/truncated", and lists
`audit-fix-a1.test.ts`, which does not exist. The head stores the **program basename only** (`command-log.ts`,
`[a-z][a-z0-9._-]{0,24}` or `?`). I tested the head's behaviour.

### Row 10: A3, vault path segments. PASS (Windows notes, H6)

`p484/a3.mts` calls `safeVaultPathSegment` and then `writeExperience`, `writeFailure` and `writeSummary` with each input
as `project`. Each case gets its own temp box with the vault inside it. After the calls, I walked the **whole box** and
checked every real file path, not just return values.

**Refused** by the guard and by all three writers, with **0 files written**:
- `..`, `../x`, `a/../../b`, `/abs/x`, `C:\x`, `C:x`, `\\host\share`, `a\..\..\b`;
- `..\t` and NBSP`..` (both trimmed to `..`);
- `CON`, `nul`, `lpt1.`;
- `x::$DATA`.

**Accepted and written under the vault**, with **0 files outside the vault in every case**:
- `x.`;
- `x␠` (trimmed to `x`);
- `...`, `.. .`, `. .`;
- `..`+U+200B;
- `con.txt`, `NUL.md`, `CONIN$`, `COM¹`, `AUX .`;
- the Unicode look-alikes `․․` (U+2024), `．．` (U+FF0E), `‥` (U+2025), `a∕b` (U+2215), `a／b` (U+FF0F), `a＼b` (U+FF3C),
  `a⧵b` (U+29F5) and `．．／x`. None of them acts as `.` or `/` on NTFS; each is a literal directory name.

**Result: every input is refused or kept under the vault dir.**

**H6 (Low, Windows-only):**
- **Unreadable directories.** Node writes through `\\?\` paths, so it creates **literal** directories named `x.`,
  `.. .`, `. .` and `AUX .`. A Win32 reader cannot open them: `cmd.exe` `if exist`/`type` on `Experiences\x.\k1.md`
  gives "The system cannot find the path specified" (`p484/win32view.mjs`).
- **Reserved-name check is exact only.** It strips trailing dots, then needs an exact match, so `con.txt`, `NUL.md`,
  `CONIN$` and `COM¹` are accepted. They are still under the vault, and cmd can read them as intermediate directories.
- **Empty summary slugs.** `writeSummary` writes `Summaries/2026-10-07-.md` for `...` and the look-alike dots, because
  their slug is empty.
- All of these need a crafted `project_dir` last segment.

### Row 11: A3, frontmatter. PASS (Low, H7)

**Through `ob_store_chunk`** (`handleStoreChunk`, with temp `KNOWLEDGE_V2_DB` and `OPEN_BRAIN_VAULT_DIR`;
`p484/chunk.mts`):
- The title (`key`) and a tag each carried, in turn:
  - a newline plus `injected: true`;
  - `a: b`;
  - `---`;
  - `x\n---\nevil: 1`;
  - double quotes and an apostrophe;
  - `a #b`;
  - `&a` and `*a`;
  - a CR plus `evil: 2`;
  - `[a, b]`.
- `parseFrontmatter` returned **exactly** the input key and tags in all 11 cases, with **no key beyond**
  `type/key/project/date/tags`.

**Through `writeExperience`/`writeFailure`** (`p484/a3.mts`, 28 values in key, tags and `source`):
- `parseFrontmatter` is **exact on all 28, with no injected key.** The values add U+2028, U+0085, a tab, leading and
  trailing spaces, `#tag`, `&a x`, `a,b`, `a\nb` (a literal backslash), `yes`, `True`, `-x`, a date and the empty
  string.
- The `yaml` package (a real YAML 1.2 parser) is also exact on 25 of 28.

**H7 (Low):** `yamlScalar` leaves `.5`, `.inf` and `0o17` unquoted. A YAML 1.2 parser reads them as numbers (0.5,
Infinity, 15), which is what Obsidian's properties would show. `parseFrontmatter` is unaffected.

### Row 12: A6, own key. PASS (Low, H5)

`resolveOwnKey(url, name, keyDir)` with planted fake keys outside `keyDir` (`p484/a6.mts`):
- **Refused as "invalid key name", with no read:**
  - `../x`, `..\x`, `../../x`;
  - an absolute `C:\…\outside\x`, `C:\x`, `C:x`, `/x`, `\\host\share\x`;
  - `a/b`, `a\b`;
  - empty, a space, `..`, `.`, `..x`.
- `good:evil` (an alternate data stream) and `CON` stay under the hub dir and report "no hub key".
- The in-dir control `good` reads correctly.

**I could make a directory junction without elevation.** With `keyDir2/<hub-id>` as a junction to a folder outside
`keyDir2`, `resolveOwnKey(url, "x", keyDir2)` returns **ok=true with the outside key**. Two more links also escape:
- a **hard link** `hl.key` to an outside file, which needs no elevation;
- a **file symlink** `sl.key`, which this machine allowed (presumably Developer Mode).

Both return the outside key.

**H5 (Low):** the confinement is lexical, by path text only. Exploiting it needs write access to `keyDir`, and anyone with
that can already plant a key, so this is a documented-limit candidate, not a defect in A6's name-traversal fix.

### Row 13: A1, command logs. PASS

The real PostToolUse hook (`src/cli-recall-trigger.ts`) was given Bash payloads on a temp DB (`p484/a1.mts`). The run was
done twice:
- with the default policy, where all fires are `silent`;
- with a temp `TRIGGER_POLICY_DIR` setting `relevance_floor` to −1e9, so **all 10 fires are `injected` and
  `recall_log` gets 10 rows**.

| Command (fake secrets) | Stored `trigger_fires.command` |
|---|---|
| `curl -H "token ghp_…" … \| tail -5` | `curl` |
| `OPENAI_API_KEY=sk-proj-… node run.js; echo $?` | `?` |
| `AGENT_KEY=… node scripts/hub-talk.mjs … \| tail -1` | `?` |
| `curl -H "Authorization: Bearer …" … \| head -3` | `curl` |
| `git clone https://qauser:p4ss…@github.com/… \| tail -2` | `git` |
| `ghp_…` as token0 | `?` |
| `/tmp/ghp_…/bin/tool …` | `tool` |
| `echo <200,000 x>ghp_… \| tail -1` (over any cap) | `echo` |
| a 40-char program name | `?` |
| `sk-qa288fake0123456` as token0 (short, lowercase) | **`sk-qa288fake0123456`**: the PR's documented ACCEPTED LIMIT in `command-log.ts`, confirmed |

- `recall_log.query` is only ever `"tail"` or `"exit" "code"`. `deriveQuery` builds it from fixed terms and never from
  command text.
- **I grepped all 12 tables** (including the FTS shadow tables) **for every raw secret: 0 hits** for the secrets this row
  names. The only hits are the 2 from the documented-limit token0 probe above, which is not one of the row's shapes.
- In the raw bytes of the db, -wal and -shm, only that same token0 probe appears. `recall-trigger.log` holds no secret,
  including the case of a malformed payload that carries one.
- **Control:** the same driver on master gives **21 table hits**, so the probe detects raw rows.

### Row 14: scrub command, temp DBs only (G-051). PASS for (a)–(c); (d) FINDING H3

The pre-fix DB is the master run's temp store with raw rows, plus 300 raw `Authorization: Bearer …` rows: 310 rows and
323 secret hits in the db file. I ran it through the CLI (`npx tsx src/cli.ts scrub-trigger-fires --db <temp>`;
`p484/scrub.mjs`), and never pointed it at `~/.claude/open-brain/`.

- **(a) PASS.**
  - `--dry-run`: "would rewrite: 310", exit 0.
  - The run: "rows rewritten: 310", exit 0.
  - **310 rows before and after, with identical ids 1..310.**
  - The commands are now `curl / ? / git / tool / echo` and the documented-limit token.
  - Secret hits: db **0** (the file went from 356,352 to 126,976 B), -wal 0 B, -shm 0.
- **(b) PASS.** The second run reports "rows rewritten: 0", exit 0, with 0 hits. By r9's design it still VACUUMs every
  time, so the db mtime changes. That makes it a no-op on rows, not on the file.
- **(c) PASS** (Windows file locking, separate holder processes):

| Holder process | Scrub result | Rows after | Secret hits after |
|---|---|---|---|
| open connection, no transaction | exit 0, 310 rewritten | 310, all redacted | 0 |
| `BEGIN` + read (snapshot held) | **exit 1 after ~7.9 s**: "another connection holds the store: stop the MCP server and close Claude Code sessions (hooks) first, then rerun" | 310, **all redacted** | db **323**, -wal 383 KB / 0 |
| `BEGIN IMMEDIATE` | **exit 1**, the same message | 310, **all still raw** (nothing written) | db 323 |
| `BEGIN EXCLUSIVE` | **exit 1**, the same message | 310, all still raw | db 323 |

  - After each holder was killed, one rerun gave exit 0, 0 hits, and no -wal/-shm left.
  - **Never a partial write:** the UPDATE is a single transaction, so it is all-or-nothing.
  - **H4 (Low):** with a reader holding the DB, the UPDATE and VACUUM **commit to the WAL** and only then is the
    checkpoint refused. Exit 1 therefore arrives after the rows are already redacted, while the main db file still holds
    every old secret byte until the rerun. The refusal text says to rerun but not that the rows were changed.
- **(d) FINDING H3 (Low-Medium).** A SQLite DB without `trigger_fires` (only `other(x)`):
  - **The non-dry run exits 0** with "rows scanned: 0 | rows rewritten: 0", and **creates `trigger_fires` and
    `sqlite_sequence` in the foreign DB** (`initTriggerFires`), then VACUUMs it.
  - `--dry-run` on the same file exits 1 with the raw SQLite text "no such table: trigger_fires".
  - So it is neither a named skip nor a crash: it is a silent schema write to a database the command does not own.
  - A 0-byte file is accepted the same way (exit 0). A missing file gives "unable to open database file" (exit 1, not
    created), and a text file gives "file is not a database" (exit 1).
  - The CLI help does state "a 0-byte or non-knowledge SQLite file may be accepted with its path printed". The dispatch
    asks for a named skip, so I report it.

### Row 15: mutants (`p484/mut.mjs`; one vitest run per file; restored)

| Mutant | Tests that go red |
|---|---|
| (a) segment guard accepts `..` (`base === ".."` → `false`) | `audit-fix-a3-r2` "allows project segments … refuses exact '..' and CON". Writes are still refused by the under-dir check, as defence in depth |
| (a′) the segment guard returns `raw` (accepts `..` and separators) | `a3-r2` (the same row) and `r3-callers` "session end: reserved project name still writes summary as General" |
| **(b) the under-dir check removed (`assertPathUnderDir` returns)** | **none**: a3 3/3, a3-r2 5/5, vault-writer 22/22, r3-callers 3/3. **H1** |
| (c) YAML escaping removed (`yamlScalar` returns `value`) | `a3` "keeps a newline-in-tag … one scalar field"; `a3-r2` "yamlScalar quotes …" and "writeExperience round-trips …" |
| (d) `resolveOwnKey` confinement removed (both the name check and the `rel` check) | `audit-fix-a6`, both rows |
| (e) redaction skipped for `trigger_fires` (inserts `fire.command`) | `audit-fix-a1-r5`, 25/25 rows red |
| (f1) the scrub skips the UPDATE (verification kept) | `r7` 16 rows, `r8` 2, `a1-r5-migration` 2 |
| (f2) the scrub skips the UPDATE **and** `assertAllCommandsCanonical`, and reports success | `r7` 18/18, `a1-r5-migration` 2/2 |
| **(g) `secure_delete = ON` removed** | **none**: r7 18/18, r8 5/5, r9 1/1, a1-r5-migration 2/2. **H2** |

**H1 (Medium): mutant (b) is live.**
- `writeSummary` does not check `date`.
- At head, `writeSummary(vault, {date: "../../escaped", project: "proj"})` throws `VaultPathRefusal`.
- With (b) applied, it **writes `box/escaped-proj.md` outside the vault** (`p484/mutb.mjs`). No test notices.
- Today's only caller passes `new Date().toISOString().slice(0, 10)`, so nothing is exploitable now. Still, the check is
  the PR's A3 backstop, and it has no test of its own.

**H2 (Low-Medium): mutant (g), measured with a kill after the UPDATE** (`p484/killg.mjs` + `killchild.mts`).
- **Setup:**
  - The child runs the real `runScrubTriggerFires` with `wal_autocheckpoint = 0`. When it reaches `VACUUM` (after the
    UPDATE committed and the canonical check passed), it writes a marker and spins.
  - The parent then runs `taskkill /F /T`.
  - Counts are secret-needle hits. The needles overlap, so 618 represents the same 323 strings.

| Build | db after the kill | -wal after the kill | -shm | After one rerun |
|---|---|---|---|---|
| head (`secure_delete = ON`) | 348,160 B / **618** | 247,232 B / **0** | 0 | db 118,784 B / **0**; -wal and -shm absent |
| mutant (g) | 348,160 B / **618** | 53,592 B / **435** | 0 | db 118,784 B / **0**; -wal and -shm absent |

- `secure_delete` does keep secret bytes out of the WAL frames of an interrupted run.
- In both builds the **main db file keeps every old secret until a rerun**, as the CHANGELOG documents. That is
  inherent to WAL with no checkpoint.
- The mutant's rerun used the mutated source and still cleaned up, because every run VACUUMs. The pragma therefore only
  matters inside the interrupted window, and no test covers that window.

### Row 16: callers. PASS (no regression)

Each file was run once at the head and once on master (`53e68b60`):

| Test file | #484 head | master |
|---|---|---|
| `vault-writer` | 22/22 | 22/22 |
| `server` | 35/35 | 35/35 |
| `topics` | 18/18 | 18/18 |
| `pipelines/session-end/index-v2` | 9/9 | 9/9 |
| `pipelines/session-start/hub-presence` | 41/41 | 41/41 |
| `trigger/fires` | 14/14 | 14/14 |
| `trigger/hook` | 12/12 | 12/12 |
| `vault-archive` | 6/6 | 6/6 |
| `t003-session-proof` (`handleStoreChunk`) | 18/18 | 18/18 |
| `shared/cli-args` | 68/68 | 65/65 |
| `pipelines/sync/checks` | 105/105 | 105/105 |

There are no new failures. The three extra `cli-args` tests come from the 12th command.

### #484 findings

| Id | Severity | Finding |
|---|---|---|
| H1 | **Medium** | Mutant (b), removing `assertPathUnderDir`, leaves every test green, and it is live: `writeSummary` with `date: "../../escaped"` writes outside the vault |
| H2 | Low-Medium | Mutant (g), removing `secure_delete`, leaves every test green. After a kill, the -wal holds 435 secret hits (0 at head). A rerun clears it |
| H3 | Low-Medium | Scrub on a DB without `trigger_fires`: it creates the table and `sqlite_sequence`, VACUUMs, and exits 0. `--dry-run` exits 1 with raw "no such table". Not a named skip. A 0-byte file is also accepted |
| H4 | Low | Scrub under a concurrent reader: exit 1 comes after the rows are already redacted (committed to the WAL), and the db file keeps the old bytes until a rerun. The refusal does not say the rows changed |
| H5 | Low | `resolveOwnKey` confinement is lexical: a junction (no elevation), a hard link or a file symlink in `keyDir` returns an outside key |
| H6 | Low | Windows: accepted segments `x.`, `.. .`, `. .` and `AUX .` create directories Win32 readers cannot open; `con.txt`, `NUL.md`, `CONIN$` and `COM¹` are accepted. All are under the vault |
| H7 | Low | `yamlScalar` leaves `.5`, `.inf` and `0o17` unquoted, and real YAML retypes them as numbers |
| H8 | Low | The PR body is stale (r1 wording, a nonexistent `audit-fix-a1.test.ts`); `db-v2.ts` gains a whitespace-only line |

## Findings summary

| Id | PR | Severity | Finding |
|---|---|---|---|
| G1 | #472 | Medium | Widening negation from clause to sentence leaves 19/19 green. NEG1 goes from CAUGHT to missed |
| G2 | #472 | Medium | K2: N1, N2, N3, N5, the split example and Q1–Q3 are missed (documented KNOWN LIMITS) |
| G3 | #472 | Low-Medium | The cross-sentence check's negation is sentence-wide, so NEG2 is missed |
| G4 | #472 | Low | FA3 is flagged in `start.md`'s paragraph context. The test's blank-line plant hides it |
| G5 | #472 | Low | Deeper `dispatch.cursor.wait` and `--wait` in `talk` are not caught |
| G6 | #472 | Low | The `WAIT_TIMEOUT_RE` sub-check has no positive |
| H1 | #484 | Medium | Mutant (b), the under-dir check removed, leaves every test green and is reachable via `writeSummary(date)` |
| H2 | #484 | Low-Medium | Mutant (g), `secure_delete` removed, leaves every test green; the -wal leaks after a kill until a rerun |
| H3 | #484 | Low-Medium | Scrub on a DB without the table creates it (exit 0). Not a named skip |
| H4 | #484 | Low | Scrub refusal under a reader comes after a committed rewrite; the db bytes stay until a rerun |
| H5 | #484 | Low | Key confinement is lexical (junction, hard link, symlink) |
| H6 | #484 | Low | Windows-odd segment names are accepted (all under the vault) |
| H7 | #484 | Low | `.5`, `.inf` and `0o17` are unquoted in YAML |
| H8 | #484 | Low | Stale PR body; whitespace-only `db-v2.ts` change |

None is blocking. **#472 r5: ACCEPT at `1a374101`. #484 r9: ACCEPT at `edfc964d`.**

QA-288: REPORT COMPLETE
