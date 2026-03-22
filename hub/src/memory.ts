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
    const best = results[0];
    return {
      confidence: best.confidence,
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
