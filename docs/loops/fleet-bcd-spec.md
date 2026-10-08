<!-- clark, 2026-10-08: the full B/C/D spec for docs/loops/fleet-deterministic-dispatch.md (summary there). Drafted from a read of A2A-Hub origin/master 7bbd94e1 (hub-talk, waker, planner-watch) by a multi-agent pass, challenged by two critics per section. Open questions are listed in the main doc. -->

### C, `ready-verify`: the READY/FROZEN verifier

- **What it does.** C checks every developer READY/FROZEN claim against **remote truth** and writes a PASS, FAIL or CANNOT_CHECK **record**. The checks are the 7 base checks above plus clark's 3 MUSTs.
- **What makes it binding.** A record is not advice. **QA is dispatched only on a PASS (or a recorded OVERRIDE) for the exact SHA** (C9). So a claim C never saw, or could not check, never reaches QA. C judges the evidence only; QA still judges the fix (C10).
- **Where the code lives.** A2A-Hub `scripts/`, next to `hub-talk.mjs` and the wakers. It lands after the Loop 18 freeze (A2A T-131). SIA and agent-dashboard run a **pinned install** of it (C1), not a seat's working tree.

#### C1. Code, install, processes

- **Files.**
  - CLI: `scripts/ready-verify.mjs`.
  - Modules: `scripts/verify/{grammar,classify,profile,git,gh,checks,record,watch,gate}.mjs`.
  - Tests: `tests/ready-verify-*.test.ts`, in the same style as `tests/waker-*.test.ts`.
- **What C reuses from A2A.** `resolveKey`/`hubId` (`scripts/hub-key.mjs`), `decodeBody` (`scripts/hub-exit.mjs`) and `withTurns` (`scripts/hub-cursor.mjs`).
  - It **never imports `hub-talk.mjs`**, which parses argv and calls `process.exit` when it loads (`hub-talk.mjs:125-239, 794`).
  - It **defines its own exit constants** and does not reuse `RC_*`.
  - To post, it spawns `hub-talk.mjs --say-file -`.
- **Pinned install.**
  - The scheduled task runs `~/.a2a-hub/verify-v<x>-<sha8>/scripts/ready-verify.mjs`. This is a `git archive` export plus a `VERSION.json {version, commit}`, the same pattern as `start-waker.ps1:5`'s `waker-v1.18.0-8baef929`.
  - A run without `VERSION.json` (from a checkout) is allowed for tests and by hand. Its record says `"pinned": false`, and **the gate refuses unpinned records**.
- **Modes:**

| Mode | Command | Use |
|---|---|---|
| watch | `ready-verify --watch --repo <git-url> --as <planner> [--baseline now\|<turn>]` | long-running; one per planner repo, run as scheduled task `A2A-Verify-<planner>` on the planner's machine (C8) |
| one turn | `ready-verify --repo <url> --as <planner> --room <sid> --turn <n>` | a re-check by hand; writes `<n>.r<k>.json` and never overwrites |
| submit | `ready-verify --submit --repo <url> --as <planner> --reply-file <path\|->` | a claim that came through no listed room (a Claude Code dev seat, a `--peer` room); the planner pastes the reply |
| dry | `ready-verify --repo <url> --reply-file <path\|->` | no hub, no record, no post; prints the verdict |
| gate | `ready-verify --gate --repo <url> --sha <sha40>` | B's QA-dispatch check (C9) |
| override | `ready-verify --override --repo <url> --as <name> --room <sid> --turn <n> --reason <text>` | the only override (C9) |
| mirror | `ready-verify --init-mirror --repo <url>` | creates the mirror ahead of the first run |

- **Hub.**
  - `HUB_URL` is required. There is no `127.0.0.1` default, unlike `hub-talk.mjs:118`. If it is unset, C exits 2 with `hub-unset`.
  - The key comes from `resolveKey(--as)`.
  - C reads turns **only** with a plain `GET /a2a/session/<sid>/messages?after=<n>` that carries **no** `X-Hub-Poll-Intent` header. That read moves no cursor and marks nothing read (`convex/messages.ts:86-91`, `src/presence.ts:44-58`).
  - **C never runs `hub-talk --inbox` or `--wait`** (the ruling at `hub-talk.mjs:72-76`).
- **Mirror.**
  - Path: `~/.a2a-hub/verify/mirrors/<owner>__<name>.git`, a bare clone with a heads-only refspec.
  - Every fetch and every check runs under an exclusive lock `<mirror>.lock`, created with `wx`. C waits up to 60 s for it, and a lock older than 10 min is stale.
  - C never reads or fetches in a seat's worktree.
- **The reply is untrusted data.**
  - Every git/gh call is `execFile` with an argv array, never `shell: true`.
  - Test names go to git after `-e`.
  - Branch names must match `^[A-Za-z0-9._/-]+$` and pass `git check-ref-format --branch`.
  - The `--repo` passed to gh comes from the profile, never from the reply.
  - `VERIFY_GIT` / `VERIFY_GH` (a JSON argv prefix, e.g. `["<node.exe>","gh-shim.mjs"]`) replace the binaries. Tests need this on Windows, because `execFile` cannot launch a `.cmd` shim without a shell.

#### C2. Inputs: the per-repo profile (tracked, read from the default branch)

- **Where it is.** `.agents/SYSTEM/verify-profile.json`, read by `git -C <mirror> show refs/heads/<defaultBranch>:.agents/SYSTEM/verify-profile.json` after the fetch.
  - **C never reads the profile from the candidate SHA**, so a developer cannot weaken it on their own branch.
  - A missing profile is exit 2 `profile-missing`. A profile that fails the schema is exit 2 `profile-invalid`.
  - Each record stores `profileBlob`. When the blob changes, the watch prints `VERIFY PROFILE <old8>-><new8>`.
- **Changing the profile is a reviewed PR to master that needs Aaron's merge word.** It is **not** covered by the docs-only standing approval (clark memory `standing-merge-approval.md` must say so). CODEOWNERS or a ruleset is to confirm.
- **Shape:**
  ```json
  {
    "schema": 1,
    "defaultBranch": "master",
    "github": "<owner>/<name>",
    "seats": { "file": ".agents/SYSTEM/hub-partner-seats.json", "role": "developer" }
           | [ { "hub": "<seat hub name>", "room": "<sessionId>" } ],
    "planners": ["<hub name>", "..."],
    "testGlobs": [":(glob)**/*.test.ts"],
    "testDecl": "\\b(it|test)(\\.concurrent)?\\(\\s*[\"'`]",
    "testDeclExclude": "\\b(x(it|describe)|(it|test|describe)\\.(skip|todo|fails))\\b",
    "placeholders": ["expect\\(\\s*true\\s*\\)", "assert(\\.ok)?\\(\\s*true\\s*\\)", "expect\\(\\s*1\\s*\\)\\.toBe\\(\\s*1\\s*\\)", "\\.(skip|only|todo)\\("],
    "minNewRows": 1,
    "pr": "required" | "optional",
    "ci": { "kind": "gh", "file": "ci.yml", "job": "test" } | { "kind": "none" },
    "mutants": { "kind": "branches", "refPattern": "<regex>", "sameTree": ["open-brain/src"], "required": true, "perRow": false }
             | { "kind": "registry", "path": "<json file>", "required": true, "perRow": false }
             | { "kind": "unregistered" }
             | { "kind": "none" },
    "bindDispatch": false,
    "post": "none" | "fail" | "all",
    "failPostCap": 2,
    "gate": false,
    "urgent": { "kind": "joblog", "dir": "~/qa/<x>" } | { "kind": "none" }
  }
  ```
- **Seats and rooms.**
  - The `seats.file` form reads every seat with `role: developer` → `{hub_name, dispatch.cursor.room}`. SIA's map already holds builder, forge and infra with their rooms.
  - The map is re-read on every tick. There is **no per-machine room file**.
  - A turn in a room that is not listed is never fetched. A claim from such a room goes through `--submit` (C9).
- **Registry.** A registry is **JSON only**: `[{id, file, from, to, tests}]`, the dashboard `MUTANTS` shape (`scripts/mutants.mjs:12-35`). `from`/`to` may be a list of pairs. C never imports or runs repo JavaScript.
- **`urgent` is required.** `kind: none` is allowed but must be written. With the key absent, `--watch` exits 2 with `sink-missing`.

#### C3. Required reply grammar (strict: anything that does not parse = FAIL `parse`)

```
L1:  [TASK: ](READY|FROZEN) <task-id>[ r<N>] <sha40>                        A2A order
 or  [TASK: ]<task-id>[ <phase>][ r<N>][,] (READY|FROZEN) <sha40>[ (<ref>)]   SIA order (hub-room.mdc:18 form)
     branch: <ref>
     ls-remote: <sha40><TAB or spaces>refs/heads/<ref>        pasted output
     pr: <n>|none
     ci: <run-id>|none
     model: <id>
     run: <exact command> exit=<n> <summary>                  one or more
     rows:
     | <row-id> | <test file> | <exact test name> | new|existing |     one or more; a markdown header and |---| separator are allowed
     mutants: none
  or mutants:
     | <mutant-id> | <product file> | <red row-id> | KILLED|SURVIVED | <mutant ref>|- |   header/separator allowed
     evidence:                                                optional; free text up to END, kept in the record, never validated
     END READY <sha40>                                        last non-blank line
