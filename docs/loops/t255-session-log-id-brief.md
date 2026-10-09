# T-255: a session log must always carry its session id, and must never overwrite another log

**By:** Atlas (planner), session 166, 2026-10-09. **Lane:** D-143 small fix. Clark opened it after Maker's report.
**Seat:** cursor-builder (checkout `sia-builder`, QA PC). **Size:** LIGHT. **Written to**
`~/Worktrees/cursor-brief-checklist.md`. **The base SHA in the dispatch turn overrides §2's.**

## Diagnosis (planner, first-hand)

Maker's checkout is `~/Worktrees/makerspace-planner`. On one session id (c28bf91a), `.agents/SESSIONS/Session_56.md`
and `Session_57.md` were both minted, and the third `ob_start` showed no reuse marker. The cause is two defects in
`open-brain/src/pipelines/session-start/session-log.ts`:

1. **The id is silently dropped.** `createSessionLog` (line 77) inserts `> **Session ID:** <id>` only *before a line
   matching* `/^(>.*Status:.*$)/m` (line 99).
   - Maker's `SESSION_TEMPLATE.md` (CRLF line endings, first line `# Session Log: Session_N (YYYY-MM-DD)`) has no
     `Status:` line, so the `replace` matches nothing.
   - Neither log contains a Session ID line (`grep -c "Session ID"` gives 0 on both).
   - `findExistingSessionLog` (line 45) matches on that line, so it can never find this checkout's logs, and every
     `ob_start` mints a new log.
   - The "missing marker" Maker saw follows from this. It is not a separate defect.
2. **An existing log is overwritten.**
   - When the record's session number has not moved, `nextGreetingSessionNumber` returns the same N again.
   - `writeFileSync(logPath, …)` (line 105) then replaces an existing `Session_N.md`.
   - Session_57.md's mtime (16:55 CDT) is after the third `ob_start`. It was overwritten with a blank template, not
     reused.

```text
IMPACT-TARGETS: createSessionLog sessionStart
```

**Out of scope, do not touch:**
- `findExistingSessionLog` and `SESSION_ID_LINE`. They are correct; they never received an id line to match.
- `nextGreetingSessionNumber`.
- The `Session N` and `[Date]` placeholder replacement. Maker's template uses `Session_N` and `YYYY-MM-DD`, so these
  are not filled in. That is cosmetic, and it stays as it is.
- `server.ts`, which already prints `skippedReason` at line 337 as `Session log: <reason>`.
- Maker's files.

## 1. Shell and Node

PowerShell. Run these first and paste the output:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
node -v
```

If it prints `v24…`, STOP and reply `BLOCKED T-255 node v24`.

## 2. Start state

**Base:** `origin/master` at **`d4117c79bc0e23e0ea0e11998a795c90ca029492`**, unless the dispatch turn names another SHA.

```powershell
git fetch origin
git switch -c fix/t255-session-log-id <BASE_SHA>
git rev-parse HEAD
git status --porcelain
```

`git rev-parse HEAD` must print the base SHA, and `git status --porcelain` must print nothing. Otherwise STOP:
`BLOCKED T-255 start state`.

## 3. Forbidden git

Do not use any of these:
- `git stash`
- `reset --hard`
- `--force`
- rebase
- amend
- `cd` into another seat's tree

Touch no PR except your own.

## The work

### W1. The id is always stamped (`createSessionLog`, session-log.ts lines 98–103)

Replace the `if (sessionId) { … }` block with:

```ts
  if (sessionId) {
    const idLine = `> **Session ID:** ${sessionId}`;
    const withStatus = content.replace(/^(>.*Status:.*$)/m, `${idLine}\n$1`);
    if (withStatus !== content) {
      content = withStatus;
    } else {
      // T-255: a template with no `> …Status:` line (a project's own SESSION_TEMPLATE.md) used to get no id at all, so
      // findExistingSessionLog could never match it and every ob_start minted a new log. Put the id under the first line.
      const nl = content.indexOf("\n");
      content = nl === -1 ? `${content}\n${idLine}\n` : `${content.slice(0, nl + 1)}${idLine}\n${content.slice(nl + 1)}`;
    }
  }
```

- When the template HAS a Status line, the output is byte-identical to today's.
- On a CRLF template, the inserted line ends in `\n` only. That is deliberate: `SESSION_ID_LINE` matches with or
  without `\r`. Do not "fix" it.

### W2. Never overwrite an existing log (`createSessionLog`)

Directly after `const logPath = …` (line 86), add:

```ts
  // T-255: a log that already exists belongs to some session; it is never overwritten (Maker's Session_57 was).
  if (existsSync(logPath)) return "";
