# T-182: declare the minimum Claude Code version, refuse below it before any tag, and make CA-9 name both versions

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop one-off (no hub key). Code only. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t182-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 168. **Task:** T-182 (P1). **Tag:** `T-182`. **Size:** SMALL-MEDIUM.
**Base:** `304d56392c8e2fdab33b08a66daae96ece46ab5d` (origin/master; its code equals 399121cd). If clark re-pins it at
launch, that SHA wins. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: claudeAdapter CLAUDE_ADAPTER_FLAGS ProcessRole.preflight runLoop (covered by tests/harness/process-role.test.ts, spawn-sites.test.ts, effort-policy.test.ts, policies.test.ts, checks.test.ts)
```

## Why

T-182 (read its note in `.agents/state.json`): the harness's claude adapter passes flags an older Claude Code lacks.
On tcm, CA-9 failed as "flag --permission-prompts is gone" and named neither version. Verified at 399121cd:
`CLAUDE_ADAPTER_FLAGS` (`src/harness/roles.ts:305-316`) has ten flags, `--effort` included (T-173); no minimum version is
declared anywhere; CA-9 (`tests/harness/process-role.test.ts:313-323`) stops at the first missing flag and checks by
SUBSTRING, so on 2.1.296 `--permission-prompt-tool` (only in a description) and `--strict-mcp-config` (only in
`--restricted`'s description) count as defined; and on an old CLI the runtime fails LATE: it tags the base, runs the
planner stage, retries the developer 3 times and ends `schema-cap-exhausted`, with the real cause only in a stderr tail.
**Planner ruling:** refuse at preflight, before any tag (deterministic, the CA-3 pattern). Updating tcm's Claude Code is
Aaron's call and out of scope.

## Ruling (exact names; paths under `open-brain/`)

1. **`src/harness/roles.ts`**, after the flag list:
   - `export const MIN_CLAUDE_CODE_VERSION = "2.1.282";` with a doc comment: the LOWEST version measured with every
     flag present (QA 104 on the QA PC: CA-9 passed on 2.1.282, and `docs/loops/qa-104/drive.ps1` ran it with
     `--effort`); it is not the version that introduced the flags; lowering it needs a measurement.
   - `export function parseClaudeVersion(stdout: string): string | null`: the first non-empty line, trimmed, must match
     `/^(\d+)\.(\d+)\.(\d+)(?: \(Claude Code\))?$/`; returns `"x.y.z"` or null.
   - `export function claudeVersionAtLeast(installed: string, required: string): boolean`: numeric per part.
   - `export function missingClaudeFlags(help: string, flags: readonly string[] = CLAUDE_ADAPTER_FLAGS): string[]`: reads
     option names only from option lines (`/^ {2}(-{1,2}[^\s,]+(?:, -{1,2}[^\s,]+)*)/`, split on `", "`), returns every
     missing flag in list order.
   - `export function claudeFlagReport(installed: string | null, missing: readonly string[], versionStdout: string): string`:
     `installed 2.1.250, required >= 2.1.282, missing flag(s): --permission-prompts, --effort`; with none missing it ends
     `missing flag(s): none`; an unparseable version starts `installed unreadable (claude --version printed "<first line>")`.
   - `RoleAdapter` gains optional `preflightCheck?(resolution, env)`; `claudeAdapter` implements it (NOT inside
     `resolve`, which would produce `role-unresolvable` and the wrong text at `runtime.ts:543-544`). The failure case of
     `Preflight` gains `kind: "unresolvable" | "unsupported"`. `ProcessRole.preflight()` (`:454-460`) calls the check
     after `resolve`, with the env it already builds. `commandAdapter` has no check (fake-role tests unaffected). Rewrite
     the comment at `:334-337` (it says an old CLI failing late is "intended").
   - Reasons: too old → `Claude Code ${installed} is installed at ${resolvedFrom}; the claude adapter requires >= ${MIN_CLAUDE_CODE_VERSION}`;
     unreadable → `${resolvedFrom} --version printed ${JSON.stringify(line)}, not a Claude Code version; the claude adapter requires >= ${MIN_CLAUDE_CODE_VERSION}`.
2. **`src/harness/process.ts`:** `export function probeVersion(executable: string, preArgs: readonly string[], env: NodeJS.ProcessEnv)`
   = `spawnSync(executable, [...preArgs, "--version"], { env, cwd: tmpdir(), shell: false, windowsHide: true, encoding: "utf-8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"] })`.
   Synchronous, because `runLoop` throws its refusals synchronously (`runtime.ts:350-352`).
3. **`src/harness/runtime.ts`:** `FailureCode` gains `"role-version-unsupported"`; at `:538-546` branch on `kind` and throw
   `refusing to start loop ${config.loop}: the ${r} role cannot be launched — ${p.reason}. Refused before any tag, commit or artefact.`
   No version literal anywhere in runtime.ts (`policies.test.ts:322` scans it for threshold literals).
4. **Spawn sites:** `tests/harness/spawn-sites.test.ts` `CLASSIFIED` gains
   `{ file: "process.ts", within: "probeVersion", why: "claude --version at preflight (T-182): constructed env, no shell, bounded" }`;
   its comment's "three classified sites" becomes four.
5. **CA-9** (`process-role.test.ts:313`): spawn `--version` and `--help` from the test; assert
   `installed !== null && claudeVersionAtLeast(installed, MIN_CLAUDE_CODE_VERSION) && missing.length === 0`, with
   `claudeFlagReport(...)` as the failure message. Keep its `skipIf` when no claude is on PATH.

## Existing tests (planner-researched; verdicts)

- `process-role.test.ts:313` CA-9: **update** as ruled. `spawn-sites.test.ts:101`: **update** (the new entry).
- Stay green: `spawn-sites.test.ts:110-133` (planted rows); `process-role.test.ts:298` (2.5 CONTROL), `:221` (2.5 win32),
  `:393`/`:400` (CA-3a/3b); `effort-policy.test.ts:144` (R10); `checks.test.ts:141` (no shell spawn: keep
  `shell: false`); `policies.test.ts:322` (no literal in runtime.ts).
- Any other newly failing row: STOP, `BLOCKED T-182 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t182-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`, else BLOCKED). Also print
   `claude --version` (the installed one; the fixture below is captured from it).
2. `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t182-wt")`, `Set-Location`
   into it, `git checkout -q -b fix/t182-claude-min-version 304d56392c8e2fdab33b08a66daae96ece46ab5d`. HEAD must print
   that SHA and the tree must be clean, else STOP, BLOCKED. `npm ci` in `open-brain`. **Forbidden:** `git stash`,
   `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout.
3. **Base run** (in `open-brain`, 30-minute cap): `npx vitest run tests/harness --no-file-parallelism --testTimeout=180000`.
   Paste the summary and every failing row; anything red is pre-existing.
4. **Commit 1, `T-182: tests (red)`.** Capture the installed `claude --help` output into
   `open-brain/tests/harness/fixtures/claude-help-<installed version>.txt` (public CLI help text; nothing else in it).
   New file `open-brain/tests/harness/t182-claude-version.test.ts` (namespace imports):
   - **V1:** `parseClaudeVersion`: `"2.1.296 (Claude Code)\n"` → `"2.1.296"`; `"2.1.282 (Claude Code)\r\n"` → `"2.1.282"`;
     `"2.1.296"` → `"2.1.296"`; null for `""`, `"error: unknown option '--version'"`, `"2.1 (Claude Code)"`,
     `"claude 2.1.296"`.
   - **V2:** `claudeVersionAtLeast` true for (2.1.282, 2.1.282), (2.1.296, 2.1.282), (2.10.0, 2.9.0); false for
     (2.1.3, 2.1.282), (2.1.281, 2.1.282), (1.99.999, 2.1.282).
   - **F1** (on the fixture): the full list → `[]`; `["--permission-prompt-tool"]` → reported missing (description-only);
     the `--strict-mcp-config` option line deleted → `["--strict-mcp-config"]`; the `--permission-prompts` and `--effort`
     lines deleted → both, in list order.
   - **M1:** the three `claudeFlagReport` strings, exactly.
   - **R1** (in the CA-3 style, with the existing `refusedCleanly` helper): `claudeAdapter({ launcher: <fake .cjs> })`
     whose fake prints `2.1.250 (Claude Code)` and logs its argv to a marker file → `LoopRefused` with code
     `role-version-unsupported` and the exact message, no tag, commit or artefact, and the marker holds only
     `["--version"]`. Control: a fake printing `2.1.282 (Claude Code)` → `preflight().ok === true`.
   - **P1:** `MIN_CLAUDE_CODE_VERSION === "2.1.282"` and `parseClaudeVersion(MIN + " (Claude Code)") === MIN`.
   Run the file: every row red (namespace imports make missing exports fail rows). Paste it.
5. **Commit 2, `T-182: a declared minimum Claude Code version, refused at preflight; CA-9 names both versions`:** the
   ruling, plus the CA-9 and spawn-sites edits.
6. End both messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline 304d5639..HEAD`
   shows 2 lines; `git status --porcelain` is empty.
7. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0), the t182 file, then step 3's command again. Paste all three,
   including CA-9's result on this machine (it runs here: claude is on PATH).
8. **Mutants** (edit, run the t182 file only (M4 also process-role.test.ts), paste, `git checkout -- <file>`, clean tree;
   never commit):
   - M1: compare versions as strings → V2 (2.1.3 case) red.
   - M2: `>` instead of `>=` → V2's equal case and R1's control red.
   - M3: back to a substring check → F1 red.
   - M4: `ProcessRole.preflight()` skips `preflightCheck` → R1 red.
9. `git diff --name-only 304d5639..HEAD` must show only `open-brain/src/harness/roles.ts`, `process.ts`, `runtime.ts`,
   `open-brain/tests/harness/process-role.test.ts`, `spawn-sites.test.ts`, `t182-claude-version.test.ts` and the one
   fixture file. Anything else: STOP, BLOCKED.
10. `git push origin fix/t182-claude-min-version` (never force); `ls-remote` must equal `rev-parse HEAD`. Then
    `gh pr create --base master --head fix/t182-claude-min-version --title "T-182: a declared minimum Claude Code version, refused at preflight; CA-9 names both versions" --body "Brief: docs/loops/t182-claude-min-version-brief.md."`
    Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion. On hosted Linux
    CA-9 skips (no claude); that is expected.

## Reply

The first line is `READY T-182 <sha40> PR #<n>` or `BLOCKED T-182 <reason>`. Then each command with its output: the
installed version, base run, red run, tsc, the t182 run, the second run (with CA-9's line), the mutants, the name-only
diff, `ls-remote` = `rev-parse`, the PR URL and CI. At most 2 attempts at a red. Mark anything not run `NOT RUN`. If the
code differs from a line this brief quotes, follow the ruling's intent and say what differed. Do not merge.
