# QA 257 report, batch B3: #301 (T-163), #305 (T-152), #308 (T-186), #313 (T-065), #314 (T-042)

**By:** QA 257 (headless Claude Code, Opus 5.5), record session 257, 2026-10-02. **Dispatch:**
`docs/loops/qa-257-b3-misc-dispatch.md`. **Dispatch tree:** `~/qa-scratch/qa257-wt` at
`507004147df01ec665ff5970257ee400534720ef` (`git -C ~/qa-scratch/qa257-wt log -1 --format=%H`); that is also
`origin/master` at the time of the run. Job class LIGHT: touched test files, one file per vitest invocation, mutants on
touched files only, `gh` reads. No full suite (CI ran it). **No live Jev call. No live `state.json`, knowledge DB, vault
or settings file was read for writing or written.** No issue or PR was created, commented on or edited. Pushed only
`qa/b3-misc-report`, through `push-qa.mjs`.

**Trees:** `qa257-pr301` `11c183e4`, `qa257-pr305` `84e75618`, `qa257-pr308` `65eb9e94`, `qa257-pr313` `1c865761`,
`qa257-pr314` `b20d99a4` (each matches `gh pr list` `headRefOid` and the dispatch pin). Bases (merge-bases with
`origin/master`): `qa257-base301/305/308` at `00552846`, `qa257-base313/314` at `5ec37cdf`. Batch: `qa257-merge`.
Every mutant was applied in a scratch tree and reverted (`git status --short` shows only the `node_modules` link).

## Verdicts

- **#301 T-163 (`11c183e4`): ACCEPT.**
- **#305 T-152 (`84e75618`): ACCEPT.**
- **#308 T-186 (`65eb9e94`): ACCEPT.**
- **#313 T-065 (`1c865761`): ACCEPT**, one non-blocking gap (row 3).
- **#314 T-042 (`b20d99a4`): ACCEPT**, one non-blocking gap (row 3).
- **Batch (merge order #308, #301, #313, #314, #305): ACCEPT.** No conflict.

## Rows 1 to 4, per PR

### Row 1. Confined: MET for all five

`git diff --stat origin/master...<head>`:

- **#301:** `docs/loops/t163-developer-handoff.md`, `docs/loops/t163/mutants/{count-not-ids,seat-keyed-slot}.diff`,
  `open-brain/tests/shared/closeout-append.test.ts` (4 files, +112). One commit. No source.
- **#305:** `docs/loops/t152-developer-handoff.md`, `open-brain/package.json` (+1, the `typecheck:tests` script),
  `open-brain/tsconfig.tests.json` (new), 18 files under `open-brain/tests/` (21 files, +156 -29). Three commits.
- **#308:** `docs/loops/t186-developer-handoff.md`, `docs/loops/t186/mutants/bom-dropped-on-write.diff`,
  `open-brain/src/pipelines/state-views/index.ts` (+4), `tests/pipelines/state-views.test.ts` (+29),
  `tests/pipelines/summary-bom.test.ts` (new) (5 files, +131).
- **#313:** `docs/loops/t065-developer-handoff.md`, `open-brain/src/shared/paths.ts` (-6),
  `open-brain/tests/shared/paths.test.ts` (+3 -1) (3 files).
- **#314:** `docs/loops/t042-developer-handoff.md`, `open-brain/src/pipelines/sync/index.ts` (+3: import, comment,
  push), `open-brain/src/pipelines/sync/vault-pollution.ts` (new, 85), `tests/pipelines/sync/vault-pollution.test.ts`
  (new, 83) (4 files).

### Row 2. Red then green: MET for all five

