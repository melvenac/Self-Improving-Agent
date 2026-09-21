# Loop 16 — close-out

**From:** Atlas (planner) · **Date:** 2026-09-21 · **Verdict:** **ACCEPTED** at `5351270` — the third
candidate — by the QA seat in report 3 (`87b4cef`), on criteria written before the first candidate
existed (`154d1b3` → `75f05eb`, nine commits, none amending an earlier one), after rejecting `45ee2ab`
in report 1 (`a13f3c5`, corrected `ef79340`) on A11's fourth clause and `f7930d0` in report 2
(`c1b977a`) on A8's R7 observable. Branch tip `ca1693f` adds the version bump to `0.44.0` above the
accepted SHA; QA re-verifies it in scope.
**Brief:** `loop-16-brief.md` (`8457600`) and twelve amendments, in order: `1453e5f` `c43a31f`
`1051cae` `5ab0ac4` `6da5fa9` `f28ed11` `3db1365` `29766dc` `0c70b52` `084cf18` `e0c1dd2` `87cbb9d`.
**Developer handoff:** `docs/loops/loop-16-developer-handoff.md` on the branch, §§1–21, by rev.

> **Sources cited by SHA, not absorbed.** Branches were unpushed when this was written; §9's merge
> order lands them.

---

## 1. The result, first

**On 2026-09-21 at 04:08:29Z the trigger fired in a real Claude Code session and put entry 299's
`ACTION` beside a live tool result, unasked, on a command whose exit code the seat would otherwise
have read from a trimmer.** Eight loops after *does the memory half get used at all* was first
asked, the answer is a row in a table keyed to a live session uuid: `| tail -8; echo $?` → query
`"tail" "exit" "code"`, state *injected*, ids `[299]`; `git status --porcelain` → nothing derived,
*not asked*. A single-stage `tail -20 file` from another seat's session — a command nobody wrote as
a test — recorded *not asked*: R18 firing in production. The registration ran four minutes and six
seconds on Aaron's word, typed into the QA session for that act at that SHA, and `settings.json` was
byte-identical afterwards (report 2 §6).

**And the loop's premise was demonstrated against the loop while it was building the fix.** While
measuring A10, the developer ran `node script 2>&1 | tail -12; echo $?`, the script crashed, the
shell reported exit 0, and the developer read tail's status — the G-039 act, in the loop built for
it, with the finished hook sitting unregistered on disk beside a store that contains the entry
describing the act. Nothing fired because nothing was registered. Caught by its author because the
stack trace was visible (amendment 8 §1). *A trigger built and not registered is exactly as useful
as no trigger* — QA's sentence, criteria §6 — which is why the two live rows were the ones that
mattered, and why they waited on one human act.

## 2. What was asked, and what happened

**One capability: something asks the store at the moment of the act, deterministically, and says
nothing when the store has nothing.** Handed both fixes from `g-039-ruling.md`, the brief chose the
queried-store trigger over a second curated set, on the evidence that `shared.md` and `MEMORY.md`
were both loaded when Developer 31 happened (§1 of the brief; Aaron did not overrule).

**Candidate 1 (`45ee2ab`) — NOT ACCEPTED, one row.** Every row passed that could run without the
hook registered — including the full suite alone in the QA tree, 1021 / exit 0 — except A11's
fourth clause: the brief required a test that fails if the trigger's module attempts a network
call, and there was none. The property held statically; the guard the brief named was missing
(amendment 9). F2 alongside it: A1's ten decoys, written to the brief's own token list, left one
live competitor under the conjunctive derivation.

**Candidate 2 (`f7930d0`) — NOT ACCEPTED, one row, found live.** The network tripwire landed
(ten surfaces, each fired deliberately before the negative is believed; QA planted a real `fetch`
inside `deriveQuery` and the claim row went red). A1 restated under R26 passed with its rank
printed. The live rows ran under Aaron's word and the trigger fired. **F3:** amendment 1's R7 —
injected entries bump `recall_count` and `last_recalled_at` — had been ruled in answer to the
developer's own question, written into a boundary report as settled, and never built; entry 299's
counters read six hours stale after the injection, and neither column name appeared anywhere in the
diff. The criteria carried R7 as an A8 observable (`46feb51`); A8 failed on it. It surfaced only
because the live evidence put the timestamp in front of QA — *a row that can only be exercised live
is a row a blocked registration silently removes* (report 2).

