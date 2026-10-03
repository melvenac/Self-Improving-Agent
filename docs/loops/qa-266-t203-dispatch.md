# QA 266: T-203 seat resolved by checkout (#376)

**By:** Atlas (planner), 2026-10-03, record session 159. Booked with clark on Plumb. A single-PR run, because Plumb was
free and this PR was the only one waiting; Aaron asked that QA not sit idle.

**Merge authority:** not pre-approved. An ACCEPT waits for Aaron's word.

**QA runs on Opus** (built by sia-infra, Claude Code Sonnet). **Job class: LIGHT:** touched test files, **one test
file per vitest invocation**, mutants on touched files only, `tsc`, `npm run typecheck:tests`, `gh` reads. No full
suite. No live Jev call. Never read or copy a real hub key; report key FILE NAMES and presence only.

**Pinned head:** #376 `09f82a12193788df0b50113aae20e2cd3cccf49c` (base master; CI run 37115492972 green). Read T-203's
note in `.agents/state.json` (it is the brief) and the PR body (it names the ported commits ded9557d / 5b1dc52e and the
six rebuilt mutants a-f).

## Rows

1. **Confined.** Files beyond `origin/master`: `hub-partner-seats.json`, `CHANGELOG.md`, `hub-presence.ts`,
   `seat-map.ts`, `sync/checks.ts`, `sync/index.ts`, `sync/seat-identity.ts`, and three test files. Flag anything else.
2. **Single source.** Show that `hub-partner-seats.json` is the ONE map (seat, role, hub_name, checkout) every per-seat
   lookup reads; `worktree-seats.json` keeps only the layout role. No second copy of the map anywhere
   (`git grep` for each hub name).
3. **Data unchanged where unruled.** `seats.forge.hub_name` is still `grok`, `seats.forge.cursor` still `true`, and the
   `readers` map keys are unchanged versus master. Diff the JSON.
4. **Red then green.** The test files against master's source (seat-map cannot load; hub-presence and greeting-size
   rows fail) and the head (pass). Quote counts.
5. **Mutants.** Re-run at least two of the developer's (a: unknown checkout falls back to the identity name; b: key
   chosen by identity) plus one of your own. Each must turn a row red.
6. **Unknown checkout** prints a visible `seat unknown for checkout <c>`-style line and never falls back to
   `AGENT.local.md`'s identity.
7. **Missing key.** A seat whose hub key file is absent gets `presence: UNKNOWN (no hub key for <name> at ...)`, never
   another seat's key.
8. **`/sync` seat-identity.** It flags an `AGENT.local.md` identity that disagrees with the map for its checkout (use a
   scratch tree), and passes when they agree.
9. **CI (read only).** `gh pr checks 376`: `test` and run id. Run `npm run typecheck:tests` at the head (exit 0).

## Rules (headless Claude Code)

- You are **QA 266**, prefix `t203`. Push ONLY `qa/t203-*` branches, only through
  `node docs/loops/qa-266/push-qa.mjs <branch>`, run from your `qa266-wt` tree.
- **Never create, comment on or edit an issue or a PR.** `gh` only to read.
- From real config and key files report only counts, names and paths, never values (G-051).
- Commit `docs/loops/t203-qa-report.md` with its `.E_t.json` on `qa/t203-report`.
- One verdict line. The last line is exactly `QA-266: REPORT COMPLETE`.
