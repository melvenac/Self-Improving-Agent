# QA 266 report: T-203 (a seat is resolved by its checkout, #376)

**By:** QA 266 (headless Claude Code, Opus 5.5), record session 159, 2026-10-03. **Dispatch:**
`docs/loops/qa-266-t203-dispatch.md`. **Dispatch tree:** `~/qa-scratch/qa266-wt` at
`7427ee5587f0343bc663cf2e6e8ba49357cab8bf` (`git -C ~/qa-scratch/qa266-wt log -1 --format=%H`).
**Candidate:** #376 `loop/t203-port` at `09f82a12193788df0b50113aae20e2cd3cccf49c` (matches the pinned head;
worktree `~/qa-scratch/qa266-pr376`). **Base:** merge-base `f9a3af2ef3c23fc2ab5792a436c980adf7109a53`
(`~/qa-scratch/qa266-base376`). **Merge row:** `origin/master` `a947b8b47c7eb453207110fe5ca2b691f8affc52` + head
(`~/qa-scratch/qa266-merge`). Job class LIGHT: one test file per vitest run, mutants on touched files only, `tsc`,
`typecheck:tests`, `gh` reads. No full suite. **No live Jev call, no hub call**: every presence probe used a
recording `fetchFn` and the hub URL `http://127.0.0.1:9`. No real hub key was read: this machine has no
`~/.a2a-hub` directory, and all keys in the probes are fake files under `~/qa-tmp`. No issue or PR was created,
commented on or edited. The only branch pushed is `qa/t203-report`, through `push-qa.mjs`.

**Deviation, stated:** `TMPDIR` could not be set to `~/qa-tmp`. The harness refused both `TMPDIR=… cmd` and
`export TMPDIR`, so vitest's `tmpdir()` fixtures went to the default `/tmp`. My own fixtures, the probe scripts and
the mutant runner are under `~/qa-tmp`.

## Verdict

**T-203 (#376, `09f82a12`): ACCEPT.** All nine rows MET. There are three gaps, none blocking (row 5's surviving
QA mutant, row 8's label, row 2's repeated path constant). Merge authority is not pre-approved, so this waits for
Aaron.

## 1. Confined: MET

`git diff --stat origin/master...09f82a12`:

```
 .agents/SYSTEM/hub-partner-seats.json              |  15 ++-
 CHANGELOG.md                                       |   6 ++
 .../src/pipelines/session-start/hub-presence.ts    |  41 ++++----
 open-brain/src/pipelines/session-start/seat-map.ts |  50 +++++++++
 open-brain/src/pipelines/sync/checks.ts            |   2 +-
 open-brain/src/pipelines/sync/index.ts             |   3 +
 open-brain/src/pipelines/sync/seat-identity.ts     |  42 ++++++++
 .../pipelines/session-start/hub-presence.test.ts   | 107 +++++++++++++++++--
 .../tests/pipelines/session-start/seat-map.test.ts | 116 +++++++++++++++++++++
 .../tests/pipelines/sync/greeting-size.test.ts     |  20 ++--
 10 files changed, 352 insertions(+), 50 deletions(-)
```

These are exactly the ten files the dispatch lists, and nothing else. The commits are `b7f7f3a0` (red rows),
`072fb18f` (product), `6c1fbb95` (forge keeps grok), `a29dbd94` (changelog) and `09f82a12` (merge of master).
Master has moved 10 commits past the merge-base, and none of them touches these files. `git merge-tree` against
`origin/master` is clean, and a real merge in `qa266-merge` succeeded (see row 4).

## 2. Single source: MET

- The map is `.agents/SYSTEM/hub-partner-seats.json`. Each `seats.<seat>` now carries `checkout`, `role`,
  `agent` and an optional `hub_name`, and `seatless_checkouts` maps `Self-Improving-Agent`.
- `resolveCheckoutSeat` (`seat-map.ts`) reads only that file, keyed by `basename(resolve(projectRoot))`.
  `describeHubPresence` uses it for the key name (`resolveOwnKey(hubUrl, seat.hubName, keyDir)`) and for the
  readers row (`readers[seat.hubName]`). So do `presenceBlockUpperBound` (which feeds `greeting-size`) and the new
  `seat-identity` check. `keyNameForIdentity` and `hubAsForIdentity` are deleted. `hub-presence.ts` no longer reads
  `opts.identity` anywhere, though the option field remains.
