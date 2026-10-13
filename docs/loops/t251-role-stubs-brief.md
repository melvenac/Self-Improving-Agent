# T-251 (+ the T-184 follow-up): adopted projects get role-file stubs and the right handoff seat; FUTURE_LOCAL names the draft-inputs record

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop or laptop one-off (any Windows host). No hub key. Code only. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t251-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 168. **Task:** T-251 (P2), plus T-184's follow-up. **Tag:** `T-251`.
**Size:** MEDIUM. **Base:** `304d56392c8e2fdab33b08a66daae96ece46ab5d` (origin/master; its code equals 399121cd). If
clark re-pins it at launch, that SHA wins. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: importHandoff migrate runCommit scaffold verifyTracking STATE_IMPORT_COMMIT_OUTPUTS (covered by tests/pipelines/state-import*, import-cmds-*, bootstrap-fix*, qa135-bootstrap, template-seed, t262-fix-2)
```

## Why

T-251 (read its note in `.agents/state.json`): role files are PER-REPO content, so SIA's own must never be copied into
another project, but today a new seat starts with NO role file, and the Makerspace import seated its handoff as
`developer` although its AGENT.md says `role: planner`. Verified at 399121cd: `project-template/.agents/` has no
`roles/`; `project-template/gitignore` re-includes only the five state files and AGENT.md, so a role file there would be
ignored, while the generated AGENT.md (`bootstrap/index.ts:653-654`) tells the owner to track `.agents/roles/`;
`state-import/index.ts:521` hard-codes `seat: "developer"`. T-184's follow-up: `FUTURE_LOCAL`
(`bootstrap/index.ts:554`) lacks `.agents/state.draft.inputs.json`, which `state import --draft` writes since #638.

## Ruling (exact names)

1. **Four stubs**, `project-template/.agents/roles/{shared,planner,developer,qa}.md`, at most 25 lines each (they print in
   full at every `/start`). Each opens with `Starting stub: replace with this project's own rules.` No person names, no
   seat names, no SIA procedure (the `template-personal-names` check scans every template file).
   - `shared.md`: rules for every seat: the record changes only through `ob_state`; run `/sync` before a commit; role
     files are tracked so every clone has them; a placeholder `## This project's rules`; and a placeholder
     `## Hub transport` ("If this project's seats talk over a hub, name the rooms and the command here."), because the
     template's `hub-room.mdc:20` and `.cursor/commands/start.md:113` cite `shared.md § Hub transport`.
   - `planner.md` / `developer.md` / `qa.md`: "Read shared.md first."; the seat's name lives in the untracked
     `.agents/AGENT.local.md`; a `## What this seat produces` section (planner: the next objective and how it will be
     accepted; developer: a change that meets the brief, plus the commands run; qa: accept or reject against the brief's
     criteria, with evidence); then the placeholder for this project's rules.
