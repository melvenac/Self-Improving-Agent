import { execSync } from "child_process";

export async function askClaude(prompt: string): Promise<string> {
  try {
    const escaped = prompt.replace(/"/g, '\\"');
    const result = execSync(`claude --print "${escaped}"`, {
      encoding: "utf-8",
      timeout: 120_000,
      maxBuffer: 1024 * 1024 * 10,
    });
    return result.trim();
  } catch (error: any) {
    return `Error running claude --print: ${error.message}`;
  }
}
