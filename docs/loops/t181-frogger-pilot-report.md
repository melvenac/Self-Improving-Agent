# T-181 pilot 1 — frogger fresh install (`/bootstrap`): report, filed by the planner

**Filed by:** Atlas (planner), record session 109 · 2026-09-26, **verbatim** from the frogger session's SendMessage.
That report lives in frogger's `.agents/pilot-report.md`, which is local only: the template gitignore excludes it.
**The planner has not re-run any step.** Frogger's own git: `master` `05ec972` (the initial commit) → branch
`sia/bootstrap` `07640b8`, local, with no remote. Merging `sia/bootstrap` is Aaron's.

## The planner's reading (session 109)

- **The pilot PASSED its two end-to-end checks:**
  - **T-175:** 0 SIA history (V-/G- ids) in any record file or draft. The importer fix works on a real project.
  - **`/start`:** returns frogger's own `## State` (rev 0) at **1,978 characters**.
- **The fresh-install path does not work as written.** Every finding below is real. The blocking ones:
  - **F1:** bootstrap's INBOX template cannot be read by the importer, and the draft still says "Validates: yes".
  - **F2:** no step produces `state.json`.
  - **F5:** leftover `CLAUDE.md` or `.agents/` makes bootstrap a no-op.
  - **F6:** bootstrap commits files the gitignore ignores.
  - **F8:** no seat identity and no roles.

  These go to one task: **"make `/bootstrap` produce a working SIA project"**, with this report as its acceptance
  list. F4, F7, F9, F10, F12, F13 and F15 are in it too.
- **F14** (a `/start` agent flagged a mismatch it never checked) is model behaviour. It is recorded against `start.md`:
  flag only what a tool output showed. That is defence in depth, not the fix.
- **Pilot 2, co-op-mailer, the import path,** is next per the plan. Before it, check co-op-mailer's inputs for QA 122's
  D11 and D12 encodings, because R4-4 is due before a non-fresh Windows adoption.

---

# (Verbatim below)

# T-181 pilot 1 — frogger fresh install (`/bootstrap`): report

**By:** the Claude session in `~/Projects/frogger`, 2026-09-26. **For:** Atlas (SIA planner).
**Brief:** `docs/loops/t181-frogger-pilot-brief.md` on `origin/docs/session-100-qa99-dispatch`.
**SIA build used:** `~/Projects/Self-Improving-Agent` master `be7ddfb`.
**Frogger git:** `master` 05ec972 (initial commit) → branch `sia/bootstrap` 07640b8 (bootstrap result). Nothing pushed; no remote.

## Steps

| # | Step | What it did / wrote |
|---|------|---------------------|
| 0 | Residue | Aaron approved. Moved `.agents/reflection-queue.json` to `~/Projects/frogger-residue/`, then `rmdir .agents`. `CLAUDE.md` was kept untouched. |
| 1 | `git init` + initial commit | Aaron approved. `git init` (default branch `master`), then commit 05ec972 with the project as it stood. The existing `.gitignore` already ignored `node_modules`/`dist`. `.claude/settings.local.json` was already excluded by the user's global git ignore (`~/.config/git/ignore:3`). Branch `sia/bootstrap` was cut from it. |
| 2a | bootstrap Step 1 | `CLAUDE.md` exists → skipped generation. `.agents/` absent (after step 0) → scaffold. Not a git repo → already handled. |
| 2b | bootstrap Step 2 | Skipped (CLAUDE.md exists). |
| 2c | bootstrap Step 3 | Wrote the six files from bootstrap.md's **inline** templates: `TASKS/INBOX.md` (3 frogger tasks under `## Priority` / `## Backlog`), `SESSIONS/SESSION_TEMPLATE.md`, `SYSTEM/SUMMARY.md`, `SYSTEM/ENTITIES.md`, `SYSTEM/RULES.md`, `skills/INDEX.md`. |
| 2d | bootstrap Step 4 | Copied `start.md`, `end.md`, `task.md` and `sync.md` from `project-template/.claude/commands/` into `.claude/commands/`. This follows the brief. See F4. |
| 2e | bootstrap Step 5 | Merged `project-template/gitignore` into the existing `.gitignore`. Both checks from line 155 pass: `Session_1.md` is ignored, and `state.json` is not ignored (negated at `.gitignore:17`). |
| 3a | `state import --draft` #1 (literal bootstrap INBOX) | Validates, but imports **0 tasks** and leaves 5 unparsed lines (see F1). |
| 3b | INBOX re-headed | Aaron chose this. `## Priority` → `## P1 — High`, `## Backlog` → `## P2 — Medium`. |
| 3c | `state import --draft` #2 | Validates. 3 tasks (T-001 P1, T-002/T-003 P2), 0 unparsed. Shown to Aaron. |
| 3d | `state import --commit` | **Run by Aaron** (G-007). Wrote `state.json` rev 0 and a snapshot of 8 files. It rendered the 4 views. |
| 4 | T-175 check | PASS. See below. |
| 5 | `/start` in a new session | See the section below. |
| 6 | Commit on branch | 07640b8 on `sia/bootstrap`: `.gitignore` (M), `.agents/state.json`, the 4 rendered views, and 4 `.claude/commands/*.md`. |

