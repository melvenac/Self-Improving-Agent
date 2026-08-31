import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import Database from "better-sqlite3";
import type { CheckResult } from "./types.js";
import { parseSkillIndexRows } from "../../shared/skill-index.js";

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
 * `bootstrap`, `skill-scan`, `task` and `test` are Claude Code workflows that
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

export function checkSummary(version: string, projectRoot: string): CheckResult {
  const summaryPath = join(projectRoot, ".agents", "SYSTEM", "SUMMARY.md");
  if (!existsSync(summaryPath)) {
    return { name: "summary", severity: "warn", message: ".agents/SYSTEM/SUMMARY.md not found" };
  }
  const content = readFileSync(summaryPath, "utf-8");
  if (content.includes(version)) {
    return { name: "summary", severity: "pass", message: `SUMMARY.md contains version ${version}` };
  }
  return { name: "summary", severity: "issue", message: `SUMMARY.md does not mention version ${version}` };
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
 * The damage is not that a row is missing. `skill-scan` reads `Experiences/`
 * recursively, so an unindexed note still drives skill clustering while being
 * invisible to `ob_recall` — knowledge that shapes proposals but can never be
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
  // whole point: a duplicate is counted twice by skill-scan and inflates the
  // cluster sizes that gate skill proposals, while an unindexed note is simply
  // unreachable. Reporting both as "not in the index" hides the first entirely.
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
    parts.push(`${duplicates.length} duplicate note(s) — same note filed under two folders, so skill-scan counts it twice: ${rel(duplicates[0])}`);
  }
  if (unindexed.length > 0) {
    parts.push(`${unindexed.length} unindexed note(s) — feed skill-scan but unreachable by ob_recall: ${rel(unindexed[0])}`);
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
