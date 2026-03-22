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
    }).catch(() => {});
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

          const answer = await askClaude(lastMessage.content);
          console.log(`Response: ${answer.slice(0, 80)}...`);

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

    const heartbeatInterval = setInterval(() => this.heartbeat(), 30_000);

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
