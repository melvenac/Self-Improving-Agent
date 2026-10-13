# T-243: the #484 audit lows — a log that withholds the payload, single-quoted YAML, one project slug, and the trust boundaries written down

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop or laptop one-off (any Windows host). No hub key. Code only. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t243-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 168. **Task:** T-243 (P3). **Tag:** `T-243`. **Size:** SMALL.
**Base:** `304d56392c8e2fdab33b08a66daae96ece46ab5d` (origin/master; its code equals 399121cd). If clark re-pins it at
launch, that SHA wins. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: logFailure (cli-recall-trigger.ts) parseFrontmatterScalar parseInlineArrayInner normalizeProject (covered by tests/trigger/hook.test.ts, tests/audit-fix-*.test.ts, tests/vault-writer.test.ts, tests/pipelines/sync/experience-frontmatter.test.ts, tests/topics.test.ts)
```

## Why

T-243 (read its note in `.agents/state.json`) holds the LOW items left out of #484 on purpose. Planner-researched at
399121cd: three are small, safe code fixes (L1, Y1, P1); three are trust-boundary-by-design (A2, A4, A5) and get written
down instead of changed. The security-relevant judgement calls are ruled below.

## Ruling (exact names; paths under `open-brain/` unless stated)

1. **L1, the recall-trigger log.** `src/cli-recall-trigger.ts:116` logs `JSON.parse`'s message, which QUOTES the payload
   (the whole input when it is 21 characters or less, else 10 characters each side of the bad token; measured on Node
   22.23.2: `JSON.parse("ghp_T243SECRET")` gives `Unexpected token 'g', "ghp_T243SECRET" is not valid JSON`). Change the
   call to `logFailure(\`payload is not valid JSON (${raw.length} chars; parser message withheld: it quotes the payload)\`);`
   (use whatever the raw-text variable is called there). Keep the prefix `payload is not valid JSON`. Do NOT rewrite old
   log lines (that is a separate, count-only check on Aaron's machine).
2. **Y1, single-quoted YAML** (`src/shared/parse-frontmatter.ts`):
   - `parseFrontmatterScalar`, after the `"` branch: `if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");`
   - `parseInlineArrayInner`: a `'` branch; the item closes at a `'` not followed by `'` (`''` is an escaped quote). An
     unterminated quote throws, so the existing catch keeps today's raw fallback.
   - The numeric guard (`~:84`) becomes `!value.startsWith('"') && !value.startsWith("'")`, so `'123'` stays a string.
3. **P1, the project slug** (`src/pipelines/topics/index.ts:80-84`): `normalizeProject` uses `slugify` from
   `../../vault-writer.js` (the same function `writeSummary` builds its tag with):
   `const slug = slugify(raw) || raw.trim().toLowerCase().replace(/\s+/g, "-");` (the fallback keeps an all-non-ASCII
   name such as `项目` out of `unsorted`). Both files are MEMORY_SIDE, so the module-boundary check allows the import.
4. **A2, A4, A5: documented, not changed.** Add a `## Trust boundaries` section to `.agents/SYSTEM/SECURITY.md`:
   - A2: `/sync`'s GitNexus step runs `node .gitnexus/run.cjs` from the project root (a gitignored launcher GitNexus
     writes), and falls back to `npx gitnexus@<version>` when it is missing (network). A repository you run `/sync` in is
     code you run.
   - A4: `ob_start` and `ob_sync` take a model-chosen `project_root`. They write only create-only files inside an
     existing `.agents/SESSIONS/` (T-255), but they run git there (`git status` honours `core.fsmonitor`): **treat these
     MCP tools as shell-equivalent inside `project_root`**.
   - A5: environment overrides change where things are read and written: `OPEN_BRAIN_VAULT_DIR`, `KNOWLEDGE_V2_DB`,
     `RECALL_TRIGGER_LOG`, `TRIGGER_POLICY_DIR`, `OPEN_BRAIN_ACTIVE_SESSION`. Whoever sets the process environment can
     already run code (`NODE_OPTIONS`), so they are not a boundary.
   - Correct three lines that are now false: `:26` (the SessionStart hook also writes fetch markers into the git common
     dir), `:27` "No network calls" (SessionStart runs `git fetch`; `/sync` may run `npx`), and `:32`'s hook list (add
     `open-brain/build/cli-recall-trigger.js`, PostToolUse).
5. **Out of scope:** code changes for A2/A4/A5, `cli-bootstrap.ts:72` (the SessionStart payload carries no command text),
   `health-checks.ts:34`'s `execSync` with the vault path in a shell string (a separate task; note it in the reply), and
   making the GitNexus step report-only inside the MCP server (a separate decision).

## Existing tests (planner-researched; verdicts)

- Stay green: `tests/trigger/hook.test.ts:294` (asserts `not valid JSON`; keep the prefix), `tests/t235-p2-5-cursor-recall.test.ts:94`,
  `tests/audit-fix-r3-callers.test.ts:26` (an unterminated quote must still fall back), `tests/audit-fix-a3-r2.test.ts:29`,
  `tests/vault-writer.test.ts:347,354`, `tests/pipelines/sync/experience-frontmatter.test.ts:175` (`type: 42`, only with
  the narrowed guard), `tests/audit-fix-r4-topics.test.ts:18`, `tests/topics.test.ts:101 119 128 141 150 164`.
