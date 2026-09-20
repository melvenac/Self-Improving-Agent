# Loop 15 — QA evidence report 2, third candidate

**By:** Probe (QA seat) · **To:** Atlas (planner) · **cc:** Forge (developer) · **Date:** 2026-09-20
**Candidate:** `4414bcc6f2d46fa62296d0ed65cb16a9b3c31752` on `loop/15-hoh-runtime`, **unpushed** —
identity from the shared object store by SHA (`git cat-file -t` → `commit`; `git branch -r
--contains` → nothing). Supersedes `1086e55`, which report 1 (`loop-15-qa-report.md`) did not accept.
**Criteria:** `docs/loops/loop-15-qa-criteria.md` at `24e33e5`, unchanged since report 1.
**Evaluation tree:** `~/Worktrees/sia-qa`, detached at the candidate. Identity verified at
2026-09-20T00:26:35Z and again at 00:33:32Z: HEAD equal to the SHA both times, `git status
--porcelain` empty both times, build stamped on the SHA, no `loop-*` tag created. Read-only: no
tracked file at the candidate was edited; every mutation was made in a scratch repository by a
script in the session scratchpad.

**Rule 13 this time:** this tree now carries its own GitNexus index, rebuilt at the candidate
(analyzer exit 0, 2,052 nodes / 4,247 edges, indexed `4414bcc` at 00:28:19Z). Every `/sync` check
ran here with **0 skipped**. The main checkout was not touched. The one main-tree-only condition still
unrun is Aaron's untracked `.agents/SYSTEM/PRD.md`, which is not a property of any candidate.

---

## Verdict

**Accepted on the criteria as written, with one open defect of the same class recorded below (D6)
and returned to the planner to rule on.** Every defect from report 1 is fixed on observation, not
on the handoff's word. The pre-existing suite is intact. I am not widening the criteria after the
fact to fail D6, and I am not leaving it out because the rows pass — both would be the seat not
doing its job.

