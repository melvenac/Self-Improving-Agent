import { mkdirSync, writeFileSync, existsSync, renameSync } from "fs";
import { join, dirname, relative, isAbsolute } from "path";
import {
  assertPathUnderDir,
  joinUnderVaultDir,
  safeVaultPathSegment,
  VaultPathRefusal,
} from "./shared/vault-path-segment.js";

/** Session summary filenames use `YYYY-MM-DD`; reject traversal in `date` before building paths (T-247 H1). */
const SUMMARY_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
import { yamlInlineArray, yamlScalar } from "./shared/yaml-frontmatter.js";

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface ExperienceInput {
  key: string;
  tags: string[];
  content: string;
  created: string;
  maturity: "progenitor" | "proven" | "mature";
  helpful: number;
  harmful: number;
  neutral: number;
  project: string;
  source: string;
}

export interface FailureInput {
  key: string;
  tags: string[];
  attempted: string;
  why_failed: string;
  what_worked: string;
  created: string;
  project: string;
}

export interface SummaryInput {
  sessionId: string;
  project: string;
  date: string;
  content: string;
}

// ─── slugify ─────────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ") // replace non-alphanumeric (except hyphens) with space
    .replace(/[\s_-]+/g, "-")        // collapse whitespace/underscores/hyphens to single hyphen
    .replace(/^-+|-+$/g, "");        // trim leading/trailing hyphens
}

export { parseFrontmatter } from "./shared/parse-frontmatter.js";

// ─── writeExperience ─────────────────────────────────────────────────────────

/**
 * Where an experience note for this key lives.
 *
 * Exported because a caller that gets `null` from `writeExperience` needs to
 * know *which* file blocked it — an existing note is only a real conflict if
 * the index also knows about it.
 */
export function experiencePath(vaultDir: string, project: string, key: string): string {
  const projectSeg = safeVaultPathSegment("project", project);
  const experiencesDir = join(vaultDir, "Experiences");
  return joinUnderVaultDir(experiencesDir, projectSeg, `${slugify(key)}.md`);
}

/**
 * Move a note out of the active corpus into `Archive/`, preserving its relative
 * path, and return the new location.
 *
 * Deleting the index row while leaving the markdown was the divergence found in
 * the v0.12.0 audit: `skill-scan` reads `Experiences/` recursively, so a deleted
 * entry kept inflating skill clusters while being unreachable by `ob_recall`.
 * Moving rather than unlinking is deliberate — irreversibly destroying a
 * human-readable note is the wrong default (apoptosis, once the automatic
 * caller, is cut; `ob_forget` is the caller now). `Archive/` sits outside the scanned directories, so nothing
 * downstream has to remember to skip it.
 *
 * Returns null when there is nothing to move, or when the path lies outside the
 * vault — a row pointing elsewhere is not this function's to relocate.
 */
export function archiveVaultNote(vaultDir: string, vaultPath: string | null): string | null {
  if (!vaultPath || !existsSync(vaultPath)) return null;

  const rel = relative(vaultDir, vaultPath);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return null;

  const base = join(vaultDir, "Archive", rel);
  mkdirSync(dirname(base), { recursive: true });

  // Two notes of the same name archived from different folders must not collide.
  let dest = base;
  for (let n = 1; existsSync(dest); n++) dest = base.replace(/\.md$/, `-${n}.md`);

  renameSync(vaultPath, dest);
  return dest;
}

export function writeExperience(
  vaultDir: string,
  input: ExperienceInput
): string | null {
  const filePath = experiencePath(vaultDir, input.project, input.key);

  if (existsSync(filePath)) return null;

  const frontmatter = [
    "---",
    `key: ${yamlScalar(input.key)}`,
    `tags: ${yamlInlineArray(input.tags)}`,
    `created: ${yamlScalar(input.created)}`,
    `maturity: ${yamlScalar(input.maturity)}`,
    `helpful: ${input.helpful}`,
    `harmful: ${input.harmful}`,
    `neutral: ${input.neutral}`,
    `project: ${yamlScalar(input.project)}`,
    `source: ${yamlScalar(input.source)}`,
    "---",
  ].join("\n");

  const fileContent = `${frontmatter}\n\n${input.content}\n`;

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, fileContent, "utf-8");

  return filePath;
}

// ─── writeFailure ────────────────────────────────────────────────────────────

export function writeFailure(
  vaultDir: string,
  input: FailureInput
): string | null {
  const keySlug = slugify(input.key);
  const projectSeg = safeVaultPathSegment("project", input.project);
  const experiencesDir = join(vaultDir, "Experiences");
  const filePath = joinUnderVaultDir(experiencesDir, projectSeg, `failure-${keySlug}.md`);

  if (existsSync(filePath)) return null;

  const frontmatter = [
    "---",
    `key: ${yamlScalar(input.key)}`,
    `type: failure`,
    `tags: ${yamlInlineArray(input.tags)}`,
    `created: ${yamlScalar(input.created)}`,
    `project: ${yamlScalar(input.project)}`,
    "---",
  ].join("\n");

  const body = [
    "## What was attempted",
    "",
    input.attempted,
    "",
    "## Why it failed",
    "",
    input.why_failed,
    "",
    "## What worked instead",
    "",
    input.what_worked,
  ].join("\n");

  const fileContent = `${frontmatter}\n\n${body}\n`;

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, fileContent, "utf-8");

  return filePath;
}

// ─── writeSummary ─────────────────────────────────────────────────────────────

export function writeSummary(
  vaultDir: string,
  input: SummaryInput
): string | null {
  if (!SUMMARY_DATE_RE.test(input.date)) {
    throw new VaultPathRefusal(`summary date must be YYYY-MM-DD, got "${input.date}"`);
  }
  const projectSlug = slugify(safeVaultPathSegment("project", input.project));
  const summariesDir = join(vaultDir, "Summaries");
  const filePath = joinUnderVaultDir(summariesDir, `${input.date}-${projectSlug}.md`);

  if (existsSync(filePath)) return null;

  // `tags` carries the project slug and a type marker. Before this, a summary's
  // only frontmatter was sessionId/project/date — no tags and no links — which
  // is why all 158 of them sat outside the graph entirely. The topics generator
  // groups summaries by `project` and reads `tags` when present; emitting both
  // means a summary is reachable the moment it is written rather than whenever
  // someone next thinks to build an index by hand.
  const projectSlugTag = slugify(input.project);
  const tags = [projectSlugTag, "session-summary"].filter(Boolean);

  const frontmatter = [
    "---",
    `sessionId: ${yamlScalar(input.sessionId)}`,
    `project: ${yamlScalar(input.project)}`,
    `date: ${yamlScalar(input.date)}`,
    `tags: ${yamlInlineArray(tags)}`,
    "---",
  ].join("\n");

  const fileContent = `${frontmatter}\n\n${input.content}\n`;

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, fileContent, "utf-8");

  return filePath;
}
