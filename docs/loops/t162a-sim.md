# SIM T162A: `open-brain rematch` adds a first MATCH: line to a lesson that has none - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-26, session 175. **Task:** T-162 slice A (P2). **Tag:** `sim-t162a`. **Base:** the
START sha the launcher names (an origin/master containing this file and T-322's merge `ea3dd365`). **Authority:**
D-145 (work the backlog by priority) and D-163 (planner launches); the slice is the planner's T-162 proposal recorded
at rev 589.

```text
IMPACT-TARGETS: rematch, runMemoryCommand (pipelines/store/rematch.ts gains an add path; cli-memory.ts's rematch branch prints it)
```

## What is measured

T-162: lessons 292 (mutation-testing-verify-the-mutation-landed) and 604 (a-mutant-that-does-not-type-check-is-not-a-
valid-mutant) were stored before D-155 and have NO `MATCH:` line, so the recall trigger can never inject them. T-322's
`rematch` refuses a note with 0 MATCH lines (row K4f), so there is no supported way to key them without `ob_forget`,
which loses their counts.

After this slice, `rematch --id <n> --match <value>`:
- **adds** one `MATCH: <value>` line when the note AND the indexed content both have exactly 0 MATCH lines (`added:
  true`, `before: null`), keeping the note's own line ending and every other byte, then re-indexes through
  `indexKnowledge` (counters, recall_count, last_recalled_at, created_at and the id kept) and the CLI refreshes the
  trigger key sidecar, exactly as the rewrite path does;
- places the line as the LAST line of the body, or, when the note has a `## Log` line, at the end of the current value
  before the log (the log holds what is no longer true; the index of a state row is its current value only, T-022).
  `keys-writer`/`match-keys` find the line anywhere (`^MATCH:` multiline / first matching line), so position is a
  convention, not a parse rule; end-of-body touches no existing byte;
- **refuses** `--match none` on a 0-line lesson: with no key it is already lookup-only (server.ts: "lookup-only: no
  MATCH: line"), so there is nothing to add. Refused rather than reported `unchanged` because `unchanged` carries a
  `before` line this lesson does not have, and an exit 0 would hide that the caller may have meant a real key;
- **refuses** a note and an index that disagree (one line against none, either way), and 2+ lines in either, as today;
- keeps T-322's rewrite path byte-for-byte (rows K1-K6, C1-C3).

Files under `docs/loops/t162a/`:
- `t162a-rematch-add.test.ts`: new file, goes to `open-brain/tests/t162a-rematch-add.test.ts`. A1-A7 (module), C4
  (CLI through tsx with `KNOWLEDGE_V2_DB` on a temp store).
- `edits.txt`: 7 edits in 4 files: `open-brain/src/pipelines/store/rematch.ts` (header, result type gains `added` and a
  nullable `before`, `matchLines` + `appendMatchLine` replace `oneMatchLine`, the body), `open-brain/src/cli-memory.ts`
  (the rematch branch prints `added: "<line>"` / `would add (dry run, nothing written)`), `open-brain/src/cli.ts` (usage
  text only; flags unchanged), `open-brain/tests/t322-rematch.test.ts` (K4f's title only).
- `m1.txt`..`m6.txt` (mutants), `apply.cjs`.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `t322-rematch.test.ts` K4f "no MATCH: line refuses" (seeds 0 lines, runs `none`) | title edited in d; stays green | `none` on 0 lines still refuses, and the new message keeps "has 0 MATCH: line(s)". The title now names `--match none`, because a real key on 0 lines is now added. |
| `t322-rematch.test.ts` K4b (2 lines) | stays green | Refused by the new 2+ check; the message keeps "has 2 MATCH: line(s)". |
| `t322-rematch.test.ts` K1-K3, K4a, K4c-K4e, K5, K6, C1-C3 | stay green | The rewrite path is unchanged; `added: false` is an extra key under `toMatchObject`; C1's `rewritten: "<old>" -> "<new>"` line is unchanged. |
| `tests/shared/cli-args.test.ts` (LINES table: `rematch` usage line) | stays green | Only the description text changes; the line still documents exactly `--id`, `--match`, `--dry-run`. |
| `tests/t261-s2.test.ts` R1-R4 | stays green | rematch.ts and cli-memory.ts are memory side; no new import. |
| `tests/trigger/t170-match-keys.test.ts` | stays green | `writeTriggerKeys` and `parseCommandKey` unchanged. |

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The five files" means, from `open-brain`:
`npx vitest run tests/t162a-rematch-add.test.ts tests/t322-rematch.test.ts tests/shared/cli-args.test.ts tests/t261-s2.test.ts tests/trigger/t170-match-keys.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). `git merge-base --is-ancestor ea3dd365 HEAD` must exit 0. In
   `open-brain`: `npm ci`, then `node -e "require('better-sqlite3')"` (on "Could not locate the bindings file":
   `npm rebuild better-sqlite3` and say so).
b. Print the sha256 (first 16 hex) of every file under `docs/loops/t162a/`.
c. Baseline: `Copy-Item docs/loops/t162a/t162a-rematch-add.test.ts open-brain/tests/t162a-rematch-add.test.ts`. Run
   the five files. Paste the `Test Files` and `Tests` lines and every `x` row with its file and assertion message.
d. From the clone root `node docs/loops/t162a/apply.cjs . docs/loops/t162a/edits.txt` (paste output). In `open-brain`:
   `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error
   lines.
e. Run the five files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/shared tests/trigger tests/pipelines/sync tests/server.test.ts tests/t261-s2.test.ts tests/t294-small-fixes.test.ts tests/t322-rematch.test.ts tests/t162a-rematch-add.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes, never the 10-minute default). Paste the
   `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the assertion message. Red rows
   alongside T-292's `Timeout calling onTaskUpdate` or a timeout: re-run each such file alone up to 3 times and paste
   every run. `tests/harness/s4-guards.test.ts` is NOT in this run (D1b is red on any uncommitted new test file in a SIM).
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|retirements"`
   and paste every line.
h. Mutants, on the applied tree. Back up once:
   `Copy-Item open-brain/src/pipelines/store/rematch.ts "$env:TEMP\t162a-rm.bak"`. For each of m1..m6:
   `node docs/loops/t162a/apply.cjs . docs/loops/t162a/<m>.txt` (paste output); run ONLY
   `npx vitest run tests/t162a-rematch-add.test.ts --no-file-parallelism --testTimeout=180000`; paste the `Tests` line
   and every `x` row; restore with `Copy-Item "$env:TEMP\t162a-rm.bak" open-brain/src/pipelines/store/rematch.ts -Force`.
   Never use `git checkout` to restore here. After m6's restore, run the five files once more and paste the `Tests` line.

## Predicted

- c: in t162a-rematch-add.test.ts all 8 rows red (A1-A4 and A7: the call returns `ok: false` with "has 0 MATCH:
  line(s)"; A5: refused, but the message lacks "they disagree"; A6: refused, but the message lacks "already
  lookup-only"; C4: the CLI exits 1 with `rematch refused`). Every row in the other four files green (K4f included).
- d: `APPLIED 7 edits to 4 files`; all three exit 0.
- e and h's final run: 0 failed.
- f: 0 failed.
- g: `module-boundary [pass]` and `retirements [pass]`.
- m1 (index not updated on an add) -> A1, A3, A4 and C4. m2 (`## Log` ignored) -> A4. m3 (LF forced) -> A3.
  m4 (disagreement not refused) -> A5. m5 (`none` added on a 0-line lesson) -> A6. m6 (dry run ignored on an add) -> A7.

Planner pre-checks on the desktop (no tests run): every edit and each mutant applies exactly once on origin/master
(`APPLIED 7 edits to 4 files`; m1-m6 `APPLIED 1 edits to 1 files`), esbuild parses the four resulting files, and the
append placement function was checked against A1, A3 and A4's expected bytes.

## Reply

First line: `READY sim-t162a <HEAD sha8> ALL PASS` only if every prediction held, f has 0 rows red alone, and g shows
both `[pass]`. Otherwise `READY sim-t162a <HEAD sha8> MISMATCH` and list each step that differed, with the full
assertion message of every red row. Every number is pasted output, with its command.

## After the build (not this run)

On the desktop, after merge and rebuild: key 292 and 604 on the mutant-apply act with
`node <main>/open-brain/build/cli.js rematch --id 292 --match "command: <key>" --dry-run` (the key in backticks, e.g.
apply.cjs), then the real run, and confirm both ids appear in `recall-trigger-keys.json`'s `keys`. The exact key text is the planner's call at that
point (T-162 note).
