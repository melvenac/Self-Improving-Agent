# T-297 step 1: the importer keeps a live project's decisions, names the handoff it did not import, and dates the last session

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t297s1-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-16, session 173. **Task:** T-297 (P2), items (1), (2), (4) and (5).
**Tag:** `T-297-S1`. **Size:** SMALL to MEDIUM (two src files; every edit is given verbatim).
**Base:** the dispatch SHA clark names (a master that contains this brief).
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: importDecisions importHandoff describeHandoffSeat describeLastSession findLastSession renderImportReport (state-import/index.ts; cli.ts's state import draft printer gains two lines)
```

## Why

These gaps were found reviewing the tarrantmailer migration (melvenac/co-op-mailer, 2026-10-16). Each was observed, not inferred.

- **(1) Decisions.**
  - `DECISIONS.md` uses `## YYYY-MM-DD — title` headings, and **0 of 98 imported**.
  - The importer reads only `### ADR-N: title`.
  - The report then said "imported as a dated log" anyway.
- **(2) Handoff.**
  - next-session.md had 90 lines before its first `##` heading, then five free-form sections.
  - None of it was imported, and the preamble was not even reported.
  - The view was re-rendered as "_Nothing recorded._", so the live handoff erased it.
  - This step does NOT copy those sections into the record as current: some of them were months stale ("Waiting on Aaron" asked for a design that had shipped). Instead it names them, and `pick_up` points to the snapshot that keeps them.
- **(4) Role.**
  - `role: implementation` is not a seat.
  - The draft already says "ASSUMED"; it now also says how to fix it.
- **(5) Last session.**
  - `# Session 3 — Applying the design (2026-09-04)` was dated the migration day: the importer reads only a date right after the dash.
  - It now also reads a date anywhere in that heading, then a `Date:` line in the first 10 lines. If neither is found, the draft says so.

Items (3) gitignore and (6) CRLF are step 2. Item (7), the view header version, is step 3.

## The change, exactly

- **Source files:** the edits are in `docs/loops/t297-s1/edits.txt` (16 exact-once replacements over `open-brain/src/pipelines/state-import/index.ts` and `open-brain/src/cli.ts`). Apply them with `docs/loops/t297-s1/apply.cjs`, which refuses unless every old text occurs exactly once.
- **Test file:** `docs/loops/t297-s1/state-import-t297.test.ts` goes to `open-brain/tests/pipelines/state-import-t297.test.ts` unchanged.

What the edits do:

1. **Decisions.**
   - `DATED_RE = /^#{2,3} (\d{4}-\d{2}-\d{2})\s+[—–-]+\s+(.+?)\s*$/`.
   - Dated entries become `D-001…`, numbered oldest first; same-date entries keep file order. They come after any ADRs.
   - The report gains `decisions.dated?`, and its sentence counts ADRs and dated entries.
   - The not-judged reason now reads "read as a log of past decisions (ADRs or dated entries), not judged as current state".
   - A new export, `decisionsWarning(r)`, warns when DECISIONS.md has lines but 0 imported. The report and the draft CLI both print it.
2. **Handoff.**
   - Non-blank, non-`# ` lines above the first `##` are reported in `sections_not_imported` as `(text before the first ## heading: N lines)`.
   - When `pick_up` would be empty and anything was not imported, `pick_up` becomes a pointer that names those sections and the snapshot. That is the text pinned in row H1.
   - The draft CLI prints `Handoff: N section(s) NOT imported (...)`.
3. **Seat.** For a declared role that is not a seat, `describeHandoffSeat` appends `; set role: in .agents/AGENT.md (or AGENT.local.md) to planner, developer or qa`.
4. **Last session.**
   - `findLastSession` tries the heading's `— date`, then any full date in the `# Session N` line, then a `Date:` line in the first 10 lines. `date_why` says which.
   - `describeLastSession` also returns a line when a real log's date fell back to the migration date.

## Measured before dispatch (QA PC SIMs by clark, 2026-10-16, at 3f14ff2e)

- **SIM 1:** the first draft also reported plain `## ` headings in DECISIONS.md as skipped. It turned `state-import.test.ts:130` red (the fixture's `## Decisions` heading), so that part was dropped.
- **SIM 2** (these exact files; edits sha256 `8b7971f6af6dcf3c…`, test `e45edd6a990de9b2…`):
  - **New file on the unpatched base:** `6 failed | 1 passed (7)`. Red: D1, D2, H1, S1, L1-L3, C1. Green: H2.
  - **After apply:** `tsc --noEmit` 0, `tsc -p tsconfig.tests.json --noEmit` 0. The step-4 paths (the `state-import` prefix includes the new file): `265 passed (265)`, 26 files.
  - **Mutants:** M1 → D1; M2 → H1; M3 → H1 + C1; M4 → L1-L3. Each was red exactly as predicted.

## Existing tests (verdicts)

The SIM 2 full run covered every test file that imports the state importer: the `state-import*` files, t251-role-stubs, t272-seat-checkout, bootstrap-fix, bootstrap-fix-r3, qa135-bootstrap, import-cmds-i1, import-cmds-i2 and template-seed. **No existing row changes.** Any red existing row: STOP, `BLOCKED T-297-S1 <test name>`.

## Steps

1. PowerShell:
   - `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t297s1-reply.md")); "REPLY_PATH=$reply"`
   - `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`
   - `node -v` must print `v22.*`; otherwise STOP.
2. Fresh clone into `(Join-Path $env:TEMP "t297s1-wt")` unless the launcher named one.
   - `git checkout -q -b fix/t297-s1-importer <base>`.
   - Check that HEAD equals the base, that porcelain is empty, and that `git ls-tree --name-only HEAD docs/loops/t297-s1/edits.txt` prints the path.
   - Run `npm ci` in `open-brain`, then `node -e "require('better-sqlite3')"`. If it fails with "Could not locate the bindings file", run `npm rebuild better-sqlite3` and say so.
   - Forbidden:
     - `git stash`, `reset --hard`, `--force`, rebase and amend;
     - any other checkout;
     - `npm run test:heavy`;
     - killing processes by name;
     - any read or write of the real `~/.claude/open-brain/`;
     - editing a real `settings.json` or `.agents/SYSTEM/greeting.json`;
     - editing anything under `docs/`.
3. **Commit 1, `T-297-S1: rows for dated decisions, the not-imported handoff and the last-session date`:**
   - `Copy-Item docs/loops/t297-s1/state-import-t297.test.ts open-brain/tests/pipelines/` (the file only).
   - With `$env:NO_COLOR='1'`, in `open-brain`, run `npx vitest run tests/pipelines/state-import-t297.test.ts --no-file-parallelism --testTimeout=180000`.
   - Expect exactly 6 red (D1, D2, H1, S1, L1-L3, C1) and H2 green. Paste the summary and the `x` rows.
4. **Commit 2, `T-297-S1: import dated decisions, name the handoff not imported, date the last session`:**
   - From the clone root: `node docs/loops/t297-s1/apply.cjs . docs/loops/t297-s1/edits.txt`. It must print exactly `APPLIED 16 edits to 2 files`; anything else: STOP.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then `npm run build` (exit 0).
   - Run `npx vitest run tests/pipelines/state-import tests/pipelines/t251-role-stubs.test.ts tests/pipelines/t272-seat-checkout.test.ts tests/pipelines/bootstrap-fix.test.ts tests/pipelines/bootstrap-fix-r3.test.ts tests/pipelines/qa135-bootstrap.test.ts tests/pipelines/import-cmds-i1.test.ts tests/pipelines/import-cmds-i2.test.ts tests/pipelines/template-seed.test.ts --no-file-parallelism --testTimeout=180000` (25-minute cap). Expect `265 passed`. Paste the `Test Files` and `Tests` lines.
5. Both commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   - `git log --oneline <base>..HEAD` shows 2 lines, and status is empty.
6. **Mutants:**
   - For each of `docs/loops/t297-s1/m1.txt` … `m4.txt`:
     - run `node docs/loops/t297-s1/apply.cjs . <mN>` (prints `APPLIED 1 edits to 1 files`);
     - run the new test file;
     - paste the summary and the `x` rows;
     - restore with `git checkout -- open-brain/src/pipelines/state-import/index.ts`;
     - check that status is empty.
   - Never commit a mutant. Expected red rows:

     | Mutant | Red rows |
     |---|---|
     | M1 | D1 |
     | M2 | H1 |
     | M3 | H1 and C1 |
     | M4 | L1-L3 |
7. `git diff --name-only <base>..HEAD` shows exactly:
   - `open-brain/src/cli.ts`
   - `open-brain/src/pipelines/state-import/index.ts`
   - `open-brain/tests/pipelines/state-import-t297.test.ts`
8. Push (never force). Check that `git ls-remote origin refs/heads/fix/t297-s1-importer` equals HEAD. Then:
   - `gh pr create --base master --head fix/t297-s1-importer --title "T-297-S1: import dated decisions, name the handoff not imported, date the last session" --body "Brief: docs/loops/t297-s1-importer-brief.md."`
   - `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY T-297-S1 <sha40> PR #<n>`, or `BLOCKED T-297-S1 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply.
- Every number is pasted output, with its command shown above it. Mark anything not run `NOT RUN`.
- Do not merge.
