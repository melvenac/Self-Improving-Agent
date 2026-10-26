# SIM T284: a tracked commit-msg hook stamps the Claude Code session - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-26, session 174. **Task:** T-284 (P3). **Tag:** `sim-t284`. **Authority:** Aaron at the
planner's desk, 2026-10-26: "Stamp uuid, tracked hook".

## What is measured

/end attributes commits by their `Claude-Session:` trailer (end-record-guard.ts, handoff-guard.ts read
`%(trailers:key=Claude-Session)`), and since T-276 a session's own uuid counts as its value. The trailer is written by
the agent today, which is prompt level. A tracked `.githooks/commit-msg` makes it deterministic:
- when `CLAUDE_CODE_SESSION_ID` holds a uuid (hex digits and dashes only) and the message has no `Claude-Session:`
  trailer, `git interpret-trailers --in-place --trailer "Claude-Session: <uuid>"`; otherwise it leaves the message alone
  (a person's commit, a session that already wrote its trailer, or a variable that is not a uuid).
- `scripts/setup-hooks.mjs` gains `COMMIT_HOOKS_PATH` and a pure `commitHooksPlan(current)`; `scripts/setup.mjs` sets
  `core.hooksPath=.githooks` only when it is unset (one pointing elsewhere is left alone and reported).

Files under `docs/loops/t284/`: `commit-msg` (new file, goes to `.githooks/commit-msg`, executable),
`t284-commit-msg-hook.test.ts` (new file, goes to `open-brain/tests/t284-commit-msg-hook.test.ts`; C0-C4, S1),
`edits.txt` (4 edits in 2 files), `m1.txt` (no existing-trailer check), `m2.txt` (no uuid check), `m3.txt` (setup
overwrites another hooksPath), `apply.cjs`.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The two files" means, from `open-brain`:
`npx vitest run tests/t284-commit-msg-hook.test.ts tests/setup-hooks.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). Print `git --version`. In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of every file under `docs/loops/t284/`.
c. Baseline: `Copy-Item docs/loops/t284/t284-commit-msg-hook.test.ts open-brain/tests/t284-commit-msg-hook.test.ts`.
   Run the two files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
d. Apply: from the clone root, `New-Item -ItemType Directory .githooks`,
   `Copy-Item docs/loops/t284/commit-msg .githooks/commit-msg`, `git add --chmod=+x .githooks/commit-msg` (staging only,
   no commit), then `node docs/loops/t284/apply.cjs . docs/loops/t284/edits.txt` (paste output). Paste
   `git ls-files -s .githooks/commit-msg`. `node --check scripts/setup.mjs` and `node --check scripts/setup-hooks.mjs`
   (exit codes). In `open-brain`: `npx tsc -p tsconfig.tests.json --noEmit` (exit code and any error lines).
e. Run the two files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/harness tests/shared tests/setup-hooks.test.ts tests/t284-commit-msg-hook.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes). Paste the `Test Files`, `Tests` and any
   `Errors` lines and every `x` row. Red rows alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts: re-run
   each such file alone and paste both.
g. Mutants, on the applied tree. Back up once: `Copy-Item .githooks/commit-msg "$env:TEMP\t284-hook.bak"`,
   `Copy-Item scripts/setup-hooks.mjs "$env:TEMP\t284-sh.bak"`. For each of m1..m3:
   `node docs/loops/t284/apply.cjs . docs/loops/t284/<m>.txt` (paste output); run ONLY
   `npx vitest run tests/t284-commit-msg-hook.test.ts --no-file-parallelism --testTimeout=180000`; paste the `Tests`
   line and every `x` row; restore both from their backups with `Copy-Item ... -Force`. After m3's restore, run the two
   files once more and paste the `Tests` line.
h. One measurement: in a temp dir, `git init -q`, then with `$env:CLAUDE_CODE_SESSION_ID` as this run has it (print
   whether it is set, and its length only, never the value), commit one file with
   `git -c user.name=t -c user.email=t@example.invalid -c core.hooksPath=<clone>/.githooks commit -q -m "probe"` and
   paste `git log -1 --format=%B` with the uuid replaced by `<uuid>`. This shows the hook under the runner's real env.

## Predicted

- c: red C0 (not tracked), C1 (no hook) and S1 (no plan function); C2, C3 and C4 green (guards: no hook leaves the
  message alone). setup-hooks.test.ts green.
- d: `APPLIED 4 edits to 2 files`; `100755` in the ls-files line; both `node --check` and tsc exit 0.
- e and g's final run: 0 failed.
- m1 -> C3 only. m2 -> C4 only. m3 -> S1 only.
- h: the message ends `Claude-Session: <uuid>` if the variable is set in this run.

## Reply

First line: `READY sim-t284 <HEAD sha8> ALL PASS` only if every prediction held and f has 0 rows red alone. Otherwise
`READY sim-t284 <HEAD sha8> MISMATCH` and list each step that differed, with the full assertion message of every red
row. Always include step h's output. Every number is pasted output, with its command.
