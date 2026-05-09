import { resolve, join } from "node:path";
import { homedir } from "node:os";

export function canonicalizeProjectDir(p?: string | null): string | null {
  if (!p) return null;
  const trimmed = p.trim();
  if (!trimmed) return null;

  let result = trimmed.replace(/\\/g, "/").replace(/\/+/g, "/");

  if (/^[a-zA-Z]:/.test(result)) {
    result = result.toLowerCase();
  }

  if (result.length > 3 && result.endsWith("/")) {
    result = result.replace(/\/+$/, "");
  }

  return result;
}

export interface ResolvedPaths {
  projectRoot: string;
  packageJson: string;
  readme: string;
  changelog: string;
  claudeMd: string;
  prd: string;
  knowledgeMcpPackageJson: string;
  settingsJson: string;
  obsidianVault: string;
  knowledgeDb: string;
  scoreHistory: string;
  projectTemplate: string;
  hooksDir: string;
}

export function resolvePaths(projectRoot: string): ResolvedPaths {
  const home = homedir();
  return {
    projectRoot: resolve(projectRoot),
    packageJson: join(projectRoot, "package.json"),
    readme: join(projectRoot, "README.md"),
    changelog: join(projectRoot, "CHANGELOG.md"),
    claudeMd: join(projectRoot, "CLAUDE.md"),
    prd: join(projectRoot, "docs", "PRD.md"),
    knowledgeMcpPackageJson: join(projectRoot, "knowledge-mcp", "package.json"),
    settingsJson: join(home, ".claude", "settings.json"),
    obsidianVault: join(home, "Obsidian Vault"),
    knowledgeDb: join(home, ".claude", "context-mode", "knowledge.db"),
    scoreHistory: join(home, ".claude", "knowledge-mcp", "score-history.jsonl"),
    projectTemplate: join(projectRoot, "project-template"),
    hooksDir: join(projectRoot, "knowledge-mcp", "scripts"),
  };
}
