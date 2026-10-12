# T-262 part 2: /end step 1b runs the skills audit; Cursor transcripts; `--seat`; the unaudited-session flag

Runtime: CC (claude -p, Sonnet 5.5)
SEAT: desktop one-off (no hub key). It spawns hooks and reads `~/.cursor`, so it runs on the desktop.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the desktop user's %TEMP% named t262-2-reply.md. Resolve and print that absolute path FIRST (§1).

**By:** Atlas (planner), 2026-10-12, session 168. **Task:** T-262 (P1). **Tag:** `T-262-2`. **Size:** MEDIUM.
**Parent:** `docs/loops/t262-skills-audit-extractor-brief.md` (part 1, merged at 2a78e12f). Its W1–W10 hold unless a row
here changes them. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.
**Base:** `d2208ae5f9603e11450741217b635c0d00d1846d`. If clark re-pins it at launch, the launch prompt says so and that SHA wins.

**Decision:** D-152, with **no veto** from Aaron on the three inferred defaults. The planner verified this in clark's
transcript, Aaron typing "no veto" at 2026-10-12T16:08:03Z. So:

- (a) a seat edits its own `-ops` skill with no per-script ask
- (b) the audit runs in-session at `/end`
- (c) `/end` is expected at every seat close

```text
IMPACT-TARGETS: auditSkills, readShellCommands (skills-audit); COMMAND_SPECS (one key gains two values); cli-session-end.ts (one new top-level block, no named symbol); cli-bootstrap.ts greeting notices (no named symbol); end-record-guard.ts gains two exports
```

## Why these four pieces

1. **/end step 1b** is the point of T-262: the seat rules on every repeated shape, ending in an edit or a decision,
   never in a queue.
2. **Cursor transcripts.** The dev seats are Cursor. Cursor writes
   `~/.cursor/projects/<key>/agent-transcripts/<uuid>/<uuid>.jsonl`, where each line is
   `{"role":"assistant","message":{"content":[{"type":"tool_use","name":"Shell","input":{"command":"…"}}]}}`, with
   no `type` field. That is the planner's read of real files on the desktop, e.g. sia-forge's `40641331…` (231 Shell
   calls). Part 1 reads only Claude Code transcripts, so `/end` under Cursor would always say "no transcripts".
3. **`--seat`.** clark ran the merged extractor in `~/Worktrees`, which has no `.agents/`. The result was `seat none ·
   ops none`, so stamp.sh ×107 and its other own scripts all showed as by-hand. Its skill is
   `~/.claude/skills/clark-ops/`.
4. **The unaudited flag** closes the gap the proposal named (§4 "Cheap"): a session that never ran the audit is
   named in the next greeting. A hook writes the note, and the seat is the one that acts on it.

## Rulings (do not re-decide)

