# T-272 follow-up: rows S7-S9 pin the seat-file filters (the Opus review's three surviving mutants)

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC or laptop one-off, NOT the desktop. No hub key. **Tests only** (SG-1: merges on green CI after the planner's
ACCEPT). Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t272b-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 171. **Task:** T-272 (P2). **Tag:** `T-272b`. **Size:** SMALL.
**Base:** the dispatch SHA clark names at launch, which MUST contain PR #705's merge (T-272). Check with
`git merge-base --is-ancestor <#705 merge sha> <base>`; if clark names none, use `origin/master` after the fetch and
check `git log --oneline -1 -- open-brain/tests/pipelines/t272-seat-checkout.test.ts` is non-empty, else BLOCKED.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: none: test code only (tests/pipelines/t272-seat-checkout.test.ts); no src symbol changes
```

## Why

T-272's Opus second review (ACCEPT at bc0d5991, `~/Worktrees/t272-review-reply.md`, outside the repo) found the src
correct, but three edits of its changed lines survive every row:
- **MA** `open-brain/src/pipelines/bootstrap/index.ts` (gitState's seat filter): dropping the `l.startsWith("?? ") &&`
  guard makes a TRACKED, modified seat file (` M .agents/AGENT.local.md`) vanish from `dirty`, so scaffold proceeds
  over an uncommitted edit.
- **MB** (agentsState's seat filter): dropping `&& statSync(...).isFile()` makes a DIRECTORY named `AGENT.local.md`
  read as `empty`, while `dirty` still holds its file: check says Scaffold, scaffold refuses, move-residue refuses.
- **MC** (gitState): `=== `.agents/${SEAT_FILE}`` → `.endsWith(SEAT_FILE)` silently drops an untracked
  `notes/AGENT.local.md` from `dirty`.

The rows below pin the correct behaviour. They are GREEN at the base and each turns red under its mutant.

## Ruling (exact; `open-brain/tests/pipelines/t272-seat-checkout.test.ts` only)

Add these three rows at the end of the existing `describe("T-272: bootstrap in a seat checkout", ...)`, after S6. Use
the file's own helpers (`seatCheckout`, `git`, `bs`, `templateDir`). Change nothing else.

```ts
  it("S7: a TRACKED seat file with an edit is still an uncommitted change (only an untracked one is dropped)", () => {
    const { wt } = seatCheckout();
    git(wt, "add", "-f", ".agents/AGENT.local.md");
    git(wt, "commit", "-q", "-m", "track the seat file");
    fs.appendFileSync(path.join(wt, ".agents", "AGENT.local.md"), "edited\n");
    expect(bs.inspectProject(wt, templateDir).git).toEqual({ kind: "root", commits: true, dirty: [" M .agents/AGENT.local.md"], empty: false });
  });

  it("S8: a DIRECTORY named AGENT.local.md is residue, and its file is an uncommitted change", () => {
    const { wt } = seatCheckout();
    fs.rmSync(path.join(wt, ".agents", "AGENT.local.md"));
    fs.mkdirSync(path.join(wt, ".agents", "AGENT.local.md"));
    fs.writeFileSync(path.join(wt, ".agents", "AGENT.local.md", "x"), "x\n");
    const ins = bs.inspectProject(wt, templateDir);
    expect(ins.agents).toEqual({ kind: "residue", entries: ["AGENT.local.md/"] });
    expect(ins.git).toEqual({ kind: "root", commits: true, dirty: ["?? .agents/AGENT.local.md/x"], empty: false });
  });

  it("S9: an untracked AGENT.local.md outside .agents/ is still an uncommitted change", () => {
    const { wt } = seatCheckout();
    fs.mkdirSync(path.join(wt, "notes"));
    fs.writeFileSync(path.join(wt, "notes", "AGENT.local.md"), "x\n");
    expect(bs.inspectProject(wt, templateDir).git).toEqual({ kind: "root", commits: true, dirty: ["?? notes/AGENT.local.md"], empty: false });
  });
```

If a row's expected value differs from what the base src returns, STOP, `BLOCKED T-272b <row> <actual>`: the review
probed these values at bc0d5991, so a difference means the premise is wrong and the planner rules, not the builder.

## Existing tests

- S1-S6: **stay green**, untouched.
- `tests/pipelines/sync/retirements-live.test.ts`: **stays green** (no retired word in the new rows).
- `tests/harness/s4-guards.test.ts` S4-9.2: **stays green** (no skip, todo, skipIf or runIf; no test lost).

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t272b-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`, else BLOCKED).
2. **Start state.** Fresh clone into `(Join-Path $env:TEMP "t272b-wt")` unless the launcher named one.
   `git checkout -q -b test/t272b-seat-filter-rows <base>`; `rev-parse HEAD` = the base; porcelain empty, else BLOCKED.
   `npm ci` in `open-brain`, then `node -e "require('better-sqlite3')"` (else `npm rebuild better-sqlite3`, say so).
   **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, a `cd` into any other checkout,
   `npm run test:heavy`, killing any process by name, any edit outside the one test file.
3. **Commit 1, `T-272b: rows S7-S9 pin the seat-file filters (Opus review mutants MA, MB, MC)`**, ending with
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. In `open-brain`:
   `npx vitest run tests/pipelines/t272-seat-checkout.test.ts tests/harness/s4-guards.test.ts tests/pipelines/sync/retirements-live.test.ts --no-file-parallelism --testTimeout=180000`:
   all green (9 rows in the t272 file). Paste.
4. **Mutants** in `open-brain/src/pipelines/bootstrap/index.ts` (edit, run the t272 file only, paste the failing rows,
   `git checkout -- <file>`, porcelain empty; never commit one):
   - **MA:** in gitState's seat filter, `!(l.startsWith("?? ") && l.slice(3).replace(/^"|"$/g, "") === `.agents/${SEAT_FILE}`)`
     → `!(l.slice(3).replace(/^"|"$/g, "") === `.agents/${SEAT_FILE}`)`. Expect S7 red.
   - **MB:** in agentsState, `!(n === SEAT_FILE && statSync(join(agents, n)).isFile())` → `!(n === SEAT_FILE)`.
     Expect S8 red.
   - **MC:** in gitState's seat filter, `=== `.agents/${SEAT_FILE}`` → `.endsWith(SEAT_FILE)`. Expect S9 red.
5. `git log --oneline <base>..HEAD` shows 1 line; `git diff --name-only <base>..HEAD` shows only
   `open-brain/tests/pipelines/t272-seat-checkout.test.ts`; porcelain empty.
6. `git push origin test/t272b-seat-filter-rows` (never force); `ls-remote` = `rev-parse HEAD`. Then
   `gh pr create --base master --head test/t272b-seat-filter-rows --title "T-272b: rows S7-S9 pin the seat-file filters" --body "Brief: docs/loops/t272-followup-rows-brief.md. Tests only (SG-1): merges on green CI after the planner's ACCEPT."`
   and `gh pr checks <n> --watch --interval 30` (cap 20 min); paste the `test` conclusion.

## Reply

- **First line:** `READY T-272b <sha40> PR #<n>` or `BLOCKED T-272b <reason>`.
- Then each command with its output: the green run, the three mutants, the log and name-only diff, `ls-remote` =
  `rev-parse`, the PR URL and CI. Mark anything not run `NOT RUN`. Do not merge.
