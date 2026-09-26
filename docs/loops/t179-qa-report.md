# T-179 + T-163 on the merged tree `3c0bfdc`: QA report (QA seat, record session 125)

**By:** the QA seat, record session **125**, headless on the QA PC `DESKTOP-O4EGB1E`, launched by
`docs/loops/qa-125/drive.ps1` (Claude session `2e613953-7019-4a16-84f7-cacfa1ca5c4f`). 2026-09-26 (UTC).
**Dispatch:** `docs/loops/t179-dispatch-qa.md` (`e1b5011`). **Candidate:** `3c0bfdc` on `origin/loop/t179-merge`
(handoff tip `f618b73`, whose diff after `3c0bfdc` is `docs/loops/` only). **Model and effort:** `claude-opus-5-5`
on all 206+ assistant messages of this run's stream (`%USERPROFILE%\sia-qa125\run-0.jsonl`); effort **`high`**, read
from this process's command line (`claude.exe -p … --model claude-opus-5-5 --effort high`, pid 10532). The stream
records no effort value, only `per_turn_effort_active: true`.

## Verdict

**REJECT as it stands: one blocking defect (D1). Everything else the dispatch named was verified and holds, with
three more defects (D2 is the serious one) and a list of gaps in the after-merge steps.**

- **D1 (blocking, new in this candidate).** The per-session retention this candidate adds is driven by the session
  **number**, and for a session the record has not seen yet that number is the caller's `session` argument,
  unchecked. **One write with a wrong number erases other sessions' handoffs and session records**, through ob_state
  itself. A number typed as 1124 instead of 124 removed Forge 118's and QA 120's handoffs and session records in one
  write (check 1, A6). The wrong number can never be corrected afterwards (A6b, G-047 locks it). **A seat that passes
  its local greeting number** (T-164: Forge 124 greeted as 6) **loses its own new handoff in the same write** (A6c).
  **T163-2's scan does not see any of it**, because it recomputes retention from the state after the step, and that
  retention explains the removal (check 1b). This violates T163-1 as briefed: "replacing another session's entry
  refuses". The fix is small (bound the number of a session the record has not seen); see "Open for the planner" 1.
- **D2 (serious; its root is T-003, which is known and open).** "Keyed by the writing session" holds only if the
  server holds the right uuid, and it takes the uuid from `ob_set_session`'s argument (unchecked, A7) or adopts it
  from the per-checkout hook slot (T-003). Three paths replace another session's handoff **in place**, and the scan
  cannot see any of them (the key is still present):
  - A7: explicit registration as the victim's uuid;
  - A8: a reconnected server adopts the other session's uuid from the shared slot;
  - A9: after `/clear`, the surviving server keeps the previous session's registration. This one rests on the MCP
    server surviving `/clear`, which I could not observe headless.
- **Holds:**
  - the op-level guarantee: no op names a uuid, and no op deletes or updates another's entry (A1, A4);
  - two sessions of one seat and checkout through the writer (A2);
  - no-session refusal (A3);
  - the newest per (seat, checkout) is never dropped (A5);
  - the migration on both live-record copies: every uuid kept by two instruments, idempotent to the byte, and an
    `ob_state` write after it works;
  - the history scan: 44 erasures, both known positives, and 3 spot-checks read by hand, confirmed by an independent
    recount;
  - `end.md` writes no state (byte-identical `state.json` in two projects);
  - the SessionEnd guard: warns, never blocks, shown exactly once;
  - the importer probes: identical to master;
  - **Addition 1 as re-ruled: met**;
  - my 7 mutants: all red locally, and **6 of 7 red on tcm**. **`erasure-blind-rev60` survives on CI**, because the
    only row that kills it skips on a shallow checkout;
  - the full local suite: 1287/1287;
  - the developer's CI run, read per test.
- **T-171 is NOT the only remaining path** (check 1). Inside T-163's per-session class the remaining paths are D1 and
  D2. Outside it, `close_task`'s `note` replaces the note exactly as `update_task` does (T-171 names only
  `update_task`), and `update_gap`, `close_gap` and `set_objective` change or remove what another session wrote, by
  design (ADR-021, G-010, STATE class).

## The brief's items