```

- **SHA.** `<sha40>` is exactly 40 lowercase hex characters. 7- and 8-character SHAs are FAIL `sha-short`. Both of today's shapes (the dashboard's `FROZEN 8a26165`, SIA's `f8eb9638`) would fail.
- **L1.**
  - `<task-id>` is the first token of the head. `<phase>` is one further token that does not match `r\d+`. This fits the real `TASK: T-235 P2-7 r2 FROZEN …` (`forge-inbox.txt:174`) once its SHA is full.
  - If `(<ref>)` is given, it must equal `branch:`. Otherwise FAIL `branch-conflict`.
  - Nothing may follow the SHA/ref on L1. Run ids, the model and the PR go on their own lines.
- **Evidence block.** `evidence:` is where the pasted output that both repos require goes:
  - A2A `developer.md:63-65`: "the exact command and its output".
  - SIA `developer.md:68-70`: "quote each run's failing lines and exit code".
  - The `l18-room2.txt` fea0e6d9 reply fits by moving its `rev-parse` block under `evidence:`.
- **Truncation (base check 7).**
  - Any unknown line outside `evidence:` is FAIL `parse`.
  - Each of these is FAIL `truncated`: a missing `END`, an END SHA that differs from L1, or text after END.
- **`run:` lines** are recorded but never verified (C10).
- **Transport prerequisite.** A multi-line block with TABs, pipes, `$` and backticks must be posted with `--say-file`. Today the waker instruction says `--say "<reply>"` (`scripts/waker/logic.mjs:259`), and so does `hub-room.mdc:14`. hub-talk itself says an argument is mangled on Windows (`hub-talk.mjs:35-38`). Both must switch to `--say-file` (a temp file or stdin) before C's FAILs mean anything. This ships with B (logic.mjs) and with SIA's mdc.

#### C4. Which turns are checked (classify every developer turn)

- **What `--watch` fetches.** For each listed room, every turn above that room's high-water mark (C8). Each turn is classified as one of:
  - **skipped**: `from` is in `planners`, ends in `-waker`, or is not the room's listed seat. Nothing is recorded or posted.
  - **claim**: any line matches `\b(ready|frozen)\b` (case-insensitive), and that match is not `\b(not|no)\s+(yet\s+)?(ready|frozen)\b`. It goes to the strict parse (C3), then to C5 and C6.
  - **claim-like**: no READY/FROZEN word, but a `\b[0-9a-f]{7,40}\b` and a `\b(done|pushed|green|passes?)\b` both appear. Recorded as FAIL `undeclared-claim` and printed on the watcher line. **Not posted.**
  - **no-claim**: everything else. Only the high-water mark advances.
- **Why a missed shape cannot fail open.** The real guard is the gate (C9). A claim in any shape C did not classify never gets a PASS record, so it never reaches QA.
- **Dispatch binding** (`bindDispatch: true`, after B). C reads the latest **planner** turn (from ∈ `planners`) above the baseline that starts with `TASK:`, in B's fixed shape with `task:` and `branch:` lines.
  - If the claim's task-id or branch differs, it is FAIL `task-mismatch` / `branch-mismatch`.
  - A seat's own `TASK:` status lines (`hub-room.mdc:18`) are never read as a dispatch.
  - With `bindDispatch: false`, the record says `dispatch: "unbound"`.

#### C5. Remote truth (exact commands; any network or auth error → CANNOT_CHECK)

| # | Step | Command | Fail code |
|---|---|---|---|
| C5.1 | Refresh the mirror, under the lock | `git -C <M> fetch --prune --no-tags origin "+refs/heads/*:refs/heads/*"` | `git-error` (cannot-check) |
| C5.2 | The SHA exists | `git -C <M> cat-file -e <sha>^{commit}` | `sha-missing` |
| C5.3 | The SHA is the branch tip on the remote | `git ls-remote --heads <url> refs/heads/<branch>` = `<sha>` = `git -C <M> rev-parse refs/heads/<branch>` | `tip-mismatch` |
| C5.4 | The pasted `ls-remote:` line is honest | its SHA and ref equal L1 and C5.3 | `paste-mismatch` |
| C5.5 | PR (base check 1) | whenever `pr: <n>` is given: `gh pr view <n> --repo <github> --json headRefOid,headRefName,state` → `headRefOid == sha`, `headRefName == branch`. `pr: none` is allowed only under `pr: optional` | `pr-head` / `pr-missing` |
| C5.6 | CI on the exact SHA (base check 2) | `W=$(gh api repos/<github>/actions/workflows/<ci.file> --jq .id)`. Then `gh run view <ci> --repo <github> --json headSha,status,conclusion,workflowDatabaseId,jobs` → `headSha == sha`, `workflowDatabaseId == W`, `conclusion == success`, and the job named `ci.job` has `conclusion == success` (**skipped is a fail**). Cross-check with `gh run list --repo <github> --commit <sha> --workflow <ci.file>`. Never by `--branch`. `ci: none` is allowed only when `ci.kind == none` | `ci-sha` / `ci-red` / `ci-missing` / `ci-skipped` |
| C5.7 | CI not finished | `status != completed` → record `PENDING`, re-check at 1, 2, 4 … min, up to 30 min, then CANNOT_CHECK `ci-pending` | `ci-pending` |

- **Why C5.6 compares workflow ids, not names.** `workflowName` returns the workflow's `name:`, which is `CI` for SIA (`ci.yml:1`), not `ci.yml`. The job check matters because on a docs-only PR the `changed` job skips `test` and the run still concludes success (`ci.yml:63-92`).

#### C6. Content checks (on `<sha>`, never on a branch name)

| # | Check | How | Fail code |
|---|---|---|---|
| C6.1 | Each claimed test exists (base check 5) | `git -C <M> grep -F -n -e "<name>" <sha> -- "<file>"` finds ≥1 line; `<file>` matches `testGlobs`; the hit line matches `testDecl` and not `testDeclExclude` | `test-missing` / `test-not-decl` |
| C6.2 | `new` rows are new | `B=$(git -C <M> merge-base refs/heads/<default> <sha>)`, then `git -C <M> diff -U0 $B <sha> -- <file>` has an **added** line holding the name. At least `minNewRows` rows are `new` | `row-preexisting` / `rows-none-new` |
| C6.3 | No placeholders (base check 6) | the same diff over `testGlobs`; **added** lines only, matched against `placeholders` (including `.skip(` / `.only(` / `.todo(`) | `placeholder` |
| C6.4 | Mutants are required | `mutants.required` and `mutants: none`, or no `KILLED` row. With `perRow`: every `new` row is the red row of ≥1 KILLED mutant | `mutants-missing` |
| C6.5 | Mutant ids exist in **that SHA's** registry (MUST 3) | registry: `git -C <M> show <sha>:<path>`, and the id is in it. branches: the ref is not `-`, matches `refPattern`, and `git ls-remote --heads <url> refs/heads/<ref>` finds it | `mutant-unknown` |
| C6.6 | Mutants target non-test files (MUST 3, base check 6) | registry: entry `file` must not match `testGlobs`. branches: `git -C <M> diff-tree --no-commit-id --name-only -r <mtip>` is non-empty, has no path matching `testGlobs`, and the claimed `<product file>` is in it. unregistered: the claimed file must not match `testGlobs` and must exist at `<sha>:<file>` | `mutant-test-file` / `mutant-file` |
| C6.7 | One commit on the head (base check 3, branches) | `git -C <M> rev-list --count <sha>..<mtip>` = 1 when the parent is `<sha>`. Otherwise `rev-parse <mtip>^:<sameTree>` = `rev-parse <sha>:<sameTree>` | `mutant-shape` / `mutant-retarget` |
| C6.8 | The mutant was written against this SHA | registry: each `from` text occurs in `git show <sha>:<file>`. branches: each removed line of the mutant diff occurs in `<sha>:<path>` | `mutant-retarget` |
| C6.9 | Mutants claimed where none are possible | `mutants.kind == none` and a mutant row is present | `mutant-unknown` |

- **SURVIVED rows** get C6.5–C6.8 only.
- **`unregistered`** records C6.5, C6.7 and C6.8 as `not-checked`.
- **Base check 4 (each mutant run is red on its rows)** is **not a developer-stage check.**
  - SIA developers never run CI and run mutants locally (`developer.md:66-70`, D-061).
  - SIA CI runs on push only for master, and on PRs (`ci.yml:3-18`), so a mutant branch has no run when READY is posted.
  - A2A and agent-dashboard have no CI.
  - C records it as `not-checked`. A `--stage qa` mode that reads QA-dispatched mutant runs (`headSha == mtip`, `conclusion == failure`, the failing names from `--log-failed` ⊆ the claimed rows) is defined with B's QA dispatch (to confirm).

#### C7. Outputs

- **Exit codes** (C's own constants):

| Code | Meaning |
|---|---|
| 0 | PASS |
| 1 | FAIL |
| 2 | CANNOT_CHECK |
| 3 | PENDING |
| 4 | SKIPPED (not a developer turn, no-claim, below baseline, or another instance owns the turn) |

  **Nobody takes a verdict from the exit code.** The watcher, planner-watch and the gate read the record file, and a missing final record means FAIL.
- **Record files** live on the planner's machine under `~/.a2a-hub/verify/`:
  - `rooms/<sid>/baseline.json`: `{turn, setBy, at}`.
  - `rooms/<sid>/hw.json`: the high-water turn. It is written temp-then-rename and only ever raised.
  - `rooms/<sid>/<turn>.json`: **created with `wx`** holding `{"verdict":"RUNNING","pid":…,"startedAt":…}`. If the file already exists, the run exits 4. The final body is written temp-then-rename:
    ```json
    {"schema":1,"verdict":"PASS|FAIL|CANNOT_CHECK|PENDING","room":"…","turn":146,"from":"rivet","task":"…",
     "model":"<from reply>","remote":"…","branch":"…","claimedSha":"<sha40>","tipSha":"<sha40>",
     "dispatch":"bound|unbound","profileBlob":"…","pinned":true,
     "checks":[{"id":"C6.1","ok":false,"code":"test-missing","detail":{"name":"…","file":"…"}}],
     "notChecked":["base-4"],"evidence":"<the evidence: block>",
     "post":"none|sent turn N|capped|failed rc=N","urgent":"written|none|failed",
     "verifier":{"version":"x.y.z","commit":"<A2A sha>"},"startedAt":"…","finishedAt":"…"}
    ```
  - `rooms/<sid>/<turn>.override.json` (C9) and `rooms/<sid>/<turn>.r<k>.json` (re-runs by hand).
  - `submit/<sha40>/<k>.json`: records from `--submit`.
  - `heartbeat-<owner>__<name>.json`: `{at, rooms:{<sid>:hw}}`, written every tick.
  - **This directory is D's measurement source:** the pass rate per seat, per model, per chat.
- **Room post.** One line, posted as `--as` via `hub-talk --session <sid> --say-file -`, governed by the profile's `post`:
  - Shape: `VERIFY <turn> FAIL <sha8|-> <code>(<count>) …` (e.g. `VERIFY 146 FAIL ce26f456 test-missing(4) mutant-unknown(2)`), or `VERIFY <turn> FAIL - cannot-check:<code>`.
  - **Codes only, from the fixed lists above. The post never quotes reply text.**
  - **Cap.** After `failPostCap` FAIL posts for the same seat:task (counted from the records), C stops posting, records `post: "capped"` and writes the urgent sink. This stops a FAIL → READY → FAIL loop running unattended.
  - **A FAIL post wakes the seat**, because the planner is on its allowList. That is why `post` starts at `none` (shadow mode) and PASS is never posted until D makes `VERIFY … PASS` not owed.
  - A hub-talk post exit of 1 or 3 is recorded as `post: "failed rc=N"`. The verdict does not change.
- **Watcher line** (stdout of `--watch`, and planner-watch's echo): `VERIFY PASS|FAIL|CANNOT|PENDING <seat> room <id8> turn <n> sha <sha8>: <codes>`.
- **Dashboard URGENT.**
  - *Interim:* `urgent.kind: joblog`. On FAIL, CANNOT_CHECK or `capped`, C writes `<dir>/job-verify-<seat>-<turn>.log`, ending in `VERDICT: FAIL <codes>`, and **nothing on PASS**. This fires the existing `qa verdict` URGENT rule (`server/alertWatcher.js:340-356`). **That rule exists only on the unmerged `loop/t015-pace-push`.** agent-dashboard master v1.14.0 has no `alertWatcher.js` (`server/` holds only `aggregate.js`, `index.mjs`, `push.js`, `config.example.json`). So the interim route works only after t015 is merged and deployed.
  - *Proper:* the agent pushes `verify/` records and heartbeats. A `verify fail` rule fires URGENT once per room:turn and a `verify stale` rule fires on an old heartbeat, both seeded so they do not fire again after a restart (the seedStanding pattern). This is a G-row for t017 or t018. Payloads carry ids and codes only.

#### C8. Fail closed, catch-up, concurrency

- **These all mean no PASS:** no parse, a missing field, a short SHA, text after END, a missing profile, an unknown room, any git/gh/hub error, CI not finished after 30 min, a timeout, a crash, a dead `RUNNING` record, an unpinned verifier (at the gate).
- **There is no "warn" level.** The only override is C9's, by a human or a planner.
- **Deadline and stale records.**
  - Each turn has an internal deadline of 150 s, excluding PENDING waits. Past it, C writes CANNOT_CHECK `timeout` itself.
  - A `RUNNING` record whose pid is gone, or that is older than 10 min, is taken over by renaming it to `<turn>.stale.<pid>`. Only one rename can succeed. The winner writes CANNOT_CHECK `verifier-died` and posts it.
- **Catch-up does not depend on unread.**
  - On start and on every tick, each room is read with `GET messages?after=<hw>`. A READY posted while the watch was down is verified on the next start, **even if the planner has since read the room**.
  - `hw` only ever rises. If two instances race and it regresses, the only effect is re-classifying a turn, which `wx` makes idempotent.
  - `planner-watch`'s unread diff is no longer a trigger (`planner-watch.mjs:42-45, 57-64`).
- **Baseline.**
  - A room with no `baseline.json` is refused (exit 2 `baseline-missing`) unless `--baseline now|<turn>` is passed. `now` = the room's current `turnCount` (`GET /a2a/session/<sid>`).
  - Turns at or below the baseline are never classified, recorded or posted. Enabling C on rivet's room with 150+ legacy READYs posts nothing.
- **Concurrency.** One watch per repo processes turns one at a time. The mirror lock (C1) also serialises any hand runs.
- **Liveness.**
  - `--watch` runs as a scheduled task `A2A-Verify-<planner>` from the pinned install, not under a Claude Code Monitor. So a planner roll or an expired Monitor cannot turn it off. Installing it is Aaron's act (to confirm).
  - The heartbeat is the dead-man switch. planner-watch prints `VERIFY STALE <repo> <age>` when the heartbeat is older than 3 min, and so does the dashboard's `verify stale` rule once it lands.
  - **A dead verifier blocks QA through the gate. It never passes a claim silently.**
- **planner-watch** (A2A `scripts/planner-watch.mjs`; SIA ports it to `sia-planner/scripts/planner-watch.mjs` or switches to A2A's copy, to confirm):
  - It gains, **with no new flag**, an echo of new record files under `~/.a2a-hub/verify/rooms/` and the stale-heartbeat line.
  - Because the command line does not change, the exact-match Monitor allow-rules stay valid (`a2a-planner/.claude/settings.local.json:9,15`, `sia-planner/.claude/settings.local.json:8,14`).
  - Its `prev` moves into memory, per process (the agreed `hoh-checklist.md:281` fix).

#### C9. Gate and override: deterministic vs human

- **Gate (a MUST in C and B).** `ready-verify --gate --repo <url> --sha <sha40>` exits 0 only if both are true:
  - a final record (`rooms/*/*.json` or `submit/<sha>/*.json`) has `verdict: PASS`, `claimedSha == <sha40>` and `pinned: true`, **or** an `.override.json` exists for a record with that `claimedSha`;
  - the profile has `gate: true`.
  
  Otherwise it exits 1 (2 if it cannot read).
  - B's QA-dispatch path calls the gate and refuses on non-zero.
  - QA is **pinned to that SHA**, not to the branch, so a push after PASS cannot change what QA tests.
- **Claims outside listed rooms.** Claude Code dev seats (A2A's Lathe "READY to Relay"; any SIA seat switched to `dispatch.claude_code {via:"session"}`) and `--peer` rooms are invisible to `--watch`. They can reach QA only after the planner runs `--submit` on the reply. **Hub-room watching covers Cursor seats in listed rooms only. The gate covers every channel.**
- **Override.**
  - The command is `ready-verify --override … --reason <text>`. It is refused (exit 1, nothing written) unless `--as` is in the profile's `planners` or is `aaron`, and its key resolves.
  - It writes `<turn>.override.json {who, reason, at, recordVerdict}`.
  - **The gate, the dashboard and D's measurement read files only.** A `VERIFY … OVERRIDE` or `VERIFY … PASS` line in a room, from anyone, changes nothing.
- **Deterministic:** everything in C3–C8 and the gate. The same reply, remote state, CI state and profile always give the same verdict and codes.
- **A human or a planner still decides:**
  - what to do with a FAIL (re-dispatch, roll the seat, D's fresh chat);
  - whether to OVERRIDE a CANNOT_CHECK during an outage;
  - when to raise `post` and `gate` for a repo (a profile PR);
  - whether a SURVIVED mutant or an `existing` row is acceptable (QA).

#### C10. What C does NOT judge

- Whether the fix is correct, complete or the right task. **That is QA's job.**
- Whether a test asserts the right thing beyond the placeholder patterns, or whether a mutant is meaningful.
- Base check 4 (each mutant is red on its rows) at the developer stage: recorded `not-checked` until `--stage qa`.
- Anything in `run:` lines or in `evidence:`, since local commands are unverifiable.
- Whether a failure labelled "unrelated" is really unrelated.

#### C11. Rollout per repo

- **The rule.** A repo lands its profile with `post: "none"`, `gate: false` (**shadow mode**) before its watch starts. It goes to `post: "fail"`, `gate: true` in one profile PR, only after B carries the C3 grammar in the required block and the waker and mdc use `--say-file`.
  - Until then, devs see the grammar only through planner prompts, the channel that decays, and today's 7/8-character SHAs would FAIL every claim.
  - The shadow-mode pass rate is D's baseline.
- **A2A** (the watch for Relay):
  - Profile:
    - `pr: "optional"`, since A2A merges through PRs (#386–#389);
    - `ci: {kind:"none"}`, since A2A has no CI (`.agents/roles/developer.md:46-70`);
    - `mutants: {kind:"unregistered"}` until one JSON registry shared by dev and QA exists (path to confirm). Loop 18's ids differ between `docs/loops/loop-18-mutants.md` and `l18-qa-job.md:22-30`.
  - `seats` is inline (rivet and its room).
  - Update the `## READY` templates (`docs/loops/rivet-dispatch-*.md`) and `planner.md:55` to C3. Multi-branch READYs (CHAIN-LOWS) post one block per branch.
  - Change `logic.mjs:259` to `--say-file`.
- **SIA** (the watch for Atlas):
  - Profile:
    - `seats: {file:".agents/SYSTEM/hub-partner-seats.json", role:"developer"}`;
    - `pr: "required"`;
    - `ci: {kind:"gh", file:"ci.yml", job:"test"}`;
    - `mutants: {kind:"branches", sameTree:["open-brain/src"], required:true}`.
  - One `refPattern` must be chosen: today 401 refs mix `loop/<t>-mut-<id>`, `-mutant-<name>` and `qa/…-mut-`.
  - `testGlobs` and `testDecl` are to confirm.
  - The C3 grammar goes into `developer.md` `## Building checks`, so it travels through A and B.
  - `hub-room.mdc:14` moves to `--say-file`. Line 18 keeps `TASK:` and gains the claim form `TASK: <id> <phase>, FROZEN <sha40> (<branch>)`.
  - Whether SIA's dashboard TASK-line parse (T-235) accepts that form is to confirm.
- **agent-dashboard** (the watch for clark's chisel rooms):
  - Add `.agents/SYSTEM/verify-profile.json` (the directory does not exist yet) with `ci: {kind:"none"}` (master has no `.github/workflows`) and inline `seats`.
  - `mutants: registry` needs a committed JSON export of `MUTANTS` (mechanism to confirm).
  - `loop-15-brief.md:55-59` and chisel's pipe line move to C3.
  - clark sees results through planner-watch: A2A's copy, armed with an exact-command allow-rule added to `~/Worktrees/.claude/settings.local.json`, which has none today. Later the dashboard `verify fail`/`verify stale` rules (t017/t018) do it.
- **Record correction:** `hoh-checklist.md:470` ("B + C … in SIA scripts/") contradicts the design doc (lines 6-7). The code lives in A2A.

#### Acceptance for C

- **Harness.** QA reproduces each row on temp bare repos, a stub hub (a node http server for register, heartbeat, `GET messages`, `POST message`, `GET session`) and a gh shim via `VERIFY_GH`, on Windows and on one Linux host.
- **Evidence.** A2A has no CI, so the evidence is the pasted `vitest` command and its exit code.
- **Not here.** FB- and FD- rows belong to sections B and D.

| # | Check |
|---|---|
| FC-1 | A complete C3 reply (SHA = remote tip, `new` rows declared in the diff, profile `ci none`, registry ids at SHA) gives exit 0 and `<turn>.json` PASS. With `post: fail` nothing is posted; with `post: all` the post is `VERIFY <n> PASS <sha8>` |
| FC-2 | A bare `READY L18 r3` (real r3) is classified as a claim and gives FAIL `parse` |
| FC-3 | An 8-character SHA in L1 gives `sha-short` |
| FC-4 | A 40-hex non-object (real r2 `8f3c1a2e…`) gives `sha-missing` |
| FC-5 | The tip moves after READY → `tip-mismatch`. A pasted `ls-remote:` SHA that differs from L1 → `paste-mismatch` |
| FC-6 | A name present only on another branch (real r1 `ce26f456` rows) → `test-missing`. Only in a comment → `test-not-decl`. Declared with `it.skip(` → `test-not-decl`. A `new` row whose declaration is already on the merge-base → `row-preexisting` |
| FC-7 | An added `expect(true)` or `.only(` → `placeholder`. The same text already on the merge-base is not flagged |
| FC-8 | `truncated` for each of: no END, an END SHA that differs from L1, text after END, a reply cut mid-table |
| FC-9 | The fea0e6d9 reply, reshaped with its pasted output under `evidence:` and a `\| Condition \| Test name \|` header plus `\|---\|` separator, gives PASS. An unknown line outside `evidence:` gives `parse` |
| FC-10 | `TASK: T-235 P2-7 r2 FROZEN <sha40>` and `TASK: T-235 P2-7, FROZEN <sha40> (loop/x)` both parse. A `(ref)` that differs from `branch:` gives `branch-conflict` |
| FC-11 | Claims are found in lowercase `frozen` and in a READY on line 3. `NOT READY yet` → no-claim. `pushed 3dfa2424, CI green` → `undeclared-claim`, not posted. Planner, `-waker` and unlisted-sender turns → exit 4, no record |
| FC-12 | CI green only on an older SHA → `ci-missing`. A different `headSha` → `ci-sha`. A run whose name is `CI` matches by workflow id. Job `test` skipped → `ci-skipped`. `in_progress` → PENDING, then after 30 min CANNOT_CHECK `ci-pending`. Completing at minute 4 → PASS |
| FC-13 | PR `headRefOid` ≠ SHA → `pr-head`. `pr: none` under `required` → `pr-missing`. A PR given under `optional` is still checked |
| FC-14 | Registry: an id only on master's registry → `mutant-unknown`. An entry file matching `testGlobs` → `mutant-test-file`. A `from` absent at `<sha>:<file>` → `mutant-retarget`. `mutants: none` under `required` → `mutants-missing` |
| FC-15 | Branches: two commits → `mutant-shape`. A different parent with a different `open-brain/src` tree → `mutant-retarget`. A diff touching a test file → `mutant-test-file`. Ref `-`, or a ref not matching `refPattern` → `mutant-unknown` |
| FC-16 | `unregistered`: a claimed product file matching `testGlobs` → `mutant-test-file`; one absent at SHA → `mutant-file`; otherwise PASS with C6.5/7/8 `not-checked` |
| FC-17 | A candidate that sets `placeholders: []` in its own profile is still checked against master's profile. No profile on master → exit 2 `profile-missing` |
| FC-18 | Each of these gives exit 2, a CANNOT_CHECK record and the post `cannot-check:<code>`: hub 500, unreachable remote, gh unauthenticated, `HUB_URL` unset, internal deadline |
| FC-19 | Two watch instances and one READY → one final record and one post; the other exits 4. Killing the run mid-check and restarting → CANNOT_CHECK `verifier-died` and a post, never PASS, and the gate exits 1 |
| FC-20 | A READY posted while the watch is down, then read by the planner (unread 0), is verified on the next start. Enabling with `--baseline now` on a room with 100 old READYs writes and posts nothing. No baseline → exit 2 `baseline-missing` |
| FC-21 | Two READYs on one repo at the same moment both reach a verdict (mirror lock) |
| FC-22 | After any run, `a2a-hub-talk-<me>-<sid>.after` and the read marks are unchanged. The only room write is the one VERIFY turn (plus hub-talk's register/heartbeat) |
| FC-23 | Test names `--output=x` and `$(touch pwned)` create no file, are treated as literals, and give `test-missing`. The post contains no reply text |
| FC-24 | A third FAIL for the same seat:task with `failPostCap: 2` → no post, `post: capped`, a job-verify log written |
| FC-25 | Gate: no record, FAIL, PENDING, PASS for another SHA, an unpinned PASS, or `gate: false` → exit 1. A matching pinned PASS or OVERRIDE → exit 0 |
| FC-26 | `--override` as a non-planner seat → exit 1, nothing written. As a planner → `.override.json` written and gate 0. A dev-posted `VERIFY 146 OVERRIDE …` room line changes no file |
| FC-27 | `bindDispatch: true`: task or branch ≠ the latest planner `TASK:` turn → `task-mismatch` / `branch-mismatch`. The seat's own `TASK:` lines are ignored |
| FC-28 | Watch stopped for 3 min → planner-watch prints `VERIFY STALE`. Its command line is unchanged (allow-rule string equality) |
| FC-29 | `urgent: joblog` → FAIL writes `job-verify-<seat>-<turn>.log` ending `VERDICT: FAIL`; PASS writes none; key absent → `--watch` exit 2 `sink-missing`. The dashboard firing URGENT once is checked only on a t015-deployed dashboard |
| FC-30 | hub-talk post rc 3 → `post: "failed rc=3"`, verdict unchanged |
| FC-31 | `VERIFY_GH=["<node>","shim.mjs"]` runs without a shell on Windows |
| FC-32 | A profile blob change between two records prints `VERIFY PROFILE <old8>-><new8>` |
| FC-33 | `--submit` of a reply gives a `submit/<sha>/` record, and the gate honours it |

**Mutant rows.** Each is a product edit to `scripts/ready-verify.mjs`, `scripts/verify/*` or `scripts/planner-watch.mjs` (never to a test) that turns the named row red, red-first.

| # | Mutant | Row turned red |
|---|---|---|
| FC-M1 | L1 accepts `[0-9a-f]{7,}` | FC-3 |
| FC-M2 | the `ls-remote` tip compare is skipped (`cat-file` only) | FC-5 |
| FC-M3 | `git grep` runs on `refs/heads/<default>`, not `<sha>` | FC-6 |
| FC-M4 | CI read with `gh run list --branch`; job conclusion not checked | FC-12 |
| FC-M5 | profile read from `<sha>` | FC-17 |
| FC-M6 | a catch-all maps errors to PASS | FC-18 |
| FC-M7 | END check removed | FC-8 |
| FC-M8 | registry read from the default branch | FC-14 |
| FC-M9 | `testGlobs` test on mutant files removed | FC-14, FC-15 |
| FC-M10 | record opened with `w`, not `wx` | FC-19 |
| FC-M11 | turns read via `hub-talk --inbox` | FC-22 |
| FC-M12 | placeholder scan over the whole tree, not added lines | FC-7 |
| FC-M13 | `execFile(…, {shell:true})` | FC-23 |
| FC-M14 | trigger back to `^(TASK:\s*)?(\S+\s+){0,2}(READY\|FROZEN)\b`, case-sensitive | FC-10, FC-11 |
| FC-M15 | "owned" exits 0, and planner-watch trusts the exit code | FC-19 |
| FC-M16 | catch-up uses unread instead of `hw` | FC-20 |
| FC-M17 | gate ignores the `claimedSha` equality | FC-25 |
| FC-M18 | `mutants.required` ignored | FC-14 |
| FC-M19 | `testDeclExclude` dropped | FC-6 |
| FC-M20 | post cap removed | FC-24 |
| FC-M21 | override accepted from any `--as` | FC-26 |
| FC-M22 | mirror lock removed | FC-21 |
| FC-M23 | baseline ignored | FC-20 |
| FC-M24 | `ci-skipped` treated as success | FC-12 |


### B, the dispatch gate (fleet: clark)

- **What it fixes.** Today a planner writes every TASK turn by hand. The evidence rules (A2A D-026/D-061, SIA D-060) reach a developer seat only if the planner remembers to paste them.
- **What B does.** The tool writes the rules into every work turn, and every room that has a developer seat refuses work turns that did not come through the tool.
- **What B does not do.** B guarantees that the rules are delivered. It does not enforce them: the waker hands the turn to the seat "quoted as data" (`scripts/waker/logic.mjs:268-273`). C enforces, so B is not done until C's verifier gates acceptance.
- **Order:** B lands after C, because it appends C's reply grammar. **Owner:** clark. **Code:** A2A-Hub, after the Loop 18 freeze. (`hoh-checklist.md:470` said "SIA scripts/"; line 471 supersedes it with A2A.)

**B1. Where the code lives (A2A-Hub)**
- `scripts/dispatch-gate.mjs` is the CLI. It is a wrapper, not a hub-talk flag, because hub-talk cannot be imported: it parses argv and calls `process.exit` at load, and it runs `main()` at `scripts/hub-talk.mjs:794`. The gate spawns hub-talk with `--say-file -` and maps its exit code (B8).
- `scripts/dispatch/` holds the modules:
  - `pointer.mjs` reads the per-repo pointer (B2).
  - `rooms.mjs` reads the gated-room registry (B3).
  - `block.mjs` and `brief.mjs` apply B5 and B6.
  - `compose.mjs` builds the stamp (B7).
  - `stamp.mjs` parses and verifies a stamp, holds the info-prefix and work-word lists, and is shared by hub-talk, the scanner, the hub and D.
  - `gate-scan.mjs` is the detector (B9b).
  - `gated-rooms.json` is the registry (B3).
- **Reused helpers:** `resolveKey`/`hubId` (`scripts/hub-key.mjs`), `RC_*`/`decodeBody` (`scripts/hub-exit.mjs`), `INBOX_ADVANCE_CAP`/`withTurns`/`maxTurn` (`scripts/hub-cursor.mjs`).
- **Reply grammar:** C writes it in A2A. The gate appends that file verbatim and keeps no copy of its own. The path is *to confirm*.
- **Pinned install.** Today each planner runs whatever hub-talk copy it finds. Atlas, for example, runs Relay's worktree copy (`sia-planner/.claude/settings.local.json:8`), and the QA PC runs a frozen waker copy (`start-waker.ps1:5`). B fixes this with one release directory per machine, `~/.a2a-hub/tools-v<ver>-<sha8>/scripts/`, made the same way as the waker copy. Planner talk lines and allow-rules point there. A QA PC install needs the D-049 P3 notice. *To confirm with Relay.*
- **Tests** live in `tests/dispatch-*.test.ts`. They run the real CLI as a child process against a temp bare origin plus a clone, and use the stub hub (`node:http`, the same pattern as `tests/hub-talk.exitcodes.cli.test.ts`). Each test name starts with its FB id.

**B2. Per-repo pointer: `.agents/SYSTEM/required-block.json`**
- The pointer file has the same name and shape in every repo:
  ```json
  {"path": ".agents/roles/developer.md", "heading": "## Building checks", "testPaths": ["(^|/)(tests?|__tests__)/", "\\.(test|spec)\\."]}
  ```
- It is **not** `hub-partner-seats.json`. SIA's open-brain reads that path in every project (`sync/hub-seats.ts:25,75-107`, `session-start/seat-map.ts:6`, `hub-presence.ts:10`, `focus.ts:26`). A minimal copy would make SIA's `/sync` fail in A2A and the dashboard: "present but worktree-seats.json is not" (`hub-seats.ts:92`) and "talk line must name hub-talk" (`:107`).
- SIA's A3 changes to "name the block in `required-block.json`". *To confirm with Atlas.*
- `testPaths` is the one test-path definition. B (B6 mutant rows) and C (mutants must target non-test files) both use it.

**B3. Gated rooms: the registry, keyed by recipient**
- `scripts/dispatch/gated-rooms.json` maps each developer room to its seat:
  ```json
  {"<roomId>": {"seat": "<hub_name>", "waker": "<hub_name>-waker", "repo": "<origin, normalised>"}}
  ```
- The guard applies to any sender, not to a list of dispatchers. A new or renamed planner, or clark posting into chisel's room, is covered automatically.
- **Exempt from the guard:**
  - the seat and its waker;
  - control turns (`parseControlTurn`, `scripts/waker/logic.mjs:3,31`);
  - info turns. An info turn's first line, after the sender prefix is removed, starts with the dashboard's info set (`ack`, `FYI`, `Status check`, `LEVEL`, `USAGE`, `QA START/END`; `agent-dashboard src/dispatch.js:13-15`). It must also contain none of the work words in `stamp.mjs`: `TASK\s*:`, `DISPATCH`, `re-?brief`, `brief\s*:`, `YOUR JOB`, `NOT ACCEPTED`, `\bowed\b`, `\bBUILD\b`, `RULINGS?`.
- **Every other turn needs a valid stamp**, whether `kind=dispatch` or `kind=follow` (B7). That covers the real rework and ruling turns:
  - `BUILD CHECK on READY L18 ce26f456: NOT ACCEPTED. r2 owed.` (a2a-planner scratchpad `rivet-l18r2.txt:1`)
  - `TASK from Relay (planner).` (`rivet-fresh-l18.txt:1`)
  - `RULINGS from Relay` (`rivet-r2.txt:1`)
  - `atlas → forge (...). DISPATCH: T-200` (sia-planner scratchpad `forge-inbox.txt:3`)
  - `TASK: T-168 PLAN RESEND` (`builder-inbox.txt:275`)
- **Initial rows:**
  - SIA's three Cursor rooms, from `hub-partner-seats.json` `seats.*.dispatch.cursor.room`: builder `k575sfwr…`, forge `k571z4gh…`, infra `k57d92gq…`.
  - The rooms for rivet and chisel are *to confirm*.
- A room is added only once its repo has `required-block.json` on its default branch (B12).

**B4. CLI**
```
HUB_URL=<hub> node <tools>/scripts/dispatch-gate.mjs --as <me> --to <seat> --session <room> \
  --repo-dir <clone> --task <id> [--round <N>] --phase <WORD> --title "<one line>" \
  --kind dispatch --branch <dev branch> --base <remote ref> [--base-sha <sha40>] --brief <file> [--dry-run]
... --kind follow --ref <dispatch-id> --body <file> [--dry-run]
```
- **Seat, room and repo must agree with the registry:**
  - `--to` and `--session` must match one `gated-rooms.json` row, else `room-mismatch`; an unknown seat gives `seat-unknown`.
  - `git -C <repo-dir> remote get-url origin`, normalised, must equal the row's `repo`, else `repo-mismatch`.
- **The gate always posts with `--session`.** It never uses `--peer` and never falls back to the newest room (`hub-talk.mjs:423-457`).
- **Phase:** `--phase` matches `^[A-Z][A-Z0-9+-]*$` and is chosen by the planner (BUILD, PLAN, RULED, RESEND, CONTINUE, MEASURE…).
- **Kind** decides the rules and D's behaviour:
  - `dispatch` needs a full brief (B6) and starts a fresh chat under D.
  - `follow` needs a `--ref` to a dispatch already in the room and resumes the chat.
- **`--task`** matches `^[A-Z]+-?[A-Za-z0-9.-]+$`, else `bad-task-id`.
- **`--dry-run`** runs every check, prints the turn, writes a `DRY` result and posts nothing.
- **Reading the hub:** the gate uses only a plain `GET /a2a/session/<id>/messages?after=N`. It never uses `--inbox`/`--wait` and never moves a cursor (`hub-talk.mjs:72-76`).

**B5. Remote truth and the required block**
- `git -C <repo-dir> fetch origin`, then `git ls-remote --symref origin HEAD refs/heads/<base>`.
- **Base:**
  - the base SHA is that tip, all 40 characters;
  - the ref is missing → `base-not-remote`;
  - `--base-sha` differs from the tip → `base-mismatch`;
  - `--branch` is the default branch → `branch-is-default`.
- **Policy** comes from the **remote default-branch tip**, not from the base the planner picked. The planner chooses where the work starts; the rules come from master.
  - Pointer: `git show <default tip>:.agents/SYSTEM/required-block.json`. Missing file, missing key, or JSON that does not parse → `no-required-block-config`.
  - Block: `git show <default tip>:<path>`, from the line equal to `heading` up to the next heading of the same or a higher level. Heading absent → `required-block-missing`; empty → `required-block-empty`.
  - `\r\n` is turned into `\n` in the block. `git show` prints the raw blob, so this is needed only when the blob itself holds CRLF.
- **Typed blocks:** a brief or body that contains `--- REQUIRED BLOCK` or `--- REPLY GRAMMAR` → `typed-block`. The planner never types the block.

**B6. Brief rules (`kind=dispatch`, deterministic part)**
- The brief is UTF-8 Markdown (else `bad-utf8`) with fixed headings.
- **`## Goal`:** at least one line that still has 4 words or more after paths, URLs, `#n` refs and the words `see|read|per|follow|in full` are removed. Else `no-goal`.
- **`## Acceptance`:** a table with the header `| id | condition | file |`. The header row and the `|---|` row are skipped. At least one data row is required, else `no-acceptance`.
  - `id` matches `^[A-Z][A-Z0-9]*-?\d+[a-z]?$` and is unique, else `dup-row-id`.
  - `condition` has at least 4 words and contains no path (a token with `/` or `\`), no URL and no `#n`. Else `acceptance-pointer`. So `Implement R1-R7 and A1-A8 from docs/loops/loop-18-brief.md` is refused, and `Check that ls-remote equals the claimed SHA` passes.
  - `file` is a product path that exists at the base (`git cat-file -e`), or `new:<path>`. Else `row-file-missing`. At least one row must name an existing file.
- **`## Mutants`** (optional) has rows `| id | product file | row id |`:
  - the row id must exist in Acceptance, else `mutant-row-unknown`;
  - the file must exist at the base, else `mutant-file-missing`;
  - the file must not match `testPaths`, else `mutant-test-file`.
- **`## Context` / `## Stop`:** free text. Pointers are allowed here, but they never count toward Goal or Acceptance.
- **Size:** the whole composed turn must be ≤ `INBOX_ADVANCE_CAP` (20,000 bytes), else `too-large`.
- **Follow turns:** the body is free text with the same typed-block and size rules, and `--ref` must resolve (B7).

**B7. The posted turn and its stamp**
- Line 1 is the one-line room post, in the shape SIA seats and the dashboard already read (`.cursor/rules/hub-room.mdc:18`, `src/dispatch.js:6`).
- **Dispatch turn:**
  ```
  TASK: <task> r<N> <PHASE>, <title> (<branch>)
  dispatch: <dispatch-id> kind=dispatch
  repo: <origin>  branch: <branch>  base: <ref> <sha40>  policy: <default ref> <sha40> blob <blob40>
  seat: <to>  room: <sessionId>  gate: dispatch-gate <A2A version> grammar sha256:<12>
  <brief, verbatim>
  --- REQUIRED BLOCK (dispatch-gate; generated) ---  ...  --- END REQUIRED BLOCK ---
  --- REPLY GRAMMAR (C) ---  ...  --- END REPLY GRAMMAR ---
  END TASK <dispatch-id> kind=dispatch sha256=<hex of every byte above, LF, UTF-8>
  ```
- **Follow turn:** line 1, then `dispatch: <ref> kind=follow`, the `seat/room/gate` line, the body, the REPLY GRAMMAR (always attached, so every request for READY carries it) and `END TASK <ref> kind=follow sha256=…`. It has no required block: the chat it resumes already holds it.
- **`dispatch-id`** = `<task>-r<N>-` plus 12 hex characters of sha256 over (brief with LF line endings + base SHA + policy blob + room). The id is bound to its room.
- **Resolving `--ref`:** a plain GET of the room must find a valid `kind=dispatch` stamp with that id and the same `room:`. Else `ref-unknown`.
- **The stamp checks integrity, not identity.** Anyone can recompute the hash. The scanner (B9b) re-derives the content, and the hub (B9c) is the check a sender cannot skip.
- **For C:** repo, branch and base come from the newest dispatch stamp in the room.
- **For D:** a valid `kind=dispatch` stamp on an owed, allow-listed turn means a fresh chat; `kind=follow` means resume. The waker uses only `stamp.mjs` and needs no list of dispatchers. The case of a `follow` whose ref is not the chat's current dispatch is left to D.

**B8. Exit codes, result file, settling a send**
- **Exit codes** keep hub-talk's meanings (`hub-talk.mjs:16-33`):
  - `0`: posted, or `--dry-run` passed.
  - `1`: any refusal; a git error that is not network-class (bad `--repo-dir`, no origin, unknown ref, auth); or hub-talk rc 1.
  - `3`: a network-class git failure (stderr matches `Could not resolve host|Connection (timed out|refused|reset)|Failed to connect|RPC failed|early EOF`; *patterns to confirm on Windows git*), or hub-talk rc 3. Nothing is posted.
  - Never `2`.
- **On refusal:** stderr prints one `[dispatch-gate] REFUSED <code> <detail>` line per failed rule. The gate evaluates every rule before it stops. The last line is `[dispatch-gate] REFUSED <id|-> reasons=<code,...>`.
- **Result file:** local, kept by the tool, not git-tracked. Path: `~/.a2a-hub/dispatch/<hubId>/<room>/<dispatch-id>.<kind>.<n>.json`.
  - It is created with `wx` (exclusive create), with `n` the next free number, and is never rewritten.
  - Fields: `{dispatchId, kind, ref, task, round, phase, from, to, room, repo, branch, base, policy, blockBlob, grammarSha, status, reasons[], turn, sent, at}`.
  - The gate also appends one line per run to `gate.jsonl` in the same `<hubId>` directory.
- **Status:**
  - `SENT`: hub-talk printed `sent turn N`, or `sent=yes`.
  - `NOT-SENT`: `sent=no`.
  - `UNKNOWN`: `sent=unknown`.
  - Also `REFUSED` and `DRY`.
- **Settling a send** (no `--resend` flag):
  - Before posting a dispatch, if an earlier `<id>.dispatch.*` result is `UNKNOWN`, the gate does one plain GET after its baseline and looks for `END TASK <id> kind=dispatch`.
  - Found → it writes `SENT` and stops with rc 1 `already-sent`.
  - Absent → it posts.
  - The GET fails → rc 3.
  - An earlier `SENT` → rc 1 `already-sent`.
- **A refusal posts nothing to the seat's room.** Any allow-listed turn wakes the waker (`logic.mjs:89-99`). The planner sees the refusal through rc 1 and stderr.

**B9. Guards: three layers, each failing closed**
- **B9a. hub-talk** (the check goes between body decode and key resolution, `hub-talk.mjs:225-227`). It applies to `--say` and `--say-file` alike.
  - A `--session` room in `gated-rooms.json`, a sender that is not exempt, and no valid stamp → rc 1 `[hub-talk] refused: work turn into a gated room without a dispatch-gate stamp`. No request is sent.
  - A stamp whose `room:` ≠ `--session` → rc 1 `stamp-misrouted`.
  - A stamped turn sent with `--peer` → rc 1.
  - A missing or unparseable registry → every turn that is not info is refused (`no-gated-registry`).
  - This catches only callers that run a current copy, so B9b and B9c are required.
- **B9b. Scanner** (`scripts/dispatch/gate-scan.mjs`). It runs as a scheduled task, not inside a planner session; host *to confirm*.
  - Every 60 s it reads each gated room with a plain GET (no X-Hub-Poll-Intent). Owner read access comes from `src/rooms.ts:60-91`; which key it uses is *to confirm*.
  - It writes one `scan-<turn>.json` per room:turn with `wx`, so a turn is reported once even across overlapping instances.
  - It prints `GATE OK|BYPASS|FORGED|MISROUTED|REPLAY|STALE|UNVERIFIABLE <from> room <id8> turn <n>: <reason>`:
    - `BYPASS`: a turn that is not exempt and has no valid stamp.
    - `FORGED`: the block is not byte-equal to the policy blob, or the grammar sha differs.
    - `MISROUTED`: `room:`/`seat:` ≠ the actual room or its seat.
    - `REPLAY`: a dispatch-id seen twice in the room.
    - `STALE`: the policy blob ≠ the current default-tip blob at first sight.
    - `UNVERIFIABLE`: the stamp does not parse, or the repo has no local clone in `~/.a2a-hub/dispatch/repos.json` (`{origin: localDir}`). An unparseable stamp counts as `BYPASS`.
  - **Heartbeat:** every scan writes `scan.heartbeat.json`. `gate-scan --health` prints `DETECTOR STALE <age>s` with rc 1 when the heartbeat is older than 300 s.
  - **On the dashboard:** the agent pushes a `dispatch` results field, the same route as C's `verify` field. Rules:
    - any GATE result other than OK → URGENT;
    - `gate detector stale` → URGENT;
    - `dispatch refused` → ALERT.
    - Each fires once per room:turn, seeded so it does not fire again on restart (`seedStanding`).
    - This is a G-row for t017 or t018, *to confirm*. It does not use the `jobLogDirs` `VERDICT:` hack.
- **B9c. Hub** (`src/rooms.ts:235-265`, next to `denyNamedAsk`). The same rule as B9a, enforced on the server. This is the only layer a raw POST or an old copy cannot get around.
  - Required, scheduled by Relay after the freeze.
  - The gated set should live on the hub (for example a `gated` flag per session that the owner sets), not in a repo tree. Shape *to confirm with Relay*.

**B10. Fail closed.** The following refuse with rc 1 and post nothing:
- any rule that cannot be evaluated;
- a brief or body that cannot be read;
- a git error;
- JSON that does not parse;
- a missing grammar file (`no-grammar`);
- a missing or unparseable registry.

The scanner reports a stamp it cannot parse, or a repo it cannot verify, as URGENT. A heartbeat that has gone silent is URGENT too.

**B11. What is deterministic, and what a human decides**
- **Deterministic:**
  - base and branch checked against the remote;
  - policy read from the default tip;
  - seat, room and repo checked against the registry;
  - the block byte-equal to its blob;
  - the grammar present;
  - the structure of B6;
  - size, stamp and ref;
  - all three guards;
  - exit codes and result files.
- **A human still decides:**
  - whether the brief really stands on its own (B6 is a floor);
  - whether the Acceptance rows are the right rows;
  - seat, base, round, phase and kind (dispatch or follow);
  - each repo's block (a PR in that repo);
  - which rooms are gated;
  - whether a GATE result was legitimate.

**B12. Rollout**
- **A2A (Relay):**
  - PR 1 (code, after the freeze; Aaron's merge word): the gate, `scripts/dispatch/*`, tests, `required-block.json` → `developer.md` `## Building checks` (lines 46-70 at `8fb45687`).
  - PR 2 (code): B9a plus `gated-rooms.json` with rivet's room, the scanner task and the pinned install.
  - Then `planner.md:55-70` changes to "dispatch through the gate", and the rivet `## READY` templates move to C's grammar.
  - PR 3: B9c.
- **SIA (Atlas):**
  - Add `required-block.json` (A3 amended).
  - Then SIA's three rooms join `gated-rooms.json` and Atlas's allow-rule for the gate is added in the same step.
  - The `TASK:` reply lines seats use (`hub-room.mdc:18`) stay as they are.
- **agent-dashboard (clark):**
  - Add `.agents/roles/developer.md` `## Building checks`, built from `docs/loop-15-brief.md:55-59` and the `scripts/mutants.mjs` registry rules, plus `required-block.json`. Docs-only PR.
  - Then chisel's room joins the registry.
  - Add the B9b dashboard rules.

**Acceptance for B** (QA reproduces each on a temp bare origin plus clone and the stub hub)

| # | Check |
|---|---|
| FB1 | A valid dispatch → rc 0 and exactly one new stub turn. Line 1 matches `^TASK: T-9 r1 BUILD, .+ \(loop/x\)$`. The block equals the section at the default tip, and `blob` = `git rev-parse <tip>:<path>`. The END sha256 recomputes. The result file says `SENT`, with `turn` = the stub's turn |
| FB2 | `--dry-run` twice → byte-identical stdout, nothing posted, `DRY` result |
| FB3 | With `core.autocrlf=false` and no `.gitattributes`, commit a `developer.md` whose blob holds `\r` (`git cat-file -p <tip>:<path> \| grep -c $'\r'` > 0) → the block has no `\r` and equals the LF text |
| FB4 | The section edited on the pushed `--base` branch, and edited uncommitted in the working tree → the turn carries the default-tip text both times |
| FB5 | `--base nope` → `base-not-remote`. An unpushed `--base-sha` → `base-mismatch`. `--branch` = the default → `branch-is-default`. The stub turn count is unchanged |
| FB6 | `--to rivet` with forge's room → `room-mismatch`. rivet with the SIA clone as `--repo-dir` → `repo-mismatch`. An unknown `--to` → `seat-unknown` |
| FB7 | Pointer missing, key missing, heading absent, or section empty → `no-required-block-config` / `required-block-missing` / `required-block-empty`; nothing posted |
| FB8 | A brief or body containing `--- REQUIRED BLOCK` or `--- REPLY GRAMMAR` → `typed-block` |
| FB9 | No Acceptance, or header-only → `no-acceptance`. A condition `Implement R1-R7 and A1-A8 from docs/loops/loop-18-brief.md` → `acceptance-pointer`. `Check that ls-remote equals the claimed SHA` is accepted. A repeated id → `dup-row-id`. A file absent at the base with no `new:` → `row-file-missing` |
| FB10 | A mutant row on `tests/x.test.ts` or `src/a.spec.ts` → `mutant-test-file`. An unknown row → `mutant-row-unknown`. An absent path → `mutant-file-missing` |
| FB11 | A composed turn over 20,000 bytes → `too-large` |
| FB12 | A brief with three faults → rc 1, and the last line lists all three codes |
| FB13 | (a) The stub stores the turn and the GET works → `sent=yes` → `SENT`; a rerun → `already-sent`. (b) The stub does not store and answers 503 → `NOT-SENT`; a rerun posts. (c) The stub stores, answers 503, and the GET fails → `UNKNOWN`; a rerun with the GET working → `SENT` plus `already-sent`, no second turn |
| FB14 | An unreachable origin host → rc 3, nothing posted. A missing `--repo-dir` or no origin → rc 1 `git-error` |
| FB15 | `--kind follow --ref <FB1 id>` → posted with `kind=follow`, the grammar and no block; no B6 sections needed. An unknown ref, or a ref from another room → `ref-unknown` |
| FB16 | B9a, relay into a gated room, each of `BUILD CHECK on READY L18 ce26f456: NOT ACCEPTED. r2 owed.`, `TASK from Relay (planner).`, `RULINGS from Relay`, `atlas → forge (SIA planner). DISPATCH: T-200`, `TASK: T-168 PLAN RESEND`, and the same from an unlisted sender `newplanner` → rc 1, no request reaches the stub. `ack FROZEN f8eb9638` → rc 0. `FYI r2 owed` → rc 1. `CANCEL` from an allow-listed sender → rc 0. rivet's own `TASK: L18 READY …` → rc 0. An ungated room → rc 0. FB1's dry-run output through `--say-file` → rc 0. One byte changed in it → rc 1. A stamp with another `room:` → rc 1 `stamp-misrouted` |
| FB17 | `gated-rooms.json` missing or unparseable → every turn that is not info is refused with rc 1 `no-gated-registry` |
| FB18 | Scanner, two instances started together. An unstamped raw POST → `GATE BYPASS` printed once, one `scan-<turn>.json`. Block edited and hash recomputed → `FORGED`. A valid stamp copied to another gated room → `MISROUTED`. The same id twice → `REPLAY`. The default tip moved after compose → `STALE`. A repo not in `repos.json` → `UNVERIFIABLE` |
| FB19 | Scanner stopped for 301 s → `gate-scan --health` prints `DETECTOR STALE` with rc 1 |
| FB20 | Every refused run posts nothing and writes one `REFUSED` result holding every reason code |
| FB21 | B9c (after the freeze; real hub): an unstamped raw POST into a gated room → 4xx and turn count unchanged. A valid stamp → 200. The seat's own turn → 200 |
| FB-M1 | Mutant: block read at `--base` instead of the default tip → FB4 red |
| FB-M2 | Mutant: block read from the working tree → FB4 red |
| FB-M3 | Mutant: `ls-remote` skipped (a local commit is accepted) → FB5 red |
| FB-M4 | Mutant: CRLF normalisation removed → FB3 red |
| FB-M5 | Mutant: registry tie removed in `rooms.mjs` → FB6 red |
| FB-M6 | Mutant: no pointer, so the gate sends without a block → FB7 red |
| FB-M7 | Mutant: the path/URL/`#n` rule removed from `brief.mjs` → FB9 red |
| FB-M8 | Mutant: header and separator rows not skipped → FB1 red |
| FB-M9 | Mutant: `typed-block` check removed → FB8 red |
| FB-M10 | Mutant: the gate stops at the first failed rule → FB12 red |
| FB-M11 | Mutant: the settle GET skipped (UNKNOWN reposts) → FB13c red |
| FB-M12 | Mutant: every git error mapped to rc 3 → FB14 red |
| FB-M13 | Mutant: B9a keys on first-line `TASK:` from a sender list → FB16 red |
| FB-M14 | Mutant: B9a checks `--say` only → FB16 red |
| FB-M15 | Mutant: B9a fails open when the registry is missing → FB17 red |
| FB-M16 | Mutant: the END hash leaves out the block → FB16 (one byte) and FB18 (FORGED) red |
| FB-M17 | Mutant: scan file written with a plain write instead of `wx` → FB18 red |
| FB-M18 | Mutant: scanner skips the room/seat comparison → FB18 MISROUTED red |
| FB-M19 | Mutant: `--ref` not checked against the room → FB15 red |
| FB-M20 | Mutant: `testPaths` default drops `.spec.` → FB10 red |

Each mutant is a product edit in `scripts/dispatch/*` or `scripts/hub-talk.mjs` on its own branch. It is registered in the A2A mutant registry C defines (*to confirm*). Its red run's command and failing lines are pasted, per A2A `developer.md` Building checks; A2A has no CI.


### D, a fresh Cursor chat for every TASK turn (fleet: clark)

**Decision (Aaron + clark, 2026-10-08):**
- A Cursor developer seat gets a **new chat for every TASK turn**. A turn that follows up on the current task resumes that chat.
- Rooms and chat history are kept. Nothing is ever deleted.
- A new room per loop is optional (D6).
- D is judged by C's pass rate (D9).

**Read on A2A-Hub `origin/master` 7bbd94e1.** Nothing under `scripts/` has changed since 8fb45687. Every line reference below was checked on this commit.

**What exists today:**
- **Pin and config.** The pin is `wakeChatId` in `~/.a2a-hub/wake-config/<seat>.json` (`docs/installing-a-seat-waker.md:38-54`). The seat config is loaded once (`scripts/seat-waker.mjs:80`). `resolveWakerConfig` re-reads the config file on every poll, but only `model` is taken from it (`:453-464`). One waker serves one room (`:135`).
- **Resume.** A wake runs `cmd.exe /c agent.cmd -p -f --model <m> --resume <pin>` (`scripts/waker/resume.mjs:23-27`).
- **Birth is the only way a new chat is made.**
  - `createWakeChat` runs `execFileSync` with **no timeout** (`birth.mjs:20-38`).
  - Birth happens only when `pinStatus` returns `"birth"` (`birth.mjs:48-53`; `seat-waker.mjs:654-713`).
  - `recordBirth` deletes `allowRebirth` (`birth.mjs:65-71`).
  - The next run is `/start` (`seat-waker.mjs:793-794`).
- **The /start run can mark a turn delivered.** A `/start` run's finalize sets `dlv` to the owed turn if the seat posted anything during it (`seat-waker.mjs:572-577`). The waker's startup text says "there is nothing to post for it" (`logic.mjs:251-257`). SIA's always-apply rule says the opposite: "run the `talk` line with `--inbox` before other work. An unread atlas turn is the assignment" (`.cursor/rules/hub-room.mdc:9-11`).
- **Long turns are dropped quietly.** A turn longer than `WAKE_TURN_MAX_CHARS` (default 7000, `config.mjs:60`) is skipped with `dlv=N`, and only an informational alarm is raised (`seat-waker.mjs:784-791`).
- **Layer 1 and Layer 2 watch only the pinned id.** Layer 1 is `scanChainForChatId(seatCfg.wakeChatId)` (`seat-waker.mjs:445`; `guard.mjs:67`). Layer 2 is `readUpdatedAtMs(…, wakeChatId)` (`:555`).
- **create-chat failures stay counted.** After 3 failures, with backoff of 2 s then 4 s (`:169-172`), the seat parks in `create_chat_failed`. The count is reset only by a model change, and only after a model refusal (`:454-457`).
- **No TASK: handling.** Nothing parses `TASK:`. Rework rounds already start with `TASK:` (`docs/loops/rivet-dispatch-t095-t096-r3.md:1`, `-t099-r2.md:1`, `-chain-lows-r2.md:1`).
- **The bare prefix is not reliable.** In SIA, new work went out without `TASK:` (builder-inbox s160, lines 3 `DISPATCH:`, 109 `RULED: your next item`, 169 `P2-3 plan RULED, build it`). Follow-ups went out with it (186 `TASK: CONTINUE T-235 P2-3`, 233 `TASK: T-235 P2-5 RULED, BUILD`). **D therefore keys on B's header grammar, not on the bare prefix.**

#### D1. The trigger: B's header line, checked at the receiver

- B stamps the first line of every planner turn to a developer seat. D reads only that line:
  - `TASK: <id> NEW …`: a new task. The waker **rotates**.
  - `TASK: <id> ROUND <n> …`: a rework round. The waker **rotates** (open question 1).
  - `FOLLOWUP <id> …`: resume the current chat. This covers addenda, HEAVY booking replies, answers and rulings.
  - `<id>` is one token, `[A-Za-z0-9][A-Za-z0-9._/-]*`. Phase-level ids are written joined, e.g. `T-235/P2-5`.
- `classifyTurn(content)` lives in a new pure module, `scripts/waker/rotate.mjs`.
  - It strips one BOM and then leading whitespace and blank lines (CR and LF both count).
  - The match is case-sensitive and anchored at the start of the first line. It returns `{kind: task|round|followup|untagged, id}`.
- The check runs **only on the owed turn** (`selectOwed`, `logic.mjs:89-99`). The seat's own turns, `<seat>-waker` notes and senders off the allow-list are never owed. So SIA's own status line, `TASK: <id> <phase>…` (`hub-room.mdc:18`), cannot cause a rotation. Control turns (`logic.mjs:3,31-36`) never do either.
- **The receiver fails closed when `rotateOnTask` is on.** These turns are **refused, not delivered**:
  - `untagged`;
  - `FOLLOWUP` whose id differs from `taskChat.task`;
  - `FOLLOWUP` with no `taskChat`.

  On a refusal:
  - `dlv` moves past the turn, so the queue does not wedge.
  - The waker posts the required note `WAKER <seat> REFUSED turn=<N> reason=untagged|followup_other_task|followup_no_task` (D4).
  - The waker raises the informational alarm with the same reason.
  - The planner re-posts the turn with the right header.

  A raw POST or a plain `hub-talk --say` cannot get past this check.

#### D2. The required block, injected by the waker

- Each seat's config gains `requiredBlock: {path, heading}`.
  - SIA: `.agents/roles/developer.md` / `## Building checks`, copied from `hub-partner-seats.json` (A3).
  - A2A: `.agents/roles/developer.md` (Building checks, `:46-70`).
  - agent-dashboard: to confirm.
- On a `task` or `round` turn, before it spawns the run, the waker:
  1. runs `git -C <worktree> fetch origin master`, with a 30 s timeout;
  2. reads `git -C <worktree> show origin/master:<path>`;
  3. cuts the section from `heading` to the next heading of the same level.
- The section goes into the **fixed envelope**, between the reply instruction and the delimiter (`logic.mjs:243-276`), headed `[REQUIRED BLOCK, <path>@origin/master <blob8>, injected by the waker]`. It does not count toward the turn's 7000-character cap.
- **Fail closed.** If the fetch, the read or the section cut fails, or the section is empty, the waker raises `alarm`/`required_block_unavailable`. The turn **stays owed** and nothing is spawned.
- The blob SHA is written to the history line (D4), so C and D9 can tie a READY to the rules that seat saw.
- B still checks the turn's shape at the sender. D does not depend on B having run.

#### D3. Rotation: where, how, and the first run

- **Hook point.** In `pollOnce`, after the `turn_too_long` check (`:791`) and before `const startup = needsStartup` (`:793`). That point is reached only after:
  - `wakeGate` returns `wake`;
  - the Layer-1 scan is clear;
  - there is no `pendingFinalize`;
  - there is no live run.

  A turn over the cap is therefore skipped **before** any `create-chat`. When `rotateOnTask` is on, that skip also posts `WAKER <seat> REFUSED turn=<N> reason=turn_too_long chars=<n> max=<m>`.
- **Gate.** `rotationDue` is true when all of these hold:
  - `liveCfg.rotateOnTask === true`;
  - `WAKE_ROTATE !== "off"`;
  - `pinStatus === "pinned"`;
  - `kind` is `task` or `round`;
  - not `(taskChat.room === room && taskChat.turn >= owedN)`. This is the idempotence check.
- **Act, in this order:**
  1. Run `create-chat` **asynchronously** with a timeout of `WAKE_CREATE_CHAT_TIMEOUT_MS` (default 60 000). The poll loop keeps heartbeating meanwhile.
  2. Save `{wakeChatId, bornAt, startupDone:false, taskChat:{room, turn:N, task:id, kind, chatId, prev, at, noted:false}}` in **one atomic write**.
  3. Change the in-memory `seatCfg` **only after that save succeeds**.
  4. Append the history line (D4).
  5. Set `oweSnapshot = null`.
  6. Publish `owes_reply` and return.
- **No separate `/start` for a rotated chat.** `startup = needsStartup(seatCfg) && taskChat?.chatId !== seatCfg.wakeChatId`.
  - The first run in the new chat is the TASK turn itself: kind `turn`, plus the required block.
  - `bornAwaitingStartup` (`birth.mjs:60-62`) still lets the gate resume a chat with no `meta.json`.
  - When that run exits cleanly, the waker persists `startupDone:true`, extending the existing branch at `:898-904`.
  - This removes the `/start` race (`:572-577`) and the double delivery under SIA's `--inbox` rule.
- **Delivery waits for the room note.** N is not spawned while `taskChat.noted === false` (D4).
- **Not touched:**
  - `ctl` and `dlv`. `dlv` moves only after the reply to N (`:583-585`).
  - `allowRebirth`. The save patch has no such key. Do not call `recordBirth`.
  - A seat with no pin stays in `no_pin` (`:654-660`). A rotation replaces a pin and never creates one where there was none.
- **Atomic config.** `saveSeatConfig` (`config.mjs:39-49`, a plain `writeFileSync` today) becomes temp-then-rename with `state.mjs`'s retry (5 tries, 60 ms apart).
- **Rotation failures.**
  - The rotation keeps its own `rotateFails` counter, with backoff of 2 s then 4 s. The third failure raises `alarm`/`rotate_failed`.
  - The counter resets when the owed turn changes, or after `WAKE_ROTATE_RETRY_MS` (default 600 000).
  - N stays owed and is **never resumed in the old chat**.
  - Recovery is either fixing `agent.cmd` and waiting for the cool-down, or flipping `rotateOnTask:false`. That flip is an operator act: the next poll delivers N to the current pin, under a ROTATE-OFF note.
  - A model refusal keeps the existing `model_rejected` path (`:681-689`).
- **Old chats stay watched.** Layer 1 scans the pin **and** the `chat` ids of the last 3 history lines. A match on an old id blocks the wake and the rotation with `owes_reply`, `blockedBy: old_chat_open`.
- **T-104 comes first.** D's PR branches from a master that contains T-104's `selectOwed` fix (unmerged `origin/loop/t103` 5a96ce7b). Without that fix, a restart replays turns above `dlv` and would rotate on stale TASK turns.
- **Test seam.** `WAKE_TEST_ROTATE_FAIL=after-create|rename`. The waker logs `TEST SEAM ACTIVE` the way `WAKE_TEST_KILL_MODULE` does (`:262-266`).

#### D4. Outputs

- **History file:** `~/.a2a-hub/wake-config/<seat>.chats.jsonl`.
  - Append-only, never truncated.
  - Rotation line: `{"at","room","turn","task","kind","chat","prev","model","blockSha"}`.
  - Toggle line: `{"at","rotate":"on|off","reason"}`.
- **Room notes**, posted as `<seat>-waker` through `noteToRoom` (`:269-275`). The first token is always `WAKER`, so a note never parses as control, TASK or READY.
  - `WAKER <seat> ROTATE turn=<N> task=<id> kind=<task|round> chat=<new8> prev=<old8>`. This note is **required**. It is retried on every poll, and N is not spawned until it has posted (`taskChat.noted:true`). A hub outage holds delivery, which already needs the hub.
  - `WAKER <seat> REFUSED turn=<N> reason=<r>`. Also required: `dlv` moves past the turn only after this note has posted.
  - `WAKER <seat> ROTATE-ON|ROTATE-OFF reason=<text|none>`, posted on the first poll that sees `rotateOnTask` change.
  - Each note is a real turn. It counts against the room's 500-turn cap and shows as a NEW TURN in `planner-watch` (`planner-watch.mjs:57-64`).
- **Waker log:** `rotate chat=… prev=… turn=N task=…` and `refused turn=N reason=…` lines in `~/.a2a-hub/logs/waker-<seat>.log`.
- **New alarms:** `required_block_unavailable`, `rotate_failed`, `untagged`, `followup_other_task`, `followup_no_task`.
- **Exit codes:** none. The waker is a long-running process.

#### D5. Crash and partial-run behaviour (fail closed: a TASK turn never reaches the old chat)

| Crash point | Next start sees | Result |
|---|---|---|
| During `create-chat` | old pin, `dlv`<N | N still owed; rotation retried |
| After `create-chat`, before the save | old pin, `dlv`<N | one orphan chat, never deleted; retried; at most one orphan per crash |
| After the save, before the note | new pin, `noted:false` | no second `create-chat`; note posted; then N is delivered once |
| After the note, during N's run | as today (`pendingFinalize`) | `taskChat` blocks a re-rotation |
| `create-chat` hangs | | timeout counts as one failure; heartbeats continue |
| Rename fails | old config intact | N still owed; in-memory pin unchanged |

#### D6. Rooms: kept; a new room only per loop

- Keep the room unless the loop owner wants a clean one, or the room is near its cap. At the cap the waker refuses with `room_full` (`logic.mjs:20-25`).
- **New procedure.** No re-point procedure exists today.
  1. Send the D-049 P3 notice to **both** planners and get a GO from each. Ten minutes of silence means WAIT.
  2. Stop the waker: `Stop-ScheduledTask A2A-Waker-<seat>`, or stop the PID in `<worktree>\.cursor\waker.pid`. Then run `restart-waker.ps1 -Seat <seat> -Check` and read back `waker node: none`, `live run: none`.
  3. Back up `<seat>.json` and `<seat>.marks.json` as `.bak-<UTC>`.
  4. Create the room with a raw `POST /a2a/session {title, participants:[<planner>,<seat>,<seat>-waker], maxTurns:500}`, using the planner's key. The caller must be a participant (`src/rooms.ts:185-228`). `hub-talk --peer` makes a two-member room with no waker in it, so do not use it here.
  5. Edit `roomSessionId` only.
  6. Run `restart-waker.ps1 -Seat <seat>` **without** `-Dlv`. The marks start at the seat's latest own turn in the new room (`logic.mjs:51-55`).
  7. Read back:
     - `rooms[<new>]` in the marks file;
     - the `started` line in the waker log, with no room-fetch error;
     - presence: the seat and `<seat>-waker` online, `idle`.
- The old room is never deleted.

#### D7. Rollback and visibility

- **Per seat:** `rotateOnTask: true|false` in `<seat>.json`.
  - Absent means false, which is today's behaviour byte for byte.
  - It is read from `liveCfg` on every poll, so a flip needs no restart.
  - Every flip appends a history line and posts a ROTATE-ON or ROTATE-OFF note with `rotateReason` if one is set. A lapse is therefore visible in the room.
  - D9's report flags any seat whose rotation is off after its first ROTATE-ON.
- **Per machine:** `WAKE_ROTATE=off`, set in `start-waker.ps1`. A restart applies it.
- **Off means** the current pin is resumed and turns are not checked for headers. To go back to the pre-D chat, set `wakeChatId` to the earliest `prev` in the history file, with the waker stopped and backups taken.
- **`restart-waker.ps1` gains two checks:**
  - it also matches every `chat` in the last 3 history lines, not just the pin (today `:18`);
  - `-Dlv` refuses while `rotateOnTask` is true unless `-ConfirmedTurn <n>` is given.

#### D8. Windows QA PC (DESKTOP-O4EGB1E)

- The PC runs a frozen copy, `~/.a2a-hub/waker-v1.18.0-8baef929` (`start-waker.ps1:5`). D ships as a new copy, `waker-v<ver>-<sha8>`. Swapping copies needs the D-049 P3 notice and a GO from both planners.
- Every resume and every `create-chat` passes `--model`. Read `~/.cursor/cli-config.json` `model` before and after the first rotation (FD20).
- Chats pile up in `~/.cursor/chats` and are never pruned. Measure disk use per chat during the pilot.

#### D9. Measurement: C's pass rate on the first READY

- **Unit:** one B-stamped `task` or `round` turn N from an allow-listed planner. `task` and `round` are reported separately.
- **Window:** from N until the next B-stamped `task` or `round` turn **from a planner**. A seat's own turns never end the window.
- **First READY:** the first seat turn in the window that matches `/^(TASK:\s*\S.*?\b)?(READY|FROZEN)\b/i`.
  - C's verdict on that turn is the score.
  - A grammar reject, or no verdict, is **FAIL**.
  - `noReady` counts only windows with no match at all.
- **Arms:**
  - **before:** `rotateOnTask` off, with C and B live **and** A+E live for that repo.
  - **after:** tasks that have a ROTATE note for turn N. The note is required, so this record is complete.
- **N:** at least 20 per arm. A gap under about 30 points is noise; for a gap of 10-30 points, extend to 40 per arm. Pilot one seat (proposed: rivet) with the others as a concurrent control.
- **Tool:** `node scripts/dispatch-report.mjs --as <planner|owner> --session <id>[,<id>…] --results <C's result file> --since <iso> [--until <iso>] [--json]`.
  - It reads rooms with a plain `GET /a2a/session/:id/messages?after=0`, with no `X-Hub-Poll-Intent`. That moves no cursor and no read mark (hub-talk ruling `:72-76`).
  - It joins C's records on `(room, turn)` and prints `seat arm kind tasks firstReady PASS FAIL noReady rate`, plus seats with rotation off after ROTATE-ON.
  - Exit codes: 0 = report printed; 1 = usage error, no key, or an unreadable or unparseable result file; 3 = network/408/429/5xx (hub-talk's classes).
- **Secondary figures:** minutes from TASK to first READY; REFUSED notes per seat; `rotate_failed` and `required_block_unavailable` alarms.
- **Roll back immediately, without waiting for N:**
  - a task-kind turn delivered to the old chat, or delivered twice;
  - `rotate_failed` on two seats;
  - any change to `cli-config.json` `model`.

#### D10. Claude Code developer seats (lathe, scout)

- They have no waker; they are Remote Control sessions started by `launch-<seat>.sh`. Rolling one is Aaron's `/clear` + `/start` (`remote-roll-procedure.md`).
- **v1: they are not rotated.** D's pass-rate claim excludes them, and D9 reports them as a separate control group.
- A deterministic check, such as a PreToolUse hook that refuses a READY `--say` once the session has handled a second task id, is an open question.

#### Deterministic vs human

- **Deterministic:**
  - header classification and refusals;
  - required-block injection and its failure;
  - rotation, idempotence, timeout and counter;
  - the required notes;
  - the history file;
  - the Layer-1 scan of old ids;
  - the rollback read on every poll;
  - the report's arithmetic.
- **Human:**
  - turning `rotateOnTask` on per seat (operator edit, plus a D-049 P3 notice for any restart);
  - Relay's one-time ruling that a configured `rotateOnTask` is a standing re-birth;
  - creating a loop room;
  - whether a ROUND rotates;
  - the keep-or-rollback call after D9 (Aaron + clark).

#### Rollout per repo

- **A2A** (code, after the Loop 18 freeze, after T-104, and after C has collected the before-arm):
  - `scripts/waker/rotate.mjs` (new);
  - a hook in `scripts/seat-waker.mjs`;
  - `scripts/waker/config.mjs`: `rotateOnTask` and `requiredBlock`, plus the atomic save;
  - `scripts/waker/logic.mjs`: the envelope's required-block section;
  - `scripts/dispatch-report.mjs` (new);
  - `docs/loops/waker-ops/restart-waker.ps1` checks;
  - a rotation subsection in `docs/installing-a-seat-waker.md`;
  - tests in `tests/waker-rotate.test.ts` and `tests/dispatch-report.test.ts`, with a stub hub and a stub `agent.cmd`;
  - mutant ids D-m1 to D-m12 in A2A's mutant registry, the file C names (shape `{id, what, file, tests, from, to}`, as in agent-dashboard `scripts/mutants.mjs:12-35`).

  Then a QA PC frozen copy, then the pilot.
- **SIA:** no code.
  - forge and the other SIA Cursor seats set `rotateOnTask` and `requiredBlock` after the pilot.
  - Atlas's dispatches go through B (TASK/ROUND/FOLLOWUP headers).
  - `hub-room.mdc:9-11` keeps `--inbox`; it is harmless now that there is no `/start` run.
- **agent-dashboard:** no code for v1.
  - chisel opts in after the pilot, once its `requiredBlock` is named.
  - `src/dispatch.js:6` and `src/task.js:2` are unaffected.
  - Optional later: show ROTATE and REFUSED notes on the seat row.

#### Acceptance for D (QA reproduces each with a temp wake-config dir, a stub hub, a stub `agent.cmd` and a temp git remote)

| # | Check |
|---|---|
| FD1 | Pinned seat with `rotateOnTask:true`; planner turn N `TASK: T-1 NEW build`. The stub sees exactly one `create-chat`. The config has the new pin, `bornAt`, and `taskChat{turn:N,task:T-1}`. The room gains `WAKER <seat> ROTATE turn=N task=T-1 …`. The next run resumes the **new** id with turn N's text and the required block, with no `/start`. The history file has 1 line |
| FD2 | Turn N+1 `FOLLOWUP T-1 …` resumes the same new chat; no `create-chat` |
| FD3 | `TASK: T-2 NEW` as the first line of a turn from the seat itself, from `<seat>-waker` or from a sender off the allow-list: no rotation, no delivery |
| FD4 | Real fixtures from builder-inbox lines 3, 109 and 169 (untagged) and 186 (`TASK: CONTINUE …`, untagged under the grammar): each is not delivered, a REFUSED note is posted, and `dlv` moves past it only after the note |
| FD5 | `FOLLOWUP T-9` while `taskChat.task=T-1`: refused `followup_other_task`. `FOLLOWUP` with no `taskChat`: refused `followup_no_task` |
| FD6 | `TASK: T-1 ROUND 2` rotates; FD9's report counts it as `round` |
| FD7 | `rotateOnTask` absent or false: the argv sequence and the config and marks writes for any turn are byte-identical to master (snapshot) |
| FD8 | Setting `rotateOnTask:false` on disk while the waker runs: the next poll posts ROTATE-OFF, and the next TASK turn resumes the current pin, with no restart. Setting it back to true posts ROTATE-ON. The history file has both toggle lines |
| FD9 | `requiredBlock` path missing, heading absent, or fetch failing: `alarm`/`required_block_unavailable`, N still owed, no spawn. When present, the envelope holds the section byte for byte and the history line holds its blob SHA |
| FD10 | A stub seat that posts during the first run in a rotated chat: `dlv=N` after one run. A stub that runs `hub-talk --inbox` and does not post: N is delivered again only through the normal retry, never through a `/start` path; the total spawns for N are at most `maxWakeAttempts` |
| FD11 | Killed after the save, before the note: on restart there is no second `create-chat`; the note is posted; then N is delivered once, to the new chat |
| FD12 | `WAKE_TEST_ROTATE_FAIL=after-create`: old pin kept, `dlv` unchanged, N still owed; the retry makes one more chat; no chat is deleted |
| FD13 | `WAKE_TEST_ROTATE_FAIL=rename`: the on-disk config is intact, the in-memory pin is unchanged, N still owed |
| FD14 | `create-chat` fails 3 times: `alarm`/`rotate_failed`; N is **not** resumed in the old chat; `dlv` unchanged. After `WAKE_ROTATE_RETRY_MS` it is retried. A `create-chat` that hangs times out at `WAKE_CREATE_CHAT_TIMEOUT_MS`, and heartbeats continue meanwhile |
| FD15 | A seat with no pin and `bornAt` set gets a TASK turn: it stays `alarm`/`no_pin`, with no `create-chat`. A rotation on a pinned seat leaves an `allowRebirth` key unchanged on disk |
| FD16 | A TASK turn arrives during a live run or `pendingFinalize`: no rotation until that run is finalized |
| FD17 | A TASK turn of 7001 characters: no `create-chat`; a REFUSED `turn_too_long` note is posted; the turn is not delivered |
| FD18 | A live stub process with the `prev` chat id in its command line: `owes_reply`, `blockedBy: old_chat_open`; no rotation and no wake |
| FD19 | The note POST returns 503: N is not spawned until the note posts; the marks are byte-identical before and after `create-chat` |
| FD20 | Windows, QA PC, pilot seat, one real TASK turn: the history line, the ROTATE note, and `idle` after the reply. `cli-config.json` `model` is the same before and after. The marks file is read back |
| FD21 | `classifyTurn`: `﻿\r\n\r\nTASK: x NEW` rotates; `task: x NEW`, `RE: TASK: x NEW` and ` > TASK: x NEW` are `untagged`. `PAUSE` before a TASK turn blocks the rotation until `RESUME` |
| FD22 | `dispatch-report.mjs` on a stub room with 4 TASK windows:<br>• C PASS<br>• C FAIL<br>• a bare `READY L18 r3` with a grammar reject<br>• a READY with no verdict<br>plus 1 window with no READY, and a seat's own `TASK: T-1 PLAN` inside a window. It prints `PASS 1 FAIL 3 noReady 1`, and the seat's turn does not end the window. A bad result file exits 1; a stub 503 exits 3. The cursor file and read marks are unchanged. **Blocked until C fixes its result record** |
| FD23 | `restart-waker.ps1 -Check` lists a live run on a `prev` chat id. `-Dlv` refuses while `rotateOnTask` is true unless `-ConfirmedTurn` is given |
| FD24 | Mutants, red-first on their own branches, each with the run's command and exit code. Each turns its named row red:<br>• D-m1: rotate on `FOLLOWUP` → FD2<br>• D-m2: deliver untagged turns → FD4<br>• D-m3: drop the `taskChat` check → FD11<br>• D-m4: write `dlv=N` at rotation → FD19<br>• D-m5: fall back to the old pin on `create-chat` failure → FD14<br>• D-m6: treat absent `rotateOnTask` as true → FD7<br>• D-m7: rotate on `no_pin` → FD15<br>• D-m8: read `rotateOnTask` only at start → FD8<br>• D-m9: spawn `/start` in a rotated chat → FD1<br>• D-m10: deliver N before the note posts → FD19<br>• D-m11: spawn without the required block when the read fails → FD9<br>• D-m12: report counts a grammar reject as `noReady` → FD22<br>Each id resolves in A2A's registry at the candidate SHA and targets a non-test file |

