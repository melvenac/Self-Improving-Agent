import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import Database from "better-sqlite3";
import type { CheckResult, SyncRuntime } from "./types.js";
import { parseSkillIndexRows } from "../../shared/skill-index.js";
import { SCHEMA_VERSION } from "../../db-v2.js";
import { parseState } from "../../shared/state-schema.js";
import { checkSummaryFromState } from "./checks-state.js";

/**
 * Slash-command files that are deliberately NOT mirrored, with the reason.
 * Anything drifting outside this list is real drift and fails the parity check.
 * Decisions recorded in Session 36.
 */
export const MIRROR_EXCEPTIONS: Record<string, string> = {
  "harness-audit.md": "repo-root only — SIA maintenance command, not for consumers",
  "notebooklm.md": "user-global only — personal workflow, never distributed",
  "transcript.md": "retracted from the template in Session 36",
  "bootstrap.md": "template only — consumers scaffold with it, SIA does not",
};

/**
 * The slash commands Cursor is meant to receive.
 *
 * Cursor deliberately gets the session-lifecycle subset, not every command:
 * `bootstrap`, `task` and `test` are Claude Code workflows that
 * have no Cursor equivalent. Declared here rather than left implicit, because a
 * deliberate omission and a forgotten one are indistinguishable by looking at
 * the directory — mirror parity only compares files present in both sides, so
 * a command silently dropped from the template would never be flagged.
 */
export const CURSOR_COMMAND_SET = ["checkpoint.md", "end.md", "start.md", "sync.md"];

export function syncReadmeVersion(
  version: string,
  projectRoot: string,
  checkOnly: boolean
): CheckResult {
  const readmePath = join(projectRoot, "README.md");
  if (!existsSync(readmePath)) {
    return { name: "readme-version", severity: "warn", message: "README.md not found" };
  }

  const content = readFileSync(readmePath, "utf-8");
  const pattern = /\*\*Latest: v[\d.]+\*\*/;
  const expected = `**Latest: v${version}**`;

  if (content.includes(expected)) {
    return { name: "readme-version", severity: "pass", message: `README version matches v${version}` };
  }

  if (!pattern.test(content)) {
    return { name: "readme-version", severity: "warn", message: "No version pattern found in README.md" };
  }

  if (checkOnly) {
    return { name: "readme-version", severity: "issue", message: `README version does not match v${version}` };
  }

  const fixed = content.replace(pattern, expected);
  writeFileSync(readmePath, fixed, "utf-8");
  return { name: "readme-version", severity: "fixed", message: `README version updated to v${version}`, autoFixed: true };
}

/**
 * Resolve a project document across the locations the framework supports.
 * `.agents/SYSTEM/` is the convention (matching checkSummary); `docs/` and the
 * repo root are legacy fallbacks so older layouts keep working.
 */
