# Makerspace import onto SIA: the brief Maker follows, and what SIA QA checks

**By:** Atlas (planner), session 164, 2026-10-07. **For:** Maker, the new Makerspace planner seat
(Aaron starts it). **Authority:** Aaron's focus change at ~07:2x CDT 10-07, **relayed by clark
(TOLD, one link; not read by the planner)**: SIA freezes at the stop point "repo migration
proven"; Makerspace is next. **Governs:** T-181's Makerspace slice. Read
`docs/loops/adoption-plan-2026-09-25.md` §5 (D-048's six guardrails) first. This file applies
them; it does not replace them.

## What "migration" means here

**An IMPORT, not a fresh install.** `~/Projects/Tarrant-County-Makerspace` already has an
old-framework `.agents/` (647 files, `FRAMEWORK.md` v1.1, its own `/start` and `/end`).
`/bootstrap`'s `bootstrap check` will say `PRE-STATE` and send you to its step 6 (the import).
**Record only (D-048 §5.4):** you get `state.json`, its views and the greeting. You get no loops,
no QA seat, and no change to site code, deploys or CI.

Read on 2026-10-07 (planner, desktop): HEAD `51a52a5`; **17 uncommitted files**; `INBOX.md` is
950 lines under 9 `## ` headings, **none of them P0–P3**; `AGENT.md` says `name: Relay`.

## Pins

- **SIA:** master **`ffc63aca`** (v0.45.0 + records), or any later master. **The CLI you run
  must be built from it.** `/bootstrap` calls `<SIA>/open-brain/build/cli.js` in Aaron's main
  checkout, and on 10-07 that build was **38 code commits behind**. **Precondition P0:** Aaron
  updates the main checkout to master and rebuilds. Use `npm install`, not `npm ci`, because
  running MCP servers lock `better_sqlite3.node`. Then check that a fresh SIA session's greeting no
  longer prints `STALE` on its `Build` line, and record the SHA it names.
- **Makerspace:** work on a branch, **`sia/adopt`**, cut from the commit that settles the 17
  files. Aaron merges it.
- **Command:** the installed `~/.claude/commands/bootstrap.md` is byte-identical to master's
  `project-template/.claude/commands/bootstrap.md` (checked 10-07). Follow it step by step.

## Steps

1. **Settle the 17 files.** Aaron or Maker does this, never a migration step (D-048 §5.2).
   Commit them, or stash them on a named branch. The tree must be clean. Record the SHA: **PRE**.
2. **Name the seat Maker.** Change `AGENT.md` `name: Relay` to `Maker`. Hub names are global, and
   Relay is A2A-Hub's planner. Do this in the rehearsal clone and again in the live tree.
3. **Rehearse in a throwaway clone** (D-048 §5.3), never in the live tree:
   `git clone ~/Projects/Tarrant-County-Makerspace <scratch>/tcm-rehearsal`, then run
   `bootstrap check` (expect `PRE-STATE`) and `state import --draft` there.
4. **Regroup the INBOX in the clone.** With 9 headings and none P0–P3, the first draft parses
   0 tasks. Move the *open* items under `## 🔴 P0`…`## 🟢 P3`. Move "Recently Completed" and the
   session findings out (into `docs/` or the archive) rather than into tasks. Re-draft until the
   report passes A2. **Write down the regrouping as a list of moves**, so step 5 replays it rather
   than re-deciding it.
5. **Live.** On `sia/adopt`, replay step 4's moves, run `--draft`, compare its summary to the
   rehearsal's (A3), then **Aaron runs `state import --commit`** (G-007).
6. **Session commands.** `PRE-STATE` skips scaffold, so the project keeps its OLD `/start` and
   `/end` in `.claude/commands/`. Those take precedence over the global ones and do not call
   `ob_start`. Replace them with the template's four (`start`, `end`, `task`, `sync`) on Aaron's
   word, and move the old ones to the archive. **This is the step most likely to be missed: the
   import can succeed while `/start` still runs the old protocol.**
7. **The SIA commit** (bootstrap step 8), then push `sia/adopt`.

## Acceptance: "migration proven" means all of A1–A8 hold

| # | Check | Evidence Maker files |
|---|---|---|
| A1 | Tree clean before the import; PRE recorded; 0 of the 17 files lost | `git status` at PRE; where each of the 17 went |
| A2 | Rehearsal draft: `Validates: yes`; tasks parsed > 0 and equal to the open items moved; **0 SIA history ids** (no `V-0xx`/`G-0xx` from SIA; T-175); no stale-input warning, or `--accept-stale` with a written reason (T-180); no encoding damage (non-ASCII text survives byte for byte; R4-4) | The draft report, verbatim |
| A3 | Live draft summary equals the rehearsal's (same task count and ids) | Both summaries side by side |
| A4 | **No site code touched:** `git diff --stat PRE HEAD -- . ':!.agents' ':!.claude' ':!CLAUDE.md' ':!.gitignore' ':!.gitattributes'` is empty | That command's output |
| A5 | Fresh session `/start` in Makerspace: a `## Briefing` block with Makerspace's own project name, objective and tasks, `Drift: none`, seat Maker, no SIA ids | The `/start` output, verbatim |
| A6 | **Lifecycle round trip:** one `ob_state` write moves the record to rev 1 and views re-render with drift none; `/end` writes a handoff; the next `/start` shows it as pick-up | Three outputs |
| A7 | **Clone test (T-167 lesson):** a fresh `git clone` of `sia/adopt` into a new folder, then `/start` there, gives the same briefing. This proves the record travels and is not only on one disk. | The `/start` output from the clone |
| A8 | **Nothing lost:** the old INBOX/task text is in `.agents/archive/` and git; a reconciliation lists each old open item and where it went (task id, docs, or dropped *with Aaron's word*) | The reconciliation table |

The frogger lessons are built into these checks: F1 (template headings unreadable while the
report said "Validates: yes") is why A2 counts tasks rather than trusting `Validates`. F5 (leftover
files make bootstrap a no-op) is why step 6 exists. F14 (an agent flagged what it never checked)
is why every row asks for verbatim output.

## What SIA QA checks afterwards

One **read-only** QA run, independent of Maker. It runs on the laptop, or on Plumb only after
confirming `/home/melvenac/builds/BUILDING` is absent. It **writes nothing to Makerspace**.
- Re-derives A4, A5 and A7 itself from a fresh clone of `sia/adopt`. It does not take them from
  Maker's files.
- Reads Maker's A2/A3/A8 evidence and spot-checks 5 reconciled items against the old INBOX at PRE.
- Verdict: ACCEPT, meaning SIA's stop point "repo migration proven" is reached, or REJECT with a
  named row.

## Planner ruling Aaron should see

D-048 guardrail 1 says Makerspace follows **both pilots done cleanly**. Neither is: the co-op-mailer
import never ran (no `state.json` there), and the frogger re-run (T-241) is open. **Ruling:** frogger
tests the fresh-install path, which Makerspace does not take, so it is not a gate. The
throwaway-clone rehearsal (step 3) **is** the import pilot, run on the real inputs. That is stronger
evidence than co-op-mailer, which has clean P-headers and would not exercise the regroup. This
changes a guardrail Aaron agreed to, so it stands only on his word.
