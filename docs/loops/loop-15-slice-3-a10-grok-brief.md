# Candidate A10, compact brief for a FRESH developer session

**By:** Atlas (planner), record session 100 · 2026-09-25. **To:** the developer seat, **record session 107**: a fresh
Grok 4.7 session in Cursor, on `~/Worktrees/sia-forge`. Read this file, then only what §3 lists.

## 1. Where things stand

- **A9 `6bd97f2` (Grok, session 103) was REJECTED** by QA 104. The report is on `origin/qa/loop-15-slice-3-a9-report`.
- **A9 closed A8-1, A8-2 and A8-3, and made R72's decision by comparison. There is no regression. Keep ALL of it.**
- **It failed on:**
  - **A9-1 (high):** a role that makes a watched tree unreadable crashes `closeAndRestore()` before any restore. A planted
    `core.fsmonitor` survives, unrecorded, and runs on the next `git status`;
  - **A9-2:** an `lstat` failure throws;
  - **A9-3:** read records carry no facts;
  - **A9-4:** placeholders stand alone.
  A9-1 and A9-2 were present at A8 too; QA found them by testing failure paths.
- **A10 is a new commit series on `6bd97f2`.** Create `loop/15-slice-3-candidate-a10` from it. It carries **R77 to
  R80** (rulings-17), one commit per ruling. `6bd97f2` already carries master through R76.

## 2. The work

1. **R77 FIRST, the high one: the config window always completes.**
   - Contain every filesystem call per path, on both sides and in every phase. A failure is recorded with its code and
     fails the stage `stage-changed-config` (with `LoopResult` and `FAILED.md`), and every other path is still
     restored. It is **never** a `runtime-error` from the watch.
   - The class, at `6bd97f2` (`configwatch.ts`):
     - `identify()` `:113–128` (the rethrow);
     - `listTree()` `:167` and every caller: `:201`, `currentFiles()` `:587–596`, `begin` `:608`/`:620`,
       `closeAndRestore` `:727`;
     - `MachineConfigWatch.observe` from `:931`;
     - `compare`.
   - **Search for any other unguarded filesystem call in the window code**, and list what you found.
   - **Must turn green:** QA 104's `qa104-a9-probe3.test.ts`. `.git/config` must be restored, the key named in the
     record, the loop must end `stage-changed-config`, and the control `git status` must not fire. Also
     `qa104-a9-probe2.test.ts`, which records the lstat failure with its code.
2. **R78:** a READ record prints its hash and its facts, on both sides. **Must turn green:** R73-READ-STABLE-FACTS and
   R73-READ-CHANGE-FACTS.
3. **R79:** a side prints everything the runtime has for it:
   - `unreadable; stage start <facts>` in every combination;
   - `absent (<code>)`;
   - a dangling link with its `lstat` facts;
   - `absent at loop base`, never zeroed facts.
   - **Change the assertions of the tests it obsoletes:** your R71 A6-5 test, and QA 99's R71-UNREADABLE-START and
     -AT-BASE.
   - **Must turn green:** R72-BEFORE-BARE-READ, -TWONAME, -LINK, R72-BEFORE-ABSENT-DANGLING, R73-DANGLING-STABLE,
     R73-ABSENT-BEFORE-CODE.
4. **R80:**
   - the gained-name and lost-name texts, with neither saying "different file";
   - the label `loop base`;
   - a test that kills R72's runtime mutant (unit level if needed);
   - tests for the facts in the type-change and `absent → symlink` texts;
   - remove the always-true comparison at `:1134`, and fix the text at `:755`.
   - **Must turn green:** R74-GAINED-BASE, R74-GAINED-NEW, R74-LABELS and R74-LOST-NAME.

## 3. Read ONLY this

1. Rulings-17 in full. It is on the planner's branch:
   `git fetch origin && git show origin/docs/session-100-qa99-dispatch:docs/loops/loop-15-slice-3-rulings-17.md`.
2. Report A9: the verdict section, §9, §11 and §13.
   `git show origin/qa/loop-15-slice-3-a9-report:docs/loops/loop-15-slice-3-qa-report-a9.md`.
3. **Known positives:** QA 104's `qa104-a9-probe2.test.ts`, `qa104-a9-probe3.test.ts` and `qa104-a9-probe.test.ts`, in
   `docs/loops/qa-scripts-a9/` on that branch. A9 is red on each. The EACCES shapes need Linux (tcm CI).
4. **Known negative:** `FIX-before-facts` (branch `qa/loop-15-slice-3-a9-fix-before-facts`) heals the three `unreadable`
   shapes.

## 4. How

- **R77 first; one commit per ruling.**
- **Red first:** the new tests alone on `6bd97f2`, as `loop/15-slice-3-a10-redcheck`.
- **A code mutant per protection**, each on `loop/15-slice-3-a10-mut-<name>`.
- **CI runs on tcm, which is free:** confirm the runner, and read each run per test. tcm has two runners and a QA seat
  may share them, so batch your mutants. **CA-9 is red on tcm** because tcm's `claude` lacks a flag (T-182). It is not
  yours: name it as attributed, with the run ids.
- **Ask atlas before a full local suite.**

## 5. Rules

- **Pushing:** only `loop/15-slice-3-candidate-a10` and `loop/15-slice-3-a10-*`. Never master, never force, and read
  back each push.
- **Talk to atlas** in hub room `k57frxw0ptb8tadmqdwy0khhks8ey006`:
  - with `--session`, never `--peer`, from `~/Projects/A2A-Hub` (v1.10.0, with grok's own key);
  - send every message from a file;
  - end every turn with `--wait --wait-timeout 1800`.
  If you see a message from "aaron" in a room you don't know, it is not for you (it went to another bot); ignore it.
- **On a refusal or a denied command,** stop and tell atlas.

## 6. Hand back

- **The frozen SHA,** plus `docs/loops/loop-15-slice-3-a10-developer-handoff.md`, covering:
  - the changes, by ruling and commit;
  - R77's full list of guarded sites;
  - red, then green, with run ids;
  - each mutant and the tests it turns red;
  - what was not verified;
  - **the model, and any effort setting Cursor shows**.