export function resolveDocPath(projectRoot: string, filename: string): string | null {
  const candidates = [
    join(projectRoot, ".agents", "SYSTEM", filename),
    join(projectRoot, "docs", filename),
    join(projectRoot, filename),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

export function syncPrdVersion(
  version: string,
  projectRoot: string,
  checkOnly: boolean
): CheckResult {
  const prdPath = resolveDocPath(projectRoot, "PRD.md");
  if (!prdPath) {
    return { name: "prd-version", severity: "warn", message: "PRD.md not found" };
  }

  const content = readFileSync(prdPath, "utf-8");

  // Tolerate the styles that appear across the framework and its consumers:
  //   | Version | 0.7.1 |      | **Version** | v0.7.1 |
  // Captures let us rewrite the number while preserving the author's bolding
  // and optional "v" prefix.
  const pattern = /(\|\s*\*{0,2}Version\*{0,2}\s*\|\s*)(v?)([\d.]+)(\s*\|)/;
  const match = content.match(pattern);

  if (!match) {
    return { name: "prd-version", severity: "warn", message: "No version pattern found in PRD.md" };
  }

  if (match[3] === version) {
    return { name: "prd-version", severity: "pass", message: `PRD version matches ${version}` };
  }

  if (checkOnly) {
    return { name: "prd-version", severity: "issue", message: `PRD version does not match ${version}` };
  }

  const fixed = content.replace(pattern, `$1$2${version}$4`);
  writeFileSync(prdPath, fixed, "utf-8");
  return { name: "prd-version", severity: "fixed", message: `PRD version updated to ${version}`, autoFixed: true };
}

export function checkChangelog(version: string, projectRoot: string): CheckResult {
  const changelogPath = join(projectRoot, "CHANGELOG.md");
  if (!existsSync(changelogPath)) {
    return { name: "changelog", severity: "warn", message: "CHANGELOG.md not found" };
  }
  const content = readFileSync(changelogPath, "utf-8");
  const pattern = new RegExp(`## \\[v?${version.replace(/\./g, "\\.")}\\]`);
  if (pattern.test(content)) {
    return { name: "changelog", severity: "pass", message: `CHANGELOG.md has entry for v${version}` };
  }
  return { name: "changelog", severity: "issue", message: `CHANGELOG.md missing entry for v${version}` };
}

export function checkReadmeRefs(projectRoot: string): CheckResult {
  const readmePath = join(projectRoot, "README.md");
  if (!existsSync(readmePath)) {
    return { name: "readme-refs", severity: "warn", message: "README.md not found" };
  }
  const content = readFileSync(readmePath, "utf-8");
  // Leading segments are part of the path, not context around it. The old
  // pattern started at `scripts/`, so `open-brain/scripts/dashboard.mjs` matched
  // only its tail and was then resolved from the repo root, where nothing sits —
  // reporting a file that had *moved into a subdirectory* as one that had been
  // deleted. The lookbehind stops a match beginning mid-path.
  const refPattern = /(?<![\w/.-])(?:[\w.-]+\/)*scripts\/[\w./-]+/g;
  const refs = [...new Set(content.match(refPattern) ?? [])];
  const missing = refs.filter((ref) => !existsSync(join(projectRoot, ref)));
  if (missing.length > 0) {
    return { name: "readme-refs", severity: "issue", message: `README references missing files: ${missing.join(", ")}` };
  }
  return { name: "readme-refs", severity: "pass", message: `All ${refs.length} script references in README exist` };
}

export function checkHookConfigs(settingsPath: string): CheckResult {
  if (!existsSync(settingsPath)) {
    return { name: "hook-configs", severity: "warn", message: "settings.json not found" };
  }
  const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
  const hooks: unknown[] = [];
  if (settings.hooks && typeof settings.hooks === "object") {
    for (const hookList of Object.values(settings.hooks)) {
      if (Array.isArray(hookList)) hooks.push(...hookList);
    }
  }
  const missing: string[] = [];
  for (const hook of hooks) {
    if (!hook || typeof hook !== "object") continue;
    const h = hook as Record<string, unknown>;
    const cmd: string = typeof h.command === "string" ? h.command : "";
    if (!cmd.includes("node ") && !cmd.includes("npx tsx ")) continue;
    // Extract file path: word after "node" or "npx tsx"
    const fileMatch = cmd.match(/(?:node|npx tsx)\s+([^\s]+)/);
    if (!fileMatch) continue;
    const filePath = fileMatch[1];
    if (!existsSync(filePath)) {
      missing.push(filePath);
    }
  }
  if (missing.length > 0) {
    return { name: "hook-configs", severity: "issue", message: `Hook commands reference missing files: ${missing.join(", ")}` };
  }
  return { name: "hook-configs", severity: "pass", message: "All hook command files exist" };
}

/**
 * `summary-version`. Two regimes (Loop 4 R3):
 * - `.agents/state.json` present → the views are generated; staleness is a
 *   header mismatch and the fix is a re-render (checkSummaryFromState). No
 *   prose is ever inserted into SUMMARY.md on this path.
 * - absent → the prose regime: SUMMARY.md must mention the version, and the
 *   remedy is a hand edit. This is the only path that can prompt a prose line.
 */
export function checkSummary(version: string, projectRoot: string, checkOnly = false): CheckResult {
  if (existsSync(join(projectRoot, ".agents", "state.json"))) {
    return checkSummaryFromState(version, projectRoot, checkOnly);
  }
  const summaryPath = join(projectRoot, ".agents", "SYSTEM", "SUMMARY.md");
  if (!existsSync(summaryPath)) {
    return { name: "summary-version", severity: "warn", message: ".agents/SYSTEM/SUMMARY.md not found" };
  }
  const content = readFileSync(summaryPath, "utf-8");
  if (content.includes(version)) {
    return { name: "summary-version", severity: "pass", message: `SUMMARY.md contains version ${version}` };
  }
  return { name: "summary-version", severity: "issue", message: `SUMMARY.md does not mention version ${version}` };
}

export function checkClaudeMd(projectRoot: string): CheckResult {
  const claudePath = join(projectRoot, "CLAUDE.md");
  if (!existsSync(claudePath)) {
    return { name: "claude-md", severity: "warn", message: "CLAUDE.md not found" };
  }
  const content = readFileSync(claudePath, "utf-8");
  // Find referenced directories (lines like `- \`dir/\`` or paths ending in /)
  const dirPattern = /`([a-zA-Z0-9._\-/]+\/)`/g;
  const refs = [...new Set([...content.matchAll(dirPattern)].map((m) => m[1]))];
  const missing = refs.filter((ref) => {
    const full = join(projectRoot, ref);
    return !existsSync(full);
  });
  if (missing.length > 0) {
    return { name: "claude-md", severity: "warn", message: `CLAUDE.md references missing dirs: ${missing.join(", ")}` };
  }
  return { name: "claude-md", severity: "pass", message: "CLAUDE.md exists and referenced dirs are valid" };
}

export function checkObsidianVault(vaultPath: string): CheckResult {
  if (!existsSync(vaultPath)) {
    return { name: "obsidian-vault", severity: "warn", message: `Vault directory not found: ${vaultPath}` };
  }
  // "Sessions" was a v1 folder. v2 records each session as a note in Summaries/
  // with the session UUID in frontmatter, so requiring Sessions/ warned on every
  // sync against a correctly-shaped vault.
  const expectedDirs = ["Experiences", "Skill-Candidates", "Summaries"];
  const missing = expectedDirs.filter((d) => !existsSync(join(vaultPath, d)));
  if (missing.length > 0) {
    return { name: "obsidian-vault", severity: "warn", message: `Vault missing directories: ${missing.join(", ")}` };
  }
  return { name: "obsidian-vault", severity: "pass", message: "Vault has all expected directories" };
}

/**
 * Markdown still pointing at the abandoned v1 vault.
 *
 * This bug class has recurred in every layer independently: slash commands in
 * four mirrors, setup.mjs, the guide skill, the reference doc. obsidianVaultDir()
 * contains it for code, but prose has no such chokepoint — a stale path in a
 * command file is read by an agent and acted on exactly as if it were current,
 * and nothing fails. A grep nobody remembers to run is not a guard; this is.
 *
 * Excluded by design, all for one reason — a record of what was true then is not
 * a stale instruction: CHANGELOG.md *should* say `Obsidian Vault/` when
 * describing what v1 did, the dream tests use v1 paths as fixtures for the rule
 * that detects them, and `docs/superpowers/plans/` holds dated plan documents
 * belonging to another plugin. Rewriting any of those would falsify the record.
 */
const V1_VAULT_REF = /Obsidian Vault(?! v2)[/\\]/;

export function checkVaultPathRefs(projectRoot: string, home = homedir()): CheckResult {
  const roots = [
    join(projectRoot, ".claude", "commands"),
    join(projectRoot, ".agents", "skills"),
    join(projectRoot, "project-template"),
    join(projectRoot, "scripts"),
    join(home, ".claude", "commands"),
    join(home, ".cursor", "commands"),
    join(home, "docs"),
  ];
  // Loaded into every session and therefore the highest-leverage place for a
  // stale path to sit: it is read as standing instruction, not as reference.
  // Named explicitly because neither lives in a directory worth walking whole.
  const files = [
    join(home, ".claude", "CLAUDE.md"),
    join(projectRoot, "CLAUDE.md"),
  ];
  const skipDirs = new Set(["node_modules", "build", ".git", "tests", "superpowers"]);
  const skipFiles = new Set(["CHANGELOG.md"]);
  const hits: string[] = [];

  const scan = (full: string): void => {
    try {
      if (V1_VAULT_REF.test(readFileSync(full, "utf8"))) hits.push(full);
    } catch { /* absent or unreadable — not this check's business */ }
  };

  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // absent live dir — same tolerance as the parity check
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) walk(join(dir, entry.name));
        continue;
      }
      if (!entry.name.endsWith(".md") || skipFiles.has(entry.name)) continue;
      scan(join(dir, entry.name));
    }
  };

  for (const root of roots) walk(root);
  for (const file of files) scan(file);

  if (hits.length > 0) {
    const shown = hits.slice(0, 5).map((h) => h.replace(projectRoot, ".").replace(home, "~"));
    const more = hits.length > 5 ? ` (+${hits.length - 5} more)` : "";
    return {
      name: "vault-path-refs",
      severity: "issue",
      message: `Docs reference the retired v1 vault: ${shown.join(", ")}${more}`,
    };
  }
  return { name: "vault-path-refs", severity: "pass", message: "No v1-vault references in docs or commands" };
}

/**
 * Vault notes and their index rows drifting apart.
 *
 * The vault is documented vault-first: the markdown is the source of truth and
 * the DB indexes it. Nothing enforced that, and the two diverge silently in both
 * directions. Three unrelated producers were found in one audit — the v1->v2
 * migration wrote notes without indexing them, a test suite wrote into the real
 * vault, and deleting an entry removes the row while leaving the file.
 *
 * The damage is not that a row is missing. The note sits in `Experiences/`
 * looking like captured knowledge while being
 * invisible to `ob_recall` — knowledge that is on disk but can never be
 * retrieved. One such note was driving a live skill proposal when this was
 * written.
 *
 * Reported as a warning, not an issue: this is data state needing per-note
 * triage (index it, or delete it), not something a commit should block on, and
 * unlike the version checks it cannot be auto-fixed.
 */
