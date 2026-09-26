# T-185 developer handoff: an unrecognised flag refuses, in every open-brain subcommand

**By:** Forge (developer), record session 117 · 2026-09-26. **To:** Atlas (planner). **Brief:**
`docs/loops/t185-cli-flags-brief.md` on `origin/docs/session-100-qa99-dispatch`. **Tree:** `~/Worktrees/sia-infra`,
branch `loop/t185-cli-flags`, based on `origin/master` at `8af41dd`.

**Frozen candidate: `9473b0d`** (`loop/t185-cli-flags`; read back with `ls-remote`). This handoff is committed on top
of it and touches only this file.

**Model and effort:** Claude Opus 5.5 (1M context), model id `claude-opus-5-5[1m]`, read from this session's system
context. Effort: **medium**. That is from the launch prompt ("Effort: medium"), since there is no effort field this
seat can read for itself.

## 1. Commits

Each commit's own `git diff --stat <c>~1 <c>`:

| Commit | Subject | Files |
|---|---|---|
| `905789b` | test(cli): T-185 red first, an unrecognised flag refuses in every subcommand (T185-2) | `tests/cli-flags.test.ts` +261 |
| `598988e` | test(cli): red first, the backfill script row, and the missing-directory sync row without `--check` | `tests/cli-flags.test.ts` +19 −1 |
| `686eef5` | fix(cli): an unrecognised flag refuses in every open-brain subcommand (T185-1) | `src/cli-spec.ts` +53; `src/cli.ts` +48 −34 (82 lines touched); `src/shared/cli-args.ts` +148; `tests/shared/cli-args.test.ts` +179 |
| `9473b0d` | fix(scripts): backfill-success-rate refuses an unrecognised argument before opening the DB (T185-1) | `scripts/backfill-success-rate.mjs` +7 |

All paths are under `open-brain/`. `npx tsc --noEmit -p .` exited 0 at `686eef5` and `9473b0d`, and on every mutant.

## 2. T185-1: what was built

- **A shared helper, not a reuse of R2-4.** R2-4 **is not on master.** At `8af41dd`, `state import` still uses the
  bare `args.slice(2).find((a) => !a.startsWith("--"))` and has no unknown-flag check at all. R2-4 exists only on the
  unmerged importer branches. So there was nothing on the base to generalise. I wrote `src/shared/cli-args.ts` to
  R2-4's rules (any `-` token not declared refuses, more than one directory refuses, a directory that does not exist
  refuses, and an existing one still walks up) plus the harness CLI's value handling. **Nothing in `state import`'s
  section of `cli.ts`, and nothing in `state-import/`, was touched.** Once importer round 4 lands, it can move onto
  the helper. That is a call-site change, so I have left it for you to rule on.
- **`parseArgs(spec, tokens, cwd)` is pure.** It returns `{ok, args}` or `{ok: false, error}`. `cli.ts`'s
  `parseOrRefuse` prints `<command> refused: <error>` and `Nothing was run.` to stderr and **exits 2**. It is called
  as the first statement of each subcommand, before any dynamic import, database open or file read. For `relocate`
  and `topics` it was moved above `openV2Database`.
- **The refusal:** `unrecognised flag "<tok>".` (the plural form lists every unknown token), then `Accepted flags:
  <the command's flags>` (or `(none)`).
- **Declarations** are in `src/cli-spec.ts` (`COMMAND_SPECS`), kept apart from `cli.ts` because `cli.ts` runs on import.
  Each value flag keeps its **existing** form, so no accepted spelling changes: `relocate --from/--to` take both
  `--x v` and `--x=v`, `topics --min` takes only `--min=<n>`, and `state migrate --seat/--last-session-seat` take only
  `--x v`.
- **A read of an undeclared flag throws** (`has("--dry-rn")` → `detach: --dry-rn is not a declared boolean flag`).
  Before this, a typo in the code read as "not given" forever. That is the declaration-typo lock-out the brief names.
- **Exit codes:** 2 is the new usage refusal. Every refusal that already existed keeps its old code (1).

### Behaviour changes worth ruling on

- **`--help` / `-h` on a subcommand now refuse** (exit 2, listing the flags). None of the `cli.ts` subcommands had
  help. At `8af41dd`, `sync --help` **ran the fixing sync** (the T-150 note records this seen live at `5759008`).
  `open-brain` with no command, or with an unknown one, still prints the usage text and exits 1, as before. The
  harness CLI's `--help`/`-h` are unchanged.
- **A malformed value now refuses where it used to fall back.** Examples: `relocate --from` with no value used to
  drop to the read-only detector, `topics --min 3` used to ignore both tokens, and `state migrate --seat` with no
  value used to hit the "REQUIRED" refusal (exit 1). All three now exit 2.
