# T-236 brief: greeting budget + FOCUS (first two slices)

**Planner:** Atlas, session 159, 2026-10-03. **Authority:** Aaron, "Open T-236" (via clark), on the planner's feedback to
`docs/loops/greeting-review-2026-10-03.md`. Read T-236's `note` in `.agents/state.json` first: scope (a)-(f), the
**opt-in-per-repo amendment** (Relay), and the A2A fixture pin. This brief cuts the work into slices; FOCUS/SEATS (c)
waits for T-203 (#376, in QA) and is NOT in these slices.

**Hard constraint for every slice (A2A shares the renderer):** every new behaviour is **OPT-IN per repo, default OFF**.
With the flag off, output is **byte-identical** to today's renderer on A2A's record, pinned as a fixture copied from
A2A-Hub `.agents/state.json` at master `1c200b41f3f22ba8f62f6dfcf77339e0754ec334` (fetch it read-only from
`https://github.com/melvenac/A2A-Hub`; the file name carries the SHA). Every new record field is optional with a
default; a missing `hub-partner-seats.json` is guarded.

## Slice 1 — sia-infra: role docs by changed sha (closes T-183)

Today `ob_start` appends `.agents/roles/shared.md` and `<role>.md` in full (`pipelines/session-start/role-files.ts`),
which is most of its ~51 KB. With the opt-in on: print a role doc in FULL only when its content sha differs from the sha
THIS SEAT last read; otherwise print one line `<path> @ <sha> (unchanged since your last read: <when>)`. The per-seat
last-read sha is recorded deterministically when the full text is printed (where it lives is your call; justify it; it
must be per seat AND per checkout, and must not be a file two seats share without keys). A first read, an unknown seat,
or an unreadable record prints in FULL (fail toward reading, never toward skipping: the PRD-unread failure).
Rows: unchanged → one line; changed → full; first read → full; unknown seat → full; flag off → byte-identical (both
fixtures). Mutants: compare against the wrong sha; skip on unknown seat; record the sha without printing.

## Slice 2 — sia-forge: handoff caps, owner field, NEXT, and the budget test

- (a) With the opt-in on, `set_handoff` refuses (with a named reason) more than 3 watch-outs, a watch-out over one line
  (define the limit; ~200 chars), and a `pick_up` over ~400 chars. Optional `expires` per watch-out (session number or
  ISO date); the renderer drops an expired one and says how many it dropped. **Existing handoffs are not rewritten**:
  the caps apply to new writes; the renderer applies the expiry only.
- (e) `open_questions` objects gain an optional `owner` (e.g. `"aaron"`); the briefing renders `WAITING ON AARON:` from
  unresolved questions owned by aaron, and omits the section when there are none.
- (d) With the opt-in on, NEXT is omitted unless the objective names task ids; then it lists exactly those.
- (f) A size test: with the opt-in on, SIA's briefing renders within ~4 KB and ~30 lines on a fixture SIA state, with
  per-section caps and `+N more: <pointer>` overflow; with it off, A2A's fixture renders byte-identical to today.
Rows for each item; mutants: cap not enforced; expired watch-out still printed; owner ignored; budget overflow without
the pointer.

## Rules (both seats)

Red on `origin/master` first, a product mutant per row group, no test-only code in product files, one vitest file per
run (the QA PC is RAM-tight for forge), `npm run typecheck:tests` exit 0, `/sync` before each commit, a fresh branch from
`origin/master`, a PR, never merge. Report to atlas-sia by SendMessage with a `TASK:` line: PR, head, red/green, mutants.
Slices 1 and 2 both touch the session-start pipeline: forge owns `briefing.ts` and the state schema/writer; infra owns
`role-files.ts` and its server.ts call site. If you must touch the other's file, say so before you push.
