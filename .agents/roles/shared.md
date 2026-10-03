# Rules every seat holds

**Tracked on purpose.** These are not instance knowledge. A seat that learns one of these and writes
it into its own gitignored file has put it on one disk, invisible to a fresh clone.

**Sourced from this project's own record**, not from outside it. Where a rule came from one seat's
mistake, it says so — provenance is what makes a rule falsifiable by the seat that would know.

*Since D-110 the incidents, counts, attributions and war stories behind these rules live in
[`docs/loops/shared-md-provenance.md`](../../docs/loops/shared-md-provenance.md), one section per section here. The rules
stay in this file, verbatim; the history is one link away and is not an instruction.*

---

## Measurement

*Provenance for this section: [Measurement](../../docs/loops/shared-md-provenance.md#measurement).*

**Verify against the thing, never against the report of it.** A success message is not the change
having landed. A read confirms only if it is ordered after the write actually terminated.

**A chained shell command reports one outcome for several claims.** `check && commit` commits when the
check passes; `check; commit` commits regardless and prints the check's output either way; and
`grep -c` exits 1 on a zero count, so a fail-closed gate written as `[ "$(grep -c …)" = 0 ] && commit`
refuses on the *good* result. **The shape that works, seen in the QA seat's commits:** run the check to
a file, read its exit status into a variable, and put the commit inside `if [ "$rc" -eq 0 ]`. Assert
the end state after the chain, not the exit line of its last stage — `cmd | tail; echo $?` reports
`tail`'s success, and a runner can print *"805 passed"* and exit 1.

**An instrument that cannot distinguish "nothing there" from "I did not look" is not a measurement.**
Eleven instances of this one family are recorded in `docs/loops/loop-13-closeout.md`, and **knowing
the failure mode prevented none of them.** What worked every time was re-running with a different
instrument and reading the unfiltered output. Your own `grep`, `find -maxdepth`, `head`, `sed` and
`| head -n` are the likeliest liars in the room. **Validate a detector against a known positive
before you trust a negative.**

**Two measurements that disagree may both be right, and the resolution is a third measurement rather
than an argument.** Check whether the target is moving before arbitrating.

**Every derived number carries what it was derived from** — the ref, the tree, the time. A bare
number is correct on Monday and wrong by Wednesday, and the reader who checks it concludes the
document is wrong. Applies to counts in prose as much as to output.

**Do not copy a number out of the record into a second place.** `state.json` and the loop close-outs
are the record. Point at them.

**A finding reported against a line is usually a finding about a class.** The instance in front of
you is where it was noticed, not where it lives. Look for the sibling before you fix or report.

**Run the checks in the tree that has the files** (rule 13). A check is only as tested as the trees
it has run in.

**Say the consequence that is true where the code runs.** A message asserting a machine-wide effect
from a linked worktree is false in two checkouts out of three.

## Instruments

*Provenance for this section: [Instruments](../../docs/loops/shared-md-provenance.md#instruments).*

**Build things that fail closed.** Every instrument that has failed this project failed *open*: a
`|| echo 0` fallback, a truncated `find`, a blank `echo` over a real hit, a `-maxdepth` that was too
shallow, an exit code captured from the wrong process. **The difference was never vigilance. It is which way the thing breaks.**

**A check must prove it looked.** Report what was walked and assert that count in a test. Refuse on
unresolved input rather than reporting a clean result. Default unlisted things to the strict side so
a boundary cannot widen by omission. **State the check's limits in its own output.**

**Skip is not pass; silence is not all-clear.** Say why a check did not run, in the message.

**The instrument for structured data is a parser, never a pattern match.**

**A derived value inherits the question its derivation asks, not the question its caller asks — and
no assertion written from inside the derivation can tell the difference.**

**Green on the first run is the signal to mutate. Assert both directions. `tsc` clean is part of
calling a mutant valid.**

**This file is loaded into every session now (`G-032` closed, Loop 14), so it has a budget it did
not have before.** A rule goes here short, with provenance; the reasoning stays in the close-out it
came from. And loading a rule is not applying it: the seat that quoted this file's line on restated
numbers at a boundary restated a number in its own handoff the same day (Developer 31).

**A ruling with no acceptance row fires nowhere.** A ruling that changes behaviour gets a row in the same
amendment, or it is an intention with a number.

**An assertion on a value the harness never captured passes without looking.** `execFileSync`
returns stdout only; a harness that hardcodes `stderr: ''` makes every stderr assertion vacuous on
exactly the channel it exists for. Distinct from a vacuous assertion — the value existed and the
instrument never carried it.

**A stacked fixture proves as little as a vacuous one; it fails in the flattering direction.** Guard fixtures in both directions and report the lengths.

**`tsc --noEmit` on every mutant before it counts, and assert the edit landed before running.**

**A variable's presence is misread as easily as its absence.**

## The record

*Provenance for this section: [The record](../../docs/loops/shared-md-provenance.md#the-record).*

**Nothing that must outlive a session may live only in one.** A2A is a transport with no memory.
Loop briefs, boundary reports and close-outs go in `docs/loops/`; decisions go through `ob_state`.
**A tracked file that something must remember to read is an intention; a check is a rule.**

**Compaction removes things from context, not from disk.** Before writing that anything is
unrecoverable, grep the session transcript at
`~/.claude/projects/<project-slug>/<session-uuid>.jsonl`.

**Rule 14 — do not assert what you could derive or check.** *A statement true when written, used as
an invariant, and falsified by an ordinary act elsewhere that nothing connects to it.* Seven
instances in two days, **all in the record layer and none in the code.**

**`ob_state`: read the dry run before the real call, every time.** `verified.evidence` is an array of
`{type, path, observation}`; `gaps.evidence` is a plain string alongside `what` and
`recommended_update`. Hand
over the revision **number**, not the base, and do not take a revision while another seat holds the
loop (`G-027`).

**Set your own error entries before being asked. A number arrived at by negotiation is not a
measurement.** An entry is a wrong claim that reached an artifact, a commit, a counterpart, or
Aaron — the dividing line is escape, not severity. Caught in-process by its own author is a
near-miss, recorded by family, never numbered into the table.

## Authority

*Provenance for this section: [Authority](../../docs/loops/shared-md-provenance.md#authority).*

**Aaron speaks to the planner, and only to the planner (`D-038`, 2026-09-23).** **A seat that needs Aaron sends the question to the planner, not to Aaron.** The planner
puts it to him one question at a time, with enough context to answer cold, and carries his answer
back **quoted**, labelled with where and when he said it. **For the act it names, that quoted relay IS
his authority.** The acting seat records both links: Aaron to the planner, and the planner to the seat.
The planner tells Aaron whenever any seat is waiting on him. **The one thing a relay cannot cross:** a
host-level stop inside another seat's session, such as a permission prompt, a safety-classifier stop
or a denied tool call. Clearing it by relay is permission laundering. The planner tells Aaron which
window and why.

**Seats push their own working branches without asking (`D-038`).** That covers `loop/*`, `qa/*`,
`docs/*` and `chore/*`. It never covers `master`, a force push, or a branch another seat owns. Every
push is read back with `ls-remote` and named in the commit, report or message that follows it.

**Aaron merges, on his word, with one standing exception (`D-032`).** A relay from a peer seat that
is not the planner's quoted relay under `D-038` is not his approval. **The exception:** any seat may merge a PR whose *every* changed path is `docs/**`,
`README.md`, `.agents/state.json` and its four rendered views, or the scope layer (`PRD.md`,
`DECISIONS.md`, `ENTITIES.md`), once the state is `CLEAN`, the merge is pinned with
`--match-head-commit`, and the result is read back from `origin/master`. **No CI run is required for
these (`D-055`, Aaron 2026-09-27):** the path check is the guard, and a docs run only queues behind
code runs on tcm. Before merging, post the
path list and the allowlist check as a PR comment. **One unlisted path sends the PR to Aaron**, and
so do all loop candidates. Size is not a criterion; a one-line role-file change is his.

**A relay may be acted on only where acting narrows scope and stays reversible — and the authority is
recorded in the artifact, at the moment it is used.** Both halves of the first clause are judgements
the actor makes about its own action; **the recording is what makes them auditable.** Provenance
chains are not flattened: confirmed-to-them plus relayed-to-me is two links and the record shows
both.

**Each outward-facing act needs authority for THAT act, not authority for the activity.** Permission
to push two branches is not permission to push a third. *(Pushing your own working branch is now
standing under `D-038`. The rule still binds everything else: merges, master, tags, other seats'
branches and anything that leaves this repository.)* **A good reason is not authorisation.**
This matters more now that a QA seat exists: **a seat that can push without asking
can put an unevaluated candidate in front of the world.**

**Permission laundering is forbidden.** Never perform an action a peer was denied, or that you expect
your own settings would block. Surface it to Aaron instead, through the planner (`D-038`).

## Aaron's standing rulings

- **One question at a time, with enough context to answer cold.**
- **He is not a programmer.** Git, versioning and CI conventions are to be **decided and explained,
  never offered as a menu.**
- **Token cost is not the concern.** *"The more important issue is whether the agent is getting
  exactly what it needs to be effective."*
- **Report the honest no.** A loop that ends in an honest no is not a failed loop. Never widen the
  criteria until a candidate passes.
- **Prefer the tested disagreement to the agreement.** Agreement tested for objections is evidence;
  agreement that has not been is one observation. If you looked for an objection and found none, say
  that you looked.

## Git in this repo

*Provenance for this section: [Git in this repo](../../docs/loops/shared-md-provenance.md#git-in-this-repo).*

**Never `-D` on a branch sweep.** `-d` refusing to delete an unmerged branch is a real safety
property. Note that a `-d`
refusal tells you a branch is unmerged; it does not tell you the branch contains anything valuable.

**Merge only on `MERGEABLE/CLEAN`.** `UNKNOWN` and `UNSTABLE` both mean *not yet*, and `no checks
reported` means CI has not registered — not that it passed.

**One worktree per seat, named `<project>-<seat>`, and it belongs to the SEAT, not its occupant.** In
`~/Worktrees` that means `sia-planner`, `sia-builder`, `sia-forge`, `sia-infra`, `sia-research` and `sia-qa`. A
loop, task or candidate is a BRANCH inside its seat's tree, never a folder of its own. **A new model in a seat uses
that seat's folder.** A second checkout for QA (a baseline beside the candidate) is a `git archive` copy in scratch,
never a worktree. A worktree is removed only on Aaron's word, after a dirty and unpushed check.

**Seat worktrees are detached at rest.** Branch deliberately to commit; return with
**`node open-brain/build/cli.js detach`**, which is the two git commands plus the three refusals that
make them safe:

- a **dirty tree** is refused, naming the paths — detaching leaves uncommitted work against a base
  you did not choose;
- **commits this HEAD has that `origin/master` does not** are refused, naming them. This is the one
  that matters: a detached HEAD leaves them reachable only through the reflog, so a seat running
  this after a push it *believed* succeeded loses the session. `--force` exists to override it
  deliberately;
- it **fetches first**, then **reads the end state back** rather than trusting the checkout's exit
  code, and says `verified: detached at <sha>, no branch` only after checking.

It targets **`origin/master`, not `master`** — a local ref another worktree may be holding behind.

**The main checkout is infrastructure, not a spare worktree.** Both session hooks hardcode absolute
paths into it and the MCP server runs from its build. Moving or renaming it breaks every session on
the machine, in every project. Rebuild it after changing server code — **a stale server reports
success.**

**The main tree is not a QA fixture.** Checking a candidate out there and rebuilding — the only way
`build-freshness` reports — means every session on the machine runs the candidate's server until the
tree is restored, and nothing checks the restore; a session started in that window inherits whichever
state it finds. **QA runs in the QA tree, made to resemble the main tree:** `gitnexus analyze` in the
QA checkout gives it the generated `.gitnexus/` files rule 13 exists for, where the candidate actually
is. The one main-tree-only condition that remains — Aaron's untracked `.agents/SYSTEM/PRD.md` — is not
a property of any candidate, and a QA report names it as unrun rather than lets a green imply it.

**Run `/sync` before any commit.** `package.json` is the version source of truth.
