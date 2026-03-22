# A2A Intelligent Hub — Implementation Plan (v1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a persistent A2A-compliant agent on Coolify that mediates communication between ephemeral Claude Code agents, accumulates knowledge in self-hosted Convex, self-corrects the repo, and mirrors activity to Telegram.

**Architecture:** Express server using `@a2a-js/sdk` for A2A protocol handling, `@anthropic-ai/sdk` for LLM reasoning, and Convex (self-hosted) for all persistent state. Local wrappers poll the Hub and pipe tasks to `claude --print`. Telegram Bot API mirrors all activity to a group chat with inline approval buttons for repo fixes.

**Tech Stack:** Node.js 20+, TypeScript, Express, `@a2a-js/sdk`, `@anthropic-ai/sdk`, Convex, Telegram Bot API, Docker, Coolify

**Spec:** `reference/planning/superpowers/specs/2026-03-21-a2a-intelligent-hub-design.md`

---

## File Structure

```
hub/                              # The Hub — A2A server (deployed to Coolify)
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
├── src/
│   ├── index.ts                  # Express server entry point, A2A route setup
│   ├── agent-card.ts             # Agent Card definition
│   ├── executor.ts               # HubExecutor — decision flow (memory → escalate → store)
│   ├── memory.ts                 # Convex queries — search experiences, store lessons
│   ├── escalation.ts             # A2A client — delegate tasks to Clark/Alice wrappers
│   ├── classifier.ts             # LLM root cause classification (repo-docs, user-env, etc.)
│   ├── repo-fixer.ts             # Draft fixes, git commit/push on approval
│   ├── telegram.ts               # Telegram mirror — broadcast + inline approval buttons
│   ├── task-store.ts             # ConvexTaskStore implementing @a2a-js/sdk TaskStore
│   ├── queue.ts                  # Agent polling queue endpoint (Hub-specific extension)
│   └── response.ts              # Handle wrapper responses to escalated tasks
├── convex/
│   ├── schema.ts                 # Convex schema (experiences, tasks, agents, repoFixes, conversations)
│   ├── experiences.ts            # Mutations/queries for experiences table
│   ├── tasks.ts                  # Mutations/queries for tasks table
│   ├── agents.ts                 # Mutations/queries for agents table
│   ├── repoFixes.ts             # Mutations/queries for repoFixes table
│   └── conversations.ts         # Mutations/queries for conversations table (v2 dashboard)
└── tests/
    ├── executor.test.ts          # Decision flow tests
    ├── memory.test.ts            # Memory search/store tests
    ├── classifier.test.ts        # Root cause classification tests
    ├── queue.test.ts             # Polling queue tests
    └── integration.test.ts       # End-to-end A2A message flow

wrapper/                          # Local Wrapper — runs on agent's machine
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                  # Entry point — poll loop + heartbeat
│   ├── poller.ts                 # Poll Hub queue endpoint for pending tasks
│   ├── claude.ts                 # Pipe tasks to `claude --print` subprocess
│   └── config.ts                 # CLI args parsing (--hub, --key, --agent-name)
└── tests/
    ├── poller.test.ts            # Polling logic tests
    └── claude.test.ts            # Claude subprocess tests
```

---

## Task 1: Hub Project Scaffold

**Files:**
- Create: `hub/package.json`
- Create: `hub/tsconfig.json`
- Create: `hub/.env.example`
- Create: `hub/src/index.ts`
- Create: `hub/src/agent-card.ts`

- [ ] **Step 1: Initialize the Hub project**

```bash
cd ~/Projects/Self-Improving-Agent
mkdir -p hub/src hub/tests hub/convex
```

- [ ] **Step 2: Create package.json**

Create `hub/package.json`:

```json
{
  "name": "a2a-intelligent-hub",
  "version": "1.0.0",
  "type": "module",
  "description": "A2A-compliant intelligent hub for agent-to-agent communication",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@a2a-js/sdk": "latest",
    "@anthropic-ai/sdk": "latest",
    "convex": "latest",
    "express": "^5.0.0",
    "node-telegram-bot-api": "latest",
    "simple-git": "latest"
  },
  "devDependencies": {
    "@types/express": "latest",
    "@types/node": "latest",
    "@types/node-telegram-bot-api": "latest",
    "tsx": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

Create `hub/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Create .env.example**

Create `hub/.env.example`:

```bash
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_PAT=ghp_...
TELEGRAM_BOT_TOKEN=123456:ABC-...
TELEGRAM_GROUP_ID=-100...
CONVEX_URL=http://convex:3210
HUB_BOOTSTRAP_KEY=your-initial-api-key
HUB_URL=https://sandbox.tarrantcountymakerspace.com
REPO_PATH=/tmp/Self-Improving-Agent
CONFIDENCE_THRESHOLD=0.85
PORT=4000
```

- [ ] **Step 5: Create Agent Card**

Create `hub/src/agent-card.ts`:

```typescript
import type { AgentCard } from "@a2a-js/sdk";

export const hubAgentCard: AgentCard = {
  name: "Intelligent-Hub",
  description:
    "Persistent AI mediator for Self-Improving-Agent installation support. Accumulates knowledge from every interaction and self-corrects the repo.",
  supportedInterfaces: [
    {
      url: process.env.HUB_URL || "https://sandbox.tarrantcountymakerspace.com/a2a",
      protocolBinding: "JSONRPC",
      protocolVersion: "1.0",
    },
  ],
  provider: {
    organization: "Tarrant County Makerspace",
    url: "https://tarrantcountymakerspace.com",
  },
  version: "1.0.0",
  capabilities: {
    streaming: true,
    pushNotifications: false,
  },
  securitySchemes: {
    apiKey: {
      apiKeySecurityScheme: {
        name: "X-Agent-Key",
        in: "header",
      },
    },
  },
  securityRequirements: [{ apiKey: [] }],
  defaultInputModes: ["text/plain", "application/json"],
  defaultOutputModes: ["text/plain", "application/json"],
  skills: [
    {
      id: "troubleshoot-installation",
      name: "Installation Troubleshooting",
      description:
        "Diagnoses and resolves Self-Improving-Agent setup errors from accumulated knowledge or by escalating to an expert agent.",
      tags: ["debugging", "installation", "setup", "configuration"],
      examples: [
        "npm ERR! code ERESOLVE during install",
        "vault-writer.mjs not found when running SessionEnd hook",
        "Smart Connections MCP fails to connect after install",
      ],
    },
    {
      id: "query-error-history",
      name: "Error History Search",
      description: "Searches past resolved issues and successful fixes.",
      tags: ["search", "history", "knowledge"],
      examples: [
        "Has anyone else seen this Obsidian vault error?",
        "What's the fix for the skill-scan permission issue?",
      ],
    },
    {
      id: "suggest-repo-fix",
      name: "Repository Improvement",
      description:
        "Proposes documentation or code changes to prevent recurring installation issues.",
      tags: ["documentation", "improvement", "self-correcting"],
      examples: [
        "Three agents hit the same npm peer dependency error",
        "Step 3 doesn't mention the required Node version",
      ],
    },
  ],
};
```