2. **Template gitignore** (`project-template/gitignore`): after the existing re-includes, add `!/.agents/roles/`,
   `/.agents/roles/*`, `!/.agents/roles/*.md` (SIA's own `.gitignore:66-68` form), and update the comment above them.
3. **`open-brain/src/shared/import-outputs.ts`:** add `export const ROLE_STUB_RELS` (the four paths) and append them to
   `STATE_IMPORT_COMMIT_OUTPUTS`. MOVE `DRAFT_REL`, `REPORT_REL` and `DRAFT_INPUTS_REL` here and re-export them from
   `state-import/index.ts` (bootstrap must not import state-import: state-import already imports bootstrap, and the cycle
   would leave `FUTURE_LOCAL` reading an undefined constant when state-import loads first).
4. **Scaffold** (`bootstrap/index.ts`): four `SCAFFOLD_FILES` entries with `tracked: true` (the existing rule at `~:587`
   copies only when the file is absent); `FUTURE_LOCAL` gains `DRAFT_INPUTS_REL`.
5. **Import, at `--commit` only** (`state-import/index.ts`, inside `migrate()`, after the render and before the draft
   move): for each stub, if the destination exists record it as `kept`; otherwise
   `writeFileSync(dest, readFileSync(templateStub), { flag: "wx" })` and record it as `installed` (not `copyFileSync`, so
   the atomic tests' fs mock can inject a failure; `wx` makes an overwrite impossible). A missing TEMPLATE stub is
   skipped and reported as `missing in template`, not thrown. Because it runs inside `migrate()`, the existing rollback
   removes installed stubs when the commit fails. `CommitResult` gains `role_stubs: { installed: string[]; kept: string[];
   missing: string[] }`; `cli.ts` prints one line for it. `--draft` installs nothing.
6. **Seat.** New `importSeat(root)`: `readAgentIdentity(root)` (`session-start/agent-identity.ts`; AGENT.local.md wins over
   AGENT.md, as `/start` does: planner ruling), then `SeatName.safeParse(role)`. Parsed → that seat; anything else (no
   file, no frontmatter, an empty or `<…>` placeholder, `none`, `builder`, `Planner` with a capital) → `developer` with
   `assumed: true`. `importHandoff` gains a fourth parameter `seat: Seat = "developer"`; a planner handoff gets
   `loop_state: { open_prs: [], frozen_sha: null, questions_for_aaron: [], rulings: [] }`, others `null`. `checkout`,
   `session_uuid`, `first_rev` and `sessions[0].seat` stay null. Record the choice in a NEW top-level
   `ImportReport.handoff_seat: { seat, declared_role, assumed }`, NOT inside `ImportReport["handoff"]` (its shape is pinned
   by typed literals in `state-import.test.ts:328` and `t253:20` and a `toEqual` at `:334`); one report line and one CLI
   line show it.
7. **`.claude/commands/bootstrap.md`:** step 3 adds the four stubs to the tracked list; step 6 names
   `state.draft.inputs.json`; step 8 adds the four stubs to the import-path list and tells an owner whose `.gitignore`
   predates this change to add the three roles lines (`--commit` cannot change `.gitignore`). Do not mention
   `state import --commit` before step 6 (`bootstrap-fix.test.ts:257-265` keys on its first occurrence).
8. **Out of scope:** template AGENT.md's placeholder roles (`builder | researcher | reviewer`), adding AGENT.md to the
   hashed inputs, `cursor-rules-current`. Name them in the reply as follow-ups.

## Existing tests (planner-researched; verdicts)

- **Update:** `tests/pipelines/template-seed.test.ts:20-41` "tracks exactly the five state files and AGENT.md" (append
  the three roles rules; its root-gitignore half stays green); `tests/pipelines/import-cmds-r2-l1.test.ts:25-41`
  "matches step 8 import-path list" (add the four stubs).
- **Stay green only if built as ruled:** `bootstrap-fix.test.ts:318` end-to-end (verify ok, check-ignore per file,
  committed = scaffold's tracked list + 2: needs the gitignore rule, and `--commit` installs nothing on the fresh path);
  `qa135-bootstrap` D1-D3 and `bootstrap-fix-r3` rows; `state-import.test.ts:77` (`--draft` adds exactly three files),
  `:196/:202` (exact `rendered`/`moved` lists), `:138/:333/:335` and `state-import-v3:54-55` (developer seat: those
  fixtures have no AGENT.md); `state-import-t184.test.ts` D1 (exactly five hashed inputs: do NOT add AGENT.md); import-cmds
  I3, I4, I5 (`/dirty-marker\.txt/`), I7, I8, I9-M3, r2-l2, r2-l3 (need the allowlist); the ~25 `tree(root).toEqual(before)`
  rollback rows; `t262-fix-2` N1 (no personal names).
- Any other newly failing row: STOP, `BLOCKED T-251 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t251-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`, else BLOCKED).
2. `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t251-wt")`, `Set-Location`
   into it, `git checkout -q -b fix/t251-role-stubs 304d56392c8e2fdab33b08a66daae96ece46ab5d`. HEAD must print that SHA
   and the tree must be clean, else STOP, BLOCKED. `npm ci` in `open-brain`. **Forbidden:** `git stash`,
   `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout.
3. **Base run** (in `open-brain`, 30-minute cap):
   `npx vitest run tests/pipelines/state-import tests/pipelines/import-cmds tests/pipelines/bootstrap-fix tests/pipelines/qa135-bootstrap.test.ts tests/pipelines/template-seed.test.ts tests/t262-fix-2.test.ts --no-file-parallelism --testTimeout=180000`.
   Paste the summary and every failing row.
4. **Commit 1, `T-251: tests (red)`.** New file `open-brain/tests/pipelines/t251-role-stubs.test.ts` (namespace imports;
   temp projects only):
   - **N1:** the four stubs exist, each differs from this repo's `.agents/roles/<n>.md`, each is at most 25 lines, none
     matches the personal-names pattern, and `shared.md` has a `## Hub transport` heading.
   - **N2:** scaffold's `written` includes the four paths with `tracked: true`; `git check-ignore` exits 1 for each.
   - **N3:** fixtures-import plus `.agents/roles/planner.md` = `# mine\n` → after `--commit`, planner.md is unchanged, the
     other three equal the template bytes, `role_stubs` is exactly `{ installed: [the three], kept: ["…/planner.md"], missing: [] }`.
   - **N4 (atomic):** inject a failure writing under `.agents/roles/` → the commit reports "Rolled back" and the tree
     equals before.
   - **N5 (seat table):** `role: planner` → planner with the empty `loop_state` (the draft validates); `role: qa` → qa;
     `none`, `builder`, a `<…>` placeholder, or no AGENT.md → developer with `assumed: true`; AGENT.local.md saying qa wins
     over AGENT.md saying planner.
   - **N6:** after `--commit`, `ownHandoff(handoffs, "planner").pick_up` equals the fixture's, and the developer lookup
     returns null.
   - **N7 (T-184 follow-up):** an owner `.gitignore` of `/.agents/*` plus `!/.agents/state.draft.inputs.json`, committed →
     scaffold exits 1 and `problems` is exactly
     `[".agents/state.draft.inputs.json: must stay local, but git would track it"]`.
   Run the file: N1-N7 red. Paste it.
5. **Commit 2, `T-251: role-file stubs for adopted projects, the imported handoff seated by role; FUTURE_LOCAL names the inputs record`:**
   the ruling, plus the two named row updates.
6. End both messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline 304d5639..HEAD`
   shows 2 lines; `git status --porcelain` is empty.
7. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0), the t251 file, then step 3's command again. Paste all three. Then
   from the repo root: `npx tsx open-brain/src/cli.ts sync --check` and paste the `template-personal-names` line.
8. **Mutants** (edit, run the t251 file only (M6 also import-cmds-r2-l1 and import-cmds I5's file), paste,
   `git checkout -- <file>`, clean tree; never commit):
   - M1: drop the roles rule from the template gitignore → N2 red.
   - M2: `--commit` overwrites an existing stub → N3 red.
   - M3: `importHandoff` ignores the seat parameter → N5, N6 red.
   - M4: a planner handoff with `loop_state: null` → N5 red.
   - M5: `FUTURE_LOCAL` without the inputs file → N7 red.
   - M6: the stubs missing from the allowlist → r2-l1 or I5 red.
9. `git diff --name-only 304d5639..HEAD` must show only: the four `project-template/.agents/roles/*.md`,
   `project-template/gitignore`, `.claude/commands/bootstrap.md`, `open-brain/src/shared/import-outputs.ts`,
   `open-brain/src/pipelines/bootstrap/index.ts`, `open-brain/src/pipelines/state-import/index.ts`, `open-brain/src/cli.ts`,
   `open-brain/tests/pipelines/t251-role-stubs.test.ts`, `open-brain/tests/pipelines/template-seed.test.ts`,
   `open-brain/tests/pipelines/import-cmds-r2-l1.test.ts`. If `/sync`'s mirror-parity or command-parity rows require the
   bootstrap.md template copy to change too, that copy is allowed: name it. Anything else: STOP, BLOCKED.
10. `git push origin fix/t251-role-stubs` (never force); `ls-remote` must equal `rev-parse HEAD`. Then
    `gh pr create --base master --head fix/t251-role-stubs --title "T-251: role-file stubs for adopted projects, the imported handoff seated by role; FUTURE_LOCAL names the inputs record" --body "Brief: docs/loops/t251-role-stubs-brief.md. After merge: rebuild the main checkout (project-template is served) and recopy ~/.claude/commands/bootstrap.md."`
    Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Reply

The first line is `READY T-251 <sha40> PR #<n>` or `BLOCKED T-251 <reason>`. Then each command with its output: base
run, red run, tsc, the t251 run, the second run, the sync line, the mutants, the name-only diff, `ls-remote` =
`rev-parse`, the PR URL and CI, and the out-of-scope follow-ups. At most 2 attempts at a red. Mark anything not run
`NOT RUN`. If the code differs from a line this brief quotes, follow the ruling's intent and say what differed. Do not
merge.
