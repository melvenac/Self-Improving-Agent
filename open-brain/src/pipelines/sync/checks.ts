import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult } from "./types.js";

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

export function syncPrdVersion(
  version: string,
  projectRoot: string,
  checkOnly: boolean
): CheckResult {
  const prdPath = join(projectRoot, "docs", "PRD.md");
  if (!existsSync(prdPath)) {
    return { name: "prd-version", severity: "warn", message: "PRD.md not found" };
  }

  const content = readFileSync(prdPath, "utf-8");
  const pattern = /\| Version \| [\d.]+ \|/;
  const expected = `| Version | ${version} |`;

  if (content.includes(expected)) {
    return { name: "prd-version", severity: "pass", message: `PRD version matches ${version}` };
  }

  if (!pattern.test(content)) {
    return { name: "prd-version", severity: "warn", message: "No version pattern found in PRD.md" };
  }

  if (checkOnly) {
    return { name: "prd-version", severity: "issue", message: `PRD version does not match ${version}` };
  }

  const fixed = content.replace(pattern, expected);
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
  const refPattern = /(?:scripts\/[\w./\-]+|knowledge-mcp\/scripts\/[\w./\-]+)/g;
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
  const expectedDirs = ["Experiences", "Sessions", "Skill-Candidates", "Summaries"];
  const missing = expectedDirs.filter((d) => !existsSync(join(vaultPath, d)));
  if (missing.length > 0) {
    return { name: "obsidian-vault", severity: "warn", message: `Vault missing directories: ${missing.join(", ")}` };
  }
  return { name: "obsidian-vault", severity: "pass", message: "Vault has all expected directories" };
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

export function checkSpecProvenance(projectRoot: string, dbPath: string): CheckResult {
  const specsDir = join(projectRoot, "specs");
  if (!existsSync(specsDir)) {
    return { name: "spec-provenance", severity: "warn", message: "specs/ directory not found" };
  }
  const files = readdirSync(specsDir).filter((f) => f.endsWith(".md"));
  return { name: "spec-provenance", severity: "pass", message: `specs/ has ${files.length} spec file(s)` };
}

export function checkRules(projectRoot: string): CheckResult {
  const rulesPath = join(projectRoot, "RULES.md");
  if (!existsSync(rulesPath)) {
    return { name: "rules", severity: "warn", message: "RULES.md not found" };
  }
  return { name: "rules", severity: "pass", message: "RULES.md exists" };
}
