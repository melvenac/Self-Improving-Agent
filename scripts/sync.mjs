#!/usr/bin/env node
/**
 * sync.mjs — Unified consistency checker for the Self-Improving Agent
 *
 * Combines version synchronization (formerly sync-docs.mjs) with structural
 * consistency checks (formerly harness-eval.mjs) into a single script.
 *
 * Inspired by Meta-Harness (Lee et al., 2026): don't compress diagnostic signal.
 * Traces file references, version numbers, hook configs, and cross-document
 * consistency across the entire protocol.
 *
 * Checks:
 *   1. Version sync — package.json → README, PRD, knowledge-mcp/package.json
 *   2. CHANGELOG — entry exists for current version
 *   3. README — all referenced scripts/files exist, no stale references
 *   4. RULES.md — hook order matches actual scripts
 *   5. Hook configs — settings.json hooks point to real files
 *   6. SUMMARY.md — version matches, broken/next reconciled with INBOX
 *   7. CLAUDE.md — referenced paths exist
 *   8. Obsidian vault — expected directories exist
 *   9. Template — project-template/ mirrors expected structure
 *
 * Usage:
 *   node scripts/sync.mjs          # auto-fix versions + full report
 *   node scripts/sync.mjs --check  # report only, exit 1 if issues found
 */

