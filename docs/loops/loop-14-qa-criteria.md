# Loop 14 — QA acceptance criteria, written before a candidate exists

**By:** Probe (QA seat, fresh session, this loop; session uuid `53ca3ad9`) · **Date:** 2026-09-20 ·
**Derived from:** `docs/loops/loop-14-rebrief.md` C1–C4 and `docs/loops/loop-14-rebrief-amendment-1.md`
§2–§3, both read at `origin/master` @ `7c7e04b` (record rev 52), the amendment winning where they
differ; `.agents/roles/qa.md` (`876029d`) and `.agents/roles/shared.md` (`e177ea2`) at the same base;
and the planner's kickoff message of 2026-09-20, which restated the rows and added one — **staleness**
— as "the developer's own note". Where a clause below comes from that message and not from the two
tracked briefs it is marked **[kickoff]**; where it is my own addition it is marked **[mine]** and is
returned to the planner in §9 rather than silently applied (my predecessor's QA 2 came from two
clauses that were not).
**Handoffs cited by close-out SHA, not by the rendered view:** the developer's for slice two is at
`git show 5b5bd30:.agents/state.json` (rev 50, session 69); the previous QA seat's at
`git show c0d69d5:.agents/state.json` (rev 51, session 70); the planner's slice-two close-out write is
`33a1bf0` (rev 52) and carries no `set_handoff`.
**Candidate:** none yet. This file is committed before the developer's first commit exists so the
criteria cannot be fitted to what arrives. **They are not widened after a verdict.**

> **Rule of this file.** Every criterion names what will be observed, in which tree, with which
> command, and what result means **pass**, **fail** or **untested**. A criterion I cannot state that
> way is in §6 as unverifiable now, not silently dropped. **Missing evidence is a gap, not a pass.**
> Where the brief is ambiguous I state the reading I will apply and return the question to the
> planner in §9 — I do not resolve it, because a QA seat resolving the planner's ambiguities is
> setting scope.

---

## 1. Fixed conditions for the evaluation

| | |
| --- | --- |
| **Candidate identity** | One SHA on `loop/14-three-seat-record`, handed over by the developer in writing, cited by rev. Every observation carries it. `git cat-file -t <SHA>` must print `commit`; if the commit is not in this checkout's object store, `git fetch origin` first and record that it was fetched. |
| **Evaluation tree** | `~/Worktrees/sia-qa`, moved with `git checkout --detach <SHA>`; then `git status --porcelain` empty and `git rev-parse HEAD` equal to the SHA, **checked before the first observation and again after the last.** If either changes between them, every observation is void, recorded as void, and the evaluation restarts on the new SHA. |
| **Made to resemble the main tree** | In order: `npm ci` and `npm run build` in `open-brain/` (exit codes into variables; `build/build-info.json` must carry the candidate SHA); `node .gitnexus/run.cjs analyze` from the root — if it fails with the FTS `file_fts` inconsistency (T-055), `analyze --repair-fts` then `analyze` again; **never `clean` without `--force`** (G-043); then `node open-brain/build/cli.js sync --check` from the root, which must report **0 skipped**. The analyzer's exit code and the indexed commit it prints are recorded beside the build's. |
| **The greeting under test** | "The greeting" is **the text the session-start pipeline prints**: the return of `handleStart` in `open-brain/src/server.ts` (what `ob_start` serves), obtained by calling the **candidate's build in this tree** through a programmatic caller (`import("./open-brain/build/server.js")` — the module does not open stdio when imported, `server.ts` guards on `process.argv[1]`), with `KNOWLEDGE_V2_DB` pointed at a scratch database so nothing is written to the live one, and `project_root` pointed at a scratch fixture (below). The hook line (`cli-bootstrap.js`) is scored where a row names it. **Nothing a session composes around that text is scored** (C4, QA's version). |
| **Fixtures** | Every fixture is a **local clone** of this checkout under the session scratchpad (`git clone --no-checkout <this checkout> <scratch>`, then `git checkout --detach <sha>`), with `refs/remotes/origin/master` set **explicitly** by `git update-ref` to a SHA I record — never left to whatever `clone` inferred. Seat identity is planted per fixture by writing `.agents/AGENT.local.md` with the three real declarations (`Atlas`/`planner`/partner `Forge`; `Forge`/`developer`/partner `Atlas`; `Probe`/`qa`/partner `Forge`) as they exist in the three worktrees on 2026-09-20. **`F-cur`:** tree at the candidate SHA, `origin/master` = candidate SHA. **`F-behind`:** tree at `d1b096b` (record rev 50 — the tree this seat was greeted from this morning, two record revisions and two merges behind), `origin/master` = candidate SHA. **`F-noremote`:** tree at the candidate SHA with no `origin/master` ref at all. Each fixture is cloned once per seat so session-log numbering in `.agents/SESSIONS/` is not shared between seats. |
| **Read-only** | No edit to any tracked file at the candidate. Nothing is repaired. Where a check must be *seen red* on a mutated copy, the mutation is made on a scratch clone, never in the candidate tree. `ob_state` writes are made only against scratch clones' `state.json`, through `handleState` from the candidate's build, dry run first. |
| **The main checkout** | `~/Projects/Self-Improving-Agent` is not moved and not built by me. The candidate changes the session-start pipeline, which every session's hooks run from the main tree (amendment §4): **the main tree moves only on the merge**. The one main-tree-only condition — Aaron's untracked `.agents/SYSTEM/PRD.md` — is reported as **unrun**, not implied green. |
| **Not shown** | Probe shapes beyond the briefs' own cases are not listed here and are not shown to the developer before the report; they are written into the report after the verdict. |

