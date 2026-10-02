# B2 round 2 developer handoff (Forge, 2026-10-02)

Dispatch: atlas-sia, after QA 256 (`docs/loops/b2-sync-qa-report.md`, row 5). Ruling: ANY input that was not checked caps the
result at WARN, never pass, even when the message names the skip. Single test file per vitest run; `tsc --noEmit` 0 on every head.

| PR | branch | head | change |
| --- | --- | --- | --- |
| #295 T-008 | `loop/t008-mcp-paths` | `7312a292` | a `${...}` command, a non-string command, or no command and no url beside a good server is WARN `not checked` (url servers stay a named skip: no command to stat). 23 tests there. |
| #298 T-008b | `loop/t008b-mcp-sources` | `7afd7f1b` | stacked on #295. An unparseable `~/.claude/settings.json` is `not checked: ...: settings unreadable, plugins not examined` (WARN); an ABSENT one enables nothing and stays quiet. A garbled `plugin.json` beside a good root `.mcp.json` is recorded as not checked (an ABSENT manifest is not). QA's G and J are rows. 27 tests. |
| #306 T-048 | `loop/t048-sync-counts` | `3f30e825` | vault-path-refs with `unreadable > 0` is WARN (only-unreadable stays SKIP). hook-configs on an unparseable settings.json returns an ISSUE `settings.json is not valid JSON` instead of throwing (BOM stripped first). 10 tests in `t048-counts.test.ts`. |
| #309 T-048 | `loop/t048-hook-configs-nested` | this head | rebased onto #306's new head; one conflict in `checkHookConfigs`, resolved by keeping the parse guard above #309's matcher-group descent. 17 tests in `t048-counts.test.ts`. |

Each head's `test` job is green. Red-first: every new row run against the previous `checks.ts` failed (#295 4, #298 2, #306 2). Mutants
(each `tsc` 0, reverted; diffs in `docs/loops/t008/`, `t008b/`, `t048/mutants/`): not-checked-passes (3 red), settings-silent (1), manifest-dropped (1),
vault-unreadable-passes (1), settings-throws (1). Two #298 mutants first failed `tsc` (type narrowing) and were rewritten before counting.

Rebasing #298 onto #295's new head conflicted in `checkMcpCommandPaths`; the two sides had both introduced a `notChecked` array. They are one array now,
so a skipped server and an unread source both feed the same WARN, with #298's wording (`not checked: ...`); #295's tests were reworded to match.

Not done: hook-configs still passes with skipped entries of other kinds (entries with no command string, non-node commands); those are named in the count, as #306 designed, and the dispatch
did not rule on them. QA's note on `d.startsWith(home)` with a forward-slash USERPROFILE is untouched.
