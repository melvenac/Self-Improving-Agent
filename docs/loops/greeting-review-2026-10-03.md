# SIA /start greeting review (Clark, 2026-10-03)

Sample: Atlas's fresh `/start`, session e05907a8 (served T-233 build).

**Size:** the Briefing block is **9.5 KB, 1,517 words and 42 lines**. The full `ob_start` return is **51.6 KB** and spills to a file (T-183). Most of that is the role docs appended after the block.

| Section | chars | share |
|---|---|---|
| WATCH OUT (12 items) | 6,625 | **70 %** |
| PICK UP HERE | 1,040 | 11 % |
| OBJECTIVE | 677 | 7 % |
| BROKEN (5 truncated gaps) | ~700 | 7 % |
| Serving build line | 287 | 3 % |
| everything else | ~400 | 4 % |

## 1. Noise to cut

1. **WATCH OUT is a rulebook, not a list of watch-outs.** At least 10 of the 12 items are standing rules: usage bands, batch QA, the merge rule, CI facts, QA-dispatch mechanics, the /sync rulings, reporting to clark, the desktop QA rule, "verify before ruling", and Jev status. They already live in `roles/shared.md` and `planner.md`, which `ob_start` appends in full in the same return. So the agent reads them twice, and they bury the one or two items that are actually new.
   - `/START AUDIT GAPS` alone is ~1,800 chars. Its own retirement condition (T-233 shipped and served) is MET, so retire it now.
   - Two items carry "CARRY VERBATIM AT EVERY ROLL" meta-instructions. Code now does that job.
2. **Three different usage numbers.**
   - The OBJECTIVE says "weekly ~91 %" (written in session 157).
   - PICK UP says "97 % at 22:2xZ".
   - The Usage line says 98 %.
   - Fix: usage appears ONLY on the Usage line, which is read live from slots.json, never in prose.
3. **NEXT lists three backlog P0s (T-022/T-024/T-025) that are not the plan,** then adds "backlog order, not a decision". Lines the reader must ignore are noise.
4. **PICK UP is a session diary**: PR numbers, SHAs, who did what at 23:0xZ. The next session needs the next action, not the history.
5. **BROKEN prints 5 gaps, each truncated with "(267 chars; full text: …)".** 43 open gaps is a backlog statistic. Unless a gap blocks today's work, show the count only.
6. **The serving-build line is 287 chars** of paths and ISO timestamps, and it is a false alarm (the commits are records only; T-234).
7. **FLAGS (model-written) repeats the block:** usage STOP, the serving build, the session number. Allow FLAGS only for things not already in the block.

## 2. Lines to shorten (same meaning)

| Now | Shorter |
|---|---|
| `SERVING BUILD IS STALE: C:\Users\melve\Projects\Self-Improving-Agent at build e833816 (built 2026-10-02T23:09:03.187Z) is 2 commits behind …` (287) | `Build e833816 · current (2 records-only commits behind)`, or when stale: `Build e833816 · STALE: 4 code commits behind → ask Aaron to update` |
| `Usage: STOP (5h 14%, resets 02:50Z) + WEEKLY 98% → everyone parks until the 5-hour reset; wind down: …` (146) | `Usage: STOP (weekly 98 %) · park, push WIP · 5h 14 %` |
| `Session 159 — 2026-10-03 · self-improving-agent v0.45.0 · state rev 299` + `Drift: none` | `#159 · v0.45.0 · rev 299 · drift none` |
| `50 active (14 P0, 21 P1, 10 P2, 5 P3); 62 done. Backlog order, not a decision: …` | `Backlog: 50 open (14 P0) · 62 done` |
| `BROKEN (43 gaps open; newest G-052)` + 5 truncated lines | `Gaps: 43 open (newest G-052)`, plus any gap tagged `blocks:` a current task |

## 3. What would give a clear focus

Put a **FOCUS** block FIRST: the 3-5 things that decide this session, computed from state, not prose.

```
FOCUS  (Usage GREEN · weekly 5 %)
1. sia-forge (Cursor, desktop): T-234 PR A → B · waiting on its hub reply (turn 239)
2. sia-builder (Cursor, QA PC): T-235 Phase 1 r2 · PR #358 open
3. Rule next: T-235 Phase 1 audit when builder posts it
Waiting on Aaron: hub-room.mdc TASK rule PR (approved, needs PR)
```

- **SEATS:** one line per dev seat (name · runtime · machine · task · state), taken from the record and the dashboard. It replaces the narrative "Seats:" sentence buried in PICK UP.
- **WAITING ON AARON:** an explicit list (from open_questions `resolvedBy: null`), so the planner knows what not to start.
- **NEW WATCH-OUTS ONLY:** at most 3 items, each ≤ 1 line, each with an expiry (session or date) after which the renderer drops it. Everything permanent moves to the role docs.
- **A hard budget in `renderBriefing`:** e.g. ≤ 2 KB and ≤ 25 lines, with a per-section cap. Overflow is cut with a pointer ("+9 more: state.json watch_out"), and a test enforces it.
- **Stop appending full role docs to `ob_start`.** Print their sha and a "read if changed since your last session" pointer. That alone fixes T-183 (51 KB → under ~5 KB).

## 4. Proposed shape (≈ 15 lines)

```
## Briefing
Build e833816 · current            Usage GREEN · weekly 5 % · 5h 43 %
#160 · v0.45.0 · rev 305 · drift none · tree clean
FOCUS
1. …  2. …  3. …
WAITING ON AARON: …
SEATS: sia-forge … | sia-builder … | sia-infra (closed)
WATCH OUT (new): … (expires #162)
Gaps 43 (newest G-052) · Backlog 50 open (14 P0) · Latest brief t234-brief.md
## End Briefing
```

**Suggested owner:** Atlas, as an addition to T-234 or as a new T-236 "greeting budget + FOCUS". The pieces: renderer changes, record fields (`watch_out[].expires`, a per-seat `task`), role docs referenced instead of inlined, and a size test. Relay's `/start` shares the renderer, so A2A benefits too.
