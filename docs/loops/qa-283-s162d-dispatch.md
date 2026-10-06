# QA 283, session-162 batch d: #466 r2 (T-025 frontmatter check) and #468 (hub-room guard)

**By:** Atlas (planner), 2026-10-06, record session 162.

**Read first:** QA 282's report, `origin/qa/s162c-report` @ `5d0cbbd9`, section on #466; and QA 281's report,
`origin/qa/s162b-report` @ `ae2baca7`, row 9 and finding G1 (the reworded-wait guard).

**Merge authority:** both PRs change `open-brain/src`, so each merge is Aaron's word.

**LIGHT:** one test file per vitest invocation, mutants on touched files only, `tsc --noEmit`,
`npm run typecheck:tests`, `gh` reads. No full suite. No Windows rows.

**Pinned heads (CI `test` green on each, read by the planner):**

| PR | Task | Previous QA'd head | New head | Built by |
|---|---|---|---|---|
| #466 | T-025 r2 | `bc9c22b26ef48fe7fd4a8520f3f0329275fb192d` (QA 282 REJECT) | `b4ad38a3573e923b10c4e89d1fc023c710cc0d5a` | cursor-builder |
| #468 | HUBROOM-GUARD | none | `004500e62784e3228b5f8fb2f4aef371c5e8843a` | cursor-infra |

## Every PR

1. **Confined.** #466: `git diff bc9c22b2 b4ad38a3` touches only the frontmatter check, the shared parser, the
   vault-writer test and the check's test. #468: `git diff origin/master...004500e6` touches only
   `pipelines/sync/hub-room-guard.ts`, `hub-talk-exit-codes.test.ts` and one line of `hub-partner-seats.json`.
2. **CI.** The `test` result and run id for each head.

## #466 r2 (QA 282 row 7 and its notes)

3. **Fails closed (F1).** Run each yourself: an `Experiences/` folder that exists but cannot be stat'd (EACCES or
   EPERM) is a **refusal**; a folder that stats but cannot be listed is a refusal; one unreadable note is a refusal;
   an absent vault or folder (ENOENT) is a **skip** with its reason; a readable, empty folder passes with `Walked 0`.
   Mutant: put r1's `existsSync` back: the EACCES row goes **red**.
4. **QA 282's notes.** A number or list `type` is an issue (mutant: accept any value → red). A BOM-prefixed note's
   `type` is read (mutant: drop the BOM strip → red).
5. **The deliberate vault-writer change.** With the shared parser, a BOM-prefixed note's frontmatter is now read by
   vault-writer, where before it was not. Confirm the PR says so, that the new vault-writer test covers it, and that
   no other parser output changed: repeat QA 282 row 8's fixture comparison (CRLF, no frontmatter, empty frontmatter,
   a value with a colon, a list value) between master's parser and the head's. Every output identical except BOM.
6. **R1 to R5 still hold** (QA 282 row 6), including R5's closed-list mutant red.

## #468 HUBROOM-GUARD (QA 281 G1 and G2)

7. **The rewordings are caught.** In both `hub-room.mdc` copies and `start.md`'s Hub-room section, each of QA 281's
   rewordings and the four in the PR's table turns the guard **red**. Then write **three new rewordings of your own**
   that a seat would obey (for example "listen on the room until atlas answers", "block on hub-talk for the next
   message", "keep polling the room before ending"), and report which the guard catches. A miss is a finding, not an
   automatic reject: rule on whether the guard is materially better than #457's.
8. **No false alarms.** The tracked files as they are, the exit-2 sentence ("Exit 2 comes only from --wait …"), the
   exit-3 retry text, and "Never block on hub-talk waiting …" all stay **green**. Mutant: remove the allowlist entry
   for the exit-2 sentence → red on the real files.
9. **G2, the `wait` key.** Confirm by your own grep over `open-brain/src`, `scripts/`, `.cursor/` and
   `project-template/` that nothing reads a top-level `wait` in `hub-partner-seats.json`, so removing it is safe.
   `/sync`'s hub-seats check still passes at the head.

## Rules (headless Claude Code)

- You are **QA 283**, prefix `s162d`. Push ONLY `qa/s162d-*` branches, and only through
  `node docs/loops/qa-283/push-qa.mjs <branch>`, run from your `qa283-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- Never read the real knowledge DB or a real vault for anything other than counts, names and paths (G-051).
- Commit `docs/loops/s162d-qa-report.md` on `qa/s162d-report`.
- One verdict per PR with its pinned head. The report's last line is exactly `QA-283: REPORT COMPLETE`.
