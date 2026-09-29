# T-198 — hub presence at `/start`

Forge (Grok 4.7), worktree `C:\Users\melve\Worktrees\sia-forge`. Record 217. Base `origin/master` `a749821`. No CI (D-061).

## Product branch

`loop/t198-presence` @ **`c168ef0`** (local only — planner clears push).

## Mutant branch (local)

| Branch | SHA | Kills |
| --- | --- | --- |
| `loop/t198-presence-mut-swallow` | **`bbf4b78`** | PR-3 |

## Interim source

`.agents/SYSTEM/hub-partner-seats.json` (until T-196). Hub room table from `docs/loops/planner-session-146-notes.md`.

## Presence fetch strategy

**Roster fetch + client-side filter** (not `?name=` per seat). One `GET /a2a/agents/presence` with no query params; partner rows matched by `hub_as` and `session_id` in code. The hub route reads only `?name=<one agent>` today (A2A-Hub `src/index.ts:542-548`; hub T-079 will fix multi-filter); a bulk `?agents=` filter is ignored.

## Red evidence (quoted)

| Row | Red (master `a749821`) | Failing line / exit |
| --- | --- | --- |
| PR-1 | no presence block | `describeHubPresence` / greeting has no `grok: polling` |
| PR-3 | no UNKNOWN line on fetch failure | unreachable hub → no `presence: UNKNOWN` in output |
| PR-5 | `bbf4b78` default swallow | `npx vitest run … -t "PR-3"` exit **1**: `block.lines[0]` undefined (3 PR-3 tests fail) |

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
