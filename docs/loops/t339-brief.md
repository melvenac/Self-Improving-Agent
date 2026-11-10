# T339: three small false readings: ops skill in the project, two /sync false issues, the OLD /start line (T-339, T-341, T-342)

Runtime: CC (claude -p, Sonnet)
SEAT: job runner (Lenovo or QA PC), NOT the desktop. No hub key. Code. Ends at READY with a PR, or HANDBACK; no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-11-10, session 177. **Tasks:** T-339, T-341, T-342. **Tag:** `t339`. **Size:** SMALL (four
source files, four test files). **Base:** the START sha the launcher names (a master that contains this brief).
**Authority:** the backlog (D-145); merge on Atlas's QA ACCEPT, sent to clark. No auth, deps, workflows or hooks.

```text
IMPACT-TARGETS: auditSkills (skills-audit/index.ts), checkHookRegistration (sync/checks.ts), checkCursorRulesCurrent (sync/developer-building-checks.ts), oldStartCommandWarning (bootstrap/index.ts)
```

## What changes

`docs/loops/t339/edits.txt`, 14 edits in 8 files. No new file.

- **T-339, `skills-audit/index.ts` `auditSkills`:** the seat's `<seat>-ops` skill is looked for in `~/.claude/skills` and
  then in `<project>/.claude/skills` (Beam's lives there). Home wins when both exist. The report line already names the
  path used.
- **T-341a, `sync/checks.ts` `checkHookRegistration`:** a duplicate is the same script under two matchers that can fire on
  the same tool call. `matcherTools` reads a matcher as a set of tool names split on `|`; an absent, empty or `*` matcher,
  or one that is not a plain `A|B` list, matches every tool. The live `~/.claude/settings.json` registers
  `cli-recall-trigger.js` under PostToolUse on `Bash|PowerShell` and on `Edit|Write`: disjoint, so no longer an issue.
- **T-341b, `sync/developer-building-checks.ts` `checkCursorRulesCurrent`:** no `.cursor/` directory and no generated rule
  file is `skip` ("not checked ... This is not a pass."), not `issue`. With `.cursor/` present, unchanged.
- **T-342, `bootstrap/index.ts` `oldStartCommandWarning`:** the OLD line keeps `OLD_START_COMMAND_WARNING` as its prefix
  and appends `(an earlier SIA copy: N line(s) differ from the template)` when the file's first line is the template's,
  else `(not SIA's /start: N line(s) differ from the template)`. N counts lines in one file and not the other.

## Existing tests that pin this behaviour (planner read; not simulated)

| file / row | verdict |
|---|---|
| t262-skills-audit SA-3, SA-3b, SA-4, SA-8 (ops in home or absent; temp project has no .claude/skills) | stay green |
| hook-registration.test.ts: pass, "flags the same script registered twice", "collapses path spelling", "two different events", invalid JSON, missing, no hooks | stay green (no matcher = every tool, so the duplicates still overlap) |
| t048-counts hook-registration rows (:180-210) | stay green, same reason |
| fleet-ae-f2 "editing the section without regenerating" (seeds `.cursor/rules`) | stays green |
| import-cmds-i7, i8, i9 M2/M3, r2-l3, r2-l5 (all `toContain`/`not.toContain` the constant, or null) | stay green: the constant is the prefix |
| t161-transcript (its own OLD string) | unaffected |

New rows: T339-1, T339-2 (t262-skills-audit, after SA-8); T341-1..4 (hook-registration.test.ts, after "two different
events"); T341-5, T341-6 (fleet-ae-f2); T342-1, T342-2 (import-cmds-i9).

## Steps

1. **Shell.** Windows host: PowerShell, `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `$env:NO_COLOR='1'`.
   Linux host: bash, `export NO_COLOR=1`, and use `cp` where a step says `Copy-Item` (backups under `/tmp`). Either way
   `node -v` must print `v22.*`. Say which host you are on.
2. **Branch.** In the clone at START: `git checkout -q -b build/t339`. HEAD must equal START and the porcelain must be
   empty. In `open-brain`: `npm ci` (exit code), then `node -e "require('better-sqlite3')"`; on "Could not locate the
   bindings file" run `npm rebuild better-sqlite3` and say so. Run every `apply.cjs` from the CLONE ROOT.
   - **Forbidden:** stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/`, `scripts/setup.mjs`, `git config` writes, any MCP config, `npm install`,
     and anything under `docs/`.
3. **Apply.** `node docs/loops/t339/apply.cjs . docs/loops/t339/edits.txt` must print exactly
   `APPLIED 14 edits to 8 files`. In `open-brain`: `npx tsc --noEmit` (exit 0),
   `npx tsc -p tsconfig.tests.json --noEmit` (exit 0), `npm run build` (exit 0).
4. **The six files.** In `open-brain`:
   `npx vitest run tests/t262-skills-audit.test.ts tests/pipelines/sync/hook-registration.test.ts tests/pipelines/sync/t048-counts.test.ts tests/pipelines/fleet-ae-f2.test.ts tests/pipelines/import-cmds-i9.test.ts tests/pipelines/import-cmds-i7.test.ts --no-file-parallelism --testTimeout=180000`.
   Expect 0 failed. Paste `Test Files` and `Tests`. A red row here: STOP, `BLOCKED t339 rows <rows>`, with each assertion
   message (expected vs received).
5. **Mutants**, each on the applied tree. Back up once from the clone root (Windows `$env:TEMP`, Linux `/tmp`):
   `open-brain/src/pipelines/skills-audit/index.ts` -> `t339-sa.bak`, `open-brain/src/pipelines/sync/checks.ts` ->
   `t339-ck.bak`, `open-brain/src/pipelines/sync/developer-building-checks.ts` -> `t339-db.bak`,
   `open-brain/src/pipelines/bootstrap/index.ts` -> `t339-bs.bak`.
   For each `docs/loops/t339/mN.txt` (m1-m6): apply (must print `APPLIED 1 edits to 1 files`), run step 4's command,
   paste the failed rows, restore that file from its backup (never git checkout). Predicted red (NOT simulated):
   m1 T339-1; m2 T341-1; m3 "flags the same script registered twice", "collapses path spelling", t048 "a duplicate is
   still an issue" and T341-3; m4 T341-5; m5 T342-2; m6 T342-1.
   **A mutant with NO red row is a STOP** (`BLOCKED t339 <m> survives`). Other differences from the prediction are not
   a STOP: paste the rows and go on; the planner rules. After the last restore, rerun step 4: 0 failed.
6. **Full suite**, in `open-brain`: `npx vitest run --no-file-parallelism --testTimeout=180000` (60-minute cap). Expect 0
   failed, subject to T-292's flake rule: a red row alongside `Timeout calling onTaskUpdate` or a hook timeout is rerun
   alone up to 3 times, pasting every run. Paste `Test Files`, `Tests`, and the whole `Unhandled Errors` section if any.
   A red `tests/harness/checks.test.ts` D4 is not a STOP: paste its last stderr line and go on; CI judges it. Any other
   red row: STOP, `BLOCKED t339 suite <rows>`, with each assertion message. (Most likely source if one appears: a sync
   test that counts severities on a temp project with no `.cursor/`, now `skip` where it was `issue`.)
7. **Sync.** From the clone root: `node open-brain/build/cli.js sync 2>&1 | grep -E "module-boundary|retirements|hook-registration|cursor-rules-current"`
   (Windows: `Select-String -Pattern "module-boundary|retirements|hook-registration|cursor-rules-current"`). Paste every
   line; module-boundary and retirements must be `[pass]`; the other two are pasted, not judged.
8. **Commit.** One commit, `T339: ops skill in the project; /sync false issues; OLD /start says which (T-339, T-341, T-342)`.
   - Stage exactly the 8 paths: `open-brain/src/pipelines/skills-audit/index.ts`, `open-brain/src/pipelines/sync/checks.ts`,
     `open-brain/src/pipelines/sync/developer-building-checks.ts`, `open-brain/src/pipelines/bootstrap/index.ts`,
     `open-brain/tests/t262-skills-audit.test.ts`, `open-brain/tests/pipelines/sync/hook-registration.test.ts`,
     `open-brain/tests/pipelines/fleet-ae-f2.test.ts`, `open-brain/tests/pipelines/import-cmds-i9.test.ts`.
   - The message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   - No git identity on the host and `git config` writes forbidden: commit with GIT_AUTHOR_*/GIT_COMMITTER_* env vars
     (Forge, melvenac@gmail.com).
   - `git log --oneline <START>..HEAD` shows 1 line and the status is empty (if anything else shows, paste it and STOP).
   - `git diff --name-status <START>..HEAD` shows those 8 paths, all `M`.
9. **Push and open the PR**, only on a host that can push. A host that cannot push (the Lenovo, read-only token) stops
   after step 8 and replies `HANDBACK t339 <sha40>`; the planner lands the commit with `job.mjs land`. Do not try to push there.
   - Push, never force. `git ls-remote origin refs/heads/build/t339` must equal HEAD.
   - `gh pr create --base master --head build/t339 --title "T339: ops skill in the project; /sync false issues; OLD /start says which (T-339, T-341, T-342)" --body "Brief: docs/loops/t339-brief.md."`.
   - Then `gh pr checks <n> --watch --interval 30` (cap 30 min). Paste every check's name and conclusion.

## Reply

- **First line:** `READY t339 <sha40> PR #<n>`, `HANDBACK t339 <sha40>` (no-push host, steps 1-8 all passed) or
  `BLOCKED t339 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild.sh <mergesha>`. Live checks, read-only: (1) `node open-brain/build/cli.js sync` in this planner tree prints
hook-registration `[pass]` against the live `~/.claude/settings.json`; (2) `skills-audit` in `~/Projects/openlaser` (Beam)
names `.claude/skills/beam-ops` as ops; (3) fleet's `/start` is current since cd36fee, so the OLD line is checked on the
next repo whose copy is behind.