**"Exit 0" everywhere below** means the process exit status captured directly from the process under
test — `cmd > file 2>&1; rc=$?` or `execFileSync` — never a pipeline's last stage and never a line of
output. **Every instrument that returns a zero or an empty result is validated against a planted
positive first.** A `grep` that must find nothing is first shown finding a planted line.

## 2. Acceptance criteria, one per row the planner set

Each row: **required** (the brief's or amendment's words), **procedure** (what I run, where),
**pass / fail / untested**, and **blind spot** (what the procedure cannot see).

### C1 — the greeting names the seat's role file and `shared.md`, by commit; missing or stale is reported, not silent

- **Required (re-brief C1, amendment §3):** *"the session-start pipeline loads the seat's role file
  and `shared.md`, and the greeting says it did — by naming the file and its commit — so a seat
  starting in a checkout with a stale or missing role file is told, not left to notice."* Sharpened:
  *"the greeting also names the seat's own last handoff and its commit."* G-032 is the remainder
  this closes: at `7c7e04b`, `grep -rln 'agents/roles' open-brain/src .claude/commands` returns
  nothing, and that grep is validated on a planted line before its empty result is believed.
- **Procedure, white-box:** read the session-start pipeline for where the role file is resolved from
  the identity (`agent-identity.ts` yields `role`; the file is `.agents/roles/<role>.md` or an
  explicit map — I record which), how "its commit" is derived (must be read from git at start time,
  not stored — a stored SHA is rule 14), and what happens on each of the three failure shapes.
  Read the shipped tests; the negative shapes must be tested, not only the happy path.
  **Black-box, `F-cur`, per seat:** the greeting for Probe names `.agents/roles/qa.md` and
  `.agents/roles/shared.md`, each with the abbreviated SHA that `git log -1 --format=%h -- <path>`
  prints at the candidate SHA (**derived at evaluation time, not copied from this file**); Atlas
  names `planner.md`, Forge names `developer.md`. **Missing:** a fixture with `AGENT.local.md`
  declaring `role: auditor` (no such role file) — the greeting says so, in a line that names the
  path it looked for. **Stale, reading (a):** `qa.md` edited in the working tree and not committed —
  the greeting says the file differs from HEAD. **Stale, reading (b):** `F-behind` where the
  candidate has touched a role file, or a scratch branch that has, with `origin/master` ahead — the
  greeting says the file at HEAD is behind `origin/master`. Which readings of "stale" the candidate
  implements is recorded; §9 returns the question.
- **Pass:** all three seats' greetings name both files with commits equal to git's answer at the
  candidate SHA; the missing case and at least reading (a) of stale are reported in the greeting
  text; the greeting also names the seat's own last handoff and its commit (measured under C2b).
  **Fail:** a role file named without a commit; a commit that does not match git; the missing case
  silent or the greeting omitting the line; a role resolved by a name-to-file guess that fails
  closed for none of the three real seats. **Untested:** reading (b) if the candidate touches no
  role file and I cannot construct the case without a fetch.
