# T-192 replay — Composer 2.5 developer handoff (record 184 / 184b / 184c)

**By:** cursor-infra (Forge seat), record session **184**, 2026-09-27, in `~/Worktrees/sia-infra`.
**Model:** Composer 2.5. **Candidate branch:** `loop/t192-replay-composer` @ **887ae4c**.

## Round 184c — real red-first on tcm

### R184-2 — real rows vs pre-fix product (no manufactured failures)

Branch **`loop/t192-replay-composer-red`** @ 4fa4f62: final test files from 887ae4c, product
`7243fd5` ci.yml + 4aeda0a ci-status behavior (plain failure when inspect inconclusive).

| Run | ID | Result | Why |
|-----|-----|--------|-----|
| **real red** | **36310482876** | failure | tcm; master-push evaluates to `ubuntu-latest` (pre-T-192 ci.yml); inconclusive-case row expects named failure, gets plain `failure` |

### R184-3 — product mutant on own branch

Branch **`loop/t192-replay-composer-mut-silent`** @ fd57197: `checks-state.ts` restores plain
failure fall-through (4aeda0a logic). `silentFallback` removed from candidate product.

| Run | ID | Result | Why |
|-----|-----|--------|-----|
| **mut-silent** | **36310577168** | failure | tcm; inconclusive-case rows expect `failure (…)` detail, product returns plain `failure` |

### Candidate green (184c)

| Run | ID | Result | Why |
|-----|-----|--------|-----|
| **green** | **36310587246** | success | tcm; `loop/t192-replay-composer` @ 887ae4c, 19 tests pass |

Mutant branches are **not** in the candidate history.

## Prior rounds (184 / 184b)

See git history on `loop/t192-replay-composer`. 184b manufactured red 36310020528 is superseded by
36310482876 above.

## Token usage

Cursor did not report token usage in this session.
