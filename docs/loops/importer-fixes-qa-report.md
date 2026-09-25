# Importer fixes (T-175, T-180): QA report, record session 102

**By:** the QA seat, record session 102, headless on the QA PC `DESKTOP-O4EGB1E` (D-045), in
`C:\Users\Aaron Melven\Worktrees\sia-qa` (HEAD `3258372`), 2026-09-25 UTC.
**Candidate:** `f6b6d44` (`origin/loop/importer-fixes-ci`), cut from master `9bc06e3`. The handoff was read at
`origin/loop/importer-fixes` `65e3a89`.
**Dispatch:** `docs/loops/importer-fixes-dispatch-qa.md`. **Scored against:** `docs/loops/importer-fixes-brief.md` §3
(IF-1 to IF-8) and the planner's three rulings recorded in the handoff.
**Model and effort:** `claude-opus-5-5` and effort `high`, read from this run's own process command line (`--model
claude-opus-5-5 --effort high`, PID 7728). The stream-json transcript (`%USERPROFILE%\sia-qa102\run-0.jsonl`, session
`9e30519a-85f5-4eff-a50d-84991902a7e6`) names `claude-opus-5-5` on every assistant record. It records no effort value,
only `per_turn_effort_active: true`.
**Scripts and raw output:** `docs/loops/qa-scripts-importer/` (README there).

## Verdict

**All eight rows pass, IF-1 to IF-8, and all three rulings hold.** I re-ran every row myself against the built CLI, not
only through the developer's tests. IF-2 ran on a fresh `git archive` of the real A2A-Hub at `e0bc3f8`. The fixture is
byte-identical to A2A-Hub for all 7 `.agents` files, and a secret scan validated on 11 planted positives finds 0 hits in
it. The full suite at `f6b6d44` passed 1045/1045 with exit 0, captured unpiped. CI run `36095908990` on `f6b6d44`
succeeded on tcm (`tcm-2`), with 1044 passed and 1 skipped: the win32-only test.

**It is not a clean pass. There are two new defects in the code this candidate adds, and neither blocks an IF row:**

- **D1 (test gap).** The T-150 refusal of an unrecognised flag is guarded by no test. The mutant that deletes it (M6)
  leaves all 19 importer tests green. The typo test passes anyway: its assertion `stderr.toContain("--accept-stal")` is
  also satisfied by the stale refusal's text, `--accept-stale`.
- **D2 (a way past the STALE block).** A UTF-8 BOM at the start of an input hides its title line from the detector. A
  stale input with a BOM is reported as "could not tell", and the reason given is false: it says the file "names no
  `Session N`", but it does. Under ruling 1, "could not tell" does not block, so `--commit` proceeds **without**
  `--accept-stale`. This PC's own PowerShell tooling writes BOMs: `drive.meta` from this run starts with U+FEFF.

Two older defects, **D3** and **D4**, were found by the dispatch's probes. Master `9bc06e3` reproduces both
identically, so they are not regressions. D3: an import with no `SESSIONS/` directory half-migrates and cannot be
re-run. D4: a mistyped acknowledgement without a leading `--` (`-accept-stale`, `accept-stale`) is taken as the project
directory. They are listed so they are not lost.

## Rows IF-1 to IF-8

| Row | Result | Evidence (mine unless marked) |
|---|---|---|
| **IF-1** | **PASS** | SIA fixture (`tests/fixtures-import`), through the built CLI: `--draft` exits 0 and the draft passes `parseState`. `verified[]` and `gaps[]` are `[]`. The report says `verified[]: 0 · gaps[]: 0` and the CLI says `verified 0 · gaps 0`. No `V-00x` or `G-00x` appears anywhere in the draft or the report. After `--commit`, `state.json` parses, again with both arrays empty. The same holds for another project: a fresh A2A-Hub archive, where the draft parses and both are empty. On master the same checks fail, finding 5 verified and 6 gaps (`evidence/probes-master.out`). The developer's `state-import-seeds.test.ts` passes 2/2. |
| **IF-2** | **PASS** | The real A2A-Hub, `git archive e0bc3f8`. `--draft` exits 0. The report's first `## ` section is `## Staleness — read this first`, with `**STALE** .agents/SESSIONS/next-session.md: line 3 declares Session 13 (> Updated at end of Session 13 (2026-08-07)…); the latest session log is Session 14 (.agents/SESSIONS/Session_14.md)`. INBOX is also STALE, at Session 11, and task.md is current at Session 14, both matching Relay's write-up. Bare `--commit` exits 1, names both inputs and `--accept-stale`, and leaves no `state.json` and no `archive/`. The tree differs from before only by the draft and the report. `--commit --accept-stal` exits 1 as an unrecognised flag. `--commit --accept-stale` exits 0, writes `state.json`, takes a 37-file snapshot and prints `Imported STALE under --accept-stale: …INBOX.md, …next-session.md`. The developer's IF-2 block against the vendored fixture passes 3/3. |
| **IF-3** | **PASS** | The developer's synthetic negative passes. My own negative: the markers are in a heading (`## Pick up here (end of Session 9)`), in the `# ` title line (`# Current Focus — Session 9`) and as a range (`Sessions 8–9`), with `Session_8.md` and `Session_9.md` present. The draft reports `0 stale · 0 could not tell · 3 current`, and `--commit` exits 0 without the acknowledgement, printing no staleness line. `--accept-stale` passed when nothing is stale is harmless and claims nothing. |
| **IF-4** | **PASS** (see D2) | Three cases. A marker only in body text gives INBOX as `could not tell` with the reason `names no Session N in its status blockquote or its headings`, not current. With `SESSIONS/` present and no `Session_N.md`, all three inputs are `could not tell`, none current. With no `SESSIONS/` at all, INBOX and task are `could not tell` and next-session is `not judged: absent`. Where `--commit` completes, it prints exactly one `Could not tell whether current: …` line. With no `SESSIONS/` it fails for an older reason, D3. **Qualification:** D2 is the reverse failure. An input that *can* be judged is filed as "could not tell", under a false reason. |
| **IF-5** | **PASS** | Seeds restored (M1): IF-1 red, 3/19, `tsc` 0. Detector disabled (M2): IF-2 red, 3/19, `tsc` 0. "Could not tell" as current (M3): IF-4 red, 3/19, `tsc` 0. [Mutants](#mutants) has all 16. |
| **IF-6** | **PASS** | `loop/importer-fixes-redcheck` `e082983` is exactly `9bc06e3` plus one test file and the fixture: `git diff --stat` shows 10 files, all under `open-brain/tests/`, and its parent is `9bc06e3`. Re-run here, the file is **9 failed / 9**, all `AssertionError` (5× `expected undefined to be defined`, and one each of deep-equal `[V-001…]`, `to contain 'verified 0 · gaps 0'`, `to throw`, `+0 to be 1`). **I also went further.** The candidate's own two test files, split and edited after `e082983`, and including `f6b6d44`'s added test (which was never red-checked), were run against master's source: **10 failed / 10**, all `AssertionError`, and `tsc` was clean. |
| **IF-7** | **PASS** | `git diff 9bc06e3 f6b6d44 -- state-import.test.ts` is one hunk. It replaces the two seed-id assertions at 142-143 with `toEqual([])` and adds one comment line (ruling 3). The file passes 9/9 unchanged otherwise. V-009 on the real archive: `--draft` added exactly `state.draft.json` and `state.import-report.md`, changing and removing nothing. The snapshot taken by `--commit --accept-stale` holds every original `.agents` file byte-identical (0 missing or differing). The stale refusal comes before the snapshot: moving the snapshot above it (M7) turns two IF-2 tests red. |
| **IF-8** | **PASS, with the ruled-out part unrun** | Plain `open-brain sync` in a scratch clone at `f6b6d44`, rebuilt: `25 passed, 0 fixed, 2 warnings, 1 issues, 2 skipped`, with the tree clean afterwards. The **one issue is the known ENTITIES.md retirements finding** (`dream`, `reflection queue`). Build-freshness **passes**, because this clone was rebuilt. The warnings are `obsidian-vault` (no vault on the QA PC, which is environmental) and `spec-provenance` (no `specs/`; the developer saw it too). The skips are `gitnexus-index`, which is not a pass, and `ci-status`, explained below. The retirements check says nothing about the new fixture directory, so ruling 2's entry works. **`/sync --check` after `gitnexus analyze` was not run: `gitnexus` is absent here by ruling.** |

**`ci-status` in the scratch clone** skipped as "gh is not authenticated", which is false: `gh auth status` shows the
account logged in. The clone's `origin` is a local path, so `gh` printed `none of the git remotes … point to a known
GitHub host … gh auth login`. The check's regex (`checks-state.ts:146`, `/auth|login|token|HTTP 401/`) reads "login"
there as an authentication failure. This predates the candidate, is outside its scope, and is minor. It is noted as an
observation, not scored.

## The planner's rulings

1. **"Could not tell" does not block `--commit`: holds.** (a) Each such input is a `- could not tell …` line in the
   report's first section, next to the STALE lines, and carries its reason (seen in IF-4's three cases). (b) `--commit`
   prints one line, `Could not tell whether current: <inputs>`, before its snapshot line. Each has a test and a mutant:
   M4 (the line removed) turns exactly the `--commit` could-not-tell test red (1/19), and M5 (the reason removed) turns
   exactly the IF-4 report-line test red (1/19). Both match the handoff.
2. **The fixture as historical in `.agents/retirements.json`: holds, with one wording point returned below.** The entry
   is under the `historical` key, beside the other three fixture directories. The fixture holds 9 files: the 7 `.agents`
   files, `README.md` and `package.json` (checked with `git ls-tree`). The secret scan finds nothing (see below). See
   Disagreements 1: `Session_13.md` is not read by the importer.
3. **The IF-7 deviation at `state-import.test.ts:142-143` is intended: confirmed.** Those two lines asserted the seed ids
   `V-001..V-005` and `G-001..G-006`, and nothing else in the file changed. The only detail is that the hunk also adds a
   comment line, so later line numbers shift by one. The handoff's "exactly lines 142-143" is right about the
   assertions.

## The fixture's fidelity and the secret scan

**Fidelity (`fidelity.mjs`, `evidence/fidelity.out`).** I cloned A2A-Hub read-only from GitHub
(`git clone --no-checkout`; `gh repo` is denied here, and the repository answers HTTP 200 unauthenticated, so it is
public). I compared each file **git blob against git blob**, so no EOL conversion applies on either side:

| File | Result | sha256 (first 12) | Bytes | CR |
|---|---|---|---|---|
| `.agents/SESSIONS/next-session.md` | identical | `11ba24ebc2a1` | 15977 | 0 |
| `.agents/SESSIONS/Session_13.md` | identical | `6311bcb3aba5` | 6350 | 0 |
| `.agents/SESSIONS/Session_14.md` | identical | `d75badf77ea2` | 7586 | 0 |
| `.agents/SYSTEM/DECISIONS.md` | identical | `b0ef508ed27b` | 30077 | 0 |
| `.agents/SYSTEM/SUMMARY.md` | identical | `c6c445eb8db8` | 13368 | 0 |
| `.agents/TASKS/INBOX.md` | identical | `2d1751251c21` | 19993 | 0 |
| `.agents/TASKS/task.md` | identical | `3ab837d9c752` | 9364 | 0 |

**7 of 7 are byte-identical, and nothing differs.** A2A-Hub's blobs were already LF, so the README's "line endings
normalised to LF" changed nothing. `package.json` is cut to `name` and `version`, and both match A2A-Hub
(`a2a-intelligent-hub@1.7.0`).

**Secret scan (`secrets.mjs`, `evidence/secrets.out`).** It uses 11 value patterns: AWS key id, `sk-`/`sk-ant-` keys,
GitHub tokens, Slack tokens, Google API keys, Stripe live keys, PEM private-key headers, JWTs, `Bearer <20+>`,
`key/token/secret/password = <16+>`, and credentials in URLs.
- **Planted positive: 11 hits for 11 planted files**, every pattern firing. A planted prose negative, which names
  `ANTHROPIC_API_KEY`, `X-Agent-Key` and `Bearer token` without values, gave **0 hits**.
- **Fixture: 9 files, 0 hits, 0 suspicious file names.**
- The first validation run **failed on purpose**: my Google-key plant was 37 characters where the key format has 35. It
  missed, and the script refused to scan until the plant was corrected. I corrected the plant, not the pattern.
- By eye, 57 lines in the fixture mention key/token/secret/password. They are prose: SSH host keys, `apiKeyHash`,
  `X-Agent-Key`, the *name* `ANTHROPIC_API_KEY`, `dev-key` as a named default.
- The fixture does contain a VPS IP address (`next-session.md:26`). It is not a secret, and it is already in the public
  repository.

## Probes

Run through the built CLI in fresh directories (`probes.mjs`; the output is in `evidence/probes.out`, and master's is in
`evidence/probes-master.out`). "Proceeds" means `--commit` exits 0 and writes `state.json`.

| Probe | What the import says | Does `--commit` proceed? | On master `9bc06e3` |
|---|---|---|---|
| **An input newer than the latest session** (next-session declares Session 20; latest log is 7) | `current`, with evidence `line 3 declares Session 20 …; the latest session log is Session 7`. Nothing flags that it is *ahead*. | **Yes**, without the acknowledgement or any note | proceeds, with no staleness concept |
| **No `SESSIONS/` directory** | `Current session: 0 ((no SESSIONS/ directory))`. INBOX and task are `could not tell` ("no SESSIONS/Session_N.md to compare against"). next-session is `not judged: absent` | **No, and worse:** exit 1 with `ENOENT … .agents\SESSIONS\next-session.md.tmp-NNNN` **after** writing `state.json`, a 4-file snapshot, and rewritten `INBOX.md` and `task.md`. A second `--commit`, and even `--draft`, then refuses: `state.json already exists`. **D3.** | **identical**, so it predates the candidate |
| **`next-session.md` names no session** | `could not tell` with its reason; the others current | **Yes**, printing `Could not tell whether current: .agents/SESSIONS/next-session.md` | proceeds silently |
| **An untracked `.agents/`** (a git repo whose `.gitignore` lists `.agents/`, confirmed with `git status --ignored`; also a directory with no git at all) | Same as tracked: next-session (6) and INBOX (5) are STALE against Session 7, with evidence | **No** without the acknowledgement (exit 1, nothing written). **Yes** with `--accept-stale`. The signal reads content only, as the handoff says | proceeds |
| **A misspelled acknowledgement** (T-150) | Each `--` variant is refused as `unrecognised flag(s) …` with exit 1 and nothing written, before or after the directory argument: `--accept-stal`, `--accept_stale`, `--Accept-Stale`, `--accept-stale=yes`, `--acceptStale`, `--accept-stales`, `---accept-stale`, `--commit=yes`. **A variant without `--`** (`-accept-stale`, `accept-stale`) is not seen as a flag, **D4** | `--` variants: **no**. Non-`--` variants on a stale project: **no**, refused as stale, so the acknowledgement is never granted. On a current project: **yes, silently**. Typed before the directory while standing in another drafted project: **the cwd's project is committed, not the named one** (PROBE-12) | all of these proceed |

Past the dispatch's list:

- **`--draft --accept-stale`** refuses (exit 1, no draft written).
- **An input fixed between `--draft` and `--commit`** (handoff limit 5), with only the marker bumped to Session 7:
  `--commit` proceeds without the acknowledgement. It commits the **draft's** handoff (`"Carry on."`), not the fixed
  file's content. So bumping a marker after a draft lets a stale draft through with no note. It is documented, but see
  Open 4.
- **A UTF-8 BOM on each input**, with the markers in the status blockquote (`Session 6` against log 7): all three read
  `could not tell`, and `--commit` proceeds without the acknowledgement. **D2.**
- **CRLF inputs:** judged correctly (1 STALE), and `--commit` refuses.
- **A future-session heading in a stale input** (`## Plan for Session 8`, blockquote Session 6, log 7): current, and
  `--commit` proceeds. This is handoff limit 1, confirmed.
- **Log names:** `Session_007.md` is read as 7. A lowercase `session_9.md` is ignored, so the latest is 7, not 9. This is
  handoff limit 4, confirmed.

## Mutants

`mutants.mjs` (`evidence/mutants.out`, with each mutant's `git diff` in `evidence/mutant-diffs/`). Every edit had to match
an exact number of times, or the mutant would be VOID; none was. After each mutant the source was restored and hashed:
`index.ts` `f01e5688a5fc` and `cli.ts` `b2e2410ab606`, both matching the handoff. `git status --porcelain` was clean at
the end. `tsc --noEmit -p .` covers `src/` only (the tsconfig's `include`), and it exits 0 on **every** mutant.

| Mutant | Protection | Diff | Red of 19 | Notes |
|---|---|---|---|---|
| M1 | T-175: no seeds | +28 −2, `index.ts`: master's own `seedVerified`/`seedGaps`, extracted from `9bc06e3`, and called again | **3** | IF-1 ×2, plus `state-import.test.ts`'s draft test through lines 142-143. **Matches the handoff (3).** |
| M2 | detector | 1 line, verdict always `current` | **3** | IF-2 ×3. **Matches (3).** |
| M3 | could-not-tell never current | 2 lines, both `could_not_tell` pushes → `current` | **3** | IF-4 ×3. The handoff has 2/18, measured before `f6b6d44` added the `--commit` line test, which is the third. Consistent. |
| M4 | ruling 1b | 1 line removed, `cli.ts` | **1** | **Matches (1).** |
| M5 | ruling 1a | 1 line: the reason dropped from could-not-tell lines only | **1** | **Matches (1).** |
| **M6** | **T-150: an unrecognised flag refuses** | 1 line, `if (false && …)` | **0: survives** | **D1.** |
| M7 | refusal before the snapshot | the snapshot line moved above the stale check | 2 | IF-2's no-`archive/` assertions |
| M8 | `--commit` re-judges and refuses | the refusal disabled | 2 | |
| M9 | `--accept-stale` lets it proceed | always refuse | 2 | |
| M10 | the staleness section comes first | moved below `## Sources` | 2 | IF-2 and IF-4 first-section tests |
| M11 | a STALE line carries its evidence | evidence dropped on STALE lines | 1 | |
| M12 | one session behind is stale | `d.n < latest.n - 1` | 3 | |
| M13 | `--accept-stale` refused with `--draft` | disabled | **0: survives** | no test |
| M14 | `--commit` prints `Imported STALE under …` | line removed | **0: survives** | the acknowledgement's only record in the output |
| M15 | the `--draft` CLI staleness summary | line removed | **0: survives** | |
| M16 | the detector reads headings | heading candidates removed | **0: survives** | every test marker is in a blockquote. My IF-3 negative would catch it: its task and next-session markers are in headings |

**The developer's reverts.** The developer's scripts (`mutants.cjs`, `mutants2.cjs`) are in their session's scratchpad in
`~/Worktrees/sia-infra`, which is not on this PC. I could not read them. I rebuilt M1 to M5 from the handoff's
descriptions instead. Each rebuilt diff is confined to what it claims: M1 adds only master's seed code and the two calls,
M2 and M3 change only verdict literals, and M4 and M5 each change one output line. Each turns red the tests, and the
number of tests, that the handoff reports.

## Full suite and CI

**The full suite, once, at `f6b6d44`** (`evidence/full-suite-f6b6d44.out`). It ran from `open-brain` in the candidate
worktree, which was clean, from 04:45:35Z to 04:47:42Z, as `npx vitest run > file 2>&1; SUITE_EXIT=$?`, giving
**`SUITE_EXIT=0`**. The result was **73 files passed, 1045 tests passed (1045)**, with no skip, in 124.39 s. The words
`onTaskUpdate` and `Unhandled` do not occur. **The 8.3-path test** (`paths.test.ts`, `resolves a real 8.3 short-name
segment (win32 only…)`) **passed here**, as PR #156 predicts. The developer's CI run skipped it, on Linux. **Processes on
this PC** (node.exe and claude.exe, via `Win32_Process`), before and after, were identical: this run's own `claude.exe`
(PID 7728) and nothing else. No other session was running.

**CI: 1 run of the 8 allowed.** I created `qa/importer-fixes-ci` at `f6b6d44` and pushed it with `push-qa.mjs`
(`pushed and read back: qa/importer-fixes-ci f6b6d44b0383…`). I then ran `gh workflow run ci.yml --ref
qa/importer-fixes-ci -f hosted=false`, since `ci.yml` runs only on `workflow_dispatch` for a non-master ref.
- **Run `36095908990`:** `workflow_dispatch`, headSha `f6b6d44b03837d2d5e23dd90c01b93d90b80a1f1`, **conclusion
  success**. It was queued at 04:48:08Z behind another seat's mutant runs on tcm, and ran from 04:56:56Z to 04:58:36Z.
- **Runner: tcm.** The log says `Runner name: 'tcm-2'` and `Machine name: 'tcm'`. The step `Egress isolation self-check
  (tcm)` ran; it is gated on `runner.environment == 'self-hosted'`. It printed `blocked:` for all 9 targets and `denied:
  /opt/doorctl`.
- `gh run view --json jobs` returns `runnerName` and `labels` as null for this job. The log is therefore the evidence,
  not the API, and a reader should not look for it there. Nothing went to a GitHub-hosted runner.
- **Result:** `tsc --noEmit` passed. Test Files 73 passed (73), **Tests 1044 passed, 1 skipped (1045)**. The skip is
  `paths.test.ts`'s win32-only 8.3 test, which passed locally. The per-file importer counts are `state-import.test.ts`
  9 ✓, `state-import-staleness.test.ts` 8 ✓ and `state-import-seeds.test.ts` 2 ✓. `onTaskUpdate`/`Unhandled`: 0.
- There is one runner warning, which predates the candidate: `Node.js 20 is deprecated … actions/checkout@v4,
  actions/setup-node@v4` are forced onto Node 24.
- This agrees with the developer's run `36093822945` (on `tcm-1`), and it is independent of it. The log is
  `evidence/ci-36095908990.log`.

## What could not be verified

- **`/sync --check` after `gitnexus analyze`, and GitNexus `impact`/`detect_changes`:** `gitnexus` is absent here by
  ruling. Not run.
- **The developer's own mutant scripts:** unreachable (see Mutants). They were rebuilt, not re-read.
- **worth-it-window-washing itself:** not on this PC. Its case, an untracked `.agents/`, was probed synthetically, in a
  git repo that ignores `.agents/` and in a directory with no git.
- **The main checkout's build** (`~/Projects/Self-Improving-Agent`, T-172): not on this PC. As the handoff says, a merge
  alone changes nothing for anyone who runs `open-brain state import` until that tree is rebuilt.
- **The CLI's `today`** is the local calendar date. The runs here are dated 2026-09-24 local time and 2026-09-25 UTC.
  Nothing I checked depends on the date.

## Defects

| # | Severity | New? | Defect | Evidence | Suggested fix |
|---|---|---|---|---|---|
| **D1** | medium (test gap) | **new** | T-150's unrecognised-flag refusal has no guarding test. The IF-2 CLI typo assertion `stderr.toContain("--accept-stal")` also matches the stale refusal's `--accept-stale`, and the exit code is 1 either way. The CHANGELOG and the handoff present this refusal as tested. | M6 survives, 19/19 green | Assert `unrecognised flag` in the typo case, and add the typo case on a **current** project, where only the flag check can refuse. M13–M15 (untested CLI lines) could go into the same test. |
| **D2** | medium | **new** | A UTF-8 BOM defeats `declaredSession`. `lines.findIndex(l => l.startsWith("# "))` misses `\uFEFF# Title`, so the status blockquote is never read. A stale input becomes "could not tell", under the false reason "names no `Session N`…", and `--commit` proceeds **without** `--accept-stale`. This is the one route found past T-180's block. | PROBE-8; `drive.meta` on this PC starts with U+FEFF (PowerShell `Add-Content -Encoding utf8`) | Strip a leading U+FEFF in `readOptional`, or in `declaredSession`, with a BOM test in the IF-2 style |
| **D3** | medium | pre-existing (master identical) | With no `SESSIONS/` directory, `--commit` writes `state.json` and the snapshot, rewrites INBOX.md and task.md, then fails with ENOENT rendering `next-session.md` (exit 1). The project is left half-migrated, and every later `--commit` or `--draft` refuses. | PROBE-2, in both runs | Create `SESSIONS/` before rendering, or refuse before the snapshot when it is absent |
| **D4** | low–medium | pre-existing (master identical) | A token without `--` is taken as the positional directory, and the first such token wins. `-accept-stale` or `accept-stale` is silently ignored on a current project. Placed before the directory, it resolves against the cwd and walks up, so **the cwd's project is committed instead of the named one**. The CHANGELOG line "Any flag `state import` does not recognise now refuses" is true only for `--` tokens. | PROBE-5b and PROBE-12, in both runs | Refuse any `-`-prefixed token that is not known, and more than one positional; or require the directory to exist |

## Disagreements, returned rather than scored

1. **Ruling 2's condition, "holds only importer inputs".** `Session_13.md` is not an importer input.
   `findLastSession` reads only the highest `Session_N.md` (14), and nothing reads 13. The fixture README says both logs
   are kept "because `findLastSession` reads only the highest", which argues for dropping 13. The file is byte-identical,
   public and secret-free, so this is not a risk. It is a wording point on whether the condition is met as the ruling
   states it.
2. **An input that declares a session ahead of the latest log is reported `current`.** The brief asks only about inputs
   that *predate* the latest session, so I have not scored this. But the handoff's own limit 4 (renumbering, per-worktree
   counters) is exactly what a declared session *ahead of* every log indicates. I would call it "could not tell", with
   that reason.
3. **The handoff's "exactly lines 142-143"** is right about the assertions changed. The hunk also adds a comment line.
   Wording only.

## Error entries and near-misses (mine)

- **E1: relative paths handed to a child process.** The first run of `probes.mjs` passed paths relative to my cwd to a
  CLI spawned with `cwd = <scenario>`. Every scenario failed with `Cannot find module …\qa102\qa102\cand\…`. I caught it
  on the first output, before any result was read as a finding. The fix was to resolve every argument to an absolute
  path.
- **E2: a hand-typed constant the code under test exports.** I typed the report path as `.agents/import-report.md`,
  but the real path is `.agents/state.import-report.md`. That gave 6 false FAILs (IF-1, IF-2 ×3, IF-4 ×2). The CLI's own
  output, printed two lines above, showed the real path. The fix was to import `DRAFT_REL`/`REPORT_REL`/`STATE_REL` from
  the build. Nothing from that run was reported.
- **Near-miss: the secret-scan plant was malformed** (37 characters against a 35-character format). This is the case
  the planted-positive gate exists for, and it refused to scan. I fixed the plant, not the pattern.
- **Near-miss: a harness note read the report after `--commit` had moved it into the snapshot.** It printed `(none)` for
  PROBE-1's verdict line, while the verdict lines printed before the commit were correct. I fixed it to read before the
  commit and re-ran both the candidate and master. The evidence is from the re-run.
- **Scope slip, no harm:** for IF-6 on `e082983` I ran `npx vitest run tests/pipelines/` (33 files, 405 tests) rather
  than the red-check file alone. It is not a full suite, and the only failing file was the red-check file. It also ran
  on master code, so the dispatch's single full-suite run at `f6b6d44` is still the only one.
- **The first `git commit` of this report failed:** `Author identity unknown`, because this PC has no git `user.name`
  or `user.email`. I set no config. I committed with `git -c user.name="Aaron Melven" -c user.email=melvenac@gmail.com`,
  for that command only. That is the identity on every seat's commits, including the candidate's and earlier `qa/`
  branches. Whether the QA PC should have a configured identity is Aaron's call, and it is noted in Open 7.
- **Left behind on purpose:** the scratch worktrees `C:\Users\Aaron Melven\qa102\cand` (clean) and `…\qa102\master`
  (detached at `9bc06e3`, with the candidate's two test files and the fixture staged for the IF-6 check) remain for
  reproduction. They are outside the repo's working tree and on no branch. `git worktree remove` clears them.

## Reproduction

```sh
# scratch = C:\Users\Aaron Melven\qa102 ; S = docs/loops/qa-scripts-importer
git worktree add --detach $scratch/cand f6b6d44 && (cd $scratch/cand/open-brain && npm ci && npm run build)
git worktree add --detach $scratch/master 9bc06e3 && (cd $scratch/master/open-brain && npm ci && npm run build)
git clone --no-checkout https://github.com/melvenac/A2A-Hub.git $scratch/a2a-hub
node $S/fidelity.mjs . $scratch/a2a-hub
node $S/secrets.mjs $scratch/cand/open-brain/tests/fixtures-import-a2a-hub
node $S/probes.mjs $scratch/cand $scratch/a2a-hub $scratch/probes           # 26 passed, 0 failed
node $S/probes.mjs $scratch/master $scratch/a2a-hub $scratch/probes-master  # 7 passed, 19 failed (master)
node $S/mutants.mjs $scratch/cand $scratch/mutants
# IF-6: (cd $scratch/master && git switch --detach e082983) then npx vitest run tests/pipelines/state-import-fixes.test.ts
#       and, at 9bc06e3, `git checkout f6b6d44 -- <the two test files> open-brain/tests/fixtures-import-a2a-hub`, then vitest on them
# Full suite: (cd $scratch/cand/open-brain && npx vitest run > suite.out 2>&1; SUITE_EXIT=$?)
# Sync: git clone <this repo> $scratch/syncclone && checkout f6b6d44 && npm ci && npm run build && node open-brain/build/cli.js sync
# CI: git branch qa/importer-fixes-ci f6b6d44 && node docs/loops/qa-102/push-qa.mjs qa/importer-fixes-ci
#     gh workflow run ci.yml --ref qa/importer-fixes-ci -f hosted=false
```

## Open for the planner

None of these blocks the report. Each has my recommendation.

1. **D2 (BOM).** Should the fix ride with this candidate before merge, or follow it? *Recommendation: with it.* It is a
   one-line strip plus one test, and it is the only route found past the STALE block.
2. **D1 (the unguarded T-150 refusal).** *Recommendation: fix the typo assertion in the same pass as D2.* The behaviour
   is correct today (PROBE-5), so this is not a merge blocker on its own.
3. **D3 and D4 are older than the candidate.** *Recommendation: file them as tasks.* D3 matters for adoption, because a
   project without `SESSIONS/` gets bricked on its first import. D4's wrong-project case needs an operator typo while
   standing in another drafted project.
4. **Handoff limit 5** (PROBE-7: bump a marker after `--draft`, and the stale draft commits with no note). *Recommendation:*
   have `--draft` record a hash of each input in the draft report, and have `--commit` refuse, or at least say so, when
   one differs.
5. **Disagreements 1 and 2** (`Session_13.md` in the fixture; a declared session ahead of the latest log) are yours to
   rule on.
6. **The `ci-status` check misreads "gh auth login" as unauthenticated** in a clone whose origin is not GitHub. This is
   minor and predates the candidate. It could go into a sync-hygiene task.
7. **The QA PC has no git identity** (see Error entries). Every headless QA commit has to pass it per command.
   *Recommendation:* set it once in the QA worktree's local config, or have the driver pass it, so that a later seat
   does not stall there.

**Branch:** this report and `docs/loops/qa-scripts-importer/` are committed on `qa/importer-fixes-report`, based on
`3258372`, and pushed with `push-qa.mjs`. The driver records the read-back. `qa/importer-fixes-ci` (at `f6b6d44`) is
this seat's only other push.

QA-102: REPORT COMPLETE
