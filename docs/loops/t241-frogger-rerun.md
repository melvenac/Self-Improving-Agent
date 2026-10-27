# SIM T241: the frogger fresh-install pilot, re-run on current SIA and graded against pilot 1's F1-F15

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits in the SIA clone, NO push anywhere.
Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-26, session 175. **Task:** T-241 (P2), the frogger slice of T-181. **Tag:** `sim-t241`.
**Authority:** Aaron at the planner's desk, 2026-10-26 (transcript 0bbb03c4): "QA PC via bundle". Tag pilot 1 first,
copy a bundle to the QA PC, reset to the pre-migration state and run /bootstrap there as a job, leaving the desktop repo
untouched. Done: tag `frogger-pilot1` on 07640b8, and clark built the mirror from the bundle.

## What this measures

Pilot 1 (2026-09-26, SIA `be7ddfb`) ran `/bootstrap` on frogger and filed 15 findings in
`docs/loops/t181-frogger-pilot-report.md`. The bootstrap-fix loop (`docs/loops/bootstrap-fix-brief.md` and its r2-r4
handoffs) and later work changed `bootstrap.md` and added `open-brain bootstrap check|move-residue|scaffold|install-commands`.
This run repeats pilot 1 from the same starting state, on SIA at START, and grades each finding.

## Inputs on this machine (paths contain a space: always quote them)

