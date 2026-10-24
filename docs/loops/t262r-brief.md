# T262R: the skills audit keys a text tool that writes a file (T-262, S173 gap 1)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-24, session 174. **Task:** T-262 (D-152), S173 gap 1. **Tag:** `t262r`. **Size:** SMALL
(2 edits in 1 src file, 1 new test file). **Base:** the START sha the launcher names (a master that contains this brief).

```text
IMPACT-TARGETS: commandKeys auditSkills (new: FILE_WRITERS, NO_FILE and writesFile in pipelines/skills-audit/index.ts)
```

## Why

T-262's audit (`open-brain/src/pipelines/skills-audit/index.ts`, `commandKeys`) drops generic programs, so clark's four
QA PC prompts built in one session as `sed -e ... old-prompt.txt > new.txt` produced no key and no row. With this change
a text tool from a fixed list (sed, awk, cat, head, tail, cut, sort, uniq, tr, grep, jq, iconv) whose segment redirects
stdout to a real file keys as `<tool> > file`. Not a file: `2>`, `>&2`, `2>&1`, /dev/null, NUL, $null. A command with a
heredoc gets no such key (`cat > f <<EOF` is content, not a build). Shell builtins (echo, printf) stay unkeyed.

## The change, exactly

Files under `docs/loops/t262r/`.
- **`t262-redirect-key.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/t262-redirect-key.test.ts`. R1-R8.
- **`edits.txt`:** 2 edits in `open-brain/src/pipelines/skills-audit/index.ts` (FILE_WRITERS, NO_FILE and writesFile
  before SCRIPT_RUNNERS; the GENERIC_PROGRAMS skip keys a text tool that writes a file).

## Measured before dispatch

QA PC SIM `sim-t262r-3` (job #76) at `896198b1`: ALL PASS. No file under `open-brain/` changed between `896198b1` and
this brief's base. sha256 prefixes: test file `8458f6c0facf29f0`, edits `5b851d10e7aae390`, m1 `881d71bb4a0323c0`, m2
`c68a23def9a636b4`, m3 `de22299907c04f87`, m4 `8f45a28cb5383bcc`.
- Baseline (the new test file, no source): the five files `1 failed | 4 passed (5)` files, `4 failed | 57 passed (61)`
  tests; the red rows are R1, R2, R7 and R8, all in t262-redirect-key.test.ts.
- Edits: `APPLIED 2 edits to 1 files`; both tsc runs and the build exit 0; the five files `61 passed (61)`.
- Step 4's wide run: `173 passed (173)` files, `2080 passed (2080)` tests, no Errors line. `module-boundary [pass]`.
- m1 (heredoc guard dropped) R5 and t262-skills-audit's `K5 heredoc bodies are data`; m2 (null devices count) R3 only;
  m3 (`>&2` counts) R4 only; m4 (any generic program keys) R6 only.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `t262-skills-audit` (incl. `K5 heredoc bodies are data`) | stays green | A heredoc command gets no `> file` key. Green in the SIM. |
| `t262-part2`, `t262-fix-2`, `s173g` | stay green | No row there redirects a text tool into a file. Green in the SIM. |
| `t258-notice-races`, `t267-folder-key-shellfree`, `tests/shared`, `tests/pipelines` | stay green | Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED t262r <test name>`. Exceptions, from T-292 load on the shared
QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in files
other than the five files below, with that error or a hook timeout: re-run each such file alone; green alone means
paste both runs and go on, red alone means STOP. A red row in the five files after step 4 is never an exception.

## Steps

"The five files" means, from `open-brain`:
`npx vitest run tests/t262-redirect-key.test.ts tests/t262-skills-audit.test.ts tests/t262-part2.test.ts tests/t262-fix-2.test.ts tests/s173g.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t262-redirect-key`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash,
   reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real
   `~/.claude/`, any MCP config, and anything under `docs/`.
3. **Commit 1** (`T262R: rows for a text tool that writes a file`).
   - `Copy-Item docs/loops/t262r/t262-redirect-key.test.ts open-brain/tests/t262-redirect-key.test.ts`.
   - Run the five files. Expect `1 failed | 4 passed (5)` files and `4 failed | 57 passed (61)` tests, the red rows R1,
     R2, R7 and R8 in t262-redirect-key.test.ts. Paste the summary and each `x` row.
4. **Commit 2** (`T262R: the skills audit keys sed/awk/... writing a file as "<tool> > file" (T-262)`).
   - `node docs/loops/t262r/apply.cjs . docs/loops/t262r/edits.txt` prints exactly `APPLIED 2 edits to 1 files`.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then
     `npm run build` (exit 0).
   - Run the five files: `61 passed (61)`.
   - `npx vitest run tests/shared tests/t258-notice-races.test.ts tests/t267-folder-key-shellfree.test.ts tests/t262-redirect-key.test.ts tests/t262-skills-audit.test.ts tests/t262-part2.test.ts tests/t262-fix-2.test.ts tests/s173g.test.ts tests/pipelines --no-file-parallelism --testTimeout=180000`
     (40-minute cap; run it in the foreground with a tool timeout of at least 40 minutes, never the 10-minute
     default). Expect 0 failed. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` (`[pass]`).
     Paste it.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m4: `node docs/loops/t262r/apply.cjs . docs/loops/t262r/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run the five files; paste the `Tests` line and the `x` rows (expected: m1 -> R5
   and `K5 heredoc bodies are data`; m2 -> R3 only; m3 -> R4 only; m4 -> R6 only); restore with
   `git checkout -- open-brain/src` (this returns to commit 2) and check the status is empty. After m4, run the five
   files once more: `61 passed (61)`. Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 2 paths:
   `M open-brain/src/pipelines/skills-audit/index.ts`, `A open-brain/tests/t262-redirect-key.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t262-redirect-key` must equal HEAD.
   `gh pr create --base master --head feat/t262-redirect-key --title "T262R: the skills audit keys a text tool that writes a file (T-262)" --body "Brief: docs/loops/t262r-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t262r <sha40> PR #<n>` or `BLOCKED t262r <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild`. Live check: after a session that builds a file with `sed ... > f` three times, the skills audit shows a
`sed > file` row.
