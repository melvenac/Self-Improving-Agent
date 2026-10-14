# T-194: ship the r7 planner hook as the courtesy layer (port onto master, unregistered) and replay the planner's acts

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t194-ship-reply.md. A reply path in
the launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 171. **Task:** T-194 (P0). **Tag:** `T-194-ship`. **Size:** MEDIUM.
**Base:** the dispatch SHA clark names (a master that contains this brief). **Source:** `loop/t194-planner-hook` at
`71ea3101` (r7; Forge, session 155). **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.
**Replay script:** `~/Worktrees/t194-replay.mjs` (outside the repo; clark copies it to the same path on the QA PC).

```text
IMPACT-TARGETS: none: every file this ports is NEW to master (no existing symbol changes; checked by the planner with git diff --diff-filter=M, empty)
```

## Why

D-147 (Aaron 10-11, option 3) and D-154 (Aaron 10-14, approval mechanics (c)): the merge and push guarantee is
GitHub's (ruleset 24343321: PR required, strict `test`, no force push or deletion). The r7 hook ships as a COURTESY
layer. QA 246 rejected r7 as a hard boundary (D-088, defects A-G), but none of A-G is a merge bypass, and the design
note says r7 can be the courtesy layer with no fix round (`docs/loops/t194-design-decision.md`, option 3).

**Shipping registers nothing.** The hook acts only once Aaron pastes its snippet into the planner checkout's
`.claude/settings.local.json` (`node open-brain/build/cli-planner-hook.js --print-registration`). Registration stays
his hand. The replay (step 6) tells him what registering would refuse in the planner's real work. The courtesy layer
must not break the records flow it sits beside.

## What ships (exactly these 30 files, taken byte-for-byte from 71ea3101)

- src (13): `open-brain/src/cli-planner-hook.ts` and `open-brain/src/planner-hook/{bash-commands,bash,emit,git,grant,parse-gate,paths,prfiles,registration,run,shell-words,summary}.ts`
- tests (17): `open-brain/tests/planner-hook/{docs-merge,hook,r3,r4,r5-property,r5,r6-depth,r6-gate-property,r6-qa237,r6,r7-depth,r7-gate-property,r7-qa241,r7}.test.ts` and `open-brain/tests/planner-hook/{r5-fixture,r6-cases,r7-cases}.ts`

**Not shipped:** the branch's other 396 files: 380 under `docs/loops/t194-r*/mutants/`, the
`t194-*-developer-handoff.md` files and the rest of `docs/loops/t194-r*/`. They stay on the branch.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t194-ship-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`, else BLOCKED).
2. Fresh clone into `(Join-Path $env:TEMP "t194-ship-wt")` unless the launcher named one;
   `git fetch origin loop/t194-planner-hook`; `git checkout -q -b fix/t194-ship-r7 <base>`; `rev-parse HEAD` = base;
   porcelain empty; `git rev-parse FETCH_HEAD` = `71ea3101…` (print the 40 chars; on a mismatch STOP,
   `BLOCKED T-194-ship source moved`). `git ls-tree -r --name-only HEAD | Select-String planner-hook` prints nothing
   (else STOP, `BLOCKED T-194-ship already on master`). `npm ci` in `open-brain`, then `node -e "require('better-sqlite3')"`
   (else `npm rebuild better-sqlite3`).
   **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cherry-pick`, `merge`, a `cd` into any other
   checkout, `npm run test:heavy`, killing any process by name (list processes, never stop one you did not start).
3. **Commit 1, `T-194: port the r7 planner hook (courtesy layer, unregistered) from 71ea3101`:**
   `git checkout 71ea3101 -- <the 30 paths above>` (name each path; no globs over the mutants). Then
   `git diff --cached --name-only` lists exactly the 30, and `git diff --cached --diff-filter=M --name-only` is empty.
   Commit.
4. In `open-brain`, with `$env:NO_COLOR='1'`:
   - `npx tsc --noEmit` → exit 0. **If it fails:** the port met an API that moved since 71ea3101. Make the SMALLEST
     edit in the ported files only (never in a file master already had) and say each edit in the reply. If two tries do
     not reach exit 0, STOP, `BLOCKED T-194-ship tsc` with the errors.
   - `npx vitest run tests/planner-hook --no-file-parallelism --testTimeout=180000` (cap 20 min) → all pass; paste
     the summary. r7 reported 1101 passed at its own base; paste the count you get. A failure: the same smallest-edit
     rule and two tries, else `BLOCKED T-194-ship tests` with the failing names.
   - If you made an edit, commit it as **Commit 2, `T-194: adapt the r7 port to current master`**, else no commit 2.
5. **Mutants** (edit, run `npx vitest run tests/planner-hook --no-file-parallelism --testTimeout=180000`, paste the
   summary and up to 10 failing test names, `git checkout -- <file>`, porcelain empty; never commit one):
   - **M1** `open-brain/src/planner-hook/run.ts`: `if (isProtectedArtifactPath(relPath, ci)) {` →
     `if (false && isProtectedArtifactPath(relPath, ci)) {`. Expect ≥1 red (source writes stop being refused).
   - **M2** `open-brain/src/planner-hook/git.ts`: `if (name === "merge" || name === "tag") return true;` →
     `if (name === "tag") return true;`. Expect ≥1 red (git merge stops needing a grant).
   - **M3** `open-brain/src/planner-hook/git.ts`: delete the line
     `if (/^--force/.test(t) || (!t.startsWith("--") && /^-[A-Za-z]*f[A-Za-z]*$/.test(t))) return true;`.
     Expect ≥1 red (a force push stops needing a grant).
   A mutant with 0 red is a SURVIVOR: report it (do not fix it), and say so on the first line after READY.
6. **Replay** (in the clone root, after `npm run build` in `open-brain` exits 0):
   `node ~/Worktrees/t194-replay.mjs <clone-root>` (absolute clone path). Paste ALL its output. Rows C1-C5 are controls
   that MUST print DENY (the script ends `CONTROLS OK`, exit 0). Rows O1-O17 are the planner's real acts from session 171,
   and whatever they print is the finding. Do not change the script. If the script is missing, report
   `NOT RUN replay (script absent)` and continue.
   Then `git status --porcelain` is empty (the build output and AGENT.local.md are gitignored; if not, STOP and say what
   is dirty).
7. `git log --oneline <base>..HEAD` shows 1 or 2 lines, and each message ends with
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git diff --name-only <base>..HEAD` shows exactly the
   30 paths.
8. `git push origin fix/t194-ship-r7` (never force); `ls-remote` = `rev-parse HEAD`;
   `gh pr create --base master --head fix/t194-ship-r7 --title "T-194: ship the r7 planner hook as the courtesy layer (unregistered)" --body "Brief: docs/loops/t194-ship-r7-brief.md. Ports r7 (71ea3101) src + tests only; registers nothing (registration is Aaron's hand). Code PR: needs a QA ACCEPT and Aaron's word naming it."`;
   `gh pr checks <n> --watch --interval 30` (cap 25 min); paste the `test` conclusion.

## Reply

- **First line:** `READY T-194-ship <sha40> PR #<n>` or `BLOCKED T-194-ship <reason>`. Add ` SURVIVOR M<k>` after
  READY for each surviving mutant.
- Then each command with its output: tsc, the planner-hook vitest summary, each mutant, the whole replay table, the
  name-only diff, push, CI. Mark anything not run `NOT RUN`. Do not merge.
