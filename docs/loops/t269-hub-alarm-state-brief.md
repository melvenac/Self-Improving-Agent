# T-269: the SEATS line prints the hub's alarm reason, and the suite census counts a run still going as busy

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop or laptop one-off (any Windows host). No hub key and no hub call: every row uses an injected fetch or a
fixture file. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t269-reply.md (a reply path in the
launcher's line wins). Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 170. **Task:** T-269 (P3). **Tag:** `T-269`. **Size:** SMALL.
**Base:** `88b2c8d40645e9508a291bbb34c4e2c8d9badfc4` (origin/master). If clark re-pins it at launch, that SHA wins.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: formatHubSeatState PresenceSeatRow formatWakerSeatLine liveStateForHubAgent CensusAgent agentsFromPresenceBody siaBusy mergeAgents censusFromEnv
```

## Why

T-269 (read its note). The note says SIA prints `state:unknown(alarm)` for v1.22.13's long-run alarm. **That premise
is wrong, and the planner read the code:** `alarm` has been in `HUB_SEAT_STATE_NAMES` since T-095
(`open-brain/src/pipelines/session-start/hub-seat-state.ts:6-13`), so `formatHubSeatState("alarm")` already prints
`alarm`. Here is what IS missing. A2A-Hub was read at v1.22.13 = `59e0f2f35cc80ff7458f2bf870684c77fbc3fd1e`:
- `scripts/seat-waker.mjs:294-296` publishes a woken run older than `WAKE_RUN_ALARM_MS` (default 3600000,
  `scripts/waker/config.mjs:66-67`) as `seatState: "alarm"`, `alarmReason: "run_too_long"`. The run keeps going and
  nothing is killed (CHANGELOG v1.22.13, T-134).
- `scripts/seat-waker.mjs:851-852` publishes `alarm` / `orphan_run` when an earlier waker's lock still has live PIDs
  (`scripts/waker/orphan.mjs:8-15`). That is also a run still going.
- `src/presence.ts:14-27` and `:176-184`: `GET /a2a/agents/presence` carries `agents[].seat.alarmReason` beside
  `seatState`. Every other reason (`activity_without_lock`, `no_reply_since_turn_<n>`, `turn_too_long`, `model_rejected`,
  `cancel_survivor`, ...) is a snake_case token too.

SIA reads only `seatState`:
- **Display:** `hub-presence.ts:36-38` (`PresenceSeatRow`), `:165` (`formatWakerSeatLine`) and `:185`
  (`liveStateForHubAgent`). An informational 60-minute run and a blocking CANCEL survivor both print `alarm` on the SEATS
  line and on the partner lines.
- **The T-168 census (the bigger defect):** `src/suite-census.ts:97-116` keeps `{name, seatState}` only. `siaBusy` (`:122`),
  `mergeAgents` (`:135`) and the fixture path in `src/cli-suite-run.ts:199-202` count only `working` as busy. Once a SIA
  seat's run passes 60 minutes, it reads IDLE, and a controlled rerun (`OPEN_BRAIN_CONTROLLED_RERUN=1`) is NOT refused
  beside it. That is the exact case T-168 exists for.

**Proof the planner ran first-hand** (the base src through tsx, scratchpad script, body
`{agents:[{name:"forge", seat:{seatState:"alarm", alarmReason:"run_too_long"}}]}`):
```text
formatHubSeatState(seat.seatState) = "alarm"
liveStateForHubAgent(cursor) = "alarm"
formatPartnerLine(cursor) = "forge: alarm"
census.agents = [{"name":"forge","seatState":"alarm"}]
census.busySia = []
controlled rerun decision = {"refuse":false,"why":null}
```

## Ruling (exact)

**W1: an alarm prints the hub's own reason** (the module's rule stands: "never invent a synonym", so the reason token
is printed as the hub sent it).
- `open-brain/src/pipelines/session-start/hub-seat-state.ts`:
  - Below `type HubSeatStateName`, add:
    ```ts
    /** Longest alarmReason printed. A2A-Hub's reasons are snake_case tokens (seat-waker.mjs v1.22.13: run_too_long, orphan_run, no_reply_since_turn_<n>, reply_instruction_unavailable). */
    export const ALARM_REASON_MAX = 40;
    const ALARM_REASON_RE = /^[a-z0-9_]{1,40}$/;
    ```
  - `formatHubSeatState(raw: string | undefined | null, alarmReason?: unknown): string`. Keep the missing check
    first. Then add: when `raw === "alarm"` and `alarmReason` is not `undefined`, `null` or `""`, return
    `` `alarm(${alarmReason})` `` if `typeof alarmReason === "string" && ALARM_REASON_RE.test(alarmReason)`, and
    `"alarm(reason:unprintable)"` otherwise. Everything else is unchanged:
    - An alarm with no reason prints `alarm`.
    - A reason on any other state is ignored, because `presence.ts:167-169` turns a stale state into `waker_down` and
      still copies the old `alarmReason`.
  - Doc comment on the function: `/** Print a hub seatState as-is when known; never invent a synonym. An alarm prints the hub's own alarmReason in parentheses (T-269). */`.
  - Header comment, lines 1-5: name A2A-Hub v1.22.13 `src/presence.ts:14-27` as the source and say that the reason
    travels in `alarmReason` and is printed in parentheses.
- `open-brain/src/pipelines/session-start/hub-presence.ts`:
  - Give `PresenceSeatRow` the field `alarmReason?: string;` with the comment
    `/** A2A-Hub presence.ts:22 (v1.22.13). Printed only with seatState "alarm" (T-269). */`.
  - `formatWakerSeatLine` (`:165`) and `liveStateForHubAgent` (`:185`) pass `agent.seat?.alarmReason` as the second
    argument.
  - Leave `validateRoster` unchanged. A non-string reason prints `alarm(reason:unprintable)` and never makes the
    whole roster UNKNOWN: by T-237's rule, one odd field does not blank every partner.
  - Leave `presenceBlockUpperBound` unchanged. The longest alarm form is 47 characters (`alarm(` + 40 + `)`), shorter
    than the 64-character `hub listener: not polling, 999 unread, no listener poll recorded` already in the bound.
    The greeting-size forms row below fails if a later cap makes it longer.

**W2: the census counts a run still going as busy.**
- `open-brain/src/suite-census.ts`:
  - Give `CensusAgent` the field `alarmReason?: string;`.
  - Add, exported:
    ```ts
    /** A2A-Hub v1.22.13 publishes a run still going as alarm: run_too_long (seat-waker.mjs:294-296) and orphan_run (live PIDs of an earlier waker's run, waker/orphan.mjs:8-15). */
    export const BUSY_ALARM_REASONS: readonly string[] = ["run_too_long", "orphan_run"];

    /** Busy: seatState working, or alarm with a reason that means a run is still going (T-269). */
    export function isBusySeat(agent: CensusAgent): boolean {
      return agent.seatState === "working" || (agent.seatState === "alarm" && agent.alarmReason !== undefined && BUSY_ALARM_REASONS.includes(agent.alarmReason));
    }
    ```
  - `agentsFromPresenceBody` (`:106-113`): widen the cast to `{ seatState?: unknown; alarmReason?: unknown }`. Push
    `{ name, seatState, alarmReason }` when `typeof seat.alarmReason === "string"`, and `{ name, seatState }`
    otherwise, so there is never an `undefined` key.
  - `siaBusy` (`:122`) becomes `if (!isBusySeat(agent)) continue;`.
  - `mergeAgents` (`:135`) becomes `if (!prev || isBusySeat(row)) byName.set(row.name, row);`.
  - Header comment (`:5-8`): replace `Busy is agents[].seat.seatState === "working",` with
    `Busy is agents[].seat.seatState === "working", or "alarm" with alarmReason run_too_long or orphan_run (A2A-Hub v1.22.13: the run is still going; T-269),`.
- `open-brain/src/cli-suite-run.ts` (`:200`): `.filter((a) => isBusySeat(a))`, and add `isBusySeat` to the import from
  `./suite-census.js` (`:22`).

**Rows.** Commit 1 adds them, except the greeting-size forms in commit 2. All are new; no existing row changes.
- `open-brain/tests/pipelines/session-start/hub-seat-state.test.ts`: a new
  `describe("T-269 an alarm prints the hub's alarmReason (A2A-Hub v1.22.13)")`:
  - **A1:** `formatHubSeatState("alarm", "run_too_long")` is `"alarm(run_too_long)"`.
  - **A2:** `formatHubSeatState("alarm", "no_reply_since_turn_42")` is `"alarm(no_reply_since_turn_42)"`.
  - **A3:** `formatHubSeatState("alarm", "x".repeat(40))` is `` `alarm(${"x".repeat(40)})` ``.
    `formatHubSeatState("alarm", "x".repeat(41))` is `"alarm(reason:unprintable)"`.
  - **A4:** `formatHubSeatState("alarm", "Run Too Long")`, `formatHubSeatState("alarm", 7)` and
    `formatHubSeatState("alarm", "a\nb")` are each `"alarm(reason:unprintable)"`.
  - **A5:** `formatHubSeatState("alarm")`, `formatHubSeatState("alarm", undefined)`, `formatHubSeatState("alarm", null)`
    and `formatHubSeatState("alarm", "")` are each `"alarm"`.
  - **A6:** `formatHubSeatState("waker_down", "run_too_long")` is `"waker_down"`, and
    `formatHubSeatState("working", "run_too_long")` is `"working"`.
- `open-brain/tests/pipelines/session-start/hub-presence.test.ts`:
  - **P1** `"T-269 P1 a cursor-runtime partner in alarm prints the hub's reason"`: PR-1's body (`:126-136`), with
    forge's `seat` set to `{ seatState: "alarm", alarmReason: "run_too_long" }`. The block contains
    `forge: alarm(run_too_long)`.
- `open-brain/tests/pipelines/session-start/focus.test.ts`: a new `describe("T-269 SEATS live state for an alarm")`:
  - **F1:** `liveStateForHubAgent("cursor", { name: "forge", seat: { seatState: "alarm", alarmReason: "run_too_long" }, rooms: [] })`
    is `"alarm(run_too_long)"`, and `liveStateForHubAgent("cursor", { name: "forge", seat: { seatState: "alarm" }, rooms: [] })`
    is `"alarm"`.
- `open-brain/tests/suite-run-meta.test.ts`, inside `describe("T-168 suite meta")`. First extend the `presence()`
  helper (`:21-23`) to `{ name: string; seatState: string; alarmReason?: string }[]`, building
  `seat: a.alarmReason === undefined ? { seatState: a.seatState } : { seatState: a.seatState, alarmReason: a.alarmReason }`.
  Existing calls are unchanged.
  - **C1** `"T-269 C1 an alarm run_too_long seat is busy and a controlled rerun refuses"`: both samples are
    `presence([{ name: "forge", seatState: "alarm", alarmReason: "run_too_long" }])`. `census.agents` equals
    `[{ name: "forge", seatState: "alarm", alarmReason: "run_too_long" }]`, `census.busySia` contains `"forge"`, and
    `decideSuiteStart({ leaseExit: 0, census, controlledRerun: true }).refuse` is `true`.
  - **C2** `"T-269 C2 an orphan_run waker alarm is busy"`: both samples are
    `presence([{ name: "cursor-builder-waker", seatState: "alarm", alarmReason: "orphan_run" }])`. `census.busySia`
    contains `"cursor-builder-waker"`.
  - **C3** `"T-269 C3 an informational alarm, or an alarm with no reason, is not busy"`:
    - Both samples `presence([{ name: "forge", seatState: "alarm", alarmReason: "activity_without_lock" }])`:
      `busySia` equals `[]`.
    - Both samples `presence([{ name: "forge", seatState: "alarm" }])`: `busySia` equals `[]`.
  - **C4** `"T-269 C4 a busy alarm in either sample wins the merge"`: the first sample is
    `presence([{ name: "forge", seatState: "idle" }])` and the second is
    `presence([{ name: "forge", seatState: "alarm", alarmReason: "run_too_long" }])`. `census.busySia` contains
    `"forge"`, and the forge row in `census.agents` has `seatState` `"alarm"`.
  - **C5** `"T-269 C5 cli fixture path counts an alarm run_too_long seat as busy"`: copy R7 (`:146-187`) exactly, with
    both fixture samples `presence([{ name: "forge", seatState: "alarm", alarmReason: "run_too_long" }])`. Exit 0,
    `written.census.busy_sia` equals `["forge"]`, and `written.census.agents[0]` equals
    `{ name: "forge", seatState: "alarm", alarmReason: "run_too_long" }`.
- `open-brain/tests/pipelines/sync/greeting-size.test.ts`, commit 2: in the forms list of
  `"no presence line form is longer than the bound's line for that partner"` (`:328-334`), add
  `formatPartnerLine(p, [{ name: p.hub_as, seat: { seatState: "alarm", alarmReason: "x".repeat(ALARM_REASON_MAX) }, rooms: [] }], "cursor")`
  and `formatPartnerLine(p, [{ name: p.hub_as, seat: { seatState: "alarm", alarmReason: "Not A Token" }, rooms: [] }], "cursor")`.
  Import `ALARM_REASON_MAX` from `../../../src/pipelines/session-start/hub-seat-state.js`.

## Existing tests (planner-read at 88b2c8d4; verdicts)

- `tests/pipelines/session-start/hub-seat-state.test.ts`: **all stay green**.
  - The `it.each(HUB_SEAT_STATE_NAMES)` rows: `alarm` with no reason still prints `alarm`.
  - `state:unknown(missing)` and `state:unknown(room_full)` are unchanged.
- `tests/pipelines/session-start/hub-presence.test.ts`: PR-1 (`forge: working`), PR-2 (`cursor-infra: owes_reply`),
  T-240 (`forge: state:unknown(bogus)`), the T-237 rows, and `:313` (`grok: absent`) **stay green**.
- `tests/pipelines/session-start/focus.test.ts`: every row **stays green**, including `T-240 r2` (`:226-250`). No row
  passes an alarm.
- `tests/pipelines/sync/greeting-size.test.ts`: the worst-case block row (`:299-309`, regex on line 305) **stays green**,
  because the bound is unchanged. The forms row (`:316-347`) **stays green** with the two added forms (47 and 25
  characters, against 64).
- `tests/suite-run-meta.test.ts`: R1-R7, `unreachable hub`, `a waker seat reporting working counts as busy`
  (`:218-230`), and the two mutant rows **stay green**. The helper change is backward compatible.
- `tests/t168-owner-wired.test.ts` (its bodies are `idle`): **stays green**.
- No edited file is pinned in `.agents/retirements.json` (checked at the base).
- Any other newly failing row: STOP, `BLOCKED T-269 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t269-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v`. It must print `v22.*`, otherwise BLOCKED.
2. **Start state.**
   - Work in the fresh clone the launcher named. If it named none, run
     `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t269-wt")` and
     `Set-Location` into it.
   - Run `git checkout -q -b fix/t269-hub-alarm-reason 88b2c8d40645e9508a291bbb34c4e2c8d9badfc4`. `git rev-parse HEAD`
     must print that SHA and `git status --porcelain` must be empty, otherwise STOP, BLOCKED.
   - In `open-brain`, run `npm ci`, then `node -e "require('better-sqlite3')"`. If that fails with "Could not locate
     the bindings file", run `npm rebuild better-sqlite3`, say so, and re-run the check.
   - **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, a `cd` into any other checkout,
     `npm run test:heavy`, any network call to a hub, and killing any process by name or image.
3. **Commit 1, `T-269: failing rows for the hub's alarm reason and a long run's census`:** rows A1-A6, P1, F1 and C1-C5
   (tests only). In `open-brain`, run
   `npx vitest run tests/pipelines/session-start/hub-seat-state.test.ts tests/pipelines/session-start/hub-presence.test.ts tests/pipelines/session-start/focus.test.ts tests/suite-run-meta.test.ts --no-file-parallelism --testTimeout=180000`.
   - Red at the base: exactly A1, A2, A3, A4, P1, F1, C1, C2, C4 and C5.
   - Green: A5, A6, C3 and every existing row.
   - Paste the output. Any other result: STOP, BLOCKED. (tsconfig includes only `src/**/*`, so the extra argument
     in the test files does not break tsc.)
4. **Commit 2, `T-269: print the hub's alarm reason; the census counts a run still going as busy`:** W1 and W2, plus
   the two greeting-size forms. In `open-brain`, run
   `npx vitest run tests/pipelines/session-start/hub-seat-state.test.ts tests/pipelines/session-start/hub-presence.test.ts tests/pipelines/session-start/focus.test.ts tests/suite-run-meta.test.ts tests/pipelines/sync/greeting-size.test.ts tests/t168-owner-wired.test.ts --no-file-parallelism --testTimeout=180000`.
   All must be green. Then `npx tsc --noEmit` must exit 0. Paste both, and cap each run at 10 minutes.
5. End each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   `git log --oneline 88b2c8d4..HEAD` shows 2 lines, and `git status --porcelain` is empty after each commit.
6. **Mutants.** For each: edit, run the named file only, paste the failing row names, `git checkout -- <file>`, and
   confirm a clean tree. Never commit one.
   - **M1** `hub-seat-state.ts`: the `` typeof alarmReason === "string" && ALARM_REASON_RE.test(alarmReason) ? `alarm(${alarmReason})` : "alarm(reason:unprintable)" ``
     return becomes `return "alarm";`. Expect A1-A4 red (hub-seat-state.test.ts).
   - **M2** `hub-seat-state.ts`: `ALARM_REASON_RE` `{1,40}` becomes `{1,41}`. Expect A3 red.
   - **M3** `hub-presence.ts`: `formatWakerSeatLine` calls `formatHubSeatState(agent.seat?.seatState)` with no
     reason. Expect P1 red (hub-presence.test.ts).
   - **M4** `hub-presence.ts`: `liveStateForHubAgent` calls `formatHubSeatState(agent.seat?.seatState)` with no reason.
     Expect F1 red (focus.test.ts).
   - **M5** `suite-census.ts`: the `isBusySeat` body becomes `return agent.seatState === "working";`. Expect C1, C2, C4
     and C5 red (suite-run-meta.test.ts).
   - **M6** `suite-census.ts`: `mergeAgents` goes back to `row.seatState === "working"`. Expect C4 red.
   - **M7** `cli-suite-run.ts`: the filter at `:200` goes back to `(a) => a.seatState === "working"`. Expect C5 red.
   - **M8** `suite-census.ts`: `agentsFromPresenceBody` always pushes `{ name, seatState }`. Expect C1, C2, C4 and C5
     red.
   - **M9** `suite-census.ts`: `BUSY_ALARM_REASONS` loses `"orphan_run"`. Expect C2 red.
7. `git diff --name-only 88b2c8d4..HEAD` must show exactly these files, and nothing else (otherwise STOP, BLOCKED):
   - `open-brain/src/cli-suite-run.ts`
   - `open-brain/src/pipelines/session-start/hub-presence.ts`
   - `open-brain/src/pipelines/session-start/hub-seat-state.ts`
   - `open-brain/src/suite-census.ts`
   - `open-brain/tests/pipelines/session-start/focus.test.ts`
   - `open-brain/tests/pipelines/session-start/hub-presence.test.ts`
   - `open-brain/tests/pipelines/session-start/hub-seat-state.test.ts`
   - `open-brain/tests/pipelines/sync/greeting-size.test.ts`
   - `open-brain/tests/suite-run-meta.test.ts`
8. Push and open the PR:
   - `git push origin fix/t269-hub-alarm-reason` (never force). `git ls-remote origin refs/heads/fix/t269-hub-alarm-reason`
     must equal `git rev-parse HEAD`.
   - Run `gh pr create --base master --head fix/t269-hub-alarm-reason --title "T-269: the SEATS line prints the hub's alarm reason; the suite census counts a run still going as busy" --body "Brief: docs/loops/t269-hub-alarm-state-brief.md. Code PR (src): needs a QA ACCEPT and Aaron's word naming it."`
   - Wait for CI with `gh pr checks <n> --watch --interval 30`, capped at 20 min, and paste the `test` conclusion.

## Reply

- The first line is `READY T-269 <sha40> PR #<n>` or `BLOCKED T-269 <reason>`.
- Then each command with its output: commit 1's red run, commit 2's green run, tsc, the mutants, the name-only diff,
  `ls-remote` = `rev-parse`, the PR URL and CI.
- Paste test output with `grep -a`, or without grep. Mark anything not run `NOT RUN`.
- Name any HIGH, CRITICAL or UNKNOWN IMPACT target from the launcher's prompt, and say which rows cover its callers.
- If the code differs from a line this brief quotes, follow the ruling's intent and say what differed. Do not merge.