| # | Ruling |
|---|---|
| P1 | **`AuditOptions` gains three optional fields:** `seat?: string`, `runtime?: "claude" \| "cursor"` (default `"claude"`), `transcript?: string`. **seat:** when given, it replaces W5's identity lookup (lowercased, trimmed); the ops dir rule is unchanged (`<home>/.claude/skills/<seat>-ops` if it exists). **transcript:** an absolute path to one transcript file. When given, it is this session, the transcript directory is the directory that holds it (for Cursor, the directory above its `<uuid>/` folder), and `session` is ignored. The window rule (W6) applies unchanged. |
| P2 | **Cursor discovery (`runtime: "cursor"`).** key = `projectDir.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+\|-+$/g, "")`. The directory is the entry of `<home>/.cursor/projects/` whose name equals the key, compared case-insensitively, plus `/agent-transcripts`. Each session is a subdirectory named by the UUID regex (no `.jsonl`), and its transcript is `<uuid>/<uuid>.jsonl` inside it. The mtime is that file's mtime. Nothing deeper is read. The error lines are the same as W9's with the Cursor directory named. **Before writing code, check the key rule:** in §1, run it on `C:\Users\melve\Worktrees\sia-forge` and confirm that `<home>/.cursor/projects/C-Users-melve-Worktrees-sia-forge` exists. Paste the result. |
| P3 | **`readShellCommands(file, runtime = "claude")`.** For `"claude"`, the rule is exactly W6, unchanged. For `"cursor"`, a parsed line counts if `role === "assistant"` and `message.content` is an array. From it, each item with `type === "tool_use"`, `name === "Shell"`, and a string `input.command` adds the command. The `unparsed` and blank-line rules are unchanged. `AuditReport` gains `runtime: "claude" \| "cursor"`. `renderAudit`'s first line is unchanged, except that ` · cursor` is appended when runtime is `cursor`. |
| P4 | **CLI.** `COMMAND_SPECS.skillsAudit.values` gains `"--seat": "both"` and `"--runtime": "both"`. `--runtime` must be `claude` or `cursor`, else stderr `Invalid --runtime: expected claude or cursor, got "<v>".` and exit 1. `--seat` must match `/^[A-Za-z][\w-]*$/`, else `Invalid --seat: expected a seat name, got "<v>".` and exit 1. The usage line becomes: `  skills-audit [--session <uuid>] [--last <n>] [--seat <name>] [--runtime claude\|cursor] [--json] [dir]   Read-only: shell commands this session repeated (T-262)`. |
| P5 | **SessionEnd flag**, in `cli-session-end.ts`, as **one new top-level `try { … } catch` block placed directly after the work-after-end block** (after its closing `catch`, around line 200). In order: (1) run only when `existsSync(join(dir, ".agents"))`, using the same `dir` expression as the block above, and `hookPayload.transcript_path` is a string naming an existing file; otherwise print nothing. (2) `audited` = some command from `readShellCommands(tp).commands` contains the substring `skills-audit`. If audited, print `[session-end] skills-audit check: audited in session`. (3) Otherwise `r = auditSkills({ projectDir: dir, home: homedir(), transcript: tp, last: 1 })` and `byHand = r.rows.filter(x => x.status === "by-hand")`. If empty, print `[session-end] skills-audit check: not audited, 0 by-hand hits`. (4) Otherwise `msg` = `SKILLS AUDIT NOT RUN: session <first 8 of r.session> closed without /end's skills audit; <byHand.length> command shape(s) repeated 3+ times by hand: <the first 3 rows as "<key> ×<thisSession>" joined by ", ">. Run /end at close (D-152).` Print `[session-end] <msg>` to stdout, then call `recordSkillsAuditNotice(dir, r.session, msg)`. (5) catch: print `[session-end] skills-audit check NOT RUN: <first line of the error>`. The block never throws and never changes the exit code. Claude Code only: Cursor fires no SessionEnd hook on our machines (T-245 A4). |
| P6 | **`end-record-guard.ts` gains two exports**, modelled on `recordWorkAfterEnd` / `takeWorkAfterEndNotices` and using the same `storePath`. Marker `.skills-audit-unaudited.jsonl`; shown file `.skills-audit-unaudited.shown.jsonl`. `recordSkillsAuditNotice(projectDir, sessionId, message)` **reads before it appends**: if the marker already holds a line whose `session` equals `sessionId`, it appends nothing. This is the T-258 F1 lesson: a doubled hook must not write twice. `takeSkillsAuditNotices(projectDir): string[]` is identical in shape to `takeWorkAfterEndNotices`; an unreadable line becomes `SKILLS AUDIT (unreadable marker line): <first 200 chars>`. Both are best-effort and never throw. |
| P7 | **Greeting.** In `cli-bootstrap.ts`, inside the existing `if (hasAgents)` block, directly after the `takeWorkAfterEndNotices` loop, add the same loop for `takeSkillsAuditNotices(cwd)`. |
| P8 | **`end.md`, step 1b.** Insert the section below **verbatim**, directly after section "## 1. Find the lessons" and before "## 2.", in `.claude/commands/end.md` and `project-template/.claude/commands/end.md` (these two must stay byte-identical). In step 4, append `` · Skills audit: {n} hits; scripted {keys}; proposed {keys}; dropped {n}`` inside the existing backticks, before the closing backtick. |
| P9 | **The Cursor twin**, `project-template/.cursor/commands/end.md`: the same section and the same step-4 change, with **two edits only**: in the command line, `skills-audit [--seat <name>]` becomes `skills-audit --runtime cursor [--seat <name>]`, and the clause `(in this repository: \`open-brain/build\`)` is kept as is. |

**The step 1b text (P8), verbatim:**

