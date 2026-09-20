# Loop 16 — the recall trigger: the store answers at the moment of the act

**From:** Atlas (planner) · **Date:** 2026-09-20 · **Sequenced by Aaron, 2026-09-20 (`D-026`):** the
`G-039` recall-trigger loop, then Loop 15 slice three.
**Base:** `origin/master` at the revision that carries all three seats' Loop 14 close-outs (the
developer reads the number from `state.json`, not from this file). **Version at base:** `0.43.0`.
**Branch:** `loop/16-recall-trigger` · **Fresh sessions required** for developer and QA, both on
Opus 5; the planner is on Fable 5.1 (Aaron, 2026-09-20).
**Ruling this brief is built from:** `docs/loops/g-039-ruling.md` — binding; this file does not
restate it. **Problem statement:** `docs/loops/loop-14-closeout.md` §4, first result. **Roles:**
`.agents/roles/*.md`.

> **What Loop 14 left, in one sentence.** `shared.md` is now loaded into every session and named
> by commit, and the seat that read it and quoted its rule on restated numbers at a boundary
> restated a number in its own handoff four sections later (Developer 31). **Loading a rule and
> applying it are two different things.** The store, meanwhile, held the exact description of an
> error a seat then made (`G-039`, entry 299), ranked it first when finally asked, and was not
> asked — for the eighth loop running, by both seats' own handoffs at `3f9295a` and `94d3e4e`.

---

## 1. What this loop is for

**One capability: something asks the store at the moment of the act, deterministically, and says
nothing when the store has nothing.** Not at session start (cut in Loop 10 C2 on evidence; the
ruling concurs and so does this brief), not by an instruction to the agent to remember to recall
(rule 4's failure mode, and the one entry 299 was sitting inside), but on an observable condition:
a tool call of a named kind, with a shape the store can be queried with.

**Why the act and not the session.** The error in `G-039` happened hours into a session, on a
command typed by hand, in a context the session start could not have anticipated. Loop 15's runtime
proved the shape for checks it runs itself — A7, *check results come from exit codes* — and that
shape is *a check at the moment of the act, not a document read earlier.* This loop builds the same
shape for what seats still do by hand, which is everything QA does and most of what the developer
does between commits.

**The ruling handed this loop two fixes and did not choose. This brief chooses, and says why.**

- **The unconditional read of a curated set already exists twice on this machine,** and the loop
  that briefed this one is the loop that measured its limit. `shared.md` is loaded into every seat's
  session by C1 (Loop 14) and carries the exit-code rule in its *Measurement* section; Aaron's
  `MEMORY.md` carries `feedback_pipe_masks_exit_code` and is loaded into every session in every
  project. **Both were in force when Developer 31 happened.** A third curated set would be a third
  file that is read and not applied. **This loop does not build one.** It is named here so its
  absence is a decision, not an oversight, and Aaron can overrule it in §8.
- **The deterministic trigger on a queried store is the capability.** It is the only one of the two
  that scales past a page, it is the one that fires *at the act* rather than at the start, and it
  has no working precedent anywhere in this repo — which is why it is a loop and not a task.

**What the trigger is not.** It is not a gate. It never blocks, denies, defers or rewrites a tool
call. It is advisory, at the boundary, and silent by default. The runtime's A7 *prevents* the
`G-039` act for checks the runtime runs; this trigger *warns* for acts the runtime does not see.
The ruling states that difference and it holds.

## 2. The increment, bounded and locally complete

**Repair — the silence that cannot be read, mandatory, first.** `ob_recalled` reporting *no
knowledge entries recalled this session* cannot distinguish *nothing asked* from *asked, and nothing
relevant* — and for five loops the silence was read as inconclusive when it was the answer
(`g-039-ruling.md` §1). That is rule 11 in the memory layer: an instrument that cannot tell "nothing
there" from "I did not look". **After this loop, every fire of the trigger is recorded whether or
not it surfaced anything**, so the question *did the memory half get used* has a denominator: fires,
hits, and injections are three different counts and the record can show all three. The existing
`trigger` census in `ob_stats` (`start` / `checkpoint` / `explicit` / `unspecified`) gains a value
for the trigger, distinct from all four; a hook-fired recall is never counted as an `explicit` one.

**New capability — one, observable:** a seat in a real Claude Code session that runs a Bash command
of the shape that produced `G-039` — `<cmd> 2>&1 | tail -N; echo $?`, or `| head -N`, or any pipe
whose last stage is a trimmer, followed by a read of `$?` — receives entry 299's `ACTION` next to the
tool result, injected by a hook, with the entry's id, without having asked. The same seat running
`git status --porcelain`, `ls`, or a command whose text matches nothing in the store, receives
nothing at all — not a *no relevant entries* line, not an empty reminder — and the record still
shows the trigger looked.

### Deliverables

- **A trigger at the tool-call boundary of a seat's session** — a Claude Code hook on `Bash` (the
  developer chooses `PreToolUse`, `PostToolUse`, or both, and says why in the handoff). Verified
  2026-09-20 against the hooks reference at `code.claude.com/docs/en/hooks`: both events accept
  `hookSpecificOutput.additionalContext`, inserted next to the tool result as a system reminder the
  model reads on its next request. **The query is derived from the tool input by code** — from the
  command text, its shape, or both — never from an instruction to the model. Which tokens of a
  command become the query, and how, is the developer's design; the brief fixes what must and must
  not come out (§4).
