# Importer leftovers round 5 (R5-1 to R5-4, O-e): QA report, record session 153

**By:** the QA seat, record session **153**, 2026-09-27 (UTC), headless, dispatched by
`docs/loops/importer-leftovers-r5-dispatch-qa.md` (Atlas, record 146). **Candidate:** `e2f202b` on
`origin/loop/importer-leftovers-r5` (handoff and evidence at `b1c5b77`). **Scored against:**
`docs/loops/importer-leftovers-rulings-qa138.md` (R5-1 to R5-4, O-e). **Comparison base:** `d500730`, which QA 138
ACCEPTED. Only what round 5 adds is scored.

**Machine:** `DESKTOP-0GV3HAD`, Windows 10 Pro 19045, Node **v22.23.2**, Windows PowerShell **5.1.19041.6456**.
**This process ran ELEVATED** (High Mandatory Level, member of BUILTIN\Administrators, NETWORK logon: the WMI launch)
**with `SeBackupPrivilege` ENABLED** (`whoami /priv`, at the start of the run). So every read path below was run twice,
once as launched and once in a child whose `SeBackupPrivilege` was disabled (QA 138's `noprivprobe.ps1` and
`noprivrun.ps1`). TEMP for probes and mutants: `C:\qa-tmp` (Defender-excluded). The one full-suite control run used the
default TEMP, `C:\Users\Aaron\AppData\Local\Temp`.
**Model and effort, from this session's transcript** (`~/.claude/projects/C--Users-Aaron-Worktrees-sia-qa/5046868e-158a-4f50-8b53-c5d10b566eca.jsonl`):
`"model":"claude-opus-5-5"` and `"effort":"high"`, 197 of 197 records each, with no other value, counted before this
commit.

**Not used**, as dispatched: `/start`, the MCP server, `gitnexus`, `/end`. No live `state.json` was written. Scratch:
`C:\qa-scratch\il153\` (worktrees `cand` and `mut` at `e2f202b`, `base` at `d500730`, `qat` on
`qa/importer-leftovers-r5-tests`, `report` on this branch). Scripts and evidence:
`docs/loops/qa-scripts-importer-leftovers-r5/`. In the committed `.out` files the home directory is masked as `<HOME>`.

## Verdict

**PASS on R5-1, R5-3, R5-4, O-e and every preserve. R5-2 is PASS for the judged inputs and DECISIONS.md, and falls
short on the session log (D1). There are three low defects. None is a way past the STALE block, none regresses a
ruling QA 138 accepted, and none should hold the merge.**

- **R5-1: PASS.**
  - A `##`-only next-session.md is judged by its heading again: stale exits 1, current exits 0 and imports
    `pick_up`. That holds for all four PS 5.1 writers: .NET UTF-8, `Set-Content`, `Out-File -Encoding utf8` and `>`.
  - UTF-7, zero bytes and the lying LE BOM are still blocked on every judged input.
  - A file read as valid UTF-8 gets evidence with no encoding word in it.
  - **QA 138's §1 shapes, byte-exact and written by PS 5.1 itself: 32 passed, 0 failed** (QA 138 had 30/2 at
    `d500730`, and I reproduced that exactly). The two rows that threw at `d500730` (a lying `FE FF` on INBOX.md and
    task.md) are now `could_not_tell/unreadable`, and a bare `--commit` refuses.
- **R5-2: PARTIAL.**
  - Every odd-length `FE FF` shape I wrote, 13 of them, is filed and none throws.
  - Judged inputs block, and their evidence names `FE FF` and the file's byte count.
  - A DECISIONS.md of that shape is named in the report, in `--draft`'s stdout and in `--commit`'s stdout, and it
    does not block.
  - **The latest session log of that shape is named nowhere, and its date silently becomes the migration date (D1).**
    The developer disclosed this.
  - A DECISIONS.md of that shape over UTF-8 text says "ADRs NOT imported: none found", though ADR-1 is in its bytes
    (D2).
- **R5-3: PASS on what it ruled.** I held each of the five importer files with share `None` for 20 runs. With the
  privilege disabled, all 8 refusals of an input read carry Node's message, then "another program holds this file
  open; close it and re-run". **All 20 runs refuse or complete cleanly, and the tree is identical after every refused
  run.** Three other EBUSY paths still print Node's message alone (D3): `--commit`'s own read of `state.draft.json`,
  the draft write, and the snapshot copy when the privilege is enabled.
- **R5-4: PASS.** Only timeouts changed. The only assertion edits are the ruled wording regexes, and nothing was
  loosened. The widening beyond DIVERGED is borne out here: tree-currency's **BEHIND** row took **6.3 s** in my
  control run, and without the block timeout that row fails at the 5 s default.
- **O-e: PASS.** Two and three markers say "every snapshot" and "which deletes today's". One marker is
  **byte-identical** to `d500730`.