```markdown
## 1b. Audit the commands you repeated (D-152)

Run the extractor on this session. It reads your transcript and writes nothing:

`node <build>/cli.js skills-audit [--seat <name>] "<project dir>"`

`<build>` is the open-brain build directory named on the SessionStart hook's `CLI start` line (in this
repository: `open-brain/build`). Pass `--seat <name>` when the header says `seat none` but you have an
ops skill at `~/.claude/skills/<name>-ops/`.

For **each `by-hand` row**, do exactly one of these, in this session:

1. **Script it.** Add or extend a script in your own `~/.claude/skills/<seat>-ops/scripts/` and run it once,
   live. Your own ops skill needs no per-script ask (D-152).
2. **Propose it.** Anything outside your own ops skill (a shared skill, a `/sync` check, an `ob_state` op) is
   one line in the step 4 report, for clark to take to Aaron. Never write it to a file or a queue.
3. **Drop it, with a reason.** To stop it returning, add the key to `audit-ignore.txt` in your ops directory
   as `<key> # <reason>`. If the reason is "already scripted and I did not use it", that is a lesson for
   step 2, keyed `MATCH: command: <key>`.

`script` rows are your existing scripts at work; they need nothing. No rows: report `0 hits`. If the
command exits 1, report its stderr line instead. A session that skips this step is named in the next
greeting (`SKILLS AUDIT NOT RUN`).
```

**Out of scope:** `~/.claude/commands/end.md` (the user-level copy; clark updates it after merge), the `-ops`
skill directories, `GENERIC_PROGRAMS`, the hit threshold, sequence detection, and any hook registration file.

## The existing tests that pin this behaviour (planner-read)

| File | What it pins | Verdict |
|---|---|---|
| `tests/t262-skills-audit.test.ts` (31 rows, part 1) | W3–W10 | **Green, unedited.** P1–P3 are additive with defaults. SA-12's exact render has no ` · cursor`. |
| `tests/shared/cli-args.test.ts` `LINES` row `skills-audit` and "every declared flag of every command is accepted" | the usage line names every declared flag | **Green, unedited**, provided P4's usage line is used exactly. |
| `tests/t003-r2.test.ts` "end.md says what a write records…" | two sentences in all three `end.md` copies | Green, unedited. Step 1b does not touch them. |
| `tests/pipelines/sync/mirror-parity.test.ts` + `/sync` mirror-parity | `.claude/commands` ↔ `project-template/.claude/commands` parity | Green, if P8's two copies are byte-identical. |
| `tests/end-fix-r3-pins.test.ts`, `end-fix-r4-pins.test.ts`, `end-fix-q6/q10/q12`, `t048-r2b`, `shared/handoff-guard.test.ts` | the SessionEnd hook's other blocks and their stdout lines | **Green, unedited.** P5 adds lines after theirs and asserts nothing of theirs. |
| `tests/setup-hooks.test.ts` | hook registration | Green, unedited. |

No existing test may be edited.

## 1. Shell, Node, reply path, the key check

PowerShell. First, in this order:

```powershell
$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t262-2-reply.md"))
"REPLY_PATH=$reply"
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
node -v
$k = ('C:\Users\melve\Worktrees\sia-forge' -replace '[^A-Za-z0-9]+','-').Trim('-'); $k
Test-Path (Join-Path $env:USERPROFILE ".cursor\projects\$k\agent-transcripts")
```

If `node -v` is not `v22.*`: STOP, `BLOCKED T-262-2 node <version>`. If the key is not
`C-Users-melve-Worktrees-sia-forge`, or `Test-Path` is `False`: STOP, `BLOCKED T-262-2 cursor key <k>`.

## 2. Start state

```powershell
$wt = Join-Path $env:TEMP "t262-2-wt"
git clone -q https://github.com/melvenac/Self-Improving-Agent.git $wt
Set-Location $wt
git checkout -q -b feat/t262-part2 d2208ae5f9603e11450741217b635c0d00d1846d
git rev-parse HEAD          # must print d2208ae5f9603e11450741217b635c0d00d1846d
git status --porcelain      # must print nothing
Set-Location open-brain; npm ci; Set-Location ..
```

Any mismatch: STOP, BLOCKED. **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into
another checkout, and any write under the real `~/.claude` or `~/.cursor`. Tests use temp homes.

## 3. Commits (exactly three)

1. `T-262-2: tests (red)`: the new test file (§4) only. Run it and paste the result. Every row is red, except that
   rows which only exercise part-1 defaults may be green; name them.
2. `T-262-2: skills-audit reads Cursor transcripts, takes --seat and --transcript; SessionEnd names an unaudited session`:
   P1–P7.
3. `T-262-2: /end step 1b, the skills audit (D-152)`: P8–P9, the three `end.md` files only.

End every commit message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. After each commit
`git status --porcelain` is empty. At the end, `git log --oneline d2208ae5..HEAD` shows exactly 3 lines.

## 4. The new tests: `open-brain/tests/t262-part2.test.ts`

Reuse part 1's fixture conventions (temp `home` and `proj`, `AGENT.local.md` naming `Testseat`, uuids
`aaaaaaaa-0000-4000-8000-00000000000N`, `utimesSync` mtimes, ops dir `home/.claude/skills/testseat-ops/scripts/foo.sh`).
`cur(cmd)` returns `{ role: "assistant", message: { content: [{ type: "tool_use", name: "Shell", input: { command: cmd } }] } }`.
The Cursor directory is `home/.cursor/projects/<P2 key of proj>/agent-transcripts/<uuid>/<uuid>.jsonl`.

| Row | Setup | Assert |
|---|---|---|
| P2-1 | Cursor session 1: `cur("git fetch")` ×3, plus one line in Claude shape `sh("git log")` ×3 | `auditSkills({ projectDir: proj, home, runtime: "cursor" })`: one row `git fetch`, `thisSession: 3`. `runtime` is `"cursor"`. |
| P2-2 | Cursor sessions 1 and 2 (session 2 newer), each `cur("git fetch")` ×3; a stray file `agent-transcripts/x.jsonl` with `cur("git push")` ×3 | `window` equals `[uuid2, uuid1]`. There is no `git push` row. |
| P2-3 | Claude session 1 holding `cur("git fetch")` ×3 | Default runtime: `rows` is empty and `shellCalls` is 0. |
| P2-4 | No `.agents` identity in `proj` (delete `AGENT.local.md`); ops dir `home/.claude/skills/clark-ops/scripts/stamp.sh`; Claude session `bash C:/x/stamp.sh a` ×3 | Without `seat`: `seat` is `null` and the row is `by-hand`. With `seat: "Clark"`: `seat` is `"clark"`, the row is `script`, and `scriptsCalled` equals `[{ script: "stamp.sh", count: 3 }]`. |
| P2-5 | Claude sessions 1 and 2 | `transcript: <abs path of session 1>`: `session` is uuid1 and `window` equals `[uuid1]`. |
| P2-6 | as P2-1 | `renderAudit` first line ends with ` · cursor`. |
| P2-7 (CLI) | as P2-1 | `skills-audit --runtime cursor <proj>`: exit 0, stdout line 1 contains `· cursor`. `--runtime vim`: exit 1, stderr `Invalid --runtime`. `--seat "a b"`: exit 1, stderr `Invalid --seat`. |
| H-1 (hook) | `proj` with `.agents/` (AGENT.local.md as above) and a git repo (`git init`, one commit). Transcript `t.jsonl` = Claude session holding `sh("git fetch")` ×3 and `sh("git log")` ×1 | Spawn the SessionEnd hook the way `end-fix-r3-pins.test.ts` R7 does, payload `{ session_id: uuid1, transcript_path: t, hook_event_name: "SessionEnd" }`, `CLAUDE_PROJECT_DIR = proj`, `HOME`/`USERPROFILE` = `home`. Exit 0. stdout contains `SKILLS AUDIT NOT RUN: session aaaaaaaa` and `git fetch ×3`. Then `takeSkillsAuditNotices(proj)` returns exactly 1 message with that text, and a second call returns `[]`. |
| H-2 | as H-1, plus `sh("node C:/b/cli.js skills-audit .")` ×1 | stdout contains `skills-audit check: audited in session`. `takeSkillsAuditNotices(proj)` is `[]`. |
| H-3 | as H-1 but `git fetch` ×2 | stdout contains `not audited, 0 by-hand hits`. No notice. |
| H-4 | as H-1, the hook spawned **twice** in sequence | `takeSkillsAuditNotices(proj)` returns exactly 1 message (P6 dedupe). |
| H-5 | as H-1, but `proj` has no `.agents/` | stdout contains no `skills-audit check` line and no `SKILLS AUDIT`. |
| H-6 | as H-1, transcript path names a missing file | Exit 0. No `SKILLS AUDIT` line. |
| D-1 (docs) | read the three `end.md` files | Each contains `## 1b. Audit the commands you repeated (D-152)` and `Skills audit: {n} hits`. The two `.claude` copies are byte-identical. The Cursor copy contains `skills-audit --runtime cursor [--seat <name>]`; the two `.claude` copies do not contain `--runtime`. |

