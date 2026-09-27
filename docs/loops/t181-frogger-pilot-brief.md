# T-181 pilot 1: frogger, a fresh SIA install. Brief for the agent in `~/Projects/frogger`

**By:** Atlas (SIA planner), record session 109 · 2026-09-26. **To:** the Claude session Aaron opened in
`~/Projects/frogger`. **Authority:** `docs/loops/adoption-plan-2026-09-25.md` §4 row 1, and Aaron in session 109.
**Purpose:** frogger is the first real project to go onto SIA by the **fresh install** path (`/bootstrap`). Nobody
has walked it on a real project (T-154). **The findings ARE the deliverable.** A step that is wrong, missing or
confusing gets written down, not silently worked around.

## Facts, read by the planner on 2026-09-26

- `~/Projects/frogger` is **not a git repository**. It has `CLAUDE.md`, `README.md`, a Vite and TypeScript app
  (`src/`, `index.html`, `vite.config.ts`), `node_modules/` and `dist/`.
- `.agents/` holds only `reflection-queue.json`, from the retired old framework. `.claude/` holds only
  `settings.local.json`.
- The SIA build that `state import` uses is the main checkout, `~/Projects/Self-Improving-Agent`, at master `be7ddfb`,
  which has the importer fixes (T-175 and T-180) merged.

## Two traps, found before you start

1. **`/bootstrap` Step 1 skips scaffolding when `.agents/` exists, and skips `CLAUDE.md` when it exists.** Both exist
   here, so an unprepared run does nothing. Move `.agents/reflection-queue.json` aside, then remove the empty
   `.agents/`. Move it to `~/Projects/frogger-residue/` (outside the repo), not to a delete. Keep `CLAUDE.md`. Record,
   as a finding, that `/bootstrap` does not handle an existing `CLAUDE.md` it did not write.
2. **`/bootstrap` never creates `state.json`.** `state import` does, from the prose files. The template's INBOX uses
   `## Priority` / `## Backlog`, while the importer reads tasks only under `## P0` to `## P3`. Record what happens.

## Steps (stop and ask Aaron at each marked step)

1. **[Aaron] `git init`**, then an initial commit of the project as it is: `node_modules/` and `dist/` ignored, the
   residue moved out. Aaron's word first.
2. Read `~/Projects/Self-Improving-Agent/project-template/.claude/commands/bootstrap.md` in full, and follow it. Copy
   the template's `.claude/commands/` and `.agents/` pieces as it says.
3. **[Aaron]** Before any `state import --commit`, show him the `--draft` output. `--commit` is **run by Aaron**
   (G-007): `node ~/Projects/Self-Improving-Agent/open-brain/build/cli.js state import --commit` from the frogger root.
   Its snapshot goes to `.agents/archive/`.
4. **Check the imported record has NO SIA history in it** (T-175): no `V-001`..`V-005` and no `G-001`..`G-006`. This
   is the importer fix's end-to-end test on a real project.
5. Run `/start` in a new frogger session. It must return a `## State` block from frogger's own `state.json`.
6. Commit the result on a branch, not on the default branch. Aaron merges.

## Hand back

Write `.agents/pilot-report.md` in frogger, **and send its full text to atlas by SendMessage** (A2A has no memory; the
planner files it in SIA's `docs/loops/`). Include:
- each step, with what it did and what it wrote;
- every finding (wrong, missing or confusing), each with the exact file and line in the template or command;
- the draft and commit output of `state import`;
- the T-175 check;
- the `/start` result's size.

**Push nothing** (frogger has no remote yet). Do not run `/end`.
