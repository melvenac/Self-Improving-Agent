# What /end should do: a skills audit at session close (proposal)

Atlas (SIA planner), session 168, 2026-10-11. This was written for Aaron's question, relayed by clark:
*"what does our end hook do today? I want to set running end, what should it do? … have agents audit
their skills op and session transcript for repetitive tasks they need to add to their skills."*

This is a proposal. Nothing in it is built or ruled.

## 1. What runs at session end today

**The SessionEnd hook** (`open-brain/build/cli-session-end.js`) runs on every session, unattended and
without the model:

- It removes this session's proof (T-003).
- It warns when there is committed loop work and no handoff (T179-2).
- It warns when work happened after `ob_end` with no later record write (T-246).
- It runs the session-end pipeline: vault session summary, auto-feedback, invocation log, shadow
  recall and topic extraction. As of #576 (T-245), each of these stages is claimed once, so a
  doubled hook does not double the rows.

**`/end`** (`.claude/commands/end.md`) runs only when the seat calls it. It has one job: store each
lesson as an `[EXPERIENCE]` with a `MATCH:` key (command, path, error or none), then `ob_end`.
`ob_end` rates the recalled entries and refuses with `RECORD NOT UPDATED` when there is committed
work and no record write. `/end` writes no project state.

**Nothing at session end looks at skills.** That is deliberate, and the history explains why.

## 2. This was tried before and cut, and the reason matters

Until Loop 10 the hook ran a **skill scan** that wrote proposals to `.skill-proposals-pending.json`.
In six months it produced **39 proposals and 0 skills**. The vault's `Skills/` folder was empty.
Loop 10 ruled it CUT (`docs/loops/loop-10-c2-verdicts.md` E8, retirement R-002).

**On 10-11, D-149 worked where the scan failed.** One planner session mined its own transcripts at
Aaron's request and wrote `atlas-ops`: six scripts, each tested live, and used the same day. clark,
maker and relay did the same.

The difference is not the detection. Both found repeated work. **The difference is who acted, and
when:**

| | Skill scan (cut) | D-149 seat skills (working) |
|---|---|---|
| Who detects | a hook, after the session | the seat, in session |
| Output | a proposal into a pending file | a tested script in the seat's own skill |
| Who acts | nobody owned the queue | the same seat, immediately |
| Approval | implied, never given | Aaron's ask covered the seat's own `-ops` skill |

**The design rule follows from this: an audit must end in an edit or in a decision, never in a
queue.** A pending file nobody owns is the defect we already measured once.

## 3. The proposal: a skills-audit step in /end

Add it as step 1b, after lessons and before `ob_end`.

**a. A deterministic extractor, in code** (deterministic first). A new `open-brain skills-audit
--session <uuid>` reads the session's transcript JSONL. It normalises each Bash/PowerShell command
to a shape: SHAs, PR numbers, paths and quoted text become placeholders. It then prints:

- command shapes that occur **3 or more times** in this session, or in 2 or more of the seat's last
  5 sessions
- multi-step **sequences** (the same 2 to 4 shapes in order) that repeat
- for each shape, whether the seat's `-ops` skill already has a script that covers it, by a
  substring match against `scripts/` and `SKILL.md`

The extractor writes nothing. It costs no model tokens. It can be tested against fixture
transcripts.

**b. The seat rules on each hit, in session.** For each hit the seat does exactly one of these:

1. **Add or extend a script** in its own `~/.claude/skills/<seat>-ops/` and test it live once.
   D-149 already covers edits to the seat's own ops skill, so this needs no new approval.
2. **Propose a NEW skill or a protocol change** that is outside its ops skill: a shared skill, a
   `/sync` check or an `ob_state` op. **The skill gate holds: Aaron approves.** The proposal goes to
   clark as one line in the `/end` report, not into a file.
3. **Drop it**, with a reason ("one-off: the roll", "already scripted as pr-wait.sh, I didn't use
   it"). The last of these is itself a lesson for step 2, keyed `MATCH: command:`.

**c. The report line** in `/end` step 4 gains:
`Skills audit: {n} hits; scripted {ids}; proposed {titles}; dropped {n}`

## 4. Where it runs: in-session /end, not a hook spawning `claude -p`

**I recommend running it in-session.** The reasons:

- **The seat that did the work is the one that knows whether a repeat was real.** A headless
  `claude -p` reads a transcript cold. It is exactly the after-the-fact observer the cut scan was.
- **SessionEnd hooks must stay fast and must not fail.** Spawning a model inside one adds minutes,
  a second bill, and a run with no hub key and no reply path.
- **The hook is still useful for the deterministic half.** It can run the extractor and cache its
  output, so `/end` reads the cache instead of re-parsing.

**The gap with this choice:** a seat that never runs `/end` gets no audit, because `/end` is
optional today. Two ways to close it:

- **Cheap:** the hook writes the extractor output to the next greeting ("3 repeated shapes from
  your last session, unaudited") when `/end` did not run.
- **Stronger, later:** a weekly `claude -p` sweep per seat over the cached extractor output, using
  Sonnet. It would only be justified if the in-session version is measured working first.

## 5. Cost

- **Extractor:** zero model tokens, under 1 s per transcript.
- **In-session ruling:** about 1–3k tokens per `/end` with hits, and nothing when there are no hits.
  Writing and testing a script is about 5–15k tokens, but it replaces work the seat was going to
  repeat anyway.
- **Headless alternative:** a full `claude -p` session per seat per day. This is the expensive one,
  and the reason not to start there.

## 6. How it ties to the skills restructure

D-149 made the per-seat `-ops` skill the home for repeated work. This step keeps that home current
instead of rebuilding it with another mining pass. It also routes cross-seat repeats upward:

- **Seat-only repeats** go into the seat's `-ops` skill.
- **Repeats that 2 or more seats hit** become one proposal, because they belong in a shared place:
  - a shared skill
  - the SIA protocol itself, like the three items D-149 already listed: the hub room map (T-196), a
    stale-open-task check in `/sync` (T-256), and records-PR serialisation in `ob_state`.
- **clark** sees every seat's audit line, so it is the natural place to spot a cross-seat repeat.

## 7. How we will know it works

There is a kill criterion this time, because the last version ran for six months on hope.

- **The measure:** scripts added or extended, and proposals Aaron rules on, per 10 `/end` runs.
  These come from the report lines.
- **Cut it** if, after 20 `/end` runs across seats, it has produced no script that a later session
  called. "Called" is checked against `invocations`/transcripts, not asserted.

## 8. Decisions for Aaron

1. **Where it runs:** in-session `/end` step (recommended), or a hook spawning `claude -p`.
2. **Whether D-149's approval covers seat edits to their own `-ops` skill without a per-script ask.**
   I recommend yes; only new skills and protocol changes come to him.
3. **Whether `/end` becomes expected at every seat close.** Today a seat can skip it; the audit only
   pays if it runs.

If he says go: build the extractor first, as a P1 task with a CC brief, tests against fixture
transcripts and the kill criterion as an acceptance criterion. Then a one-section edit to `end.md`
and its Cursor twin, where T-197 parity applies.