120 s timeout per test, no sleeps.

## 5. Mutants (edit, run `t262-part2.test.ts`, `git checkout -- <file>`, confirm a clean tree; never commit one)

| Id | Edit | Expected red |
|---|---|---|
| M1 | `readShellCommands` cursor branch accepts `name === "Bash"` instead of `"Shell"` | P2-1 |
| M2 | Cursor discovery also reads `*.jsonl` directly in `agent-transcripts/` | P2-2 |
| M3 | Ignore `opts.seat` | P2-4 |
| M4 | P6 append without the read-before-write check | H-4 |
| M5 | `audited` always `false` | H-2 |
| M6 | Drop the `.agents` guard in P5 | H-5 |

Paste each result line.

## 6. Runs (desktop; never the whole suite)

```powershell
Set-Location (Join-Path $wt "open-brain")
npx tsc --noEmit; "tsc exit $LASTEXITCODE"
npx vitest run tests/t262-part2.test.ts tests/t262-skills-audit.test.ts tests/shared/cli-args.test.ts tests/t003-r2.test.ts tests/pipelines/sync/mirror-parity.test.ts tests/end-fix-r3-pins.test.ts tests/end-fix-r4-pins.test.ts tests/shared/handoff-guard.test.ts tests/pipelines/sync/module-boundary.test.ts --no-file-parallelism --testTimeout=180000
npm run build; "build exit $LASTEXITCODE"
node build/cli.js sync --check 2>&1 | Select-String -Pattern "mirror-parity|module-boundary"
node build/cli.js skills-audit --runtime cursor C:\Users\melve\Worktrees\sia-forge; "cursor exit $LASTEXITCODE"
node build/cli.js skills-audit --seat clark C:\Users\melve\Worktrees; "clark exit $LASTEXITCODE"
```

