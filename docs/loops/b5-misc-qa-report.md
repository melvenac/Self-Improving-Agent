# QA 259, batch B5 report: #292 (T-224), #293 (T-223), #320 (T-228)

**By:** QA 259 (prefix `b5-misc`), record session 259, headless Claude Code on **Opus 5.5** (`claude-opus-5-5`),
2026-10-02. Job class LIGHT: touched test files only, one vitest file per invocation, no full suite, no live Jev call.

**Dispatch tree:** `git -C ~/qa-scratch/qa259-wt log -1 --format=%H` → `1579c786018a98dafe130ae2bdaa67c3af00919d`.
**`origin/master` at fetch:** `d11301ee58c497152c81a321048c1ee5e3447273`. It is two commits past the dispatch
(`734878a1` + merge `d11301ee`, #322), and both add only `docs/loops/builder-roll-handoff-addendum-2026-10-02.md`. The
base trees and the merge row use `d11301ee`.

**Merge authority:** the dispatch says B5 is NOT covered by Aaron's overnight pre-approval. The ACCEPT verdicts below
are QA verdicts. Merging still needs Aaron's word.

## Verdicts

| PR | Task | Pinned head | Verdict |
|---|---|---|---|
| #292 | T-224 placeholder reason + `\s` fix | `c77dce55677a71a4ede59bbab933adf3270f2c22` | **ACCEPT** |
| #293 | T-223 exact CI group strings | `58e0ce15eb5871c50eb01794c007a9a842fc5acb` | **ACCEPT** |
| #320 | T-228 hub-talk exit codes 0 to 3 | `c9b5e7571d0b02c822372d78ed102281e7415c8e` (code `e1ffa274`) | **ACCEPT** |
| batch | merge order #293, #292, #320 | scratch merge `49009b15a4c81a0df1425c47ecf1fb23fae7aafe` | **ACCEPT** |

Trees: heads in `~/qa-scratch/qa259-pr{292,293,320}`, master in `~/qa-scratch/qa259-base{292,293,320}`, and the merge in
`~/qa-scratch/qa259-merge` (local branch `qa/b5-misc-merge`, not pushed). Each test tree has its own `npm ci` of
`open-brain` (184 packages; install scripts not run). Every mutant was applied in a scratch tree only and restored with
`git checkout --`. `git status --short` was clean afterwards, and the clean file was re-run green.

## Row 1: Confined

`git diff --stat origin/master...<head>`:

- **#292** (merge-base `8b7aa952`, commits `4c2129d3`, `c77dce55`): `open-brain/src/pipelines/session-start/agent-identity.ts`
  (+22/−7), `open-brain/tests/pipelines/session-start/standing-cron.test.ts` (+40), `project-template/.agents/AGENT.md`
  (1 line). 3 files. Confined.
- **#293** (merge-base `9f6d20df`, one commit `58e0ce15`): `open-brain/tests/pipelines/sync/ci-runs-on.test.ts` (+21)
  only. `git diff origin/master 58e0ce15 -- .github` is empty, so `ci.yml` is unchanged. Confined.
- **#320** (merge-base `c0c710e4`, commits `e1ffa274`, `c9b5e757`): `.cursor/rules/hub-room.mdc`,
  `project-template/.cursor/rules/hub-room.mdc`, `project-template/.cursor/commands/start.md`,
  `docs/loops/cursor-start-differences.json`, the new `open-brain/tests/pipelines/sync/hub-talk-exit-codes.test.ts`, and
  the new `docs/loops/t228-developer-handoff.md`. 6 files. Confined.

## Row 2: Red then green

- **#292** `standing-cron.test.ts`: the head's test file was run against master's source (`qa259-base292`):
  **3 failed | 9 passed (12)**. SR-8 received `status_to is missing`. SR-8b received a valid line
  `*/20 * * * * → status to clark (rule: .agents/roles/<role>.md)…`. SR-8d (`<status>`) received `status_to is missing`.
  At the head: **12 passed (12)**.
- **#293** `ci-runs-on.test.ts`: this PR changes only a test. It re-pins master's existing `ci.yml`, so the new row is
  **green on master by construction**: the head test file against master's `ci.yml` gave **22 passed (22)**, and at the
  head **22 passed (22)**. To show the row has teeth, I ran it against the pre-#310 `ci.yml` (`770da4e4`, the T-221
  scheme): **9 failed | 13 passed (22)**. The T-223 row failed with `Expected "ci-pr-7"`, `Received
  "ci-pull_request-loop/x"`, and 8 of #310's own rows failed with it. Mutants M1 and M2 (row 6) give the red against the
  current scheme.
- **#320** `hub-talk-exit-codes.test.ts` on master: **5 failed | 1 passed (6)**. Only the identical-copies row passed,
  because the two `.mdc` files were already identical on master. This matches the developer's count. At the head:
  **6 passed (6)**.

