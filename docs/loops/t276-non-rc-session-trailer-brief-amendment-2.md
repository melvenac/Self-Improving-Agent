# T-276 amendment 2: F3 (r2) uses a late-bridge fixture whose first line is short

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC or laptop one-off, NOT the desktop. No hub key. Code. Ends at READY with PR #710 updated, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t276-r3-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 171. **Task:** T-276 (P2). **Tag:** `T-276`. **Size:** SMALL.
**Branch:** `fix/t276-session-trailer` at `1d855c87dfd15e3eac778aba2f87d1f0cb90b60a` (PR #710, round 1; r2 committed
nothing). **Master to merge:** the dispatch SHA clark names; if none, `git rev-parse origin/master` after the fetch.
**Amendment 1 stands** (`docs/loops/t276-non-rc-session-trailer-brief-amendment-1.md`): its ruling 1, its steps and
its mutants, with the one change below. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: endSessionWindow handleEnd (open-brain/src/server.ts); covered by tests/t276-session-trailer.test.ts F1-F3 and tests/end-fix-*.test.ts
```

## Why

r2 replied BLOCKED, and the builder is right (`~/Worktrees/t276-r2-reply.md`, outside the repo):
- Amendment 1's F3 (r2) used `lateBridge()`, which puts the 300,000-byte pad on the FIRST record, the one carrying
  `timestamp`. `endSessionWindow`'s `since` comes from `sessionStartFromTranscript`, which reads only the 256 KiB head,
  so that line never parses, `since` is null, and `handleEnd` prints RECORD NOT CHECKED before the UNATTRIBUTED block.
  Ruling 1 cannot turn that row green, and at round 1 it failed for the wrong reason.
- The builder probed a corrected fixture: a short first line, then the pad on its own record, then the bridge record.
  At round 1's src, F3 goes red for the predicted reason (`not to contain 'no Remote Control id'`); with ruling 1 applied,
  all 17 rows pass. The planner's fixture was wrong, not the ruling.
- A real transcript's first record is short, so the corrected fixture is the realistic one. `lateBridge()` stays as it
  is: A4 uses it to pin the head-only reader, and that is still right.

## Ruling (the one change to amendment 1)

1. In `open-brain/tests/t276-session-trailer.test.ts`, add this helper directly after `lateBridge()`:
   ```ts
   /** T-276 r3: a late bridge whose FIRST record is short, as a real transcript's is, so the head still holds the session start. */
   function lateBridgeShortHead(dir: string): string {
     const p = join(dir, "late-bridge-short-head.jsonl");
     writeFileSync(
       p,
       `{"timestamp":"${START}","sessionId":"${U}"}\n{"type":"user","pad":"${"x".repeat(300000)}"}\n{"type":"bridge-session","bridgeSessionId":"cse_${ME}"}\n`,
     );
     return p;
   }
   ```
2. Amendment 1's F3 (r2) row uses `proveSessionWithTranscript(dir, lateBridgeShortHead(dir));` in place of
   `proveSessionWithTranscript(dir, lateBridge(dir));`. Every other line of the row, and of E3 (r2) and C3 (r2), is
   exactly as amendment 1 gives it.
3. **Expected at commit 1 (round 1's src):** F3 (r2) RED on `not.toContain("no Remote Control id")` (its first
   assertion passes). E3 (r2) and C3 (r2) GREEN. Every other row green. Paste the failing assertion; any other outcome:
   STOP, BLOCKED.
4. The mutant list is amendment 1's (MX1, MX2, MX6, MX7). MX6 must turn F3 (r2) red.

Everything else (steps 1-9, the server.ts conflict rule, scope, reply) is amendment 1's, with the reply named
`t276-r3-reply.md` and commit messages saying `r3` where amendment 1 says `r2`.
