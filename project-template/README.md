# Project Template: AI Context Scaffold

This is a **project-level AI context scaffold** designed to give AI coding agents deep understanding of your codebase from the first prompt. Drop it into any new project to provide structured context that makes AI assistants dramatically more effective.

## Supported Agents

| Agent | Config Location |
|---|---|
| **Claude Code** | `.claude/commands/` |
| **Gemini** | `.gemini/commands/` |
| **Cline** | `.clinerules/` |
| **Cursor** | Reads `.agents/` structure directly |

## How to Use

1. **Copy** the contents of this `project-template/` directory into your new project's root:
   ```bash
   cp -r project-template/{.agents,.claude,.gemini,.clinerules} /path/to/your-project/
   ```

2. **Fill in your project context** (the files in `.agents/SYSTEM/`):
   - `PRD.md` — What the project does, who it's for, key requirements
   - `ENTITIES.md` — Core data models, schemas, key abstractions
   - `RULES.md` — Tech stack conventions, coding standards, architectural decisions
   - `DECISIONS.md` — Log of significant technical decisions and their rationale
   - `SECURITY.md` — Auth patterns, secrets handling, access control
   - `TESTING.md` — Test strategy, frameworks, coverage expectations
   - `RUNBOOK.md` — How to build, deploy, and operate the project
   - `SUMMARY.md` — High-level overview the agent reads first

3. **Start a session** using the `/start` command in your AI agent. This loads context and creates a session log.

4. **End a session** using the `/end` command. This captures what was done, decisions made, and lessons learned.

## Directory Structure

```
.agents/
  FRAMEWORK.md        # How agents should use this structure
  SYSTEM/             # Project context files (you fill these in)
  TASKS/              # Task tracking for the agent
  SESSIONS/           # Session logs (auto-generated)
  skills/             # Reusable agent skills
  workflows/          # Multi-step workflow definitions
  examples/           # Example configs and patterns
.claude/commands/     # Claude Code slash commands
.gemini/commands/     # Gemini slash commands
.clinerules/          # Cline agent rules
```

## First Steps

After copying the template into your project:

1. Open `.agents/SYSTEM/PRD.md` and describe your project
2. Fill in `ENTITIES.md` with your data models
3. Set `RULES.md` with your tech stack and conventions
4. Run `/start` in your AI agent to begin your first session

The most important files to fill in first are **PRD.md**, **ENTITIES.md**, and **RULES.md** -- these give the agent enough context to be immediately useful.

## Connection to the Learning System

This template is part of the [Self-Improving Agent](https://github.com/melvenac/Self-Improving-Agent) learning system. When used with the full system:

- **Sessions** feed experiences back into your knowledge vault
- **Decisions** accumulate into reusable skills over time
- **Patterns** discovered in one project transfer to others

The template works standalone (just copy and fill in), but becomes more powerful when connected to the global memory layer. See the main repo for full setup instructions.