export function checkVaultIndexParity(vaultPath: string, dbPath: string): CheckResult {
  if (!existsSync(vaultPath) || !existsSync(dbPath)) {
    return { name: "vault-index-parity", severity: "pass", message: "Vault or knowledge DB absent — parity not applicable" };
  }

  const norm = (p: string) => p.replace(/\\/g, "/").toLowerCase();

  let indexed: Set<string>;
  let rows: Array<{ vault_path: string }>;
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    rows = db.prepare("SELECT vault_path FROM knowledge_index WHERE vault_path IS NOT NULL").all() as Array<{ vault_path: string }>;
    db.close();
    indexed = new Set(rows.map((r) => norm(r.vault_path)));
  } catch (err) {
    return { name: "vault-index-parity", severity: "warn", message: `Could not read knowledge DB: ${(err as Error).message}` };
  }

  // Only the directories the ob_ tools write and index. Summaries/ is written by
  // session-end and deliberately not indexed, so scanning it would be all noise.
  const scanned = ["Experiences", "Checkpoints"];
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) out.push(...walk(full));
      else if (e.name.endsWith(".md")) out.push(full);
    }
    return out;
  };

  const files = scanned.flatMap((d) => walk(join(vaultPath, d)));
  const unmatched = files.filter((f) => !indexed.has(norm(f)));
  const dangling = rows.filter((r) => !existsSync(r.vault_path));

  // An unmatched file whose *basename* is indexed under a different folder is a
  // second copy of an indexed note, not an unindexed one. The distinction is the
  // whole point: a duplicate means the vault holds two copies of one
  // experience, while an unindexed note is simply unreachable. Reporting both
  // as "not in the index" hides the first entirely.
  const indexedNames = new Set([...indexed].map((p) => p.slice(p.lastIndexOf("/") + 1)));
  const nameOf = (f: string) => norm(f).slice(norm(f).lastIndexOf("/") + 1);
  const duplicates = unmatched.filter((f) => indexedNames.has(nameOf(f)));
  const unindexed = unmatched.filter((f) => !indexedNames.has(nameOf(f)));

  if (unmatched.length === 0 && dangling.length === 0) {
    return { name: "vault-index-parity", severity: "pass", message: `Vault and index agree (${files.length} notes)` };
  }

  const rel = (f: string) => f.replace(vaultPath, "").replace(/\\/g, "/").replace(/^\//, "");
  const parts: string[] = [];
  if (duplicates.length > 0) {
    parts.push(`${duplicates.length} duplicate note(s) — same note filed under two folders, so the vault holds two copies of one experience: ${rel(duplicates[0])}`);
  }
  if (unindexed.length > 0) {
    parts.push(`${unindexed.length} unindexed note(s) — present in the vault but unreachable by ob_recall: ${rel(unindexed[0])}`);
  }
  if (dangling.length > 0) {
    parts.push(`${dangling.length} index row(s) whose vault file is missing`);
  }
  return { name: "vault-index-parity", severity: "warn", message: parts.join("; ") };
}

/**
 * Malformed rows in SKILL-INDEX.md's `## Skills` table.
 *
 * The parser used to `continue` past any row it could not read, so a mangled
 * row (a lost pipe, a blanked Domain cell) made the registered skill invisible
 * to graduation detection and the health score — the cluster it distilled kept
 * being re-proposed every scan, and a corrupted index was indistinguishable
 * from an empty one. The parser now reports what it dropped; this check turns
 * any drop into a sync failure so corruption is caught at commit time, not
 * after another twelve sessions of re-proposals.
 */
export function checkSkillIndex(vaultPath: string): CheckResult {
  const indexPath = join(vaultPath, "Skill-Candidates", "SKILL-INDEX.md");
  if (!existsSync(indexPath)) {
    return { name: "skill-index", severity: "pass", message: "SKILL-INDEX.md absent — nothing to validate" };
  }

  let content: string;
  try {
    content = readFileSync(indexPath, "utf-8");
  } catch (err) {
    return { name: "skill-index", severity: "warn", message: `Could not read SKILL-INDEX.md: ${(err as Error).message}` };
  }

  const { rows, dropped } = parseSkillIndexRows(content);
  if (dropped.length > 0) {
    const shown = dropped[0].length > 60 ? dropped[0].slice(0, 60) + "…" : dropped[0];
    return {
      name: "skill-index",
      severity: "issue",
      message: `SKILL-INDEX.md has ${dropped.length} malformed skill row(s) invisible to graduation (clusters will re-propose): ${shown}`,
    };
  }
  return { name: "skill-index", severity: "pass", message: `SKILL-INDEX.md parses cleanly (${rows.length} skill(s))` };
}

/**
 * Personal identity leaking into the distributable template.
 *
 * project-template/ ships to strangers, and it shipped with "Aaron" in ~20
 * places and "You are Clark" in the startup command — every consumer's agent
 * introduced itself as Clark and addressed its user as Aaron. Identity belongs
 * in the unshipped layers (the user's global CLAUDE.md, a project's
 * .agents/AGENT.md); template prose stays generic ("the user"). Found by
 * Atlas's self-containment scan (Session 52), same distribution-drift class as
 * Session 36 — and like mirror parity, "remember not to write names into the
 * template" is a prompt-level rule until a check enforces it.
 *
 * The name list is this repo's owner and agents. `melvenac` in GitHub URLs is
 * a repo reference, not a leak — \b keeps `melve` from matching inside it.
 * Case-insensitive: "you are clark" in prose is exactly the shape that would
 * recur, and a guard weaker than the state it protects is barely a guard.
 */
const PERSONAL_NAMES = /\b(Aaron|Clark|melve)\b/i;

export function checkTemplatePersonalNames(projectRoot: string): CheckResult {
  const templateRoot = join(projectRoot, "project-template");
  if (!existsSync(templateRoot)) {
    return { name: "template-personal-names", severity: "warn", message: "project-template/ not found" };
  }

  const skipDirs = new Set(["node_modules", ".git"]);
  const hits: string[] = [];
  const walk = (dir: string): void => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) walk(full);
        continue;
      }
      try {
        const match = readFileSync(full, "utf-8").match(PERSONAL_NAMES);
        if (match) hits.push(`${full.replace(templateRoot, "project-template").replace(/\\/g, "/")} ("${match[1]}")`);
      } catch { /* binary or unreadable — not prose, not a leak */ }
    }
  };
  walk(templateRoot);

  if (hits.length > 0) {
    const shown = hits.slice(0, 5).join(", ");
    const more = hits.length > 5 ? ` (+${hits.length - 5} more)` : "";
    return {
      name: "template-personal-names",
      severity: "issue",
      message: `Template ships personal names — consumers' agents will use them: ${shown}${more}`,
    };
  }
  return { name: "template-personal-names", severity: "pass", message: "No personal names in project-template/" };
}