**Candidate 3 (`5351270`) — ACCEPTED.** One commit: the injection branch bumps both columns for
injected ids only, inside the transaction that writes the fire row; *looked-at does not bump* is
structural (nothing else in `fires.ts` writes `knowledge_index`; the query holds a read-only
handle). Diff confined to one source file, +23 — verified by both seats — so the live evidence stood
and no second registration was needed (R27). QA went beyond R27 and drove the built binary through
all three states, re-measured A10 (unchanged within noise; the interpreter floor moved with the
machine and served as the control), and ran the full suite: 1031 / exit 0.

**`ca1693f`** — version `0.44.0`, CHANGELOG and README recovered from `4a9b056` by reverting the
revert, nothing under `open-brain/src`, the record unchanged at rev 59.

## 3. What it built

- **The derivation** (`src/trigger/query.ts`): risky *elements* of a command, not its words —
  a pipeline whose last stage trims → `tail`; a read of `$?`/`${PIPESTATUS` → `exit`, `code` —
  ANDed into a precision-only FTS query. No element, no query, the store never asked. A fixed table,
  no model, no network, reproducible from a transcript (amendment 4).
- **The floor as data** (trigger-owned policy: zod source, JSON, derived schema, drift check),
  `8.0`, measured in the live store's gap between the third relevant entry (10.62) and the first
  irrelevant (6.83); `max_injected` 1; provenance (599 entries, 2026-09-20) required by the contract
  and asserted (R19). **bm25's IDF is corpus-relative, so A4's fixture is 599 documents with a scale
  row that goes red at 5.5e-6 when the corpus is shrunk** (amendment 5).
- **The fire record** (`trigger_fires`, a sibling table): one of three states on every invocation —
  *not asked* / *silent* / *injected* — with a `CHECK` constraint refusing a fourth (QA tried four in
  raw SQL); `hook` in `RECALL_TRIGGERS` and not in `ob_recall`'s enum; `ob_stats` prints all three
  counts, zeros included; `ob_recalled` marks `[hook-injected]`; only injected ids reach `recall_log`
  and therefore the rated set — by construction, not by filter (R5, R6, R16). **And now the
  counters** (R7).
- **The hook** (`cli-recall-trigger.ts`, `PostToolUse` on `Bash`): `additionalContext` with the
  entry's id and `ACTION` when injecting; no key, no stdout, no stderr when silent; exit 0, empty
  both channels and one log line on every failure — store absent, locked, past deadline, malformed
  payload (R3, R15, R23). Never blocks, structurally (R1). Declared memory-side in `MEMORY_SIDE`
  (R21).
- **The network tripwire** (`tests/trigger/no-network.test.ts`): ten surfaces patched and
  recording; known positives fired before the claim.

## 4. The findings that generalise

1. **Loading a rule, agreeing with a rule, and applying a rule are three different things.** The
   developer's sentence at F3, and the loop's subject one level up: a ruling the developer asked
   for, agreed with, wrote into a boundary report — and did not build. Nothing between the ruling
   and the verdict could tell: 153 tests, `tsc`, `sync`, five boundary reports and a checklist were
   all green. Planner's share: a ruling with no §4 row to make its absence red.
2. **An assertion on a value the harness never captured** (M18): `execFileSync` returns stdout
   only; the A6 harness hardcoded `stderr: ''`; every stderr assertion passed without looking, on
   the observable R15 exists for. Found by a mutant, not by review. Distinct from a vacuous
   assertion — the value existed and the instrument never carried it (amendment 8).
