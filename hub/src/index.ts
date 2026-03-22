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

// Wrapper response endpoint
app.post("/a2a/task/:taskId/respond", async (req, res) => {
  const { taskId } = req.params;
  const apiKey = req.headers["x-agent-key"] as string;
  if (!apiKey) return res.status(401).json({ error: "Missing X-Agent-Key" });

  const responseText = req.body?.response;
  if (!responseText) return res.status(400).json({ error: "Missing response field" });

  await convex.mutation(api.tasks.addMessage, {
    taskId,
    role: "agent",
    content: responseText,
  });

  await convex.mutation(api.tasks.updateStatus, {
    taskId,
    status: "completed",
  });

  res.json({ ok: true });
});

// Agent polling queue
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