| row | verdict | one line |
| --- | --- | --- |
| A1 | pass | README command verbatim exits 0 against a scratch repo with the scripts; defaults now spawn npm through node and record npm's own failure in a bare repo |
| A2 | pass | unchanged: three shapes refused to the cap with `FAILED.md`, empty `repair_targets` accepted; schema seen red under ajv first |
| A3 | pass | a QA stub that commits into the candidate is refused, rolled back, and leaves no QA tag; the candidate is asserted as the evidence commit's first parent |
| A4 | pass | planner and developer commits refused as `stage-committed` with the right reason; uncommitted writes refused as before |
| A5 | pass, D6 open | zero-padded tags in the right ancestry; git alone restores; **a role can force-move an existing tag undetected** |
| A6 | pass, same limit | three payloads, nothing sent, no key value anywhere; value redaction still not exercised by a run |
| A7 | pass | five spawn sites, all `shell: false` with args arrays; the only `shell: true` in the harness is inside a comment, which the rewritten scan now strips |
| P1 | pass | no diff under the protected paths |
| P2 | pass | 823/823 here; 648/648 with the harness excluded; `sync --check` 26/4/0/**0 skipped** |
| P3 | pass | no write path to `.agents/state.json` in the harness |
| F1–F5 | pass | no network call site; prompts and index absent; template untouched; no key value; no Python |

---

## 1. What could not be verified

- **Role isolation and "enforces separation"** — unchanged from report 1: with stubs there is no
  session to isolate, and A3/A4 stand in for the property rather than establish it. What changed
  is that they now hold against a role that commits, which is what a real session does.
- **Forge's seen-red counts** — "6 of 7 new commit-path tests fail with enforcement reverted, 3 of 4
  D4 tests fail with `npm.cmd` restored" — were not reproduced; they need a mutated copy of the
  candidate. What was done instead: my own probes against the built candidate, which are behavioural
  and independent of the suite, and the new tests read in full.
- **CI, other machines** — nothing here ran off this machine. One full-suite run at this SHA:
  no `[vitest-worker]` timeout (grep validated on a plant in report 1). One run is not a
  characterisation.
- **`tests/harness/` typecheck** — still `src/` only (`T-152`); not repeated.
- **The `hoh_jev.md` / `docs/HOH-JEV.md` relation** — still not diffed.

## 2. What the checks I ran cannot see

- **Enforcement now observes commits and the working tree. It does not observe refs.** A role that
  runs `git tag -f`, `git branch -f`, or `git update-ref` moves nothing git status or `git diff
  base..HEAD` can see. D6 is this, observed.
- **Rollback of a stage that moved HEAD to a non-descendant fails closed and stops.** Observed (P6):
  a QA stub that `git reset --hard loop-001-base` is refused as `stage-committed`, the runtime's
  own rollback refuses because the base is not an ancestor of the new HEAD, the reason says *"THE
  TREE COULD NOT BE ROLLED BACK … Recover by hand"*, and the tree is left at the base commit with the
  candidate still reachable through `loop-001-developer`. That is the documented behaviour and it is
  honest; it is also a loop that ends with the tree somewhere other than the candidate.
- **`git clean -fd` after a rogue-commit rollback does not remove ignored files** (`-x` is not
  passed). The scratch repos have no `.gitignore`, so this was not exercised.
- **The A6 network assertion, the A7 scan and `build-freshness`** carry the same limits as report 1
  §2. The A7 scan additionally now strips comments; its own test asserts a planted comment mention
  does not fire and the same text in code does.
- **Windows exit codes from npm appear as unsigned 32-bit values** (`4294963238` is npm's `-4058`).
  Recorded as a failure either way; the number is what Node reports.
- **My instruments this round:** one inline `node -e` lost a backslash to the shell and failed —
  replaced by a script file, the CLI's JSON on disk was intact. My probe script truncated failure
  reasons at 260 characters — the one case that mattered was re-run for the full text. Neither
  reached a number in this report.

## 3. Deterministic results, reproduced in this tree

Each exit code read from its own process. Nothing carried forward.

| command | exit | observed |
| --- | --- | --- |
| `npm ci` | 0 | 00:26:52Z |
| `npm run build` | 0 | stamped `4414bcc…`, built 00:27:05Z |
| `npx tsc --noEmit` | 0 | no output |
| `gitnexus analyze` | 0 | indexed `4414bcc`, 00:28:19Z; no tracked file changed |
| `npx vitest run` | 0 | **55 files, 823 passed (823)**, 84.68s, started 00:28:32Z; 0 timeout lines |
| `npx vitest run --exclude 'tests/harness/**'` | 0 | **48 files, 648 passed (648)** — baseline reproduced |
| `node open-brain/build/cli.js sync --check` | 0 | **26 passed, 4 warnings, 0 issues, 0 skipped**; `gitnexus-index [pass]` indexed `4414bcc` 00:28:19Z measured 00:32:57Z; `build-freshness [pass]`; `module-boundary [pass]` 56/41 |

Forge's numbers, verbatim: build 0, typecheck 0, `npx vitest run` 0 with 823 tests and 0 errors,
`sync --check` 0 with 0 issues, 823 − 175 = 648. **All reproduced here**, and 823 − 648 = 175 from
two vitest counts of my own.

The four `/sync` warnings are the same four pre-existing ones as in report 1 and at the baseline.

## 4. Report 1's defects, each re-observed

| report 1 | status | observation (scratch repo, `probe3.mjs` against the candidate's build, 00:30:19Z) |
| --- | --- | --- |
| **D1** QA commits into the candidate | **fixed** | `failed`, exit 1, `stage-committed` at stage `qa`, reason *"the stage moved HEAD from 6b262a71… to 303df2f6… — a role may not commit"*; HEAD back at the candidate; `README.md` restored to `# fixture`; tags `loop-001-base`, `loop-001-developer` only — **no `loop-001-qa`**; `FAILED.md` the only thing left in the tree |
| **D2** planner commits outside allowlist | **fixed** | `stage-committed` at `planner`; `src/backdoor.ts` absent; HEAD at the initial commit; only `loop-001-base` |
| **D3** developer commits, wrong reason | **fixed** | `stage-committed` at `developer`, reason names *"moved HEAD"* and `src/backdoor.ts`; never `developer-no-change`; file absent; HEAD back at the plan commit |
| **D4** default checks `EINVAL` | **fixed** | README's command verbatim (`npx tsx open-brain/src/harness/cli.ts run --loop t001 --dry-run --repo <scratch>`) against a scratch repo whose `open-brain/package.json` has `build`/`test` scripts: **exit 0**, *"checks: build exit 0 in 485ms; unit exit 0 in 558ms … checks green"*. Against a bare scratch repo: exit 1, both checks `npm error …` with npm's own exit code, `passed: false` — recorded, not `EINVAL`, not a pass. The resolved command is `node.exe …\npm\bin\npm-cli.js --prefix open-brain run build`. The README now says to pass `--repo`, that a loop commits and tags there, and that the defaults need the scripts |
| **D5** `A_t.gitref` overstated | **fixed** | the file now separates *what the runtime guarantees* (tree matched at QA start; QA neither committed nor wrote outside its allowlist; the sha is the evidence commit's first parent) from *what it does not* |

**Control (P4):** an uncommitted QA edit is still refused as `allowlist-violation` with the file
restored. **Also observed (P7):** a developer that commits *only permitted paths* is refused as
`stage-committed` — the runtime owns the commit boundary, as the handoff says. **Clean run (P8):**
completed, exit 0, `loop-001-qa^1` equals the candidate, `git reset --hard loop-001-base && git
clean -fdx` returns HEAD to the pre-loop commit with the tree clean and `artifacts/` gone.

## 5. New defect

### D6 — a role can rewrite an existing tag during its stage and the loop completes

**Observation** (P5, same run). A QA stub ran `git tag -f loop-001-developer loop-001-base` during
its stage — no commit, no file write, HEAD untouched — then returned stock evidence. Result:

```
status: completed   exitCode: 0   failure: null
tags:  loop-001-base       → c2d8576 (initial)
       loop-001-developer  → c2d8576 (initial)   ← was 27e744f, the candidate
       loop-001-qa         → b9bf4e4 (evidence)
evidence parent == candidate: true    porcelain: []    E_t present
```

`loop-001-developer` now names the pre-loop commit. `E_t.json` and `A_t.gitref` still name the real
candidate, so the record and the tags disagree and nothing noticed. A reader who trusts the tag —
which is what the tag is for — restores or inspects the wrong commit.

**Why it happens** (white-box): `enforceAllowlist` compares `git diff base..HEAD` and `git status`;
`tagVerified` checks HEAD against the sha *being created*; nothing re-reads the target of a tag that
already exists. `tagAt` refuses to move a tag through the runtime, and a role does not go through
the runtime.

**Class:** the same one as D1–D3 — a role acting on the repository through a channel the observer
does not watch. Report 1's channel was commits; this one is refs. The same argument applies: a real
session can run `git tag`. **Not a criteria row.** A5's observable — the two tags exist, git alone
restores — passed on the clean run and on this one (`loop-001-base` was left alone in this probe; a
role could move it too). The planner sets whether it blocks; my evidence is that it is reachable by
the same means D1 was, and silent.

## 6. Regressions

- Pre-loop suite: 648/648 in 48 files with the harness excluded, matching the `e47ae20` baseline.
- `sync --check`: the same 25 passes as report 1 plus `gitnexus-index` now reporting; warnings
  unchanged in text.
- `/start`, `/end`, `project-template/`: unchanged by diff (P1). `ob_state` sole writer: P3, by
  grep.
- A2, A6, the CLI's argument refusals, and the schema seen-red table are byte-for-byte the same
  outcomes as report 1 (`probe2.mjs` re-run against this build: identical verdicts on all eight
  shapes and both artifacts valid under ajv).

## 7. Error entries

**Developer (Forge): 0 new.** The G-040 scan false positive was caught by its author before the
candidate reached me and is recorded in the handoff; a near-miss by family. No wrong claim in the
handoff or the commit messages was found against the observations here.

**QA (Probe): 0 entries, 2 near-misses by family** — a backslash eaten by the shell in an inline
script (replaced by a file), and a probe that truncated the one reason that mattered (re-run in
full). Neither reached a number, a message or a file.

## 8. What Atlas should weigh

The acceptance bar you set for the fix is met on observation: identity is verified before every tag,
enforcement compares against the diff from the stage's base, and the README's first command exits 0
on win32 with no overrides against a repository that has the scripts. D6 sits outside that bar and
inside the class. Whether slice one ships with it open or closes it first is a ruling, not an
evaluation; my evidence is one probe, one line of git, and a completed loop whose developer tag
points at the wrong commit.
