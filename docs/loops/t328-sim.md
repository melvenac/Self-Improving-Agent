# SIM T328: the gitignore merge keeps the project's own exceptions - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-28, session 175. **Task:** T-328 (P3). **Tag:** `sim-t328`. **Base:** the START sha the
launcher names (origin/master `112db8d1` or later, containing this file). **Authority:** D-145 (work the backlog by
priority); the defect was seen in both 10-27 adoptions (foundry, worth-it), fixed there by hand.

```text
IMPACT-TARGETS: mergeTemplateFiles (bootstrap/index.ts; shared by `bootstrap scaffold` and `state import --commit`)
```

## What is measured

`mergeTemplateFiles` appends the template gitignore's missing rules under one SIA header. git takes the LAST matching
pattern, so the block's `.env` / `.env.*` landed after a project's own `!.env.example` and silently re-ignored it
(`git check-ignore -v --no-index .env.example` -> `.gitignore:49:.env.*` in foundry). Tracked copies stay tracked,
but a new or renamed template is ignored, which matters most for foundry, a template repo.

**Fix chosen (smallest deterministic):** after the SIA block, re-append the owner's own `!` exception lines under a
second header, `# --- the project's own exceptions, re-applied after the SIA block (T-328) ---`. Only for
`.gitignore`; de-duplicated; exceptions under `.agents/` are left out, because the SIA block decides what in
`.agents/` is tracked (an owner's `!.agents/...` would otherwise re-include session logs the block keeps local). No
exceptions in the owner's file -> no second block, byte-identical to today. Idempotent: a second merge finds every
template rule present and skips, as today.

**Rejected:** dropping `.env`/`.env.*` from the template. They are the template's default secret guard for a fresh
install (a project with no .gitignore gets the template as-is, `G1`), and they date from the loop-4 template seed
(b492fd81). Removing them would leave a fresh project with no env rule at all; the defect is the ordering, not the rule.

Files under `docs/loops/t328/`:
- `t328-gitignore-negations.test.ts`: new file, goes to `open-brain/tests/pipelines/t328-gitignore-negations.test.ts`.
  E1-E5 call `mergeTemplateFiles(root, defaultTemplateDir())` on a fresh `git init` temp dir and read the result with
  `git check-ignore -q --no-index`.
- `edits.txt`: 2 edits in 1 file, `open-brain/src/pipelines/bootstrap/index.ts`: the exported helper
  `ownerNegationsToReapply`, and the merge's write line gaining the exceptions tail.
- `m1.txt` (no exceptions re-applied), `m2.txt` (`.agents/` exceptions not filtered), `m3.txt` (exceptions written
  BEFORE the SIA block), `apply.cjs`.

Planner pre-check (desktop, plain git, no code run): a hand-built merged file with the template block after
`.env*`/`!.env.example` ignores `.env.example` (baseline); with `!.env.example` re-appended after the block,
`.env.example` is not ignored, `.env.local` and `.agents/SESSIONS/Session_1.md` stay ignored, `.agents/state.json`
stays tracked.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `state-import-t297s2.test.ts` G1 (no .gitignore -> created from the template) | stays green | The `created` branch is untouched. |
| `state-import-t297s2.test.ts` G2 (owner `node_modules/` -> one SIA header) | stays green | No owner exceptions -> no second block; `split(SIA header)` is still length 2. |
| `state-import-t297s2.test.ts` G3 (failed import restores the owner's file) | stays green | Restore path untouched. |
| `bootstrap-fix.test.ts` (owner `node_modules/\n.agents/`, startsWith) | stays green | No `!` lines; the owner's lines still lead the file. |
| `import-cmds-r2-l1.test.ts` (fixture already carries every rule) | stays green | `missing` is empty -> skipped before the new code. |
| `t297-s3-working-tree.test.ts` W4 (template file content) | stays green | The template file is unchanged. |

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The four files" means, from `open-brain`:
`npx vitest run tests/pipelines/t328-gitignore-negations.test.ts tests/pipelines/state-import-t297s2.test.ts tests/pipelines/bootstrap-fix.test.ts tests/pipelines/import-cmds-r2-l1.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of every file under `docs/loops/t328/`.
c. Baseline: `Copy-Item docs/loops/t328/t328-gitignore-negations.test.ts open-brain/tests/pipelines/t328-gitignore-negations.test.ts`.
   Run the four files. Paste the `Test Files` and `Tests` lines and every `x` row with its file and assertion message.
d. From the clone root `node docs/loops/t328/apply.cjs . docs/loops/t328/edits.txt` (paste output). In `open-brain`:
   `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error
   lines.
e. Run the four files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/pipelines tests/t154-cli-start.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes, or background to a log file and wait). Paste
   the `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the assertion message. Red rows
   alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts (known flaky: hub-presence, state-import-r4,
   end-fix-q3, t159-fast-path N3, record-erasure R179): re-run each such file alone up to 3 times and paste every run.
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|retirements|mirror-parity|command-tool-names"`
   and paste every line. A `mirror-parity` or `command-tool-names` line that names only `~\.claude` or `~\.cursor`
   copies is environment, not this change: say so and go on.
h. Mutants, on the applied tree. Back up once:
   `Copy-Item open-brain/src/pipelines/bootstrap/index.ts "$env:TEMP\t328-bs.bak"`. For each of m1..m3:
   `node docs/loops/t328/apply.cjs . docs/loops/t328/<m>.txt` (paste output); in `open-brain` run
   `npx tsc --noEmit` (paste exit code), then ONLY
   `npx vitest run tests/pipelines/t328-gitignore-negations.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and every `x` row; restore with
   `Copy-Item "$env:TEMP\t328-bs.bak" open-brain/src/pipelines/bootstrap/index.ts -Force`. Never use `git checkout` to
   restore here. After m3's restore, run the four files once more and paste the `Tests` line.

## Predicted

- c: red E1, E4, E5 in t328-gitignore-negations.test.ts only (E2 and E3 are green pins: no-exceptions output and
  idempotence are today's behaviour); every other row in the four files green.
- d: `APPLIED 2 edits to 1 files`; all three exit 0.
- e, f and h's final run: 0 failed.
- g: `module-boundary [pass]`, `retirements [pass]`.
- h: each mutant tsc exit 0. m1 -> E1, E4, E5. m2 -> E4. m3 -> E1, E4, E5.

## Reply

First line: `READY sim-t328 <HEAD sha8> ALL PASS` only if every prediction held, f has 0 rows red alone, and g shows
`module-boundary [pass]` and `retirements [pass]`. Otherwise `READY sim-t328 <HEAD sha8> MISMATCH` and list each step
that differed, with the full assertion message of every red row. Every number is pasted output, with its command.

## After merge (not this run)

sia-rebuild. foundry and worth-it were fixed by hand on 10-27 (their negations re-appended after the block); nothing
to redo there. The next adoption's `.gitignore (merged)` shows the exceptions block when the owner had any.
