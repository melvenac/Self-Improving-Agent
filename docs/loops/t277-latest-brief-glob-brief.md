# T-277: the latest brief also comes from docs/loop-*-brief.md at the docs root

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop or laptop one-off (any Windows host). No hub key. Code PR: one src file, two test files and the three
/start copies. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t277-reply.md (a reply path in the
launcher's line wins). Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 170. **Task:** T-277 (P3). **Tag:** `T-277`. **Size:** SMALL.
**Base:** `88b2c8d40645e9508a291bbb34c4e2c8d9badfc4` (origin/master). If clark re-pins it at launch, that SHA wins.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: latestBriefSelection isBrief (open-brain/src/pipelines/session-start/latest-brief.ts; reached through describeLatestBrief from start-report.ts and latestBriefPath from reads-owed.ts)
```

## Why

T-277 (read its note). agent-dashboard's `/start` printed no `Latest brief:` line, and its planner found the brief by
hand. The cause is in `open-brain/src/pipelines/session-start/latest-brief.ts` at the base:
- `latestBriefSelection` returns null when `docs/loops` does not exist on disk (`:22`). It lists and logs only
  `docs/loops/` (`:24`, `:29`).
- `isBrief` requires the `docs/loops/` prefix (`:72`).

agent-dashboard keeps every brief directly under `docs/` (`docs/loop-14-brief.md`, `docs/loop-14-brief-amendment-3.md`,
`docs/loop-t026-brief.md`, ...) and has no `docs/loops` directory. The planner read this on GitHub at `b126e4c`.

**Planner-run, first-hand (2026-10-13, main-tree build c1975286, scratch fixtures):**

| Input | Result today |
|---|---|
| A repo holding only `docs/loop-2-brief.md` | `null` |
| `docs/loops/t1-brief.md` (09-01) plus `docs/loop-2-brief.md` (10-01) | `Latest brief: docs/loops/t1-brief.md (2026-09-01)`, the OLDER one |
| A clone of agent-dashboard | `null` |

A JS copy of the code ruled below printed `Latest brief: docs/loop-t026-brief.md (2026-10-13)` on that clone. It passed
every new row in this brief and the six mutants were seen to bite on it.

**Out of scope, ruled:**
- **A project setting for the brief location: NO.** Nothing in `latest-brief.ts` or its two callers reads a project
  setting today. One fixed second place covers the only layout anyone has reported.
- **The name rule does not change.** At the docs root a brief also needs the `loop-` prefix, but the endings are T-233
  C's: `brief.md`, `rebrief.md`, or an `-amendment-N` of either. So agent-dashboard's `loop-N-amendment-M.md` and
  `loop-N-addendum-M.md` stay NOT briefs, exactly as they would under `docs/loops`.

## Ruling (exact)

**`open-brain/src/pipelines/session-start/latest-brief.ts` only (src).**

1. Import `readdirSync` beside `existsSync`: `import { existsSync, readdirSync } from "node:fs";`
2. Append this paragraph to the T-210 header comment, after the "Returns the line to print ..." paragraph:
   ```
    * T-277: a project may keep its briefs directly under docs/ instead, as `loop-<x>-brief.md`, `-rebrief` or an
    * `-amendment-N` of either (agent-dashboard does, and its /start had no line). Those count too, by the same
    * commit-date rule across both places. Only the `loop-` prefix counts there, so `docs/design-brief.md` is not one.
   ```
3. Under `export const BRIEF_DIR = "docs/loops";` add:
   ```ts
   /** T-277: briefs kept directly under docs/ (not in a subdirectory), named `loop-<x>-brief.md`, `-rebrief` or an `-amendment-N`. */
   export const ROOT_BRIEF_DIR = "docs";
   export const ROOT_BRIEF_NAME = /^loop-.+-(re)?brief(-amendment-\d+)?\.md$/;

   function rootBriefOnDisk(projectRoot: string): boolean {
     const docs = join(projectRoot, ROOT_BRIEF_DIR);
     if (!existsSync(docs)) return false;
     try {
       return readdirSync(docs).some((name) => ROOT_BRIEF_NAME.test(name));
     } catch {
       return false;
     }
   }
   ```
4. In `latestBriefSelection`, keep the `run` helper and the selection loop exactly as they are. Change three things:
   - `if (!existsSync(join(projectRoot, BRIEF_DIR))) return null;` becomes
     `if (!existsSync(join(projectRoot, BRIEF_DIR)) && !rootBriefOnDisk(projectRoot)) return null;`
   - The `ls-tree` pathspec `` `${BRIEF_DIR}/` `` becomes `` `${ROOT_BRIEF_DIR}/` ``. The `-r --name-only HEAD` arguments
     and the `.filter((p) => isBrief(p))` stay.
   - Right after `if (present.size === 0) return null;` add
     ``const rootBriefs = [...present].filter((p) => !p.startsWith(`${BRIEF_DIR}/`));``. The `log` call's pathspec
     list `` "--", `${BRIEF_DIR}/` `` becomes `` "--", `${BRIEF_DIR}/`, ...rootBriefs ``. A repository with no docs-root
     brief therefore runs the same `git log` as today.
5. `isBrief` becomes:
   ```ts
   export function isBrief(path: string): boolean {
     const base = path.split("/").pop() ?? "";
     if (path.startsWith(`${BRIEF_DIR}/`)) return BRIEF_NAME.test(base);
     return path === `${ROOT_BRIEF_DIR}/${base}` && ROOT_BRIEF_NAME.test(base);
   }
   ```
   Leave `BRIEF_NAME`, its comment, `latestBriefPath` and `describeLatestBrief` unchanged.

**The three /start copies (prose, commit 3).** The line below is line 96 of `.claude/commands/start.md` and
`project-template/.claude/commands/start.md`, and line 99 of `project-template/.cursor/commands/start.md`:

```
brief in `docs/loops/`, a file named `*brief.md`, `*rebrief.md` or an `-amendment-N` of either, by git commit date; do not pick one by loop number or by file name).
```

It becomes this, byte-identical in all three files:

```
brief in `docs/loops/`, or at the docs root as `docs/loop-*-brief.md`, a file named `*brief.md`, `*rebrief.md` or an `-amendment-N` of either, by git commit date; do not pick one by loop number or by file name).
```

Change no other line. Do NOT edit `~/.claude/commands/start.md` or `~/.cursor/commands/start.md`: they are the user's
live copies, and the next install syncs them.

## New rows (exact)

**A. `open-brain/tests/pipelines/session-start/latest-brief.test.ts`.** Put the two helpers after `commit()`, and add
the new `describe` block after the existing one.

```ts
// T-277: a repository with NO docs/loops directory, and a commit helper that takes a repo-relative path.
function bareRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "latest-brief-"));
  made.push(root);
  git(root, ["init", "-q"]);
  return root;
}