- **Preserves: all hold.**
  - R4-5's output is identical, line for line, to QA 138's at `d500730` (paths masked).
  - O7 is as above.
  - O14's union is untouched by the diff, and nothing casts to it.
  - The STALE block holds on every stale row.
  - IF-10's +13 and +1 are `ahead_of_latest`, and a bare `--commit` exits 0 with state.json written.
- **Probes:**
  - probes-r3: 17/4, with the same FAIL ids as Forge 147's and QA 138's.
  - probes-r4 byte-exact: **16/0, because this run is privileged.**
  - probes-r4 with the hold removed: 16/0.
  - probes-r4 with the privilege disabled: 12 PASS, then Forge's `EBUSY` crash in the probe's own `tree()`.
  - Masked, every PASS/FAIL/NOTE line is identical to Forge 147's.
- **Mutants:** 23 of my own.
  - 19 were killed by the candidate's tests, including QA 138's three former survivors, re-expressed on the new code.
  - 4 survived (A10, B3, E2, E3). All 4 are killed by green rows in my test file.
- **CI (tcm, 1 of 6 runs):** `36294795430` on `qa/importer-leftovers-r5-tests` @ `6c51944`, runner `tcm-2`: **3
  failed, 1375 passed, 2 skipped (1380)**, 93 files. The 3 are D1, D2 and D3, exactly as designed.
- **/sync:** none of the developer's 4 issues is new with round 5 (item 7).

## 1. R5-1: the heading rule, and its wording

**QA 138's §1, byte-exact** (`shapes-qa138.mjs`, QA 138's script unchanged). Evidence:
`evidence/shapes-qa138-e2f202b.out` and `…-d500730.out`.
- **Candidate: 32 passed, 0 failed.**
- **Base: 30 passed, 2 failed**, with every PASS/FAIL/NOTE row identical to QA 138's own `d500730` output.

**Every R4-4 shape is still `could_not_tell/unreadable`, and a bare `--commit` refuses with the tree identical**, for
INBOX.md, task.md and next-session.md, stale and current:
- UTF-32LE and UTF-32BE;
- UTF-7;
- zero bytes, both from `New-Item` and from `Clear-Content`;
- a UTF-8 BOM, then `>>`;
- a lying `FF FE` over UTF-8;
- a lying `FF FE` over UTF-32;
- a lying `FE FF` over UTF-8.

At `d500730` that last shape THREW on INBOX.md and task.md. IF-10's +13 and +1 pass.

**The rows that changed, candidate against `d500730`** (all NOTE rows, and all the ruled narrowing):

| Shape (valid UTF-8, PS 5.1) | `d500730` | `e2f202b` |
|---|---|---|
| next-session.md, `##` sections only | unreadable, exit 1 ×2 | **stale exit 1 / current exit 0** |
| INBOX.md with `##` headings only (the session is in the blockquote) | unreadable ×2 | `no_declared_session`, exit 0 ×2 |
| INBOX.md with `#Inbox`, `#<TAB>Inbox`, `  # Inbox` or a setext title, **each followed by `## P0`** | unreadable ×8 | `no_declared_session`, exit 0 ×8 |
| INBOX.md whose text begins with U+FEFF before `# Inbox` (.NET, two marks) | unreadable ×2 | `no_declared_session`, exit 0 ×2 |

Those last three rows carry a `##` line, so they have a heading and are judged. `declaredSession` reads the status
blockquote only under a `# ` title, which is unchanged and disclosed by the developer. So each row is
`no_declared_session`, which does not block, **in the stale project too**. That is `1646567`'s behaviour for every
row, as QA 138's base column recorded it. See O1.

**My own rows** (`r5-qa153.mjs`, every input written by PS 5.1). Evidence: `evidence/r5-qa153-e2f202b.out` and
`…-d500730.out`. **Candidate: 28 passed, 0 failed. Base: 5 passed, 23 failed.**

| Shape | `e2f202b` | Evidence (candidate) |
|---|---|---|
| next-session.md with `##` sections, written 4 ways: .NET UTF-8, `Set-Content`, `Out-File utf8` (BOM), `>` (UTF-16LE) | stale exit 1 / current exit 0 ×4; `pick_up` imported | judged by `## Pick up here (Session N)` |
| INBOX.md: `## P0 (Session N)` only; `###### Inbox (Session N)` | stale / current | judged |
| INBOX.md: `####### ` (seven), `#Inbox`, `#<TAB>Inbox`, `  # Inbox`, setext, each with **no** `##` line; next-session.md as bold lines; `#Inbox` behind a UTF-8 BOM | unreadable, exit 1 ×14 | *"has no heading line (no line is `#` to `######` followed by a space), so it cannot be judged: give it a title, or pass --accept-stale"*. **No word matching `encoding\|UTF-\|byte-order\|1252`** in any of them |
| UTF-7 (`Set-Content -Encoding UTF7`) on INBOX, task and next | unreadable, exit 1 ×6 | the same valid-UTF-8 sentence: UTF-7 is ASCII, so it reads as valid UTF-8 |
| Windows-1252 (`Set-Content`, with an é), no heading | unreadable ×2 | keeps *"its encoding may be one the importer does not read"* and *"read as Windows-1252"* |
| a **genuine** UTF-16LE file (PS 5.1 `>`) of /end A7's bold lines, no heading | unreadable ×2 | *"has no heading line as its UTF-16LE byte-order mark reads it (…): the mark may not match the bytes, as when UTF-8 text follows it"*. The mark does match here; see O2 |

