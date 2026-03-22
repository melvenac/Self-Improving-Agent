import { describe, it, expect, vi } from "vitest";
import { HubExecutor } from "../src/executor.js";

describe("HubExecutor", () => {
  it("answers from memory when confidence is high", async () => {
    const executor = new HubExecutor({
      searchMemory: vi.fn().mockResolvedValue({
        confidence: 0.9,
        experience: {
          trigger: "npm ERR! ERESOLVE",
          action: "Run: npm install --legacy-peer-deps",
          outcome: "Resolved peer dependency conflict",
        },
      }),
      escalate: vi.fn(),
      storeLesson: vi.fn(),
      classify: vi.fn(),
    });

    const result = await executor.handleMessage("npm ERR! ERESOLVE peer dependency");
    expect(result.answeredFromMemory).toBe(true);
    expect(result.response).toContain("--legacy-peer-deps");
  });

  it("escalates when memory confidence is low", async () => {
    const escalateFn = vi.fn().mockResolvedValue("Try reinstalling Node.js");

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
});
