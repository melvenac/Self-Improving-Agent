import { describe, it, expect, vi } from "vitest";
import { HubExecutor } from "../src/executor.js";

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

  it("complete flow: receive → memory hit → answer directly", async () => {
    const executor = new HubExecutor({
      searchMemory: vi.fn().mockResolvedValue({
        confidence: 0.95,
        experience: {
          trigger: "npm ERR! ERESOLVE",
          action: "npm install --legacy-peer-deps",
          outcome: "Install succeeds",
        },
      }),
      escalate: vi.fn(),
      storeLesson: vi.fn(),
      classify: vi.fn(),
    });

    const result = await executor.handleMessage("npm ERR! code ERESOLVE");

    expect(result.answeredFromMemory).toBe(true);
    expect(result.response).toContain("legacy-peer-deps");
  });
});
