# Loop 14 re-brief — amendment 2 (rulings made at kickoff)

**From:** Atlas (planner) · **Date:** 2026-09-20 · **Amends:** `loop-14-rebrief-amendment-1.md`.
Rulings made by A2A on the developer's design calls and the QA seat's criteria readings
(`424c618`, unpushed at the time of writing), recorded here because A2A is a transport with no
memory. Where this file is silent, amendment 1 applies, then the re-brief, then the original.

## 1. The greeting check that preceded the kickoff

Before Loop 14 was kicked off, both fresh seats reported their `/start` greetings verbatim for
verification against the record. **Both greetings were faithful renders of trees two merges behind
master** (rev 50 against rev 52): the developer's worktree was still on its predecessor's close-out
branch; the QA worktree was detached at what master had been when its predecessor left. Every
wrong claim — stale objective, "G-045 missing", the developer's handoff shown to the QA seat — had
that one cause. Four instruments (clean tree, `Drift: none`, a valid render, a matching version)
all reported healthy on a stale tree. **The staleness line in amendment 1 gains its design
constraint from this, in the developer's words: it must be legible next to a green drift line,
because they answer different questions.**

Two more things the check surfaced. **The seats' own composition adds claims the record never
made**: both hand-counted the same 35-task render into priority buckets and got different answers,
and the developer's split was wrong both times underneath a correct total. C4 scores only what the
pipeline printed. And **verifying seat identity by running the hook binary reassigns the checkout's
session identity**: `cli-bootstrap.js` writes the active-session slot and generates a uuid when its
input carries none. An instrument that changes what it measures, G-044's family, inside the
pipeline C1 modifies. **C1 gains a read-only identity door.** The corrupted slot is in Aaron's home
directory and is his to repair; the developer was denied the write and correctly stopped.

## 2. Rulings on the QA seat's six readings

1. **Stale role file (C1):** working-tree content differing from HEAD's blob is **required**; the
   path being behind `origin/master` is **recorded only** — the tree-level staleness line owns that.
2. **Unknown seat (C2):** **refused**, in scope. The seat set is closed — planner, developer, qa,
   the harness's `RoleName` — and a seat no identity file can produce is a write without a valid seat.
3. **Other seats' close-out SHAs:** **derived from git at read time**, bounded, failing closed with a
   line that names the bound it searched. A stored SHA would assert a commit that does not exist
   when the write is made — rule 14.
4. **Staleness shapes:** all four required — an explicit *current* line; *could not compare* with the
   reason when `origin/master` is absent; *ahead* never reported as behind; **no network** from the
   start pipeline, which compares to the local `origin/master` ref and never fetches.
5. **The migrated record:** the schema migration of the live `state.json` is the developer's record
   write — `schema_version` moves and revision goes 52 → 53 in one write on the developer's branch —
   and **nothing else writes the record between the candidate and the merge.** The record moves one
   seat at a time through it; QA reads it with the candidate's build in its own tree.
6. **C3's refusal shape:** schema refusal or absence rendered in words both pass; **only silence fails.**

## 3. The developer's design calls, accepted after looking for an objection

- `handoffs[]` with a `seat` field, not a record keyed by seat (the canonicaliser's key-order table
  needs no new machinery for an array).
- C3's rows — `open_prs`, `frozen_sha`, `questions_for_aaron`, `rulings` — are **required but may be
  empty**: `[]` and `null` are answers, absence is refused. Empty and absent must not look alike.
- `end_session` for a uuid already in `last_session` **normalises and says so** — keeps `n`, updates
  the date, prints that it reused N — rather than refusing, because a second close-out mid-loop is
  the case that actually occurs (`G-047`).
- C1 **returns the role files' content** and names each file with its commit; naming without loading
  would close C1's letter and leave `G-032` standing. Cost measured and reported at the C1 boundary.
- One staleness implementation on three surfaces — `ob_start`, the hook, the CLI greeting entry.
- `T-157` is in scope: it is the retention pass in the same writer C2 changes.
- Order, each seen red first: staleness → C1 → C2 → C3 → T-157 → CLI greeting entry.

## 4. Merge choreography, the planner's

Because C2 migrates the record's schema and an older build parses the migrated file as a failure
rather than a downgrade: at the merge the main tree is rebuilt and the server reconnected **before
any seat reads the record**; the planner and QA trees rebuild before their first read; the planner's
close-out write comes after all of that, on the new build. The fresh-session test (C4 as the
re-brief wrote it) is run by Aaron and the planner after the merge and is the loop's acceptance of
last resort, not QA's frozen-SHA verdict.
