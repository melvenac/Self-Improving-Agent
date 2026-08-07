# /end — Session End (Cursor + SIA)

> **Cursor Composer:** Execute all steps **inline**. Use **open-brain MCP** (`ob_sync`, `ob_store`, `ob_feedback`, `ob_end` if available). Requires `open-brain` in `~/.cursor/mcp.json`.
>
> **Never skip /end** — next session quality depends on it.

## Step 0: Detect Context

- **`.agents/` exists** → **Part A** (project close-out)
- **No `.agents/`** → **Part B** (knowledge capture only)

---

## Part A: Project Close-Out

### Meta mode

If `.agents/META/` exists, write tracking to `META/` — not `SYSTEM/` templates.

### A1. Update session log

Update current `.agents/SESSIONS/Session_*.md` or today's session file:

- What Was Done · Files Modified · Files Created
- Gotchas & Lessons · Decisions Made
- Status: **Completed**

### A2. Update SUMMARY.md

Target: `.agents/SYSTEM/SUMMARY.md` (or `META/SUMMARY.md`)

**Update the CURRENT STATE block** (top of file):

1. Status line — version + one-line state
2. Active blockers / what's working / what's next — match INBOX top items
3. Do not bloat the milestones archive unless a major release landed

### A3. DECISIONS.md (if applicable)

Add entries for significant decisions this session.

### A4. ENTITIES.md (if schema changed)

Update schema doc; run `npm run validate:entities` if the project has it.

### A5. INBOX.md

Mark completed `[x]` · add new tasks · re-prioritize if needed.

### A6. task.md

Append phase completions to the ledger; do not use as live queue.

### A7. next-session.md

**Read first**, then overwrite:

- **Pick up here** · **Watch out for** · **Open questions**

### A8. Validation (if configured)

```bash
npm run validate:entities      # if schema changed
npm run validate:session:post  # if script exists
```

### A9. Doc drift

1. Call **`ob_sync`** MCP tool with `project_root: {cwd}`
2. If features/commands changed: check `README.md`, `.agents/SYSTEM/PRD.md`, `CLAUDE.md`, `AGENTS.md`
3. Fix factual staleness only — report "Doc audit: updated N files" or "all current"

### A10–A14. Knowledge capture

**A10 Research** — `ob_store` for external research (GitHub, docs, NotebookLM). **Do not write the vault note yourself** — `ob_store` is vault-first and writes `Experiences/{project}/{key}.md` itself; a second Write is a duplicate at a path nothing reads.

**A11** — Review for non-obvious lessons hooks would miss

**A12 Experiences** — `ob_recall` dedup first, then `ob_store` with `[EXPERIENCE]` format. Again no manual vault write: `ob_store` nests under the project, and a flat `Experiences/{key}.md` beside it is read by `skill-scan` as a separate experience.

**A13 Summary** — Write `~/Obsidian Vault v2/Summaries/YYYY-MM-DD-{project-slug}.md` (What / Why / How / Lessons). The SessionEnd hook writes the same path but yields to an existing file, so this enriched version wins.

**A14 Feedback** — Read `.recalled-entries.json`; `ob_feedback(entry_id, rating, referenced)` for each recalled entry (helpful / harmful / neutral)

Call **`ob_end`** if available to run session-end pipeline (vault summary, auto-feedback, skill-scan).

---

## Part B: Knowledge Capture (no `.agents/`)

Run B1–B5 mirroring A10–A14 (research, lessons, experiences, summary, feedback).

---

## Present summary

**Project session:**

```
Session N Complete — [Date]

Accomplished:
- ...

Files Changed:
- ...

Next Session:
- (from next-session.md)

Captured:
- (supplemental experiences, or "ob_end / hooks handled it")

Blockers:
- None | ...
```

**Lightweight:** Report captured experiences + "Session summary stored."

---

## Judgment calls

- Quick Q&A with nothing to capture is fine — still update project docs if `.agents/` exists.
- If Aaron says "don't store that", respect immediately.
- Prefer fewer, high-quality experiences over noise.
