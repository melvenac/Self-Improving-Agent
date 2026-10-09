# QA 296, session-165 batch a: the Makerspace import (A1–A8), narrow and read-only

**By:** Atlas (planner), 2026-10-09, record session 165. **Machine:** the laptop (Windows), booked and launched by
clark (D-065). **Routing:** D-140. Normally Grok would take the static rows, but clark ruled (2026-10-09) that ONE
Claude run covers A1–A8, because the Makerspace repo is private and the Grok token reads SIA only.

- **What is under test:** `melvenac/melvenac-makerspace`, branch `sia/adopt`, pinned at
  **`bb06a3673377c766b8c2b7ab8f9086734c8aca78`**. The planner verified it in a fresh longpaths clone: it equals
  ls-remote, the 5 record files are `w/lf attr/text eol=lf`, the tree is clean, A4 is empty, and `bootstrap check`
  reports BOOTSTRAPPED with 4 SIA commands.
- **Criteria:** `docs/loops/makerspace-import-brief.md` §Acceptance (A1–A8).
- **Prefix:** `s165a`. **Report:** `docs/loops/s165a-qa-report.md` on branch `qa/s165a-report` in the SIA repo, pushed
  only with `node docs/loops/qa-296/push-qa.mjs qa/s165a-report`.
- **The stop point:** an ACCEPT here is SIA's "Makerspace migration proven" (D-130). The planner sends it to clark, and
  Aaron merges `sia/adopt`.

**Do not read** Maker's or any planner's messages or hub rooms until your report is pushed. **Never touch** Maker's live
tree. It is on the desktop, not this machine, so do not try to reach it.

## Setup (paths are fixed; use forward slashes; node needs `C:/…`, not `/c/…`)

| Name | Path |
|---|---|
| `MK` | `C:/qa-scratch/qa296-mk`, a clone of the Makerspace branch |
| `TMP` | `C:/qa-tmp/qa296` |
| `DB` | `C:/qa-tmp/qa296/knowledge-v2.db` |
| `VAULT` | `C:/qa-tmp/qa296/vault` (create it empty) |
| `REALDB` | `$HOME/.claude/open-brain/knowledge-v2.db`, which you read the mtime of and never write |

Every child `claude` you start gets `KNOWLEDGE_V2_DB=<DB>` and `OPEN_BRAIN_VAULT_DIR=<VAULT>` in its environment.
**Do NOT change `HOME` or `USERPROFILE` for a child `claude`.** It needs `~/.claude` for its login and its MCP
config. The REALDB guard (G1) is what proves no write leaked.

## Rows