/**
 * This build's schema version against the stamp in the live database.
 *
 * Per-session MCP servers pick up new code only when their own session
 * reconnects, so two writers can run different builds against one DB
 * indefinitely — proven live in Session 52, when a v0.18.0 server's default
 * contaminated a column a v0.19.x server had already moved past. The stamp
 * (SQLite user_version, written forward-only by openV2Database) is what lets
 * an older writer learn it is behind; this check reads it at the commit gate.
 */
export function checkSchemaVersion(dbPath: string): CheckResult {
  if (!existsSync(dbPath)) {
    return { name: "schema-version", severity: "pass", message: "Knowledge DB absent — nothing to compare" };
  }

  let dbVersion: number;
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    dbVersion = Number(db.pragma("user_version", { simple: true })) || 0;
    db.close();
  } catch (err) {
    return { name: "schema-version", severity: "warn", message: `Could not read knowledge DB: ${(err as Error).message}` };
  }

  if (dbVersion === SCHEMA_VERSION) {
    return { name: "schema-version", severity: "pass", message: `Schema stamp matches this build (v${SCHEMA_VERSION})` };
  }
  if (dbVersion > SCHEMA_VERSION) {
    return {
      name: "schema-version",
      severity: "issue",
      message: `This build writes schema v${SCHEMA_VERSION} but the DB is stamped v${dbVersion} by a newer build — running stale code; rebuild or pull before writing`,
    };
  }
  return {
    name: "schema-version",
    severity: "warn",
    message: `DB stamped v${dbVersion}, this build writes v${SCHEMA_VERSION} — heals on the next openV2Database (no server has opened the DB since this build)`,
  };
}

/**
 * Project directories recorded in the DB that no longer exist on disk.
 *
 * `project_dir` is an identity key derived from a path, so renaming a directory
 * silently orphans everything keyed to the old name. Renaming
 * `Tarrant County Makerspace` to `Tarrant-County-Makerspace` — spaces are awful
 * to `cd` into — stranded 16 entries and 15 vault notes, and a project-scoped
 * `ob_recall` from the real repo then returned about 60% of that project's
 * memory while looking exactly like a complete result.
 *
 * Asks the filesystem rather than guessing a normalization rule: this catches
 * any rename, move or deletion, where folding spaces to hyphens would corrupt
 * every project whose directory legitimately contains a space.
 *
 * **Warn, never issue.** A directory can be legitimately absent — an archived
 * project, a different machine, work that was never a repo — and only a person
 * knows whether a missing path means "renamed to that one" or "gone". Failing
 * the commit gate over history that is merely old would be the wrong trade.
 */
export function checkProjectDirsExist(dbPath: string): CheckResult {
  if (!existsSync(dbPath)) {
    return { name: "project-dirs", severity: "pass", message: "Knowledge DB absent — nothing to check" };
  }

  let rows: { p: string; c: number }[];
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    rows = db
      .prepare(`
        SELECT project_dir AS p, COUNT(*) AS c FROM knowledge_index
        WHERE project_dir IS NOT NULL AND project_dir != '' AND project_dir LIKE '%/%'
        GROUP BY project_dir
      `)
      .all() as { p: string; c: number }[];
    db.close();
  } catch (err) {
    return { name: "project-dirs", severity: "warn", message: `Could not read knowledge DB: ${(err as Error).message}` };
  }

  const missing = rows.filter((r) => !existsSync(r.p)).sort((a, b) => b.c - a.c);
  if (missing.length === 0) {
    return { name: "project-dirs", severity: "pass", message: `All ${rows.length} project directories resolve on disk` };
  }

  const detail = missing.map((m) => `${m.p} (${m.c})`).join(", ");
  return {
    name: "project-dirs",
    severity: "warn",
    message:
      `${missing.length} project director${missing.length === 1 ? "y" : "ies"} no longer exist${missing.length === 1 ? "s" : ""} — ` +
      `entries are unreachable by project-scoped recall: ${detail}. ` +
      `Fold a renamed one forward with: open-brain relocate --from "<old>" --to "<new>" --apply`,
  };
}

export function checkTemplate(projectRoot: string): CheckResult {
  const templatePath = join(projectRoot, "project-template");
  if (!existsSync(templatePath)) {
    return { name: "template", severity: "warn", message: "project-template/ directory not found" };
  }
  const requiredDirs = [".agents", ".claude"];
  const missing = requiredDirs.filter((d) => !existsSync(join(templatePath, d)));
  if (missing.length > 0) {
    return { name: "template", severity: "issue", message: `project-template/ missing: ${missing.join(", ")}` };
  }
  return { name: "template", severity: "pass", message: "project-template/ has .agents and .claude" };
}

export function checkSpecProvenance(projectRoot: string): CheckResult {
  const candidates = [
    join(projectRoot, "specs"),
    join(projectRoot, "docs", "specs"),
    join(projectRoot, "docs", "superpowers", "specs"),
  ];
  const specsDir = candidates.find((d) => existsSync(d));
  if (!specsDir) {
    return { name: "spec-provenance", severity: "warn", message: "specs/ directory not found" };
  }
  const files = readdirSync(specsDir).filter((f) => f.endsWith(".md"));
  return { name: "spec-provenance", severity: "pass", message: `specs/ has ${files.length} spec file(s)` };
}

/**
 * Guards against the same hook script being registered more than once for the
 * same event. A duplicate SessionStart registration made the bootstrap hook emit
 * SESSION_UUID twice; setup.mjs re-adding an existing entry is the usual cause.
 * Counting registrations catches it without needing a live session to observe.
 */
export function checkHookRegistration(settingsPath: string): CheckResult {
  if (!existsSync(settingsPath)) {
    return { name: "hook-registration", severity: "warn", message: "settings.json not found" };
  }

  let parsed: { hooks?: Record<string, Array<{ hooks?: Array<{ command?: string }> }>> };
  try {
    parsed = JSON.parse(readFileSync(settingsPath, "utf-8"));
  } catch {
    return { name: "hook-registration", severity: "issue", message: "settings.json is not valid JSON" };
  }

  const duplicates: string[] = [];

  for (const [event, matchers] of Object.entries(parsed.hooks ?? {})) {
    const counts = new Map<string, number>();

    for (const matcher of matchers ?? []) {
      for (const hook of matcher.hooks ?? []) {
        const command = hook.command;
        if (!command) continue;
        // Key on the script filename so path spelling differences (slashes,
        // drive-letter case) still collapse to the same registration.
        const script = (command.match(/[\w.-]+\.(?:js|mjs|cjs|ts)/g) ?? []).pop();
        if (!script) continue;
        counts.set(script, (counts.get(script) ?? 0) + 1);
      }
    }

    for (const [script, n] of counts) {
      if (n > 1) duplicates.push(`${event}: ${script} registered ${n}x`);
    }
  }

  if (duplicates.length > 0) {
    return {
      name: "hook-registration",
      severity: "issue",
      message: `Duplicate hook registrations — ${duplicates.join("; ")}`,
    };
  }

  return { name: "hook-registration", severity: "pass", message: "No duplicate hook registrations" };
}

