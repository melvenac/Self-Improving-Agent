# T-294 amendment 1: `trigger-keys` joins the CLI's declared commands properly; resume in the same clone

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC one-off, the SAME clone as the first run (`C:\Users\Aaron Melven\Worktrees\oneoff-t294`). Code. Ends at
READY with a PR, no merge.
REPLY: an ABSOLUTE path under the user's %TEMP% named t294-a1-reply.md (a launcher's reply path wins). Print it FIRST.

**By:** Atlas (planner), 2026-10-15, session 171. **Amends:** `docs/loops/t294-small-fixes-brief.md` (base b64230e9).
Everything there stands except what this file changes. **Tag:** `T-294`.

## Ruling

The first run stopped correctly. Ruling 3 added a sixteenth `COMMAND_SPECS` entry, and `tests/shared/cli-args.test.ts`
walks every entry. It hard-codes the sorted names, and it requires a usage line for each declared command. The
brief listed that file as "stays green" without reading how it enumerates; that was the planner's miss. A declared
command must be documented, so:

1. **`open-brain/src/cli.ts`, the usage text:** directly after the `scrub-trigger-fires` block (its `Limits:` line),
   add
   `  console.log("  trigger-keys                               Rewrite the recall trigger's key sidecar from the store (T-170)");`.
   It documents no flags, matching `triggerKeys`'s empty spec.
2. **`open-brain/tests/shared/cli-args.test.ts`** (now an allowed existing change):
   - in "walks at least the fifteen commands (proves it looked)", append `"trigger-keys"` as the LAST element of the
     sorted list (after `"topics"`). The row title stays as it is;
   - in `LINES`, add `["trigger-keys", /^\s+trigger-keys(.*)$/m],` after the `scrub-trigger-fires` entry.
3. Step 7's list gains `open-brain/tests/shared/cli-args.test.ts` (nine files).
4. **A5** (`tests/trigger/hook.test.ts`, "the POLICY FILE is what let 299 through"): the run showed it failing once
   under load, and passing 12/12 alone. Nothing on its path changes. If it fails again in step 3 below, rerun
   `tests/trigger/hook.test.ts` alone and paste both runs. Two failures in a row: STOP, `BLOCKED T-294 A5`.

## Steps

1. Resolve and print `$reply` (`t294-a1-reply.md`), the Node path, and `node -v` (must print `v22.*`).
2. `cd` into `C:\Users\Aaron Melven\Worktrees\oneoff-t294`. `git rev-parse HEAD` must be
   `75ebe59bb32f1fe8f0aedf89bc198f8ef2bfe1a1` (commit 1), and the porcelain must list only the seven uncommitted
   files of rulings 1–5 plus hook.test.ts. Anything else: STOP, `BLOCKED T-294 resume state differs`. (If the
   changes are gone, restore them with `git apply %TEMP%\t294-commit2-uncommitted.patch`.)
3. Apply rulings 1–2. Run the brief's step 4 commands (the vitest set, both `tsc` runs, `npm run build`): all green.
4. Commit 2 with the brief's message, then the brief's steps 5–8 (two commits, mutants M1–M5, the name-only diff of
   nine files, push, PR, CI).

## Reply

- **First line:** `READY T-294 <sha40> PR #<n>` or `BLOCKED T-294 <reason>`.
- Then each command with its output. Mark anything not run `NOT RUN`. Do not merge.
