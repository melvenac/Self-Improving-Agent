# QA 257, batch B3: records, typecheck and small fixes (#301, #305, #308, #313, #314)

**By:** Atlas (planner), 2026-10-02, record session 157, under Aaron's batch-QA rule.

**QA runs on Opus. Job class: LIGHT.** Touched test files, **one test file per vitest invocation**, mutants on touched
files only, `gh` reads, and no full suite. **Make no live Jev call.**

**Pinned heads:**

| PR | task | head | dev handoff |
|---|---|---|---|
| #301 | T-163: regression test that a close-out appends (the erasure check already exists) | `11c183e478e513dc4e026d8ea47b19de37e47515` | `docs/loops/t163-developer-handoff.md` |
| #305 | T-152: `tsconfig.tests.json` plus `typecheck:tests`; 36 of 40 errors fixed, 4 wait for #294 | `84e756180e400cccba92e4d66ddbcf12ed15ec0c` | `docs/loops/t152-developer-handoff.md` |
| #308 | T-186: `applySummaryRegion` with a leading BOM (**impact HIGH: every `ob_state` write**) | `65eb9e947cff92cf0e03fc8ba2d42e20bc6043a6` | `docs/loops/t186-developer-handoff.md` |
| #313 | T-065: drop the retired v1 `knowledgeDb` path | `1c865761d7feb33cd95dc449c4e57742b1c38bd9` | `docs/loops/t065-developer-handoff.md` |
| #314 | T-042: `/sync` vault-pollution check (`ob-server-*`) | `b20d99a46269739fcac4d6b8a0ea31eb89bbec43` | `docs/loops/t042-developer-handoff.md` |

All five are based on master.

## Rows for each PR

1. **Confined.** List the files each PR's own commits touch beyond master.
2. **Red then green.** Quote the counts.
3. **One mutant of your own**, plus one of the developer's.
4. **CI on the head (read only).** `gh pr checks <n>`.

## Rows specific to B3

5. **#301.** Its fixture runs the REAL writer:
   - seat B's close-out cannot remove seat A's handoff or session;
   - the seat-keyed mutant goes red.
   - Run the `record-erasure` check on a scratch copy of this repo and quote its line.
6. **#305, test-only.**
   - `npm run typecheck:tests` reports exactly 4 errors, all category B, at the files the handoff names.
   - `git diff master...84e75618 -- open-brain/src` is empty.
   - Pick 5 of the 18 changed test files and confirm each change is type-only, with no assertion weakened. Quote
     each.
   - `policies.test.ts` still has a `hasPriorFailures: true` case.
7. **#308, HIGH impact.** On a scratch copy of the repo, run `ob_state` render-only (an empty ops list with
   `render: true`, via the CLI if the MCP is unavailable) against a `SUMMARY.md` that has:
   - (a) no BOM: the output is byte-identical to master's;
   - (b) a BOM and markers;
   - (c) a BOM and no markers: the region lands after the title, and the BOM stays first.

   Quote `od -c | head -2` for each.
8. **#313.** `git grep -n knowledgeDb` over `open-brain/src`, `open-brain/tests`, `open-brain/scripts`, `scripts/` and
   `.claude/` is empty (fixtures-import excluded). Quote it.
9. **#314.**
   - Seed a temp vault with `ob-server-x.md`: the check warns with the count and path.
   - A clean vault passes.
   - An absent vault is "not checked".
   - It resolves through `obsidianVaultDir()` (v2), not the retired v1 vault. Show the call.
10. **Batch merge order.** On a scratch branch from `origin/master`, merge in this order: #308, #301, #313, #314, #305.
    - Report every conflict, and stop on one.
    - On the merged result, run the touched test files one per invocation, `tsc --noEmit` and `typecheck:tests` (still
      4).

## Rules (headless Claude Code)

- You are **QA 257**, and your prefix is `b3-misc`. Push ONLY `qa/b3-misc-*`, and only through
  `node docs/loops/qa-257/push-qa.mjs <branch>`, run from `~/qa-scratch/qa257-wt`.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- Commit `docs/loops/b3-misc-qa-report.md` with its `.E_t.json` on `qa/b3-misc-report`.
- Give one verdict line per PR and a batch verdict. The last line is exactly `QA-257: REPORT COMPLETE`.
