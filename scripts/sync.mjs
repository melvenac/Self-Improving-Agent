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

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const HOME = homedir();
const checkOnly = process.argv.includes("--check");

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

// ── Run all checks ─────────────────────────────────────────────────

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

// ── Report ─────────────────────────────────────────────────────────

console.log();

if (fixes.length > 0) {
  console.log(`🔧 FIXED (${fixes.length}):\n`);
  for (const f of fixes) {
    console.log(`  [${f.category}] ${f.field}: "${f.from}" → "${f.to}"`);
  }
  console.log();
}

if (issues.length > 0) {
  console.log(`❌ ISSUES (${issues.length}):\n`);
  for (const i of issues) {
    console.log(`  [${i.category}] ${i.message}`);
    if (i.detail) console.log(`    → ${i.detail}`);
  }
  console.log();
}

if (warnings.length > 0) {
  console.log(`⚠️  WARNINGS (${warnings.length}):\n`);
  for (const w of warnings) {
    console.log(`  [${w.category}] ${w.message}`);
    if (w.detail) console.log(`    → ${w.detail}`);
  }
  console.log();
}

const totalIssues = issues.length - fixes.length; // fixed issues don't count
console.log(`✅ PASSED: ${passed.length} checks`);
console.log(`🔧 FIXED: ${fixes.length}`);
console.log(`⚠️  WARNINGS: ${warnings.length}`);
console.log(`❌ ISSUES: ${totalIssues > 0 ? totalIssues : 0}`);
console.log();

if (checkOnly && issues.length > 0) {
  process.exit(1);
}
