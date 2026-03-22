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