- **Blind spot:** naming a file proves the pipeline **stat'd** it, not that its content reached the
  session. G-032's second half — reachability of the knowledge, not the path — is not observable
  from a greeting and is named as unverified in the report rather than passed.

### C2a — `set_handoff` and `end_session` refuse without a seat

- **Required (amendment §2):** *"`set_handoff` and `end_session` take a seat; a write without one is
  refused."*
- **Procedure:** on a scratch clone at the candidate SHA, through `handleState` from the candidate's
  build: (1) a batch `[set_handoff {pick_up, watch_out, open_questions}]` with **no seat field**,
  dry run then real; (2) the same for `end_session {n, date, uuid}`; (3) a batch with a seat value
  that is not one of the seats the record knows (`seat: "auditor"`); (4) a batch with a valid seat.
  Before and after each refused call: `sha256sum .agents/state.json` and the `revision` field.
- **Pass:** (1), (2) and (3) are refused with a message naming the missing or unknown seat; the whole
  batch is refused (nothing else in it applies); `state.json` is byte-identical and the revision
  unchanged after each; (4) applies. Whether the seat is keyed by **name** (`Probe`) or **role**
  (`qa`) is the developer's choice and is recorded; either way the value the greeting later renders
  for is the one `agent-identity.ts` resolves, from the same file. **Fail:** any of (1)–(3) applies;
  a refusal that leaves the file changed; a seat accepted that no identity file can produce.
  **[mine]** (3) — the amendment says "a write without one is refused"; refusing an *unknown* seat is
  my reading of "takes a seat", returned in §9.
- **Blind spot:** `handleState` is the MCP door; `/end` is a command file that composes the batch.
  A command file that omits the seat would be refused every time — which is a pass here and a
  finding under C3 and §3.

### C2b — the greeting renders the reader's own seat's last handoff and names the others' by SHA; the negative fixture is this morning's defect

- **Required (amendment §2, §3):** *"the greeting renders the reader's own seat's last handoff and
  names the other seats' by SHA"*; *"the greeting must say which seat's handoff it rendered. A
  greeting that shows the developer's handoff to the planner is C4 failing on the row C2 exists
  for."* The shape — `handoff` keyed by seat or `handoffs[]` with a seat field — is the developer's.
- **The negative fixture, observed live 2026-09-20 in this seat:** at `d1b096b` (rev 50) the
  greeting's `Handoff (session 69)` block was the **developer's** slice-two handoff, rendered to the
  **QA** seat with nothing saying whose it was; the planner reported the same to Forge. `F-behind`
  reproduces it exactly, and `F-cur` with the record migrated is the positive.
- **Procedure, `F-cur`, per seat:** the greeting's handoff block (a) names the seat whose handoff it
  is, (b) for Probe renders the handoff whose `pick_up` begins *"THIS IS THE QA SEAT'S HANDOFF"*
  (session 70, byte-equal to `handoff` at `git show c0d69d5:.agents/state.json`), for Forge the one
  whose `pick_up` begins *"LOOP 15 SLICE TWO IS ACCEPTED AND MERGED"* (session 69, byte-equal to
  `git show 5b5bd30:.agents/state.json`), and for Atlas either none — said in words — or whatever
  the planner has written by then, cited by rev; (c) names the other two seats' handoffs by a SHA
  that `git show <sha>:.agents/state.json` resolves to a state carrying that seat's handoff as
  rendered. **Migration:** if the candidate carries a migrated `state.json` (the single slot split
  into per-seat entries), the two entries above must be byte-equal to their sources; a migrated
  record that drops or edits either is a fail. **`F-behind`, per seat:** the old single-slot record
  is read by the candidate's build — the greeting must either say which seat's handoff the slot is
  (session 69 → the developer) or refuse the old shape in words; it must **not** present it as the
  reader's own. **Old shape read by the old build** is the baseline (§7), not a candidate result.
- **Pass:** (a)–(c) for all three seats on `F-cur`; `F-behind` never shows the developer's handoff as
  Probe's or Atlas's own. **Fail:** a handoff block with no seat named; the wrong seat's rendered as
  the reader's; a SHA that does not resolve or resolves to a state without that handoff; a
  migration that alters either preserved handoff.
- **Blind spot:** "names by SHA" needs the SHA **derived at read time from git**, because
  `set_handoff` runs inside `/end` before the commit exists (`end.md` says so in its own warning).
  A fixture without history for that path — a shallow clone — cannot name it; the greeting must say
  so rather than print nothing. **[mine]** that last clause, returned in §9.

