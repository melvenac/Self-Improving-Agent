# /checkpoint — Pre-Compact Capture (Cursor + SIA)

> Capture this phase before context compaction. Flow: `/start` → work → `/checkpoint` → compact → … → `/end`

## Step 0: Phase number

1. `ob_recall(query: "[CHECKPOINT]", project: {cwd}, sessions: 1, limit: 10)`
2. Count checkpoints from **this session**
3. Phase number = count + 1

## Step 1: Store checkpoint

Write one checkpoint via `ob_store_chunk`:

```
[CHECKPOINT] Phase {N} — {one-line description}

## What was accomplished
- ...

## Key context carrying forward
- ...

## Files touched
- ...
```

```
ob_store_chunk({
  content: <above>,
  key: "{project-slug}-phase-{N}",
  category: "checkpoint",
  tags: ["checkpoint", "phase-{N}", "{project-slug}", ...],
  project_dir: <cwd>,
  phase: {N}
})
```

## Step 2: Confirm

```
Checkpoint {N} saved — {description}
Vault: ~/Obsidian Vault v2/Checkpoints/...
Tags: ...

Compact the conversation when ready (Cursor: start a new chat or use summarize if available).
```

## Judgment

- One checkpoint per phase, not five
- Skip if phase was trivial Q&A: "Nothing worth checkpointing."
