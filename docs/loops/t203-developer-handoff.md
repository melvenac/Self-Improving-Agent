# T-203 — developer handoff

Seat: Forge (Claude Code). Branch `loop/t203-seat-by-checkout`, built ON `origin/loop/t198-presence` (`a40fc77`), not
on master: T-203 changes T-198's lookups. Closes **G-049** when merged. Push cleared by the planner for `loop/t203*`
for the seat move to the QA PC. No CI run (D-061).

**Merge order (agreed): t198 → #220 (T-196) → T-203.** The seat file `.agents/SYSTEM/hub-partner-seats.json` is added
by t198 (adopted from T-196's superset blob) and by #220; T-203 MODIFIES it. If #220's blob differs from the one adopted
at `6306ffe`, re-apply T-203's fields on top of it. The only dependency on #220 is that file's format and its
`hub-seats` check, which requires each `seats` key to be listed in `worktree-seats.json` and hub_name and room only for
`cursor: true` entries. I use none of #220's code.

## Commits

| SHA | What |
|---|---|
| `ded9557d6af1017e64db3f1b89a9a3ecc0a9df05` | red rows |
| `5b1dc52e5ebf040e96441107bc6bfa58f5d2010b` | product and the seat-file data |

## Single source

`hub-partner-seats.json` is the one map from a worktree basename to seat, role, agent name and hub name. Each
`seats.<seat>` entry gains `checkout`, `role`, `agent`. `worktree-seats.json` is NOT extended: it stays the layout
rule (which `<project>-<seat>` names may exist) and holds no seat attribute.

Data changes the planner ruled (all in that one file):
- `seats.forge.hub_name` is `forge` (was `grok`, the Cursor/Grok occupant's key, which must not be borrowed);
  `readers.grok` is renamed `readers.forge`; Atlas's own partner row now says `forge` (label and `hub_as`). Until the
  enrollment runs, Atlas's block prints forge as absent, which is true.
- `agent`: Atlas, Builder, Forge, Infra, Probe, Scout. `qa` and `research` are added as seats with no hub_name.
- `seatless_checkouts`: `Self-Improving-Agent` → "main checkout carries no seat".
- **My addition, not ruled:** `seats.forge.cursor` is now `false`, because the forge seat is a Claude Code session and
  no longer a Cursor seat. One-line revert if not wanted; #220's check then needs a room and hub_name for it, which
  the entry has.

## What changed in behaviour

- `resolveCheckoutSeat(projectRoot)` (new, `session-start/seat-map.ts`) resolves the basename. AGENT.local.md is never
  read by it.
- T-198's block and the greeting-size bound resolve the KEY name and the READERS row from the mapped hub name.
  `hubAsForIdentity` and `keyNameForIdentity` are deleted.
- An unlisted checkout prints `presence: UNKNOWN (seat unknown for checkout <c>)` and makes no hub call. The main
  checkout prints `presence: none (main checkout carries no seat)`. A mapped seat with no hub name prints no block.
- New `/sync` check `seat-identity`: the checkout's own AGENT.local.md against the map (name and role). Issue on
  disagreement; skip, with the reason, on the main checkout, an unlisted checkout, no AGENT.local.md, or no map.

## Per row: which red is real (base = a40fc77, the T-198 tip; final tests in an archive)

9 rows fail at base and `seat-map.test.ts` cannot load (the module does not exist), so every S-1 and S-4 row is red.

| Row | Red at base? |
|---|---|
| S-1 map resolution (all rows of `seat-map.test.ts`) | **True base red**: no module |
| S-2 (sia-builder and sia-infra read their own key and readers row; identity null still resolves) | **True base red** (3 rows) |
| S-3 (unlisted checkout line, main checkout line, mapped seat with no hub name) | **True base red** (3 rows) |
| S-4 `/sync` `seat-identity` | **True base red**: no module |
| greeting-size bound follows the map | **True base red** (1 row); also PR-1 and PR-4 fail at base because the partner is now named `forge` in the data |

## Mutants (own branches off `5b1dc52`, unpushed until the move; tsc 0; edit-landed asserted; vitest exit 1)

| Mutant | Edit | Rows that die |
|---|---|---|
| a-identity-fallback `4b39ac410addf8b46990b3b41a5f49cd76164287` | an unlisted checkout falls back to the identity name | S-3 unlisted row (1) |
| b-key-from-identity `4753346ae677a5400526a7ac27ddb8e308a1cf31` | key name from the identity again (the G-049 defect) | 2 (S-2 builder, infra) |
| c-readers-by-identity `0e2396618117f98bdfe15c2e98409fc67a4f0f16` | readers row from the identity | 2 |
| d-check-always-passes `a3e61c85373dc44d54d2ae44f9fc0a702eb997bd` | `seat-identity` never fires | 2 |
| e-wrong-basename `a3389c6e0374379ca2b429cd6c497cea5353aca8` | the map is keyed by the parent directory | all S-1 rows |
| f-main-not-mapped `6646ab6ee7772ff55eaf8a40e41fa7382a4f6fa6` | the seatless map is ignored | 3 |

Mutant `a` failed `tsc` twice (rc 2) before the recorded, type-clean version; the earlier ones were discarded.

## S-4 on the real files (read-only, derived)

`checkSeatIdentity` was run on temp directories named for each checkout, each holding a COPY of that checkout's real
`AGENT.local.md` and this branch's seat file. No real file was touched or edited:

- sia-planner PASS, sia-forge PASS, sia-qa PASS, sia-research PASS.
- **sia-builder ISSUE**: `AGENT.local.md says name Forge, role developer; .agents/SYSTEM/hub-partner-seats.json says
  name Builder, role developer.`
- **sia-infra ISSUE**: same, `says name Infra`.

Each of those two seats fixes its own untracked file once T-203 merges (the planner's instruction).

## Full suite, unpiped, on `5b1dc52`

`node node_modules/vitest/vitest.mjs run` → **exit 1**, 3 failed | 1800 passed | 78 skipped, plus 3 errors (a
`vitest-worker` "Timeout calling onTaskUpdate", the load signature):

1. `tests/harness/qa104-a9-probe2.test.ts` R72 — `EPERM … symlink` (known on this desktop; failed at base in earlier runs).
2. `tests/shared/state-schema.test.ts` T-171 r3b — reads the moving `origin/master` (known).
3. `tests/pipelines/session-start/role-files.test.ts` "records HEAD-behind-upstream…" — a 5000 ms timeout under load;
   passed 13 of 13 alone, twice. Not shown failing at base.

## sync --check (build stamped `5b1dc52`), exit 1

27 passed, 3 issues (retirements, probe-markers, greeting-size), none introduced here. `seat-identity [pass]` on
sia-forge; `worktree-layout [pass]`. greeting-size 48,440 (presence bound 194).

## Not done, and scope notes

- The seat label in "Your handoff" (server.ts) still comes from the AGENT.local.md identity's role; T-202 (the
  seat-online report) does not exist yet. Both are noted, not changed.
- No tcm run (D-061).
