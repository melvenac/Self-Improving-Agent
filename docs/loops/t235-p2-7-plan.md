# T-235 P2-7 — cursor hook dedupe (plan + measurement)

**Seat:** forge / QA PC (DESKTOP-O4EGB1E). **Branch:** `loop/t235-p2-7` from `origin/master` `91e14451`.
**Ruling:** Atlas s161 (five points: SessionEnd scope, wx claim, TTL 120s, live measure, rows R1–R4 + race + SessionEnd).

## Mechanism

- **Claim file:** `~/.claude/open-brain/hook-claims/{sessionStart|sessionEnd}-{session_id}.claim` via `O_EXCL` / `wx`.
- **Scope:** `detectIde(payload) === "cursor"` (`cursor_version` present). Claude Code–shaped payloads with no `cursor_version` are never deduped (R3).
- **TTL:** `HOOK_CLAIM_TTL_MS = 120_000` (2 min). Dual hooks fire within seconds; resume/compact with the same `session_id` after two minutes must run in full (R4).
- **Instrument (no hook stdin):** each claim appends one JSON line to `~/.claude/open-brain/hook-run-metrics.jsonl` and prints `[ob-hook-metric] …` on stderr.

## Live counts (QA PC)

| Metric | Before patch (plan s161) | After patch (this branch) |
|--------|--------------------------|---------------------------|
| `cli-bootstrap` full runs per Cursor session | **2** (Cursor `~/.cursor/hooks.json` + Claude `settings.json` SessionStart) | **1** (second invocation: `SESSION_START_SKIPPED`) |
| `cli-session-end` full runs per Cursor session | **1** today from Claude settings; **2** once #425 `sessionEnd` registers (held until P2-7 merges) | **1** per event (second: `SESSION_END_SKIPPED`) |
| `trigger_fires` rows for plan measure session | **Not isolated in this slice** — global DB has many sessions; P2-2 scratch run did not call recall trigger | Re-run cursor-agent after merge with same instrument; builder P2-5 needs per-session count from a session that exercised PostToolUse Bash recall |

**After-patch proof (dual-hook simulation, 2026-10-04):** same payload `session_id=p27-measure-0001` with `cursor_version`:

1. `node …/build/cli-bootstrap.js --ide cursor` → metric `outcome: claimed`, full `SESSION_UUID` output.
2. `node …/build/cli-bootstrap.js` (no `--ide`, Claude settings path) → metric `outcome: duplicate`, `SESSION_START_SKIPPED`.

**PostToolUse / recall under cursor-agent (plan s161):** Claude `settings.json` PostToolUse/Bash hook is registered; P2-2 scratch logger showed `postToolUse` events with `session_id`. Direct `cli-recall-trigger` fire count was not logged in that scratch run; **likely fires** when the agent uses tools, pending a dedicated recall-instrumented session for P2-5.

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
