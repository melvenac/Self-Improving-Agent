# T-243 amendment 1: SECURITY.md says only what is true, and the four surviving mutants die

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop or laptop one-off (any Windows host). No hub key. Code only. Ends at READY with PR #673 updated, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t243-r2-reply.md (a reply path in the
launcher's line wins). Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 170. **Task:** T-243. **Tag:** `T-243`. **Size:** SMALL.
**Branch:** `fix/t243-audit-lows` at `89b2bf3d9a384ce68e1281629cca403b94b682e7` (PR #673). If clark re-pins it at launch,
that SHA wins. **The brief's rulings stand:** `docs/loops/t243-audit-lows-brief.md`.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: parseFrontmatterScalar parseInlineArrayInner (open-brain/src/shared/parse-frontmatter.ts; covered by tests/t243-audit-lows.test.ts, tests/audit-fix-a3-r2.test.ts, tests/audit-fix-r4-topics.test.ts, tests/topics.test.ts, tests/vault-writer.test.ts, tests/pipelines/sync/experience-frontmatter.test.ts)
```

## Why

The Opus second review of round 1 (`t243-review-reply.md`, VERDICT CHANGES, at 89b2bf3d) found the code (L1, Y1, P1)
correct, and found SECURITY.md stating three things that are false at that head. The planner read each cited line at
89b2bf3d:
- **F1 (MEDIUM):** "everything else is local file I/O" is false. `ob_start` (MCP and the CLI `start`) reaches
  `describeHubPresence` (start-report.ts:206), which sends a GET carrying the seat's `X-Agent-Key`
  (hub-presence.ts:268) to `HUB_URL`, default `http://100.124.212.87:4000` (:12, :313), with the key read from
  `A2A_KEY_DIR` or `~/.a2a-hub/keys` (:318).
- **F3 (LOW):** "one exception: fetch markers" is false. The SessionStart hook also claims (renames) and deletes the
  legacy `.agents/SESSIONS/.missing-handoff.jsonl` inside the project (cli-bootstrap.ts:332,
  shared/handoff-guard.ts:236-244).
- **F2 (LOW):** the env-override list misses `HUB_URL` (it moves where the agent key is SENT), `A2A_KEY_DIR`,
  `OPEN_BRAIN_SCORE_HISTORY`, `OPEN_BRAIN_SHADOW_LOG`, `CLAUDE_PROJECT_DIR` and `HOME`/`USERPROFILE`.
- **F4 (LOW):** four mutants of the new parse lines survive (MA-MD below).

A security document that says less than the code does is worse than no list at all, because readers stop looking.

## Ruling (exact)

1. **`.agents/SYSTEM/SECURITY.md`:**
   a. The writes line names BOTH exceptions to "never write outside `~/Obsidian Vault v2/` and `~/.claude/open-brain/`":
      the fetch markers in the project's git common dir, and the SessionStart hook's claim-and-delete of a leftover
      `.agents/SESSIONS/.missing-handoff.jsonl` inside the project. Before you write it, list every write the three
      registered hooks make outside those two directories (`cli-bootstrap.ts`, `cli-recall-trigger.ts`,
      `cli-session-end.ts` and what they call) and paste the list with file:line in the reply. If you find a third,
      name it too.
   b. The network line drops "everything else is local file I/O" and names every network call: the SessionStart
      hook's `git fetch`, `/sync`'s `npx` fallback, and `ob_start`'s hub presence GET, which carries the seat's
      `X-Agent-Key` to `HUB_URL` when the seat map names partners and a key file exists. Before you write it, grep
      `open-brain/src` for `fetch(`, `http`, `https.request` and spawned network tools (`git fetch`, `npx`, `curl`) and
      paste what you found in the reply with file:line. Name any other caller you find.
   c. The env-override bullet adds `HUB_URL` (and says it moves where the agent key is sent), `A2A_KEY_DIR`,
      `OPEN_BRAIN_SCORE_HISTORY`, `OPEN_BRAIN_SHADOW_LOG`, `CLAUDE_PROJECT_DIR` (which project the SessionEnd hook reads
      and writes for) and `HOME`/`USERPROFILE` (every default). Before you write it, list every `process.env.` read in
      `open-brain/src`, and add any other variable that moves a read, a write or a network destination.
   d. "SessionEnd hooks run automatically" becomes "The hooks run automatically" (three are registered).
2. **`tests/t243-audit-lows.test.ts`**, new rows:
   - **D1b:** SECURITY.md contains `X-Agent-Key`, `HUB_URL`, `A2A_KEY_DIR`, `OPEN_BRAIN_SCORE_HISTORY`,
     `OPEN_BRAIN_SHADOW_LOG`, `CLAUDE_PROJECT_DIR` and `.missing-handoff.jsonl`, and does not contain
     "everything else is local file I/O".
   - **Y1b (kills MA):** `tags: ['a' , 'b']` parses to `["a", "b"]`.
   - **Y1c (kills MB):** `k: '` parses to `'` (a lone quote stays raw).
   - **Y1d (kills MC):** the scalar `k: 'it''s'` parses to `it's`.
   - **P1b (kills MD):** summaries with project `ПРОЕКТ` and `проект` land under ONE topic `проект`, and a project
     `项目 项目` lands under `项目-项目`.
   - **Y1e:** `tags: ["a" , "b"]` parses to `["a", "b"]` (ruling 3).
3. **`src/shared/parse-frontmatter.ts`:** the double-quoted inline-array branch `trimStart()`s the remainder before its
   comma check, as the single-quoted branch already does (the review's nit: `["a" , "b"]` gives `["a","","b"]` today).
   No other src change.
4. **Out of scope:** the side effect the review names under P1 (`readEntries` now slugifies `project_dir` basenames,
   `open_brain` becomes `open-brain`) is accepted as consistent with the ruling; YAML-strict errors for hand-edited
   values no writer produces; T-280 (health-checks `execSync`).

## Existing tests (planner-read at 89b2bf3d; verdicts)

- The 7 round-1 rows of `t243-audit-lows.test.ts`: **stay green.**
- The frontmatter, topics and vault-writer files in the IMPACT line: **stay green** (no writer emits a space before a
  comma; `yamlInlineArray` quotes such values).
- `tests/pipelines/sync/retirements-live.test.ts`: run it (it caught round 1 in CI).
- Any other newly failing row: STOP, `BLOCKED T-243 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t243-r2-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v`. It must print `v22.*`, otherwise BLOCKED.
2. **Start state.** Work in the fresh clone the launcher named. If it named none, run
   `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t243-r2-wt")` and
   `Set-Location` into it. Then `git checkout -q -b fix/t243-audit-lows origin/fix/t243-audit-lows`.
   `git rev-parse HEAD` must print `89b2bf3d9a384ce68e1281629cca403b94b682e7` and `git status --porcelain` must be
   empty, else STOP, BLOCKED. Run `npm ci` in `open-brain`. Every test run uses a temp HOME, USERPROFILE,
   KNOWLEDGE_V2_DB, RECALL_TRIGGER_LOG and OPEN_BRAIN_VAULT_DIR. **Forbidden:** `git stash`, `reset --hard`, `--force`,
   rebase, amend, merge, `cd` into any other checkout, `npm run test:heavy`.
3. **Commit 1, `T-243 r2: tests (red)`:** ruling 2's rows. Run the t243 file: D1b and Y1e red; Y1b, Y1c, Y1d and P1b
   green (they pin today's correct behaviour against the mutants in step 7). Paste it.
4. **Commit 2, `T-243 r2: SECURITY.md names the hub fetch, the second write and every override`:** rulings 1 and 3,
   with the three lists from 1a-1c pasted in the reply.
5. End both messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   `git log --oneline 89b2bf3d..HEAD` shows 2 lines; `git status --porcelain` is empty.
6. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0), then
   `npx vitest run tests/t243-audit-lows.test.ts tests/audit-fix-a3-r2.test.ts tests/audit-fix-r3-callers.test.ts tests/audit-fix-r4-topics.test.ts tests/topics.test.ts tests/vault-writer.test.ts tests/pipelines/sync/experience-frontmatter.test.ts tests/pipelines/sync/retirements-live.test.ts --no-file-parallelism --testTimeout=180000`.
   Paste both.
7. **Mutants** (edit, run the t243 file only, paste, `git checkout -- <file>`, clean tree; never commit):
   - MA `parse-frontmatter.ts`: the single-quoted branch's `.trimStart()` dropped → Y1b.
   - MB `v.length >= 2` → `v.length >= 1` in the scalar branch → Y1c.
   - MC the scalar branch's `.replace(/''/g, "'")` dropped → Y1d.
   - MD `topics/index.ts`: the fallback replaced by `raw` → P1b.
   - ME the double-quoted branch's new `trimStart()` dropped → Y1e.
8. `git diff --name-only 89b2bf3d..HEAD` must show only `.agents/SYSTEM/SECURITY.md`,
   `open-brain/src/shared/parse-frontmatter.ts` and `open-brain/tests/t243-audit-lows.test.ts`. Anything else: STOP,
   BLOCKED.
9. `git push origin fix/t243-audit-lows` (never force). `ls-remote` must equal `rev-parse HEAD`. Wait for CI
   (`gh pr checks 673 --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Reply

The first line is `READY T-243 <sha40> PR #673` or `BLOCKED T-243 <reason>`. Then each command with its output: the red
run, the three lists (writes, network calls, env reads) with file:line, tsc, step 6's run, the mutants, the name-only
diff, `ls-remote` = `rev-parse`, and CI. **Paste test output with `grep -a`, or without grep.** At most 2 attempts at a
red. Mark anything not run `NOT RUN`. If the code differs from a line this amendment quotes, follow the ruling's intent
and say what differed. Do not merge.
