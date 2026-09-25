# Importer fixes, round 2: brief for a FRESH developer session (record session 105)

**By:** Atlas (planner), record session 100 · 2026-09-25. **To:** the Claude developer seat (Forge), **record session
105**, a fresh session in **`~/Worktrees/sia-infra`**, not `sia-forge`.
**Authority:** Aaron, this session: *"go ahead, write the round 2 brief"*, after the planner ruled that `f6b6d44` should
not merge as it stands. D-035 gives a fresh session for a new candidate.
**Why:** QA 102 passed all eight rows of round 1 (`f6b6d44`), but found a way past T-180's block (D2), an unguarded
refusal (D1), and two older defects that can damage a project during adoption (D3, D4). All four sit in the same code.
Adoption (T-181, D-048) waits on this.

## 1. Start

1. `/start`. Your record number is **105**; the greeting's number is local (T-164).
2. The tree is on `loop/importer-fixes-ci` or detached; check with `git status`. Branch from round 1's tip:
   `git fetch origin && git switch -c loop/importer-fixes-r2 origin/loop/importer-fixes`. That is `65e3a89`: candidate
   `f6b6d44` plus its handoff.
3. `npm ci && npm run build` in `open-brain`.
4. **Read:**
   - this brief;
   - QA 102's report, IN FULL (301 lines). It is on `origin/qa/importer-fixes-report`:
     `git show origin/qa/importer-fixes-report:docs/loops/importer-fixes-qa-report.md`. The probes and evidence are
     beside it in `docs/loops/qa-scripts-importer/`;
   - the round-1 handoff at `65e3a89`;
   - round 1's brief, `docs/loops/importer-fixes-brief.md` (on `origin/docs/session-100-qa99-dispatch`), for rows
     IF-1 to IF-8. **They must all still hold.**

## 2. The work, by what each fix protects (sites at `f6b6d44`)

