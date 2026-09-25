# Adopting Aaron's active projects onto SIA — the plan, and what planner session 100 settled

**By:** Atlas (planner), record session **100** · 2026-09-25 (UTC; Aaron's local date 2026-09-24). **Model:**
`claude-opus-5-5` (1M context); effort unrecorded for this session (it began before D-047's change).
**Why this file exists:** Aaron, in this session: *"Can we put this into a doc for future referance? I don't want to
roll this planner session and have to rebuild it."* Everything a later planner needs from session 100 is here or in
`.agents/state.json` (decisions D-047, D-048; the tasks named below; the planner handoff).

**Read first, if you are a fresh planner:** the SIA Step-Back artifact
(https://claude.ai/artifact/3Kv8BuKYrj5vaKQgD8NKC7), `.agents/SYSTEM/PRD.md`, `README.md`. Session 100 did not read them
at `/start` although the handoff said to. It was the second planner session in a row to skip them (error entry, §7). The
Step-Back stops at Loop 11 (2026-09-17). Loops 12–16 are not in it; for example, idea B (the core/memory split) shipped
later (V-035, V-036) but is listed there as never run. T-169 schedules the rewrite at Loop 15 close; the Step-Back needs
its Part 6 then too.

## 1. The purpose this plan serves

The Step-Back's finding, and Aaron's own reading of it: **what works is the lifecycle, meaning the record, the startup
greeting and the handoff, which together stop sessions starting cold.** The learning loop (rate, mature, prune) did not
deliver and was cut in Loop 10. Aaron (this session): *"The startup greeting is evidance that each agent has better
context for the project state and what's next than what they had before the loops."*

So adoption is about giving each project **`state.json` and the greeting**. Loops, three seats and QA are optional,
per project, and only where acceptance matters.

## 2. How the A2A-Hub migration went (the only prior adoption)

Read from A2A-Hub's own record and git on 2026-09-25 (origin/master `c4d2d1c`, state rev 44):

- **Migrated 2026-09-22** (`3beac7c`, `9fa2bcb`; seats `5bb0777`). Relay's write-up:
  `~/Projects/A2A-Hub/docs/loops/sia-migration-assessment.md`. **That file is the preparation checklist.**
- **Since then:** 98 commits, four loops each built, QA-accepted and tagged (v1.7.0 → v1.10.0), 5 verified records,
  8 new decisions. Relay, Rivet and Gauge each work in their own worktree, and SIA's startup loads their role files.
  Cross-project routing (D-039 here, D-003 there) works, and it caught errors on 2026-09-25 in both directions.
- **What was rough, all at import time:**
  1. The importer read tasks only under `## P0`–`## P3`; A2A-Hub's INBOX was grouped by roadmap version, so 106 lines
     were skipped until Relay regrouped it by hand.
  2. **The importer seeds SIA's own history** (V-001..V-005, G-001..G-006) into every project. Relay removed it with a
     parser. **T-175, still open.**
  3. The importer cannot tell that an input predates the latest `Session_N.md`: A2A-Hub's handoff and INBOX were
     stale, and Relay corrected them by hand. **Reported to the planner on 2026-09-22 and never recorded until now:
     T-180.**
  4. `--commit` had to be run by Aaron: the auto-mode classifier denies it inside an agent session (G-007).
  5. `.env` had to be copied into each seat worktree by hand.

## 3. Preconditions, before any other project is migrated

1. **Candidate A closes** (Loop 15 slice three; A8 is in QA 99 as of this writing).
2. **Forge fixes the importer: T-175 (delete the seeds) and T-180 (refuse or warn on stale inputs).** One short loop.
   Without it, every adoption repeats two hand clean-ups.
3. **T-167 is worth doing in the same stretch:** render the problem statement at `/start`. It is the structural fix
   for §7's error, and every adopted project inherits the greeting.

## 4. The order

| # | Project | State on disk, read 2026-09-25 | What it tests |
|---|---|---|---|
| 1 | **frogger** (`~/Projects/frogger`) | **Not a git repository.** `.agents/` holds only a leftover `reflection-queue.json`; has `CLAUDE.md`. No SIA core. | **Fresh install** (`/bootstrap`), the path T-154 names and nobody has walked on a real project. Step one is `git init` (Aaron's call). |
| 2 | **co-op-mailer** | INBOX already has P0–P3 headers; no `task.md` objective found; tree clean; last commit 2026-09-17; CI on hosted `ubuntu-latest` | **Import**, the easy case: validates the importer fixes end to end. Its mid-November drop is a soft deadline (Aaron). |
| 3 | **Tarrant County Makerspace** — record only (see §5) | INBOX **950 lines**, no P-headers; **17 uncommitted files**; last commit 2026-08-29; old framework (`FRAMEWORK.md` v1.1, old `/start`, `/end`); no CI workflows; pre-production | **The one that matters.** Record-only, before the cutover (D-048). |
| 4 | **foundry** | INBOX grouped Now/Next/Later (regroup needed); last commit 2026-09-05; 1 uncommitted file; CI hosted | The preparation step. |
| 5 | **worth-it-window-washing** | Non-standard `.agents/` (`biuld.txt`, `error.md`, email drafts); no tracked INBOX or handoff; 2 uncommitted files; no CI | The messy case. |

Frogger and co-op-mailer are the two pilots, one for each way onto SIA. Makerspace follows only when both are clean.

## 5. Makerspace: record only, before the cutover (D-048)

**Aaron, this session:** *"before the cutover would be better. I think adding state.jason would help the agent
immediatly."* Earlier: *"It's important we dont mess that one up"* and *"I've been hesitant to tough tarrant county
makerspace with sia in its loops."*

**Why before:** the Step-Back's Part 1 finding, *"they are logs wearing the name of state"*, is exactly Makerspace's
condition: every session reconstructs "where are we" from a 950-line INBOX. The record is the proven fix. The pre-cutover
development work is what benefits.

**The guardrails, in order:**
1. **Both pilots done cleanly, and the importer fixes landed.**
2. **The 17 uncommitted files are settled first**, by Aaron or Makerspace's own seat, never by a migration step.
   Uncommitted work is what a migration can lose.
3. **Rehearsal in a throwaway clone:** `state import --draft` there, never in the live tree. Read the report; measure
   how much of the 950 lines the importer can take; decide the regrouping from that.
4. **Record only:**
   - `state.json`, its rendered views and the greeting;
   - **one seat, no loops, no QA seat;**
   - **no change to site code, deploys or CI.**
5. `--commit` is run by Aaron (G-007). The importer snapshots `.agents/` to `.agents/archive/` first, and git keeps the rest.
6. Loops, seats and QA for Makerspace: **only after the cutover, and only if Aaron wants them.**

**Seat name:** Makerspace's `AGENT.md` names its agent **Relay**, which is A2A-Hub's planner seat. Give it its own name
at migration: hub names are global.

## 6. Cross-project hazards

- **Seat names collide:** foundry and co-op-mailer name their agent **Forge** (SIA's developer seat), and Makerspace
  names **Relay**. Harmless within a project, ambiguous on the hub and in "who is waiting on Aaron". Rename per project.
- **One machine's load:** more seats on this box make full suites unreliable (G-042). QA for SIA moved to the QA PC for
  that reason (D-045).
- **GitHub Actions minutes:** every repo above is private and shares one 2,000-minute budget. It stood at 1,802 on
  2026-09-24, with SIA about 56% of use. Point each adopted repo's CI at the tcm runners as part of its migration.
- **The old framework's residue:** `reflection-queue.json` (a retired feature) sits in frogger, foundry, co-op-mailer,
  worth-it and Makerspace. Remove it at each migration.

## 7. Planner error entry (session 100)

**The handoff's second watch-out said to read the Step-Back, PRD.md and README.md at `/start`.** Session 100 listed it
under FLAGS and did not do it until Aaron pointed at it, hours in. Session 90 had done the same. **An instruction that
fires in no session is not a rule** (G-035's shape). The containment is structural: T-167 renders the problem statement
at `/start`. Until it lands, a planner reads the three documents before its first ruling, and says in its briefing
that it has.

## 8. What else session 100 did and settled (so it is not rebuilt)

- **Effort (D-047):** the Opus 5.5 default in `~/.claude/settings.json` moved from `high` to `medium` on Aaron's
  "yes", following Anthropic's *Prompting Claude Opus 5.5* guide: at `medium`, Opus 5.5 matches or beats Opus 5 at
  `high`; effort names do not carry across models; lowering effort beats prompt instructions for reducing thinking.
  **QA seats are set explicitly** (QA 99 runs `--effort high`, the same as QA 93/94/96, so the machine change is the
  only new variable). Watch report quality across the change.
- **The guide, applied:** unattended runs treat a text-only end of turn as a report, not completion; the completion
  check is deterministic, with at most three resumes; a refusal is never resumed, and its `stop_details` category is
  recorded. The guide's early-stop paragraph goes into headless runs only, never into interactive seats. Not adopted:
  "treat earlier answers as done" (our method depends on re-examining them) and time budgets (no model-driving harness
  yet).
- **Candidate A8** `9e2dd5d` (Grok 4.7, record 98). The planner verified it against the thing: the SHA by `ls-remote`,
  each commit's `diff --stat`, and every CI run's head and conclusion.
- **QA 99, the first headless QA:** it runs on desktop-o4egb1e, launched by Aaron (the host classifier stopped the
  planner, "[Create Unsafe Agents]", and the planner did not route around it). Its files:
  - dispatch: `docs/loops/loop-15-slice-3-dispatch-qa-a8.md`;
  - driver, push guard, early-stop text and live view: `docs/loops/qa-99/`;
  - the view: `node C:/Users/melve/Worktrees/sia-planner/docs/loops/qa-99/watch.mjs` (read-only; forward slashes
    work in Git Bash and PowerShell);
  - output on the QA PC: `C:\Users\AARONM~1\sia-qa99\` (`drive.meta`, `run-N.jsonl`, `done`).
  - Tailscale "Run unattended" is on (`ForceDaemon: true`, read 2026-09-25).
- **A2A-Hub (Relay):**
  - Loop 4 (the chat UI at tcm `/ui/`) was merged and v1.10.0 tagged on Aaron's direct word in Relay's window. This
    seat's relay is recorded there as link 1 of D-009.
  - The T-003 tcm cutover ships v1.10.0 as one deploy.
  - **Owed by this seat:** the cutover window, once candidate A is decided, and the derived list of SIA hub names. So
    far `atlas` and `grok` are observed in room `k57frxw0ptb8tadmqdwy0khhks8ey006`.
  - The T-050 stop-hook trial is deferred until Relay writes a brief for Aaron.
  - `~/Projects/A2A-Hub` stays at `003f57d` until the cutover's last step (their D-008).
