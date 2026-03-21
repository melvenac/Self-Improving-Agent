# Framework Guide
**Version 1.0 — Portable Agent Architecture**

> This document explains the framework, how to use it, and how to duplicate it for any project with any tech stack.

---

## What Is This?

This is an **AI-first development framework** — a structured set of markdown documents, workflows, and validation scripts that give AI coding agents (Cline, Claude Code, Gemini, Cursor, etc.) persistent memory, consistent behavior, and guardrails across sessions.

Without this framework, every AI session starts from zero. With it, agents:
- Know what was built, what's broken, and what's next
- Follow consistent coding standards
- Don't repeat mistakes (gotchas are documented)
- Update their own documentation as they work
- Can be validated for protocol compliance

---

## Framework Architecture

```
.agents/                          ← Agent-readable project brain
├── FRAMEWORK.md                  ← This file (how to use & duplicate)
├── SYSTEM/                       ← Project truth documents
│   ├── PRD.md                    ← Product requirements
│   ├── SUMMARY.md                ← Current state (overwritten each session)
│   ├── ENTITIES.md               ← Data model documentation
│   ├── DECISIONS.md              ← Architectural decision log
│   ├── RULES.md                  ← Coding standards & conventions
│   ├── TESTING.md                ← Testing strategy
│   ├── RUNBOOK.md                ← Production operations
│   └── SECURITY.md               ← Security audit checklist
├── TASKS/                        ← Work tracking
│   ├── INBOX.md                  ← Prioritized task backlog
│   └── task.md                   ← Current sprint/focus
├── SESSIONS/                     ← Session history
│   ├── SESSION_TEMPLATE.md       ← Template for new sessions
│   └── Session_N.md              ← Individual session logs
├── skills/                       ← Reusable agent skills
│   ├── INDEX.md                  ← Skill registry
│   └── <skill-name>/SKILL.md    ← Individual skill instructions
└── workflows/                    ← Lifecycle commands
    ├── start.md                  ← Session start protocol
    ├── end.md                    ← Session end protocol
    ├── test.md                   ← Zero-token E2E testing protocol
    └── task.md                   ← Next task selection protocol

.claude/commands/                 ← Claude Code slash commands (mirrors workflows/)
.gemini/commands/                 ← Gemini slash commands (mirrors workflows/)
.clinerules/                      ← Cline-specific rules
CLAUDE.md                         ← Claude Code entry point
```

### The Three Layers