```

### W3. Say so (`sessionStart`, pipelines/session-start/index.ts, the `else` branch, lines 43–56)

After `const logPath = createSessionLog(…)`, add the case where `logPath === ""`. The sessions directory exists at this
point, because that was checked at line 26, so `""` can only mean W2's refusal. Set:

```ts
session = {
  sessionId,
  sessionNumber: 0,
  logPath: "",
  reused: false,
  skippedReason: `Session_${sessionNumber}.md already exists and does not carry this session's id — it was NOT overwritten, and no log was created for this session`,
};
```

Otherwise keep today's object unchanged.

## 4. Commits (exactly two)

| # | Contents | Message |
|---|---|---|
| 1 | §6's two new test files only; they must be red at this commit | `T-255: tests (red)` |
| 2 | W1–W3 | `T-255: always stamp the session id; never overwrite an existing session log` |

After each commit, paste `git status --porcelain` (it must be empty) and `git log --oneline <BASE_SHA>..HEAD` (1 line,
then 2).

## 5. Mutants (local only, never pushed; ALL run, none `NOT RUN`)

Use the same procedure as T-250 §5, on branches `mut-N`, keeping the tree clean.

| N | Edit | Must turn red |
|---|---|---|
| 1 | Delete W1's `else` branch (back to Status-only) | SL-1, SL-4 |
| 2 | Delete W2's `if (existsSync(logPath)) return "";` | SL-5 |
| 3 | In W3, set `skippedReason: null` | SL-6 |
| 4 | In W1, insert the id line at the END of the content, not under the first line | SL-1 |

## 6. Tests

**New file:** `open-brain/tests/pipelines/session-start/session-log-id.test.ts`.

- Every project is `mkdtempSync(join(tmpdir(), "t255-"))` containing `.agents/SESSIONS/`. There is no state.json, so
  numbering is local (max existing + 1).
- `sessionStart` is called with `{ projectRoot, homePath: <a temp dir>, sessionId: ID }`, where
  `ID = "c28bf91a-7f93-47c6-a711-0a11bb5b0c2d"`.
- `MAKER_TEMPLATE` is these exact four lines joined with `"\r\n"`, plus a trailing `"\r\n"`:
  - `# Session Log: Session_N (YYYY-MM-DD)`
  - `<!-- NAMING: Use Session_11.md, Session_12.md, etc. (sequential, not date-based) -->`
  - `` (an empty line)
  - `## Session Objective`

| Row | Setup | Asserts |
|---|---|---|
| SL-1 | `MAKER_TEMPLATE` written as `SESSION_TEMPLATE.md`; `createSessionLog(root, 1, ID, "2026-10-09")` | Line 2 of the written file (split on `\n`) is exactly `> **Session ID:** c28bf91a-7f93-47c6-a711-0a11bb5b0c2d`, and `findExistingSessionLog(root, ID)` returns `{ sessionNumber: 1, logPath: <that path> }` |
| SL-2 | Template `"# Session N — [Date]\n\n> **Objective:** x\n> **Status:** In Progress\n"` | The written content is exactly `"# Session 1 — 2026-10-09\n\n> **Objective:** x\n> **Session ID:** <ID>\n> **Status:** In Progress\n"`. That is today's behaviour, unchanged |
| SL-3 | No template (the built-in fallback) | The content contains `> **Session ID:** <ID>\n> **Status:** In Progress` |
| SL-4 | `MAKER_TEMPLATE`; `sessionStart` twice with the same ID | The first call has `reused === false`. The second has `reused === true`, the same `logPath` and the same `sessionNumber`. Afterwards `readdirSync(SESSIONS).filter(f => /^Session_\d+\.md$/.test(f))` has length 1 |
| SL-5 | `Session_1.md` pre-written with content `"OLD\n"` (no id); call `createSessionLog(root, 1, ID, "2026-10-09")` | It returns `""`, and `readFileSync(Session_1.md, "utf8") === "OLD\n"` |

**A second new file, `open-brain/tests/pipelines/session-start/session-log-id-skip.test.ts`,** holds only SL-6, because
it mocks the module:

```ts
vi.mock("../../../src/pipelines/session-start/session-log.js", async (orig) => ({
  ...(await orig<typeof import("../../../src/pipelines/session-start/session-log.js")>()),
  createSessionLog: () => "",
}));
```

