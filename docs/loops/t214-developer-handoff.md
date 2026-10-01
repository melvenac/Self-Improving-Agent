# T-214 developer handoff — a whitespace-only line in a declared block is not content

**By:** Builder (developer seat), 2026-10-01. **Branch:** `loop/t214-declared-blank` from origin/master `ec7138bb`.
**Rule:** (a), D-075. `parseDeclared` skips a line matching `^[ \t\r]*$` before any other check. Only spaces, tabs and a
lone `\r` count as blank; a non-breaking space does not (nothing else loosens).

## Runs (QA PC, sequential, Aaron approved the heavy runs in this window)

`npm ci` 0; `npm run build` 0; `tsc --noEmit` 0; `vitest run tests/harness` **0** (30 files passed, 7 skipped; 490 tests
passed, 75 skipped), which includes every existing `b2-et` (declared) and `shadow-merge` test unchanged.
Free RAM: 1.47 GB at the first single-file run (just under the 1.5 GB bar), 1.75 to 1.85 GB before each mutant.
**`/sync` was not run before the commit.**

## Generator counts (`tests/harness/t214-declared-blank.test.ts`, seeded PRNG so a failure reproduces)

- B1: **240** blank-insertion variants (6 valid blocks, 4 `qa-declared` and 2 `qa-unrunnable`, 40 each; 1 to 5 blanks from
  `""`, space, tab, mixed, `\r`; at any position 0..n including before the first header and at the end).
- B2: **30** more as CRLF files. B3: order of ids preserved.
- J1: **60** junk variants (6 blocks, 10 junk strings, plus 2 blanks each), every one still refused.

## Clause map: test, mutant, red then green

| Clause | Test | Mutant (local diff in `docs/loops/t214/mutants/`) | Red | Green |
|---|---|---|---|---|
| P-blank at any position, and order of ids | B1, B2, B3 | `m1-blank-only-before-header` (skips blanks only before a header) | B1 B2 B3 E1 fail | pass |
| whitespace-only counts as blank | B1, B2, B3, E1 | `m2-whitespace-only-not-blank` (blank is `^$`) | B1 B2 B3 E1 fail | pass |
| nothing else loosens (junk, item before header, id in both, id twice, two blocks, NBSP) | J1, J2 | `m3-junk-accepted` | J1 J2 fail | pass |
| both fence kinds | B1, B2, J1, E1 (frozen `qa-unrunnable` bases) | `m4-qa-unrunnable-not-covered` | B1 B2 E1 fail | pass |
| present-but-empty is not absent | E1 | `m5-blank-only-block-absent` | E1 fails | pass |
| the real file | R1 | (base run below) | fails at the base | passes |

**Base red:** the new test file run against `origin/master`'s unchanged `declared.ts` fails B1, B2, B3, E1 and R1
(J1 and J2 pass: refusals already held at the base). R1 is the real `loop-15-slice-3-c-criteria.md`, refused at the base
(R1 fails there; the refusal text is the one the dispatch quotes, which I did not capture) and parsing at the candidate to unrunnable CC-23, CC-24, CC-25 and out-of-scope
CC-26, CC-27, CC-28, CC-21. That file and C's shadow artifact and ledger were not touched.

Mutants were applied with `git apply`, run on the one test file, and reverted with `git checkout`; none is committed
to source. No CI was run.
