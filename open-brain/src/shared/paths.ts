import { resolve, join } from "node:path";
import { existsSync, readdirSync } from "node:fs";
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
 * Human-facing project name for vault folders, filenames and frontmatter.
 *
 * Takes the **raw** project directory, never the canonical one. A canonical form
 * is for comparison, not display: `canonicalizeProjectDir` lowercases the entire
 * path when it starts with a drive letter, so rebuilding a name from its output
 * yields `self-improving-agent` where the real directory is
 * `Self-Improving-Agent`.
 *
 * That mistake is invisible on Windows — the filesystem is case-insensitive, so
 * both spellings resolve to one folder, parity checks pass and nothing dangles.
 * On Linux or macOS it silently creates a *second* project folder, which
 * `skill-scan` then counts as a separate project. Two rows (#235, #365) were
 * written that way before this existed.
 */
export function projectDisplayName(rawProjectDir?: string | null, fallback = "General"): string {
  if (!rawProjectDir) return fallback;
  const segments = rawProjectDir.replace(/[/\\]+$/, "").split(/[/\\]/).filter(Boolean);
  return segments.pop() || fallback;
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
  const override = process.env.OPEN_BRAIN_VAULT_DIR;
  if (override) return override;

  const resolved = join(home, "Obsidian Vault v2");

  // Resolving to the developer's REAL vault during a test run means the
  // isolation in tests/setup-env.ts has been torn down — historically by an
  // `afterEach` that `delete`d the override instead of restoring it. The
  // failure is silent by construction: an unset variable *means* "use
  // production", so absent and configured are the same value from in here, and
  // the only symptom is session summaries appearing in the user's notes (57
  // before April, 13 more on 2026-08-31). Fail loudly instead.
  //
  // Only the real home is refused. A test asserting path composition against a
  // synthetic home is deliberate and still allowed.
  const underTest = process.env.VITEST || process.env.VITEST_WORKER_ID;
  if (underTest && resolved === join(homedir(), "Obsidian Vault v2")) {
    throw new Error(
      "obsidianVaultDir() resolved to the real Obsidian vault during a test run. " +
        "OPEN_BRAIN_VAULT_DIR is unset — restore it in teardown rather than deleting it " +
        "(tests/setup-env.ts sets it globally and re-asserts after each test)."
    );
  }

  return resolved;
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

/**
 * Does a project directory exist, given its CANONICAL form?
 *
 * `canonicalizeProjectDir` lowercases drive-letter paths so two spellings of
 * one directory compare equal. That form is an identity key — for comparison,
 * never for filesystem access (path-normalization §10). Handing it to
 * `existsSync` works on NTFS by accident and fails on ext4/APFS, where a
 * lowercased path is a different path; master's CI was red on exactly that
 * for two weeks. So: try the path as given, then walk it component by
 * component from its root, matching each segment against the parent's
 * directory listing case-insensitively. Resolves on both kinds of filesystem.
 */
export function projectDirExists(canonicalPath: string): boolean {
  if (!canonicalPath) return false;
  if (existsSync(canonicalPath)) return true;
  return existsCaseInsensitive(canonicalPath);
}

/** The component walk on its own, so tests can exercise it on any filesystem. */
export function existsCaseInsensitive(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter((p) => p.length > 0);
  if (parts.length === 0) return false;

  let current: string;
  if (/^[a-zA-Z]:$/.test(parts[0])) {
    current = parts.shift()! + "/";
  } else if (normalized.startsWith("/")) {
    current = "/";
  } else {
    current = ".";
  }

  for (const part of parts) {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return false;
    }
    const want = part.toLowerCase();
    const listed = entries.find((e) => e === part) ?? entries.find((e) => e.toLowerCase() === want);
    // A name the filesystem resolves but readdir never lists: a Windows 8.3 short
    // alias such as AARONM~1, which is what os.tmpdir() returns in some launch
    // contexts. Accept the segment as given when it resolves. On a case-sensitive
    // filesystem this changes nothing: no case-insensitive entry means no exact one.
    const next = current.endsWith("/") ? current + (listed ?? part) : `${current}/${listed ?? part}`;
    if (listed === undefined && !existsSync(next)) return false;
    current = next;
  }
  return existsSync(current);
}