## Findings (wrong, missing or confusing)

**F1 — WRONG: the bootstrap INBOX template cannot be read by the importer.**
`project-template/.claude/commands/bootstrap.md:74-78` writes `## Priority` / `## Backlog`. But the importer only
accepts `## P0`..`## P3` or `## Completed` (`open-brain/src/pipelines/state-import/index.ts:187` `SECTION_RE`,
lines 199-205). The result: every bootstrapped task is dropped, and the draft is empty but **still "Validates: yes"**. The
only signal is "unparsed lines 5" in the summary line. The template's own `.agents/TASKS/INBOX.md:25-41`
already uses P0-P3, so bootstrap.md and the template disagree with each other. Fix: make bootstrap.md:74-78 use
`## P1 — High` and so on (or have the importer map Priority→P1 and Backlog→P2). Consider having `--draft` warn loudly
when an INBOX exists but 0 tasks were parsed.

**F2 — WRONG (corrects the brief): the template *does* ship a `state.json`, and bootstrap.md never mentions it.**
`project-template/.agents/state.json` exists (rev 0, `"name": "{{PROJECT}}"`, `last_session.date` hard-coded
`2026-09-14`). bootstrap.md never mentions `state.json` or `state import` anywhere (lines 1-178). Anyone who copies the
template's `.agents/` wholesale gets that file, and then `state import` refuses: `.agents/state.json already exists —
the importer runs once` (`index.ts:794`, `:853`). Anyone who follows bootstrap.md literally gets no `state.json` at all,
so `/start` falls back to prose (`start.md:64`). Either way, the fresh-install path has **no step that produces the
record**. Fix: add a bootstrap step, "run `open-brain state import --draft`, review it, then the owner runs `--commit`". Also
either drop `project-template/.agents/state.json` or document a placeholder-substitution path for it.

**F3 — CONFUSING: bootstrap writes files inline, yet the template has richer files.**
bootstrap.md:52-131 gives inline stub content. The template's `.agents/` has different and larger files
(`AGENT.md`, `FRAMEWORK.md`, `SYSTEM/PRD.md`, `DECISIONS.md`, `TESTING.md`, and more, plus `TASKS/task.md`). The brief says
"copy the template's `.agents/` pieces as it says", but bootstrap.md never says to copy anything from the template. I
followed bootstrap.md's inline content. Fix: pick one source of truth.

**F4 — WRONG: the command source is misnamed, and there is a skip rule the brief overrides.**
bootstrap.md:149 says the command templates come from "the power-user curriculum repo (`commands/` directory)". The
real source is `Self-Improving-Agent/project-template/.claude/commands/`. bootstrap.md:147 says to skip Step 4 "if
the user already has these commands (e.g., from a global setup)". Aaron has them globally (`~/.claude/commands/`,
identical to the template apart from CRLF), so a literal run would install nothing. I copied them per the brief.
bootstrap.md:139-142 lists 4 commands, while the template ships 7 (`bootstrap`, `checkpoint`, `test` are extra).

**F5 — WRONG: an existing CLAUDE.md or `.agents/` makes bootstrap a no-op.**
bootstrap.md:14-18 skips `CLAUDE.md` if it exists, and skips *all* scaffolding if `.agents/` exists, without looking at
what is in either. Here `.agents/` held only old-framework residue (`reflection-queue.json`), which would have
blocked everything. Also, `CLAUDE.md` was not written by bootstrap, and nothing checks or appends SIA-specific content to
it. Fix: detect "`.agents/` with no `state.json`/`TASKS/`" as un-bootstrapped. For an existing CLAUDE.md, offer to
append a short SIA section rather than skipping silently.

**F6 — WRONG: bootstrap Step 5 tells you to commit files that the template gitignore ignores.**
bootstrap.md:154 says to make the initial commit "with CLAUDE.md + .agents/ + .claude/commands/". But line 155's gitignore ignores
everything under `.agents/` except the 5 state files. So `ENTITIES.md`, `RULES.md`, `skills/INDEX.md` and
`SESSION_TEMPLATE.md` (all scaffolded in Step 3) are never committed and exist only on this disk (verified with
`git check-ignore -v`). If that is intended, bootstrap.md should say so.

**F7 — ORDER: bootstrap.md puts `git init` last, and the brief puts it first.**
bootstrap.md:151-154 runs `git init` after scaffolding. The brief (step 1) did it first, so that the pre-SIA project is
its own commit. The brief's order is better: it leaves a clean diff of what bootstrap added.

**F8 — MISSING: seat identity and roles.**
The SessionStart hook in this session reported `NO SEAT IDENTITY RESOLVED` (no `.agents/AGENT.local.md` or
`AGENT.md`) and `ROLE FILE MISSING: .agents/roles/shared.md`. bootstrap.md creates neither, and
`project-template/.agents/` has no `roles/` directory at all. `start.md:87` treats `AGENT.md` as optional, so
only the hook complains. Both are also gitignored under the template gitignore. Fix: decide whether a fresh
install needs a seat, and if so add it to bootstrap.

**F9 — CONFUSING: SESSION_TEMPLATE.md and staleness.**
The importer says "could not tell" for `INBOX.md` because there is no `SESSIONS/Session_N.md`. That is expected on a fresh
install, but the report's line "retention edge: done items closed ≤ session -3" and "closed_session = -3" read like bugs
at session 0. They are cosmetic, and nothing blocks.

**F10 — POSSIBLE (not verified): line endings.**
Frogger has `core.autocrlf=true`, and git warned "LF will be replaced by CRLF" on `.agents/state.json` and the 4 rendered
views. The importer writes "canonical bytes". If a later checkout rewrites `state.json` with CRLF, byte comparison or
revision logic might trip. I did not test this. It is worth a `.gitattributes` (`.agents/** text eol=lf`) in the template.

**F11 — MINOR: the importer takes the project name from `package.json`, not CLAUDE.md or README.**
The record says `frogger v0.0.1`, while the page and README call it "Arcade". That is fine, just noting it.

## `state import` output

### Draft #1 (literal bootstrap INBOX)
```
Validates: yes
Current session: 0 ((no Session_N.md))
Staleness: 0 stale · 1 could not tell (.agents/TASKS/INBOX.md) · 0 current.
Tasks: 0 (open 0, in_progress 0, blocked 0, done 0); superseded links 0; unparsed lines 5
Decisions: 0 (0 skipped) · verified 0 · gaps 0 · objective NOT found
Handoff: pick_up 0 lines, watch_out 0, open_questions 0
SUMMARY.md: --commit will remove 0 lines (0 blockquote + 0 Current State)
Unparsed: line 3 `## Priority`, line 4 item, line 6 `## Backlog`, lines 7-8 items — "no priority section"
```

### Draft #2 (INBOX re-headed P1/P2)
```
Validates: yes
Staleness: 0 stale · 1 could not tell (.agents/TASKS/INBOX.md) · 0 current.
Tasks: 3 (open 3, in_progress 0, blocked 0, done 0); superseded links 0; unparsed lines 0
Decisions: 0 (0 skipped) · verified 0 · gaps 0 · objective NOT found
Handoff: pick_up 0 lines, watch_out 0, open_questions 0
SUMMARY.md: --commit will remove 0 lines
```

### Commit (run by Aaron)
```
state import — committed
Could not tell whether current: .agents/TASKS/INBOX.md
Snapshot: .agents\archive\pre-state-migration-2026-09-26 (8 files)
Wrote:    .agents/state.json at revision 0
SUMMARY.md: removed 0 lines (0 blockquote + 0 Current State); kept Status, What's Working, What's Next
Rendered: .agents/TASKS/INBOX.md, .agents/TASKS/task.md, .agents/SESSIONS/next-session.md, .agents/SYSTEM/SUMMARY.md
Moved into snapshot: .../state.draft.json, .../state.import-report.md
```

## T-175 check — PASS

`grep -cE "V-00[1-5]|G-00[1-6]"` returns 0 on `.agents/state.json`, `TASKS/INBOX.md`, `TASKS/task.md`,
`SESSIONS/next-session.md` and `SYSTEM/SUMMARY.md`, and on both drafts and reports. The record holds
`revision 0`, `project.name "frogger"`, tasks `T-001,T-002,T-003`, and `verified 0 · gaps 0 · decisions 0`. There is no SIA
history.

## `/start` in a new session

**PASS.** Session `9816b0cb-928c-48cf-9874-71f3eebc74fd` was a fresh session on branch `sia/bootstrap`, with `/start`
run inline. `ob_set_session` was called, then `ob_start`. `ob_start` returned `## State (state.json rev 0)` rendered from
frogger's own record: `Project: frogger v0.0.1`, Objective none, T-001 (P1) and T-002/T-003 (P2), verified 0, gaps 0,
decisions 0, and one developer handoff (session 0, close-out 07640b8, nothing recorded). It created `SESSIONS/Session_1.md`.

**Size:** the `ob_start` result is 1,978 chars / 54 lines. ob_start reports "Total returned words: 261 (~485 tokens)".
The files behind it: SUMMARY.md ~255 tok, INBOX.md ~158, task.md ~110, next-session.md ~79, state.json ~312 (none
truncated). The agent's rendered `/start` reply was about 25 lines.

Findings from the fresh session:

**F12 — MINOR: `ob_start`'s header line drops the project name.** It prints `Project: v0.0.1`, while the `## State` block
prints `Project: frogger v0.0.1`. The header appears to read a name field that bootstrap never writes.

**F13 — CONFUSING: "Tree currency" is hard-wired to `origin/master`.** The SessionStart hook and ob_start both say
"origin/master does not exist in this checkout — nothing to compare against. This is not a pass." On a fresh install
with no remote, this line shows up every session. It is accurate, but it will stay until T-001 is done. The hook also
repeats both role-knowledge problems (F8) every session.

**F14 — MODEL BEHAVIOUR (not SIA): the fresh `/start` agent claimed a fact it never checked.** Its FLAGS said that "the
local branches are `main` and `sia/bootstrap`. There is no `master`." That is false: `git branch -a` shows `master` and
`sia/bootstrap`. The agent ran only `git status --porcelain`, `ls` and `git remote -v`, never `git branch`. T-001's
wording ("push master") is correct. This is not an SIA defect, but a `/start` reply that invents a mismatch against a task
is worth knowing about. It argues for `start.md` telling the agent to flag only what a tool output showed.

**F15 — NOTE: `start.md` looks for `docs/loops/`, which a fresh install lacks.** The agent reported "Latest brief: none
(`docs/loops/` doesn't exist)". That is harmless, but the brief/loop coordination described in `start.md:93-95` does not
exist for a bootstrapped project, and nothing in bootstrap mentions it.