## Row 3: Mutants (one of the developer's, one of mine)

| PR | Mutant | Who | Result |
|---|---|---|---|
| #292 | `PLACEHOLDER = /<[^<>s]+>/` (the round-1 regex, with the backslash lost) | developer (SR-8d is "red on `4c2129d3`") | **killed**: 1 failed \| 11 passed, SR-8d `<status>` received the valid line `→ status to <status>` |
| #292 | `PLACEHOLDER = /<[^<>]+>/` (whitespace no longer excluded) | QA | **killed**: 1 failed \| 11 passed, SR-8d prose `a < b > c` reported as `unfilled placeholder (< b >)` |
| #293 | M1, the PR group loses `pr-` (`format('ci-{0}', …number)`); this is also the developer's own case (commit message: "a PR group that lost its `pr-` prefix") | dispatch / developer | **killed**: T-223 row red (`Expected "ci-pr-7"`, `Received "ci-7"`), T-227 concurrency row **green**, 1 failed \| 21 passed |
| #293 | M2, the push group gains `pr-` (`format('ci-pr-{0}', github.sha)`) | dispatch / developer | **killed**: T-223 row red (`expected 'ci-pr-9f8e7d' to be 'ci-push-9f8e7d'`), T-227 row **green**, 1 failed \| 21 passed |
| #293 | dispatch group keyed by `github.sha` instead of `github.run_id` | QA | **killed**: 2 failed \| 20 passed (T-223 `Expected "ci-dispatch-11"`, `Received "ci-dispatch-0000000"`, and the T-227 row) |
| #320 | one word (`mutant`) appended to the codes line in `project-template/.cursor/commands/start.md` | developer | **killed**: `start-parity` 1 failed \| 10 passed ("is green on this tree"); new test 1 failed \| 5 passed (the cursor_only table row) |
| #320 | `doubling to 60 s` → `doubling to 30 s` in `project-template/.cursor/rules/hub-room.mdc` only | QA | **killed**: 2 failed \| 4 passed (that copy's contract row and the identical-copies row) |

The developer's round-1 T-223 mutant (M-push-only, from `session-157-builder-2-handoff.md`) targets the pre-#310
`ci-{event}-{ref}` scheme, which no longer exists. It does not apply to round 2, so M1 stands as the developer's case.

## Row 4: CI on the heads (read only)

`gh pr checks` and `gh run view --json headSha,event,conclusion`:

- **#292**: `test` **pass**. PR run **37003721961** (`pull_request`, headSha `c77dce55…`, success). There is also a push
  run **37003717431** (`push`, headSha `c77dce55…`, success). The branch's base predates #310's master-only push trigger,
  so it still got a push run. `changed` pass, `test-windows` skipping.
- **#293**: `test` **pass**. Run **37003859495** (`pull_request`, headSha `58e0ce15…`, success).
- **#320**: `test` **pass**. Run **37006678567** (`pull_request`, headSha `c9b5e757…`, success).

## Row 5: #292 specifics

- `grep -n "const PLACEHOLDER" agent-identity.ts | cat -A` at the head:
  `121:const PLACEHOLDER = /<[^<>\s]+>/;$`. It reads `/<[^<>\s]+>/` with the backslash present. **MET.**
- `<status>`, `<seat>` and `<sia-status-recipient>` (plus `<agent-name>`) are each named
  `status_to is an unfilled placeholder (<…>)`, in SR-8d (green). My no-`\s` mutant shows the assertion is live.
  **MET.**
- The prose `a < b > c` is not a placeholder. SR-8d asserts `→ status to a < b > c`, and my mutant turns it red.
  **MET.**
- An absent key and an empty key both still say `status_to is missing`, and a placeholder-only file still says
  `none in seat data`. This is SR-8c, green on both master and the head. **MET.**
- The template example is read at test time. SR-8's `templateExample()` reads
  `project-template/.agents/AGENT.md` with `readFileSync` and takes the fenced `status_cron:` block. The test asserts
  exactly `Standing cron: INVALID in .agents/AGENT.local.md: status_to is an unfilled placeholder (<agent-name>)`.
  It is green at the head and red on master. **MET.**

## Row 6: #293 specifics

- Master `ci.yml:56` `group:` is
  `github.event_name == 'pull_request' && format('ci-pr-{0}', github.event.pull_request.number) || (github.event_name == 'workflow_dispatch' && format('ci-dispatch-{0}', github.run_id) || format('ci-push-{0}', github.sha))`,
  which gives `ci-pr-<number>`, `ci-push-<sha>` and `ci-dispatch-<run_id>`. The new row asserts exactly
  `expect(pr("7")).toBe("ci-pr-7")`, `expect(push("9f8e7d")).toBe("ci-push-9f8e7d")` and
  `expect(dispatch("11")).toBe("ci-dispatch-11")`. **MET.**
