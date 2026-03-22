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