import { readFileSync, writeFileSync, existsSync, statSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const HOME = homedir();
const checkOnly = process.argv.includes("--check");
const scoreMode = process.argv.includes("--score");
const historyMode = process.argv.includes("--history");
const scoreJson = scoreMode && process.argv.includes("--json");

const issues = [];
const warnings = [];
const fixes = [];
const passed = [];

// ── Helpers ──────────────────────────────────────────────────────────

function read(relPath, base = ROOT) {
  const full = join(base, relPath);
  if (!existsSync(full)) return null;
  return readFileSync(full, "utf-8");
}

function write(relPath, content) {
  writeFileSync(join(ROOT, relPath), content, "utf-8");
}

function fileExists(absPath) {
  return existsSync(absPath);
}

function issue(category, message, detail) {
  issues.push({ category, message, detail });
}

function warn(category, message, detail) {
  warnings.push({ category, message, detail });
}

function fix(category, field, from, to) {
  fixes.push({ category, field, from, to });
}

function pass(category, message) {
  passed.push({ category, message });
}

// ── Scoring ────────────────────────────────────────────────────────
const scoreCategories = {
  config:    { points: 0, max: 25, details: [] },
  knowledge: { points: 0, max: 25, details: [] },
  staleness: { points: 0, max: 20, details: [] },
  coverage:  { points: 0, max: 20, details: [] },
  pipeline:  { points: 0, max: 10, details: [] },
};

function score(category, points, max, detail) {
  const cat = scoreCategories[category];
  if (!cat) return;
  cat.points += points;
  cat.details.push({ points, max, detail });
}

// ── Read authoritative source ───────────────────────────────────────

const pkg = JSON.parse(read("package.json"));
const version = pkg.version;
const vVersion = `v${version}`;

console.log(`\n📋 Sync — v${version} (from package.json)\n`);
console.log("=".repeat(60));

// ── 1. Version sync: README.md ──────────────────────────────────────

function syncReadmeVersion() {
  const readme = read("README.md");
  if (!readme) { issue("VERSION", "README.md not found"); return; }

  const versionPattern = /\*\*Latest:\s*v[\d.]+\*\*/;
  const match = readme.match(versionPattern);

  if (match) {
    const expected = `**Latest: ${vVersion}**`;
    if (match[0] !== expected) {
      issue("VERSION", `README.md version: expected "${expected}", found "${match[0]}"`);
      if (!checkOnly) {
        write("README.md", readme.replace(versionPattern, expected));
        fix("VERSION", "README.md", match[0], expected);
      }
    } else {
      pass("VERSION", `README.md version correct (${vVersion})`);
    }
  }
}

// ── 2. Version sync: PRD.md ────────────────────────────────────────

function syncPrdVersion() {
  const prd = read(".agents/SYSTEM/PRD.md");
  if (!prd) { return; } // PRD is optional

  const prdPattern = /(\|\s*\*\*Version\*\*\s*\|\s*)v[\d.]+(\s*\|)/;
  const currentInPrd = prd.match(/\*\*Version\*\*\s*\|\s*(v[\d.]+)/)?.[1];

  if (currentInPrd && currentInPrd !== vVersion) {
    issue("VERSION", `PRD.md version: expected "${vVersion}", found "${currentInPrd}"`);
    if (!checkOnly) {
      write(".agents/SYSTEM/PRD.md", prd.replace(prdPattern, `$1${vVersion}$2`));
      fix("VERSION", "PRD.md", currentInPrd, vVersion);
    }
  } else if (currentInPrd) {
    pass("VERSION", `PRD.md version correct (${vVersion})`);
  }
}

// ── 3. Version sync: knowledge-mcp/package.json ────────────────────

function syncKmcpVersion() {
  const kmcpPkg = read("knowledge-mcp/package.json");
  if (!kmcpPkg) { issue("VERSION", "knowledge-mcp/package.json not found"); return; }

  const kmcp = JSON.parse(kmcpPkg);
  if (kmcp.version !== version) {
    issue("VERSION", `knowledge-mcp/package.json version: expected "${version}", found "${kmcp.version}"`);
    if (!checkOnly) {
      kmcp.version = version;
      write("knowledge-mcp/package.json", JSON.stringify(kmcp, null, 2) + "\n");
      fix("VERSION", "knowledge-mcp/package.json", kmcp.version, version);
    }
  } else {
    pass("VERSION", `knowledge-mcp/package.json version correct (${version})`);
  }
}

// ── 4. CHANGELOG has entry for current version ─────────────────────

function checkChangelog() {
  const changelog = read("CHANGELOG.md");
  if (!changelog) { warn("CHANGELOG", "CHANGELOG.md not found"); return; }

  const pattern = new RegExp(`## \\[${vVersion.replace(/\./g, "\\.")}\\]`);
  if (!pattern.test(changelog)) {
    issue("CHANGELOG", `No entry found for ${vVersion}`);
  } else {
    pass("CHANGELOG", `Entry exists for ${vVersion}`);
  }
}

// ── 5. README file references ──────────────────────────────────────

function checkReadmeRefs() {
  const readme = read("README.md");
  if (!readme) return; // Already flagged in syncReadmeVersion

  const scriptRefs = [
    { name: "session-end.mjs", repoPath: "knowledge-mcp/scripts/session-end.mjs" },
    { name: "skill-scan.mjs", repoPath: "knowledge-mcp/scripts/skill-scan.mjs" },
    { name: "session-bootstrap.mjs", repoPath: "scripts/session-bootstrap.mjs" },
    { name: "backfill-concepts.mjs", repoPath: "knowledge-mcp/scripts/backfill-concepts.mjs" },
    { name: "setup.mjs", repoPath: "scripts/setup.mjs" },
    { name: "sync.mjs", repoPath: "scripts/sync.mjs" },
    { name: "dashboard.mjs", repoPath: "knowledge-mcp/scripts/dashboard.mjs" },
  ];

  for (const ref of scriptRefs) {
    if (readme.includes(ref.name)) {
      if (!fileExists(join(ROOT, ref.repoPath))) {
        issue("README", `References \`${ref.name}\` but not found at ${ref.repoPath}`);
      } else {
        pass("README", `\`${ref.name}\` reference valid`);
      }
    }
  }

  // Stale script references
  const staleScripts = ["vault-writer.mjs", "vault-sync-projects.mjs", "auto-index.mjs"];
  for (const stale of staleScripts) {
    if (readme.includes(stale)) {
      issue("README", `References removed script \`${stale}\``);
    }
  }

  // Stale directory references
  const dirPattern = /mkdir.*Guidelines|\{[^}]*Guidelines[^}]*\}/i;
  if (dirPattern.test(readme)) {
    issue("README", "Creates stale directory `Guidelines/`", "Renamed to Skill-Candidates/ in v0.5.2");
  }

  pass("README", "File reference scan complete");
}

// ── 6. RULES.md hook order ─────────────────────────────────────────

