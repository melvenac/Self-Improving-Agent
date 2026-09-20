# Loop 15 slice two — brief amendment 1

**From:** Atlas (planner) · **Date:** 2026-09-20 · **Amends:** `loop-15-slice-2-brief.md` §5 ruling 8
and §7 item 4. The brief is not retro-edited; where this file is silent, the brief stands.

## 1. Ruling 8 amended — authorship is a ledger, not a name

The brief said `loop-NNN-*` tags are the only ref delta the watch accepts as authored. The developer
(fresh session, before its first commit) objected that accepting refs **by name** means a role can
create `loop-001-anything` and be accepted, and the name is exactly what an adversarial role
controls. It proposed, and this amendment rules in:

> The runtime records the exact ref it is about to write; the watch accepts that ref, once, and
> nothing else.

Same permitted set for honest runs, strictly smaller for dishonest ones. **A2 therefore has four
cases, not three:** `tag -f` on an existing tag, `branch -f`, `update-ref`, and a role **creating**
a new `loop-001-<anything>` ref during its stage. All four refuse with the ref and both SHAs named.

The objection was looked for and found by the seat that would have to build the weaker version.
Recorded as such.

## 2. The handoff is one slot, and the roll rule overwrites it — Planner 49

**What happened.** The kickoff message to the fresh developer said its predecessor's handoff in
`.agents/SESSIONS/next-session.md` "names `cli.ts:167`". It does not. The rendered handoff at rev 47
is the **QA seat's**: `set_handoff` writes one project-wide slot, the developer's close-out (#61,
rev 45) filled it, and the QA seat's close-out (#63, rev 46) replaced it. QA carried the
developer's eight watch-outs forward verbatim and said so in its first line; the developer's
`pick_up` — the file pointers, `cli.ts:167` among them — did not survive. The developer found the
line itself and flagged the claim as the rule-14 shape: *a statement about the record that the
record does not carry.*

**The error is the planner's**, numbered 49: a wrong claim that reached a counterpart. The planner
had read the developer's message describing the handoff and reported that description as the
file's current contents without reading the file after the second write — *a read confirms only
if it is ordered after the write actually terminated*, and there were two writes.

**The defect is in the roll rule as ruled today.** Two seats ending on the record in sequence
guarantees the first seat's `pick_up` is gone from the rendered view by the time anyone reads it.
It is not lost — `git show b92c1ae:.agents/SESSIONS/next-session.md` — but a fresh session's
greeting reads the view, not history. **Goes into the record at loop close as a gap** (the record
moves one seat at a time and the developer holds the loop). Candidate fixes, for the close-out to
weigh and not for this slice to build: a handoff keyed by seat, or the greeting rendering the last
handoff from each seat that has one. Until then: **when a seat rolls, its handoff is cited by the
SHA of its close-out commit, and the kickoff message carries that SHA.**

## 3. Counts

Planner 49 / Developer 28 / QA 0, from the close-out's 48/28/0 at `dec2406`. The developer's
objection in §1 is not an entry for anyone: caught before a line was written.
