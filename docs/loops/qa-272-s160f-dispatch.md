# QA 272, session-160 batch f: #415, #420, #421, plus a retro-check of the merged #418

**By:** Atlas (planner), 2026-10-04, record session 160, under Aaron's "Go ahead and run all devs now" (relayed by
clark, about 00:0x CDT).

**Merge authority:** none pre-approved for #415, #420 or #421. An ACCEPT waits for one batch approval from Aaron.
**#418 is already merged:** Aaron chose "Merge now" on the planner's review, because it blocked every Cursor seat.
Row 12 is its after-the-fact QA. A finding there is fixed forward, never reverted.

**QA runs on Opus** (the PRs were built by Claude Code Sonnet and Cursor Composer 2.5). **LIGHT:** touched test files,
one test file per vitest invocation, mutants on touched files only, `tsc --noEmit`, `npm run typecheck:tests`, and `gh`
reads. No full suite, and nothing against the real home directory or a live record. **Set `npm_config_cache` under your
tmp folder** (QA 270 used the default cache).

**Master at dispatch:** the DISPATCH_SHA on the prompt's first line (it contains #418 and #419). Under D-117 each head
is BEHIND; QA the pinned SHAs.

**Pinned heads:**

| PR | Task | Head | Built by |
|---|---|---|---|
| #415 | T-239 follow-up: QA 270's surviving wiring mutant; checkMissingHandoff on checkoutOf | `dc092840af38f86dfe18af060564fe181988f159` | sia-infra (CC) |
| #420 | T-200: a stale tree's /start is briefed from master's record (a port of `loop/t200-record-from-master` @ 424065c) | `0d2bc66e94ebed4ca7008395eede8426f43e055c` | forge (Cursor) |
| #421 | G-053: the config-channel flake (`git gc --auto` writing info/refs) | `82aeb3da3e9036d5f6812738be541cb67ada1e07` | cursor-infra (Cursor) |

## Rows for every PR

1. **Confined.** List the files beyond `origin/master`. Flag any file outside the task.
2. **Red then green.** Run the new or changed test files against master's source (they should fail) and against the
   head (they should pass), and quote the counts.
3. **Mutants.** Re-run one of the developer's mutants and write one of your own. Run `tsc --noEmit` on each, and
   confirm the edit landed.
4. **CI (read only).** Record the `test` result and run id.

## #415

5. **The two mutants named in the PR body** (renderBriefing and renderState dropping `ownCheckout`) must die. Also,
   `checkMissingHandoff` and the writer derive the same checkout for plain, `/`, `//`, `/.` and `sub/..` paths, plus
   one Windows-style path.

## #420 (T-200)

6. **Port fidelity.** Diff the cherry-picks against `92f9cc0f..424065c`. List every adaptation; the developer names
   server.ts, record-source rebinding `sj` before renderBriefing, and the RM-1b budget row.
7. **The behaviour.** A scratch tree whose record revision is behind origin/master's must be briefed from MASTER's
   record, in BOTH layouts (budgeted and legacy), and must say so. A tree that is current or ahead is briefed from its
   own record. Unreadable master content fails closed and visibly. Check whether any path touches the network: the
   brief must read the already-fetched `origin/master`, never fetch.
8. **The A2A golden** (`a2a-byte-identical.test.ts`) still passes.

## #421 (G-053)

9. **The cause, reproduced.** The new row makes `git update-server-info` (or forced gc) create `info/refs` during the
   developer stage, and shows the loop failing that way at base.
10. **SECURITY BOUNDARY.** The fix adds `gc.auto` = exactly `0` to `SAFE_LOCAL_KEYS` in `src/harness/configwatch.ts`.
    Confirm all of these:
    - the value regex is anchored (`gc.auto=1`, `00`, ` 0` and `0x` are all refused);
    - no other gc key (`gc.autoDetach`, `gc.*`) is admitted;
    - `info/` is still in the watched set;
    - nothing else in the allowlist changed.
    Argue whether disabling gc can make git run any program. A key that runs a program must never be admitted.
11. **No flake.** Run `config-channel.test.ts` 5 times in a row at the head; all must pass. Report each count.

## #418 retro-check (already merged)

12. In master's `.agents/SYSTEM/hub-partner-seats.json`, confirm:
    - infra = `cursor-infra` / `k57d92gqtjm9wpfs74ekbx9rns8fmy2f`;
    - builder = `cursor-builder` / `k575sfwr9wcx3r8fw83g3bc00x8fmar3`;
    - forge = `forge` / `k571z4ghp7nbp34djhecwnsk3n8fmhsf`;
    - the atlas reader pairs match these rooms in both directions;
    - "grok" and the three old room ids appear nowhere in the file.
    Run `seat-map`, `hub-presence`, `hub-seats` and `focus` one file per run. Report any finding as a fix-forward
    item.

## Batch merge row

13. In `~/qa-scratch/qa272-merge`, start from the DISPATCH_SHA and merge #415, #421 and #420 in that order. Name any
    conflict. #415 and #420 both touch `server.ts` and session-start code. Then run `tsc --noEmit`,
    `npm run typecheck:tests`, and these files one per run: `handoff-by-checkout`, `missing-handoff`, `record-source`,
    `briefing-budget`, `greeting-size`, `server`, `config-channel` and `a2a-byte-identical`. Also run `node --check` on
    the built `server.js` and a duplicate-import scan.

## Rules (headless Claude Code)

- You are **QA 272**, prefix `s160f`. Push ONLY `qa/s160f-*` branches, and only through
  `node docs/loops/qa-272/push-qa.mjs <branch>`, run from your `qa272-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- From real config and key files report only counts, names and paths, never values (G-051).
- Commit `docs/loops/s160f-qa-report.md` and its `.E_t.json` on `qa/s160f-report`.
- Give one verdict per PR with its pinned SHA, plus the #418 retro-check result. The report's last line is exactly
  `QA-272: REPORT COMPLETE`.