/**
 * Deterministic mirror enforcement.
 *
 * Slash commands exist in up to three places: the live user dirs (~/.claude,
 * ~/.cursor), the distributable template, and the repo root for dogfooding.
 * Drift between them shipped stale commands to template consumers repeatedly
 * (12 sessions of recurring "distribution drift"), because parity was only ever
 * checked by eye. This compares them byte-for-byte instead.
 *
 * Live user directories are only compared when present, so the check still
 * works in CI and for consumers who have not installed the commands.
 */
export function checkMirrorParity(projectRoot: string, home = homedir()): CheckResult {
  const templateClaude = join(projectRoot, "project-template", ".claude", "commands");
  const templateCursor = join(projectRoot, "project-template", ".cursor", "commands");

  const pairs: Array<{ label: string; a: string; b: string; required: boolean }> = [
    { label: "repo↔template (.claude)", a: join(projectRoot, ".claude", "commands"), b: templateClaude, required: true },
    { label: "live↔template (.claude)", a: join(home, ".claude", "commands"), b: templateClaude, required: false },
    { label: "live↔template (.cursor)", a: join(home, ".cursor", "commands"), b: templateCursor, required: false },
  ];

  const problems: string[] = [];
  let compared = 0;

  // The template's Cursor set is asserted against an explicit list, since the
  // pairwise comparison below can only see files that exist on both sides.
  if (existsSync(templateCursor)) {
    const actual = readdirSync(templateCursor).filter((f) => f.endsWith(".md")).sort();
    const expected = [...CURSOR_COMMAND_SET].sort();
    for (const file of expected) {
      if (!actual.includes(file)) problems.push(`template (.cursor): ${file} missing`);
    }
    for (const file of actual) {
      if (!expected.includes(file)) {
        problems.push(`template (.cursor): ${file} unexpected — add it to CURSOR_COMMAND_SET if intended`);
      }
    }
  }

  for (const { label, a, b, required } of pairs) {
    const aExists = existsSync(a);
    const bExists = existsSync(b);

    if (!aExists || !bExists) {
      if (required) problems.push(`${label}: missing directory`);
      continue;
    }

    const listMd = (d: string) => readdirSync(d).filter((f) => f.endsWith(".md")).sort();
    const aFiles = listMd(a);
    const bFiles = listMd(b);
    const all = [...new Set([...aFiles, ...bFiles])].sort();

    for (const file of all) {
      if (MIRROR_EXCEPTIONS[file]) continue;

      const inA = aFiles.includes(file);
      const inB = bFiles.includes(file);

      if (!inA) { problems.push(`${label}: ${file} missing from ${a}`); continue; }
      if (!inB) { problems.push(`${label}: ${file} missing from ${b}`); continue; }

      compared++;
      // Compare content, not bytes. A file copied on Windows picks up CRLF
      // while the repo copy stays LF, which a byte-for-byte check reports as
      // drift forever even though the two files say exactly the same thing.
      // Trailing-newline differences are noise for the same reason.
      const norm = (p: string) =>
        readFileSync(p, "utf-8").replace(/\r\n/g, "\n").replace(/\s+$/, "");
      if (norm(join(a, file)) !== norm(join(b, file))) {
        problems.push(`${label}: ${file} differs`);
      }
    }
  }

  if (problems.length > 0) {
    return {
      name: "mirror-parity",
      severity: "issue",
      message: `Slash-command mirrors out of sync — ${problems.join("; ")}`,
    };
  }

  return {
    name: "mirror-parity",
    severity: "pass",
    message: `Slash-command mirrors in sync (${compared} file comparison(s))`,
  };
}

export function checkRules(projectRoot: string): CheckResult {
  const rulesPath = resolveDocPath(projectRoot, "RULES.md");
  if (!rulesPath) {
    return { name: "rules", severity: "warn", message: "RULES.md not found" };
  }
  return { name: "rules", severity: "pass", message: "RULES.md exists" };
}

/**
 * `.agents/state.json` (Loop 2, read side). Absent is a SKIP with the reason
 * printed, not a pass: the writer (ob_state, Loop 3) never creates the file,
 * so an unmigrated project has none, and a pass would claim a validation
 * that never ran. Present must parse against the strict schema.
 *
 * Loop 8 R3 / ADR-027: the `project.version` comparison is gone with the field.
 * The schema is strict, so a file still carrying it now fails the parse above
 * and is reported as invalid — which is the check that matters, since there is
 * no migration runner for this file.
 */
/**
 * Loop 10 R1 — the schema-staleness check.
 *
 * This parses the live `.agents/state.json` with **the calling process's own
 * loaded schema**, and now names which process that was. It tests the capability
 * rather than a proxy: can the process that will be asked to write this file even
 * read it.
 *
 * **Why not the obvious version comparison.** Loop 9's R3 held `schema_version` at
 * 1 while changing the shape of `ProjectSchema`, so a version check sees 1 against
 * 1 and passes. It would have been green through the entire two-loop outage.
 *
 * **The class this closes.** An MCP server holds its schema for the life of the
 * process, so a loop that changes a schema cannot close itself through the tool it
 * changed without a reconnect — a human action neither agent can perform. It
 * silently cost two loops of record-keeping. Running this from the CLI cannot
 * detect it, because that is a different process; the runtime label is what makes
 * the two distinguishable in the output.
 *
 * Reported whatever the severity, because a pass that is not shown is
 * indistinguishable from a check that never ran.
 */
export function checkStateSchema(
  _version: string,
  projectRoot: string,
  runtime: SyncRuntime = "cli",
): CheckResult {
  const name = "state-schema";
  const where = runtime === "mcp-server" ? "the running MCP server" : "this CLI process";
  const statePath = join(projectRoot, ".agents", "state.json");
  if (!existsSync(statePath)) {
    return {
      name,
      severity: "skip",
      message: "skipped — no .agents/state.json (this project has not been migrated; ob_state never creates the file)",
      report: true,
    };
  }
  const parsed = parseState(readFileSync(statePath, "utf-8"));
  if (!parsed.ok) {
    const remedy =
      runtime === "mcp-server"
        ? " — the server's loaded schema cannot read the live file. If the schema changed this session, ask Aaron to run `/mcp reconnect open-brain`, then re-run this check: a stale server reports success."
        : " — note this is the CLI's schema, not the running server's. The server may hold a different one; run ob_sync as an MCP tool to test that.";
    return {
      name,
      severity: "issue",
      message: `.agents/state.json invalid at ${parsed.error}, as parsed by ${where}${remedy}`,
      report: true,
    };
  }
  return {
    name,
    severity: "pass",
    message: `.agents/state.json readable by ${where} (schema v${parsed.data.schema_version}, rev ${parsed.data.revision}, ${parsed.data.tasks.length} tasks)`,
    report: true,
  };
}

