# T-279: the Win32 process table crosses the PowerShell pipe as printable ASCII; T-270's mechanism corrected

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC or laptop one-off, NOT the desktop (Aaron, 2026-10-13: the desktop's CPU is at 100%, so no npm, vitest,
tsc or build runs there). It must be a Windows host: rows W1 and W2 spawn Windows PowerShell 5.1. No hub key. Code PR.
Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t279-reply.md (a reply path in the
launcher's line wins). Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 170. **Task:** T-279 (P3). **Tag:** `T-279`. **Size:** SMALL.
**Base:** `7d9215b250513ccd7bc4c06728d436834c5664b2` (origin/master, #688 merged). If clark re-pins it at launch, that
SHA wins. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: readWin32ProcessTableStdout parseWin32ProcessTable loadWin32ProcessTable (open-brain/src/shared/process-session.ts; parseWin32ProcessTable changes only its comment; new exports asciiSafeJsonCommand and WIN32_TABLE_PIPELINE; callers resolveCursorAgentHost and suite-owner.ts liveOwnerProbe are covered by tests/t270-table-control-chars.test.ts C6-C7, tests/t168-owner-wired.test.ts N3, tests/t235-p2-3-cursor-proof.test.ts)
```

## Why

T-279 (read its note). Windows PowerShell 5.1 writes its stdout to a pipe in the console's OEM code page (437 on the
fleet's hosts) with .NET's best-fit fallback. So `readWin32ProcessTableStdout` (`process-session.ts:202-213` at the
base) hands Node a lossy table:
- → • § ¶ ← ↑ ↓ ↔ ☺ ► arrive as the C0 bytes 0x1A 0x07 0x15 0x14 0x1B 0x18 0x19 0x1D 0x01 0x10, which JSON.parse refuses.
- · ✓ é arrive as 0xFA 0xFB 0x82, which Node decodes as U+FFFD, and — and an emoji arrive as `-` and `??`.

T-270 (#677) made the parse survive by turning C0 into spaces (`:160`), but its comment (`:158`) and the t270 test
docstring blame ConvertTo-Json. That is false: ConvertTo-Json escapes control characters, and the bytes come from the
encoder on the pipe. Command lines are still read lossily.

**Planner-run, first-hand** (s170: Node v22.23.2, Windows PowerShell 5.1.19041.6456, console code page 437; the
production spawn shape `execFileSync("powershell.exe", ["-NoProfile","-NonInteractive","-Command", cmd], { stdio:
["ignore","pipe","ignore"], windowsHide: true, timeout: 60000 })`). The input was a one-row table built INSIDE
PowerShell holding the 14 characters above plus U+1F600:

| Command | Bytes outside 0x20-0x7E | JSON.parse | Exact string back |
|---|---|---|---|
| today's `… \| ConvertTo-Json -Compress` | 13 (1a 07 15 14 1b 18 19 1d 01 10 fa fb 82) | FAIL "Bad control character" | no |
| ruled below: the same, with every char outside 0x20-0x7E escaped to `\uXXXX` inside PowerShell | 0 | ok | **yes**, U+1F600 included (as a surrogate pair) |
| alternative: `[Console]::OutputEncoding = UTF8` first | 42 (UTF-8) | ok | yes |

- **Why the escape and not the alternative:** the escape needs nothing from the console, so only ASCII ever reaches the
  encoder. The alternative depends on the console handle the process happens to have.
- **What could not be tested:** detached runs, with no console, returned no stdout at all for every variant, so they
  say nothing either way.
- **A prototype of this exact ruling** ran green in a scratch clone on the desktop before the CPU rule (t279 5/5; t270,
  t268, t235 and t168 all green, 44 tests). W1 took 2.2 s and W2 5.2 s. That run also printed one vitest
  `Timeout calling "onTaskUpdate"` under 100% CPU, which is G-042, and why the rows below tick around each synchronous
  spawn.

## Ruling (exact; `open-brain/src/shared/process-session.ts` unless named)

1. **The comment above the T-270 replacement** (`:158`, one line) becomes these two lines; `:159` and `:160` stay:
   ```ts
   // Defence in depth (T-270): a raw C0 byte once reached this parse. ConvertTo-Json escapes control characters;
   // the console's cp437 best-fit encoder on the pipe made them (→ as 0x1A), and the read now escapes to ASCII (T-279).
   ```
2. **Replace `function readWin32ProcessTableStdout(): string { … }`** (`:202-213`) with exactly:
   ```ts
   /** The one CIM query the table reads. */
   export const WIN32_TABLE_PIPELINE = "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine";

   /**
    * PowerShell text that serialises `pipeline` with ConvertTo-Json -Compress, then escapes every UTF-16 code unit
    * outside printable ASCII (0x20-0x7E) to \uXXXX, so only ASCII crosses the pipe (T-279). Windows PowerShell 5.1
    * writes stdout in the console's OEM code page (437) with .NET best-fit: unescaped, → reaches Node as the C0 byte
    * 0x1A, · as 0xFA (decoded as U+FFFD) and an emoji as "??". JSON.parse turns the escapes back into the exact
    * string, an astral character's two surrogate escapes included. 5.1's ConvertTo-Json has no -EscapeHandling.
    */
   export function asciiSafeJsonCommand(pipeline: string): string {
     return `[regex]::Replace((${pipeline} | ConvertTo-Json -Compress), '[^\\x20-\\x7E]', [System.Text.RegularExpressions.MatchEvaluator]{ param($m) '\\u{0:x4}' -f [int][char]$m.Value })`;
   }

   /** Production reads WIN32_TABLE_PIPELINE; a Windows test passes a synthetic pipeline through the same spawn. */
   export function readWin32ProcessTableStdout(pipeline: string = WIN32_TABLE_PIPELINE): string {
     return execFileSync(
       "powershell.exe",
       ["-NoProfile", "-NonInteractive", "-Command", asciiSafeJsonCommand(pipeline)],
       { encoding: "utf-8", timeout: 60_000, stdio: ["ignore", "pipe", "ignore"], windowsHide: true },
     );
   }
   ```
   `loadWin32ProcessTable` (`:189`) is unchanged: it calls `run()` with no argument, so production reads
   `WIN32_TABLE_PIPELINE`.
3. **`open-brain/tests/t270-table-control-chars.test.ts`**: the docstring above `rawPayload` (lines 8-11) becomes exactly:
   ```ts
   /**
    * A raw control character inside a CommandLine string (T-270). Windows PowerShell 5.1's ConvertTo-Json escapes
    * control characters; the raw byte came from the console's cp437 best-fit encoder on the pipe (→ arrives as 0x1A).
    * The read now escapes to ASCII (T-279); these rows keep the parse's defence in depth. JSON.stringify escapes the
    * character, so put the raw one back.
    */
   ```
   Nothing else in that file changes.
4. **Out of scope** (name them in the reply):
   - `readProcessParent` (`:216-235`) reads one row through `Write-Output`, with the same lossy encoding. But it is
     line-based, is never JSON-parsed, and its consumers match ASCII tokens.
   - `processStartTime` (`:69`) prints a number.
   - T-281's `provenTranscriptPath` and the proof returns (`:309-390`).

## New test file `open-brain/tests/t279-ascii-safe-table.test.ts` (exactly)

```ts
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// Namespace import: a missing export fails its rows, not the file.
import * as ps from "../src/shared/process-session.js";

/**
 * T-279: Windows PowerShell 5.1 writes stdout in the console's OEM code page (437) with .NET best-fit, so a
 * non-ASCII character in a command line reaches Node lossily: → as the C0 byte 0x1A, · as 0xFA (decoded as
 * U+FFFD), — as "-", an emoji as "??". The table read escapes every UTF-16 code unit outside 0x20-0x7E to \uXXXX
 * inside PowerShell, so only printable ASCII crosses the pipe and JSON.parse restores the exact string.
 */

// → • § ¶ ← ↑ ↓ ↔ ☺ ► · ✓ é —, then one astral character (U+1F600, a surrogate pair)
const BMP = [0x2192, 0x2022, 0x00a7, 0x00b6, 0x2190, 0x2191, 0x2193, 0x2194, 0x263a, 0x25ba, 0x00b7, 0x2713, 0x00e9, 0x2014];
const ASTRAL = 0x1f600;
const BUILT = "a " + String.fromCharCode(...BMP) + String.fromCodePoint(ASTRAL) + " b";
const PRINTABLE = /^[\x20-\x7E]*$/;
// G-042: vitest does not yield between the tests of one file, and W1/W2 spawn PowerShell synchronously. A macrotask
// on either side of each spawn lets the worker answer its reporter.
const tick = (): Promise<void> => new Promise((r) => setImmediate(r));

/** The PowerShell escape, mirrored in JS: UTF-16 code units, as .NET's regex sees them. */
function escapeLikePowerShell(json: string): string {
  return json.replace(/[^\x20-\x7E]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

describe("T-279 the Win32 process table crosses the PowerShell pipe as printable ASCII", () => {
  it("A1: asciiSafeJsonCommand wraps the pipeline in ConvertTo-Json -Compress and escapes every char outside 0x20-0x7E", () => {
    expect(ps.asciiSafeJsonCommand("P")).toBe(
      "[regex]::Replace((P | ConvertTo-Json -Compress), '[^\\x20-\\x7E]', [System.Text.RegularExpressions.MatchEvaluator]{ param($m) '\\u{0:x4}' -f [int][char]$m.Value })",
    );
  });

  it("A2: the production pipeline is still the one CIM query", () => {
    expect(ps.WIN32_TABLE_PIPELINE).toBe("Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine");
  });

  it("A3: an escaped payload is printable ASCII and parses back to the exact command lines", () => {
    const payload = escapeLikePowerShell(
      JSON.stringify([
        { ProcessId: 7, ParentProcessId: 1, CommandLine: BUILT },
        { ProcessId: 8, ParentProcessId: 7, CommandLine: "x\u001ay" },
      ]),
    );
    expect(payload).toMatch(PRINTABLE);
    expect(payload).toContain("\\ud83d\\ude00");
    const r = ps.parseWin32ProcessTable(payload);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.table.get(7)?.commandLine).toBe(BUILT);
    expect(r.table.get(8)?.commandLine).toBe("x\u001ay");
  });

  it("A4: the production read spawns asciiSafeJsonCommand, and the table loads through it by default", () => {
    const src = readFileSync(join(import.meta.dirname, "../src/shared/process-session.ts"), "utf8");
    expect(src).toContain('["-NoProfile", "-NonInteractive", "-Command", asciiSafeJsonCommand(pipeline)]');
    expect(src).toContain("export function loadWin32ProcessTable(run: () => string = readWin32ProcessTableStdout): Win32TableResult {");
    expect(src).not.toContain('"Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress"');
  });

  it.runIf(process.platform === "win32")(
    "W1: a synthetic row read through the production spawn arrives as printable ASCII and parses back exactly; unescaped it does not",
    async () => {
      const lit = BMP.map((cp) => `[char]0x${cp.toString(16)}`).join("+") + `+[char]::ConvertFromUtf32(0x${ASTRAL.toString(16)})`;
      const synth = `[pscustomobject]@{ProcessId=7;ParentProcessId=1;CommandLine=('a '+${lit}+' b')} | Select-Object ProcessId,ParentProcessId,CommandLine`;
      await tick();
      const out = ps.readWin32ProcessTableStdout(synth);
      await tick();
      expect(out.trim()).toMatch(PRINTABLE);
      const r = ps.parseWin32ProcessTable(out);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.table.get(7)?.commandLine).toBe(BUILT);
      // The control, round 1's command: the same row with no escaping does not cross as printable ASCII.
      const raw = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `${synth} | ConvertTo-Json -Compress`], {
        encoding: "utf-8",
        timeout: 60_000,
        stdio: ["ignore", "pipe", "ignore"],
        windowsHide: true,
      });
      await tick();
      expect(raw.trim()).not.toMatch(PRINTABLE);
    },
  );

  it.runIf(process.platform === "win32")("W2: the real table reads as printable ASCII and loads", async () => {
    await tick();
    const out = ps.readWin32ProcessTableStdout();
    await tick();
    expect(out.trim()).toMatch(PRINTABLE);
    const r = ps.loadWin32ProcessTable(() => out);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.table.size).toBeGreaterThan(10);
  });
});
```

## Existing tests (planner-read at 7d9215b2; verdicts)

- `tests/t270-table-control-chars.test.ts` C1-C8: **stay green**. The parse is unchanged, and only the docstring moves.
- `tests/t235-p2-3-cursor-proof.test.ts`: **stays green**. Its r3/r4 rows inject runners, and its e2e rows read the
  real table through `proveSession`'s cursor walk (13/13 in the prototype run).
- `tests/t168-owner-wired.test.ts`: **stays green**. N3 walks the live table to the cursor-agent host; `:164` injects a
  failing loader.
- `tests/t268-owner-session-proof.test.ts` S1-S10: **stay green**. They inject `tableOf(rows)` and never read the
  real table.
- `process-session.ts` is not pinned in `.agents/retirements.json` (planner-checked at the base).
- Any other newly failing row: STOP, `BLOCKED T-279 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t279-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v`. It must print `v22.*`, otherwise BLOCKED.
   Also paste `$PSVersionTable.PSVersion.ToString()` (expect 5.1.x) and `[Console]::OutputEncoding.CodePage`.
2. **Start state.**
   - Work in the fresh clone the launcher named. If it named none, run
     `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t279-wt")` and
     `Set-Location` into it.
   - `git checkout -q -b fix/t279-ascii-table-pipe 7d9215b250513ccd7bc4c06728d436834c5664b2`. `git rev-parse HEAD`
     must print that SHA and `git status --porcelain` must be empty, else STOP, BLOCKED.
   - In `open-brain`, run `npm ci`, then `node -e "require('better-sqlite3')"`. If it prints "Could not locate the
     bindings file", run `npm rebuild better-sqlite3`, re-check, and say so.
   - **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, a `cd` into any other checkout,
     `npm run test:heavy`, killing any process by name, and any edit outside the three files below except a mutant
     (step 7), which is always reverted.