- **A query path that fails closed.** `ob_recall`'s handler (`server.ts`, *precision first, recall
  second*) fills its result limit by broadening the FTS query to `OR` when the precise query
  underfills — by design, for an agent that asked. **The trigger never uses that path.** Below a
  relevance floor the trigger's query returns nothing, and *nothing* is what reaches the model. The
  floor is data (a policy value, not a literal in the query code), and the developer reports where it
  was set and what it was calibrated against.
- **A record of every fire.** Fired-and-silent, fired-and-injected, and the ids injected, keyed to
  the live session uuid the way `recall_log` already is, with the new trigger value. `ob_recalled`
  distinguishes hook-injected entries from explicit ones. **Only injected entries are recallable for
  rating at `/end`** — an entry the trigger looked at and did not surface was never in front of the
  seat and must not enter the rated set (that would write ratings into `success_rate` for entries
  nobody read, the column that gates apoptosis and boosts ranking).
- **The hook never blocks.** No `permissionDecision`, no exit 2, no `updatedInput`, ever. A crash
  or timeout inside the hook leaves the tool call exactly as it would have been without the hook and
  is logged to a file the handoff names — the recall is lost, the act proceeds, and the loss is
  visible afterwards. **Fail closed on injection; never fail closed on the tool.**
- **Registered the way the existing hooks are registered.** `SessionStart` and `SessionEnd` run
  from the main tree's build by absolute path in `~/.claude/settings.json` (`G-030` names why that is
  a defect; `T-154` owns fixing it). This loop registers the trigger by the same route and does not
  widen into `G-030`. The consequence is inherited and stated: the trigger runs the main tree's
  build, so a stale main tree serves a stale trigger (`G-034`'s family), and the handoff says so.
- **Cost, measured and reported.** Wall time added per `Bash` call, p95 over at least fifty
  consecutive calls in the QA tree, with the method; the hook's `timeout` set explicitly and
  named. Aaron has ruled token cost is not the concern; latency at the moment of a verification
  claim might be, and it is unmeasured. This loop measures it; it does not pick the number that
  would make it a failure.

### Explicitly out of scope

Reinstating any session-start injection (Loop 10 C2 stands). Changing `ob_recall`'s behaviour for
explicit callers — the broadening fallback stays for an agent that asked; the floor built here is
the trigger's, and applying it to `ob_recall` is `G-026` and is not this loop. A second curated set
(§1). `T-014` (point-of-use rating) beyond the one constraint above. `T-154` / `G-030` (hook
installability). Any change to `.claude/commands/`, to the runtime in `open-brain/src/harness/`, or
to the record schema. Jev anywhere in the trigger's path — the ruling names a Jev-shaped question
and slice two proved the transport; **this trigger is a query against a local SQLite store and must
work with no network and no key.** `G-045` and slice three's list.

## 3. What must be preserved

- **`ob_recall` for an explicit caller behaves exactly as at base** — same SQL, same broadening,
  same output. The existing recall tests pass unchanged; a test that had to change is a finding.
- **The suite is green with the exit code read from the process** (`G-042`'s rule, A9 of slice
  two), `sync --check` clean in the QA tree with zero skipped, `module-boundary` green. The trigger
  imports nothing from the harness and the harness imports nothing from it.
- **`ob_state` remains the only writer of `.agents/state.json`.** The trigger never touches the
  record. `recall_log` and whatever sits beside it are the store's tables, not the record.
- **No network in the test suite and none in the trigger's path.** A test that fails if a network
  call is attempted covers the new code.
- **The `SessionStart` and `SessionEnd` hooks are unchanged**, and the greeting is unchanged: the
  trigger adds nothing to session start.
- **The store is opened read-only by the query, and written only for the fire record.** A trigger
  that runs on every `Bash` call and can write anything else to the store is a new channel into the
  memory half with no seat behind it.
- **Nothing pushes, merges, or tags.** Unchanged from every loop.

## 4. Acceptance — observable, derived per item, written before the candidate

QA writes `loop-16-qa-criteria.md` from this table before the developer's first commit and does not
widen it after a verdict; a clause QA adds beyond these words is marked as QA's and returned to the
planner (Loop 14's A7-style ruling). **A1 is first and is seen red before anything else exists.**
Every row that asserts an absence also asserts the matching presence in the same test (`T-156`).

| id | type | observable |
| --- | --- | --- |
| **A1** | white-box, seen red first | Against a fixture store holding entry 299's text and at least ten decoys sharing common tokens (`exit`, `code`, `tail`, `run`), the trigger's query for the literal command `npx vitest run 2>&1 \| tail -8; echo $?` returns entry 299 **first**. The developer's first commit is this test failing. |
| **A2** | white-box | Against the same fixture, the trigger's query for each of `git status --porcelain`, `ls -la`, and a command built from tokens that appear in no entry returns **nothing** — and the fire is recorded for each, with zero ids. Three negatives, three positives-of-the-record, one test. |
| **A3** | white-box | A fixture where the precise query underfills and an `OR` broadening *would* return a decoy: the trigger returns nothing. A mutant that routes the trigger through `ob_recall`'s broadening path turns this red. |
| **A4** | white-box | The relevance floor is read from data, not a literal; changing it changes A2's third case from silent to injected with **no source change**, and a floor hand-edited into the query code is caught by a drift check (`D-021`'s pattern, as slice two's policies). |
| **A5** | black-box | The hook, invoked as Claude Code invokes it (JSON on stdin built with `JSON.stringify`, never by hand — QA's Loop 14 lesson), on the A1 command emits `hookSpecificOutput.additionalContext` containing entry 299's id and `ACTION`; on each A2 command emits **no** `additionalContext` field and no stdout; in **no** case emits `permissionDecision`, `updatedInput`, or exits non-zero. Both directions asserted on the emitted JSON. |
| **A6** | black-box | With the store path pointed at a file that does not exist, a store that is locked, and a hook killed at its timeout: the tool call's own result is byte-identical to a run with no hook registered, and each failure appears in the named log file. Three cases. |
| **A7** | live, by QA | In a real Claude Code session in the QA tree with the hook registered, run the A1 command against a harmless target, then `git status --porcelain`. The session transcript (`~/.claude/projects/<slug>/<uuid>.jsonl`) contains the hook's system reminder with entry 299's id next to the first tool result and **none** next to the second. **Read from the transcript, never from the seat's own account of what it saw.** |
| **A8** | black-box | After A7, `ob_stats` shows the new trigger value in the census with a count of at least two fires; `ob_recalled` in that session lists entry 299 as hook-injected and lists nothing for the silent fire; the rated set at `/end` contains 299 and not the decoys the trigger looked at. |
| **A9** | white-box | The existing `ob_recall` tests pass unchanged at the candidate; `git diff base..candidate -- open-brain/tests/` touches no existing recall assertion. |
| **A10** | live, by QA | p95 wall time added per `Bash` call over ≥50 consecutive calls in the QA tree, measured with and without the hook registered, reported with the method and the hook's configured `timeout`. A number, not a verdict. |
| **A11** | black-box | Suite exit code read from the process (`G-042`); `sync --check` clean with zero skipped in the QA tree; `module-boundary` green; a test that fails on any network attempt covers the trigger's module. |

## 5. Rulings, so nothing is asked twice

1. **The trigger is a hook on the seat's tool-call boundary, not a runtime stage.** The runtime
   already prevents this act for its own checks (A7, slice one); the by-hand acts are where the
   miss lives. A runtime-stage trigger is slice four's selective retrieval, not this.
2. **The trigger never blocks.** Advisory only. If the developer finds a case where blocking is
   the right answer, it is a finding for the close-out, not a change to the hook.
3. **Silent means silent.** No *"no relevant entries"* line. A channel that speaks when it has
   nothing trains the reader to skip it; the record, not the model, is where a silent fire is seen.
4. **The trigger's query path does not broaden.** Precision only, floor below, nothing under it.
   `ob_recall`'s widening is for a caller who asked; nobody asked here.
5. **The floor is data.** Same shape as slice two's `harness/policies/`: a source of truth, a
   derived file, a drift check. Where it lives is the developer's; that it is not a literal is not.
6. **Injected is the only thing that counts as recalled.** Looked-at is a fire, not a recall.
7. **Query derivation is deterministic and local.** No Jev, no network, no model call. The ruling's
   Jev-shaped question is recorded and deferred; a trigger that needs a key to fire is not a
   trigger that fails closed on nothing.
8. **One curated set is enough and it is the one Loop 14 shipped.** No new always-loaded file. If
   the loop finds an entry the trigger keeps surfacing that belongs in `shared.md`, it goes to the
   close-out as a proposal, not into the file under the freeze.
9. **The hook is registered by the existing route and inherits its defects by name.** `G-030` and
   `G-034` are cited in the handoff next to the registration line; neither is widened into.
10. **A7 is QA's, once, by hand, from the transcript.** The developer's own session running the
    hook is where evaluation starts, not where it ends.

## 6. Process — the three-seat loop, as Loop 14 ran it

- **Fresh sessions.** All three seats rolled on the record after Loop 14 (`3f9295a`, `94d3e4e`,
  `8b200f7`). The developer and QA who read this are new sessions greeted at the current revision;
  **each reports its `/start` greeting verbatim to the planner before anything else**, and the
  planner checks it against the record — Loop 14's morning found two faithful renders of stale
  trees, and four instruments called them healthy.
- **Criteria before candidate.** QA writes `loop-16-qa-criteria.md` from §4 before the developer's
  first commit, on its own branch, reported by SHA; the developer does not see the probes.
- **Frozen candidate by SHA.** The developer hands off a SHA; QA evaluates in `~/Worktrees/sia-qa`,
  made to resemble the main tree (indexed, built, `sync --check` with zero skipped). **The main tree
  is not a QA fixture.** A7 and A10 need the hook registered for a real session in the QA tree:
  register it against the QA tree's build for the duration of the probe and say in the report how
  the registration was restored — the registration is in Aaron's `settings.json`, and touching it
  is an act that needs his word for that act.
- **The record moves one seat at a time.** Developer writes at the end of its build; QA does not
  write the record; the planner closes.
- **Cite the developer branch by rev, not tip.** Every check to a file, exit status into a
  variable, commit inside the `if`.
- **The main-tree build serves the hook in production.** Nothing in this loop rebuilds the main
  tree; that is Aaron's, at merge, in the close-out's choreography.

## 7. What a fresh developer session reads first

In this order, by path, nothing restated here:

1. `.agents/roles/developer.md` and `shared.md` — loaded for you and named by commit in the greeting.
2. `docs/loops/g-039-ruling.md` — the constraint, the two fixes, and Planner 48.
3. `docs/loops/loop-14-closeout.md` §3 and §4 — the derived-value finding and the problem statement.
4. Your own seat's last handoff, rendered in the greeting, and the QA seat's at `94d3e4e` — the
   linked-worktree fixture, the heredoc rule, `GIT_TRACE` to a file, the suite-runs-alone rule.
5. `open-brain/src/server.ts` at `// --- ob_recall ---` (the handler, the broadening fallback,
   `recordRecallEvent`, `_recalledKnowledgeIds`); `open-brain/src/db-v2.ts` (`recall_log`,
   `RECALL_TRIGGERS`, `recallRankExpr`, `searchFts`); `open-brain/src/pipelines/session-end/recalled-ids.ts`
   (what `/end` is allowed to rate, and why the file is dead).
6. `open-brain/src/cli-bootstrap.ts` and `cli-session-end.ts` — how the two existing hooks read
   stdin, resolve the DB, and exit; the trigger is a third sibling of these, not of `server.ts`.
7. The hooks reference at `code.claude.com/docs/en/hooks` — `PreToolUse` / `PostToolUse` input and
   output, `additionalContext`, the `timeout` field. Verify it yourself; this brief's reading of it
   is a relay.
8. The knowledge entry itself: `ob_recall` with `trigger: "explicit"` for *piping to tail masks the
   real exit code* returns entry 299 first at base (planner, 2026-09-20, session 2 of this tree).
   Its text carries `TRIGGER:` and `ACTION:` fields the vault template gives every experience —
   a fact about the store's shape, not a design instruction.

## 8. Held for Aaron

- **One ruling to confirm or overturn:** this loop builds the deterministic trigger only and does
  not add a second always-loaded curated set (§1). The ruling handed both; this brief chose on the
  evidence that the curated-set fix was in force when Developer 31 happened.
- **One act that needs his word when it comes:** registering the trigger hook in
  `~/.claude/settings.json` for A7 and A10 — QA will ask, by SHA, at the moment.

Sequencing after this loop is already ruled (`D-026`): Loop 15 slice three, `G-045` first.

**What this brief cannot make true:** that a seat *applies* what the trigger puts in front of it.
Loop 14 showed a loaded rule can be quoted and broken in the same session; a surfaced entry can be
too. What this loop makes true is narrower and measurable — that the store is *asked*, at the act,
by something that does not have to remember to ask, and that when it is silent the record can say
whether it looked. Whether surfacing changes the error rate is what the loops after this one count,
against the error table, by family.
