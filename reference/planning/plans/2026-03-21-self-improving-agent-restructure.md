# Self-Improving-Agent Repo Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Learning-System repo into a publishable, beginner-friendly Self-Improving-Agent repo that includes the AI-First Framework as a nested project template.

**Architecture:** Four-phase restructure: (1) reorganize existing files, (2) import framework template, (3) write all new documentation, (4) rename and archive. Each phase produces a commit.

**Tech Stack:** Markdown documentation, Node.js scripts, Git, GitHub CLI

**Spec:** `docs/superpowers/specs/2026-03-21-self-improving-agent-repo-design.md`

---

## Task 1: Create New Directory Structure

**Files:**
- Create: `getting-started/` (empty, populated in Task 5)
- Create: `how-it-works/` (empty, populated in Task 6)
- Create: `project-template/` (empty, populated in Task 3)
- Create: `reference/` (empty, populated in Task 2)

- [ ] **Step 1: Create the four new top-level directories**

```bash
mkdir -p getting-started how-it-works project-template reference
touch getting-started/.gitkeep how-it-works/.gitkeep project-template/.gitkeep reference/.gitkeep
```

- [ ] **Step 2: Commit scaffold**

```bash
git add getting-started/.gitkeep how-it-works/.gitkeep project-template/.gitkeep reference/.gitkeep
git commit -m "chore: scaffold new directory structure"
```

> Note: Use `.gitkeep` files since Git doesn't track empty directories. These will be removed as real content arrives.

---

## Task 2: Reorganize Existing Files

**Files:**
- Move: `current-protocols.md` → `reference/current-protocols.md`
- Move: `gaps.md` → `reference/gaps.md`
- Move: `setup.md` → `reference/setup-legacy.md` (preserved as reference; new guides replace it)
- Move: `scripts/package.json` → `package.json` (repo root)
- Keep in place: `scripts/`, `commands/`, `SELF-IMPROVING-AGENT.md`
- Archive: `docs/superpowers/` and `superpowers/` — move to `reference/planning/`

- [ ] **Step 1: Move reference docs**

```bash
git mv current-protocols.md reference/current-protocols.md
git mv gaps.md reference/gaps.md
git mv setup.md reference/setup-legacy.md
```

- [ ] **Step 2: Move package.json to repo root**

```bash
git mv scripts/package.json package.json
```

- [ ] **Step 3: Rename existing skill-scan script to match spec naming**

```bash
git mv scripts/skill-scan.mjs scripts/vault-skill-scan.mjs 2>/dev/null; true
```

> Note: If the file doesn't exist, this is a no-op. Task 7 will create/update it.

- [ ] **Step 4: Archive planning artifacts**

```bash
mkdir -p reference/planning
git mv docs/superpowers/specs/ reference/planning/specs/
git mv docs/superpowers/plans/ reference/planning/plans/
# Remove empty docs/ tree if nothing remains
rmdir docs/superpowers docs 2>/dev/null; true
```

> Note: If `superpowers/` exists at root too, move those as well:
```bash
git mv superpowers/ reference/planning/superpowers/ 2>/dev/null; true
```

- [ ] **Step 5: Verify structure and commit**

```bash
git status
git add -A
git commit -m "refactor: reorganize files into new structure"
```

---

## Task 3: Import Framework Template

**Source:** `~/Projects/AI-First-Developement-Framwork/`
**Destination:** `project-template/`

**Files to copy:**
- Copy: `.agents/FRAMEWORK.md` → `project-template/.agents/FRAMEWORK.md`
- Copy: `.agents/SYSTEM/` (all files) → `project-template/.agents/SYSTEM/`
- Copy: `.agents/TASKS/` → `project-template/.agents/TASKS/`
- Copy: `.agents/SESSIONS/SESSION_TEMPLATE.md` → `project-template/.agents/SESSIONS/SESSION_TEMPLATE.md`
- Copy: `.agents/skills/` → `project-template/.agents/skills/`
- Copy: `.agents/workflows/` → `project-template/.agents/workflows/`
- Copy: `.agents/examples/` → `project-template/.agents/examples/`
- Copy: `.claude/commands/` → `project-template/.claude/commands/`
- Copy: `.gemini/commands/` → `project-template/.gemini/commands/`
- Copy: `.clinerules/` → `project-template/.clinerules/`
- Skip: `.agents/META/` (framework development only, not part of template)
- Skip: `.agents/SESSIONS/Session_1.md`, `Session_2.md` (session history, not template)
- Skip: `CLAUDE.md` (project-specific, user writes their own)
- Skip: `README.md` (we write a new template README)
- Create: `project-template/README.md`