- [ ] **Step 6: Create minimal Express server**

Create `hub/src/index.ts`:

```typescript
import express from "express";
import { hubAgentCard } from "./agent-card.js";

const app = express();
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", agent: hubAgentCard.name });
});

// Agent Card discovery
app.get("/.well-known/agent-card.json", (_req, res) => {
  res.json(hubAgentCard);
});

const port = parseInt(process.env.PORT || "4000");
app.listen(port, () => {
  console.log(`Hub running on port ${port}`);
  console.log(`Agent Card at http://localhost:${port}/.well-known/agent-card.json`);
});
```

- [ ] **Step 7: Install dependencies and verify**

```bash
cd hub && npm install
```

- [ ] **Step 8: Run dev server and test**

```bash
cd hub && npm run dev
# In another terminal:
curl http://localhost:4000/health
curl http://localhost:4000/.well-known/agent-card.json
```

Expected: health returns `{"status":"ok","agent":"Intelligent-Hub"}`, agent card returns full JSON.

- [ ] **Step 9: Commit**

```bash
git add hub/
git commit -m "feat(hub): scaffold A2A Hub project with Agent Card and Express server"
```

---

## Task 2: Convex Schema & Self-Hosted Setup

**Files:**
- Create: `hub/convex/schema.ts`
- Create: `hub/convex/experiences.ts`
- Create: `hub/convex/tasks.ts`
- Create: `hub/convex/agents.ts`
- Create: `hub/convex/repoFixes.ts`

- [ ] **Step 1: Initialize Convex in the hub directory**

```bash
cd hub && npx convex init
```

Follow the prompts for self-hosted Convex setup. This creates `convex/` directory structure.

- [ ] **Step 2: Create the schema**

Create `hub/convex/schema.ts`:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  experiences: defineTable({
    trigger: v.string(),
    action: v.string(),
    context: v.string(),
    outcome: v.string(),
    confidence: v.number(),
    sourceAgent: v.string(),
    category: v.union(
      v.literal("repo-docs"),
      v.literal("repo-script"),
      v.literal("repo-config"),
      v.literal("user-env"),
      v.literal("user-error")
    ),
    embedding: v.optional(v.array(v.float64())),
    createdAt: v.number(),
  })
    .searchIndex("search_trigger", { searchField: "trigger" })
    .searchIndex("search_action", { searchField: "action" }),

  tasks: defineTable({
    taskId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("in-progress"),
      v.literal("escalated"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    messages: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
        timestamp: v.number(),
      })
    ),
    assignedAgent: v.optional(v.string()),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  }).index("by_status", ["status"]),

  agents: defineTable({
    name: v.string(),
    apiKeyHash: v.string(),
    agentCard: v.any(),
    lastSeen: v.number(),
    status: v.union(v.literal("online"), v.literal("offline")),
  }).index("by_name", ["name"]),

  conversations: defineTable({
    taskId: v.string(),
    messages: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
        timestamp: v.number(),
      })
    ),
    participants: v.array(v.string()),
    summary: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_taskId", ["taskId"]),

  repoFixes: defineTable({
    experienceId: v.id("experiences"),
    diffPreview: v.string(),
    filePaths: v.array(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("pushed")
    ),
    approvedBy: v.optional(v.string()),
    feedback: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_status", ["status"]),
});
```

- [ ] **Step 3: Create experiences queries/mutations**

Create `hub/convex/experiences.ts`:

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const search = query({
  args: { text: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("experiences")
      .withSearchIndex("search_trigger", (q) => q.search("trigger", args.text))
      .take(args.limit ?? 5);
    return results;
  },
});

export const store = mutation({
  args: {
    trigger: v.string(),
    action: v.string(),
    context: v.string(),
    outcome: v.string(),
    confidence: v.number(),
    sourceAgent: v.string(),
    category: v.union(
      v.literal("repo-docs"),
      v.literal("repo-script"),
      v.literal("repo-config"),
      v.literal("user-env"),
      v.literal("user-error")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("experiences", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("experiences")
      .order("desc")
      .take(args.limit ?? 20);
  },
});
```

- [ ] **Step 4: Create tasks queries/mutations**

Create `hub/convex/tasks.ts`:

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    taskId: v.string(),
    messages: v.array(
      v.object({ role: v.string(), content: v.string(), timestamp: v.number() })
    ),
    assignedAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tasks", {
      ...args,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    taskId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("in-progress"),
      v.literal("escalated"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    assignedAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("taskId"), args.taskId))
      .first();
    if (!task) throw new Error(`Task ${args.taskId} not found`);
    await ctx.db.patch(task._id, {
      status: args.status,
      assignedAgent: args.assignedAgent,
      ...(args.status === "completed" ? { resolvedAt: Date.now() } : {}),
    });
  },
});

export const addMessage = mutation({
  args: {
    taskId: v.string(),
    role: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("taskId"), args.taskId))
      .first();
    if (!task) throw new Error(`Task ${args.taskId} not found`);
    await ctx.db.patch(task._id, {
      messages: [...task.messages, { role: args.role, content: args.content, timestamp: Date.now() }],
    });
  },
});

export const getPending = query({
  args: { agentName: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "escalated"))
      .filter((q) => q.eq(q.field("assignedAgent"), args.agentName))
      .take(10);
  },
});

export const getByTaskId = query({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("taskId"), args.taskId))
      .first();
  },
});
```

- [ ] **Step 5: Create agents queries/mutations**

Create `hub/convex/agents.ts`:

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const register = mutation({
  args: {
    name: v.string(),
    apiKeyHash: v.string(),
    agentCard: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        agentCard: args.agentCard,
        lastSeen: Date.now(),
        status: "online",
      });
      return existing._id;
    }
    return await ctx.db.insert("agents", {
      ...args,
      lastSeen: Date.now(),
      status: "online",
    });
  },
});