| PR | Red (head's tests on the base tree) | Green (head) |
|---|---|---|
| #301 | Test-only, verify-first PR: the behaviour predates it, so `closeout-append.test.ts` is **1 passed** on base `00552846` as the handoff says. The red is the seat-keyed mutant (row 3): **1 failed**. | `closeout-append.test.ts` 1 passed (1) |
| #305 | `tsc -p tsconfig.tests.json` on base `00552846` with the head's `tsconfig.tests.json`: **40 errors in 21 files** (5 handoff-provenance, 4 rating-method, 4 policies, 3 each fires/t048-r1b/checks/state-render, 2 ranking, 1 each in the other 13), matching the handoff's table. | `npm run typecheck:tests`: **4 errors**, exit 2 (row 6). The 18 touched test files: 370 passed, 0 failed, 18 invocations. |
| #308 | `state-views.test.ts` **1 failed / 16 passed** (`applySummaryRegion with a leading BOM and no markers inserts after the title, and the BOM stays first`); `summary-bom.test.ts` **1 failed / 1 passed** (`a BOM'd SUMMARY.md keeps its BOM first ...`). | `state-views` 17/17, `summary-bom` 2/2, `shared/state-writer.test.ts` 46/46 |
| #313 | `paths.test.ts` **1 failed / 12 passed / 1 skipped** (`resolvePaths > resolves home-relative paths`) | 13 passed / 1 skipped (14). The skip is `it.skipIf(process.platform !== "win32")` at line 153, Windows-only. |
| #314 | `vault-pollution.test.ts` fails to load: `Cannot find module '../../../src/pipelines/sync/vault-pollution.js'`, Test Files 1 failed, no tests | `vault-pollution` 5/5; `sync/index.test.ts` 4/4 |

### Row 3. Mutants: one of mine and one of the developer's per PR

| PR | Developer's mutant | Result | QA mutant | Result |
|---|---|---|---|---|
| #301 | `docs/loops/t163/mutants/seat-keyed-slot.diff` (`set_handoff` slot keyed by `op.seat`) | **killed**: 1 failed, `expected [ [ …(2) ] ] to deep equally contain [ …(2) ]` | `state-writer.ts` sessions upsert: a new uuid overwrites the existing `sessions[]` entry with the same seat (seat-keyed `sessions[]`) | **killed**: 1 failed, `expected [ …(2) ] to deeply equal ArrayContaining{…}` (A's uuid gone) |
| #305 | No mutant diff shipped (a type-only PR). I used the inverse of the fix: one `hasPriorFailures: false` removed from `policies.test.ts:246` | **caught**: `typecheck:tests` 5 errors, the new one `policies.test.ts(244,99): error TS2345 ... not assignable to parameter of type 'PlanGateContext'` | `policies.ts:425` `&& !ctx.hasPriorFailures` dropped (prior failures ignored) | **killed**: 2 failed / 25 passed: the pre-existing F5 row "still thresholds it when there ARE prior failures" and the new row "with prior failures AND a plan that addresses them ... (hasPriorFailures: true)" |
| #308 | `docs/loops/t186/mutants/bom-dropped-on-write.diff` | **killed**: `state-views` 2 failed / 15, `summary-bom` 1 failed / 1 | BOM put back only when there are no markers (`existing.includes(SUMMARY_BEGIN) ? r : BOM + r`) | **killed**: `state-views` 2 failed (both BOM rows; the no-marker row fails on its idempotency re-apply); `summary-bom` 2/2 survives it (it only writes a no-marker file once) |
| #313 | No diff shipped; the handoff's red is the field restored, i.e. the base tree | **killed** (row 2's red) | `knowledgeV2Db` default repointed to `~/.claude/context-mode/knowledge.db` | **SURVIVED**: 13 passed. `tests/setup-env.ts:35` sets `process.env.KNOWLEDGE_V2_DB = join(stateDir, "knowledge-v2.db")`, so the new assertion `paths.knowledgeV2Db toContain("knowledge-v2.db")` reads the test override and never the default. **Gap, non-blocking:** the removal itself is pinned (red on base); the added v2 assertion is weaker than it reads. |
| #314 | The handoff's "walk does not descend into folders" (`if (ent.isDirectory()) continue;`) | **killed**: 3 failed / 2 (VP-1, VP-2, VP-4), matching the handoff | (a) any file counts, not only `.md` | **survived**, 5/5. Near-equivalent: `ARTIFACT` already requires `.md`, so only the note count can move and no row has a non-dot, non-`.md` file. |
| | | | (b) the readable-vault pre-check removed | **killed**: VP-3 failed (an absent vault would otherwise be scanned and reported `pass` with `1 directory unreadable`) |

**#314 gap, non-blocking:** every row passes `vaultDir` explicitly, so no test exercises the default `obsidianVaultDir()`
path. Row 9 below covers it by script.

### Row 4. CI on the head (read only): MET for all five

`gh pr checks <n>`: `changed` pass, `test` pass, `test-windows` skipping, in both the push and the pull_request runs.
`gh run view <id> --json headSha` confirms each run is on the pinned head:

| PR | push run | pull_request run | headSha |
|---|---|---|---|
| #301 | 36981718634 success (test 4m32s) | 36981727241 success (4m37s) | `11c183e4…` |
| #305 | 36983944706 success (4m15s) | 36983949651 success (4m12s) | `84e75618…` |
| #308 | 36984617953 success (4m9s) | 36984624995 success (4m13s) | `65eb9e94…` |
| #313 | 36985993303 success (4m12s) | 36985998243 success (4m12s) | `1c865761…` |
| #314 | 36986187135 success (4m26s) | 36986192184 success (4m5s) | `b20d99a4…` |

## Rows 5 to 10, specific to B3

### Row 5. #301: MET

- **The fixture runs the real writer:** `closeout-append.test.ts` imports `applyStateOps` from
  `src/shared/state-writer.js` and writes through it with `render: true`. A (`sia-builder`, session 200) closes out;
  B (`sia-forge`) closes out as 201 and then again claiming 200. It asserts A's handoff `[A, "A's handoff text"]` and
  B's updated one are both in `state.json`, B's first text is gone (B updated only its own entry), `sessions[]` holds
  both uuids with A still `n: 200`, and the rendered `next-session.md` carries both texts.
- **Seat B's close-out cannot remove seat A's handoff or session:** green on head (1/1) and on base.
- **The seat-keyed mutant goes red:** yes (row 3), and so does my seat-keyed `sessions[]` mutant.
- **`record-erasure` on a scratch copy** (`checkRecordErasure` on the `qa257-pr301` worktree, through `tsx`):

  ```
  record-erasure [pass]: 0 erasures since schema v3; walked 1682 commits, 455 .agents/state.json changes (222 at schema v3+); 44 erasure(s) in schema <3 history, which allowed them and cannot be repaired — listed by `open-brain state erasures`, failing nothing. LIMIT: reads HEAD's committed history only — an uncommitted edit is not seen
  ```

  (The handoff's run said 1681 commits; the head is one commit further on.)

### Row 6. #305, test-only: MET

- `npm run typecheck:tests` on `84e75618`: **exactly 4 errors, all category B**, at the files the handoff names:

  ```
  tests/index-upsert.test.ts(126,7): error TS2353: ... 'successRate' does not exist in type 'KnowledgeIndexInput'.
  tests/ranking.test.ts(4,26): error TS2305: Module '"../src/lifecycle.js"' has no exported member 'maturityBoost'.
  tests/ranking.test.ts(32,7): error TS2353: ... 'successRate' does not exist in type 'KnowledgeIndexInput'.
  tests/shadow-strategies.test.ts(33,7): error TS2353: ... 'successRate' does not exist in type 'KnowledgeIndexInput'.
  ```

- `git diff origin/master...84e75618 -- open-brain/src` is **empty** (0 bytes).
- **Five changed test files, each type-only, no assertion weakened.** Every `-` line in the tests diff was read; no
  `expect` was removed or loosened (the five `findHandoffCommit` and two `pragma` `expect` lines reappear with the
  same matcher and expected value, only the argument cast changed).
  1. `harness/policies.test.ts`: `hasPriorFailures: false` added to four `decidePlanGate` contexts (the rule reads
     `!ctx.hasPriorFailures`, so undefined and false are the same), plus one **new** row with
     `ctx({ hasPriorFailures: true })` expecting `proceed`.
  2. `session-start/handoff-provenance.test.ts`: `findHandoffCommit(dir, "developer", undefined, rewritten)` became
     `findHandoffCommit(dir, "developer", undefined, asCurrent(rewritten))`, where `asCurrent(h) { return h as Handoff; }`;
     the `expect(...).toBe(committed)` and the others are unchanged.
  3. `shared/state-schema.test.ts`: `serializeState(parseState(once).data!)` became
     `const parsed = parseState(once); if (!parsed.ok) throw new Error(...); serializeState(parsed.data)`. Stricter, not
     weaker: a failed parse now throws instead of passing `undefined` on.
  4. `sync/checks.test.ts`: `allowed_referrers: []` became
     `allowed_referrers: [] as Array<{ path: string; class: string; why: string }>`.
  5. `rating-method.test.ts`: `projectDir: null` became `projectDir: undefined` (`indexKnowledge` does
     `input.projectDir ?? null`), and `db.pragma(...).map((c: { name: string }) => c.name)` became
     `(db.pragma(...) as Array<{ name: string }>).map((c) => c.name)` with the same `toContain`.

  Also read: `t048-r1b` (`actual.readFileSync as unknown as (...a: unknown[]) => unknown`), `shadow-merge`
  (`return mod as unknown as Awaited<ReturnType<typeof load>>` with a comment), `s4-g5-qa`
  (`const failNoSeverity: Record<string, unknown> = ...`). One is not purely a type change and the handoff says so
  (its finding 1): `gate.test.ts` drops `legend: ["no", "yes"]` from the request payload. src never reads `legend`
  on a question, and `gate.test.ts` is 10/10, so no behaviour moves. Whether the test meant `criteria` is for the
  owner of that test.
- `policies.test.ts` **still has `hasPriorFailures: true` cases**: lines 367 (the F5 row) and 376 (the new row).

### Row 7. #308, HIGH impact: MET

`ob_state` has no CLI door for a write or a render (`open-brain state` is `show | erasures | import | migrate`), and
the MCP is not used here. So I called the function the tool calls, `applyStateOps`, render-only, with the exact
arguments `checks-state.ts:85` uses: `{ session: lastSession(state)?.n ?? 0, expected_revision: state.revision,
ops: [], render: true }` (`/home/agents/qa-tmp/render.mts`). Each case is a scratch project in
`~/qa-tmp/bom/<case>-<master|head>` holding copies of the tracked `.agents/state.json` (revision 279) and
`package.json`. "master" is `qa257-wt` (`origin/master`, `50700414`). Every run: `{"ok":true,"rev":[279,279]}`,
rendered INBOX, task, next-session and SUMMARY. The revision did not move.

- **(a) No BOM** (the repo's own `SUMMARY.md`, with markers, 58070 bytes): master and head SUMMARY outputs are
  **byte-identical** (`cmp` silent), `diff -r` of the whole `.agents/` is empty, and the output also equals the
  input.

  ```
  0000000   #       P   r   o   j   e   c   t       S   u   m   m   a   r
  0000020   y  \n  \n   <   !   -   -       s   t   a   t   e   :   b   e
  ```

- **(b) BOM and markers:** head keeps one BOM at offset 0, title at 1, region at 20 (byte-identical to master here,
  because master's marker path already kept the BOM).

  ```
  0000000 357 273 277   #       P   r   o   j   e   c   t       S   u   m
  0000020   m   a   r   y  \n  \n   <   !   -   -       s   t   a   t   e
  ```

- **(c) BOM and no markers** (`BOM + "# Project Summary\n\nHand-written intro ...\n"`): **head** puts the region
  after the title and keeps the BOM first; the only BOM is at offset 0, and the prose is kept.

  ```
  0000000 357 273 277   #       P   r   o   j   e   c   t       S   u   m
  0000020   m   a   r   y  \n  \n   <   !   -   -       s   t   a   t   e
  ```

  **Master** on the same input (the defect, for contrast): the region is at offset 0 and the BOM is mid-file at
  offset 56621, just before the title.

  ```
  0000000   <   !   -   -       s   t   a   t   e   :   b   e   g   i   n
  0000020       -   -   >  \n   <   !   -   -       g   e   n   e   r   a
  ```

### Row 8. #313: MET

`git grep -n knowledgeDb -- open-brain/src open-brain/tests open-brain/scripts scripts .claude ':!open-brain/tests/fixtures-import'`
in `qa257-pr313`: **no output, exit 1**. Across the whole repo the remaining hits are only text, not code: the T-065
title in `.agents/state.json:213` and `.agents/TASKS/INBOX.md:43`, the handoff itself, and the excluded
`tests/fixtures-import/` copies. `tsc --noEmit` is 0 on the merge (row 10), so nothing consumed the field.

### Row 9. #314: MET

My own scratch vaults under `~/qa-tmp/vp`, through `checkVaultPollution("/unused")` with **no** `vaultDir`, so it
resolves through `obsidianVaultDir()` (the `OPEN_BRAIN_VAULT_DIR` override points it at the scratch vault; the real
vault was never touched) (`/home/agents/qa-tmp/vp.mts`, run with `tsx` on `qa257-pr314`):

- **Seeded** (`ob-server-x.md` at the root plus `Summaries/2026-10-02-real.md`): `warn`, `"1 ob-server-* file(s) in
  the vault at /home/agents/qa-tmp/vp/seeded (of 2 .md files): ob-server-x.md. These are test artifacts written
  outside isolation; delete them with Aaron's approval; 0 directories unreadable"`.
- **Clean** (`Experiences/a.md` and `Experiences/ob-server-notes.txt`): `pass`, `"0 ob-server-* files in 1 .md files
  under the vault; 0 directories unreadable"`.
- **Absent:** `skip`, `"not checked: no readable vault at /home/agents/qa-tmp/vp/absent-vault (ENOENT), so
  ob-server-* artifacts were not looked for. This is not a pass."`.
- **It resolves through v2's `obsidianVaultDir()`:** `vault-pollution.ts:3`
  `import { obsidianVaultDir } from "../../shared/paths.js";` and `:61` `dir = vaultDir ?? obsidianVaultDir();`.
  `paths.ts:56-60`: `obsidianVaultDir(home = homedir())` returns `OPEN_BRAIN_VAULT_DIR` if it is set, else
  `join(home, "Obsidian Vault v2")`, and it throws under vitest when that would be the real home. With the override
  unset, `obsidianVaultDir("/home/x")` printed `/home/x/Obsidian Vault v2`. The retired v1 `Obsidian Vault` name does
  not appear in the new file. Registered in `sync/index.ts` as `checks.push(checkVaultPollution(options.projectRoot));`,
  next to `checkProbeMarkers`.

### Row 10. Batch merge order: MET, no conflict

`qa257-merge` from `origin/master` `50700414`, with `git merge --no-ff` in the order #308, #301, #313, #314, #305:
**every merge was clean** (`Merge made by the 'ort' strategy` five times). Result `00ee96d4` (local only, not pushed).

- `npx tsc --noEmit`: **exit 0**.
- `npm run typecheck:tests`: **4 errors**, the same four category-B lines as row 6, exit 2. The new test files from
  #301, #308, #313 and #314 add no errors under `tsconfig.tests.json`.
- Touched test files, **one per invocation, 25 files, 0 non-zero:** state-views 17, summary-bom 2, closeout-append 1,
  paths 13 (+1 Windows-only skip), vault-pollution 5, sync/index 4, shared/state-writer 46, db-v2 15, gate-artifacts
  7, gate 10, policies 27, s4-g5-qa 22, shadow-merge 43, drift-detector 4, handoff-provenance 11, state-render 33,
  state-import 9, sync/checks 102, scorer 11, t048-r1b 8, rating-method 8, relocate 8, state-schema 20, topics 18,
  fires 14. All passed.

## Gaps (none blocking)

1. **#313:** `paths.test.ts`'s new `knowledgeV2Db toContain("knowledge-v2.db")` is satisfied by `tests/setup-env.ts:35`'s
   override, so a repointed default survives (QA mutant). A row that clears the env var, or reads the default
   through `resolvePaths` with a synthetic home, would pin it.
2. **#314:** no test row reaches `obsidianVaultDir()`; every row passes `vaultDir`. QA's script shows the default path
   works. The `(^|-)` anchor and the `.md` count are also unpinned (near-equivalent mutants).
3. **#301:** verify-first. The new test is green on base by design, so its only red evidence is the mutants. Both
   killed.
4. **#305:** no developer mutant diff shipped. `gate.test.ts` drops a `legend` the request type does not have (the
   handoff's finding 1, left to the test's owner).

QA-257: REPORT COMPLETE