3. **A stacked fixture proves as little as a vacuous one; it fails in the flattering direction.**
   Both seats built one within hours — the developer's short decoys made 299 rank 9th, QA's short
   sentence made an irrelevant document win — and both caught their own. Corrected: 4th of 11 at
   comparable length, 3rd in QA's fixture (amendment 11). The pairing is the evidence it is a class.
4. **`tsc --noEmit` on every mutant before it counts.** Three times in one session a type-invalid
   mutant went red for the wrong reason and would have proved nothing; the rule was the only thing
   between QA and a mutant that measured nothing. Goes to `shared.md` with QA's provenance.
5. **A mutation that silently fails to apply is indistinguishable from a blind guard.** QA's
   heredoc regex never compiled, the fixture never changed, the test passed, and the exit codes read
   *"the guard does not detect nine decoys"* — a false accusation against a working guard. The
   probe script now asserts the edit landed before running (report 3 §8).
6. **"Restored" and "parses the same" are different claims.** QA's first restore of Aaron's
   `settings.json` escaped every em-dash — 7224 bytes became 7245 — for the whole registration
   window; caught by hashing against a backup, restored verbatim.

## 5. Limits, stated so the ACCEPTED is not read as more than it is

- **The ranking is bm25's length preference, and the live store's thin field is what makes it look
  right today.** Against ten genuine same-topic competitors 299 ranks 3rd–4th; on the real store it
  ranks 1st of five because only five entries carry all three terms. Not repaired: a column weight
  chosen to pass A1 is tuning to the test (the developer's key-weight table, ×2 → 5th … ×10 → 1st
  by 0.56, is evidence for the loop that owns ranking). A1 asserts precision and *reports* the rank
  (R26). Mitigating fact: all ten of the developer's competitors give the same advice as 299.
- **The floor is calibrated to a 599-entry store on 2026-09-20 and rots as the store grows** (R19).
- **The common case pays ~0.28 s per `Bash` call to ask the store nothing**, because R16's census
  writes a fire row on every invocation; interpreter startup is 21–27% of it. Kept this loop for the
  denominator (R22); the cheap *not-asked* path — append to the hook's log, reconcile at session end
  — is the first follow-up, and it is put to Aaron in §8.
- **A7's transcript clause could not be met**: no `.jsonl` exists for the QA session's uuid under
  its project directory. Scored on the fire rows; where a session's transcript lives is open.
- **Registration is machine-wide.** One entry in `~/.claude/settings.json` arms the hook for every
  session in every project; the probe fired in the planner's and developer's sessions too. `G-030`
  owns the mechanism.
- **The developer's handoff describes mutant M24 as "silent fires bump"; it was a store-wide bump
  gated on the silent state** — real and red, oversold by its label. QA's M24b (the per-id bump
  moved outside the branch) is the row of record. Corrected here, not retro-edited.
