# T-272: bootstrap in a seat checkout keeps AGENT.local.md, and names the tracked AGENT.md after the repository

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC or laptop one-off, NOT the desktop (Aaron, 2026-10-13: the desktop's CPU is at 100%, so no npm, vitest,
tsc or build runs there). No hub key. Code only. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t272-reply.md (a reply path in the
launcher's line wins). Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 170. **Task:** T-272 (P2). **Tag:** `T-272`. **Size:** SMALL.
**Base:** `9d93d8371c822b8f2ef01e77212c7f125f78eb24` (origin/master). If clark re-pins it at launch, that SHA wins.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: gitState agentsState scaffold buildImportDraft (open-brain/src/pipelines/bootstrap/index.ts, open-brain/src/pipelines/state-import/index.ts; new export SEAT_FILE; reached through inspectProject, moveResidue and the bootstrap/state-import CLI commands; covered by tests/pipelines/t272-seat-checkout.test.ts and the bootstrap, import-cmds and state-import files in step 3)
```

## Why

T-272 (read its note). Prism (agent-dashboard's planner) bootstrapped SIA from its SEAT checkout, a linked worktree
`~/Worktrees/dashboard-planner` of the repository `agent-dashboard`, holding `.agents/AGENT.local.md`. Bootstrap moved
the seat file aside and named the tracked `.agents/AGENT.md` after the checkout folder. Prism had to rename AGENT.md
back to the project's name and restore its seat file (lesson 671).

**Planner's fork, first-hand, 2026-10-13.** The bootstrap code is the base's: `git diff 88b2c8d4 9d93d837` is empty for
`pipelines/bootstrap/`, `pipelines/state-import/` and `shared/paths.ts`. The run used a scratch build of 88b2c8d4 and a
fixture: repository `agent-dashboard` with a worktree `dashboard-planner` holding `.agents/AGENT.local.md`.
```text
$ node cli.js bootstrap check <worktree>
git:       repository root; has commits; 1 uncommitted change(s)
.agents/:  RESIDUE — AGENT.local.md (no state.json, no TASKS/)
Next:      Move the residue aside first (`bootstrap move-residue`), then run check again.
$ node cli.js bootstrap move-residue <worktree>
bootstrap move-residue — moved, nothing deleted
To:      .agents/archive/pre-bootstrap-residue-2026-10-13/
Entries: AGENT.local.md
$ node cli.js bootstrap scaffold <worktree>        (then:)
$ head -7 .agents/AGENT.md
---
name: dashboard-planner
role: none
...
$ test -e .agents/AGENT.local.md
ABSENT
```
Three defects, all in the base code:
- **The seat file is residue.** `agentsState` (`bootstrap/index.ts:174-178`) names every entry of `.agents/` except
  `archive/` as residue, and `moveResidue` (`:274-308`) moves exactly those entries.
- **The seat file is an uncommitted change.** `gitState` (`:130-132`) counts the untracked `?? .agents/AGENT.local.md`
  as dirty. Before the template gitignore exists, nothing ignores it, so `scaffold` refuses at `:580` (`1 uncommitted
  change(s) ... Nothing written`) unless the file is moved.
- **The checkout's folder is used as the project's name.** `scaffold` writes `agentMd(basename(root))` (`:594`), and
  the import draft's fallback name is `basename(root)` (`state-import/index.ts:800`).

The seat file is legitimate by design. The AGENT.md that scaffold writes tells the reader "To make a checkout a seat
later, write `.agents/AGENT.local.md` (local to that checkout)" (`:657`). `/start` reads AGENT.local.md before AGENT.md
(`session-start/agent-identity.ts:34-35`), and the template gitignore's `/.agents/*` keeps it local. T-249's
`projectIdentityName` (`shared/paths.ts:91-93`) already names a directory after its REPOSITORY: it is the last segment
of `mainWorktreeRoot`, which resolves a linked worktree to its main checkout and returns anything else unchanged.

**The fix was prototyped and run by the planner's fork** (scratch commit, never pushed). It gave 5 of the 6 rows below
red at 88b2c8d4 (S1, S2, S3, S4, S6), then 6 of 6 green, and a re-run of the CLI sequence gave `name: agent-dashboard`
with AGENT.local.md kept and ignored (`!! .agents/AGENT.local.md`). This brief rules that change, with three
differences listed at the end.

## Ruling (exact; paths under `open-brain/`)

**1. `src/pipelines/bootstrap/index.ts`**
- **Imports.** After line 7 (`import { STATE_IMPORT_COMMIT_OUTPUTS, ... } from "../../shared/import-outputs.js";`) add
  `import { projectIdentityName } from "../../shared/paths.js";`. On line 3, remove `basename`, because the scaffold
  line was its only use: line 3 becomes `import { dirname, join, resolve } from "node:path";`.
- **The constant.** After `export const SIA_SECTION_HEADING = "## Self-Improving Agent (SIA)";` (`:108`) add:
  ```ts

  /**
   * T-272: a seat checkout's own identity file. The template gitignore's `/.agents/*` rule keeps it local, and /start
   * reads it before AGENT.md. It is never residue and never a change for the owner to commit, so bootstrap leaves it
   * where it is: moving it aside unseated the checkout (Prism, 10-13).
   */
  export const SEAT_FILE = "AGENT.local.md";
  ```
- **`gitState`** (`:131-132`). After the existing `.filter(...)` for `.agents/archive/`, add a second filter so the
  statement reads:
  ```ts
      const dirty = porcelain.split("\n").filter(Boolean)
        .filter((l) => !(l.startsWith("?? ") && l.slice(3).replace(/^"|"$/g, "").startsWith(".agents/archive/")))
        .filter((l) => !(l.startsWith("?? ") && l.slice(3).replace(/^"|"$/g, "") === `.agents/${SEAT_FILE}`));
  ```
  Only an UNTRACKED seat file is dropped. A tracked AGENT.local.md with edits (` M`) is still a change to commit.
- **`agentsState`** (`:174-177`). Add one filter after the `archive` filter, plus one comment line above both:
  ```ts
    // The seat file (SEAT_FILE) is never residue either: it is this checkout's identity, local by design (T-272).
    const entries = readdirSync(agents)
      .filter((n) => !(n === "archive" && statSync(join(agents, n)).isDirectory()))
      .filter((n) => !(n === SEAT_FILE && statSync(join(agents, n)).isFile()))
      .map((n) => (statSync(join(agents, n)).isDirectory() ? `${n}/` : n))
      .sort();
  ```
  `moveResidue` takes its entries from `agentsState`, so it needs no change: the seat file stays put. A `.agents/`
  holding only the seat file is `empty`, and `move-residue` refuses with its existing message.
- **`FUTURE_LOCAL`** (`:558`). Add `` `.agents/${SEAT_FILE}` `` after `".agents/archive/x"`, so `verifyTracking`
  fails a merged `.gitignore` that would track the seat file:
  ```ts
  const FUTURE_LOCAL = [".agents/SESSIONS/Session_1.md", ".agents/archive/x", `.agents/${SEAT_FILE}`, DRAFT_REL, REPORT_REL, DRAFT_INPUTS_REL];
  ```
- **`scaffold`** (`:594`): `writeFileSync(dest, agentMd(basename(root)), "utf8");` becomes
  `writeFileSync(dest, agentMd(projectIdentityName(root)), "utf8");`.

**2. `src/pipelines/state-import/index.ts`**
- **Imports.** After line 39 (`import { readAgentIdentity } from "../session-start/agent-identity.js";`) add
  `import { projectIdentityName } from "../../shared/paths.js";`. On line 21, remove `basename`, because line 800 was
  its only use: line 21 becomes `import { dirname, join, relative, resolve } from "node:path";`.
- **Line 800:** `: { name: basename(root), version: pkg?.version ?? "0.0.0", name_from: "folder" },` becomes
  `: { name: projectIdentityName(root), version: pkg?.version ?? "0.0.0", name_from: "folder" },`.
- **Line 57** (the `project` doc comment) becomes exactly:
  `  /** `name_from: "folder"` when there is no package.json name (R-BF-9): the REPOSITORY's folder, so a linked worktree is named after its main checkout (T-272); `"flag"` when --name gave it (T-248). */`

Change nothing else. `.agents/retirements.json` pins one line of `state-import/index.ts` (R-007, `project\.version`).
None of these edits touches it or adds that text. Run `retirements-live.test.ts` anyway.

## New test file (commit 1): `open-brain/tests/pipelines/t272-seat-checkout.test.ts`

Write it exactly as below. It is the planner's fork's file, with one added assertion in S3 (marked `T-272 M6`).

```ts
/**
 * T-272 (docs/loops/t272-bootstrap-seat-checkout-brief.md): bootstrap run in a SEAT checkout, a linked worktree
 * whose folder is not the repository's name and which holds .agents/AGENT.local.md, keeps the seat file where it
 * is. It names the tracked AGENT.md, and the import draft's folder-name fallback, after the REPOSITORY (T-249's
 * projectIdentityName), not after the checkout folder. Prism, 10-13: move-residue archived AGENT.local.md, and
 * scaffold wrote `name: dashboard-planner` into the tracked AGENT.md.
 */
import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as cp from "node:child_process";
import * as bs from "../../src/pipelines/bootstrap/index.js";
import * as si from "../../src/pipelines/state-import/index.js";

const repoRoot = path.join(import.meta.dirname, "../../..");
const templateDir = path.join(repoRoot, "project-template");
const TODAY = "2026-10-13";
const SEAT = "---\nname: Prism\nrole: planner\npartner: Forge\n---\n\n# Prism, local to this checkout\n";

const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) fs.rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

