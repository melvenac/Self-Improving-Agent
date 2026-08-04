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

/**
 * The live Obsidian vault. Single source of truth — every caller imports this
 * instead of re-joining the literal.
 *
 * The v2 rebuild was a clean slate, not a migration, so both vaults still exist
 * on disk with near-identical names. Code that hard-coded the old name kept
 * resolving to the abandoned v1 directory: session captures landed in v2 while
 * the health check looked for them in v1, so SessionStart reported "session-end
 * may be failing" on every launch for months while the pipeline was healthy.
 * Keeping the string in one place is what makes that class of bug impossible
 * rather than merely fixed.
 */
export function obsidianVaultDir(home: string = homedir()): string {
  return process.env.OPEN_BRAIN_VAULT_DIR || join(home, "Obsidian Vault v2");
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
  shadowLog: string;
  activeSession: string;
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
    obsidianVault: obsidianVaultDir(home),
    // NOTE: this is the legacy v1 knowledge.db, still read by the cli.ts scoring
    // path. The MCP server scores against knowledge-v2.db. Porting cli.ts to v2
    // is tracked separately — do not repoint this without migrating that caller,
    // which expects the v1 schema via createDb().
    knowledgeDb: join(home, ".claude", "context-mode", "knowledge.db"),
    // The live v2 database. Both the MCP server and the CLI score against this;
    // they previously read different databases and reported different scores.
    knowledgeV2Db: process.env.KNOWLEDGE_V2_DB
      || join(home, ".claude", "open-brain", "knowledge-v2.db"),
    // These two are keyed off $HOME, not projectRoot, so a caller passing a temp
    // project_root still writes to the real history. The env overrides exist so
    // tests can redirect them — without one, running the test suite appended a
    // junk entry to the production score history on every run, corrupting the
    // trend that Pipeline Health scores.
    scoreHistory: process.env.OPEN_BRAIN_SCORE_HISTORY
      || join(home, ".claude", "open-brain", "score-history.jsonl"),
    // Deliberately NOT the v1 path (~/.claude/knowledge-mcp/shadow-recall.jsonl).
    // Those 7 entries score a different metric against a retired ranking engine;
    // mixing them into the new history would average incomparable numbers.
    shadowLog: process.env.OPEN_BRAIN_SHADOW_LOG
      || join(home, ".claude", "open-brain", "shadow-recall.jsonl"),
    // Written by the SessionStart hook, read by ob_set_session when the agent
    // has no UUID to pass — the IDE-agnostic path. See shared/active-session.ts.
    activeSession: process.env.OPEN_BRAIN_ACTIVE_SESSION
      || join(home, ".claude", "open-brain", "active-session.json"),
    projectTemplate: join(projectRoot, "project-template"),
  };
}
