<!-- generated from .agents/state.json rev 63 by open-brain v0.44.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## planner _(written session 76)_

### Pick up here

LOOP 16 IS CLOSED — ACCEPTED at 5351270, v0.44.0 at 579d894 (D-027), close-out at docs/loops/loop-16-closeout.md with a CI addendum §10; the developer (#87 af90fce, rev 60) and QA (#88, rev 61) rolled before this write. The next loop is Loop 15 slice three, G-045 first (D-026) — write its brief from loop-14-closeout.md §8, loop-16-closeout.md §§5 and 8, and the five tasks opened at this write (T-158..T-162); kick off fresh developer and QA sessions on Opus 5 as Loop 16 was kicked off: both seats report their /start greetings VERBATIM first and the planner checks them against origin/master's record before either reads the brief. Read in order: .agents/roles/planner.md and shared.md (loaded); docs/loops/loop-16-closeout.md; docs/loops/g-039-ruling.md §'What this does not settle'; the developer's and QA seat's handoffs by SHA (named in the greeting). TRANSPORT: Claude Code cross-session discovery is broken on this machine; the seats talk through A2A-Hub on tcm (D-028; memory reference_a2a_hub_tcm) — rooms atlas↔forge k571c0nz7tq2e5g0qt8td094n18ers8v and atlas↔probe k579yfv49ydbzrt3txbg6vrrhs8erycy exist, or open new ones per seat with hub-talk --peer; keep your own read-only-cursor reader; one background listener per room; every message from a file. Held for Aaron at this write: register the trigger for production (close-out §8.1); the census price (§8.2); the tcm redeploy with fd23eac after this close-out merges, AUTH_MODE staying warn.

### Watch out

- NO add_gap BY ANY SEAT UNTIL T-158 LANDS: close_gap splices without a tombstone and the next add_gap is handed a CLOSED id whose old meaning tracked files cite (QA's dry run got G-046 and G-047). New gaps travel as verified entries, handoff rows and tasks — this write did exactly that.
- A RULING WITH NO ACCEPTANCE ROW FIRES NOWHERE. R7 was ruled at amendment 1, agreed by the developer, written into a boundary report, and never built; 153 tests, tsc, sync and five reports were all green. Every ruling that changes behaviour gets a §4 row in the same amendment, or it is an intention.
- THE CENSUS LINE `hook: N` IN ob_stats IS VISIBLE FROM THE OLD BUILD — the data is there and the old query renders it. Only the three fire counts (not-asked / silent / injected) prove the new server. Both seats nearly ran /end against a stale server on that line.
- EVERY SEAT SESSION TONIGHT HAD NO TRANSCRIPT: CLAUDE_CODE_CHILD_SESSION=1 inherited from the VS Code window. Launch cleanly or with CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1 before any row that reads a transcript; check the variable at /start (T-161).
- ALL QA EVIDENCE IN LOOP 16 CAME FROM ONE MACHINE; CI found two faults in one file the first time it looked (599 fsyncs on a file-backed fixture; it.each rows without the spawn timeout). 'Green per-file' was true and false under load. Run the full suite alone at every candidate, and read the CI run id, not the empty rollup — registration lagged ~3.5 minutes.
- A STACKED FIXTURE FAILS IN THE FLATTERING DIRECTION: both seats built one within hours (short decoys; a short sentence) and both caught their own. Guard fixtures in both directions — not weakened, not stacked — and report decoy lengths.
- AN ASSERTION ON A VALUE THE HARNESS NEVER CAPTURED (M18): execFileSync returns stdout only; a hardcoded stderr: '' passed every stderr assertion without looking. tsc --noEmit on every mutant before it counts — three type-invalid mutants went red for the wrong reason in one session.
- THE REGISTRATION IS MACHINE-WIDE: one settings.json entry arms the hook for every session in every project; it fired in the planner's and developer's sessions during QA's probe. Say the blast radius, not only the build.
- PARALLEL BASH CALLS SHARE ONE CWD; MSYS MANGLES ref:path IN git show; GITHUB ACTIONS REGISTERS RUNS LATE; the sync gate goes red on docs-only commits until you rebuild — all still true, all bit again.
- hub-talk: --say used to advance the read cursor (two dropped turns); fixed in c85c0d3, but a --wait started while a previous one runs under the same name double-delivers, and an inline --say executes backticks. One listener; files.

### Open questions

- Register the trigger for production, pointing at the main tree's build? Recommended yes for one loop, measured by the fires table and point-of-use rating (close-out §8.1). Aaron's file, Aaron's call.
- Is the floor conservative or mute? First production counts: 10 recognised commands asked the store and got nothing, against 1 injection. T-159 keeps the denominator; the next trigger increment reads it.
- The first injection was rated neutral by the seat that received it — the rule was already loaded three ways. When does an injection change behaviour, and what counts it? The fires table plus /end ratings are the instrument; nothing yet reads them across sessions.
- Where does the ranking gap get built — a column weight, a gap criterion between rank 1 and 2, or a relevance signal beyond bm25 (G-026 amendment)? Not slice three's; named so it is not rediscovered.
- A2A-Hub: redeploy tcm with fd23eac (after this close-out merges, before the roll — Aaron's sequencing); per-agent keys then strict; long-poll/push (T-160). Aaron declined the tailnet for the Grok bot's host; revocation must be exercised against the ~39 live agent rows before the hub is public.

### Loop state

**Open PRs:** _None._

**SHA frozen for QA:** `none — Loop 16 accepted at 5351270, tip ca1693f + c02b47b, tagged v0.44.0 at 579d894`

**Questions pending for Aaron:** 
- Register the trigger for production (main tree build)?
- Keep the census price one loop, or make T-159 slice three's first task?
- tcm redeploy with fd23eac after this close-out merges (AUTH_MODE stays warn).

**Rulings made mid-loop:** 
- R1–R27 in loop-16-brief-amendment-1..12 (1453e5f c43a31f 1051cae 5ab0ac4 6da5fa9 f28ed11 3db1365 29766dc 0c70b52 084cf18 e0c1dd2 87cbb9d); R28 at this write: no add_gap by any seat until T-158; G-039 stays open as the loop's evidence rather than being spliced away.
- Planner errors 51–54 set in the close-out §7 (54 / 31 / 2).
- No PRs open at this write: #83–#88 merged; the planner close-out PR follows this commit.

## developer _(written session 74)_

### Pick up here

LOOP 16 IS MERGED AND TAGGED: PR #83 at f075482, origin/master 579d894, v0.44.0. The recall trigger is live — it fired in a real session and the production store carries its fire rows. THE DURABLE ACCOUNT IS docs/loops/loop-16-developer-handoff.md: sections 1-16 for candidates 1 and 2, 17-21 for candidate 3, with section 5 and section 18 carrying what went wrong. The planner's close-out is docs/loops/loop-16-closeout.md at 579d894. THE RECORD'S OBJECTIVE IS STILL THE PRE-LOOP ONE ('NEXT LOOP: the G-039 recall trigger — not yet briefed') and G-039 is still open: both are the planner's to rule at its own close-out write, and this seat deliberately did not touch either. The next developer session is a FRESH seat for whatever is briefed next.

### Watch out

- A DERIVED VALUE IS ONLY AS GOOD AS THE CHANNEL THE ASSERTION READS FROM. execFileSync returns ONLY STDOUT, so a harness that hardcoded stderr:'' made every expect(stderr).toBe('') pass without ever looking — on the exact observable a ruling had just been written to require. A mutant found it; no amount of reading would have. When a test asserts on a value, check the instrument actually carries that value to the assertion.
- A THRESHOLD COMPARED AGAINST bm25 IS CORPUS-RELATIVE, AND A FIXTURE THAT DOES NOT RESEMBLE THE CORPUS CANNOT TEST IT. The same query scores about 5e-6 against three documents and 14.01 against 599. At the shipped floor a small store is silent for EVERY input, so 'the floor silenced the weak match' passes with the floor doing no work at all. floor.test.ts carries a row asserting its own corpus is still at production scale; if that row ever goes red, every floor assertion under it has gone vacuous rather than wrong.
- A STACKED FIXTURE PROVES AS LITTLE AS A VACUOUS ONE — IT JUST FAILS IN THE FLATTERING DIRECTION. Decoys at 235-343 characters against a 566-character target reported rank 9; rebuilt at comparable length, rank 4. The wrong number was the one that made the problem someone else's, and I reported it before catching it.
- A RULING CAN BE ASKED FOR, AGREED, REPORTED AS SETTLED, AND NEVER BUILT. R7 was the answer to my own question and produced no code and no test. Nothing between the ruling and QA's verdict could tell: 153 tests, tsc clean, sync clean, five boundary reports and a handoff checklist were all green. Loading a rule, agreeing with a rule, and applying a rule are three different things.
- PER-INSERT TRANSACTIONS ON A FILE-BACKED SQLite FIXTURE ARE 20x SLOWER: 599 inserts is 599 fsyncs, 2999ms against 148ms wrapped. Survivable locally and over vitest's 10s HOOK timeout on CI, where the whole file then reports its tests SKIPPED — which reads like a missing suite rather than a slow one. :memory: fixtures are unaffected, which is why only one file went red.
- A BULK EDIT THAT MATCHES `it(` DOES NOT MATCH `it.each([...])(`. Three rows kept vitest's default timeout and passed alone every single time, including in CI where an earlier failure hid them. PER-FILE GREEN IS NOT SUITE GREEN: run the full suite alone before calling a change done, including when the change is 'only tests'.
- `git show <ref>:<path>` IS MANGLED BY MSYS IN THE BASH TOOL — it becomes a backslash path and git refuses it. Use PowerShell for ref:path reads. Every amendment and every cross-branch file in this loop was read that way.
- THE HOOK RUNS THE BUILD ITS REGISTRATION POINTS AT, and ob_stats is the only honest test of which build is serving a session — the RECONNECT MESSAGE REPORTS SUCCESS EITHER WAY. Note the trap: the recall-trigger census value `hook` is visible from the OLD build too, because that query predates the loop; only the three FIRE COUNTS prove the new one.

### Open questions

- IS THE FLOOR SET TOO HIGH? The first production numbers are 5 not-asked, 10 asked-silent, 1 injected — so ten recognised commands asked the store and got nothing. That is either a correctly conservative floor or a floor that will train seats to ignore a channel that never speaks. The fire table now makes it answerable; nobody has answered it.
- DOES A SEAT ACT ON WHAT IS SURFACED? Unmeasured by design. This loop makes the store ask; whether the answer changes an error rate is the next loops' count, against the error table, by family.
- IS THE 0.28s PER Bash CALL ACCEPTABLE? R22 kept the census's denominator for the evaluation period and put the cost to Aaron. The named follow-up is a cheap not-asked path that appends to the log the hook already writes and lets the session-end hook reconcile it into trigger_fires.
- SHOULD THE RANKING BE REPAIRED, AND HOW? Entry 299 ranks 4 of 11 against ten same-topic competitors; the live store ranks it first only because five entries match all three terms. Key-column weighting moves it (x10 to first, by 0.56) but a weight chosen to make a test pass is tuning to the test.

## qa _(written session 75)_

### Pick up here

THIS IS THE QA SEAT'S HANDOFF for Loop 16, the G-039 recall trigger, ACCEPTED at 5351270 and released as v0.44.0. Read the planner's close-out at docs/loops/loop-16-closeout.md for the loop's disposition; the four QA reports are in #85 (75e307d) — report 1 at a13f3c5 with its correction at ef79340, report 2 at c1b977a, report 3 at 87b4cef, report 4 at 31fec1a. Seats roll after every complete loop, so the next QA session is a FRESH one for whatever the planner briefs — Loop 15 slice three per D-023, whose mandatory first repair is G-045. Its first act is the same as this seat's was: write docs/loops/loop-<N>-qa-criteria.md from the brief's rows BEFORE any candidate exists, in the shape of loop-16-qa-criteria.md at 75f05eb, every pass clause derived from the brief's words, anything added marked [mine] and returned to the planner in a numbered section rather than applied. Nine criteria commits this loop and not one of them moved while a candidate was under evaluation; that is the property worth keeping. The probe shapes are in report 1 §10, report 2 §14 and report 3 §10 and are rerunnable from the descriptions — the scripts were scratchpad-only and are not tracked. Evaluate in ~/Worktrees/sia-qa; the tree carries its own .gitnexus/ index so /sync runs 0 skipped. TWO GAPS THIS SEAT FOUND ARE UNWRITTEN AND ARE IN V-071 AND THE OPEN QUESTIONS BELOW, because writing them would have reused two closed gap ids.

### Watch out

- CLOSED GAP IDS ARE HANDED BACK BY THE NEXT add_gap. At rev 60 a dry run assigned G-046 and G-047 — ids closed at rev 59 whose OLD meanings are cited in ten tracked files, including .claude/commands/end.md, which explains the per-seat handoff by citing G-046. Done-task retention now protects ids the tree cites (it KEPT T-157 in this very write, with a NOTE); gaps have no such guard, and the gap failure is worse: an evicted task id goes DANGLING and announces itself, while a reused gap id points at something WRONG and does not. DRY RUN EVERY add_gap AND CHECK THE ASSIGNED ID AGAINST `git grep` BEFORE THE REAL CALL.
- ob_stats SHOWING `hook: 1` IS NOT EVIDENCE THE SERVER KNOWS ABOUT THE TRIGGER. That census is a GROUP BY over recall_log values, so a stale build prints it from data alone. The three fire counts from trigger_fires are the discriminator, and the planner's check was worded to require them — one word looser and a pre-0.44.0 server would have been declared current.
- A QUOTING LAYER BETWEEN YOU AND THE ARTIFACT EDITS THE CONTENT AND REPORTS SUCCESS. Four instances this session: a heredoc'd backslash became a real newline inside a TypeScript string literal (syntax-broken mutant, all twelve tests red, looks exactly like the result you wanted); a heredoc'd regex never compiled so a fixture was never modified and the test passed against it — which read as A FALSE ACCUSATION against a working guard; a backticked word in a hub message was executed as a command substitution and the clause arrived missing its subject; and json.dumps without ensure_ascii=False escaped every em-dash in Aaron's settings.json. WRITE EVERY SCRIPT AND EVERY MESSAGE TO A FILE, including one-liners, and have mutation scripts ASSERT THE EDIT LANDED before running anything.
- tsc --noEmit ON EVERY MUTANT, BEFORE COUNTING IT. Three mutants this session were type-invalid and proved nothing while looking red or green as convenient — TS2349 from calling an object instead of its method, and an invented field that fell back to the real one at run time. A mutant that breaks syntax or types is not a mutant.
- A FIXTURE CAN FAIL IN THE FLATTERING DIRECTION, and that is harder to see than a vacuous one because it looks like rigour. My first A1 decoy carried all three query terms in one short sentence and beat entry 299; the developer's rank-9 fixture gave every decoy a length advantage. Both exaggerated the defect. Measure your fixture's shape — decoy lengths against the target's — and report the range.
- THE DERIVATION READS ELEMENTS, NOT WORDS. `zzqqxxyy 2>&1 | tail -3; echo $?` derives all three terms and injects, because the recogniser sees a trimmer pipeline and a $? read. You cannot produce a SILENT fire with nonsense command text; use a three-document store, where bm25's IDF collapses and nothing clears the floor.
- EVERY ROW YOU RUN, RUNS ON THIS MACHINE. CI is the second machine and it found two faults in one file the first time it looked, both of which passed every local run including three full suites. Cite a CI run id as evidence, and treat an empty statusCheckRollup as PRE-REGISTRATION and not a pass — mine was genuinely empty for ~3.5 minutes after the push before the run appeared.
- NOTHING IS PUSHED FROM THIS SEAT. The planner pushes QA branches by the SHA this seat reports, on Aaron's word for that push. Every push names a BRANCH TIP, never an interior commit — a report correction is auditable only if the thing it corrects travels with it.
- REGISTERING THE HOOK IN ~/.claude/settings.json IS MACHINE-WIDE, not QA-tree-wide: two of the ten fire rows from the A7 probe carry other seats' session uuids. Aaron's word is for THAT ACT AT THAT SHA and does not carry forward. Back up first, hash before and after, and verify the restore BY BYTES — 'PostToolUse is [] again' is a semantic restore, not a restore.

### Open questions

- WHERE DOES A CLAUDE CODE SESSION'S TRANSCRIPT ACTUALLY LIVE? Not at ~/.claude/projects/<slug>/<uuid>.jsonl for this session — three .jsonl files there, none this uuid, none holding the probe string; a recursive search found it only in open-brain/knowledge-v2.db-wal, the trigger's own fire row. Until that is answered, no criteria row can evidence that the host DELIVERED a hook's additionalContext to the model, only that the hook emitted it. A7 was scored on the fire rows for exactly this reason. UNWRITTEN AS A GAP because the id would have collided.
- DOES A SEAT APPLY WHAT THE TRIGGER SURFACES? Unchanged and unmeasured, and the loop's own premise was demonstrated against it while the candidate was being built — the developer piped to tail and read tail's exit code while measuring A10, against a store containing entry 299, with the hook built and not registered. A trigger built and not registered is exactly as useful as no trigger.
- IS THE RANKING GAP (R26) WORSE THAN THE LIVE STORE SUGGESTS? Entry 299 ranks first on the real 599-entry store only because five entries there carry all three derived terms — a thin field. Against ten same-topic competitors it ranks 4th (developer, comparable length) or 3rd (mine). The key-weight table is in the close-out as evidence; the loop that owns ranking chooses.
- IS G-042 ANYTHING BUT THIS MACHINE? Eight sightings, one machine, and now three clean full runs in a row in the QA tree at rising counts (1021, 1027, 1031). CI has never shown the worker-heartbeat signature — but CI has now shown two OTHER load-dependent faults in the same file, which is the first evidence that the QA tree is a fast machine rather than a representative one. UNWRITTEN AS A GAP because the id would have collided.

## Last session

Session 76 — 2026-09-21 — planner — `22631f4e-433a-4f29-8669-47ee2f543bec`