| Layer | Purpose | Changes How Often |
|---|---|---|
| **SYSTEM/** | Project truth — what the project IS | Rarely (PRD, RULES) to every session (SUMMARY) |
| **TASKS/** | What needs to be DONE | Every session |
| **SESSIONS/** | What WAS done | Append-only log |

**Skills** are reusable patterns. **Workflows** are lifecycle hooks.

---

## How to Duplicate This Framework for a New Project

### Phase 1: Scaffold (5 minutes)

Copy the framework skeleton. Everything below is **tech-stack agnostic**:

```bash
mkdir -p .agents/SYSTEM .agents/TASKS .agents/SESSIONS .agents/skills .agents/workflows
mkdir -p .claude/commands .gemini/commands
```

Copy these files **as-is** (they're universal):
- `.agents/SESSIONS/SESSION_TEMPLATE.md`
- `.agents/workflows/start.md`
- `.agents/workflows/end.md`
- `.claude/commands/start.md` and `end.md`
- `.gemini/commands/start.md` and `end.md`

### Phase 2: Write the PRD (30-60 minutes)

**This is the most important step.** The PRD is the foundation everything else derives from.

Create `.agents/SYSTEM/PRD.md` with:
1. **Project overview** — What are we building? For whom?
2. **Core features** — Numbered list of must-have features
3. **Tech stack** — What technologies are we using?
4. **User roles** — Who uses the system and what can they do?
5. **Pages/Routes** — What pages exist?
6. **Data model sketch** — What are the main entities? (This becomes ENTITIES.md)
7. **Third-party integrations** — What external services are involved?
8. **Non-functional requirements** — Performance, security, accessibility

**Tip**: You can have an AI agent help you write the PRD. Give it your idea and ask it to produce a structured PRD following this format.

### Phase 3: Derive the SYSTEM Documents (from PRD)

Once the PRD exists, create the remaining SYSTEM docs **in this order**:

| Order | Document | Derived From | When to Customize |
|---|---|---|---|
| 1 | `PRD.md` | Your brain | Before anything else |
| 2 | `ENTITIES.md` | PRD §6 (data model) | After PRD, before coding |
| 3 | `RULES.md` | PRD §3 (tech stack) | After PRD, before coding |
| 4 | `SUMMARY.md` | PRD (initial state) | After PRD, updated every session |
| 5 | `DECISIONS.md` | Empty initially | As decisions are made |
| 6 | `TESTING.md` | Tech stack + features | After first feature ships |
| 7 | `RUNBOOK.md` | Infrastructure choices | Before production deploy |
| 8 | `SECURITY.md` | Auth + payment + data | Before production deploy |

### Phase 4: Create Skills (Iterative — NOT Upfront)

**Do NOT try to create all skills before coding.** Skills emerge from patterns you discover during development.

#### When to Create a Skill

| Trigger | Example |
|---|---|
| You explain the same pattern to the AI 3+ times | "Always use lazy init for Stripe in Convex Actions" → `stripe-lazy-init` skill |
| A technology has project-specific conventions | "We use shadcn/ui with a dark theme" → `shadcn-ui` skill |
| A workflow has more than 5 steps | "Creating a new Convex component" → `convex-component-authoring` skill |
| An integration has gotchas | "FullCalendar + Convex real-time" → `fullcalendar-convex` skill |
| You want to prevent a class of bugs | "Schema changes must update ENTITIES.md" → `convex-schema-guard` skill |

#### Skill Creation Timeline

```
PRD written
  ↓
Start coding (Session 1-3)
  → Create: session-manager skill (universal)
  → Create: 1-2 tech-stack skills (e.g., your DB framework, your UI library)
  ↓
Features shipping (Session 4-8)
  → Create skills as patterns emerge
  → Don't force it — if you haven't repeated a pattern, you don't need a skill
  ↓
Stabilizing (Session 8+)
  → Create: playwright-tester skill (zero-token E2E testing)
  → Create: deployment skill
  → Flesh out placeholder skills
  → Add validation scripts
```

### Phase 5: Wire Up Validation (Optional but Recommended)

If your project has a data model documentation file (like ENTITIES.md), create a validation script that checks it against the actual schema. This is the single highest-ROI automation in the framework.

---

## Customizing for Different Tech Stacks

The framework is **90% tech-agnostic**. Here's what changes per stack:

### What's Universal (Copy As-Is)
- Session lifecycle (start/end workflows)
- SUMMARY.md structure
- DECISIONS.md format
- TASKS/ structure
- SESSION_TEMPLATE.md
- SECURITY.md structure (customize the checklist items)

### What's Tech-Specific (Must Customize)

| Document | What Changes | Example |
|---|---|---|
| `RULES.md` | Coding standards section | React rules vs. Vue rules vs. Python rules |
| `ENTITIES.md` | Schema format | Convex validators vs. Prisma schema vs. SQL DDL |
| `TESTING.md` | Testing tools & patterns | Vitest vs. Jest vs. pytest |
| `RUNBOOK.md` | Deploy steps & infrastructure | Vercel vs. Docker vs. AWS |
| Skills | Entirely project-specific | Different skills for every project |

### Example: Same Framework, Different Stack

**A Next.js + Convex + Clerk + Stripe project** would have:
- Skills: `convex-schema-guard`, `stripe-lazy-init`, `shadcn-ui`, `playwright-tester`
- Testing: Zero-token Playwright E2E (`npx playwright test tests/e2e/`)
- Validation: `validate-entities.ts` (parses Convex schema.ts files)
- Rules: Server Components default, Convex validators, Tailwind dark theme

**A Django + PostgreSQL + HTMX project** would have:
- Skills: `django-models`, `htmx-patterns`, `celery-tasks`
- Validation: Script that parses Django models.py and checks ENTITIES.md
- Rules: Class-based views, Django ORM conventions, template naming

**A Go + gRPC + Kubernetes project** would have:
- Skills: `protobuf-schema`, `k8s-manifests`, `go-error-handling`
- Validation: Script that parses .proto files and checks ENTITIES.md
- Rules: Go naming conventions, error wrapping, context propagation

**A SvelteKit + Supabase + Tailwind project** would have:
- Skills: `supabase-rls`, `svelte-stores`, `playwright-tester`
- Validation: Script that parses Supabase migrations and checks ENTITIES.md
- Rules: Server-side load functions, Supabase RLS policies, Tailwind utility classes

**An Astro + SQLite + HTMX project** would have:
- Skills: `astro-islands`, `drizzle-orm`, `htmx-patterns`
- Validation: Script that parses Drizzle schema and checks ENTITIES.md
- Rules: Static-first pages, island architecture for interactivity, minimal JS

**A Rails + PostgreSQL + Hotwire project** would have:
- Skills: `rails-models`, `turbo-frames`, `stimulus-controllers`
- Validation: Script that parses `db/schema.rb` and checks ENTITIES.md
- Rules: Convention over configuration, fat models thin controllers, Turbo for SPA-like UX

**A FastAPI + SQLAlchemy + React project** would have:
- Skills: `sqlalchemy-models`, `pydantic-schemas`, `react-query`
- Validation: Script that parses SQLAlchemy models and checks ENTITIES.md
- Rules: Pydantic for all request/response schemas, async endpoints, dependency injection

---

## The Session Lifecycle

Every development session follows this pattern:

```
/start
  ├── Read SUMMARY.md (current state)
  ├── Read INBOX.md (priorities)
  ├── Read ENTITIES.md (if schema work)
  ├── Create session log
  ├── Run validate:session:pre
  └── State objective → get approval → code

... development work ...

/test (optional — after feature work or before deploy)
  ├── Assess project structure
  ├── Author .spec.ts files (zero-token — deterministic scripts)
  ├── Execute via Playwright CLI (zero AI tokens)
  ├── Fix loop (max 3 attempts per failure)
  └── Report → feeds into /end session summary

/end
  ├── Update session log (accomplishments, files, gotchas)
  ├── Update SUMMARY.md (current state block)
  ├── Update DECISIONS.md (if applicable)
  ├── Update ENTITIES.md (if schema changed)
  ├── Run validate:entities (if schema changed)
  ├── Mark tasks done in INBOX.md
  ├── Run validate:session:post
  └── Present summary to user
```

This lifecycle is what gives agents **continuity across sessions**. Without it, every session is a cold start.

---

## Zero-Token E2E Testing

The framework includes a **zero-token testing strategy** that uses AI only to *write* deterministic test scripts, then runs them natively with Playwright at zero token cost.

### Why Zero-Token?

Traditional AI-driven testing (screenshot analysis, Playwright MCP server) consumes massive tokens per run. This approach splits testing into two phases:

1. **Write phase** (AI tokens) — The agent reads your project structure, understands routes/components/auth gates, and generates `.spec.ts` test files organized by strategy
2. **Run phase** (zero tokens) — Playwright executes those scripts natively via CLI. No AI judgment needed at runtime

### The 5-Phase Workflow

```
/test (or invoke playwright-tester skill)
  ├── Phase 1: Assess    — Read project structure (framework, routing, entry points)
  ├── Phase 2: Author    — Write independent .spec.ts files by strategy
  ├── Phase 3: Execute   — Run tests natively via Playwright CLI
  ├── Phase 4: Fix Loop  — Auto-repair failures (max 3 attempts)
  └── Phase 5: Report    — Results table, bugs found/fixed, suggested coverage
```

### Test Strategy Categories

| File | Strategy | What it covers |
|---|---|---|
| `happy_path.spec` | Core user journeys | The flows that must always work |
| `validation.spec` | Form validation | Required fields, error states, success states |
| `navigation.spec` | Routing & links | All routes resolve, nav links work, 404 handling |
| `auth_gates.spec` | Auth boundaries | Protected routes redirect, public routes stay open |
| `responsive.spec` | Viewport rendering | Mobile, tablet, desktop breakpoints |
| `[feature].spec` | Feature-specific | Booking flow, membership flow, etc. |

### Integration with the Framework

| Framework Layer | Testing Integration |
|---|---|
| `skills/playwright-tester/SKILL.md` | The skill file — 5-phase playbook with project-specific details |
| `SYSTEM/TESTING.md` | Documents the zero-token strategy as an official testing layer |
| `SYSTEM/RULES.md` | Add rule: "Tests are `.spec.ts` files, run natively, zero AI tokens at execution" |
| `skills/INDEX.md` | Register the `playwright-tester` skill |
| `playwright.config.ts` | Project root — Playwright configuration |
| `tests/e2e/` | Test files live here, organized by strategy |

### The Fix Loop

The fix loop is what makes this self-repairing:

1. Run tests → some fail
2. Agent reads error output and failure screenshots
3. Determines if failure is a **test bug** (bad selector, timing) or an **app bug** (broken UI, backend error)
4. Fixes the issue, re-runs
5. **Max 3 attempts** per failing test — prevents infinite loops
6. Final report lists all bugs found/fixed and suggests additional coverage

### When to Create the Testing Skill

Following the framework's skill creation philosophy ("create when you've repeated a pattern 3+ times"), the testing skill fits naturally in the **Stabilizing** phase:

```
Stabilizing (Session 8+)
  → Create: playwright-tester skill
  → Install: @playwright/test + playwright.config.ts
  → Author initial test suite (happy path + navigation)
  → Expand coverage as features stabilize
```

### Duplicating for Other Projects

The testing skill is **90% portable**. When duplicating for a new project:

1. Copy `skills/playwright-tester/SKILL.md` as a starting template
2. Update Phase 1 (Assess) with the new project's framework/routing conventions
3. Update Phase 2 (Author) test categories to match the new project's features
4. The Fix Loop and Report phases are universal — copy as-is
5. Create a new `playwright.config.ts` pointing to the project's dev server

The test *files* themselves are project-specific and get regenerated by the skill each time.

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Do This Instead |
|---|---|---|
| Writing all skills upfront | Skills without real usage are speculative and wrong | Create skills when you've repeated a pattern 3+ times |
| Putting code in SYSTEM docs | SYSTEM docs are for agents to READ, not execute | Keep code in `src/scripts/`, reference from docs |
| Skipping /end | Next session starts from zero, loses all context | Always run /end, even for short sessions |
| Making SUMMARY.md too long | Agents waste tokens reading history | Archive old milestones, keep SUMMARY focused on NOW |
| Tech-specific rules in universal docs | Makes the framework non-portable | Keep tech rules in RULES.md and skills, not in workflows |
| One giant RULES.md | Too much to read every session | Split into RULES.md (always read) + skills (read on demand) |

---

## Quick Start Checklist for a New Project

```markdown
- [ ] Copy framework skeleton (mkdir + copy universal files)
- [ ] Write PRD.md (the foundation — spend time here)
- [ ] Create ENTITIES.md from PRD data model section
- [ ] Create RULES.md with tech-stack-specific coding standards
- [ ] Create SUMMARY.md with initial project state
- [ ] Create empty DECISIONS.md
- [ ] Create INBOX.md with initial task backlog from PRD
- [ ] Create skills/INDEX.md (empty table, fill as skills emerge)
- [ ] Create session-manager skill (universal)
- [ ] Wire up CLAUDE.md / .clinerules to point to .agents/
- [ ] Start Session 1 with /start
- [ ] Create first tech-specific skill after Session 2-3
- [ ] Add validation scripts after Session 5+
- [ ] Create TESTING.md after first feature ships
- [ ] Create playwright-tester skill after Session 8+ (stabilizing phase)
- [ ] Run initial zero-token test suite and iterate through fix loop
- [ ] Create RUNBOOK.md before production deploy
- [ ] Create SECURITY.md before production deploy
```

---

## Developing This Framework

If you're improving the framework template itself (not using it for a project), you need a way to use the session lifecycle without polluting the skeleton templates.

### The META/ Pattern

Create a `.agents/META/` directory with its own tracking files:

```
.agents/META/              ← Framework development tracking (gitignored)
├── SUMMARY.md             ← Current state of framework development
├── DECISIONS.md           ← Framework design decisions (META-NNN prefix)
└── INBOX.md               ← Framework improvement backlog
```

### How It Works

1. **`.gitignore`** excludes `.agents/META/` — it never reaches GitHub
2. **`/start`** detects META/ and reads from `META/SUMMARY.md` and `META/INBOX.md` instead of the SYSTEM/ templates
3. **`/end`** writes session updates to META/ files, leaving SYSTEM/ templates untouched
4. **Session logs** go to `SESSIONS/Session_N.md` as normal (also gitignored)

### Framework Development Workflow

```
/start                         ← Reads META/SUMMARY.md, META/INBOX.md
  ↓
... improve skeleton files ... ← Edit SYSTEM/ templates, add skills, fix workflows
  ↓
/end                           ← Updates META/ tracking, NOT the SYSTEM/ templates
  ↓
git add + commit + push        ← Only skeleton improvements reach GitHub
```

The key rule: **`/end` writes tracking data to META/. You manually edit SYSTEM/ files only when intentionally improving the template content.**

---

## Versioning This Framework

As you use this across projects, you'll improve it. Keep a "framework template" repo (like this one):

```
ai-first-framework/
├── .agents/           ← Universal skeleton (no project-specific content)
├── .claude/           ← Universal slash commands
├── .gemini/           ← Universal slash commands
├── CLAUDE.md          ← Universal entry point template
├── README.md          ← GitHub-facing onboarding guide
└── .gitignore         ← Excludes META/, sessions, build artifacts
```

Then for each new project: clone the repo, reset git history, write the PRD, and let the framework grow organically. See README.md for the step-by-step setup.