3. **Commit 1, `T-279: tests (red): the Win32 process table crosses the pipe as printable ASCII`:** the new test file
   only. In `open-brain`, run
   `npx vitest run tests/t279-ascii-safe-table.test.ts --no-file-parallelism --testTimeout=180000`.
   - **Red at the base:** exactly A1, A2, A4, W1 and W2. A missing export is `undefined` through the namespace import,
     so those rows fail with "is not a function" or `expected undefined`.
   - **Green:** A3.
   - Any other split: STOP, `BLOCKED T-279 commit-1 <row>`. Paste the run.
4. **Commit 2, `T-279: read the Win32 process table through an ASCII-safe pipe; correct T-270's mechanism`:** rulings 1-3.
   Run in `open-brain` (wall-clock cap 20 min):
   `npx vitest run tests/t279-ascii-safe-table.test.ts tests/t270-table-control-chars.test.ts tests/t268-owner-session-proof.test.ts tests/t235-p2-3-cursor-proof.test.ts tests/t168-owner-wired.test.ts --no-file-parallelism --testTimeout=180000`.
   - All green; paste it.
   - If vitest prints `Timeout calling "onTaskUpdate"` with every row green (G-042), run each file alone with the same
     flags and paste every run. Say which file printed it.
   - Then `npx tsc --noEmit` exits 0; paste it.
