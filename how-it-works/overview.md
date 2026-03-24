# How the Self-Improving Agent Works

The self-improving agent is a three-layer feedback loop that makes your AI coding assistant smarter over time. Every session generates knowledge, and that knowledge gets fed back into future sessions automatically.

## The Core Cycle

```
    +------------------+
    |   MEMORY LAYER   |  Obsidian Vault: experiences, skills, sessions
    |  (Obsidian Vault)|
    +--------+---------+
             |
             v
    +------------------+
    |    RETRIEVAL      |  Session start: surface relevant knowledge
    | (/start, /recall) |
    +--------+---------+
             |
             v
    +------------------+
    |   DEVELOPMENT     |  You work with the agent, making decisions
    |  (your session)   |
    +--------+---------+
             |
             v
    +------------------+
    |  ACCUMULATION     |  Session end: capture lessons automatically
    | (vault-writer.mjs)|
    +--------+---------+
             |
             v
    +------------------+
    |   MEMORY LAYER   |  Updated with new experiences and sessions
    |  (Obsidian Vault)|
    +------------------+
```

Each session feeds the next. The agent retrieves what it learned before, uses it during development, and captures new lessons when the session ends.

## Three Tiers of Knowledge

The system organizes knowledge in three tiers, from broadest to most specific.

### Global Tier -- Obsidian Vault

The Obsidian Vault (`~/Obsidian Vault/`) is the central knowledge store. It holds:

- **Experiences** -- individual lessons learned from past sessions
- **Skills** -- reusable patterns distilled from multiple experiences
- **Sessions** -- chronological logs of what happened
- **Topics** -- aggregation notes that group related experiences

This tier persists across ALL projects. A lesson learned in your Stripe integration helps when you build another payment flow months later.

### Domain Tier -- Tagged Experiences

Experiences are tagged by technology and pattern (e.g., `convex`, `stripe`, `nextjs`). This creates natural groupings:

- "How to handle Convex validators" -- surfaces in any Convex project
- "Stripe webhook patterns" -- surfaces whenever you work with Stripe
- "Blender automation gotchas" -- surfaces in pipeline work

Domain knowledge crosses project boundaries but stays within a technology area.

### Project Tier -- .agents/ Scaffold

Each project gets its own `.agents/` directory (or `.claude/`) containing:

- **PRD** -- what the project is and where it's going
- **Entities** -- key data structures and relationships
- **Rules** -- project-specific conventions
- **Decisions** -- architectural choices and their rationale

This tier is specific to one codebase. It doesn't leave the project.

## Components in Detail

Each part of the cycle has its own documentation:

- **[The Memory Layer](memory-layer.md)** -- how the Obsidian Vault stores knowledge as plain-text markdown, the directory structure, and the experience format (TRIGGER / ACTION / CONTEXT / OUTCOME).

- **[Accumulation](accumulation.md)** -- how `vault-writer.mjs` and `vault-skill-scan.mjs` automatically capture knowledge at session end, with guardrails to prevent noise.

- **[Retrieval](retrieval.md)** -- how the agent surfaces relevant experiences and skills at session start, using semantic search and domain tags.

- **[Skill Distillation](skill-distillation.md)** -- how individual experiences cluster into reusable skills over time, with a human approval gate to ensure quality.

- **[Multi-Agent Coordination](multi-agent.md)** -- how the A2A wrapper lets multiple Claude Code agents coordinate through a shared hub, with each agent benefiting from the same learning system.

## Why It Works

The system works because it is:

1. **Automatic** -- accumulation happens via a SessionEnd hook. You don't have to remember to save lessons.
2. **Non-prescriptive** -- retrieved knowledge is guidance, not mandates. The agent suggests; you decide.
3. **Plain text** -- everything is markdown in an Obsidian Vault. You can read, edit, and search it yourself.
4. **Compounding** -- each session makes future sessions better. Experiences cluster into skills. Skills make the agent more effective. Better sessions produce better experiences.