- `worktree-seats.json` is byte-identical to the base (`project`, `seats` name list, description). Only
  `worktree-layout.ts` and `hub-seats.ts` read it, and neither takes a per-seat attribute from it.
- I ran `git grep` at the head for each hub name and checkout name (`cursor-builder`, `cursor-infra`, `grok`,
  `"atlas"`, `sia-builder`, `sia-forge`, `sia-infra`, `sia-planner`, `sia-qa`), over `open-brain/src`, `scripts`
  and `.agents/SYSTEM/*.json`, leaving out the map itself. The only hits are comments (`seat-map.ts:20`,
  `seat-identity.ts:8`, `state-render.ts:228`, `handoff-guard.ts:5`, `latest-brief.ts:54` `*-grok-brief`). No
  other JSON or source file holds a second copy of the seat-to-hub map.
- **Gap (minor, not blocking):** the path string `.agents/SYSTEM/hub-partner-seats.json` is declared three times:
  `HUB_PARTNER_SEATS_REL` in `hub-presence.ts:8` and `sync/hub-seats.ts:15`, plus `SEAT_MAP_REL` in
  `seat-map.ts:5`. All three name the same file, so it is one map behind three path constants, not two maps.

## 3. Data unchanged where unruled: MET

I parsed both JSON files with node:

```
forge.hub_name grok -> grok   cursor true -> true
readers keys base atlas,grok,cursor-infra,cursor-builder | head atlas,grok,cursor-infra,cursor-builder
readers deep-equal true
seat keys base planner,builder,forge,infra | head planner,builder,forge,infra,qa,research
hub_url/talk/talk_tokens/wait unchanged: true
```

No field that already existed in any of the four old seats changed value. The added fields are `checkout`,
`role` and `agent` on all seats, plus the new `qa` and `research` seats (no `hub_name`), `seatless_checkouts`,
and the description.

## 4. Red then green: MET

**Red** (in `qa266-base376`: the head's three test files over the base's source and seat file):

- `seat-map.test.ts`: exit 1, `Cannot find module '../../../src/pipelines/session-start/seat-map.js'`, no tests
  collected.
- `hub-presence.test.ts`: exit 1, **9 failed | 24 passed (33)**. The failures are both R5 key rows (mapped hub
  name, missing key does not fall back), S-2 sia-builder, sia-infra and sia-forge, S-2 null identity, S-3 unlisted
  checkout, main checkout `presence: none`, and sia-qa prints nothing.
- `greeting-size.test.ts`: exit 1, **1 failed | 10 passed (11)**, on "counts the worst-case presence block for a
  reader with partners".

These counts match the PR body exactly.

**Green** at the head (`qa266-pr376`): seat-map **14/14**, hub-presence **33/33**, greeting-size **11/11**.
hub-seats is **5/5**, run as a control on the edited seat file.

**Merge** (`qa266-merge`, current master `a947b8b4` + head): seat-map 14/14, hub-presence 33/33, greeting-size
11/11.

## 5. Mutants: MET

I re-built the mutants by hand in `qa266-pr376` with `~/qa-tmp/mutate.mjs`. For each one the script confirms the
edit landed, runs `tsc`, runs vitest on one file, and restores the file with `git checkout`. `src` status was empty
after every run.

| Mutant | Edit | tsc | Result |
|---|---|---|---|
| a (dev) identity-fallback | an unknown checkout with an identity becomes a seat whose hub name is the identity name | 0 | **killed**: hub-presence 1 failed / 33 (S-3 unlisted checkout) |
| b (dev) key-from-identity | `resolveOwnKey(hubUrl, identity name ?? seat.hubName, …)` | 0 | **killed**: hub-presence 5 failed / 33 (both R5 key rows, S-2 ×3) |
| q1 (QA) role ignored | `seat-identity` compares the name only | 0 | **killed**: seat-map 1 failed / 14 ("a matching name with the wrong role is also an issue") |
| q2 (QA) derived hub name | a seat with no `hub_name` gets `agent.toLowerCase()` (against D-115) | 0 | **killed**: seat-map 2 failed / 14 (sia-qa and sia-research have NO hub name). hub-presence 33/33 (no `probe` readers row) |
| q3 (QA) silent unknown | an unknown checkout returns an empty block | **2** | killed (S-3), but **not counted**: tsc rejects the edit |
| q4 (QA) bound pinned to atlas | `presenceBlockUpperBound` reads `readers["atlas"]` whatever the checkout | 0 | **SURVIVED**: greeting-size 11/11 |

