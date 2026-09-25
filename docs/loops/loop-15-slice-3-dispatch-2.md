# Loop 15 slice three: dispatch 2, the loop resumes

**From:** Atlas (planner), record session **78** · **Date:** 2026-09-22 · **On Aaron's word**
("Forge and Probe are standing by"). This settles the session-77 open question of whether the seats
run before Wednesday's reset: they run now.
**Brief:** `loop-15-slice-3-brief.md`, unchanged. This file dispatches; it does not amend the brief.

## 0. Before anything else, every seat reads what the project is FOR

Last loop a seat started work and then asked, halfway through, what the project was for. The record
is mechanism, and it does not carry purpose. **Before your first action on the loop, read all three
of these:**

1. **`.agents/SYSTEM/PRD.md`**. The four-sentence problem statement is the purpose. Its Core Features
   list is stale (items 2, 4 and 5 were cut in Loop 10); PR #97 adds a note saying so, and T-169
   rewrites the list at this loop's close.
2. **`README.md`**. Same caveat: it still describes the maturity lifecycle and skill proposals.
3. **The SIA Step-Back**, https://claude.ai/artifact/3Kv8BuKYrj5vaKQgD8NKC7. It says what the
   project set out to solve, what worked, and why the three-seat loop exists (ideas E and F; the
   HoH runtime is F made mechanical). It stops at Loop 11. **Read the artifact, not the vault
   copy.** *Corrected 2026-09-22, same session:* this line first offered
   `~/Obsidian Vault v2/Research/sia-extraction-evaluation-2026-09-14.md` as an equivalent. It is
   not: the vault copy is 234 lines and stops at Part 3 plus a Loop 4 addendum. Parts 4 and 5
   (Loop 10's ruling, Loop 11's audit) and every "NOW" block exist only in the artifact. The QA
   seat found it by reading both, and the developer had read only the vault copy. The planner
   asserted the equivalence without checking it.

**In your first report, write one sentence saying what this slice is for in terms of the problem
statement.** If you cannot, say so, and stop before acting.

## 1. Record session numbers (T-164: do not use the number your greeting shows)

| Seat | Record session |
|---|---|
| Atlas (planner) | 78 |
| Probe (QA) | **79** |
| Forge (developer) | **80** |

Seats still stop **without `/end`** (T-163 is unfixed; each close-out overwrites the shared slot).
Durable work goes in tracked files.

**Added the same session, on Aaron's word: record MODEL and EFFORT in every tracked report.** Both are
variables. An unrecorded change to either confounds `T-165`'s later comparison of a different
developer, and today's error entries are the first data on whether effort matters at all.

**The instrument is the session transcript, not the settings.** *Corrected the same session; the QA
seat found it.* This paragraph first said "read the effort level from your own session's settings".
That instrument answers a different question. In the QA seat, three readings gave three answers:
`~/.claude/settings.json` gave `high` (the configured default for the model), the inherited
`CLAUDE_EFFORT` gave `max` (current, not at launch), and the host transcript
(`~/.claude/projects/<slug>/<session-uuid>.jsonl`) carries a **per-entry `effort` field** that read
`medium` on all 248 entries until 01:02:27Z and `max` after. `high` never appeared. **Read effort from
the transcript's per-entry field, and report it as runs with timestamps**, because it can change
mid-session. The planner's transcript confirms the instrument in a second seat: `medium` on 355
entries 20:22Z → 00:59:43Z, `high` from 00:59:50Z. **So every ruling and every QA artefact written
this session before those switches was produced at medium**: the G-045 acceptance (`76c728a`),
criteria A (`770bcb9`, `ce8e6a1`, `96738a8`), rulings-1 and rulings-2. Each report states its
commits' effort from the transcript.

The planner's recommendation,
**unmeasured and set by Aaron:** QA **max** (the last gate before merge, where the valuable work is
thinking of the probe nobody else did); developer **xhigh** while building security-relevant
candidates, **high** for mechanical work; planner **high**. The planner's own errors this session
were failures to check, not to reason, and the fix for those is gates that code enforces.

## 2. Probe (QA): score the G-045 candidate first

- Candidate **`9ed674c`** (on `origin/loop/15-slice-3-forge-candidate`, tip `5759008`, which adds
  only the developer handoff). Criteria **`17c9056`** on `origin/loop/15-slice-3`, which you wrote
  before the candidate existed. Fast-forward `loop/15-slice-3` to `5759008` in your own tree.
- Read-only, frozen SHA; report "tree moved" and "tree dirty" separately; verdicts from exit codes
  only; the baseline at `eb14d09` is **not** assumed green (criteria §7, V-076).
- **Full-suite run (T-168):** call `ListAgents` immediately before the run and **record every peer's
  state beside the result**. Limits: registration lag means an empty listing is not evidence of
  idleness, and non-Claude load is invisible. Tell Forge and the planner before you start the run,
  and again when it ends.
- Report into a tracked `docs/loops/loop-15-slice-3-qa-report.md` on your branch, then message the
  planner. **Aaron merges**; a relay is not his approval.

## 3. Forge (developer): design, not build, while QA scores

- **No full-suite runs and no builds while Probe's suite is running.** The machine is shared and
  load is what G-042 depends on.
- Brief §3 items 2-4 are next: a real model-backed role through the runtime, **T-155** (the shadow
  merge gate, built so a shadow developer can be pointed at it, which T-165 needs), Jev thresholds
  against real diffs, and F11. **Criteria come before the candidate**, so do not build yet.
  Write a **design proposal** for §3.2 and T-155 into a tracked file and send it to the planner for
  a ruling. The design is yours; the planner rules on it and does not specify it.
- Name, in the proposal, what G-045's acceptance must be true for your design to hold, so a QA
  rejection of `9ed674c` is visibly upstream of it.

## 4. Rules carried from the brief, not restated

Brief §4 applies whole: no `add_gap` (R28), a ruling needs an acceptance row, controls must
discriminate the transition, PowerShell for `ref:path`, native A2A on this machine (D-029), and
nothing gates on a single `ListAgents` poll.

**Added the same session: "use PowerShell for `ref:path`" trades one mangling for another.** The QA
seat's finding, by blob hash: in PowerShell 5.1, `git show origin/master:<path> | Out-File` decodes
git's UTF-8 as ANSI, and every em-dash comes back as `â€”` (36 differing lines on PRD.md against
identical bytes). MSYS mangles the path; PowerShell mangles the content. Routes that survive both:
compare blob hashes (`git rev-parse <ref>:<path>` against `git hash-object <file>`); in Bash,
`MSYS_NO_PATHCONV=1 git show <ref>:<path>`; in PowerShell, set
`[Console]::OutputEncoding = [Text.Encoding]::UTF8` first. **A content comparison has to be
validated against a known-identical pair before its differences are trusted.**
