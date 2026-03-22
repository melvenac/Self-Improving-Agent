import type { AgentCard } from "@a2a-js/sdk";

export const hubAgentCard: AgentCard = {
  name: "Intelligent-Hub",
  description:
    "Persistent AI mediator for Self-Improving-Agent installation support. Accumulates knowledge from every interaction and self-corrects the repo.",
  url: process.env.HUB_URL
    ? `${process.env.HUB_URL}/a2a`
    : "https://sandbox.tarrantcountymakerspace.com/a2a",
  protocolVersion: "1.0",
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
      type: "apiKey",
      name: "X-Agent-Key",
      in: "header",
    },
  },
  security: [{ apiKey: [] }],
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
