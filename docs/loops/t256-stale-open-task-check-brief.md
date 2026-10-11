# T-256: `/sync` warns when a CODE commit on HEAD names a task that is still open

Runtime: CC (claude -p, Sonnet 5.5)
SEAT: laptop one-off (no hub key)
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the laptop user's %TEMP% named t256-reply.md. Resolve and print that absolute path FIRST (§1), before any temp HOME is set.

**By:** Atlas (planner), 2026-10-11. **Task:** T-256 (P2, opened by the planner). **Tag:** `T-256`. **Decision:** D-150
(fleet routing: CC develops, Grok reviews, Cursor is reserve). **Size:** SMALL. **Written to**
`~/Worktrees/cursor-brief-checklist.md`. **Base:** `5b249bca3064f46ef0183ebba96ee36d5bf1626b` (the dispatch fills in the 40-char SHA; until it
does, the brief is not launchable).

## Why

On 2026-10-11 the planner found T-200, T-233 and T-247 already merged on master but still `open` in
`.agents/state.json`, and nearly briefed one of them again. Nothing compares the record with history. This check does:
an `open` or `in_progress` task whose id appears in the subject of a CODE commit reachable from HEAD is a WARNING.

**What it prints on master today (planner, first-hand at `5b249bca`, a prototype of §W1's exact rules):** 42
open/in_progress tasks, 1500 commits scanned, **4 hits**: T-168 (`9bfb2e1`), T-235 (`9daf38d`), T-046 (`a8adca0`
"fix(sync): … (T-046 D1)") and T-172 (`4d19938`, a "T-233 A: …" subject that cites T-172 further along). T-172 is
a cross-reference, and it is the noise this rule accepts (see "Decisions"). The planner triages those four after merge;
the dev does not touch `state.json`.

### Decisions on the open choices (planner)

| Choice | Ruling | Reason |
|---|---|---|
| Subjects or bodies | **Subjects only** (`%s`) | Repo convention puts the task id in the subject (`T-247 H2: …`, `T-252: tests (red)`). Bodies cite related tasks for context ("see T-208", "after T-245"), which would make the warning fire on tasks a commit merely mentions. A commit naming its task only in the body is missed; that is a stated LIMIT. |
| Id match | `/\bT-\d+\b/g` extracted from the subject, then looked up in the open set. **Case-sensitive.** | `T-245` extracts as `T-245`, so `T-24` never matches it. `QAT-24` has no boundary before `T`. Branch-style `t247` is not an id. |
| What is CODE | A commit touching at least one path that does **not** start with `docs/`, does **not** start with `.agents/`, and does **not** end in `.md` (case-insensitive). A commit with no paths is not code. | Briefs, records and docs name open tasks all the time (`docs: T-245 round 3`, `state: rev 378 … close T-200`). |
| Merges | **Skipped** (`--no-merges`) | A merge's own subject is `Merge pull request #N from …/t247-pins`; the commits it brings in are on HEAD and are read directly. |
| "tests (red)" commits | **Counted, no exclusion.** | A red-tests commit only reaches master inside the PR that carries its fix, so excluding it changes nothing on master; one that landed alone is itself a reason to look. One rule fewer. |
| Statuses | `open` and `in_progress` only. `blocked` and `done` never warn. | A blocked task is open by intent and already says why. |
| Suppression | The task's `note` contains the exact text `stays open after <sha7>`, where `<sha7>` is the first 7 chars of the **newest** CODE commit naming it. | One mechanism, no schema change (`TaskSchema` is strict, so a list field would mean a schema bump and a migration). Keyed to the newest commit, so a later code commit re-arms the warning. |
| Severity | `warn`, never `issue`; `report: true` | A task can rightly stay open after a partial commit. |
| Bound | The newest **1500 non-merge commits** (`--max-count=1500`) | At `5b249bca` that reaches back to 2026-09-17, runs in about 0.3 s and prints about 400 KB, under `execRunner`'s 1 MB default buffer. A count is deterministic in tests; a date is not. |
| Cost | **Two git calls per run, whatever the number of tasks**: `rev-parse --is-shallow-repository`, then one `log`. Zero when no task is open. | Row T256-7 counts them. |
| Skips | No state file, unreadable state, no `tasks` array, git not installed, not a repository, shallow clone, `git log` failing: each a `skip` naming the reason. | A skip is never a pass (`types.ts`). |

```text
IMPACT-TARGETS: runSync
```

`checkOpenTaskCommits` and `isCodePath` are new and do not exist at the base. `execRunner` and `CommandRunner` are
imported from `checks-state.ts` unchanged.

**Out of scope, do not touch:** `.agents/state.json` and its views; `checks-state.ts` (import from it only);
`types.ts`; `shared/state-schema.ts`; `record-erasure.ts`; every other check; `CHANGELOG.md`, `package.json`,
`README.md`, `.claude/commands/sync.md`, any doc; every existing test file.

## 1. Shell, Node and the reply path

PowerShell. Run these first, in this order, and paste the output. The reply path is resolved **before** anything
changes HOME:

```powershell
$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t256-reply.md"))
"REPLY_PATH=$reply"
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
node -v
```

`$reply` is the only reply path for the whole run; never recompute it. If `node -v` prints `v24…`, STOP: write the
reply (§12) with `BLOCKED T-256 node v24`.

## 2. Start state

Work in the directory the launcher started you in: a fresh full clone of `melvenac/Self-Improving-Agent` made by
clark for this run, which no seat uses. Do not create or move to another checkout.

```powershell
git remote get-url origin
git fetch origin
git switch -c fix/t256-open-task-commits 5b249bca3064f46ef0183ebba96ee36d5bf1626b
git rev-parse HEAD
git status --porcelain
Set-Location open-brain; npm ci; "EXIT=$LASTEXITCODE"; Set-Location ..
```

`origin` must name `melvenac/Self-Improving-Agent`, `git rev-parse HEAD` must print the base SHA, `git status
--porcelain` must print nothing, and `npm ci` must print `EXIT=0`. Otherwise STOP: `BLOCKED T-256 start state`.

## 3. Forbidden git

Do not use `git stash`, `reset --hard`, `--force`, rebase or amend, and do not `cd` into another seat's tree. Touch no
PR except your own.

## The work (all line numbers at `5b249bca`; re-find by text if they moved)

### W1. New file `open-brain/src/pipelines/sync/open-task-commits.ts`

Exactly this content:

```ts
/**
 * T-256. An open or in_progress task that a CODE commit on HEAD already names. On 2026-10-11 the planner found
 * T-200, T-233 and T-247 merged on master and still open, and nearly briefed one again. A WARNING, never an issue:
 * a task can rightly stay open after a partial commit, and its note says so with `stays open after <sha7>`.
 *
 * Two git calls per run (rev-parse, then one log), whatever the number of tasks. Reads the record as JSON, not
 * through the schema, as task-assignees does: a record this build cannot parse is state-schema's finding.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult } from "./types.js";
import { execRunner, type CommandRunner } from "./checks-state.js";

export const OPEN_TASK_COMMIT_BOUND = 1500;
const TASK_ID_RE = /\bT-\d+\b/g;
const SUBJECT_CHARS = 72;
const SHOWN = 10;

/** A path is CODE unless it is under docs/ or .agents/, or is a Markdown file. */
export function isCodePath(path: string): boolean {
  return !path.startsWith("docs/") && !path.startsWith(".agents/") && !/\.md$/i.test(path);
}

export function checkOpenTaskCommits(projectRoot: string, run: CommandRunner = execRunner): CheckResult {
  const name = "open-task-commits";
  const skip = (why: string): CheckResult => ({ name, report: true, severity: "skip", message: `skipped — ${why}; open-task commits: unknown` });

  const statePath = join(projectRoot, ".agents", "state.json");
  if (!existsSync(statePath)) return skip("no .agents/state.json");
  let tasks: Array<{ id?: unknown; status?: unknown; note?: unknown }>;
  try {
    const data = JSON.parse(readFileSync(statePath, "utf8")) as { tasks?: unknown };
    if (!Array.isArray(data.tasks)) return skip(".agents/state.json has no tasks array");
    tasks = data.tasks as typeof tasks;
  } catch (err) {
    return skip(`.agents/state.json unreadable: ${(err as Error).message.split("\n")[0]}`);
  }
  const open = tasks.filter((t) => typeof t.id === "string" && (t.status === "open" || t.status === "in_progress"));
  if (open.length === 0) {
    return { name, report: true, severity: "pass", message: "0 open/in_progress tasks; nothing to match (git not run)" };
  }

  const rp = run("git", ["rev-parse", "--is-shallow-repository"], projectRoot);
  if (!rp.ok) return skip(/ENOENT/.test(rp.error) ? "git is not installed" : `not a git repository (${rp.error.split("\n")[0]})`);
  if (rp.stdout.trim() === "true") return skip("shallow clone, the history this check reads is not here (fetch full history to run it)");
  const log = run("git", ["-c", "core.quotepath=off", "log", "--no-merges", `--max-count=${OPEN_TASK_COMMIT_BOUND}`, "--name-only", "--format=%x1e%H%x1f%s", "HEAD"], projectRoot);
  if (!log.ok) return skip(`git log failed (${log.error.split("\n")[0]})`);

  // git log is newest first, so the first CODE commit that names a task is its newest.
  const newest = new Map<string, { sha: string; subject: string }>();
  const records = log.stdout.split("\x1e").slice(1);
  for (const rec of records) {
    const [head, ...rest] = rec.split("\n");
    const sep = head.indexOf("\x1f");
    const sha = head.slice(0, sep).trim();
    const subject = head.slice(sep + 1).trim();
    const files = rest.map((l) => l.trim()).filter((l) => l.length > 0);
    if (!files.some(isCodePath)) continue;
    for (const id of new Set(subject.match(TASK_ID_RE) ?? [])) {
      if (!newest.has(id)) newest.set(id, { sha, subject });
    }
  }

  const hits: string[] = [];
  for (const t of open) {
    const h = newest.get(t.id as string);
    if (!h) continue;
    const sha7 = h.sha.slice(0, 7);
    if (typeof t.note === "string" && t.note.includes(`stays open after ${sha7}`)) continue;
    const subj = h.subject.length > SUBJECT_CHARS ? `${h.subject.slice(0, SUBJECT_CHARS)}…` : h.subject;
    hits.push(`${String(t.id)} is ${String(t.status)} but ${sha7} '${subj}' on HEAD touches code; close it with evidence or note why it stays open`);
  }
  const scanned = `scanned ${records.length} non-merge commits (bound ${OPEN_TASK_COMMIT_BOUND}) against ${open.length} open/in_progress task(s)`;
  if (hits.length > 0) {
    const shown = hits.slice(0, SHOWN).join(" | ") + (hits.length > SHOWN ? ` | +${hits.length - SHOWN} more` : "");
    return { name, report: true, severity: "warn", message: `${hits.length} open task(s) named by a code commit: ${shown}. ${scanned}. Suppress one with "stays open after <sha7>" in its note` };
  }
  return { name, report: true, severity: "pass", message: `0 open tasks named by a code commit; ${scanned}. LIMIT: subjects only, merges skipped; a commit is code when it touches a path outside docs/, .agents/ and *.md` };
}
```

### W2. Register it in `open-brain/src/pipelines/sync/index.ts`

- After line 37 (`import { checkRecordErasure } from "./record-erasure.js";`) add exactly:
  `import { checkOpenTaskCommits } from "./open-task-commits.js";`
- After line 137 (`  checks.push(checkRecordErasure(options.projectRoot));`) add exactly these two lines:
  ```ts
    // T-256: an open task that a code commit on HEAD already names.
    checks.push(checkOpenTaskCommits(options.projectRoot));
  ```

Nothing else in `index.ts` changes.

## 4. Commits (exactly two)

| # | Contents | Message |
|---|---|---|
| 1 | §6's new test file only | `T-256: tests (red)` |
| 2 | W1 and W2 | `T-256: /sync open-task-commits warns when a code commit on HEAD names an open task` |

**At commit 1,** run §6's command with `$files = "tests/pipelines/sync/open-task-commits.test.ts"` and paste the
summary. Expected: the file fails to load because `../../../src/pipelines/sync/open-task-commits.js` does not exist
(`Test Files 1 failed`, the error naming `open-task-commits`). Any other result: STOP, `BLOCKED T-256 commit-1 red set`.

After each commit, paste `git status --porcelain` (must be empty) and `git log --oneline 5b249bca3064f46ef0183ebba96ee36d5bf1626b..HEAD` (1 line,
then 2).

## 5. Mutants (local only, never pushed; ALL run, none `NOT RUN`)

For each mutant:
1. `git switch -c mut-N <commit 2's sha>`.
2. Make the one edit, then `git commit -am "MUTANT N"`.
3. Run §6's command with `$files = "tests/pipelines/sync/open-task-commits.test.ts"`, and paste each red test with
   its assertion line.
4. `git switch fix/t256-open-task-commits`, then `git status --porcelain` (must be empty).

Never push a `mut-N` branch.

| N | File | Edit | Must turn red |
|---|---|---|---|
| 1 | `open-task-commits.ts` | `if (!files.some(isCodePath)) continue;` becomes `if (files.length === 0) continue;` | T256-2 |
| 2 | `open-task-commits.ts` | In the `open` filter, `(t.status === "open" \|\| t.status === "in_progress")` becomes `t.status !== "done"` | T256-3 |
| 3 | `open-task-commits.ts` | `for (const id of new Set(subject.match(TASK_ID_RE) ?? [])) {` becomes `for (const id of open.map((t) => t.id as string).filter((x) => subject.includes(x))) {` | T256-4 |
| 4 | `open-task-commits.ts` | Delete the line `if (typeof t.note === "string" && t.note.includes(\`stays open after ${sha7}\`)) continue;` | T256-5 |
| 5 | `open-task-commits.ts` | Delete the line `if (rp.stdout.trim() === "true") return skip(…);` | T256-6 |
| 6 | `open-task-commits.ts` | Insert `run("git", ["rev-parse", "HEAD"], projectRoot);` as the first line inside `for (const t of open) {` | T256-7 |
| 7 | `index.ts` | Delete the line `checks.push(checkOpenTaskCommits(options.projectRoot));` (leave the import) | T256-8 |

If a mutant stays green, STOP: `BLOCKED T-256 mutant N survives`. Mutant 7 leaves an unused import; `tsc` is not run
on mutants.

## 6. Tests

### New file: `open-brain/tests/pipelines/sync/open-task-commits.test.ts`

Header and helpers (the git helper follows `record-erasure.test.ts`):

```ts
/**
 * T-256 rows (docs/loops/t256-stale-open-task-check-brief.md): /sync warns when a CODE commit on HEAD names an
 * open or in_progress task. Every row is a real git repository in a temp dir.
 */
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { checkOpenTaskCommits } from "../../../src/pipelines/sync/open-task-commits.js";
import { execRunner, type CommandRunner } from "../../../src/pipelines/sync/checks-state.js";

const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});
function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  tmps.push(d);
  return d;
}
function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function repo(prefix: string): string {
  const d = tmp(prefix);
  git(d, "init", "-q", "-b", "master");
  return d;
}
let n = 0;
/** Writes each listed file, adds ONLY those files, commits with `subject`, returns the full sha. */
function commitFiles(dir: string, subject: string, files: string[]): string {
  for (const f of files) {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), `${subject} ${++n}\n`);
  }
  git(dir, "add", "--", ...files);
  git(dir, "-c", "user.email=t@example.com", "-c", "user.name=T", "commit", "-q", "-m", subject);
  return git(dir, "rev-parse", "HEAD");
}
type T = { id: string; status: string; note: string };
/** The check reads .agents/state.json as JSON; it is never committed (commitFiles adds only listed files). */
function writeState(dir: string, tasks: T[]): void {
  mkdirSync(join(dir, ".agents"), { recursive: true });
  writeFileSync(join(dir, ".agents", "state.json"), JSON.stringify({ tasks }, null, 2) + "\n");
}
const TAIL = 'Suppress one with "stays open after <sha7>" in its note';
const hit = (id: string, status: string, sha: string, subject: string) =>
  `${id} is ${status} but ${sha.slice(0, 7)} '${subject}' on HEAD touches code; close it with evidence or note why it stays open`;
```

In the rows table below and in §5's mutant table, a backslash before a pipe is Markdown escaping for a literal pipe
character; type the pipe alone in code (`||`, `" | "`).

Wrap all rows in `describe("T-256: open-task-commits", () => { … })`. Each row is one `it` whose title starts with
its row id. No row reads the real repository's history or `state.json`, except T256-8, which reads `index.ts` source
text only.

| Row | Setup | Asserts |
|---|---|---|
| T256-1 (warn, newest commit, both statuses) | `d = repo("t256-1-")`. `writeState(d, [{id:"T-7",status:"open",note:""},{id:"T-8",status:"in_progress",note:""}])`. `commitFiles(d,"init",["src/seed.ts"])`; `commitFiles(d,"T-7: first",["src/a.ts"])`; `c2 = commitFiles(d,"T-8 and T-7: second",["open-brain/src/b.ts"])`. `r = checkOpenTaskCommits(d)` | `r` toEqual `{ name: "open-task-commits", report: true, severity: "warn", message: \`2 open task(s) named by a code commit: ${hit("T-7","open",c2,"T-8 and T-7: second")} \| ${hit("T-8","in_progress",c2,"T-8 and T-7: second")}. scanned 3 non-merge commits (bound 1500) against 2 open/in_progress task(s). ${TAIL}\` }` |
| T256-2 (docs-only commits do not trip it) | `d = repo("t256-2-")`. `writeState(d, [{id:"T-7",status:"open",note:""}])`. `commitFiles(d,"init",["src/seed.ts"])`; `commitFiles(d,"docs: T-7 brief",["docs/loops/t7.md",".agents/notes.json","README.md","open-brain/NOTES.md"])`; `commitFiles(d,"docs: T-7 round 2",["docs/tools/x.ts"])`. `r = checkOpenTaskCommits(d)` | `r.severity` toBe `"pass"`. `r.message` toMatch `/^0 open tasks named by a code commit; scanned 3 non-merge commits \(bound 1500\) against 1 open\/in_progress task\(s\)\. LIMIT: subjects only, merges skipped/` |
| T256-3 (done and blocked never warn) | `d = repo("t256-3-")`. `writeState(d, [{id:"T-7",status:"done",note:""},{id:"T-8",status:"blocked",note:""},{id:"T-9",status:"open",note:""}])`. `commitFiles(d,"init",["src/seed.ts"])`; `commitFiles(d,"T-7: fix",["src/a.ts"])`; `commitFiles(d,"T-8: part",["src/b.ts"])`. `r = checkOpenTaskCommits(d)` | `r.severity` toBe `"pass"`. `r.message` toMatch `/^0 open tasks named by a code commit; scanned 3 non-merge commits \(bound 1500\) against 1 open\/in_progress task\(s\)\./` |
| T256-4 (whole-word id) | `d = repo("t256-4-")`. `writeState(d, [{id:"T-24",status:"open",note:""},{id:"T-245",status:"done",note:""}])`. `commitFiles(d,"init",["src/seed.ts"])`; `commitFiles(d,"T-245: done work",["src/a.ts"])`; `commitFiles(d,"QAT-24 thing",["src/b.ts"])`; `commitFiles(d,"t-24 lowercase",["src/c.ts"])`. `r1 = checkOpenTaskCommits(d)`. Then `cd = commitFiles(d,"fix (T-24)",["src/d.ts"])`; `r2 = checkOpenTaskCommits(d)` | `r1.severity` toBe `"pass"` and `r1.message` toMatch `/^0 open tasks named by a code commit; scanned 4 non-merge commits/`. `r2.severity` toBe `"warn"` and `r2.message` toContain `hit("T-24","open",cd,"fix (T-24)")` |
| T256-5 (suppression keys on the newest commit) | `d = repo("t256-5-")`. `writeState(d, [{id:"T-7",status:"open",note:""}])`. `commitFiles(d,"init",["src/seed.ts"])`; `c1 = commitFiles(d,"T-7: partial",["src/a.ts"])`. `r1 = checkOpenTaskCommits(d)`. Then `writeState(d, [{id:"T-7",status:"open",note:\`part 1 landed; stays open after ${c1.slice(0,7)} for the CLI half\`}])`; `r2 = checkOpenTaskCommits(d)`. Then `c2 = commitFiles(d,"T-7: CLI half",["src/cli.ts"])`; `r3 = checkOpenTaskCommits(d)` | `r1.severity` toBe `"warn"`, `r1.message` toContain `hit("T-7","open",c1,"T-7: partial")`. `r2.severity` toBe `"pass"`. `r3.severity` toBe `"warn"`, `r3.message` toContain `hit("T-7","open",c2,"T-7: CLI half")` and not.toContain `c1.slice(0,7)` |
| T256-6 (skips with a reason) | (a) `d = tmp("t256-6a-")`, `writeState(d, [{id:"T-7",status:"open",note:""}])`, no git. Set `process.env.GIT_CEILING_DIRECTORIES = dirname(d)` and restore the previous value (or delete it) in `finally`. (b) same state, `checkOpenTaskCommits(d, () => ({ ok: false, error: "git not found (ENOENT)" }))`. (c) `d = repo("t256-6c-")`, state as (a), `commitFiles(d,"init",["src/seed.ts"])`, `commitFiles(d,"T-7: x",["src/a.ts"])`, then `writeFileSync(join(d,".git","shallow"), git(d,"rev-parse","HEAD") + "\n")`. (d) `d = tmp("t256-6d-")`, no state file | (a) `severity` toBe `"skip"`, `message` toMatch `/^skipped — not a git repository \(.+\); open-task commits: unknown$/`. (b) `message` toBe `"skipped — git is not installed; open-task commits: unknown"`. (c) `r` toEqual `{ name: "open-task-commits", report: true, severity: "skip", message: "skipped — shallow clone, the history this check reads is not here (fetch full history to run it); open-task commits: unknown" }`. (d) `message` toBe `"skipped — no .agents/state.json; open-task commits: unknown"` |
| T256-7 (two git calls, however many tasks) | `d = repo("t256-7-")`. `writeState(d, ["T-1","T-2","T-3","T-4","T-5"].map((id) => ({ id, status: "open", note: "" })))`. `commitFiles(d,"T-1: a",["src/a.ts"])`; `commitFiles(d,"T-2: b",["src/b.ts"])`; `commitFiles(d,"T-3: c",["src/c.ts"])`. `calls: Array<{ cmd: string; args: string[] }> = []`; `counting: CommandRunner = (cmd, args, cwd) => { calls.push({ cmd, args }); return execRunner(cmd, args, cwd); }`. `r = checkOpenTaskCommits(d, counting)` | `r.severity` toBe `"warn"` and `r.message` toMatch `/^3 open task\(s\) named by a code commit: /`. `calls` toEqual `[{ cmd: "git", args: ["rev-parse", "--is-shallow-repository"] }, { cmd: "git", args: ["-c", "core.quotepath=off", "log", "--no-merges", "--max-count=1500", "--name-only", "--format=%x1e%H%x1f%s", "HEAD"] }]` |
| T256-8 (wired into runSync) | `src = readFileSync(join(import.meta.dirname, "../../../src/pipelines/sync/index.ts"), "utf8")`. Copy `wired` from `worktree-layout.test.ts` lines 183–190 (the arrow function only), with the needle `checks.push(checkOpenTaskCommits(options.projectRoot))` | `wired(src)` toBe `true`; `wired("// checks.push(checkOpenTaskCommits(options.projectRoot));")` toBe `false` |

T256-6(a)'s ceiling variable stops git walking up from the temp dir into any repository that encloses `%TEMP%`, so
the row cannot pass or fail on the laptop's directory layout. The planner checked on Windows (Git for Windows,
Node v22.23.2): with the ceiling set, `git rev-parse --is-shallow-repository` in an empty temp dir exits 128 with
`fatal: not a git repository …`, and a `.git/shallow` file holding HEAD's sha makes it print `true`. (A
`git clone --depth 1 file:///…` fixture failed on that machine, which is why (c) writes the marker.)

