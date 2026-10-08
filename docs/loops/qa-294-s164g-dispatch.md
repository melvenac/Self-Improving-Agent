# QA 294, session-164 batch g: #516 FLEET-AE (SIA's A and E of the fleet design)

**By:** Atlas (planner), 2026-10-08, record session 164. **Machine:** the laptop (Windows), booked through clark.
**Read first:** `docs/loops/fleet-deterministic-dispatch.md` (sections A and E, acceptance F1–F9), and
`.agents/roles/developer.md` (its `## Building checks` section is A's single source).
**Do not read** any hub room or developer report until your report is pushed.
**Merge authority:** Aaron's word. **Gates:** the Makerspace import (Aaron: A and E land before it).

**Narrow:** one test file per vitest run, mutants on touched files only, `tsc --noEmit`, `npm run typecheck:tests`,
`gh` reads. No full suite.

**Pinned head (CI `test` green; mutant runs read red by the planner):** `1bc4d20dc15cb4271428bc6879e4de414cec47e1`
(CI 37784203945), built on master `3ccfeaef`. Mutants, each one commit on the head:

| Branch | Run | Mutant |
|---|---|---|
| `loop/fleet-ae-mut-1` | 37784365983 | `cursor-rules-current` warns instead of failing |
| `loop/fleet-ae-mut-2` | 37784370489 | the STANDING RULES section is capped |
| `loop/fleet-ae-mut-3` | 37784375859 | `set_standing` writes on an unknown id |

Confirm with `gh pr view 516` that the head still equals this pin. If it moved, stop and report INCOMPLETE.

## Rows

1. **Confined.** List every file in `git diff origin/master...<head>`. Allowed:
   - `open-brain/src` and its tests;
   - `scripts/`;
   - `.cursor/rules/`;
   - `.agents/SYSTEM/hub-partner-seats.json`;
   - `CHANGELOG.md`.

   **`.agents/state.json` must not be touched.** If any decision is tagged `standing`, that is a finding.
2. **Mutant runs.** Each red run's failing tests are the rows its mutant targets.
3. **A, re-derived.** Run `node scripts/gen-cursor-rules.mjs` yourself on the head:
   - the `.mdc` body equals the `## Building checks` section byte for byte, after line-ending normalisation;
   - the header names the source path and the correct blob SHA (`git rev-parse <head>:.agents/roles/developer.md`);
   - `alwaysApply: true` is set;
   - a second run changes nothing (`git status` clean).

   Then edit one word in the section: real `/sync` (`node build/cli.js sync --check-only` or its documented form)
   FAILS, naming the `.mdc`. Regenerate, and it passes. Also check that a deleted `.mdc` FAILS.
4. **A3 and A4.**
   - `requiredBlock` in `hub-partner-seats.json` resolves (path + heading) to exactly the text the `.mdc` carries.
   - Run the real SessionStart hook for a developer seat in a temp checkout, and check that its role-knowledge output
     names `developer.md`.
5. **E, through the real MCP path, on a temp copy of a record.**
   - `ob_state add_decision {standing:true}`, then `set_standing` on an existing id, then `ob_start`: both appear under
     `STANDING RULES`, between WATCH OUT and OPEN QUESTIONS, newest first.
   - Untag one, and it disappears.
   - Feed the briefing 40 standing decisions: all 40 render.
   - `set_standing` on an unknown id refuses and writes nothing: revision unchanged, file bytes unchanged.
6. **Backward compatibility.** Run `ob_start` on a copy of **master's real `.agents/state.json`** (copied to temp; never
   the live file). The briefing is identical to master's own `ob_start` output on the same copy, except the build line.
   Diff the two and show the diff.
7. **Windows.**
   - A CRLF `developer.md` under `core.autocrlf=true` gives the same `.mdc` body, and `/sync` does not flap across two
     runs.
   - Run the generator from a path with a space.
8. **Your own mutants.**
   - (a) The generator copies the section's heading line too, or one line too many.
   - (b) `standing` is ignored for decisions written by `add_decision`, so only `set_standing` works.
   - (c) The briefing sorts oldest first.

   Name the red test for each, or report a finding.

## Rules (headless Claude Code)

- You are **QA 294**, prefix `s164g`. Push ONLY `qa/s164g-*` branches, and only through
  `node docs/loops/qa-294/push-qa.mjs <branch>`, run from your `qa294-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- Never write a live `.agents/state.json`. Copy it to `C:/qa-tmp` first. Never read the real knowledge DB, the real
  open-brain data dir or a real vault for anything but counts, names and paths (G-051). Make no live Jev call. Never
  print a key.
- **Sandbox (D-131):** list every command run with the sandbox disabled under `Unsandboxed commands`, with its purpose
  and every path it touched, or write `Unsandboxed commands: none`.
- Commit `docs/loops/s164g-qa-report.md` on `qa/s164g-report`. Put the verdict, with its pinned head, first. The
  report's last line is exactly `QA-294: REPORT COMPLETE`.
