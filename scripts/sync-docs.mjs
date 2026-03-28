#!/usr/bin/env node
/**
 * sync-docs.mjs — Single source of truth doc synchronization
 *
 * Reads from authoritative files:
 *   - package.json         → version
 *   - CHANGELOG.md         → latest features/fixes
 *   - .agents/SYSTEM/SUMMARY.md → project status
 *
 * Updates downstream files:
 *   - README.md            → version reference
 *   - .agents/SYSTEM/PRD.md → version in table
 *   - knowledge-mcp/package.json → version field
 *
 * Usage:
 *   node scripts/sync-docs.mjs          # fix drift in place
 *   node scripts/sync-docs.mjs --check  # report drift only (exit 1 if found)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const checkOnly = process.argv.includes("--check");
const drifts = [];
const fixes = [];

// ── Helpers ──────────────────────────────────────────────────────────

function read(relPath) {
  const full = join(ROOT, relPath);
  if (!existsSync(full)) return null;
  return readFileSync(full, "utf-8");
}

function write(relPath, content) {
  writeFileSync(join(ROOT, relPath), content, "utf-8");
}

function reportDrift(file, field, expected, actual) {
  drifts.push({ file, field, expected, actual });
}

function reportFix(file, field, from, to) {
  fixes.push({ file, field, from, to });
}

// ── Read authoritative sources ───────────────────────────────────────

const pkg = JSON.parse(read("package.json"));
const version = pkg.version; // e.g. "0.3.2"
const vVersion = `v${version}`; // e.g. "v0.3.2"

console.log(`\nAuthoritative version: ${vVersion} (from package.json)\n`);

// ── Check: README.md ─────────────────────────────────────────────────

const readme = read("README.md");
if (readme) {
  // Match patterns like **Latest: v0.3.1** or just standalone v0.3.1
  const versionPattern = /\*\*Latest:\s*v[\d.]+\*\*/;
  const match = readme.match(versionPattern);

  if (match) {
    const expected = `**Latest: ${vVersion}**`;
    if (match[0] !== expected) {
      reportDrift("README.md", "version", expected, match[0]);
      if (!checkOnly) {
        const updated = readme.replace(versionPattern, expected);
        write("README.md", updated);
        reportFix("README.md", "version", match[0], expected);
      }
    }
  } else {
    // Try bare version pattern
    const barePattern = /v\d+\.\d+\.\d+/;
    const bareMatch = readme.match(barePattern);
    if (bareMatch && bareMatch[0] !== vVersion) {
      reportDrift("README.md", "version (bare)", vVersion, bareMatch[0]);
    }
  }
} else {
  console.log("  SKIP: README.md not found");
}

// ── Check: .agents/SYSTEM/PRD.md ─────────────────────────────────────

const prd = read(".agents/SYSTEM/PRD.md");
if (prd) {
  // Match: | **Version** | v0.3.0 |
  const prdPattern = /(\|\s*\*\*Version\*\*\s*\|\s*)v[\d.]+(\s*\|)/;
  const prdMatch = prd.match(prdPattern);

  if (prdMatch) {
    const currentInPrd = prd.match(/\*\*Version\*\*\s*\|\s*(v[\d.]+)/)?.[1];
    if (currentInPrd !== vVersion) {
      reportDrift("PRD.md", "version", vVersion, currentInPrd);
      if (!checkOnly) {
        const updated = prd.replace(prdPattern, `$1${vVersion}$2`);
        write(".agents/SYSTEM/PRD.md", updated);
        reportFix("PRD.md", "version", currentInPrd, vVersion);
      }
    }
  }
} else {
  console.log("  SKIP: .agents/SYSTEM/PRD.md not found");
}

// ── Check: knowledge-mcp/package.json ────────────────────────────────

const kmcpPkg = read("knowledge-mcp/package.json");
if (kmcpPkg) {
  const kmcp = JSON.parse(kmcpPkg);
  if (kmcp.version !== version) {
    reportDrift("knowledge-mcp/package.json", "version", version, kmcp.version);
    if (!checkOnly) {
      kmcp.version = version;
      write("knowledge-mcp/package.json", JSON.stringify(kmcp, null, 2) + "\n");
      reportFix("knowledge-mcp/package.json", "version", kmcp.version, version);
    }
  }
} else {
  console.log("  SKIP: knowledge-mcp/package.json not found");
}

// ── Check: CHANGELOG.md has entry for current version ────────────────

const changelog = read("CHANGELOG.md");
if (changelog) {
  const changelogPattern = new RegExp(`## \\[${vVersion.replace(/\./g, "\\.")}\\]`);
  if (!changelogPattern.test(changelog)) {
    reportDrift("CHANGELOG.md", "entry", `## [${vVersion}] entry`, "missing");
  }
}

// ── Report ───────────────────────────────────────────────────────────

if (drifts.length === 0) {
  console.log("All docs in sync.\n");
  process.exit(0);
}

if (checkOnly) {
  console.log(`DRIFT DETECTED (${drifts.length} issue${drifts.length > 1 ? "s" : ""}):\n`);
  for (const d of drifts) {
    console.log(`  ${d.file} → ${d.field}: expected "${d.expected}", found "${d.actual}"`);
  }
  console.log("\nRun 'node scripts/sync-docs.mjs' or '/sync' to fix.\n");
  process.exit(1);
}

console.log(`Fixed ${fixes.length} file${fixes.length > 1 ? "s" : ""}:\n`);
for (const f of fixes) {
  console.log(`  ${f.file} → ${f.field}: "${f.from}" → "${f.to}"`);
}

// Report any drift that couldn't be auto-fixed
const unfixed = drifts.filter(
  (d) => !fixes.some((f) => f.file === d.file && f.field === d.field)
);
if (unfixed.length > 0) {
  console.log(`\nManual attention needed (${unfixed.length}):\n`);
  for (const d of unfixed) {
    console.log(`  ${d.file} → ${d.field}: expected "${d.expected}", found "${d.actual}"`);
  }
}

console.log();
