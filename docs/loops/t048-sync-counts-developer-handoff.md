# T-048 in `sync/checks.ts`: the 18 rows sia-builder left, developer handoff

**By:** Forge (developer seat, `sia-forge`, Claude Sonnet 5.5), 2026-10-02. **Branch:** `loop/t048-sync-counts` from `origin/master` `8b7aa952`. **Dispatch:** atlas-sia, session 157 (LIGHT). Source table: `docs/loops/t048-developer-handoff.md` on `loop/t048-dropped-counts` (`b47eb897`). Not merged; one PR. This edits `checkHookConfigs`, `checkHookRegistration`, `checkVaultPathRefs`, `checkMirrorParity`, `checkCommandParity`, `checkCommandToolNames`, `checkCommandNames`, `checkRetirements` and `checkModuleBoundary` in `sync/checks.ts`, so it conflicts textually with none of my open PRs' functions (#295, #298, #300, #303 add or edit other functions) but all five touch the file: whichever merges later rebases.

## The 18 rows

| Row (at `00552846`) | Check | Fix | Now states |
| --- | --- | --- | --- |
| `checks.ts:166, 169, 172` | hook-configs | each entry not stat'ed is counted by reason | `N hook command file(s) checked; skipped M (a not an object, b with no command string, c not a node/npx tsx command, d with no file path) of E entries`; **zero checked is SKIP "not checked ... not a pass"** |
| `:499, :503` | hook-registration | registrations counted; unusable entries counted by reason | `N script registration(s) counted across E event(s); skipped M (...)`; zero counted is SKIP |
| `:297` | vault-path-refs | files scanned, and the ones not | `N .md file(s) scanned; not scanned: a non-.md, b CHANGELOG.md, c skipped directories (names), d absent directories, e absent named files, f unreadable`; nothing scanned is SKIP |
| `:552, :570, :573, :579` | mirror-parity | exceptions named, non-.md counted, skipped optional pairs named | `K file comparison(s) + the template Cursor set asserted; X excepted [file (pair), ...]; Y non-.md file(s) ignored; Z optional pair(s) skipped [pair (dir does not exist)]`; nothing compared **and** no Cursor set asserted is SKIP |
| `:743, :765, :793` | command-parity | template-only exceptions, user-only commands and non-.md files counted; an unreadable directory is reported instead of becoming an empty list | `excepted N template-only [names]; M non-.md file(s) ignored`, `U user-only command(s) not compared` |
| `:863, :951` | command-tool-names, command-names | the absent command directories named | `3 of 5 command directories scanned; absent: ~/.claude/commands, ~/.cursor/commands` |
| `:1137` | retirements | (file, retirement) pairs skipped as declared referrers | `with N (file, retirement) pair(s) not scanned because the file is a declared referrer` |
| `:1402, :1406` | module-boundary | type-only and package imports | `N type-only and M package import(s) are not edges` |

**Partly done, said plainly:** row `:743` is fixed for command-parity (`listCommandsCounted`). `listCommands` itself, still used by command-tool-names and command-names, keeps dropping non-.md files and turning an unreadable directory into an empty list. Those two checks now name their absent directories, but not their ignored files. A small follow-up.

## A finding the counts exposed

**`hook-configs` was vacuous on the real `settings.json`.** It treated each list entry as a hook, but the real file nests hooks under matcher groups (`{ "hooks": [ { "command": ... } ] }`), so every entry had no `command` and the loop stat'ed nothing, while the message said "All hook command files exist". Run read-only on this PC's real settings it now says: `skip | not checked: no hook command file was read. 0 hook command file(s) checked; skipped 4 (4 with no command string) of 4 entries. This is not a pass.` I did NOT change what it reads (descending into `hooks[]` would start stat'ing real commands, which have quoted paths the current regex would mis-parse: a behaviour change for the planner to rule). `hook-registration` does descend, and read 4 registrations across 3 events.

## Rows (red before, green after)

New: `tests/pipelines/sync/t048-counts.test.ts` (6 rows: hooks) and `t048-counts-parity.test.ts` (7 rows: mirror, command-parity, tool-names and names, boundary, retirements). Changed because they pinned the unqualified pass: `checks.test.ts` (hook-configs with no hooks, vault-path-refs with only exempt files), `hook-registration.test.ts` (no hooks block), `mirror-parity.test.ts` (only exceptions): each now expects **skip**, with the counts, and the vault-path row also proves a clean file makes it a pass naming the exemptions.

- **Red** (those five files against `origin/master`'s `checks.ts`): **17 failed**, 118 passed. **Green:** `tests/pipelines/sync` all pass (335 plus the new ones); `tsc --noEmit` 0.
- **Mutants**, one per fix group, in `docs/loops/t048-sync-counts/mutants/`, each `tsc --noEmit` 0 and each red:

| Mutant | Red tests |
| --- | --- |
| `hook-configs-zero-is-pass` (zero checked passes again) | 2 |
| `hook-registration-zero-is-pass` | 2 |
| `mirror-parity-exceptions-uncounted` | 2 |
| `command-parity-template-only-uncounted` | 2 |
| `boundary-type-only-uncounted` | 1 |
| `vault-path-refs-changelog-uncounted` | 1 |
| `retirements-allowed-pairs-uncounted` | 1 |
| `tool-names-absent-dirs-unnamed` | 1 |

## Real run, read-only (this checkout and this PC's `~/.claude`)

`hook-configs`: skip (above). `hook-registration`: pass, 4 registrations across 3 events. `mirror-parity`: pass, 6 comparisons plus the Cursor set, 2 excepted (`bootstrap.md`, `harness-audit.md`), 2 optional pairs skipped (no `~/.claude/commands` or `~/.cursor/commands` here). `command-parity`: pass, 6 shared, 1 template-only excepted. `command-tool-names` / `command-names`: pass, 3 of 5 directories scanned. `module-boundary`: pass, 50 type-only and 176 package imports not edges. `vault-path-refs`: pass, 45 files scanned, 6 non-.md, 3 absent directories.

## Not run

The full suite, and a real `/sync` report. `scorer`'s skipped-check count (`scorer.ts:44`), `start-parity.ts`, the harness rows and the other rows in sia-builder's table that are not in `checks.ts` were not part of this dispatch.