The last two are **read-only live checks on real transcripts**. Paste the header line and the `scripts called:` line
of each. Expect: the first shows ` · cursor` and a non-zero shell-call count. The second shows
`seat clark · ops …clark-ops`, with at least one `script` row or a `scripts called:` entry for stamp.sh.

**Known reds on the desktop (environmental):** cli-flags R185-8, the suite-run-meta same-owner lease, config-channel
CA-4c, and the server.test.ts 5 s timeout. None of these files is in the run list. For any red in a listed existing
file, run it at the base (`git worktree add $env:TEMP\t262-2-base d2208ae5`, `npm ci` there) and paste both. A red
that is also red at the base is not yours.

## 7. Scope check, then push

`git diff --name-only d2208ae5..HEAD` must show exactly:

- `.claude/commands/end.md`
- `open-brain/src/cli-bootstrap.ts`
- `open-brain/src/cli-session-end.ts`
- `open-brain/src/cli-spec.ts`
- `open-brain/src/cli.ts`
- `open-brain/src/pipelines/skills-audit/index.ts`
- `open-brain/src/shared/end-record-guard.ts`
- `open-brain/tests/t262-part2.test.ts`
- `project-template/.claude/commands/end.md`
- `project-template/.cursor/commands/end.md`

Any other path: STOP, BLOCKED.

```powershell
git push origin feat/t262-part2
git ls-remote origin refs/heads/feat/t262-part2   # must equal git rev-parse HEAD
gh pr create --base master --head feat/t262-part2 --title "T-262 part 2: /end step 1b skills audit, Cursor transcripts, --seat, unaudited-session flag" --body "Brief: docs/loops/t262-part2-end-audit-brief.md. D-152 (no veto)."
```

Never force-push. Push rejected: STOP, BLOCKED.

## 8. STOP rules and reply

- At most 2 attempts at any one red, then BLOCKED. Never edit an existing test. Never touch a file outside §7.
  A STOP still writes the reply.
- The reply's first line is `READY T-262-2 <sha40> PR #<n>` or `BLOCKED T-262-2 <reason>`. Then, each with its
  command shown above it: `node -v` and the key check, the start state, the red run, each mutant's line, tsc, the
  vitest summary, build, the `sync --check` lines, both live checks, the name-only diff, `ls-remote` = `rev-parse`,
  and the PR URL. Name any HIGH, CRITICAL or UNKNOWN IMPACT-TARGET and say which tests cover its callers. Report any
  deviation from a ruling with its reason. Mark anything not run `NOT RUN`.