| Row | Setup | Asserts |
|---|---|---|
| SL-6 | Temp project with an empty `.agents/SESSIONS/` and no state.json, so the local number is 1; `sessionStart({ projectRoot, homePath: <temp>, sessionId: ID })` | `result.session.logPath === ""`, `result.session.reused === false`, and `result.session.skippedReason === "Session_1.md already exists and does not carry this session's id — it was NOT overwritten, and no log was created for this session"` |

**Command** (PowerShell, from `open-brain/`). Use the T-250 §6 block with
`$files = "tests/pipelines/session-start/session-log-id.test.ts tests/pipelines/session-start/session-log-id-skip.test.ts tests/pipelines/session-start/session-log.test.ts tests/t048-dropped-counts.test.ts tests/t048-zero-case.test.ts"`.
Paste the vitest summary and `EXIT=` separately, and paste `Get-ChildItem $iso -Recurse -Name`. PID-only kill.

## 7. Known red · 8. Typecheck · 9. Scope

- **Known red:** as in T-250 §7, with at most 2 fix attempts.
- **Typecheck:** `npx tsc --noEmit` → `EXIT=0`.
- **Scope:** `git diff --name-only <BASE_SHA>..HEAD` may show only:
  ```
  open-brain/src/pipelines/session-start/session-log.ts
  open-brain/src/pipelines/session-start/index.ts
  open-brain/tests/pipelines/session-start/session-log-id.test.ts   (new)
  open-brain/tests/pipelines/session-start/session-log-id-skip.test.ts   (new)
  ```
  Anything else means STOP.

## 10. Push and PR

```powershell
git push origin fix/t255-session-log-id
git ls-remote origin refs/heads/fix/t255-session-log-id
git rev-parse HEAD
```

The two SHAs must be equal. Never use `--force`. Then:

```powershell
gh pr create --base master --head fix/t255-session-log-id --title "T-255: always stamp the session id; never overwrite a session log" --body "Brief: docs/loops/t255-session-log-id-brief.md. D-143 small fix. Reviewed by the planner before QA."
```

## 11. STOP rules · 12. Reply · 13. RAM and time

- **STOP rules:** as in T-250 (§11–13).
- **Reply:** in room `k575sfwr9wcx3r8fw83g3bc00x8fmar3`, as cursor-builder.
  - **Line 1:** `TASK: T-255 READY, session log id + no overwrite (fix/t255-session-log-id)`
  - **Line 2:** `READY T-255 <sha40>` or `BLOCKED T-255 <reason>`
  - **Then:** items 1–11 as in T-250 §12. Item 5 is the pasted `git diff <BASE_SHA>..HEAD -- open-brain/src`. Every
    mutant is run.

## Acceptance

| # | Check |
|---|---|
| T255-A1 | SL-1…SL-6 pass; the existing session-log and t048 tests stay green; `tsc` 0; scope as §9 |
| T255-A2 | Mutants 1–4 are each red on their named rows |
| T255-A3 | Live, after the SG-1 rebuild and an explicit `/mcp` reconnect: Maker's next `ob_start` creates one log carrying a `> **Session ID:**` line, and a second `ob_start` in the same session prints `(existing log for this session id — reused, nothing created)` |
| T255-A4 | After A3, Maker deletes `Session_57.md`. It is evidence only, and it was overwritten with a blank template |

## ROUND 2 (2026-10-09): grok-sia-review F1 (major), F2, F4, F6 (`docs/loops/t255-review-r1.md`)

**Ruling:**
- **F1 is real.** It would hit Maker on its very next start: the record says max n=56 and `Session_57.md` exists
  without an id, so every `ob_start` computes 57 and refuses forever. **A skipped log is worse than a renumbered one.**
  R2-1 replaces "refuse" with "take the next free number".
- **F2:** the `existsSync` → `writeFileSync` race is closed by an atomic `wx` create.
- **F4:** the CLI prints the skip.
- **F6:** a real record-path test.
- **F3** is mostly moot after R2-1, and the remaining refusal message is reworded per F3. **F5** and **F7** are
  recorded only (nits, no code).

**Start state:** your branch `fix/t255-session-log-id`, with HEAD and `origin/fix/t255-session-log-id` both at
**`7a6f870fde58af7bf55e726e3746b06de73f0b8f`**, and an empty porcelain. Otherwise STOP with `BLOCKED T-255 r2 start state`.