5. Each commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   `git log --oneline 7d9215b2..HEAD` shows 2 lines, and `git status --porcelain` is empty after each commit.
6. **W1 and W2 are the live proof.** Paste their two lines from step 4's output, with their durations. If either
   was skipped (the host is not Windows), STOP, `BLOCKED T-279 not a Windows host`: this run needs Windows.
7. **Mutants.** For each: edit, run `tests/t279-ascii-safe-table.test.ts` (M4: `tests/t270-table-control-chars.test.ts`)
   alone with the same flags, paste the failing row names, then `git checkout -- <file>` and confirm a clean tree. Never
   commit a mutant.
   - **M1** `asciiSafeJsonCommand` returns `` `${pipeline} | ConvertTo-Json -Compress` `` → A1 and W1 red.
   - **M2** in `asciiSafeJsonCommand`, `'\\u{0:x4}'` → `'\\u{0:x}'` → A1 and W1 red (§ becomes `\ua7`).
   - **M3** in `readWin32ProcessTableStdout`, `asciiSafeJsonCommand(pipeline)` → `` `${pipeline} | ConvertTo-Json -Compress` ``
     → A4 and W1 red.
   - **M4** in `parseWin32ProcessTable`, `const cleaned = trimmed.replace(/[\u0000-\u001f]/g, " ");` →
     `const cleaned = trimmed;` → t270 C1, C2, C3, C6, C7 and C8 red. The defence in depth stays pinned.
   - **M5** `WIN32_TABLE_PIPELINE` loses `,CommandLine` → A2 red.
