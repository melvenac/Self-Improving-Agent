# Skill Distillation: How Patterns Become Reusable Knowledge

Skill distillation is the process of converting clusters of related experiences into reusable, higher-level knowledge. It's how the system moves from "I learned this one thing" to "here's a reliable pattern."

## The Progression

```
Individual          Experience           Skill              Approved
Experiences    -->  Clusters        -->  Candidates    -->  Skills
(1 lesson)         (3+ related)         (proposed)         (validated)
```

Each stage represents increasing confidence that a pattern is real and worth codifying.

## Experience Clustering

The `vault-skill-scan.mjs` hook (see [Accumulation](accumulation.md)) groups experiences by domain tags after every session. When 3+ experiences share similar triggers or contexts within the same domain, that's a potential skill.

For example, if the vault contains:
- "Convex validator must wrap entire args object" (domain: convex)
- "Convex query functions cannot use mutations internally" (domain: convex)
- "Convex scheduled functions need explicit error handling" (domain: convex)
- "Convex action retries need idempotency keys" (domain: convex)

The scanner identifies this as a "convex" cluster with 4 experiences -- well above the 3-experience minimum.

## SKILL-CANDIDATES.md

Located at `~/Obsidian Vault/Guidelines/SKILL-CANDIDATES.md`, this file is where proposed skills live before approval. The skill scanner updates it automatically.

Each entry includes:
- The cluster's domain tag
- The number of experiences in the cluster
- A list of the member experiences
- Whether it's new (just crossed the threshold) or growing (already known, gained members)

```markdown
## Cluster: convex (4 experiences)
- Convex validator must wrap entire args object
- Convex query functions cannot use mutations internally
- Convex scheduled functions need explicit error handling
- Convex action retries need idempotency keys

Status: GROWING (was 3, now 4)
```

Candidates stay in this file until a human approves or explicitly declines them.

## SKILL-INDEX.md

Located at `~/Obsidian Vault/Guidelines/SKILL-INDEX.md`, this is the registry of approved, active skills. The retrieval system reads this file at session start to find relevant skills.

Each entry in the index points to a skill file in the `Guidelines/` directory.

## The Proposal Flow

### 1. Scanner Detects a Cluster

After a session ends, `vault-skill-scan.mjs` runs and finds that 3+ experiences share a domain. The cluster is written to `SKILL-CANDIDATES.md` and a notification is saved to `.skill-proposals-pending.json`.

### 2. Agent Proposes at Next Session Start

During [retrieval](retrieval.md), the agent checks for pending proposals. If one is relevant to the current session, it presents the cluster:

```
Skill proposal: "Convex Function Patterns"
Based on 4 experiences about Convex gotchas and patterns.
Members:
  - Convex validator must wrap entire args object
  - Convex query functions cannot use mutations internally
  - Convex scheduled functions need explicit error handling
  - Convex action retries need idempotency keys

Want me to distill this into a reusable skill?
```

### 3. User Decides

- **Approve** -- the agent creates a skill file from the cluster, adds it to `SKILL-INDEX.md`, and removes the cluster from `SKILL-CANDIDATES.md`.
- **Decline** -- the cluster stays in candidates. It may grow as more experiences accumulate, making it a stronger candidate later.
- **Modify** -- the user can adjust which experiences belong in the cluster or refine the skill's scope before approval.

### 4. Skill File Is Created (on approval)

A new markdown file is created in `~/Obsidian Vault/Guidelines/` following the skill template:

```markdown
---
name: Convex Function Patterns
domain: convex
problem-class: API design, validation, error handling
date-created: 2026-03-20
source-experiences: 4
---

# Convex Function Patterns

Reusable patterns for writing Convex functions across projects.

## TRIGGER
When writing or reviewing Convex functions (queries, mutations, actions,
scheduled functions).

## CONTEXT
Convex has specific requirements for argument validation, function
composition, and error handling that differ from typical Node.js patterns.

## ACTION
1. Always wrap function args in `v.object()` -- bare objects silently
   skip validation.
2. Never call mutations from within query functions -- use actions
   for cross-function orchestration.
3. Add explicit error handling to scheduled functions -- unhandled
   errors fail silently.
4. Use idempotency keys in actions that call external APIs -- Convex
   may retry actions on transient failures.

## Source Experiences
- [[Convex validator must wrap entire args object]]
- [[Convex query functions cannot use mutations internally]]
- [[Convex scheduled functions need explicit error handling]]
- [[Convex action retries need idempotency keys]]
```

### 5. Skill Enters Rotation

Once in `SKILL-INDEX.md`, the skill is surfaced during future retrieval. It replaces the individual experiences in most cases -- the skill is a more efficient way to convey the same knowledge.

## Why Skills Are Never Auto-Created

The human approval gate exists for several reasons:

1. **Pattern validation** -- just because 3 experiences share a tag doesn't mean they form a coherent pattern. A human can judge whether the cluster is a real, reusable skill or just coincidence.

2. **Scope refinement** -- the scanner groups by tags, which is coarse. A human can split or merge clusters based on deeper understanding.

3. **Quality control** -- skills are surfaced frequently and influence the agent's behavior. A bad skill causes repeated bad advice. The approval gate prevents this.

4. **Trust** -- the developer maintains control over what the agent "knows." No knowledge becomes institutionalized without explicit approval.

This is the most important guardrail in the system. The compound feedback loop is powerful precisely because it has this quality gate. Without it, noise would accumulate and degrade the agent's effectiveness over time.
