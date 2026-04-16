import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";

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

// ─── parseFrontmatter ────────────────────────────────────────────────────────

export function parseFrontmatter(raw: string): Record<string, unknown> {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const result: Record<string, unknown> = {};
  const lines = match[1].split(/\r?\n/);

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();

    if (!key) continue;

    // Array: [a, b, c]
    if (value.startsWith("[") && value.endsWith("]")) {
      const inner = value.slice(1, -1);
      if (inner.trim() === "") {
        result[key] = [];
      } else {
        result[key] = inner.split(",").map((s) => s.trim());
      }
      continue;
    }

    // Number
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      result[key] = Number(value);
      continue;
    }

    result[key] = value;
  }

  return result;
}

// ─── writeExperience ─────────────────────────────────────────────────────────

export function writeExperience(
  vaultDir: string,
  input: ExperienceInput
): string | null {
  const keySlug = slugify(input.key);
  const filePath = join(vaultDir, "Experiences", input.project, `${keySlug}.md`);

  if (existsSync(filePath)) return null;

  const tagsInline = input.tags.join(", ");
  const frontmatter = [
    "---",
    `key: ${input.key}`,
    `tags: [${tagsInline}]`,
    `created: ${input.created}`,
    `maturity: ${input.maturity}`,
    `helpful: ${input.helpful}`,
    `harmful: ${input.harmful}`,
    `neutral: ${input.neutral}`,
    `project: ${input.project}`,
    `source: ${input.source}`,
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
  const filePath = join(
    vaultDir,
    "Experiences",
    input.project,
    `failure-${keySlug}.md`
  );

  if (existsSync(filePath)) return null;

  const tagsInline = input.tags.join(", ");
  const frontmatter = [
    "---",
    `key: ${input.key}`,
    `type: failure`,
    `tags: [${tagsInline}]`,
    `created: ${input.created}`,
    `project: ${input.project}`,
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
  const projectSlug = slugify(input.project);
  const filePath = join(
    vaultDir,
    "Summaries",
    `${input.date}-${projectSlug}.md`
  );

  if (existsSync(filePath)) return null;

  const frontmatter = [
    "---",
    `sessionId: ${input.sessionId}`,
    `project: ${input.project}`,
    `date: ${input.date}`,
    "---",
  ].join("\n");

  const fileContent = `${frontmatter}\n\n${input.content}\n`;

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, fileContent, "utf-8");

  return filePath;
}
