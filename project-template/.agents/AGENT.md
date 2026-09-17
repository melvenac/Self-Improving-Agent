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