- **`state migrate` no longer drops a file whose name equals the seat value.** The old filter removed every token
  equal to `seat`, so a file named `developer` was skipped. Files are now exactly the positionals.
- **`start <dir>`** keeps its old no-walk-up behaviour and gains only the existence check.

## 3. T185-1: every argv parser found

**Search:** `git grep -n -E "process\.argv|parseArgs\("` over all tracked files except `docs/`, plus a broader
`git grep "\bargv\b"`, plus a filesystem grep of the untracked `.claude/`. **The broad grep found 5 argv sites** (the
hits in `.agents/state.json` are prose). A grep for `process.argv` finds only code that names it. A parser handed
`argv` under another name would be missed, and the broader `\bargv\b` pass is what covers that.

| Entry point | Command | Mutates? | Refuses now? | Why not, if not |
|---|---|---|---|---|
| `src/cli.ts` | `sync` | yes (applies fixes without `--check`) | **yes** | |
| `src/cli.ts` | `start` | yes (a session log) | **yes** | |
| `src/cli.ts` | `relocate` | with `--apply` | **yes** | |
| `src/cli.ts` | `topics` | with `--apply` | **yes** | |
| `src/cli.ts` | `detach` | yes (git checkout) | **yes** | |
| `src/cli.ts` | `state show` | no | **yes** | |
| `src/cli.ts` | `state migrate` | yes | **yes** | |
| `src/cli.ts` | `state import` | yes | **unchanged** | Out of scope (brief §2). At `8af41dd` it has **no** unknown-flag check, so `state import --comit` still runs a draft. R2-4 fixes this on the importer branch. |
| `src/cli.ts` | `state <other>` / no command / unknown command | no | already refuses (usage, exit 1) | Unchanged. `end` appears in the usage text but has no implementation, so `open-brain end` prints usage and exits 1. That was true before, and I have not fixed it here. |
| `src/harness/cli.ts` | `harness run`, `harness schemas` | yes | **already did** (exit 2, `unrecognised argument`) | Unchanged. It was built to T-150 in Loop 15, and its positionals refuse too. |
| `scripts/backfill-success-rate.mjs` | one-off DB backfill | with `--apply` | **yes** (new, exit 2, before the DB opens) | |
| `src/cli-bootstrap.ts` | SessionStart hook (`--ide <name>`) | yes (the active-session slot, only when the payload carries an id) | **no** | The host invokes it with arguments written by `setup.mjs`, not typed by a person. A refusal there exits non-zero at session start, on every session on the machine, over a registration typo. The flag only labels the slot, and the payload's IDE detection overrides it (`detectIde`). **I think refusing does more harm than good here. It is yours to rule.** |
| `src/server.ts` | MCP server | through tools, not argv | **no** | It reads only `argv[1]`, to detect a direct run. It parses no flags, so there is nothing to refuse. |
| `src/cli-session-end.ts`, `src/cli-recall-trigger.ts` | SessionEnd hook, PostToolUse hook | yes | n/a | They read no argv (stdin payload only). The grep found no `argv` in either. |
| untracked `.claude/` (hooks and commands) | | | n/a | No `process.argv` found. The only CLI invocations there are `cli.js sync --score`, which still parses. |

**The documented invocations still parse.** I grepped the tracked tree (excluding `docs/loops/`, `state.json` and
session logs), `.github/`, `project-template/` and `.claude/commands` for `cli.js|open-brain <subcommand> ...`. Every
flag found is declared.

## 4. T185-2: tests

- `tests/cli-flags.test.ts` (20 tests) is end-to-end. It runs `node tsx src/cli.ts ...` with `spawnSync`, so
  **stderr is captured on exit 0 as well**. Each run has its cwd and positional inside a scratch directory under the
  OS temp dir. **`inScratch()` refuses to spawn anywhere else**, so no failure can reach this repository. The
  fixtures are chosen so that at the base the command **does the real thing**. The sync fixture's README version is
  behind `package.json`, so a fixing sync writes to it. The detach fixture is a real clone on `master` that is a
  project root, so a fall-through walks up to it and detaches it. The migrate fixture is a v1 `state.json`. Each
  fixture also has a premise row asserting that property, so "unchanged" cannot pass on a fixture nothing would
  touch. The assertions: exit 2 comes first, then the token named, then `Accepted flags:`, then a byte snapshot of
  the fixture (for detach, also `symbolic-ref`, `HEAD` and `status --porcelain`).
  - `sync`: `-check`, `--chek`, `--help`, `-h`, and a missing directory.
  - `start`: `-dry-run`, `--dry-run`, and a missing directory.
  - `detach`: `-dry-run`, `--dry-rn`, and a missing directory.
  - `state migrate`: `-dry-run` and `--dry-rn`. There is also a guard that the correctly spelled `--dry-run` is still
    a dry run.
  - `state show -json`, `relocate --aply`, `topics --aply`, and `backfill-success-rate.mjs --aply` (the DB file is
    not created).
