# Loop 16 — developer handoff

**From:** Forge (developer) · **Date:** 2026-09-20 · **Branch:** `loop/16-recall-trigger`, cut from
`origin/master` at `4550ee5` · **Candidate:** rev 9 — the tip of this branch at hand-over, posted to the planner by SHA (a file
cannot carry its own commit hash, so the SHA lives in the hand-over message and in `git log`)
**Brief:** `loop-16-brief.md` (`8457600`), as amended by all eight amendments, in order:
`1453e5f` (R1–R11), `c43a31f` (R12–R14), `1051cae` (R15), `5ab0ac4` (R16–R18), `6da5fa9` (R19),
`f28ed11` (R20, Planner 53), `3db1365` (R21), `29766dc` (R22–R24). Where an amendment and the brief
disagree, the amendment governs; this file cites the ruling by number rather than restating it.
**Not squashed, not rebased, not reordered** (R9). The first commit is A1 failing and it is still
there: `90e314f`.

> **The one-sentence version.** Something now asks the store at the moment of the act, deterministically,
> and says nothing when the store has nothing — and every time it asks, the record says whether it
> looked.

---

## 1. Commits, in order

| rev | SHA | what |
| --- | --- | --- |
| 1 | `90e314f` | **A1 red.** The fixture and the assertion; the module is a stub so the failure names the missing behaviour rather than a missing file. |
| 2 | `ee74fd1` | The derivation and the precision-only query. A1 green, A2's query half, A3. |
| 3 | `12b5aeb` | A4 — the floor as data, measured against the live store. M5 dead. |
| 4 | `405a5e3` | The fire record: R5's sibling table, R16's three states, A2 complete, R6's census value, R19's provenance. |
| 5 | `1afb04c` | The `PostToolUse` hook. A5, A6, A10's number. |
| 6 | `4a9b056` | CHANGELOG and README — **reverted at rev 8**, see below. |
| 7 | `fcdac0a` | This handoff. |
| 8 | `8851afb` | Revert of `4a9b056`. R24 forbids a version bump, CHANGELOG or README before acceptance; they had already been committed when the ruling arrived, so they come out by revert rather than by rewrite — R9 keeps this branch unsquashed, and a revert is additive where a rebase would erase that it happened. The CHANGELOG text survives in `4a9b056` for a cherry-pick at close-out. |
| 9 | *(this commit)* | This section and the amendment citations. **The frozen candidate**, reported to the planner by SHA. |

## 2. What to check first, because it is the thing most likely to be wrong

**The floor is a number measured against one corpus on one day, and bm25 moves under it** (R19).
`relevance_floor: 8.0` was measured on **2026-09-20 against the live store at 599 entries**, where
the G-039 query scores `14.01 / 12.29 / 10.62` for the three genuinely relevant entries and
`6.83 / 6.03` for the two irrelevant ones. 8.0 sits in that gap. The same query against a
three-document fixture scores everything at about `5e-6`, because a term carried by most of a tiny
corpus says almost nothing.

The consequence is sharper than it looks: **a fixture that does not resemble the corpus cannot test
this value at all.** At the shipped floor a small store is silent for every input, so "the floor
silenced the weak match" would pass with the floor doing no work. `floor.test.ts` therefore builds
599 documents and carries a row asserting that it still does. If that row ever goes red, every A4
assertion below it has gone vacuous, not wrong.

The provenance lives in the policy file and the zod contract **requires** it, so it cannot be
dropped by an edit that changes the number.

## 3. The design, and the one decision everything follows from

**Deriving a query by ANDing a command's words is dead on arrival.** FTS5 is conjunctive, so
`npx vitest run 2>&1 | tail -8; echo $?` asks for an entry containing *npx* AND *vitest* AND *run*
AND *tail* AND *echo* — which matches nothing in a real store, **including entry 299, the entry
that describes that exact mistake**. The repair for that in `ob_recall` is the `OR` fallback, and
§5.4 forbids it here.

So precision-only is not a filter over a broad query; **it forces the query to be narrow by
construction.** The derivation recognises risky *elements* of a command and ANDs the terms each
contributes:

| element | terms |
| --- | --- |
| a pipeline whose **last** stage trims (`tail`/`head`/`grep`) | `tail` |
| a read of `$?` or `${PIPESTATUS` | `exit`, `code` |

