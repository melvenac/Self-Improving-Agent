# T-235 P2-7 — cursor hook dedupe (plan + measurement)

**Seat:** forge / QA PC (DESKTOP-O4EGB1E). **Branch:** `loop/t235-p2-7` from `origin/master` `91e14451`.
**Ruling:** Atlas s161 (five points: SessionEnd scope, wx claim, TTL 120s, live measure, rows R1–R4 + race + SessionEnd).

## Mechanism

- **Claim file:** `~/.claude/open-brain/hook-claims/{sessionStart|sessionEnd}-{session_id}.claim` via `O_EXCL` / `wx`.
- **Scope:** `detectIde(payload) === "cursor"` (`cursor_version` present). Claude Code–shaped payloads with no `cursor_version` are never deduped (R3).
- **TTL:** `HOOK_CLAIM_TTL_MS = 120_000` (2 min). Dual hooks fire within seconds; resume/compact with the same `session_id` after two minutes must run in full (R4).
- **Instrument (no hook stdin):** each claim appends one JSON line to `~/.claude/open-brain/hook-run-metrics.jsonl` and prints `[ob-hook-metric] …` on stderr.

**Stale reclaim window:** when a claim file is older than TTL, the loser path `stat` → `unlink` → `wx` retry is not atomic across processes. Two concurrent hooks can both decide the file is stale, both unlink, and both succeed at `wx` on retry — so both run full. That window is narrow (only after TTL, only when two ends fire together) and is separate from the dual-registration race (milliseconds, no TTL) that wx fixes on the hot path.

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
