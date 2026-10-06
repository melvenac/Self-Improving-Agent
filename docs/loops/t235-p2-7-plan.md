# T-235 P2-7 — cursor hook dedupe (plan + measurement)

**Seat:** forge / QA PC (DESKTOP-O4EGB1E). **Branch:** `loop/t235-p2-7` from `origin/master` `91e14451`.
**Ruling:** Atlas s161 (five points: SessionEnd scope, wx claim, TTL 120s, live measure, rows R1–R4 + race + SessionEnd).

## Mechanism

- **Claim file:** `~/.claude/open-brain/hook-claims/{sessionStart|sessionEnd}-{session_id}.claim` via `O_EXCL` / `wx`.
- **Scope:** `detectIde(payload) === "cursor"` (`cursor_version` present). Claude Code–shaped payloads with no `cursor_version` are never deduped (R3).
- **TTL:** `HOOK_CLAIM_TTL_MS = 120_000` (2 min). Dual hooks fire within seconds; resume/compact with the same `session_id` after two minutes must run in full (R4).
- **Instrument (no hook stdin):** each claim appends one JSON line to `~/.claude/open-brain/hook-run-metrics.jsonl` and prints `[ob-hook-metric] …` on stderr.

**Stale reclaim (r5, turn 57 / QA 284 D1–D2):** Hot path is still `wx` on the claim file. Stale reclaim takes `wx` on `<claim>.reclaim`, then renames the stale claim aside under that lock. A crashed `.reclaim` is broken only while holding a second wx lock on `<claim>.reclaim.breaker` (aux breaker files use the same TTL rule; sweep skips `*.reclaim` and `*.breaker`). Under the breaker, stat the reclaim lock, optional test seam, re-stat the same inode, then unlink only if still past TTL — never rename-aside on reclaim locks (r4's mismatch-aside `unlinkSync` could delete someone else's fresh lock). **Sweep:** expired `*.claim` files are removed only under that claim's reclaim wx lock with the same stat → seam → re-stat → unlink pattern; tombstones and other non-claim names keep the old cap walk. **F3:** a reclaim or breaker lock whose mtime is still within `RECLAIM_LOCK_TTL_MS` is never broken (unit row). Deterministic interleave rows (D3) pin breaker and sweep seams; r4 rename-aside and stat-unlink sweep shapes stay red in regression tests.

**r6 (QA 284 F1–F6, safety + liveness, frozen `fcc24c74` / CI 37492391602):** Reclaim wx locks are **per generation**: `<claim>.reclaim.<claim-mtimeMs>`. Breaker wx is `<gen-lock>.breaker` or `.rot.<mtime>` for abandoned stale breaker files — **no stat→unlink** in the hot path; stale gen-lock break is stat → seam → re-stat → unlink only while holding breaker wx, aborting if the inode changed after the seam (F2). **Sweep** removes expired `*.claim` only while holding that claim's generation reclaim wx lock, with stat → seam → re-stat → **post-seam snap** → rename-aside → unlink; if another session recreated the claim in the gap, the sweep aborts (fixes N=8 doubles from unlocked sweep). **Hooks** retry up to `CLAIM_RETRY_MS` (2 s) on contention; return `duplicate` immediately when the claim file is still within TTL; `ENOENT` on reclaim stat under lock is **not** “reclaimed” (go back to wx); only a successful rename-aside returns `reclaimed`. Release paths unlink wx aux files **only when the embedded pid matches** (R2). Tombstone sweep re-stats before unlink (F6). Barrier late = start miss &gt;200 ms (F4).

**Safety/liveness (zero-claims / doubles per 100, race-sid where noted):**

| Row | r5 `ba09e2c6` | r6 `57d86689` | r6 `b466eee0` HEAVY + CI barriers |
|-----|---------------|---------------|-----------------------------------|
| Cross N=2 (1 race-sid + 1 other) | 83 / 0 | 0 / 0 | 0 / 0 |
| Cross N=3 (dual race-sid + 1 other) | 72 / 0 | 0 / 0 | 0 / 0 |
| Cross N=8 (dual + 6 others) | 11 / 0 | 0 / 22 | 0 / 0 |
| Cross N=8 (4 race-sid + 4 others) | 2–7 / 0 | 0 / 7 | 0 / 0 |
| Same-session stale barrier N=2/3/8 | 0 / 0 | 0 / 0 | 0 / 0 (CI) |
| Same-session crashed-lock barrier N=2/3/8 | 0 / 0 | 0 / 0 | 0 / 0 (CI, N=8 ×3) |

