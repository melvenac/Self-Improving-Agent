# Session Manager

> **Trigger**: Every session start and end. This is the universal skill that enforces the framework's session lifecycle.
> **Definition of Done**: Session log created/completed, SUMMARY.md updated, INBOX.md updated, all checklists passed.

## Why This Skill Exists

The session lifecycle (`/start` and `/end`) is the single most important workflow in the framework. Without it, every AI session starts from zero. This skill codifies the rules, edge cases, and best practices so agents follow the protocol consistently.

## Session Start Protocol

### Step-by-Step

1. **Detect meta mode** — If `.agents/META/` exists, read from META/ instead of SYSTEM/ templates
2. **Read current state** — SUMMARY.md tells you where the project is RIGHT NOW
3. **Read task backlog** — INBOX.md and task.md tell you what's prioritized
4. **Read entities** — Only if this session involves data model changes
5. **Check skills** — Read INDEX.md, load any skills relevant to today's work
6. **Create session log** — Copy SESSION_TEMPLATE.md to Session_N.md (increment from last session)
7. **State objective** — Present what you understand and propose, then wait for approval

### Finding the Session Number

```
Look in .agents/SESSIONS/ for the highest-numbered Session_N.md file.
New session = N + 1.
If no sessions exist, start at Session 1.
```

### The Start Presentation

Always present this format before starting work:

```
Session N — [Date]
Project State: [1-2 sentence summary from SUMMARY.md]
Proposed Objective: [what you plan to work on]
Awaiting approval...
```

Do NOT start coding until the user approves.

## Session End Protocol

### Step-by-Step

1. **Complete session log** — Fill in all sections of Session_N.md:
   - What Was Done (list of accomplishments)
   - Files Modified and Files Created
   - Gotchas & Lessons Learned (hard-won knowledge that prevents future mistakes)
   - Decisions Made (reference ADR numbers if logged)

2. **Update SUMMARY.md** — Overwrite the "Current State" section:
   - What's Working NOW (not historically — only current state)
   - What's Broken / Blocked NOW
   - What's Next (top 3-5 priorities)

3. **Update DECISIONS.md** — If any architectural decisions were made:
   - Use the ADR format: Context, Decision, Alternatives, Consequences
   - Number sequentially (ADR-001, ADR-002, etc.)
   - In meta mode, use META-NNN prefix and write to META/DECISIONS.md

4. **Update ENTITIES.md** — If the data model changed:
   - Update the entity definition to match the actual schema
   - Update the ER diagram
   - Add a changelog entry

5. **Update INBOX.md** — Mark completed tasks, add discovered tasks, re-prioritize if needed

6. **Present summary** — Show the user what was accomplished, what's next, and any blockers

### The End Presentation

Always present this format:

```
Session N Complete — [Date]

Accomplished:
- [list]

Files Changed:
- [list]

Gotchas:
- [list, or "None"]

Next Session:
- [recommended focus]

Blockers:
- [list, or "None"]
```

## Rules

### Never Skip /end
Even for short sessions. Even if you only fixed one bug. The next session's quality depends entirely on this session's /end being thorough. A skipped /end means the next session starts from zero.

### SUMMARY.md is Current State, Not History
Overwrite it — don't append. It should reflect NOW. Session logs are the history.

### Keep SUMMARY.md Concise
If SUMMARY.md is growing past ~50 lines, it's too long. Move historical milestones to an "Archive" section or trim. Agents read this every session — don't waste tokens on old news.

### Gotchas Are Gold
The "Gotchas & Lessons Learned" section of session logs is the most valuable part of the framework. These are hard-won lessons that prevent future mistakes. Write them even when you think they're obvious — your future self (or the next AI session) will thank you.

### Meta Mode Awareness
If `.agents/META/` exists:
- Read/write SUMMARY, DECISIONS, INBOX from META/
- Do NOT overwrite SYSTEM/ template files (those are the skeleton)
- Only modify SYSTEM/ files when intentionally improving template content
- Session logs still go to SESSIONS/ (gitignored)

## Edge Cases

### What if the user wants to skip /start?
Let them — but note in the session log that context may be incomplete. Offer to read SUMMARY.md if they change their mind.

### What if there's no previous session?
This is Session 1. Read SUMMARY.md (it should have initial state from setup), read INBOX.md, and proceed normally.

### What if the user disagrees with the proposed objective?
Adjust. The user always decides what to work on. Re-present the updated objective and get approval.

### What if /end reveals the SYSTEM docs are outdated?
Update them as part of /end. This is expected — SUMMARY.md should be rewritten, not just appended to.

### What if work was done between sessions (manual edits, other agents)?
/start should detect this via git status or file timestamps. Note any unexpected changes in the session log and ask the user for context before proceeding.