### C2c — a second `end_session` for the same uuid updates rather than increments (G-047)

- **Required (amendment §2):** *"`end_session` becomes idempotent per uuid (a second write for the
  same uuid updates its entry rather than taking a new number), so the number counts what its name
  says."*
- **Procedure:** scratch clone at the candidate SHA; read `last_session.n` (call it `N0`). Through
  `handleState` with a valid seat: `end_session {uuid: U1, date, n}` → record `n` rendered by the
  greeting and in `state.json`; `end_session {uuid: U1, ...}` again (with the same `n` and, as a
  second run, with `n + 1` supplied by the caller — I record which the writer accepts, refuses or
  corrects); then `end_session {uuid: U2}`. Then the same three writes by a **different** seat with
  U1 — does a second seat closing under the first seat's uuid update or increment? Recorded.
- **Pass:** after the two U1 writes the record shows **one** number for U1 and the count has advanced
  by exactly one from `N0`; U2 takes exactly the next number; the greeting's `Last session` (or its
  successor line) agrees with `state.json`; a shipped test asserts the same-uuid case and was **seen
  red** at the developer's first commit (`npx vitest run <file>` on a scratch clone at that commit
  fails; at the candidate passes). **Fail:** two numbers for one uuid; the second write refused
  outright with no way to close a session twice (slice two needed three close-outs per seat-session,
  which is the case this exists for); the seen-red clause missing.
- **Blind spot:** the record keeps `last_session` only (G-047 says so); whether the candidate keeps
  a per-uuid table or infers from the last entry decides what a *third* seat's interleaved close
  does. I test one interleaving (above); the report names the ones I did not.

### C2d — the enumeration is done once, as the test of the shape

- **Required (amendment §2):** *"The enumeration is still done, once, as the test of the shape: every
  item on the 'carried by nothing' list must have a place in the per-seat handoff or be shown to
  live in a runtime artifact."* The list, from the re-brief's C3 table: the near-miss register,
  Aaron's standing rulings, which PRs are open / QA'd, the SHA frozen for a QA in progress,
  questions pending for Aaron, the detach procedure — plus rulings made mid-loop (re-brief C2).
- **Procedure:** read the developer's handoff for this loop and any tracked enumeration file it
  points to. For each of the seven items: the tracked text names **where** it lives — a field of the
  per-seat handoff (then the field exists in `HandoffSchema` at the candidate and `state.json`'s
  strict schema refuses its absence or presence as the developer chose), or a runtime artifact
  under `artifacts/iterations/` (then `open-brain/src/harness/artifacts.ts` at the candidate
  writes it), or **"carried by nothing, still"** said in words.
- **Pass:** all seven sorted, each with a path that exists at the candidate SHA; a "still nothing"
  is a pass for this row and a finding in the report. **Fail:** an item unsorted; a place named that
  does not exist at the SHA; the enumeration only in an A2A message.
- **Blind spot:** this row checks a document against a schema. Whether a planner *fills* the fields
  is C3, and C3's live half is not mine (below).

### C3 — the planner seat's `/end` writes the enumerated rows through the command

- **Required (re-brief C3, amendment §3):** *"a planner close-out that is run, not remembered … the
  planner's `/end` equivalent writes the rows above that the runtime does not carry, into a tracked
  artifact, without the seat having to decide to."* Acceptance: *"the planner seat rolls on this
  loop's close — the first time — and its `/end` is C3's acceptance."* Returning the tree to
  detached after a push is still the first piece and still by hand.
- **What I can verify before the merge:** (1) the command text — `.claude/commands/end.md` (and any
  mirror `/sync` checks) at the candidate names the seat in `set_handoff` and `end_session`, and
  for the planner seat enumerates the rows of C2d as things the batch **must** carry, not "should";
  `command-tool-names` and `command-names` still pass on it. (2) The refusal — on a scratch clone,
  a planner-seat close batch missing an enumerated row is **refused** by `handleState` if the schema
  makes the rows required, or **accepted with the absence rendered in words** if it does not; which
  of the two the candidate chose is recorded, and *silently accepted with nothing rendered* is a
  fail. (3) The detach step: if the candidate scripts it, the script is run on a scratch clone with
  a local branch checked out and must leave `git symbolic-ref -q HEAD` empty and HEAD at the SHA
  `origin/master` names; if not scripted, "still by hand" is recorded as the brief allows.