- `tests/shared/cli-args.test.ts` (34 tests) covers the helper, plus **the walk over every declared flag of all seven
  commands**. Every boolean is accepted and reads true, and every value flag is accepted in each declared form. It
  also checks **the declarations against the usage text the CLI actually prints**, in both directions: every
  documented flag is declared, and every declared flag is documented. It asserts the count of commands walked, and
  that the usage text was captured.
- **Existing tests whose assertions changed: none.** `git diff --diff-filter=M origin/master loop/t185-cli-flags --
  open-brain/tests` is empty. Two files were added, and no existing file was modified.

## 5. Runs

All runs are `workflow_dispatch` on tcm. The runner name comes from each run's log, and the head SHA is confirmed.

| Run | Ref / SHA | Runner | Result |
|---|---|---|---|
| **Red 1** `36209560043` | `loop/t185-redcheck` `905789b` (master plus tests only) | tcm-2 | `cli-flags`: **16 failed / 19**. Every failure is at the exit-2 assertion: sync ×4 exit 0 (the fixing sync ran), sync missing-dir exit 1 (the walk-up reached the fixture and ran a check), start ×3 exit 0, detach ×3 exit 0 (a real detach in the scratch clone), migrate `-dry-run` exit 1, migrate `--dry-rn` exit 0, state show exit 1, relocate exit 0, topics exit 0. The 3 that pass are the two premise rows and the spelled-right migrate guard. Suite: 16 failed / 1037 passed / 1 skipped. |
| **Red 2** `36209870776` | `loop/t185-redcheck` `598988e` (still no source diff against `origin/master`) | tcm-2 | `cli-flags`: **17 failed / 20**. It adds the backfill row (exit 1: it created the DB and then failed). The missing-dir sync row now exits 0, because the walk-up runs the **fixing** sync. Suite: 17 failed / 1037 passed / 1 skipped; Test Files 1 failed / 71 passed. |
| Red, `cli-args.test.ts` | | | **Not run red.** It imports the two new modules, so at the base it fails on import, which is the wrong reason. Its evidence is the mutants below. |
| **Green** `36209923825` | `loop/t185-cli-flags` `9473b0d` | tcm-2 | **success.** Test Files 73 passed. **Tests 1088 passed, 1 skipped (1089).** `cli-flags` 20 ✓, `cli-args` 34 ✓. `onTaskUpdate`/`Unhandled`: 0 lines. |

The brief warns that CA-9 is red on tcm (T-182). **I saw no failure outside my two files in any of these runs.** I did
not look up which test CA-9 names, so I claim nothing about it either way.

**Mutants.** Each is one line off `9473b0d`: `git diff --shortstat` reports 1 file, +1 −1. Each was `tsc`-clean, and
the edit was asserted to have landed exactly once before its commit.

| Mutant | Branch / SHA | Run | Runner | Result |
|---|---|---|---|---|
| The shared refusal removed | `loop/t185-mut-no-refusal` `124b89f` | `36210013456` | tcm-1 | **killed**: 21 failed (every unknown-flag row in both files) |
| `detach`'s declaration widened to accept anything | `loop/t185-mut-detach-widened` `d723b30` | `36210016132` | tcm-1 | **killed**: 2 failed (`detach -dry-run`, `detach --dry-rn`) |
| The directory-existence check removed | `loop/t185-mut-no-dir-check` `0fb6b4a` | `36210018280` | tcm-2 | **killed**: 5 failed (sync, start and detach missing-dir; the helper's missing-dir and file-not-a-dir rows) |
| The undeclared-read throw removed | `loop/t185-mut-undeclared-read-silent` `5f3d543` | `36210020015` | tcm-1 | **killed**: 1 failed (`has() and value() throw ...`) |

The backfill refusal's protection was shown red **locally** by reverting only that source file (exit 1 against the
expected 2), and then on tcm in Red 2.

## 6. Not verified, and seen in passing

- **No full local suite**, per the planner's ruling. Locally I ran only the two new files: 53/53 before the backfill
  row, and both red passes of the detach and backfill rows.
- **Windows was not run in CI** (the `test-windows` job is skipped without `inputs.windows`). The two new files
  passed locally on win32.
- **`node open-brain/build/cli.js sync --check` in this tree reports 1 ISSUE:** `retirements: .agents/SYSTEM/ENTITIES.md
  names dream ... reflection queue (retired 2026-09-15, cut)`. This change does not touch `ENTITIES.md`. I have not
  checked whether the same issue fires on `origin/master` in another tree, so I am reporting it rather than
  classifying it.
- The `cli-bootstrap` ruling (§3) and whether `state import` should adopt the helper after round 4 are both yours.

No `/end` (T-163).