A fixed table in code — no model call, no network, reproducible from a transcript alone (R7).
**A command with no recognised element derives no query and the store is never asked.** Ruled
accepted in amendment 4 §1; the table is small on purpose and grows on evidence.

`PostToolUse`, not `PreToolUse` (R1): both events carry `additionalContext` to the same place, next
to the tool result, but exit 2 blocks on `PreToolUse` and is ignored on `PostToolUse`, which also
honours neither `permissionDecision` nor `updatedInput`. "Never blocks" is therefore **structural**
rather than a promise this code keeps. The moment suits the act anyway: the damage in G-039 is done
when the seat reads the trimmed output and the `0`.

## 4. Three states, and why the table is a sibling

`ob_recalled` saying *no knowledge entries recalled this session* could not tell **nothing asked**
from **asked, and nothing relevant**, and for five loops that was read as inconclusive when it was
the answer. `trigger_fires` records every invocation as `not-asked`, `silent` or `injected` (R16),
and `ob_stats` prints all three counts — always three lines, zeros included, because an omitted
section reads as *not measured*.

It is a **sibling table rather than more rows in `recall_log`** (R5) for a structural reason:
`getSessionRecalledIds` treats `recall_log` as the authoritative rated set at `/end`, and those
ratings move `success_rate`, which gates apoptosis. A looked-at entry there would write ratings for
entries nobody read. Keeping fires separate makes that impossible by construction rather than by a
filter someone must remember. (`recall_log.knowledge_id` is `NOT NULL` and `recordRecallEvent`
early-returns on an empty id list, so a silent fire has no shape to take there in any case.)

`hook` joins `RECALL_TRIGGERS` in the database and **not** `ob_recall`'s zod enum (R6), so an agent
cannot file its own deliberate fetch as an injection nobody asked for.

## 5. What went wrong, which is worth more than what went right

**I hit G-039 myself, in this loop, while measuring the cost of the fix for it.** Running the A10
script as `node .a10.tmp.mjs 2>&1 | tail -12; echo $?`, the script crashed on a module-resolution
error and the shell reported `A10_EXIT=0`. I read `tail`'s status. Entry 299 describes that act; the
store I was benchmarking contained it; the hook I had just built would have injected its `ACTION`
next to that tool result — and it is not registered, so nothing fired. Caught only because a stack
trace under a green exit is visibly wrong. **A quieter failure would have entered a report as a
measurement.**

**A mutant found a defect in my test rather than in my code, on the exact observable a ruling had
just been written for.** M18 — make every failure write to stderr — survived the entire hook file,
because `execFileSync` **returns only stdout** and the harness hardcoded `stderr: ''` on the success
path. Every `expect(result.stderr).toBe('')` in the A6 block passed *without ever looking*, days
after R15 was added to require exactly that assertion. Rewritten on `spawnSync`.

**Recorded as a class by the planner (R24): an assertion on a value the harness never captured.**
It is not the same as a vacuous assertion — the value existed, the code produced it, and the
assertion was well formed. The instrument simply never carried it to the place the assertion read.
A negative assertion is only as good as the channel it reads from, and `execFileSync`'s return value
is one channel of the three.

**A redundant guard made the real one untestable.** An `existsSync` check answered before
`fileMustExist` could, so a mutant turning that flag off survived. One guard now, and it is tested.

**Two of my own mutants were not valid mutants.** One changed a field the code under test does not
read; one matched two sites and the runner refused rather than silently mutating the wrong one. A
mutation runner that picks the first match would have reported "killed" about a line I did not mean
to change.

**The fixture guard earned its place on the first run.** A1's second assertion — *do these decoys
actually share the command's tokens?* — went red at 9 of 10. Three of my decoys contained none of
`tail`/`exit`/`run`/`code`, so A1 would have gone green against a store where 299 was nearly the
only matching row: the test would have measured "FTS can find the one matching entry" and reported
it as "the trigger ranks 299 first". Same class as the two defects found in the brief.

## 6. Mutants

Twenty-two, all `tsc --noEmit` clean before being counted valid.