export const heartbeat = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (agent) {
      await ctx.db.patch(agent._id, { lastSeen: Date.now(), status: "online" });
    }
  },
});

export const getOnline = query({
  handler: async (ctx) => {
    const cutoff = Date.now() - 60_000; // 60s timeout
    const agents = await ctx.db.query("agents").collect();
    return agents.filter((a) => a.lastSeen > cutoff);
  },
});

export const validateKey = query({
  args: { apiKeyHash: v.string() },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .filter((q) => q.eq(q.field("apiKeyHash"), args.apiKeyHash))
      .first();
    return agent ?? null;
  },
});
```

- [ ] **Step 6: Create repoFixes queries/mutations**

Create `hub/convex/repoFixes.ts`:

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const propose = mutation({
  args: {
    experienceId: v.id("experiences"),
    diffPreview: v.string(),
    filePaths: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("repoFixes", {
      ...args,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const approve = mutation({
  args: { id: v.id("repoFixes"), approvedBy: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "approved", approvedBy: args.approvedBy });
  },
});

export const reject = mutation({
  args: { id: v.id("repoFixes"), feedback: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "rejected", feedback: args.feedback });
  },
});

export const getPending = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("repoFixes")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(10);
  },
});
```

- [ ] **Step 7: Deploy Convex schema**

```bash
cd hub && npx convex deploy
```

Verify tables are created in the Convex dashboard.

- [ ] **Step 8: Commit**

```bash
git add hub/convex/
git commit -m "feat(hub): add Convex schema and CRUD operations for experiences, tasks, agents, repoFixes"
```

---

## Task 3: Hub Executor — Decision Flow

**Files:**
- Create: `hub/src/memory.ts`
- Create: `hub/src/executor.ts`
- Create: `hub/tests/executor.test.ts`

- [ ] **Step 1: Write the failing test for memory search**

Create `hub/tests/executor.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { HubExecutor } from "../src/executor.js";

describe("HubExecutor", () => {
  it("answers from memory when confidence is high", async () => {
    const executor = new HubExecutor({
      searchMemory: vi.fn().mockResolvedValue({
        confidence: 0.9,
        experience: {
          trigger: "npm ERR! ERESOLVE",
          action: "Run npm install --legacy-peer-deps",
          outcome: "Install succeeds",
        },
      }),
      escalate: vi.fn(),
      storeLesson: vi.fn(),
      classify: vi.fn(),
    });

    const result = await executor.handleMessage("npm ERR! code ERESOLVE during install");
    expect(result.answeredFromMemory).toBe(true);
    expect(result.response).toContain("npm install --legacy-peer-deps");
  });

  it("escalates when confidence is low", async () => {
    const escalateFn = vi.fn().mockResolvedValue("Try checking your Node version");
    const executor = new HubExecutor({
      searchMemory: vi.fn().mockResolvedValue({ confidence: 0.3, experience: null }),
      escalate: escalateFn,
      storeLesson: vi.fn(),
      classify: vi.fn().mockResolvedValue("user-env"),
    });

    const result = await executor.handleMessage("Something weird happened");
    expect(result.answeredFromMemory).toBe(false);
    expect(escalateFn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd hub && npx vitest run tests/executor.test.ts
```

Expected: FAIL — `HubExecutor` not found.

- [ ] **Step 3: Create memory.ts**

Create `hub/src/memory.ts`:

```typescript
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

export interface MemoryResult {
  confidence: number;
  experience: {
    trigger: string;
    action: string;
    outcome: string;
  } | null;
}

export class MemoryEngine {
  private client: ConvexHttpClient;

  constructor(convexUrl: string) {
    this.client = new ConvexHttpClient(convexUrl);
  }

  async search(query: string): Promise<MemoryResult> {
    const results = await this.client.query(api.experiences.search, {
      text: query,
      limit: 3,
    });

    if (results.length === 0) {
      return { confidence: 0, experience: null };
    }

    // Convex FTS returns results ranked by relevance (best first).
    // Use the stored confidence from when the experience was created.
    // If multiple results match, the top result's confidence indicates reliability.
    const best = results[0];
    return {
      confidence: best.confidence, // stored confidence from original resolution
      experience: {
        trigger: best.trigger,
        action: best.action,
        outcome: best.outcome,
      },
    };
  }

  async store(experience: {
    trigger: string;
    action: string;
    context: string;
    outcome: string;
    confidence: number;
    sourceAgent: string;
    category: "repo-docs" | "repo-script" | "repo-config" | "user-env" | "user-error";
  }) {
    await this.client.mutation(api.experiences.store, experience);
  }
}
```

- [ ] **Step 4: Create executor.ts**

Create `hub/src/executor.ts`:

```typescript
import type { MemoryResult } from "./memory.js";

const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD || "0.85");

interface ExecutorDeps {
  searchMemory: (query: string) => Promise<MemoryResult>;
  escalate: (message: string) => Promise<string>;
  storeLesson: (lesson: {
    trigger: string;
    action: string;
    context: string;
    outcome: string;
    confidence: number;
    sourceAgent: string;
    category: "repo-docs" | "repo-script" | "repo-config" | "user-env" | "user-error";
  }) => Promise<void>;
  classify: (trigger: string, action: string) => Promise<string>;
}

export interface ExecutorResult {
  answeredFromMemory: boolean;
  response: string;
  category?: string;
}

export class HubExecutor {
  private deps: ExecutorDeps;

  constructor(deps: ExecutorDeps) {
    this.deps = deps;
  }

  async handleMessage(message: string): Promise<ExecutorResult> {
    // Step 1: Search memory
    const memoryResult = await this.deps.searchMemory(message);

    if (memoryResult.confidence >= CONFIDENCE_THRESHOLD && memoryResult.experience) {
      // Answer from memory
      const response = `Known fix: ${memoryResult.experience.action}\n\nExpected outcome: ${memoryResult.experience.outcome}`;
      return { answeredFromMemory: true, response };
    }

    // Step 2: Escalate to available agent
    const agentResponse = await this.deps.escalate(message);

    // Step 3: Classify root cause
    const category = await this.deps.classify(message, agentResponse);

    // Step 4: Store lesson
    await this.deps.storeLesson({
      trigger: message,
      action: agentResponse,
      context: "Installation troubleshooting via A2A Hub",
      outcome: "Resolved",
      confidence: 0.9,
      sourceAgent: "escalation",
      category: category as any,
    });

    return { answeredFromMemory: false, response: agentResponse, category };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd hub && npx vitest run tests/executor.test.ts
```

Expected: PASS (both tests).

- [ ] **Step 6: Commit**

```bash
git add hub/src/memory.ts hub/src/executor.ts hub/tests/executor.test.ts
git commit -m "feat(hub): add HubExecutor decision flow with memory search and escalation"
```

---

## Task 4: LLM Classifier

**Files:**
- Create: `hub/src/classifier.ts`
- Create: `hub/tests/classifier.test.ts`

- [ ] **Step 1: Write the failing test**

Create `hub/tests/classifier.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { Classifier } from "../src/classifier.js";

describe("Classifier", () => {
  it("returns a valid category", async () => {
    const mockAnthropic = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "repo-docs" }],
        }),
      },
    };

    const classifier = new Classifier(mockAnthropic as any);
    const result = await classifier.classify(
      "vault-writer.mjs not found",
      "Copy vault-writer.mjs from scripts/ to ~/.claude/knowledge-mcp/scripts/"
    );

    expect(["repo-docs", "repo-script", "repo-config", "user-env", "user-error"]).toContain(result);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd hub && npx vitest run tests/classifier.test.ts
```

Expected: FAIL — `Classifier` not found.

- [ ] **Step 3: Implement classifier**

Create `hub/src/classifier.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";

const VALID_CATEGORIES = ["repo-docs", "repo-script", "repo-config", "user-env", "user-error"] as const;
type Category = (typeof VALID_CATEGORIES)[number];

export class Classifier {
  private client: Anthropic;

  constructor(client: Anthropic) {
    this.client = client;
  }

  async classify(trigger: string, action: string): Promise<Category> {
    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 50,
      system: `You are a root cause classifier. Given an installation error (trigger) and its fix (action), classify the root cause into exactly one category. Respond with ONLY the category string, nothing else.

Categories:
- repo-docs: Missing or unclear documentation in the repo
- repo-script: Missing automation or wrong command in the repo
- repo-config: Missing config file or entry in the repo
- user-env: User's local environment issue (wrong Node version, OS quirk)
- user-error: User mistake, not a repo problem`,
      messages: [
        {
          role: "user",
          content: `Trigger: ${trigger}\nAction: ${action}`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const category = text as Category;

    if (VALID_CATEGORIES.includes(category)) {
      return category;
    }
    return "user-error"; // safe default
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd hub && npx vitest run tests/classifier.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hub/src/classifier.ts hub/tests/classifier.test.ts
git commit -m "feat(hub): add LLM root cause classifier for installation issues"
```

---

## Task 5: Agent Queue (Polling Endpoint)

**Files:**
- Create: `hub/src/queue.ts`
- Create: `hub/tests/queue.test.ts`
- Modify: `hub/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `hub/tests/queue.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { AgentQueue } from "../src/queue.js";

