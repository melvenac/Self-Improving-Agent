# T-003 round 2: developer handoff

**By:** Grok 4.7 (developer), record session 152. **Planner:** Atlas, hub room `k57frxw0ptb8tadmqdwy0khhks8ey006`.
**Candidate:** `d781b59` on `loop/t003-r2`. This handoff is the commit after it.
**Base:** `origin/loop/t003` at `9f4fc1e` (the round-1 handoff). Its parent is the round-1 candidate `706c029`. The brief named `706c029`; the branch tip had already moved to the handoff, and round 2 stays stacked on it.
**Model:** Grok 4.7. This Cursor session did not surface an effort setting.
No `/end`. No laptop (`windows=true`) CI. `tsc --noEmit` before every push. This worktree has no GitNexus index and this session has no GitNexus tools, so impact was not run.

## What changed

| Item | Where | What it does |
|---|---|---|
| **D1** | `sessionStart` treats `sessionId: null` as "do not discover". `undefined` still discovers. `handleStart` passes the proven id, which is null with no proof, and prints `Session ID: none — <reason>`. | A shared checkout cannot stamp or reuse the newest transcript's log. |
| **D2** | `proveSession` | JSON `null`, an array, or any non-object is a named refusal (`is not a session record`). It does not throw. |
| **D3** | `handleEnd` | With no named `session_id`, both `resolveRecalledIds` and `sessionEndV2` use the proven id. A rating of an id `recall_log` holds for that id reaches `feedback_log`. |
| **D4** | `handleFeedback` | No proof still records the counter line, and also prints `NOT LOGGED: this server cannot prove its session — <reason>`. |
| **D5** | `cli-bootstrap.ts` | The proof block uses `detectIde(payload, registeredAs)`, the same payload-then-flag result as the slot. `--ide cursor` with no `cursor_version` does not write a Claude proof. |
| **R2-D1** | `applyStateOps` | After the proven uuid's recorded session is found, a non-null `checkout` that differs from this write's checkout is refused, and the handoff is unchanged. A null checkout (a legacy session record) is not refused. A session recorded under this write's checkout still writes. |
| **R2-D5** | no product change | One row: a hand removal of the migrated legacy session record, after that seat has written a keyed session, is flagged. It kills `erasure-legacy-session`. |
| **`end.md`** | all three copies | Line 7's "every write records its session" and line 11's "only a different checkout is refused" now say what the writer does: a write with no session records nothing and says so; a write is refused when its session is already recorded under a different checkout; a null checkout is not refused on that comparison. |

`handleFeedback` is exported so the D4 row can call it. The tool still calls that function. Behavior aside from the `NOT LOGGED` line is unchanged.

**The registration-time checkout check was already gone on T-003** (round-1 handoff: R179-2 superseded, because only the proven id registers). It was not restored. P3 registers against the victim checkout, where that uuid is local, so a check at `project_dir` does not close it. P2, P3 and P4 are refused in the writer, which is the door the ruling names.

## Red, then green, on tcm

`workflow_dispatch` of `ci.yml`. `hosted` and `windows` left unset, so the job is the self-hosted tcm runner. Read per test from the log.

**Red** `573ac65`, run `36287132237` (11 failed, 1325 passed, 2 skipped):

| Row | Result |
|---|---|
| QA 142 D1 (no proof does not stamp the newest transcript) | fail |
| QA 142 D2 (JSON null is a named refusal) | fail |
| D1 print `Session ID: none —` | fail |
| sessionStart: null does not discover | fail |
| D3 `ob_end` with no `session_id` | fail |
| D4 `NOT LOGGED` | fail |
| D5 `--ide cursor` | fail |
| P2, P3, P4 | fail |
| `end.md` wording | fail |
| R2-D5 legacy-session removal | pass (the check already flagged it; the row was the gap) |
| same checkout, and a null checkout | pass |

**Green** `d781b59`, run `36287331316`: 89 files, 1336 passed, 2 skipped (1338).

## Mutants

Each branch is `d781b59` plus one deletion. `tsc` before the push. tcm, same dispatch.

| Branch | SHA | Run | Kills |
|---|---|---|---|
| `loop/t003-r2-mut-d1` | `245064b` | `36287373437` | QA 142 D1, and `a null session id does not fall back to transcript discovery` (2 failed). The greeting's `Session ID: none —` row stays green: that line is printed from the proof, not from the id discovery would have found. The log row is the one that sees the other session's id. |
| `loop/t003-r2-mut-d2` | `9435a1d` | `36287383074` | QA 142 D2 |
| `loop/t003-r2-mut-d3` | `1c5265b` | `36287393691` | D3 |
| `loop/t003-r2-mut-d4` | `41879cf` | `36287405024` | D4 |
| `loop/t003-r2-mut-d5` | `0903ffc` | `36287418795` | D5 |
| `loop/t003-r2-mut-r2d1` | `540e1d3` | `36287470332` | P2, P3 and P4 (3 failed). The same-checkout write and the null-checkout write stay green. |
| `loop/t003-r2-mut-r2d5` | `5f3b048` | `36287503550` | the legacy-session removal row (`isSuperseded(..., true)`, QA's `erasure-legacy-session`) |

## Not this round

- O-1 (a cached null start time) and O-2 (proof pruning).
- Open 3 (detect an install without SessionEnd).
- Row #348's repair. The transcript check on Aaron's machine was not done.

## Not verified

- No laptop CI.
- No `/sync`. The running MCP server is the main checkout's build; this worktree was not installed over it.
- GitNexus impact was not run.
- Tests used scratch directories and the suite's `KNOWLEDGE_V2_DB`. The live `state.json` and the real by-pid directory were not written.