**Gap (not blocking):** q4 survives because every greeting-size row with partners uses `sia-planner`, whose
reader is `atlas`. No row sizes the bound for another seat's checkout, such as sia-builder, so a bound that
ignores the checkout passes. The live presence path (`describeHubPresence`) is covered, since mutant b and the
S-2 rows kill the same kind of edit there. Only the size check's worst-case bound is unpinned.

## 6. Unknown checkout: MET

The probe is `~/qa-tmp/probe.mts`, run against the head's source. In each case `AGENT.local.md` says
`Forge / developer`, and both `forge.key` and `grok.key` are present:

```
[r6 sia-scratch]   lines=["presence: UNKNOWN (seat unknown for checkout sia-scratch)"] fetches=0
[r6 qa266-pr376]   lines=["presence: UNKNOWN (seat unknown for checkout qa266-pr376)"] fetches=0
[ctl main checkout] lines=["presence: none (main checkout carries no seat)"] fetches=0
```

There is no fall back to the identity, and the hub is not called. The test row S-3 and mutant a pin this too.

## 7. Missing key: MET

```
[r7 sia-forge, keys forge + a2a-grok]          presence: UNKNOWN (no hub key for grok at …/127.0.0.1-9/grok.key)            fetches=0
[r7 sia-builder, keys forge + grok + cursor-infra] presence: UNKNOWN (no hub key for cursor-builder at …/127.0.0.1-9/cursor-builder.key) fetches=0
[ctl sia-builder, keys forge + cursor-builder] 2-line presence block, fetches=1, X-Agent-Key = the fake cursor-builder key
```

When the seat's key is absent, no other seat's key is used, including keys that are present for the identity
name or for other seats. The control shows the seat's own key is the one sent. The test rows and mutant b pin
this.

## 8. `/sync` seat-identity: MET

`checkSeatIdentity` on fixtures:

```
sia-builder says Forge/developer   -> issue: … AGENT.local.md says name Forge, role developer; … says name Builder, role developer. The map wins …
sia-infra says Infra/qa            -> issue (role-only disagreement)
sia-builder says Builder/developer -> pass
sia-planner says Atlas/planner     -> pass
sia-forge with no identity file    -> skip (no identity to compare)
sia-scratch (unlisted)             -> skip: seat unknown for checkout sia-scratch
```

End to end, I ran `runSync` (`~/qa-tmp/sync-probe.mts`) on a real scratch git worktree whose basename is
`sia-builder` (`~/qa-scratch/qa266-seat/sia-builder` at the head), with `home` set to `~/qa-tmp`:

```
[no AGENT.local.md (tracked AGENT.md answers)] issue: checkout sia-builder: AGENT.local.md says name Forge, role developer; … says name Builder …
[AGENT.local.md Forge/developer]               issue: (same)
[AGENT.local.md Builder/developer]             pass: … matches the seat map (name Builder, role developer). LIMIT: …
```

The scratch tree's `git status` was clean afterwards. **Gap (cosmetic):** when there is no `AGENT.local.md`, the
identity comes from the tracked `AGENT.md`, but the message still says "AGENT.local.md says".

## 9. CI and typecheck: MET

- `gh pr checks 376`: `changed` pass, **`test` pass (2m56s)**, `test-windows` skipping. All are in run
  **37115492972** (`pull_request`, headSha `09f82a12193788df0b50113aae20e2cd3cccf49c`, conclusion success).
- At the head: `npx tsc --noEmit` exit 0, and **`npm run typecheck:tests` exit 0** with no errors. The 4 errors the
  PR body mentions were fixed by #371, which this head brings in through `09f82a12`.

## Gaps (all non-blocking)

1. QA mutant q4 survives: no greeting-size row checks the presence upper bound for a checkout other than
   sia-planner.
2. The `seat-identity` message says "AGENT.local.md says" even when the tracked `AGENT.md` supplied the identity.
3. The seat-map path is declared three times as constants (same file, one map).
4. T-203's title also names "handoff attribution, seat-online report". Its SCOPE items (1) to (4) do not, and
   those are what was tested. T-199 already attributes handoffs by checkout. This report rules nothing on the
   seat-online report.

QA-266: REPORT COMPLETE