function git(cwd: string, ...args: string[]): string {
  return cp.execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** A fresh temp base; realpath.native because some hosts hand out an 8.3 short temp path (as t249 does). */
function tmpBase(): string {
  const base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "t272-")));
  tmps.push(base);
  return base;
}

/** A repository folder `name` under `base`, one commit, no package.json; `gitignore` is the owner's own, when given. */
function repo(base: string, name: string, gitignore?: string): string {
  const dir = path.join(base, name);
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "README.md"), `# ${name}\n`);
  if (gitignore !== undefined) fs.writeFileSync(path.join(dir, ".gitignore"), gitignore);
  git(dir, "init", "-q", "-b", "master");
  git(dir, "config", "user.email", "t272@example.invalid");
  git(dir, "config", "user.name", "t272");
  git(dir, "config", "commit.gpgsign", "false");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "the project before SIA");
  return dir;
}

/** Repository `agent-dashboard` and its linked worktree `dashboard-planner`, which holds the seat file. */
function seatCheckout(gitignore?: string): { main: string; wt: string } {
  const base = tmpBase();
  const main = repo(base, "agent-dashboard", gitignore);
  const wt = path.join(base, "dashboard-planner");
  git(main, "worktree", "add", "-q", "--detach", wt);
  fs.mkdirSync(path.join(wt, ".agents"));
  fs.writeFileSync(path.join(wt, ".agents", "AGENT.local.md"), SEAT);
  return { main, wt };
}

