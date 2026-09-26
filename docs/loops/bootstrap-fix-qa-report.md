# The `/bootstrap` fix (stacked on T-179 round 2), `6543e8e`: QA report (record session 135)

**By:** the QA seat, record session **135**, headless, 2026-09-26 (dates are the machine's local date; the run
started 23:26 UTC). **Dispatch:** `docs/loops/bootstrap-fix-dispatch-qa.md` (Atlas, record 109).
**Machine: `DESKTOP-0GV3HAD`, Aaron's desktop, not the QA PC.** `claude.exe` was the one in npm's global folder,
`%USERPROFILE%` is `C:\Users\Aaron` (no space), Git for Windows sets `core.autocrlf=true` system-wide
(`C:/Program Files/Git/etc/gitconfig`), and Node is v22.23.2. The run's own worktree is `~/Worktrees/sia-qa`, detached at
`2667c6b`. **Candidate:** `6543e8e` (`origin/loop/bootstrap-fix-r2`; tip `b45900f` adds only `docs/loops/`), checked
out and built in `C:\qa-scratch\cand` (`tsc --noEmit` exit 0, `npm run build` exit 0, "build stamped 6543e8e").
**Model:** `claude-opus-5-5`; the driver passes `--effort high`.

## Verdict

**PASS for BF-1 to BF-8 as the brief words them, and FAIL on "a stranger can install this" outside a Node
project.** Every BF row does what it says, and every in-scope pilot finding (F1–F10, F12) is closed. The frogger-shaped
install (i) met (a)–(e) with **no manual fix**. My mutants of the three required kinds were all killed: residue deleted,
0-task warning removed, template `state.json` copied again. So were 11 of my other 12; the survivor, M13, is minor (Mutants).

The clean empty folder, install (ii), **did not** meet (e). It needed **two manual fixes that `bootstrap.md` does not
mention**:
- **D6:** an empty folder has nothing for "The project before SIA" to commit. `git commit` exits 1, and `check` repeats
  the same instruction. I used an empty commit.
- **D1:** `state import` refuses any project with no `package.json` ("no project root found walking up"). That covers
  every Python, Go or Rust project, and every new one. I wrote a minimal `package.json`, and step 8 then listed it as the
  one unpredicted file.

**D2 is D1's other face, and the one with a real hazard.** Run in such a project, step 6 walks up. If a parent folder
is a Node project with `.agents/SYSTEM/`, it drafts **the parent**, and writes the draft and report into the parent's
`.agents/`. Step 7 would then commit the parent's record.

Neither D1 nor D2 is in a BF row. Both are in the importer's root rule, which is older than this candidate. But they
decide whether the brief's goal, "a stranger can install this", holds. They are listed for the planner under
"Open for the planner", and **I recommend they block the merge only if non-Node projects are in scope for T-154**.

**Forge 133's note (dispatch item 6): the wording IS misleading, and it also misroutes.** After scaffold, `check`
says `PRE-STATE` and "this is the IMPORT path, not a fresh install". Step 1's table sends `PRE-STATE` to step 6. So a
bootstrap that is interrupted after step 3 and resumed from step 1 skips steps 4 and 5. It then imports **the
template's 10 example tasks** ("Write the PRD" …) with no warning, and the objective becomes "Write the PRD" (D3,
shown below).

## BF-1 to BF-8