- **Whether a seat *applies* what the trigger surfaces** is not shown and was never claimed (the
  brief's last paragraph). The fires table and point-of-use rating are what the next loops count.

## 6. The transport, because the loop ran on it

Claude Code's cross-session discovery returned nobody on this machine (three live sessions, three
bound inbox pipes, valid registry keys, v2.1.278; feedback drafted). The loop ran on **A2A-Hub,
deployed to `tcm` over Tailscale in the first hour** (`reference_a2a_hub_tcm` in memory), with a
seat-side wake built from the harness's own mechanism: a background `hub-talk --wait` whose exit
re-invokes the session — measured on both paths by QA. Clark (the general seat) fixed the transport
under the loop: the read cursor moved only on a read (two turns had been dropped, one per room, on
a send); `--peer` room selection; non-destructive `--inbox`; a 500-turn default. Five commits,
pushed on Aaron's word; the auth work landed after as `95ca5c6`. Standing rules from it: one
listener per seat, re-armed only after the previous exits; every hub message from a file (a
backticked word vanished as a command substitution in three seats' messages the same night).

## 7. The record

**50 Planner / 31 Developer / 2 QA** at Loop 14's close → **54 / 31 / 2** at this one. Four planner
entries, all set by this seat before being asked: **51** A4 unbuildable as written; **52** A6 could
not fail on `PostToolUse`; **53** *"same base"* — a cross-tree comparison of code that was not
identical, in the file that records evidence; **54** a replay reported as a cursor regression that
was the changeover's one-time backlog. Two brief limits recorded and not numbered: A1's fixture
wording, and *"for the duration of the probe"* describing the build and not the blast radius.

**Near-misses, by family, all seats** — the developer's A10 pipe (§1); the developer's stacked
fixture and QA's short-sentence decoy (§4.3); the developer's stop after boundary 1; the planner's
GO naming the criteria file (refused, R13); QA's grep with backslash-pipe alternation, its two
type-invalid mutants, its regex that never compiled, its byte-different restore, its two listeners
at once, its mislabelled silent probe; and the planner's four dropped-or-mangled hub messages.

**G-042, eight sightings, one table** (criteria §7.7): QA base ×2 red alone at `4550ee5` (974);
developer's tree rev 2 clean (986), 3 timeout (997), 4 timeout (1008), 5 clean (1021); QA's tree at
`45ee2ab` clean (1021), `f7930d0` clean (1027), `5351270` clean (1031). The test-count correlation
QA proposed at rev 4 was retracted by QA at rev 5; nothing yet distinguishes the runs that fire.

**Written at the close-out record write, after the merge and the main-tree rebuild:** `D-027`
(Loop 16 accepted at `5351270`, `ca1693f` the bump); gaps for the ranking limit, the transcript
instrument, and the machine-wide registration; a task for the cheap *not-asked* path and one for a
`Stop`-hook seat wake; `G-042` amended with the table; `shared.md` gains §4's rules 1, 2, 4 and 5
with provenance, short, and loses nothing; the objective → Loop 15 slice three, `G-045` first
(D-026). The developer's `/end` and QA's precede it, in Loop 14's order.

## 8. Held for Aaron

1. **Register the trigger for real?** One `PostToolUse` entry in `~/.claude/settings.json` pointing
   at the **main tree's** build after the merge — machine-wide, ~0.28 s per Bash call, a reminder
   beside `| tail; echo $?`-shaped results. **Recommended:** register it and let the fires table and
   point-of-use rating measure it for a loop. His file, his call.
2. **The census price** (R22): keep the denominator at 0.28 s per call, or make the cheap
   *not-asked* path the first task of slice three. Recommended: keep it one loop, then cheapen.
3. **Two things in his A2A-Hub repo** from Clark's status: uncommitted `.agents` docs, CHANGELOG
   and a `1.6.2 → 1.7.0` bump; and the `dev-key` default reachable on the tailnet — `AUTH_MODE`
   must stay `warn` until per-agent keys exist, or every seat 403s mid-loop.

## 9. The merge choreography

1. **Merge, in order:** `loop/16-recall-trigger` (cite rev 14; tip `ca1693f`), then
   `qa/loop-16-criteria` (`75f05eb`), then `qa/loop-16-report` (`87b4cef`), then `docs/loop-16-brief`
   with this close-out as its last commit. The planner pushes each by tip on Aaron's word; Aaron
   merges on `MERGEABLE/CLEAN`.
2. **Rebuild the main tree after the merge** and `/mcp reconnect open-brain` in every session —
   the server's code moved (`RECALL_TRIGGERS`, `ob_stats`, `ob_recalled`); confirm from an `ob_stats`
   read that prints the three fire counts, never from the reconnect message.
3. **Tag `v0.44.0`** on the merge.
4. **The roll:** the developer's `/end`, then QA's, then the planner's close-out record write and
   this seat's roll. Then slice three.

---

**The loop's verdict, the planner's to give:** Loop 16 asked whether something could ask the store
at the moment of the act without anyone remembering to. On the third candidate it can, and it did,
once, observed — and the same loop produced the act it exists to catch, twice: once by hand in the
developer's shell, and once as a ruling that was agreed with and never built. That is the next
loop's material, and it was earned here.
