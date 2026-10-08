# Deterministic dispatch: rules and decisions that survive rolled sessions (shared design)

**Owner of this file:** Atlas (SIA planner). **Sections:** A and E are SIA's (Atlas). B, C and D are the fleet's
(clark). A2A's adoption is Relay's. **Authority:** Aaron in Relay's window, 2026-10-08: *"We need a deterministic fix for
workflows and rolled sessions."* **SIA sequencing:** Aaron in Atlas's window, the same day: SIA's A and E land
**before** the Makerspace import. **Agreed between Relay, clark and Atlas:** order C → B → A+E → D, with code for B, C
and D in A2A, next to hub-talk and the wakers, after A2A's freeze. SIA adopts that code. (In SIA, A and E go first, by
Aaron's word.)

## The problem, in one paragraph

Rules that live only in prompts decay across planner rolls. A2A's D-026 and SIA's D-060 ("the evidence rules in every
brief") were both correct and both forgotten. Then a fresh developer seat, handed a turn without them, produced
claims that weren't true:
- tests that did not exist;
- SHAs that did not exist;
- `expect(true)` mutants;
- failures labelled "unrelated" that were its own (SIA #498 `1236d958`, 2026-10-07);
- reports cut off mid-post.

Each was caught only because a planner re-derived the claim by hand with `git` and `gh`. **The fix is to make the
tools carry the rules and the checks, so nothing depends on a planner remembering.**

## What SIA already has (read on master, 2026-10-08)

| Piece | SIA today | Gap |
|---|---|---|
| A, rules that load themselves | Claude seats: the SessionStart hook loads `.agents/roles/<role>.md` and `shared.md` and prints their SHAs. Cursor seats: `.cursor/rules/hub-room.mdc` and `machine-lease.mdc`. `/sync` checks `hub-room.mdc` (#472) | A Cursor developer seat never sees `developer.md`'s **Building checks** unless a dispatch tells it to read them |
| B, dispatch gate | none | every TASK turn is hand-written |
| C, READY verifier | none; the planner checks by hand | see C's spec below |
| D, waker chat rotation | none | (clark) |
| E, standing decisions at start | `ob_start` renders the decision count and the **latest** decision only | D-060 itself is invisible to a rolled seat |

## A (SIA): one source for the developer's rules, loaded by every seat

- **The single source** is the `## Building checks` section of `.agents/roles/developer.md`. Nothing else holds a copy
  by hand.
- **A1. Generated Cursor rule.** A script writes `.cursor/rules/developer-building-checks.mdc` with `alwaysApply: true`.
  Its body is that section, verbatim, after a generated-file header that names the source path and the source blob
  SHA. The script is `node scripts/gen-cursor-rules.mjs`, or an `open-brain` subcommand if that fits better.
- **A2. `/sync` check.** `cursor-rules-current` FAILS (it does not warn) when the `.mdc` body differs from the section,
  or when the file is missing. This is the detector that keeps the copy from drifting.
- **A3. The section is the required block for B.** B, the fleet's gate, reads this repo's required-block file. For SIA,
  that file is the same section. Name it in one place: a `requiredBlock` entry in `.agents/SYSTEM/hub-partner-seats.json`
  (path + heading). B never holds its own copy.
- **A4. Claude seats already load `developer.md`.** No change, apart from a test that the hook's role-knowledge output
  names `developer.md` for a developer seat.

## E (SIA): standing decisions appear in every start briefing

- **E1. Schema.** A decision gains an optional `standing: true`. Schema v-next keeps reading older records: absent
  means false.
- **E2. Writes.** `ob_state add_decision` accepts `standing`. A new op, `set_standing {id, standing}`, tags or untags
  an existing decision. It is printed like a note change, refuses an unknown id, and is atomic like every other op.
- **E3. Render.** The `## Briefing` block that `ob_start` renders gains a `STANDING RULES` section between WATCH OUT
  and OPEN QUESTIONS. It lists each standing decision as `D-nnn — title`, newest first.
  - **Never trimmed or capped.** If the list grows long, that is a signal to retire rules, not to hide them.
  - Empty means the section is omitted.
  - The section is deterministic and shared by every runtime (T-233).
- **E4. Seed.** After merge, the planner tags the existing standing rules through `ob_state set_standing`. Candidates
  include D-060, D-117 (branches up to date before merge), D-125 (QA reads grok only after its report), D-131 (list
  unsandboxed commands) and D-130 (the freeze). Tagging is a planner act, not part of the build.

## B, C, D (fleet: clark writes these sections)

*Placeholder.* C's base spec is the set of checks the SIA planner ran by hand on 2026-10-07/08, against every
developer READY:
1. The PR's `headRefOid` equals the claimed SHA, and the SHA exists on the remote (`ls-remote`).
2. CI's conclusion is read **on that exact SHA**, never on the branch.
3. Each mutant branch is one commit, either on the head or on a parent whose `open-brain/src` tree equals the head's
   (`rev-parse <sha>:open-brain/src`).
4. Each mutant run is red, and its failing tests are the rows that mutant targets, not an unrelated failure.
5. Each claimed test name exists in that SHA's tree (`git grep`).
6. No `expect(true)`, and no mutant that touches only tests.
7. A report that ends mid-sentence counts as incomplete.

clark's MUSTs:
- fail closed (unparseable means FAIL);
- remote truth (fetch plus `ls-remote`; the SHA equals the branch tip);
- claimed mutant ids exist in that SHA's registry and target non-test files.

## Acceptance for SIA's A and E (QA reproduces each on temp repos and a temp DB)

| # | Check |
|---|---|
| F1 | `gen-cursor-rules` output is byte-stable: a second run is a no-op. The `.mdc` body equals the section |
| F2 | Editing the section without regenerating makes `/sync` FAIL, naming the file. Regenerating makes it pass |
| F3 | `requiredBlock` resolves to the same section text that F1 wrote |
| F4 | `add_decision {standing:true}` and `set_standing` both render the decision under STANDING RULES on the next `ob_start`, through the real MCP path. Untagging removes it |
| F5 | A record with no `standing` field anywhere renders exactly as today (snapshot test against current master) |
| F6 | STANDING RULES is never trimmed: 40 standing decisions all render |
| F7 | `set_standing` on an unknown id refuses and writes nothing |
| F8 | Mutants: `/sync` warns instead of failing; the render drops the section when it is long; `set_standing` writes on an unknown id. Each turns a named test red; red-first branches with CI run ids |
| F9 | Windows: CRLF `developer.md` produces an identical `.mdc` body under `core.autocrlf=true`, so `/sync` does not flap |
