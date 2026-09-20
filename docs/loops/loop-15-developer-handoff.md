# Loop 15 — developer handoff to QA

**From:** Forge (developer seat) · **To:** Probe (QA seat) · **cc:** Atlas (planner seat)
**Date:** 2026-09-19
**Branch:** `loop/15-hoh-runtime`. **Not pushed** — a push needs Aaron's word for that push.
**Base:** `master` @ `d45c965` (state rev 39), rebased onto it after Atlas relayed PR #52's merge.

---

## The claim this seat is making, and the one it is not

**Not making:** that slice one works. *"It works" is not available to the agent that built it.*

**Making:** here is a frozen candidate, here is what was run against it, here is what each number
was derived from, and here is what I could not establish. Everything below is from **this worktree**
(`~/Worktrees/sia-forge`) unless it says otherwise. **The other three checkouts have not run any of
it** — `git worktree list` shows four sharing one `.git`, and rule 13 says a check is only as tested
as the trees it has run in. `build-freshness` shipped green in one tree and was wrong in two.

---

## Candidate

| | |
| --- | --- |
| **Frozen SHA** | `4414bcc6f2d46fa62296d0ed65cb16a9b3c31752` (third candidate; supersedes `1086e55`, which QA did not accept) |
| **Branch** | `loop/15-hoh-runtime` |
| **Reachable** | from the shared `.git` by SHA — no push needed, all four checkouts share one object store |

**Commits after the candidate are this document and the session-close state write**, which touch
`docs/loops/` and `.agents/` only. No source file changes after `1086e55`.

**Check the SHA off `git log` yourself rather than taking it from this line.** If it disagrees with
`4414bcc`, the disagreement is the finding, not a typo to smooth over — a derived number carries the
ref and time it came from, and this one was derived by the seat that wants it to be right.

**Every number in the next section was re-measured at `4414bcc`** after the QA fixes — not carried
forward from either superseded candidate.

---

## Deterministic results

Each command was run **separately** and its exit code read from the process itself. That is not
pedantry: an earlier reading in this session took the exit code of `tail` through a pipe and reported
`0` for a suite that was exiting `1`. See *My error entry*.

| Check | Command | Exit | Observed |
| --- | --- | --- | --- |
| Build | `npm run build` (in `open-brain/`) | **0** | build stamped `4414bcc` |
| Typecheck | `npx tsc --noEmit` | **0** | no output |
| Suite | `npx vitest run` | **0** | 55 files, **823 tests**, **0 errors** |
| `/sync` | `node open-brain/build/cli.js sync --check` | **0** | 25 passed, 0 issues, 4 warnings, 1 skip |

Three `/sync` lines worth reading rather than summarising:

- `build-freshness [pass]: build matches HEAD 4414bcc` — so the build these results came from is the
  candidate's, not an older one. See *Finding 4* for why that is weaker evidence than it looks.
- `module-boundary [pass]: core does not import memory (56 file(s), 41 core)` — the harness is inside
  the 41 core files and reaches no memory code.
- `state-schema [pass]: … rev 41` — the rebase onto `d45c965` landed (it arrived as rev 39) and
  this session's own close-out has since been written. Not a stale record.

**Typecheck covers `src/` only.** `T-152` records that the suite itself is not type-checked. I
type-checked `tests/harness/` separately with a throwaway config extending `tsconfig.json`: **exit 0**.
That config was deleted rather than committed, so **nothing in CI re-checks it** — a fact about the
repo, not a claim about my tests.

**Suite arithmetic, so you can check it rather than accept it:** 823 total − 175 new = **648**, which
is the number the brief's §3 names as the figure to preserve. Measured directly too:
`npx vitest run --exclude 'tests/harness/**'` gives **648 passed in 48 files**. **No pre-existing
file was modified** — `git diff --stat d45c965..HEAD` touches only new paths plus `package.json`,
`CHANGELOG.md`, `README.md` and the four rendered state views.

**The four `/sync` warnings are all pre-existing** and none is mine: `PRD.md not found`,
`specs/ directory not found`, one unindexed vault note, one stale project directory. The skip is
`gitnexus-index`, which skips in every worktree but one — **a skip there is not a pass**.

**`module-boundary` passes at 56 files, 41 core**, and the harness is inside the 41. That is
deliberate: see *Decision 1*.

---

## What changed since the candidate you rejected

**All four defects fixed, plus D5. Your acceptance bar for A3/A4 is what I built to, not a
reinterpretation of it.**

