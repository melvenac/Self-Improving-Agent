# T-252: BRIEFING-FIX follow-ups F1–F4 (grok re-review r2)

**Brief path:** `docs/loops/t252-briefing-followups-brief.md`. **By:** Atlas (planner), 2026-10-11. **Source:** `docs/loops/briefing-fix-review-r2.md` (grok-sia-review, delta
`19cb1e5f..3ded135d`, 0 blocking, 0 major; planner ruled F1–F4 go to a follow-up task). **Priority:** P2.
**Seat:** a desktop Cursor seat. Its name and hub room are the `SEAT:` and `ROOM:` lines of the dispatch turn; §12
uses them verbatim. **Size:** SMALL. **Written to** `~/Worktrees/cursor-brief-checklist.md`. **The base SHA in the
dispatch turn overrides §2's.**

## Why (planner, first-hand at `b142886f`)

All four findings were checked against `open-brain/src` at `b142886f875340913cc945399b1790167871fc08`. The line
numbers are at that SHA. Each finding still holds; the reviewer cited `3ded135`, and nothing has changed since.

| # | Where (at `b142886f`) | What happens today (reproduced on Node v22.23.2) |
|---|---|---|
| F1 | `pipelines/session-start/fleet.ts` lines 177–185, the cap loop in `buildFleet`. Line 181: `const namePart = names.length > 0 ? names.join(", ") : "none";` | A 190-char coordinator name with 2 matching seats prints `… · seats none +2 more (verified ?)`. "none" is wrong: there are seats, they just don't fit. |
| F2 | `fleet.ts` `fleetProjectKey`, the two loops at lines 72–76 and 77–81. Neither checks that `p` is an object. | `projects: [null]` throws `Cannot read properties of null (reading 'repo')` in loop 1 when `projectRoot` is a git repo, and `… (reading 'name')` in loop 2 when it is not (`repoName` is then `null`, and loop 1 short-circuits before reading `p.repo`). `describeFleet`'s catch (lines 197/214) then prints `FLEET: unavailable (…: invalid shape: …)`, which hides every seat. |
| F3 | `tests/pipelines/session-start/briefing-fix.test.ts` lines 420–435, BF-F7 | Its four bodies (`null`, `[]`, `{"seats":[{"name":"a"}]}`, `{"seats":"x"}`) are all stopped by `parseFleetRoot` or `normalizedSeats` before the catch. With the catch removed (old mutant 9), the file stays 20/20 green. |
| F4 | `server.ts` lines 439–447, the `fleet:` IIFE inside `handleStart`. Line 443: `const path = process.env.FLEET_JSON ?? "fleet.json";` | With `FLEET_JSON` unset, the fallback names `fleet.json`, not the path `describeFleet` actually reads, which is `fleetPath` (fleet.ts line 31): `join(homedir(), "Projects", "fleet", "fleet.json")`. |

| F2b (planner, same class) | `fleet.ts` `buildFleet` line 157, `const verified = data.verifiedAt ? new Date(data.verifiedAt) : null;`, and `verifiedStale` line 124, `new Date(verifiedAt)` | `{"verifiedAt":{"valueOf":0,"toString":0}}` is truthy, and both of its conversion methods are non-callable, so `new Date(...)` throws `TypeError: Cannot convert object to primitive value`. The catch then prints `FLEET: unavailable (<path>: invalid shape: Cannot convert object to primitive value)`, which hides every seat. The planner ruled that this gets guarded now (W5). |

**The F3 problem, and how this brief solves it.** At `b142886f`, `{"projects":[null]}` reaches the catch, but F2's
guard (W1) closes that route, and W5 closes the `verifiedAt` route. Any fleet.json body that reaches the catch is by
definition a missing guard. So catch coverage rests on a **type-cast seam that needs no production change**:
`describeFleet(root, null as unknown as string, …)` on a valid file with no `projects`. `fleetProjectKey` returns
`null`, then `projectSeats` line 114 runs `fleetKey.toLowerCase()` and throws
`Cannot read properties of null (reading 'toLowerCase')`. The catch prints
`FLEET: unavailable (<path>: invalid shape: Cannot read properties of null (reading 'toLowerCase'))`. That is row T252-5.

**The new file satisfies the task's "a BF-F7 case".** T252-5 is the BF-F7-class case that reaches `describeFleet`'s
catch. It lives in the new test file (§6) rather than inside BF-F7, so `briefing-fix.test.ts` is not edited.

