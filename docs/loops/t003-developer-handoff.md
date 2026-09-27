# T-003 developer handoff: a server knows its OWN session

**By:** Forge (developer), record session **137**, uuid `02565cad-14c9-4db0-bc2c-970686419ae9`, 2026-09-26/27.
**Model / effort, read from this session's transcript:** `claude-opus-5-5`, effort `medium` on all 285
assistant turns counted.
**Candidate:** `loop/t003` at **`706c029`** (code), stacked on `origin/loop/t179-r2` `d0335d7`. No merge-in
was needed: round 2 had no fix round when this was built.
**Brief:** `docs/loops/t003-session-identity-brief.md` (on `origin/docs/session-100-qa99-dispatch`).
**Rulings:** Atlas (planner, record 109) over A2A, 2026-09-26. Q1: the proof is SIA-owned (written by the hook),
not Claude Code's `~/.claude/sessions/<pid>.json`. Q2: Cursor refuses attributed writes. The SessionEnd removal
and "the server uses ppid, never CLAUDE_PID" were accepted as named protections, each with a row. The reconnect
measurement was required before freeze. The rulings are quoted from the planner's messages; Aaron's word
reached me only through them.

**"It works" is not a claim this seat can make.** What follows is what I ran, in this tree, and what it
printed.

## 1. Step 0: what a server can know (full tables: `docs/loops/t003-step0.md`)

