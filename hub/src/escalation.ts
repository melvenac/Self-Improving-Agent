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
    const agents = await this.client.query(api.agents.listOnline, {});
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

      const task = await this.client.query(api.tasks.getByTaskId, { taskId });
      if (task && task.status === "completed") {
        const lastMessage = task.messages[task.messages.length - 1];
        return lastMessage.content;
      }
    }

    return "Escalation timed out — the agent did not respond within 2 minutes.";
  }
}
