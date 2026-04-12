import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function findNextSessionNumber(projectRoot: string): number {
  const sessionsDir = join(projectRoot, ".agents", "SESSIONS");
  if (!existsSync(sessionsDir)) return 1;

  const files = readdirSync(sessionsDir);
  const numbers = files
    .filter((f) => /^Session_\d+\.md$/.test(f))
    .map((f) => parseInt(f.match(/Session_(\d+)\.md/)![1], 10));

  if (numbers.length === 0) return 1;
  return Math.max(...numbers) + 1;
}

export function createSessionLog(
  projectRoot: string,
  sessionNumber: number,
  sessionId: string | null,
  date: string
): string {
  const sessionsDir = join(projectRoot, ".agents", "SESSIONS");
  const templatePath = join(sessionsDir, "SESSION_TEMPLATE.md");
  const logPath = join(sessionsDir, `Session_${sessionNumber}.md`);

  let content: string;
  if (existsSync(templatePath)) {
    content = readFileSync(templatePath, "utf-8");
  } else {
    content = "# Session N — [Date]\n\n> **Objective:** [TBD]\n> **Status:** In Progress\n";
  }

  content = content.replace("Session N", `Session ${sessionNumber}`);
  content = content.replace("[Date]", date);

  if (sessionId) {
    content = content.replace(
      /^(>.*Status:.*$)/m,
      `> **Session ID:** ${sessionId}\n$1`
    );
  }

  writeFileSync(logPath, content, "utf-8");
  return logPath;
}
