<!-- generated from .agents/state.json rev 23 by open-brain v0.36.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## Pick up here _(written session 62)_

Loop 11 is complete and merged: PRs #17, #18, #19 and #20 are in master, v0.36.0 is tagged at 39fefb4, and the instruction surface is tracked — a fresh clone now gets CLAUDE.md and the commands for the first time. One piece of work is outstanding and it is small: PR #21 (.gitattributes, T-151) is open and verified against a control worktree but not merged; Aaron merges. The next loop's subject is unruled. The evidence points at one gap: nothing checks that a deletion propagated to the prose, which is where 25 of 38 defects came from.

## Watch out

- A substring check answers a DIFFERENT QUESTION than the one being asked, and the answers coincide most of the time — which is why it is dangerous rather than merely unreliable. Five instances in session 62: four where grep matched a citation of a retired assertion, one where it missed a correct document by being too literal (searching 'error 21' in a file that says 'Developer 21').
- `git show <ref>:<path>` is mangled by MSYS on Windows when the ref contains a slash — use MSYS_NO_PATHCONV=1. It cost three re-runs in one session and TWICE produced confident wrong answers that were nearly filed as findings. A zero from a broken instrument looks exactly like a zero from a clean file.
- For an instruction that produces artifacts, LOOK AT THE ARTIFACTS. The /checkpoint filename doubling was invisible in both files — each internally consistent — and obvious in one `ls`. Adopted as the audit's fourth question.
- `ln -s` under MSYS creates a real directory, not a link. That is what makes `git worktree remove` fail with 'Filename too long' after you have linked node_modules into a throwaway worktree. Remove the copy first, or do not link at all.
- An unrecognised CLI flag selects the MUTATING default: `sync --check-only` is silently discarded because cli.ts:21 is args.includes('--check'), and sync runs in fix mode. T-150 is open on it. Until it is fixed, type the flag exactly.
- Two seats share one working tree. Either seat can delete the other's files by doing something entirely correct on its own branch, and for untracked files the loss is silent because git does not report removing what it never tracked. T-149 is open; the fix is one worktree per seat and it was demonstrated three times in session 62.
- The checks in this repo had a better record in session 62 than either agent's hand-rolled reasoning. command-parity was right when a raw md5 said 7 of 11 commands had diverged (none had — CRLF across the tracked/untracked boundary); mirror-parity caught a repair applied to one Cursor copy and not the other, and surfaced a fourth command mirror (~/.cursor/commands/) that neither enumeration had.
- Read the ob_state dry run before the real call, every time. Filing one task in session 62 would have evicted done-task T-004 under retention; the dry run said so first and its content was preserved in CHANGELOG.md before it went.

## Open questions

- Does the protocol half earn its keep? Still unanswered — and session 62 is evidence of a kind: a full loop ran start to finish with ZERO recalls. ob_recalled returned 'No knowledge entries recalled this session'. Session-start injection is suspended (Loop 10 C2) and no deliberate mid-task recall was ever wanted. A memory layer that is never consulted during a day of hard work is not obviously earning anything.
- What checks that a deletion propagated to the prose? 25 of 38 defects were references to things the protocol itself deleted. command-tool-names now catches the tool-name case and NOTHING catches the rest — file names, script names, component names, renamed packages.
- Should the point-of-use rating signal be built (T-014)? T-057 was closed by striking `referenced` from the instructions rather than implementing it, which stops the lie but leaves the was-it-cited question unanswered and the 445 neutrals still hiding it.
- Node v24: the v22 pin is released in this repo, but Smart Connections may break in Aaron's vault where no test here would catch it. Unchanged from session 61.

## Last session

Session 62 — 2026-09-17 — `b0518d9a-934d-45d6-b6e3-279816d3a66a`