- The same digits give three groups: `const same = [pr("7"), push("7"), dispatch("7")]; expect(new Set(same).size).toBe(3)`.
  The row also checks `pr("1") ≠ pr("11")`, `pr("7", sha abc123) ≠ push("abc123")`, and that two commits of one PR
  share a group. **MET.**
- M1 and M2 were applied to `ci.yml` in `qa259-pr293` only and then restored. Each turns the T-223 row red while #310's
  T-227 row (`concurrency is per PR; a master push and a dispatch never share a group…`) stays green (row 3). **MET.**

## Row 7: #320 specifics

- `git grep -n "wait-timeout 3500"` at the head finds 13 lines. Three are live instruction copies of the wait sentence,
  and all three carry rc 0 to 3: `.cursor/rules/hub-room.mdc:10`, `project-template/.cursor/rules/hub-room.mdc:10`, and
  `project-template/.cursor/commands/start.md:109` (whose codes are on line 111, the "next line"). The other hits are not
  wait rules a seat runs under:
  - `.agents/SYSTEM/hub-partner-seats.json:6` is a command token, not a sentence.
  - `docs/loops/cursor-qa-overlay.md:54` is in a file headed **RETIRED, 2026-09-27**.
  - `cal-a12-dispatch-qa.md`, `cal2-a12-dispatch-qa.md`, `planner-session-146-notes.md` and `session-147-dispatches.md`
    are historical dispatches and notes.
  - The `t228-developer-handoff.md` hits quote the old wording.

  The developer's handoff lists the same exclusions. **MET**, read as the three live copies.
- The codes are stated as: exit 0, a turn was printed, act on it; exit 1, refused or called wrong, fix the call and do
  not retry; exit 2, the window elapsed, wait again; exit 3, unavailable or throttled. **Caveat:** relay's table
  (A2A-Hub `docs/loops/loop-13-design-ruling.md` at `8e59f58`) is not in this repository or on this machine (a glob of
  `/home/agents` found no copy), so I could not compare against it directly. I checked against the dispatch's row 7 and
  T-228's INBOX line. The developer says the same: the wording is the dispatch's.
- rc 3's text in all three copies includes the stderr line
  `` `[hub-talk] retry status=<code|network> retry-after=<seconds|unknown>` `` verbatim, `wait `retry-after` seconds`,
  `back off 5 s doubling to 60 s`, and `after 5 consecutive exit-3 results over 2 minutes with no `retry-after`, stop and
  report`. All 16 required phrases are asserted in every copy (test rows 1 to 3, green). **MET.**
- The two `hub-room.mdc` files are byte-identical: `sha256sum` gives `e40c86a2082aa6fc004a198b0319b48d8634a29927ec439be571b73109a5888d`
  for both, and `cmp` exits 0. **MET.**
- At the head, each file run alone: `start-parity` **11 passed (11)**, `command-parity` **9 passed (9)**,
  `mirror-parity` **13 passed (13)**, `hub-seats` **5 passed (5)**, and `hub-talk-exit-codes` **6 passed (6)**. **MET.**
- `cursor-start-differences.json` (numstat `2 1`): a node comparison of master and the head shows `description` and
  `claude_only` unchanged. In `cursor_only`, exactly one entry was removed (the old Hub-room line,
  "Read `.agents/SYSTEM/hub-partner-seats.json`…, and again on exit 2…") and two were added: the reworded Hub-room line,
  and the new `` `hub-talk` exit codes `` line. The second entry is needed because the table waives complete lines only,
  and start.md now carries the codes on their own line. Both new entries are lines of the Hub-room section, and no other
  entry changed. **MET**, read as "only the hub-room entry is replaced, and it becomes two hub-room lines". If the planner
  meant strictly one-for-one, this is the only point to rule on.

## Row 8: Batch merge order

On local `qa/b5-misc-merge` from `origin/master` `d11301ee`, run `git merge --no-ff` in order:
`58e0ce15` (#293) → `e0f3b58a`, `c77dce55` (#292) → `462f9709`, `c9b5e757` (#320) → **`49009b15a4c81a0df1425c47ecf1fb23fae7aafe`**.
**No conflicts** (ort, all three clean).

On the merge, one file per invocation: `standing-cron` 12/12, `ci-runs-on` 22/22, `hub-talk-exit-codes` 6/6,
`start-parity` 11/11, `command-parity` 9/9, `mirror-parity` 13/13, `hub-seats` 5/5. `npx tsc --noEmit`: **exit 0**.

## Gaps and notes

- #293's red-first can only be shown against an older `ci.yml` and through mutants, because the PR pins existing
  behaviour. This is expected, not a defect.
- #320: relay's own table was not readable here (row 7 caveat). The `cursor_only` change is two-for-one (row 7).
- Config files: none were read. No live Jev call, and no state, DB or settings writes. `gh` was used for reads only.
- Secrets scan of this report and its `.E_t.json` before commit: no key or token patterns.

QA-259: REPORT COMPLETE