| Row | Verdict | Evidence (mine, this run) |
|---|---|---|
| **BF-1** (F1) | **PASS** | The template INBOX's `## 🔴 P0 — Critical` … headings parse: **3 tasks** in (i) and **4** in (ii), no WARNING. An INBOX with only `## Priority` / `## Backlog` (probe P2b) prints `unparsed lines 5 — WARNING: see below` on the Tasks line, then the full `WARNING: .agents/TASKS/INBOX.md exists but 0 tasks were parsed (5 unparsed lines)…`. The report carries the same text in bold. Mutants M2 (warning removed) and M12 (`SECTION_RE` reverted) were both killed on an AssertionError. **Limit:** with **no** INBOX (an empty `TASKS/`, P2a) there is no warning and the draft holds 0 tasks. That matches the brief's wording ("when an INBOX exists"). |
| **BF-2** (F2) | **PASS** | The template ships no `.agents/state.json` (`git ls-files project-template \| grep -i state`: nothing). `SCAFFOLD_FILES` has no `state.json`. The only writer that creates one is `state import --commit`; `applyStateOps` refuses when the file is absent (`state-writer.ts:174`,`:189`). The decision was stated with a reason (the developer handoff §2: removed, not skipped, because README's `cp -r` path would keep the trap). Both installs got `state.json` from `--commit` alone. Mutants M3a (seed restored) and M3b (seed restored **and** copied by scaffold) were killed, by 2 and 4 assertions respectively. |
| **BF-3** (F5) | **PASS, with D3, D4 and D5** | (i): `RESIDUE — reflection-queue.json` → `move-residue` put it at `.agents/archive/pre-bootstrap-residue-2026-09-26/`, and its bytes read back identical. Probe P3a: a nested residue with one git-tracked file moved with identical sha1s; `check` then named the removal commit. `CLAUDE.md`: the append was offered and made on yes (i). The existing file's sha1 was identical after `check`, `move-residue` and `scaffold` (P5). Nothing in the bootstrap code writes `CLAUDE.md`. **"Not bootstrapped":** see the section below. Mutants M1 (delete instead of move), M1b (names kept, bytes emptied), M4, M5, M11, M14 were killed. |
| **BF-4** (F6) | **PASS** | Scaffold printed all 11 files as `tracked`/`local` with a reason each, then "Verified with git". Step 8's rule predicted **13** paths in (i), and `git status --short --untracked-files=all` listed **exactly those 13**. Status was empty after "Bootstrap SIA". `--ignored` showed only `SESSION_TEMPLATE.md` and `archive/`. P4b (an owner's `.agents/` rule) gave `VERIFY FAILED` with 6 named problems, exit 1. Mutants M9 (the check that `state.json`/`next-session.md` will be tracked, disabled) and M10 (AGENT.md untracked) were killed. |
| **BF-5** (F8) | **PASS** | Scaffold writes `.agents/AGENT.md` `role: none`, and it is tracked. Both the SessionStart hook (`cli-bootstrap.js`, fed a hook payload) and `ob_start` print `This checkout is NOT A SEAT (arcade, role: none)`, `Its sessions are recorded with no seat; a set_handoff names its seat in the op.`, and `shared.md — ABSENT (shared; not a seat, so none is expected)`. There is **no** problem block and **no** `NO SEAT IDENTITY RESOLVED`. **The line is true:** in the BF-7 clone, `set_handoff developer` from that `role: none` checkout was **applied** (rev 0→1), not refused. Mutants M6 and M15 were killed. Two leftovers, both minor: `ob_start`'s handoff block still says `READER'S SEAT UNRESOLVED`, and `role-files.ts:66-69`'s doc comment still says such a write "is refused by the schema" (the comment only; the output is right). |
| **BF-6** (F3, F4, F7) | **PASS** | Scaffold copies from `project-template/`, printing `Template: C:\qa-scratch\cand\project-template`. The command source is named. The global-commands skip is replaced by an explicit rule (step 3: installed in the project even if the owner has them globally; existing ones skipped). P4a: an owner's `start.md` was kept and listed under `Skipped:`. `git init` comes first, and scaffold refuses otherwise: no repo, no commit, a dirty tree, and a nested repo each refused with "Nothing written" (P4c, P4d, P4e). Mutant M8 (overwrite) was killed. **A quibble, not a defect:** `bootstrap.md` still carries one piece of file content, the SIA section for `CLAUDE.md`. It has to, because no template file holds it. |
| **BF-7** (F10) | **PASS** | The template ships `gitattributes` (`/.agents/** text eol=lf`), and scaffold merges it. A clone of (i) under `autocrlf=true` has **0 CR** in `state.json`, INBOX, task.md, next-session and SUMMARY. `CLAUDE.md` has 16 and `.gitattributes` 10 (outside `.agents/`, the known positive). `ob_state` write 1 (rev 0→1) worked, with a 5-file diff of 25+/20−, not a whole-file rewrite. I then deleted the working files and checked them out again: 0 CR. Write 2 (rev 1→2) worked. **Control, `.gitattributes` removed:** the checkout gave 72/20/42 CR, and after one write `SUMMARY.md` was **mixed**, 21 of its 42 lines CRLF. The write itself also works without the file, so it is the churn and the mixed file that `.gitattributes` prevents. Mutant M7 (`eol=lf` dropped) was killed. |
| **BF-8** (F12, F9) | **PASS** | `ob_start`'s header reads `Project: frogger v0.0.1` in (i) and `Project: blank v0.0.0` in (ii), the same as the State block. Both import reports: `closed_session = 0`, and 0 matches for `= -N` / `session -N`. Forge's `merge-hunk3-unfloored` mutant covers the floor, and I did not repeat it. |

### What counts as "not bootstrapped" (dispatch item 2)

| `.agents/` holds | `check` says | Then |
|---|---|---|
| nothing / absent | `empty` / `absent` | the fresh-install path |
| any other entries (e.g. `reflection-queue.json`, `META/`) | `RESIDUE — <entries>` | `move-residue`, never delete |
| **only `TASKS/`** (even empty, P2a; even a *file* named `TASKS`, P2c) | `PRE-STATE` → "the IMPORT path, not a fresh install" | scaffold **refuses**, and so does `move-residue` ("pre-state, not residue"). The import is the only way on: an empty `TASKS/` drafts a record with 0 tasks, no WARNING (no INBOX), and no `AGENT.md`, so `/start` would say NO SEAT IDENTITY RESOLVED |
| **only a `state.json`** (P1a valid, **P1b the old `{{PROJECT}}` seed, P1c zero bytes**) | `BOOTSTRAPPED` → "Stop. Run /start." | P1b's `ob_start`: `Project: {{PROJECT}} v1.0.0`, `NO SEAT IDENTITY RESOLVED`, `ROLE FILE MISSING` (**D4**) |

The brief's rule is "no `state.json` and no `TASKS/`" = not bootstrapped. The code implements exactly that, so
`state.json`-only being BOOTSTRAPPED is to the letter. But `check` never reads the file. A zero-byte file, or the
placeholder seed that older copies of the template carry, is reported as a finished install, and the stranger is
sent to `/start` with a broken project.

## Install (i): frogger's shape (full transcript: `docs/loops/qa-135/evidence/install-i-transcript.txt`)

**Fixture** (`C:\qa-scratch\i\arcade`):
- `package.json` (`frogger` 0.0.1), an existing CRLF `CLAUDE.md` ("# Arcade"), `README.md`, and a CRLF `.gitignore`
  (`node_modules/`, `dist/`);
- `src/game.js` with two TODOs and a FIXME, and a leftover `.agents/reflection-queue.json`;
- no git; `core.autocrlf=true` (system).

`OB` = `node C:/qa-scratch/cand/open-brain/build/cli.js`. I followed `bootstrap.md` at `6543e8e` literally and stood
in for the owner.

| Step | Output (abridged; whole text in the transcript) |
|---|---|
| 0 | **Unclear (U1):** `~/.claude/settings.json` on this machine has **no SessionStart hook**, so step 0's only rule for finding `<SIA>` finds nothing, and there is no fallback ("ask the owner"). I used the candidate worktree. |
| 1 `check` | `git: NOT a repository` · `CLAUDE.md: present, without the SIA section` · `.agents/: RESIDUE — reflection-queue.json (no state.json, no TASKS/)` · `Next: Move the residue aside first` |
| 2.1 `move-residue` | `moved, nothing deleted` · `To: .agents/archive/pre-bootstrap-residue-2026-09-26/` · `Entries: reflection-queue.json`; the file's content read back unchanged. `check` → `.agents/: empty`, `Next: git init, then commit the project as it stands, leaving .agents/ out` |
| 2.2 | `git init`; `git status --short` showed 6 entries including `?? .agents/`; `.gitignore` existed, so no question. `git add -A -- . ":(exclude).agents"` then commit `ef7f335 The project before SIA`, 5 files. `check` → `has commits; 0 uncommitted change(s)`, `Next: Scaffold` |
| 3 `scaffold` | 11 written (10 tracked, 1 local), `.gitignore` **merged** (the owner's 2 lines kept, the template's rules appended under a `# --- SIA …` marker, CRLF kept), `.gitattributes` created, "Verified with git …", exit 0 |
| 4 | Owner: yes. The SIA section was appended verbatim, and the file now ends with it |
| (extra) `check` | `11 uncommitted change(s)` · `PRE-STATE` · "An existing project on the pre-record framework … this is the IMPORT path, not a fresh install." (dispatch item 6) |
| 5 | INBOX: the example tasks were replaced by the two TODOs (P1) and the FIXME… (P2), with the four headings kept. task.md: objective only. SUMMARY: title and status |
| 6 `--draft` | `Validates: yes` · **`Tasks: 3 (open 3 …); unparsed lines 17`**, no WARNING · `SUMMARY.md: --commit will remove 24 lines (2 blockquote + 20 Current State)`. The report: `closed_session = 0` and round 2's retention sentence |
| 7 `--commit` (stand-in) | `Wrote: .agents/state.json at revision 0` · `Snapshot: …pre-state-migration-2026-09-26 (7 files)` · rendered the 4 views |
| 8 | Predicted 13. Listed **13**: ` M .gitignore`, ` M CLAUDE.md`, and 11 `??` (AGENT.md, next-session.md, SUMMARY.md, INBOX.md, task.md, state.json, the 4 commands, `.gitattributes`). Commit `42a54ef Bootstrap SIA`, 13 files. Status afterwards: **empty**. `--ignored`: `SESSION_TEMPLATE.md` and the two `archive/` folders only |

- **(a)** The draft imported the scaffolded, then edited, tasks: `Tasks: 3`, no WARNING.
- **(b)** A v3 record with no SIA history:
  - `schema_version 3`, revision 0, project `frogger`;
  - T-001..T-003, each with `closed_rev: null`;
  - the handoff and the session each with `first_rev: null`;
  - 0 verified, gaps and decisions.
  - `grep -cE "V-00[1-5]|G-00[1-6]"` reads 0 on `state.json` and the 4 views. The known positive, SIA's own record, reads 20.
- **(c)** `ob_start` returned `## State (state.json rev 0)`:
  - `Project: frogger v0.0.1`, in the header too;
  - the objective and the 3 tasks by priority;
  - NOT A SEAT, with no problem block;
  - 256 words.
  - That is the candidate's `handleStart` called from a script, not `/start` in a fresh Claude session (not available
    here). `USERPROFILE` and `KNOWLEDGE_V2_DB` were pointed at `C:\qa-scratch\home`, so no real home or DB was touched.
- **(d)** The listed paths equalled the prediction, and status was empty after the commit.
- **(e)** No manual fix. The notes on unclear text below did not block.

## Install (ii): a clean empty folder (full transcript: `docs/loops/qa-135/evidence/install-ii-transcript.txt`)

**Fixture:** `C:\qa-scratch\ii\blank`, empty. The same `<SIA>` and the same system `autocrlf=true`.

| Step | Output |
|---|---|
| 1 `check` | `git: NOT a repository` · `CLAUDE.md: absent` · `.agents/: absent` · `Next: git init, then commit the project as it stands …` |
| 2.2 | `git init`; `git status --short` was empty. There was no `.gitignore`, so the owner was asked what to leave out. The stand-in answer was "nothing yet, it is empty", so no `.gitignore` was written. `git add -A -- . ":(exclude).agents"` exit 0. **`git commit -m "The project before SIA"` → `nothing to commit`, exit 1.** `check` → `NO commit yet; 0 uncommitted change(s)` · `Next: Commit the project as it stands (the repository has no commit yet)` — **a dead end (D6)** |
| manual fix 1 | `git commit --allow-empty -m "The project before SIA"` → `9776c90`. `check` → `Next: Scaffold` |
| 3 `scaffold` | 11 written; `.gitignore` and `.gitattributes` **created**; "Verified with git", exit 0 |
| 4 | `CLAUDE.md` absent → scanned (nothing to find) → asked the owner (stand-in: "a small CLI that converts CSV to JSON") → a short draft with **About**, **Commands** all TBD, 2 **Conventions**, and the SIA section; written on yes. `check` → `present, with the SIA section`, and again `PRE-STATE … not a fresh install` |
| 5 | Owner asked what they are building: 4 tasks, one under each heading; objective; title and status |
| 6 `--draft` | **`state import refused: no project root found walking up from C:\qa-scratch\ii\blank — need a directory with package.json beside .agents/SYSTEM/, .agents/META/ or open-brain/`**, exit 1. Passing the directory changes nothing (**D1**) |
| manual fix 2 | `package.json` `{"name":"blank","version":"0.0.0","private":true}` |
| 6 again | `Validates: yes` · **`Tasks: 4`** · `unparsed lines 17` · no WARNING |
| 7 (stand-in) | `Wrote: .agents/state.json at revision 0`; 4 views rendered |
| 8 | Predicted 13 (no ` M`, since everything was new). Listed **14**: the 13 plus `?? package.json` from manual fix 2. Step 8 says to stop and ask; the owner said include it. `4245a2a Bootstrap SIA`; status empty afterwards |

- **(a)** `Tasks: 4`, but only after manual fix 2.
- **(b)** `schema_version 3`, rev 0, project `blank`, T-001..T-004 with `closed_rev null`, and 0 SIA-history matches in
  all 5 files.
- **(c)** `ob_start`:
  - `Project: blank v0.0.0` in the header and the State block;
  - P0–P3 one task each;
  - NOT A SEAT;
  - 265 words.
  - The hook said the same, `Agent: blank (none)`.
- **(d)** 14 listed against 13 predicted. The extra file is the manual fix's own, and step 8's "stop and ask" caught it.
- **(e)** **FAIL: two manual fixes, neither in `bootstrap.md`.**

### Every place the text was unclear (both installs)

- **U1, step 0:** there is no fallback when `~/.claude/settings.json` has no SessionStart hook.
- **U2, step 2.2:** nothing says what to do when there is nothing to commit (D6).
- **U3, step 5 → step 7:** step 5 has the owner set SUMMARY's status to "Just bootstrapped". `--commit` then cuts
  exactly that blockquote ("removed 24 lines (2 blockquote + …)") and renders its own status line, so the edit is
  discarded. It is harmless, but it is a step whose only effect is undone two steps later.
- **U4, step 6:** `unparsed lines 17` appears with no explanation in both installs. They are the template INBOX's own
  "How to Use" lines. A stranger told to check the Tasks count sees a 17 next to it and cannot tell whether it matters.
- **U5, step 5:** "replace the objective" leaves the template's PRD-first "Active Tasks" table and acceptance criteria
  in `task.md`. It turned out not to matter, because `--commit` re-renders `task.md` entirely. The text does not say so.
- **U6, dispatch item 6:** `check` run after scaffold. It gives misleading wording, and a routing gap on resume (D3).
- **U7, step 6 for a non-Node project:** the refusal names a remedy ("need a directory with package.json") that
  `bootstrap.md` never prepares the reader for (D1).

## Dispatch item 6: `bootstrap check` after step 4

**The wording is misleading, and it is more than wording.**
1. "An existing project on the pre-record framework" is false for a stranger who has just scaffolded. "Not a fresh
   install" says they took a wrong turn.
2. The `git:` line on the same screen says `11 uncommitted change(s)`, and step 2.3 says to commit uncommitted changes
   before scaffolding. A literal reader may commit the scaffold on its own.
3. **Routing (D3, probe P6):** bootstrap interrupted after step 3, then resumed at step 1. `check` → `PRE-STATE`, and
   step 1's table says "Skip to step 6 (the import)". So steps 4 and 5 are skipped, and `--draft` gives
   `Validates: yes`, **`Tasks: 10`**, no WARNING. The tasks are the template's: P0 "Write the PRD (`.agents/SYSTEM/PRD.md`)",
   P1 "Derive ENTITIES.md …", and so on. The objective is `**Write the PRD**`. Nothing tells the owner that these are
   placeholders.

**Recommendation** (Forge 133 proposed the first half): `check` says "scaffolded, not yet imported: continue at step 4"
when the tree holds exactly scaffold's files. **And** `--draft` warns when INBOX.md is byte-identical to the template's.
Both are small.

## Mutants (mine; driver `docs/loops/qa-135/evidence/mut-driver.cjs`, output `mutants.json`)

The method:
- Each mutant uses an exact anchor whose count is asserted to be 1, and the edit is asserted to have landed.
- `tsc --noEmit -p .` runs, and so do 5 test files: `bootstrap-fix`, `template-seed`, `session-start/role-files`,
  `state-import`, `state-import-v3` (52 tests).
- Each failing test is read from vitest's JSON reporter.
- The files are restored and hash-checked.
- It runs in its own worktree, `C:\qa-scratch\mut` at `6543e8e`.
- The unmutated baseline is **52/52** when run alone. A first baseline, run while the full suite was running beside
  it, showed 1 failed and 1 error. I did not capture which, and the unloaded re-run was green. The mutant runs were
  sequential and unloaded.

| Mutant | What it breaks | tsc | passed | Verdict | Failing tests | restored |
|---|---|---|---|---|---|---|
| `M1-residue-deleted` | move-residue deletes the residue and reports it moved | 2 | 51/52 | **KILLED** | 1: first is “bootstrap-fix: BF-3: `open-brain bootstrap check` / `move-residue` move-residue moves it under .agents/archive…” — `AssertionError: expected false to be true // Object.is equality` | true |
| `M1b-residue-emptied` | move-residue moves the names but not the bytes (each file emptied) | 0 | 51/52 | **KILLED** | 1: first is “bootstrap-fix: BF-3: `open-brain bootstrap check` / `move-residue` move-residue moves it under .agents/archive…” — `AssertionError: expected false to be true // Object.is equality` | true |
| `M2-no-zero-task-warning` | the 0-task WARNING is removed | 2 | 51/52 | **KILLED** | 1: first is “bootstrap-fix: BF-1: the scaffolded INBOX imports, and an INBOX that yields 0 tasks says so an INBOX with item…” — `AssertionError: expected 'Tasks: 0 (open 0, in_progress 0, bloc…' to match /WARN` | true |
| `M3a-template-state-restored` | the template's placeholder state.json is back in project-template/ | 0 | 50/52 | **KILLED** | 2: first is “bootstrap-fix: BF-2/4/6/7/8: scaffold, import, commit, /start — on a real git project BF-2: the template ships…” — `AssertionError: expected true to be false // Object.is equality` | true |
| `M3b-template-state-copied` | the template state.json is back AND scaffold copies it | 0 | 48/52 | **KILLED** | 4: first is “bootstrap-fix: BF-5: role: none with no roles/ directory reports NOT A SEAT and raises no problem a not-a-seat…” — `AssertionError: expected 1 to be +0 // Object.is equality` | true |
| `M4-pre-state-is-residue` | prose TASKS/ is no longer PRE-STATE, so move-residue would move a real project's tasks aside | 0 | 51/52 | **KILLED** | 1: first is “bootstrap-fix: BF-3: `open-brain bootstrap check` / `move-residue` a record (state.json) is BOOTSTRAPPED and p…” — `AssertionError: expected 'residue' to be 'pre-state' // Object.is equality` | true |
| `M5-record-is-residue` | a state.json no longer means BOOTSTRAPPED | 0 | 51/52 | **KILLED** | 1: first is “bootstrap-fix: BF-3: `open-brain bootstrap check` / `move-residue` a record (state.json) is BOOTSTRAPPED and p…” — `AssertionError: expected 'residue' to be 'bootstrapped' // Object.is equality` | true |
| `M6-not-a-seat-role-missing` | role: none reports ROLE FILE MISSING again (BF-5) | 0 | 50/52 | **KILLED** | 2: first is “bootstrap-fix: BF-5: role: none with no roles/ directory reports NOT A SEAT and raises no problem no ROLE FILE…” — `AssertionError: expected [ Array(1) ] to deeply equal []` | true |
| `M7-template-eol-dropped` | the template gitattributes no longer forces eol=lf (BF-7) | 0 | 46/52 | **KILLED** | 6: first is “bootstrap-fix: BF-5: role: none with no roles/ directory reports NOT A SEAT and raises no problem a not-a-seat…” — `AssertionError: expected 1 to be +0 // Object.is equality` | true |
| `M8-scaffold-overwrites` | scaffold overwrites an existing file | 0 | 51/52 | **KILLED** | 1: first is “bootstrap-fix: BF-2/4/6/7/8: scaffold, import, commit, /start — on a real git project scaffold never overwrite…” — `AssertionError: expected [] to include '.claude/commands/start.md'` | true |
| `M9-future-tracked-unchecked` | verify no longer checks that state.json/next-session.md will be tracked | 0 | 51/52 | **KILLED** | 1: first is “bootstrap-fix: BF-2/4/6/7/8: scaffold, import, commit, /start — on a real git project the tracking check fires…” — `AssertionError: expected '.agents/TASKS/INBOX.md: scaffold call…' to match /…/st` | true |
| `M10-agent-md-untracked` | the template gitignore no longer tracks AGENT.md (BF-5 in a clone) | 0 | 46/52 | **KILLED** | 6: first is “bootstrap-fix: BF-5: role: none with no roles/ directory reports NOT A SEAT and raises no problem a not-a-seat…” — `AssertionError: expected 1 to be +0 // Object.is equality` | true |
| `M11-archive-counts-dirty` | the moved residue under archive/ makes the tree dirty (scaffold would refuse) | 0 | 50/52 | **KILLED** | 2: first is “bootstrap-fix: BF-2/4/6/7/8: scaffold, import, commit, /start — on a real git project residue moved BEFORE git…” — `AssertionError: expected [ Array(1) ] to deeply equal []` | true |
| `M12-section-re-reverted` | SECTION_RE back to /^## (P[0-3])\b/ (the template's emoji headings stop parsing) | 0 | 50/52 | **KILLED** | 2: first is “bootstrap-fix: BF-1: the scaffolded INBOX imports, and an INBOX that yields 0 tasks says so the template's own…” — `AssertionError: expected +0 to be 10 // Object.is equality` | true |
| `M13-landed-check-removed` | move-residue no longer reads back what landed | 0 | 52/52 | **SURVIVED** | none | true |
| `M14-claude-md-any-heading` | check treats any CLAUDE.md as already carrying the SIA section (the append is never offered) | 0 | 50/52 | **KILLED** | 2: first is “bootstrap-fix: BF-3: `open-brain bootstrap check` / `move-residue` an .agents/ with no state.json and no TASKS…” — `AssertionError: expected 'has-sia-section' to be 'present' // Object.is equality` | true |
| `M15-agent-md-role-developer` | scaffold's AGENT.md declares role: developer (a fresh install is a seat again) | 0 | 51/52 | **KILLED** | 1: first is “bootstrap-fix: BF-2/4/6/7/8: scaffold, import, commit, /start — on a real git project the whole path: scaffold…” — `AssertionError: expected 'Tree currency: NOT CHECKED — origin/m…' to contain 'NO` | true |
| `M1t-residue-deleted-typed` | M1 in a form that typechecks: delete the residue, report it moved | 0 | 51/52 | **KILLED** | 1: first is “bootstrap-fix: BF-3: `open-brain bootstrap check` / `move-residue` move-residue moves it under .agents/archive…” — `AssertionError: expected false to be true // Object.is equality` | true |
| `M2t-no-zero-task-warning-typed` | M2 in a form that typechecks: inboxWarning always null | 0 | 51/52 | **KILLED** | 1: first is “bootstrap-fix: BF-1: the scaffolded INBOX imports, and an INBOX that yields 0 tasks says so an INBOX with item…” — `AssertionError: expected 'Tasks: 0 (open 0, in_progress 0, bloc…' to match /WARN` | true |

**19 mutants (17 kinds, M1 and M2 each in two forms): 18 KILLED, 1 SURVIVED.**
- Every kill is an `AssertionError`, not a timeout or a load failure; the full failure text for each is in
  `mutants.json`.
- Every mutant was restored and hash-checked (`restored true`), and the mutant worktree was clean afterwards.

**The three required kinds were all killed, each in a form that typechecks:**
- the residue deleted instead of moved: M1t, and M1b, which keeps the names but empties the bytes;
- the 0-task warning removed: M2t;
- the template `state.json` restored (M3a), and restored and copied by scaffold (M3b).

**M13 SURVIVED:** `moveResidue`'s read-back of what landed can be removed, and no test notices.
- It is a defence for a partial rename, which no fixture produces, so the risk is low.
- But its doc comment says "the moved entries are read back before the move is reported", and nothing tests that.

The first M1 and M2 forms (`tsc` exit 2) were killed too; they are kept in the table for honesty (E3).

## CI (tcm) and the local control run

| # | Run | Ref / SHA | Result |
|---|---|---|---|
| 1 | `36279886856` | `qa/bootstrap-fix-cand` = `6543e8e` (the candidate, unchanged) | **success**, runner `tcm-1`, machine `tcm`: **Test Files 87 passed (87); Tests 1339 passed \| 2 skipped (1341)**. `bootstrap-fix.test.ts` 23 tests ✓. This matches Forge's `36232404753` exactly |
| 2 | `36280226004` | `qa/bootstrap-fix-qa-tests` = `4fab7ba` (`6543e8e` + `qa135-bootstrap.test.ts` only) | **failure, as intended**, `tcm-1`: **Test Files 1 failed \| 87 passed (88); Tests 5 failed \| 1341 passed \| 2 skipped (1348)**. The 5 failures are exactly the 5 DEFECT rows, each an `AssertionError` (D1 `not to match /no project root found/`; D2 `expected [ 'SYSTEM', 'TASKS', …(2) ] to deeply equal [ 'SYSTEM', 'TASKS' ]`; D3 `not to match /not a fresh install/`; D4 `not to match /BOOTSTRAPPED/`; D5 `expected false to be true`). The 2 CONTROL rows passed, so 1339 + 2 = 1341. **D1–D5 reproduce on Linux, not only on Windows** |

**Runs used: 2 of 6.** `test-windows` was skipped (opt-in, not requested).

**The one local full-suite control** (default TEMP `C:\Users\Aaron\AppData\Local\Temp`, so Defender stays in play; at
`6543e8e`): **Test Files 1 failed | 86 passed (87); Tests 2 failed | 1339 passed (1341)**, exit 1.
- The 2 failures are both `tests/pipelines/session-start/tree-currency.test.ts`, each `Test timed out in 5000ms`.
- That file and `tree-currency.ts` are **not** in the candidate's diff against its base.
- My first mutant baseline was running beside the suite, so the load was partly mine.
- I record it as a Windows timing result, not a candidate defect. It was not re-run: one control run was allowed.
- The local count has 0 skips where tcm has 2. The 2 are platform-conditional; I did not chase them.

## What could not be verified

- **`/start` in a fresh Claude session**, which is what (c) literally means. I called `handleStart` from a script
  instead, which is how Forge ran it too. The model-side behaviour (F14) is out of reach here.
- **The owner running `--commit`** (G-007). I ran it as the stand-in, in scratch only.
- **Step 0 as written.** This machine has no SessionStart hook, so `<SIA>` was given, not found.
- **The QA PC.** This run was on Aaron's desktop, so the Defender exclusion on `C:\qa-tmp` could not be confirmed:
  `drive.meta` recorded `defender_exclusions=` as empty.
- **A real Claude Code agent reading `bootstrap.md`.** I was the stranger, and I know the codebase. The two installs
  are "literal", not naive.
- **GitNexus impact/detect_changes** were not available (dispatch). QA changed no product code.

## Defects

| # | Severity | What | Where | Evidence |
|---|---|---|---|---|
| **D1** | **High for non-Node projects** | `state import` refuses any project with no `package.json`, so step 6 cannot run for Python/Go/Rust/new projects. `bootstrap.md` never mentions the requirement. `bootstrap check`/`scaffold` accept such projects, so the failure comes after the scaffold is on disk | `shared/repo-root.ts` `resolveRepoRoot` (pre-existing; the importer's root rule) | Install (ii) step 6; `qa135-bootstrap.test.ts` D1, red locally and on tcm run 2 |
| **D2** | **High, wrong-project write** | In such a project, step 6 walks **up** and drafts a parent that has `package.json` + `.agents/SYSTEM/`. It writes `state.draft.json` and the report into the **parent's** `.agents/`, and step 7 would commit the parent's record. `bootstrap check` deliberately never walks up (its comment says so), but the importer does | same | probe P7 (`Root: C:\qa-scratch\probes\p7`, the parent's `.agents/` gained 2 files); test D2 red locally and on tcm run 2 |
| **D3** | Medium | After scaffold, `check` says PRE-STATE / "not a fresh install". Resuming from step 1 skips steps 4–5 and imports the template's 10 example tasks and "Write the PRD" as the record, with no warning | `bootstrap/index.ts` `agentsState`/`nextStep`; `bootstrap.md` step 1 table | probe P6; test D3 red locally and on tcm run 2 |
| **D4** | Low–medium | `check` calls any `state.json` BOOTSTRAPPED without reading it: a zero-byte file, or the old `{{PROJECT}}` seed. `/start` then shows `Project: {{PROJECT}}` and the NO SEAT problems | `agentsState` | P1b, P1c; test D4 red locally and on tcm run 2 (the valid-record control is green) |
| **D5** | Low | A second `move-residue` on the same day moves **everything**, the earlier archive included, into the same dated folder, which nests it (`…residue-2026-09-26/archive/…residue-2026-09-26/a.json`). It then prints `refused … check it by hand` with exit 1, **after** moving. Nothing is lost, but "refused" is false: the move happened. `agentsState` leaves `archive/` out of the entries, while `moveResidue` moves the whole `.agents/` | `moveResidue` | P3b; test D5 red locally and on tcm run 2 |
| **D6** | Medium for new projects | An empty folder cannot make "The project before SIA" commit (`nothing to commit`, exit 1), and `check`/`bootstrap.md` loop on the same instruction | `bootstrap.md` step 2.2; `nextStep` | install (ii) |
| D7 | Cosmetic | Step 5's SUMMARY status edit is removed by `--commit` (U3) | `bootstrap.md` step 5 | install (i) step 7 |
| D8 | Cosmetic | `ob_start` says `READER'S SEAT UNRESOLVED` on a not-a-seat checkout, and `role-files.ts:66-69`'s comment still claims a not-a-seat write is refused | `state-render`/`role-files.ts` | both installs' (c) |

**Out of this candidate's scope, seen in passing:**
- Every rendered view is stamped `by open-brain v<the project's version>` (`v0.0.1` for frogger): `state-views/index.ts`
  `header()` takes `package.json`'s version (`state-writer.ts:295`). It predates this branch.
- The importer keeps the markdown bold in the objective (`**Frogger is playable …**`).
- Tree currency still prints "NOT CHECKED … This is not a pass" on every fresh install (F13, a task).
- The imported `developer [legacy]` handoff on a project with no seats (Forge's BF §8).
- `project-template/README.md:40`'s standalone `cp -r project-template/.agents` still yields an `AGENT.md` whose role is
  the placeholder `<builder | researcher | …>`.

## Disagreements

- **With Forge 133 §6 on the post-step-4 `check` line:** "noticed, not fixed", as wording. It is also a routing gap
  that imports template tasks on resume (D3), so I would not call it wording only.
- **With the developer handoff §2's "bootstrap.md carries no file content":** it carries the SIA section. That is
  right as a design (no template file holds it), but the sentence overstates it.
- **With the brief's BF-3 rule, mildly:** `state.json`-only as BOOTSTRAPPED is the brief's letter, and I scored it as
  such. D4 asks for the file to at least parse before `check` says so.

## Error entries (mine)

- **E1:** my first SessionStart-hook payload was mis-escaped by my shell (`\\` in a JSON path). The hook **refused**
  it ("the payload on stdin is not valid JSON … Nothing was written"), which is correct. Re-run with forward slashes.
  It is kept in transcript (i).
- **E2:** I started the mutant baseline while the full-suite control was running. That load likely caused the
  baseline's 1 unexplained failure and contributed to the full suite's 2 timeouts. The baseline was re-run alone
  (52/52). The full suite was not re-run (one control run).
- **E3:** my first M1 and M2 edits did not typecheck (`tsc` exit 2). For M2, `if (r) return null;` narrowed `r` to
  `never`: `TS2339: Property 'sources' does not exist on type 'never'`. I did not diagnose M1. Vitest ran both anyway
  through tsx, and both were killed. I re-ran them as M1t and M2t, which typecheck (`tsc` 0), and both were killed on
  the same assertions. All four rows are in the table.
- **E5:** I tried the `Monitor` tool to wait for the mutant batch, and it was **denied** (dontAsk mode). I did not
  retry it. I waited with a plain Bash `until` loop on the batch's own output file instead: an ordinary wait, not a
  way around the denial.
- **E6:** my first draft of this report stated mutant outcomes before the batch had finished. It guessed "M9
  survived" and "13 of 14", and both were wrong: M9 was killed, and M13 survived. Every mutant claim here was then
  rewritten from `mutants.json`.
- **E4:** a junk no-op command (`git diff --no-index /dev/null /dev/null`) crept into transcript (i) at step 5. I
  removed it from the transcript. It touched nothing.

## Open for the planner

1. **D1/D2: is a non-Node project in scope for "a stranger can install this" (T-154)?** If yes, this candidate should
   not merge as the fresh-install fix until step 6 works without a `package.json` and never walks into a parent. The
   simplest cut is for `state import` to take the directory literally when `.agents/TASKS/` is there, as `bootstrap
   check` does. If no, `bootstrap check` should say so at step 1 (a `package.json` is required) rather than let
   scaffold write files that step 6 cannot import. **My recommendation: fix D1/D2 in a small round, since D2 is a
   wrong-project write.**
2. **D3:** do you want the "scaffolded, not yet imported" state in `check`, plus a WARNING for an INBOX identical to the
   template's? I recommend both.
3. **D6:** should `bootstrap.md` step 2.2 say "if there is nothing to commit, commit with `--allow-empty`"? Or should
   `check` detect an empty tree? Either is one line.
4. **M13 (the survivor):** a small test would close it: make one entry unmovable (or stub `renameSync` to move a
   subset), and assert that the read-back names the difference. It is not blocking.
5. **Machine:** this run was on DESKTOP-0GV3HAD, not the QA PC. If the queue expected the QA PC, the driver's
   first-found `claude.exe` rule picked this machine's npm copy.

## Files (on `qa/bootstrap-fix-report`)

- this report;
- `docs/loops/qa-135/evidence/`:
  - `install-i-transcript.txt` and `install-ii-transcript.txt`;
  - `probes.txt` and `probes2.txt` (P1–P7), with their scripts `probes.sh` and `probes2.sh`, and `t.sh`;
  - `bf7.txt`;
  - `mut-driver.cjs`, `mutants.txt` and `mutants.json`;
  - `full-suite-local.txt` (ANSI stripped);
  - `ob-start.mjs` and `ob-state.mjs`.
- The red rows: `open-brain/tests/pipelines/qa135-bootstrap.test.ts` on `qa/bootstrap-fix-qa-tests` (`4fab7ba`, parent
  `6543e8e`). They are evidence, not a fix.
- Pushed: `qa/bootstrap-fix-cand`, `qa/bootstrap-fix-qa-tests` and `qa/bootstrap-fix-report`, each through `push-qa.mjs`
  and read back. No other ref, no master, no force. No real project and no live `state.json` was written. The
  known-positive grep read SIA's record as tracked at `6543e8e`, the copy in the candidate worktree, not the live one.
  No `/end`.
- The report is also copied, uncommitted, into `~/Worktrees/sia-qa/docs/loops/`, the path the driver's completion
  check reads.

QA-135: REPORT COMPLETE
