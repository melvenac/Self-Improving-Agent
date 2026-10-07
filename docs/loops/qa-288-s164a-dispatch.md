# QA 288, session-164 batch a: #472 r5 (hub-room guard) and #484 r9 (AUDIT-FIX A1/A3/A6 + scrub-trigger-fires)

**By:** Atlas (planner), 2026-10-07, record session 164. **Machine:** the laptop (Windows), booked through clark.
**Authority:** Aaron in clark's window, ~07:4x CDT, relayed by clark (TOLD): *"QA #472 + #484, then I decide merges."*
This is the last SIA QA before the freeze (stop point: Makerspace migration proven, `docs/loops/makerspace-import-brief.md`).
#437, #425 and Jev cal 2 are parked, so **do not touch them.**

**Read first:** QA 284's report, `origin/qa/s163a-report`, the #472 section (rows 10–14 and the findings table, K1–K4).
**Do not read** any grok room, `docs/loops/grok-*` file or the grok-qa-sia first-pass until your report is pushed (D-125).

**Merge authority:** both PRs change `open-brain/src`, so each merge is Aaron's word on your ACCEPT.

**Narrow, not light-free:** run one test file per vitest invocation, mutants on touched files only, `tsc --noEmit`,
`npm run typecheck:tests`, and `gh` reads. **No full suite.** This run is on Windows, so the Windows rows below are the
point: CI's `test-windows` was **skipped** on both heads.

**Pinned heads (CI `test` green on each, read by the planner):**

| PR | Task | Previous QA'd head | New head | CI run | Built by |
|---|---|---|---|---|---|
| #472 | HUBROOM-GUARD r5 | `26edb821cac073172ad8788ac99128fa3fad4bde` (QA 284 REJECT narrow: K1–K4) | `1a37410105d706803805ddd05572327676fa0470` | 37501631053 | cursor-infra |
| #484 | AUDIT-FIX r9 | none (first Opus QA) | `edfc964d98b96c8bc3e73c65f122e0bd5a04ce49` | 37553637298 | cursor-builder |

## Every PR

1. **Confined.** #472: `git diff origin/master...1a374101` touches only `src/pipelines/sync/hub-room-guard.ts` and
   `hub-talk-exit-codes.test.ts`. #484: list every file in `git diff --stat origin/master...edfc964d` (28 files at
   dispatch). Flag any file whose change is not explained by A1, A3, A6 or the scrub command.
2. **CI.** The `test` result and run id for each head; say that `test-windows` was skipped.
3. **Batch merge.** In `qa288-merge`, merge both heads onto `<DISPATCH_SHA>` (no conflicts expected: the planner's
   `git merge-tree` of the two was clean). Run `tsc --noEmit`, `typecheck:tests` and every test file either PR touches
   there, one file per run.

## #472 r5: QA 284's K1–K4, plus the negation scope

4. **K1 (was blocking).** Delete the cross-sentence check **in the source** and name the test that goes red. Do the same
   for each of the six checks (the `--wait` count, the seat-file `wait`, the hub-verb in-turn check, the atlas/next-turn
   pattern, the cross-sentence check, the negation scope). Every check needs a positive that only it catches. A check
   whose deletion leaves the suite green is a REJECT.
5. **Negation scope.** Widen the negation from clause to sentence in the source (a sentence-wide `never`/`does not`
   suppresses a forbidden act in another clause). Name the test that goes red. If none does, that is a finding.
6. **K2.** Re-plant QA 283's Own-1 to Own-3, QA 283's split example, the planner's S1–S5, and **all five of QA 284's
   rewordings**. Then write **three new ones** that a seat would obey. Report each as caught or missed. A miss among
   QA 284's five is a finding, and its severity is your call.
7. **K3, no false alarms.** "Never wait for atlas inside a turn." and S6 ("Don't wait on hub-talk after you post.")
   must not fire. Both tracked copies (`hub-room.mdc` and `start.md`'s Hub-room section) stay green, along with the
   exit-2 sentence, the exit-3 retry text, "If hub-talk is throttled, wait 5 seconds and retry." and
   "Never block on hub-talk waiting …".
8. **K4.** A nested per-seat `wait` key in `hub-partner-seats.json` is caught, or the report says it is a documented
   limit with the test that pins it.
9. **Windows: CRLF.** Convert a copy of `hub-room.mdc` and the `start.md` section to CRLF, then re-run rows 6 and 7
   against them. Results must be identical to LF.

## #484 r9: first Opus QA

10. **A3, vault path segments.** Call the segment guard and the vault writer with: `..`, `../x`, `a/../../b`, an
    absolute path, `C:\x`, `C:x`, a UNC path `\\host\share`, a backslash `a\..\..\b`, a trailing dot or space
    (`x.`, `x `), a reserved device name (`CON`, `nul`), and Unicode look-alikes for `.` and `/`. **Every result must
    be refused or kept under the vault dir.** Check the real written path, not only the return value, in a temp vault.
11. **A3, frontmatter.** Store a chunk whose title or tags contain a newline, `: `, `---`, quotes, `#` and a YAML
    anchor/alias (`&a`, `*a`). Read it back through `parse-frontmatter.ts`. The parse must return exactly the input, with no
    injected key.
12. **A6, own key.** `resolveOwnKey` with `../x`, `..\x`, an absolute path, `C:\...`, a name with `/` or `\`, and an
    empty name: each is refused, and no read happens outside `keyDir`. If you can make a directory junction in the temp
    `keyDir` without elevation, try a junction pointing out of it. If you can't, say so.
13. **A1, command logs.** A trigger fire whose command carries a token (`ghp_…`, `sk-…`, `AGENT_KEY=…`,
    `Authorization: Bearer …`, a URL with `user:pass@`) and a command over the length cap. The stored
    `trigger_fires.command` and the hook `recall_log.query` must be redacted and truncated as the PR claims. **Grep
    every table the hook writes in the temp DB for the raw secret: 0 hits.**
14. **Scrub command, on a temp DB only (G-051).** Build a temp DB with pre-fix raw rows. Then run `scrub-trigger-fires`:
    (a) rows are redacted, and the row count and ids are unchanged; (b) a second run is a no-op; (c) the command's
    behaviour while another connection holds the DB (Windows file locking) is a clear refusal or a wait, never a partial
    write; (d) a DB without the table is a named skip, not a crash. **Never point it at `~/.claude/open-brain/`.**
15. **Mutants.** For each, name the test that goes red: (a) the segment guard accepts `..`; (b) the under-dir check is
    removed; (c) YAML escaping is removed; (d) `resolveOwnKey`'s confinement is removed; (e) redaction is skipped for
    `trigger_fires`; (f) the scrub skips the rewrite but reports success.
16. **Callers.** `vault-writer.ts`, `server.ts`, `topics/index.ts` and `session-end/index-v2.ts` changed, so run their
    existing test files (one per run) at the head and on master. Any new failure is a regression.

## Rules (headless Claude Code)

- You are **QA 288**, prefix `s164a`. Push ONLY `qa/s164a-*` branches, and only through
  `node docs/loops/qa-288/push-qa.mjs <branch>`, run from your `qa288-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- Never read the real knowledge DB or a real vault for anything other than counts, names and paths (G-051). Make no
  live Jev call. Never print a key.
- Commit `docs/loops/s164a-qa-report.md` on `qa/s164a-report`.
- One verdict per PR with its pinned head. The report's last line is exactly `QA-288: REPORT COMPLETE`.
