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
