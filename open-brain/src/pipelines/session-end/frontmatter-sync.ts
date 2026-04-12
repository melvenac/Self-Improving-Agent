import type { FeedbackResult, FrontmatterField, FrontmatterSyncResult } from "./types.js";

/**
 * Extracts YAML frontmatter from a markdown string.
 * Returns { frontmatter, body } or null if no frontmatter found.
 */
export function parseFrontmatter(markdown: string): { frontmatter: string; body: string } | null {
  // Must start with ---
  if (!markdown.startsWith("---")) return null;

  const afterFirst = markdown.slice(3);
  // Find the closing ---
  const closeIndex = afterFirst.search(/\n---(\n|$)/);
  if (closeIndex === -1) return null;

  const frontmatter = afterFirst.slice(0, closeIndex);
  // Body starts after the closing ---\n
  const body = afterFirst.slice(closeIndex + 4); // skip \n---\n

  return { frontmatter: frontmatter.replace(/^\n/, ""), body };
}

/**
 * Updates named fields within a YAML frontmatter string.
 * Existing fields are replaced in-place; missing fields are appended at end.
 * All other fields (id, key, domain, etc.) are preserved exactly.
 */
export function updateFrontmatter(frontmatter: string, fields: FrontmatterField): string {
  const fieldEntries = Object.entries(fields) as [keyof FrontmatterField, FrontmatterField[keyof FrontmatterField]][];
  let result = frontmatter;

  const updated = new Set<string>();

  // Replace existing fields in-place
  for (const [key, value] of fieldEntries) {
    const regex = new RegExp(`^(${key}:\\s*).*$`, "m");
    if (regex.test(result)) {
      result = result.replace(regex, `${key}: ${value}`);
      updated.add(key);
    }
  }

  // Append missing fields at end
  const missing = fieldEntries.filter(([key]) => !updated.has(key));
  if (missing.length > 0) {
    const suffix = missing.map(([key, value]) => `${key}: ${value}`).join("\n");
    result = result.trimEnd() + "\n" + suffix;
  }

  return result;
}

/**
 * Batch-syncs frontmatter counters from DB back to vault .md files.
 * One file write per unique entryId.
 *
 * @param feedbackResults  - Results from auto-feedback stage
 * @param vaultExperiencesPath - Absolute path to experiences directory in vault
 * @param readFile  - Injected FS read; returns null if file missing
 * @param writeFile - Injected FS write
 * @param getCounters - Get latest counters from DB for an entryId
 */
export function syncFrontmatter(
  feedbackResults: FeedbackResult[],
  vaultExperiencesPath: string,
  readFile: (path: string) => string | null,
  writeFile: (path: string, content: string) => void,
  getCounters: (id: number) => FrontmatterField | null
): FrontmatterSyncResult {
  const result: FrontmatterSyncResult = {
    filesUpdated: 0,
    filesSkipped: 0,
    errors: [],
  };

  // Deduplicate by entryId — keep first occurrence (key should be stable)
  const seen = new Map<number, FeedbackResult>();
  for (const fb of feedbackResults) {
    if (!seen.has(fb.entryId)) {
      seen.set(fb.entryId, fb);
    }
  }

  for (const [id, fb] of seen) {
    try {
      // Sanitize key for filesystem safety (keys should be slugs, but guard against slashes/specials)
      const safeKey = fb.key.replace(/[<>:"/\\|?*]/g, "-");
      const filePath = `${vaultExperiencesPath}/${id}-${safeKey}.md`;

      // Get latest counters from DB
      const counters = getCounters(id);
      if (counters === null) {
        result.filesSkipped++;
        continue;
      }

      // Read vault file
      const content = readFile(filePath);
      if (content === null) {
        result.filesSkipped++;
        continue;
      }

      // Parse frontmatter
      const parsed = parseFrontmatter(content);
      if (parsed === null) {
        result.filesSkipped++;
        continue;
      }

      // Update frontmatter with latest counters
      const updatedFm = updateFrontmatter(parsed.frontmatter, counters);

      // Reconstruct file: ---\n{frontmatter}\n---\n{body}
      const newContent = `---\n${updatedFm}\n---\n${parsed.body}`;

      writeFile(filePath, newContent);
      result.filesUpdated++;
    } catch (err) {
      result.errors.push(`Entry ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