| Candidate | Available | Same across reconnect | Correct after `/clear` |
|---|---|---|---|
| Spawn env `CLAUDE_CODE_SESSION_ID` | yes (measured in a probe server's OWN env) | respawned, so re-read | **No: observed stale** (the server survives `/clear`) |
| `CLAUDE_PID` in the MCP server's env | yes | — | **WRONG in 2 of 2 probe runs**: inherited from the launching session (the nested case) |
| `process.ppid` | yes: 3 of 3 (interactive 8832←2500, probes 12992←10300 and 2292←13988) | **yes: observed** (15820←2500 after `/mcp reconnect`) | the pid is stable; it names the process, not the session |
| Hook payload `session_id` + hook's `CLAUDE_PID` | yes: `CLAUDE_PID` = its own claude in 2 of 2 | — | the hook fires on `/clear` and **completes before the first tool call: 3 of 3** (headless) |
| Claude's `~/.claude/sessions/<pid>.json` | yes (one instance) | per process | yes (observed) — **not used** (ruling Q1: undocumented host internals) |
| Newest transcript / `ob_set_session` argument | guess / unchecked | — | disqualified |

The server survived `/clear` in 3 of 3 instances: this session's own claude process has served five sessions,
and the two headless probes each served two. That is QA 125's A9 premise, which QA could not observe headless.

**Reconnect (Aaron ran `/mcp reconnect open-brain` here, measured 23:47Z):** old server 8832 exited. The new
server is 15820, and its parent is still claude 2500. `processStartTime(2500)` = `134348741325326178`,
byte-identical to the `procStart` Claude Code itself recorded, so two independent instruments agree. **The
live proof read was NOT observable:** the serving build is the main tree's, which has no proof. See §7.

**Denied by the auto-mode classifier ("Credential Exploration") and not pursued another way:** reading server
8832's environment block, and reading other claude processes' `~/.claude/sessions/*.json`.

## 2. The design as built

- **`open-brain/src/shared/process-session.ts` (new):** `processStartTime(pid)` (win32
  `Get-Process…StartTime.ToFileTimeUtc()`, linux `/proc/<pid>/stat` field 22, else `ps -o lstart=`), and
  `writeProcessSession` (atomic: tmp then rename), `removeProcessSession` (only its own session's) and
  `proveSession`. Proofs are kept in `by-pid/`, beside `active-session.json`, so every override of that path
  (the test suite's included) isolates them.
- **SessionStart (`cli-bootstrap.ts`)** writes `by-pid/<CLAUDE_PID>.json` = `{session_id, claude_pid,
  proc_start, ide, written_at, transcript_path?}` **first**: after the payload and workspace are parsed, before
  tree currency, git and the health checks. It is written only from a payload id (never a generated one), only
  for Claude Code, and never with an unreadable start time. Every outcome prints a `Session proof …` line,
  so a missing proof is never silent.
- **SessionEnd (`cli-session-end.ts`)** removes the proof first thing, and only when it holds the ending
  session's id. Whichever hook runs first across `/clear`, the next session's proof survives.
- **Server (`server.ts`):** `writeSessionId()` = `proveSession(by-pid dir, process.ppid, start of ppid)` at
  every call. Only the parent's start time is cached (the parent is fixed; the pid is re-checked).
  **`_activeSessionId` and `_sessionSelfRegistrations` are gone.** `attributedSession(named)` makes a named id
  a claim: it must equal the proven one, or the call refuses naming both.
  - `ob_set_session`: a check. It refuses without a proof or with a different id, and persists the proven id to
    `sessions`.
  - `ob_state`: `session_uuid` is the proven id. With none, `set_handoff` refuses (T-163's existing refusal)
    and the reason is appended.
  - `ob_start`: stamps the proven id (after `/clear`, the new session's log).
  - `ob_recall` / `ob_feedback` / `ob_recalled`: log under the proven id, or say "NOT LOGGED" with the reason.
  - `ob_end`, `ob_store_chunk`: a `session_id` other than the proven one refuses **before anything is
    written**. `ob_store_chunk`'s body is extracted to an exported `handleStoreChunk` so it is testable.
  - `ob_stats`: `Session proof (this server instance): <id>, via parent process <pid>` or `NONE — <reason>`,
    replacing the self-registration count.
- **Removed, not guarded:** `resolveWriteSession` and its five tests. The per-project slot is still written by
  the hook (a `/start` hint, a diagnostic), and **nothing attributes a write from it.**
- **R179-2's different-checkout refusal is superseded.** Its premise (registering as another checkout's
  session) is impossible now, since no id but the proven one registers. Its three tests are converted, and its
  pinned LIMIT row (same-checkout impersonation) is **flipped to refused**.
- **`end.md`, all three copies, identically:** "Needs a session the server can PROVE is its own … Cursor
  writes no proof, so under Cursor nothing is attributed (ruling Q2)"; the report token is now "no proven
  session".

### Limits, stated in the code as well

1. **Stale adoption needs SessionStart AND SessionEnd to fail across one `/clear`.** Either alone is caught
   (rows 6 and 13).
2. The hook-before-first-tool ordering is **measured headless only**, 3 of 3. A hook that exceeds its timeout
   is covered only by limit 1's SessionEnd half.
3. **The server must be claude's direct child.** `setup.mjs` registers `command: 'node'` (lines 132, 208),
   which was observed direct. A wrapper (`cmd /c`, `npx`) makes every attributed write refuse. That fails
   closed, not wrong.
4. **Cursor attributes nothing** (ruling Q2). A measured Cursor proof is a follow-up task for the planner to
   file.
5. `processStartTime` costs one PowerShell spawn on Windows: once per server (cached), and once per
   SessionStart hook.

### Condition (1): are both hooks registered on a fresh install?

**Yes on this stack, for the documented install:** `scripts/setup.mjs` → `setup-hooks.mjs` registers
SessionStart **and** SessionEnd (R179-5). The row *"an empty settings file gets both, and other settings keys
survive"* (`tests/setup-hooks.test.ts:30`) passed in my run. **`/bootstrap`
(`project-template/.claude/commands/bootstrap.md`) installs no hooks at all on this stack**: it scaffolds a
project, and the hooks are a once-per-machine install. The record-133 `/bootstrap` fix is on another branch,
and whether it changes this is **not checked** from here.

## 3. The rows (`open-brain/tests/t003-session-proof.test.ts`, 18 rows)

Each proof is **real**: it is written for the worker's actual parent process, with that process's actual start
time, by the function the hook uses. Each server row imports a **fresh module** (what a reconnect is).

| # | Row | Red first on | Killing mutant |
|---|---|---|---|
| 1–2 | `processStartTime` known positive, stable, two processes differ, dead pid / 0 / −1 → null | (new instrument) | — |
| 3 | **A7, one checkout:** `ob_set_session(OTHER)` refused naming both; the write lands under the proven id and the victim is untouched | unchanged server: **accepted** the claim | M5 |
| 4 | the proven id is accepted "via process proof"; a bare call registers the proven id, **not the slot's** | unchanged: `[via argument]` | M5 |
| 5 | **A8 reconnect:** fresh server, slot holds OTHER, proof SELF, no registration → the write lands under SELF | unchanged: **adopted OTHER** | — (M4's shape) |
| 6 | no proof + a fresh slot → the write refuses with the reason; the slot is never adopted | unchanged: **adopted the slot** | M4 |
| 7 | **A9 `/clear`:** proof replaced by NEXT, no re-registration → the next write is NEXT's, and SELF's handoff is intact; `ob_start` stamps NEXT | unchanged: **replaced SELF's handoff** (A9 exactly) | M3 |
| 8 | `/clear` + failed SessionStart (proof removed) → refuses rather than writing as the old session | unchanged: **wrote** | M3 |
| 9 | **nested:** `CLAUDE_PID` names another live process with a valid ATTACKER proof → still SELF | by mutant only (the old code has no proof) | **M1** |
| 10 | reused pid (start-time mismatch) → refuses "a reused pid" | by mutant only | **M2** |
| 11 | `ob_end` with a foreign `session_id` → refused | unchanged: **accepted** | M6 |
| 12 | `ob_store_chunk` foreign id → refused; unnamed → linked to the proven id | unchanged: no exported handler (**red by absence**, noted) | M7 |
| 13 | **two sessions in one checkout, as real processes:** two stand-in claude parents, each running a writer as its direct child (`ppid === parent` asserted), with the slot holding B → each handoff under its own uuid | unchanged: **A's write landed under B** | M4 (via 6) |
| 14–15 | `proveSession` names each refusal; `removeProcessSession` removes only its own | (new) | M8, M11 |
| 16 | **hook:** SessionStart writes `by-pid/<CLAUDE_PID>.json` with the payload id and the real start time; end to end, `proveSession` returns it. **`CLAUDE_PID` ≠ the hook's parent**, so a ppid-keyed hook is caught | d0335d7 hooks: **no proof** | **M9** |
| 17 | no `CLAUDE_PID` (deleted explicitly: this suite inherits 2500), a Cursor payload, a subagent, no payload id → **no proof**, each with its reason | d0335d7 hooks: no message | M10 |
| 18 | SessionEnd removes its own proof and keeps NEXT's | d0335d7 hooks: no removal | M11, M12 |

**Two of my fixture faults were caught by the rows themselves, before any green:** (a) A7's victim was
first seeded through the server under test, so the row was red for "the old server can't write unregistered"
rather than for A7; it is now seeded by `applyStateOps`. (b) The two-sessions writer first ran under tsx's
**cli**, which starts a second node process, so the writer's parent was tsx rather than the stand-in claude.
The `ppid === parent` assertion failed on it, and the writer now runs under `node --import tsx/esm`.
**And one weakness found by reading my own green:** the hook rows first passed `CLAUDE_PID` = the hook's own
parent, so a hook keyed on its ppid would have passed. They now pass `process.ppid` (a live process that is
not the hook's parent), and M9 is the proof.

## 4. Runs (this tree, Windows 10, node 22.23.2)

- **Red:** the 11 server rows on the unchanged `server.ts` (only the new module present): 11 failed, 4
  passed. Two were re-run after the fixture fixes above, red for the right defect. Hook rows on the d0335d7
  hooks: 3 of 3 failed (RED0 in the mutant log).
- **Green:** `tests/t003-session-proof.test.ts` 18 of 18. The five affected files (`active-session`,
  `cli-bootstrap`, `server`, `setup-hooks`, `t003-session-proof`): **106 of 106**, vitest rc 0 (captured
  unpiped).
- Six pre-existing tests failed after the change, **all expected**: each registered an arbitrary id and then
  wrote. They are converted with `proveOwn(id)` (a real proof), plus a file-level `afterEach` that removes it.
- **`npx tsc --noEmit -p .`: clean**, before the commit and on every mutant.
- **No full local suite** (brief). **CI:** dispatched run **36281313992** on `706c029`, tcm (Linux) plus the
  opt-in Windows laptop job (`windows=true`), because `processStartTime` has per-platform branches. Its result
  is in §8.
- **`/sync --check`:** the same three issues as on the base, with identical counts (21 passed, 4 warnings, 3
  issues, 4 skipped): the state-schema v2 record on this branch, mirror-parity (the `.claude` mirror's
  difference is byte-level: 0 text lines differ before and after my three-way edit; the `.cursor` one is 5
  lines, unchanged), and retirements in ENTITIES.md.
- **GitNexus `impact` / `detect_changes`: NOT run.** The index lives in the main checkout at another commit,
  and CLAUDE.md warns a stale index answers with a confident wrong blast radius. The blast radius was taken by
  hand instead: `writeSessionId` has 6 call sites (ob_start, ob_state, ob_recall, ob_feedback, ob_recalled,
  ob_store_chunk), and `_activeSessionId` had 3 users. All are changed and covered above.

## 5. Mutants (`scratchpad/mutants.mjs`; each: the site occurs exactly once, the edit landed, `tsc` clean, rows non-zero, restored in `finally`)

| Mutant | Result |
|---|---|
| M1 server reads `CLAUDE_PID` | KILLED (nested row) |
| M2 no start-time check | KILLED (reused pid) |
| M3 proof cached for the server's life | KILLED (A9, failed-SessionStart) |
| M4 slot adopted when there is no proof | KILLED (no-proof) |
| M5 `ob_set_session` accepts any claim | KILLED (A7) |
| M6 `ob_end` unchecked | KILLED |
| M7 `ob_store_chunk` unchecked | KILLED |
| M8 `proveSession` pid check removed | KILLED |
| M9 hook keys the proof on its ppid | KILLED |
| M10 hook writes a proof with no payload id | KILLED |
| M11 SessionEnd removes unconditionally | KILLED |
| M12 SessionEnd removes nothing | KILLED |
| RED0 the d0335d7 hooks | 3 of 3 red |

12 of 12 killed, none invalid. After the run the tree was restored: the grep for every mutant's text is 0, `tsc`
is clean, and 106 of 106 pass. **Not covered by a mutant:** "the proof is written FIRST" in the hook. It is
by construction (its position in the file), and no row measures ordering inside a hook.

## 6. Row #348: the repair, for Aaron (NOT done)

Read **read-only** from `~/.claude/open-brain/knowledge-v2.db` (`readonly: true, fileMustExist`):

- `feedback_log` #348: `session_uuid 2e5f340b-ea0c-4a51-97f3-e44b7be2b2f5`, knowledge 372, `helpful`,
  2026-09-01T08:28:52Z, `direct/direct`. That uuid is **absent from `sessions`** and has no other row in
  `feedback_log` or `recall_log`.
- **The rightful session is `1f1d05c2-8d7a-4870-b03a-944292ffc049`**, by two independent facts. It has
  **exactly 33** `recall_log` rows (T-003's note: "33 `recall_log` rows under this session's real id"), and it
  is the only session in that window (2026-08-31 20:00Z to 09-01 14:00Z, three sessions) that recalled
  **entry 372**, the entry #348 rates.
- **Repair (one statement, guarded so it can change only that row, and only if it is still wrong):**
  `UPDATE feedback_log SET session_uuid = '1f1d05c2-8d7a-4870-b03a-944292ffc049' WHERE id = 348 AND session_uuid = '2e5f340b-ea0c-4a51-97f3-e44b7be2b2f5';`
  Expect `changes = 1`. Before running it, confirm the uuid against Session 53's log in the main tree
  (`.agents/SESSIONS/Session_53.md`, "Session ID"), which is gitignored and so not readable from this checkout.
  Take a backup copy of the DB first.

## 7. What is not shown

- **A live proof read by a real server.** The serving server and hooks are the main tree's build. It shows
  only after the merge, the main tree's update and rebuild (T-172), and a new session. Then check: the
  greeting has a `Session proof written: …` line, and `ob_stats` shows `Session proof (this server
  instance): <this session's id>, via parent process <claude pid>`. After `/clear`, the id changes with no
  `ob_set_session`.
- **Interactive timing** of SessionStart against the first tool call (headless only).
- **Cursor**, any path.
- **macOS** `ps -o lstart=` branch: no mac here, and no CI mac runner.

## 8. CI

Run **36281313992** (workflow_dispatch on `706c029`, `windows=true`): **success**, both jobs, read with `gh run view` after `gh run watch` exited 0.

| Job | Runner | Result |
|---|---|---|
| `test` | tcm, self-hosted Linux | Test Files 87 passed (87); **Tests 1320 passed, 2 skipped (1322)**; `tests/t003-session-proof.test.ts (18 tests)` passed. That is the `/proc/<pid>/stat` branch of `processStartTime` on a real Linux process tree |
| `test-windows` | laptop-win, self-hosted | Test Files 87 passed (87); **Tests 1321 passed, 1 skipped (1322)**; the T-003 rows are listed passed. That is the PowerShell branch |

The full suite ran on CI only; no full local suite (brief).