### Existing tests checked against this change (found mechanically, then read)

The planner ran, at `5b249bca`:
`git grep -ln "runSync\|ob_sync\|handleSync" HEAD -- open-brain/tests` and
`git grep -n "checks.length\|toHaveLength\|checks.find\|checks.filter\|checks.some\|checks.map\|warnings.length\|toMatchSnapshot\|Health Score\|scoreConfigStructure" HEAD -- open-brain/tests`,
then read every hit. The only `.snap` file (`tests/pipelines/__snapshots__/fleet-ae-f5.test.ts.snap`) contains no
sync text. No test asserts the exact list or number of `/sync` checks.

| File:line (at `5b249bca`) | Asserts | After T-256 |
|---|---|---|
| `tests/pipelines/sync/index.test.ts:28` | `result.checks.length` > 0 | stays green |
| `tests/pipelines/sync/index.test.ts:53-63` | each check in its severity bucket; bucket sizes sum to `checks.length` | stays green (the new check is in exactly one bucket) |
| `tests/pipelines/sync/greeting-size.test.ts:138-143` | `names` length > 1 and contains `greeting-size` | stays green |
| `tests/pipelines/sync/repo-root.test.ts:43-47` | `fromSub.checks` toEqual `fromRoot.checks` (same root, two runs) | stays green (deterministic: a temp root with no `.agents/state.json` skips identically twice) |
| `tests/pipelines/sync/cursor-hook-compat.test.ts:255-284` | `runSync` on the REAL repo root; finds the `cursor-hook-compat` row by name | stays green (the new row warns on the real repo, about 0.3 s; nothing asserts on it) |
| `tests/pipelines/sync/worktree-layout.test.ts:182-196` | source scan for its own `checks.push(...)` line | stays green |
| `tests/server.test.ts:626-645` | `handleSync` text contains `Sync — v1.0.0`, `Summary:`, `Health Score:`, `/100` | stays green |
| `tests/t048-r3.test.ts:60-92` | `Pipeline Health: \d+/10` regexes from `handleSync`/`handleScore` | stays green (regex, no exact score) |
| `tests/cli-flags.test.ts:106-133` | `sync` flag refusals and a missing-dir refusal | stays green (refused before any check runs) |
| `tests/pipelines/sync/scorer.test.ts`, `tests/pipelines/sync/checks.test.ts:142-143` | `scoreConfigStructure` on hand-built arrays | stays green (no `runSync`) |
| `tests/shared/cli-args.test.ts:160,201` | the CLI command list | stays green (no new command) |
| `tests/pipelines/sync/checks-state.test.ts` | imports from `checks-state.ts` | stays green (file unchanged) |

