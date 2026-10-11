# T-242: the two Grok bots become atlas reader partners, and the tests that froze the live map assert properties

Runtime: CC (claude -p, Sonnet 5.5)
SEAT: desktop one-off (no hub key)
ROOM: none
REPLY: write the full reply to C:\Users\melve\AppData\Local\Temp\t242-reply.md (absolute path; a temp HOME must not redirect it)

**By:** Atlas (planner), 2026-10-11. **Task:** T-242. **Tag:** `T-242`. **Decision:** D-150 (CC dev). **Size:** SMALL.
**Written to** `~/Worktrees/cursor-brief-checklist.md`. Everything the run needs is in this file. There is no
dispatch turn, no hub post and no room. You hold no hub key, and nothing in this job calls the hub.

## Why (planner, first-hand at `5b249bca`)

T-242 adds `grok-sia-review` and `grok-qa-sia` to `readers.atlas.partners` in `.agents/SYSTEM/hub-partner-seats.json`.
A planner edit that added them was reverted because two tests pin the live file's partner count:

| # | Where (at `5b249bca`) | What it pins today |
|---|---|---|
| F1 | `open-brain/tests/pipelines/session-start/seat-map.test.ts` lines 160–164, `it("atlas reads exactly these three partners, and no reader or seat still speaks as grok")` | Line 161 sorts `readers.atlas.partners[].hub_as` and requires exactly `["cursor-builder", "cursor-infra", "forge"]`, so any fourth partner turns it red. Line 162 requires the reader keys to be exactly `["atlas", "cursor-builder", "cursor-infra", "forge"]`. Line 163 requires no `seats[*].hub_name` to be `"grok"`. |
| F2 | `open-brain/tests/pipelines/session-start/hub-presence.test.ts` line 215, inside R1 (lines 208–222) | `expect(partnerLines.length).toBe(3)`. R1 runs on a `sia-planner` checkout holding a copy of the live file, so two more partners make 5 lines. |

**Correction to the task text.** The task says the `grok-*` names "trip the old forge=grok guard". They do not.
Line 163 is `.not.toContain("grok")` on an ARRAY of seat hub names, which is an exact element match, and the bots are
not in `seats`. Only line 161 (the exact list) turns red. Line 163's intent is kept, as SM-3.

### What the partner rows drive (read in `open-brain/src` at `5b249bca`)

- **ob_start's presence block.** `server.ts` lines 379–387 call `describeHubPresence`
  (`pipelines/session-start/hub-presence.ts` lines 283–340). It resolves the seat by CHECKOUT (`resolveCheckoutSeat`),
  takes `readers[<that seat's hub_name>].partners` (line 308), reads that seat's OWN key, and makes **one** request:
  `GET <hub>/a2a/agents/presence` (`fetchPresenceRoster`, 3 s timeout). It then renders **one line per partner** from
  that single roster (line 335). **There is no per-partner hub call.** Adding two partners adds two printed lines and no
  requests, so ob_start is neither slower nor more likely to fail.
- **How a bot line renders.** `formatPartnerLine` picks the formatter by `runtimeByHubName(...)[p.hub_as]`, which is
  built from `seats` only (`seat-map.ts` lines 68–77). The bots are not seats, so their runtime is `undefined`, and the
  hub-listener formatter (`formatHubListenerLine`, lines 147–161) is used: `grok-sia-review: absent` when the roster has
  no such agent or no row for that room, otherwise `grok-sia-review: hub listener: polling` / `not polling[, N unread
  since Xm]`. That is the right wording for a bot, which has no waker and no `seatState`.
- **Only the atlas reader is affected.** The block is built for the reader whose checkout is `sia-planner`.
  Developer checkouts read their own `readers.<hub_name>` rows, which do not change.
- **SEATS line.** `buildLiveByHubName` (lines 194–211) iterates `seats`, never `readers`, so the bots never appear on
  the SEATS line, and the `focus.test.ts` SEATS strings do not change.