function checkRules() {
  const rules = read(".agents/SYSTEM/RULES.md");
  if (!rules) { warn("RULES", ".agents/SYSTEM/RULES.md not found"); return; }

  const staleScripts = ["vault-writer.mjs", "vault-sync-projects.mjs", "auto-index.mjs"];
  for (const stale of staleScripts) {
    if (rules.includes(stale)) {
      issue("RULES", `References removed script \`${stale}\``);
    }
  }

  const expectedOrder = ["session-end.mjs", "skill-scan.mjs"];
  const hookOrderMatch = rules.match(/Hook execution order.*?:(.*)/i);
  if (hookOrderMatch) {
    const orderLine = hookOrderMatch[1];
    const mentionedScripts = expectedOrder.filter(s => orderLine.includes(s));
    if (mentionedScripts.length === expectedOrder.length) {
      const idx1 = orderLine.indexOf(expectedOrder[0]);
      const idx2 = orderLine.indexOf(expectedOrder[1]);
      if (idx1 < idx2) {
        pass("RULES", "Hook execution order is correct");
      } else {
        issue("RULES", "Hook execution order is wrong", `Expected: ${expectedOrder.join(" → ")}`);
      }
    } else {
      warn("RULES", "Hook order line doesn't mention all expected scripts");
    }
  }

  pass("RULES", "Rules scan complete");
}

// ── 7. Settings.json hook configs ──────────────────────────────────

function checkHookConfigs() {
  const settingsPath = join(HOME, ".claude/settings.json");
  if (!fileExists(settingsPath)) { warn("HOOKS", "~/.claude/settings.json not found"); return; }

  let settings;
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
  } catch (e) {
    issue("HOOKS", "Failed to parse settings.json", e.message);
    return;
  }

  if (!settings.hooks) { warn("HOOKS", "No hooks defined in settings.json"); return; }

  const protocolScripts = ["knowledge-mcp", "session-bootstrap", "session-end", "skill-scan", "vault-writer", "vault-utils"];

  for (const [event, hookConfigs] of Object.entries(settings.hooks)) {
    if (!Array.isArray(hookConfigs)) continue;
    for (const config of hookConfigs) {
      if (!config.hooks || !Array.isArray(config.hooks)) continue;
      for (const hook of config.hooks) {
        if (hook.type !== "command" || !hook.command) continue;

        const isProtocolHook = protocolScripts.some(s => hook.command.includes(s));
        if (!isProtocolHook) continue;

        const nodeMatch = hook.command.match(/node\s+["']?([^"']+\.m?js)["']?/);
        if (nodeMatch) {
          let scriptPath = nodeMatch[1].trim();
          scriptPath = scriptPath.replace(/^~/, HOME);
          scriptPath = scriptPath.replace(/\//g, "\\");

          if (!fileExists(scriptPath)) {
            issue("HOOKS", `${event} hook references missing file: ${nodeMatch[1]}`, `Full command: ${hook.command}`);
          } else {
            pass("HOOKS", `${event} → \`${nodeMatch[1]}\` exists`);
          }
        }
      }
    }
  }
}

// ── 8. SUMMARY.md consistency ──────────────────────────────────────

