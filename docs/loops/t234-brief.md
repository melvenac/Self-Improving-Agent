# T-234 brief: the T-233 greeting follow-ups

**Planner:** Atlas, session 159, 2026-10-03. **Seat:** sia-forge (Cursor Composer 2.5, **desktop**, hub name `grok`,
room `k57frxw0ptb8tadmqdwy0khhks8ey006`). **Authority:** Aaron via clark, ~01:10 CDT 2026-10-03: "Get the planners
to dispatch work to all available agents if downstream dev work can be done."

Read T-234's `note` in `.agents/state.json` first: it is the task. This brief cuts it into two PRs.

## PR A: product fixes clark found on the served greeting

1. **False stale.** `open-brain/src/pipelines/session-start/serving-build.ts` counts every commit between the
   serving build and origin/master. On 2026-10-03 it said "2 commits behind" and later "6 commits behind"
   while those commits touched only `.agents/` records and `docs/`. Count only commits that change what the
   serving tree SERVES (at least `open-brain/` and `.claude/commands/`; justify the path set you choose). When
   every commit is outside it, say so (e.g. "N commits behind (records/docs only), build current") and do
   not print STALE.
2. **Usage text.** `open-brain/src/pipelines/session-start/briefing.ts:167` says STOP means "everyone parks until
   the 5-hour reset". On 2026-10-03 the STOP came from the WEEKLY window (5h 14%, weekly 98%), which that reset
   does not lift. Attribute STOP to the window that caused it; at weekly >= 98% say "until the weekly reset
   (or Aaron's one-time reset)".
3. **F6.** A serving tree AHEAD of origin/master reads as "level"; make it "ahead by N (unmerged local commits)".

## PR B: QA 263's gaps (F1-F5, F7)

QA's artifacts are on `origin/qa/t233-report` (fe33a55a): `docs/loops/t233-qa-report.md`,
`docs/loops/qa-263/qa263-probes.test.ts`, and six mutants under `docs/loops/qa-263/mutants/`. Adopt the probe
rows into the suite (in the suite's own test files, not as a copied probe file). **Done when every one of the
six QA mutants goes red** against your suite, applied one at a time. F7 is a start.md wording nit: any
start.md line you change needs the same line in `project-template/.claude/commands/start.md` and either
the Cursor copy or `docs/loops/cursor-start-differences.json` (the cursor-start-parity check).

## Rules for this seat (D-060, Composer)

- **Real red:** every new test fails on `origin/master` before your fix and passes after; paste both runs
  (file name, counts, the failing assertion).
- **Product mutants on your own branch:** for PR A, break each fix and show the guarding test fail. For PR B,
  QA's six mutants are the mutants.
- **No test-only code** in product files.
- One vitest FILE per invocation, never the full suite. `/sync` before each commit.
- Branch from a fresh `origin/master` (your checkout is on an old merged branch: `git fetch origin` first).
  Push your branch and open the PR; **never merge, never push to master.**
- Launch Cursor as `cursor-agent`, never bare `agent` (on the desktop that runs Grok's CLI).
- Start every work reply with `TASK: T-234 <PR A|PR B>, <what> (<branch>)`.

## Reporting

Hub only, from a file: `HUB_URL=http://100.124.212.87:4000 node C:/Users/melve/Projects/A2A-Hub/scripts/hub-talk.mjs
--as grok --session k57frxw0ptb8tadmqdwy0khhks8ey006 --say "$(cat <file>)"`, then `--wait --wait-timeout 3500`.
Per PR: PR number, head SHA, red and green runs, mutant results. PR A first; start PR B after A is posted.
QA is booked by the planner after both are up (Composer candidates get a non-Composer QA seat).
