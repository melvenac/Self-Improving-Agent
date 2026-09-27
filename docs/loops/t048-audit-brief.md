# T-048: audit `open-brain/src` for filters that drop rows silently. Brief for a FRESH developer session (Grok, record 139)

**By:** Atlas (planner), record session 109 · 2026-09-26. **To:** **Grok in Cursor**, record **139**, a **fresh chat**
(D-035) in `~/Worktrees/sia-forge`. Transport: the hub room `k57frxw0ptb8tadmqdwy0khhks8ey006`, and the record is in
tracked files. **Authority:** Aaron ("sia-forge is open in cursor, anything we can give to it?").

## What and why

**The invariant (T-048):** any filter that drops rows must emit the dropped count, so absent and zero never collapse
into one value. Four instances of the class are on record:
- harmful-unrepresentable (v0.15.0);
- skillRows (v0.17.0);
- Prime's frontmatter-less SKILL.md;
- the v0.15.1 resolver that was unreachable and uncountable.

One pass over the rest is cheaper than finding the fifth in production.

**This is an AUDIT, not a fix.** It is read and report only, with no product change. Each finding becomes a task.

## Scope

- **In:** every loop and filter in `open-brain/src/`: `continue` inside a loop that skips an item, `.filter(...)`,
  `.flatMap(...)` returning `[]`, early `return` from a per-item callback, a `try { … } catch { }` that swallows a
  per-item error, and `?.` or `??` defaults that turn "missing" into "empty".
- **Out:** `open-brain/src/harness/` **only where A11 (`ef2a8a7`, in QA) changes it**. Audit master's harness, and
  mark any finding in an A11-changed file as such. Tests, scripts and `project-template/` are out.
- **Base:** `origin/master` (`7640b93` or later).

## What to report, per site

A table of: file:line, the kind of drop, what is dropped, and **whether the count is emitted or visible anywhere**.
Classify each:
- **SAFE:** the drop is counted, reported or asserted.
- **INTENDED:** a filter whose dropped set is meaningless to count, and say why. Be sparing; the burden is on
  "intended".
- **SILENT:** the class. A caller cannot tell "none existed" from "some were dropped".

For each SILENT one, say what reaches the user or the record when it happens. Rank them by that consequence.

## How

- Read only. Search with `rg` or grep, and read each site in its function. Do not run the full suite. No code change.
- Label each finding READ (you read the code path) or INFERRED (from the name or type alone). Inferred findings rank
  last.
- **Deliverable:** `docs/loops/research/t048-silent-drops.md` on branch `research/t048-audit` from `origin/master`.
  Push it and read it back. It is docs only, so the planner merges it under D-032.
- Then post in the hub room: the branch, the file, the counts per class, and the top five SILENT. **The file is pushed
  BEFORE you post.**

**First message to atlas in the room:** "T-048 started", with your model.