- [ ] **Step 1: Copy .agents/ structure (excluding META/ and session logs)**

```bash
# Create directory structure
mkdir -p project-template/.agents/{SYSTEM,TASKS,SESSIONS,skills,workflows,examples}

# Copy FRAMEWORK.md
cp ~/Projects/AI-First-Developement-Framwork/.agents/FRAMEWORK.md project-template/.agents/

# Copy SYSTEM docs
cp ~/Projects/AI-First-Developement-Framwork/.agents/SYSTEM/*.md project-template/.agents/SYSTEM/

# Copy TASKS
cp ~/Projects/AI-First-Developement-Framwork/.agents/TASKS/*.md project-template/.agents/TASKS/

# Copy session template only
cp ~/Projects/AI-First-Developement-Framwork/.agents/SESSIONS/SESSION_TEMPLATE.md project-template/.agents/SESSIONS/

# Copy skills (preserve subdirectories)
cp -r ~/Projects/AI-First-Developement-Framwork/.agents/skills/* project-template/.agents/skills/

# Copy workflows
cp ~/Projects/AI-First-Developement-Framwork/.agents/workflows/*.md project-template/.agents/workflows/

# Copy examples
cp -r ~/Projects/AI-First-Developement-Framwork/.agents/examples/* project-template/.agents/examples/
```

- [ ] **Step 2: Copy agent command directories**

```bash
# Claude Code commands
mkdir -p project-template/.claude/commands
cp ~/Projects/AI-First-Developement-Framwork/.claude/commands/*.md project-template/.claude/commands/

# Gemini commands
mkdir -p project-template/.gemini/commands
cp ~/Projects/AI-First-Developement-Framwork/.gemini/commands/*.md project-template/.gemini/commands/

# Cline rules
mkdir -p project-template/.clinerules
cp ~/Projects/AI-First-Developement-Framwork/.clinerules/*.md project-template/.clinerules/
```

- [ ] **Step 3: Verify no personal config leaked into template**

Check copied files for references to personal paths, Obsidian, Open Brain, or user-specific config:

```bash
grep -rl "Obsidian\|Open Brain\|melve\|vault-writer\|kb_recall\|kb_store" project-template/ || echo "Clean — no personal references found"
```

If any matches found, edit those files to remove personal references.

- [ ] **Step 4: Write project-template/README.md**

Create `project-template/README.md` with:
- What this template is (project-level AI context scaffold)
- How to use: copy contents into a new project root
- First steps: fill in PRD.md, ENTITIES.md, RULES.md
- How it connects to the learning system (sessions feed experiences to vault)
- Supported agents: Claude Code, Gemini, Cline, Cursor

- [ ] **Step 5: Commit template import**

```bash
git add project-template/
git commit -m "feat: import AI-First Framework as project template"
```

---

## Task 4: Write Root README.md

**Files:**
- Modify: `README.md` (complete rewrite)

- [ ] **Step 1: Read current README.md for any content worth preserving**

```bash
# Review current content before overwriting
```

- [ ] **Step 2: Write new README.md**

Structure:
1. **Title:** Self-Improving Agent
2. **Tagline:** *A full-stack AI development environment that learns across sessions*
3. **What is this?** — 3-4 sentences: install once, get persistent AI memory across all projects. Each session makes the agent smarter. Includes a project template for structuring new codebases.
4. **How it works** — text diagram of the three-layer feedback loop: Retrieval → Development → Accumulation
5. **What you'll set up** — bullet list of required tools (Claude Code CLI, VS Code, Node.js, Git, Obsidian, Open Brain MCP, Smart Connections MCP)
6. **Getting Started** — link to `getting-started/01-prerequisites.md`
7. **Architecture** — link to `how-it-works/overview.md`
8. **Project Template** — brief description + link to `project-template/README.md`
9. **License**

