# QA 251: T-164 + T-211 round 2, the narrow re-check of QA 249's F1 to F5 (report)

**By:** QA seat, record session 251, headless Claude Code (Opus 5.5) on Linux, Node v22.22.1, 2026-10-02.
**Dispatch:** `docs/loops/qa-251-t164-t211-r2-dispatch.md` at `62807f255bd6b9e34f7be7c466e38e4973a74cd1`
(`git -C ~/qa-scratch/qa251-wt log -1 --format=%H` → `62807f255bd6b9e34f7be7c466e38e4973a74cd1`).
**Ruling re-checked:** D-095 on QA 249 (`origin/qa/t164-t211-report` `0c891c82`).

**Candidates** (resolved with `git rev-parse`; both branch heads read back equal to them):

| | Round 2 (candidate) | Round 1 | Branch |
| --- | --- | --- | --- |
| T-164 | `892f7644b48cb49b56dc821406f35a84ca28369a` | `fbf94ae63dcd49c37b96a113e9c5a1f389077b0e` | `origin/loop/t164-port` (PR #270) |
| T-211 | `3b0b8188976a97abe42d899300730bd1112b2d97` | `9f6fcea4abf42c1a98219aec639be5d6f10f63ed` | `origin/loop/t211-standing-cron` (PR #272) |

**Bases:** round 2 sits on `f7ac983d4face4a88f5af9742cc91a54c01e3f4f`. Round 1 sat on `bea385b2` (`git merge-base fbf94ae6 f7ac983d`).
**Trees** (all detached): `~/qa-scratch/qa251-wt` (dispatch, then the report branch), `qa251-t164`, `qa251-t211`,
`qa251-r1-t164`, `qa251-r1-t211`.

## Verdicts

- **T-164 `892f7644`: ACCEPT.** F1 is fixed. One `max(n)+1` function serves both the greeting and the refusal.
  QA 249's own SC-2 test, copied unchanged, fails at `fbf94ae6` and passes at `892f7644`.
- **T-211 `3b0b8188`: ACCEPT.** F2 and F3: each QA 249 mutant now turns one row red. F4: the template's example
  prints the present-shape line once its two placeholders are filled. Read literally, it does not, and row 5 below
  sets out that reading. F5: the handoff names SR-6, and SR-5a turns SR-6 red.
- **Pair: ACCEPT.**

## Rows

| # | Row | Result |
| --- | --- | --- |
| 1 | Confined | **met**: every changed file traces to the rebase, F1 to F5, or the handoff |
| 2 | F1 in the code | **met**: `nextFreeSessionNumber` is gone; both sites call `nextSessionNumber` = max(n)+1 |
| 3 | F1 red then green | **met**: QA 249's test fails at `fbf94ae6`, passes at `892f7644` |
| 4 | F2 and F3 | **met**: mutant (a) turns SR-2b red; mutant (b) turns SR-4 red |
| 5 | F4 | **met, with a note**: present-shape with the placeholders filled; the literal unfilled text prints INVALID (N1) |
| 6 | F5 | **met**: SR-5a turns SR-6 red, as the handoff now says |
| 7 | Nothing else moved | **met**: touched tests 15/15; neighbours 98/98; `tsc --noEmit` 0 at both heads |
| 8 | CI on the heads | **met**: 4 runs, all success, none cancelled |

### 1. Confined

`git range-diff bea385b2..9f6fcea4 f7ac983d..3b0b8188`: all six round-1 commits are `=`, which means their patches
are identical after the rebase. Three commits are new:

- `892f7644` (F1): `session-log.ts`, `state-schema.ts`, `state-writer.ts`, `record-session-number.test.ts`.
- `df430553` (F2, F3, F4): `standing-cron.test.ts`, `project-template/.agents/AGENT.md`.
- `3b0b8188` (handoff): `docs/loops/t164-t211-r2-developer-handoff.md`, plus `docs/loops/t211-developer-handoff.md`.
  That second file changes one line, the SR-5 row, which is the F5 correction.

`git diff fbf94ae6 892f7644 --stat`: 58 files. `git diff 9f6fcea4 3b0b8188 --stat`: 62 files. The master movement
is `git diff bea385b2 f7ac983d --stat`, 54 files:

- `.agents/` state and views, `CHANGELOG.md`, `README.md`, `package.json`.
- Under `docs/loops/`: the slice-4 records, the QA 248, 249 and 250 artefacts, the Jev calibration files, and the
  T-221, T-222 and r2 dispatches.

None of the 54 overlaps a candidate file, and none is under `open-brain/` or `project-template/`.

- 58 = 54 + the 4 files of `892f7644`.
- 62 = 54 + 4 + 2 + 2.

**No file is unaccounted for.**

### 2. F1, read in the code (`892f7644`)

`git grep -n "nextFreeSessionNumber" 892f7644 -- open-brain/src open-brain/tests` prints nothing. **The function is
gone, with no callers.** `git grep -n "nextSessionNumber\b"` over the same paths:

```
open-brain/src/pipelines/session-start/session-log.ts:3:import { nextSessionNumber } from "../../shared/state-schema.js";
open-brain/src/pipelines/session-start/session-log.ts:19:    return { sessionNumber: nextSessionNumber(stateJson.data.sessions), source: "record" };
open-brain/src/shared/state-schema.ts:368:export function nextSessionNumber(sessions: readonly Pick<SessionRecord, "n">[]): number {
open-brain/src/shared/state-writer.ts:34:  nextSessionNumber,
open-brain/src/shared/state-writer.ts:267:      const free = nextSessionNumber(next.sessions);
```

- **Greeting**, `session-log.ts:19` in `nextGreetingSessionNumber`:
  `return { sessionNumber: nextSessionNumber(stateJson.data.sessions), source: "record" };`
- **SC-2 refusal**, `state-writer.ts:267` in `applyStateOps`: `const free = nextSessionNumber(next.sessions);`. The
  next line puts it into `` `…; next free number is ${free}` ``.
- **The function**, `state-schema.ts:368-370`:
  `return sessions.length === 0 ? 1 : Math.max(...sessions.map((s) => s.n)) + 1;`. That is `max(n)+1`, and 1 for an
  empty record.

### 3. F1, red then green

I copied `docs/loops/qa-249/tests/qa249-t164.test.ts` from `origin/qa/t164-t211-report` with `git show … >` into
`open-brain/tests/qa249/` in both T-164 trees. `git hash-object` gives `1ba635fe…` for both copies, the same as the
original blob.

- **At `892f7644`:** `qa249-t164.test.ts` **3 passed**. Its live case greets `Session #156` and reuses the log on a
  second `ob_start`.
- **At `fbf94ae6`:** **1 failed and 2 passed.** The failure is
  `record shaped like the live one (76, 147..155) … the refusal names 157`:
  `expected 'session number 156 is already recorded for uuid aaaaaaaa-0000-4000-8000-000000000249; next free number is 1' to contain 'next free number is 157'`
  (`qa249-t164.test.ts:79`). **Red at round 1.**

The candidate's own `record-session-number.test.ts`:

- At `892f7644`: **7 passed**.
- At `fbf94ae6`, round 1's own copy: **6 passed**, because the new case is not in it.
- Round 2's copy run against round-1 code: 1 failed and 6 passed. The failure is the new sparse-record case:
  `expected 'session number 155 is already recorded for uuid cccccccc-…-000000000155; next free number is 1' to contain 'next free number is 156'`.
  I restored the file afterwards with `git checkout --`.

### 4. F2 and F3 (`3b0b8188`)

The baseline is `standing-cron.test.ts`, **8 passed**. I applied each mutant alone with `git apply`, ran the file,
and restored it with `git checkout --`. `git status` was clean after each.

- **(a) `qa249-a-status-to-only-no-shadow.diff`**: 1 failed and 7 passed. The red row is **SR-2b**,
  `a local file carrying ONLY status_to still wins over a full AGENT.md, and is INVALID`, at
  `standing-cron.test.ts:53`:
  `expect(readStandingCron(root)).toBe("Standing cron: INVALID in .agents/AGENT.local.md: status_cron is missing")`.
  It received `Standing cron: 7,37 * * * * → status to clark (rule: docs/rule.md). …`.
- **(b) `qa249-b-minute-accepts-60.diff`**: 1 failed and 7 passed. The red row is **SR-4**, at
  `standing-cron.test.ts:77`:
  `expect(readStandingCron(root)).toBe('Standing cron: INVALID in .agents/AGENT.local.md: status_cron minute field "60" is out of range 0-59')`.
  It received `Standing cron: 60 * * * * → status to relay-a2a (rule: .agents/roles/planner.md). …`.

### 5. F4

**The documented example at `3b0b8188`**, from `project-template/.agents/AGENT.md`, lines 26-32:

````
```
status_cron: "*/20 * * * *"
status_to: <agent-name>
status_rule: .agents/roles/<role>.md
```

`status_cron` is a 5-field cron in local time, `status_to` is the agent the status goes to, and `status_rule` is a
repo-relative path to the rule text. Write each value alone on its line: the reader does not strip a trailing `# comment`.
````

I wrote a probe, `docs/loops/qa-251/tests/qa251-f4.test.ts`, and ran it from `open-brain/tests/qa251/`. It reads the
template file **at run time** with the same fence regex, so it is not a copy. It writes the block, byte for byte,
into the frontmatter of a scratch `AGENT.local.md` under `~/qa-tmp`, then calls the start-time reader,
`readStandingCron`.

- **Placeholders filled, every other byte from the file:**
  `Standing cron: */20 * * * * → status to clark (rule: .agents/roles/planner.md). Create it with CronCreate before the briefing ends.`
  This is **the present-shape line, not INVALID.** QA 249's F4 was written about this case. With the placeholders
  left in, the reader stops at the missing `status_to` before it looks at the cron, so QA 249's "11 fields" can only
  have come from a filled copy.
- **Same probe at round 1, `9f6fcea4`:**
  `Standing cron: INVALID in .agents/AGENT.local.md: status_cron has 11 fields, expected 5`. **Red at round 1**, and
  it matches QA 249's F4 exactly.
- **Literally verbatim, `<agent-name>` and `<role>` left in:**
  `Standing cron: INVALID in .agents/AGENT.local.md: status_to is missing`, at both rounds. The cause is
  `readStatusKeys` (`agent-identity.ts:128`), which skips any value that starts with `<`. That is the same
  placeholder rule `parseDeclaration` applies to `name:` and `role:` (line 51), so an unfilled template value counts
  as unset. See **N1**.
- The template file itself, used as a seat's `AGENT.md`, gives `Standing cron: none in seat data.`. The example sits
  in the body, not the frontmatter.

**The test that guards this reads the template file itself.** It is SR-7, at `standing-cron.test.ts:107-118`:

```ts
const template = readFileSync(join(import.meta.dirname, "../../../../project-template/.agents/AGENT.md"), "utf-8");
const block = template.match(/```\n(status_cron:[\s\S]*?)```/);
...
const example = block![1]!.replace("<agent-name>", "clark").replace("<role>", "planner").split("\n").filter((l) => l.trim() !== "");
```

The only difference between the test's input and the file is the placeholder fill. My filled probe gives the same
result. The developer's handoff discloses the fill. Putting a `# comment` back inside the fence would turn SR-7 red,
because the file is read at test time.

**Ruling basis.** I read row 5 as "the documented example works when used as documented". Angle brackets mark a
placeholder throughout this template (`name: <AgentName>`), and the reader treats them as unset on purpose. On that
reading row 5 is met. A strictly literal reading, with the placeholders left in and expected to give the
present-shape line, is not met. If the planner holds that reading, it overturns T-211's ACCEPT, and N1 is the fix.

### 6. F5

The SR-5 row in `docs/loops/t211-developer-handoff.md` at `3b0b8188` now reads:
`5a (line dropped) goes red on **SR-6** only (SR-1, SR-2 call readStandingCron directly); 5b on SR-1, SR-2, SR-4, SR-4b (QA 249 F5, corrected in round 2)`.
The round-2 handoff's F5 bullet says the same.

I applied `docs/loops/t211/mutants/sr5a-line-dropped.diff` to `3b0b8188`. It changes only `open-brain/src/server.ts`,
2 lines out and 1 in. Result: 1 failed and 7 passed.

- The red row is **SR-6**: `expected [] to deeply equal [ 'Standing cron: none in seat data.' ]`.
- All of SR-1, SR-2, SR-2b, SR-3, SR-4, SR-4b and SR-7 stay green.

The tree was restored and `git status` was clean.

### 7. Nothing else moved

The round-2 diff touches two test files: `record-session-number.test.ts` and `standing-cron.test.ts`.

- At `892f7644`: `record-session-number` **7 passed**.
- At `3b0b8188`: `record-session-number` plus `standing-cron`, **15 passed** (7 + 8), 2 files.
- I also ran the neighbours of the changed source at `3b0b8188`, which was not required: `state-writer` (46),
  `server` (30), `session-log` (9), `agent-identity` (6), `start-parity` (4), `template-seed` (3). That is **98
  passed, 0 failed**.
- `npx tsc --noEmit` in `open-brain/` exits **0** at `892f7644` and at `3b0b8188`. In both trees the only extra file
  was QA's untracked probe directory.

I did not run the full suite, because the job class is LIGHT. CI ran it, see row 8.

### 8. CI on the heads (read only)

`gh run list --commit` returns two runs per head, all on workflow `CI`:

| Head | Run | Event | Conclusion | `test` job |
| --- | --- | --- | --- | --- |
| `892f7644` | 36976283947 | push | success | success (07:01:17 to 07:05:08) |
| `892f7644` | 36976289271 | pull_request | success | success (4m7s; I watched it to completion with `gh run watch --exit-status`) |
| `3b0b8188` | 36976284517 | push | success | success (07:03:15 to 07:07:18) |
| `3b0b8188` | 36976288445 | pull_request | success | success (07:05:09 to 07:09:14) |

In every run, `changed` is success and `test-windows` is skipped. **No run was cancelled.**

The heads do not carry T-221 themselves. They sit on `f7ac983d`, and `.github/workflows/ci.yml` at `3b0b8188` still
uses the group `ci-{head_ref || ref_name}`. Master now has `ci-{event_name}-{…}`. The PR run is built from the merge
ref, so it uses master's per-event group, and the push run uses the branch's own file. The two groups therefore
differ, and that is why nothing was cancelled.

## Notes and findings

- **N1 (minor, not blocking; T-211).** If the template's example is copied with `<agent-name>` left in, the reader
  prints `INVALID … status_to is missing`. "Missing" is misleading, because the key is present and holds an unfilled
  placeholder. The template does not say the angle-bracket values must be replaced, although the convention is used
  throughout the file. Suggested fix, not applied: either the reason says `status_to is an unfilled placeholder`, or
  the template's sentence says to replace the `<…>` values.
- **N2 (process).** `TMPDIR` could not be set: the permission layer refused every env-prefixed command. Vitest
  fixtures from the candidates' own tests therefore went to `/tmp` (for example `/tmp/qa249-live-r6f5XZ`), and each
  was removed by its `afterEach`. QA's F4 probe writes under `~/qa-tmp` explicitly.
- **N3 (process).** `npm ci` printed an `allowScripts` warning for `better-sqlite3` and `esbuild` install scripts.
  Every test run passed regardless, so nothing depended on them.
- **Hygiene.** I wrote nothing outside `~/qa-scratch`, `~/qa-tmp` and those `/tmp` fixtures. I made no live
  `state.json`, DB or settings write and no Jev call. I used `gh` only to read CI. QA's test files stay uncommitted
  in the candidate scratch trees; the probe's copy is `docs/loops/qa-251/tests/qa251-f4.test.ts` on this branch.

## Verdict lines

- `QA-251 T-164 892f7644b48cb49b56dc821406f35a84ca28369a: ACCEPT`
- `QA-251 T-211 3b0b8188976a97abe42d899300730bd1112b2d97: ACCEPT` (row 5 on the "as documented" reading; N1 non-blocking)

QA-251: REPORT COMPLETE
