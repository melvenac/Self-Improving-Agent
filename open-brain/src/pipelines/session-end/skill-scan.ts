import type { SkillCluster, SkillScanResult } from "./types.js";

export interface ExperienceFile {
  name: string;
  content: string;
}

const NOISE_TAGS = new Set(["test", "marker", "gotcha", "pattern", "fix", "optimization", "debug"]);

/**
 * Parse YAML frontmatter for `tags` and `domain` fields.
 * Handles both inline array and YAML list syntax.
 */
export function parseExperienceTags(content: string): string[] {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return [];

  const fm = fmMatch[1];
  const tags: string[] = [];

  function parseField(fieldName: string): void {
    // Inline array: tags: [a, b, c]
    const inlineMatch = fm.match(new RegExp(`^${fieldName}:\\s*\\[([^\\]]+)\\]`, "m"));
    if (inlineMatch) {
      const items = inlineMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
      tags.push(...items);
      return;
    }

    // YAML list:
    // tags:
    //   - a
    //   - b
    const listMatch = fm.match(new RegExp(`^${fieldName}:\\s*\\n((?:\\s+-\\s+.+\\n?)*)`, "m"));
    if (listMatch) {
      const items = listMatch[1]
        .split("\n")
        .map((line) => line.replace(/^\s+-\s+/, "").trim())
        .filter(Boolean);
      tags.push(...items);
      return;
    }

    // Scalar value: domain: some-value
    const scalarMatch = fm.match(new RegExp(`^${fieldName}:\\s+(\\S+)`, "m"));
    if (scalarMatch) {
      tags.push(scalarMatch[1].trim());
    }
  }

  parseField("tags");
  parseField("domain");

  // Filter noise and deduplicate
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    if (!NOISE_TAGS.has(tag) && !seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
    }
  }
  return result;
}

/**
 * Group filenames by shared tags.
 */
export function clusterByTag(files: { name: string; tags: string[] }[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const file of files) {
    for (const tag of file.tags) {
      if (!map.has(tag)) map.set(tag, []);
      map.get(tag)!.push(file.name);
    }
  }
  return map;
}

/**
 * Detect cluster status changes relative to previous counts.
 * Only returns clusters at or above threshold.
 */
export function detectChanges(
  current: Map<string, string[]>,
  previous: Map<string, number>,
  threshold: number = 3
): SkillCluster[] {
  const result: SkillCluster[] = [];
  for (const [tag, files] of current) {
    const count = files.length;
    if (count < threshold) continue;

    const prevCount = previous.get(tag);
    let status: SkillCluster["status"];
    if (prevCount === undefined) {
      status = "new";
    } else if (count > prevCount) {
      status = "growing";
    } else {
      status = "stable";
    }

    result.push({ tag, count, files, status });
  }
  return result;
}

/**
 * Merge clusters with file overlap above overlapThreshold.
 * Overlap ratio = intersection / min(sizeA, sizeB).
 */
export function consolidateClusters(
  clusters: SkillCluster[],
  overlapThreshold: number = 0.6
): SkillCluster[] {
  // Work on a copy; track which indices have been absorbed
  const active = clusters.map((c) => ({ ...c, files: [...c.files], consolidatedFrom: c.consolidatedFrom ? [...c.consolidatedFrom] : undefined }));
  const absorbed = new Set<number>();

  for (let i = 0; i < active.length; i++) {
    if (absorbed.has(i)) continue;
    for (let j = i + 1; j < active.length; j++) {
      if (absorbed.has(j)) continue;

      const setA = new Set(active[i].files);
      const setB = new Set(active[j].files);
      const intersection = active[j].files.filter((f) => setA.has(f));
      const ratio = intersection.length / Math.min(setA.size, setB.size);

      if (ratio > overlapThreshold) {
        // Primary (i) absorbs secondary (j)
        // Add unique files from j into i
        const uniqueFromJ = active[j].files.filter((f) => !setA.has(f));
        active[i].files.push(...uniqueFromJ);
        active[i].count = active[i].files.length;

        // Track consolidation provenance
        if (!active[i].consolidatedFrom) active[i].consolidatedFrom = [];
        active[i].consolidatedFrom!.push(active[j].tag);
        if (active[j].consolidatedFrom) {
          active[i].consolidatedFrom!.push(...active[j].consolidatedFrom!);
        }

        absorbed.add(j);
      }
    }
  }

  return active.filter((_, idx) => !absorbed.has(idx));
}

/**
 * Full pipeline: parse → cluster → detect approaching → detect changes → consolidate.
 */
export function scanForSkills(
  experienceFiles: ExperienceFile[],
  previousCounts: Map<string, number>,
  threshold: number = 3
): SkillScanResult {
  if (experienceFiles.length === 0) {
    return { clusters: [], pendingProposals: 0, approaching: 0 };
  }

  // Parse tags from each file
  const tagged = experienceFiles.map((f) => ({
    name: f.name,
    tags: parseExperienceTags(f.content),
  }));

  // Cluster by tag
  const tagMap = clusterByTag(tagged);

  // Count approaching (threshold-1 = 2 files)
  const approachingThreshold = threshold - 1;
  let approaching = 0;
  for (const files of tagMap.values()) {
    if (files.length === approachingThreshold) approaching++;
  }

  // Detect changes at or above threshold
  const clusters = detectChanges(tagMap, previousCounts, threshold);

  // Consolidate overlapping clusters
  const consolidated = consolidateClusters(clusters);

  // Count pending proposals (new or growing)
  const pendingProposals = consolidated.filter(
    (c) => c.status === "new" || c.status === "growing"
  ).length;

  return { clusters: consolidated, pendingProposals, approaching };
}
