Starting stub: replace with this project's own rules.

# Rules for every seat

Every seat reads this file first, then its own role file.

- The record (`.agents/state.json`) changes only through `ob_state`. Never edit it or its
  rendered views (INBOX.md, task.md, next-session.md, SUMMARY.md's marked region) by hand.
- Run `/sync` before a commit.
- Role files are tracked, so every clone of this project has them. A seat's name is not:
  it lives in the untracked `.agents/AGENT.local.md` of each checkout.

## This project's rules

Write the rules every seat in this project follows here.

## Hub transport

If this project's seats talk over a hub, name the rooms and the command here.
