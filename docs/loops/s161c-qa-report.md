# QA 275 (s161c) report: #434, #436, #437, plus amendment 1 (#421 r3, #424 r2, #427 r2, batch merge) (Plumb, Linux)

**By:** QA 275, record session 161, headless Claude Code on Opus on Plumb (Linux). Nobody watching live.
**Dispatch:** `docs/loops/qa-275-s161c-dispatch.md` and `docs/loops/qa-275-s161c-dispatch-amendment-1.md`, both present
at DISPATCH_SHA `bbea9698417a70344ea777c6e15283cdd6ec7ad7`.
`git -C ~/qa-scratch/qa275-wt log -1 --format=%H` → `bbea9698417a70344ea777c6e15283cdd6ec7ad7`.
**Read before the amendment rows:** QA 273 (`origin/qa/s161a-report` @ `7ce08718`) and QA 274
(`origin/qa/s161b-report` @ `bfc22508`).

## Verdicts

| PR | Pinned head | Verdict | Why, in one line |
|---|---|---|---|
| #421 r3 (G-053) | `8173cef6495dd9333cd199d0c05c82ac671589ed` | **ACCEPT** | r2→r3 touches only the test file. Both mutants that survived QA 273 are now red. |
| #424 r2 (T-235 P2-6) | `b9026d71d1fbfa2ba42de465fac4d54feae702cd` | **ACCEPT** | A user file is moved aside byte-identical and both paths are printed. A second run is a no-op. The drop-move-aside mutant and all three parity mutants are red. |
| #427 r2 (T-235 P2-3) | `987901c9cb43f3dd3a31b9e22fec164edd9769dd` | **REJECT** | The wrong-pid defect is fixed. But r2's new win32 process-table query has no error handling: if the query fails, the SessionStart hook crashes (exit 1, no greeting) instead of failing closed. r1 failed closed in the same case. The Windows row 20 re-run is needed in any case. |
| #434 (T-240) | `12f26320fdb89ea9e9c76dfc30790628b707d6d7` | **REJECT** | Row 6: when *another* seat's row has no `runtime`, `ob_start` drops the SEATS line without a word. A waker seat with no runtime is then shown as `hub listener: not polling`, which is the exact wording T-240 exists to remove. The `dispatch.cursor.room` rule passes when only the top-level `room` is present. |
| #436 (T-235 P2-5) | `144623d2f9707d7b501a0657f842f4a827d85562` | **ACCEPT** | Rows 10–13 pass. Nits below. |
| #437 (T-235 P2-7) | `23d46156a5fa34873ef1bee0ab723e52d1b33858` | **REJECT** | Row 14: mutant M1 (read-then-write) passes the PR's race row 10 of 10. My barrier race kills it (48/50 double claims), so the product is atomic, but the suite does not pin it. Row 17: the stale-claim window is real (15/100 double claims and ENOENT crashes under a barrier). |
| Batch merge (row 29–31) | merged tree `6d95e06ef75fce64502083a30761ac221887d1c9` | **Mechanical; green** | Every conflict is a union of both sides. Row 30 is all green. The full suite has 0 failed, with 2 worker-RPC timeout errors (D-082). |

**Overall: REJECT.** The prompt allows ACCEPT only if every PR is accepted; the amendment says the same for all six
PRs plus the batch.

## Method and environment

- Node v22.22.1, git 2.53. `TMPDIR=~/qa-tmp` and `npm_config_cache=~/qa-tmp/npm-cache` were set for every npm, npx and
  vitest run, through small runners in `~/qa-tmp/qa275/`. Every probe script cited below is in that directory.