**The class (D1, D2, D3).** `enforceAllowlist` now takes the stage's base commit and compares
against the **union of `git diff base..HEAD` and the working tree**, so a role that commits is seen.
Any stage that moves HEAD at all is refused as `stage-committed` and rolled back to its base —
including one whose committed paths were all permitted, because the runtime owns the commit
boundary and which commit is the candidate depends on it. Identity is verified **before every tag**
via a helper that refuses when HEAD is not the sha being tagged. And the invariant your D1 broke is
asserted directly rather than inferred: **the candidate must be the evidence commit's first
parent**, checked after the evidence commit.

**D3's reason is now the right one.** A committing developer fails `stage-committed` with *"the
stage moved HEAD…"*, never `developer-no-change`. There is a test asserting it is not the old code.

**D4.** `resolveNpm()` locates npm's JavaScript entry point and runs it through `node` — **no
shell**, so A7's property is unchanged. There is no `npm.cmd` fallback on win32; if npm cannot be
located the check is a recorded failure naming the problem, never a silent pass. **Verified by hand:
the documented command with no overrides now exits 0** against a scratch repo with `open-brain/`
scripts. The README is corrected too — it now passes `--repo` and warns that a loop commits and tags
in the repository it runs against, which the old first example did not say.

**D5.** `A_t.gitref` now states what is guaranteed (tree matched at QA start, QA neither committed
nor wrote outside its allowlist, candidate is the evidence commit's parent) and what is not.

**Seen red against the shipped behaviour, not merely written:** reverting enforcement to
working-tree-only fails **6 of the 7** new commit-path tests; restoring `npm.cmd` fails **3 of 4**
D4 tests with the exact `EINVAL` you reported. The seventh is an invariant assertion that holds on a
clean run either way, which is why it does not move.

**One of my own scans was wrong and you did not catch it because it was green.** The "no shell spawn
in harness source" scan reported `checks.ts` as an offender the moment I added a doc comment saying
*"the fix is not `shell: true`"* — the sentence explaining the prohibition, matched as an instance of
it. Same shape as the `git push` scan hitting its own deny list. It now strips comments, with both
halves asserted: a planted mention in a comment must not fire and the same text in code must.

---

## One run by hand, outside vitest

A test suite can pass because the suite and the code agree with each other. This is the same runtime
driven from a shell against a scratch repository it had never seen, with the checks pointed at real
processes:

```
node node_modules/tsx/dist/cli.mjs src/harness/cli.ts run --loop t001 \
  --repo <scratch> --build-cmd "node -e process.exit(0)" --unit-cmd "node -e process.exit(0)"
```

Exit **0**. It printed its own scale at every stage — *"examined 1 changed path(s) against 1 rule(s)"*
— and its own limits beside each verdict. It produced `A_t.gitref`, `D_t.json`, `D_t.md`, `E_t.json`
and the developer stub's file, and the three tags.

**Rollback checked with git alone, no harness involved:** `git reset --hard loop-001-base && git
clean -fdx` returned HEAD to the pre-loop commit, removed `artifacts/` entirely, and left
`git status --porcelain` empty.

**Something you should notice in that transcript, because it is a hole the tests paper over.** The QA
stage reported *"examined 0 changed path(s)"*. In a normal run **QA writes nothing during its own
stage** — the runtime writes `E_t` after validating it. So the QA allowlist is not exercised by a
passing run at all; it is only exercised when a QA role misbehaves, which happens in
`runtime.test.ts` and nowhere else. Weigh that test accordingly, since it is the only thing standing
between a QA seat and the candidate.

---

## Where the acceptance criteria are implemented and tested

The brief's §4, with the file that implements each and the test that would fail if it stopped
holding. **Every one was seen red on a real condition before being trusted** — the specific mutation
or planted defect is named.

| id | Implementation | Test | Seen red on |
| --- | --- | --- | --- |
| **A1** | `runtime.ts` | `runtime.test.ts` "A1 — end to end", `cli.test.ts` "A1 — a full loop" | planted assertion `exitCode === 4242`, reported correctly in the full run |
| **A2** | `runtime.ts` retry loop, `artifacts.ts` `renderFailure` | `runtime.test.ts` "A2 — schema retry and the cap" | a planner stub invalid on every attempt; `FAILED.md` asserted for content, not existence |
| **A3** | `workspace.ts` `verifyFrozen` | `runtime.test.ts` "A3", `workspace.test.ts` "verifyFrozen" | `verifyFrozen`'s two conditions mutated to `if (false)` → **2 tests fail** |
| **A4** | `workspace.ts` `enforceAllowlist` + `roles.ts` `makeWriter` | `runtime.test.ts` "A4", `workspace.test.ts` | `ok` mutated to `true` → **4 tests fail** |
| **A5** | `git.ts` `tagAt`, `runtime.ts` | `runtime.test.ts` "A5 — versioning and rollback" | rollback asserted by running `git reset --hard loop-001-base` with no harness involved |
| **A6** | `gate.ts` `DryRunTransport` | `gate.test.ts` "dry run — A6", `cli.test.ts` "A6" | a transport that throws on dispatch, plus `globalThis.fetch` replaced with a thrower |
| **A7** | `checks.ts` `runCheck` | `checks.test.ts` | a command that prints "All 648 tests passed!" and **exits 1** |

---

## The two questions you said you would ask

### A4 — is refusal prevention or detection? **Both, and the one that matters is detection.**

- **Prevention:** `RoleContext.write` (`roles.ts` `makeWriter`) normalises the path and refuses
  before touching disk.
- **Detection:** after every stage, `enforceAllowlist` compares `git status --porcelain=v1 -z
  --untracked-files=all` against the rules, and `revertPaths` undoes anything outside them.

**Prevention is the convenience; detection is the mechanism.** A role that goes through the helper is
stopped by a helper it chose to use. In slice two the roles are separate processes writing straight
to disk, and the helper protects nothing. So the test that carries the weight is
`runtime.test.ts` → "refuses a developer write outside the allowlist, bypassing the helper", where
the stub calls `node:fs` directly and is still refused, reverted, and denied a candidate commit.

**Limits you should record rather than take my word on:** detection sees **paths git reports**. It
does not see a write made and reverted inside the same stage, and it does not see a gitignored path.
`git status` was chosen with `-z` so a path with a space cannot be mis-split and
`--untracked-files=all` so a file inside a new directory is reported as the file, not the directory —
a directory-only listing would let `secret/thing.ts` be reported as `secret/`, which a prefix rule
might permit. Both are asserted in `git.test.ts`.

### A7 — any `shell: true` or template-string command?

**None.** `checks.ts` and `git.ts` both spawn with `execFileSync`/`spawnSync`, args array,
`shell: false`. This is asserted mechanically rather than claimed: `checks.test.ts` → "finds no shell
spawn in any harness source file" walks the harness sources, asserts the walked count, and **was seen
red on a planted `{ shell: true }` file**. Its patterns are validated against known positives in the
test above it, because a scan that cannot find a planted hit proves nothing.

There is a companion scan in `git.test.ts` for network git subcommands, **also seen red on a planted
`git(root, ["push", …])`**. That scan's first version reported `git.ts` itself, correctly matching
the text and answering the wrong question — it had found the deny-list constant, where `"push"`
appears precisely because it is forbidden. The exclusion is narrow and named, so renaming the
constant re-fires the scan.

---

## Findings you should weigh, not take as settled

### Finding 1 — I shipped a suite that exited 1 while reporting 805 passed, and I nearly handed it to you

The harness tests spawn several hundred synchronous child processes. `rmSync` over a `.git`
directory on Windows blocks long enough that the vitest worker could not answer its reporter
heartbeat, producing `[vitest-worker]: Timeout calling "onTaskUpdate"` as an **unhandled error**.
Vitest annotates that "might cause false positive tests" **and exits non-zero** — so `npm test`
failed while every line of output said 805 passed.

**Observed in every full-suite run in which I looked for it before the fix — 7 of 7.** (The fix
commit's message says "5/5"; that was written from a narrower count and 7 is the number to use.)
**After the fix: 4 full-suite runs at `1c8e6ca`, all exit 0, all with 0 occurrences of the timeout.**
One of those four ran concurrently with a `tsc` build, a `/sync` and a by-hand harness run on the
same machine, so it was the most loaded of the set and still clean. **That is four runs on one
machine, not a characterisation** — the condition is load-dependent and I cannot speak for CI.

The fix spans two commits, and only the second one actually fixed it — worth separating, because the
first looked like it should have been enough and was not:

- `7dc0e67` replaced four `git config` spawns per fixture repository with one file write. It cut
  ~200 child processes and ~13s of test time. **The warning persisted.**
- `1c8e6ca` made fixture cleanup an awaited async `rm` instead of `rmSync`, and removed one duplicate
  tree scan per loop in `runtime.ts`. **That cleared it.** The blocking that mattered was deleting
  `.git` directories, not spawning processes — which is not where I first looked.

**What I measured before fixing, and it is the part worth keeping:** a planted failing assertion
**was** reported in the full run, twice, so the warning was not suppressing failures here. That is a
bound on the blast radius, not an all-clear.

**Two things I did not establish.** Whether the same condition appears on CI or on another machine —
it is load-dependent and I only have this one. And on one planted-failure run, **two** test files
failed when I had planted **one**; the second was not identified, and `G-016` records a known
intermittent cross-test failure in `state-writer.test.ts` under the full suite. A later run of the
same plant failed exactly one. **I am reporting that as unresolved rather than attributing it to
`G-016`, because I did not capture the name.**

### Finding 2 — ~~a rule I enforce that the brief does not spell out~~ — RAISED, OVERTURNED, FIXED

**Resolved before this document reached you. Kept rather than deleted, because the correction is
more useful than the original finding.**

I enforced a second schema rejection the brief does not name: `D_t` refused an empty
`repair_targets`, reading `HOH-JEV.md` §"Rules the runtime enforces" as symmetric. I flagged it to
Atlas as my reading rather than a ruling. **Atlas overturned it, and the reason is a defect I had
not seen, not a difference of taste.**

`new_capability` is checkable from `D_t` alone. *"Repairs outstanding problems"* is only checkable
against `E_{t-1}`, **which the schema never sees** — it cannot know whether there was anything to
repair. So the symmetric rule refuses the two cases where there legitimately is nothing: **the first
loop of any project, which has no `E_{t-1}` at all, and any loop following a clean `E_t`.** My rule
would have deadlocked the runtime **on start and again on success.** The paper's own plan gate lists
`capability_increment` as a valid category, and for a gate to judge it the schema has to let it
through. The rule belongs to slice two's `addresses_top_failures` gate question, which can see the
prior evidence.

**Fixed at the new candidate.** `repair_targets` is still required as an array and may now be empty;
the refusal, its description note and the test asserting it are gone. The replacement tests assert
the two cases the old rule deadlocked, plus that an *omitted* `repair_targets` is still refused —
"allowed to be empty" is not "optional", and "nobody considered it" must not render the same as
"nothing to repair".

**What this cost and what it is worth:** a schema rule that looked like a faithful reading of a
written rule would have made the runtime unusable on its own first iteration, and **I did not find
it — the seat that did not write it did.** That is the loop's own thesis landing on the loop.

### Finding 3 — the tag instruction contradicts itself across the two source documents

`HOH-JEV.md` §6.2 says the runtime "never merges, pushes to master, or **tags**". The brief §2 and
A5 require `loop-<t>-<role>` tags. I built the tags, because A5 is acceptance and the §6.2 sentence
reads as being about master. **The runtime creates only local tags in the `loop-NNN-*` namespace and
cannot push them** — ten network subcommands are refused at the call site. Flagging it because I
resolved a contradiction in the sources by judgement, and that is Atlas's to confirm.

### Finding 4 — the freshness of the `/sync` result depends on a build I made

`build-freshness` passes by comparing the build stamp to HEAD. The check is not mine — it shipped in
`v0.40.0` on master — but **the binary that ran it is one I built from this candidate**, so the
result is a green produced by the thing under evaluation.

`G-033` already records the shape: a check served by a stale server cannot report that server's own
staleness. I ran `/sync` from the **CLI** rather than through the MCP server for exactly that reason,
which removes the stale-server case and not this one. **If you want a `/sync` result that does not
depend on my build, build it yourself in your own checkout** — and note that `gitnexus-index` will
skip there too, which is not a pass.

---

## Decisions I made that the brief left open

**Decision 1 — `harness/` lives at `open-brain/src/harness/`, not the repo root.** The brief writes
`harness/`. The same reasoning that ruled TypeScript over Python applies to a second root-level
project: one build, one test command, one CI lane. The deciding factor was that **`module-boundary`
only reads `open-brain/src`** — at the repo root, the runtime whose entire job is enforcing a
boundary would have sat outside the only check that asserts the dependency direction. Inside, it is
checked as core and passes, which means the harness reaches no memory code and a future import would
fail `/sync`.

**Decision 2 — zod is the schema source; the `.json` files are derived.** A hand-maintained JSON
Schema beside a runtime validator is two statements of one shape, which is the defect family most of
this repo's record is made of. `schema.test.ts` regenerates and compares byte for byte, **seen red on
a hand-edited `minLength`**. Regenerate with `npx tsx src/harness/cli.ts schemas --write`; it refuses
to write into a build directory. The two rules JSON Schema cannot express are written into the
generated files' own `description`, so a reader validating against the file alone is told what it
cannot see.

**Decision 3 — the plan artifact is `D_t.json` with `D_t.md` as a rendered view.** Under Amendment 1
this is my call. It is the `state.json` pattern this repo already uses. `cli.test.ts` asserts the
JSON validates.

**Decision 4 — a red build does not stop the loop.** It is the evidence. The loop completes, writes
`E_t` recording the failure, and the CLI exits non-zero. Suppressing a QA report about a broken
candidate would be widening the criteria until something passes.

---

## What slice one does not do, stated so it is not discovered as a gap

- **It fixes boundary failures and nothing about measurement failures.** Eleven near-misses in two
  days were agents misreading their own instruments. *Finding 1 above is a twelfth, in this session,
  committed by the seat writing this sentence.* **A runtime cannot stop a seat running a grep that
  hides the line it needed.**
- **The roles are stubs.** No model call, no API key read, no gate decision taken. `UnconfiguredTransport`
  throws rather than returning a permissive answer, so a live gate with no client **fails closed**.
- **Cut from slice one, deliberately:** role prompts and `artifacts/index.md`.
- **Untouched:** `.claude/commands/`, `start.md`, the hook contract, `project-template/`, and
  `ob_state` remains the only writer of `.agents/state.json`.

---

## My error entry, set before being asked — and then corrected downward

**I first wrote this section claiming one entry that escaped. That was wrong, and correcting it
downward is as much the job as setting it.**

I read `VITEST_EXIT=0` off a suite that was exiting `1`, because I ran
`npx vitest run 2>&1 | tail -8; echo "VITEST_EXIT=$?"` and captured **`tail`'s** status through the
pipe. It is the **exact** defect written in my own role file — *"`head`'s exit code captured instead
of `node`'s gave a green `0` from a server that had crashed, inside the test for whether the thing
installs"* — made while building a component whose acceptance criterion A7 is *"deterministic check
results come from exit codes"*. **Knowing the failure mode prevented nothing.** What caught it was
re-running with a redirect instead of a pipe: a different instrument, which is the only thing that
has ever worked.

**But by the dividing line in `shared.md` — *an entry is a wrong claim that reached an artifact, a
commit, a counterpart, or Aaron; the dividing line is escape, not severity* — this is a NEAR-MISS.**
I traced where the false green went and it went nowhere: no message to Atlas or Probe carried it, the
feature commit's message claims test counts (true) rather than an exit code, and this document's
results table was written **after** the correct `SUITE_EXIT=1` reading, so it never contained the
wrong number. It came close — the next thing I was going to do was hand over a suite I believed was
green — but proximity is not escape.

**The commit message of `1c8e6ca` says "I reported that suite as green," which overstates it** in the
same way my first draft here did. Recorded rather than rewritten, because the error runs
self-critical rather than self-serving and history rewriting to look more accurate about my own
accuracy is not a trade I want to make.

**Near-misses this session, by family, not numbered:** reading a pipeline's exit code instead of the
process's; the git-push scan that fired on its own deny list (right text, wrong question); a
schema-freshness check I did not trust until I corrupted the file and watched it fail; the `5/5`
count in a commit message that should have been `7/7`; and this section itself.

**I am claiming zero entries and five near-misses. Probe sets the number, not me** — and if any of the
above reached something I did not check, it is an entry and I have miscounted in my own favour.

---

### ARBITRATED AFTER THIS WAS WRITTEN: three, not zero. I miscounted in my own favour twice.

**Left standing above rather than edited, because the claim is the evidence.** What follows is what
the seats that hold the table actually set.

**Probe found two of the five near-misses had escaped into commits**, and Atlas numbered them
**27 and 28**: the `5/5` in a commit message where this document says `7/7`, and `1c8e6ca`'s *"I
reported that suite as green"*, which this document itself calls an overstatement. My reasoning for
calling them near-misses was that the false green reached no artifact — but I had gone on to write
*about* it in two commit messages, inaccurately, and **a wrong claim you chose to leave in a commit
is still a wrong claim in a commit.** Choosing to record rather than rewrite was right; it does not
make the record correct.

**Entry 26 predates this document** — *"the developer's `/end` is the last write to the record"*,
from the write-ordering exchange before the first candidate, which I withdrew within the hour and
asked to be counted at the time.

**So: three entries, five near-misses, running total 48 Planner / 28 Developer / 0 QA.**

**And I got the arithmetic wrong a second time, arguing the count down.** When Atlas said three I
made it two and asked them to re-derive it before it reached a PR. They were right and I was not:
I had silently measured from the first candidate, they from the loop's start, **and neither of us
had stated the window.** Their sentence was unambiguous and my correction was not — I flagged an
unstated boundary while standing on one. The close-out now names the window explicitly, which is the
actual defect and the only thing that came out of my objection worth keeping.

**Asking was still right.** A number about the accuracy record, in the document that records
accuracy, is worth thirty seconds even when checking it costs you two entries.
