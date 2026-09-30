# T-198 r2 — developer handoff

Seat: Forge (Claude Code, `sia-forge`). Branch `loop/t198-presence`, base `231f501` (QA 225 REJECT). Local only:
nothing pushed, no CI (D-061). Scope: QA 225's four majors (hub turn 235) plus the own-key fix (turn 236).
Plan approved by the planner, with three rulings: worst-case bound in `greeting-size`; no dispatch, QA runs the tcm
row; key name is the reader's identity lowercased.

## Commits

| SHA | What |
|---|---|
| `6306ffe77a7d734fa6787009b1185db644f9b4af` | red rows; adopts the T-196 superset `hub-partner-seats.json` blob unchanged |
| `f172e280aa1532c7a246a9017e1dd79c65e7028a` | product (also holds a fixture-name fix to one greeting-size row: the two roots differ in path length, which shows in the text) |

## Per row: which red is real

| Row | Change | Red at 231f501? |
|---|---|---|
| R1 wording | lines say `listener polling` / `listener not polling`; header says it is listener activity, not proof the seat read a turn | **True base red** (PR-1, PR-2, R1 wording row) |
| R2 validation | every agent and room validated; one `UNKNOWN (malformed body: <path> …)` line | **True base red** (7 rows, including QA's probe body) |
| R3 greeting-size | a worst-case block is counted in `composeGreeting` and printed as `worst-case upper bound, not fetched` | **True base red** (3 rows) |
| R4 tcm egress | all requests use an injected `fetchFn`; tripwire on global `fetch` and `net.Socket.connect` | **True base red, by the ORIGINAL tests**: below |
| R5 own key | `X-Agent-Key` from `<keyDir>/<host>-<port>/<name>.key`; missing/unreadable/short key prints `UNKNOWN`, no hub call, no fallback | **True base red** (6 rows) |

19 of the new rows fail against the unfixed product (37 rows in the two files; 18 pass at base: existing PR-3, PR-4,
PR-5, PR-6, header, tripwire-armed and the pre-existing greeting rows).

### R4 evidence (D-061: no tcm run by me)

The original nine tests from `231f501`, run in a `git archive` of `231f501` with a tripwire that makes the global
`fetch` throw, give **5 failed | 4 passed**: PR-1, PR-2, PR-3 non-2xx, PR-3 malformed JSON and the header test — the
same five QA 225 saw fail on tcm. The rewritten tests contain no socket; the tripwire is armed by a row of its own.
The tcm run itself is the row the planner puts into QA's dispatch.

## Design choices

- **Key name.** `keyNameForIdentity` is the identity name lowercased (`forge`, `atlas`), separate from the readers-map
  name (`hubAsForIdentity`: Forge is looked up under `grok`). `grok.key` exists on this machine and belongs to another
  seat; it is never read. No `AGENT_KEY` env override (not needed by the server).
- **No listener overclaim.** No "last post": the roster's `lastSeenAgeMs` is the agent's last hub contact, not a post.
- **Bound, not a fetch.** `presenceBlockUpperBound` builds the block from the same seat file and formatter with every
  partner at `999 unread since 99d`. The one-line `UNKNOWN` form is not counted (stated in the code).
- `swallowFetchErrors` (the PR-5 mutant hook) is left as QA 225 scored it met; I did not widen scope to remove it.

## Mutants (own branches off f172e28, unpushed; tsc 0; edit-landed asserted; vitest exit 1)

| Mutant | SHA | Edit | Rows that die |
|---|---|---|---|
| r1-seat-seen | `c60d13a6ed7564de6fa019c63124772be8ee1599` | line becomes `polling (seat has seen this turn)` (QA's surviving mutant) | PR-1, R1 wording (2) |
| r2-array-only | `cc114bf88f63bc41ce1a14fa4fb09d8f8f9e2030` | validation returns after the array check | all 7 R2 rows |
| r3-no-bound | `1419350e1e00c302d1aefbb37659dc67dcf67710` | presence term removed from `composeGreeting` | the greeting bound row (1) |
| r5a-dev-key | `8eb31b7d4b749c54eefa0199df4f6385450909d3` | header is `dev-key` again | 2 R5 rows |
| r5b-fallback | `86b6389f839e05d22a87811f82a0edeffe1315a1` | falls back to `dev-key` when there is no key | 4 R5 rows |

The mutant runner calls node on the tsc and vitest entry points and refuses a null exit status (an earlier C r4 run
read `null` for every mutant because `npx.cmd` did not spawn).

## Full suite, unpiped, on f172e28

`node node_modules/vitest/vitest.mjs run` → **exit 1**; 2 failed | 1780 passed | 78 skipped (132 files: 2 failed, 122
passed, 8 skipped). Both failures are the ones seen at `5f7c9a0` for C r4, outside this task:
`tests/harness/qa104-a9-probe2.test.ts` R72-BEFORE-ABSENT-DANGLING (EPERM on symlink) and
`tests/shared/state-schema.test.ts` T-171 r3b (reads the moving `origin/master`).

## Which key file each seat resolves to on this desktop, derived

`~/.a2a-hub/keys/100.124.212.87-4000/` holds: a2a-grok, aaron, atlas, cursor-builder, cursor-infra,
cursor-qa2-composer, cursor-qa2-gpt, grok, grokbot, melve-76, relay. **No `forge.key`.**

Each checkout's `AGENT.local.md` (untracked) gives its identity, and the identity — not the seat — picks the reader row
and the key name:

| Checkout | Identity | Reader row | Key file | Prints |
|---|---|---|---|---|
| `sia-planner` | Atlas / planner | `atlas` | `atlas.key` (exists) | the block |
| `sia-forge` | Forge / developer | `grok` | `forge.key` (**missing**) | `presence: UNKNOWN (no hub key for forge at …)` until Aaron's enrollment runs |
| `sia-builder` | **Forge / developer** | `grok` | `forge.key` (**missing**) | UNKNOWN, and its reader row is grok's room, not the builder's |
| `sia-infra` | **Forge / developer** | `grok` | `forge.key` (**missing**) | UNKNOWN, and grok's room, not the infra room |
| `sia-qa` | Probe / qa | none | — | no block (no reader entry) |
| `sia-research` | Scout / none | none | — | no block |

**Named finding, not fixed here:** the Cursor seats' checkouts carry the identity `Forge`, so they do not map by
lowercasing to `cursor-builder` / `cursor-infra`, and `cursor-builder.key` / `cursor-infra.key` exist but are never
looked up. Mapping an identity to its own reader row and key needs the checkout's seat (the `worktree-seats.json`
layout) or a per-checkout hub name, which is the planner's to reconcile.

## sync --check after a rebuild (build stamped f172e28), exit 1

27 passed, 3 issues (retirements, probe-markers, greeting-size), none in this task's files except the size, which was
already over the limit (T-183). The greeting-size line now includes the block: `greeting is 48440 characters, over the
40000 limit (state render 24641, role files 22974, tree and seat 628, presence block 194 (worst-case upper bound, not
fetched))`. QA 225 measured 48,244 without the block; the bound adds 194.

## Not run

- The tcm run with no egress (QA's row, per D-061).