**R2-1 (QA's D2): an encoding detail never turns a STALE input into "could not tell".**
- A leading UTF-8 BOM (U+FEFF) hides the `# ` title line from `declaredSession`
  (`state-import/index.ts:384–387`, the `findIndex(l => l.startsWith("# "))` at `:387`). The input is then filed as
  "could not tell", with the false reason at `:434`, and `--commit` proceeds without `--accept-stale`.
- **Name the class and close it at the read:** every input text the importer judges passes through one normalisation.
  At least strip a leading U+FEFF. Say whether CRLF needs anything (QA found CRLF judged correctly), and anything
  else you find in the same class.
- The same `findIndex` shape is at `:530` and `:284`. Check whether they share the defect.
- **Known positive:** QA 102's PROBE-8 (BOM on each input, `Session 6` against log 7).

**R2-2 (QA's disagreement 2): an input that declares a session AHEAD of the latest log is not "current".**
- At `:438`, `d.n < latest.n ? "stale" : "current"` files `d.n > latest.n` as current. That is the renumbering case the
  round-1 handoff names as a limit.
- Make it "could not tell", with a true reason (it declares Session N, the latest log is M < N).
- **Known positive:** QA 102's PROBE-1 (declares 20, latest log 7).

**R2-3 (QA's D3): an import never leaves a project half-migrated. It completes, or it changes nothing.**
- With no `SESSIONS/` directory, `runCommit` (`:691`) writes `state.json` and the snapshot and rewrites INBOX.md and
  task.md. Then rendering `next-session.md` fails with ENOENT (`:725`), and every later `--draft`/`--commit` refuses
  because `state.json already exists`.
- The protection is the invariant, not the directory. Check **every** step after the snapshot that can fail. The
  missing directory is only the instance QA found.
- Your design choice: create the directory, or refuse before the snapshot, or anything else. Justify it in the handoff.
- **Known positive:** QA 102's PROBE-2. Master `9bc06e3` reproduces it, so it predates round 1.

**R2-4 (QA's D4): `state import` acts on exactly the project the operator named, and any token it does not recognise
refuses.**
- `cli.ts:428` refuses only unknown `--` tokens. `cli.ts:442` takes the first non-`--` token as the directory. So
  `-accept-stale` or `accept-stale` is silently taken as the directory. Placed before the real directory, it resolves
  against the cwd and walks up, and **the cwd's project is committed instead of the named one** (QA's PROBE-12).
- Refuse:
  - any `-`-prefixed token that is not known;
  - more than one positional token;
  - a positional token that does not name an existing directory.
  Nothing is written in any of these cases.
- Other `open-brain` subcommands share the `args.find((a) => !a.startsWith("--"))` shape (`cli.ts:54`, `:166`, `:285`,
  `:369`). **List them in the handoff with whether each is exposed.** Fix only `state import` here; the rest become a
  task.

**R2-5 (QA's D1): every protection has a test that fails without it.**
- T-150's unrecognised-flag refusal (`cli.ts:428–430`) has no guarding test. The typo assertion at
  `state-import-staleness.test.ts:105`, `toContain("--accept-stal")`, is also satisfied by the stale refusal's
  `--accept-stale`. Assert the refusal's own words. Add the typo case on a **current** project, where only the flag
  check can refuse.
- QA 102's surviving mutants **M13** (`--accept-stale` with `--draft`), **M14** (the `Imported STALE under …` line),
  **M15** (the `--draft` staleness summary) and **M16** (the detector reads headings) each need a test they turn red.

**Not in round 2:**
- an input changed between `--draft` and `--commit` (QA's Open 4; a task);
- `Session_13.md` in the fixture (accepted as it is);
- the `ci-status` "gh auth login" misreading (a task).

## 3. Acceptance, written before any candidate exists

| Row | Must hold |
|---|---|
| IF-1 … IF-8 | round 1's rows, all still passing |
| IF-9 | PROBE-8's BOM inputs: the stale ones are **STALE**, with true evidence, and `--commit` refuses without `--accept-stale`. The same inputs without a BOM give the same verdicts. |
| IF-10 | PROBE-1's ahead-of-log input is **could not tell**, with a reason naming both numbers. Round 1's current and stale cases are unchanged. |
| IF-11 | PROBE-2 (no `SESSIONS/`): after `--commit`, the project is either fully migrated or byte-identical to before, and a second run behaves as for a fresh project. **Show one other induced failure after the snapshot** behaving the same way. |
| IF-12 | PROBE-12 and PROBE-5b: each unrecognised or misplaced token refuses, and nothing is written. The named project, and only it, is ever the target. |
| IF-13 | M6 and M13 to M16 each turn a test red, and so does each new protection's own mutant. `tsc --noEmit` is clean on each. |
| IF-14 | Red first: the new tests alone on `65e3a89`, on `loop/importer-fixes-r2-redcheck`. |
| IF-15 | `/sync` shows no new issue; CI is green on tcm; the full local suite runs once when the peers are idle. |

## 4. How

- One commit per R2 item. CHANGELOG under the same unreleased patch version round 1 used. **No version bump or tag**
  (D-019).
- **CI:** your branches run on tcm, which is free. tcm has **two** runners, shared with other seats and a QA seat's
  probes, so batch where you can. Confirm the runner on each run.
- **Ask atlas before a full local suite** (G-042). Talk to atlas by native A2A (`sia-planner-ac` in `ListAgents`).
- **Pushing:** only `loop/importer-fixes-r2*`. Never master, never force, and read back each push. You do not write
  `.agents/state.json`.
- **On a refusal or a denied command:** stop and tell atlas.

## 5. Hand back

- The frozen SHA and `docs/loops/importer-fixes-r2-developer-handoff.md`, covering:
  - changes by R2 item and commit;
  - red, then green, with run ids;
  - each mutant and the tests it turns red;
  - R2-3's design choice and the other failure you induced;
  - R2-4's list of exposed subcommands;
  - what was not verified;
  - **model and effort, from your transcript.**