- `npm ci` was run once in `qa275-merge/open-brain`. Every other tree got `node_modules` as a symlink to it. This is
  safe because no PR touches `package.json` or `package-lock.json` (diffed, three-dot, all seven heads including #425).
  The symlink shows as `?? open-brain/node_modules` in each tree's status. Nothing else was left modified.
- Worktrees:
  - `qa275-wt`: the dispatch SHA, now branch `qa/s161c-report`.
  - `qa275-pr<N>`: each pinned head.
  - `qa275-base<N>`: each PR's merge-base with `origin/master`. 421: `651ac36b`; 424: `71b2b924`; 427: `f8dc13a5`;
    434, 436 and 437: `91e14451`.
  - `qa275-base427r1` (`270b550b`): #427 r1, for the narrow red and as a control.
  - `qa275-merge`: first used for row 19 (#437 merged onto #425's head, `9fe60e5f`), then reset to the DISPATCH_SHA for
    the batch.
  - `qa275-a2ahub`: a read-only `gh repo clone` of A2A-Hub master at `73d1dae2` (v1.17.0).
- **Head drift.** Five of the six fetched PR heads equal their pinned SHAs. **#437's PR head has moved** to `d8f4c9dc`:
  two commits after `23d46156`, both docs-only (`docs/loops/t235-p2-7-plan.md`, +4/−2). The pinned SHA was QA'd.
  The new text adds a "stale reclaim window" paragraph and replaces the `trigger_fires` row with the P2-5 measure.
  `origin/master` equals the DISPATCH_SHA.
- **Real profile, G-051** (match / no-match only). Checked: `~/.cursor/hooks.json` (absent), `~/.cursor/mcp.json`
  (absent), `~/.cursor/commands` (absent), `~/.claude/settings.json`, `~/.claude.json`,
  `~/.claude/settings.local.json` (absent) and `~/.claude/open-brain/knowledge-v2.db` (absent). They were hashed before
  any run, then re-hashed after the `setup.mjs` runs, after row 19 and after the full suite. **Every comparison
  matched.**
- No live state, DB, Jev or settings write was made. `gh` was used read-only (runs, PR bodies, and the A2A-Hub clone).
- **Full suite in shards.** The full suite takes longer than this harness's 600 s foreground limit; QA 273's run was
  moved to the background by the harness. So I ran it **once, as three vitest shards (`--shard=i/3`) in sequence**,
  each in the foreground. Nothing was run in the background.

## Rows for every PR (1–4)

### Row 1: Confined (files beyond `origin/master`, three-dot)

| PR | Commits | Files | Outside the task? |
|---|---|---|---|
| #421 | `82aeb3da`, `9915a59b`, `8173cef6` | `open-brain/src/harness/configwatch.ts`, `open-brain/tests/harness/config-channel.test.ts`, `open-brain/tests/harness/fixture.ts` | none |
| #424 | `12c28926`, `b9026d71` | `open-brain/src/pipelines/sync/checks.ts`, `open-brain/tests/setup-cursor-commands.test.ts`, `project-template/.cursor/commands/{harness-audit,task,test}.md`, `scripts/setup-hooks.mjs`, `scripts/setup.mjs` | none |
| #427 | `270b550b`, `987901c9` | `docs/loops/t235-p2-3-r2-measure.md`, `open-brain/src/cli-bootstrap.ts`, `open-brain/src/server.ts`, `open-brain/src/shared/process-session.ts`, `open-brain/tests/fixtures-t003/cursor-agent/versions/e2e-fixture/index.js` (replaces `cursor-agent-host.cjs`), `open-brain/tests/t003-r2.test.ts`, `open-brain/tests/t003-session-proof.test.ts`, `open-brain/tests/t235-p2-3-cursor-proof.test.ts` | none |
| #434 | `4100c878`, `12f26320` | `.agents/SYSTEM/hub-partner-seats.json`, **`.agents/roles/shared.md` (role file, Aaron's)**, `.cursor/rules/hub-room.mdc` and its `project-template` mirror (one sentence: `cursor: true` → `runtime: "cursor"`), `session-start/{focus,hub-presence,hub-seat-state (new),seat-map}.ts`, `sync/hub-seats.ts`, `server.ts` (one line), 7 test files | none. The two `hub-room.mdc` edits are required: they named the removed `cursor` boolean. |
| #436 | `144623d2` | `docs/loops/t235-p2-5-measure.md`, `open-brain/src/cli-recall-trigger.ts`, `open-brain/tests/setup-hooks.test.ts`, `open-brain/tests/t235-p2-5-cursor-recall.test.ts`, `scripts/setup-hooks.mjs`, `scripts/setup.mjs` | none |
| #437 | `23d46156` | `docs/loops/t235-p2-7-plan.md`, `open-brain/src/cli-bootstrap.ts`, `open-brain/src/cli-session-end.ts`, `open-brain/src/shared/session-hook-claim.ts` (new), `open-brain/tests/cli-bootstrap.test.ts`, `open-brain/tests/cli-session-end-dedupe.test.ts`, `open-brain/tests/shared/session-hook-claim.test.ts` | none. `setup.mjs` is untouched, as the plan says. |

### Row 2: Red then green

The head's new or changed test files (with any new fixture) were copied onto the base tree and run against the base
source. The base was then restored (`git checkout -- .` plus deleting the added files; status verified), and the files
were run at the head. Script: `redgreen.mjs`.

| PR | File | Base (red) | Head (green) |
|---|---|---|---|
| #427 | `t235-p2-3-cursor-proof` vs master `f8dc13a5` | 7 failed / 1 passed (8) | 8/8 |
| #427 | `t003-r2` vs master | 1 failed / 8 passed (9): D5 | 9/9 |
| #427 | `t003-session-proof` vs master | 1 failed / 17 passed (18) | 18/18 |
| #427 | `t235-p2-3-cursor-proof` vs **r1** `270b550b` (narrow) | 2 failed / 6 passed: the new matcher rows. **The e2e row passes on r1** (see row 27). | 8/8 |
| #427 | `t003-session-proof` vs r1 | 18/18 (not red: the replacement assertion accepts both outcomes, see row 27) | 18/18 |
| #434 | `hub-seat-state` | cannot import (module absent) | 8/8 |
| #434 | `seat-map` | 5 failed / 17 passed (22) | 22/22 |
| #434 | `focus` | 3 failed / 7 passed (10) | 10/10 |
| #434 | `hub-presence` | 10 failed / 31 passed (41) | 41/41 |
| #434 | `hub-seats` | 2 failed / 4 passed (6) | 6/6 |
| #434 | `greeting-size` | 1 failed / 13 passed (14) | 14/14 |
| #434 | `briefing-budget` | 33/33 (not red: the change only completes a `SeatResolution` literal for the new type) | 33/33 |
| #436 | `t235-p2-5-cursor-recall` | 4 failed / 1 passed (5) | 5/5 |
| #436 | `setup-hooks` | 2 failed / 11 passed (13) | 13/13 |
| #437 | `shared/session-hook-claim` | cannot import (module absent) | 6/6 |
| #437 | `cli-bootstrap` | 1 failed / 15 passed (16): R1 | 16/16 |
| #437 | `cli-session-end-dedupe` | 1 failed (1) | 1/1 |

#421 and #424 are narrow re-checks and are covered by rows 21–24. At their heads: `config-channel` 44/44;
`setup-cursor-commands` 8/8; `mirror-parity` 13/13.

`tsc --noEmit` and `npm run typecheck:tests` exit 0 on all six pristine heads (`tsc-all.mjs`).

### Row 3: Mutants

Each mutant was applied in the head's scratch tree (`mut.mjs`: an exact single-match replacement). The edit was shown
with `git diff`, `tsc --noEmit` was run, the named test files were run one per vitest invocation, and the file was then
restored with `git checkout` (status re-checked: only the `node_modules` symlink).

| PR | Mutant | Whose | tsc | Result |
|---|---|---|---|---|
| #421 | admit `"-0"` (`value === "0" \|\| value === "-0"`) | QA 273's | 0 | **killed**, 1 failed (`no trim` loop) |
| #421 | `key.startsWith("gc.auto") && value === "0"` | QA 273's | 0 | **killed**, 1 failed (`gc.autoPackLimit=0` row) |
| #421 | `Number(value) === 0 && value.trim() === value` (admits `+0`, `-0`, `00`) | mine | 0 | **killed**, 2 failed |
| #424 | drop the move-aside (`if (fs.existsSync(dest))` → `if (false)`) | dev's | 0 | **killed**, 2 failed |
| #424 | parity skips `task.md` / `test.md` / `harness-audit.md` (one mutant per file) | mine | 0 | **killed** each, 1 failed: the matching per-file row |
| #427 | cli-bootstrap writes `claude_pid: process.pid` (QA 273's survivor) | QA 273's | 0 | **killed** by the e2e row (`t235-p2-3-cursor-proof` 1 failed). `t003-r2` and `t003-session-proof` still pass. |
| #427 | walk from `process.pid` instead of `process.ppid` (revert r2's fix) | mine | 0 | **survives** all three files. Near-equivalent under r2's matcher: the hook's own command line cannot be `…/cursor-agent/versions/<v>/index.js`. Nit. |
| #434 | drop the cursor branch in `formatPartnerLine` | dev's (PR-1/PR-2) | 0 | **killed**, 6 failed |
| #434 | `formatHubSeatState` returns the raw value for an unknown one | mine | 0 | **killed**, 1 failed in each of `hub-seat-state` and `hub-presence` |
| #434 | drop the cursor branch in `liveStateForHubAgent` | mine | 0 | **killed** by `focus` (2 failed). `hub-presence` alone passes. |
| #436 | allowlist `["Shell","ShellTool"]` | dev's | 0 | **killed**, 2 failed |
| #436 | `/^(shell\|bash\|terminal)$/i` instead of the Set | mine | 0 | **survives** (5/5). The product refuses those names (row 10); the suite only pins `ShellTool`. Nit. |
| #436 | drop `registerCursorRecallHook()` from `setup.mjs` `main()` | mine | 0 | **survives** `setup-hooks` (13/13). There is no `setup.mjs`-level test at this head (`setup-scratch-home` arrives with #425). Row 12 proves the wiring. Nit. |
| #437 | M1 read-then-write | dev's (plan) | 0 | see row 14: **survives the race row 10/10** |
| #437 | M2 `dedupeCursorHookRuns` → `true` | dev's (plan) | 0 | **killed**: `cli-bootstrap` R3 and `session-hook-claim` R3 |
| #437 | M2 at the `cli-session-end.ts` call site only (`… \|\| true`) | mine | 0 | **survives** `cli-session-end-dedupe`, `session-hook-claim`, `t003-session-proof`, `t048-r2b` and `handoff-guard` |

### Row 4: CI (read only)

| PR | Run | headSha | event | `test` | `changed` | `test-windows` |
|---|---|---|---|---|---|---|
| #421 | 37189592640 | `8173cef6495dd9333cd199d0c05c82ac671589ed` | pull_request | success | success | skipped |
| #424 | 37189663548 | `b9026d71d1fbfa2ba42de465fac4d54feae702cd` | pull_request | success | success | skipped |
| #427 | 37189839577 | `987901c9cb43f3dd3a31b9e22fec164edd9769dd` | pull_request | success | success | skipped |
| #434 | 37186403772 | `12f26320fdb89ea9e9c76dfc30790628b707d6d7` | pull_request | success | success | skipped |
| #436 | 37186601074 | `144623d2f9707d7b501a0657f842f4a827d85562` | pull_request | success | success | skipped |
| #437 | 37186696789 | `23d46156a5fa34873ef1bee0ab723e52d1b33858` | pull_request | success | success | skipped |

Each run's `headSha` is the pinned head. #437's current PR head `d8f4c9dc` (docs-only) is not the pinned run's head.

## #434 (T-240)

**Row 5: the seatState values are the hub's. PASS.**

- A2A-Hub master `73d1dae2` (v1.17.0), `src/seatStateStore.ts` lines 3–9: `SeatStateName` = `working | idle |
  owes_reply | paused | waker_down | alarm`.
- `hub-seat-state.ts` `HUB_SEAT_STATE_NAMES` has the same six values, and **no value is in one set but not the
  other**. The citation says v1.16.2; the lines are unchanged at v1.17.0.
- The roster shape matches: the hub's `presence.ts` puts `seat.seatState` on `agents[]` (`PresenceAgentRow.seat`).
- The hub omits `seat` for an agent with no `-waker` peer and no published state. #434 prints that case as
  `state:unknown(missing)`.
- Probe (`probe434.mts`):
  - Each of the six values prints as-is.
  - `busy`, `Working` and `room_full` print `state:unknown(busy)`, `state:unknown(Working)` and
    `state:unknown(room_full)`.
  - `""` and an absent value print `state:unknown(missing)`.
- **A waker seat never prints `not polling`.** For a `cursor`-runtime seat I combined every seatState (the six, an
  unknown one, and missing) with five room shapes: none; not polling with no age; unread with an age; unread with no
  age; polling. Both `liveStateForHubAgent` and `formatPartnerLine` were checked: **0 of 80 lines contain
  `not polling`**. An agent absent from the roster prints `absent`.

**Row 6: both runtimes from fixtures. FAIL on the ob_start half.**

- Fixture map with one `cursor` seat and one `claude-code` seat:
  - With no roster: `SEATS: cur — cursor composer-2.5 qa-pc · cc — claude-code opus desktop`.
  - With a roster: `SEATS: cur — cursor composer-2.5 qa-pc owes_reply · cc — claude-code opus desktop hub listener:not polling`.
- **This checkout's own row with no `runtime`** fails loudly:
  - FOCUS prints `FOCUS: .agents/SYSTEM/hub-partner-seats.json: seat other runtime must be cursor or claude-code`.
  - Presence prints `presence: UNKNOWN (…)`.
  - Unit row: `seat-map` "T-240 a seat row with no runtime is unreadable".
- **Another seat's row with no `runtime`** fails silently in ob_start:
  - `seatOrder` returns `null` (`focus.ts:49`), so `server.ts` passes `null` and the briefing **omits the SEATS line
    without a word** (`briefing.ts:192-193`).
  - `runtimeByHubName` silently skips that row, so the seat's runtime is `undefined`.
  - Probe (`probe434b.mts`): the head's real map with `builder.runtime` deleted, read as `sia-planner` with an `idle`
    seatState on the roster. Atlas's partner line becomes **`cursor-builder: hub listener: not polling`**, and
    `liveByHubName` gives `hub listener:not polling`. That is the "not polling for a waker seat" T-240 removes,
    reappearing with nothing said.
  - `/sync` does catch it (below), but row 6 asks for loud failure in **both**.
- `/sync` `hub-seats` on the head's real map, mutated (`probe434.mts`):

| Map | Result |
|---|---|
| unchanged | pass: "3 cursor runtime(s): builder, forge, infra; 3 claude-code: planner, qa, research" |
| `qa.runtime` deleted | issue: "qa has no runtime (cursor or claude-code)" |
| `qa.runtime = "Cursor"` | issue (case-sensitive), same message |
| builder: `dispatch.cursor.room = ""` and top-level `room` deleted | issue: "builder is a cursor runtime seat with no room" |
| builder: `dispatch.cursor.room` key deleted, top-level `room` kept | **pass**: the check falls back to the top-level `room` (`hub-seats.ts:507`) |
| builder: `dispatch.cursor.room` differs from top-level `room` | **pass**: the two copies may drift without a word |
| builder: `dispatch.cursor.hub_name` differs from `hub_name` | **pass**: same |
| planner switched to `cursor` (its room is `""`) | issue: "planner is a cursor runtime seat with no room" |

So "a `cursor` seat without `dispatch.cursor.room` fails `/sync`" holds only when the top-level `room` is absent too.
The map now holds `room` and `hub_name` twice per seat, and `hub-room.mdc` says only "substitute `{room}`" without
saying from which copy.

**Row 7: the map migration is lossless. PASS.** `migr434.mjs` made 60 checks of master's map against the head's:

- Every seat's `checkout`, `role` and `agent` are unchanged.
- Every `hub_name` is present (`atlas`, `cursor-builder`, `forge`, `cursor-infra`). `qa` and `research` still have no
  top-level `hub_name`.
- Every room id is present as both `room` and `dispatch.cursor.room` (builder `k575sfwr…`, forge `k571z4gh…`, infra
  `k57d92gq…`).
- `cursor: true` maps to `runtime: "cursor"`, and `false` to `claude-code`.
- The `readers` map is deep-equal, so all 6 reader pairs are present.
- `hub_url`, `talk`, `talk_tokens`, `wait` and `seatless_checkouts` are identical.
- `"cursor": true|false` appears nowhere at the head.
- **No reader of the old `cursor` boolean** is left in `open-brain/src`, `scripts/`, `.cursor/` or
  `project-template/.cursor/`. Checked by grep across the tree excluding `docs/`, `node_modules` and `build`. The only
  hits are T-240's own task text in `.agents/state.json` and `INBOX.md`.
- Observation: `dispatch.cursor.hub_name` for `qa` (`probe`), `research` (`scout`) and planner (`atlas`, waker
  `atlas-waker`) names hub identities that do not exist today. That is harmless while those seats are `claude-code`.
- The `host` and `model` values (for example planner `desktop` / `sonnet`) are the PR's claims. T-240's scope note asks
  for `sonnet` for CC; I cannot verify the real hosts.

**Row 8: the CC fallback is labelled honestly. PASS.** For a `claude-code` seat, `liveStateForHubAgent` prints
`hub listener:absent`, `hub listener:not polling` or `hub listener:polling`. The partner line prints
`hub listener: polling`, `hub listener: not polling[, N unread since …| no listener poll recorded]`, or `absent`. No
line says `session`.

**Row 9: `shared.md` switch-runtime procedure. PASS, with one consistency finding.**

- Both directions are present (Cursor → Claude Code, Claude Code → Cursor).
- The keep-the-hub-names ruling (D-115) is stated: `cursor-builder` and `cursor-infra` stay.
- D-119 OwnerPid is given per runtime: CC is "the `claude.exe` process for that session"; Cursor is "the nearest
  ancestor whose command line contains `cursor-agent` (not the shell that launched it)".
- Commands and paths named: `-File` (the lease script `docs/loops/machine-lease.ps1` is tracked) and
  `docs/loops/g054-finding.md` (tracked). **No step names a command that is missing from the tracked tree.**
- The waker stop and start steps name no command at all. Nit.
- **Finding (low):** the Cursor OwnerPid rule is the "command line contains `cursor-agent`" substring rule.
  - QA 273 showed that rule matching a repo path.
  - #427 r2 replaced it in code with `isCursorAgentHostCommandLine` (`…\cursor-agent\versions\<v>\index.js`, plus the
    `.cmd`/`.ps1` shims).
  - Once both merge, the role doc and the code define "the cursor-agent owner" differently.
  - The doc should name the function or its rule.

**#434 verdict: REJECT** `12f26320fdb89ea9e9c76dfc30790628b707d6d7`, on row 6. Rows 1–5 and 7–9 pass.

Fix:

- In `ob_start`, a map row without `runtime` should print a reason, for example `SEATS: <reason>`, not drop the line.
- The partner presence for that hub name should say UNKNOWN rather than fall back to the listener wording.
- Add a test with a *non-reader* seat missing `runtime`.
- Decide whether `dispatch.cursor.room` must be present, or whether `room` and `dispatch.cursor.room` may coexist. If
  both are kept, `/sync` should flag a disagreement between the two copies (and between `hub_name` and
  `dispatch.cursor.hub_name`).
- `shared.md` merges on Aaron's word in any case.

## #436 (T-235 P2-5)

**Row 10: only measured names. PASS.**

- `CURSOR_MEASURED_SHELL_TOOL_NAMES` is exactly `new Set(["Shell"])`. That matches `t235-p2-5-measure.md` (A): one
  observed `postToolUse` row with `tool_name: "Shell"`, and "Allowlist in code: `Shell` only".
- `probe436.mts` runs the real `cli-recall-trigger.ts` at the head, against a scratch DB copied fresh for each run, with
  a Cursor-shaped `postToolUse` payload and a command that matches an entry:

| tool_name | Result |
|---|---|
| `ShellTool` | exit 0, 0 stdout bytes |
| `bash` | exit 0, 0 stdout bytes |
| `Terminal` | exit 0, 0 stdout bytes |
| `shell` | exit 0, 0 stdout bytes |
| `Shell` (control) | exit 0, 249 bytes, injects the PIPESTATUS entry |

**Row 11: Claude Code byte-identical. PASS.** CC `PostToolUse` payloads at base `91e14451` and at the head (fresh DB
copy per run), comparing stdout bytes (sha256) and exit code:

| Payload | Base | Head | Same? |
|---|---|---|---|
| Bash, matching command | 249 B `6db52a0a…`, exit 0 | 249 B `6db52a0a…`, exit 0 | **byte-identical** |
| Bash, non-matching command | 0 B, exit 0 | 0 B, exit 0 | identical |
| Bash, whitespace-only command | 0 B, exit 0 | 0 B, exit 0 | identical |
| Bash, no `session_id` | 0 B, exit 0 | 0 B, exit 0 | identical |
| Read (not Bash) | 0 B, exit 0 | 0 B, exit 0 | identical |

**Row 12: registration. PASS.** `setup2x.mjs` ran the head's `setup.mjs` twice under a scratch HOME whose path contains
a space. The HOME was seeded with a user `postToolUse` hook (`echo my-user-post-hook`) and a `stop` hook.

- Run 1:
  - Exit 0.
  - Logged "Cursor postToolUse recall hook registered".
  - `postToolUse` = `[{"command":"echo my-user-post-hook"}, {"command":"\"/usr/bin/node\" \"/home/agents/qa-scratch/qa275-pr436/open-brain/build/cli-recall-trigger.js\""}]`.
  - `stop` and `sessionStart` are kept or added.
- Run 2:
  - Exit 0.
  - Logged "Cursor postToolUse recall hook already configured".
  - **No file under the scratch HOME changed** (hash walk).
- Exactly one `cli-recall-trigger.js` entry. The Node path and the script path are both absolute, and the script exists
  after the build.
- Real profile files: **match** (all seven).

**Row 13: honest claim. PASS, with one wording nit.**

- The measure doc's (C) says: "Automated run did not prove the Cursor host surfaces
  `hookSpecificOutput.additionalContext` to the model … model surfacing under cursor-agent is unverified".
- The PR body says "stdout injection proven in vitest; **cursor-agent model surfacing of additionalContext
  unverified**".
- **No sentence claims the model receives it.** The two uses of "injection" refer to the hook's stdout shape.
- Wording nit: the PR body says it registers "via `setup.mjs` / `withCursorRecallHook` **when
  `OPEN_BRAIN_RECALL_TRIGGER` is set**". `OPEN_BRAIN_RECALL_TRIGGER` is a constant in `setup.mjs`, not an environment
  variable, and registration is unconditional.

**Observations, not blocking:**

- The Cursor `postToolUse` entry has no matcher, so Cursor spawns Node on **every** tool call. The trigger returns
  early for non-shell tools, but the built hook still costs **500–620 ms per non-shell call on Plumb** (5 runs,
  `time436.mjs`). Claude Code's entry is matched to `Bash`.
- The emitted JSON says `hookEventName: "PostToolUse"` (Claude Code's shape) for a Cursor event. Whether Cursor reads
  it at all is the unverified part (C) names.

**#436 verdict: ACCEPT** `144623d2f9707d7b501a0657f842f4a827d85562`. Nits:

- Two surviving mutants (row 3): the case-insensitive allowlist, and the dropped `setup.mjs` call.
- The PR-body env-var wording.
- The per-tool-call cost.

## #437 (T-235 P2-7)

**Row 14: atomic claim. PASS on the product, FAIL on the test.**

- `tryCreateClaim` uses `writeFileSync(path, …, { flag: "wx" })` and returns false on `EEXIST`. That is an exclusive
  create.
- The PR's race row (`session-hook-claim.test.ts` "race: two concurrent sessionStart claims — exactly one wins"), with
  the whole file run 10 times at the head: **10/10 runs 6/6 passed**.
- **M1 applied** (`if (existsSync(path)) return false; writeFileSync(path, …)` with no `wx`; diff shown, tsc exit 0):
  the race row run 10 times with `-t race` gives **10/10 passed**. **The race row does not fail under M1.**
  - Cause: the row spawns two `tsx` processes and lets them race. tsx start-up jitter (hundreds of ms) is far wider
    than the check-then-write window, so the two never overlap.
- My barrier race (`race437.mjs`): N children import the **built** module, spin until a shared instant, then call
  `tryClaimHookRun` once. Each trial uses a fresh HOME.

| Build | Trials | Exactly one claimed | Multiple claimed | Errors thrown |
|---|---|---|---|---|
| head, 2 procs | 50 | 50 | 0 | 0 |
| head, 8 procs | 50 | 50 | 0 | 0 |
| **M1**, 2 procs | 50 | 2 | **48** | 0 |
| **M1**, 8 procs | 50 | 47 | **3** | 0 |

So the product is atomic, but nothing in the suite would catch a regression to read-then-write. The tree was restored
and rebuilt pristine afterwards (status verified).

**Row 15: Claude Code is never suppressed. PASS on the product. M2 kills only the bootstrap half.**
`probe437.mts` used the built hooks, a scratch HOME, and no `OPEN_BRAIN_IDE`:

| Run | Result |
|---|---|
| `cli-bootstrap.js`, CC payload (no `cursor_version`), twice | FULL (11 lines) and FULL (11 lines); 0 claim files |
| `cli-session-end.js`, CC payload, twice | FULL (3 lines) and FULL (3 lines); 0 claim files |
| control: the same two hooks with a Cursor payload | FULL then `SESSION_START_SKIPPED` / `SESSION_END_SKIPPED`; 1 claim file each |

- M2 in the shared function is killed by `cli-bootstrap` R3 and `session-hook-claim` R3.
- **M2 at the `cli-session-end.ts` call site survives every test** that runs that script (row 3).
- `cli-session-end-dedupe` has no Claude Code row, so the session-end half of R3 is unpinned.
- **Finding (low): the gate is broader than "`cursor_version` present".**
  - `dedupeCursorHookRuns` is `detectIde(payload, registeredAs) === "cursor"`, and `detectIde` falls back to the
    registration: `--ide`, or `OPEN_BRAIN_IDE`.
  - Probe: a CC-shaped payload with `OPEN_BRAIN_IDE=cursor` in the environment is deduped by both hooks (FULL, then
    SKIPPED).
  - Claude Code hooks do not normally carry that variable (setup puts it only in Cursor's MCP env). But the plan and
    the PR body state the gate as `cursor_version` only.

**Row 16: legitimate re-run. PASS.** TTL is `HOOK_CLAIM_TTL_MS = 120_000` (120 s).

- Built `cli-bootstrap.js` with a Cursor payload:
  - start → FULL; the dual hook → SKIPPED.
  - The claim's mtime was set 121 s back. A resume → **FULL**, and its dual hook → SKIPPED.
- **Design limit:** with the claim aged 60 s, a resume with the same `session_id` → **SKIPPED**. So a Cursor resume or
  compact within 120 s of the last SessionStart gets no bootstrap output.

**Row 17: the stale-claim window. YES, both can run; and a third outcome, a crash.**

- The stale path is `existsSync` → `statSync` → `unlinkSync` → `wx` retry, and those steps are not atomic across
  processes.
- Interleaving:
  1. A and B both see EEXIST and both stat the old claim as stale.
  2. A unlinks and creates its new claim.
  3. B then unlinks **A's new claim** and creates its own. Both return `claimed`.
- If B's `unlinkSync` (or `statSync`) lands between A's unlink and A's create, it throws `ENOENT`. That is uncaught in
  `tryClaimHookRun` and at both hooks' top level, so that hook exits non-zero.
- `race437.mjs` in stale mode (a claim pre-created with mtime 10 min old), head build:

| Procs | Trials | Exactly one claimed | **Both / multiple claimed** | Trials with an ENOENT throw |
|---|---|---|---|---|
| 2 | 100 | 85 | **15** | **76** |
| 8 | 100 | 99 | **1** | 1 |

- Zero claimed was never observed.
- **Severity: medium-low, not a blocker on its own.**
  - It arises only past the TTL, on a resume where both registrations fire.
  - Real start-up jitter is much wider than the barrier's, so live odds are far lower than 15%.
  - When it fires, the outcome is either the double run P2-7 exists to stop, or a crashed hook (non-zero exit, stack
    on stderr) beside one full run.
- Fix: reclaim by `renameSync(path, path + ".stale." + pid)`; only one process wins the rename, and an `ENOENT` loser
  returns `duplicate`. Then `wx`. Or catch `ENOENT` on stat and unlink and treat it as `duplicate`.
- The post-pin docs commit `d8f4c9dc` names this window in the plan.
- Also, claim files are never removed: one per Cursor session per event accumulates in `hook-claims/`. Nit.

**Row 18: simulation vs live.** `t235-p2-7-plan.md` at the pinned head, under the heading "Live counts (QA PC)":

- **`cli-bootstrap` before = 2:** attributed to "plan s161". I found no recorded live run behind it in the tracked
  tree. `t235-p2-2-measure.md`'s live `cursor-agent` logger counts `sessionStart` = 1 from a *project* hook, and does
  not count Claude-settings runs.
- **`cli-bootstrap` after = 1:** a **simulation**. It is two sequential `node build/cli-bootstrap.js` invocations
  (`--ide cursor`, then none) with one payload. They are not concurrent, and there was no `cursor-agent`.
- **`cli-session-end` before** ("1 today; 2 once #425"): inferred, not measured. **After** ("1 per event"): the same
  simulation kind. No live sessionEnd was run.
- **`trigger_fires`:** not measured at the pin. The post-pin docs commit replaces it with the live P2-5 measure (0,
  session `2564043c`, live `cursor-agent` on the QA PC).
- So **no after-patch count comes from a live `cursor-agent` run.** The "Live counts" heading over a table whose after
  column is simulated should say so.

**Row 19: SessionEnd with #425. PASS.**

- Scratch merge: #437 (`23d46156`) onto #425's head (`9fcb97ca`), clean, giving `9fe60e5f`. Built.
- `probe437e.mts` ran that tree's `setup.mjs` in a scratch HOME. It registered 1 Cursor `sessionEnd` command and 1
  Claude `SessionEnd` command.
- Then the **registered command strings themselves** were fired with the same Cursor `sessionEnd`-shaped payload
  (`reason`, `final_status`, `duration_ms`, `cursor_version`, `session_id=end-row19-0001`):
  - Cursor `hooks.json` command: exit 0, **FULL** (3 lines).
  - Claude `settings.json` command: exit 0, **`SESSION_END_SKIPPED`**.
  - Metrics: `claimed,duplicate`.
- Real profile: match.

**#437 verdict: REJECT** `23d46156a5fa34873ef1bee0ab723e52d1b33858`, on row 14 (M1 survives the PR's race row).

Fix:

- Make the race row able to fail. For example, synchronise the children on a barrier, as `race437.mjs` does, and run
  several trials or more processes. Confirm that M1 then goes red.
- Add a Claude Code row to `cli-session-end-dedupe`.
- Fix the stale reclaim (row 17), since the same file is being touched.
- Relabel the plan's after-column as simulated.

The product's hot path (fresh claim) is correct, and rows 15, 16 and 19 pass.

## #421 r3 (G-053), narrow

**Row 21. PASS.** `git diff 9915a59b 8173cef6` touches only `open-brain/tests/harness/config-channel.test.ts` (+7/−1):

- `"-0"` and `"+0"` are added to the refusal loop.
- A new row refuses `gc.autoPackLimit=0`.
- `git diff --quiet 9915a59b 8173cef6 -- open-brain/src scripts` exits 0, so **the product is byte-identical to r2**.

**Row 22. PASS.** Both of QA 273's survivors are now red: admitting `-0` (1 failed) and widening to `gc.auto*` (1
failed, the new `gc.autoPackLimit=0` row). See row 3. The head is 44/44.

**#421 verdict: ACCEPT** `8173cef6495dd9333cd199d0c05c82ac671589ed`.

## #424 r2 (T-235 P2-6)

**Row 23. PASS.**

- Function probe (`probe424.mjs`, real template, scratch cursor dir; `task.md` user-modified, `start.md` identical to
  the template):
  - Run 1: `{copied:6, movedAside:[task.md → task.md.user-2026-10-04T104146.423Z]}`.
  - The side file is **byte-identical** to the user's content (sha256 match).
  - `task.md` now equals the template.
  - **`start.md` is untouched** (same inode and mtime).
  - Run 2: `{copied:0, movedAside:0}`, every file hash unchanged, and still exactly **one** side file.
- Through `setup.mjs` itself (`setup2x.mjs`, scratch HOME with a user `task.md`):
  - Run 1 logs `✓ Preserved user Cursor command: moved ~/.cursor/commands/task.md → ~/.cursor/commands/task.md.user-2026-10-04T104217.031Z`.
    **Both paths are named.**
  - Run 2 logs `· Cursor slash commands already up to date — skipped`, and no file changed.
- The drop-move-aside mutant goes red (2 failed).

**Row 24. PASS.** The parity test has a per-file row for each of `task.md`, `test.md` and `harness-audit.md`. Each
removal gives `issue` / "`<file>` missing". A per-file product mutant (parity skips that one file) turns exactly that
file's row red: 3 of 3 (row 3).

**Nit (not blocking):**

- The move-aside compares with the *current* template.
- So a user whose copy is merely an **older template version** (never edited) is "preserved" again on every template
  update: a new `<name>.md.user-<ts>` each time, with the message "Preserved user Cursor command".
- A manifest of what setup wrote would tell the two cases apart.
- QA 273's other nit stands: the parity rows use a synthetic fixture, not the real template.

**#424 verdict: ACCEPT** `b9026d71d1fbfa2ba42de465fac4d54feae702cd`.

## #427 r2 (T-235 P2-3)

**Row 25: QA 273 rows 17–19 again, at `987901c9`.**

*Row 17, the walk: PASS.* `probe427c.mts` used the real `cli-bootstrap.ts` spawned by the e2e fixture host
(`…/fixtures-t003/cursor-agent/versions/e2e-fixture/index.js`):

| Input | Result |
|---|---|
| `cursor_version`, no `--ide` | "Session proof written … for cursor-agent host process 2682839"; `by-pid/2682839.json`, `claude_pid` = the fixture's own printed pid, `ide=cursor` |
| `--ide cursor` + `cursor_version` | the same, for host 2682870 |
| `--ide cursor`, no `cursor_version` | **NOT written** ("no cursor_version (D5)"), unchanged from r1 |

There is still **one** matcher, `findCursorAgentHostPid` with `isCursorAgentHostCommandLine`, shared by the hook and
the server. The hook now starts at `process.ppid`. D-119's lease rule is still prose (row 9 above).

*Row 18, Claude Code unchanged: PASS.* `probe427d.mts` sent a Claude payload (`CLAUDE_PID` = a live pid) through base
`f8dc13a5` and the head:

- The proof line is identical.
- The file name is identical (`by-pid/2683157.json`).
- The 217-byte proofs are **identical apart from `written_at`**.
- `server.ts` is unchanged from r1. It walks only when `OPEN_BRAIN_IDE=cursor`, and tries the direct parent first.

*Row 19, fails closed: PASS on Linux.* **QA 273's wrong-pid probe was repeated exactly**: `probe427b.mts` is copied
from `~/qa-tmp/probe427b.mts` with only the tmp root changed (diff shown in the run). It reaches the head through a
symlink `…/my-cursor-agent-tools`, with `--ide cursor` and a `cursor_version` payload, and no host:

- **Head:** "Session proof NOT written: no cursor-agent host process found in the hook's ancestor chain, so this
  session's server will refuse attributed writes." No file was written.
- **Same probe at r1 (control):** "Session proof written … for cursor-agent host process 2682612", the hook itself,
  which was gone after exit. The defect reproduces on r1 and is fixed on r2.
- With no host behind a plain parent (with and without `CLAUDE_PID`): NOT written, with the same reason.
- `ob_set_session` with a claim other than the proven id is still refused (the `t235-p2-3-cursor-proof` row passes).

**Row 26: the host matcher.**

- `isCursorAgentHostCommandLine` matches, case-insensitively and **anywhere in the command line**, any of:
  - `\cursor-agent\versions\<v>\index.js`
  - `/cursor-agent/versions/<v>/index.js`
  - `\cursor-agent.ps1` together with `powershell`
  - `\cursor-agent.cmd`
- The live line it cites (`t235-p2-3-r2-measure.md`, cursor-agent 2026.10.01-e373342, Windows) is
  `…\AppData\Local\cursor-agent\versions\2026.10.01-e373342\node.exe …\cursor-agent\versions\2026.10.01-e373342\index.js …`.
- **False negatives (fail closed):** each of these is missed, and gives "no cursor-agent host … found", no proof:
  - a renamed install directory (anything but exactly `cursor-agent`);
  - a layout without `versions/<v>/index.js`, for example a bundled single binary;
  - a unix shim (`~/.local/bin/cursor-agent`) whose child is not `…/cursor-agent/versions/<v>/index.js`.
  The unix pattern mirrors the Windows shape and was **not live-measured on Linux or macOS**.
- **Fails open: yes, narrowly (low).**
  - Because the match is anywhere in the command line, a non-host ancestor whose **arguments merely mention** such a
    path is taken as the host.
  - Probe: a plain parent at a path with no `cursor-agent` in it, run as
    `node plain-parent.mjs --note /x/cursor-agent/versions/9/index.js -- <hook>`. Result: "Session proof written …
    for cursor-agent host process 2683039", which is that parent.
  - This is contrived, so low. Anchoring the match to the entry-script argument would close it.

**Row 27: the e2e test. PASS, with one weak assertion.**

- The new row spawns the fixture host, which spawns `cli-bootstrap.ts --ide cursor`. It asserts
  `by-pid/<hostPid>.json`, `claude_pid === hostPid`, and the "Session proof written … for cursor-agent host process
  <hostPid>" line.
- QA 273's `claude_pid: process.pid` mutant is **red** (row 3).
- The replaced `t003-session-proof` assertion is the "Cursor payload under a Claude registration" case (`cursor_version`
  set, `CLAUDE_PID` set, no `--ide`). It asserts the output never says `for claude process <CLAUDE>`. Then it
  **branches**:
  - if "Session proof written", the line must say `cursor-agent host process` and no proof may exist under the claude
    pid;
  - otherwise the line must say "no cursor-agent host process found", and no proof may exist.
- So it states the invariant (never a Claude proof), but not which of the two things happens. Under CI and on Plumb
  the second branch runs.
- Nit: the walk-from-`process.pid` mutant is near-equivalent and survives (row 3). The e2e row passes on r1 too,
  because the fixture's path has no `cursor-agent` above the hook. The r1 defect is pinned by the matcher rows, not by
  the e2e row.

**Row 28: the new win32 branch. Differs in kind, and one difference is a defect.**

Read from `process-session.ts` at the head:

- **The query.** r1 ran
  `powershell.exe … Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"` once per ancestor (15 s timeout each),
  inside `readProcessParent`'s `try/catch`, which returned `null` on any error. r2's `loadWin32ProcessTable` runs
  **one** `Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress`
  with **no filter** (the whole process table), a 60 s timeout, and Node's default `maxBuffer` (1 MiB).
- **The walk.** It now happens in memory over that one snapshot. A null `CommandLine` (another user's or an elevated
  process) becomes `""` and the walk continues through `ParentProcessId`. The win32 table is used only when the
  default reader is passed, so **no test exercises it on any platform** (CI `test-windows` was skipped on every run).
- **Defect (blocking): the table load has no `try/catch`, and neither do its callers.** Any failure throws out of
  `findCursorAgentHostPid`:
  - `powershell.exe` failing or missing;
  - WMI/CIM erroring;
  - the 60 s timeout;
  - output that is not JSON;
  - **more than 1 MiB of output**, plausible for a whole-table dump with command lines on a busy desktop. Not measured
    here.

  `cli-bootstrap.ts` calls it at module top level in the proof IIFE, outside any `try`.
- Simulation on Linux (`probe427w.mts`, `process.platform` forced to `win32` by a preload; there is no
  `powershell.exe` here):

| Tree | In-process `findCursorAgentHostPid(ppid)` | Built `cli-bootstrap.js` under the fixture host, `--ide cursor` + `cursor_version` |
|---|---|---|
| **r2 head** | **THREW `ENOENT spawnSync powershell.exe`** | **exit 1**, stdout = only the fixture's own pid line: no proof line, no greeting, no `SESSION_UUID`. stderr: `Error: spawnSync powershell.exe ENOENT` |
| r1 (control) | returned `null` | exit 0, 4 lines: "Session proof NOT written: no cursor-agent host process found …" |

- So on Windows, a failed process query turns "fails closed with a visible reason" (QA 273 row 19's gate, which r1
  met) into a crashed SessionStart that prints nothing.
- On the server side, `writeSessionId()` → `proveSession` with `cursorWalk` would throw into each attributed tool call
  whenever the direct proof is absent.
- Fix: wrap the table load (or the call) and return `null` with the reason, and raise `maxBuffer`. Optionally filter
  the query to the needed columns, which r2 already selects.

**#427 verdict: REJECT** `987901c9cb43f3dd3a31b9e22fec164edd9769dd`, on row 28: the win32 query failure is not
handled, which is a fail-closed regression from r1.

- The wrong-pid fix itself (QA 273's blocker) is verified.
- **Separately, and as the amendment says, #427 r2 cannot merge until the real-Windows row 20 is re-run** on the
  laptop. QA 274's row 20 evidence is for the old per-ancestor walk.
- That re-run should also force a query failure, or measure the JSON size on the real desktop, to settle the 1 MiB
  question.

## Batch merge (rows 29–31)

**Row 29.** In `~/qa-scratch/qa275-merge`, from `bbea9698`, merged `--no-ff` in order with scratch identity `qa275`
(nothing pushed):

| Merge | Commit | Result |
|---|---|---|
| #421 `8173cef6` | `2cb542b4` | clean |
| #424 `b9026d71` | `524ad940` | clean |
| #425 `9fcb97ca` | `a9bd61ce` | **CONFLICT `scripts/setup.mjs`**, one hunk: the `import { … } from './setup-hooks.mjs'` line (#424 adds `copyCursorSlashCommands`; #425 adds `withCursorSessionEndHook`). Resolved as the union. **Mechanical.** `setup-hooks.mjs` auto-merged, as in QA 273. |
| #427 `987901c9` | `85c555fc` | clean |
| #434 `12f26320` | `1e07c997` | **clean**. The expected `open-brain/src/server.ts` conflict (#427 and #434) **did not occur**: their hunks are ~300 lines apart (`writeSessionId` vs the `focus.seats` line). `git show --remerge-diff` on this merge shows nothing for `server.ts`. |
| #436 `144623d2` | `b88cfb18` | **CONFLICT in three files**, listed below. `node --check` passes on both scripts, and no conflict markers remain (grep). |
| #437 `23d46156` | **`6d95e06ef75fce64502083a30761ac221887d1c9`** | clean. `cli-bootstrap.ts` (#427 and #437) auto-merged. |

The three files that conflicted on the #436 merge:

1. **`scripts/setup.mjs`**, four hunks:
   - The import line: union of all four added names, giving
     `withSessionHooks, withCursorMcp, withCursorSessionHook, withCursorSessionEndHook, withCursorRecallHook, repoRootFrom, copyCursorSlashCommands`.
   - The constants: keep both `OPEN_BRAIN_SESSION_END` and `OPEN_BRAIN_RECALL_TRIGGER`.
   - The function block: keep #436's new `registerCursorRecallHook()`, followed by #424's renamed
     `installCursorSlashCommands()` header and its first line. #436's side carried the *old* header
     `function copyCursorSlashCommands() {`, which #424 renamed.
   - `main()`: `registerCursorRecallHook(); installCursorSlashCommands();`.
2. **`scripts/setup-hooks.mjs`**: #425's `withCursorSessionEndHook` and #436's `withCursorRecallHook` were added at the
   same place. Kept both, closing the first function where its own body ends.
3. **`open-brain/tests/setup-hooks.test.ts`** (**not named in the amendment**):
   - The import line: union.
   - #425's `describe("setup.mjs Cursor sessionEnd (T-235 P2-4)")` and #436's
     `describe("setup.mjs Cursor recall hook (T-235 P2-5)")` were added at the same place. Kept both, closing the first
     describe.

**Every resolution is mechanical**: a union of both sides, with no line from either side changed. The only judgment
was taking #424's renamed function header over #436's stale one, which is forced by #424's rename.
`git show --remerge-diff b88cfb18` shows exactly the hunks above.

**Row 30.** On `6d95e06e`, every check exits 0:

| Check | Result |
|---|---|
| `tsc --noEmit` | exit 0 |
| `npm run typecheck:tests` | exit 0 |
| `npm run build` | exit 0 |
| `node --check build/server.js`, `build/cli-bootstrap.js`, `build/cli-session-end.js`, `build/cli-recall-trigger.js` | exit 0 each |
| `tests/harness/config-channel.test.ts` | 44/44, exit 0 |
| `tests/setup-cursor-commands.test.ts` | 8/8, exit 0 |
| `tests/setup-hooks.test.ts` | 19/19, exit 0 |
| `tests/setup-scratch-home.test.ts` | 1/1, exit 0 |
| `tests/t003-session-proof.test.ts` | 18/18, exit 0 |
| `tests/t003-r2.test.ts` | 9/9, exit 0 |
| `tests/t235-p2-3-cursor-proof.test.ts` | 8/8, exit 0 |
| `tests/t235-p2-5-cursor-recall.test.ts` | 5/5, exit 0 |
| `tests/cli-session-end-dedupe.test.ts` | 1/1, exit 0 |
| `tests/shared/session-hook-claim.test.ts` | 6/6, exit 0 |
| `tests/cli-bootstrap.test.ts` | 16/16, exit 0 |
| `tests/pipelines/sync/mirror-parity.test.ts` | 13/13, exit 0 |
| `tests/pipelines/session-start/hub-seat-state.test.ts` | 8/8, exit 0 |
| `tests/pipelines/session-start/hub-presence.test.ts` | 41/41, exit 0 |
| `tests/pipelines/session-start/seat-map.test.ts` | 22/22, exit 0 |
| `tests/pipelines/sync/hub-seats.test.ts` | 6/6, exit 0 |
| `tests/pipelines/session-start/focus.test.ts` | 10/10, exit 0 |
| `tests/pipelines/session-start/briefing-budget.test.ts` | 33/33, exit 0 |
| `tests/pipelines/sync/greeting-size.test.ts` | 14/14, exit 0 |
| `tests/server.test.ts` | 35/35, exit 0 |

**Row 31: full suite, once, on `6d95e06e`**, as three foreground shards in sequence (see Method). Reported separately,
G-042:

| Shard | Test files | Tests | Errors | Exit | Wall |
|---|---|---|---|---|---|
| 1/3 | 63 passed | 1000 passed, 3 skipped (1003) | 0 | 0 | 211 s |
| 2/3 | 63 passed | 789 passed (789) | **1**: `[vitest-worker]: Timeout calling "onTaskUpdate"` | **1** | 221 s |
| 3/3 | 62 passed | 890 passed, 2 skipped (892) | **1**: the same | **1** | 272 s |
| **Total** | **188 passed (188)** | **2679 passed, 0 failed, 5 skipped (2684)** | **2** | **non-zero** (0, 1, 1) | 704 s |

- **Passed 2679, failed 0, errors 2, exit non-zero.**
- The only non-zero cause is vitest's worker RPC timeout (`onTaskUpdate`). No test is named and there is no product
  stack (`rpc.-pEldfrD.js` `onTimeoutError`).
- With 0 failed, this is the symptom D-082 ruled environmental on Plumb.
- Full logs: `~/qa-tmp/qa275/shard-{1,2,3}.log`.
- The real profile hashes matched after the run.

**Batch result:** the merge is clean or mechanical, and the merged tree is green apart from the D-082 symptom. That
does not change the per-PR verdicts above.

## Findings summary

1. **#427, blocking (row 28).** The r2 win32 process-table load (`loadWin32ProcessTable`) is unguarded.
   - Any query failure (powershell or CIM error, 60 s timeout, non-JSON, more than 1 MiB of output) throws.
   - The SessionStart hook then exits 1 with no output at all, where r1 failed closed with a reason. Shown by
     simulation.
   - The real-Windows row 20 must be re-run regardless.
2. **#434, blocking (row 6).** Another seat's row with no `runtime` makes `ob_start` drop SEATS silently and print
   `hub listener: not polling` for a waker seat.
   - `dispatch.cursor.room` falls back to the top-level `room`.
   - The duplicated `room` and `hub_name` copies can drift without `/sync` noticing.
3. **#437, blocking (row 14).** M1 (read-then-write) survives the PR's race row 10/10, while a barrier race kills it
   48/50. The product's `wx` is atomic (100/100 exactly-one).
4. **#437, medium-low (row 17).** In the stale-claim reclaim, two processes can both run (15/100 under a barrier).
   `unlinkSync` and `statSync` can throw an uncaught `ENOENT` (76/100 trials).
5. **#437, low.**
   - The dedupe gate also fires on `OPEN_BRAIN_IDE=cursor` or `--ide cursor`, not only on `cursor_version`.
   - The session-end half of R3 is unpinned (a call-site M2 survives).
   - Claim files are never cleaned.
   - A resume within 120 s is suppressed (a design limit).
6. **#437, docs (row 18).** The plan's "Live counts" after-column is a sequential simulation, and no after-patch count
   is from a live `cursor-agent` run. The PR head drifted to `d8f4c9dc` (docs only) after the pin.
7. **#427, low (row 26).** The matcher matches anywhere in the command line, so an ancestor whose arguments mention
   `…/cursor-agent/versions/<v>/index.js` is taken as the host (shown). Renamed installs and unix shims fail closed;
   the unix shape is unmeasured.
8. **#434 / #427, low.** `shared.md`'s Cursor OwnerPid rule ("contains `cursor-agent`") differs from #427 r2's
   matcher.
9. **#436, observations.**
   - The Cursor `postToolUse` entry has no matcher: about 0.5–0.6 s of Node start-up per non-shell tool call on Plumb.
   - The output carries CC's `hookEventName: "PostToolUse"`.
   - The PR body's "when `OPEN_BRAIN_RECALL_TRIGGER` is set" is wrong: registration is unconditional.
10. **Nits.**
    - Surviving mutants: #436's case-insensitive allowlist and dropped `setup.mjs` call; #427's walk-from-pid
      (near-equivalent).
    - #427's conditional `t003-session-proof` replacement assertion.
    - #424's re-preservation of an older template copy on every template update.
    - The batch conflict set included `open-brain/tests/setup-hooks.test.ts`, which the amendment did not list. The
      expected `server.ts` conflict did not occur.

QA-275: REPORT COMPLETE