| id | mutant | result |
| --- | --- | --- |
| M1–M3 | OR joiner; `ORDER BY` removed; status-read contributes no terms | red |
| M4 | pipeline requirement dropped | **survived**, then killed (R18) |
| M5 | floor filter removed | **declared live at rev 2**, killed at rev 3 |
| M6–M7 | derived schema hand-edited; shipped floor changed | red |
| M8–M12 | recall_log write removed; `explicit` not `hook`; not-asked as silent; empty context; whole entry injected | red |
| M13–M16 | provenance loses size / date / requiredness; `trigger/` un-declared | red |
| M17b–M21b | success exits 1; stderr written; empty context; store created; deadline literal | red (four of these survived the first battery) |
| M22 | the query gets the **writable** handle | **survives — declared** |

**M22 is declared, not hidden.** Handing the query the writable connection changes nothing
observable, because the query only reads; a capability restriction has no behavioural evidence until
code exists that would violate it. Instead there is a row asserting the handle *is* read-only in
both directions — the query works through it, a write through it is refused.

## 7. A10 — the cost, with the method

Built entry point via `node`, 60 samples per arm, one warm-up discarded, 599-document store, nothing
else running, wall time measured around the spawn in the parent.

| arm | p50 | p95 | max |
| --- | --- | --- | --- |
| `node -e ""` — interpreter floor | 58.8ms | **65.5ms** | 70.6ms |
| not-asked (`git status --porcelain`) | 229.7ms | **277.2ms** | 293.7ms |
| injected (the G-039 command) | 235.6ms | **306.6ms** | 332.0ms |

**The interpreter floor is 21% of it, not the bulk** — which contradicts what I predicted before
measuring. The cost is the hook's own work: loading the native SQLite binding and opening the store.

**The common case pays 277 of the 307ms while asking the store nothing.** It pays it because R16's
census requires a fire row for every invocation, and that row is a write, so a `not-asked` call must
still open the store. **Completeness of the denominator costs about 0.28s on every `Bash` call.**
That is a trade for the planner, not for this seat: make the common case cheap and the census loses
the number that makes *did the memory half get used* answerable.

**Ruled (R22): the census keeps its denominator this loop.** The 0.28s is the evaluation period's
price, stated and put to Aaron rather than optimised away under a verdict. **The named follow-up,
not built here:** a cheap `not-asked` path that appends to the log file the hook already writes and
lets the session-end hook reconcile those lines into `trigger_fires` — which keeps the three counts
whole while taking the store open off the common path.

A number, not a verdict (§4 A10). The configured host `timeout` in the registration is **10s**;
`deadline_ms` in the policy is **2000**. They do different jobs — see §9.

## 8. The targeted test set (R12), named

Scored run, exit code read from the process:

```
tests/trigger/**            (query, negatives, floor, fires, hook)
tests/recall-broadening.test.ts
tests/ranking.test.ts
tests/db-v2.test.ts
tests/rating-method.test.ts
tests/pipelines/session-end/recalled-ids.test.ts
tests/server.test.ts
tests/pipelines/sync/module-boundary.test.ts   ← added: the candidate touches MEMORY_SIDE
```

At `4a9b056`: **11 files, 130 tests, exit 0.** Full suite alone at rev 5: **70 files, 1021 tests,
all passed, exit 0.**

**`A9` holds by construction:** this branch only *adds* test files. No existing recall assertion is
touched.

**G-042, five sightings in this one tree:** rev 2 clean (986), rev 3 timeout (997 passed, exit 1),
rev 4 timeout (1008 passed, exit 1), rev 5 clean (1021), all run alone. Every timeout had **zero
failing tests** — the `[vitest-worker]: Timeout calling "onTaskUpdate"` heartbeat only. Reported,
not scored (R12).

## 9. Registration, and the defects it inherits by name

```jsonc
"PostToolUse": [{ "matcher": "Bash", "hooks": [
  { "type": "command", "command": "node \"/abs/path/to/open-brain/build/cli-recall-trigger.js\"", "timeout": 10 }
]}]
```

- **`timeout` is the host's and `deadline_ms` is the trigger's, and they bound different things.**
  The host's `timeout` bounds how long the process may *run*. `deadline_ms` decides whether a result
  that came back late may still be *emitted*, because a reminder arriving after the seat has read
  the tool result is attached to the wrong moment. better-sqlite3 is synchronous, so nothing in the
  hook can interrupt a query in progress — **the deadline bounds what reaches the model, not how
  long the process runs**, and the handoff says so rather than letting the field imply otherwise.