function checkSummary() {
  const summary = read(".agents/SYSTEM/SUMMARY.md");
  if (!summary) { warn("SUMMARY", ".agents/SYSTEM/SUMMARY.md not found"); return; }

  const versionMatch = summary.match(/v(\d+\.\d+\.\d+)/);
  if (versionMatch) {
    if (`v${versionMatch[1]}` !== vVersion) {
      issue("SUMMARY", `Version mismatch: SUMMARY says v${versionMatch[1]}, package.json says ${vVersion}`);
    } else {
      pass("SUMMARY", `Version matches package.json (${vVersion})`);
    }
  }

  const inbox = read(".agents/TASKS/INBOX.md");
  if (inbox && summary.includes("What's broken")) {
    const brokenSection = summary.match(/What's broken[^]*?(?=\n##|\n\*\*|$)/i)?.[0] || "";
    const completedItems = [...inbox.matchAll(/- \[x\]\s+\*\*(.+?)\*\*/g)].map(m => m[1]);

    for (const item of completedItems) {
      const shortName = item.split("—")[0].trim().toLowerCase();
      if (brokenSection.toLowerCase().includes(shortName.substring(0, 20))) {
        warn("SUMMARY", `Completed INBOX item "${item}" may still be listed as broken`);
      }
    }
  }

  pass("SUMMARY", "SUMMARY scan complete");
}

// ── 9. CLAUDE.md path references ───────────────────────────────────

function checkClaudeMd() {
  const claudeMd = read("CLAUDE.md");
  if (!claudeMd) { warn("CLAUDE.md", "No CLAUDE.md found in project root"); return; }

  const dirRefs = [
    { pattern: /knowledge-mcp\/src\//, path: "knowledge-mcp/src" },
    { pattern: /knowledge-mcp\/scripts\//, path: "knowledge-mcp/scripts" },
    { pattern: /scripts\//, path: "scripts" },
    { pattern: /project-template\//, path: "project-template" },
    { pattern: /\.claude\/commands\//, path: ".claude/commands" },
  ];

  for (const ref of dirRefs) {
    if (ref.pattern.test(claudeMd)) {
      if (!fileExists(join(ROOT, ref.path))) {
        issue("CLAUDE.md", `References \`${ref.path}/\` but directory not found`);
      } else {
        pass("CLAUDE.md", `\`${ref.path}/\` exists`);
      }
    }
  }
}

// ── 10. Obsidian vault structure ───────────────────────────────────

function checkObsidianVault() {
  const vaultPath = join(HOME, "Obsidian Vault");
  if (!fileExists(vaultPath)) { warn("VAULT", "Obsidian Vault not found at ~/Obsidian Vault"); return; }

  const expectedDirs = ["Experiences", "Sessions", "Skill-Candidates", "Summaries", "Research"];
  for (const dir of expectedDirs) {
    if (!fileExists(join(vaultPath, dir))) {
      issue("VAULT", `Missing expected directory: ~/Obsidian Vault/${dir}/`);
    } else {
      pass("VAULT", `\`${dir}/\` exists`);
    }
  }

  const staleDirs = ["Guidelines"];
  for (const dir of staleDirs) {
    if (fileExists(join(vaultPath, dir))) {
      warn("VAULT", `Stale directory still exists: ~/Obsidian Vault/${dir}/`);
    }
  }
}

// ── 11. Template consistency ───────────────────────────────────────

function checkTemplate() {
  const templatePath = join(ROOT, "project-template");
  if (!fileExists(templatePath)) { warn("TEMPLATE", "project-template/ not found"); return; }

  const expectedFiles = [
    "project-template/.agents/SYSTEM/PRD.md",
    "project-template/.agents/SYSTEM/ENTITIES.md",
    "project-template/.agents/SYSTEM/SUMMARY.md",
    "project-template/.agents/TASKS/INBOX.md",
    "project-template/.agents/SESSIONS/SESSION_TEMPLATE.md",
  ];

  for (const f of expectedFiles) {
    if (!fileExists(join(ROOT, f))) {
      issue("TEMPLATE", `Missing template file: ${f}`);
    } else {
      pass("TEMPLATE", `\`${f}\` exists`);
    }
  }
}

function printScoreReport() {
  const total = Object.values(scoreCategories).reduce((s, c) => s + Math.min(c.points, c.max), 0);
  const maxTotal = Object.values(scoreCategories).reduce((s, c) => s + c.max, 0);

  if (scoreJson) {
    const result = {
      date: new Date().toISOString().slice(0, 10),
      total,
      config: Math.min(scoreCategories.config.points, scoreCategories.config.max),
      knowledge: Math.min(scoreCategories.knowledge.points, scoreCategories.knowledge.max),
      staleness: Math.min(scoreCategories.staleness.points, scoreCategories.staleness.max),
      coverage: Math.min(scoreCategories.coverage.points, scoreCategories.coverage.max),
      pipeline: Math.min(scoreCategories.pipeline.points, scoreCategories.pipeline.max),
      details: scoreCategories,
    };
    console.log(JSON.stringify(result));
    return;
  }

  console.log(`\nProtocol Health Score: ${total}/${maxTotal}\n`);
  for (const [name, cat] of Object.entries(scoreCategories)) {
    const catScore = Math.min(cat.points, cat.max);
    const bar = "\u2588".repeat(Math.round(catScore / cat.max * 20)).padEnd(20, "\u2591");
    const detailSummary = cat.details.filter(d => d.points < d.max).map(d => d.detail).join(", ");
    console.log(`  ${name.padEnd(18)} ${String(catScore).padStart(2)}/${cat.max}  ${bar}  ${detailSummary ? `(${detailSummary})` : ""}`);
  }
  console.log();
}

function printScoreHistory() {
  const historyPath = join(HOME, ".claude", "knowledge-mcp", "score-history.jsonl");
  if (!existsSync(historyPath)) {
    console.log("No score history found. Run --score to start tracking.");
    return;
  }
  const lines = readFileSync(historyPath, "utf-8").trim().split("\n").filter(Boolean);
  if (lines.length === 0) {
    console.log("Score history is empty.");
    return;
  }

  console.log("\nProtocol Health Score History:\n");
  const entries = lines.map(l => JSON.parse(l));
  for (const e of entries) {
    const bar = "\u2588".repeat(Math.round(e.total / 100 * 30)).padEnd(30, "\u2591");
    const session = e.session ? `Session ${String(e.session).padStart(2)}` : e.date;
    console.log(`  ${session}: ${String(e.total).padStart(3)}  ${bar}`);
  }

  if (entries.length >= 2) {
    const first = entries[0].total;
    const last = entries[entries.length - 1].total;
    const diff = last - first;
    const trend = diff > 0 ? `+${diff} (improving)` : diff < 0 ? `${diff} (declining)` : "unchanged";
    console.log(`\n  Trend: ${trend} over ${entries.length} sessions`);
  }
  console.log();
}

// ── DB helper ─────────────────────────────────────────────────────────

function openKnowledgeDb() {
  const dbPath = join(HOME, ".claude", "context-mode", "knowledge.db");
  if (!existsSync(dbPath)) return null;
  try {
    // Resolve better-sqlite3 from knowledge-mcp's node_modules
    const kmcpPkgPath = join(HOME, ".claude", "knowledge-mcp", "package.json");
    let Database;
    if (existsSync(kmcpPkgPath)) {
      const require = createRequire(kmcpPkgPath);
      Database = require("better-sqlite3");
    } else {
      // Fallback: try repo-local knowledge-mcp
      const localPkgPath = join(ROOT, "knowledge-mcp", "package.json");
      const require = createRequire(localPkgPath);
      Database = require("better-sqlite3");
    }
    return new Database(dbPath, { readonly: true });
  } catch (err) {
    console.error(`[score] Failed to open knowledge.db: ${err.message}`);
    return null;
  }
}

// ── Scoring functions ─────────────────────────────────────────────────

function scoreConfigStructure() {
  const totalChecks = passed.length + issues.length + warnings.length;
  if (totalChecks === 0) {
    score("config", 0, 25, "no checks ran");
    return;
  }
  const effectivePassed = passed.length + warnings.length * 0.5;
  const points = Math.round((effectivePassed / totalChecks) * 25);
  score("config", points, 25,
    points < 25 ? `${issues.length} issues, ${warnings.length} warnings` : "all checks pass"
  );
}

function scoreKnowledgeQuality() {
  const db = openKnowledgeDb();
  if (!db) { score("knowledge", 0, 25, "knowledge.db not found"); return; }

  try {
    // Recall precision: % of feedback-rated entries marked helpful (10 pts)
    const feedback = db.prepare(`
      SELECT
        SUM(helpful_count) as helpful,
        SUM(harmful_count) as harmful,
        SUM(neutral_count) as neutral
      FROM knowledge
      WHERE helpful_count + harmful_count + neutral_count > 0
    `).get();

    if (feedback && (feedback.helpful + feedback.harmful + feedback.neutral) > 0) {
      const total = feedback.helpful + feedback.harmful + feedback.neutral;
      const precision = feedback.helpful / total;
      const pts = Math.round(precision * 10);
      score("knowledge", pts, 10, pts < 10 ? `${Math.round(precision * 100)}% recall precision` : "high recall precision");
    } else {
      score("knowledge", 5, 10, "no feedback data yet");
    }

    // Feedback coverage: % of entries with at least 1 rating (8 pts)
    const totalK = db.prepare("SELECT COUNT(*) as c FROM knowledge").get();
    const rated = db.prepare("SELECT COUNT(*) as c FROM knowledge WHERE helpful_count + harmful_count + neutral_count > 0").get();

    if (totalK.c > 0) {
      const coverage = rated.c / totalK.c;
      const pts = Math.round(coverage * 8);
      score("knowledge", pts, 8, pts < 8 ? `${rated.c}/${totalK.c} entries have feedback` : "good feedback coverage");
    } else {
      score("knowledge", 0, 8, "no knowledge entries");
    }

    // Dedup check (7 pts)
    const dupes = db.prepare(`
      SELECT COUNT(*) as c FROM (
        SELECT SUBSTR(key, 1, 20) as prefix
        FROM knowledge WHERE key IS NOT NULL
        GROUP BY prefix HAVING COUNT(*) > 1
      )
    `).get();

    const dupePenalty = Math.min(dupes.c * 2, 7);
    score("knowledge", 7 - dupePenalty, 7, dupes.c > 0 ? `${dupes.c} potential duplicate clusters` : "no duplicates detected");
  } catch (err) {
    score("knowledge", 0, 25, `query error: ${err.message}`);
  } finally {
    db.close();
  }
}

function scoreStaleness() {
  const db = openKnowledgeDb();
  if (!db) { score("staleness", 0, 20, "knowledge.db not found"); return; }

  try {
    // Never-recalled entries 90+ days old (10 pts)
    const staleEntries = db.prepare("SELECT COUNT(*) as c FROM knowledge WHERE recall_count = 0 AND created_at < datetime('now', '-90 days')").get();
    const totalK = db.prepare("SELECT COUNT(*) as c FROM knowledge").get();

    if (totalK.c > 0) {
      const staleRatio = staleEntries.c / totalK.c;
      const pts = Math.round((1 - Math.min(staleRatio * 2, 1)) * 10);
      score("staleness", pts, 10, staleEntries.c > 0 ? `${staleEntries.c} entries never recalled (90+ days)` : "no stale entries");
    } else {
      score("staleness", 10, 10, "no entries to check");
    }

    // Low success rate entries (5 pts)
    const lowRate = db.prepare("SELECT COUNT(*) as c FROM knowledge WHERE success_rate IS NOT NULL AND success_rate < 0.3 AND helpful_count + harmful_count + neutral_count >= 3").get();
    const pts2 = lowRate.c === 0 ? 5 : Math.max(0, 5 - lowRate.c);
    score("staleness", pts2, 5, lowRate.c > 0 ? `${lowRate.c} entries below 0.3 success rate` : "no low-quality entries");

    // Summary coverage (5 pts)
    const totalSessions = db.prepare("SELECT COUNT(*) as c FROM sessions WHERE event_count >= 3").get();
    const summarized = db.prepare("SELECT COUNT(*) as c FROM summaries").get();

    if (totalSessions.c > 0) {
      const ratio = summarized.c / totalSessions.c;
      const pts3 = Math.round(ratio * 5);
      score("staleness", pts3, 5, pts3 < 5 ? `${summarized.c}/${totalSessions.c} sessions summarized` : "all sessions summarized");
    } else {
      score("staleness", 5, 5, "no sessions to check");
    }
  } catch (err) {
    score("staleness", 0, 20, `query error: ${err.message}`);
  } finally {
    db.close();
  }
}

function scoreCoverage() {
  const db = openKnowledgeDb();
  if (!db) { score("coverage", 0, 20, "knowledge.db not found"); return; }

  try {
    // Domain coverage from domains.json (10 pts)
    const domainsPath = join(ROOT, ".agents", "SYSTEM", "domains.json");
    if (existsSync(domainsPath)) {
      const domains = JSON.parse(readFileSync(domainsPath, "utf-8"));
      const domainTags = domains.tags || [];
      let covered = 0;
      for (const tag of domainTags) {
        const match = db.prepare("SELECT COUNT(*) as c FROM knowledge WHERE tags LIKE ?").get(`%${tag}%`);
        if (match.c >= 2) covered++;
      }
      if (domainTags.length > 0) {
        const ratio = covered / domainTags.length;
        const pts = Math.round(ratio * 10);
        score("coverage", pts, 10, pts < 10 ? `${covered}/${domainTags.length} domains have 2+ experiences` : "all domains covered");
      } else {
        score("coverage", 5, 10, "no domains.json tags defined");
      }
    } else {
      score("coverage", 5, 10, "no domains.json found");
    }

    // Maturity distribution (5 pts)
    const maturity = db.prepare("SELECT COUNT(CASE WHEN maturity = 'mature' THEN 1 END) as mature, COUNT(CASE WHEN maturity = 'proven' THEN 1 END) as proven, COUNT(*) as total FROM knowledge").get();
    if (maturity.total > 0) {
      const matureRatio = (maturity.mature + maturity.proven * 0.5) / maturity.total;
      const pts = Math.round(Math.min(matureRatio * 2, 1) * 5);
      score("coverage", pts, 5, `${maturity.mature} mature, ${maturity.proven} proven of ${maturity.total}`);
    } else {
      score("coverage", 0, 5, "no knowledge entries");
    }

    // Skill conversion (5 pts)
    const VAULT_PATH = join(HOME, "Obsidian Vault");
    const candidatesPath = join(VAULT_PATH, "Skill-Candidates", "SKILL-CANDIDATES.md");
    const skillIndexPath = join(VAULT_PATH, "Skill-Candidates", "SKILL-INDEX.md");
    let clusterCount = 0;
    let skillCount = 0;
    if (existsSync(candidatesPath)) {
      const content = readFileSync(candidatesPath, "utf-8");
      clusterCount = (content.match(/### \S+ \(\d+ experiences?\)/g) || []).length;
    }
    if (existsSync(skillIndexPath)) {
      const content = readFileSync(skillIndexPath, "utf-8");
      skillCount = (content.match(/has skill/g) || []).length;
    }
    if (clusterCount > 0) {
      const ratio = skillCount / clusterCount;
      const pts = Math.round(Math.min(ratio * 2, 1) * 5);
      score("coverage", pts, 5, `${skillCount}/${clusterCount} clusters have skills`);
    } else {
      score("coverage", 5, 5, "no skill clusters yet");
    }
  } catch (err) {
    score("coverage", 0, 20, `error: ${err.message}`);
  } finally {
    db.close();
  }
}

function scorePipelineHealth() {
  // SessionEnd hooks ran recently (4 pts)
  const logPath = join(HOME, "Obsidian Vault", "Logs", "session-end.log");
  if (existsSync(logPath)) {
    try {
      const stat = statSync(logPath);
      const hoursAgo = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60);
      if (hoursAgo <= 24) {
        score("pipeline", 4, 4, "hooks ran within 24h");
      } else if (hoursAgo <= 168) {
        score("pipeline", 2, 4, `hooks last ran ${Math.round(hoursAgo)}h ago`);
      } else {
        score("pipeline", 0, 4, `hooks last ran ${Math.round(hoursAgo / 24)}d ago`);
      }
    } catch {
      score("pipeline", 0, 4, "cannot read log file");
    }
  } else {
    score("pipeline", 0, 4, "no session-end.log found");
  }

  // Score trend (3 pts)
  const historyPath = join(HOME, ".claude", "knowledge-mcp", "score-history.jsonl");
  if (existsSync(historyPath)) {
    try {
      const lines = readFileSync(historyPath, "utf-8").trim().split("\n").filter(Boolean);
      const entries = lines.slice(-5).map(l => JSON.parse(l));
      if (entries.length >= 2) {
        const first = entries[0].total;
        const last = entries[entries.length - 1].total;
        const diff = last - first;
        if (diff > 0) score("pipeline", 3, 3, `improving (+${diff} over ${entries.length} sessions)`);
        else if (diff === 0) score("pipeline", 2, 3, "stable");
        else score("pipeline", 1, 3, `declining (${diff} over ${entries.length} sessions)`);
      } else {
        score("pipeline", 1, 3, "not enough history for trend");
      }
    } catch {
      score("pipeline", 0, 3, "cannot read score history");
    }
  } else {
    score("pipeline", 1, 3, "no score history yet");
  }

  // Shadow-recall log (3 pts)
  const shadowPath = join(HOME, ".claude", "knowledge-mcp", "shadow-recall.jsonl");
  if (existsSync(shadowPath)) {
    try {
      const stat = statSync(shadowPath);
      const hoursAgo = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60);
      score("pipeline", hoursAgo <= 168 ? 3 : 1, 3, hoursAgo <= 168 ? "shadow-recall data is recent" : "shadow-recall data is stale");
    } catch {
      score("pipeline", 0, 3, "cannot read shadow-recall log");
    }
  } else {
    score("pipeline", 0, 3, "no shadow-recall data yet");
  }
}

function appendScoreHistory(sessionNumber) {
  const total = Object.values(scoreCategories).reduce((s, c) => s + Math.min(c.points, c.max), 0);
  const entry = {
    date: new Date().toISOString().slice(0, 10),
    session: sessionNumber || null,
    project: "self-improving-agent",
    total,
    config: Math.min(scoreCategories.config.points, scoreCategories.config.max),
    knowledge: Math.min(scoreCategories.knowledge.points, scoreCategories.knowledge.max),
    staleness: Math.min(scoreCategories.staleness.points, scoreCategories.staleness.max),
    coverage: Math.min(scoreCategories.coverage.points, scoreCategories.coverage.max),
    pipeline: Math.min(scoreCategories.pipeline.points, scoreCategories.pipeline.max),
  };
  const historyPath = join(HOME, ".claude", "knowledge-mcp", "score-history.jsonl");
  appendFileSync(historyPath, JSON.stringify(entry) + "\n");
}

// ── Run all checks ─────────────────────────────────────────────────

if (historyMode) {
  printScoreHistory();
  process.exit(0);
}

syncReadmeVersion();
syncPrdVersion();
syncKmcpVersion();
checkChangelog();
checkReadmeRefs();
checkRules();
checkHookConfigs();
checkSummary();
checkClaudeMd();
checkObsidianVault();
checkTemplate();

if (scoreMode) {
  scoreConfigStructure();
  scoreKnowledgeQuality();
  scoreStaleness();
  scoreCoverage();
  scorePipelineHealth();
  printScoreReport();
  if (!scoreJson) {
    appendScoreHistory();
  }
} else {
  // ── Report ─────────────────────────────────────────────────────────
  console.log();

  if (fixes.length > 0) {
    console.log(`\u{1f527} FIXED (${fixes.length}):\n`);
    for (const f of fixes) {
      console.log(`  [${f.category}] ${f.field}: "${f.from}" \u2192 "${f.to}"`);
    }
    console.log();
  }

  if (issues.length > 0) {
    console.log(`\u274c ISSUES (${issues.length}):\n`);
    for (const i of issues) {
      console.log(`  [${i.category}] ${i.message}`);
      if (i.detail) console.log(`    \u2192 ${i.detail}`);
    }
    console.log();
  }

  if (warnings.length > 0) {
    console.log(`\u26a0\ufe0f  WARNINGS (${warnings.length}):\n`);
    for (const w of warnings) {
      console.log(`  [${w.category}] ${w.message}`);
      if (w.detail) console.log(`    \u2192 ${w.detail}`);
    }
    console.log();
  }

  const totalIssues = issues.length - fixes.length;
  console.log(`\u2705 PASSED: ${passed.length} checks`);
  console.log(`\u{1f527} FIXED: ${fixes.length}`);
  console.log(`\u26a0\ufe0f  WARNINGS: ${warnings.length}`);
  console.log(`\u274c ISSUES: ${totalIssues > 0 ? totalIssues : 0}`);
  console.log();
}

if (checkOnly && issues.length > 0) {
  process.exit(1);
}
