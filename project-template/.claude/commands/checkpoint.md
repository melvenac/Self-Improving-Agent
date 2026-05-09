# /checkpoint — Session Checkpoint (Pre-Compact Knowledge Capture)

> **One command before compacting.** Captures the current phase of work as a vault markdown file + searchable DB index, then prompts you to compact.
>
> **Flow:** `/start` → work → `/checkpoint` → `/compact` → work → `/checkpoint` → `/compact` → `/end`

## Step 0: Determine Phase Number

Check if previous checkpoints were stored this session:

1. Run `ob_recall` with query: `"[CHECKPOINT]"` scoped to the current project, limited to the last 1 session (`sessions: 1`)
2. Count how many `[CHECKPOINT]` entries were returned from the current session
3. **Phase number** = count + 1 (first checkpoint = phase 1)

---

## Step 1: Capture Phase Context

Write **one** checkpoint via `ob_store_chunk` that captures this phase of work. This is agent-driven — use your full conversation context to write a high-signal summary. The checkpoint is written as a vault markdown file (source of truth) with a DB index entry (for search).

**Format the content as:**

```
[CHECKPOINT] Phase {N} — {one-line description of what this phase accomplished}

## What was accomplished
{2-4 bullet points — decisions made, code written, problems solved}

## Key context carrying forward
{What the next phase of work needs to know — active problems, next steps, open questions, partial work in progress}

## Files touched
{List of files created or modified this phase}
```

**ob_store_chunk parameters:**
```
ob_store_chunk({
  content: <formatted checkpoint above>,
  key: "{project-slug}-phase-{N}",
  category: "checkpoint",
  tags: ["checkpoint", "phase-{N}", "{project-slug}", ...domain tags],
  project_dir: <current working directory>,
  phase: {N}
})
```

The vault file is written to `~/Obsidian Vault v2/Checkpoints/YYYY-MM-DD-{project}-{key}-phase-{N}.md` with full frontmatter (type, project, date, session, phase, tags).

**What to include:**
- Decisions and their reasoning (the "why" that compaction loses)
- Error resolutions — what failed and how it was fixed
- Partial work state — what's half-done and needs to continue
- User preferences or corrections expressed this phase

**What to exclude:**
- Raw file contents (searchable via the codebase itself)
- Routine tool output
- Anything already stored via `/end` from a prior session

---

## Step 2: Prompt for Compaction

After storing the checkpoint, output:

```
Checkpoint {N} saved — {one-line description}
Vault: ~/Obsidian Vault v2/Checkpoints/{filename}
Tags: {tags used}

Run `/compact` to compress the conversation.
```

---

## Judgment Calls

- **Keep it lean.** One checkpoint per phase, not five. The goal is searchable context, not a transcript.
- **Carrying forward > accomplished.** The most valuable part is what compaction would lose — partial state, open threads, reasoning that isn't in the code.
- **Don't duplicate /end.** Checkpoints capture phase-level detail. `/end` captures session-level experiences and summaries. They're complementary.
- **Skip if nothing happened.** If the phase was just Q&A with no meaningful work, say "Nothing worth checkpointing — run `/compact` when ready."