8. `git diff --name-only 7d9215b2..HEAD` must show exactly `open-brain/src/shared/process-session.ts`,
   `open-brain/tests/t270-table-control-chars.test.ts` and `open-brain/tests/t279-ascii-safe-table.test.ts`. Anything
   else: STOP, BLOCKED.
9. `git push origin fix/t279-ascii-table-pipe` (never force). `git ls-remote origin refs/heads/fix/t279-ascii-table-pipe`
   must equal `git rev-parse HEAD`. If the push is rejected: STOP. Then
   `gh pr create --base master --head fix/t279-ascii-table-pipe --title "T-279: the Win32 process table crosses the PowerShell pipe as printable ASCII" --body "Brief: docs/loops/t279-ascii-safe-table-pipe-brief.md. Code PR (src)."`
   Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion. CI is Linux, so
   W1 and W2 skip there; step 4's local Windows run is their evidence.

## Reply

The first line is `READY T-279 <sha40> PR #<n>` or `BLOCKED T-279 <reason>`. Then each command with its output: node
-v, the PowerShell version and code page, the start-state proofs, commit 1's split, the green run (with W1's and W2's
durations), tsc, the five mutants, the name-only diff, `ls-remote` = `rev-parse`, the PR URL and CI. Name any HIGH,
CRITICAL or UNKNOWN impact target from the launcher's block, and say which rows cover its callers. **Paste test
output with `grep -a`, or without grep.** Mark anything not run `NOT RUN`. If the code differs from a line this brief
quotes, follow the ruling's intent and say what differed. Do not merge.