/**
 * Loop 8 R4 — slash-command parity between the repo and the template it ships.
 *
 * This repo IS the framework source, so it carries the commands it distributes
 * while the author also has them installed globally. The duplication is
 * expected; what was missing is any check that the copies agree. Loop 5's R4
 * had to be applied to every copy by hand and one copy drifted and stayed
 * drifted.
 *
 * Three tiers, deliberately scoped:
 *
 *   1. `.claude/commands/` vs `project-template/.claude/commands/` — `issue`.
 *      Fully deterministic, no machine dependence.
 *   2. `~/.claude/commands/` — `warn`, and SKIPPED ENTIRELY when absent. The
 *      template ships to other people and other machines; a check that reads
 *      the author's home directory must never be able to fail someone else's
 *      build.
 *   3. `project-template/.cursor/commands/` — NOT COVERED, on purpose. It holds
 *      four commands against the `.claude` set's eight and they are ADAPTED,
 *      not copied, so byte or content parity is the wrong assertion there and
 *      would produce a permanently red check. G-001 stays open and this check
 *      does not pretend to cover it.
 *
 * Line endings are normalised before comparing. The user-scope copy of
 * `sync.md` is CRLF where the repo copy is LF with identical content, and
 * reporting that as drift would fail on Windows for no reason.
 *
 * Asymmetric by design, and the asymmetry has an exception. A file only in the
 * repo is allowed — `harness-audit.md` is a framework-development command that
 * new projects have no use for. A file only in the template is normally an
 * issue, because the template would be shipping a command the repo does not
 * carry as source. `bootstrap.md` is the standing exception: it takes an empty
 * folder to an AI-ready project, so the already-bootstrapped framework repo has
 * no use for it, and it has never existed in repo scope.
 */
const TEMPLATE_ONLY_ALLOWED = new Set(["bootstrap.md"]);

/** Content equality ignoring line-ending style and a trailing newline. */
function sameCommandContent(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\r\n/g, "\n").replace(/\s+$/, "");
  return norm(a) === norm(b);
}

function listCommands(dir: string): string[] {
  try {
    return readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
  } catch {
    return [];
  }
}

export function checkCommandParity(projectRoot: string, home = homedir()): CheckResult {
  const name = "command-parity";
  const repoDir = join(projectRoot, ".claude", "commands");
  const templateDir = join(projectRoot, "project-template", ".claude", "commands");

  if (!existsSync(repoDir) || !existsSync(templateDir)) {
    return { name, severity: "skip", message: "skipped — .claude/commands or project-template/.claude/commands absent" };
  }

  const repo = listCommands(repoDir);
  const template = listCommands(templateDir);
  const problems: string[] = [];

  // Tier 1: repo vs template.
  for (const f of template) {
    if (!repo.includes(f)) {
      if (TEMPLATE_ONLY_ALLOWED.has(f)) continue;
      problems.push(`${f} is in the template but not in .claude/commands`);
      continue;
    }
    const a = readFileSync(join(repoDir, f), "utf8");
    const b = readFileSync(join(templateDir, f), "utf8");
    if (!sameCommandContent(a, b)) problems.push(`${f} differs between .claude/commands and the template`);
  }

  if (problems.length) {
    return { name, severity: "issue", message: `command drift: ${problems.join("; ")}` };
  }

  const shared = template.filter((f) => repo.includes(f)).length;

  // Tier 2: user scope. Absent is a skip for that tier, never a failure.
  const userDir = join(home, ".claude", "commands");
  if (!existsSync(userDir)) {
    return {
      name,
      severity: "pass",
      message: `${shared} shared commands identical to the template (user scope absent — not checked)`,
      report: true,
    };
  }

  const userDrift: string[] = [];
  for (const f of listCommands(userDir)) {
    if (!repo.includes(f)) continue; // user-only commands are their own business
    const a = readFileSync(join(repoDir, f), "utf8");
    const b = readFileSync(join(userDir, f), "utf8");
    if (!sameCommandContent(a, b)) userDrift.push(f);
  }

  if (userDrift.length) {
    return {
      name,
      severity: "warn",
      message: `${shared} shared commands identical to the template; user-scope copies differ: ${userDrift.join(", ")}`,
      report: true,
    };
  }

  return {
    name,
    severity: "pass",
    message: `${shared} shared commands identical across repo, template and user scope`,
    report: true,
  };
}

/**
 * Loop 11 C3 — every `ob_*` a command instructs an agent to call must exist in
 * the server's registered tool list.
 *
 * WHY THIS AND NOT PROSE PARITY. `command-parity` compares the three mirrors to
 * each other. Three identical copies of a false instruction agree perfectly and
 * it reports `pass` — which is exactly what happened to `/skill-scan`, live and
 * byte-identical in all three mirrors for a component Loop 10 had cut.
 *
 * WHAT IT DOES NOT CATCH, stated here so the check is never oversold: **a tool
 * that lies about itself.** Loop 11 found two of fourteen tool descriptions
 * falsified by Loop 10's own cuts — `ob_feedback` claiming to drive maturity
 * promotion and apoptosis, `ob_end` claiming to flag reflection clusters. Both
 * tools EXIST, under exactly the names the commands call them by, so this check
 * passes on both. Tool names are machine-checkable; whether a description is
 * true is not.
 *
 * It is a regression guard rather than a speculative one: `ob_summarize` and
 * `ob_store_summary` both shipped, and both were caught by a human reading the
 * files. This prevents the third recurrence, not a hypothetical first.
 *
 * The registry is read from `server.ts`'s registration sites rather than from a
 * list maintained beside them — a second list is the stand-in that rule 5 warns
 * about, and it would drift from the thing it describes exactly as the mirrors
 * did.
 */
export function checkCommandToolNames(projectRoot: string, home = homedir()): CheckResult {
  const name = "command-tool-names";
  const serverSrc = join(projectRoot, "open-brain", "src", "server.ts");

  if (!existsSync(serverSrc)) {
    return { name, severity: "skip", message: "skipped — open-brain/src/server.ts not found (running outside the source tree)" };
  }

  const registered = new Set(
    [...readFileSync(serverSrc, "utf8").matchAll(/^\s*"(ob_[a-z_]+)",\s*$/gm)].map((m) => m[1])
  );
  if (registered.size === 0) {
    return { name, severity: "skip", message: "skipped — no ob_* registrations found in server.ts (registration shape changed?)" };
  }

  const dirs = [
    join(projectRoot, ".claude", "commands"),
    join(projectRoot, "project-template", ".claude", "commands"),
    join(projectRoot, "project-template", ".cursor", "commands"),
    join(home, ".claude", "commands"),
    join(home, ".cursor", "commands"),
  ].filter(existsSync);

  if (dirs.length === 0) {
    return { name, severity: "skip", message: "skipped — no command directories found" };
  }

  const problems: string[] = [];
  let scanned = 0;
  let namesChecked = 0;

  for (const dir of dirs) {
    for (const f of listCommands(dir)) {
      const text = readFileSync(join(dir, f), "utf8");
      scanned++;
      const named = new Set([...text.matchAll(/\b(ob_[a-z_]+|kb_[a-z_]+)\b/g)].map((m) => m[1]));
      for (const tool of named) {
        namesChecked++;
        if (tool.startsWith("kb_")) {
          // The v1 prefix. Retired wholesale, so any survivor is a dead call.
          problems.push(`${f}: ${tool} (kb_* is the retired v1 prefix)`);
        } else if (!registered.has(tool)) {
          problems.push(`${f}: ${tool} is not a registered tool`);
        }
      }
    }
  }

  if (problems.length) {
    const shown = problems.slice(0, 6).join("; ");
    const more = problems.length > 6 ? `; +${problems.length - 6} more` : "";
    return { name, severity: "issue", message: `commands call tools that do not exist: ${shown}${more}` };
  }

  return {
    name,
    severity: "pass",
    message: `${namesChecked} tool references across ${scanned} command files all resolve to ${registered.size} registered tools (names only — this cannot tell whether a tool's description is true)`,
    report: true,
  };
}