- **The /sync greeting-size bound.** `presenceBlockUpperBound` (lines 352–388) adds one worst-case line per partner. For
  a bot that is the waker form or `hub listener: not polling, 999 unread, no listener poll recorded`, under 90 chars
  each, against `GREETING_LIMIT = 40_000` (`sync/checks.ts` line 2563). The presence block is printed outside the
  Briefing, so the 30-line/4096-char Briefing budget is unaffected.
- **/sync `hub-seats`.** `checkHubSeats` (`sync/hub-seats.ts` lines 112–126) requires each partner to have non-empty
  `label`, `hub_as` and `session_id`. The new rows satisfy that, and nothing there cross-checks partners against seats.
- **`scripts/planner-watch.mjs`** reads only `hub_url` from this file (line 30), never `readers`.

**The bots are not seats.** They have no worktree and no waker, so they stay out of `seats{}`, out of
`worktree-seats.json`, and out of `readers` as keys (they never run ob_start).

```text
IMPACT-TARGETS: none — no src symbol changes; commit 2 edits data only (.agents/SYSTEM/hub-partner-seats.json), read by describeHubPresence, presenceBlockUpperBound and checkHubSeats, whose rows are in §6
```

**Out of scope, do not touch:** any file under `open-brain/src` (mutant 6 edits one line locally and restores it);
`seats{}`, `seatless_checkouts`, `talk`, `talk_tokens`, `hub_url` and `description` in the JSON; the `readers` rows for
`forge`, `cursor-infra` and `cursor-builder`; `.agents/SYSTEM/worktree-seats.json`; every other test file;
`CHANGELOG.md`, `package.json`, any doc.

## 1. Shell and Node

PowerShell. Each Bash/PowerShell tool call is a fresh shell, so **every** command block below starts with the PATH
line. Run this first and paste the output:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
node -v
```

If it does not print `v22.…`, STOP: `BLOCKED T-242 node <version>`.

## 2. Start state

**Base:** `origin/master` at **`5b249bca3064f46ef0183ebba96ee36d5bf1626b`**. **Branch:** `fix/t242-grok-reader-partners`.
**Checkout:** a new worktree at `C:\Users\melve\Worktrees\sia-t242`. If that directory already exists, STOP:
`BLOCKED T-242 worktree exists`. Do not work in any other checkout, and do not `cd` into another seat's tree.

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
git -C C:\Users\melve\Projects\Self-Improving-Agent fetch origin
git -C C:\Users\melve\Projects\Self-Improving-Agent rev-parse origin/master
git -C C:\Users\melve\Projects\Self-Improving-Agent worktree add -b fix/t242-grok-reader-partners C:\Users\melve\Worktrees\sia-t242 5b249bca3064f46ef0183ebba96ee36d5bf1626b
git -C C:\Users\melve\Worktrees\sia-t242 rev-parse HEAD
git -C C:\Users\melve\Worktrees\sia-t242 status --porcelain
```

