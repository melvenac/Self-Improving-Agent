# T-194 ship, amendment 1: ship the two QA rows files, restore their tests, and give S4-9.2 an exact platform-skip allowance

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC, RESUME the T-194-ship clone (`oneoff-t194-ship`) on branch `fix/t194-ship-r7` at
`05d7674347cc5d09e65c0a77facd836fde7357b6`, or a fresh clone of that branch. No hub key. Ends at READY, no merge.
REPLY: an ABSOLUTE path under the user's %TEMP% named t194-ship-a1-reply.md (a path in the launcher's line wins);
print it FIRST.

**By:** Atlas (planner), 2026-10-14, session 171. **Task:** T-194. **Tag:** `T-194-ship-a1`. **Amends:**
`docs/loops/t194-ship-r7-brief.md` (everything there still holds unless this file says otherwise).
**Replay script:** `~/Worktrees/t194-replay.mjs` **rev 2** (clark copies it again; rev 1 used `~` paths, and the hook
refuses a tilde before it reads anything else, so four rows reported the tilde rather than the act).

```text
IMPACT-TARGETS: none: tests and test data only (S4-9.2's helper in tests/harness/s4-guards.test.ts; no src symbol changes)
```

## Rulings on the BLOCKED reply (05d76743)

1. **Ship the two rows files.** The brief excluded them by mistake: `r6-qa237.test.ts` and `r7-qa241.test.ts` read
   `docs/loops/t194-r6/qa237-rows.json` and `docs/loops/t194-r7/qa241-rows.json`. Both are checked safe for the
   public repo (the only names in them are the repo's GitHub URL and the env name GH_TOKEN). A suite that skips when
   its data is absent is a test that cannot fail, so try 1's `describe.skipIf(ROWS.length === 0)` is reverted.
2. **Restore both test files byte-for-byte** from 71ea3101. `hook.test.ts`'s typecheck narrowing (commit 05d76743)
   STAYS. It is the smallest edit `tsc -p tsconfig.tests.json` needs.
3. **S4-9.2 gets an exact platform-skip allowance**, built like its existing `ALLOWED_TEST_LOSSES`. r7's two
   `it.skipIf(process.platform !== "win32")` tests check Windows-only path forms (upper-case drive paths, `\\?\`, NTFS
   streams, `/mnt` and `/cygdrive`). They cannot run on Linux CI, and they DO run on the Windows QA PC and in the
   `test-windows` job. An early return inside the body would evade the guard (the builder was right to refuse it), so
   the guard names them instead. Planner pre-check (node over the real diffs, outside the repo):
   - master's added lines since 2448a6ea carry 0 skips;
   - r7's files carry exactly these 2;
   - with the allowance there are 0 findings, and without it 2;
   - dropping an entry gives 1 finding, and an unused entry is 1 stale finding;
   - try 1's `describe.skipIf` stays a finding;
   - the allowance's own source lines (spelled in pieces) do not self-hit.

## Exact edits

**Commit 3, `T-194: ship the QA 237/241 rows files and restore their tests byte-for-byte`:**
`git checkout 71ea3101 -- docs/loops/t194-r6/qa237-rows.json docs/loops/t194-r7/qa241-rows.json open-brain/tests/planner-hook/r6-qa237.test.ts open-brain/tests/planner-hook/r7-qa241.test.ts`.
Then `git rev-parse HEAD:<each of the 4 paths>` equals `git rev-parse 71ea3101:<same path>` (paste the 8 hashes).

**Commit 4, `T-194: S4-9.2 names r7's two Windows-only tests in an exact platform-skip allowance`,** in
`open-brain/tests/harness/s4-guards.test.ts` only:

(a) Directly above the line `describe("slice four guards", { timeout: 120_000 }, () => {`, insert:

```ts
/**
 * The ONLY skips S4-9.2 accepts (T-194 ship, atlas-sia ruling, session 171): a test of Windows-only path forms, which
 * cannot run on Linux CI and does run on Windows. An entry matches one ADDED line EXACTLY (trimmed), and an entry that
 * matches no added line is itself a finding, so an allowance cannot outlive the test it names. Spelled in pieces so this
 * file does not contain what it scans for.
 */
export interface PlatformSkipAllowance { line: string; reason: string }
export const ALLOWED_PLATFORM_SKIPS: readonly PlatformSkipAllowance[] = [
  { line: `it.${"sk"}${"ipIf"}(process.platform !== "win32")("through the hook (Windows): an upper-case absolute path is denied", () => {`, reason: "T-194 r7, planner-hook/r4.test.ts: upper-case Windows paths" },
  { line: `it.${"sk"}${"ipIf"}(process.platform !== "win32")("Windows: case, long-path prefix, NTFS dots/streams and the /mnt, /cygdrive forms", () => {`, reason: "T-194 r7, planner-hook/r5.test.ts: Windows-only path forms" },
];

/** Skip hits no allowance covers, plus every allowance no hit uses; [] means the guard holds. */
export function skipFindings(skipHits: string[], allowances: readonly PlatformSkipAllowance[]): string[] {
  const findings: string[] = [];
  for (const h of skipHits) if (!allowances.some((a) => a.line === h.trim())) findings.push(`skip added with no matching allowance: ${h.trim()}`);
  for (const a of allowances) if (!skipHits.some((h) => h.trim() === a.line)) findings.push(`stale platform-skip allowance: ${a.line}`);
  return findings;
}

```

(b) In `it("S4-9.2 …")`, replace `expect(hits(SKIPS, scopedAdded("skips"))).toEqual([]);` with
`expect(skipFindings(hits(SKIPS, scopedAdded("skips")), ALLOWED_PLATFORM_SKIPS)).toEqual([]);`.

(c) Directly after S4-9.2's closing `  });` (the one right after `expect(testCountFindings(rows, ALLOWED_TEST_LOSSES)).toEqual([]);`), insert:

```ts

  it("S4-9.2b a platform-skip allowance matches one added line exactly, and an unused one is stale", () => {
    const gate = `  it.${"sk"}${"ipIf"}(process.platform !== "win32")("w", () => {`;
    const allow = [{ line: gate.trim(), reason: "row" }];
    expect(skipFindings([gate], allow)).toEqual([]);
    expect(skipFindings([gate], [])).toHaveLength(1);
    expect(skipFindings([`  it.${"sk"}${"ip"}("w", () => {`], allow)).toHaveLength(2);
    expect(skipFindings([], allow)).toHaveLength(1);
  });
```

## Steps

1. Node 22 first on PATH, `node -v` = `v22.*`. In the clone: `git rev-parse HEAD` = `05d76743…` (the 40 chars above),
   porcelain empty, else STOP `BLOCKED T-194-ship-a1 start`. Same forbidden list as the brief (no stash, reset --hard,
   force, rebase, amend, cherry-pick, merge, kill by name).
2. Commit 3, then commit 4, each with the Co-Authored-By line; porcelain empty after each.
3. In `open-brain`, `$env:NO_COLOR='1'`:
   - `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` → both exit 0.
   - `npx vitest run tests/planner-hook tests/harness/s4-guards.test.ts --no-file-parallelism --testTimeout=180000`
     (cap 25 min) → all pass. Expect planner-hook **1101 passed, 0 skipped** on Windows (the two win32 tests RUN here),
     and S4-9.2 plus S4-9.2b pass. Paste the summary. Two tries at a smallest edit in the files this amendment names,
     else `BLOCKED T-194-ship-a1 tests`.
4. **Mutants** (edit, run `npx vitest run tests/harness/s4-guards.test.ts --no-file-parallelism --testTimeout=180000`, paste the
   summary and failing names, `git checkout -- <file>`, porcelain empty; never commit one):
   - **MA:** delete the second `ALLOWED_PLATFORM_SKIPS` entry (the `r5.test.ts` one). Expect S4-9.2 red.
   - **MB:** delete the line `for (const a of allowances) if (!skipHits.some((h) => h.trim() === a.line)) findings.push(…);`.
     Expect S4-9.2b red.
5. **Replay rev 2:** `npm run build` in `open-brain` (exit 0), then `node <path of t194-replay.mjs> <clone-root>`. Paste
   ALL output. C1-C5 must DENY (`CONTROLS OK`). O1-O21 are reported as found.
6. `git log --oneline 712f61bb..HEAD` shows 5 lines; `git diff --name-only 712f61bb..HEAD` shows the brief's 30 paths
   plus `docs/loops/t194-r6/qa237-rows.json`, `docs/loops/t194-r7/qa241-rows.json`, and
   `open-brain/tests/harness/s4-guards.test.ts` (33). `git diff 712f61bb..HEAD -- open-brain/tests/harness/s4-guards.test.ts` pasted.
7. `git push origin fix/t194-ship-r7` (never force); `ls-remote` = `rev-parse HEAD`. `gh pr checks 749 --watch --interval 30`
   (cap 25 min); paste the `test` conclusion. If `test` is red, paste the failing names and STOP: no third try.

## Reply

First line `READY T-194-ship-a1 <sha40> PR #749` or `BLOCKED T-194-ship-a1 <reason>`. Then every command with its
output. Mark anything not run `NOT RUN`. Do not merge.
