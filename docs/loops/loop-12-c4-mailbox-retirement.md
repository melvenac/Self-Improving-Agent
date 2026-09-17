# Loop 12 — C4: running the mailbox retirement through the pipeline

**Order held.** The pipeline was frozen at `1db6164`, the retirement was entered with an **empty**
`allowed_referrers`, and its output was recorded **before any manual sweep**. Then the sweep ran.

**The retirement was NOT executed. See "Why this stopped" — it is a scope finding, not a shortfall.**

---

## C4a step 1 — the pipeline, unaided

Entry `R-009 agent mailbox`, pattern `mailbox|atlas-to-forge|forge-to-atlas|\{sender\}-to-\{receiver\}`,
no allowed referrers. **Eleven files:**

```
.agents/AGENT.md
.agents/SYSTEM/RUNBOOK.md
.claude/commands/start.md
CLAUDE.md
open-brain/src/cli-bootstrap.ts
open-brain/src/pipelines/session-start/agent-identity.ts
project-template/.agents/AGENT.md
project-template/.agents/FRAMEWORK.md
project-template/.claude/commands/start.md
project-template/.cursor/commands/start.md
project-template/README.md
```

**All eleven are real referrers. Zero false positives.**

## C4a step 2 — the manual sweep, afterwards

The sweep looked where the pipeline structurally cannot, and searched terms the pattern does not
carry (`inbox`, `outbox`, `channels/sia`, `mailbox_channel`).

**Two real findings the pipeline could not see, and they are one class:**

| file | why the pipeline missed it |
|---|---|
| `~/.claude/commands/start.md` | outside `projectRoot` |
| `~/.cursor/commands/start.md` | outside `projectRoot` |

Plus **the transport itself** — `~/.agents/mailbox/`, 55 files, 1.2 MB — also outside the repo.

**And five findings that were noise.** `RULES.md`, `.claude/commands/end.md`, `harness-audit.md`,
`task.md` and `cli.ts` all matched on `INBOX` — **`.agents/TASKS/INBOX.md`, the task inbox, which has
nothing to do with the mailbox.** Rule 8, in the loop's own manual sweep, caught only by reading each
hit instead of counting it.

## The delta, which is this loop's headline number

| | found | real | false |
|---|---|---|---|
| **pipeline, unaided** | 11 | **11** | **0** |
| **manual sweep, beyond the pipeline** | 7 | **2** | **5** |

**The machine had 100% precision. The human sweep had 29%.**

**And the pipeline's entire blind spot is one nameable structural boundary — the repo root — not a
deficiency of judgement.** That matters more than the counts. A gap you can name is a gap you can
close: the same check pointed at the four command mirrors, as `command-names` already is, would have
reached both missed files. **The reach is bounded by where it was told to look, not by what it can
understand.**

**This is the measured answer to the question C1 could only estimate.** C1 guessed ~58% machine
reach and C2 corrected it downward. C4 says something different and better: *within the scanned
surface, the machine found everything and invented nothing; the residue was entirely outside the
surface.* **Sweeping the two together would have proved none of this** — it would have shown "18
referrers found" and hidden both the perfect precision and the structural gap.

## Why this stopped before executing the retirement

**The mailbox is not SIA's. It serves six projects.**

```
~/.agents/mailbox/channels/
  a2a-hub/      atlas-to-forge, decisions, forge-to-atlas
  coop-mailer/  atlas-queue, atlas-to-forge, decisions, forge-to-atlas
  foundry/      atlas-to-forge, decisions, forge-to-atlas
  nexcrm/       decisions, mason-to-quill, mason-to-scout, quill-to-mason, scout-to-mason
  openlaser/    CHANNEL.md, decisions
  sia/          the channel this loop runs on
```

**Aaron's ruling — "the mailbox was pre-A2A and should be retired" — was given in the context of this
loop's channel.** Executing it as written deletes coordination state for **five other projects**,
including `nexcrm`, which has three named seats (mason, quill, scout) this loop has never looked at,
and `openlaser`, which has a `CHANNEL.md` the SIA channel does not.

**C4c says plainly: if the retirement touches something outside its subject, stop and report — that
is a scope error, not a repair.** This is that case. The ruling is Aaron's and it stands; **what it
covers is a question only he can answer**, and it is one question, not four:

> **Does "retire the mailbox" mean the `sia` channel, or the whole `~/.agents/mailbox/` transport
> including five other projects' channels?**

`R-009` is therefore **not committed to the record.** An unexecuted retirement in the record would
make `/sync` red for everyone until the sweep completes, and the sweep cannot complete until the
scope is ruled. The measurement above is preserved here instead, which is what C4 was for.

## C4b — the record half, which is already done

The hazard C4b names is real and already mitigated for this loop:

- **briefs and boundary reports → `docs/loops/`** — the Loop 12 brief, and C1, C2, C3 and this report,
  are all tracked there. **This loop ran on the new channel from its first message.**
- **decisions → `state.json` `decisions[]`** — 43 recorded, superseding the 285 KB `decisions.md`.
- **ephemeral coordination → A2A.**

**What is NOT yet mitigated is the thing the transport did that A2A does not.**

## The constraint the replacement has to satisfy

**A2A is a transport with no memory, and this loop is evidence.**

Every boundary in Loop 12 — C1, C2, C3 — ended the same way: the reporting seat went idle before the
Planner's reply drained, and the Planner sent a nudge asking whether the ruling had arrived. **Three
boundaries, three nudges, three round-trips neither seat chose.** From outside, **an idle seat and a
working seat are indistinguishable** — which is the read-ordering problem already in this project's
watch-outs, one level up: a read confirms nothing unless it is ordered after the write terminated.

**The mailbox had the opposite failure: durable but unread.** `/recall` proves it — the Component Log
recorded that retirement correctly and it sat unread for five months.

**Neither transport, alone, makes a handoff both delivered and durable.** The mailbox was a file
nobody read; A2A is a message read promptly and then gone — session 61's entire close-out travelled
that way and **exists in no file anywhere.**

**This is not an objection to the retirement. Aaron ruled it.** It is the constraint the replacement
must meet: **the conclusions need a durable home even though the coordination does not.** For this
loop that home was `docs/loops/`, and it worked — every ruling in this channel survives in a tracked
file because both seats wrote them down. **That discipline is currently a habit, not a mechanism**,
and it is the same shape as every other finding in this loop.

## Held for Aaron

1. **The scope question above** — the only blocking one.
2. `enableHeuristicRatings` is gated off for a reason Loop 10 cut (C2).
3. `$declined`: `success_rate`, maturity and apoptosis — behaviour cut, vocabulary live (C3).
4. The Loop 12 PR itself.
