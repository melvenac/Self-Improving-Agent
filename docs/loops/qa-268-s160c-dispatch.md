# QA 268, session-160 batch c: #393 r2 (narrow), #397

**By:** Atlas (planner), 2026-10-03, record session 160. Aaron's standing instruction, given through clark at about
17:4x CDT: "Let's get all available agents working."

**Merge authority:** none pre-approved. An ACCEPT waits for one batch approval from Aaron naming both PRs and SHAs.

**QA runs on Opus** (both PRs were built by Claude Code Sonnet seats). **Job class: LIGHT:** touched test files, **one
test file per vitest invocation**, mutants on touched files only, `tsc --noEmit`, `npm run typecheck:tests`, and `gh`
reads. No full suite, no live Jev call, and nothing run against the real home directory.

**Master at dispatch:** `f8345f1b` (#387, #388 and #391 merged after QA 267).

**Pinned heads:**

| PR | Task | Head | Scope note |
|---|---|---|---|
| #393 | T-236 slice 2, **round 2, narrow re-QA** | `6f145faf9d1bba962d281e16285fcb59b14b68c7` | QA 267 rejected r1 (`4020a42b`) on the batch-merge row only: a duplicate `greetingFlag` import. |
| #397 | T-237: hub presence accepts `pollAgeMs: null` | `3e95016c92844b67113ae44f9d9c7ed362335587` | `hub-presence.ts`, its test file and `CHANGELOG.md` |

If a head has moved when you start, QA the pinned SHA and say so.

## #393 round 2 (narrow)

QA 267's report (`docs/loops/s160b-qa-report.md` on `qa/s160b-report` @ `827fc7aa`) accepted every other row of #393.
Re-run only these:

1. **Range-diff.** Run `git range-diff f5512b6a~1..4020a42b origin/master..6f145faf`. The planner saw all three
   original commits as `=`. The only new commit is a merge of `f8345f1b`. The developer merged rather than rebasing,
   because a force push needs Aaron's word. Read that merge commit's diff in full.
2. **One import.** `grep -c "import { greetingFlag }" open-brain/src/server.ts` must be 1 at the head.
   `greeting.json` must hold the three sorted keys: `briefing_budget: true`, `handoff_caps: false`,
   `role_docs_by_sha: true`.
3. **Merged with master.** Merge `6f145faf` into `f8345f1b` in a scratch tree. Then run `tsc --noEmit` and
   `npm run typecheck:tests` (both must exit 0), and run `node --check` or an import of the built `server.js`, since
   Node refused the duplicate import. Then run these test files, one per run: `server.test.ts`,
   `role-docs-by-sha.test.ts`, `a2a-byte-identical.test.ts` and `briefing-budget.test.ts`.
4. **CI.** `gh pr checks 393`: record the `test` result and run id (the developer reports 37161339592).
5. **The class, not the line.** Any other symbol imported twice by the merged tree? Check every `src` file. Then say
   whether a CI step would have caught this. Note that `typecheck:tests` is in CI; does it cover `src`?

## #397 rows

6. **Confined.** Only `hub-presence.ts`, `hub-presence.test.ts` and `CHANGELOG.md`. A2A's field names are unchanged.
7. **Red then green.** Run the new rows against master's `hub-presence.ts` and against the head, and quote the counts.
   Row 1: `null` is accepted and the other rooms render. Row 2: `unread > 0` with a `null` or absent age never prints
   `since`. Row 3: a string, a boolean or `Infinity` is still malformed.
8. **Mutants.** Re-run the developer's M1 (null maps to 0) and write one of your own. Each must turn a row red.
9. **Wording.** The new line reads `listener not polling, N unread, no listener poll recorded`. Confirm that it
   breaks no existing wording row in `hub-presence.test.ts` (the developer reports that the word "seen" is forbidden
   in partner lines).
10. **CI.** `gh pr checks 397`: record the `test` result and run id.

## Batch merge row

11. In `~/qa-scratch/qa268-merge`, start from `f8345f1b`, merge `6f145faf` and then `3e95016c`, and run `tsc --noEmit`,
    `npm run typecheck:tests`, `hub-presence.test.ts` and `server.test.ts`. Name any conflict, for example in
    `CHANGELOG.md`.

## Rules (headless Claude Code)

- You are **QA 268**, prefix `s160c`. Push ONLY `qa/s160c-*` branches, and only through
  `node docs/loops/qa-268/push-qa.mjs <branch>`, run from your `qa268-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- From real config and key files report only counts, names and paths, never values (G-051).
- Commit `docs/loops/s160c-qa-report.md` and its `.E_t.json` on `qa/s160c-report`.
- Give one verdict per PR with its pinned SHA. The report's last line is exactly `QA-268: REPORT COMPLETE`.