- Mirror: `C:/Users/Aaron Melven/mirrors/frogger.git` (bare). `master` = `05ec972` (the project before SIA),
  `sia/bootstrap` = `07640b8` (pilot 1's result), tag `frogger-pilot1`.
- Residue: `C:/Users/Aaron Melven/mirrors/frogger-residue/reflection-queue.json`; its sha256 starts `f038eccc09b949cf1978`.

## Rules

- Writes are allowed ONLY under `$env:TEMP\frogger-rerun` (the frogger clone), `$env:TEMP\frogger-rerun-kb` (a scratch
  knowledge store), and the SIA clone's `open-brain/` (npm ci and the build). Never write to `~/.claude/`, the mirror or
  the residue folder. Never push. No commits in the SIA clone. Commits in the frogger clone happen only where
  bootstrap.md makes one.
- `$env:KNOWLEDGE_V2_DB = "$env:TEMP\frogger-rerun-kb\knowledge-v2.db"` before any OB command, so nothing reaches the
  real store or greeting-metrics file. Create the folder first.
- **OB** means `node "<SIA clone>\open-brain\build\cli.js"`, run from the frogger clone's root unless a step says
  otherwise. Use only this CLI, never the MCP tools.
- **The owner:** bootstrap.md asks the owner at several points. Answer as the owner did in pilot 1 where the report
  shows the answer: approve moving the residue, approve the commits, and if the INBOX needs re-heading, re-head it. Where
  pilot 1 shows no answer, answer "yes". Record EVERY ask in the reply as a row: the step, the question verbatim, the
  answer given. Bootstrap step 7's `state import --commit` is the owner's step: run it yourself and label it
  `OWNER STEP` in the reply.
- At most 2 attempts at any step. A STOP still writes the reply. Every claim is pasted output, with its command.

## Steps

a. **SIA clone.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`;
   `$env:NO_COLOR='1'`. Print `git rev-parse HEAD` and `git status --porcelain` (must be empty). In `open-brain`:
   `npm ci`, then `npm run build` (paste the exit codes and the `build stamped` line).

b. **Starting state.**
   - `git clone "C:/Users/Aaron Melven/mirrors/frogger.git" "$env:TEMP\frogger-rerun"`. In the clone:
     `git checkout -q master`, `git rev-parse HEAD` must print `05ec972…`. Paste `git branch -a`, `git tag`,
     `git log --oneline -3`.
   - `git remote remove origin`, because pilot 1's frogger had no remote and the mirror clone adds one. Paste
     `git remote -v` (empty).
   - `New-Item -ItemType Directory .agents`; copy the residue file to `.agents\reflection-queue.json`; paste
     `Get-FileHash .agents\reflection-queue.json` (must start `F038ECCC09B949CF1978`).
   - Paste `Get-ChildItem -Force -Name`, `git status --short --untracked-files=all` and the first 15 lines of
     `CLAUDE.md` (absent is a fact to report).
   - Compare with pilot 1's step 0: its `.agents/` held only `reflection-queue.json`, and `CLAUDE.md` existed.
     One difference is expected: pilot 1's folder was NOT a git repository (its step 1 ran `git init` and made
     05ec972), and this one is already at 05ec972. Say so in the reply, and grade F7 on what bootstrap.md says to do
     for a folder with no repository, read from its text.

c. **Bootstrap.** Read `project-template/.claude/commands/bootstrap.md` in the SIA clone and follow it step by step
   from Step 1, as the agent it addresses. Run `OB bootstrap check` where it says to, and paste each output in full.
   Follow the `Next:` lines. For each bootstrap step, paste every command and its output. Record each owner ask.
   Stop at Step 9 and paste the summary you would print. If a step cannot be completed, STOP: name the step and paste
   the output.

d. **Fresh `/start` (CLI).** From the frogger clone: `OB start "$env:TEMP\frogger-rerun"`. Paste the whole output.
   This is the report a fresh session's `/start` prints (T-154), and F12, F13 and F15 are graded on it.

e. **Final state.** In the frogger clone: `OB bootstrap check`, `git log --oneline --all --decorate`,
   `git status --short --untracked-files=all`, and `git ls-files .agents .claude CLAUDE.md .gitignore .gitattributes`.
   Paste each.

## Grading (the reply's table)

Grade each finding **FIXED**, **STILL PRESENT** or **N/A**, citing the step and the pasted line it rests on. What each
finding was, from the pilot report:

| # | Pilot 1's finding | FIXED means |
|---|---|---|
| F1 | The bootstrap INBOX template's headings (`## Priority`/`## Backlog`) parse 0 tasks while the draft says "Validates: yes" | The scaffolded INBOX uses P0-P3 headings and the draft parses the tasks written; a 0-task draft prints a WARNING |
| F2 | No bootstrap step produces `state.json` | A bootstrap step runs `state import --draft` then `--commit`, and `.agents/state.json` exists at rev 0 |
| F3 | bootstrap writes inline files while the template has richer ones (two sources of truth) | Files come from one source (`bootstrap scaffold` copies the template) |
| F4 | The command source is misnamed, and a "skip if global" rule installs nothing | Commands are installed into the project's `.claude/commands/` from the template even when global copies exist |
| F5 | An existing `CLAUDE.md` or `.agents/` makes bootstrap a no-op | `check` treats residue-only `.agents/` as RESIDUE and `CLAUDE.md` gets an offered SIA section |
| F6 | bootstrap says to commit files its own gitignore ignores | Scaffold's tracked/local list matches git, and the SIA commit holds exactly the tracked files |
| F7 | `git init` comes last | bootstrap.md has the project committed before scaffolding (from its text, since this folder already had a repo) |
| F8 | No seat identity and no roles | `.agents/AGENT.md` and the four `roles/*.md` stubs are scaffolded and tracked |
| F9 | Staleness "could not tell" and `closed_session = -3` read like bugs at session 0 | The import report and summary no longer print negative sessions; "could not tell" is explained as expected |
| F10 | Line endings: `state.json` and the views would be checked out CRLF | `.gitattributes` has `/.agents/** text eol=lf` (paste it) |
| F11 | The project name comes from `package.json` | Informational: report the name the record shows and where it came from; FIXED only if the draft states its source |
| F12 | `ob_start`'s header line drops the project name (`Project: v0.0.1`) | Step d's header line names `frogger` |
| F13 | "Tree currency" is hard-wired to `origin/master`, which a remote-less repo lacks | Step d says plainly that there is no remote, without implying a failure |
| F14 | The `/start` agent claimed a fact it never checked | N/A: model behaviour, not graded by a CLI run |
| F15 | `start.md` looks for `docs/loops/`, which a fresh install lacks | Step d's "Latest brief" line handles a missing `docs/loops/` without noise |

## Reply

- **First line:** `READY t241 <SIA HEAD sha8> FIXED <n>/15` (n = FIXED rows; N/A rows count toward neither), or
  `BLOCKED t241 <reason>`.
- Then the grading table: `| F# | FIXED / STILL PRESENT / N/A | evidence (step + pasted line) |`, all 15 rows.
- Then the owner-asks table (`| step | question verbatim | answer given |`), and every NEW problem the run hit that
  F1-F15 do not cover, as N1, N2… in the same WRONG / MISSING / CONFUSING / MINOR style as the pilot report.
- Then the pasted outputs of steps a-e. Mark anything not run `NOT RUN`.
