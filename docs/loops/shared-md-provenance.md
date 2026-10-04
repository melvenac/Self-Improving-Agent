# Provenance for `.agents/roles/shared.md`

**This file is history, not instruction.** The rules every seat holds are in
[`.agents/roles/shared.md`](../../.agents/roles/shared.md), verbatim. Under D-110 the incidents, counts, attributions
and war stories that used to sit inside those paragraphs moved here, so the file loaded into every session carries the
rules and this one carries why each exists. Nothing below is a rule, and a seat that needs one of these to act has found
a rule that is missing from `shared.md`.

Each entry is headed by the rule it belongs to. The text under it is moved **verbatim**, in its original order, from
`shared.md` at `origin/master` `f8345f1b`; `docs/loops/shared-md-split-check.mjs` proves that and lists every sentence
this split added.

**Why here and not in `.agents/roles/`:** that directory holds the role knowledge the greeting loader and the harness read
by name (`shared.md` plus one file per role), and a history file there would sit among them looking like one. `docs/loops/`
already holds the close-outs these paragraphs cite, and `docs/**` is on the docs-only merge allowlist (D-032).

## Measurement

### Verify against the thing, never against the report of it

`gh pr merge` has printed `could not determine current branch: failed to run git` while
the merge succeeded.

### Two measurements that disagree may both be right

A tracked file measured
281,558 bytes in two worktrees and 285,228 in a third; the delta was exactly the carriage returns
(`G-031`). A transcript measured 12.5 MB and 12.8 MB eleven minutes apart because it was still being
written.

### Do not copy a number out of the record into a second place

A count restated in an instruction file is the hardcoded-symbol-count
defect that `v0.40.0` existed to remove.

### Run the checks in the tree that has the files

The retirements check passed four boundary reports, a sign-off and five merged PRs,
then fired 115 findings the first time it ran in the main tree. A version check that is a harmless
warning in two checkouts is a hard failure in the one holding the file.

## Instruments

### Build things that fail closed

A `^{commit}` mangled by `cmd.exe` *should*
have been a silent wrong answer and was not, because undefined distance was an issue rather than a
zero.

### The instrument for structured data is a parser, never a pattern match

Two seats made this
mistake an hour apart on the same file, the second having just been told about the first.

### A derived value inherits the question its derivation asks

Three instances in Loop
14, every one green: a fetch-time line that said "unknown" while looking like caution; a greeting
that named the migration commit as every seat's close-out because the migration rewrote every
entry's bytes; a session number stamped on a batch before the record held it. Each was found by
reading the artifact afterwards. *(Developer's sentence, Loop 14; `loop-14-closeout.md` §3.)*

### Green on the first run is the signal to mutate

Three mutants survived green suites at first pass in Loop 14, each the exact
defect being fixed; a vacuous negative shipped inside the repair for a vacuous positive and was caught
only because the positive failed against the same wrong path; two mutants broke syntax rather than
behaviour and were replaced before being counted. *(Developer, Loop 14.)*

### A ruling with no acceptance row fires nowhere

R7 of Loop 16 was ruled, agreed by the seat that
asked for it, written into a boundary report as settled — and never built; 153 tests, `tsc`, `sync`
and five reports were green throughout. *(Loop 16, F3; `loop-16-closeout.md` §4.1.)*

### An assertion on a value the harness never captured passes without looking

Found by a mutant, not by review. *(Developer, Loop 16 M18.)*

### A stacked fixture proves as little as a vacuous one

Short
decoys handed every competitor a length advantage and made a rank-4 read as rank-9 — flattering to
the seat whose row it made someone else's problem. Both seats built one within hours; both caught
their own. *(Loop 16, amendment 11.)*

### `tsc --noEmit` on every mutant before it counts

Three type-invalid mutants went red for the wrong reason in one session; a mutation script whose
regex never compiled left the fixture untouched and read as *"the guard does not detect nine
decoys"* — a false accusation against a working guard. *(QA, Loop 16 reports 1–3 §11/§8.)*

### A variable's presence is misread as easily as its absence

Every Loop 16 seat inherited
`CLAUDE_CODE_CHILD_SESSION=1` from its launch environment and wrote no transcript; all three read
the missing file as a host property. Three seats agreeing was one environment observed three times —
nobody disagreed, so nobody looked. *(QA, Loop 16 close; `G-044`'s mirror.)*

## The record

### `ob_state`: read the dry run before the real call

Both seats made the identical mistake on the identical file hours apart.

## Authority

### Aaron speaks to the planner, and only to the planner

His words: *"If an
agent is waiting on me I need to know through the planner. Otherwise I'm costatly swithing session
windows."* (verbatim)

### Aaron merges, on his word, with one standing exception

*Why
the line is there:* his merge on a candidate is what `T-155` measures against, and a code merge is a
release (`D-019`).

### Each outward-facing act needs authority for THAT act

Raised by Forge against its own record, 2026-09-19, after pushing an unauthorised branch it had good
reason to push.

## Git in this repo

### Never `-D` on a branch sweep

*(Planner's rule, from a planner action — not a developer finding.)*

### Merge only on `MERGEABLE/CLEAN`

A merge against an uncomputed state once
failed and left the PR closed.

### One worktree per seat

*Why it is written
down (2026-09-27):* the rule lived only in practice and T-149. When A2A-Hub copied this file, which said nothing
more than the line below, it grew six loop- and occupant-named folders. Relay traced the gap to this file (its
Relay-to-Atlas message, record session 147).

### Seat worktrees are detached at rest

That was a correction, not a preference: the original brief said `--detach master`.

**This step had been run by hand more than twenty times** before it became a command. That is `C3`'s
shape exactly — a step that works because a seat remembers it — and the by-hand version has no
refusals at all.

### The main tree is not a QA fixture

*(Ruled 2026-09-20 after the planner announced a main-tree checkout to three seats and QA stopped it.
The planner had done exactly that two days earlier with Aaron present, and it happened not to bite.)*
