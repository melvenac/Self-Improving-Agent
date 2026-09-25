# Candidate A6, compact brief for a FRESH developer session

**By:** Atlas (planner), record session 90 · 2026-09-24. **To:** the developer seat, **record session 93**. That is
a fresh Grok 4.7 session in Cursor on `~/Worktrees/sia-forge`. The brief also works for a Claude seat. **Budget:**
256k context. Read this file, then only what §3 lists.

## 1. Where things stand, and what changes

- **A5 `4c1287f` (Grok, session 91) was REJECTED:** `docs/loops/loop-15-slice-3-qa-report-a5.md` on master.
- **A5 closed A4-1 and A4-3, and got R57, R59 and most of R58 right.** Keep that work.
- **It regressed on A5-1:** the hand-written route walk stops short of the real file for stow-style relative links
  (`../../dotfiles/...`) and for linked folders with two or more levels below them. The config is then **silently
  unwatched**.
- **Aaron's decision D-041 changes the approach.** Six candidates on this clause showed the hand-written tracing is
  the problem. **The OS follows the links. The runtime only asks: is this the same file as at base?**
- **A6 is a new commit series on `4c1287f`.** Create `loop/15-slice-3-candidate-a6` from it.
- **A6 carries exactly R60 to R63**, in `docs/loops/loop-15-slice-3-rulings-13.md` on master.

## 2. The work (`configwatch.ts` line numbers at `4c1287f`)

1. **R60: the object test, machine-config side only.**
   - **At base:** for each machine-config path, let the OS resolve it (for example `realpathSync.native` plus `stat`)
     and record the real file's identity: type, `dev`, `ino` (`{ bigint: true }`), `nlink`. Also record the resolved
     path.
   - **After a stage:** resolve again.
     - **Same file:** open it, `fstat` **the open handle**, confirm it is the same file, and only then read from
       **that handle**.
     - **Different file:** do not read. Report the path with its base and current resolution.
     - **Does not resolve:** do not read, and report it (item 2).
   - **A link planted at the watched path itself** is still reported as a type change, by `lstat` of the path as
     written (A4's lexical check).
   - **Stop using the route walk on the machine side:** `recordChain` (`:876`), `resolutionMismatch` (`:890`),
     `snap`'s chain (`:974`) and `baseNotes`'s chain (`:960`).
   - **Keep the repository side's chain** (`recordRepoChain` `:317`, `repositoryResolutionDiff` `:330`). **But fix
     `routeChain`'s cumulative `rest`** (`:257` onwards): it doubles the path for a link with two or more components
     after it. One test, one mutant.
   - **Must still hold:** A4-1's four shapes are not read, and an in-place edit of the base file through any link
     (stow, `$XDG_CONFIG_HOME` as a link, `~/.config` as a link, relative `..` targets) **is read and hashed**.
2. **R61: no silent paths.** At every stage, every watched path is in exactly one **reported** state: **read** (with
   its hash), **not read** (with the reason and identity), or **unwatched** (with the reason, e.g. it did not resolve
   at base). The base note must state the state that will actually be used. Today `baseNotes` says "read through that
   target" even for paths never read (A5-3).
3. **R62: "not read" is never "changed".** `changed()` (`:424`) returns true whenever either side is `unreadIdentity`.
   It must instead compare the identity facts both sides hold, and equal facts mean no change. A repository file that
   is new since the loop's base, and untouched by the stage, is **no change**. That is A5-4.
4. **R63: tests with their own plants and controls.** (b)1, (b)2, (b)4 and (b)6 each assert their plant and carry an
   in-test control. Add one test asserting "The offending paths were **reverted**." is **present** after a revert that
   ran.

**Not in A6:** D-A2-7, D-A5, and R37's remaining limit (a racing role can make the runtime OPEN a different file; the
handle check stops the READ).

## 3. Read ONLY this

1. `configwatch.ts` at `4c1287f`: the line ranges above and what they call.
2. Rulings-13 in full.
3. Report A5 on master: the **verdict section**, §3.6 (A5-4), §9 and §14.
4. **The known positives, all on origin:**
   - QA 92's Linux probe on `qa/loop-15-slice-3-a5-probe` (`dfbac1b`). Its STOW, XDGFILE, XDGDIR, ANCHOR-EDIT,
     VIADIR-EDIT and STOW-LOOP shapes are red at A5 and must be green at A6.
   - QA 89's A4-1 probe on `qa/loop-15-slice-3-a4-probe` (`9f58fbc`): H, J, R and LOOP must stay unread.
   - `docs/loops/qa-scripts-a5/probe-r57.mts` NEWBETWEEN, for A5-4.
5. The existing test files, only where your new tests go: `configwatch-links.test.ts` and `config-channel.test.ts`.

## 4. How

- **One commit per ruling** (R60, R61, R62, R63), plus separate handoff commits. The dispatch table will be built from
  each commit's diff, so keep the ruling in each commit's subject.
- **Red before green for every item, on YOUR tests:**
  - put the new tests alone on `4c1287f` as `loop/15-slice-3-a6-redcheck`;
  - dispatch CI there (D-040);
  - report each failing test by name.
- **Name a CODE mutant for each protection and show it red** on its own `loop/15-slice-3-a6-mut-<name>` branch on CI.
- **Read every CI run per test before you report it.** A dispatched run is not a result.
- Keep `docs/loops/loop-15-slice-3-a6-developer-handoff.md` current.
- **Ask atlas before a full local suite** (G-042).
- At about 70% context, stop at a clean commit and push.

## 5. Rules (D-038, D-040)

- **Pushing:**
  - push only `loop/15-slice-3-candidate-a6` and your own `loop/15-slice-3-a6-*` branches;
  - never `master`, and never force;
  - read back each push with `git ls-remote`.
- **CI:** dispatch or re-run CI on your own branches without asking (D-040). Name every run id.
- **Talking to atlas:** only in A2A-Hub room `k57frxw0ptb8tadmqdwy0khhks8ey006`, always with `--session`, and never
  with `--peer`. **End every turn with `--wait --wait-timeout 1800`.**
- **When something stops you:** on a refusal or a denied command, stop and tell atlas.
- **The record:** `.agents/state.json` belongs to the planner.

## 6. Hand back

- **The frozen SHA,** pushed. Do not push to the candidate branch after reporting it.
- **The handoff file**, covering:
  - the changes, by ruling and commit;
  - red then green for each item, with CI run ids and per-test results;
  - each mutant, with its branch, run id and the test it turns red;
  - what was not verified, and why;
  - the model, as Cursor shows it.
- **Any findings that fail no row.**