| # | Command(s) | Pass when |
|---|---|---|
| P1 | `node -v` | prints `v22.*`; otherwise STOP → `INCOMPLETE node` |
| P2 | `claude mcp get open-brain`. Print ONLY the command and args path, never env values (G-051). Let `SIA` be the repo root above `open-brain/build/`. Then `node -e "console.log(require('<SIA>/open-brain/build/build-info.json').commit)"` and `git -C <SIA> merge-base --is-ancestor 6f83c5abcc19a986937b001b16602a14e139e7f2 <that commit>; echo EXIT=$?` | `EXIT=0`. Otherwise STOP → `INCOMPLETE laptop SIA build <commit> predates 6f83c5ab`. **Do not rebuild** (clark's ruling) |
| P3 | `git ls-remote https://github.com/melvenac/melvenac-makerspace.git refs/heads/sia/adopt` | equals `bb06a3673377c766b8c2b7ab8f9086734c8aca78`. Otherwise STOP → `INCOMPLETE pin moved` |
| P4 | `git clone -c core.longpaths=true -b sia/adopt https://github.com/melvenac/melvenac-makerspace.git <MK>`, then `git -C <MK> rev-parse HEAD` and `git -C <MK> status --porcelain` | HEAD = the pin, and porcelain prints nothing |
| G0 | Record REALDB's mtime (`node -e "console.log(require('fs').statSync(process.argv[1]).mtime.toISOString())" <REALDB>`) | printed |
| A1 | `git -C <MK> cat-file -t 9aa50d183cdc94baf78b4cb196a6b950fdc38358`; `git -C <MK> merge-base --is-ancestor 9aa50d18 HEAD; echo EXIT=$?`; read `.agents/archive/import-reconciliation-2026-10-09.md` §A1 | `commit`; EXIT=0; the A1 section names 17 paths. Each path is either present in `git -C <MK> ls-tree -r --name-only 9aa50d18` (committed) or listed as discarded with Aaron's word (TOLD (Maker): record that label as it is). 0 unaccounted |
| A2 | Read `.agents/archive/pre-state-migration-2026-10-09/state.import-report.md`. Then `node -e` on `<MK>/.agents/state.json`: count tasks, count by status, count `/\b[VG]-0\d\d\b/` and `\uFFFD` in the file text | The report says `Validates: yes` and `Tasks: 38`; state.json has 38 tasks, all `open`; 0 SIA V/G ids; 0 U+FFFD |
| A3 | `node -e` deep-compare `<MK>/.agents/archive/pre-state-migration-2026-10-09/state.draft.json` with `<MK>/.agents/state.json`, ignoring nothing | Deep-equal: the committed record is the reviewed draft. The rehearsal-vs-live equality is Maker's evidence; mark it `TOLD (Maker)`, since the rehearsal clone no longer exists |
| A4 | `git -C <MK> diff --stat 9aa50d18 HEAD -- . ':!.agents' ':!.claude' ':!CLAUDE.md' ':!.gitignore' ':!.gitattributes'` | prints nothing |
| A5+A7 | From `<MK>`, with the env above: `claude -p "/start" --model sonnet --allowedTools "mcp__open-brain__ob_set_session,mcp__open-brain__ob_start,Read,Bash(git status:*),Bash(git status)" > <TMP>/a5-start.txt 2>&1; echo EXIT=$?` | `EXIT=0`, and the output contains: a `## Briefing` block that ends `## End Briefing`; `Tarrant County Makerspace`; `Drift: none`; the objective starting `Launch the rebuilt tarrantcountymakerspace.com`; `Maker` as the seat agent; task ids `T-0..`; and NO SIA identifiers (no `self-improving-agent`, no `V-0\d\d`, no `G-0\d\d`, no `D-1\d\d`). It runs in a fresh clone, so this is also A7 (the record travels). Paste the briefing block verbatim |
| A6a | From `<MK>`, same env: `claude -p "Do /start steps 1 and 2 only (ob_set_session, then ob_start with project_root set to this directory). Then call ob_state with project_root set to this directory, session = the number on ob_start's 'Session #N' line, expected_revision 0, ops [{\"op\":\"set_handoff\",\"seat\":\"planner\",\"pick_up\":\"QA-296 HANDOFF MARKER\",\"watch_out\":[],\"open_questions\":[]}]. Print ob_state's full output verbatim." --model sonnet --allowedTools "mcp__open-brain__ob_set_session,mcp__open-brain__ob_start,mcp__open-brain__ob_state" > <TMP>/a6-write.txt 2>&1; echo EXIT=$?` | `EXIT=0`; the output shows `Revision: 0 → 1` and `Rendered (4)`; `git -C <MK> status --porcelain` lists `.agents/state.json`, the 4 views (`.agents/TASKS/INBOX.md`, `.agents/TASKS/task.md`, `.agents/SESSIONS/next-session.md`, `.agents/SYSTEM/SUMMARY.md`) and, at most, session-log files `.agents/SESSIONS/Session_*.md`. Nothing else may appear |
| A6b | From `<MK>`, same env: the A5 command again, writing `<TMP>/a6-start.txt` | `Drift: none`; the PICK UP HERE section shows `QA-296 HANDOFF MARKER`; `state rev 1` |
| A6c | `/end`: **NOT RUN, by design.** It writes the vault and session store, and the planner rules that `set_handoff` is the handoff half of A6 for this QA. | Mark `NOT RUN (planner ruling)` |
| A8 | `git -C <MK> rev-parse 9aa50d18:.agents/TASKS/INBOX.md` and `git -C <MK> hash-object .agents/archive/INBOX-pre-sia-2026-10-09.md`. Read the reconciliation: count its rows; every T-id it names must exist in state.json; check the `## Approval` and `Confirmed` lines | Equal blobs; 49 rows (38 T-ids that all exist, 11 drops); the Approval section present with Aaron's AskUserQuestion, and the Confirmed line present |
| G1 | REALDB mtime again; `git -C <MK> log -1 --format=%H` | REALDB mtime unchanged since G0 (otherwise this is a FINDING: a write leaked); HEAD still the pin (the A6 writes are uncommitted, which is fine) |

## Rules

- Read-only for every repo except the scratch clone and your own `qa/s165a-*` branches in the SIA repo.
- Never push to `melvenac-makerspace`. Never commit in `<MK>`.
- Every number in the report is pasted command output, with the command above it. Anything not run is `NOT RUN`
  with its reason.
- **Verdict:** ACCEPT only if P1–P4, A1–A8 and G1 all pass, A6c being NOT RUN by design. Any failed row is REJECT,
  with its finding named. A STOP in P1–P3 is INCOMPLETE.
- The report's last line is exactly `QA-296: REPORT COMPLETE`.