/**
 * Loop 12 C2 — `command-names`, the second referent class.
 *
 * `command-tool-names` resolves `ob_*` against the server's registration sites.
 * This resolves `/name` against the command files that actually exist, across
 * the same five mirrors. It is the same mechanism pointed at the referent that
 * Loop 11's own worked example rotted on: **root `README.md` listed
 * `/skill-scan` in the live Commands table for two loops after the command was
 * deleted**, and `e0b2fc8` repaired the distributable copy while missing it.
 *
 * **Why command names and not file paths.** C2 tried file paths first and did
 * not ship them, on purpose. A path check over the same surface produced six
 * distinct findings of which **one** was a real defect; the other five were
 * prose naming a non-existent path *correctly* — an obituary (`test.md` citing
 * `.agents/workflows/test.md` inside the sentence explaining that it exists in
 * no mirror), an example (`e.g. src/components/BookingDrawer.tsx`) and a
 * conditional (`if .agents/META/ exists`). Separating those three from a
 * dangling reference means parsing intent, which this loop is forbidden to
 * attempt. **The difference is a registry.** Tool names have one in
 * `server.ts`; command names have one in the command directories; file paths
 * have none, and the filesystem is not a registry of what prose may mention.
 * **Extend this mechanism to a referent only where a registry exists.** A check
 * that cries wolf gets switched off, and then it occupies the slot a real check
 * would have had.
 *
 * `BUILTINS` is deliberately tiny and grows only by an explicit act, for the
 * same reason a retirement's allowed referrers are captured rather than
 * inferred: it lists the host's own commands that this repo's prose actually
 * names, not every command the host ships. Adding one is a decision someone
 * makes and can be asked about, which is the right cost.
 *
 * Out of scope, and stated here because `command-tool-names` set the precedent:
 * **this cannot tell whether a command's description is true.** It resolves the
 * name and nothing else.
 */
export function checkCommandNames(projectRoot: string, home = homedir()): CheckResult {
  const name = "command-names";

  /** Host commands, not this project's. Grows by explicit act, never inferred. */
  const BUILTINS = new Set(["compact", "init"]);

  const commandDirs = [
    join(projectRoot, ".claude", "commands"),
    join(projectRoot, "project-template", ".claude", "commands"),
    join(projectRoot, "project-template", ".cursor", "commands"),
    join(home, ".claude", "commands"),
    join(home, ".cursor", "commands"),
  ].filter(existsSync);

  if (commandDirs.length === 0) {
    return { name, severity: "skip", message: "skipped — no command directories found" };
  }

  const registered = new Set<string>();
  for (const dir of commandDirs) for (const f of listCommands(dir)) registered.add(f.slice(0, -3));

  if (registered.size === 0) {
    return { name, severity: "skip", message: "skipped — command directories hold no .md files" };
  }

  // The surface that gives instructions about THIS repo. Historical records —
  // CHANGELOG, DECISIONS, PRD, the loop docs, session logs, the archive — keep
  // their references by rule: they describe what was, not what is. They are
  // excluded by not being listed, rather than by a filter someone must
  // remember to apply.
  const surface: Array<[string, string]> = [];
  for (const dir of commandDirs) {
    const label = dir.startsWith(home)
      ? `~/${dir.slice(home.length + 1)}`
      : dir.slice(projectRoot.length + 1);
    for (const f of listCommands(dir)) surface.push([join(dir, f), `${label.replace(/\\/g, "/")}/${f}`]);
  }
  for (const f of ["README.md", "CLAUDE.md"]) {
    if (existsSync(join(projectRoot, f))) surface.push([join(projectRoot, f), f]);
  }
  const skillsDir = join(projectRoot, ".agents", "skills");
  if (existsSync(skillsDir)) {
    for (const entry of readdirSync(skillsDir)) {
      const skill = join(skillsDir, entry, "SKILL.md");
      if (existsSync(skill)) surface.push([skill, `.agents/skills/${entry}/SKILL.md`]);
    }
  }

  const problems: string[] = [];
  let namesChecked = 0;

  for (const [abs, rel] of surface) {
    const seen = new Set<string>();
    for (const m of readFileSync(abs, "utf8").matchAll(/`\/([a-z][a-z0-9-]*)`/g)) {
      const cmd = m[1];
      if (seen.has(cmd)) continue;
      seen.add(cmd);
      namesChecked++;
      if (!registered.has(cmd) && !BUILTINS.has(cmd)) problems.push(`${rel}: /${cmd}`);
    }
  }

  if (problems.length) {
    const shown = problems.slice(0, 6).join("; ");
    const more = problems.length > 6 ? `; +${problems.length - 6} more` : "";
    return {
      name,
      severity: "issue",
      message: `instructions name commands that do not exist: ${shown}${more} (if one is a host command, add it to BUILTINS in checks.ts — an explicit act, not an inference)`,
    };
  }

  return {
    name,
    severity: "pass",
    message: `${namesChecked} command references across ${surface.length} instruction files all resolve to ${registered.size} command files or ${BUILTINS.size} declared host commands (names only — this cannot tell whether a command's description is true)`,
    report: true,
  };
}

/**
 * Loop 12 C3 — `retirements`, the check that makes a deletion finish itself.
 *
 * **The record this reads is not new. It is `.agents/LIFECYCLE.md`'s Component
 * Log, made into data.** That log already existed, already tracked, and already
 * held the right answer: `2026-04-16 | /recall | PRUNED | Absorbed into /start`.
 * The `/recall` reference in the gotchas skill survived to **v0.36.0 anyway** —
 * five months and thirty-four minor versions — because **nothing read it.**
 * That is Loop 11's rule 4 in one artifact: every containment that worked was a
 * command, every containment that failed was an intention. The log was an
 * intention. This check is the command.
 *
 * **Why an allowlist and not a parser.** C2 established that a referent is
 * checkable only where a registry exists, and that the filesystem is not one: a
 * registry is a closed list of what exists *and may be named*, and the
 * filesystem answers only the first half. **For a retired name there is no
 * registry anywhere, because the thing is gone — so the record IS the missing
 * registry**, built by hand at retirement time. `allowed_referrers` is captured
 * when the retirement is made, which is the only moment anyone knows which
 * mentions are deliberate. A correct obituary written then is in the set by
 * construction; a dangling reference appearing later is not.
 *
 * This is forced rather than chosen. A retired name read in prose is textually
 * identical whether it is a defect or an obituary — C2 proved it by firing on
 * its own repair, where `` `/recall` `` inside the sentence explaining that
 * `/recall` is gone was indistinguishable from the defect being described.
 *
 * **Entries are global, not per referent class.** A per-class record would have
 * no entry at all for a class with no registry, so it would under-cover
 * *silently*. Global keeps the record complete where checking cannot follow, and
 * moves the incompleteness into this message where a reader can see it — which
 * is why the pass text names the classes it cannot resolve. **Green here means
 * "every recorded retirement is finished", never "everything is finished".**
 *
 * **An empty record passing would be the same defect as a check nobody has seen
 * fail**, so the count of retirements and of verified referrers is in the
 * message, and a stale allowlist entry — a path that no longer exists, or no
 * longer names its retirement — is an issue rather than a silent pass.
 */
