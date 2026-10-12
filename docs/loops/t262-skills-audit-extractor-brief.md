# T-262 part 1: `open-brain skills-audit`, a read-only extractor of repeated shell commands

Runtime: CC (claude -p, Sonnet 5.5)
SEAT: desktop one-off (no hub key)
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the desktop user's %TEMP% named t262-reply.md. Resolve and print that absolute path FIRST (§1), before any test sets a temp HOME.

**By:** Atlas (planner), 2026-10-12, session 168. **Task:** T-262 (P1). **Tag:** `T-262-1`. **Decision:** D-152.
Aaron (verified relay, 10-12 03:23Z): "agents adding their repeated steps to their own skills at end, Atlas's
proposal... I agree". **Size:** MEDIUM. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.
**Base:** `87f71732a67edf6b157b1b843318bd27dd264c18` (origin/master after #607). If clark re-pins the base at launch,
the launch prompt says so and that SHA wins.

```text
IMPACT-TARGETS: COMMAND_SPECS — one new key; cli.ts gains one top-level branch and one usage line (no named symbol)
```

## Why, and why only the extractor

The proposal is `docs/loops/end-skills-audit-proposal-2026-10-11.md`. In short: at `/end` a seat looks at the shell
commands it repeated and either scripts each one into its own `-ops` skill, proposes it, or drops it with a reason.
The Loop 10 skill scan found repeats too, but it wrote them to a queue nobody owned (39 proposals, 0 skills). So
**an audit must end in an edit or a decision, never in a queue.**

**This brief builds part 1 only**: the deterministic extractor. It reads transcripts, writes nothing and costs no
model tokens, so it is safe whatever Aaron rules on the open defaults below. Part 2 (the `/end` step 1b text in
`end.md` and its Cursor twin, and the SessionEnd flag for an unaudited session) gets its own brief after:

1. Aaron has had the chance to veto the three D-152 defaults clark inferred. **These are flagged here, not decided:**
   - (a) a seat's edits to its own `-ops` skill need no per-script ask
   - (b) the audit runs in-session at `/end`, not in a hook that spawns `claude -p`
   - (c) `/end` is expected at every seat close
2. The planner has run the merged extractor on real seat transcripts.

**Kill criterion (an acceptance row of T-262, measured in part 2):** cut the audit if, after 20 `/end` runs across
seats, no script it led to was called by a later session. This extractor's `scripts called:` line is the instrument.

## The design (planner rulings; do not re-decide)

The planner prototyped this on its own last 5 transcripts (1,076 shell calls) before writing the rules. The
findings that shaped them:

- **Keying on the full normalised command found almost nothing.** One shape repeated 3 or more times in a 172-call
  session. Keying on the first word alone was swamped by `grep`, `sed` and `cat`. The key below, "program plus
  subcommand or script name, generic tools dropped", gave about 20 readable rows per session.
- **Sequence detection is out.** Windows of consecutive calls were dominated by `git fetch` next to everything:
  the top 10 sequences all contained `git fetch` or `node -e`. No signal, so no sequences in part 1.
- **The proposal's "substring match against the skill" is out.** It marked `git fetch` as covered, because a script
  calls it, while the seat ran it 163 times by hand. Coverage is decided only by the exact rules in W4.

| # | Ruling |
|---|---|
| W1 | **New module** `open-brain/src/pipelines/skills-audit/index.ts`. It imports only `node:` built-ins and `../session-start/agent-identity.js` / `../session-start/session-discovery.js`, never `better-sqlite3`, `db-v2` or `server`. It is CORE by the module-boundary rule (unlisted = core); do not add it to `MEMORY_SIDE`. |
| W2 | **Exports, exactly:** `GENERIC_PROGRAMS: ReadonlySet<string>`, `commandKeys(command: string): string[]`, `readShellCommands(file: string): { commands: string[]; unparsed: number }`, `auditSkills(opts: AuditOptions): AuditReport`, `renderAudit(report: AuditReport): string`. The types are in §W6. |
| W3 | **`commandKeys`**, in this order: (1) cut the string at the first match of `/<<-?'?\w+'?/` and keep the part before it (heredoc bodies are data); (2) replace every match of `/"(?:[^"\\]|\\.)*"|'[^']*'/g` with `Q`, then every match of `/\$\([^()]*\)/g` with `Q`; (3) split on `/\s*(?:&&|\|\||;|\||\n)\s*/`; (4) for each segment: trim it; remove leading assignments matching `/^(\w+=\S*\s+)+/`; split on `/\s+/`; let `p` be the first token with everything up to its last `/` or `\` removed; skip the segment if `p` fails `/^[A-Za-z][\w.-]*$/` or is in `GENERIC_PROGRAMS`; (5) if `p` is `gh`, `git`, `npm` or `npx`: key = `p` + the later tokens matching `/^[a-z][a-z-]*$/`, in order, at most 2 for `gh` and 1 for the others, joined by single spaces; (6) if `p` is `node`, `bash`, `sh`, `python`, `tsx`, `pwsh` or `powershell`: the first later token matching `/\.(m?js|cjs|ts|sh|py|ps1)['"]?$/`, with quotes removed and its path stripped as in (4), gives key `p + " " + basename`; otherwise, if the next token is `-e`, the key is `p + " -e"`; otherwise it is `p`; (7) any other `p` is the key. Return the keys in first-seen order, **deduplicated** (one command counts a key once). |
| W3a | **`GENERIC_PROGRAMS`, exactly these 50:** `grep sed cat head tail wc ls echo awk sleep for while if printf cut sort uniq tr test true mkdir rm cp mv cd export set done do then fi iconv find xargs jq Get-Content Select-Object Select-String Write-Output break continue exit case esac timeout date return local read Q` |
| W4 | **Status of a key:** `ignored` if the seat's `audit-ignore.txt` lists it (W5). Else `script` if the key has two or more words and its last word is the exact file name of an entry in the ops `scripts/` directory. Else `by-hand`. A seat with no ops directory has only `by-hand` keys. |
| W5 | **Seat and ops directory.** seat = `readAgentIdentity(projectDir)?.name.toLowerCase()`, or `null`. ops = `join(home, ".claude", "skills", seat + "-ops")` when the seat is set and that directory exists, else `null`. `audit-ignore.txt` sits in the ops directory. One key per line; text after the first ` # ` is a reason and is ignored; blank lines and lines starting with `#` are skipped; keys are trimmed and compared exactly. A missing file means nothing is ignored. |
| W6 | **Transcripts.** projects = `join(home, ".claude", "projects")`. The transcript directory is the entry there whose name equals `deriveProjectKey(projectDir).toLowerCase()`, compared case-insensitively, the same match `discoverSessionUuid` uses. The files are `<uuid>.jsonl` directly in that directory, where the name matches `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/`. Subdirectories (subagent transcripts) are never read. **This session** is `opts.session` when given (it must exist), else the newest file by mtime. **The window** is this session plus the files older than it (by mtime, ties broken by name ascending), newest first, `opts.last` files in all (default 5, minimum 1). `readShellCommands` reads a file line by line: a line that does not `JSON.parse` adds 1 to `unparsed`; a parsed line counts only if `type === "assistant"`, `isSidechain !== true`, and `message.content` is an array; from it, each item with `type === "tool_use"`, `name` of `"Bash"` or `"PowerShell"`, and a string `input.command` adds that command. Types: `AuditOptions = { projectDir: string; home: string; session?: string; last?: number }`. `AuditReport = { seat: string \| null; opsDir: string \| null; transcriptDir: string; session: string; window: string[]; shellCalls: number; unparsed: number; rows: AuditRow[]; ignoredHits: number; scriptsCalled: { script: string; count: number }[] }`. `AuditRow = { key: string; thisSession: number; sessions: number; windowTotal: number; status: "by-hand" \| "script" }`. |
| W7 | **Rows.** Count keys per command (W3) over this session and over the window. A key is a **hit** when its this-session count is **3 or more**. Hits with status `ignored` are counted in `ignoredHits` and get no row. `rows` holds the other hits, sorted by `thisSession` descending, then `key` ascending. `scriptsCalled` lists every key with status `script` and a this-session count of 1 or more (not only hits), as `{ script: <last word>, count }`, sorted by count descending, then script ascending. `shellCalls` and `unparsed` are this session's only. |
| W8 | **`renderAudit`**, lines in this order: `skills-audit: seat <seat\|none> · ops <opsDir\|none> · session <first 8 chars> · window <window.length> sessions · <shellCalls> shell calls · <unparsed> unparsed lines`; then `this  sess  window  status   key`; then one line per row: `String(thisSession).padStart(4)`, two spaces, `String(sessions).padStart(4)`, two spaces, `String(windowTotal).padStart(6)`, two spaces, `status.padEnd(7)`, two spaces, the key; then `hits: <by-hand rows> by-hand, <script rows> script, <ignoredHits> ignored`; then `scripts called: ` followed by `<script>×<count>` items joined by `, `, or `none`. Lines are joined with `\n`, with no trailing newline. |
| W9 | **CLI.** `cli-spec.ts` gains `skillsAudit: { name: "skills-audit", booleans: ["--json"], values: { "--session": "both", "--last": "both" }, positionals: "directory" }`. `cli.ts` gains a branch `else if (command === "skills-audit")`, placed directly after the `topics` branch. It parses with `parseOrRefuse(COMMAND_SPECS.skillsAudit, args.slice(1))` and takes the directory as `resolve(opts.directory ?? ".")`, the way the `start` branch does. `--last` must be an integer of 1 or more, else it prints `Invalid --last: expected a positive integer, got "<v>".` to stderr and exits 1. `home` is `homedir()` from `node:os`. When there is no transcript directory, or `--session` names no file, it prints `skills-audit: no transcripts for <projectDir> under <projects>` (or `skills-audit: no transcript <session>.jsonl in <transcriptDir>`) to stderr and exits 1. Otherwise it prints `renderAudit(report)` or, with `--json`, `JSON.stringify(report, null, 2)`, and exits 0. It imports the module dynamically, as the other branches do. **Usage line**, placed directly after the `topics` line: `  skills-audit [--session <uuid>] [--last <n>] [--json] [dir]   Read-only: shell commands this session repeated (T-262)` |
| W10 | **It writes nothing**: no file, no directory, no DB, no network. |

**Out of scope, do not touch:** `end.md` (all copies), `cli-session-end.ts`, any hook, the `-ops` skill directories,
`MEMORY_SIDE`, and sequence detection.

## The existing tests that pin this behaviour (planner-read)

| File | What it pins | Verdict |
|---|---|---|
| `tests/shared/cli-args.test.ts` "walks at least the thirteen commands" (line ~158) | the exact sorted list of `COMMAND_SPECS` names | **Turns red. Edit it in commit 1:** add `"skills-audit"` to the array between `"start"` and `"state erasures"` (sorted order), and change the test title to `"walks at least the fourteen commands (proves it looked)"`. |
| `tests/shared/cli-args.test.ts` `LINES` (line ~200) and "names a usage line for every command it declares" | one usage regex per spec | **Turns red. Edit it in commit 1:** add `["skills-audit", /^\s+skills-audit (.*)$/m],` directly after the `topics` row. The flag rows then check `--session`, `--last` and `--json` against W9's usage line. |
| `tests/shared/cli-args.test.ts` "every declared flag of every command is accepted" | parses each declared flag | Green once the spec exists (it walks the new spec too). |
| `tests/pipelines/sync/module-boundary.test.ts` | the boundary checker, on fixtures | Green, unedited. |
| `tests/cli-flags.test.ts` | flag typos refuse | Green, unedited. |

These two `cli-args.test.ts` edits are the **only** edits to an existing test this brief allows.

## 1. Shell, Node and the reply path

PowerShell. Run these first, in this order, and paste the output:

```powershell
$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t262-reply.md"))
"REPLY_PATH=$reply"
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
node -v
```

If `node -v` is not `v22.*`, STOP and write `BLOCKED T-262-1 node <version>` to `$reply`.

## 2. Start state

Work in a fresh clone under `$env:TEMP`. Never use the main checkout `C:\Users\melve\Projects\Self-Improving-Agent`.

```powershell
$wt = Join-Path $env:TEMP "t262-wt"
git clone -q https://github.com/melvenac/Self-Improving-Agent.git $wt
Set-Location $wt
git checkout -q -b feat/t262-skills-audit 87f71732a67edf6b157b1b843318bd27dd264c18
git rev-parse HEAD          # must print 87f71732a67edf6b157b1b843318bd27dd264c18
git status --porcelain      # must print nothing
Set-Location open-brain; npm ci; Set-Location ..
```

Any mismatch: STOP, BLOCKED. **Forbidden:** `git stash`, `reset --hard`, `--force` in any form, rebase, amend, and
`cd` into any other checkout.

## 3. Commits (exactly two, in this order)

1. **Tests first, red.** Create `open-brain/tests/t262-skills-audit.test.ts` (§4) and make the two `cli-args.test.ts`
   edits from the table above. Commit message: `T-262-1: tests (red)`. Run both files and paste the result: every
   row of the new file fails (the module does not exist yet, so a collection error counts as red), and in
   `cli-args.test.ts` the "thirteen/fourteen" row and the usage rows fail. Everything else stays green.
2. **The extractor and the CLI.** Add the module, the spec entry, the `cli.ts` branch and the usage line. Commit
   message: `T-262-1: open-brain skills-audit lists the shell commands a session repeated (read-only)`.

End every commit message with:

```
Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

After each commit, `git status --porcelain` must be empty. At the end, `git log --oneline 87f71732..HEAD` must show
exactly 2 lines.

## 4. The new tests: `open-brain/tests/t262-skills-audit.test.ts`

**Key rows (pure; call `commandKeys`).** Every expected value was measured on the planner's prototype of W3.
Write inputs that contain a backslash with ``String.raw`…` ``.

| Row | Input | Expected |
|---|---|---|
| K1 | `cd C:/x && git fetch origin -q && git log --oneline -3` | `["git fetch", "git log"]` |
| K2 | `S=C:/a/scripts; bash $S/records-pr.sh docs/x "C:/m.txt"` | `["bash records-pr.sh"]` |
| K3 | `node -e "const a=1; for(const x of y){}"` | `["node -e"]` |
| K4 | `gh pr view 602 --json state \| jq .state` | `["gh pr view"]` |
| K5 | `cat > f <<'EOF'` + `\n` + `git push` + `\n` + `EOF` | `[]` |
| K6 | `grep -n x f \| head` | `[]` |
| K7 | ``String.raw`HUB_URL=http://h:4000 node C:\tools\hub-talk.mjs --as atlas` `` | `["node hub-talk.mjs"]` |
| K8 | `git add a && git add b` | `["git add"]` |
| K9 | `npx vitest run tests/a.test.ts` | `["npx vitest"]` |
| K10 | `Get-Content f \| Select-Object -First 3` | `[]` |
| K11 | `git commit -q -m "a; git push` + `\n` + `more && gh pr merge"` | `["git commit"]` |
| K12 | `for i in 1 2; do gh pr checks 602; sleep 5; done` | `[]` |
| K13 | `GENERIC_PROGRAMS.size` | `50` |

K12 is `[]` on purpose. `for` takes the segment and `do gh` is not split from it, so a loop body is not counted.
Assert this exactly. It is a stated limit, not a bug to fix.

**Fixture for the audit rows.** In `beforeEach`, make `home = mkdtempSync(join(tmpdir(), "t262-home-"))` and
`proj = mkdtempSync(join(tmpdir(), "t262-proj-"))`. Write `proj/.agents/AGENT.local.md` with
`---\nname: Testseat\nrole: planner\n---\n`. The transcript directory is
`join(home, ".claude", "projects", deriveProjectKey(proj))`. A helper `writeSession(uuid, mtimeSec, lines)` writes
`<uuid>.jsonl` (one JSON object per line) and sets its mtime with `utimesSync(path, mtimeSec, mtimeSec)`. A helper
`sh(cmd, name = "Bash")` returns `{ type: "assistant", message: { content: [{ type: "tool_use", name, input: { command: cmd } }] } }`.
Use the uuids `aaaaaaaa-0000-4000-8000-00000000000N` for N = 1…6 and mtimes `1_700_000_000 + N*100`. The ops
directory, when a row needs one, is `home/.claude/skills/testseat-ops/` with `scripts/foo.sh` (content `echo`).
Remove both temp directories in `afterEach`.

| Row | Setup | Assert (`auditSkills({ projectDir: proj, home, ...})` unless stated) |
|---|---|---|
| SA-1 | Session 1 only: `git fetch` ×3, `git log` ×2. | One row: `{ key: "git fetch", thisSession: 3, sessions: 1, windowTotal: 3, status: "by-hand" }`. |
| SA-2 | Session 1: `git fetch` ×1. Session 2: `git fetch` ×3. | Session 2 is this session. The row has `thisSession: 3, sessions: 2, windowTotal: 4`. `window` equals `[uuid2, uuid1]`. |
| SA-3 | Ops dir with `scripts/foo.sh`. Session 1: `bash C:/s/foo.sh a` ×3, `node -e "x"` ×1. | Row `bash foo.sh` has status `script`. `scriptsCalled` equals `[{ script: "foo.sh", count: 3 }]`. |
| SA-4 | Ops dir; `audit-ignore.txt` = `# comment\n\ngh pr view # read-only lookups\n`. Session 1: `gh pr view 1` ×3. | `rows` is empty. `ignoredHits` is 1. |
| SA-5 | Session 1: `git push` ×3 in lines carrying `isSidechain: true`; `git push` ×3 in `{ type: "user", ... }` lines; a `tool_use` named `Read` with `input.command: "git push"` ×3. | `rows` is empty. `shellCalls` is 0. |
| SA-6 | Session 1: `git push` ×3 and one line `not json`. | `unparsed` is 1. `shellCalls` is 3. |
| SA-7 | Sessions 1–6, each with `git fetch` ×3. | `last: 5` by default: `window.length` is 5, and the row has `sessions: 5, windowTotal: 15`. With `session: uuid3`: `window` equals `[uuid3, uuid2, uuid1]`. |
| SA-8 | No ops dir; session 1: `bash foo.sh` ×3. | `opsDir` is `null`. The row's status is `by-hand`. `scriptsCalled` is `[]`. |
| SA-9 | A subdirectory `<uuid1>/subagents/x.jsonl` holding `git push` ×3, plus session 1 with `git log` ×3. | Only `git log` has a row. |
| SA-10 | `sh(cmd, "PowerShell")` ×3 with `git status`. | Row `git status`, `thisSession: 3`. |
| SA-11 | Session 1 as in SA-3. Snapshot every path under `home` and `proj` with its size and mtimeMs, run `auditSkills` and `renderAudit`, then snapshot again. | The two snapshots are equal. |
| SA-12 | Session 1 as in SA-3. | `renderAudit` equals, exactly: `skills-audit: seat testseat · ops <opsDir> · session aaaaaaaa · window 1 sessions · 4 shell calls · 0 unparsed lines\nthis  sess  window  status   key\n   3     1       3  script   bash foo.sh\nhits: 0 by-hand, 1 script, 0 ignored\nscripts called: foo.sh×3`, where `<opsDir>` is the value in the report. |

**CLI rows (spawn).** Use the spawn pattern of `tests/t154-cli-start.test.ts`: `spawnSync(process.execPath, [tsxCli, cliEntry, ...args], { cwd, encoding: "utf8", env, timeout: 90_000 })`, with `env = { ...process.env, HOME: home, USERPROFILE: home }`.

| Row | Setup | Assert |
|---|---|---|
| SC-1 | Fixture as SA-3; run `skills-audit <proj>` with `NODE_OPTIONS=--import=<file URL of tests/fixtures/deny-sqlite.mjs>`. | Exit 0. stdout's first line starts `skills-audit: seat testseat`. stderr does not contain `T-154 deny`. |
| SC-2 | Same fixture; `skills-audit --json <proj>`. | Exit 0. `JSON.parse(stdout).rows[0].key` is `"bash foo.sh"`. |
| SC-3 | Empty `home`; `skills-audit <proj>`. | Exit 1. stderr contains `skills-audit: no transcripts for`. |
| SC-4 | Fixture as SA-3; `skills-audit --last=0 <proj>`. | Exit 1. stderr contains `Invalid --last`. |
| SC-5 | Fixture as SA-3; `skills-audit --session aaaaaaaa-0000-4000-8000-000000000009 <proj>`. | Exit 1. stderr contains `skills-audit: no transcript`. |

All timeouts are 120 s per test, with no real sleeps.

## 5. Mutants (edit, run `t262-skills-audit.test.ts`, `git checkout -- <file>`, then confirm a clean tree; never commit one)

| Id | Edit in `skills-audit/index.ts` | Expected red |
|---|---|---|
| M1 | Remove `"for"` from `GENERIC_PROGRAMS` | K12, K13 |
| M2 | Change the hit threshold from `>= 3` to `>= 2` | SA-1 (git log becomes a row) |
| M3 | Drop the `isSidechain !== true` condition | SA-5 |
| M4 | Read `.jsonl` files in subdirectories too (recursive) | SA-9 |
| M5 | Remove the step-(2) quote replacement | K11 |
| M6 | Mark a key `script` when its last word merely CONTAINS a script name (`includes` instead of `===`) | add no row; report whether any row goes red. If none does, say so: the planner will decide whether a row is missing. |

For each mutant, paste the result line.

## 6. Test runs (desktop; never the whole suite)

```powershell
Set-Location (Join-Path $wt "open-brain")
npx tsc --noEmit; "tsc exit $LASTEXITCODE"          # expect 0
npx vitest run tests/t262-skills-audit.test.ts tests/shared/cli-args.test.ts tests/cli-flags.test.ts tests/pipelines/sync/module-boundary.test.ts --no-file-parallelism --testTimeout=180000
npm run build; "build exit $LASTEXITCODE"            # expect 0
node build/cli.js sync --check 2>&1 | Select-String -Pattern "module-boundary"
node build/cli.js skills-audit $wt; "audit exit $LASTEXITCODE"
```

The last command runs against the clone itself. It has no transcripts in the real HOME, so it must exit 1 with
`skills-audit: no transcripts for`. Paste it. Cap the wall-clock at 20 minutes. Afterwards, list any leftover node
processes; do not kill them.

**Known red on this desktop (environmental; s168):** `cli-flags` R185-8 (a clone under `%TEMP%` defeats its "outside
the temp dir" check). For **any** red row in an existing file, run the same file at the base and paste both outputs:
`git worktree add $env:TEMP\t262-base 87f71732`, then `npm ci` there. A red that is also red at the base is not yours.
A red that is green at the base is yours: fix it, with at most 2 attempts, then BLOCKED.

## 7. Scope check, then push

```powershell
git diff --name-only 87f71732a67edf6b157b1b843318bd27dd264c18..HEAD
```

**Allowed, and exactly these:**

- `open-brain/src/pipelines/skills-audit/index.ts`
- `open-brain/src/cli-spec.ts`
- `open-brain/src/cli.ts`
- `open-brain/tests/t262-skills-audit.test.ts`
- `open-brain/tests/shared/cli-args.test.ts`

Any other path: STOP, BLOCKED.

```powershell
git push origin feat/t262-skills-audit
git ls-remote origin refs/heads/feat/t262-skills-audit   # must equal git rev-parse HEAD
gh pr create --base master --head feat/t262-skills-audit --title "T-262 part 1: open-brain skills-audit (read-only repeated-command extractor)" --body "Brief: docs/loops/t262-skills-audit-extractor-brief.md. D-152."
```

Never force-push. If the push is rejected: STOP, BLOCKED.

## 8. STOP rules

- At most 2 attempts at any one red; then BLOCKED.
- Never edit an existing test to make it pass, except the two `cli-args.test.ts` edits named above.
- Never touch a file outside §7's list.
- A STOP still writes the reply.

## 9. Reply (write to `$reply`; the first line is the grammar)

- First line: `READY T-262-1 <sha40 of HEAD> PR #<n>` or `BLOCKED T-262-1 <one-line reason>`.
- Then, each with the command shown above its pasted output:
  - `node -v`
  - the start-state proof
  - the `T-262-1: tests (red)` run
  - each mutant's result line
  - tsc
  - the §6 vitest summary
  - build
  - the `sync --check` line
  - the `skills-audit` run on the clone
  - the §7 name-only diff
  - `ls-remote` and `rev-parse`
  - the PR URL
- Name any HIGH, CRITICAL or UNKNOWN IMPACT-TARGET, and say which tests cover its callers.
- Mark anything not run `NOT RUN`.