- [ ] **Step 3: Commit README**

```bash
git add README.md
git commit -m "docs: rewrite README as landing page for Self-Improving-Agent"
```

---

## Task 5: Write Getting Started Guides

**Files:**
- Create: `getting-started/01-prerequisites.md`
- Create: `getting-started/02-clone-and-configure.md`
- Create: `getting-started/03-mcp-servers.md`
- Create: `getting-started/04-hooks-and-commands.md`
- Create: `getting-started/05-verify-installation.md`

Each doc starts with **"What you'll do"** one-liner, ends with **"Next step →"** link.

**Reference:** `reference/setup-legacy.md` contains the original setup steps. Use as source material but rewrite for beginners who may have never used a CLI.

- [ ] **Step 1: Write 01-prerequisites.md**

Content:
- One sentence per tool explaining why it's needed
- Install Claude Code CLI (link to official docs, verify with `claude --version`)
- Install VS Code (note: any IDE works, VS Code used in examples)
- Install Node.js LTS (verify with `node --version`)
- Install Git (verify with `git --version`)
- Create GitHub account if needed
- Install Obsidian (link + brief "what is it" paragraph)
- Every install step includes: what to do, how to verify it worked, what to do if it didn't

- [ ] **Step 2: Write 02-clone-and-configure.md**

Content:
- How to open a terminal (yes, that basic)
- Clone the repo (`git clone` with exact command)
- Directory structure walkthrough — what each folder is for (one sentence each)
- Create Obsidian Vault directory: `~/Obsidian Vault/` with subdirs: `Sessions/`, `Experiences/`, `Topics/`, `Guidelines/`
- Open the vault in Obsidian for the first time (step by step with what they should see)

- [ ] **Step 3: Write 03-mcp-servers.md**

Content:
- What MCP servers are (one beginner paragraph: "MCP servers are plugins that give Claude Code extra abilities")
- Install Open Brain MCP (step by step)
- Install Smart Connections MCP (step by step)
- Configure Smart Connections to index this repo directory
- Verify both are working in Claude Code (exact commands + expected output)

**Reference:** `reference/setup-legacy.md` steps 1, 4 cover MCP server setup

- [ ] **Step 4: Write 04-hooks-and-commands.md**

Content:
- What hooks are ("code that runs automatically after every session")
- What slash commands are ("shortcuts you type to trigger workflows")
- Configure SessionEnd hooks in Claude Code `settings.json` (show exact JSON)
- Install global slash commands: copy `commands/` files to `~/.claude/commands/`
- Verify hooks are registered (how to check in Claude Code)

**Reference:** `reference/setup-legacy.md` steps 5-6 cover hook/command setup

- [ ] **Step 5: Write 05-verify-installation.md**

