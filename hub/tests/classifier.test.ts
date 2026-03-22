import { describe, it, expect, vi } from "vitest";
import { Classifier } from "../src/classifier.js";

describe("Classifier", () => {
  it("returns a valid category", async () => {
    const mockAnthropic = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "repo-docs" }],
        }),
      },
    };

    const classifier = new Classifier(mockAnthropic as any);
    const result = await classifier.classify(
      "vault-writer.mjs not found",
      "Copy vault-writer.mjs from scripts/ to ~/.claude/knowledge-mcp/scripts/"
    );

    expect(result).toBe("repo-docs");
  });

  it("defaults to user-error for unknown categories", async () => {
    const mockAnthropic = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "something-invalid" }],
        }),
      },
    };

    const classifier = new Classifier(mockAnthropic as any);
    const result = await classifier.classify("test", "test");
    expect(result).toBe("user-error");
  });
});
