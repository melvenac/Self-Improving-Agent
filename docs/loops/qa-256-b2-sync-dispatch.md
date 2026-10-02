# QA 256, batch B2: /sync checks (#295, #298, #300, #303, #306, #309)

**By:** Atlas (planner), 2026-10-02, record session 157, under Aaron's batch-QA rule. All six PRs are sia-forge's,
and all of them edit `open-brain/src/pipelines/sync/checks.ts` or `sync/index.ts`.

**QA runs on Opus. Job class: LIGHT.** Touched test files, **one test file per vitest invocation**, mutants on touched
files only, `gh` reads, and no full suite. **Make no live Jev call.**

**Read-only real-machine runs are allowed** where a row asks for one. They are read-only: never write `~/.claude.json`,
settings or the vault.

**Pinned heads:**

| PR | task | head | base | dev handoff |
|---|---|---|---|---|
| #295 | T-008: every MCP `command` in `~/.claude.json` resolves | `cc28573882497898e3ab0346777066ecf1e62287` | master | `docs/loops/t008-developer-handoff.md` |
| #298 | T-008b: plus `.mcp.json` and enabled plugins | `7b09c5b7ce3aa661f4e2acfc6d4235e09239cebf` | #295 | `docs/loops/t008b-developer-handoff.md` |
| #300 | T-051: the skills contract (directory = name = INDEX row) | `5ae7f9f28bed80d58cbdb34056e87d620faecaed` | master | `docs/loops/t051-developer-handoff.md` |
| #303 | T-176: gitnexus-index measured in both directions | `112a41396f78e2312c85ce71221aaeed15fa2979` | master | `docs/loops/t176-developer-handoff.md` |
| #306 | T-048: sync checks state their checked and skipped counts | `d8dc12db5da04aabb66ec9e30433aee0ed637aab` | master | `docs/loops/t048-sync-counts-developer-handoff.md` |
| #309 | T-048: hook-configs descends into matcher groups (incl. `sh -c`) | `eb721dec39b13e6a17a8ca7f16cb574c56b62d02` | #306 | `docs/loops/t048-hook-configs-developer-handoff.md` |

## Rows for each PR

1. **Confined.** List the files each PR's own commits touch beyond its base.
2. **Red then green.** The PR's new or changed test files fail against its base's source and pass on its head. Quote
   the counts.
3. **One mutant of your own** on the core change, and report which row catches it. Re-run one of the developer's stated
   mutants from `docs/loops/t0xx/mutants/`.
4. **CI on the head (read only).** `gh pr checks <n>`, quoting the `test` conclusion and the run id.

## Rows specific to B2

5. **"Not checked" is never a pass.**
   - For #295, #298, #303, #306 and #309, feed each check an input it cannot read: absent config, unreadable file, an
     unknown SHA, an unparseable command.
   - Its result must be `skip` or `warn`, stating "not checked", and **never `pass`**.
   - Quote each one.
6. **#298, the plugin layout.** Its fixture follows `enabledPlugins`, then `installed_plugins.json`, then
   `.claude-plugin/plugin.json` or `.mcp.json`.
   - Confirm the layout on a real install, read-only.
   - Report whether `${CLAUDE_PLUGIN_ROOT}` is resolved, and how.
7. **#309, real settings.** Run hook-configs read-only against this machine's `~/.claude/settings.json`. Quote the
   counts line.
   - Then add `sh -c "…"` and `node "C:\path with spaces\x.js"` entries to a fixture.
   - The `sh -c` entry must be not-checked. The quoted path with spaces must be stat'ed as one path.
8. **#303.** Fixture repos for the four cases: at HEAD, behind, ahead (warn) and diverged (issue, naming both counts and
   the merge-base).
9. **Batch merge order.** On a scratch branch from `origin/master`, merge the heads in order: #295, #298, #300, #303,
   #306, #309.
   - Known conflict: #295 and #309 both edit the `node:path` import line in `checks.ts`. Report every conflict.
   - Resolve ONLY that import-line conflict, by taking the union of the imported names, and say so. **Stop on any
     other conflict.**
   - On the merged result, run every touched sync test file, one per invocation, plus `tsc --noEmit`. Then run
     `node open-brain/build/cli.js sync --check` after `npm run build`, in the scratch tree only, and quote every new
     check's line.

## Rules (headless Claude Code)

- You are **QA 256**, and your prefix is `b2-sync`. Push ONLY `qa/b2-sync-*`, and only through
  `node docs/loops/qa-256/push-qa.mjs <branch>`, run from `~/qa-scratch/qa256-wt`.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- Commit `docs/loops/b2-sync-qa-report.md` with its `.E_t.json` on `qa/b2-sync-report`.
- Give one verdict line per PR and a batch verdict: ACCEPT only if every PR is accepted AND row 9 merges, with only the
  named import-line resolution. The last line is exactly `QA-256: REPORT COMPLETE`.