describe("T-272: bootstrap in a seat checkout", { timeout: 60_000 }, () => {
  it("S1: the seat file is neither residue nor an uncommitted change, so check says Scaffold", () => {
    const { wt } = seatCheckout();
    const ins = bs.inspectProject(wt, templateDir);
    expect(ins.agents).toEqual({ kind: "empty" });
    expect(ins.git).toEqual({ kind: "root", commits: true, dirty: [], empty: false });
    expect(ins.next).toBe("Scaffold (`bootstrap scaffold`).");
  });

  it("S2: scaffold keeps AGENT.local.md byte for byte, git ignores it, and AGENT.md names the repository", () => {
    const { wt } = seatCheckout();
    const r = bs.scaffold(wt, templateDir);
    expect(r.verify).toEqual({ ok: true, problems: [] });
    expect(fs.readFileSync(path.join(wt, ".agents", "AGENT.local.md"), "utf8")).toBe(SEAT);
    expect(cp.spawnSync("git", ["check-ignore", "-q", ".agents/AGENT.local.md"], { cwd: wt }).status).toBe(0);
    const agentMd = fs.readFileSync(path.join(wt, ".agents", "AGENT.md"), "utf8");
    expect(agentMd.startsWith("---\nname: agent-dashboard\nrole: none\n")).toBe(true);
    expect(agentMd).toContain("# agent-dashboard — not a seat");
    expect(agentMd).not.toContain("dashboard-planner");
  });

  it("S3: residue beside the seat file moves alone, and the seat file stays in .agents/", () => {
    const { wt } = seatCheckout();
    fs.writeFileSync(path.join(wt, ".agents", "PRISM-START.md"), "# notes\n");
    expect(bs.inspectProject(wt, templateDir).agents).toEqual({ kind: "residue", entries: ["PRISM-START.md"] });
    // T-272 M6: only the seat file is dropped from the dirty list; any other untracked .agents/ file still counts.
    expect(bs.inspectProject(wt, templateDir).git).toEqual({ kind: "root", commits: true, dirty: ["?? .agents/PRISM-START.md"], empty: false });
    const m = bs.moveResidue(wt, TODAY);
    expect(m).toEqual({ to: `.agents/archive/${bs.RESIDUE_PREFIX}${TODAY}`, entries: ["PRISM-START.md"] });
    expect(fs.readFileSync(path.join(wt, ".agents", "AGENT.local.md"), "utf8")).toBe(SEAT);
    expect(fs.existsSync(path.join(wt, m.to, "AGENT.local.md"))).toBe(false);
  });

  it("S4: the import draft's folder-name fallback is the repository's name", () => {
    const { wt } = seatCheckout();
    bs.scaffold(wt, templateDir);
    const d = si.buildImportDraft(wt, TODAY, templateDir);
    expect(d.report.project).toEqual({ name: "agent-dashboard", version: "0.0.0", name_from: "folder" });
    expect(d.state.project.name).toBe("agent-dashboard");
  });

  it("S5: a plain repository (not a worktree) still names AGENT.md after its own folder", () => {
    const dir = repo(tmpBase(), "plain-proj");
    bs.scaffold(dir, templateDir);
    expect(fs.readFileSync(path.join(dir, ".agents", "AGENT.md"), "utf8").startsWith("---\nname: plain-proj\nrole: none\n")).toBe(true);
  });

  it("S6: an owner rule that tracks AGENT.local.md fails scaffold's verify", () => {
    const { wt } = seatCheckout("/.agents/*\n!/.agents/AGENT.local.md\n");
    const r = bs.scaffold(wt, templateDir);
    expect(r.verify.ok).toBe(false);
    expect(r.verify.problems).toEqual([".agents/AGENT.local.md: must stay local, but git would track it"]);
  });
});
```

## Existing tests (planner-read at 9d93d837; verdicts)

| Test | Verdict |
|---|---|
| `tests/pipelines/bootstrap-fix.test.ts`, `bootstrap-fix-r3.test.ts`, `bootstrap-fix-r4.test.ts`, `qa135-bootstrap.test.ts` | **Stay green.** No fixture holds an AGENT.local.md, their projects are plain repositories (the name is unchanged), and their residue entries are other names. `bootstrap-fix.test.ts:404-416` (an owner `.agents/` rule) matches its problem with `toMatch`, and the owner's rule also ignores the seat file, so no new problem appears. |
| `tests/pipelines/t251-role-stubs.test.ts` N7 (`:199-204`, exact `toEqual` on `verify.problems`) | **Stays green.** Its owner rule `/.agents/*` + `!/.agents/state.draft.inputs.json` ignores AGENT.local.md, so the list stays one item. `importProject` writes AGENT.local.md into a pre-state fixture (`.agents/TASKS/`), which `agentsState` classifies before any residue scan. |
| `tests/pipelines/template-seed.test.ts` | **Stays green.** No template file changes. |
| `tests/t249-worktree-identity.test.ts` | **Stays green.** `shared/paths.ts` is unchanged. |
| `tests/pipelines/state-import-t248.test.ts` (`name_from` `flag` and `package.json`), `tests/pipelines/state-import.test.ts` | **Stay green.** Only the folder fallback changes, and on a plain directory `projectIdentityName(root)` equals the old `basename(root)`. No test pins a `"folder"` name. |
| `tests/pipelines/import-cmds-*.test.ts`, `tests/pipelines/briefing-fix-install.test.ts` | **Stay green.** No fixture holds an AGENT.local.md. |
| `tests/pipelines/sync/module-boundary.test.ts` | **Stays green.** `shared/paths.ts` is core, as are bootstrap and state-import. |
| `tests/pipelines/sync/retirements-live.test.ts` | **Stays green.** No pinned line is edited. |

Any other newly failing row: STOP, `BLOCKED T-272 <row>`. To show a row was already red, run its file at the base
(`git switch --detach 9d93d8371c822b8f2ef01e77212c7f125f78eb24`, run, `git switch fix/t272-bootstrap-seat-checkout`) and
paste both outputs.

## Steps

1. **Node and the reply path.** PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t272-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v`. It must print `v22.*`, otherwise BLOCKED.
2. **Start state.**
   - Work in the fresh clone the launcher named. If it named none, run
     `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t272-wt")` and
     `Set-Location` into it.
   - Run `git checkout -q -b fix/t272-bootstrap-seat-checkout 9d93d8371c822b8f2ef01e77212c7f125f78eb24`.
     `git rev-parse HEAD` must print that SHA and `git status --porcelain` must be empty, else STOP, BLOCKED.
   - In `open-brain`, run `npm ci`, then `node -e "require('better-sqlite3')"`. If that prints "Could not locate the
     bindings file", run `npm rebuild better-sqlite3`, re-check, and say so.
   - **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, a `cd` into any other checkout,
     `npm run test:heavy`, killing any process by name, and any edit outside the three files in step 7, except a
     mutant (step 6), which is always reverted.
3. **Commit 1, `T-272: failing rows: bootstrap in a seat checkout keeps AGENT.local.md and names AGENT.md after the repository`:**
   the new test file only. In `open-brain`, run
   `npx vitest run tests/pipelines/t272-seat-checkout.test.ts --no-file-parallelism --testTimeout=180000`.
   - RED, exactly: S1, S2, S3, S4, S6. GREEN: S5. Paste it.
   - Any other split: STOP, `BLOCKED T-272 commit-1 split <row>`.
4. **Commit 2, `T-272: bootstrap keeps a seat checkout's AGENT.local.md, and names AGENT.md and the import after the repository`:**
   rulings 1 and 2. In `open-brain`, run (30-minute wall-clock cap):
   `npx vitest run tests/pipelines/t272-seat-checkout.test.ts tests/pipelines/bootstrap-fix.test.ts tests/pipelines/bootstrap-fix-r3.test.ts tests/pipelines/bootstrap-fix-r4.test.ts tests/pipelines/qa135-bootstrap.test.ts tests/pipelines/t251-role-stubs.test.ts tests/pipelines/template-seed.test.ts tests/t249-worktree-identity.test.ts tests/pipelines/state-import-t248.test.ts tests/pipelines/state-import.test.ts tests/pipelines/import-cmds tests/pipelines/briefing-fix-install.test.ts tests/pipelines/sync/module-boundary.test.ts tests/pipelines/sync/retirements-live.test.ts --no-file-parallelism --testTimeout=180000`.
   - All green. Paste the summary and any failing row.
   - Then run `npx tsc --noEmit`, which must exit 0. Paste it.
   - At most 2 fix attempts on a red row, then STOP, `BLOCKED T-272 <row>`.
5. **Commit messages.** End both with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   `git log --oneline 9d93d837..HEAD` shows 2 lines, and `git status --porcelain` is empty.
6. **Mutants.** For each: edit, run `tests/pipelines/t272-seat-checkout.test.ts` only with step 3's flags, paste the
   failing row names, then `git checkout -- <file>` and confirm a clean tree. Never commit a mutant.

   | Mutant | File | Edit | Rows that go red |
   |---|---|---|---|
   | M1 | `bootstrap/index.ts` | delete the `.filter((n) => !(n === SEAT_FILE && ...isFile()))` line in `agentsState` | S1, S2, S3, S4, S6 |
   | M2 | `bootstrap/index.ts` | delete the second `.filter(...)` in `gitState` (the `` `.agents/${SEAT_FILE}` `` one) | S1, S2, S3 (its dirty list gains `?? .agents/AGENT.local.md`), S4, S6 |
   | M3 | `bootstrap/index.ts` | `agentMd(projectIdentityName(root))` → `agentMd(root.split(/[\\/]/).pop()!)` | S2 (S5 stays green) |
   | M4 | `bootstrap/index.ts` | remove `` `.agents/${SEAT_FILE}`, `` from `FUTURE_LOCAL` | S6 |
   | M5 | `state-import/index.ts` | `name: projectIdentityName(root)` → `name: root.split(/[\\/]/).pop()!` | S4 |
   | M6 | `bootstrap/index.ts` | in `gitState`'s second filter, `=== \`.agents/${SEAT_FILE}\`` → `.startsWith(".agents/")` | S3 |

   M3 and M5 use an inline expression rather than `basename`, so they need no import change.
7. **Scope.** `git diff --name-only 9d93d837..HEAD` must show exactly these files. Anything else: STOP, BLOCKED.
   - `open-brain/src/pipelines/bootstrap/index.ts`
   - `open-brain/src/pipelines/state-import/index.ts`
   - `open-brain/tests/pipelines/t272-seat-checkout.test.ts`
8. **Push and PR.**
   - `git push origin fix/t272-bootstrap-seat-checkout` (never force).
     `git ls-remote origin refs/heads/fix/t272-bootstrap-seat-checkout` must equal `git rev-parse HEAD`. If the push
     is rejected, STOP.
   - Then run
     `gh pr create --base master --head fix/t272-bootstrap-seat-checkout --title "T-272: bootstrap in a seat checkout keeps AGENT.local.md and names AGENT.md after the repository" --body "Brief: docs/loops/t272-bootstrap-seat-checkout-brief.md. Code PR (src)."`
   - Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Where this ruling differs from the fork's prototype

1. **`basename` is removed** from both files' `node:path` imports, because each file's only use is the line this brief
   replaces. The prototype left the unused imports in place.
2. **S3 gains one assertion** (`git.dirty` is exactly `["?? .agents/PRISM-START.md"]`), and mutant M6 is added. The
   prototype's rows never checked that the dirty filter drops ONLY the seat file. A filter on the whole `.agents/`
   prefix passed all six of them.
3. **The `ImportReport.project` doc comment** (line 57) now says the folder is the repository's. The prototype left it
   as it was.

The src lines otherwise match the prototype.

## Reply

- **First line:** `READY T-272 <sha40> PR #<n>` or `BLOCKED T-272 <reason>`.
- **Then each command with its output:** `node -v`, the start-state proofs, commit 1's split, commit 2's run, tsc,
  the six mutants, the name-only diff, `ls-remote` = `rev-parse`, and the PR URL and CI.
- **GitNexus:** name any HIGH, CRITICAL or UNKNOWN impact target from the launcher's block, and say which rows cover
  its callers:
  - `agentsState` and `gitState` are reached through `inspectProject`, `scaffold` and `moveResidue` (S1-S3, S6, and
    the bootstrap files);
  - `scaffold` is covered by S2, S5, S6 and bootstrap-fix;
  - `buildImportDraft` by S4 and the state-import files.
- **Pasting:** paste test output with `grep -a`, or without grep. Mark anything not run `NOT RUN`.
- If the code differs from a line this brief quotes, follow the ruling's intent and say what differed. Do not merge.