- **What I cannot verify and will not report as verified:** the planner's live roll on this loop's
  close happens **after** my verdict and is the planner's and Aaron's observation, not mine. The
  report says so in its own words.
- **Pass:** (1) and (2) as stated; (3) recorded either way. **Fail:** the command still writes a
  seatless batch; a planner-seat batch that omits every enumerated row and is accepted with nothing
  said.
- **Blind spot:** a command file is prose to an LLM; "must" in it is a prompt-level instruction
  (`CLAUDE.md`'s own ordering puts it last). The deterministic half is the schema; the report
  separates the two.

### S — a tree behind `origin/master` is told so before the rest of the greeting **[kickoff]**

- **Required (kickoff message, "the developer's own note"):** *"a tree whose record revision or HEAD
  is behind `origin/master` is told so before the rest of the greeting, in a line legible next to
  drift 'none'."* This is the condition this seat started in today: `Drift: none` over a record two
  revisions behind, and nothing said.
- **Procedure:** `F-behind` (HEAD `d1b096b`, rev 50; `origin/master` = candidate, rev ≥ 52): the
  greeting carries a line **before the `## State` header and adjacent to the `Drift:` line** that
  says the tree is behind, naming both sides — `HEAD` vs `origin/master` by SHA and/or record
  revision vs the revision in `git show origin/master:.agents/state.json` — and the commit count
  (`git rev-list --count HEAD..origin/master`, which I compute independently and compare). `F-cur`:
  the same position carries an explicit **current** line, not silence. `F-noremote`: the line says
  it **could not compare** and why. **Ahead is not behind:** a tree at an unmerged candidate SHA
  with `origin/master` behind it prints current-or-ahead, not behind.
- **Pass:** all four shapes as stated, the line precedes the State block, and it names what it
  compared against (the local `origin/master` **ref**, by SHA — a remote-tracking ref is only as
  fresh as the last fetch, and a line that says "current" without saying against what is rule 14).
  **Fail:** silence on `F-behind`; silence or "current" on `F-noremote`; the line after the State
  block; a network fetch performed by the start pipeline to answer (`GIT_TRACE=1` on the run shows
  no `fetch`/`ls-remote`). **[mine]** the `F-noremote` and ahead-is-not-behind shapes and the
  no-network clause; returned in §9.
- **Blind spot:** the line is true of the ref, not of the remote. Nothing in a greeting can say
  whether `origin/master` on GitHub has moved since the last fetch, and the report says so.

### C4, QA's version — rendered from the candidate's own build in this tree, three seats, two trees, scored on what the pipeline printed

- **Required (kickoff, restating amendment §3 for this seat):** *"the greeting is rendered from the
  candidate's own build in YOUR tree, for each of the three seats, from a tree deliberately left two
  revisions behind and from a current one, and scored on what the pipeline printed, not on what a
  session composed around it."* The real fresh-session test (kill the planner session, `/start` in
  `~/Worktrees/sia-planner`, then `~/Worktrees/sia-qa`) is Aaron's and the planner's after the
  merge and **is not my verdict**.
- **Procedure:** six runs — `F-cur` × {Atlas, Forge, Probe} and `F-behind` × {Atlas, Forge, Probe}
  — each captured **verbatim to a file** under the scratchpad, with the fixture's HEAD SHA,
  `origin/master` SHA, `KNOWLEDGE_V2_DB` path and wall-clock time in a header. Each transcript is
  scored against C1, C2b and S by reading the text, and the report quotes the scored lines. The
  planner's C4 list — *which seat, which loop is live, which PRs are open and QA'd, the rules in
  force with their counts, Aaron's standing rulings, which role file by commit* — is applied to
  each transcript as **present in the printed text / absent**, no inference. Counts are the
  pipeline's (`Tasks (N active; done: M)`, `Gaps (N)`); **I hand-count nothing** for the verdict —
  this morning's 13/17/5 against the developer's 13/18/4 on the same render is the reason.
- **Pass:** six transcripts exist; every C1, C2b and S clause holds in the text of each `F-cur` run;
  `F-behind` runs carry the S line and never render another seat's handoff as the reader's own.
  **Fail:** any clause I can only satisfy by reading something the pipeline did not print.
  **Untested by design:** the planner-list items the pipeline prints nowhere — *open PRs and which
  were QA'd*, *rules in force with their counts* — are reported as absent-from-the-greeting, which
  is C2d's "carried by nothing" list measured, not a fail of this row unless the candidate claims
  them.
