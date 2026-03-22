import Anthropic from "@anthropic-ai/sdk";
import simpleGit from "simple-git";
import { writeFileSync, readFileSync } from "fs";
import { join } from "path";

const REPO_PATH = process.env.REPO_PATH || "/tmp/Self-Improving-Agent";
const REPO_URL = "https://github.com/melvenac/Self-Improving-Agent.git";

export class RepoFixer {
  private anthropic: Anthropic;
  private git = simpleGit();

  constructor(anthropic: Anthropic) {
    this.anthropic = anthropic;
  }

  async ensureRepo() {
    try {
      await this.git.cwd(REPO_PATH).status();
      await this.git.pull();
    } catch {
      await this.git.clone(REPO_URL, REPO_PATH);
      this.git = simpleGit(REPO_PATH);
    }
  }

  async draftFix(trigger: string, action: string, category: string): Promise<{
    diffPreview: string;
    filePaths: string[];
  } | null> {
    const response = await this.anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: `You are a documentation fixer. Given an installation error and its fix, propose a specific change to the Self-Improving-Agent repo documentation or scripts that would prevent this error from happening to future users.

Respond with JSON only:
{
  "filePaths": ["getting-started/03-mcp-servers.md"],
  "changes": [
    {
      "file": "getting-started/03-mcp-servers.md",
      "description": "Add note about Node version requirement",
      "search": "existing text to find",
      "replace": "replacement text with fix"
    }
  ]
}`,
      messages: [
        {
          role: "user",
          content: `Category: ${category}\nTrigger: ${trigger}\nFix: ${action}`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    try {
      const parsed = JSON.parse(text);
      if (!parsed.filePaths?.length) return null;

      // Generate diff preview
      const diffLines: string[] = [];
      for (const change of parsed.changes) {
        diffLines.push(`--- a/${change.file}`);
        diffLines.push(`+++ b/${change.file}`);
        diffLines.push(`@@ ${change.description} @@`);
        diffLines.push(`-${change.search}`);
        diffLines.push(`+${change.replace}`);
      }

      return {
        diffPreview: diffLines.join("\n"),
        filePaths: parsed.filePaths,
      };
    } catch {
      return null;
    }
  }

  async applyAndPush(changes: Array<{ file: string; search: string; replace: string }>, message: string) {
    await this.ensureRepo();

    for (const change of changes) {
      const filePath = join(REPO_PATH, change.file);
      const content = readFileSync(filePath, "utf-8");
      const updated = content.replace(change.search, change.replace);
      writeFileSync(filePath, updated);
    }

    await this.git.add(".");
    await this.git.commit(`fix: ${message}\n\nAutomated fix by A2A Hub Bot`);
    await this.git.push();
  }
}