export function checkRetirements(projectRoot: string): CheckResult {
  const name = "retirements";
  const recordPath = join(projectRoot, ".agents", "retirements.json");

  if (!existsSync(recordPath)) {
    return { name, severity: "skip", message: "skipped — .agents/retirements.json not found" };
  }

  let record: RetirementRecord;
  try {
    record = JSON.parse(readFileSync(recordPath, "utf8")) as RetirementRecord;
  } catch (e) {
    return { name, severity: "issue", message: `.agents/retirements.json is not valid JSON: ${(e as Error).message}` };
  }

  const retirements = record.retirements ?? [];
  if (retirements.length === 0) {
    // Loud rather than green. A record with nothing in it proves nothing, and
    // the shape of this failure is the reason the count travels in every message.
    return { name, severity: "issue", message: ".agents/retirements.json records no retirements — an empty record passes for the same reason an unfallen check does" };
  }

  const historical = record.historical ?? [];
  const isHistorical = (rel: string) => historical.some((h) => rel === h || rel.startsWith(h));

  const surface = listScannableFiles(projectRoot).filter((rel) => !isHistorical(rel));

  const unexpected: string[] = [];
  const stale: string[] = [];
  let verified = 0;
  const classes = new Set<string>();
  const events = new Set<string>();

  for (const r of retirements) {
    events.add(r.event);
    for (const c of r.classes ?? []) classes.add(c);
    // Case sensitivity is per retirement and defaults to STRICT. A prose name
    // ("Skill-scan" at the start of a sentence) needs `ignore_case`; an
    // identifier does not, and granting it globally made `KB_PATH` — a live
    // variable in dashboard.mjs — look like the retired `kb_*` TOOL prefix.
    // That is rule 8 arriving inside the check written to apply it.
    const re = () => new RegExp(r.pattern, r.ignore_case ? "i" : "");
    const allowed = new Set((r.allowed_referrers ?? []).map((a) => a.path));

    for (const a of r.allowed_referrers ?? []) {
      const abs = join(projectRoot, a.path);
      if (!existsSync(abs)) {
        stale.push(`${r.name}: allowed referrer ${a.path} no longer exists`);
        continue;
      }
      if (!re().test(readFileSync(abs, "utf8"))) {
        stale.push(`${r.name}: ${a.path} no longer names it — drop it from allowed_referrers`);
        continue;
      }
      verified++;
    }

    for (const rel of surface) {
      if (allowed.has(rel)) continue;
      let txt: string;
      try { txt = readFileSync(join(projectRoot, rel), "utf8"); } catch { continue; }
      if (re().test(txt)) unexpected.push(`${rel} names ${r.name} (retired ${r.ruled}, ${r.event})`);
    }
  }

  if (unexpected.length || stale.length) {
    const all = [...unexpected, ...stale];
    const shown = all.slice(0, 6).join("; ");
    const more = all.length > 6 ? `; +${all.length - 6} more` : "";
    return { name, severity: "issue", message: `retired names still referenced outside the record: ${shown}${more}` };
  }

  // The unverifiable half is stated, not omitted. `command` and `tool` names can
  // additionally be resolved against a live registry by command-names and
  // command-tool-names; every other class is guarded by this record alone.
  const RESOLVABLE = ["command", "tool"];
  const unresolvable = [...classes].filter((c) => !RESOLVABLE.includes(c)).sort();
  return {
    name,
    severity: "pass",
    message:
      `${retirements.length} retirements across ${events.size} event classes, ${verified} allowed referrers all present and still naming their retirement, ` +
      `0 unexpected across ${surface.length} live files — ` +
      `resolvable against a registry: ${RESOLVABLE.join(", ")}; guarded by this record alone: ${unresolvable.join(", ")} ` +
      `(green means every RECORDED retirement is finished, not that every retirement is recorded)`,
    report: true,
  };
}

interface RetirementRecord {
  historical?: string[];
  retirements?: Array<{
    name: string;
    pattern: string;
    event: string;
    ruled: string;
    classes?: string[];
    ignore_case?: boolean;
    allowed_referrers?: Array<{ path: string; class: string; why: string }>;
  }>;
}

/**
 * Files worth scanning for a retired name: **the ones git tracks**.
 *
 * This used to be a filesystem walk with a hand-maintained skip list, and the
 * name asserted a property it did not have. It shipped that way and fired **115
 * findings** on a working tree that had a `.gitnexus/` index — a gitignored
 * generated cache whose parse artifacts happen to contain the string
 * `skill-scan`. The worktree it was developed in had no such directory, so it
 * was green there and broken everywhere else.
 *
 * **A hand-maintained skip list is the same defect this check exists to find:**
 * a second list, beside the thing it describes, that drifts. `.gitignore` is
 * already the repo's statement about what is not its own content, and `git
 * ls-files` reads it rather than duplicating it.
 *
 * The trade-off, stated rather than hidden: **an untracked file naming a retired
 * thing is not reported.** That is deliberate — an untracked file does not ship,
 * and the alternative is re-deriving `.gitignore` by hand. The filesystem walk
 * survives only as a fallback for a temp directory under test, where there is
 * no git repo to ask.
 */
function listScannableFiles(root: string): string[] {
  try {
    const out = execSync("git ls-files -z", { cwd: root, encoding: "buffer", stdio: ["ignore", "pipe", "ignore"] });
    const files = out.toString("utf8").split("\0").filter(Boolean);
    if (files.length > 0) return files.filter((f) => /\.(md|ts|mjs|cjs|js|json)$/.test(f));
  } catch { /* not a git repo, or git unavailable — fall back to the walk */ }
  return walkTracked(root);
}

/** Fallback only: a temp dir under test has no git repo to ask. */
function walkTracked(root: string, rel = "", out: string[] = []): string[] {
  const SKIP = new Set(["node_modules", ".git", "build", "dist", "coverage", ".vitest"]);
  let entries: string[];
  try { entries = readdirSync(join(root, rel)); } catch { return out; }
  for (const e of entries) {
    if (SKIP.has(e)) continue;
    const childRel = rel ? `${rel}/${e}` : e;
    const abs = join(root, childRel);
    let isDir = false;
    try { isDir = statSync(abs).isDirectory(); } catch { continue; }
    if (isDir) walkTracked(root, childRel, out);
    else if (/\.(md|ts|mjs|cjs|js|json)$/.test(e)) out.push(childRel);
  }
  return out;
}
