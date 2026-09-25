# Loop 15 slice three — QA report A9: candidate A9 `6bd97f2`: REJECTED

**By:** the QA seat, record session **104** (the dispatch assigned it) · **Date:** 2026-09-25 (UTC).
**Where:** the QA PC `desktop-o4egb1e` (D-045), in `C:\Users\Aaron Melven\Worktrees\sia-qa`, launched headless by
`docs/loops/qa-104/drive.ps1`. Nobody watched the run and the planner could not be reached. Every question I would have
asked is in **§15, Open for the planner**, with what I did instead.
**Model and effort:** the driver launched `--model claude-opus-5-5 --effort high`, and the transcript agrees (§0.1).

**Dispatch:** `docs/loops/loop-15-slice-3-dispatch-qa-a9.md` at `fcfbaeb`, the QA tree's HEAD (`drive.meta`
`head=fcfbaeb9…`). `origin/docs/session-100-qa99-dispatch` moved to `dd14852` during the run (a round-2 importer brief
and state); neither commit touches the dispatch, the rulings or the criteria.
**Criteria:** `docs/loops/loop-15-slice-3-qa-criteria-a.md` at **`6672e83`** (FINAL). Its blob `1551f364` is the same
at `6672e83`, at A8 and at A9. Read with **rulings-9 to rulings-16**:
- rulings-9 to 15: each blob in the QA tree equals `origin/master`'s;
- **rulings-16** (blob `2d3ebe94`) is on `origin/docs/session-100-qa99-dispatch` only, as the dispatch says. Its
  "every defect and question, assigned" table is scored as it says (§2).
- **D-042 (R67)** and **D-046 (R69)** are in force.

**Candidate (frozen):** **`6bd97f2a573394ce84f986531975f3d509d484c5`** on `origin/loop/15-slice-3-candidate-a9`, on A8
`9e2dd5d`. I read each commit's `git diff --name-only`, and the dispatch's table matches it:
- `5cf0b8b`, the R76 merge (80 files against its first parent);
- `0504910`, the two test files;
- `cb2b605`, `configwatch.ts` and `runtime.ts`;
- `0423d97`, `configwatch.ts`;
- `1c1d91c` and `6bd97f2`, the handoff only.

Built by Grok 4.7 in Cursor, developer record 103. I read the handoff (`docs/loops/loop-15-slice-3-a9-developer-handoff.md`
at `6bd97f2`) in full.

**Known positives:** A8 `9e2dd5d`, as a `git archive` copy with its own `npm ci` and build (win32), and as CI branches
carrying A9's `ci.yml` (Linux, tcm). Its `configwatch.ts` blob `db75d772` matches the SHA; A9's is `1e1e3183`.
**Scored on:** win32 (Windows 10 Pro 19045), git `2.55.0.windows.5`, Node v22.23.3. Symlinks and junctions can be made
here without a prompt.
**Linux:** CI on this seat's own `qa/loop-15-slice-3-a9-*` branches, **all on tcm** (`Machine name: 'tcm'`, runners
`tcm-1` and `tcm-2`, **git 2.43.0**). **9 of the 10 allowed runs used** (§5.2).

---

## Verdict: REJECTED. A9 closes A8-1, A8-2 and A8-3 as QA 99 measured them, and R72's decision-by-comparison holds. But a role that makes a watched tree unreadable still ends the config window before any restore, R73's lstat-failure and read-record clauses are not built, and R72's "a placeholder never stands alone" is broken in four shapes

**What A9 fixed, measured against the named known positives:**