**No existing test is expected to go red, so commit 1 edits no existing file.** If any §6 file other than the new
one goes red at commit 2, STOP: `BLOCKED T-256 unexpected red <file>:<test>`, and paste the assertion line.

### Command

PowerShell, from `open-brain/`. The run is a process whose PID you record. It has a temp HOME, USERPROFILE and
knowledge DB; `$reply` from §1 is untouched by them. The 10-minute cap stops only that PID's tree:

```powershell
$iso = Join-Path $env:TEMP ("t256-home-" + [guid]::NewGuid().ToString("N")); New-Item -ItemType Directory $iso | Out-Null
$env:HOME = $iso; $env:USERPROFILE = $iso; $env:KNOWLEDGE_V2_DB = Join-Path $iso "knowledge-v2.db"
$files = "tests/pipelines/sync/open-task-commits.test.ts tests/pipelines/sync/index.test.ts tests/pipelines/sync/greeting-size.test.ts tests/pipelines/sync/repo-root.test.ts tests/pipelines/sync/cursor-hook-compat.test.ts tests/pipelines/sync/worktree-layout.test.ts tests/pipelines/sync/checks-state.test.ts tests/server.test.ts tests/t048-r3.test.ts"
$p = Start-Process -FilePath "npx.cmd" -ArgumentList "vitest run $files --no-file-parallelism --testTimeout=30000" -NoNewWindow -PassThru -RedirectStandardOutput "$iso\vitest.out" -RedirectStandardError "$iso\vitest.err"
if (-not $p.WaitForExit(600000)) { taskkill /PID $p.Id /T /F; "BLOCKED: 10-minute cap, killed PID $($p.Id) tree only" } else { "EXIT=$($p.ExitCode)" }
Get-Content "$iso\vitest.out"
```

