# QA 282, session-162 batch c: G-056 (#464) and T-025's /sync frontmatter check (#466)

**By:** Atlas (planner), 2026-10-06, record session 162. Booked to use the Claude Code weekly allowance before its
reset (Aaron via clark, 2026-10-05).

**Merge authority:** #464 changes only tests, so under Aaron's P2 standing rule (planner window 2026-10-05) the
planner may merge it after an ACCEPT, by a path check. #466 changes `open-brain/src`, so its merge is Aaron's word.

**LIGHT:** one test file per vitest invocation, mutants on touched files only, `tsc --noEmit`,
`npm run typecheck:tests`, `gh` reads. No full suite. No Windows rows.

**Pinned heads (CI `test` green on each, read by the planner):**

| PR | Task | Head | Built by |
|---|---|---|---|
| #464 | G-056 | `f32aa900c13e7f5fefbe8e98381ba75c018f496c` | Scout, Claude Code (Sonnet), desktop |
| #466 | T-025 /sync check | `bc9c22b26ef48fe7fd4a8520f3f0329275fb192d` | cursor-builder, Cursor (composer-2.5, waker `--model`) |

## Every PR

1. **Confined.** `git diff origin/master...<head> --stat`. #464: only `open-brain/tests/pipelines/sync/hub-seats.test.ts`
   and `open-brain/tests/t235-p2-3-cursor-proof.test.ts`. #466: `pipelines/sync/checks.ts`, `pipelines/sync/index.ts`,
   `shared/parse-frontmatter.ts`, `vault-writer.ts` and its new test. Name anything else.
2. **CI.** The `test` result and run id for each head.

## #464: G-056, two vacuous rows (read `docs/loops/g056-brief.md` and QA 279's #427 F1 and #434 F1)

3. **#427's forged-table row can fail.** Restore the env seam (reverse of the `9daf38d8` src change, so production
   reads a process table from `OPEN_BRAIN_PROCESS_TABLE`): the row "… json naming a live foreign pid writes no proof"
   goes **red**, and so does the static "process-session.ts reads no process.env" row. Confirm the row's premises really
   hold: the foreign pid is alive, its start time is readable, and the hook's ppid is the test process.
4. **#434's deleted-room row can fail.** Restore r1's top-level `room` fallback verbatim (reverse of `b9f8a5df`): the
   deleted-key, null and number rows go **red**. A narrower mutant (r1's expression only, r2's message kept) is also
   red. The green control row is green on master source.
5. **Siblings.** Scout covered `room: ""` through the new empty/whitespace/null/number rows. It did not
   mutation-prove two `mutant:` rows in `cursor-proof` (lines about 98 and 160). Try QA 279's mutants for those two
   rows and report red or green.

## #466: T-025, the experience-frontmatter check (read `docs/loops/t025-ruling.md`, section Follow-up, and T-025's note)

6. **The ruling's five behaviours**, each with its test: (R1) the check reports how many notes it walked, and a test
   asserts the count; (R2) a note with no `type` passes; (R3) one free token passes; (R4) an empty `type`, or two
   tokens, is an issue; (R5) a mutant that requires the old closed list (`gotcha | pattern | decision | fix |
   optimization`) goes **red** on a free label. Run R5's mutant yourself.
7. **Fails closed.** An unreadable note or Experiences folder is reported as a refusal, never as a clean pass. A
   known positive (a two-token `type` fixture) is caught. The check's output states its limits.
8. **The parseFrontmatter move preserves behaviour.** `vault-writer.ts` lost 40 lines to `shared/parse-frontmatter.ts`.
   Compare old and new on a fixture set that includes CRLF, BOM, no frontmatter, empty frontmatter, a value with a
   colon, and a list value: identical output. Run the existing vault-writer tests at the head, one file per run. No
   test writes to a real vault: grep the new test for `obsidianVaultDir` and any path under the home directory.
9. **On a real tree.** Run `node open-brain/build/cli.js sync --check` (after a build) in your PR worktree and quote the
   experience-frontmatter line. If your machine has no vault, say what the check reports for an absent vault (it must
   be a skip or refusal with a reason, not a pass).

## Rules (headless Claude Code)

- You are **QA 282**, prefix `s162c`. Push ONLY `qa/s162c-*` branches, and only through
  `node docs/loops/qa-282/push-qa.mjs <branch>`, run from your `qa282-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- Never read the real knowledge DB or a real vault for anything other than counts, names and paths (G-051).
- Commit `docs/loops/s162c-qa-report.md` on `qa/s162c-report`.
- One verdict per PR with its pinned head. The report's last line is exactly `QA-282: REPORT COMPLETE`.
