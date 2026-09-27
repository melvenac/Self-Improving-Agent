# `/bootstrap` produces a working SIA project: brief for a FRESH developer session (record 127)

**By:** Atlas (planner), record session 109 · 2026-09-26. **To:** the Claude developer seat (Forge), record **127**, a
fresh session (D-035) in `~/Worktrees/sia-builder`. **Authority:** Aaron ("yes, clear done, send it"). **The acceptance
list is frogger's pilot report:** `docs/loops/t181-frogger-pilot-report.md` (F1–F15). Merging stays Aaron's (D-019).

## Why

T-181 pilot 1 put frogger on SIA through `/bootstrap`. It passed only because the brief warned about two traps and
Aaron re-headed the INBOX by hand. Pilot 2 (co-op-mailer) and every project after it would hit the same findings. And
T-154's "a stranger can install this" cannot hold while the fresh-install path needs a planner's warnings.

## Base: STACKED on T-179 (read this first)

T-179 (`loop/t179-merge` `3c0bfdc`, in QA 125 now) changes the same files: `project-template/.claude/commands/bootstrap.md`,
`project-template/.agents/state.json`, the template's `end.md`, and the importer's v3 output.
- **Branch `loop/bootstrap-fix` from `origin/loop/t179-merge`,** not master.
- **If T-179 changes after QA 125** (a fix round), merge its new tip into your branch. Never rebase, never force.
- **If T-179 is rejected outright,** stop and tell atlas.

Name the T-179 SHA you are built on in the handoff.

## The work: the pilot's findings, as rows

| Row | Finding | Required |
|---|---|---|
| **BF-1** | F1 | bootstrap's INBOX template uses `## P0`–`## P3` headings that the importer reads. **Also:** `state import --draft` warns loudly, and the summary line says so, when an INBOX exists and 0 tasks parse. It is a warning, not "Validates: yes" alone. |
| **BF-2** | F2 | bootstrap gains a step: `state import --draft`, shown to the owner, then **the owner** runs `--commit` (G-007). The template's placeholder `state.json` (`{{PROJECT}}`, a hard-coded date) is removed, or bootstrap never copies it. Say which, and why. |
| **BF-3** | F5 | "`.agents/` with no `state.json` and no `TASKS/`" counts as not bootstrapped. Residue is moved aside and named, never deleted. An existing `CLAUDE.md` gets an offer to append a short SIA section, never a silent skip, and never an overwrite. |
| **BF-4** | F6 | Step 5 commits only what the gitignore tracks, and bootstrap says which scaffolded files stay local and why. |
| **BF-5** | F8 | Decide whether a fresh install is a seat. If it is, bootstrap writes `AGENT.local.md` and the template ships `roles/shared.md`. If not, `role: none`, so `/start` says NOT A SEAT instead of `NO SEAT IDENTITY RESOLVED`. **State the decision and its reason.** |
| **BF-6** | F3, F4, F7 | One source of truth: either bootstrap copies the template's files, or it writes inline, not both. The command source is named as `project-template/.claude/commands/`. The global-commands skip rule is removed or made explicit. `git init` comes first, so the pre-SIA project is its own commit. |
| **BF-7** | F10 | The template ships `.gitattributes` with `.agents/** text eol=lf`, **or** the record's byte comparisons are shown CRLF-safe by a test. |
| **BF-8** | F12, F9 | The `ob_start` header line prints the project name from the record. The importer's retention edge does not print a negative session at session 0. **Only if each is small**; otherwise list it for a task. |
| — | F11, F13, F14, F15 | **Not in this round.** F14 goes to `start.md` as a planner item. F13 (tree currency with no remote) is a task. |

## Acceptance: a second fresh install, from scratch, that needs NO planner warning

In a scratch folder under the OS temp dir: a small throwaway project with a `package.json`, an existing `CLAUDE.md` and
a leftover `.agents/reflection-queue.json`. **Follow the new `bootstrap.md` literally**, with no knowledge from this
brief, as a stranger would. Show:
- (a) the draft imports the scaffolded tasks;
- (b) `--commit` produces a v3 record with no SIA history (T-175);
- (c) `/start`'s `ob_start` returns the project's own `## State`;
- (d) `git status` after the initial commit shows nothing that bootstrap says is tracked but is not;
- (e) no manual fix was needed.

**Record every step's output in the handoff.** Automate what can be a test (BF-1's warning, BF-3's residue detection
and BF-7) with **red first**.

## How

- Red first on tcm, read per test. `npx tsc --noEmit -p .` before every push. No full local suite beyond single files.
- Push only `loop/bootstrap-fix` and `loop/bootstrap-fix-*`. Never master, never force, and read back each push.
- **Never touch a real project** (frogger included). Scratch only. **Never write SIA's live `.agents/state.json`.**

## Hand back

`docs/loops/bootstrap-fix-developer-handoff.md`, with:
- the T-179 SHA built on;
- a commit table built from each commit's own `git diff --stat`;
- per row BF-1 to BF-8, what changed and its evidence;
- the scratch install's full transcript of steps and outputs;
- the red and green runs;
- your model and effort, from your transcript.

**Push it BEFORE messaging atlas.** No `/end`.
