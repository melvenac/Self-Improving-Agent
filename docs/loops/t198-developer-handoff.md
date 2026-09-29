# T-198 — hub presence at `/start`

Forge (Grok 4.7), worktree `C:\Users\melve\Worktrees\sia-forge`. Record 217. Base `origin/master` `a749821`. No CI (D-061).

## Product branch

`loop/t198-presence` @ **`<LOCAL_SHA>`** (local only — planner clears push).

## Mutant branch (local)

| Branch | SHA | Kills |
| --- | --- | --- |
| `loop/t198-presence-mut-swallow` | **`<MUT_SHA>`** | PR-3 |

## Interim source

`.agents/SYSTEM/hub-partner-seats.json` (until T-196). Hub room table from `docs/loops/planner-session-146-notes.md`.

## Red evidence (quoted)

| Row | Red (master `a749821`) | Failing line / exit |
| --- | --- | --- |
| PR-1 | no presence block | `describeHubPresence` / greeting has no `grok: polling` |
| PR-3 | no UNKNOWN line on fetch failure | unreachable hub → no `presence: UNKNOWN` in output |
| PR-5 | `loop/t198-presence-mut-swallow` | PR-3 test exit **1**: expected UNKNOWN, got `lines: []` |

## Green (product)

| Command | Exit |
| --- | --- |
| `npx tsc --noEmit -p .` | 0 |
| `npm run build` | 0 |
| `npx vitest run tests/pipelines/session-start/hub-presence.test.ts` | 0, **9** passed |
| `npx vitest run tests/server.test.ts` | 0, **30** passed (PR-6 preserved) |

## Rows

| Row | Test |
| --- | --- |
| PR-1 | `hub-presence.test.ts` PR-1 |
| PR-2 | `hub-presence.test.ts` PR-2 |
| PR-3 | `hub-presence.test.ts` PR-3 / PR-3b / PR-3c |
| PR-4 | `hub-presence.test.ts` PR-4 |
| PR-5 | mutant red; product green on PR-3 |
| PR-6 | `server.test.ts` unchanged; presence block ~**220** chars (header + 3 partners sample) |
