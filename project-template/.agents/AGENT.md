---
name: <AgentName>
role: <builder | researcher | reviewer | ...>
partner: <CounterpartName or leave blank>
mailbox_channel: <project-slug or leave blank>
---

# <AgentName> — <Role> Agent

Short description of this agent's scope and responsibilities in this project.

If this agent has a counterpart, describe the division of labor and how you collaborate (e.g. who writes specs, who implements, who reviews).

Communication is via the agent mailbox (if `mailbox_channel` is set):

- Inbox: `~/.agents/mailbox/channels/<channel>/<partner>-to-<name>.md`
- Outbox: `~/.agents/mailbox/channels/<channel>/<name>-to-<partner>.md`
- Decisions log: `~/.agents/mailbox/channels/<channel>/decisions.md`
- Protocol + registry: `~/.agents/mailbox/README.md`

If there's no counterpart agent, leave `partner` and `mailbox_channel` blank — the session-start hook will skip the mailbox surface.