Content:
- Start Claude Code in any project directory
- Run `/recall` — should return "no relevant experiences" (that's correct, vault is empty)
- Do a small task (suggest something simple)
- End the session
- Check vault: a session log should appear in `~/Obsidian Vault/Sessions/`
- Check vault: an experience should appear in `~/Obsidian Vault/Experiences/`
- "Congratulations!" + links to how-it-works and project-template

- [ ] **Step 6: Remove .gitkeep and commit**

```bash
rm getting-started/.gitkeep 2>/dev/null; true
git add getting-started/
git commit -m "docs: add beginner-friendly getting started guides"
```

---

## Task 6: Write How It Works Docs

**Files:**
- Create: `how-it-works/overview.md`
- Create: `how-it-works/memory-layer.md`
- Create: `how-it-works/accumulation.md`
- Create: `how-it-works/retrieval.md`
- Create: `how-it-works/skill-distillation.md`

**Reference:** `reference/current-protocols.md` and `SELF-IMPROVING-AGENT.md` contain the source material. These docs restructure that content into focused, standalone pages.

- [ ] **Step 1: Write overview.md**

Content:
- Core idea: three-layer feedback loop
- Text diagram: Memory → Retrieval → Development → Accumulation → Memory
- Three tiers explained: Global (vault), Domain (tagged experiences), Project (.agents/)
- Links to the four detail docs

- [ ] **Step 2: Write memory-layer.md**

Content:
- What the Obsidian Vault stores: sessions, experiences, skills
- Directory structure and YAML frontmatter format
- Experience structure: TRIGGER / ACTION / CONTEXT / OUTCOME (with example)
- How sessions link to experiences via WikiLinks
- How topics aggregate related experiences

- [ ] **Step 3: Write accumulation.md**

Content:
- What happens at session end (automatic via SessionEnd hooks)
- vault-writer.mjs: creates session log, extracts experiences, updates topic links
- vault-skill-scan.mjs: detects experience clusters, proposes skills at 3+
- Guardrails: dedup, skill gate (never auto-creates), context cap (3 exp + 2 skills)

- [ ] **Step 4: Write retrieval.md**

Content:
- What happens at session start via /recall
- How Open Brain surfaces relevant experiences by project + domain tags
- How Smart Connections enables semantic search
- The 3 experiences + 2 skills cap per session
- How retrieval-count and last-used frontmatter enable relevance scoring

- [ ] **Step 5: Write skill-distillation.md**

Content:
- How experiences cluster into skill candidates over time
- SKILL-CANDIDATES.md and SKILL-INDEX.md explained
- Proposal flow: detect cluster → propose to user → user approves → create skill
- Skill template format (TRIGGER / CONTEXT / ACTION with examples)
- Why skills are never auto-created (quality gate)

- [ ] **Step 6: Remove .gitkeep and commit**

```bash
rm how-it-works/.gitkeep 2>/dev/null; true
git add how-it-works/
git commit -m "docs: add architecture documentation (how-it-works)"
```

---

## Task 7: Write Missing Scripts and Commands

**Files:**
- Create: `scripts/vault-writer.mjs` (SessionEnd hook — extracts sessions + experiences to vault)
- Modify: `scripts/vault-skill-scan.mjs` (cluster detection — renamed in Task 2, update/rewrite content)
- Create: `commands/start.md` (global /start command — doesn't exist in this repo)
- Create: `reference/advanced-config.md`

- [ ] **Step 1: Examine existing hook configuration**

Check how vault-writer is currently configured in Aaron's Claude Code settings to understand what it does today:

```bash
cat ~/.claude/settings.json | grep -A 20 "SessionEnd"
```

- [ ] **Step 2: Write scripts/vault-writer.mjs**

This is the core SessionEnd hook. It should:
1. Read the session transcript from Open Brain (via `better-sqlite3`)
2. Create a session log in `~/Obsidian Vault/Sessions/` with YAML frontmatter
3. Extract experiences (decisions, gotchas) into individual files in `~/Obsidian Vault/Experiences/`
4. Update topic notes with new backlinks in `~/Obsidian Vault/Topics/`

**Reference:** `reference/current-protocols.md` specifies the exact format and behavior.

- [ ] **Step 3: Write scripts/vault-skill-scan.mjs**

Cluster detection script. Should:
1. Read all experiences from `~/Obsidian Vault/Experiences/`
2. Group by domain tags
3. Identify clusters of 3+ similar experiences
4. Update `~/Obsidian Vault/Guidelines/SKILL-CANDIDATES.md`
5. Log results

- [ ] **Step 4: Write commands/start.md**

The `/start` slash command for global use. Should:
1. Greet user by name
2. Run /recall to surface relevant knowledge
3. Check for .agents/ directory — if present, read SUMMARY.md + INBOX.md
4. Present session summary and proposed objective
5. Await approval

**Reference:** The project-template version exists at `project-template/.claude/commands/start.md` — the global version wraps it with vault retrieval.

- [ ] **Step 5: Write reference/advanced-config.md**

Content:
- How to customize SessionEnd hooks
- Tuning retrieval (adjusting context cap, domain tags)
- Adding new slash commands
- Configuring Smart Connections indexing paths
- Troubleshooting common issues

- [ ] **Step 6: Commit scripts and commands**

```bash
git add scripts/ commands/start.md reference/advanced-config.md
git commit -m "feat: add vault-writer hook, skill-scan script, and /start command"
```

---

## Task 8: Clean Up and Final Commit

**Files:**
- Modify: `SELF-IMPROVING-AGENT.md` (update to reference new doc locations)
- Remove: `.gitkeep` files from any directories that now have content
- Modify: `CHANGELOG.md` (add entry for this restructure)

- [ ] **Step 1: Update SELF-IMPROVING-AGENT.md**

Update internal links to point to new locations (`how-it-works/`, `reference/`, etc.). This file stays at root as the agent quick-reference.

- [ ] **Step 2: Decide on project-level CLAUDE.md**

Decide whether `Self-Improving-Agent/` gets its own `CLAUDE.md` or relies on the global `~/.claude/CLAUDE.md`. If creating one, it should point agents to `SELF-IMPROVING-AGENT.md` and explain the repo structure. Document the decision either way.

- [ ] **Step 3: Update CHANGELOG.md**

Read the existing `CHANGELOG.md` first to determine the current version and follow existing format. Add entry (bump version accordingly):
```markdown
## [vX.Y.Z] - 2026-03-21

### Changed
- Restructured repo as Self-Improving-Agent (consolidated with AI-First Framework)
- Reorganized docs into getting-started/, how-it-works/, reference/
- Moved AI-First Framework into project-template/

### Added
- Beginner-friendly getting started guides (5 docs)
- Architecture documentation (5 docs)
- vault-writer.mjs SessionEnd hook
- vault-skill-scan.mjs cluster detection script
- /start global slash command
- project-template/ with complete .agents/ scaffold
- reference/advanced-config.md
```

- [ ] **Step 4: Final review and commit**

```bash
git status
git add -A
git commit -m "chore: final cleanup — update links, changelog, remove scaffolding"
```

---

## Task 9: Rename Repo and Archive Old Framework

**Files:**
- GitHub: rename `Learning-System` → `Self-Improving-Agent`
- GitHub: archive `AI-First-Developement-Framwork`
- Modify: `~/.claude/CLAUDE.md` (update paths and domain tags)

- [ ] **Step 1: Rename the GitHub repo**

```bash
gh repo rename Self-Improving-Agent
```

- [ ] **Step 2: Update local remote URL**

```bash
git remote set-url origin https://github.com/melvenac/Self-Improving-Agent.git
```

- [ ] **Step 3: Archive the old framework repo**

First, update its README with a redirect:
```bash
cd ~/Projects/AI-First-Developement-Framwork
# Edit README.md to add archive notice pointing to Self-Improving-Agent
git add README.md
git commit -m "docs: add archive notice — moved to Self-Improving-Agent repo"
git push
gh repo archive melvenac/AI-First-Developement-Framwork --yes
cd ~/Projects/Learning-System
```

- [ ] **Step 4: Update ~/.claude/CLAUDE.md**

Update the Key Paths table:
- Change `Learning System Docs` path to `~/Projects/Self-Improving-Agent/`
- Remove or update `AI-First Framework` path (archived)

Update the Project Domain Tags table accordingly.

- [ ] **Step 5: Push everything and tag**

```bash
git push origin master
git tag -a v3.0.0 -m "Self-Improving-Agent: consolidated repo with beginner-friendly docs"
git push origin v3.0.0
```

- [ ] **Step 6: Verify**

- Visit the GitHub repo page — confirm name is `Self-Improving-Agent`
- Confirm old framework repo shows as archived
- Clone fresh in a temp directory and follow the getting-started guide to smoke test

---

## Task Summary

| Task | Description | Depends On |
|---|---|---|
| 1 | Create directory structure | — |
| 2 | Reorganize existing files | 1 |
| 3 | Import framework template | 1 |
| 4 | Write root README | 1 |
| 5 | Write getting-started guides | 2 (needs reference/setup-legacy.md) |
| 6 | Write how-it-works docs | 2 (needs reference/current-protocols.md) |
| 7 | Write missing scripts + commands | 2 |
| 8 | Clean up and final commit | 3, 4, 5, 6, 7 |
| 9 | Rename repo and archive | 8 |

Tasks 3, 4, 5, 6, 7 can run in parallel after Task 2 completes.