| Item | At A8 | At A9 | Evidence |
|---|---|---|---|
| **A8-1** (facts on unread records) | none | **closed** | R68-STABLE-UNREAD, R68-NOT-A-FILE, R70-HANDLE-FACTS: red at A8 on win32 and Linux, green at A9 on both. R68-UNREADABLE-STABLE (Linux): same. The stable text is now `not read: different file; type file dev … ino … nlink 2 size … mtimeNs …` |
| **A8-2** (an in-place write to an unreadable machine path is silent) | silent | **closed** | WRITEONLY-LATER and R68-UNREADABLE-LATER: red at A8, green at A9 (Linux). **Through `runLoop`** (mine, R72-UNREADABLE-LOOP): at A9 a qa line `unreadable; stage start … size 23 … → unreadable; current … size 56 …`; at A8 no line |
| **A8-3** (the `base` label; `type`) | wrong facts; no `type` | **closed as QA 99 measured it** | R71-BASE-LABEL and R68-TWO-NAME-LATER-FACTS: red at A8, green at A9. But see A9-5 for R74's own words |
| **A8-4** (R75's tests) | missing | **met, with gaps** (§4) | the developer's seven mutants are byte-identical to local rebuilds, and each kills its own test on CI |
| **A8-5** (the duplicated comment) | present | **gone** | — |
| **R72, the class** (`runtime.ts:1064`) | text equality | **decided by `changed`** | `runtime.ts:1064` is `if (!f.changed) continue;`, and no other comparison of `before` and `after` remains in `runtime.ts` (§3.1) |
| **R72, repository side**, an unreadable file | an exception string | **reported with facts** | R72-REPO-UNREADABLE-AT-START (mine): `unreadable; type file … size 209 … → unreadable; … size 234 …`. Red at A8 |
| **R76 / CA-12's 8.3 path** | failed | **passes** | the full suite at `6bd97f2` on this PC: exit 0; `paths.test.ts` 14 of 14, including "finds a mixed-case directory through its lowercased canonical path" and #156's "resolves a real 8.3 short-name segment" (§5.1) |

**Why it is rejected.**

**A9-1 (high; pre-existing, measured at A8 too): a role that makes a watched repository TREE unreadable ends the config
window before anything is put back. A planted `core.fsmonitor` stays in `.git/config`, the record never names it, and
it fires on the next plain `git status`.**
- `closeAndRestore()` builds its path set with `currentFiles()` → `listTree()` → `readdirSync`, **outside** the
  per-path `try` (`configwatch.ts:727` at A9). `identify()` rethrows every `lstat` error except ENOENT and ENOTDIR
  (`:113–128`).
- **Measured on Linux** (`qa104-a9-probe3.test.ts`, run `36106489579`): the developer appends `core.fsmonitor =
  <script>` to `.git/config`, then makes `.git/hooks` mode 000.
  - The loop ends `runtime-error` at the developer stage: "EACCES: permission denied, scandir '…/.git/hooks' …
    Recover by hand before rerunning". **Not `stage-changed-config`.**
  - There is **no developer config verdict**; the only verdict is the planner's "no repository config or hook
    changed". The `.git/config` write is in no record.
  - `.git/config` is **not restored**: after the loop it still holds the planted line.
  - The runtime itself never ran the program (the marker is empty after the loop), so CA-1's inside-the-runtime clause
    holds.
  - **Control, same test:** a plain `git status` in that repository afterwards writes the marker (`fired`). A person
    following "recover by hand" with an ordinary git command runs the role's program.
- **Same result at A8** (`36107488769`, the same probe file on `9e2dd5d`). A9 did not introduce it; it is found now.
- **Rows:** CA-15 clause 1 ("The stage fails `stage-changed-config` … ends in a `LoopResult` and `FAILED.md`"); CA-4a
  and CA-1's order ("the restore must finish before any git call reads the repository", `runtime.ts:1049` comment:
  the restore does not finish at all); **R72** ("A write to a watched config path during a stage is never silent,
  whether or not the runtime can read the file … applies on both sides").

**A9-2 (medium; pre-existing, measured at A8 too): where `lstat` itself fails, the machine side throws. It does not
record the failure, as R73 requires.** R73: "Where `lstat` itself fails, the record says that, with the error code. It
is **never an empty side**."
- `observe()` calls `identify(p)` first (`:931`), and `identify` rethrows EACCES. A9's new code handles a failed
  `realpath` (`did not resolve: <code>`, `:982–984`), not a failed `lstat`.
- **Measured on Linux** (`qa104-a9-probe2.test.ts`, `36106162274`):
  - R73-LSTAT-EACCES-UNIT: HOME made mode 000 inside the stage; `compare()` throws `EACCES: permission denied, lstat
    '…/.gitconfig'`. No record;
  - R73-LSTAT-EACCES-LOOP: through `runLoop`, the loop ends `runtime-error` at the developer stage. The developer stage
    has **no machine record** for the path (only the planner's). The ref window, the allowlist and any rollback never
    run for that stage.
- **Same at A8** (`36107488769`).
- **Rows:** R73 (the lstat-failure clause, which the dispatch named in item 3); CA-4f's "Fail: … a change that fails
  the stage" (the change here fails the loop and is not reported as a finding).

**A9-3 (medium): R73's "read or not" is not built. A READ record carries a hash and no facts.** R73: "Every watched path,
in every stage's record, carries the `lstat` facts: type, `dev`, `ino`, `nlink`, `size`, `mtimeNs`. **Changed or not,
read or not.**"
- The read/read row is `row(opened.hash, end.hash, …)` (`:1129`); the read branch prints `end.hash` alone (`:1133–1136`).
- **Measured** on win32 and Linux: R73-READ-STABLE-FACTS, an untouched single-name `~/.gitconfig`, is `df4af436… →
  df4af436…`, with no ino; R73-READ-CHANGE-FACTS, an in-place append, is `ab402cb9… → f204a634…`, with no size.
- The candidate's R73 tests cover unread records only.
- **Row:** CA-15 clause 4 ("the record says what happened"), under R73. If "read or not" was not meant for read
  records, this is not a defect (§15, question 2).

**A9-4 (medium): R72's "a placeholder never stands alone for a side that has facts" is broken wherever the stage started
unreadable and ended otherwise, and for a dangling link.** R72: "Its two sides print whatever the runtime has for each
(facts, hash, or both). A placeholder (`unreadable`, `absent`) never stands alone for a side that has facts."
- `stageBefore()` returns the bare word `"unreadable"` (`:1117`) although the stage-start snapshot has its facts. A9
  prints `unreadable; stage start <facts>` only when BOTH sides are unreadable (`unreadBoth`, `:1160`, `:1170`).
- **Measured on Linux** (`36105737530`), each with EACCES at the stage start asserted:
  - R72-BEFORE-BARE-READ: made readable and edited → `before: "unreadable"`, `after: 0034e104…`;
  - R72-BEFORE-BARE-TWONAME: replaced by a two-name file → `before: "unreadable"`;
  - R72-BEFORE-BARE-LINK: a symlink planted at the path → `before: "unreadable"`.
- **`absent` for a side that has `lstat` facts** (Linux `36106162274`; win32 in the A9 and A8 archives, run after the
  suite): R72-BEFORE-ABSENT-DANGLING, a dangling
  symlink at base and at the stage start whose target the role creates → `before: "absent"`. The link was there;
  `stageBefore` says `absent` whenever `realpath` failed, whatever the code.
- **The candidate's own test pins the bare placeholder:** "R71 A6-5: a failed read at stage start is the word
  unreadable, not absent" asserts `expect(row?.before).toBe("unreadable")`.
- **Known negative:** `FIX-before-facts`, a one-line build that makes that line return `unreadable; stage start
  <facts>` (§4). On tcm (`36109020869`) it **heals all three** R72-BEFORE-BARE probes (`before: unreadable; stage start
  type file dev 66306 ino 4202847 …`) and reddens exactly three tests: the candidate's R71 A6-5 test and QA 99's
  R71-UNREADABLE-START and R71-UNREADABLE-AT-BASE, each of which asserts the bare word. So the probes are right, and
  the fix is one line.
- **Row:** CA-15 clause 4, under R72's last bullet.

**Lower** (§9):
- **A9-5 (low, R74's words):**
  - the gained-a-name text is `handle is a different file; the object gained a name inside open; not read; …`. R74:
    "the text says exactly that, **not 'different file'**" (R74-GAINED-BASE, R74-GAINED-NEW, win32 and Linux);
  - the loop base's facts are labelled `base`, not `loop base` (R74-LABELS). The facts are now the loop base's, so the
    text is true; the label is not R74's word (§15, question 3).
- **A9-6 (low, R73's edges):**
  - a stable dangling symlink's record is `unwatched: did not resolve: ENOENT; not read` with no facts, although
    `lstat` succeeds on the link (R73-DANGLING-STABLE);
  - `before: "absent"` carries no error code, where the stable record for the same path says `did not resolve:
    ENOENT` (R73-ABSENT-BEFORE-CODE);
  - an absent loop base is printed as facts: `not read: base unresolved type absent dev null ino null nlink 0 size 0
    mtimeNs 0`. `nlink 0 size 0 mtimeNs 0` are not facts of anything.
- **A9-7 (low, R75's coverage):** R72's core protection has no killing test. `M-R72-runtime` (A8's text-equality line
  back in `runtime.ts:1064`) kills nothing on win32 or Linux (`36107446599`). At A9 it is equivalent, because every
  change's texts now differ. So R72's rule is kept by the texts, not by a test (§4). The facts in the type-change and
  `absent → symlink` texts have no test (`M-R73-typechange`, `M-R73-absentlink`: 0 kills).
- **A9-8 (cosmetic):** the read branch keeps a text comparison that is always true (`if (before !== end.hash ||
  opened.state !== "read")`, `:1134`); an unreadable repository file that cannot be put back is listed as
  "(snapshot was file; not followed)", which describes a link, not an unread file.

**The size mutant's wider kill set (dispatch item 5): the handoff's reason is incomplete; the cause is timing.** §4.1.

**The full suite at `6bd97f2`: `SUITE_EXIT=0`, 76 of 76 files, 1142 passed, 32 skipped (1174), 0 unhandled** (§5.1). The total equals CI's (1174). R76 did what it was for: the 8.3-path test that failed at A8 on this PC passes. **CA-12 is still not met as measured** only because `/sync --check` after `gitnexus analyze` cannot run here (§6).

---

## 0. Rulings and authority in force

| Source | Where |
|---|---|
| Rulings-1 to 15 | master, as cited by the criteria and reports A3 to A8 |
| **Rulings-16 R72–R76** and its table of every defect and question | `origin/docs/session-100-qa99-dispatch` (`loop-15-slice-3-rulings-16.md`, blob `2d3ebe94`) |
| **D-042** (R67), **D-046** (R69 accepted) | `origin/master:.agents/state.json` |
| The dispatch | `loop-15-slice-3-dispatch-qa-a9.md` at `fcfbaeb` |
| **CI on this seat's own branches** | **D-040**, within the dispatch's cap of 10 runs; 9 used (§5.2) |
| **Pushing this seat's own branches** | only through `node docs/loops/qa-104/push-qa.mjs <branch>`; every push read back by the script |
| **The local window** | the dispatch: this PC is dedicated and quiet (D-045). Process lists around the suite are in §5.1 |

### 0.1 Model and effort

- **The session's init line** (`%USERPROFILE%/sia-qa104/run-0.jsonl`, parsed as JSON by `effort9.mjs`):
  `model: "claude-opus-5-5"`, session `2db08e29-993c-4321-b074-a73d82e0fe1e`, `permissionMode: "dontAsk"`, Claude Code
  `2.1.282`. The init line has no effort field; it carries `per_turn_effort_active`.
- **The host transcript** (`~/.claude/projects/C--Users-Aaron-Melven-Worktrees-sia-qa/2db08e29-….jsonl`, parsed as
  JSON): every assistant entry carries `model: "claude-opus-5-5"`, `effort: "high"` and `perTurnEffort: "high"`. The
  count and time span, read after the last measurement and before the report was committed: **382 of 382 entries,
  06:48:19Z → 09:17:44Z**. That span covers every measurement, mutant, CI dispatch, the suite and the sync clone. The
  turns after it (commit and push) are not in the count.
- **So the transcript agrees with the driver's `--model claude-opus-5-5 --effort high`.**

## 1. Frozen-candidate conditions

| Condition | Observation | Result |
|---|---|---|
| criteria before candidate | `6672e83` is an ancestor of `6bd97f2` (exit 0). **Control:** `dd14852` (the dispatch branch head) exits 1. QA 99's control `d18a196` is now an ancestor, because R76 brought master in | held |
| built on A8 | `9e2dd5d` is an ancestor (exit 0); so is PR #156's `ac4d19b` | held |
| A9's own diff after the merge | `5cf0b8b..6bd97f2`: `configwatch.ts` (+51/−25), `runtime.ts` (±1), `configwatch-a7-seam.test.ts` (+2), `configwatch-links.test.ts` (+200), the handoff (+98). Nothing else | as the dispatch states |
| **tree moved** | `ls-remote` of the candidate branch = `6bd97f2…` at 07:04:48Z and again at 09:15:29Z | **not moved** |
| **QA tree** | detached at `fcfbaeb` throughout. At the start its only porcelain entries were QA 99's report and scripts, untracked copies the driver's copier placed (`drive.meta` `porcelain_lines=2`; each is byte-identical to `95727ef`'s blob). The candidate was examined in archive copies (`C:/qa104/arch/`), a worktree (`C:/qa104/wt-a9`) and a clone (`C:/qa104/syncclone`). CI commits were built with a temporary index | **clean** |
| build | `npm ci` and `npm run build` exit 0 in each archive (06:49Z) and in the worktree (09:10Z) | current |
| **CA-13**, no version bump | `git diff 9bc06e3 6bd97f2 -- package.json open-brain/package.json CHANGELOG.md`: **0 lines**. Against A8 there are 45, all master's v0.44.2 bump, which R76's merge brings | **pass** |

### 1.1 Dispatch item 7: the merge `5cf0b8b` changes nothing of A8's

Checked independently of the planner:
- **parents** `9e2dd5d` and `9bc06e3`;
- **tree** `fd230173`, equal to `git merge-tree --write-tree 9e2dd5d 9bc06e3`;
- `git diff 9e2dd5d 5cf0b8b -- open-brain/src/harness open-brain/tests/harness`: **empty**;
- file by file, against the merge base `f673d5e`:
  - **every one of A8's 27 changed files is byte-identical in the merge to A8, except `.github/workflows/ci.yml`**;
  - **every one of master's 136 changed files is byte-identical in the merge to master, except `ci.yml`**;
  - `ci.yml` is the one file both sides touched. The merge keeps master's tcm runner selection and A8's
    `--reporter=verbose` line, which is exactly a clean three-way merge of the two;
- after the merge, nothing outside `open-brain/src/harness`, the two test files and the handoff changes (`.github`,
  `.agents`, the version files, `README.md` and `open-brain/src/shared` all compare equal between `5cf0b8b` and
  `6bd97f2`).

## 2. Rows

**"Cand. rows"** means the row files run unmutated on win32 in the A9 archive copy with the JSON reporter:
- the six row files, the candidate's `configwatch-a7-seam.test.ts`, every carried probe file, and this seat's
  `qa104-a9-probe.test.ts` and `qa104-seam.test.ts`;
- **285 tests: 219 passed, 56 skipped, 10 failed, 0 unhandled** (BASELINE, 07:04–07:06Z);
- **all 10 failures are probes, none a candidate test:** this seat's R73-READ-STABLE-FACTS, R73-READ-CHANGE-FACTS,
  R73-DANGLING-STABLE, R73-ABSENT-BEFORE-CODE, R74-LABELS, R74-GAINED-BASE and R74-GAINED-NEW; and three obsolete
  assertions: QA 94's NO-SEAM CONTROL, QA 96's R65-FACTS, and QA 96's HANDLE-NLINK-BASE (obsolete by rulings-16 Q3);
- the 56 skips are `skipIf(win32)` and the two real-`claude` rows. Every POSIX row below is read **as passed** from
  CI's per-test output, never from a skip.

**Rulings-16's table, scored as it says:**

| From report A8 | Ruling | A9 must | Observed | Verdict |
|---|---|---|---|---|
| A8-1 | R73 | every watched path, every stage's record: the facts, "changed or not, read or not"; an lstat failure recorded with its code | unread records carry the facts (A8-1's four probes green). **Read records do not** (A9-3). **An lstat failure throws** (A9-2). A dangling link's stable record has none (A9-6) | **FAIL** (A9-2, A9-3) |
| A8-2 | R72 | never silent, decided from the comparison, both sides; no placeholder alone | never silent on the machine side (WRITEONLY-LATER, R68-UNREADABLE-LATER, R72-UNREADABLE-LOOP) and for an unreadable repository FILE (R72-REPO-UNREADABLE-AT-START). `runtime.ts` decides by `changed`. **A repository write is silent when a watched tree is unreadable** (A9-1). **The bare placeholder stands alone in four shapes** (A9-4) | **FAIL** (A9-1, A9-4) |
| A8-3 | R74 | labels `loop base`/`stage start`/`current`; `type` on every side; the gained-a-name text | `stage start` and `current` present; the loop base's facts are true and labelled `base`; `type` on every fact set (R74-LABELS: 2 of 2 in `after`; R74-TYPECHANGE-TYPE: 2 of 2). The gained-name text still says "different file" (A9-5) | **FAIL, low** (A9-5) |
| A8-4 | R75 | a candidate test and a mutant per protection | met for the six the ruling lists (§4). The runtime line has no killing test (A9-7) | **pass**, with A9-7 |
| A8-5 | cosmetic | removed | removed | **pass** |
| §11.1 / Q3 | Q3 + R74 | refused on both routes; the text says so | refused on both routes (HANDLE-NLINK-BASE and R74-GAINED-BASE: not read). Text: A9-5 | as A9-5 |
| §11.2, §11.3 | recorded | — | OBS-R69-PARENT-NEWDIR still read; GAP-OBJECT-MOVED still read (Linux `36106489579`) | recorded |
| §11.4 | R68-STABLE-UNREAD replaces R65-FACTS | green | green at A9 (win32, Linux), red at A8 | **pass** |
| CA-12 (8.3 path) | R76 | the suite on a base with #156 | `SUITE_EXIT=0`, 1142 passed, 32 skipped; the 8.3 and mixed-case tests pass (§5.1) | **pass** (the suite half) |

**The rows rulings-16 touches, and the rest:**

| Row | Observed | Verdict |
|---|---|---|
| **CA-4f** | the write A8-2 was is now a line (R72-UNREADABLE-LOOP, Linux). ABSENT-BASE-LOOP and R69-GITCONFIG-FIRST both hashes (Linux `36106489579`). **But an lstat failure fails the loop instead of being reported** (A9-2) | **FAIL** (A9-2) |
| **CA-15 clause 1** | the ancestor-link and link rows pass unmutated. **A watched tree made unreadable ends the loop `runtime-error`, not `stage-changed-config`** (A9-1) | **FAIL** (A9-1) |
| **CA-15 clause 3** | QA 89's A4-1 H, J and LOOP `✓` on Linux; R69's edges all `✓` (QA 99's probe, Linux `36106489579`, win32 BASELINE); D-042's trade (TRADE-LOCKRENAME, TRADE-HARDLINK-ELSEWHERE, TRADE-NEW-TWO-NAME, HARDLINK-SAME) `✓`; R70: HANDLE-NLINK `✓`, R70-APPEARED-NLINK `✓` | **pass** |
| **CA-15 clause 4, CA-14** | **met:** A8-1's texts, A8-2's texts (both fact sets), A8-3's label facts, the repository unreadable file; r62's EXISTBETWEEN, EXISTBETWEEN2 and NEWBETWEEN `ok: true` (CA-14; controls `ok: false`). **Not met:** A9-3, A9-4, A9-5, A9-6 | **FAIL** (A9-3, A9-4; A9-5, A9-6) |
| **CA-11** | "config outside the repository … role writes hashed and reported": held for A8-2's write; **not** for the lstat-failure shape (A9-2). The repository row: A9-1 | **FAIL** (A9-1, A9-2) |
| **R54, R62, R64** | the machine side decides from the facts (`sameId`); the repository side from `changed`, now with `readError`. M-dev8-facts kills 11, M-dev9-facts7 3, M-dev-identity9 3, M-R54-9 3, M-R71-before9 5. The repository side and the machine side now both print the facts they compare, **except on a read record** (A9-3) | **pass**, with A9-3 under R73 |
| **CA-1** | Cand. rows pass. **M-L2 kills 16**, A8's count; among them process-role's "a role that sleeps, then writes a ref and plants a hook" and its CONTROL. **In A9-1 the planted program did not run inside the runtime** (marker empty after the loop), so CA-1's own clause holds there; what fails is the restore and the record | **pass** |
| **CA-2.1–2.6** | Cand. rows pass. **M-2.5-refuse-node** kills 16. On tcm, "2.5 CONTROL: the real claude launcher resolves" **ran and passed** (`36106489579`); it skips on this PC | **pass** |
| **CA-3a–d, order** | Cand. rows pass; preflight is untouched by A9. M-2.5-refuse-node kills CA-3a/3b's row | **pass** |
| **CA-4b** | spawn-sites pass. **M-R16 kills 7** | **pass** (R16) |
| **CA-4c, CA-4e, CA-4g** | Cand. rows pass. **M-L0 kills CA-4c's own row and CA-4e.** probe2 H at A9 is identical to A8 (§3.5). M-L2 kills CA-4g's repo-local cell | **pass** |
| **CA-4d** | **M-L2-norestore kills 19**, the CA-4d row ("names its files and trees") among them | **pass** |
| **CA-4h, CA-4i** | Cand. rows pass; the CA-4h rows are among M-L2's kills. M-backstop not run (§4's cut) | **pass** on the rows |
| **CA-5** | Cand. rows pass on `2.55.0.windows.5`. On tcm, the CA-5 row prints "on this git (**git version 2.43.0**)" `✓`. **The two versions are now 2.43 and 2.55 again**, as the row wants | **pass** |
| **CA-6** | Cand. rows pass; tcm: both POSIX rows and the three timeout rows `✓` (`36106489579`). probe2 SINGLE and DFORK identical to A8 | **pass** |
| **CA-7** | Cand. rows pass. **M-2.5-refuse-node** kills 16, A8's count, which report A7 read as including all five CA-7 rows | **pass** |
| **CA-8** | probe2 COMPOSE identical to A8. **M-L2 kills CA-8** | **pass** |
| **CA-9** | red on tcm in every run, including the developer's redcheck `36095548004` (no product change) and every one of mine: tcm's `claude` does not list `--permission-prompts`. **Attributed to the runner** (the dispatch). **Run against this PC's `claude` 2.1.282** (`~/.local/bin/claude.exe`, put first on `PATH` for the one test, in the A9 archive): **`✓`**, exit 0, and all nine adapter flags are listed in its `--help` (`ca9.sh`) | **pass** on this PC; red on tcm, attributed |
| **CA-10** | **M-CAS kills 1** | **pass** on (1) |
| **CA-12** | **full suite exit 0** (1142 passed, 32 skipped; the 8.3 test passes, §5.1). CI on A9 code: every candidate test `✓` except CA-9 (attributed). Plain `sync` exit 0 in a scratch clone; `sync --check` exit 1 on one issue whose inputs are master's (§6). **`/sync --check` after `gitnexus analyze`: UNRUN** (no `gitnexus` here) | **not met as measured**, only for the `gitnexus` half; returned (rulings-16 Q5) |
| **CA-13** | 0 lines against master | **pass** |
| **R35** | QA 89's Linux R35 `✓`; the candidate's R35 symlink row `✓` on tcm. The loop probes `r35base`, `r35edit` and `r35anchorEdit` are identical to A8 in every verdict and victim field | **pass** |
| **R50** | M-dev7-r50 kills 1. The historical M-R50 survives, as at A7 and A8 (equivalent under R64) | **pass** |

## 3. Detail

### 3.1 Dispatch item 2: R72, both sides

**The runtime.** `runtime.ts` at A9 has one reading of a finding's `before` and `after`: line 1067 prints them into the
line. The skip is `if (!f.changed) continue;` (`:1064`); `f.after.startsWith("type change:")` (`:1065`) chooses a
sentence, not whether to report. I searched `runtime.ts` for `.before`, `.after`, `before ===` and `=== f.`; nothing
else compares them. In `configwatch.ts` one text comparison is left, in the read branch (`before !== end.hash`), and it
is always true there because `opened.state !== "read"` in that branch (A9-8).

**The machine side, an unreadable path written in place (Linux).**

| Probe | At A8 | At A9 |
|---|---|---|
| WRITEONLY-LATER (QA 96), R68-UNREADABLE-LATER (QA 99) | × silent | **✓** |
| R72-UNREADABLE-LOOP (mine, `runLoop`: developer `chmod 0200`, qa appends) | × no qa line | **✓** a qa line: `unreadable; stage start type file dev 66306 ino 4201377 nlink 1 size 23 … → unreadable; current … size 56 …` |
| the candidate's "R72: an in-place write to an unreadable file is a change" | red at the redcheck | ✓ |

**QA 99's known negative for A8-2's shape (its §14), used:** M-R71-unreadable on A8 (`36087328580`, re-read per test;
GitHub-hosted `ubuntu-24.04`, as QA 99 ran it): WRITEONLY-LATER and R68-UNREADABLE-LATER **`✓`**. So the same two probes
are red at A8, green on A8's known negative, and green at A9: they see the shape in both directions, and A9's green is
not a probe that cannot fail.

**The repository side.**
- **An unreadable FILE** (the handoff says what it tested: mode 0200 after the window opened). Mine makes `.git/config`
  mode 0200 **before** `begin()` and appends (R72-REPO-UNREADABLE-AT-START):
  - at A9: `modified (unreadable; type file dev 66306 ino 4201262 nlink 1 size 209 … → unreadable; … size 234 …)`,
    `ok: false`. It cannot be put back (no bytes were read), and the verdict says so, in the words "(snapshot was file;
    not followed)" (A9-8);
  - at A8: red (`begin()` throws EACCES from `readFileSync`);
  - control, untouched (OBS-REPO-UNREADABLE-STABLE): `ok: true`, no change;
  - **M-R72-repo-catch** (A8's `readState`) kills the candidate's repository test and mine (`36107449005`).
- **An unreadable TREE: A9-1.** The config window ends in an exception before any restore (§ Verdict).

### 3.2 Dispatch item 3: R73, and the lstat-failure text

| Record | Text at A9 | R73 |
|---|---|---|
| stable, two names (R68-STABLE-UNREAD) | `not read: different file; type file dev … ino … nlink 2 size … mtimeNs …` | met |
| a directory (R68-NOT-A-FILE) | `not read: not a file; type dir …` | met |
| stable unreadable (R68-UNREADABLE-STABLE, Linux) | `unreadable; type file …` | met |
| handle refusal (R70-HANDLE-FACTS) | `handle is a different file; the object gained a name inside open; not read; type file … nlink 2 …` | met (facts); the words: A9-5 |
| type change (R74-TYPECHANGE-TYPE) | `type change: … is a symlink target …; not read: base … type file …; current … type file …` | met |
| **a READ record** (R73-READ-STABLE-FACTS, -CHANGE-FACTS) | the hash alone | **not met** (A9-3) |
| **realpath fails**, absent path (R73-LSTAT-FAIL-STABLE) | `unwatched: did not resolve: ENOENT; not read` | met; **M-R73-code** kills it |
| **lstat fails** (EACCES) | **an exception out of `compare()`** | **not met** (A9-2) |
| a dangling link, stable (R73-DANGLING-STABLE) | `unwatched: did not resolve: ENOENT; not read`, no facts although `lstat` succeeds | not met (A9-6) |
| `before` of an absent stage start (R73-ABSENT-BEFORE-CODE) | `absent`, no code | not met (A9-6) |

### 3.3 Dispatch item 4: R74

- **Labels.** R74-LABELS (win32 and Linux): `before: stage start type file dev 66306 ino 4200922 nlink 2 size 22 …`;
  `after: not read: base … ino 4201484 nlink 1 size 23 …; current … ino 4200922 nlink 2 size 41 …`. The facts after
  `base` are the loop base's (ino `4201484` is the base file's; the stage start's is `4200922`). The word is `base`,
  not `loop base` (A9-5).
- **`type` on every side:** every fact set in every text I produced carries `type` (R74-LABELS 2 of 2, R74-TYPECHANGE-TYPE
  2 of 2, the handle and stable texts). **M-R74-type** (drop `type` from `factText`) kills 4, among them the
  candidate's R73 and R74 tests.
- **The gained-a-name text** (`qa104-seam.test.ts`, win32 and Linux):
  - R74-GAINED-BASE, the base object: `handle is a different file; the object gained a name inside open; not read;
    type file … nlink 2 …`, not read;
  - R74-GAINED-NEW, a new single-name file: the same text;
  - R74-LOST-NAME (observation): the base object LOSES a name inside open (`nlink 2 → 1`, same dev and ino):
    `handle is a different file; not read; … nlink 1`. That text is also untrue of the same object, and R74 does not
    cover it (§11);
  - R74-SWAPPED-CONTROL: a different file renamed onto the path inside open: `handle is a different file`, which is true.

### 3.4 On CI's Linux: this seat's branches (all tcm)

| Branch | Base | Run | Runner | Result |
|---|---|---|---|---|
| `qa/loop-15-slice-3-a9-probe` | A9 | **`36105737530`** | tcm-2 | 18 failed, 1252 passed, 5 skipped (1275). Every candidate test `✓` except CA-9 |
| `qa/loop-15-slice-3-a9-probe-on-a8` | A8 + A9's `ci.yml` | `36105739704` | tcm-1 | 34 failed: the known positives red |
| `qa/loop-15-slice-3-a9-probe2` | A9 | `36106162274` | tcm-2 | 21 failed: + probe 2's three |
| `qa/loop-15-slice-3-a9-m-dev9-size` | A9 + the size mutant | `36106192155` | tcm-1 | 28 failed: 7 kills (§4.1) |
| `qa/loop-15-slice-3-a9-probe3` | A9 | **`36106489579`** | tcm-1 | 22 failed: + probe 3. **The base for every mutant diff** |
| `qa/loop-15-slice-3-a9-m-r72-runtime` | A9 + M-R72-runtime | `36107446599` | tcm-2 | 22 failed: **0 kills** |
| `qa/loop-15-slice-3-a9-m-r72-repo-catch` | A9 + M-R72-repo-catch | `36107449005` | tcm-1 | 24 failed: 2 kills |
| `qa/loop-15-slice-3-a9-probe3-on-a8` | A8 + A9's `ci.yml` | `36107488769` | tcm-2 | 38 failed: A9-1 and A9-2 **the same at A8** |
| `qa/loop-15-slice-3-a9-fix-before-facts` | A9 + FIX-before-facts | `36109020869` | tcm-1 | 22 failed: heals R72-BEFORE-BARE × 3; reddens the three bare-word assertions |

**The A8 branches carry A9's `ci.yml`** (the only non-probe file; `git diff --quiet 9e2dd5d … -- open-brain/src` exits 0),
so that A8 and A9 run on the same runners and git 2.43.

Per test at A9 on Linux (`36106489579`), besides §3.1–3.3:
- **every candidate test `✓` except CA-9**, in all four A9 probe runs;
- **QA 99's R69 edges, R70, R71 and OBS probes `✓`**, including R71-UNREADABLE-START and R71-UNREADABLE-AT-BASE. Those
  two assert `before` **equals** `"unreadable"`, the shape R72 now forbids; they are obsolete in that assertion (§14);
- QA 96's ABSENT-BASE-LOOP, TWO-NAME-LATER, WRITEONLY-LATER, STAGE-START-UNREAD, the TRADE rows, HANDLE-NLINK and
  HANDLE-NLINK-CONTROL, REPO-FACTS, REFWATCH-REPEAT `✓`;
- QA 94's GITCONFIG-LOOP, HARDLINK-SAME, R61-UNIT, R61-LOOP, TRADE-DIFF, REPOINT, REUSE, AT-PATH-SAME, UNREAD-BASE `✓`;
- QA 92's STOW-CTL, STOW-H, XDGDIR-*, XDGFILE-CTL, DOWN-CTL, ABS2, ANCHOR-EDIT, VIADIR-EDIT `✓`;
- QA 89's A4-1 CONTROL, H, J, LOOP, R29 row shape, R35 on Linux `✓`;
- red, and obsolete as report A8 §14 lists: QA 89's A4-1 R, QA 94's TRADE-SAME and NO-SEAM, QA 92's STOW-LOOP, QA 96's
  R65-FACTS; and QA 96's HANDLE-NLINK-BASE (rulings-16 Q3).

### 3.5 Dispatch item 6: regressions, and the loop probes on win32

QA 92's `probe15-a5.mts` (31 probes) ran against the A9 and A8 archive copies (09:06–09:09Z, alone; each exit 0,
stderr empty). `shapev9.mjs` is QA 99's comparator with R73/R74's labels normalised.
- **With the machine findings dropped (`NOMF=1`): 0 of 31 differ.** No status, failure code, config verdict, victim,
  token or "in record" field differs between A9 and A8.
- **With them: 7 of 31 differ** (`machineNext`, `machineHard`, `machineHardAbsent`, `r35chainJ`, `r35chainH`,
  `r54Twice`, `r35anchor`). Each difference is R74 or R73 at work:
  - in the qa stage's change text, the facts after `base` are now the loop base's (`nlink 1`), where A8 printed the
    stage start's (`nlink 2`). That is A8-3, fixed;
  - the type-change text now carries `size` and `mtimeNs` for both sides.
- **probe2** (H, R34, SINGLE, DFORK, DMGconfig, DMGhead, DMGindex, COMPOSE), **r57**, **r59** and **r62** are identical
  field by field (`cmpj9.mjs`: 56, 11, 13 and 24 leaves). The only differences are the tree path, timestamps, a
  duration and a PID.
- **A6-2 stays closed:** r62's NEWBETWEEN, EXISTBETWEEN and EXISTBETWEEN2 are `ok: true` at A9, and both controls are
  `ok: false`.
- **The 60 mutants' own loop probes** (the shapes `runmut9.sh` names per mutant) all exited 0.

**D-042's trade, both ways:** TRADE-LOCKRENAME, GITCONFIG-LOOP and the candidate's two R67 tests are read with both
hashes; a hard link made elsewhere does not stop reads (TRADE-HARDLINK-ELSEWHERE, HARDLINK-SAME); a new two-name file
is not read (TRADE-NEW-TWO-NAME, A4-1 H, STOW-H, XDGDIR-H). **M-dev8-r67** (A6's gate) kills 15 (A8: 13), among them both
R67 rows, TRADE-LOCKRENAME and TRADE-HARDLINK-ELSEWHERE. **M-R67-nlink** kills 12 (A8: 6), among them R43, R49 and
TRADE-NEW-TWO-NAME. The additions include the candidate's new R73, R74 and R75 size tests and QA 99's R68 probes: each
plants a two-name file to make it unread, and under this mutant it is read.

## 4. Mutants

**Local, win32.** Each mutant is a `git archive 6bd97f2 open-brain` copy with a `node_modules` junction to the A9
archive's (`build9.mjs`).
- Each edit is asserted to occur the expected number of times **against A9's blob before archiving**, then asserted to
  land and read back.
- **Every one of the 60 builds is `tsc --noEmit` exit 0.**
- The rows are those of §2, read with the JSON reporter against the unmutated **BASELINE** (285 tests). A "kill" is a
  test red under the mutant and not red at BASELINE.
- Sequential, 07:04:06Z → 09:06:49Z, with nothing else of mine running locally. **No run printed an unhandled error.**
  CI dispatches and log fetches ran beside the batch; they use the network only.

**Applicability.** `mutants-a9.mjs` carries every earlier spec: 114 in all, 89 applicable to A9 as written.
- A9's edits broke seven specs that applied at A8: M-R54-7, M-R71-before, M-dev-identity7, M-dev7-facts,
  M-dev7-record, M-dev7-trade and M-follow-a7. Each has an A9 equivalent (`-9`, `9`, or `dev9-…7`).
- **The developer's seven, rebuilt locally from their diffs, are byte-identical to their branch blobs** (§5.2).
  `M-dev9-size` and `M-dev9-mtime` are textually QA 99's M-R68-size and M-R68-mtime, so those two were not run twice.

**60 were run:** every configwatch mutant that bears on A9, the carried layer mutants, R72–R74's own, and one FIX build.

| Mutant | Edit | Kills (win32) | CI (Linux, tcm) | What it shows |
|---|---|---|---|---|
| **M-dev9-r72** (= dev r72) | `changed` false for an unreadable/unreadable change | **0** (POSIX) | `36095827583` re-read: 1 (R72) | R72's machine decision |
| **M-R72-runtime** (mine) | `runtime.ts:1064` back to `if (f.before === f.after)` | **0** | **`36107446599`: 0** | **equivalent at A9**: every change's texts now differ. R72's rule is held by the texts, not by a test (A9-7) |
| **M-R72-repo-catch** (mine) | `readState` throws on EACCES again (A8's) | 0 (POSIX) | **`36107449005`: 2**, the candidate's repository R72 test and R72-REPO-UNREADABLE-AT-START | R72's repository side |
| M-R72-after-bare / M-R72-before-bare (mine) | the unreadable change's `after` / `before` back to the bare word | 0 / 0 (POSIX) | not run: the budget went to A9-1's attribution. The candidate's R72 test asserts `size` on both sides, so each would redden it (read, not measured) | — |
| **M-dev9-r73** (= dev r73) | the stable record without facts | **4**: the candidate's two R73 tests, R68-STABLE-UNREAD, R68-NOT-A-FILE | `36095829425` re-read: 3 | R73 stable |
| **M-R73-handle** (mine) | the handle text without facts | **2**: the candidate's R70 seam test, R70-HANDLE-FACTS | — | R73 on the handle |
| **M-R73-typechange / M-R73-absentlink** (mine) | the type-change / `absent → symlink` text without facts | **0 / 0** | — | no test anywhere (A9-7) |
| **M-R73-code** (mine) | `did not resolve` without its code | **1**: R73-LSTAT-FAIL-STABLE (mine) | — | no candidate test (A9-7) |
| **M-dev9-r74** (= dev r74) | the stage start's facts after `base` again | **2**: the candidate's R74, R71-BASE-LABEL | `36095831228` re-read: 1 | R74's label |
| **M-R74-stagestart** (mine) | no `stage start` label | **1**: the candidate's R74 | — | R74 |
| **M-R74-type** (mine) | `type` out of `factText` | **4**: the candidate's R73 and R74, R74-TYPECHANGE-TYPE, R68-TWO-NAME-LATER-FACTS | — | R74's `type` |
| **M-dev9-handle** (= dev handle) | the gained-a-name words out | **1**: the candidate's R70 seam test | `36095838395` re-read: 1 | R74's handle text |
| M-R74-gained-nlink (mine) | the handle's `nlink` not put in the record | **0** | — | the gained name's `nlink 2` in the facts has no killing test (the candidate asserts the ino only) |
| **M-dev9-size** (= dev size = M-R68-size) | `size` out of `sameId` | **7**: the candidate's R68, R74, R75 size; R75-SIZE-REASON-R74; R68-TWO-NAME-LATER-FACTS, R68-SIZE-ONLY, R71-BASE-LABEL | **`36106192155`: 7** (§4.1) | R75 size; the rest timing |
| **M-dev9-mtime** (= dev mtime = M-R68-mtime) | `mtimeNs` out | **2**: the candidate's R75 mtimeNs, R68-MTIME-ONLY | `36095834697` re-read: 1 | R75 mtime |
| **M-dev9-r71** (= dev r71) | `stageBefore`'s bare `unreadable` → `stage start <facts>` | 0 (POSIX) | `36095836534` re-read: 1 (R71 A6-5) | R71 A6-5's word |
| **FIX-before-facts** (a fix, not a mutant) | the bare `unreadable` → `unreadable; stage start <facts>` | 0 (POSIX) | **`36109020869`**: heals R72-BEFORE-BARE × 3; reddens the three bare-word assertions | A9-4's known negative |
| M-R71-unreadable (QA 99's) | `stageBefore`'s `unreadable` line out | 0 (POSIX) | — | — |
| **M-R71-before9** | "before" from the loop base, all three sites | **5**: the candidate's R68, R74, R75 size; STAGE-START-UNREAD; R68-TWO-NAME-LATER-FACTS | — | R71 A6-4 (A8: 2) |
| **M-dev8-facts** | size and mtime out of `sameId` | **11** | — | R68 (A8: 4) |
| M-dev8-appear | `appeared` out | **7** + 1 healed | — | R69 (A8: 7) |
| M-R69-nlink / -lexical / -typechange / -symlink-both / -basename / -parent | as at A8 | **5 / 0 / 0 / 1 / 1 / 3** | — | R69's edges, each as at A8 |
| **M-R70-nlink** | the handle's `nlink` comparison out | **4** + 1 healed (HANDLE-NLINK-BASE) | — | R70 (A8: 3 + 1) |
| M-dev8-record | repository `stateHash` without size/mtime | **2** | — | A7-4 (A8: 2) |
| M-R59-read8 / M-R67-realpath8 / M-dev8-r67 / M-R67-nlink | as at A8 | **5 / 6 / 15 + 2 / 12** | — | (A8: 5 / 6 / 13 + 1 / 6) |
| M-handle-narrow / M-dev-handle | as at A8 | **8 + 1 / 14 + 3** | — | (A8: 6 + 1 / 14 + 1) |
| M-R29-both / M-dev-object / M-typechange6 | as at A8 | **26 / 23 / 0** | — | (A8: 19 / 17 / 0) |
| M-dev-identity9 / M-dev7-drifted / M-dev9-facts7 / M-dev9-record7 / M-dev9-trade7 / M-dev7-r50 | A9 equivalents | **3 / 1 / 3 / 2 / 1 / 1** | — | (A8: 2 / 1 / 3 / 2 / not run / 1) |
| M-R54-9 | read/read attribution against the loop base | **3** | — | R54(2) (A8: 3) |
| M-R46-basenotes6 / M-R57 / M-R43-repo / M-R49-repo / M-R50 | as at A8 | **1 / 2 / 2 / 3 / 0** | — | identical to A8 |
| M-L0 / M-L2 / M-L2-norestore / M-follow-a9 / M-R16 / M-CAS / M-2.5-refuse-node | as at A8 | **2 / 16 / 19 / 6 / 7 / 1 / 16** | — | identical to A8's counts |

**Every carried mutant that was run kills at A9 at least what it killed at A8.** The additions are the candidate's new
tests and this seat's probes.

**R75's list, each with its own test and a mutant that turns it red** (the ruling's six):

| Protection | Candidate test | Mutant | Red under it |
|---|---|---|---|
| R71 A6-4 (stage-start facts as `before`) | R74's test (`stage start`, `size ${start.size}`) and R68's | M-R71-before9, M-R74-stagestart | yes (5; 1) |
| R71 A6-5 (`unreadable`) | "R71 A6-5: a failed read at stage start is the word unreadable" | dev r71 | yes (CI) |
| R72 on an unreadable file | "R72: an in-place write to an unreadable file is a change" | dev r72 | yes (CI) |
| R73 on a stable unread entry | the two R73 tests (+ the POSIX one) | dev r73 | yes |
| `size` alone | "R75: size alone, with mtime pinned" | dev size | yes |
| `mtimeNs` alone | "R75: mtimeNs alone, same size" | dev mtime | yes |

**Beyond the list** (A9-7): R72's runtime line, the facts in the type-change and `absent → symlink` texts, the
`realpath` error code, and the handle's `nlink` in its record have no killing candidate test.

**The mutant cut:** not run locally, and why:
- M-L1, M-L2-order (+M-L1), M-R18 (+M-L2), M-R15, M-backstop, M-endstate, M-follow-b/-c, M-R44, M-R45 (-record,
  -mkdir), M-R46-root, M-R49-repo+M-R43-repo, M-R50+agrees(-v2), M-R51-refuse-cmd, M-2.5-accept-cmd, M-R55-route,
  M-R59-revert, M-R59-never, M-dev-rest, M-dev-unwatched, M-dev-revert: A9 touches none of the code they edit except
  `configwatch.ts`'s machine side, their rows ran unmutated and pass, and their last kills are A6's and A7's (the same
  cut as report A8 §7.6);
- the 24 specs that are not applicable as written (A5's and A6's that later candidates broke, and the seven listed
  above, each replaced by its A9 equivalent), listed by `applic9.mjs`.

### 4.1 Dispatch item 5: the size mutant, and the reason the handoff gives

The handoff: "Dropping `size` from `sameId` reddens R75's size test, and also R72 and R74, because size is part of R72's
change decision and of R74's printed facts."
- **Measured:** the size mutant is byte-identical to QA 99's M-R68-size (blob `cb178be1`). On tcm (`36106192155`) it
  kills the candidate's R75 size, R72 and R74 tests, QA 99's R68-SIZE-ONLY, QA 94's REUSE, and my two copies of the
  candidate's R72 and R74 shapes.
- **My copies print whether the stage's write moved `mtimeNs`.** In that run neither did (`mtimeMoved: false`): tcm's
  mtime moves in steps of about 1 ms, and both writes landed in the same step as the stage start's state.
- **Their twins force `mtimeNs` to move** (`utimesSync` to a fixed past second). **Both stay green under the size
  mutant** on tcm; on win32 the R74 twin stays green too (the R72 twin is POSIX-only).
- **And the timing varies run to run:** in `36105737530` (A9, no mutant) my copy of the R72 shape printed
  `mtimeMoved: true`. In that run the size mutant would not have reddened it.
- **So:** size is part of the decision, as the handoff says, but the R72 and R74 tests die under the size mutant only
  when their write lands in the same mtime step. That is the dependency R75 said to avoid ("do not depend on a write
  landing in the same timestamp tick"). The ruling accepts the wider kill set. The R75 size test itself pins mtime and
  is deterministic.

## 5. Full suite and CI (CA-12)

### 5.1 The full suite

**The QA full suite at the candidate: 09:10:51Z → 09:14:04Z, `SUITE_EXIT=0`, captured unpiped
(`npx vitest run > file; SUITE_EXIT=$?`).**
- **Where:** `C:/qa104/wt-a9/open-brain`, a detached `git worktree` of the QA repository at `6bd97f2`, after `npm ci`
  (exit 0) and `npm run build` (exit 0); 0 porcelain entries after the build. The QA tree itself stayed at the
  dispatch commit, because the driver reads its stop file and this seat's push script from it.
- `Test Files  76 passed (76)`, **`Tests  1142 passed | 32 skipped (1174)`**, duration 188.93 s, 0 matches for
  `Unhandled|onTaskUpdate`.
- **The total, 1174, equals CI's** on the candidate's code head (`36095775536`: 1168 passed, 1 failed, 5 skipped).
- **The 8.3 path:** `tests/shared/paths.test.ts` 14 of 14 `✓`, among them "finds a mixed-case directory through its
  lowercased canonical path", which failed at A8 on this PC (report A8 §5.1), and #156's "resolves a real 8.3
  short-name segment". `ac4d19b` (#156) is an ancestor of `6bd97f2` (exit 0).
- **The 32 skips** are the win32 skips of POSIX-only tests and the two real-`claude` rows (the adapter does not find
  `claude` on this PC's `PATH`; §7).
- The worktree's HEAD after the suite: `6bd97f2`; 0 porcelain entries.

**The processes on this PC** (`tasklist /V`, just before and just after; the CSVs are in `C:/qa104/suite/`):
- 165 processes before and 169 after.
- The only claude, node or shell processes, before and after: this session's `claude.exe` (PID 8896), 3 × `sshd`,
  2 × `powershell` (the driver), this seat's `bash` shells (4 before, 6 after: the suite script and the shell that
  waited on it), `conhost` (4, 5) and 12 × `msedgewebview2`. There was **no `node.exe`** either time.
- **Defender (`MsMpEng.exe`) had 5 h 09 min of CPU time** at the start of the suite, the most after Idle. It scans the
  files the tests create. I did not measure what it cost the suite.

### 5.2 CI

- **The candidate's code head:** the developer's `36095775536` on `0423d97` (tcm-2) and `36096803947` on `1c1d91c`
  (tcm-2): 1 failed (CA-9), 1168 passed, 5 skipped, re-read per test. **No run exists on `6bd97f2` itself**; the four
  A9 probe runs above are on it, with the probe files added, and every candidate test there is `✓` except CA-9.
- **The developer's redcheck** `36095548004` (`0504910`, tcm-1): 11 failed, the nine new configwatch-links tests, the
  seam's R70 assertion, and **CA-9**. The dispatch's premise holds: CA-9 is red on a commit with no product change.
- `36095550425` on `cb2b605` (tcm-2): 2 failed, CA-9 and R60 (the stow-link test `0423d97` fixes), as the handoff says.
- **The developer's seven mutant runs,** each re-read per test and diffed against `36095775536`:

| Mutant | Run | Runner | Kills (besides CA-9) |
|---|---|---|---|
| r72 | `36095827583` | tcm-2 | R72's unreadable in-place write |
| r73 | `36095829425` | tcm-2 | the three R73 tests |
| r74 | `36095831228` | tcm-2 | R74 |
| size | `36095832746` | tcm-1 | R75 size, R72, R74 |
| mtime | `36095834697` | tcm-1 | R75 mtimeNs |
| r71 | `36095836534` | tcm-1 | R71 A6-5 |
| handle | `36095838395` | tcm-1 | R70's gained-a-name assertion |

  Each matches the handoff's table. **Each branch's `configwatch.ts` is byte-identical to my local rebuild** from its
  diff against `0423d97` (blobs `f1655885`, `9e0b5660`, `d9166fba`, `cb178be1`, `e2dba3a4`, `b22be31b`, `1c39a44a`),
  and `runtime.ts` and the tests equal `6bd97f2`'s. `r74`'s branch is built from `cb2b605` with its own path-fix commit;
  its tree equals `0423d97` plus the one edit.
- **This seat's nine runs** are in §3.4. Budget: **9 of 10 used**; every one ran on tcm, and one queued briefly behind
  another seat's run.

## 6. `/sync --check` and plain `sync` (CA-12)

- **`gitnexus` is not available on this PC** (report A8 §6; rulings-16 Q5). **So `/sync --check` after `gitnexus
  analyze`, as CA-12 asks, is UNRUN.**
- **In a scratch clone** (`plainsync9.sh`): `git clone --no-hardlinks` of the QA repository, detached at `6bd97f2`,
  `npm ci` exit 0, build exit 0.
  - `sync --check`: **exit 1**, "25 passed, 0 fixed, 2 warnings, **1 issues**, 2 skipped".
    - **The one issue is `retirements`**: `.agents/SYSTEM/ENTITIES.md` still names `dream` and `reflection queue`,
      retired 2026-09-15. At A8 there were three (`prd-version`, `summary-version`, `retirements`); R76's merge
      brought master's version and summary, so two are gone.
    - **Its inputs are master's, byte for byte:** `git diff --quiet 9bc06e3 6bd97f2 -- .agents package.json
      open-brain/package.json CHANGELOG.md README.md` exits 0. **Control:** `open-brain/src/harness` differs, exit 1.
      So the issue is master's, not A9's.
    - The skips: `gitnexus-index` ("no .gitnexus/ in this tree … this is not a pass") and `ci-status` ("gh is not
      authenticated" inside the clone's run).
    - The warnings: `obsidian-vault` (no vault on this PC) and `spec-provenance` (no `specs/`).
    - `build-freshness` passed: "build matches HEAD 6bd97f2".
  - **Plain `sync`: exit 0**, "25 passed, **0 fixed**, 2 warnings, 1 issues, 2 skipped". The clone has 0 porcelain
    entries afterwards: nothing was rewritten.
  - **The QA tree was never written:** its only porcelain entries are this report and the driver's two copies of
    QA 99's files, all untracked.

## 7. What could not be verified, stated so nobody inherits it as settled

1. **`/sync --check` after `gitnexus analyze`**: unrun. `gitnexus` is not on this PC (rulings-16 Q5: a question for
   Aaron, recorded as unrun).
2. **CA-9's pin on tcm is red for the runner's reason.** tcm's `claude --help` does not list `--permission-prompts`
   (`36106489579`: "flag --permission-prompts is gone"). On tcm, the other real-`claude` row, "2.5 CONTROL: the real
   claude launcher resolves", **ran and passed** (report A8 §7.2 had neither row running on its hosted runners).
   **On this PC** the pin passes against Claude Code 2.1.282 (§2, `ca9.sh`). "2.5 CONTROL" still skips here, because
   the adapter looks for `claude` on the role's `PATH`, and this PC's is at `~/.local/bin`.
3. **A9-1 and A9-2 on win32.** This session cannot make a file or directory unreadable to itself (report A8 §7.4), so
   both are Linux-only measurements.
4. **How old A9-1 and A9-2 are.** Measured at A8 and A9 only; not bisected.
5. **The mutant cut** (§4): the specs not run locally are listed there with the reason.
6. **The declared unrunnables U1–U6** (criteria §3), **M-R22**, and **CA-9's real run** (candidate A's, attributed).
7. **The writer behind report A7 §3.5's and report A8 §4's `stage-changed-config` sightings:** not seen in this
   session's runs: across the BASELINE and 60 mutants, no `runtime` test failed at all, and the one `refwatch-stage`
   kill is M-CAS's own.

## 8. What the checks I ran cannot see

- **One win32 machine, and tcm's Linux** (self-hosted, git 2.43). The local mutants ran on win32 only, where the POSIX
  tests skip. The Linux mutants are this seat's three (and one FIX build) and the developer's seven.
- **Stub roles and unit windows.** The shapes in §3 are those the dispatch named, those I found by reading `observe()`,
  `stageBefore()` and `closeAndRestore()`, and those the first CI run surfaced. Shapes none of these reached may exist.
- **Timestamp granularity.** tcm's mtime moves in steps of about 1 ms; NTFS here, about 15 ms (report A8 §8).
- **Permissions.** Every "unreadable" shape is POSIX: this PC cannot make a file unreadable to this session (report
  A8 §7.4). A9-1 and A9-2 are measured on Linux only.

## 9. Defects, each with the observation that produced it

| # | Severity | Defect | Observation |
|---|---|---|---|
| **A9-1** | **high** (CA-15 clause 1; CA-4a/CA-1 order; R72 both sides) — **pre-existing, present at A8** | a role that makes a watched repository tree unreadable ends `closeAndRestore()` with an exception before any restore; the loop is `runtime-error`; a planted `.git/config` change is neither restored nor recorded | R72-REPO-TREE-EACCES-LOOP, Linux `36106489579` (A9) and `36107488769` (A8): `scandir … EACCES`; `configRestored: false`, `plantedAfterLoop: true`; the control `git status` fires the planted program. Code `configwatch.ts:727` (`currentFiles()` outside the per-path try), `:113–128` |
| **A9-2** | **medium** (R73's lstat-failure clause; CA-4f) — **pre-existing, present at A8** | an `lstat` failure other than ENOENT/ENOTDIR throws out of `MachineConfigWatch.compare()`; no stage record; the loop ends `runtime-error` | R73-LSTAT-EACCES-UNIT and -LOOP, Linux `36106162274`, `36106489579`, `36107488769`. Code `:931`, `:113–128` |
| **A9-3** | **medium** (R73 "read or not"; CA-15 clause 4) | a read record prints the hash alone, with no facts | R73-READ-STABLE-FACTS, R73-READ-CHANGE-FACTS, win32 and Linux. Code `:1129`, `:1133–1136` |
| **A9-4** | **medium** (R72 "a placeholder never stands alone"; CA-15 clause 4) | `before` is the bare `unreadable` when the stage started unreadable and ended otherwise, and the bare `absent` for a dangling link; the candidate's R71 A6-5 test asserts the bare word | R72-BEFORE-BARE-READ, -TWONAME, -LINK (Linux), R72-BEFORE-ABSENT-DANGLING (win32, Linux). Code `:1117–1118`. FIX-before-facts heals the three `unreadable` shapes (`36109020869`) |
| A9-5 | low (R74's words) | the gained-a-name text still says "handle is a different file"; the loop base is labelled `base` | R74-GAINED-BASE, R74-GAINED-NEW, R74-LABELS. Code `:1032`, `:1155`, `:1169` |
| A9-6 | low (R73's edges; true texts) | a stable dangling link has no facts; `before: absent` has no code; an absent loop base is printed as `dev null ino null nlink 0 size 0 mtimeNs 0` | R73-DANGLING-STABLE, R73-ABSENT-BEFORE-CODE, R72-BEFORE-ABSENT-DANGLING |
| A9-7 | low (R75 coverage) | R72's runtime line has no killing test (equivalent at A9); the type-change and `absent → symlink` facts have no test | M-R72-runtime: 0 kills, win32 and Linux `36107446599`. M-R73-typechange, M-R73-absentlink: 0 |
| A9-8 | cosmetic | an always-true text comparison left in `compare()`; "(snapshot was file; not followed)" for an unread repository file | `:1134`, `:755`; R72-REPO-UNREADABLE-AT-START's `unrestored` |
| A7-5 | probe (carried) | QA 92's STOW-LOOP and the probe15 counters count one finding per path | unchanged |
| D-A2-7, D-A5, R37's named limit | carried | — | the handoff says they are not in A9 |

## 10. Regressions: previously validated behaviour confirmed still working

- **Unmutated rows:** 219 passed on win32; the 10 failures are probes (§2). On tcm, every candidate test `✓` except
  CA-9 in all four A9 probe runs. The full suite: exit 0, 1142 passed.
- **Everything QA 99 found closed stays closed** (dispatch item 6):
  - **A7-1's trigger:** ABSENT-BASE-LOOP (both hashes) and R69-GITCONFIG-FIRST `✓` on Linux; R69-GITCONFIG-FIRST `✓` on
    win32;
  - **R69's edges and guards:** every edge probe `✓` on win32 and Linux, and every guard's mutant kills what it killed
    at A8 (M-R69-nlink 5, -symlink-both 1, -basename 1, -parent 3; the single symlink guards 0 and 0, as at A8);
  - **R70:** HANDLE-NLINK, R70-APPEARED-NLINK `✓`; M-R70-nlink kills 4;
  - **D-042's trade** both ways (§3.5);
  - **A4-1 H, J and LOOP** `✓` on Linux, victim hashes not in the record.
- **A6-1** (GITCONFIG-LOOP, HARDLINK-SAME, R61-LOOP) **and A6-2** (EXISTBETWEEN, EXISTBETWEEN2 `ok`) stay closed.
- **QA 92's 31 win32 loop probes:** identical to A8 in every status, verdict, victim, token and "in record" field. The 7
  that differ differ only in the machine texts R73 and R74 changed (§3.5). **probe2, r57, r59 and r62** are identical.
- **Every carried mutant that was run** kills at A9 at least what it killed at A8 (§4).
- **Regressions:** none found in behaviour A8 had right. A9-1 and A9-2 are present at A8 as well (§11.1).

## 11. Where the criteria, the rulings and the candidate disagree (returned, not scored)

1. **A9-1 and A9-2 are older than A9.** Both are present at A8, measured with the same probe files on the same runner.
   `identify()`'s rethrow and `closeAndRestore()`'s unguarded `currentFiles()` look older still; I did not bisect
   them. They are scored because rulings-16 R72 and R73 now state, in words, what they break. **Returned:** whether
   they are A9's to fix or a separate item.
2. **A lost name inside `open` is also called "a different file"** (R74-LOST-NAME): the same object, `nlink 2 → 1`. R74
   names only the gained case.
3. **R72 and a readable file rewritten with identical bytes** (OBS-READ-SAMEBYTES-RENAME): a lock-and-rename to a new
   inode with the same bytes is `changed: false`. For a read path the decision is the hash; for an unread one it is
   the facts, so the same act is a change on one side and not on the other. Within R72's words ("decided from the facts
   and hashes the runtime compared"). Recorded.
4. **R71 and R72 on the bare word.** R71 says a failed read says `unreadable`; R72 says the placeholder never stands
   alone. The candidate's R71 A6-5 test pins the bare word. `unreadable; stage start <facts>` satisfies both, and A9
   already prints that when both sides are unreadable.
5. **CA-9 and tcm.** The pin is red on every tcm run because tcm's `claude` lacks `--permission-prompts`. §7 has it
   run against this PC's `claude`.

## 12. This seat's error entries and near-misses this session

**Error entries (escaped):** none known.

**Near-misses (caught in-process, not numbered):**
- **R73-PARENT-EACCES, my first shape for the lstat-failure text, was written wrongly.** It restored the directory's
  mode only after its assertions, so when `compare()` threw, the directory stayed at mode 000 and the test's cleanup
  failed too (`scandir … EACCES`). The exception it caught is A9-2. The replacement, `qa104-a9-probe2.test.ts`,
  restores the mode in `finally`; the original test is left as it ran, and its red is read as A9-2, not as a second
  defect.
- **Two new probe files instead of an edit.** Probe 2 and probe 3 were written while the local mutant batch was
  running. `runmut9.sh` copies `qa104-a9-probe.test.ts` into every mutant, so editing it would have given later
  mutants false kills against the BASELINE. They went into separate files that the batch does not run.
- **QA 99's control commit is now an ancestor.** `d18a196` exits 0 at A9, because R76 brought master in. I used the
  dispatch branch head `dd14852` (exit 1) as the non-ancestor control instead.
- **A `sed` edit to `shapev9.mjs` did nothing.** The escaped pattern did not match, and `diff` showed only the header
  and the `NOMF` line changed. I made the label-normalising edit with the editor and re-read it.
- **Driver copies in the QA tree.** At the start the tree held QA 99's report and scripts as untracked files, placed by
  the driver's copier. I compared three of them with `95727ef`'s blobs (identical) and used my own copies in
  `C:/qa104`; I did not touch the tree's copies.

## 13. Reproduction

The scripts are tracked at **`docs/loops/qa-scripts-a9/`** on this seat's report branch, byte-identical to the copies
that ran, with a README. The earlier seats' sets are reused where the README says.

| Branch (pushed with `push-qa.mjs`, read back) | Head | What |
|---|---|---|
| `qa/loop-15-slice-3-a9-probe` | `12c80e0` | A9 + QA 89, 92 v3, 94 × 2, 96 × 3, 99 × 2, 104 × 2 |
| `qa/loop-15-slice-3-a9-probe-on-a8` | `8961172` | the same files on A8, with A9's `ci.yml` |
| `qa/loop-15-slice-3-a9-probe2` | `ab62531` | + `qa104-a9-probe2.test.ts` |
| `qa/loop-15-slice-3-a9-m-dev9-size` | `ef4350e` | probe2 set + the size mutant |
| `qa/loop-15-slice-3-a9-probe3` | `f624d5a` | + `qa104-a9-probe3.test.ts` |
| `qa/loop-15-slice-3-a9-m-r72-runtime` | `f170d8f` | probe3 set + M-R72-runtime |
| `qa/loop-15-slice-3-a9-m-r72-repo-catch` | `1c77a1e` | probe3 set + M-R72-repo-catch |
| `qa/loop-15-slice-3-a9-probe3-on-a8` | `456bed7` | the probe3 set on A8, with A9's `ci.yml` |
| `qa/loop-15-slice-3-a9-fix-before-facts` | `2c355f1` | probe3 set + FIX-before-facts |
| `qa/loop-15-slice-3-a9-report` | this commit | this report and `docs/loops/qa-scripts-a9/` |

**A9-1 in five lines (Linux, not root):**
1. A repository with `.git/hooks` a real directory.
2. The developer role appends `[core] fsmonitor = <script>` to `.git/config`.
3. It then runs `chmod 000 .git/hooks`, and exits.
4. `runLoop` returns `runtime-error` ("scandir … EACCES"), with no developer config verdict; `.git/config` still holds the
   line.
5. `chmod 755 .git/hooks; git status` runs the script.

**A9-2 in three lines:** `~/.gitconfig` is read at base; in a stage the role runs `chmod 000 ~`; `compare()` throws
`EACCES … lstat`, and the loop ends `runtime-error` with no record for that stage.

## 14. Handoff to the next QA session (D-035)

1. **Known positives.**
   - **A9-1, A9-2:** A9 `6bd97f2` and A8 `9e2dd5d`, by `qa104-a9-probe3.test.ts` and `qa104-a9-probe2.test.ts`
     (Linux; they need a non-root runner).
   - **A9-3:** A9 and A8 by R73-READ-STABLE-FACTS and R73-READ-CHANGE-FACTS (win32 and Linux).
   - **A9-4:** A9 by R72-BEFORE-BARE-* (Linux) and R72-BEFORE-ABSENT-DANGLING. **FIX-before-facts is a known negative
     for the three `unreadable` shapes** (`36109020869`); it does not touch the dangling-link shape.
   - **A9-5:** A9 by R74-GAINED-* and R74-LABELS.
2. **Obsolete probe assertions, now including QA 99's R71-UNREADABLE-START and R71-UNREADABLE-AT-BASE** (they assert
   the bare `unreadable`, which R72 forbids), and QA 96's HANDLE-NLINK-BASE (rulings-16 Q3). Still obsolete from report
   A8 §14: QA 89's A4-1 R, QA 94's TRADE-SAME and NO-SEAM, QA 92's STOW-LOOP, QA 96's R65-FACTS.
3. **tcm's git is 2.43.0**, so CA-5 has two versions again. tcm's `claude` has no `--permission-prompts`, so CA-9 is red
   there on every commit.
4. **This PC can make symlinks and junctions, not unreadable files.** Every EACCES shape needs CI.
5. **Keep the seams** (`qa94-handle`, `qa96-seam`, `qa99-seam`, `qa104-seam`, the candidate's own).
6. **Plain `sync` only in a scratch clone.** `gitnexus` is not on this PC.
7. **Nothing is pushed except this seat's own branches, through `push-qa.mjs`; the merge is Aaron's.**

## 15. Open for the planner

Each item is what I would have asked, and what I did instead. None of them blocked the rest of the work.

1. **A9-1 and A9-2 predate A9** (§11.1). I scored them, because R72's "never silent, whether or not the runtime can
   read the file … both sides" and R73's "where lstat itself fails, the record says that" describe exactly what they
   break, and the dispatch named "the lstat-failure text". If they are to be a separate item, A9 still fails on A9-3
   and A9-4.
2. **Does R73's "read or not" cover READ records** (A9-3)? I read it literally. If only unread records were meant, A9-3
   is not a defect.
3. **Is `base` acceptable for R74's `loop base`** (A9-5)? The facts are now the loop base's. I scored the word, low.
4. **The severity of A9-1.** I called it high: the runtime's record omits a planted program-valued key, the file is
   left in place, and the ordinary recovery runs it. The loop does fail, so nothing is accepted.
5. **CA-9 on tcm.** It is red on every tcm run because tcm's `claude` lacks `--permission-prompts`; it passes here
   against Claude Code 2.1.282. A tcm `claude` update, or a runner note, would let CI measure it; that is outside QA's
   authority. I scored it as the dispatch says.

**Dispatch items, each done or written up:** 1 every row re-run (§2; win32 locally, POSIX on tcm, 9 of 10 runs);
2 R72 both sides (§3.1); 3 R73 and the lstat-failure text (§3.2); 4 R74 (§3.3); 5 R75 and the size mutant's reason
(§4, §4.1); 6 regressions and QA 92's 31 loop probes (§3.5, §10); 7 the merge (§1.1); 8 the full suite once, with
processes (§5.1); 9 plain `sync` in a scratch clone, and `/sync --check` after `gitnexus analyze` unrun (§6). No `/end`
(T-163).

QA-104: REPORT COMPLETE
