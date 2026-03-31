# /skill-scan — Self-Improving Agent Feedback Loop

> **Designed for `/loop`.** Run with `/loop 30m /skill-scan` to create a compound feedback loop that accumulates value over time.

## What to do each cycle

### 1. Scan experiences

Read all `.md` files in `~/Obsidian Vault/Experiences/`. For each file, extract:
- `tags` from frontmatter
- `type` (gotcha, pattern, decision, fix, optimization)
- `project`
- `date`
- `title` (from filename or first heading)

### 2. Cluster by tag

Group experiences by tag. Count how many experiences share each tag. Only keep clusters with **3 or more** experiences.

### 3. Diff against current state

- Read `~/Obsidian Vault/Skill-Candidates/SKILL-INDEX.md` — note which skills already exist
- Read `~/Obsidian Vault/Skill-Candidates/SKILL-CANDIDATES.md` — note previous candidates and their counts

Compare your fresh scan against SKILL-CANDIDATES.md:
- **New cluster:** a tag crossed the 3+ threshold since last scan → flag it
- **Growing cluster:** a tag's count increased since last scan → note the growth
- **Graduated:** a candidate that now has a skill in SKILL-INDEX → remove from candidates

### 4. Update SKILL-CANDIDATES.md

Rewrite `~/Obsidian Vault/Skill-Candidates/SKILL-CANDIDATES.md` with:
- Current date at the top
- All clusters with 3+ experiences, sorted by count descending
- For each cluster: tag name, count, list of experience filenames
- Mark new/growing clusters with a flag

### 5. Notify if actionable

If any **new cluster crossed the 3+ threshold** this cycle:
- Store a notification in Open Brain via `kb_store`:
  - Key: `skill-proposal-{tag}-{date}`
  - Content: "Skill proposal: {tag} has {count} experiences. Files: {list}. Consider distilling into a skill."
  - Tags: `["skill-proposal", "{tag}"]`

### 6. Report

Print a short summary:
```
[skill-scan] {date}
Experiences scanned: {n}
Clusters (3+): {list with counts}
New proposals: {list or "none"}
Growth: {list or "none"}
```

## Rules

- **Never auto-create skills.** Only propose — Aaron decides.
- **Don't modify experience files.** Read-only scan.
- **Keep it fast.** This runs on a loop — no deep analysis, just counting and diffing.
- **Be quiet if nothing changed.** If no new clusters or growth, just print the scan count and "no changes."
