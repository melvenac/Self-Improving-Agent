import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readJson } from "../../shared/fs-utils.js";
import type { ProjectState, SessionMode } from "./types.js";

export function readProjectState(projectRoot: string): ProjectState {
  const hasAgents = existsSync(join(projectRoot, ".agents"));
  const hasMeta = existsSync(join(projectRoot, ".agents", "META"));

  let mode: SessionMode = "lightweight";
  if (hasAgents && hasMeta) mode = "meta";
  else if (hasAgents) mode = "project";

  const pkg = readJson<{ version: string }>(join(projectRoot, "package.json"));
  const version = pkg?.version ?? "0.0.0";

  const summaryDir = hasMeta ? ".agents/META" : ".agents/SYSTEM";
  const summary = readOptional(join(projectRoot, summaryDir, "SUMMARY.md"));
  const inbox = readOptional(join(projectRoot, ".agents/TASKS/INBOX.md"));
  const taskFile = readOptional(join(projectRoot, ".agents/TASKS/task.md"));
  const nextSession = readOptional(join(projectRoot, ".agents/SESSIONS/next-session.md"));

  return { mode, version, summary, inbox, taskFile, nextSession, hasAgents, hasMeta };
}

function readOptional(path: string, maxLines = 50): string | null {
  if (!existsSync(path)) return null;
  const content = readFileSync(path, "utf-8");
  const lines = content.split("\n");
  if (lines.length > maxLines) {
    return lines.slice(0, maxLines).join("\n") + "\n...(truncated)";
  }
  return content;
}