describe("AgentQueue", () => {
  it("returns pending tasks for an agent", async () => {
    const mockGetPending = vi.fn().mockResolvedValue([
      { taskId: "task-1", messages: [{ role: "user", content: "help", timestamp: 1 }] },
    ]);

    const queue = new AgentQueue({ getPendingTasks: mockGetPending });
    const tasks = await queue.getTasksFor("clark");
    expect(tasks).toHaveLength(1);
    expect(tasks[0].taskId).toBe("task-1");
  });

  it("returns empty array when no tasks", async () => {
    const queue = new AgentQueue({ getPendingTasks: vi.fn().mockResolvedValue([]) });
    const tasks = await queue.getTasksFor("clark");
    expect(tasks).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd hub && npx vitest run tests/queue.test.ts
```

Expected: FAIL — `AgentQueue` not found.

- [ ] **Step 3: Implement queue**

Create `hub/src/queue.ts`:

```typescript
interface QueueDeps {
  getPendingTasks: (agentName: string) => Promise<Array<{
    taskId: string;
    messages: Array<{ role: string; content: string; timestamp: number }>;
  }>>;
}

export class AgentQueue {
  private deps: QueueDeps;

  constructor(deps: QueueDeps) {
    this.deps = deps;
  }

  async getTasksFor(agentName: string) {
    return await this.deps.getPendingTasks(agentName);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd hub && npx vitest run tests/queue.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add queue endpoint to Express server**

Modify `hub/src/index.ts` — add after the Agent Card route:

```typescript
// Agent polling queue (Hub-specific extension, not A2A v1.0 spec)
app.get("/a2a/queue/:agentId", async (req, res) => {
  const { agentId } = req.params;
  const apiKey = req.headers["x-agent-key"] as string;

  if (!apiKey) {
    return res.status(401).json({ error: "Missing X-Agent-Key header" });
  }

  // TODO: validate API key against Convex agents table
  // const agent = await convex.query(api.agents.validateKey, { apiKeyHash: hash(apiKey) });

  const tasks = await queue.getTasksFor(agentId);
  res.json({ tasks });
});

// Agent heartbeat
app.post("/a2a/heartbeat/:agentId", async (req, res) => {
  const { agentId } = req.params;
  // TODO: update agent lastSeen in Convex
  res.json({ ok: true });
});
```

- [ ] **Step 6: Commit**

```bash
git add hub/src/queue.ts hub/tests/queue.test.ts hub/src/index.ts
git commit -m "feat(hub): add agent polling queue endpoint and heartbeat"
```

---

## Task 6: Telegram Mirror

**Files:**
- Create: `hub/src/telegram.ts`

- [ ] **Step 1: Create Telegram mirror module**

Create `hub/src/telegram.ts`:

```typescript
import TelegramBot from "node-telegram-bot-api";

export class TelegramMirror {
  private bot: TelegramBot;
  private groupId: string;

  constructor(token: string, groupId: string) {
    this.bot = new TelegramBot(token, { polling: true });
    this.groupId = groupId;
    this.setupCallbacks();
  }

  private setupCallbacks() {
    this.bot.on("callback_query", async (query) => {
      const data = query.data;
      if (!data) return;

      if (data.startsWith("approve:")) {
        const fixId = data.replace("approve:", "");
        this.onApprove?.(fixId, query.from.username || "unknown");
        await this.bot.answerCallbackQuery(query.id, { text: "Approved!" });
      } else if (data.startsWith("reject:")) {
        const fixId = data.replace("reject:", "");
        this.onReject?.(fixId);
        await this.bot.answerCallbackQuery(query.id, { text: "Rejected" });
      }
    });
  }

  onApprove?: (fixId: string, approvedBy: string) => void;
  onReject?: (fixId: string) => void;

  async broadcast(message: string) {
    await this.bot.sendMessage(this.groupId, message, { parse_mode: "Markdown" });
  }

  async broadcastWithApproval(message: string, fixId: string) {
    await this.bot.sendMessage(this.groupId, message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `approve:${fixId}` },
            { text: "❌ Reject", callback_data: `reject:${fixId}` },
          ],
        ],
      },
    });
  }

  async agentOnline(name: string) {
    await this.broadcast(`🟢 *${name}* connected`);
  }

  async agentOffline(name: string) {
    await this.broadcast(`🔴 *${name}* disconnected`);
  }

  async incomingQuestion(agent: string, question: string) {
    await this.broadcast(`❓ *${agent}* asks:\n${question}`);
  }

  async hubDecision(decision: string) {
    await this.broadcast(`🤖 Hub: ${decision}`);
  }

  async response(source: string, answer: string) {
    await this.broadcast(`💡 *${source}*:\n${answer}`);
  }

  async lessonStored(trigger: string, category: string) {
    await this.broadcast(`📚 Lesson stored: _${trigger}_ → category: \`${category}\``);
  }

  async proposeRepoFix(fixId: string, diffPreview: string, filePaths: string[]) {
    const message = `🔧 *Proposed repo fix*\nFiles: ${filePaths.join(", ")}\n\n\`\`\`\n${diffPreview.slice(0, 500)}\n\`\`\``;
    await this.broadcastWithApproval(message, fixId);
  }
}
```

- [ ] **Step 2: Test manually by sending a message**

Add to `hub/src/index.ts` temporarily:

```typescript
// Quick test — remove after verifying
const telegram = new TelegramMirror(process.env.TELEGRAM_BOT_TOKEN!, process.env.TELEGRAM_GROUP_ID!);
telegram.broadcast("Hub is online and connected to Telegram!");
```

Run `npm run dev` with env vars set. Verify message appears in Telegram group.

- [ ] **Step 3: Remove test code, commit**

```bash
git add hub/src/telegram.ts
git commit -m "feat(hub): add Telegram mirror with broadcast and inline approval buttons"
```

---

## Task 7: Repo Fixer

**Files:**
- Create: `hub/src/repo-fixer.ts`

- [ ] **Step 1: Create repo fixer module**

Create `hub/src/repo-fixer.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import simpleGit from "simple-git";
import { writeFileSync, readFileSync } from "fs";
import { join } from "path";

const REPO_PATH = process.env.REPO_PATH || "/tmp/Self-Improving-Agent";
const REPO_URL = "https://github.com/melvenac/Self-Improving-Agent.git";

export class RepoFixer {
  private anthropic: Anthropic;
  private git = simpleGit();

  constructor(anthropic: Anthropic) {
    this.anthropic = anthropic;
  }

  async ensureRepo() {
    try {
      await this.git.cwd(REPO_PATH).status();
      await this.git.pull();
    } catch {
      await this.git.clone(REPO_URL, REPO_PATH);
      this.git = simpleGit(REPO_PATH);
    }
  }

  async draftFix(trigger: string, action: string, category: string): Promise<{
    diffPreview: string;
    filePaths: string[];
  } | null> {
    const response = await this.anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: `You are a documentation fixer. Given an installation error and its fix, propose a specific change to the Self-Improving-Agent repo documentation or scripts that would prevent this error from happening to future users.

Respond with JSON only:
{
  "filePaths": ["getting-started/03-mcp-servers.md"],
  "changes": [
    {
      "file": "getting-started/03-mcp-servers.md",
      "description": "Add note about Node version requirement",
      "search": "exact text to find in file",
      "replace": "replacement text"
    }
  ]
}

If no repo change is needed, respond with: {"filePaths": [], "changes": []}`,
      messages: [
        {
          role: "user",
          content: `Error: ${trigger}\nFix: ${action}\nCategory: ${category}`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    try {
      const parsed = JSON.parse(text);
      if (!parsed.filePaths?.length) return null;

      // Generate diff preview
      const diffLines: string[] = [];
      for (const change of parsed.changes) {
        diffLines.push(`--- a/${change.file}`);
        diffLines.push(`+++ b/${change.file}`);
        diffLines.push(`@@ ${change.description} @@`);
        diffLines.push(`-${change.search}`);
        diffLines.push(`+${change.replace}`);
      }

      return {
        diffPreview: diffLines.join("\n"),
        filePaths: parsed.filePaths,
      };
    } catch {
      return null;
    }
  }

  async applyAndPush(changes: Array<{ file: string; search: string; replace: string }>, message: string) {
    await this.ensureRepo();

    for (const change of changes) {
      const filePath = join(REPO_PATH, change.file);
      const content = readFileSync(filePath, "utf-8");
      const updated = content.replace(change.search, change.replace);
      writeFileSync(filePath, updated);
    }

    await this.git.add(".");
    await this.git.commit(`fix: ${message}\n\nAutomated fix by A2A Hub Bot`);
    await this.git.push();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add hub/src/repo-fixer.ts
git commit -m "feat(hub): add repo fixer with LLM-drafted fixes and git push"
```

---

## Task 8: Wire Everything Together in index.ts

**Files:**
- Modify: `hub/src/index.ts`
- Create: `hub/src/escalation.ts`

- [ ] **Step 1: Create escalation module**

Create `hub/src/escalation.ts`:

```typescript
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { randomUUID } from "crypto";

export class Escalation {
  private client: ConvexHttpClient;

  constructor(convexUrl: string) {
    this.client = new ConvexHttpClient(convexUrl);
  }

  async escalateToAgent(message: string, agentName?: string): Promise<string> {
    // Find an online agent
    const agents = await this.client.query(api.agents.getOnline, {});
    const target = agentName
      ? agents.find((a: any) => a.name === agentName)
      : agents[0];

    if (!target) {
      return "No agents are currently online. Please try again later or check the documentation at https://github.com/melvenac/Self-Improving-Agent";
    }

    const taskId = randomUUID();

    // Create escalated task in Convex
    await this.client.mutation(api.tasks.create, {
      taskId,
      messages: [{ role: "user", content: message, timestamp: Date.now() }],
      assignedAgent: target.name,
    });
    await this.client.mutation(api.tasks.updateStatus, {
      taskId,
      status: "escalated",
      assignedAgent: target.name,
    });

    // Wait for response (poll with timeout)
    const timeout = 120_000; // 2 minutes
    const start = Date.now();

    while (Date.now() - start < timeout) {
      await new Promise((r) => setTimeout(r, 3000)); // check every 3s

      // Query by taskId directly — look for completed status
      const task = await this.client.query(api.tasks.getByTaskId, { taskId });
      if (task && task.status === "completed") {
        const lastMessage = task.messages[task.messages.length - 1];
        return lastMessage.content;
      }
    }

    return "Escalation timed out — the agent did not respond within 2 minutes.";
  }
}
```

- [ ] **Step 2: Wire all modules into index.ts**

Rewrite `hub/src/index.ts`:

```typescript
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { hubAgentCard } from "./agent-card.js";
import { MemoryEngine } from "./memory.js";
import { HubExecutor } from "./executor.js";
import { Classifier } from "./classifier.js";
import { Escalation } from "./escalation.js";
import { AgentQueue } from "./queue.js";
import { TelegramMirror } from "./telegram.js";
import { RepoFixer } from "./repo-fixer.js";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { createHash } from "crypto";

const app = express();
app.use(express.json());

// Initialize dependencies
const convexUrl = process.env.CONVEX_URL!;
const convex = new ConvexHttpClient(convexUrl);
const anthropic = new Anthropic();
const memory = new MemoryEngine(convexUrl);
const classifier = new Classifier(anthropic);
const escalation = new Escalation(convexUrl);
const repoFixer = new RepoFixer(anthropic);
const queue = new AgentQueue({
  getPendingTasks: (agentName) => convex.query(api.tasks.getPending, { agentName }),
});

// Telegram mirror (optional — only if env vars are set)
let telegram: TelegramMirror | null = null;
if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_GROUP_ID) {
  telegram = new TelegramMirror(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_GROUP_ID);
}

// Hub executor
const executor = new HubExecutor({
  searchMemory: (query) => memory.search(query),
  escalate: async (message) => {
    await telegram?.hubDecision("Escalating to available agent...");
    return escalation.escalateToAgent(message);
  },
  storeLesson: async (lesson) => {
    await memory.store(lesson);
    await telegram?.lessonStored(lesson.trigger, lesson.category);

    // Check if repo fix is needed
    if (["repo-docs", "repo-script", "repo-config"].includes(lesson.category)) {
      const fix = await repoFixer.draftFix(lesson.trigger, lesson.action, lesson.category);
      if (fix) {
        // Store in Convex and notify Telegram
        // TODO: get experience ID from store call
        await telegram?.proposeRepoFix("fix-id", fix.diffPreview, fix.filePaths);
      }
    }
  },
  classify: (trigger, action) => classifier.classify(trigger, action),
});

// Routes
app.get("/health", (_req, res) => {
  res.json({ status: "ok", agent: hubAgentCard.name });
});

app.get("/.well-known/agent-card.json", (_req, res) => {
  res.json(hubAgentCard);
});

// A2A message/send endpoint
app.post("/a2a/message/send", async (req, res) => {
  const apiKey = req.headers["x-agent-key"] as string;
  if (!apiKey) return res.status(401).json({ error: "Missing X-Agent-Key" });

  const message = req.body?.params?.message?.parts?.[0]?.text;
  if (!message) return res.status(400).json({ error: "No message text found" });

  const senderName = req.body?.params?.message?.role || "unknown";
  await telegram?.incomingQuestion(senderName, message);

  try {
    const result = await executor.handleMessage(message);

    if (result.answeredFromMemory) {
      await telegram?.hubDecision("Found answer in memory");
    }
    await telegram?.response(result.answeredFromMemory ? "Hub (memory)" : "Escalated agent", result.response);

    res.json({
      jsonrpc: "2.0",
      id: req.body.id || 1,
      result: {
        task: {
          status: "completed",
          artifacts: [{ parts: [{ kind: "text", text: result.response }] }],
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Wrapper response endpoint — receives answers from escalated agents
app.post("/a2a/task/:taskId/respond", async (req, res) => {
  const { taskId } = req.params;
  const apiKey = req.headers["x-agent-key"] as string;
  if (!apiKey) return res.status(401).json({ error: "Missing X-Agent-Key" });

  const responseText = req.body?.response;
  if (!responseText) return res.status(400).json({ error: "Missing response field" });

  // Add response message to task
  await convex.mutation(api.tasks.addMessage, {
    taskId,
    role: "agent",
    content: responseText,
  });

  // Mark task as completed
  await convex.mutation(api.tasks.updateStatus, {
    taskId,
    status: "completed",
  });

  res.json({ ok: true });
});

// Agent polling queue (Hub-specific extension)
app.get("/a2a/queue/:agentId", async (req, res) => {
  const { agentId } = req.params;
  const apiKey = req.headers["x-agent-key"] as string;
  if (!apiKey) return res.status(401).json({ error: "Missing X-Agent-Key" });

  const tasks = await queue.getTasksFor(agentId);
  res.json({ tasks });
});

// Agent heartbeat
app.post("/a2a/heartbeat/:agentId", async (req, res) => {
  const { agentId } = req.params;
  await convex.mutation(api.agents.heartbeat, { name: agentId });
  res.json({ ok: true });
});

// Agent registration
app.post("/a2a/register", async (req, res) => {
  const { name, apiKey, agentCard } = req.body;
  const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");

  await convex.mutation(api.agents.register, { name, apiKeyHash, agentCard });
  await telegram?.agentOnline(name);
  res.json({ ok: true, message: `Agent ${name} registered` });
});

const port = parseInt(process.env.PORT || "4000");
app.listen(port, () => {
  console.log(`Hub running on port ${port}`);
  telegram?.broadcast("Hub is online 🟢");
});
```

- [ ] **Step 3: Verify it compiles**

```bash
cd hub && npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 4: Run all tests**

```bash
cd hub && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add hub/src/
git commit -m "feat(hub): wire all modules together — executor, memory, classifier, telegram, queue, escalation"
```

---

## Task 9: Local Wrapper

**Files:**
- Create: `wrapper/package.json`
- Create: `wrapper/tsconfig.json`
- Create: `wrapper/src/index.ts`
- Create: `wrapper/src/poller.ts`
- Create: `wrapper/src/claude.ts`
- Create: `wrapper/src/config.ts`

- [ ] **Step 1: Scaffold wrapper project**

```bash
cd ~/Projects/Self-Improving-Agent
mkdir -p wrapper/src wrapper/tests
```

- [ ] **Step 2: Create package.json**

Create `wrapper/package.json`:

```json
{
  "name": "a2a-wrapper",
  "version": "1.0.0",
  "type": "module",
  "description": "Local wrapper that bridges Claude Code CLI to an A2A Hub",
  "bin": { "a2a-wrapper": "dist/index.js" },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "commander": "latest"
  },
  "devDependencies": {
    "@types/node": "latest",
    "tsx": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

Create `wrapper/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Create config parser**

Create `wrapper/src/config.ts`:

```typescript
import { Command } from "commander";

export interface WrapperConfig {
  hubUrl: string;
  apiKey: string;
  agentName: string;
  pollInterval: number;
}

export function parseConfig(): WrapperConfig {
  const program = new Command();
  program
    .requiredOption("--hub <url>", "Hub URL (e.g., https://sandbox.tarrantcountymakerspace.com)")
    .requiredOption("--key <apiKey>", "API key for authenticating with the Hub")
    .requiredOption("--name <agentName>", "Agent name (e.g., clark, alice)")
    .option("--poll-interval <ms>", "Polling interval in milliseconds", "5000")
    .parse();

  const opts = program.opts();
  return {
    hubUrl: opts.hub,
    apiKey: opts.key,
    agentName: opts.name,
    pollInterval: parseInt(opts.pollInterval),
  };
}
```

- [ ] **Step 5: Create Claude Code bridge**

Create `wrapper/src/claude.ts`:

```typescript
import { execSync } from "child_process";

export async function askClaude(prompt: string): Promise<string> {
  try {
    const escaped = prompt.replace(/"/g, '\\"');
    const result = execSync(`claude --print "${escaped}"`, {
      encoding: "utf-8",
      timeout: 120_000, // 2 minute timeout
      maxBuffer: 1024 * 1024 * 10, // 10MB
    });
    return result.trim();
  } catch (error: any) {
    return `Error running claude --print: ${error.message}`;
  }
}
```

- [ ] **Step 6: Create poller**

Create `wrapper/src/poller.ts`:

```typescript
import type { WrapperConfig } from "./config.js";
import { askClaude } from "./claude.js";

export class Poller {
  private config: WrapperConfig;
  private running = false;

  constructor(config: WrapperConfig) {
    this.config = config;
  }

  async register() {
    const response = await fetch(`${this.config.hubUrl}/a2a/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: this.config.agentName,
        apiKey: this.config.apiKey,
        agentCard: {
          name: this.config.agentName,
          description: `Claude Code agent: ${this.config.agentName}`,
          skills: [],
        },
      }),
    });
    const data = await response.json();
    console.log(`Registered: ${data.message}`);
  }

  async heartbeat() {
    await fetch(`${this.config.hubUrl}/a2a/heartbeat/${this.config.agentName}`, {
      method: "POST",
      headers: { "X-Agent-Key": this.config.apiKey },
    }).catch(() => {}); // silent fail on heartbeat
  }

  async pollOnce(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.config.hubUrl}/a2a/queue/${this.config.agentName}`,
        { headers: { "X-Agent-Key": this.config.apiKey } }
      );
      const data = await response.json();

      if (data.tasks && data.tasks.length > 0) {
        for (const task of data.tasks) {
          const lastMessage = task.messages[task.messages.length - 1];
          console.log(`Task ${task.taskId}: ${lastMessage.content.slice(0, 80)}...`);

          // Pipe to Claude Code
          const answer = await askClaude(lastMessage.content);
          console.log(`Response: ${answer.slice(0, 80)}...`);

          // Send response back to Hub via dedicated response endpoint
          await fetch(`${this.config.hubUrl}/a2a/task/${task.taskId}/respond`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Agent-Key": this.config.apiKey,
            },
            body: JSON.stringify({ response: answer }),
          });
        }
        return true;
      }
      return false;
    } catch (error: any) {
      console.error(`Poll error: ${error.message}`);
      return false;
    }
  }

  async start() {
    this.running = true;
    console.log(`Wrapper started for ${this.config.agentName}`);
    console.log(`Polling ${this.config.hubUrl} every ${this.config.pollInterval}ms`);

    await this.register();

    // Heartbeat every 30s
    const heartbeatInterval = setInterval(() => this.heartbeat(), 30_000);

    // Poll loop
    while (this.running) {
      await this.pollOnce();
      await new Promise((r) => setTimeout(r, this.config.pollInterval));
    }

    clearInterval(heartbeatInterval);
  }

  stop() {
    this.running = false;
  }
}
```

- [ ] **Step 7: Create entry point**

Create `wrapper/src/index.ts`:

```typescript
#!/usr/bin/env node
import { parseConfig } from "./config.js";
import { Poller } from "./poller.js";

const config = parseConfig();
const poller = new Poller(config);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down wrapper...");
  poller.stop();
  process.exit(0);
});

poller.start();
```

- [ ] **Step 8: Install dependencies and verify**

```bash
cd wrapper && npm install && npx tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
git add wrapper/
git commit -m "feat(wrapper): add local A2A wrapper with polling, heartbeat, and Claude Code bridge"
```

---

## Task 10: Dockerfile & Coolify Deployment

**Files:**
- Create: `hub/Dockerfile`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Create Dockerfile**

Create `hub/Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install git for repo-fixer
RUN apk add --no-cache git

COPY package*.json ./
RUN npm ci --production

COPY dist/ ./dist/
COPY convex/ ./convex/

EXPOSE 4000

CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Create .dockerignore**

Create `hub/.dockerignore`:

```
node_modules
src
tests
*.ts
!dist/**/*.js
```

- [ ] **Step 3: Test Docker build locally**

```bash
cd hub && npm run build && docker build -t a2a-hub .
```

- [ ] **Step 4: Update CHANGELOG**

Add to `CHANGELOG.md`:

```markdown
## [v4.0.0] - 2026-03-XX

### Added
- A2A Intelligent Hub — persistent A2A-compliant agent for agent-to-agent communication
- Local wrapper for bridging Claude Code CLI to the Hub
- Convex-backed knowledge base with experience storage and search
- Telegram mirror for human visibility and repo fix approvals
- Self-correcting repo loop — Hub proposes and commits doc/script fixes
- LLM root cause classifier for installation issues
```

- [ ] **Step 5: Commit**

```bash
git add hub/Dockerfile hub/.dockerignore CHANGELOG.md
git commit -m "feat(hub): add Dockerfile for Coolify deployment"
```

---

## Task 11: End-to-End Integration Test

**Files:**
- Create: `hub/tests/integration.test.ts`

- [ ] **Step 1: Write integration test**

Create `hub/tests/integration.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { HubExecutor } from "../src/executor.js";

describe("End-to-end flow", () => {
  it("complete flow: receive → memory miss → escalate → store → classify", async () => {
    const stored: any[] = [];

    const executor = new HubExecutor({
      searchMemory: vi.fn().mockResolvedValue({ confidence: 0.2, experience: null }),
      escalate: vi.fn().mockResolvedValue("Run: cp scripts/vault-writer.mjs ~/.claude/knowledge-mcp/scripts/"),
      storeLesson: vi.fn().mockImplementation((lesson) => { stored.push(lesson); }),
      classify: vi.fn().mockResolvedValue("repo-docs"),
    });

    const result = await executor.handleMessage("vault-writer.mjs not found");

    expect(result.answeredFromMemory).toBe(false);
    expect(result.response).toContain("vault-writer.mjs");
    expect(result.category).toBe("repo-docs");
    expect(stored).toHaveLength(1);
    expect(stored[0].category).toBe("repo-docs");
  });

  it("complete flow: receive → memory hit → answer directly", async () => {
    const executor = new HubExecutor({
      searchMemory: vi.fn().mockResolvedValue({
        confidence: 0.95,
        experience: {
          trigger: "npm ERR! ERESOLVE",
          action: "npm install --legacy-peer-deps",
          outcome: "Install succeeds",
        },
      }),
      escalate: vi.fn(),
      storeLesson: vi.fn(),
      classify: vi.fn(),
    });

    const result = await executor.handleMessage("npm ERR! code ERESOLVE");

    expect(result.answeredFromMemory).toBe(true);
    expect(result.response).toContain("legacy-peer-deps");
  });
});
```

- [ ] **Step 2: Run all tests**

```bash
cd hub && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add hub/tests/integration.test.ts
git commit -m "test(hub): add end-to-end integration tests for Hub decision flow"
```

---

## Task 12: Deploy to Coolify & Test with Brian

- [ ] **Step 1: Push to GitHub**

```bash
cd ~/Projects/Self-Improving-Agent
git push origin master
```

- [ ] **Step 2: Deploy Hub on Coolify**

1. Log into Coolify at your VPS
2. Create new service → Docker → point to `hub/Dockerfile` in your repo
3. Set environment variables from `.env.example`
4. Set domain: `sandbox.tarrantcountymakerspace.com`
5. Deploy

- [ ] **Step 3: Verify deployment**

```bash
curl https://sandbox.tarrantcountymakerspace.com/health
curl https://sandbox.tarrantcountymakerspace.com/.well-known/agent-card.json
```

- [ ] **Step 4: Deploy self-hosted Convex on Coolify**

Deploy Convex as a separate service on Coolify. Configure Hub's `CONVEX_URL` to point to the internal Docker network address.

- [ ] **Step 5: Test with Brian**

1. Send Brian the wrapper: `cd wrapper && npm run build`
2. Brian runs: `node dist/index.js --hub https://sandbox.tarrantcountymakerspace.com --key <his-key> --name alice`
3. Create a Telegram group with Aaron, Brian, and the bot
4. Alice sends a test question
5. Verify: message appears in Telegram, Hub processes it, Clark responds

- [ ] **Step 6: Tag release**

```bash
git tag -a v4.0.0 -m "A2A Intelligent Hub v1"
git push origin master --tags
```