Every round-1 rule still holds:
- §1: Node 22.
- §3: forbidden git.
- §6: the Start-Process block with a temp HOME, `--no-file-parallelism`, a 10-minute cap, and a **PID-only kill**
  (`taskkill /PID <recorded pid> /T`; never by name, image or command line).
- §8: tsc.
- §11: STOP after 2 attempts.
- §12: the reply.

```text
IMPACT-TARGETS: createSessionLog sessionStart handleStart
```

`claimSessionLog` is new.

### R2-1 (F1 + F2): `session-log.ts`

**In `createSessionLog`:**
- DELETE the round-1 line `if (existsSync(logPath)) return "";`.
- Replace the final `writeFileSync(logPath, content, "utf-8");` with:

```ts
  // T-255 r2 (F2): an atomic create. A log that already exists belongs to some session and is never overwritten.
  try {
    writeFileSync(logPath, content, { encoding: "utf-8", flag: "wx" });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") return "";
    throw err;
  }
```

Nothing else in `createSessionLog` changes.

**Add this directly below `createSessionLog`:**

```ts
/** T-255 r2 (F1): how many numbers past the first a session may skip to find a free Session_N.md. */
export const SESSION_LOG_PROBE_LIMIT = 20;

/**
 * Create this session's log at `firstNumber`, or at the next number whose file does not exist yet. A taken number is
 * never overwritten, and it is never refused forever either: the record's number does not move until a session is
 * recorded, so refusing would leave every ob_start of this session without a log (review r1 F1).
 * Returns null only when all SESSION_LOG_PROBE_LIMIT numbers are taken.
 */
export function claimSessionLog(
  projectRoot: string,
  firstNumber: number,
  sessionId: string | null,
  date: string,
): { sessionNumber: number; logPath: string } | null {
  for (let n = firstNumber; n < firstNumber + SESSION_LOG_PROBE_LIMIT; n++) {
    const logPath = createSessionLog(projectRoot, n, sessionId, date);
    if (logPath !== "") return { sessionNumber: n, logPath };
  }
  return null;
}
```

### R2-2: `types.ts` and `index.ts` (`sessionStart`)

- **`types.ts`:** `SessionInfo` gains
  `/** T-255 r2: the number the record proposed, when its Session_N.md was already taken and a later number was used. */ takenNumber?: number;`
- **`index.ts`:** replace the body of the `else` branch (the round-1 code from `const { sessionNumber, source } = …` to
  the end of the `if (logPath === "") … else …`) with:

```ts
        const { sessionNumber, source } = nextGreetingSessionNumber(options.projectRoot, state.stateJson);
        const date = new Date().toISOString().split("T")[0];
        const claimed = claimSessionLog(options.projectRoot, sessionNumber, sessionId, date);
        if (claimed === null) {
          session = {
            sessionId,
            sessionNumber: 0,
            logPath: "",
            reused: false,
            skippedReason: `Session_${sessionNumber}.md through Session_${sessionNumber + SESSION_LOG_PROBE_LIMIT - 1}.md all already exist (not matched to this session's id) — none was overwritten, and no log was created for this session`,
          };
        } else {
          session = {
            sessionId,
            sessionNumber: claimed.sessionNumber,
            logPath: claimed.logPath,
            reused: false,
            skippedReason: null,
            sessionNumberSource: source,
            ...(claimed.sessionNumber !== sessionNumber ? { takenNumber: sessionNumber } : {}),
          };
        }
```

Import `claimSessionLog` and `SESSION_LOG_PROBE_LIMIT` from `./session-log.js`, and drop `createSessionLog` from that
import.

### R2-3: `server.ts` (`handleStart`, the session line at line 332)

Inside the template literal, directly after the `${result.session.reused ? … : localNote}` expression, add:

```ts
${result.session.takenNumber !== undefined ? ` (Session_${result.session.takenNumber}.md was already taken and was not overwritten; this session's log is Session_${result.session.sessionNumber}.md)` : ""}
```

Nothing else in `server.ts` changes.

### R2-4 (F4): `cli.ts`

Directly after the `if (result.session.logPath) { … }` block at line 209, add:

```ts
  else if (result.session.skippedReason) console.log(`\nSession log: ${result.session.skippedReason}`);