- Paste the vitest summary and the `EXIT=` line separately (G-042).
- Kill only with `taskkill /PID <the recorded PID> /T`. Never by name, image or command line (`Stop-Process -Name`,
  `taskkill /IM`, `Where-Object CommandLine -match`). To see stray processes, LIST them; do not stop them.
- No test here spawns a waker or an agent. Afterwards paste `Get-ChildItem $iso -Recurse -Name`.
- No watch mode, never the whole suite. No test uses timers or sleeps.

## 7. Known red · 8. Typecheck · 9. Scope

**Known red.** If a file you did not change fails:
1. `git switch --detach 5b249bca3064f46ef0183ebba96ee36d5bf1626b`.
2. Run that one file with §6's block (`$files = "<that file>"`).
3. `git switch fix/t256-open-task-commits`.
4. Paste both outputs.

Identical at the base means it was already there: name it and go on. At most **2** fix attempts on your own failures,
then STOP: `BLOCKED T-256 <test>`.

**Typecheck.** From `open-brain/`: `npx tsc --noEmit; "EXIT=$LASTEXITCODE"` → `EXIT=0`.

**Scope.** `git diff --name-only 5b249bca3064f46ef0183ebba96ee36d5bf1626b..HEAD` may show only:

```
open-brain/src/pipelines/sync/open-task-commits.ts             (new)
open-brain/src/pipelines/sync/index.ts
open-brain/tests/pipelines/sync/open-task-commits.test.ts      (new)
```

