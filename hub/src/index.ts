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

// Agent polling queue (Hub-specific extension)
app.get("/a2a/queue/:agentId", async (req, res) => {
  const { agentId } = req.params;
  const apiKey = req.headers["x-agent-key"] as string;
  if (!apiKey) return res.status(401).json({ error: "Missing X-Agent-Key" });

  // TODO: Wire to actual queue in Task 8
  res.json({ tasks: [] });
});

// Agent registration
app.post("/a2a/register", async (req, res) => {
  const { name, apiKey, agentCard } = req.body;
  // TODO: Wire to Convex in Task 8
  res.json({ ok: true, message: `Agent ${name} registered` });
});

// Agent heartbeat
app.post("/a2a/heartbeat/:agentId", async (req, res) => {
  const { agentId } = req.params;
  // TODO: Wire to Convex in Task 8
  res.json({ ok: true });
});

const port = parseInt(process.env.PORT || "4000");
app.listen(port, () => {
  console.log(`Hub running on port ${port}`);
  console.log(`Agent Card at http://localhost:${port}/.well-known/agent-card.json`);
});