```

This one has no test row; it is verified from the diff.

### Round-2 tests

**SL-6 changes** (`session-log-id-skip.test.ts`):
- The mock becomes `claimSessionLog: () => null`, in place of `createSessionLog`. A module mock does not intercept
  calls made inside `session-log.ts` itself, so mocking `createSessionLog` would no longer reach this path.
- It asserts
  `skippedReason === "Session_1.md through Session_20.md all already exist (not matched to this session's id) — none was overwritten, and no log was created for this session"`.

**New rows** in `session-log-id.test.ts`:

| Row | Setup | Asserts |
|---|---|---|
| SL-7 | Temp root. Copy `open-brain/tests/fixtures-state/state.json` to `<root>/.agents/state.json` (its max `sessions[].n` is 54). Create an empty `.agents/SESSIONS/`. FIRST assert that `nextGreetingSessionNumber(root, readProjectState(root).stateJson)` deep-equals `{ sessionNumber: 55, source: "record" }` (`readProjectState` comes from `src/pipelines/session-start/state-reader.js`). If it does not, STOP with `BLOCKED T-255 r2 SL-7 fixture`. Pre-write `Session_55.md` = `"OLD\n"`. Call `sessionStart({ projectRoot: root, homePath: <temp>, sessionId: ID })` twice | **First call:** `sessionNumber === 56`, `logPath` ends with `Session_56.md`, `takenNumber === 55`, `reused === false`, and `Session_55.md` still reads exactly `"OLD\n"`. **Second call:** `reused === true` with the same `logPath`. **Afterwards:** the SESSIONS files matching `/^Session_\d+\.md$/` number exactly 2 |
| SL-8 | Local root with `Session_1.md` … `Session_20.md`, each `"X\n"` | `claimSessionLog(root, 1, ID, "2026-10-09") === null`, and `Session_21.md` does not exist |
| SL-9 | Local root with `Session_3.md` = `"X\n"` | `claimSessionLog(root, 3, ID, "2026-10-09")` deep-equals `{ sessionNumber: 4, logPath: join(root, ".agents", "SESSIONS", "Session_4.md") }`, and `Session_3.md` still reads `"X\n"` |

SL-5 stays unchanged. With the early `existsSync` gone, it now proves the `wx` create.

### Round-2 mutants

These are local only, never pushed. Run ALL of them and paste every red row.

| N | Edit | Must turn red |
|---|---|---|
| 5 | `claimSessionLog` loop bound `n < firstNumber + 1` (no probing) | SL-7, SL-9 |
| 6 | Remove `flag: "wx"` (plain overwrite) | SL-5, SL-9 |
| 7 | Loop bound `n <= firstNumber + SESSION_LOG_PROBE_LIMIT` | SL-8 |
| 8 | Drop the `takenNumber` spread | SL-7 |

Re-run round-1 mutants 1, 3 and 4 as well. Mutant 3 now means: set `skippedReason: null` in the `claimed === null`
branch. It must turn SL-6 red. Mutant 2 is superseded by mutant 6.

### Commits, scope, tests, push, reply

**Commits:** exactly two, on top of 7a6f870f:

1. `T-255 r2: tests (red)`. This holds the SL-6 change plus SL-7, SL-8 and SL-9.
2. `T-255 r2: take the next free log number atomically instead of refusing; CLI prints the skip (review F1, F2, F4)`.

`git log --oneline 7a6f870f..HEAD` must show 2 lines.

**Scope:** `git diff --name-only 7a6f870f..HEAD` may contain only these files. Anything else means STOP.
- `open-brain/src/pipelines/session-start/session-log.ts`
- `open-brain/src/pipelines/session-start/index.ts`
- `open-brain/src/pipelines/session-start/types.ts`
- `open-brain/src/server.ts`
- `open-brain/src/cli.ts`
- the two `session-log-id*` test files

**Tests:** use the §6 block with the same five files, and add `tests/pipelines/session-start/briefing.test.ts`,
because `server.ts` changed.

**Push:** `git push origin fix/t255-session-log-id`. Never use `--force`. `ls-remote` must equal HEAD. PR #564 already
exists, so open no new PR.

**Reply:** use the §12 format. Item 5 is the pasted `git diff 7a6f870f..HEAD -- open-brain/src`. The first two lines
are:

```text
TASK: T-255 ROUND 2, review F1 F2 F4 F6 (fix/t255-session-log-id)
READY T-255 <sha40>
```

**Acceptance A3 now reads:** run Maker's next `ob_start` after the rebuild and reconnect.
- The session line says
  `Session_57.md was already taken and was not overwritten; this session's log is Session_58.md`.
- That log carries a `> **Session ID:**` line.
- A second `ob_start` prints the reuse marker.

**A4:** after A3, Maker deletes `Session_57.md`.