Anything else: STOP.

## 10. Push and PR

```powershell
git push origin fix/t256-open-task-commits
git ls-remote origin refs/heads/fix/t256-open-task-commits
git rev-parse HEAD
```

The two SHAs must be equal. Never `--force`. If the push is rejected: STOP, `BLOCKED T-256 push rejected`. Then:

```powershell
gh pr create --base master --head fix/t256-open-task-commits --title "T-256: /sync warns when a code commit on HEAD names an open task" --body "Brief: docs/loops/t256-stale-open-task-check-brief.md. New check open-task-commits: an open/in_progress task whose id is in the subject of a non-merge commit on HEAD that touches a path outside docs/, .agents/ and *.md is a WARNING, suppressible with 'stays open after <sha7>' in the task note. Two git calls per run, newest 1500 non-merge commits, skips on no git / not a repo / shallow."
```

If `gh` fails (not installed or not authenticated), do not retry: put `PR: NOT RUN (<first error line>)` in the reply.
The pushed branch is enough for the planner.

## 11. STOP rules

At most 2 attempts at any failing step. A STOP still writes the reply, with `BLOCKED` in its first two lines.

## 12. Reply

There is no hub and no room. Write the whole reply, as Markdown, to `$reply` (the absolute path printed as
`REPLY_PATH=` in §1), then print it back:

```powershell
Set-Content -Path $reply -Value $body -Encoding utf8
"WROTE=$reply"; Get-Content $reply
```

- **Line 1:** `TASK: T-256 READY, /sync open-task-commits (fix/t256-open-task-commits)`. On a stop, `BLOCKED` replaces
  `READY`.
- **Line 2:** `READY T-256 <sha40>` or `BLOCKED T-256 <reason>`.
- **Line 3:** `MODEL: <the exact model id this run is using>`.
- **Then, in order:**
  1. `REPLY_PATH=` and `node -v`
  2. The start state
  3. The commit log, plus the commit-1 red run (§4)
  4. The test command, the vitest summary and the `EXIT=` line
  5. `git diff 5b249bca3064f46ef0183ebba96ee36d5bf1626b..HEAD -- open-brain/src`
  6. The `tsc` `EXIT=`
  7. The scope diff
  8. Mutants 1–7, each with its red test and assertion line
  9. The push readback
  10. The PR number, or `PR: NOT RUN (…)`
  11. **IMPACT:** if the launcher rated `runSync` HIGH, CRITICAL or UNKNOWN, say how its callers are covered (the
      §6 files: `index.test.ts`, `repo-root.test.ts`, `cursor-hook-compat.test.ts`, `server.test.ts`
      `handleSync`, `t048-r3.test.ts`, and T256-8); otherwise `IMPACT: no HIGH/CRITICAL/UNKNOWN`.
- Every number is pasted command output with the command shown above it. Anything not run is `NOT RUN`. The final
  line of the run's own output is `WROTE=<the absolute reply path>`.

## 13. RAM and time

One test process. No hub listener, no second node. No real sleeps; nothing in this job waits.

## Acceptance

| # | Check |
|---|---|
| T256-A1 | T256-1…T256-8 pass. The other §6 files stay green. `tsc` gives 0. Scope is as §9. |
| T256-A2 | At commit 1 the new file fails to load on the missing module, and nothing else changed. |
| T256-A3 | Mutants 1–7 are each red on their named rows. |
| T256-A4 | A Grok review (D-150 lane) of the diff returns APPROVE, or CHANGES that the planner rules on. |
| T256-A5 | After merge, `/sync` on master prints `open-task-commits` and the planner triages each hit (close with evidence, or `stays open after <sha7>` in the note). |
