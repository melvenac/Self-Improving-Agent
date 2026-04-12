import { resolve, join } from "node:path";
import { homedir } from "node:os";

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