`rev-parse HEAD` must print `5b249bca3064f46ef0183ebba96ee36d5bf1626b` and `status --porcelain` must print nothing. Otherwise STOP:
`BLOCKED T-242 start state`. Then install dependencies **in the new worktree only** (never in
`C:\Users\melve\Projects\Self-Improving-Agent`, whose `node_modules` running MCP servers hold open):

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
Set-Location C:\Users\melve\Worktrees\sia-t242\open-brain
npm ci; "EXIT=$LASTEXITCODE"
```

`EXIT=0` or STOP: `BLOCKED T-242 npm ci`. All later commands run from `C:\Users\melve\Worktrees\sia-t242` (git) or
its `open-brain\` (vitest, tsc), always by absolute path.

## 3. Forbidden git

Do not use: `git stash`, `reset --hard`, `--force`, rebase, amend, `git worktree remove` on any tree but your own, or a
`cd`/`Set-Location` into another seat's tree. Touch no PR except your own.

## The work

### W1 (commit 2). `.agents/SYSTEM/hub-partner-seats.json`: two rows appended to `readers.atlas.partners`

The `readers.atlas` block becomes exactly this (the three existing rows unchanged and in order, a comma after the
`cursor-builder` row, then the two new rows). Keep the file's two-space indentation and its trailing newline.

```json
    "atlas": {
      "partners": [
        { "label": "forge", "hub_as": "forge", "session_id": "k571z4ghp7nbp34djhecwnsk3n8fmhsf" },
        { "label": "cursor-infra", "hub_as": "cursor-infra", "session_id": "k57d92gqtjm9wpfs74ekbx9rns8fmy2f" },
        { "label": "cursor-builder", "hub_as": "cursor-builder", "session_id": "k575sfwr9wcx3r8fw83g3bc00x8fmar3" },
        { "label": "grok-sia-review", "hub_as": "grok-sia-review", "session_id": "k57c639j4wkyp3y3vhfxxytn1s8fsdx6" },
        { "label": "grok-qa-sia", "hub_as": "grok-qa-sia", "session_id": "k573rrq0rz6p519xhh4p9mmyk98fsb55" }
      ]
    },
```

The two rooms are `[atlas, grok-sia-review]` and `[atlas, grok-qa-sia]`. Both ids are 32 characters, `k` plus 31 of
`[0-9a-z]`, like the three existing room ids (planner checked all five with `/^k[0-9a-z]{31}$/`). Nothing else in the
file changes. After the edit, `node -e "JSON.parse(require('fs').readFileSync('.agents/SYSTEM/hub-partner-seats.json','utf8'))"`
must exit 0.

### W2 (commit 1). `seat-map.test.ts`: the count becomes properties

1. **Line 137**, the `seats` type inside the `map` cast, becomes:
   ```ts
       seats: Record<string, { checkout: string; hub_name?: string; room?: string; dispatch?: { cursor?: { room?: string; hub_name?: string } } }>;
   ```
2. **Replace lines 160–164** (the whole `it("atlas reads exactly these three partners, …")` block; line 165, the
   closing `});` of the `describe`, stays) with exactly this:

```ts
  // T-242: the Grok bots are atlas's partners on their own rooms. They are not seats (no worktree, no waker) and not readers.
  const SESSION_ID = /^k[0-9a-z]{31}$/;
  const BOTS = [
    { label: "grok-sia-review", hub_as: "grok-sia-review", session_id: "k57c639j4wkyp3y3vhfxxytn1s8fsdx6" },
    { label: "grok-qa-sia", hub_as: "grok-qa-sia", session_id: "k573rrq0rz6p519xhh4p9mmyk98fsb55" },
  ] as const;

  it("T-242 SM-1 atlas reads both Grok bots, each exactly once, on its own room", () => {
    for (const bot of BOTS) {
      expect(map.readers.atlas!.partners.filter((p) => p.hub_as === bot.hub_as)).toEqual([bot]);
    }
  });

  it("T-242 SM-2 every partner row of every reader is well-formed, and atlas's partners are distinct", () => {
    for (const [reader, block] of Object.entries(map.readers)) {
      expect(block.partners.length, reader).toBeGreaterThan(0);
      for (const p of block.partners) {
        for (const field of [p.label, p.hub_as]) {
          expect(typeof field === "string" && field.length > 0 && field === field.trim(), `${reader}: ${JSON.stringify(p)}`).toBe(true);
        }
        expect(p.session_id, `${reader}: ${JSON.stringify(p)}`).toMatch(SESSION_ID);
      }
    }
    const atlas = map.readers.atlas!.partners;
    expect(new Set(atlas.map((p) => p.hub_as)).size).toBe(atlas.length);
    expect(new Set(atlas.map((p) => p.session_id)).size).toBe(atlas.length);
  });

  it("T-242 SM-3 no seat, reader or partner speaks as plain grok; every reader is a seat; the Grok bots are neither seats nor readers", () => {
    const seatHubNames = Object.values(map.seats)
      .flatMap((s) => [s.hub_name, s.dispatch?.cursor?.hub_name])
      .filter((n): n is string => typeof n === "string");
    expect(seatHubNames).not.toContain("grok");
    expect(Object.keys(map.readers)).not.toContain("grok");
    for (const [reader, block] of Object.entries(map.readers)) {
      expect(block.partners.map((p) => p.hub_as), reader).not.toContain("grok");
      expect(Object.values(map.seats).map((s) => s.hub_name), `reader ${reader} is a seat's hub_name`).toContain(reader);
    }
    for (const bot of BOTS) {
      expect(seatHubNames).not.toContain(bot.hub_as);
      expect(Object.keys(map.readers)).not.toContain(bot.hub_as);
    }
  });
