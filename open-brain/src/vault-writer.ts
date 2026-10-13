import { mkdirSync, writeFileSync, existsSync, renameSync, readFileSync } from "fs";
import { join, dirname, relative, isAbsolute, basename } from "path";
import { parseFrontmatter } from "./shared/parse-frontmatter.js";
import {
  joinUnderVaultDir,
  safeVaultPathSegment,
  VaultPathRefusal,
} from "./shared/vault-path-segment.js";
import { yamlInlineArray, yamlScalar } from "./shared/yaml-frontmatter.js";

const SUMMARY_DATE_SHAPE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Reject bad shape and non-calendar dates before any vault path is built (T-247 H1, QA 290 J1). */
export function assertValidSummaryDate(date: string): void {
  if (!SUMMARY_DATE_SHAPE_RE.test(date)) {
    throw new VaultPathRefusal(`summary date must be YYYY-MM-DD, got "${date}"`);
  }
  let roundTrip: string;
  try {
    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new VaultPathRefusal(`summary date is not a valid calendar date, got "${date}"`);
    }
    roundTrip = parsed.toISOString().slice(0, 10);
  } catch (err) {
    if (err instanceof VaultPathRefusal) throw err;
    throw new VaultPathRefusal(`summary date is not a valid calendar date, got "${date}"`);
  }
  if (roundTrip !== date) {
    throw new VaultPathRefusal(`summary date is not a valid calendar date, got "${date}"`);
  }
}

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

export function experienceFrontmatter(input: ExperienceInput): string {
  return [
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
}

export function writeExperience(
  vaultDir: string,
  input: ExperienceInput
): string | null {
  const filePath = experiencePath(vaultDir, input.project, input.key);

  if (existsSync(filePath)) return null;

  const fileContent = `${experienceFrontmatter(input)}\n\n${input.content}\n`;

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, fileContent, "utf-8");

  return filePath;
}

// ─── state notes (T-022) ─────────────────────────────────────────────────────

/**
 * A note's body: everything after its frontmatter, BOM stripped, CRLF or LF.
 * A note with no frontmatter is all body.
 */
export function noteBody(raw: string): string {
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n)?([\s\S]*)$/.exec(text)?.[1] ?? text;
}

/**
 * Split a state note's body into its current value and its `## Log`.
 *
 * The log starts at the first line that is exactly `## Log`; `log` is what
 * follows that heading. A body with no log is all current. Lines come back
 * LF-joined whatever the file used.
 */
export function splitStateLog(body: string): { current: string; log: string } {
  const lines = (body.charCodeAt(0) === 0xfeff ? body.slice(1) : body).split(/\r?\n/);
  const at = lines.indexOf("## Log");
  if (at === -1) return { current: lines.join("\n"), log: "" };
  return { current: lines.slice(0, at).join("\n"), log: lines.slice(at + 1).join("\n") };
}

/**
 * Rewrite a state note with a new current value, demoting the previous one to
 * the top of its `## Log` (newest first). The frontmatter carries the new tags
 * and source but the note's ORIGINAL `created`. Written to a temp file in the
 * same directory and renamed into place, so a crash never leaves half a note.
 */
export function replaceStateNote(path: string, input: ExperienceInput, demotedAt: string): void {
  const raw = readFileSync(path, "utf-8");
  const created = parseFrontmatter(raw).created;
  const { current, log } = splitStateLog(noteBody(raw));

  const frontmatter = experienceFrontmatter({
    ...input,
    created: created === undefined ? input.created : String(created),
  });
  const older = log.trim();
  const entries = `### Replaced ${demotedAt}\n\n${current.trim()}${older ? `\n\n${older}` : ""}`;
  const fileContent = `${frontmatter}\n\n${input.content}\n\n## Log\n\n${entries}\n`;

  const tmp = join(dirname(path), `.${basename(path)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tmp, fileContent, "utf-8");
  renameSync(tmp, path);
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
  assertValidSummaryDate(input.date);
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