- **Blind spot:** six runs from one build on one machine, through a programmatic caller rather than
  the MCP transport and the real hook. The transport can differ from the handler (G-033); the
  report names the caller.

## 3. Preservation — what must still be true

| Behaviour | How I check | Fail looks like |
| --- | --- | --- |
| The whole suite passes in this tree at the candidate SHA | `npx vitest run > file 2>&1; rc=$?` in `open-brain/`; exit code from the variable, count from the file; compared to the baseline (§7); zero `Unhandled`/`vitest-worker`/`timed out` lines (G-042) | exit ≠ 0 whatever the count says; a count lower than baseline without a removed test named in the developer's handoff |
| `/sync` in this tree: 0 failed, 0 skipped | `node open-brain/build/cli.js sync --check` from the root, exit code into a variable | any skip; `command-tool-names` or `command-names` red on the changed `end.md` |
| `state.json` strict schema still refuses an unknown key and a `closed_session` that disagrees with status (V-006, V-022) | `tests/shared/state-schema.test.ts` and `state-writer.test.ts` pass; one planted unknown key at the top level and one inside a handoff entry refused through `handleState` | either accepted |
| The `## State` render still replaces the four prose files and renders task titles only (V-025) | the six C4 transcripts contain one `## State` block, a `## Sizes` block, and no `## SUMMARY.md` / `## INBOX.md` header | prose files returned alongside the State block |
| `ob_start` reuse: a second call for the same session id reuses the log and says so | two `handleStart` calls on one fixture; the second prints `existing log for this session id — reused` and `ls .agents/SESSIONS` shows one new file | a second log |
| `AGENT.local.md` still wins over `AGENT.md` (PR #37) | `tests/pipelines/session-start/agent-identity.test.ts` passes; the hook line in a fixture with both files names the local one | tracked file wins |
| Retention (T-157, G-024): if the candidate touches the writer, a close that would evict a done task **cited in the tracked tree** refuses or tombstones; if it does not touch the writer, the developer's handoff **says so** | a scratch close of enough tasks to trip retention, with one of them cited in a planted `docs/` file; `git grep` for the id before and after | silent eviction; the handoff silent on T-157 |
| Drift detection unchanged | `Drift: none` on `F-cur`; a planted version mismatch in a fixture is reported | drift silent |
| The hook line (`cli-bootstrap.js`) still prints `SESSION_UUID:` and `Agent: <name> (<role>) — partner: <partner>` | run `node open-brain/build/cli-bootstrap.js` in a fixture with stdin from a planted hook payload | either line missing |
| The memory-free door still writes nothing (V-012) | `node open-brain/build/cli.js state show <fixture>`; `sha256sum` of `state.json` before and after | a write |

## 4. Scope fences — things the candidate must NOT do

- **No role runs through the harness runtime** (amendment §4); G-045 is not touched. `git diff
  --stat 7c7e04b..<candidate> -- open-brain/src/harness/` is empty or explained in the handoff.
- **The main checkout is not moved, built or checked out by the candidate or by me.**
- **C3 does not widen into G-026** (re-brief): no change under `open-brain/src` to recall, ranking
  or `ob_recall`'s trigger. `git diff --stat` over `lifecycle.ts`, `db-v2.ts`, `pipelines/session-end/`
  is empty or explained.
- **T-154 and T-155 are out of scope** (re-brief); a change to the `/start` memory-free route or to
  merge gating is a finding.
- **No improvement to the content of any handoff** (re-brief C2, unchanged): a migrated handoff is
  byte-equal to its source (C2b).
- **No network from the start pipeline** (S).

## 5. What I will report as a finding even though no row fails

- The key the per-seat handoff uses (name vs role) and whether anything checks the two agree with
  `.agents/roles/`.
- Every "carried by nothing, still" from C2d.
- Any C4 list item the pipeline prints nowhere.
- Any regex alternation in a shipped assertion whose second branch is a defect the test then permits
  (slice two's `refwatch-stage.test.ts` lesson; `T-156`).
- Any scan over source text in the new tests without a planted positive and a planted near-miss in
  the same test (G-040).
- Any place the greeting asserts a machine-wide effect from a linked worktree (G-034's family).

## 6. What cannot be verified now, stated so nobody inherits it as settled

- **C3's live half.** The planner's first roll on this loop's close is after the merge.
- **C4's real half.** A killed and restarted planner session in `~/Worktrees/sia-planner` is
  Aaron's and the planner's test. My six transcripts are the candidate's build through a
  programmatic caller in my tree.
- **The MCP transport.** The greeting the seats see comes through the main tree's server build
  after the merge; the handler I call is the same function, the process is not (G-033).
- **`PRD.md` in the main tree.** Unrun here, as always.
- **Whether the seat's knowledge reached the session** (C1's blind spot). A greeting can prove a
  file was named, not that it was read.
- **The fresh-clone case.** A stranger's clone (G-030, T-154) has no `AGENT.local.md`, no hook and
  no `origin/master` until fetched; the candidate's behaviour there is observed only as far as
  `F-noremote` and the missing-role fixture reach.

## 7. Baseline, reproduced in this tree before any candidate

Recorded in a follow-up commit on this branch once run, each number with the SHA, tree and time it
came from — **not copied from any report**:

- `npx vitest run` in `open-brain/` at `7c7e04b`: exit code, passed/failed/skipped, any
  `Unhandled`/`vitest-worker` line count.
- `node open-brain/build/cli.js sync --check` at `7c7e04b`: passed / warned / failed / skipped.
- The **old build's** greeting for each of the three seats on `F-cur`-shaped fixtures at `7c7e04b`
  and on `F-behind`: six transcripts. These are what C2b's negative fixture looks like **before**
  the candidate, so the report can show the defect present at base and absent at the candidate
  rather than assert it.
- `git log -1 --format=%h -- .agents/roles/<file>` for all four role files at `7c7e04b`.

## 8. Procedure order on hand-over

1. Record the developer's stated SHA and rev in writing. `git fetch origin`; `git cat-file -t`.
2. `git checkout --detach <SHA>`; `git status --porcelain` empty; `git rev-parse HEAD` recorded.
3. Build; analyze (with the T-055 repair if it fires); `sync --check` → 0 skipped. All exit codes
   into variables; `build-info.json` carries the SHA.
4. Full suite (§3 row 1). Exit code first, count second.
5. Fixtures: clone, detach, `update-ref` `origin/master`, plant `AGENT.local.md`; record every SHA.
6. Rows in order: C1, C2a, C2c, C2b, S, C4 (the six transcripts), C2d, C3, §3, §4.
7. Seen-red clauses (C2c, and C1/C2b if the developer's first commit is a red test): scratch clone
   at the first commit, run the named file, exit code recorded.
8. `git rev-parse HEAD` and `git status --porcelain` again. Void if either moved.
9. Report to `docs/loops/loop-14-qa-report.md` on a `qa/loop-14-report` branch cut from the same
   base, committed, not pushed; SHA reported to the planner by A2A. Probes withheld until then.

## 9. Returned to the planner — readings applied, not resolved

Each is applied as stated so the evaluation can run; a ruling that differs is applied on receipt
and recorded inline as **RULED**, as slice two's file did.

1. **"Stale role file"** (C1): I test two readings — (a) working-tree bytes differ from HEAD's blob;
   (b) the file at HEAD is behind the same path at `origin/master`. Pass requires (a); (b) is
   recorded. Is (b) required?
2. **Unknown seat** (C2a): the amendment refuses a write *without* a seat. I also refuse a seat no
   identity file can produce. Is that in scope, or the developer's choice?
3. **"Names the others' by SHA"** (C2b): a handoff cannot carry its own commit SHA because
   `set_handoff` runs before the commit (`end.md`'s own warning). I require the SHA derived from git
   at read time and a "cannot name" line where history is absent. Confirm, or rule the SHA is a
   different thing than a close-out commit.
4. **Staleness shapes** (S): the kickoff row names *behind*. I also require an explicit *current*
   line, a *could not compare* line with no `origin/master`, *ahead* not reported as behind, and no
   network from the start pipeline. Confirm or strike.
5. **The migrated record** (C2b): if the candidate carries a migrated `state.json`, that is a record
   write by the developer mid-loop, at a revision. Whose revision is it, and does the record move
   one seat at a time through it? Not mine to rule; asked so the report can cite it.
6. **C3's refusal shape**: required rows refused by schema, or absence rendered in words? I accept
   either and fail only silence. Confirm that is the bar.
