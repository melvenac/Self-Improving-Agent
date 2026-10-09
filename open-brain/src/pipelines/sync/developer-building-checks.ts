import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readJson } from "../../shared/fs-utils.js";
import type { CheckResult } from "./types.js";

export const DEVELOPER_ROLE_REL = ".agents/roles/developer.md";
export const BUILDING_CHECKS_HEADING = "Building checks";
export const DEVELOPER_BUILDING_CHECKS_MDC_REL = ".cursor/rules/developer-building-checks.mdc";
export const REQUIRED_BLOCK_REL = ".agents/SYSTEM/required-block.json";

const GENERATED_HEADER_PREFIX = "<!-- generated from ";

/** Same as `git hash-object --stdin` on the UTF-8 bytes (LF-normalised section text). */
export function gitHashObjectStdin(content: string): string {
  return execFileSync("git", ["hash-object", "--stdin"], { input: content, encoding: "utf8" }).trim();
}

/** Normalize line endings to LF for stable generation under `core.autocrlf`. */
export function normalizeLf(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Extract the `## Building checks` section through the line before the next `## ` heading (or EOF).
 * Returns text starting with `## Building checks` and normalized to LF.
 */
export function extractBuildingChecksSection(md: string): string {
  const normalized = normalizeLf(md);
  const needle = `## ${BUILDING_CHECKS_HEADING}`;
  const start = normalized.indexOf(needle);
  if (start < 0) {
    throw new Error(`${DEVELOPER_ROLE_REL} has no "## ${BUILDING_CHECKS_HEADING}" section`);
  }
  const after = normalized.slice(start + needle.length);
  const next = after.search(/\n## /);
  const body = next < 0 ? after : after.slice(0, next);
  return `${needle}${body}`.replace(/\s+$/, "") + "\n";
}

export function readDeveloperRoleMarkdown(projectRoot: string): string {
  const path = join(projectRoot, DEVELOPER_ROLE_REL);
  if (!existsSync(path)) throw new Error(`${DEVELOPER_ROLE_REL} not found`);
  return readFileSync(path, "utf8");
}

export function buildingChecksSectionFromRoot(projectRoot: string): string {
  return extractBuildingChecksSection(readDeveloperRoleMarkdown(projectRoot));
}

export interface RequiredBlockConfig {
  path: string;
  heading: string;
}

export function readRequiredBlockConfig(projectRoot: string): RequiredBlockConfig {
  const cfgPath = join(projectRoot, REQUIRED_BLOCK_REL);
  const data = readJson<RequiredBlockConfig>(cfgPath);
  if (!data || typeof data.path !== "string" || typeof data.heading !== "string") {
    throw new Error(`${REQUIRED_BLOCK_REL} missing or invalid { path, heading }`);
  }
  return data;
}

/** Same bytes F1 writes into the `.mdc` body (section only, after the generated header line). */
export function requiredBlockSectionText(projectRoot: string): string {
  const cfg = readRequiredBlockConfig(projectRoot);
  const rel = cfg.path.replace(/\\/g, "/");
  const md = readFileSync(join(projectRoot, rel), "utf8");
  if (cfg.heading !== BUILDING_CHECKS_HEADING) {
    throw new Error(`required-block heading must be "${BUILDING_CHECKS_HEADING}" (got ${JSON.stringify(cfg.heading)})`);
  }
  if (rel !== DEVELOPER_ROLE_REL) {
    throw new Error(`required-block path must be ${DEVELOPER_ROLE_REL} (got ${rel})`);
  }
  return extractBuildingChecksSection(md);
}

export function renderDeveloperBuildingChecksMdc(section: string, sectionSha: string): string {
  const header =
    `${GENERATED_HEADER_PREFIX}${DEVELOPER_ROLE_REL}, heading "${BUILDING_CHECKS_HEADING}", section-sha ${sectionSha} (git hash-object of the extracted section) — run: node scripts/gen-cursor-rules.mjs -->\n`;
  return `---
description: Building checks from ${DEVELOPER_ROLE_REL} (generated; do not edit).
alwaysApply: true
---

${header}${section}`;
}

/** Parse `section-sha <hex>` from the generated header comment. */
export function parseSectionShaFromMdc(mdc: string): string | null {
  const m = normalizeLf(mdc).match(/section-sha ([0-9a-f]{40})/);
  return m?.[1] ?? null;
}

export function expectedDeveloperBuildingChecksMdc(projectRoot: string): string {
  const section = buildingChecksSectionFromRoot(projectRoot);
  // F8-r2-(i) mutant: hashes the whole role file, not the extracted section
  const sha = gitHashObjectStdin(normalizeLf(readDeveloperRoleMarkdown(projectRoot)));
  return renderDeveloperBuildingChecksMdc(section, sha);
}

/** Write `.cursor/rules/developer-building-checks.mdc` when content differs. Returns whether the file changed. */
export function writeDeveloperBuildingChecksMdc(projectRoot: string): { changed: boolean; path: string } {
  const path = join(projectRoot, DEVELOPER_BUILDING_CHECKS_MDC_REL);
  const next = expectedDeveloperBuildingChecksMdc(projectRoot);
  const prev = existsSync(path) ? normalizeLf(readFileSync(path, "utf8")) : null;
  if (prev === normalizeLf(next)) return { changed: false, path };
  writeFileSync(path, next, "utf8");
  return { changed: true, path };
}

/** A2: FAIL when the generated Cursor rule drifts from the role file section. */
export function checkCursorRulesCurrent(projectRoot: string): CheckResult {
  const name = "cursor-rules-current";
  const path = join(projectRoot, DEVELOPER_BUILDING_CHECKS_MDC_REL);
  try {
    const expected = expectedDeveloperBuildingChecksMdc(projectRoot);
    if (!existsSync(path)) {
      return {
        name,
        severity: "issue",
        message: `${DEVELOPER_BUILDING_CHECKS_MDC_REL} missing — run node scripts/gen-cursor-rules.mjs`,
      };
    }
    const actual = normalizeLf(readFileSync(path, "utf8"));
    if (actual !== normalizeLf(expected)) {
      return {
        name,
        severity: "issue",
        message: `${DEVELOPER_BUILDING_CHECKS_MDC_REL} is out of date with ${DEVELOPER_ROLE_REL} — run node scripts/gen-cursor-rules.mjs`,
      };
    }
    return { name, severity: "pass", message: `${DEVELOPER_BUILDING_CHECKS_MDC_REL} matches ${DEVELOPER_ROLE_REL}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { name, severity: "issue", message: `cursor-rules-current: ${msg}` };
  }
}
