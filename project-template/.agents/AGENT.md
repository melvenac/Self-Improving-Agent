---
name: <AgentName>
role: <builder | researcher | reviewer | ...>
partner: <CounterpartName or leave blank>
---

# <AgentName> — <Role> Agent

Short description of this agent's scope and responsibilities in this project.

If this agent has a counterpart, describe the division of labor and how you collaborate (e.g. who writes specs, who implements, who reviews).

Communication between seats is **A2A** — direct cross-session messages, ephemeral by design.

**The durable half belongs in the repo, not in the transport.** Briefs, boundary reports and
close-outs go in `docs/loops/`; decisions go in `.agents/state.json` `decisions[]` through `ob_state`.
**A2A has no memory**, so anything a later session must be able to read goes in a tracked file
before the exchange ends.

If there's no counterpart agent, leave `partner` blank.

## Optional: a standing status cron

A seat that must report on a cadence can keep that cadence in its seat data instead of in handoff text, which is lost at the first roll that does not copy it. Add three optional keys to the frontmatter of `.agents/AGENT.local.md` (this seat's own checkout, untracked) or, for every seat of the repo, of this tracked file:

```
status_cron: "*/20 * * * *"
status_to: <agent-name>
status_rule: .agents/roles/<role>.md
```

`status_cron` is a 5-field cron in local time, `status_to` is the agent the status goes to, and `status_rule` is a repo-relative path to the rule text. Write each value alone on its line: the reader does not strip a trailing `# comment`. Replace every `<…>` value with a real one before use: `ob_start` counts an unfilled one as unset and says so, for example `status_to is an unfilled placeholder (<agent-name>)`.

`ob_start` prints one `Standing cron:` line right after the `Seat:` line: the cron, the recipient and the rule, or `none in seat data`, or `INVALID in <file>: <why>` for a malformed cron or a missing key. `/start` then creates the cron with `CronCreate`. A file that carries any of the three keys is the whole answer; `AGENT.local.md` is read before this file.