**The refusal at `--commit`** repeats the evidence after *"1 input(s) cannot be read, so whether they are current
cannot be told:"*. `--draft`'s stdout line says *"cannot be read or judged (NUL bytes, UTF-32, an odd-length UTF-16BE
file, or no heading line; the report says which): save as UTF-8 with a title and re-run the draft"*. Both sentences
are generic across causes; see O3.

## 2. R5-2: odd-length `FE FF`, filed and never thrown

Script `r5-qa153.mjs`. Two PS 5.1 shapes:
- a **lie**: .NET `WriteAllBytes(FE FF)`, then UTF-8 text padded to an odd length;
- a **genuine** UTF-16BE file (`Set-Content -Encoding BigEndianUnicode`) with one byte appended.

| Input | `d500730` | `e2f202b` |
|---|---|---|
| INBOX.md, task.md, next-session.md (lie); INBOX.md (genuine + 1 byte); INBOX.md `FE FF 23` (3 bytes) | THREW, CLI exit 1 | `could_not_tell/unreadable`; the evidence names `(FE FF)` and **the file's byte count** (e.g. `(161)`); a bare `--commit` refuses naming it; tree identical |
| INBOX.md `FE FF` alone (2 bytes) | unreadable | unreadable, *"(it is empty)"* |
| guard: a genuine UTF-16LE file (`>`) + 1 byte | stale / current | stale / current (the LE path drops the odd byte, unchanged) |
| **DECISIONS.md, lie** (81 bytes) | THREW; the draft is refused | draft exit 0, bare `--commit` exit 0. Named in `not_judged`, in the report's "Not read in full", in `--draft`'s stdout and in `--commit`'s stdout. **`ADRs imported: none`, and `ADRs NOT imported …: none found`** although `### ADR-1` is in the bytes as UTF-8 (**D2**) |
| DECISIONS.md, genuine + 1 byte | THREW | exit 0 / 0; named in all three; `ADRs imported: ADR-1`; state.json `["ADR-1"]` |
| **Session_7.md (the latest log), lie** | THREW | draft exit 0, commit exit 0. **Not named** in the report, `--draft` or `--commit`. `last_session.date` is **`2026-09-26`**, today's date, where the log says 2026-09-23, and state.json records that date (**D1**) |
| Session_7.md, genuine + 1 byte | THREW | exit 0 / 0; not named; the date reads right (2026-09-23), because the even part decodes |
| SUMMARY.md, lie | draft THREW | draft exit 0; named in `not_judged`; `--commit` refuses: *"SUMMARY.md has a UTF-16BE byte-order mark (FE FF), but an odd number of bytes (69) …, and --commit rewrites it in place … Save it as UTF-8"*. Nothing written |

**R5-2's text, "a not-judged DECISIONS.md or session log of that shape follows R4-5: named, and not blocking", is met
for DECISIONS.md and not for the session log.** The developer's handoff says so ("nothing reports it unreadable. There
is no slot for that in the report").

## 3. R5-3: the EBUSY refusal, held for real, with and without `SeBackupPrivilege`

