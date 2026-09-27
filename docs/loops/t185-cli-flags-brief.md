# T-185: an unrecognised flag refuses, in every open-brain subcommand. Brief for a FRESH developer session (record 117)

**By:** Atlas (planner), record session 109 · 2026-09-26. **To:** the Claude developer seat (Forge), **record session
117**, a fresh session (D-035) in **`~/Worktrees/sia-infra`**. **Authority:** Aaron's word in session 109 ("yes", to
the planner's pick of T-185 for sia-infra). **Starting the session is Aaron's act.** Merging stays his (D-019).

## 1. Why

T-150's rule is that an unrecognised CLI flag must refuse, not select the mutating default. It was applied to `state
import` only (importer round 2, R2-4). Round 2's developer read the other subcommands and found the same shape. That
table is in `docs/loops/importer-fixes-r2-developer-handoff.md` on `origin/loop/importer-fixes-r2`, around line 129,
at `aba35de`, and it was **read, not run**:

| Site | Command | Mutates? | The typo that does the real thing |
|---|---|---|---|
| `cli.ts:54` | `sync` | yes: without `--check` it applies fixes | `sync -check` takes `-check` as the directory, walks up from the cwd, and **runs the fixing sync**. `--chek` is ignored silently, with the same result. |
| `cli.ts:166` | `start` | yes: it creates a session log | The first non-`--` token becomes `projectRoot` directly: no existence check and no walk-up. |
| `cli.ts:285` | `detach` | yes: a git checkout | `detach -dry-run` **runs a real detach**. `--dry-rn` is ignored, with the same result. |
| `cli.ts:333` | `state migrate` | yes | `-dry-run` is taken as a file to migrate, and `--dry-rn` is ignored. **The files are migrated for real.** |
| `cli.ts:369` | `state show` | no | A stray token reads a different project. Read-only. |

The line numbers are at `aba35de`. Re-derive them on your base.

## 2. The work

**T185-1: one argument rule, shared.** Every subcommand declares the flags it accepts. Any token starting with `-`
that is not declared (single or double dash, misspelled or foreign) **refuses with exit 2**. The refusal names the
token and lists the command's flags, and nothing is written. A positional that must be a directory is checked to
exist, with no silent walk-up from a path that does not exist. Reuse `state import`'s R2-4 implementation if it
generalises, or move it into a shared helper, and say which you did. `state import`'s behaviour must not change.
- **Search** `cli.ts` and every other entry point that parses `process.argv` (the hook entry points and the build CLIs
  included), and **list every parser you found** in the handoff. For each, give the command, whether it mutates,
  whether it now refuses, and, where it does not, why. This list is the deliverable, as R3-1's rmSync list was.
- `--help` and `-h`, where they exist today, keep working.

**T185-2: tests, red first.** For each mutating command in the table: `-dry-run` (or `-check`) and one misspelled
`--` flag. Each exits 2, names the token, and leaves the target byte-identical (for `detach`, HEAD and the working
tree unchanged; for `sync`, no file touched). Also: every documented flag of every command is still accepted (a test
that walks each command's declared flags), so a declaration typo cannot lock a flag out.

**Out of scope:** changing any flag's meaning, and the `state import` door. **Hands off:** the importer's own code in
`state-import/` and its section of `cli.ts`. Importer round 4 (record 116) is working there in `sia-builder` at the
same time. If T185-1's shared helper needs a change at `state import`'s call site, stop and tell atlas first.

## 3. Start

1. `/start`. Your record number is **117**. The greeting's number is local (T-164).
2. `git fetch origin && git switch -c loop/t185-cli-flags origin/master` (master is `8af41dd` or later).
3. `npm ci && npm run build` in `open-brain`.
4. **Read ONLY:** this brief, the table above in round 2's handoff, R2-4 in `importer-fixes-round-2-brief.md`, and
   `cli.ts`.

## 4. How

- **Red first with your own tests**, on master, as `loop/t185-redcheck`. Read that run on tcm per test. A row red for the
  wrong reason (for example, a test that fails because the command did the real thing to a fixture it then cannot
  find) does not count.
- **A code mutant per protection** (at least: the shared refusal removed, one command's declaration widened to accept
  anything, and the directory-existence check removed), each on `loop/t185-mut-<name>` and batched on tcm. `npx tsc
  --noEmit -p .` before every push and on every mutant.
- CI on **tcm** (D-040). CA-9 is red there (T-182), and it is not yours.
- **No full local suite** (the planner's ruling: this box is never quiet).
- **Tests must never run a real `detach` or a fixing `sync` against this repository.** Use scratch repositories under
  the OS temp dir only. A test that could reach the real checkout on a failure is itself a defect.
- Push only `loop/t185-cli-flags` and `loop/t185-*`. Never master, never force, and read back each push. On a refusal or
  a denied command, stop and tell atlas.

## 5. Hand back

`docs/loops/t185-developer-handoff.md`, with:
- a commit table built from each commit's own `git diff --stat`;
- T185-1's parser list;
- the red run, the green run and every mutant with its run id;
- every existing test whose assertion changed, and why;
- your model and effort, read from your own transcript.

Then name the frozen SHA. No `/end` (T-163). Message atlas by SendMessage when it is pushed.
