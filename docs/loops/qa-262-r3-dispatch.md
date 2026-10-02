# QA 262: #295 and #298 round 3, the narrow re-check (T-008, T-008b)

**By:** Atlas (planner), 2026-10-02, record session 157.

**What this re-checks:** QA 260's two REJECTs, recorded in `docs/loops/b2r2-sync-qa-report.md` (report `0f53d867`), and
the D-106 ruling. That ruling says two things:

- A non-object or null entry is malformed input in every source. It is "not checked", and the result is WARN.
- An absent `settings.json` stays PASS, but the message must name the skip.

**Merge authority:** this re-check is NOT under Aaron's overnight pre-approval. An ACCEPT here waits for his word.

**Job class: LIGHT.** QA runs on Opus. Run touched test files only, **one test file per vitest invocation**. Mutants go
on touched files only. `gh` is read-only. No full suite, and **make no live Jev call**.

**Pinned heads.** Both PRs are rebased on master at `a30fa359`.

| PR | task | head | base |
|---|---|---|---|
| #295 | T-008 | `931998db3b5736cfb157e654669c58727dfb865f` | master |
| #298 | T-008b | `3b485b7c6e9168282d05f8ac3751c5a96951d604` | #295 |

## Rows

1. **QA 260's failing fixtures.**
   - **#295:** a `null` entry beside a good one, a string entry beside a good one, and a number entry beside a good one.
     Each gives WARN and names the key.
   - **#298:** an absent `~/.claude/settings.json` gives PASS, and the message ends with
     `Skipped: settings.json absent: no plugins enabled, none examined.`
   - **#298:** a present `settings.json` does not carry that note.
2. **Everything QA 260 accepted still holds.** Re-run QA 260 row 1 (the mixed `${...}` and non-string fixtures, G, G'
   and J) and row 2 (a url server named, and `{}` settings giving pass) on these heads. Any change is a finding.
3. **Red then green.** The previous heads are `7312a292` (#295) and `7afd7f1b` (#298).
   - The new rows fail against each previous head's `checks.ts`.
   - The new rows pass on the new heads.
4. **One mutant of your own on each PR**, plus the developer's (`docs/loops/t008/mutants/nonobject-dropped.diff`,
   `docs/loops/t008b/mutants/absent-unnamed.diff`).
5. **Rebase integrity.** `git range-diff` from each previous head to its new head. Every change must be either round 3's
   new commit or rebase context. Name anything else.
6. **CI on each head (read only).** `gh pr checks 295` and `gh pr checks 298`.
7. **Real config, read-only.** Run `mcp-command-paths` on this machine and quote its result line. Report counts, names
   and paths only.
8. **Merge order.**
   - On a scratch branch from `origin/master`, merge #295, then #298.
   - Then merge #306 at `3f30e825` and #309 at `f1c2a338`, both QA 260 ACCEPTs, because they share `checks.ts`.
   - Resolve only the `node:path` import union, and say so.
   - Run each touched sync test file, one per invocation, and `tsc --noEmit`.

## Rules (headless Claude Code)

- **Identity:** you are **QA 262**, and your prefix is `t008r3`.
- **Pushing:** push ONLY `qa/t008r3-*` branches, and only through `node docs/loops/qa-262/push-qa.mjs <branch>`, run from
  your `qa262-wt` tree.
- **PRs and issues:** never create, comment on or edit an issue or a PR. Use `gh` only to read.
- **Real config files:** report counts, names and paths only. Scan for key and token patterns before every commit.
- **Report:** commit `docs/loops/t008r3-qa-report.md` and its `.E_t.json` on `qa/t008r3-report`.
- **Verdicts:** give one verdict line per PR. The last line is exactly `QA-262: REPORT COMPLETE`.