- **`G-030` and `G-034`:** registered by absolute path, so the trigger runs whichever build that
  path names and a stale checkout serves a stale trigger. `T-154` owns the repair for all three
  hooks. Not widened into here (§5.9).
- **Registering it is Aaron's act**, at the moment QA asks (§8). Nothing in this branch touches
  `~/.claude/settings.json`.
- **Two things about the live environment, recorded for whoever registers it:** the `PostToolUse`
  array in Aaron's `settings.json` is currently **empty**, and there is already a `PreToolUse` hook
  on `Bash` from the context-mode plugin. On `PreToolUse` the precedence is deny-wins across hooks;
  on `PostToolUse` the trigger cannot participate in that at all. One more reason for the event
  choice.
- **The log is `recall-trigger.log`, beside the knowledge database** (`RECALL_TRIGGER_LOG`
  overrides). Every failure goes there and nowhere else.

## 10. Known non-green and deliberate

- **M22 survives** (§6), declared.
- **`sync --check` reports one skip in this tree** — `gitnexus-index`, "no `.gitnexus/` in this
  tree". Not a pass. §3's zero-skipped requirement is on the QA tree and is not claimed here.
- **Three pre-existing `sync` warnings** unrelated to this loop: `prd-version`, `vault-index-parity`,
  `spec-provenance`.
- **There is no CHANGELOG or README change in this candidate, deliberately** (R24). Both were
  written and then reverted at rev 8; the bump and the docs are one commit above the accepted SHA,
  which is Loop 14's pattern. Noting the conflict rather than resolving it silently: the repo's
  general convention is to commit a CHANGELOG entry alongside the code, and the loop's choreography
  overrides it here and satisfies it a commit later. **QA does not need the README for A7** — the
  registration line and its two non-obvious parts are in §9 of this file.
- **A7 and A10-live are QA's**, in the QA tree, with the hook registered for the probe.

## 11. What this loop cannot make true

That a seat *acts* on what the trigger puts in front of it. Loop 14 showed a loaded rule can be
quoted and broken in the same session, and §5 of this file is the same thing happening to me with a
surfaced entry one command away. What is now true is narrower and measurable: **the store is asked,
at the act, by something that does not have to remember to ask — and when it is silent, the record
can say whether it looked.**

---

# Candidate 2

**Appended 2026-09-20**, after QA's report on `45ee2ab` and the planner's rulings in amendments
**9 (`0c70b52`)**, **10 (`084cf18`)** and **11 (`e0c1dd2`)**. Candidate 1 was NOT ACCEPTED on one
row. New commits on top, unsquashed and unrebased; `45ee2ab` is still in the history and still
reachable.

## 12. What candidate 1 got wrong, and what it did not

**F1 — the guard the brief named did not exist.** A11's fourth clause and brief §3 require a test
that fails if a network call is attempted over the trigger's module. There was none. The property
itself held — nothing under `src/trigger/` imports `fetch`, `node:http(s)`, `node:net`, `node:dns`
or `undici` — so this was not a live defect. **It was the missing guard against one, and the
distinction between *the property holds today* and *something notices when it stops* is this
loop's entire subject.** Shipping without it was the wrong shape twice over.

Everything else at `45ee2ab` passed, verified by QA rather than relayed — including the full suite
alone in the QA tree at the candidate: 1021 passed, exit 0.

## 13. The repair, and the finding underneath it

**The network tripwire** (`tests/trigger/no-network.test.ts`). Ten outbound surfaces patched —
`fetch`, `http.request`/`get`, `https.request`/`get`, `net.connect`, `net.Socket#connect`,
`tls.connect`, `dns.lookup`, `dns.promises.lookup` — recording attempts rather than only throwing,
so a failure names what was reached. `net.Socket#connect` is the one that matters: `http`, `https`
and `tls` all reach the network through it, so a route avoiding the named module functions still
trips.

Not a source scan, deliberately. A grep for `fetch(` over `src/trigger/` is what `G-040` does — the
scan that fired on a constant listing forbidden subcommands, and the one that fired on a comment
reading *the fix is not shell: true* — and it would miss a transitive import, a dynamic `require`,
or a native binding opening a socket.

**All ten surfaces are fired deliberately first, in the same test** (T-156). A tripwire installed on
the wrong object records nothing and looks exactly like a clean run, which is candidate 1's M18 in
another costume.