```text
IMPACT-TARGETS: fleetProjectKey buildFleet verifiedStale handleStart
```

The new `fleetFallback` is not listed, because it does not exist at the base SHA. `describeFleet` is unchanged; only
mutant 5 edits it.

**Out of scope, do not touch:**
- `parseFleetRoot`, `normalizedSeats`, `hubFields`, `describeFleet`'s body, the `FleetJson` interface, and
  `verifiedStale`'s body (W5 changes only its parameter type).
- **The 260-character budget line.** `FLEET_LINE_CHARS` and the cap's length behaviour when the core alone is over
  200 characters are out of scope. T252-1's line is 260 characters, and the planner accepts that.
- `tests/pipelines/session-start/briefing-fix.test.ts` and `record-source.test.ts`. They run unchanged.
- `briefing.ts`, `renderBriefing`, and everything else in `server.ts` outside the two edits in W4.
- Any real `~/Projects/fleet/fleet.json`. No test reads it (§6).

## 1. Shell and Node

PowerShell. Run these first and paste the output:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
node -v
```

If it prints `v24…`, STOP and reply `BLOCKED T-252 node v24`.

## 2. Start state

**Base:** `origin/master` at **`b142886f875340913cc945399b1790167871fc08`**, unless the dispatch turn names another SHA.
Work in your own seat checkout.

```powershell
git fetch origin
git switch -c fix/t252-briefing-followups <BASE_SHA>
git rev-parse HEAD
git status --porcelain
```

`git rev-parse HEAD` must print the base SHA, and `git status --porcelain` must print nothing. Otherwise STOP:
`BLOCKED T-252 start state`.

## 3. Forbidden git

Do not use any of these:
- `git stash`
- `reset --hard`
- `--force`
- rebase
- amend
- `cd` into another seat's tree

Touch no PR except your own.

## The work (W1–W5), all in `open-brain/src`

### W1 (F2). `fleetProjectKey` skips non-object `projects[]` entries

In `pipelines/session-start/fleet.ts`, add this line as the **first statement inside each of the two**
`for (const p of fleet.projects) {` loops (lines 72 and 77):

```ts
      if (!p || typeof p !== "object") continue;
```

Change nothing else in `fleetProjectKey`.

### W2 (F1). The budget line never says "none" when there are seats

In `buildFleet`, the loop body at lines 178–184 currently reads:

```ts
    const names = allNames.slice(0, shown);
    const hidden = allNames.length - shown;
    const more = hidden > 0 ? ` +${hidden} more` : "";
    const namePart = names.length > 0 ? names.join(", ") : "none";
    budget = `${budgetCore}${namePart}${more}${suffix}`;
    if (budget.length <= FLEET_LINE_CHARS || shown === 0) break;
    shown -= 1;
```

Replace the `const more …`, `const namePart …` and `budget = …` lines (180–182) with exactly:

```ts
    let seatPart: string;
    if (allNames.length === 0) seatPart = "none";
    else if (shown === 0) seatPart = `+${hidden} more`;
    else seatPart = hidden > 0 ? `${names.join(", ")} +${hidden} more` : names.join(", ");
    budget = `${budgetCore}${seatPart}${suffix}`;
```

The results:

| Seats | Line ends |
|---|---|
| None match | `· seats none (verified …)`, exactly as today |
| Some fit | `· seats a, b +3 more (verified …)`, exactly as today |
| **None fit (new)** | `· seats +2 more (verified …)`, with one space after `seats` and no `none` |

### W3 (F4). `fleetFallback`, the never-throw fallback line, in `fleet.ts`

Append this exported function at the end of `fleet.ts`, after `describeFleet`:

```ts
/** handleStart's fallback when describeFleet itself throws: names the path describeFleet reads. Never throws. */
export function fleetFallback(err: unknown, env: NodeJS.ProcessEnv = process.env): { legacy: string[]; budget: string } {
  const msg = (err instanceof Error ? err.message : String(err)).split("\n")[0]!;
  return invalidShape(fleetPath(env), msg);
}
```

`fleetPath` and `invalidShape` stay private; they are in the same file. Do not use `firstLine` here, because
`firstLine(null)` throws.

### W4 (F4). `handleStart` uses it

In `server.ts`:
- Line 41 becomes exactly:
  `import { describeFleet, fleetFallback } from "./pipelines/session-start/fleet.js";`
- In the `fleet:` IIFE, replace the three lines inside `} catch (err) {` (443–445: `const path …`, `const line …`,
  `return { legacy: [line], budget: line };`) with exactly:
  ```ts
            return fleetFallback(err, process.env);
  ```

The `try { return describeFleet(projectRoot, projectName, process.env, startNow); }` part is unchanged.

### W5 (F2b). A non-primitive `verifiedAt` renders as unknown, not as "FLEET: unavailable"

In `fleet.ts`:
- Line 122 becomes exactly:
  `function verifiedStale(verifiedAt: string | number | undefined, now: Date): string | null {`
  Its body is unchanged.
- In `buildFleet`, replace line 157 (`const verified = data.verifiedAt ? new Date(data.verifiedAt) : null;`) with
  exactly:
  ```ts
    const rawVerified: unknown = data.verifiedAt;
    const verifiedAt =
      typeof rawVerified === "string" || (typeof rawVerified === "number" && Number.isFinite(rawVerified))
        ? rawVerified
        : undefined;
    const verified = verifiedAt ? new Date(verifiedAt) : null;
  ```
- Line 159 (`const stale = verifiedStale(data.verifiedAt, now);`) becomes exactly:
  `const stale = verifiedStale(verifiedAt, now);`

Line 158 (`verifiedLabel`) is unchanged. Anything that is not a string or a finite number becomes `undefined`, which
renders exactly as an absent `verifiedAt` does today: `verified ?`, and no STALE. Strings behave exactly as before.
A finite number keeps working as it does today: the planner checked that an epoch-ms value 26 h old still renders
STALE.

## 4. Commits (exactly two)

| # | Contents | Message |
|---|---|---|
| 1 | §6's new test file only | `T-252: tests (red)` |
| 2 | W1–W5 | `T-252: BRIEFING-FIX follow-ups F1-F4 (projects[] null guard, catch-reaching BF-F7 case, seats +K more, real fleet.json fallback path)` |

**At commit 1,** run §6's command on the new file alone (`$files = "tests/pipelines/session-start/t252-briefing-followups.test.ts"`)
and paste the summary. Expected: T252-1, T252-2, T252-3, T252-4, T252-6, T252-7 and T252-8 are red, and **T252-5 is green**.
T252-5 pins the catch that already exists; it is a mutant-killer, not a red test. Any other result means STOP:
`BLOCKED T-252 commit-1 red set`.

After each commit, paste `git status --porcelain` (it must be empty) and `git log --oneline <BASE_SHA>..HEAD` (1 line,
then 2).

## 5. Mutants (local only, never pushed; ALL run, none `NOT RUN`)

For each mutant:
1. `git switch -c mut-N <final head>`.
2. Make the one edit, then `git commit -am "MUTANT N"`.
3. Run §6's command, and paste the test that turned red with its assertion line.
4. `git switch fix/t252-briefing-followups`.

The tree must be clean after each one. Never push a `mut-N` branch.

| N | File | Edit | Must turn red |
|---|---|---|---|
| 1 | `fleet.ts` | Delete W1's guard line from the **first** loop (the one that reads `p.repo`) | T252-2 |
| 2 | `fleet.ts` | Delete W1's guard line from the **second** loop (the one that reads `p.name` only) | T252-3 |
| 3 | `fleet.ts` | Delete W1's guard line from **both** loops | T252-4 |
| 4 | `fleet.ts` | In W2, `` seatPart = `+${hidden} more`; `` becomes `` seatPart = `none +${hidden} more`; `` | T252-1 |
| 5 | `fleet.ts` | In `describeFleet`, delete the outer `try {` line (197) and the three lines `} catch (err) {` / `return invalidShape(path, firstLine(err));` / `}` (214–216), leaving the body between them as it is | T252-5 |
| 6 | `fleet.ts` | In `fleetFallback`, `fleetPath(env)` becomes `env.FLEET_JSON ?? "fleet.json"` | T252-6 |
| 7 | `server.ts` | `return fleetFallback(err, process.env);` becomes `return fleetFallback(err, { FLEET_JSON: process.env.FLEET_JSON ?? "fleet.json" });` | T252-7 |
| 8 | `fleet.ts` | In W5, replace the four-line `const verifiedAt = …;` statement with `const verifiedAt = data.verifiedAt;` (the guard removed) | T252-8 |

Mutant 5 is the old BRIEFING-FIX mutant 9 that survived in r2 (F3). It must be red now. If it stays green, STOP:
`BLOCKED T-252 mutant 5 survives`.

## 6. Tests

### New file: `open-brain/tests/pipelines/session-start/t252-briefing-followups.test.ts`

The header and helpers are copied from `briefing-fix.test.ts`:

```ts
/**
 * T-252 rows (docs/loops/t252-briefing-followups-brief.md): BRIEFING-FIX r2 F1-F4 and the verifiedAt guard.
 */
import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
import { describeFleet, fleetFallback, fleetProjectKey, type FleetJson } from "../../../src/pipelines/session-start/fleet.js";

const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});
function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  tmps.push(d);
  return d;
}
function git(cwd: string, ...args: string[]): void {
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
function gitRepo(dir: string): void {
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "T");
  writeFileSync(join(dir, "marker"), "x");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "init");
}
const now = new Date("2026-10-08T22:00:00.000Z");
const C190 = "c".repeat(190);
const seat = (name: string) => ({ name, project: "SIA" });
```

Every row writes its fleet file under a `tmp(...)` dir and passes it as `{ FLEET_JSON: path }`. No row passes
`process.env` to `describeFleet`, and no row reads `~/Projects/fleet/fleet.json`. Wrap all rows in
`describe("T-252: BRIEFING-FIX r2 follow-ups", () => { … })`. Each row is one `it` whose title starts with its row id.

| Row | Setup | Asserts |
|---|---|---|
| T252-1 (F1) | `root = tmp("t252-1-")`, `gitRepo(root)`. File A: `JSON.stringify({ coordinator: { name: C190 }, seats: [seat("a"), seat("b")] })`. File B: `JSON.stringify({ coordinator: { name: C190 }, seats: [] })`. Call `describeFleet(root, "SIA", { FLEET_JSON: <file> }, now)` on each | A's `budget` toBe `` `FLEET: coordinator ${C190} · hub ? · dashboard ? · seats +2 more (verified ?)` `` and not.toContain `"none"`. B's `budget` toBe `` `FLEET: coordinator ${C190} · hub ? · dashboard ? · seats none (verified ?)` `` |
| T252-2 (F2, loop 1) | `root = tmp("t252-2-")`, `gitRepo(root)`, `folder = root.split(/[/\\]/).pop()!`. `fleet = { projects: [null, { name: "SIA", repo: folder }] } as unknown as FleetJson` | `fleetProjectKey(root, "self-improving-agent", fleet)` toBe `"SIA"` |
| T252-3 (F2, loop 2) | `root = tmp("t252-3-")`, `gitRepo(root)`. `fleet = { projects: [null, { name: "SIA", repo: "no-such-folder" }] } as unknown as FleetJson` | `fleetProjectKey(root, "sia", fleet)` toBe `"SIA"` (loop 1 finds no repo match; loop 2 must skip the `null` and match the name) |
| T252-4 (F2, end to end) | `root = tmp("t252-4-")`, `gitRepo(root)`. File: `JSON.stringify({ projects: [null], seats: [seat("atlas-sia")] })`. `r = describeFleet(root, "SIA", { FLEET_JSON: path }, now)` | `r.budget` toBe `"FLEET: coordinator ? · hub ? · dashboard ? · seats atlas-sia (verified ?)"`. `r.legacy[3]` toBe `"Seats (SIA): atlas-sia ? ?/? ? ?"` |
| T252-5 (F3, reaches the catch) | `root = tmp("t252-5-")`, `gitRepo(root)`. File: `'{"seats":[]}'` (write the literal string) at `pb`. Call `describeFleet(root, null as unknown as string, { FLEET_JSON: pb }, now)` | `expect(() => describeFleet(root, null as unknown as string, { FLEET_JSON: pb }, now)).not.toThrow()`, and the result toEqual `{ legacy: [Lb], budget: Lb }` with `` Lb = `FLEET: unavailable (${pb}: invalid shape: Cannot read properties of null (reading 'toLowerCase'))` `` |
| T252-6 (F4, the function) | `root = tmp("t252-6-")`, `alt = join(root, "f.json")` (never created) | `fleetFallback(new Error("boom\nsecond"), {})` toEqual `{ legacy: [L1], budget: L1 }` with `` L1 = `FLEET: unavailable (${join(homedir(), "Projects", "fleet", "fleet.json")}: invalid shape: boom)` ``. `fleetFallback("str", { FLEET_JSON: alt }).budget` toBe `` `FLEET: unavailable (${alt}: invalid shape: str)` ``. `fleetFallback(null, { FLEET_JSON: alt }).budget` toBe `` `FLEET: unavailable (${alt}: invalid shape: null)` ``, and it does not throw |
| T252-7 (F4, the wiring) | `src = readFileSync(join(import.meta.dirname, "../../../src/server.ts"), "utf8")` | `src` toContain `"return fleetFallback(err, process.env);"`. `src` not.toContain `'process.env.FLEET_JSON ?? "fleet.json"'` |
| T252-8 (F2b, verifiedAt guard) | `root = tmp("t252-8-")`, `gitRepo(root)`. File: `'{"verifiedAt":{"valueOf":0,"toString":0},"seats":[{"name":"atlas-sia","project":"SIA"}]}'` (write the literal string). `r = describeFleet(root, "SIA", { FLEET_JSON: path }, now)` | `r.budget` toBe `"FLEET: coordinator ? · hub ? · dashboard ? · seats atlas-sia (verified ?)"` and not.toContain `"FLEET: unavailable"`. `r.legacy` toEqual `["## Fleet (fleet.json, verified ?)", "Coordinator: ? · questions and Aaron's decisions go to ?", "Hub: ? ? · Dashboard: ? ?", "Seats (SIA): atlas-sia ? ?/? ? ?"]` |

T252-6 computes `homedir()`; it never reads that path. Under §6's command, `homedir()` is inside the temp `$iso`.

All of the exact messages above were reproduced by the planner on Node v22.23.2 against `b142886f`'s `fleet.ts` with
W1–W3 and W5 applied. The planner re-ran T252-5 and T252-8 after the W5 ruling, and both outputs match the rows above.

### Existing assertions checked against this change (none turn red)

At `b142886f`, the planner grepped `open-brain/tests` and every non-test path for the fleet and seats text:
`seats none`, `+K more`, `FLEET:`, `FLEET: unavailable`, `verified`, `## Fleet`, `Seats (`, `invalid shape`,
`FLEET_JSON` and `"fleet.json"`. It also checked every test that imports `describeFleet` or `handleStart`, and
every `.snap` file. Each hit was then checked against W1–W5:

| File:line (at `b142886f`) | Asserts | After T-252 |
|---|---|---|
| `briefing-fix.test.ts:303-311` BF-F1 | Exact legacy block and budget line, 2 seats that fit, string `verifiedAt` | stays green (W2's "some fit" branch is unchanged; W5 passes strings through) |
| `briefing-fix.test.ts:314-332` BF-F11 | `Hub: v1.22.0 `, no `vv` | stays green (`hubFields` is untouched) |
| `briefing-fix.test.ts:334-351` BF-F2 | 40 seats, line ≤ 200, `/ +d+ more/` | stays green (`shown > 0` keeps `names +K more` with its leading space) |
| `briefing-fix.test.ts:353-362` BF-F3 | String `verifiedAt` 26 h old gives ` · STALE (verified ` in both layouts | stays green (W5 passes strings, and `verifiedStale`'s body is unchanged) |
| `briefing-fix.test.ts:364-374` BF-F4 | `FLEET: unavailable (<p>: not found)` and `(<p>: invalid JSON)` | stays green (both return before `buildFleet`) |
| `briefing-fix.test.ts:376-402` BF-F5 | Placement of `## Fleet` and `FLEET:` | stays green |
| `briefing-fix.test.ts:404-418` BF-F6 | `fleetProjectKey` with object entries | stays green (W1 skips only non-objects) |
| `briefing-fix.test.ts:420-435` BF-F7 | `null`/`[]` give `invalid shape: not an object`; bad seats give `seats none` | stays green (`parseFleetRoot` is unchanged; no seats means `allNames.length === 0`, which gives `none`) |
| `briefing-fix.test.ts:437-446` BF-F9 | `seats none`, no double space | stays green (same branch) |
| `record-source.test.ts:278-284` BF-F10 null | `handleStart` text contains `FLEET: unavailable (` and `## End Briefing` | stays green (`parseFleetRoot` path; the W4 fallback is not reached) |
| `record-source.test.ts:286-291` BF-F10 seat without project | End Briefing, no error | stays green |
| `briefing.test.ts:478` and `:597` | The ob_start block toEqual one rendered with `describeFleet(root, …, process.env, …)` in the same process | stays green (both sides call the same function; under §6's temp home both give `not found`) |
| `briefing-budget.test.ts`, `focus.test.ts`, `standing-budget.test.ts` (`+K more` hits) | WATCH OUT / tasks / standing / working-tree `+K more` | stays green (not fleet text; `briefing.ts` is untouched) |
| `fleet-ae-f1/f2/f4/f8`, `fleet-ae-harness.ts`, `server.test.ts`, `handoff-by-checkout`, `missing-handoff`, `latest-brief`, `focus-off`, `no-standing-cron`, `role-docs-by-sha`, `serving-build`, `bootstrap-fix`, `import-cmds-*`, `qa142-t003`, `t003-*` | They import `handleStart` or mention "fleet", but none asserts `FLEET`, `## Fleet`, `Seats (` or `FLEET_JSON` text | stays green |
| `.snap` files | None contains fleet text | n/a |
| **Non-test consumer:** `server.ts:443-445` (the fallback) | The only code outside `fleet.ts` that builds a fleet line | changed by W4, pinned by T252-6 and T252-7 |

**There are no red existing tests, so commit 1 edits no existing file.** If any file in §6 other than the new one goes
red at commit 2, it is not expected: STOP with `BLOCKED T-252 unexpected red <file>:<test>`, and paste the
assertion line.

### Command

PowerShell, from `open-brain/`. The run is a process whose PID you record. It has a temp HOME, USERPROFILE and
knowledge DB, and `FLEET_JSON` is removed so nothing can point at the real fleet file. The 10-minute cap stops only
that PID's tree (checklist 17):

```powershell
$iso = Join-Path $env:TEMP ("t252-home-" + [guid]::NewGuid().ToString("N")); New-Item -ItemType Directory $iso | Out-Null
$env:HOME = $iso; $env:USERPROFILE = $iso; $env:KNOWLEDGE_V2_DB = Join-Path $iso "knowledge-v2.db"
Remove-Item Env:FLEET_JSON -ErrorAction SilentlyContinue
$files = "tests/pipelines/session-start/t252-briefing-followups.test.ts tests/pipelines/session-start/briefing-fix.test.ts tests/pipelines/session-start/record-source.test.ts tests/pipelines/session-start/briefing.test.ts tests/pipelines/session-start/briefing-budget.test.ts"
$p = Start-Process -FilePath "npx.cmd" -ArgumentList "vitest run $files --no-file-parallelism --testTimeout=20000" -NoNewWindow -PassThru -RedirectStandardOutput "$iso\vitest.out" -RedirectStandardError "$iso\vitest.err"
if (-not $p.WaitForExit(600000)) { taskkill /PID $p.Id /T /F; "BLOCKED: 10-minute cap, killed PID $($p.Id) tree only" } else { "EXIT=$($p.ExitCode)" }
Get-Content "$iso\vitest.out"
Test-Path (Join-Path $iso "Projects")
```

- Paste the vitest summary and the `EXIT=` line separately (G-042).
- The last line must print `False`: nothing created a fleet path under the temp home.
- Kill only with `taskkill /PID <the recorded PID> /T`. Never kill by name, image or command line
  (`Stop-Process -Name`, `taskkill /IM`, `Where-Object CommandLine -match`). To see stray processes, LIST them and do
  not stop them.
- No test in this job spawns a waker or an agent. Afterwards, paste `Get-ChildItem $iso -Recurse -Name`.
- No watch mode, and never the whole suite.

## 7. Known red · 8. Typecheck · 9. Scope

**Known red.** If a file you did not change fails:
1. `git switch --detach <BASE_SHA>`.
2. Run that one file with §6's block (`$files = "<that file>"`).
3. `git switch fix/t252-briefing-followups`.
4. Paste both outputs.

If the failure is identical at the base, it was already there: name it and go on. You get at most **2** fix attempts
on your own failures. After that, STOP with `BLOCKED T-252 <test>`.

**Typecheck.** From `open-brain/`: `npx tsc --noEmit; "EXIT=$LASTEXITCODE"` → `EXIT=0`.

**Scope.** `git diff --name-only <BASE_SHA>..HEAD` may show only:

```
open-brain/src/pipelines/session-start/fleet.ts
open-brain/src/server.ts
open-brain/tests/pipelines/session-start/t252-briefing-followups.test.ts   (new)
```

Anything else means STOP.

## 10. Push and PR

```powershell
git push origin fix/t252-briefing-followups
git ls-remote origin refs/heads/fix/t252-briefing-followups
git rev-parse HEAD
```

The two SHAs must be equal. Never use `--force`. If the push is rejected, STOP: `BLOCKED T-252 push rejected`. Then:

```powershell
gh pr create --base master --head fix/t252-briefing-followups --title "T-252: BRIEFING-FIX follow-ups F1-F4 (grok re-review r2)" --body "Brief: docs/loops/t252-briefing-followups-brief.md. Fixes docs/loops/briefing-fix-review-r2.md F1-F4: projects[] null guard in fleetProjectKey, a BF-F7-class case that reaches describeFleet's catch (old mutant 9 now red), 'seats +K more' instead of 'seats none +K more', and handleStart's fallback naming the real default fleet.json path. Reviewed by the planner before QA."
```

## 11. STOP rules

At most 2 attempts at any failing step. A STOP still posts a reply whose second line is `BLOCKED T-252 <reason>`.

## 12. Reply

`<SEAT>` and `<ROOM>` are the exact values from the dispatch turn's `SEAT:` and `ROOM:` lines. If the dispatch turn
lacks either one, do not guess: leave the reply in `$iso\reply.txt` and end the turn.

```powershell
$env:HUB_URL = "http://100.124.212.87:4000"
$ht = "C:/Users/Aaron Melven/Projects/A2A-Hub/scripts/hub-talk.mjs"
if (-not (Test-Path $ht)) { "hub-talk not at $ht: use the exact hub-talk.mjs path your --inbox call used at the start of this run" }
node $ht --as <SEAT> --session <ROOM> --say-file "$iso\reply.txt"; "EXIT=$LASTEXITCODE"
```

- Write the reply to `$iso\reply.txt`, not inline. If your hub-talk has no `--say-file`, use
  `--say (Get-Content -Raw "$iso\reply.txt")`.
- Exit codes follow `.cursor/rules/hub-room.mdc`: 0 means posted, end the turn. 1 means the call was wrong: fix it,
  and do not retry it unchanged. 3 means the hub is unavailable: back off 5 s, doubling to 60 s, and stop after 5 in a row.
- Keep each post under 9,000 characters. Split it into two posts if needed, `(1/2)` and `(2/2)`.
- **Line 1:** `TASK: T-252 READY, BRIEFING-FIX follow-ups F1-F4 (fix/t252-briefing-followups)`. On a stop, `BLOCKED`
  replaces `READY`.
- **Line 2:** `READY T-252 <sha40>` or `BLOCKED T-252 <reason>`.
- **Then, in order:**
  1. `node -v`
  2. The start state
  3. The commit log, plus the commit-1 red run (§4)
  4. The test command, the vitest summary, the `EXIT=` line and the `Test-Path` line
  5. `git diff <BASE_SHA>..HEAD -- open-brain/src`
  6. The `tsc` `EXIT=`
  7. The scope diff
  8. Mutants 1–8, each with its red test and assertion line
  9. The push readback
  10. The PR number
  11. **IMPACT:** each target clark's launcher rated HIGH, CRITICAL or UNKNOWN, with the rows or §6 files that cover
      its callers (`handleStart`: record-source.test.ts BF-F10 and T252-7; `buildFleet`: T252-1, T252-4 and
      briefing-fix.test.ts BF-F1/F2/F9; `fleetProjectKey`: T252-2, T252-3 and BF-F6; `verifiedStale`: T252-8 and BF-F3), or
      `IMPACT: no HIGH/CRITICAL/UNKNOWN`.
- Every number is pasted command output, with the command shown above it. Anything not run is `NOT RUN`. End your turn
  after posting.

## 13. RAM and time

One test process, and no hub listener running alongside it. No real sleeps and no timers: every row passes `now`
explicitly, and nothing in this job waits.

## Acceptance

| # | Check |
|---|---|
| T252-A1 | T252-1…T252-8 pass. The other four files in §6 stay green. `tsc` gives 0. Scope is as §9. |
| T252-A2 | At commit 1, exactly T252-1/2/3/4/6/7/8 are red and T252-5 is green. |
| T252-A3 | Mutants 1–8 are each red on their named rows. Mutant 5 (describeFleet's try/catch removed, the old r2 M9) is red. |
| T252-A4 | A Grok review (D-145 lane) of the diff returns APPROVE, or CHANGES that the planner rules on. |
