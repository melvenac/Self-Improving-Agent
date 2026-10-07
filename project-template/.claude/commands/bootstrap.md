# /bootstrap — Put a project on SIA

> **One command, from an existing folder to a project `/start` can read.** The file copying and
> the checks are done by `open-brain bootstrap`, so they happen the same way every time. This file
> is the order and the owner's decisions. Follow it step by step and do not improvise file content:
> **every file comes from `project-template/`, through step 3.**

## Step 0: Find the SIA install

SIA is the folder the owner cloned `Self-Improving-Agent` into (where they ran `node scripts/setup.mjs`).
If you do not know it, read `~/.claude/settings.json`: the `SessionStart` hook runs
`node "<SIA>/open-brain/build/cli-bootstrap.js"`. Everything before `/open-brain/` is `<SIA>`.

Below, **`OB`** means `node "<SIA>/open-brain/build/cli.js"`. Run every `OB` command from the
project root.

## Step 1: Look before touching anything

```
OB bootstrap check
```

It reports git, `CLAUDE.md` and `.agents/`, and ends with a `Next:` line. Act on that line:

| `.agents/` says | Do this |
|---|---|
| `BOOTSTRAPPED` | Stop. Tell the owner: "This project is already on SIA. Run `/start`." |
| `NOT A RECORD` | A `state.json` that is not a record (empty, not JSON, or an old template's placeholder). Show the owner `Next:`. If it is left over, step 2.1 moves it aside. |
| `SCAFFOLDED` | A bootstrap that stopped after step 3. Go on at step 4. |
| `PRE-STATE` | Not a fresh install: the project already has `.agents/TASKS/`. Skip to step 6 (the import). |
| `RESIDUE — …` | Old files with no record. Step 2 moves them aside. |
| `absent` or `empty` | Go on. |

If `git:` says `inside another repository`, **stop**. `git init` here makes this folder its own project, or move the folder out of the enclosing repository.

## Step 2: Residue aside, then the project is its own commit

Do these **in this order**, running `OB bootstrap check` after each. Its `Next:` line says which one
comes next.

1. **Residue first.** Show the owner the entries `check` listed and say they will be moved, not
   deleted. On yes:

   ```
   OB bootstrap move-residue
   ```

   They land in `.agents/archive/pre-bootstrap-residue-<date>/`, which stays local. The owner deletes
   it when they have looked. If git already tracked those files, `Next:` says to commit their
   removal on its own. Do that.
2. **Not a repository:** ask the owner, "Initialize git here and commit the project as it stands?"
   On yes, `git init`, then look at `git status --short` **before** committing. If there is no
   `.gitignore`, ask the owner what to leave out (dependencies like `node_modules/`, build output,
   `.env` files) and write a `.gitignore` for those first. Then commit, **leaving `.agents/` out**:

   ```
   git add -A -- . ":(exclude).agents"
   git commit -m "The project before SIA"
   ```

   **An empty folder** has nothing to commit, and `git commit` stops with `nothing to commit`. Make
   the commit empty instead (`check` says so too):

   ```
   git commit --allow-empty -m "The project before SIA"
   ```

3. **No commit yet, or uncommitted changes:** ask the owner to commit them the same way (or commit
   on their word). Scaffold refuses a dirty tree, so that the SIA commit holds only what bootstrap
   added.

`Next:` must now say to scaffold.

## Step 3: Scaffold

```
OB bootstrap scaffold
```

It copies the fresh-install files from `project-template/`, never overwrites a file that exists
(it lists what it skipped), merges the template's `gitignore` and `gitattributes` into the
project's, and then **checks with git** that every file is tracked or local exactly as it says.
It prints each file as `tracked` or `local` with the reason. **Read that list to the owner**:

- **Tracked** (committed with the project): `.agents/TASKS/INBOX.md`, `.agents/TASKS/task.md`,
  `.agents/SYSTEM/SUMMARY.md`, `.agents/AGENT.md`, the four session commands in
  `.claude/commands/` (`/start`, `/end`, `/task`, `/sync`), `.gitignore` and `.gitattributes`.
- **Local** (this disk only, by design): `.agents/SESSIONS/SESSION_TEMPLATE.md`, because session logs
  are local. The template's PRD, DECISIONS, ENTITIES, RULES and similar files are **not** scaffolded:
  the gitignore keeps them local, so they would exist on one disk only. Write them when the project
  needs them.

About the commands: they are installed **in the project** even if the owner has the same commands
globally, so a clone on another machine has them too. Scaffold skips any that already exist here.

`.agents/AGENT.md` says `role: none`: a project with one agent is **not a seat**. Seats (planner,
developer, QA) are for a multi-checkout loop, and this project does not run one. `/start` will say
`NOT A SEAT`, which is correct.

If it ends with **`VERIFY FAILED`**, stop and show the owner the problems. It is almost always an
older rule in their `.gitignore` or `.gitattributes`, for example `.agents/`. Fix it with the owner,
then continue. Do not work around it.

## Step 4: CLAUDE.md

This comes **after** scaffold on purpose: scaffold refuses a tree with uncommitted changes, and a
changed `CLAUDE.md` belongs in the SIA commit (step 8), not in the project's own.

`check`'s `CLAUDE.md:` line (step 1) decides this step. **Never overwrite the owner's file.**

- **present, without the SIA section:** show the owner the section below and ask,
  "Append this SIA section to your CLAUDE.md?" Append it only on yes. On no, leave the file as it is.
- **present, with the SIA section:** nothing to do.
- **absent:** scan the project (`package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`, the
  README, lint and test configs) and draft a short `CLAUDE.md`: a title, a one-line **About**, the
  **Commands** (build, test, lint, dev: detected or "TBD"), 2–5 **Conventions**, the key directories.
  End it with the section below. Show the draft to the owner before writing it.

The SIA section, verbatim (the heading is how `check` finds it):

```markdown
## Self-Improving Agent (SIA)

- The project record is `.agents/state.json`. Change it only through the `ob_state` tool, never by
  hand. `TASKS/INBOX.md`, `TASKS/task.md`, `SESSIONS/next-session.md` and `SYSTEM/SUMMARY.md` are
  rendered from it.
- Start a session with `/start`, and end it with `/end` (it stores the session's lessons).
- Run `/sync` before a commit.
```

## Step 5: Make the three files this project's own

Edit the scaffolded files **in place**, and keep their structure:

- **`.agents/TASKS/INBOX.md`:** replace the example tasks with this project's. If it has substantial
  code, use its TODOs, FIXMEs and obvious next steps. If it is new, ask the owner what they are
  building. **Keep the four headings exactly as they are** (`## 🔴 P0 — Critical` through
  `## 🟢 P3 — Low`): tasks are read only under a P0–P3 heading. Each task is one line, `- [ ] Title`.
- **`.agents/TASKS/task.md`:** replace the objective under `## Current Objective` with the owner's
  first goal.
- **`.agents/SYSTEM/SUMMARY.md`:** set the title to the project's name. Leave the status line: step 7
  replaces it with one rendered from the record.

Show the owner the three files.

## Step 6: Draft the record

```
OB state import --draft
```

It writes nothing but a draft and a report (`.agents/state.draft.json`,
`.agents/state.import-report.md`), in this folder's `.agents/` and never a parent's. The project
needs no `package.json`: without one, the project's name is the folder's name, and the draft says
so. Check the summary:

- `Validates: yes`.
- `Tasks:` is the number of tasks you wrote. If it says **`WARNING: … 0 tasks were parsed`**, a heading
  is wrong. If it says **`WARNING: … is the template's, unchanged`**, step 5 was skipped. Fix either
  and re-run the draft.

Show the owner the summary lines.

## Step 7: The owner commits the record

The import writes `.agents/state.json` once and cannot be re-run over it, so **the owner runs it,
not the agent**. Agent sessions are often not allowed to run it at all. Ask the owner to type, in
this session:

```
! node "<SIA>/open-brain/build/cli.js" state import --commit
```

It writes `.agents/state.json` at revision 0 and renders the views.

## Step 7b: Session commands (import path)

If step 1's `commands:` line listed any of `start.md`, `end.md`, `task.md` or `sync.md` as `OLD` or
`absent`, install SIA's copies **right after** step 7's `state import --commit` (the record and its
four rendered views may still be uncommitted; `install-commands` allows only those paths to be dirty):

```
OB bootstrap install-commands
```

It archives each `OLD` file under `.agents/archive/pre-bootstrap-commands-<date>/` (local), copies the
template's four commands, leaves `SIA` files alone, and touches no other file under `.claude/`. Run
`OB bootstrap check` again: all four should read `SIA`, and `/start` should no longer warn about an
old project `/start`.

## Step 8: The SIA commit

Run `git status --short --untracked-files=all`. Without `--untracked-files=all`, new folders show as one
line (`?? .agents/`) and cannot be compared.

On the **import path** (step 1 said `PRE-STATE`), step 3 never ran, so its tracked list is **empty**.
The status must list exactly:

- `.agents/state.json`
- the four rendered views: `.agents/TASKS/INBOX.md`, `.agents/TASKS/task.md`,
  `.agents/SESSIONS/next-session.md`, `.agents/SYSTEM/SUMMARY.md`
- the four session commands: `.claude/commands/start.md`, `end.md`, `task.md`, `sync.md`
- `CLAUDE.md` if step 4 changed it

On a **fresh install** (step 3 ran), the status must list exactly the tracked files from step 3, plus
`.agents/state.json` and `.agents/SESSIONS/next-session.md`, plus `CLAUDE.md` if step 4 changed it.

If anything else appears, stop and ask the owner. Then, on the owner's word:

```
git add -A
git commit -m "Bootstrap SIA"
```

## Step 9: Summary

```
Project on SIA.

✓ git         — the project before SIA is its own commit; SIA's files are the next
✓ .agents/    — state.json (the record) + its views; session logs stay local
✓ .claude/    — /start, /end, /task, /sync
✓ CLAUDE.md   — {kept as it was | SIA section appended | written}

Next: open a NEW session here and run /start.
```

## Judgment calls

- Never delete anything. Residue is moved, files are never overwritten, and the owner decides about
  their `CLAUDE.md`.
- Every `OB` command prints what it did. If a command refuses, show the owner its message as it
  stands. The refusal names the fix.
- If the owner seems overwhelmed, say: "You don't need to understand all of this yet. When it's done,
  run `/start` in a new session."