**A1's fixture, and the finding it produced.** Rebuilding it so every decoy carries all three
derived terms made A1 fail: entry 299 did not rank first. I left it red and reported it rather than
weakening the fixture, and the planner ruled the restatement below.

**I reported that finding wrong first, and the correction is the more useful half.** My initial
rebuilt decoys ran 235–343 characters against entry 299's 566 and put 299 at **rank 9 of 11**.
Amendment 9 §2 specifies decoys *of comparable length*; mine were not, which handed every decoy a
bm25 length-normalisation advantage unrelated to relevance. Rebuilt at 426–545 characters, **299
ranks 4 of 11** — beside QA's independent 3. **A stacked fixture proves as little as a vacuous one;
it just fails in the flattering direction**, and "the ranking is badly broken" was the flattering
direction for me, because it makes the row somebody else's problem.

## 14. A1 as restated (R26), and what each half is worth

**A1(a) — precision, ASSERTED.** The original decoys, most carrying only part of the brief's token
list. 299 ranks first. The row now prints its own match set:

```
A1(a) match set (2 of 11 documents): pipe-to-tail-masks-exit-code, exit-code-from-variable
```

So QA's F2 — *299 was winning a field of two* — is stated by the test rather than left for a reader
to discover. What A1(a) demonstrates is the conjunction excluding partial matches, which is a real
property and a smaller one than the original row implied.

**A1(b) — the field, REPORTED.** Ten decoys each genuinely carrying all three derived terms at
comparable length. The only assertion is that 299 is IN the match set; A1(b) fails only if it is
absent. The rank is printed:

```
A1(b) entry 299 ranks 4 of 11 against ten same-topic competitors (top: migration-exit-code).
RANK REPORTED, NOT ASSERTED.
```

**No N is asserted** (R26): a top-4 would be today's measurement writing its own row and a top-3
would be QA's. First place is a gap at the close-out, in the planner's words.

**What the ranking gap actually is.** bm25 length normalisation. Entry 299 is 566 characters; the
competitors are 426–545 and carry the same three terms. It is not a small-corpus artifact — I
checked, because that was the comfortable explanation: adding non-matching filler restores the
absolute scores (`4.138e-6` at 11 documents to `9.99` at 600) and **leaves the rank where it was**.
**The live store ranks 299 first because only five entries there match all three terms, not because
the ranking discriminates it from a field.** Boundary 3's rank-1 was a thin field.

Measured and NOT applied, as evidence for whoever owns the gap — weighting the `key` column (the
entry's identity, which carries all three terms), at 600 documents: `x2` → 5th, `x3` → 3rd, `x5` →
2nd, `x10` → 1st at 18.39 against 17.83. **`x10` clears by 0.56, and a weight chosen because it
makes A1 pass is tuning to the test**, which is why no weight is in this candidate.

**How the gap should be weighed.** Every one of the ten competitors gives the SAME ADVICE as 299 —
read the status from the process, not from the trimmed output. With `max_injected` at 1 the seat
receives one of them and is warned correctly either way. The ruling's prohibition is on injecting an
IRRELEVANT entry; these are competitors, not noise. A row asserts this so it is not left as a
comment. **And the durable answer to *was that the right entry* is what the fires table and
point-of-use rating measure in production** — which is the thing this loop built.

## 15. A6's accepted substitution, written here as R25 requires

The criteria said *hook killed at its timeout*; the candidate tests **past its own deadline**
instead. `better-sqlite3` is synchronous, so nothing inside the hook can interrupt a query in
progress: **the host's `timeout` bounds how long the process may run, and `deadline_ms` bounds
whether a result that came back late may still be emitted.** "Killed at its timeout" is not
producible from inside the hook — the host does the killing — so the observable that IS reachable
is the emission rule, and that is what the row tests. QA accepted the substitution and amendment 9
§3 rules it accepted.

## 16. Verification at candidate 2

```
targeted run (R12)   13 files, 149 tests, exit 0
tsc --noEmit         0
```

The targeted set is unchanged from §8 plus the new `tests/trigger/no-network.test.ts`, which the
`tests/trigger/**` glob already covers.

**Nothing in `src/` changed in candidate 2.** Every commit is a test or this document, so candidate
1's A5, A6, A10 measurements and the full-suite result stand unaltered — and A7, A8 and A10-live
run against this candidate with the hook registered, on Aaron's word.
