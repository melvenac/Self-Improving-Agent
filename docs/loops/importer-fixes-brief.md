# Importer fixes (T-175 + T-180): brief for a FRESH developer session (record session 101)

**By:** Atlas (planner), record session 100 · 2026-09-25. **To:** the Claude developer seat (Forge), **record session
101**, in **`~/Worktrees/sia-infra`**. Not `sia-forge`: that is Grok's Cursor workspace, and if A8 is rejected, A9 goes
back there. Two seats must never share one working tree.
**Authority:** Aaron, this session, 2026-09-25: *"yes"* to *"Shall I brief a fresh Forge session for the importer fixes
(T-175 + T-180) now?"*
**Why now:** these two fixes gate every further adoption (`docs/loops/adoption-plan-2026-09-25.md` §3, T-181). They
touch none of candidate A's code, so they run in parallel with QA 99.

## 1. Start

1. Run `/start`. Your record number is **101**; the greeting's number is local (T-164).
2. The tree is clean on `chore/qa-machine` (`de0a525`, pushed and matching origin). Branch from **current master**:
   `git fetch origin && git switch -c loop/importer-fixes origin/master`.
3. **Build first** (`npm ci && npm run build` in `open-brain`). This checkout's build is stale.

## 2. The two fixes, by what they protect

**T-175: another project's record must contain nothing that is not true of that project.**
- The importer hardcodes SIA's own history into every project it imports: `seedVerified()` and `seedGaps()` at
  `open-brain/src/pipelines/state-import/index.ts:353-378`, called at `:440-443`.
- **Every site that reads or reports them:**
  - the report block at `:537`;
  - the `ImportReport` fields at `:76-77` and their zero init at `:430-431`;
  - `cli.ts:450`, which prints "verified N · gaps N";
  - `open-brain/tests/pipelines/state-import.test.ts`.
- Remove the seeds. Keep every report line **true**: an import yields `verified[]` and `gaps[]` empty, and says so.
  Do not delete the counts silently.
- SIA's own record is unaffected: it was imported once, and `--commit` refuses a second run (V-009).

**T-180: the importer must never present an input as current state when it predates the project's latest session
without saying so.**
- The inputs are read at `:395-404` (INBOX, task, next-session, SUMMARY, DECISIONS).
- The latest session is found by `findLastSession` at `:335`.
- **Known positive:** `~/Projects/A2A-Hub` at **`e0bc3f8`**. Its `next-session.md` is Session 13's, while
  `SESSIONS/Session_14.md` exists; its INBOX was last updated at Session 11. Take it with `git archive` into a scratch
  directory, never into A2A-Hub's working tree. Relay's write-up is
  `~/Projects/A2A-Hub/docs/loops/sia-migration-assessment.md`, "First draft", item 4.
- **Also a hard case:** worth-it-window-washing keeps `.agents/` untracked, so git history is not available for every
  project. Whatever signal you use must say which signal it used and which inputs it could not judge. **"Could not
  tell" is a reported result, never silence.**
- **Required behaviour:**
  - `--draft` puts a staleness finding at the **top** of the import report, naming each stale input and the evidence;
  - `--commit` **refuses** while a finding stands, unless the operator passes an explicit acknowledgement. The flag's
    name is yours, and it is refused if misspelled (T-150's rule).
  - How staleness is detected is yours to design. Say in the handoff what it cannot see.

## 3. Acceptance, written before any candidate exists

| Row | Must hold |
|---|---|
| IF-1 | An import of a fixture has empty `verified[]` and `gaps[]`. The report and the CLI line say 0, and the draft passes `parseState`. |
| IF-2 | A2A-Hub at `e0bc3f8` (known positive): the draft report's first section names `next-session.md` as stale, with evidence; `--commit` on that draft refuses without the acknowledgement and proceeds with it. |
| IF-3 | Known negative: a fixture whose inputs are current produces no staleness finding, and `--commit` proceeds without the acknowledgement. |
| IF-4 | An input the detector cannot judge (e.g. untracked, no session marker) is reported as "could not tell", and is never counted as current. |
| IF-5 | A mutant per protection: seeds restored → IF-1 red; detector disabled → IF-2 red; "could not tell" treated as current → IF-4 red. `tsc --noEmit` clean on each mutant. |
| IF-6 | Red first: the new tests alone on `origin/master`, on a `loop/importer-fixes-redcheck` branch. |
| IF-7 | Preserved: the rest of `state-import.test.ts` stays green unchanged; `--draft` still writes nothing but the draft and the report (V-009); the pre-commit snapshot still happens (V-009). |
| IF-8 | `/sync` clean apart from the two known issues (the retirements check on ENTITIES.md, and build-freshness in trees that were not rebuilt). |

## 4. How

- One commit per task. CHANGELOG under the next patch version. **No version bump or tag**: the release is Aaron's (D-019).
- CI: dispatch on your own branches (D-040). Branches cut from current master run on the tcm runners, which cost no
  Actions minutes. **Check that a run's runner is tcm before dispatching more than one.**
- **Ask atlas before a full local suite** (G-042). Other projects' sessions on this machine count.
- Talk to atlas by native A2A (`ListAgents`; the planner is `sia-planner-ac`, or whatever the listing shows). Keep
  `docs/loops/importer-fixes-developer-handoff.md` current.
- **Pushing:** only `loop/importer-fixes*` branches. Never master, never force, and read back each push.
- **On a refusal or a denied command:** stop and tell atlas.
- You do not write `.agents/state.json`; the planner does.

## 5. Hand back

- The frozen SHA, and the handoff covering:
  - changes by task and commit;
  - red, then green, with run ids;
  - each mutant and the tests it turns red;
  - what the staleness detector cannot see;
  - what was not verified;
  - **model and effort, from your transcript.**
- **After merge:** the importer other projects run is the MAIN checkout's build (`~/Projects/Self-Improving-Agent`,
  at `f673d5e` today, behind master). The fix reaches an adoption only once that tree is updated and rebuilt (T-172).
  Say so in the handoff so the release step does not miss it.
