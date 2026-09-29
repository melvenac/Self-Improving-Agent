# T-196 — hub procedure as tracked knowledge (record 219)

**By:** Forge, `cursor-infra`. **Branch:** `loop/t196-hub-knowledge` from `origin/master` (`334fee5`). Local only (D-061). The planner.md section is `loop/t196-planner-md`, not this branch (D-062).

## What the hub itself said

`hub-talk --as atlas --list --json` on 2026-09-28. A Cursor seat's room is the session id present on both that name and `atlas`:

| Seat | Hub name (key on disk) | Room |
| --- | --- | --- |
| builder | `cursor-builder` | `k57098epn7qz32vt0cazfjpbes8f6kdq` (its only room) |
| infra | `cursor-infra` | `k5702788wctxj75begyt4x2k5x8f6mav` (its only room) |
| forge | `grok` | `k57frxw0ptb8tadmqdwy0khhks8ey006` (also on atlas). `grok` has other rooms; they are not the planner pair. |
| planner | `atlas` | no single room; atlas holds one room per seat |

## Rows

| Row | Where | Red then green |
| --- | --- | --- |
| HB-1 | `loop/t196-planner-md` `planner.md` tells a fresh planner to arm one listener per Cursor room from `hub-partner-seats.json`, which `/start` already prints in full. No memory read. | The section names the file and the wait line. Live arming is the next planner session. |
| HB-2 | `.cursor/rules/hub-room.mdc` (`alwaysApply`) and the `talk` line in the data file. | Live, once per seat, for the planner to observe. Not run from this seat. |
| HB-3 | `project-template/.cursor/commands/start.md` step A6b: an unread atlas turn is the assignment and nothing else is proposed. | Live in `sia-forge`. Not run from `sia-infra`. |
| HB-4 | `open-brain/src/pipelines/sync/hub-seats.ts`, wired in `runSync`. It reads `.agents/SYSTEM/hub-partner-seats.json`, the file `ob_start` reads. | Green: `npx vitest run tests/pipelines/sync/hub-seats.test.ts`. The stranger-seat case, the missing-room case, and a file with no `readers` map expect `issue`. The absent-file case expects skip and the line `hub-seats: not checked: no seat file`. |

One file: Forge's T-198 roster is `readers` in `hub-partner-seats.json`. T-196 adds `talk`, `seats`, `hub_url`, and `wait` to that file. `/sync` does not validate a second seat file. A project with no `hub-partner-seats.json` is `skip`, and the printed line is `hub-seats: not checked: no seat file`.
