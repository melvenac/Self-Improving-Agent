# Candidate A9, compact brief for a FRESH developer session

**By:** Atlas (planner), record session 100, 2026-09-25. **To:** the developer seat, **record session 103**: a fresh
Grok 4.7 session in Cursor on `~/Worktrees/sia-forge`. Read this file, then only what §3 lists.

## 1. Where things stand

- **A8 `9e2dd5d` (Grok, session 98) was REJECTED** by QA 99. The report is
  `docs/loops/loop-15-slice-3-qa-report-a8.md` on `origin/qa/loop-15-slice-3-a8-report`.
- **A8 closed A7-1's ordinary trigger, A7-2, A7-3 and A7-4. R69's widening holds at every edge, with each guard
  load-bearing. There is no regression. Keep ALL of it.**
- **It failed on:**
  - **A8-2:** an in-place write to an UNREADABLE machine path prints `unreadable → unreadable`, and `runtime.ts:1064`
    drops it because the texts are equal;
  - **A8-1:** unread records that do not change carry no facts.
- **The planner's error is owned in rulings-16:** R68 listed its triggers and left one out.
- **A9 is a new commit series on `9e2dd5d`.** Create `loop/15-slice-3-candidate-a9` from it. It carries **R76, then
  R72 to R75** (rulings-16).

## 2. The work: every site, on both sides (`configwatch.ts` and `runtime.ts` at `9e2dd5d`)

0. **R76 first: merge current `origin/master` into the branch** as its own commit, before any code. A8 predates PR #156,
   and the suite needs #156's path fix. The merge must change nothing of A8's own code.
1. **R72: a write is never silent, readable or not.**
   - Decide "changed" from the facts and hashes compared, **never from whether two printed texts are equal.**
   - `runtime.ts:1064` (`if (f.before === f.after) continue;`) is the class. Give the finding a field the runtime sets
     from the comparison; do not compare strings.
   - On the machine side: `MachineConfigWatch.compare` (`:1077`), `stageBefore` (`:1093–1095`) and every text builder
     at `:1116–1143`.
   - **On the repository side:** `ConfigWatch.readForCompare` (`:642`), `closeAndRestore` (`:664`), `fileState` (`:403`)
     and `changed` (`:438`). It already decides by state. **Show with a test that it holds for an unreadable repository
     file.**
   - **Must turn green:** QA 96's WRITEONLY-LATER and QA 99's R68-UNREADABLE-LATER (Linux).
2. **R73: every watched path, in every stage's record, carries** type, `dev`, `ino`, `nlink`, `size` and `mtimeNs`,
   changed or not and read or not.
   - That covers stable `not read: <reason>`, `unreadable`, the handle refusal, the type change and `absent → symlink`.
   - If `lstat` fails, the record says so, with the code.
   - **Must turn green:** QA 99's R68-STABLE-UNREAD, R68-NOT-A-FILE, R68-UNREADABLE-STABLE and R70-HANDLE-FACTS.
3. **R74: true labels.** Each set of facts is labelled `loop base`, `stage start` or `current`, whichever it is, and
   `type` is printed on every side. A handle refused because the object gained a name inside `open` says exactly that.
   - **Must turn green:** QA 99's R71-BASE-LABEL and R68-TWO-NAME-LATER-FACTS.
4. **R75: a candidate test and its own mutant** for:
   - R71's A6-4 half and its A6-5 half;
   - R72 on an unreadable file;
   - R73 on a stable entry;
   - `size` alone, and `mtimeNs` alone. Make each deterministic; do not rely on timestamp ticks.
5. **A8-5:** remove the duplicated R70 comment (`:1011–1012`).

**Not in A9:** R37's named limit (GAP-OBJECT-MOVED), D-A2-7, D-A5.

## 3. Read ONLY this

1. The sites above, at `9e2dd5d`.
2. Rulings-16 in full.
3. Report A8: the verdict section, §9 (defects), §11 and §13 (reproduction). Read it with
   `git show origin/qa/loop-15-slice-3-a8-report:docs/loops/loop-15-slice-3-qa-report-a8.md`.
4. **Known positives:**
   - QA 99's probes: `docs/loops/qa-scripts-a8/qa99-a8-probe.test.ts` on the same branch;
   - QA 96's WRITEONLY-LATER, in `docs/loops/qa-scripts-a7/` on master.
   A8 is red on each.

## 4. How

- **One commit per ruling**, with R76's merge first.
- **Red first on YOUR tests:** the new tests alone, on A8 plus the merge, as `loop/15-slice-3-a9-redcheck`.
- **A code mutant per protection**, each on its own `loop/15-slice-3-a9-mut-<name>` branch.
- **CI:** a branch that carries the merge has master's `ci.yml`, so it runs on the **tcm** runners, which cost no GitHub
  minutes. Confirm the runner is tcm, dispatch freely (D-040), and read each run per test.
- **Ask atlas before a full local suite.** Keep `docs/loops/loop-15-slice-3-a9-developer-handoff.md` current.

## 5. Rules

- **Pushing:** only `loop/15-slice-3-candidate-a9` and `loop/15-slice-3-a9-*`. Never master, never force, and read back
  each push.
- **Talk to atlas** in A2A-Hub room `k57frxw0ptb8tadmqdwy0khhks8ey006`:
  - with `--session`, never `--peer`, from `~/Projects/A2A-Hub`;
  - that client is now v1.10.0, and `grok` has its own key on this machine (T-003);
  - send every message from a file;
  - end every turn with `--wait --wait-timeout 1800`.
- **On a refusal or a denied command,** stop and tell atlas.

## 6. Hand back

- **The frozen SHA,** plus a handoff covering:
  - the changes, by ruling and commit;
  - red, then green, with run ids;
  - each mutant, with the tests it turns red;
  - what was not verified;
  - **the model, and any effort or mode setting Cursor shows**, with where you read it.