Script `ebusy-importer-qa153.mjs`: QA 138's `ebusy-importer.mjs` with its script paths moved to this scratch, and a
500 ms wait before the hold note is read (E1). A PS 5.1 process holds each file with
`[IO.File]::Open(p,'Open','Read','None')`. The built CLI runs in a child with `SeBackupPrivilege` DISABLED
(`AdjustTokenPrivileges`; the child's `whoami /priv` shows it Disabled), and again as launched. The whole tree is hashed
before and after. Evidence: `evidence/ebusy-importer-e2f202b.out` (04:21:13Z–04:24:42Z).

| Held | Privilege DISABLED: `--draft` / `--commit` | Privilege enabled: `--draft` / `--commit` |
|---|---|---|
| `TASKS/INBOX.md` | exit 1 `EBUSY … open '…INBOX.md': another program holds this file open; close it and re-run` / the same | exit 0 (reads through) / exit 1 `EBUSY … copyfile …` at the snapshot, **no remedy** |
| `SESSIONS/Session_7.md` | exit 1, with the remedy / the same | exit 0 / exit 1 copyfile, no remedy |
| `SYSTEM/SUMMARY.md` | exit 1, with the remedy / the same | exit 0 / exit 1 copyfile, no remedy |
| `SYSTEM/DECISIONS.md` | exit 1, with the remedy / the same | exit 0 / exit 1 copyfile, no remedy |
| `.agents/state.draft.json` | exit 1 `EBUSY … open '…state.draft.json'`, **no remedy** (the draft write) / exit 1, **no remedy** (`--commit`'s read, `index.ts:977`) | exit 1, no remedy (the write) / exit 1 copyfile, no remedy |

**20 of 20 runs refuse or complete cleanly.** Every refused run leaves the tree identical, with no state.json and no
archive. The 4 privileged `--draft` runs that completed only rewrote the draft and the report.

**8 of the 16 EBUSY refusals carry the cause and the remedy.** Those 8 are every one of the input reads, which R5-3
ruled and which are the ones an unelevated operator meets. The other 8 print Node's message alone (**D3**):
- `--commit`'s read of `state.draft.json` is a read refusal of exactly the kind R5-3 rules, and `index.ts:977` calls
  `readFileSync` directly;
- the draft write;
- the snapshot copy, which only a privileged process reaches.

probes-r3's R3-3 row shows the same raw message for a write refused on SUMMARY.md.

**In the suite:** the candidate's R5-3 rows mock `readFileSync` for INBOX.md and Session_7.md. My mocked rows add
task.md, next-session.md, DECISIONS.md and SUMMARY.md, through `--draft` and `--commit` (green), plus the draft read
at `--commit` (RED: D3).

## 4. R5-4: the timeouts, and nothing else

`git diff d500730 e2f202b -- open-brain/tests`, every removed line:
- `tree-currency.test.ts`: only `describe("describeTreeCurrency", () => {`. It becomes
  `describe(…, { timeout: SPAWN_TIMEOUT_MS }, …)`, with a 30 s constant and a comment. No `it` or `expect` changed.
- `state-import-leftovers.test.ts`: two `});` become `}, SPAWN_TIMEOUT_MS);`. Those are the R4-5 CLI row and its
  guard, the file's only two rows that spawn the CLI. There are four regex edits:
  `/no readable \`# \` title/` → `/has no heading line/`, three times, and the same phrase inside one `RegExp`. That
  is R5-1's ruled wording change, a specific phrase replaced by a specific phrase, so it is not a loosening.
  "it is empty" stays asserted elsewhere, by QA 138's Q6 row and R5's zero-bytes row.
- `state-import-qa138.test.ts` against QA's `c3b89d2`: one regex, `has no readable` → `has no heading line`, for the
  same reason.
- **`git diff --stat f5754ed e2f202b` touches only `src/cli.ts` and `state-import/index.ts`.** The tests committed
  red-first were not edited after the fix.

**Is the widening warranted?** In my control run, tree-currency's rows took 6.3 s (BEHIND), 4.6 s, 4.1 s (DIVERGED)
and 3.7 s. BEHIND would have failed at the default. The leftovers' R4-5 CLI row took 4.6 s. The other slow importer
rows (7.7 s in `state-import-staleness`, 7.4 s in `state-import-r2`) already carry `60_000`
(`evidence/full-suite-e2f202b-durations.out`).

## 5. O-e, O7 and the other preserves

**O7 and O-e** (QA 138's `o7-qa138.mjs`, candidate against base; `evidence/o7-qa138-e2f202b.out`):
- One marker: **byte-identical** to `d500730`, *"Keep a copy of the snapshot … which deletes it on success"*.
- Two markers (created 09-09, then 01-01) and three: the oldest is named first, and the grammar reads right. The text
  ends *"Keep a copy of **every snapshot** until the re-run completes: that re-run needs --force-snapshot, which
  deletes **today's** on success"*.
- `--draft` prints the same text.
- The only difference from the base is that clause.

"today's" is accurate: `--force-snapshot` sets aside the snapshot directory named for today, which is none of the named
ones unless one is dated today.

**R4-5** (`r45-qa138.mjs`): the output is **identical to QA 138's at `d500730`**, every line, with paths masked. All
five PS 5.1 DECISIONS.md shapes are named in all three places, with the same NUL counts, first bytes and ADR lists.

**O14:** the diff does not touch `InputStaleness` (`index.ts:533–535`, a two-arm union with the reason required on
`could_not_tell`). There is no `as` cast to `InputStaleness`, `CouldNotTell` or `any`.

**The STALE block:** every stale row in §1 and §2 that is judged exits 1, and so do the probes' stale rows. The
`**STALE**` count per probe output equals Forge 147's.

**IF-10:** +13 and +1 are `ahead_of_latest`; a bare `--commit` exits 0 and state.json is written.

## 6. The probes

Blobs extracted with `git cat-file -p` and checked with `git hash-object`: `probes-r3.mjs` `b3ecab0` and
`probes-r4.mjs` `d475c7b`. The noNone copy was made with `patch` from Forge's `probes-r4-noNone.diff`, and the
re-derived diff is that one line. The probes ran one at a time against `C:\qa-scratch\il153\cand`, built from
`e2f202b`, with nothing else running (`evidence/probes.times`).

| Run | Result | Compared with |
|---|---|---|
| probes-r3, byte-exact (04:15:03Z–04:15:29Z) | **17 passed, 4 failed**, exit 1 | PASS/FAIL ids identical to Forge 147's `probes-r3-e2f202b.out` and QA 138's `d500730` run. Every full line is identical to Forge's once paths and hashes are masked (first 230 characters) |
| probes-r4, byte-exact (04:15:29Z–04:16:28Z) | **16 passed, 0 failed**, exit 0; the share=`None` row reads *stale; bare --commit exit 1; tree identical* | Forge's crashed, because his process was unprivileged. Mine equals the noNone run plus that one NOTE row |
| probes-r4 with the hold removed (04:16:28Z–04:17:24Z) | **16 passed, 0 failed** | identical to Forge 147's `probes-r4-noNone-e2f202b.out` (masked) |
| probes-r4, byte-exact, `SeBackupPrivilege` disabled (04:17:24Z–04:17:50Z) | 12 PASS, then `EBUSY … open …held-held-None-Open\.agents\TASKS\INBOX.md` in the probe's own `tree()`, exit 1 | Forge's crash, reproduced |

The probe's crash is the probe reading the held file, not the importer. The importer's own read under the same hold
is §3.

## 7. Mutants

**Mine** (`mutants-qa153.cjs`, run from `C:\qa-scratch\il153\mut\open-brain` at `e2f202b`, 04:25:28Z–04:35:45Z, alone).
- Each edit matches exactly once, and tsc runs on every mutant.
- vitest runs every `tests/pipelines/state-import*` file: 13 files, 148 tests. The baseline was 148/148 in 18 s.
- The source is restored and hash-checked after every mutant (`restored: … clean`).
- A red row that is only a timeout is not counted as a kill. None occurred.
- Evidence: `evidence/mutants/`, each `.diff` plus `mutants-qa153.out`.

| Mutant | Protection removed | At `e2f202b` |
|---|---|---|
| A1 | a bare `#` line no longer a heading | killed, 2 |
| A2 | levels 1–5 only | killed, 1 |
| A3 | no upper bound (`#######` accepted) | killed, 1 |
| A4 | `#<TAB>` accepted | killed, 1 |
| A5 | the old `# `-only rule | killed, 6 |
| A6 | the valid-UTF-8 wording blames the encoding again | killed, 3 |
| A7 | the UTF-16 mark's sentence dropped | killed, 1 |
| A8 | the Windows-1252 sentence dropped | killed, 1 |
| A9 | the draft gets no encodings | killed, 2 |
| **A10** | **`runCommit` gets no encodings** (the refusal words a BOM path as valid UTF-8, unlike the draft) | **SURVIVED** |
| **Q4r** | QA 138's Q4: the heading rule on INBOX.md only | **killed, 5** (QA 138's Q4 rows, now in the candidate) |
| **Q5r** | QA 138's Q5: the BOM path's NUL offset counted in characters | **killed, 1** |
| **Q6r** | QA 138's Q6: zero bytes not said to be empty | **killed, 2** |
| B1 | the odd byte dropped and the rest judged, as LE does | killed, 3 |
| B2 | the byte count excludes the mark | killed, 2 |
| **B3** | the odd file's text decoded one byte off, so "as far as it reads" reads nothing | **SURVIVED** |
| B4 | the odd branch removed (swap16 throws) | killed, 6 |
| C1 | the session log read with a bare `readFileSync` | killed, 1 |
| C2 | the wrap keyed on EPERM | killed, 2 |
| C3 | the cause dropped, the remedy kept | killed, 2 |
| E1 | "the snapshot" whatever the count | killed, 1 |
| **E2** | "which deletes it" whatever the count | **SURVIVED** |
| **E3** | the one-marker text changed ("today's") | **SURVIVED** |

**QA 138's three survivors stay killed.** The ruling's three named protections, the old `# `-only rule (A5), a
throwing BE decode (B4) and the old wording (A6), are each killed.

**With my test files added** (`state-import-qa153.test.ts` and `state-import-qa153-ebusy.test.ts`), **A10, B3, E2 and
E3 are each killed** by a green row beyond the three known reds (`evidence/mutants-withqa/`):
- A10 by the `--commit` refusal row on a UTF-16LE mark;
- B3 by the genuine UTF-16BE + 1 byte DECISIONS.md row;
- E2 and E3 by the one-marker and two-marker text row.

**R5-4 has no mutant:** a timeout protects no behaviour. §4's diff audit and timings stand in for it. **Forge's 11
round-5 mutants and his 16 leftovers mutants were not re-run**; his evidence is at `b1c5b77`.

## CI (tcm, 1 of 6 runs used) and the local control run

| Run | Branch @ SHA | Runner | Result |
|---|---|---|---|
| `36286942468` (the developer's, read, not re-run) | `loop/importer-leftovers-r5-red` @ `c3b89d2` | tcm | failure as intended; `test-windows` skipped (`gh run view`) |
| `36286944274` (the developer's, read, not re-run) | `loop/importer-leftovers-r5-green` @ **`e2f202b`** | tcm | success; `test-windows` skipped. 1368 passed, 2 skipped, per the handoff's log |
| **`36294795430`** (mine) | `qa/importer-leftovers-r5-tests` @ **`6c51944`** (`e2f202b` + my 2 test files) | **`tcm-2`** | **failure, as designed: 3 failed, 1375 passed, 2 skipped (1380)**, 93 files. The 3 are D1, D2 and D3; my other 7 are green on Linux. The typecheck step ran before the tests. 0 `onTaskUpdate` lines. `evidence/ci-36294795430.clean.txt` |

No `windows=true` run was made.

**Full suite, local, ONE run, default TEMP** (04:38:34Z–04:41:20Z, nothing else running): **91 files, 1370 passed,
0 failed.** vitest nevertheless exited 1, on one unhandled error: `[vitest-worker]: Timeout calling "onTaskUpdate"`.
That is the worker RPC timing out under load, not a test; the developer's handoff counts this same line class in CI
logs. 39 tests ran over 5 s and passed under their explicit timeouts. Evidence: `evidence/full-suite-e2f202b.out` and
`.meta`.

## Item 7: the developer's `/sync` issues, new or inherited?

`node open-brain/build/cli.js sync --check` ran in clean detached worktrees at the candidate and at `d500730`, each with
its own build (`evidence/sync-check-cand.out`, `sync-check-base.out`). **The two outputs are the same apart from the
build SHA and the file and commit counts: 23 passed, 3 warnings, 2 issues, 4 skipped.**

| Developer's issue at `65cdf9c` | Clean checkout, `e2f202b` | Clean checkout, `d500730` | New with round 5? |
|---|---|---|---|
| `retirements`: ENTITIES.md names `dream`, `reflection queue` | the same issue | the same issue | **No, inherited** |
| `build-freshness`: build `b371176`, HEAD `65cdf9c` | pass (the build matches HEAD) | pass | **No.** Their checkout's build was `b371176`, a T-171 commit that is **not an ancestor** of `e2f202b` |
| `mirror-parity`: live↔template `end.md` (`.claude`, `.cursor`), `.cursor/sync.md` | **pass** | pass | **No.** `.cursor/` is not tracked and does not exist in a clean checkout, and the round-5 diff touches nothing under `.claude/`, `.cursor/`, `project-template/` or `.agents/`. The issue lives in the developer's local, untracked `.cursor/` |
| `greeting-size`: 46770 > 40000 | skipped: no valid state.json for this build | skipped | **No.** It measures the local record and role files, which round 5 does not touch |

**One the developer did not see:** `state-schema` is an issue in both clean checkouts. The tracked `.agents/state.json`
is schema v2, and this branch's build expects v3. It is inherited: the same at `d500730`. The developer's run reported
`state-schema` passing because it used `b371176`'s build. **Nothing from item 7 is scored.**

## What could not be verified

- **An unprivileged, non-elevated seat.** I disabled `SeBackupPrivilege` in child processes. I did not run
  unelevated, and I did not use Forge's PC.
- **That the EBUSY behaviour holds on CI.** Linux has no share modes and `test-windows` is skipped. §3 stands on this
  PC's runs, and the suite's R5-3 rows are mocks.
- **co-op-mailer's and Makerspace's real inputs**, which are not on this PC. Whether any real next-session.md is
  `##`-only was answered by QA 138 (none found). I did not re-search.
- **Forge's own mutants** were not re-run (§7).
- **The developer's `/sync` run itself.** I could not reproduce their checkout's untracked `.cursor/` or its
  `b371176` build; item 7 is read from clean checkouts.

## Defects

| ID | Severity | Since | What | Evidence | Suggested fix |
|---|---|---|---|---|---|
| **D1** | **low** (a ruling half not met; a silent wrong date) | round 5. At `d500730` this shape THREW and failed closed | **An odd-length `FE FF` latest session log is not named anywhere**: not in the report, not in `--draft`'s stdout, not in `--commit`'s. R5-2 says a session log of that shape "follows R4-5: named, and not blocking". When the mark lies over UTF-8 text, the log's `# Session 7 — 2026-09-23` line decodes to CJK, so `last_session.date` falls back to **the migration date** (`2026-09-26`), and a bare `--commit` writes that date into state.json with no word of it. It does not block, as ruled. Disclosed by the developer ("There is no slot for that in the report") | `evidence/r5-qa153-e2f202b.out` (the Session_7.md rows); tcm `36294795430` row D1 | Name it as DECISIONS.md is named: a `not_judged` or `last_session` note carrying the `undecodable` evidence, and a stdout line. Or keep the throw's fail-closed character for the latest log only |
| **D2** | **low** | round 5 (the shape threw at `d500730`) | **An odd-length `FE FF` DECISIONS.md over UTF-8 text** is named and does not block, as ruled. But it prints `ADRs imported: none` and `ADRs NOT imported (headings found once the NUL bytes are removed; the unreadable bytes may hold more): none found`, and state.json gets `[]`. `### ADR-1` is in the file as plain UTF-8. The not-imported list is recovered by removing NULs from the decoded text, and this shape has no NULs: its text is CJK. The hedge "may hold more" is in the sentence, but "none found" is what the operator reads | `r5-qa153-e2f202b.out` (the DECISIONS rows); tcm row D2 | For the odd `FE FF` shape, recover headings by reading the bytes after the mark as UTF-8 (or as Latin-1 with NULs removed), as the NUL path recovers ASCII |
| **D3** | **low** | the `--commit` draft read and the draft write are older than round 5; round 5 wrapped the input reads only | **8 of 16 real EBUSY refusals print Node's message alone.** One is a read R5-3 covers in words: **`--commit`'s read of `state.draft.json`** (`index.ts:977`, a bare `readFileSync`). The others are the draft write, and the snapshot `copyfile` that a privileged process reaches. The input reads, the case O-b named, all carry the remedy | `ebusy-importer-e2f202b.out`; tcm row D3 (mocked) | Route `index.ts:977` through `readBytes`, and wrap the draft write and the snapshot copy the same way. One helper, three call sites |

## Observations, not scored

- **O1: the narrowing returns six shapes to `no_declared_session`, which does not block, even when stale.** Those are
  a `##`-only INBOX.md whose session is in its blockquote, and `#Inbox`, `#<TAB>Inbox`, `  # Inbox`, a setext title
  or a leading U+FEFF, each above `## ` sections. That is `1646567`'s behaviour exactly, and it is what "judged by its
  heading again" implies. But one of them is not a missing title: **a text that begins with U+FEFF (two marks, .NET)
  has a real `# ` title hidden by the second mark.** `d500730` happened to block it, and now it commits as
  undeclared. The importer strips the file's BOM, not a U+FEFF that begins the text.
- **O2: a genuine UTF-16LE file with no heading gets a hedged encoding claim.** PS 5.1's `>`, the importer's most
  common Windows writer, writes that shape; /end A7's bold lines are an example. The evidence says *"the mark may not
  match the bytes, as when UTF-8 text follows it"*, and here the mark matches. The ruling keeps the encoding sentence
  "only where the decode path justifies it". The BOM path is where a lie happens, and "may" is hedged, so I do not
  score it. The text tells the two apart: a lie over UTF-8 decodes to CJK, and a genuine file decodes to ASCII.
- **O3: the sentences around the evidence are still generic.** For a valid UTF-8 file, `--commit` opens with
  *"cannot be read, so whether they are current cannot be told"*, and `--draft`'s stdout ends *"save as UTF-8 with a
  title and re-run the draft"*. The evidence itself is right.
- **O4:** the evidence's rule reads *"no line is `#` to `######` followed by a space"*, but a bare `#` line (end of
  line) is also a heading. This is cosmetic.
- **O5: an odd `FE FF` genuine UTF-16BE file** (one stray byte) is `unreadable` and blocks, while the LE mirror is
  judged as it reads. That asymmetry is as ruled ("filed unreadable"). A BE file with a stray byte is otherwise fully
  readable.
- **O6:** the developer's handoff says "17 more CLI-spawning rows in `state-import-r2/r4/seeds/staleness` have no
  explicit timeout". The slow ones I measured there (7.4 s and 7.7 s) carry `60_000`. I did not audit all 17.

## Disagreements, returned rather than scored

1. **With the handoff's `/sync` reading.** Its 4 issues were produced by a build from `b371176`, which is not on this
   branch, and by a checkout with an untracked `.cursor/`. In a clean checkout with its own build, the candidate shows
   2 issues: `retirements` and `state-schema`. Both are inherited from `d500730`.
2. **With the ruling's R5-2 sentence, and I read it as the planner's to settle.** "Named" for a session log has no slot
   in the report, as the developer says. Either the ruling wanted one added (D1), or "named" was meant for DECISIONS.md
   only. I scored it as written.

## Error entries and near-misses (mine)

- **E1:** the first EBUSY run passed relative worktree paths. The children resolved the CLI against each project
  directory and failed with `Cannot find module`, so no importer ran. The run then died on a race, unlinking the hold's
  `.held` note while PowerShell still had it open. That output is kept as
  `evidence/ebusy-importer-e2f202b-E1-relative-paths.out`. The recorded run (04:21:13Z) uses absolute paths and a 500 ms
  wait before the note is read.
- **E2:** my first commit on `qa/importer-leftovers-r5-tests` failed because this environment has no git identity. The
  push that followed in the same command created that branch **at `e2f202b` itself**, the candidate SHA with nothing
  added. I then committed with `-c user.name/-c user.email`, set per command with no config change, and pushed
  fast-forward to `6c51944`. No other ref was touched.
- **E3:** `mklink /J` through Git Bash mangled its backslashes and left a dangling junction named
  `open-brainnode_modules` in the `qat` worktree root. I removed it with `cmd /c rmdir`, which removes the link only,
  and made the junction with PowerShell. It was never committed.
- **E4:** my R5 script's first draft read the import report from the wrong file name. I fixed it before any recorded
  run. The DECISIONS rows' "report file lines" still read `(none)`, because a completed `--commit` moves the report into
  the snapshot. I read the archived report instead: it names DECISIONS.md, with its FE FF evidence and the ADR lines,
  and it does not name Session_7.md.
- **Near-miss, overlaps:** none among the timing-sensitive runs. The probes (04:15:03Z–04:17:50Z), the EBUSY run, the
  mutant chain (04:25:28Z–04:35:45Z) and the full suite (04:38:34Z–04:41:20Z) each ran alone. My test-file run (after
  the chain) and the with-QA mutant re-runs were short and ran alone too. The R5 script's run overlapped the two
  `/sync --check` runs; neither measures time.
- **Left in place:** `C:\qa-scratch\il153\` (worktrees `cand`, `mut`, `base`, `qat`, `report`, and the probe
  directories). `git worktree remove` clears them. Nothing of QA 138's `il138` was modified: its probe fixture
  `pr4/held-held-None-Open` was not used, since mine is `il153/pr4`.

## Reproduction

```sh
# S = docs/loops/qa-scripts-importer-leftovers-r5 ; S138 = QA 138's scripts (origin/qa/importer-leftovers-report) ; W = C:/qa-scratch/il153
for p in "cand e2f202b" "base d500730" "mut e2f202b"; do set -- $p
  git worktree add --detach $W/$1 $2 && (cd $W/$1/open-brain && npm ci && npm run build); done
node $S138/shapes-qa138.mjs $W/cand $W/sh-cand ; node $S138/shapes-qa138.mjs $W/base $W/sh-base   # 32/0 ; 30/2
node $S/r5-qa153.mjs $W/cand $W/r5-cand ; node $S/r5-qa153.mjs $W/base $W/r5-base                  # 28/0 ; 5/23
node P3/probes-r3.mjs $W/cand $W/pr3 ; node P4/probes-r4.mjs $W/cand $W/pr4 ; node P4/probes-r4-noNone.mjs $W/cand $W/pr4n
powershell -File $S138/noprivprobe.ps1 -Script P4/probes-r4.mjs -Wt $W/cand -Out $W/pr4np         # 12, then EBUSY in tree()
node $S/ebusy-importer-qa153.mjs C:/qa-scratch/il153/cand C:/qa-scratch/il153/pr4/held-held-None-Open C:/qa-scratch/il153/ebusy
node $S138/o7-qa138.mjs $W/cand $W/base $W/o7 ; node $S138/r45-qa138.mjs $W/cand $W/r45
(cd $W/mut/open-brain && node $S/mutants-qa153.cjs <ev> all)                                       # 19 killed, 4 survived
(cd $W/cand && node open-brain/build/cli.js sync --check) ; (cd $W/base && node open-brain/build/cli.js sync --check)
(cd $W/cand/open-brain && TEMP="$QA_DEFAULT_TEMP" TMP="$QA_DEFAULT_TEMP" npx vitest run)          # 1370/1370, 1 RPC error
node docs/loops/qa-153/push-qa.mjs qa/importer-leftovers-r5-tests
gh workflow run ci.yml --ref qa/importer-leftovers-r5-tests -f hosted=false                          # 36294795430: 3 failed / 1375 / 2 skipped
```

`ebusy-importer-qa153.mjs` carries this scratch's absolute paths to `hold.ps1` and `noprivrun.ps1` (QA 138's, copied
to `C:/qa-scratch/il153/s138/`). Adjust them before re-running elsewhere.

## Branches pushed (each read back by `push-qa.mjs`)

- `qa/importer-leftovers-r5-tests` → `6c51944`. QA evidence, red by design on 3 rows, not for merge. Its first push
  was at `e2f202b` (E2).
- `qa/importer-leftovers-r5-report` → this report, its scripts and its evidence.

## Open for the planner

None of these blocks the rest of this work; each is a recommendation.

1. **Merge `e2f202b`.** R5-1, R5-3, R5-4 and O-e hold, and so does every preserve. D1–D3 are low, none is a way past
   the STALE block, and each can go to one small follow-up. *Recommendation:* merge, and brief D1–D3 together.
2. **D1, the session log (a ruling question).** Decide whether "named" in R5-2 requires a report slot for the latest
   log. *Recommendation:* yes. A silently wrong session date in the record is the kind of quiet loss R4-5 was ruled
   against, and a `last_session.evidence` field plus one stdout line is enough.
3. **D2 and D3:** small code fixes. *Recommendation:* the same follow-up as D1. For D3, one wrapper used at
   `index.ts:977`, the draft write and the snapshot copy.
4. **O1, the hidden `# ` title behind a leading U+FEFF.** *Recommendation:* strip one leading U+FEFF from the decoded
   text as well as the file's BOM, so that file is judged by its real title rather than committed as undeclared. It
   is older than the leftovers (`1646567` did the same).
5. **O2 (optional):** word the UTF-16 no-heading evidence by what the decode produced. A lie gives CJK, and a genuine
   file gives ASCII.
6. **Item 7:** tell the developer seats that `/sync --check` must run on the checkout's own build, since
   `build-freshness` fails otherwise. A local `.cursor/` makes `mirror-parity` report on files that are not in the
   repository.

QA-153: REPORT COMPLETE
