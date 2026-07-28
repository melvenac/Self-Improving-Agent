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
  settingsJson: string;
  obsidianVault: string;
  knowledgeDb: string;
  knowledgeV2Db: string;
  scoreHistory: string;
  projectTemplate: string;
}

export function resolvePaths(projectRoot: string): ResolvedPaths {
  const home = homedir();
  return {
    projectRoot: resolve(projectRoot),
    packageJson: join(projectRoot, "package.json"),
    readme: join(projectRoot, "README.md"),
    changelog: join(projectRoot, "CHANGELOG.md"),
    claudeMd: join(projectRoot, "CLAUDE.md"),
    settingsJson: join(home, ".claude", "settings.json"),
    obsidianVault: join(home, "Obsidian Vault"),
    // NOTE: this is the legacy v1 knowledge.db, still read by the cli.ts scoring
    // path. The MCP server scores against knowledge-v2.db. Porting cli.ts to v2
    // is tracked separately — do not repoint this without migrating that caller,
    // which expects the v1 schema via createDb().
    knowledgeDb: join(home, ".claude", "context-mode", "knowledge.db"),
    // The live v2 database. Both the MCP server and the CLI score against this;
    // they previously read different databases and reported different scores.
    knowledgeV2Db: process.env.KNOWLEDGE_V2_DB
      || join(home, ".claude", "open-brain", "knowledge-v2.db"),
    scoreHistory: join(home, ".claude", "open-brain", "score-history.jsonl"),
    projectTemplate: join(projectRoot, "project-template"),
  };
}