- `tests/audit-fix-r3-callers.test.ts:19` tests an inline copy of the OLD slug formula, not `normalizeProject`: leave it
  unchanged and say so in the reply.
- Any other newly failing row: STOP, `BLOCKED T-243 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t243-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`, else BLOCKED).
2. `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t243-wt")`, `Set-Location`
   into it, `git checkout -q -b fix/t243-audit-lows 304d56392c8e2fdab33b08a66daae96ece46ab5d`. HEAD must print that SHA
   and the tree must be clean, else STOP, BLOCKED. `npm ci` in `open-brain`. **Forbidden:** `git stash`, `reset --hard`,
   `--force`, rebase, amend, `cd` into any other checkout, and reading or writing the real
   `~/.claude/open-brain/recall-trigger.log` (tests set `RECALL_TRIGGER_LOG` to a temp file).
3. **Base run** (in `open-brain`, 30-minute cap):
   `npx vitest run tests/trigger tests/t235-p2-5-cursor-recall.test.ts tests/audit-fix-r3-callers.test.ts tests/audit-fix-a3-r2.test.ts tests/audit-fix-r4-topics.test.ts tests/vault-writer.test.ts tests/pipelines/sync/experience-frontmatter.test.ts tests/topics.test.ts --no-file-parallelism --testTimeout=180000`.
   Paste the summary and every failing row.
4. **Commit 1, `T-243: tests (red)`.** New file `open-brain/tests/t243-audit-lows.test.ts` (namespace imports):
   - **L1:** run the hook (the way `hook.test.ts` does) with stdin `ghp_T243SECRET`, then with
     `{"tool_name":"Bash","session_id":"s","tool_input":{"command": ghp_T243SECRETxyz}}` → exit 0, empty stdout and
     stderr, one log line each containing `payload is not valid JSON`, and `T243` appears NOWHERE in the log.
   - **Y1:** parse `key: 'x: y'`, `tags: ['a', 'b, c', 'it''s']`, `n: '123'`, `m: 42` → `"x: y"`, `["a","b, c","it's"]`,
     the string `"123"`, the number 42; `parseInlineArray("alpha, 'broken")` → `["alpha, 'broken"]`; a key `'quoted'`
     written by `writeExperience` round-trips exactly.
   - **P1:** five `writeSummary` calls with project `C++ Tools` and one with `项目` (temp vault), then `planTopics` with
     minimum 5 → a `c-tools` topic, no `c++-tools` topic, each C++ summary under `c-tools` only, and a `项目` topic.
   - **D1:** `.agents/SYSTEM/SECURITY.md` contains `.gitnexus/run.cjs`, `project_root`, `OPEN_BRAIN_VAULT_DIR`,
     `cli-recall-trigger.js` and `shell-equivalent`, and does not contain `No network calls`.
   Run the file: L1, Y1, P1 and D1 red. Paste it.
5. **Commit 2, `T-243: the audit lows (log withholds the payload, single-quoted YAML, one project slug, trust boundaries)`:**
   the ruling.
6. End both messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline 304d5639..HEAD`
   shows 2 lines; `git status --porcelain` is empty.
7. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0), the t243 file, then step 3's command again. Paste all three.
8. **Mutants** (edit, run the t243 file only, paste, `git checkout -- <file>`, clean tree; never commit):
   - M1: pass `err` to `logFailure` again → L1 red.
   - M2: delete the scalar `'` branch → Y1 red.
   - M3: restore the old `normalizeProject` body → P1 red.
   - M4: delete the Trust boundaries section → D1 red.
9. `git diff --name-only 304d5639..HEAD` must show only `.agents/SYSTEM/SECURITY.md`,
   `open-brain/src/cli-recall-trigger.ts`, `open-brain/src/shared/parse-frontmatter.ts`,
   `open-brain/src/pipelines/topics/index.ts`, `open-brain/tests/t243-audit-lows.test.ts`. Anything else: STOP, BLOCKED.
10. `git push origin fix/t243-audit-lows` (never force); `ls-remote` must equal `rev-parse HEAD`. Then
    `gh pr create --base master --head fix/t243-audit-lows --title "T-243: the #484 audit lows (log withholds the payload, single-quoted YAML, one project slug, trust boundaries)" --body "Brief: docs/loops/t243-audit-lows-brief.md."`
    Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Reply

The first line is `READY T-243 <sha40> PR #<n>` or `BLOCKED T-243 <reason>`. Then each command with its output: base
run, red run, tsc, the t243 run, the second run, the mutants, the name-only diff, `ls-remote` = `rev-parse`, the PR URL
and CI, and one line on `health-checks.ts:34` for a follow-up task. At most 2 attempts at a red. Mark anything not run
`NOT RUN`. If the code differs from a line this brief quotes, follow the ruling's intent and say what differed. Do not
merge.
