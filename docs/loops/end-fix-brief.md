# END-FIX: /end must leave a record that matches the session (brief)

**By:** Atlas (planner), session 164, 2026-10-07. **Authority:** Aaron in clark's window, 07:5x CDT, relayed by clark
(TOLD): *"SIA has focused on our start hook but not the end hook. Let's work on that before the makerspace
migration."* **Evidence:** `docs/loops/end-hook-evidence-2026-10-07.md` (worth-it session beab87e9; transcript read
first-hand by clark, the itemized list from the worth-it session). **Gates:** the Makerspace import
(`docs/loops/makerspace-import-brief.md`) waits for this loop's ACCEPT.

**Developer:** cursor-builder (Cursor/Grok, because pace is WELL AHEAD). **QA:** one Opus run on the laptop after QA 288.
**Merge:** this changes `open-brain/src`, so the merge is Aaron's word.

## The root cause, read by the planner at `ffc63aca`

**A detector exists, and it is scoped to SIA's own workflow.** `open-brain/src/shared/handoff-guard.ts` (T179-2,
T-212) runs in the SessionEnd hook. It counts a session's work **only on local `loop/*` branches** (line 128) and a
handoff **only as a committed `docs/loops/*-handoff.md`**. worth-it commits and tags on master, so the guard returns
`no-work` and stays silent. Every other project Aaron runs is the same: no `loop/*` branches, no `docs/loops/`.
On top of that, the guard **never runs inside the conversation**. It prints at SessionEnd (often unseen) and leaves a
marker for the next greeting, so the agent that could still fix the record never hears of it.

## Rows (deterministic first; prompt text is defence in depth only)

**E1. One "session's work" measure, for any project.** Replace the `loop/*`-only scan with: commits on **any local
branch**, in the session window, carrying this session's `Claude-Session:` trailer. Add tags pointing at those
commits, and a change to `package.json` `version`. Untrailered commits in the window are still counted apart and
reported, as T-212 does today. Keep the `loop/*` + `docs/loops` handoff rule as one *kind* of handoff, not the only one.

**E2. One "record updated this session" measure, per layout.**
- **New layout** (`.agents/state.json` valid): a handoff keyed by this session's uuid (`set_handoff`), or a record rev
  written with this session in `sessions[]`.
- **Old layout** (no `state.json`, prose files): `.agents/SESSIONS/next-session.md` modified after the session start,
  committed or not. Plus the explicit line `OLD LAYOUT: nothing writes the handoff for you; update next-session.md, or
  import the record (state import)`. That line prints **every time**, not only when there was work.

**E3. `ob_end` gates, in the conversation.** When E1 finds work and E2 finds no update, `ob_end` **refuses**. It writes
nothing and returns, as its first line, `RECORD NOT UPDATED: <n> commits, tags <list>, since <last handoff session/rev
or file mtime>`, plus what to do. The agent can pass `record_ok: "<reason>"` to close anyway. The reason is stored and
printed in the next greeting. **This is the fix that would have caught worth-it.** The agent was still live and
would have read the refusal.

**E4. The SessionEnd hook re-checks, and never blocks.** At the real end it runs E1/E2 on the window **from `ob_end`'s
time** (stored by E3) to now. Work after `/end` with no later record write leaves a marker:
`WORK AFTER /end NOT RECORDED: <n> commits …`. The next session's greeting prints it once, as the missing-handoff
marker does now. Old layout gets the same marker. The hook still exits 0 on every path (a hook that fails at `/clear`
traps the user).

**E5. /end's own recalls do not count as use.** Give `ob_recall` a `purpose` argument (`"dedup"`). Entries recalled
**only** with `purpose: "dedup"` are left out of `ob_recalled` and out of the rated set. Update `end.md` step 2 to pass
it. Test: a session whose only recalls are dedup has 0 rateable entries.

**E6. Two reads, reported, not built unless broken:**
- (a) the foreign `.recalled-entries.json` writer (fc49e982 in beab87e9). Confirm that a foreign file's ids are
  **never rated** for this session, and say where that file is written. If they are rated, fix it.
- (b) whether `ob_end` writes into the `Session_N.md` that `ob_start` created. If nothing does, say so. Do not
  build a writer; the planner rules after reading.

**E7. `end.md` text.** One short section: what E3's refusal means and how `record_ok` works. Remove nothing else.

## Acceptance (QA reproduces each on temp repos and a temp DB, never the real store)

| # | Fixture | Expect |
|---|---|---|
| Q1 | Old layout, 2 trailered commits + a tag on **master**, next-session.md untouched | `ob_end` refuses with `RECORD NOT UPDATED` naming 2 commits and the tag; nothing written |
| Q2 | Q1 then next-session.md edited | `ob_end` closes |
| Q3 | New layout, commits on master, no `set_handoff` for this uuid | refuses; after `set_handoff`, closes |
| Q4 | `record_ok: "x"` | closes; the reason is in the next greeting |
| Q5 | No commits, no tags (a reading session) | closes, no warning; old layout still prints the OLD LAYOUT line |
| Q6 | Commits after `ob_end`, then SessionEnd | marker written; the next greeting prints `WORK AFTER /end` once |
| Q7 | Loop seat: `loop/*` commits + `docs/loops/*-handoff.md` | `ok`, as today (no regression of T179-2 / T-212) |
| Q8 | Untrailered commits in the window | counted apart and reported, never assigned (T-212) |
| Q9 | Dedup-only recalls | 0 rateable entries; a real recall is still rateable |
| Q10 | SessionEnd hook with git missing, no transcript, unreadable state.json | exits 0, says `did not run`, never passes |
| Q11 | Mutants: E1 back to `loop/*`-only; E3 warns instead of refusing; E5 counts dedup | each turns a named test red |
| Q12 | Windows (the laptop) | Q1, Q3 and Q6 pass with CRLF files and Windows paths |

**Out of scope:** Cursor (it writes no session proof, ruling Q2). A Cursor session's `ob_end` attributes nothing today,
so E3 must **say** it could not check, never pass silently. Changing how `/start` renders.
