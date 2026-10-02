# Forge park handoff, 2026-10-02 (record session 157; Forge seat log session 3)

Forge (Claude Code, checkout `sia-forge`) is PARKED under the backlog gate (more than 6 code PRs await QA): no new code PRs.
Nothing is uncommitted. Every branch below is pushed. This file is the durable half of the roll; the A2A exchange with atlas-sia
carried the rulings and has no memory.

## Open PRs, heads and QA state (heads as of this file; verify with `gh pr view`)

| PR | task | branch | head | QA state |
| --- | --- | --- | --- | --- |
| #289 | T-208 (r1 to r3) | `loop/t208-fetch-first` | `be32de21` | QA 258 ACCEPTED; waits for Aaron's morning word (B4 is outside his overnight pre-approval) |
| #290 | T-212 | `loop/t212-trailer-attribution` | `f707a09c` | QA 258 ACCEPTED; same wait. Rebased onto master without T-208, merges alone |
| #294 | T-215 | `loop/t215-maturity-cut` | `39c3cca7` | QA 258 ACCEPTED; DIRTY against master after B3 (#305, #313). Rebase requested by atlas-sia; see "Next" |
| #295 | T-008 | `loop/t008-mcp-paths` | `7312a292` | B2 round 2; awaits QA 260 |
| #298 | T-008b | `loop/t008b-mcp-sources` | `7afd7f1b` | B2 round 2; stacked on #295; awaits QA 260 |
| #306 | T-048 counts | `loop/t048-sync-counts` | `3f30e825` | B2 round 2; awaits QA 260 |
| #309 | T-048 hook-configs | `loop/t048-hook-configs-nested` | `f1c2a338` | B2 round 2; stacked on #306; awaits QA 260. CI `test` green at this head (run 37009727374) |

#309 is the only one whose head moved after the last report to atlas-sia (`18fad1fb` to `f1c2a338`, the typed-hook rule below).
Handoffs on the branches: `docs/loops/t208-t212-developer-handoff.md` (on #290), `t208-r3-developer-handoff.md` (on #289),
`b2-round2-developer-handoff.md` (on #309), plus each branch's own mutant diffs under `docs/loops/t008/`, `t008b/`, `t048/`, `t048-hook-configs/`, `t208/`, `t215/`.
They reach master with their PRs.

## Next

1. **QA 260** re-checks B2 round 2 (#295, #298, #306, #309). If it rejects one, atlas-sia sends the round.
2. **#294 rebase** onto `origin/master` (atlas-sia's request): resolve with no behaviour change, `--force-with-lease`, wait for CI, send `git range-diff <old-base>..39c3cca7 origin/master..<new-head>` with each non-`=` commit's resolution in a line, and say whether #305's merge lets `typecheck:tests` reach 0 with the branch. If this file lists #294 at `39c3cca7`, the rebase has not happened yet.
3. After that, nothing: park until a dispatch from atlas-sia. Aaron merges B4 (#289, #290, #294) on his word.

## Rulings in force (from atlas-sia, session 157)

- **Uniform "not checked" rule:** any input that was not examined caps a /sync check at WARN, never pass, even when the message names the skip.
- **url servers and bare commands are named skips**, not gaps: nothing to stat. An ABSENT `~/.claude/settings.json` enables nothing (pass); an UNPARSEABLE one warns.
- **hook-configs entries:** a non-object entry, or a command-type entry (`type: "command"`, or no type in the legacy shape) with no command string, is not checked (WARN). An entry with an explicit non-command `type` (prompt, agent, anything else) is a named skip, `<type> hook, no command`. A bare `echo`/builtin/PATH name is a named skip too. #309 `f1c2a338` implements this (20 tests in `t048-counts.test.ts`).
- **S4-9.2:** a test file may end below its base count only through the `ALLOWED_TEST_LOSSES` table in `s4-guards.test.ts` (exact before and after, stale entry is a finding).

## Open findings (recorded, not scheduled)

- **`startsWith(home)` in command-tool-names / command-names (#306 area):** the absent-directory names use `d.startsWith(home)` with a non-normalised `home`. With a forward-slash `USERPROFILE` the prefix test fails and the name falls through to `d.slice(projectRoot.length + 1)`, giving garbage like `absent: de/commands`. QA 256 "Pre-existing"; atlas-sia ruled it a recorded finding, not this round.
- **The typed-hook rule** (above) is implemented in #309 only; hook-registration, which keys on any `*.js` substring and counts a garbled command as a registration, was not touched (QA 256, outside B2).
- **Drift in the SessionStart hook** is the same check ob_start runs (SUMMARY version and INBOX-completed items), not every rendered view against `state.json` (stated in `t208-r3-developer-handoff.md`).
- **T-221** (a push run and its PR run share a concurrency group, so a cancelled push `test` leaves a PR BLOCKED) is still open in the record; report it, never push empty commits.

## Watch out (this seat)

- Single test file per vitest run; never the full suite on the QA PC. No `python` on this machine: edit with the Edit tool or `node -e`. A heredoc or `node -e` through the shell has collapsed backslashes and turned `\n` into real newlines three times this session (regexes and strings in test files); read the written lines back before running.
- `git checkout <file>` reverts uncommitted test edits along with a mutant: commit the test change first, then mutate (a mutant that survived the first time here was masked by exactly this).
- `--force-with-lease=<ref>:<sha>` once printed "Everything up-to-date" for a branch with new local commits; read the remote back with `git ls-remote` after every push.
- `ob_start` hands this seat the sia-builder handoff (G-049: three checkouts share one hub identity), so the greeting names no assignment for Forge. Forge's own last handoff in the record is session 151.
