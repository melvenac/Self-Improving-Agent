import { readFileSync, writeFileSync, existsSync } from "node:fs";
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

export function syncKmcpVersion(
  version: string,
  projectRoot: string,
  checkOnly: boolean
): CheckResult {
  const kmcpPath = join(projectRoot, "knowledge-mcp", "package.json");
  if (!existsSync(kmcpPath)) {
    return { name: "kmcp-version", severity: "warn", message: "knowledge-mcp/package.json not found" };
  }

  const pkg = JSON.parse(readFileSync(kmcpPath, "utf-8"));

  if (pkg.version === undefined) {
    return { name: "kmcp-version", severity: "warn", message: "No version field in knowledge-mcp/package.json" };
  }

  if (pkg.version === version) {
    return { name: "kmcp-version", severity: "pass", message: `knowledge-mcp version matches ${version}` };
  }

  if (checkOnly) {
    return { name: "kmcp-version", severity: "issue", message: `knowledge-mcp version ${pkg.version} does not match ${version}` };
  }

  pkg.version = version;
  writeFileSync(kmcpPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
  return { name: "kmcp-version", severity: "fixed", message: `knowledge-mcp version updated to ${version}`, autoFixed: true };
}