```

Nothing else in `seat-map.test.ts` changes. Lines 146–158 (the per-seat room rows and the atlas↔seat reader pairs)
stay as they are: they filter by `hub_as`, so they ignore the bot rows.

### W3 (commit 1). `hub-presence.test.ts`: R1 counts the partners it read, and a new row renders the bots

1. **Line 3** becomes:
   ```ts
   import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync, readFileSync } from "node:fs";
   ```
2. **Directly after line 24** (`const BUILDER_ROOM = …`), insert:
   ```ts
   // T-242: the Grok bots' rooms with atlas ([atlas, grok-sia-review], [atlas, grok-qa-sia]).
   const GROK_REVIEW_ROOM = "k57c639j4wkyp3y3vhfxxytn1s8fsdx6";
   const GROK_QA_ROOM = "k573rrq0rz6p519xhh4p9mmyk98fsb55";
   ```
   HP-1 below uses both. (`GROK_QA_ROOM` is deliberately NOT the room in HP-1's roster: that is how HP-1 proves a bot
   on the hub but not in its atlas room prints `absent`.)
3. **Line 215** (`expect(partnerLines.length).toBe(3);`) is replaced with:
   ```ts
       // T-242: one line per partner the checkout's own copy of the map lists, in its order. Not a frozen count.
       const listed = (JSON.parse(readFileSync(join(root, HUB_PARTNER_SEATS_REL), "utf8")) as {
         readers: { atlas: { partners: { label: string }[] } };
       }).readers.atlas.partners;
       expect(listed.length).toBeGreaterThan(0);
       expect(partnerLines.length).toBe(listed.length);
       partnerLines.forEach((line, n) => expect(line.startsWith(`  ${listed[n]!.label}: `), line).toBe(true));
   ```
4. **Directly after line 222** (the `});` that closes R1), insert HP-1:
   ```ts
   it("T-242 HP-1 the Grok bots render as hub-listener partner lines from the same single fetch", async () => {
     const base = roster();
     const { fetchFn, calls } = fixtureFetch({
       agents: [
         ...base.agents,
         { name: "grok-sia-review", rooms: [{ sessionId: GROK_REVIEW_ROOM, unread: 1, pollingNow: false, pollAgeMs: 60_000 }] },
         { name: "grok-qa-sia", rooms: [{ sessionId: "k5700000000000000000000000000000", unread: 0, pollingNow: true, pollAgeMs: 0 }] },
       ],
     });
     const block = await describe_(fetchFn);
     expect(calls).toHaveLength(1);
     expect(block.lines).toContain("  grok-sia-review: hub listener: not polling, 1 unread since 1m");
     // grok-qa-sia is on the roster but not in its atlas room (GROK_QA_ROOM), so it is absent.
     expect(block.lines).toContain("  grok-qa-sia: absent");
     expect(GROK_QA_ROOM).toMatch(/^k[0-9a-z]{31}$/);
     expect(block.lines.join("\n")).not.toMatch(/grok-(sia-review|qa-sia): (working|idle|owes_reply|state:unknown)/);
   });
   ```

Nothing else in `hub-presence.test.ts` changes.

## 4. Commits (exactly two)

| # | Contents | Message |
|---|---|---|
| 1 | W2 and W3 (the two test files only) | `T-242: seat map and presence tests assert properties, not a partner count (red)` |
| 2 | W1 (the JSON only) | `T-242: grok-sia-review and grok-qa-sia are atlas reader partners` |

Each message ends with these two lines after a blank line:

```
Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Refs: docs/loops/t242-grok-reader-partners-brief.md
```

After each commit paste `git -C C:\Users\melve\Worktrees\sia-t242 status --porcelain` (empty) and
`git -C C:\Users\melve\Worktrees\sia-t242 log --oneline 5b249bca3064f46ef0183ebba96ee36d5bf1626b..HEAD` (1 line, then 2).

**The red run after commit 1.** Run §6's command with `$files` set to
`tests/pipelines/session-start/seat-map.test.ts tests/pipelines/session-start/hub-presence.test.ts` and paste the
summary. Expected at commit 1: **exactly two failures, SM-1 and HP-1, both on assertions.** SM-2, SM-3 and the rewritten
R1 are GREEN at commit 1 (the three-partner file already satisfies the properties); that is correct, they are what the
old counts become. Any other failure, or SM-1/HP-1 green, is a STOP: `BLOCKED T-242 red run`.

## 5. Mutants (local only, never committed or pushed; ALL run, none `NOT RUN`)

On the final HEAD (after commit 2), for each mutant: make the one edit, run the **mutant command** (§6's command with
`$files` = `tests/pipelines/session-start/seat-map.test.ts tests/pipelines/session-start/hub-presence.test.ts`), paste
each red test's name and its failing assertion line, then `git -C C:\Users\melve\Worktrees\sia-t242 checkout -- <file>`
and paste an empty `status --porcelain`. Never commit a mutant.

| N | File: edit | Must turn red |
|---|---|---|
| 1 | `hub-partner-seats.json`: delete the `grok-qa-sia` row (and the comma ending the `grok-sia-review` row) | SM-1, HP-1 |
| 2 | `hub-partner-seats.json`: `grok-sia-review`'s `session_id` loses its last character (`…fsdx6` → `…fsdx`) | SM-1, SM-2, HP-1 |
| 3 | `hub-partner-seats.json`: `grok-sia-review`'s `"hub_as": "grok-sia-review"` becomes `"hub_as": "grok"` | SM-1, SM-3, HP-1 |
| 4 | `hub-partner-seats.json`: add a reader after the `cursor-builder` reader: `"grok-sia-review": { "partners": [ { "label": "Atlas", "hub_as": "atlas", "session_id": "k57c639j4wkyp3y3vhfxxytn1s8fsdx6" } ] }` (comma before it) | SM-3 |
| 5 | `hub-partner-seats.json`: `grok-qa-sia`'s `session_id` becomes `k571z4ghp7nbp34djhecwnsk3n8fmhsf` (forge's room) | SM-1, SM-2 |
| 6 | `open-brain/src/pipelines/session-start/hub-presence.ts` line 335: `partners.map((p) =>` becomes `partners.slice(0, 3).map((p) =>` | R1, HP-1 |

Mutant 6 proves the rewritten R1 still catches a dropped partner line. If any mutant leaves its named rows green, STOP:
`BLOCKED T-242 mutant N`.

## 6. Tests

### Existing test files that read the seat file, with verdicts (planner's mechanical sweep at `5b249bca`)

`git grep -ln "hub-partner-seats\|readers\|partnerLines\|partners" HEAD -- open-brain/tests scripts` returns 17 paths.
Every one, with its verdict:

| File | Lines | Verdict |
|---|---|---|
| `tests/pipelines/session-start/seat-map.test.ts` | 160–164 | **Changes (W2).** Line 161's exact list and line 162's exact reader keys become SM-1/SM-2/SM-3. Lines 146–158 stay and stay green (they filter by `hub_as`). |
| `tests/pipelines/session-start/hub-presence.test.ts` | 215 | **Changes (W3).** `toBe(3)` becomes "one line per listed partner, in order". R1's line regex (217) accepts `absent`, which is what the bots render against `roster()`. Every other row uses `toContain`/`find`, or a one-line UNKNOWN body that never reaches the partner list. PR-4 line 286 calls `formatPartnerLine` with a literal `grok` partner, not the file: green. R2 lines 265–271 name `grok` only inside a malformed roster body: green. |
| `tests/pipelines/sync/greeting-size.test.ts` | 294, 299–309, 316–347 | **Stays green.** 303–305 check only the three seat labels. 321 is `toHaveLength(partners.length)`, read from the live file, and 323–346 check the bound against every form for EVERY partner, so they exercise the bot rows automatically (bot runtime falls back to `"claude-code"` at line 327; the bound's candidates include the listener forms). |
| `tests/pipelines/session-start/focus.test.ts` | 17, 42, 116, 155–181, 229 | **Stays green.** 116 finds rooms by `hub_as`. 157 is `toMatchObject` on `liveByHubName`, which comes from `seats` only. 159–161 and 177–179 compare SEATS lines, which never include readers. 229 edits `seats.builder` only. |
| `tests/pipelines/session-start/focus-off.test.ts` | 42 | **Stays green.** It copies the file into a `sia-infra` checkout with no key: presence is one UNKNOWN line for the `cursor-infra` reader, whose row is unchanged. |
| `tests/pipelines/session-start/missing-handoff.test.ts` | 189 | **Stays green.** It uses the file for `seats` (checkout → seat) only. |
| `tests/pipelines/sync/task-assignees.test.ts` | 21, 40 | **Stays green.** Assignees are checked against `seats` keys, unchanged. |
| `tests/pipelines/fleet-ae-f3.test.ts` | 20–24 | **Stays green.** It checks only that `requiredBlock` is absent. |
| `tests/pipelines/sync/hub-talk-exit-codes.test.ts` | 131–132 | **Stays green.** It checks for no `wait` key; the new rows have none. |
| `tests/pipelines/sync/hub-seats.test.ts` | 10, 37–183 | **Stays green.** All bodies are inline fixtures (`READERS`); it never reads the live file. |
| `tests/t048-dropped-counts.test.ts` | 125–126 | **Stays green.** Inline fixture. |
| `tests/t048-zero-case.test.ts` | 70–71 | **Stays green.** Inline fixture. |
| `tests/pipelines/session-start/role-files.test.ts` | 193 | **Stays green.** The match is the word "readers" in a comment. |
| `tests/fixtures-import/.agents/SYSTEM/SUMMARY.md`, `tests/fixtures-import/.agents/TASKS/INBOX.md`, `tests/fixtures-state/a2a-state-1c200b41.json` | — | **Not tests.** Prose fixtures where the words appear in text; they never read the seat file. |
| `scripts/planner-watch.mjs` | 30–34 | **Not a test.** Reads `hub_url` only. |

### Rows

| Row | File | Red at commit 1? | Asserts |
|---|---|---|---|
| SM-1 | seat-map | **red** | Each bot appears exactly once in `readers.atlas.partners`, equal to its exact row. |
| SM-2 | seat-map | green | Every reader has ≥1 partner; every partner's `label`/`hub_as` is a non-empty trimmed string and `session_id` matches `/^k[0-9a-z]{31}$/`; atlas's `hub_as` and `session_id` values are each unique. |
| SM-3 | seat-map | green | No seat `hub_name` or `dispatch.cursor.hub_name`, reader key or partner `hub_as` is plain `grok`; every reader key is some seat's `hub_name`; neither bot is a seat hub name or a reader key. |
| R1 (rewritten) | hub-presence | green | One partner line per partner the copied file lists, each starting `  <label>: `, in file order. |
| HP-1 | hub-presence | **red** | One fetch; `  grok-sia-review: hub listener: not polling, 1 unread since 1m`; `  grok-qa-sia: absent` (roster agent present, wrong room); no bot line uses a waker word. |

### Command

PowerShell. The run is a process whose PID you record. It gets a temp HOME, USERPROFILE and KNOWLEDGE_V2_DB, and the
10-minute cap stops only that PID's tree (checklist 17). These variables are set in this one shell only; the reply
path in the header is absolute and is never built from `$HOME`/`$env:USERPROFILE`.

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
Set-Location C:\Users\melve\Worktrees\sia-t242\open-brain
$iso = Join-Path $env:TEMP ("t242-home-" + [guid]::NewGuid().ToString("N")); New-Item -ItemType Directory $iso | Out-Null
$env:HOME = $iso; $env:USERPROFILE = $iso; $env:KNOWLEDGE_V2_DB = Join-Path $iso "knowledge-v2.db"; $env:A2A_KEY_DIR = Join-Path $iso "keys"
$files = "tests/pipelines/session-start/seat-map.test.ts tests/pipelines/session-start/hub-presence.test.ts tests/pipelines/sync/greeting-size.test.ts tests/pipelines/session-start/focus.test.ts tests/pipelines/session-start/focus-off.test.ts tests/pipelines/session-start/missing-handoff.test.ts tests/pipelines/sync/task-assignees.test.ts tests/pipelines/fleet-ae-f3.test.ts tests/pipelines/sync/hub-talk-exit-codes.test.ts tests/pipelines/sync/hub-seats.test.ts"
$p = Start-Process -FilePath "npx.cmd" -ArgumentList "vitest run $files --no-file-parallelism --testTimeout=20000" -NoNewWindow -PassThru -RedirectStandardOutput "$iso\vitest.out" -RedirectStandardError "$iso\vitest.err"
if (-not $p.WaitForExit(600000)) { taskkill /PID $p.Id /T /F; "BLOCKED: 10-minute cap, killed PID $($p.Id) tree only" } else { "EXIT=$($p.ExitCode)" }
Get-Content "$iso\vitest.out" -Tail 40
Get-ChildItem $iso -Recurse -Name
```

- Paste the vitest summary and the `EXIT=` line separately (a summary can say "passed" with a non-zero exit).
- Kill only with `taskkill /PID <the recorded PID> /T /F`. Never kill by name, image or command line. To see stray
  processes, LIST them; do not stop them.
- No test here spawns a waker, an agent or a hub listener, and none opens a socket (`hub-presence.test.ts` arms a
  network tripwire). After the run, the `Get-ChildItem $iso` listing must not show a `.a2a-hub` directory; also paste
  `Test-Path C:\Users\melve\.a2a-hub\keys\*\grok-*.key` (expected `False`: nothing in this job writes a key).
- No watch mode, and never the whole suite.

## 7. Known red · 8. Typecheck · 9. Scope

**Known red.** None known for these files on the desktop. If a file you did not change fails:
`git -C C:\Users\melve\Worktrees\sia-t242 switch --detach 5b249bca3064f46ef0183ebba96ee36d5bf1626b`, run that one file with §6's command, then
`git -C C:\Users\melve\Worktrees\sia-t242 switch fix/t242-grok-reader-partners`, and paste both outputs. Identical at
the base means it was already there: name it and go on. At most **2** fix attempts on your own failures, then STOP:
`BLOCKED T-242 <test>`.

**Typecheck.** From `open-brain\`: `npx tsc --noEmit; "EXIT=$LASTEXITCODE"` → `EXIT=0`. (It covers `src/` only; no
src file changes, so this proves only that the tree still builds.)

**Scope.** `git -C C:\Users\melve\Worktrees\sia-t242 diff --name-only 5b249bca3064f46ef0183ebba96ee36d5bf1626b..HEAD` may show only:

```
.agents/SYSTEM/hub-partner-seats.json
open-brain/tests/pipelines/session-start/hub-presence.test.ts
open-brain/tests/pipelines/session-start/seat-map.test.ts
```

Anything else means STOP. Also paste `git -C C:\Users\melve\Worktrees\sia-t242 diff 5b249bca3064f46ef0183ebba96ee36d5bf1626b..HEAD -- .agents/SYSTEM/hub-partner-seats.json`:
it must show exactly one changed line (the `cursor-builder` atlas row gains a trailing comma) and two added lines.

## 10. Push and PR

```powershell
git -C C:\Users\melve\Worktrees\sia-t242 push origin fix/t242-grok-reader-partners
git -C C:\Users\melve\Worktrees\sia-t242 ls-remote origin refs/heads/fix/t242-grok-reader-partners
git -C C:\Users\melve\Worktrees\sia-t242 rev-parse HEAD
```

The two SHAs must be equal. If the push is rejected, STOP. Never `--force`. Then, from the worktree:

```powershell
Set-Location C:\Users\melve\Worktrees\sia-t242
gh pr create --base master --head fix/t242-grok-reader-partners --title "T-242: Grok bots are atlas reader partners; seat-map/presence tests assert properties" --body "Brief: docs/loops/t242-grok-reader-partners-brief.md. T-242 (D-150 CC dev run). Data change plus two test files; no src change. Reviewed by the planner before QA."
```

Do not merge. Do not remove the worktree.

## 11. STOP rules

At most 2 attempts at any failing step. A STOP still writes the reply file, with `BLOCKED` in lines 1 and 2.

## 12. Reply

Write the whole reply with your Write tool to **`C:\Users\melve\AppData\Local\Temp\t242-reply.md`** (absolute; never a
path built from `$HOME`, `$env:USERPROFILE` or `$env:TEMP` inside a shell whose HOME you changed). Overwrite it if it
exists. Then end the run; there is no hub post.

- **Line 1:** `TASK: T-242 READY, Grok bots as atlas reader partners (fix/t242-grok-reader-partners)`. On a stop,
  `BLOCKED` replaces `READY`.
- **Line 2:** `READY T-242 <sha40>` or `BLOCKED T-242 <reason>`.
- **Line 3:** `MODEL: <the exact model id you are running as>`.
- **Then, in order:**
  1. `node -v`
  2. The start state (all five §2 outputs) and `npm ci` `EXIT=`
  3. The commit log, and the red run after commit 1 (exactly SM-1 and HP-1 red)
  4. The test command, the vitest summary and the `EXIT=` line, the `$iso` listing and the `Test-Path` line
  5. `git diff 5b249bca3064f46ef0183ebba96ee36d5bf1626b..HEAD` in full (three files, small)
  6. The `tsc` `EXIT=`
  7. The scope diff
  8. Mutants 1–6, each with its red tests and the clean `status --porcelain` after it
  9. The push readback (both SHAs)
  10. The PR number and URL
  11. **IMPACT:** any target the launcher rated HIGH, CRITICAL or UNKNOWN with the rows that cover it, or
      `IMPACT: no HIGH/CRITICAL/UNKNOWN` (the targets line is `none`)
- Every number is pasted command output, with the command shown above it. Anything not run is `NOT RUN`.

## 13. RAM and time

One test process. No hub listener, waker or second node process alongside it. No real sleeps; no row depends on time
(HP-1's `since 1m` comes from the fixture's `pollAgeMs: 60_000`, not a clock).

## Acceptance

| # | Check |
|---|---|
| T242-A1 | SM-1, SM-2, SM-3, R1 (rewritten) and HP-1 pass; the other eight §6 files stay green; `tsc` 0; scope as §9. |
| T242-A2 | The red run after commit 1 shows exactly SM-1 and HP-1 red. |
| T242-A3 | Mutants 1–6 are each red on their named rows. |
| T242-A4 | Live, after merge and a rebuild of the main-tree server: atlas's ob_start presence block in `sia-planner` lists `grok-sia-review:` and `grok-qa-sia:` lines, still from one roster fetch, and `/sync`'s `hub-seats` and `greeting-size` checks pass. |
