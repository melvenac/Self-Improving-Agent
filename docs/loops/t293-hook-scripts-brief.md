# T-293: the planner hook lets `bash <file.sh>` run as it lets `node <file.js>` run, and treats records/ pushes as docs/ pushes

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t293-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 171. **Task:** T-293 (P1). **Tag:** `T-293`. **Size:** SMALL.
**Base:** the dispatch SHA clark names (a master that contains this brief and T-194's #749).
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: pushNeedsGrant checkBashSimples (open-brain/src/planner-hook/git.ts, parse-gate.ts; reached only from the UNREGISTERED planner hook, cli-planner-hook.ts; covered by tests/planner-hook/*)
```

## Why

T-194 shipped the r7 planner hook unregistered (#749, D-147, D-154: a courtesy layer; GitHub's ruleset is the merge
guarantee). Its replay of the planner's real acts found two refusals that would stop the planner's records/docs flow if
the hook were registered:
- every `bash <atlas-ops script>` (records-pr, docs-pr, pr-refresh, pr-keep-current, tree-sync), because the hook
  parses `bash` only as `bash -c '<string>'`;
- `git push origin records/<branch>`, because the standing-push rule lists `loop/`, `qa/`, `docs/` and `chore/` and
  predates the records/ branches.

**The ruling (planner, under D-147's courtesy framing):**
- The hook already lets `node <file.js> [args]` run a script it cannot read. `bash <file.sh> [args]` gets exactly the
  same terms: no option before the script, and the file must end in `.sh`.
- `records/` joins the standing-push branches, with every other standing rule unchanged: remote `origin`, no force,
  no delete, and no master/main target.

**Planner pre-check** (scratch copies of master's src with the rulings applied, run through the repo's tsx, outside
the repo):
- rows A1-A5 and D1-D10 below give the stated verdicts;
- master (1aebb121) denies all 15;
- each mutant flips exactly its named rows;
- all 2096 Bash/PowerShell rows of QA 237 + QA 241 keep their decisions;
- of the 639 command strings in `r6-cases.ts` / `r7-cases.ts`, exactly ONE flips: `bash script.sh` (see Existing
  tests).

## Ruling (exact)

1. `open-brain/src/planner-hook/git.ts`:
   `const STANDING_BRANCH_RE = /^(?:loop|qa|docs|chore)\/[^\s/][^\s]*$/;` →
   `const STANDING_BRANCH_RE = /^(?:loop|qa|docs|chore|records)\/[^\s/][^\s]*$/;`. In the doc comment above
   `GIT_RISKY_CONFIG_RE`, the line that begins ` * docs/ or chore/, and no force,` becomes
   ` * docs/, chore/ or records/ (T-293), and no force,` with the rest of that line unchanged.
2. `open-brain/src/planner-hook/parse-gate.ts`, directly above `const SHELLS = new Set([`, insert:
   ```ts
   /** T-293: the script a `bash <file> [args]` call may run. */
   const BASH_SCRIPT_RE = /\.sh$/i;
   ```
3. Same file, in the `if (SHELLS.has(name)) {` block, replace the two lines
   ```ts
         const ok = args.length === 2 && args[0].text === "-c";
         if (!ok) return refuse(`${name} is only parseable as: ${name} -c '<string>'`);
   ```
   with
   ```ts
         // T-293: bash may also run a script FILE, as node may (`node <file.js> [args]`): no option before the script, and
         // the file must end in .sh. Its contents are not read, exactly as node's are not; GitHub's ruleset is the guarantee.
         if (name === "bash" && args.length >= 1 && !args[0].text.startsWith("-") && BASH_SCRIPT_RE.test(args[0].text)) continue;
         const ok = args.length === 2 && args[0].text === "-c";
         if (!ok) return refuse(`${name} is only parseable as: ${name} -c '<string>', or bash <file.sh> [args]`);
   ```
4. Nothing else in src changes.

## Rows (commit 1, new file `open-brain/tests/planner-hook/t293.test.ts`)

Build the repo the way `hook.test.ts` does: a temp dir with `.agents/AGENT.local.md` holding `role: planner`. Call
`runPlannerHook({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command }, cwd: repo }, { summaryContent: null })`
and assert `.decision`. Use `S = "C:/Users/melve/.claude/skills/atlas-ops/scripts"`, the literal text the planner types. It
is only text, and nothing opens it.

- **ALLOW** (`decision` is not `"deny"`):
  - A1 `` `bash ${S}/records-pr.sh records/rev467-s171 msg.txt` ``
  - A2 `` `bash ${S}/tree-sync.sh` ``
  - A3 `"bash scripts/run-me.sh --flag value"`
  - A4 `"git push origin records/rev467-s171"`
  - A5 `"git push origin records/rev467-s171:records/rev467-s171"`
- **DENY** (`decision` is `"deny"`):
  - D1 `"bash -x scripts/run-me.sh"`
  - D2 `"bash scripts/run-me.py"`
  - D3 `"bash"`
  - D4 `"sh scripts/run-me.sh"`
  - D5 `"git push origin records/x:master"`
  - D6 `"git push --force origin records/rev467-s171"`
  - D7 `"git push origin records/"`
  - D8 `"bash -c 'git merge origin/master'"`
  - D9 `"bash $S/records-pr.sh records/x m.txt"`
  - D10 `"bash --rcfile=x.sh"`

**Expected at commit 1 (the base):** A1-A5 RED, D1-D10 GREEN.

## Existing tests (verdicts)

- `tests/planner-hook/r6-cases.ts`, the `BASH_REFUSED` row `["a shell run on a file", "bash script.sh", "bash is only parseable"]`
  turns ALLOWED by ruling 3. In **commit 2**, change it to
  `["a shell run on a file", "sh script.sh", "sh is only parseable"]`: the same construct for a shell T-293 does not
  open. The row count is unchanged. This is the ONLY existing row that flips (pre-checked).
- Every other row stays as it is. The other `bash is only parseable` rows (`echo ls | bash`, `bash -c 'ls' extra`,
  `bash -lc 'ls'`) still match, because the new message still begins `bash is only parseable`.
- Every file in `tests/planner-hook/` stays green, and so do `tests/harness/s4-guards.test.ts`, `tests/t235-p2-5-cursor-recall.test.ts`
  and `tests/pipelines/sync/retirements-live.test.ts`. Any other row that turns red: STOP, `BLOCKED T-293 <test name>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t293-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`, else BLOCKED).
2. Fresh clone into `(Join-Path $env:TEMP "t293-wt")` unless the launcher named one;
   `git checkout -q -b fix/t293-hook-scripts <base>`; `rev-parse HEAD` = base; porcelain empty;
   `git ls-tree --name-only HEAD open-brain/src/cli-planner-hook.ts` prints the path (else STOP,
   `BLOCKED T-293 base lacks T-194`). `npm ci` in `open-brain`, then `node -e "require('better-sqlite3')"`.
   **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout,
   `npm run test:heavy`, killing any process by name.
3. **Commit 1, `T-293: rows for bash <file.sh> and records/ pushes`:** the new test file. `$env:NO_COLOR='1'`; in
   `open-brain`: `npx vitest run tests/planner-hook/t293.test.ts --no-file-parallelism --testTimeout=180000`. Exactly
   A1-A5 red. Paste the summary and the `x` rows.
4. **Commit 2, `T-293: bash runs a .sh file as node runs a .js file; records/ is a standing push branch`:** rulings 1-3
   plus the `r6-cases.ts` row. Run
   `npx vitest run tests/planner-hook tests/harness/s4-guards.test.ts tests/t235-p2-5-cursor-recall.test.ts tests/pipelines/sync/retirements-live.test.ts --no-file-parallelism --testTimeout=180000`
   (cap 25 min; all green), `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0). Paste all.
5. Each message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline <base>..HEAD`
   shows 2 lines; porcelain empty.
6. **Mutants** (edit, run `npx vitest run tests/planner-hook/t293.test.ts --no-file-parallelism --testTimeout=180000`,
   paste the summary and `x` rows, `git checkout -- <file>`, porcelain empty; never commit one):
   - **M1** git.ts: `(?:loop|qa|docs|chore|records)` → `(?:loop|qa|docs|chore)`. Expect A4, A5 red.
   - **M2** parse-gate.ts: delete the line `if (name === "bash" && args.length >= 1 && … ) continue;`. Expect A1, A2, A3 red.
   - **M3** parse-gate.ts: `!args[0].text.startsWith("-") && BASH_SCRIPT_RE` → `BASH_SCRIPT_RE`. Expect D10 red.
   - **M4** parse-gate.ts: `const BASH_SCRIPT_RE = /\.sh$/i;` → `const BASH_SCRIPT_RE = /\.\w+$/i;`. Expect D2 red.
   - **M5** parse-gate.ts: `if (name === "bash" && args.length` → `if (args.length`. Expect D4 red.
   Check each mutant applied (paste its `git diff` line) before trusting the run: Git Bash collapses doubled
   backslashes in command text, so build M4's text in a file or with PowerShell.
7. `git diff --name-only <base>..HEAD` shows exactly `open-brain/src/planner-hook/git.ts`,
   `open-brain/src/planner-hook/parse-gate.ts`, `open-brain/tests/planner-hook/r6-cases.ts` and
   `open-brain/tests/planner-hook/t293.test.ts`.
8. `git push origin fix/t293-hook-scripts` (never force); `ls-remote` = `rev-parse HEAD`;
   `gh pr create --base master --head fix/t293-hook-scripts --title "T-293: the planner hook runs bash <file.sh> as it runs node <file.js>; records/ pushes stand" --body "Brief: docs/loops/t293-hook-scripts-brief.md. The hook stays UNREGISTERED. Code PR (src): needs a QA ACCEPT and Aaron's word naming it."`;
   `gh pr checks <n> --watch --interval 30` (cap 25 min); paste the `test` conclusion.

## Reply

- **First line:** `READY T-293 <sha40> PR #<n>` or `BLOCKED T-293 <reason>`.
- Then each command with its output. Mark anything not run `NOT RUN`. Do not merge.
