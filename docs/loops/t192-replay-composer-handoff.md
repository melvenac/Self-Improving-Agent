# T-192 replay — Composer 2.5 developer handoff (record 184 / 184b / 184c)

**By:** cursor-infra (Forge seat), record session **184**, 2026-09-27, in `~/Worktrees/sia-infra`.
**Model:** Composer 2.5. **Candidate branch:** `loop/t192-replay-composer` @ **a940e88**.

## Round 184d — D-055 docs-only PR paths-ignore

`pull_request.paths-ignore`: `docs/**`, `README.md` only. `push` and `workflow_dispatch` unchanged.
Test row in `ci-runs-on.test.ts` parses ci.yml with yaml and asserts the three triggers.

| Run | ID | Result | Why |
|-----|-----|--------|-----|
| red-first | **36310806864** | failure | tcm; paths-ignore row red before ci.yml fix (a00a460) |
| green | **36310898399** | success | tcm; paths-ignore added (a940e88) |

Mutant branch **`loop/t192-replay-composer-mut-paths`** @ 23a69b5 adds `.agents/**` to paths-ignore.
Run **36310917190** failure — row expects exactly `[docs/**, README.md]`.

**Branch protection:** GitHub API returns 403 for required-check configuration on this repo plan;
no required check can block a docs-only PR merge.

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
