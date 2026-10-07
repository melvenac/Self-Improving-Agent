# IMPORT-CMDS: the import path installs SIA's session commands (brief)

**By:** Atlas (planner), session 164, 2026-10-07. **Developer:** cursor-builder. **Freeze path:** yes. The Makerspace
import (`docs/loops/makerspace-import-brief.md`, step 6) needs it.

## The gap, read at master `c972a073`

- `bootstrap check` reports `PRE-STATE` for a project with `.agents/TASKS/` and no `state.json`
  (`open-brain/src/pipelines/bootstrap/index.ts:125`). `/bootstrap` then skips to the import.
- `bootstrap scaffold` **throws** on pre-state (`index.ts:328`). So the four session commands (`start`, `end`, `task`,
  `sync`, `index.ts:288-291`) are **never installed** on the import path.
- A pre-record project keeps its OLD `.claude/commands/start.md` and `end.md`. Those take precedence over the global
  ones and never call `ob_start`/`ob_end`. **The import can succeed while `/start` still runs the old protocol**, and
  nothing reports it. Today's only defence is a manual step in the Makerspace brief.

## Build

- **C1. Detect.** `bootstrap check` lists every project `.claude/commands/{start,end,task,sync}.md`, each as `SIA`
  (byte-identical to `project-template/`), `OLD` (present and different) or `absent`. If any is `OLD` or `absent`, the
  `Next:` line names C2 after the import.
- **C2. Install.** A new subcommand, `bootstrap install-commands`:
  - **Refuses unless `state.json` is a valid record**, so it runs after the import, never before.
  - **Refuses on a dirty tree.**
  - Moves each `OLD` file to `.agents/archive/pre-bootstrap-commands-<date>/` (local), then copies the template's.
  - Leaves `SIA` files alone, and touches no other file under `.claude/`.
  - Prints each file's before and after state.
- **C3. `bootstrap.md`.** One step after step 7 (the owner's `--commit`): run `install-commands` when `check` says so.
  Edit only `project-template/.claude/commands/bootstrap.md`. The installed copy in `~/.claude/commands/` is Aaron's to
  update.
- **C4. `ob_start` warns.** When `state.json` is valid but `.claude/commands/start.md` exists and is not the SIA
  version, the briefing prints one line: `OLD /start in this project: run bootstrap install-commands`.

## Acceptance (temp repos only)

| # | Fixture | Expect |
|---|---|---|
| I1 | Pre-state repo with old `start.md` + `end.md` | `check` lists both `OLD`, plus `task`/`sync` `absent`; `Next:` names install-commands after the import |
| I2 | I1 before import | `install-commands` refuses (no record), writes nothing |
| I3 | I1 after `state import --commit` | installs 4; the 2 old files are in the archive; byte-identical to the template |
| I4 | Re-run on I3 | no-op, exit 0 |
| I5 | Dirty tree | refuses, writes nothing |
| I6 | A project `.claude/commands/other.md` and `settings.local.json` | untouched |
| I7 | I3 minus the install (valid record, old `start.md`) | the `ob_start` briefing has the OLD /start line; after install it is gone |
| I8 | Windows: CRLF old files, a path with a space | I1, I3 and I7 pass |
| I9 | Mutants: install runs without a record; OLD is treated as SIA; the C4 line is removed | each turns a named test red; red-first branches with CI run ids |

**Constraints:** only `open-brain/src` (bootstrap pipeline, cli-bootstrap, the session-start render), its tests,
`project-template/.claude/commands/bootstrap.md` and `CHANGELOG.md`. No HEAVY runs, one test file per vitest run, no
real DB or vault. Merge is Aaron's word after QA.