function commitAt(root: string, rel: string, date: string, body = "x"): void {
  const parts = rel.split("/");
  mkdirSync(join(root, ...parts.slice(0, -1)), { recursive: true });
  writeFileSync(join(root, ...parts), `${body}\n${date}\n`);
  git(root, ["add", "-A"]);
  git(root, ["commit", "-q", "-m", `add ${rel}`], date);
}

describe("describeLatestBrief — T-277 briefs at the docs root (docs/loop-*-brief.md)", () => {
  it("T277-1: a project with briefs only at the docs root gets a line", () => {
    const root = bareRepo();
    commitAt(root, "docs/loop-2-brief.md", "2026-10-01T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBe("Latest brief: docs/loop-2-brief.md (2026-10-01)");
  });

  it("T277-2a: both places, the docs-root brief is newer, and it wins", () => {
    const root = bareRepo();
    commitAt(root, "docs/loops/t1-brief.md", "2026-09-01T12:00:00+00:00");
    commitAt(root, "docs/loop-2-brief.md", "2026-10-01T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBe("Latest brief: docs/loop-2-brief.md (2026-10-01)");
  });

  it("T277-2b: both places, the docs/loops brief is newer, and it wins", () => {
    const root = bareRepo();
    commitAt(root, "docs/loop-2-brief.md", "2026-09-01T12:00:00+00:00");
    commitAt(root, "docs/loops/t9-brief.md", "2026-10-05T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBe("Latest brief: docs/loops/t9-brief.md (2026-10-05)");
  });

  it.each([
    "loop-3-brief.md",
    "loop-3-rebrief.md",
    "loop-14-brief-amendment-3.md",
    "loop-16-rebrief-amendment-2.md",
    "loop-17a-brief.md",
  ])("T277-3 kept: docs/%s is a brief", (name) => {
    const root = bareRepo();
    commitAt(root, "docs/loop-1-brief.md", "2026-09-01T12:00:00+00:00");
    commitAt(root, `docs/${name}`, "2026-09-20T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBe(`Latest brief: docs/${name} (2026-09-20)`);
  });

  it.each([
    "loop-12-brief-part-b.md",
    "loop-1-amendment-1.md",
    "loop-9-addendum-2.md",
    "design-brief.md", // only the loop- prefix counts at the docs root
    "brief.md",
    "loop-9-brief.md.orig",
    "sub/loop-3-brief.md", // a subdirectory of docs/ other than docs/loops is not the docs root
  ])("T277-4 excluded: docs/%s is not a brief, even when newer than one", (name) => {
    const root = bareRepo();
    commitAt(root, "docs/loop-1-brief.md", "2026-09-01T12:00:00+00:00");
    commitAt(root, `docs/${name}`, "2026-09-20T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBe("Latest brief: docs/loop-1-brief.md (2026-09-01)");
  });

  it("T277-5a: a docs folder with no brief in either place is omitted", () => {
    const root = bareRepo();
    commitAt(root, "docs/README.md", "2026-09-01T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBeNull();
  });

  it("T277-5b: a docs folder with no brief is omitted even outside a git repository", () => {
    const root = mkdtempSync(join(tmpdir(), "latest-brief-"));
    made.push(root);
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(join(root, "docs", "README.md"), "x");
    expect(describeLatestBrief(root)).toBeNull();
  });

  it("T277-5c: a docs-root brief outside a git repository says not determined, as docs/loops does (T210-6)", () => {
    const root = mkdtempSync(join(tmpdir(), "latest-brief-"));
    made.push(root);
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(join(root, "docs", "loop-1-brief.md"), "x");
    expect(describeLatestBrief(root)).toMatch(/^Latest brief: not determined \(/);
  });

  it("T277-6: ob_start prints the docs-root brief", async () => {
    const NL = "\n";
    const root = bareRepo();
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
    for (const d of ["SYSTEM", "TASKS", "SESSIONS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
    writeFileSync(join(root, ".agents", "SYSTEM", "SUMMARY.md"), `# Summary${NL}`);
    writeFileSync(join(root, ".agents", "TASKS", "INBOX.md"), `# Inbox${NL}`);
    writeFileSync(join(root, ".agents", "TASKS", "task.md"), `# Task${NL}`);
    writeFileSync(join(root, ".agents", "SESSIONS", "next-session.md"), `# Handoff${NL}`);
    commitAt(root, "docs/loop-3-brief.md", "2026-09-02T12:00:00+00:00");
    const lines = (await handleStart({ project_root: root })).content[0]!.text.split(NL);
    expect(lines.filter((l) => l.startsWith("Latest brief:"))).toEqual(["Latest brief: docs/loop-3-brief.md (2026-09-02)"]);
  });
});
```

**B. `open-brain/tests/pipelines/session-start/briefing-fix.test.ts`.** Add this inside `describe("BF-R: READS OWED")`,
after BF-R4:

```ts
  it("BF-R5 (T-277): a docs-root brief, with no docs/loops, is owed like one under docs/loops", () => {
    const root = tmp("bf-r5-");
    git(root, "init", "-q", "-b", "main");
    git(root, "config", "user.email", "t@example.com");
    git(root, "config", "user.name", "T");
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(join(root, "docs", "loop-7-brief.md"), "# brief\n", "utf8");
    gitAt(root, "2026-10-01T12:00:00", "add", "-A");
    gitAt(root, "2026-10-01T12:00:00", "commit", "-q", "-m", "seed");
    const state = stateWithSessions([]);
    const line = describeReadsOwed(root, state, 5, "developer", "sia-forge");
    expect(line).toMatch(/^READS OWED \(\d+\): /);
    expect(line).toContain("docs/loop-7-brief.md");
  });
```

**Expected at commit 1 (the base code):**
- These fail in `latest-brief.test.ts`, 16 rows: T277-1, T277-2a, the five T277-3 rows, the seven T277-4 rows, T277-5c
  and T277-6.
- In `briefing-fix.test.ts`, only BF-R5 fails.
- These pass at the base already and must stay green: T277-2b, T277-5a, T277-5b, and every existing row.

## Existing tests (planner-read at 88b2c8d4; verdicts)

| Test | Verdict |
|---|---|
| `tests/pipelines/session-start/latest-brief.test.ts`: T210-1..T210-7 and the T233-C kept (6) and excluded (9) rows | **Stay green**. Every `docs/loops` path is judged exactly as before. With no `docs` folder (T210-2b, T210-2c) the new pre-check still returns null. With `docs/loops` outside git (T210-6) git still runs and fails. The planner ran T210-1, T210-2b, T210-2c, T210-6 and a T233-C row on the prototype. |
| `tests/pipelines/session-start/briefing-fix.test.ts` BF-R1..BF-R4 | **Stay green** (their brief lives under `docs/loops`, or there is none). |
| `tests/pipelines/sync/start-parity.test.ts` | **Stays green**, provided the new line is identical in the three copies. The T-226 rows grab lines matching `*brief.md` and require the two template copies to carry identical brief sentences. They also require line 95's `` `ob_start` names for you on its `Latest brief: <path> (<date>)` line `` (unchanged), and forbid `largest loop number` and `loop-N-*.md` (absent from the new line). "is red against master's Cursor /start" reads `origin/master`, which this change does not move. |
| `tests/pipelines/sync/mirror-parity.test.ts`, `tests/pipelines/sync/command-parity.test.ts` | **Stay green** (synthetic fixtures; the repo and template `.claude` copies stay byte-identical). |
| `tests/pipelines/sync/retirements-live.test.ts` | **Stays green**. R-009 pins one line in each start.md copy, the "There is no mailbox step" obituary, and this change does not touch it. Run it because those files are edited. |
| Golden and `latestBrief:` fixture strings (`a2a-byte-identical`, `briefing-budget`, `fleet-ae-*`) | **Untouched**: they pass the line in as a string. |

Any other row that turns red: STOP and send `BLOCKED T-277 <row>`. To show it was already red, run that file at the
base (`git switch --detach 88b2c8d40645e9508a291bbb34c4e2c8d9badfc4`, run, `git switch fix/t277-latest-brief-docs-root`)
and paste both outputs.

## Steps

1. **Reply path and Node.** In PowerShell:
   - `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t277-reply.md")); "REPLY_PATH=$reply"`
   - `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`
   - `node -v` must print `v22.*`. Otherwise reply BLOCKED.
2. **Start state.**
   - Work in the fresh clone the launcher named. If it named none, run
     `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t277-wt")` and
     `Set-Location` into it.
   - Run `git checkout -q -b fix/t277-latest-brief-docs-root 88b2c8d40645e9508a291bbb34c4e2c8d9badfc4`.
     `git rev-parse HEAD` must print that SHA and `git status --porcelain` must be empty. Otherwise STOP with BLOCKED.
   - In `open-brain`, run `npm ci`, then `node -e "require('better-sqlite3')"`. If it fails with "Could not locate the
     bindings file", run `npm rebuild better-sqlite3`, say so, and run the check again.
   - **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout,
     `npm run test:heavy`, stopping any process by name, and any edit under `open-brain/src` other than
     `latest-brief.ts`.
   - At most 2 attempts at any step, then BLOCKED.
3. **Commit 1, `T-277: failing rows for a brief kept at the docs root (docs/loop-*-brief.md)`:** rows A and B only.
   In `open-brain`, run
   `npx vitest run tests/pipelines/session-start/latest-brief.test.ts tests/pipelines/session-start/briefing-fix.test.ts --no-file-parallelism --testTimeout=180000`
   with a 10-minute wall-clock cap. Paste it. The red set must be exactly the one listed under "Expected at commit 1".
4. **Commit 2, `T-277: the latest brief also comes from docs/loop-*-brief.md at the docs root`:** the src ruling.
   Run the same command: all green. Paste it.
5. **Commit 3, `T-277: /start names the docs-root brief location in its three copies`:** the one-line replacement in the
   three files. Run
   `npx vitest run tests/pipelines/sync/start-parity.test.ts tests/pipelines/sync/mirror-parity.test.ts tests/pipelines/sync/command-parity.test.ts tests/pipelines/sync/retirements-live.test.ts --no-file-parallelism --testTimeout=180000`:
   all green. Paste it.
6. **Final checks.**
   - Run the six files above in one command (same flags, 10-minute cap): all green. Paste it.
   - `npx tsc --noEmit` exits 0. Paste it.
   - Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   - `git log --oneline 88b2c8d4..HEAD` shows 3 lines, and `git status --porcelain` is empty.
7. **Mutants.** For each one: edit `latest-brief.ts`, run `tests/pipelines/session-start/latest-brief.test.ts` only,
   paste the failing row names, then `git checkout -- open-brain/src/pipelines/session-start/latest-brief.ts` and
   confirm a clean tree. Never commit a mutant.
   - **M1** In `isBrief`, `` return path === `${ROOT_BRIEF_DIR}/${base}` && ROOT_BRIEF_NAME.test(base); `` →
     `return false;`. Killed by T277-1, T277-2a, T277-3, T277-4 and T277-6.
   - **M2** `if (!existsSync(join(projectRoot, BRIEF_DIR)) && !rootBriefOnDisk(projectRoot)) return null;` →
     `if (!existsSync(join(projectRoot, BRIEF_DIR))) return null;`. Killed by T277-1 and T277-5c.
   - **M3** In the `log` call, `` `${BRIEF_DIR}/`, ...rootBriefs `` → `` `${BRIEF_DIR}/` ``. Killed by T277-1: a
     docs-root brief then gets no date.
   - **M4** `ROOT_BRIEF_NAME = /^loop-.+-(re)?brief(-amendment-\d+)?\.md$/` →
     `/(^|-)(re)?brief(-amendment-\d+)?\.md$/`. Killed by the T277-4 rows `design-brief.md` and `brief.md`.
   - **M5** In `isBrief`, `` path === `${ROOT_BRIEF_DIR}/${base}` `` → `` path.startsWith(`${ROOT_BRIEF_DIR}/`) ``.
     Killed by the T277-4 row `sub/loop-3-brief.md`.
   - **M6** In `rootBriefOnDisk`, `return readdirSync(docs).some((name) => ROOT_BRIEF_NAME.test(name));` →
     `return true;`. Killed by T277-5b: it prints "not determined" where it should print nothing.
8. **Scope.** `git diff --name-only 88b2c8d4..HEAD` must show exactly these six files. Anything else: STOP, BLOCKED.
   - `.claude/commands/start.md`
   - `open-brain/src/pipelines/session-start/latest-brief.ts`
   - `open-brain/tests/pipelines/session-start/briefing-fix.test.ts`
   - `open-brain/tests/pipelines/session-start/latest-brief.test.ts`
   - `project-template/.claude/commands/start.md`
   - `project-template/.cursor/commands/start.md`
9. **Push and PR.**
   - `git push origin fix/t277-latest-brief-docs-root` (never force). `git ls-remote origin refs/heads/fix/t277-latest-brief-docs-root`
     must equal `git rev-parse HEAD`. If the push is rejected, STOP.
   - Run `gh pr create --base master --head fix/t277-latest-brief-docs-root --title "T-277: the latest brief also comes from docs/loop-*-brief.md at the docs root" --body "Brief: docs/loops/t277-latest-brief-glob-brief.md. Code: open-brain/src/pipelines/session-start/latest-brief.ts, plus the brief sentence in the three /start copies."`
   - Wait for CI with `gh pr checks <n> --watch --interval 30`, capped at 20 min, and paste the `test` conclusion.

## Reply

- **First line:** `READY T-277 <sha40> PR #<n>` or `BLOCKED T-277 <reason>`.
- **Then each command with its output:** commit 1's red set, commit 2's and commit 3's green runs, the final six-file
  run, tsc, the six mutants, the name-only diff, `ls-remote` = `rev-parse`, and the PR URL and CI.
- **Paste test output with `grep -a`, or without grep.** Mark anything not run `NOT RUN`.
- **GitNexus:** name any HIGH, CRITICAL or UNKNOWN impact target from the launcher's header, and say which rows cover its
  callers. `describeLatestBrief` is covered by T277-1..5; `handleStart` through `start-report.ts` by T277-6;
  `latestBriefPath` through `reads-owed.ts` by BF-R5.
- If the code differs from a line this brief quotes, follow the ruling's intent and say what differed. Do not merge.