| Item | Result | Evidence |
|---|---|---|
| **T163-1** a close-out can only add its own record | **Holds at the op level; fails at the door (D1, D2).** Handoffs keyed by `session_uuid`, which the writer stamps (A1: `session_uuid`, `uuid`, `checkout`, `session`, `sessionUuid` in the op each refused as an unrecognised key). `set_handoff` with no session refuses (A3). No delete/update op exists for either array (A4: 5 invented ops refused; `end_session` refused by name). But see D1 (the number) and D2 (the uuid). | `c1.out` |
| T163-1: planner kept singular? | Not kept (the developer's choice, argued in handoff §2). Rendering still shows one planner handoff per checkout. | c9 |
| T163-1: `last_session` → | `sessions[]`, written by every attributed write; `lastSession()` derived. An unattributed write changes neither array (A3). | `c1.out` A3 |
| T163-1: the migration | **Verified** (check 2). | `c2.out` |
| T163-1: retention never drops a still-open seat's entry | **Holds for the rule:** the newest per (seat, checkout) is never dropped, however old (A5: infra@110 kept at newest 500). **But "newest" is decided by an unchecked number (D1).** | `c1.out` A5, A6 |
| **T163-2** the `/sync` check + history | **Verified** (check 3): 44 legacy erasures (25 handoffs, 19 sessions), rev 60→61 and 61→62 flagged, 0 at v3. It fails on a v3 hand edit (control in c1b). **Blind to D1 and D2 by construction.** | `c3.out`, `c3-recount.out`, `c1b.out` |
| **T179-1** `/end` cut to lessons | **Verified** (check 4). 59 lines (the brief: under 60; the developer's handoff says 58, `wc -l` says 59). No `ob_state`. Byte-identical `state.json` in two projects, rated and unrated. The template copy is byte-identical to `.claude/commands/end.md`. | `c4a2.out`, `c4b.out`, `c4c.out` |
| **T179-2** missing handoff warns, never blocks | **Verified** (check 5). | `c5.out` |
| Merge round: importer v3 rule, guarantees | **Verified** by QA 111/122's probes (check 6), identical to master; the v3 rule accepted by the planner. | `probes-*.out` |
| Merge round: greeting figures | Label cost **+87** reproduced by an independent line diff (five lines: `[legacy]` ×3 +27, heading +23, "— 1 writing session(s) in the record" +37). | `c9b-label.sh` |

## The planner's rulings

| Ruling | Result |
|---|---|
| Retention per **checkout** | Built as ruled: (seat, checkout), >10 sessions older than the record's newest (A2 at gaps 5, 10, 11; A5). **The number that decides "newest" is unchecked: D1.** |
| Greeting: newest handoff per (seat, checkout) | Built as ruled (c9: "(147 older handoff(s) superseded within their seat and checkout are in the record, not shown)"). |
| Migration keeps every uuid | **Verified by two instruments** on both copies (check 2). |
| **Addition 1 as re-ruled** | **MET.** See [Addition 1](#addition-1-greeting-size-at-1-10-and-50-sessions-per-seat). |
| Importer v3 rule (legacy entries, stamped by no session) | Accepted by the planner; consistent with what I saw. The imported legacy entry survives a keyed write (the developer's v3 row 3) and is never superseded (A12). |

## Check 1: can anyone erase another session's record?

Instrument `c1-attack.mjs`: the candidate's build, on a scratch clone of `3c0bfdc` whose record is this
repository's rev 132, migrated to v3 by the candidate. Writer-level probes call `applyStateOps` with an explicit
`session_uuid`/`checkout`. Door-level probes (A7–A9) call the server's own `handleSetSession`/`handleState`, with
every store redirected to scratch. Output: `evidence/c1.out`.

| # | Attack | Result |
|---|---|---|
| A1 | `set_handoff` carrying `session_uuid` / `uuid` / `checkout` / `session` / `sessionUuid` | **HOLDS** ×5: `Unrecognized key` |
| A2 | two sessions of one seat, same checkout, 5 / 10 / 11 sessions apart | **HOLDS** ×3: first kept at 5 and 10; dropped at 11 **by retention, as ruled, and reported** ("superseded=handoff 00000200…"); the legacy developer@74 kept every time |
| A3 | no registered session | **HOLDS**: `set_handoff` refuses; an `add_gap` at session 9999 applies with a NOTE and leaves `handoffs[]`/`sessions[]` untouched |
| A4 | `delete_handoff`, `remove_handoff`, `update_handoff`, `clear_handoffs`, `delete_session` (each naming the victim), `end_session`, `set_handoff`+victim uuid | **HOLDS** ×7: all refused, victim unchanged |
| A5 | a retention drop of the newest per (seat, checkout) | **HOLDS**: at newest 500, infra@110 (its instance's only entry) and builder@115 kept; builder@111 dropped (ruled) |
| **A6** | one session writes with a **wrong number** (1124 for 124) | **BROKEN**: the same write superseded **Forge 118's handoff and session record** (same seat and checkout) and **QA 120's** (another seat, another checkout, because "newest" is now 1124). `lastSession()` reads 1124. |
| **A6b** | the session corrects its number | **BROKEN**: "already recorded as session 1124; kept 1124" (G-047). No op can correct it. |
| **A6c** | a session passes its **local greeting number** (6), in a checkout where 118 wrote | **BROKEN**: its own new handoff is superseded in the same write, and the greeting keeps showing 118's |
| **A7** | `ob_set_session(<victim's uuid, read off state.json>)` then `set_handoff` | **BROKEN**: the victim's entry now reads "attacker overwrote it" |
| **A8** | T-003 × T-163: session B started second in the same checkout (the slot holds B); A's server reconnects and never re-registers | **BROKEN**: A's `set_handoff` replaced B's handoff (B's entry now "session A's handoff after a reconnect") |
| **A9** | `/clear`: the server keeps the previous session's registration; the new session writes before `/start` | **BROKEN** in the handler: session 901's handoff replaced by 902's text, still stamped session 901. **Premise not observed** (see [could not be verified](#what-could-not-be-verified)). |
| A10 | a qa-role session labels its handoff `developer` in a developer's checkout, 11 ahead | The script prints BROKEN; **I reclassify it as a limit.** Any real developer session 11 ahead would drop the same two entries by the ruled rule. What it shows is that `seat` is an op argument, not checked against the checkout's declared role. |
| A11 | STATE/EVENT paths | `update_task` note → replaced (**T-171**); **`close_task` note → replaced** (not named by T-171); `update_gap` evidence → replaced (ADR-021, by design); `close_gap` → another session's gap removed (G-010, known) |
| A12 | do legacy entries ever leave? | No. After three qa writes 20 sessions apart, qa@75 `[legacy]` is still there. No op removes one, and a hand edit would be an erasure `/sync` fails at v3. They render for ever (as one-line excerpts; c9). |

**Check 1b: does T163-2 see these?** (`c1b-scan.mjs`, `evidence/c1b.out`) Each step was committed in a clone with
the full history, then scanned by the candidate's CLI: `Erasures: 45 (1 at schema v3+)`. The one flagged is my
**control**, a hand edit deleting S124's handoff. **A6's four removals and A7's overwrite are not flagged.**

**T-171, as asked:** it is known, NOT fixed, and **not the only remaining path.** Named above: D1 and D2 in the
per-session class; `close_task`'s note outside it.

## Check 2: the migration v2 → v3 on copies of the live record

`c2-migrate.sh`, `evidence/c2.out`. Copies: **rev 132** (`origin/docs/session-100-qa99-dispatch`, sha256
`f486846e…`, byte-identical to this tree's live file) and **master's rev 131** (`b75b6530…`), each in a full
scratch clone of `3c0bfdc`.

| | rev 132 copy | master rev 131 copy |
|---|---|---|
| Dry run | changes listed; file sha unchanged | same |
| Run 1 | v2→v3, **rev 132→133** | v2→v3, **rev 131→132** |
| Instrument A (the migration's own count) | 2 distinct before, 2 after, none lost | same |
| Instrument B (`grep -o` of every uuid-shaped string, and a JSON walk printing each one's path) | before: 2 occurrences, 2 distinct, at `$.gaps.12.evidence` (`d7e514f8…`) and `$.last_session.uuid` (`22631f4e…`). After: 2 and 2, at `$.gaps.12.evidence` and **`$.sessions.0.uuid`**. Sets equal. | identical |
| Field by field | every field except schema_version, revision, handoffs, last_session and sessions byte-identical; handoffs word for word + `session_uuid`/`checkout` null; `sessions[0]` = `last_session` + `checkout: null` | same |
| Run 2 (idempotence) | "already at schema v3 (revision 133) — nothing to do"; sha256 after run 1 == after run 2 (`53313f81…`) | same (`491d5f70…`) |
| An `ob_state` write after (server handlers, registered session) | `set_handoff qa` + `add_gap`: **rev 133→134, applied, 4 views rendered**. Legacy qa@75 kept beside the new keyed qa@125; `sessions[]` = [76 legacy, 125 new]; 3 distinct uuids | rev 132→133, the same |

The live `.agents/state.json` of this tree was never written: sha256 `f486846e…` at start and end.

## Check 3: T163-2 on this repository's full history

A fresh full clone from GitHub (`--is-shallow-repository` false), detached at `3c0bfdc`, scanned by the candidate's
CLI (`evidence/c3.out`, 6.2 s):

```
Walked 827 commits on HEAD; 223 changes to .agents/state.json (0 at schema v3+).
Erasures: 44 (0 at schema v3+, which /sync fails on)
```

**Total 44: 25 handoffs and 19 session uuids**, all legacy. **Known positives flagged:** rev 60→61 (`0ad9c29`: session
`46758737…` (74, developer) and handoff qa@72) and rev 61→62 (`024dfa4`: session `6eab2c5c…` (75, qa) and handoff
planner@73). The developer's 789 commits / 222 changes were at `7ba177f`; the merge of master adds history, not
erasures.

**Three spot-checks, read from the two revisions myself** (`git show <c>^:… / <c>:…`):

| Commit | Scan says | Parent → commit, read by hand |
|---|---|---|
| `0ad9c29` rev 60→61 | removed qa@72 and session 74's uuid | handoffs `qa@72,developer@74,planner@73` → `qa@75,developer@74,planner@73`; last_session 74 `46758737…` (developer) → 75 `6eab2c5c…` (qa). **Confirmed.** |
| `a1d5b11` rev 130→131 | removed planner@100 | `…planner@100` → `…planner@109`; last_session unchanged (76). **Confirmed.** |
| `c3ec2c3` rev 9→11 (v1) | removed handoff ?@57 and session 57's uuid | v1 handoff @57 → @58; last_session 57 `10613af5…` → 58 `4a395fd1…`. **Confirmed.** (The commit's own subject says "rev 8 → 11": the intermediate revisions were never committed.) |

**Second instrument** (`c3-recount.mjs`, my own walker, not the candidate's code): **44 removals (25 handoffs, 19
sessions), in the same 28 commits, with the same count in every commit.** 0 commits differ.

## Check 4: T179-1, the new `end.md` run as written

`c4-end.mjs` drives the **real MCP server over stdio** (the SDK client) through `end.md`'s steps in order:
`ob_recall` the lesson's title (trigger explicit), `ob_store` (`kind: "event"`, a `MATCH: command:` key, tags), read it
back with `ob_recall`, `ob_recalled`, then `ob_end` rating only what `ob_recalled` listed. Everything the server
touches outside the project (DB, slot, vault, logs) is redirected to scratch.

| Project | `state.json` sha256 before = after | files changed in the project | stored / recalled / rated |
|---|---|---|---|
| A: SIA clone, migrated v3 record (637 files) | `3e1e2fd0…` = **BYTE-IDENTICAL** | none | id 1 kind event / `[1]` / `{"1":"helpful"}`, "Feedback: 1 entries rated" |
| B: a stranger's project from `project-template/` (37 files) | `11cbc64d…` = **BYTE-IDENTICAL** | none | same; vault got `Experiences/c4-stranger/…md` and `Summaries/2026-09-26-c4-stranger.md` (scratch) |
| B, no `ob_set_session` (a session with no `/start` and no hook) | **BYTE-IDENTICAL** | none | stored; recall "_(NOT LOGGED: no active session — no hook slot found…)_"; `ob_recalled`: "No session id: no-slot"; **0 rated** |

**What a stranger's project needs for `/end` to work:**
1. The open-brain server built and registered as `open-brain` (`node scripts/setup.mjs` does it for Claude and
   Cursor). The Cursor copy says so; the Claude copy does not.
2. **A registered session before step 3.** Without the SessionStart hook or `/start`'s `ob_set_session`,
   `ob_recalled` has nothing and the rating step silently rates 0. `end.md` does not say this.
3. **The SessionEnd hook, for the claim in line 10** ("writes the session summary, auto-feedback and logging whether
   or not `/end` runs"). **`setup.mjs` does not register SessionEnd** (check 7); only the README's manual block does.
4. Nothing from the record: `/end` reads and writes no `state.json`.
5. Cosmetic: the template copy carries SIA's own ids into every stranger's project (T-163, T-170) and an SIA path
   as its `MATCH: path:` example.
6. **No code reads `MATCH:` yet** (grep of `open-brain/src`: no hit; T-170's recall side is out of scope). Line 21
   says the trigger injects an entry "only on a deterministic match against the act" in the present tense.

## Check 5: T179-2, the SessionEnd guard

`c5-guard.sh` runs the candidate's **built hooks** as a host does: a JSON payload on stdin, a scratch project with a
bare origin, a transcript whose first line fixes the session start, and HOME and every store in scratch
(`evidence/c5.out`).

| Case | Result |
|---|---|
| T0 only a commit from before the session start | "no loop/* commits this session", exit 0 |
| **T1 commits on `loop/a`, no handoff** | **`HANDOFF MISSING` on stdout AND stderr, naming the session, `loop/a`, 1 commit; exit 0**; marker written (1 line), ignored by git |
| **T2 the next SessionStart, twice** | **first greeting: 1 `HANDOFF MISSING` line; second: 0**; marker moved aside to `.missing-handoff.shown.jsonl` |
| **T3 work on `loop/b-mut` + handoff on `loop/b`** | "handoff committed (docs/loops/b-developer-handoff.md)", no warning, no marker |
| T4 `docs/loops/c-notes.md` + root `HANDOFF.md` | warns (stated limit) |
| **T5 never blocks** | no transcript, a garbage transcript, a broken `.git/HEAD`, stdin not JSON: **exit 0 every time**, "NOT RUN" with the reason |
| T6 another session's commit in the same window | counted as this one's (stated limit, confirmed) |
| T7 a handoff arriving through a merge of a docs branch | counted as committed |

**Runtime:** on a clone with all 162 remote `loop/*` branches made local, `checkSessionHandoff` took **7.7 s (1-day
window) and 9.4 s (7 and 60 days)**: two git calls per branch, before the rest of SessionEnd. It never blocks, but
it is paid at every `/clear`. The live seat checkouts are not on this PC, so their branch counts are unknown. The
same run shows the inverse of T6: in a busy checkout, another session's handoff in the window reads as "ok".

The notice is shown by the **SessionStart hook's** output (`cli-bootstrap`), not by `ob_start`'s greeting. Whether a
host surfaces it is the host's business; it is consumed either way.

## Check 6: the importer on v3

QA 122's `probes-r4.mjs` (sha256 `6863dd15…`, from `qa/importer-fixes-r4-report`) and QA 111's `probes-r3.mjs`
(`3832568d…`, from `qa/importer-fixes-r3-report`), **byte-exact**, run on `3c0bfdc` and on master `aae0dce`
(built here) today:

| Script | `3c0bfdc` | `aae0dce` | diff of the outputs (paths normalised) |
|---|---|---|---|
| `probes-r4.mjs` | **16 passed, 0 failed** | 16 / 0 | one line: a temp-file pid (`INBOX.md.tmp-3612` vs `-15188`) |
| `probes-r3.mjs` | **17 passed, 4 failed** (21 checks) | 17 / 4 | one line: a temp-file pid |

**The 4 FAILs are the rows QA 122 recorded at `78a7d13`, each named with its ruling:** the three `R3-2 class: … then
PS 5.1 >>` rows and `UTF-8 with one stray NUL at the end`. All four are R3-2's NUL case as **R4-1** ruled (block, do
not judge). No other FAIL. The v3 change is invisible to both probe sets, as it should be.

## Check 7: the after-merge steps (handoff §7) walked as a stranger

`c7-walk.sh` (`evidence/c7.out`): a clone of master `aae0dce` with its v2 rev-131 record; a scratch merge of
`3c0bfdc`; a scratch HOME; the OLD server = `aae0dce`'s build, the NEW = the merged tree's build.

| Moment | What a stranger sees |
|---|---|
| Before the merge, OLD | greeting fine (rev 131); `ob_state` dry run fine |
| After merge, before rebuild, OLD still running | still fine (the merge leaves the record at v2) |
| **Rebuild** via `node scripts/setup.mjs` (§7 does not name the command) | builds, registers MCP, SessionStart hook, 7 commands, Cursor MCP/hook/4 commands, vault. **No SessionEnd hook** (T179-2's). With no `~/.claude` it crashes (`ENOENT … .mcp.json`); pre-existing. |
| **NEW, record still v2** (between §7 steps 1 and 2) | **`ob_start` refuses the whole greeting** ("STATE RECORD REFUSED … NOT falling back"), `ob_state` refuses. The advice names the migrate command. |
| **NEW, another SIA project on the machine** (the template, v2) | **the same refusal.** §7 does not mention other projects, and the advice's command `node open-brain/build/cli.js …` exists only in SIA's own tree. |
| Step 2: migrate dry run, run, commit | as in check 2 (131→132) |
| NEW on v3 | greeting fine (rev 132), `ob_state` fine |
| **OLD (a seat not rebuilt/reconnected) on v3** | refuses, advising a rebuild. Correct. |
| Step 3: installed commands | `~/.claude/commands/{end,sync}.md` and `~/.cursor/commands/{end,sync}.md` equal the template's, and `.claude/commands/end.md` equals the installed copy |
| `/sync --check` after | 24 passed, 2 warnings, **4 issues**: **`summary-version`** (all four views still say rev 131: **`state migrate` does not re-render them**, and the `state-views` warning says the same); **`build-freshness`** (build `45c07d5` ≠ HEAD `9c718bb`: the migration commit came after the rebuild); `greeting-size` (46,882 > 40,000; **also an issue on master**, 46,572); `retirements` (ENTITIES.md, pre-existing). `record-erasure` pass (1 v3 step, 0 erasures); `command-parity` pass across repo, template and user scope; `state-schema` pass. |

**Missing or out of order in §7:**
1. **Order:** reconnect only **after** step 2. §7 says rebuild and reconnect first; every open session's greeting is
   then refused until the migration lands.
2. **Re-render the views in the migration commit.** `state migrate` writes `state.json` only; the four rendered
   views stay at rev 131, and `/sync` fails `summary-version`. Run `sync` (without `--check`), or an empty `ob_state`
   batch, before committing, so "one commit, the migration alone" carries its views. Then **rebuild again**, or
   accept `build-freshness` until the next rebuild: the migration commit moves HEAD after the build.
3. **Every other project** on the machine that has a v2 record needs `node <SIA>/open-brain/build/cli.js state
   migrate --dry-run <project>/.agents/state.json`, then the real run. Until then its greeting is refused. §7 names only this repo.
4. **Seat worktrees:** each seat's checkout reads its own `.agents/state.json`. A seat whose server is rebuilt while
   its branch holds v2 is refused and told to run the migration on its own branch copy: a second, independent
   migration commit on a branch, which is G-027's shape. §7 should say: bring master's migration commit into each
   seat's branch before that seat reconnects.
5. Step 3's command is `node scripts/setup.mjs` (it also does step 1's rebuild). **Register the SessionEnd hook by
   hand**, as the README shows, or T179-2 never fires on a machine set up the documented way. (This QA PC's
   `~/.claude/settings.json` has no hooks at all, read-only check.)

## Addition 1: greeting size at 1, 10 and 50 sessions per seat

`c9-greeting.mjs`, `evidence/c9.out`. Records built from the migrated rev-132 record plus N sessions per seat
(planner, developer, qa). Each session has its own uuid, a `sessions[]` entry and a handoff of fixed length. **All kept:** constructed directly and
validated by `StateSchema`, so retention prunes nothing and only the render rule is under test. The greeting is the
live `handleStart` text, one process per (record, seat).

| Layout | N/seat | handoffs in record | planner | developer | qa |
|---|---|---|---|---|---|
| one checkout per seat | 1 | 6 | 44,404 | 43,219 | 43,935 |
| | **10** | 33 | **44,500 (+96)** | 43,315 (+96) | 44,031 (+96) |
| | **50** | 153 | **44,503 (+3)** | 43,318 (+3) | 44,034 (+3) |
| three checkouts per seat | 1 | 6 | 44,404 | 43,219 | 43,935 |
| | 10 | 33 | 45,482 | 44,297 | 45,013 |
| | 50 | 153 | 45,485 (+3) | 44,300 (+3) | 45,016 (+3) |

**The line diff says what each delta is** (`c9.out`). N=1→10 adds exactly one line, **"(27 older handoff(s)
superseded within their seat and checkout are in the record, not shown)"**, plus the changed session numbers and the
`state.json` size line. N=10→50 is **+3 characters**: the count (27→147) and digits in the size line. **Every
handoff body line is the same.** With three checkouts per seat, the greeting grows once, to one handoff per checkout
(the ruling: newest per (seat, checkout)), and is then flat from 10 to 50. **Met.**

Two facts beside it:
- **N=0 → N=1 SHRINKS the greeting** by 4,168 to 10,450 characters. The migrated legacy handoff stops being "Your
  handoff" (full text) and becomes a one-line excerpt among the others.
- **The handoff's §8 is wrong on one point:** "The `[legacy]` tags disappear for a seat once it writes its first v3
  handoff." They do not. The legacy entry stays for ever (A12) and keeps rendering as `developer [legacy] (session
  74): …`. Only the "Your handoff" line loses the tag.

## Mutants

Driver `mutants-qa125.mjs`. Each is one anchored substitution that matched **exactly once**, with a non-empty diff and
`tsc --noEmit -p .` exit 0, run locally on the named test files. The dispatch's three are the first, third and fifth.
Commits on `qa/t179-mut-*` from `3c0bfdc`, pushed with `push-qa.mjs` and read back. CI by `workflow_dispatch` on tcm,
**7 runs** (budget 8).

| Mutant | What it breaks | Branch head | Local (named files) | tcm run | tcm red / 1287 |
|---|---|---|---|---|---|
| **`ret-seat`** (dispatch) | retention's (seat, checkout) key widened to seat only | `bc65624` | red 2 | 36226601200 (tcm-1) | **2**: closeout-erasure "retention NEVER drops another checkout's newest entry…"; record-erasure "DOES flag the same drop when retention does not explain it" |
| `render-seat` | the RENDER key (newest per (seat, checkout)) widened to seat only | `aefac69` | red 3 | 36226604213 (tcm-2) | **3**: state-views "next-session.md renders the NEWEST handoff per seat and checkout…"; state-schema "newestHandoffPerInstance keeps one per (seat, checkout)…"; state-render "another CHECKOUT of the same seat is named, not hidden" |
| **`uuid-skip-delete`** (dispatch) | `set_handoff` replaces the same (seat, checkout) entry without the uuid check | `804687f` | red 2 | 36226607194 (tcm-2) | **4**: closeout-erasure ×2 (the same-seat survivor row; the ≤10 retention row); record-erasure KNOWN NEGATIVE and KNOWN POSITIVE |
| `session-by-checkout` | `sessions[]` upsert finds "mine" by checkout, not uuid | `aba2d60` | red 4 | 36226610360 (tcm-1) | **7**: closeout-erasure ×2, state-writer ×2, record-erasure ×3 |
| **`erasure-blind-rev60`** (dispatch) | the scan skips ONE revision: the step out of rev 60 (T-163's known positive) | `f37ef8d` | **red 1** (the real-history row, full checkout) | 36226613268 (tcm-1) | **0: SURVIVES** (1285 passed, 2 skipped). The only row that kills it is the real-history row, which **skips on CI** (shallow checkout). The developer's `erasure-blind` (skipping the newest step) was killed by fixture rows; a scan blind to a single old revision is not. |
| `erasure-blind-merge` | the scan is blind to every merge step | `3702c13` | red 1 | 36226615839 (tcm-1) | **1**: "flags a MERGE resolution that keeps one branch's record and drops the other's (G-027)" |
| `guard-repeat` | the guard's notice is never moved aside (T179-2: exactly once) | `cb1c280` | red 1 | 36226618554 (tcm-2) | **1**: "the warning is recorded for the next greeting and shown ONCE" |

Every red is a test assertion, not infrastructure (each run: 84 files collected, 1287 tests). The extra tcm reds on
`uuid-skip-delete` and `session-by-checkout` are files I did not name locally. **No test kills D1 or D2 on the
candidate** (they are not mutants: they are the candidate's behaviour, shown in check 1).

## The full suite and CI

- **The one full local suite** (the Defender-on control, `TEMP=TMP=C:\Users\AARONM~1\AppData\Local\Temp`, the
  default from `QA_DEFAULT_TEMP`), on the candidate `3c0bfdc` built here, started 2026-09-26T07:23:32Z: **84 of 84
  files, 1287 of 1287 tests passed, 0 skipped**, 157 s, exit 0 (`evidence/fullsuite-3c0bfdc.summary`). Both rows that
  skip on CI ran here: the real-history `record-erasure` row (this is a full checkout) and `paths.test`'s. Nothing
  else ran locally at the time except my `gh` polling; the mutant runs were on tcm.
- **The developer's CI, read per test:** tcm run **36224382093**, `loop/t179-merge` @ `3c0bfdc`, runner `tcm-1`,
  success, **1285 passed, 2 skipped (1287), 84 of 84 files**. `record-erasure` shows 13 tests with 1 skipped (the
  real-history row). Matches the handoff.
- **My CI:** 7 mutant runs on tcm (above), budget 8. No Windows job was dispatched (`windows=false`, `hosted=false`).
  No CI run for the candidate itself: the developer's run above is its record.

## What could not be verified

- **A9's premise:** that Claude Code keeps the MCP server process, and so its in-memory registration, across
  `/clear`. The handler behaviour is shown, but no live `/clear` was run (headless). **A8** is T-003's mechanism, shown
  at the handler level with a fresh module instance standing in for the reconnected process.
- The SessionEnd/SessionStart hooks were run directly with payloads, not fired by a live `/clear`. How a host shows a
  SessionEnd hook's output is not observed.
- Guard runtime on the real seat checkouts (`sia-builder`, `sia-infra`, `sia-forge` are not on this PC).
- Cursor: nothing ran under Cursor. The Cursor copies were compared byte for byte only.
- `gitnexus` and the open-brain MCP of this session were not available (the dispatch says so). No impact analysis
  was run; this seat edited no product code except its own mutants.

## Defects

| Id | Severity | Defect | Where |
|---|---|---|---|
| **D1** | **High (blocking)** | The session number of a session the record has not seen is the caller's, unchecked. Per-session retention trusts it, so one wrong number erases other sessions' handoffs and session records, or the writer's own. It cannot be corrected (G-047), and T163-2 cannot see it. | `state-writer.ts` `applyStateOps` (`effectiveSession = mine ? mine.n : options.session`), `isSuperseded`, `newestSessionNumber`; A6/A6b/A6c, c1b |
| **D2** | Medium-high (root T-003, open) | The writing session is whatever `ob_set_session` was given (unchecked), or what the per-checkout slot holds after a reconnect, or the previous session after `/clear`. Each replaces another session's handoff in place, invisibly to T163-2. | `server.ts` `handleSetSession`, `writeSessionId`; A7, A8, A9 |
| D3 | Medium | `setup.mjs` does not register the SessionEnd hook, so T179-2 and `end.md` line 10's claim depend on the README's manual step, and §7 does not mention it. Pre-existing gap, now load-bearing. | `scripts/setup.mjs` `registerHooks` |
| D4 | Low | `close_task`'s `note` replaces the note, as `update_task`'s does. T-171 names only `update_task`. | `state-writer.ts` `close_task` |
| D5 | Low | Legacy entries can never leave: no op removes one, and a hand edit fails `record-erasure` at v3. Three stale handoffs (qa@75, developer@74, planner@109) render in every greeting for ever. | A12, c9 |
| D6 | Low-medium | §7 gaps: order (reconnect after migrating); the migration leaves the four views stale, so `/sync` fails `summary-version` on the migration commit; other projects; seat worktrees; rebuild after the migration commit; the setup command; the SessionEnd hook. | check 7 |
| D7 | Low | `end.md` overclaims ("nothing it can erase", given D1/D2; "injects only on a deterministic match", with no code reading `MATCH:` yet); it does not say that step 3 needs a registered session; SIA ids in the template copy. | `end.md` lines 8–10, 21, 45–47 |
| D8 | Low, pre-existing | `ob_state` writes `state.json` before the views. If a view write fails, the tool reports `ob_state error` while the revision has already moved. Same order on master. | `state-writer.ts:301–304`; my check-2 run in a dir without `TASKS/` |

## Disagreements

- **With handoff §2** ("A session adds its entry or updates its own; no op can address another's"): true of ops,
  false of the door (D1, D2).
- **With handoff §8** ("The `[legacy]` tags disappear…once it writes its first v3 handoff"): they remain on the legacy
  entries, for ever (Addition 1 section).
- **With the dispatch's framing of T-171 as "the only remaining path":** it is not (check 1).
- **With the merge handoff §6** ("Addition 1 remains not met"): under the re-ruling it is **met**. The +87 is the
  fixed label cost the planner allowed.
- **Classification of my own A10:** the script says BROKEN; I read it as a limit (see check 1).

## Error entries (mine)

1. **Check 2, first run VOID:** I passed `/c/…` paths with `MSYS_NO_PATHCONV=1` set, so node read `C:\c\…`. Rerun
   with `C:/…` paths.
2. **Check 2, second run:** my minimal scratch dir had no `.agents/TASKS/`, so the `ob_state` write failed at the
   views after writing `state.json` (this is how D8 was found). Rerun in a full clone; the migration half was valid.
3. **Extraction:** `git show origin/master:.agents/state.json` under Git Bash was mangled by MSYS path conversion
   ("ambiguous argument 'origin\master;…'"). Redone with `MSYS_NO_PATHCONV=1`; stored as this session's lesson in the
   check-4 scratch DB, not in any real DB.
4. **Check 1, first run:** crashed at A7's reset (my reset deleted the open scratch DB: EBUSY). A1–A6c had completed.
   Rerun complete with the reset fixed.
5. **Check 4, two runs rated 0:** my `ob_recalled` parse looked for `#1` where the output says `[1]`, and a `sed` fix
   did not apply. Superseded by `c4a2.out`/`c4b.out`.
6. **Check 5, first run:** T4–T7 VOID (I deleted a checked-out branch; `docs/loops` was not on master). Rerun.
7. **Check 7, first run VOID:** a `node -e` argv offset in my probe, and a scratch HOME with no `.claude`. Rerun. The
   second fact is also a real (pre-existing) setup crash.
8. **Check 3 recount:** the first comparison mis-parsed my own output (a git stderr line first). Re-parsed; 0 of 28
   commits differ.
9. **Label cost:** my first numeric measurement (178/92/85) is confounded by my setup: the scratch HEAD commits the
   v3 record, so master's provenance line differs. I rely on the line diff (+87), not on those totals.
10. **Check 7's `/sync` summary:** my first reading used a grep that did not match the `summary-version` line, so I
    counted three issues plus a duplicate. Reading the whole output (`evidence/c7-sync-after.out`) found the fourth:
    the migration leaves the views stale (D6).

## Reproduction

Scripts in `docs/loops/qa-scripts-t179/`, outputs in `…/evidence/`. Scratch root `C:/qa-scratch/qa125`, with the
candidate built in `cand/` (`npm ci && npm run build`, stamped `3c0bfdc`) and master in `base/` (`aae0dce`). Copies of
the record: `git show origin/docs/session-100-qa99-dispatch:.agents/state.json > live-rev132.json` and
`origin/master:… > live-master.json` (with `MSYS_NO_PATHCONV=1`).

```
bash c2-migrate.sh C:/qa-scratch/qa125/cand C:/qa-scratch/qa125 C:/qa-scratch/qa125/live-rev132.json C:/qa-scratch/qa125/live-master.json
node c1-attack.mjs  C:/qa-scratch/qa125/cand C:/qa-scratch/qa125      # creates c1-proj (3c0bfdc + migrated rev 132)
node c1b-scan.mjs   C:/qa-scratch/qa125/cand C:/qa-scratch/qa125
git clone <origin> full && git -C full checkout --detach 3c0bfdc && (cd full && node ../cand/open-brain/build/cli.js state erasures .)
node c3-recount.mjs C:/qa-scratch/qa125/full
node c4-end.mjs C:/qa-scratch/qa125/cand <project> <store>   # and c4-end-nosession.mjs
bash c5-guard.sh C:/qa-scratch/qa125/cand C:/qa-scratch/qa125
node probes-r4.mjs <cand|base> <scratch> ; node probes-r3.mjs <cand|base> <scratch>
bash c7-walk.sh C:/qa-scratch/qa125
node c9-greeting.mjs C:/qa-scratch/qa125/cand C:/qa-scratch/qa125 ; bash c9b-label.sh C:/qa-scratch/qa125
node mutants-qa125.mjs C:/qa-scratch/qa125/mut ; node docs/loops/qa-125/push-qa.mjs qa/t179-mut-<name> ; gh workflow run ci.yml --ref qa/t179-mut-<name>
```

## Open for the planner

1. **D1, blocking in my verdict. My recommendation:** for a uuid the record has not seen, refuse a `session` more than
   a few above the record's newest, and refuse one far enough below it that retention would drop the new entry at
   once. Or stop deciding retention by caller-supplied numbers at all. Also a test that one wrong number cannot drop
   another session's entry. If you rule instead that retention may trust the number, the rest of this report stands
   and the verdict becomes ACCEPT with D2–D8.
2. **D2:** decide whether T-163's guarantee may be claimed before T-003 is fixed. My recommendation: state the
   dependency in `end.md` and in the handoff ("keyed by the registered session; T-003 can register the wrong one"),
   and schedule T-003. At the least, `ob_set_session` could refuse a uuid that `sessions[]` already records under a
   different checkout.
3. **§7 additions** (check 7, items 1–5), before Aaron walks it.
4. **Legacy entries (D5):** is a way out wanted? For example, a legacy entry superseded by the first keyed entry of
   its seat, which `record-erasure` would then explain.
5. **T-171's scope:** add `close_task`'s note (D4).
6. **The real-history erasure row skips on CI** (depth-1 checkout), and my `erasure-blind-rev60` mutant **survives
   tcm** because of it (run 36226613268, green). T163-2's known positives are therefore guarded only in full seat
   checkouts. My recommendation: `fetch-depth: 0` in `ci.yml` (T-178's file), or a fixture row that reproduces a
   removal at a revision the walk could skip singly.

QA-125: REPORT COMPLETE