Deterministic gates: `session-hook-claim-interleave.test.ts` (F1/F2, r6 doubles sweep-restat seam); mutants `claim-mutant-report.mts` (R7).

**Known limits (advisory review — documented only):** **F3:** generation-lock / breaker exclusion holds only while no participant stalls past `RECLAIM_LOCK_TTL_MS`. **F4 (r8):** a crashed generation reclaim lock plus crashed `.breaker` and `.rot.*` aux files can wedge reclaim until manual cleanup (needs three crashes in tight windows; r7 aux sweep was removed as unsafe). **F5:** a crash while holding a generation reclaim lock can yield up to ~60 s of `duplicate` for that session until the lock is stale enough to break.

**r8 (r7 evidence cleanup):** Removed `sweepRemoveAbandonedAuxWx` and `sweepSkipBreakerAndRot`. F1 RED/GREEN uses **M2** mutant via isolated temp build (`claim-m2-f1-gate.mts`); no checkout mutation. F9 cross-session row is GREEN smoke only. `claim-r7-gate-check.mts` deleted.

**r9:** `claim-mutant-report` passes filesystem path (not URL); exits non-zero when `throws>0` or `exact==0`. M2 removes only post-restat snap (seam must fire once). `snapStat` / generation naming: ENOENT only absent; EPERM/EBUSY retry; no `.reclaim.0` fallback. `tryBreakStaleReclaimLockViaBreaker` shared by acquire + test; `drop-breaker-release` isolated mutant RED.

**r10:** `tryClaimHookRun` catches non-ENOENT stat errors from the own-claim path and retries within `CLAIM_RETRY_MS`, then `duplicate` (no hook throw). `claim-mutant-report` invalid only when `throws>0`, `late>0`, or `exact+zeroClaims+doubles≠trials`. Seam rows: EPERM×8 then success → `claimed`; persistent EPERM → `duplicate` ~2s.

## Live counts (QA PC)

| Metric | Before patch (plan s161) | After patch (this branch) |
|--------|--------------------------|---------------------------|
| `cli-bootstrap` full runs per Cursor session | **2** (Cursor `~/.cursor/hooks.json` + Claude `settings.json` SessionStart) | **1** (second invocation: `SESSION_START_SKIPPED`) |
| `cli-session-end` full runs per Cursor session | **1** today from Claude settings; **2** once #425 `sessionEnd` registers (held until P2-7 merges) | **1** per event (second: `SESSION_END_SKIPPED`) |
| `trigger_fires` rows for cursor-agent session | **0** for session `2564043c` (builder P2-5 live measure on QA PC, docs/loops/t235-p2-5-measure.md on PR #436): PostToolUse tool_name is `Shell`, Claude settings matcher is `Bash`, so imported `cli-recall-trigger` does not fire | **0** expected until P2-5 wires recall on Cursor `postToolUse` (out of P2-7 scope) |

**After-patch proof (dual-hook simulation, 2026-10-04):** same payload `session_id=p27-measure-0001` with `cursor_version`:

1. `node …/build/cli-bootstrap.js --ide cursor` → metric `outcome: claimed`, full `SESSION_UUID` output.
2. `node …/build/cli-bootstrap.js` (no `--ide`, Claude settings path) → metric `outcome: duplicate`, `SESSION_START_SKIPPED`.

**PostToolUse / recall under cursor-agent:** Builder P2-5 measure (session `2564043c`, QA PC) confirms **trigger_fires = 0** — matcher mismatch (`Shell` vs `Bash`), not a dedupe problem. P2-7 stays scoped to SessionStart and SessionEnd only (Atlas s161 information turn).

## Tests (vitest, one file per run)

| Row | File | Assertion |
|-----|------|-----------|
| R1–R4, race, sessionEnd claims | `tests/shared/session-hook-claim.test.ts` | wx dedupe, TTL reclaim, concurrent race |
| R1, R3 bootstrap | `tests/cli-bootstrap.test.ts` | skip vs double-run |
| SessionEnd skip | `tests/cli-session-end-dedupe.test.ts` | second end skipped |

**Mutants (QA):** (M1) read-then-write instead of `wx`; (M2) dedupe without `cursor_version` gate — both must restore failing rows.

## Files

- `open-brain/src/shared/session-hook-claim.ts` (new)
- `open-brain/src/cli-bootstrap.ts`, `open-brain/src/cli-session-end.ts`
- `scripts/setup.mjs` — **unchanged** (Claude registration byte-identical)
