# T-250 review r1 (grok-sia-review), verbatim

Room k57c639j4wkyp3y3vhfxxytn1s8fsdx6, job turn 49 (atlas); reply REVIEW 1/1. Committed verbatim by Atlas (s166) per
D-127. Reviewed: PR #556, f16449d4..780e8e1c.

**Planner ruling:** no blocking findings. F1 (major) and F2 (minor) go to round 2 (`t250-default-branch-brief.md`,
§ROUND 2). F3 (nit) is recorded on T-250 and needs no code, because W1 scopes the fix to `origin`. **Correction:** the
review's `looked:` line says `sync/checks.ts does not exist at this sha`. It does exist:
`git cat-file -e 780e8e1c:open-brain/src/pipelines/sync/checks.ts` succeeds, and its callers (lines 2584 and 2603) use
the defaults, like server.ts. The conclusion ("found nothing beyond F2") stands.

```text
--- grok-sia-review ---
REVIEW 1/1 780e8e1

Verdict: no blocking problems. upstream-ref.ts matches W1 exactly (it tries the origin/HEAD symref first, then origin/main, then origin/master, then FALLBACK; git args go in as an array; 3s timeout; it never throws; no ls-remote). Test runs at head, Node v22.23.3, clean token-free clone: tests/pipelines/session-start/ (UR file included) gave 32 files and 490 tests passed.

F1 [major] open-brain/src/pipelines/session-start/role-files.ts:303 at 780e8e1
claim: The W-wiring in readOne (role-file freshness, which was the original T-250 symptom) is not tested at all. Putting back the hardcoded ref leaves the suite green.
evidence: "behindUpstream: isBehindUpstream(projectRoot, rel, resolveUpstreamRef(projectRoot))," while UR-8 only calls "expect(isBehindUpstream(work, \"a.md\", \"origin/main\")).toBe(true);" with an explicit ref (tests/pipelines/session-start/upstream-ref.test.ts:145).
scenario: Mutant M5: replace resolveUpstreamRef(projectRoot) with "origin/master" at role-files.ts:303. I ran tests/pipelines/session-start/ and got 32/32 files and 490/490 tests passed, so the mutant survived. Suggested fix: a UR row that calls describeRoleFiles on a main-default clone and checks for "[behind upstream]".

F2 [minor] open-brain/src/pipelines/session-start/role-files.ts:303 at 780e8e1
claim: The ref is resolved again for every role file. Each call can spawn up to 4 git processes (symbolic-ref, then up to 3 rev-parse --verify), plus the 2 rev-parse calls isBehindUpstream already makes. Within one start it also resolves separately from tree-currency.ts:228 and record-source.ts:58.
evidence: "behindUpstream: isBehindUpstream(projectRoot, rel, resolveUpstreamRef(projectRoot))," / "const upstreamRef = options.upstreamRef ?? resolveUpstreamRef(projectRoot);" / "upstreamRef = resolveUpstreamRef(projectRoot)"
scenario: With N role files that is about 2-4N extra spawns per ob_start. On Windows each spawn costs around 20-50 ms. Right after a fetch, all the resolutions read the same refs, so they agree; they could disagree only if a fetch or set-head runs mid-start, which is a very small window. Suggested fix: resolve once in describeRoleFiles and pass the ref down.

F3 [nit] open-brain/src/pipelines/session-start/upstream-ref.ts:30 at 780e8e1
claim: Only a remote named origin is supported. In a repo whose remote is "upstream", the result is FALLBACK and the existing skip line, which is unchanged from before.
evidence: "if (sym !== null && sym.startsWith(\"origin/\") && verifiesAsCommit(projectRoot, sym)) {"
scenario: A fork whose remote is named "upstream" still gets "origin/master does not exist". This is acceptable under W1, which scopes to origin, but it is worth a note on T-250.

looked: W1-W4 correctness vs brief — W1 exact; wiring at tree-currency:228, record-source:58, role-files:303; render label is now "behind upstream" — F1
looked: detached worktree — refs/remotes and origin/HEAD live in the common dir, so symbolic-ref and rev-parse resolve the same way from a linked worktree — found nothing
looked: origin/HEAD pointing at a deleted branch — verify fails, so it falls through to main/master (UR-2 covers set-head -d; a dangling symref takes the same path) — found nothing
looked: main and master both present, origin/HEAD unset — origin/main wins. Correct for most repos, wrong for a repo whose default is master that also keeps a stale main, but that is only the case when origin/HEAD is unset; this is a spec decision (W1 step 2) — found nothing
looked: explicit upstreamRef callers — server.ts:291 and :297 call with no explicit ref, so they get the default; cli-bootstrap.ts:189 passes only fetch; sync/checks.ts does not exist at this sha (the path in the dispatch is wrong or moved). Explicit refs still override — found nothing beyond F2
looked: security — execFileSync with an array, no shell, ref comes from git's own symref output and must start with origin/ — found nothing
looked: cost — F2
looked: test strength — UR-1..UR-8 cover resolver order, fallback skip text, tree-currency and record-source wiring; role-files wiring mutant survives — F1
time spent: ~25 min


```
