# Rules every seat holds

**Tracked on purpose.** These are not instance knowledge. A seat that learns one of these and writes
it into its own gitignored file has put it on one disk, invisible to a fresh clone.

**Sourced from this project's own record**, not from outside it. Where a rule came from one seat's
mistake, it says so — provenance is what makes a rule falsifiable by the seat that would know.

---

## Measurement

**Verify against the thing, never against the report of it.** A success message is not the change
having landed. `gh pr merge` has printed `could not determine current branch: failed to run git` while
the merge succeeded. A read confirms only if it is ordered after the write actually terminated.

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
than an argument.** Check whether the target is moving before arbitrating. A tracked file measured
281,558 bytes in two worktrees and 285,228 in a third; the delta was exactly the carriage returns
(`G-031`). A transcript measured 12.5 MB and 12.8 MB eleven minutes apart because it was still being
written.

**Every derived number carries what it was derived from** — the ref, the tree, the time. A bare
number is correct on Monday and wrong by Wednesday, and the reader who checks it concludes the
document is wrong. Applies to counts in prose as much as to output.

**Do not copy a number out of the record into a second place.** `state.json` and the loop close-outs
are the record. Point at them. A count restated in an instruction file is the hardcoded-symbol-count
defect that `v0.40.0` existed to remove.

**A finding reported against a line is usually a finding about a class.** The instance in front of
you is where it was noticed, not where it lives. Look for the sibling before you fix or report.

**Run the checks in the tree that has the files** (rule 13). A check is only as tested as the trees
it has run in. The retirements check passed four boundary reports, a sign-off and five merged PRs,
then fired 115 findings the first time it ran in the main tree. A version check that is a harmless
warning in two checkouts is a hard failure in the one holding the file.

**Say the consequence that is true where the code runs.** A message asserting a machine-wide effect
from a linked worktree is false in two checkouts out of three.

## Instruments

**Build things that fail closed.** Every instrument that has failed this project failed *open*: a
`|| echo 0` fallback, a truncated `find`, a blank `echo` over a real hit, a `-maxdepth` that was too
shallow, an exit code captured from the wrong process. A `^{commit}` mangled by `cmd.exe` *should*
have been a silent wrong answer and was not, because undefined distance was an issue rather than a
zero. **The difference was never vigilance. It is which way the thing breaks.**

**A check must prove it looked.** Report what was walked and assert that count in a test. Refuse on
unresolved input rather than reporting a clean result. Default unlisted things to the strict side so
a boundary cannot widen by omission. **State the check's limits in its own output.**

**Skip is not pass; silence is not all-clear.** Say why a check did not run, in the message.

**The instrument for structured data is a parser, never a pattern match.** Two seats made this
mistake an hour apart on the same file, the second having just been told about the first.

## The record

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
`recommended_update`. Both seats made the identical mistake on the identical file hours apart. Hand
over the revision **number**, not the base, and do not take a revision while another seat holds the
loop (`G-027`).

**Set your own error entries before being asked. A number arrived at by negotiation is not a
measurement.** An entry is a wrong claim that reached an artifact, a commit, a counterpart, or
Aaron — the dividing line is escape, not severity. Caught in-process by its own author is a
near-miss, recorded by family, never numbered into the table.

## Authority

**Aaron merges, on his word.** A relay from a peer seat is not his approval.

**A relay may be acted on only where acting narrows scope and stays reversible — and the authority is
recorded in the artifact, at the moment it is used.** Both halves of the first clause are judgements
the actor makes about its own action; **the recording is what makes them auditable.** Provenance
chains are not flattened: confirmed-to-them plus relayed-to-me is two links and the record shows
both.

**Each outward-facing act needs authority for THAT act, not authority for the activity.** Permission
to push two branches is not permission to push a third. **A good reason is not authorisation.**
Raised by Forge against its own record, 2026-09-19, after pushing an unauthorised branch it had good
reason to push. This matters more now that a QA seat exists: **a seat that can push without asking
can put an unevaluated candidate in front of the world.**

**Permission laundering is forbidden.** Never perform an action a peer was denied, or that you expect
your own settings would block. Surface it to Aaron instead.

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

**Never `-D` on a branch sweep.** `-d` refusing to delete an unmerged branch is a real safety
property. *(Planner's rule, from a planner action — not a developer finding.)* Note that a `-d`
refusal tells you a branch is unmerged; it does not tell you the branch contains anything valuable.

**Merge only on `MERGEABLE/CLEAN`.** `UNKNOWN` and `UNSTABLE` both mean *not yet*, and `no checks
reported` means CI has not registered — not that it passed. A merge against an uncomputed state once
failed and left the PR closed.

**Seat worktrees are detached at rest.** Branch deliberately to commit; return with
`git checkout --detach origin/master` — **`origin/master`, not `master`**, which another worktree may
be holding behind.

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
*(Ruled 2026-09-20 after the planner announced a main-tree checkout to three seats and QA stopped it.
The planner had done exactly that two days earlier with Aaron present, and it happened not to bite.)*

**Run `/sync` before any commit.** `package.json` is the version source of truth.
