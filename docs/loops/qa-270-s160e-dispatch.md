# QA 270, session-160 batch e: #412 (T-238), #413 (T-239)

**By:** Atlas (planner), 2026-10-03, record session 160, under Aaron's standing "get all available agents working".

**Merge authority:** none pre-approved. An ACCEPT waits for one batch approval from Aaron naming both PRs and SHAs.

**QA runs on Opus** (both were built by Claude Code Sonnet seats). **Job class: LIGHT:** touched test files, **one test
file per vitest invocation**, mutants on touched files only, `tsc --noEmit`, `npm run typecheck:tests`, and `gh` reads.
No full suite, no live Jev call, and nothing run against the real home directory or a live `.agents/state.json`.

**Master at dispatch:** `be913275` (#397, #401, #402 and #403 merged after QA 269). Under D-117, master requires
up-to-date branches, so at merge time each head may gain a merge of master; the planner range-diffs it.

**Pinned heads:**

| PR | Task | Head | CI |
|---|---|---|---|
| #412 | T-238: KEY_ORDER guard (a derived test plus a refusal on write) | `f918de5844a89d38f03d4d4e23173e4540c9f814` | 37169473529 |
| #413 | T-239: "your handoff" picked by seat AND checkout (flag `handoff_by_checkout`) | `e00c0d5aae7ad902a589d09b60a672d0700ae78c` | 37169676054 |

Briefs: each task's note in `.agents/state.json` (T-238, T-239), each PR body, and
`docs/loops/t238-developer-handoff.md` / `docs/loops/t239-developer-handoff.md`.

## Rows for both PRs

1. **Confined.** List the files beyond `origin/master`. The planner counts 3 for #412 and 10 for #413. Flag anything
   outside the task.
2. **Red then green.** Run the new test files against master's source (they should fail) and against the head (they
   should pass), and quote the counts. #412's file fails to load at base (its function is missing), so its behaviour is
   pinned by the mutants. Say so, and do not count it as red.
3. **Mutants.** Re-run two of the developer's mutants named in the PR body, and write one of your own. Each must turn a
   row red. Run `tsc --noEmit` on every mutant and confirm the edit landed.
4. **CI (read only).** Run `gh pr checks <n>` and record the `test` result and run id.

## #412 (T-238)

5. **The walker is derived, not a list.** Show that `schemaObjectSlots()` finds every slot in `StateSchema`. Add a
   nested object to a schema in a scratch copy and confirm the walker finds it. Confirm it THROWS on a zod type it cannot
   see (try `z.record`).
6. **The refusal on write.** In a scratch record, delete a key from `KEY_ORDER` and call `ob_state` (or
   `serializeState`): the write must refuse with "KEY_ORDER and StateSchema disagree" and leave the file byte-identical.
   This is the developer's "refusal removed alone" mutant: confirm it dies.
7. **No regression on a real-shaped record.** Serialize a copy of master's `.agents/state.json` (copied to scratch) at
   the head. It must succeed and come out byte-identical to master's serializer. Say what the refusal costs per write
   (time it over 100 writes).

## #413 (T-239)

8. **Flag OFF is byte-identical.** With `handoff_by_checkout` absent or false, the output must match master on SIA's
   fixture AND on the A2A fixture `a2a-state-1c200b41.json`, where a2a-qa is still briefed from `qa@a2a-planner#19`
   (Relay's ruling: A2A keeps the flag off).
9. **Flag ON.** The planner's rulings: a checkout with no handoff of its own prints `none recorded for this checkout
   (<seat>, <checkout>)`, never a sibling's; a legacy null-checkout entry is never "yours" and is listed as
   `[legacy, unattributed]`; a newer sibling never displaces your own.
10. **One derivation.** The writer and reader both use `checkoutOf`. The developer notes that master's
    `checkMissingHandoff` (from T-199) still derives the checkout inline. Report whether the two can disagree on any
    real path (case, trailing slash, symlink), as a finding, not a fix.
11. **The three-way PICK UP.** All flags on: FOCUS on the header, your OWN pick-up in the body, #402's notice appended,
    and SEATS above. The new worst-case row: at most 30 lines and 4,096 characters (the developer measured 30 and 3,834).
    The notice must be exactly `MISSING_HANDOFF_MAX_CHARS` long, read from the product constant.

## Batch merge row

12. In `~/qa-scratch/qa270-merge`, start from `be913275` and merge #412 then #413. **Both edit
    `open-brain/src/shared/state-schema.ts`** (#412: KEY_ORDER export and the walker; #413: `checkoutOf` and
    `ownHandoff`). Name any conflict and its resolution. Then run `tsc --noEmit` and `npm run typecheck:tests`, and these
    test files one per run: `state-keyorder`, `state-writer`, `state-schema`, `handoff-by-checkout`, `briefing`,
    `briefing-budget`, `missing-handoff`, `focus`, `server` and `a2a-byte-identical`. Check `node --check` on the built
    `server.js`, and scan `src` for duplicate imports.

## Rules (headless Claude Code)

- You are **QA 270**, prefix `s160e`. Push ONLY `qa/s160e-*` branches, and only through
  `node docs/loops/qa-270/push-qa.mjs <branch>`, run from your `qa270-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- From real config and key files report only counts, names and paths, never values (G-051).
- Commit `docs/loops/s160e-qa-report.md` and its `.E_t.json` on `qa/s160e-report`.
- Give one verdict per PR with its pinned SHA. The report's last line is exactly `QA-270: REPORT COMPLETE`.
